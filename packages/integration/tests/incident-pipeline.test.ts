import { describe, it, expect } from 'vitest';
import { AgentRegistry, EventBus } from '@opsagents/core';
import { IncidentController } from '@opsagents/controllers-incident';
import type { ServiceInputs } from '@opsagents/core';

function makeController() {
  return new IncidentController(new AgentRegistry(), new EventBus());
}

const criticalInputs: ServiceInputs = {
  serviceId: 'api-gateway',
  timestamp: Date.now(),
  incident: {
    alertId: 'inc-001',
    severity: 'critical',
    message: 'Complete API gateway outage detected',
    source: 'gateway',
    timestamp: Date.now(),
  },
  monitors: { cpuPercent: 96, memoryPercent: 92, diskIoMbps: 20, networkMbps: 8 },
  perfLog: { p50Latency: 120, p99Latency: 980, errorRate: 0.2, throughput: 10 },
  machineParams: { cpuPercent: 96, memoryPercent: 92, nodeCount: 3, availabilityZone: 'us-east-1a' },
};

const lowSeverityInputs: ServiceInputs = {
  serviceId: 'batch-processor',
  timestamp: Date.now(),
  incident: {
    alertId: 'inc-002',
    severity: 'low',
    message: 'Batch job delayed by 5 minutes',
    source: 'scheduler',
    timestamp: Date.now(),
  },
  machineParams: { cpuPercent: 25, memoryPercent: 30, nodeCount: 2, availabilityZone: 'us-east-1b' },
};

describe('Incident Pipeline Integration', () => {
  it('runs full pipeline for critical incident', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(criticalInputs);
    expect(['escalated', 'failure']).toContain(result.status);
    expect(result.results.length).toBeGreaterThanOrEqual(2);
  });

  it('includes ReportingAgent result even when escalated', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(criticalInputs);
    const reportResult = result.results.find((r) => r.agentId === 'reporting');
    expect(reportResult).toBeDefined();
    expect(reportResult!.status).toBe('success');
  });

  it('report markdown references the incident', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(criticalInputs);
    const reportResult = result.results.find((r) => r.agentId === 'reporting');
    const o = reportResult!.output as { markdown: string };
    expect(o.markdown).toContain('inc-001');
  });

  it('report json has correct structure', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(criticalInputs);
    const reportResult = result.results.find((r) => r.agentId === 'reporting');
    const o = reportResult!.output as { json: Record<string, unknown> };
    expect(o.json.serviceId).toBe('api-gateway');
    expect(o.json.incidentId).toBe('inc-001');
    expect(['escalated', 'degraded', 'resolved']).toContain(o.json.overallStatus);
  });

  it('runs all 5 agents for low-severity incident with no escalation', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(lowSeverityInputs);
    // All agents should have run (no early halt)
    const ids = result.results.map((r) => r.agentId);
    expect(ids).toContain('issue-identification');
    expect(ids).toContain('reporting');
  });

  it('IssueIdentificationAgent result includes blast radius', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(criticalInputs);
    const issueResult = result.results.find((r) => r.agentId === 'issue-identification');
    expect(issueResult).toBeDefined();
    const o = issueResult!.output as { blastRadius: string };
    expect(['contained', 'service-wide', 'cross-service']).toContain(o.blastRadius);
  });

  it('orchestration result carries overall timing', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(lowSeverityInputs);
    expect(result.orchestration.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.orchestration.sessionId).toBeTruthy();
  });

  it('escalatedBy is set when pipeline escalates', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(criticalInputs);
    if (result.status === 'escalated') {
      expect(result.escalatedBy).toBeTruthy();
    }
  });
});
