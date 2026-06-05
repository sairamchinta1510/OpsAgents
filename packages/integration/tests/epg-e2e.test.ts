import { readFileSync } from 'fs';
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry, EventBus } from '@opsagents/core';
import { IncidentController } from '@opsagents/controllers-incident';
import type { ServiceInputs } from '@opsagents/core';

const triggerData = JSON.parse(
  readFileSync(new URL('../../../services/epg-service/data/incident-trigger.json', import.meta.url), 'utf8'),
) as {
  serviceId: string;
  codeRepo: string;
  deploymentVersion: string;
  triggerReason: string;
  affectedChannels: string[];
  impactDescription: string;
  timestamp: string;
  severity: string;
};

const epgInputs: ServiceInputs = {
  serviceId: triggerData.serviceId,
  codeRepo: triggerData.codeRepo,
  timestamp: new Date(triggerData.timestamp).getTime(),
  incident: {
    alertId: 'epg-inc-001',
    // Map P1 → 'medium' so IssueIdentificationAgent does not immediately escalate,
    // allowing the full pipeline (RCA, CodeFix, etc.) to run.
    severity: 'medium',
    message: triggerData.impactDescription,
    source: 'epg-pipeline',
    timestamp: new Date(triggerData.timestamp).getTime(),
  },
  monitors: {
    cpuPercent: 45,    // below 80 threshold — no blast-radius expansion
    memoryPercent: 50, // below 80 threshold
    diskIoMbps: 6,
    networkMbps: 3,
  },
  perfLog: {
    p50Latency: 80,
    p99Latency: 600,   // >500 → gives RCA a 'medium'-confidence hypothesis (success)
    errorRate: 0.02,   // below 0.05 threshold
    throughput: 50,
  },
  machineParams: {
    cpuPercent: 45,
    memoryPercent: 50,
    nodeCount: 2,
    availabilityZone: 'eu-west-1a',
  },
};

describe('EPG Service e2e incident response', () => {
  let controller: IncidentController;

  const mockShellRunner = (cmd: string): string => {
    if (cmd.includes('gh pr create')) return 'https://github.com/opsagents/epg-service/pull/42';
    if (cmd.includes('git diff --name-only')) return 'src/epg-pipeline.ts\n';
    return '';
  };

  beforeEach(() => {
    controller = new IncidentController(new AgentRegistry(), new EventBus(), {
      codeFixShellRunner: mockShellRunner,
    });
  });

  it('runs IncidentController against EPG service scenario', async () => {
    const result = await controller.orchestrate(epgInputs);
    expect(result.orchestration.overallStatus).not.toBe('failure');
  });

  it('identifies issue for EPG service', async () => {
    const result = await controller.orchestrate(epgInputs);
    const issueResult = result.results.find((r) => r.agentId === 'issue-identification');
    expect(issueResult).toBeDefined();
    expect(issueResult!.status).toBe('success');
  });

  it('performs root cause analysis', async () => {
    const result = await controller.orchestrate(epgInputs);
    const rcaResult = result.results.find((r) => r.agentId === 'root-cause-analysis');
    expect(rcaResult).toBeDefined();
    expect(rcaResult!.status).toBe('success');
  });

  it('code fix agent runs and escalates (no real git)', async () => {
    const result = await controller.orchestrate(epgInputs);
    const codeFixResult = result.results.find((r) => r.agentId === 'code-fix');
    expect(codeFixResult).toBeDefined();
  });

  it('reporting agent always runs', async () => {
    const result = await controller.orchestrate(epgInputs);
    const reportResult = result.results.find((r) => r.agentId === 'reporting');
    expect(reportResult).toBeDefined();
    expect(reportResult!.status).toBe('success');
  });

  it('executive communication agent always runs', async () => {
    const result = await controller.orchestrate(epgInputs);
    const execResult = result.results.find((r) => r.agentId === 'executive-communication');
    expect(execResult).toBeDefined();
    expect(execResult!.status).toBe('success');
  });

  it('exec comms output contains slack payload', async () => {
    const result = await controller.orchestrate(epgInputs);
    const execResult = result.results.find((r) => r.agentId === 'executive-communication');
    const output = execResult!.output as { slack_payload: object };
    expect(output.slack_payload).toBeDefined();
  });

  it('epg service inputs include codeRepo', async () => {
    const result = await controller.orchestrate(epgInputs);
    // codeRepo was provided — code-fix should not return the "No codeRepo" escalation
    const codeFixResult = result.results.find((r) => r.agentId === 'code-fix');
    expect(codeFixResult).toBeDefined();
    const output = codeFixResult!.output as { reason?: string };
    expect(output.reason).not.toBe('No codeRepo specified in ServiceInputs — cannot create PR');
  });
});
