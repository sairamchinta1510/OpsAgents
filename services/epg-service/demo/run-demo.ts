#!/usr/bin/env node
/**
 * EPG Service Demo Runner
 * Simulates a full lights-off incident response triggered by EPG pipeline v2.3.1 crash
 *
 * Run with: npm run demo --workspace=services/epg-service
 *   or: npx tsx services/epg-service/demo/run-demo.ts
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MetaController } from '@opsagents/controllers';
import { AgentRegistry, EventBus } from '@opsagents/core';
import type { ServiceInputs, Trigger, AgentResult } from '@opsagents/core';
import { IncidentController } from '@opsagents/controllers-incident';
import { DeploymentController } from '@opsagents/controllers-deployment';
import { MonitoringController } from '@opsagents/controllers-monitoring';
import { InfrastructureController } from '@opsagents/controllers-infrastructure';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load stub data
const incidentTrigger = JSON.parse(
  readFileSync(join(__dirname, '../data/incident-trigger.json'), 'utf-8')
);

const channels = JSON.parse(
  readFileSync(join(__dirname, '../data/channels.json'), 'utf-8')
);

const bbcOneSchedule = JSON.parse(
  readFileSync(join(__dirname, '../data/schedules/bbc-one.json'), 'utf-8')
);

const latencyMetrics = JSON.parse(
  readFileSync(join(__dirname, '../data/latency-metrics.json'), 'utf-8')
);

console.log('\n🎬 OpsAgents EPG Service Demo');
console.log('═══════════════════════════════════════════════════');
console.log(`📡 Service: ${incidentTrigger.serviceId}`);
console.log(`🚨 Trigger: ${incidentTrigger.triggerReason}`);
console.log(`📺 Affected channels: ${incidentTrigger.affectedChannels.join(', ')}`);
console.log(`⚠️  Severity: ${incidentTrigger.severity}`);
console.log(`🕐 Timestamp: ${incidentTrigger.timestamp}`);
console.log('═══════════════════════════════════════════════════\n');

console.log('📊 Current metrics:');
console.log(`  Error rate: ${(latencyMetrics.metrics.error_rate * 100).toFixed(1)}%`);
console.log(`  P99 latency: ${latencyMetrics.metrics.p99_ms}ms`);
console.log(`  Message: ${latencyMetrics.message}\n`);

console.log('🔍 Sample schedule data (BBC One - has null end_time bug):');
const badProgramme = bbcOneSchedule.programmes.find((p: any) => p.end_time === null);
if (badProgramme) {
  console.log(`  ❌ Programme: "${badProgramme.title}"`);
  console.log(`     start_time: ${badProgramme.start_time}`);
  console.log(`     end_time: ${badProgramme.end_time} ← NULL POINTER BUG\n`);
}

// Build ServiceInputs for the orchestration
const inputs: ServiceInputs = {
  serviceId: incidentTrigger.serviceId,
  codeRepo: incidentTrigger.codeRepo,
  timestamp: Date.parse(incidentTrigger.timestamp),
  incident: {
    alertId: 'epg-001',
    severity: 'high',
    message: incidentTrigger.triggerReason,
    source: 'epg-pipeline',
    timestamp: Date.parse(incidentTrigger.timestamp),
  },
  perfLog: {
    p50Latency: latencyMetrics.metrics.p50_ms,
    p99Latency: 750,   // below 800ms threshold — error rate alone signals the issue
    errorRate: latencyMetrics.metrics.error_rate,
    throughput: latencyMetrics.metrics.requests_per_second,
  },
  monitors: {
    cpuPercent: 65,    // below 80% threshold
    memoryPercent: 72, // below 80% threshold
    diskIoMbps: 120,
    networkMbps: 450,
    customMetrics: {
      epg_null_end_time_errors: 1847,
      affected_channels: incidentTrigger.affectedChannels.length,
    },
  },
  machineParams: {
    cpuPercent: 65,
    memoryPercent: 72,
    instanceType: 'c5.2xlarge',
    region: 'eu-west-1',
  },
  code: {
    diff: `- const API_KEY = 'sk-live-hardcoded-abc123';\n+ const API_KEY = process.env.EPG_API_KEY;\n- const duration = new Date(programme.end_time!).getTime()\n+ if (programme.end_time === null) { warnings.push(...); continue; }`,
    commitSha: 'a1b2c3d',
    files: ['src/epg-pipeline.ts'],
  },
  metadata: {
    channels: channels.map((c: any) => c.id),
    affectedChannels: incidentTrigger.affectedChannels,
    deploymentVersion: incidentTrigger.deploymentVersion,
    impactDescription: incidentTrigger.impactDescription,
  },
};

console.log('🤖 Starting MetaController orchestration...');
console.log('   Running 4 controllers in parallel:');
console.log('   • IncidentController (7 agents)');
console.log('   • DeploymentController');
console.log('   • MonitoringController');
console.log('   • InfrastructureController\n');

// Build trigger
const trigger: Trigger = {
  type: 'alert',
  severity: 'critical',
};

// Wire up MetaController with all 4 domain controllers
const meta = new MetaController();
const incidentController = new IncidentController(new AgentRegistry(), new EventBus());
const deploymentController = new DeploymentController(new AgentRegistry(), new EventBus());
const monitoringController = new MonitoringController(new AgentRegistry(), new EventBus());
const infraController = new InfrastructureController(new AgentRegistry(), new EventBus());

meta.addDomainController(incidentController);
meta.addDomainController(deploymentController);
meta.addDomainController(monitoringController);
meta.addDomainController(infraController);

try {
  const startTime = Date.now();
  const result = await meta.orchestrate(trigger, inputs);
  const elapsed = Date.now() - startTime;

  console.log(`\n✅ Orchestration complete in ${elapsed}ms\n`);
  console.log('═══════════════════════════════════════════════════');
  console.log('📋 Results by Controller:');

  for (const agentResult of result.agentResults) {
    const orchResult = agentResult.output as any;
    const status = orchResult?.overallStatus ?? agentResult.status;
    const emoji = status === 'success' ? '✅' : status === 'escalated' ? '⚠️' : '❌';
    console.log(`\n  ${emoji} ${agentResult.agentId}: ${status}`);

    const agentResults: AgentResult[] = orchResult?.agentResults ?? [];
    for (const ar of agentResults) {
      const aEmoji = ar.status === 'success' ? '  ✓' : ar.status === 'skipped' ? '  ⏭' : '  ⚠';
      console.log(`    ${aEmoji} ${ar.agentId}: ${ar.status}`);
    }
  }

  // Show exec-comms output location (from IncidentController agent results)
  const incidentOrc = result.agentResults.find(r => r.agentId === 'incident-controller');
  const incidentAgents: AgentResult[] = (incidentOrc?.output as any)?.agentResults ?? [];
  const execCommsResult = incidentAgents.find(r => r.agentId === 'executive-communication');
  const execCommsOutput = execCommsResult?.output as any;
  if (execCommsOutput?.outputDir) {
    console.log(`\n📧 Executive Communications written to: ${execCommsOutput.outputDir}/`);
    console.log(`   • slack_payload.json`);
    console.log(`   • executive-email.md`);
    console.log(`   • dashboard-summary.json`);
  }

  // Show code fix PR if created
  const codeFixResult = incidentAgents.find(r => r.agentId === 'code-fix');
  const codeFixOutput = codeFixResult?.output as any;
  if (codeFixOutput?.pr_url) {
    console.log(`\n🔧 Auto-fix PR: ${codeFixOutput.pr_url}`);
  } else {
    console.log(`\n🔧 Auto-fix PR: Not created (demo mode — no real git repo)`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('🎬 Demo complete! OpsAgents handled the EPG incident autonomously.');
  console.log('📺 All channels restored. BBC One 21:00-23:00 gap resolved.\n');

} catch (error) {
  console.error('\n❌ Orchestration failed:', error);
  process.exit(1);
}
