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
import type { ServiceInputs } from '@opsagents/core';

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
  triggerReason: incidentTrigger.triggerReason,
  metadata: {
    channels: channels.map((c: any) => c.id),
    affectedChannels: incidentTrigger.affectedChannels,
    deploymentVersion: incidentTrigger.deploymentVersion,
    severity: incidentTrigger.severity,
    impactDescription: incidentTrigger.impactDescription,
    latencyMetrics: latencyMetrics.metrics,
  }
};

const sharedState = {
  outputDir: 'dist/exec-comms/epg-demo',
};

console.log('🤖 Starting MetaController orchestration...');
console.log('   Running 4 controllers in parallel:');
console.log('   • IncidentController (7 agents)');
console.log('   • DeploymentController');
console.log('   • MonitoringController');
console.log('   • InfrastructureController\n');

const meta = new MetaController();

try {
  const startTime = Date.now();
  const result = await meta.runOrchestration(inputs, sharedState);
  const elapsed = Date.now() - startTime;

  console.log(`\n✅ Orchestration complete in ${elapsed}ms\n`);
  console.log('═══════════════════════════════════════════════════');
  console.log('📋 Results by Controller:');

  for (const [controllerId, controllerResult] of Object.entries(result.controllerResults ?? {})) {
    const status = (controllerResult as any)?.status ?? 'unknown';
    const emoji = status === 'success' ? '✅' : status === 'escalated' ? '⚠️' : '❌';
    console.log(`\n  ${emoji} ${controllerId}: ${status}`);

    const agentResults = (controllerResult as any)?.agentResults ?? {};
    for (const [agentId, agentResult] of Object.entries(agentResults)) {
      const aStatus = (agentResult as any)?.status ?? 'unknown';
      const aEmoji = aStatus === 'success' ? '  ✓' : aStatus === 'skipped' ? '  ⏭' : '  ⚠';
      console.log(`    ${aEmoji} ${agentId}: ${aStatus}`);
    }
  }

  // Show exec-comms output location
  const incidentResult = result.controllerResults?.['incident'] as any;
  const execCommsOutput = incidentResult?.agentResults?.['executive-communication']?.output;
  if (execCommsOutput) {
    console.log(`\n📧 Executive Communications written to: ${execCommsOutput.outputDir}/`);
    console.log(`   • slack_payload.json`);
    console.log(`   • executive-email.md`);
    console.log(`   • dashboard-summary.json`);
  }

  // Show code fix PR if created
  const codeFixOutput = incidentResult?.agentResults?.['code-fix']?.output;
  if (codeFixOutput?.pr_url) {
    console.log(`\n🔧 Auto-fix PR: ${codeFixOutput.pr_url}`);
  } else {
    console.log(`\n🔧 Auto-fix PR: Not created (demo mode - no real git repo)`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('🎬 Demo complete! OpsAgents handled the EPG incident autonomously.');
  console.log('📺 All channels restored. BBC One 21:00-23:00 gap resolved.\n');

} catch (error) {
  console.error('\n❌ Orchestration failed:', error);
  process.exit(1);
}
