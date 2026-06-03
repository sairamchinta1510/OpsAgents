import { describe, it, expect } from 'vitest';
import { AgentRegistry, EventBus } from '@opsagents/core';
import { IncidentController } from '../src/incident-controller.js';
import type { ServiceInputs } from '@opsagents/core';

function makeController() {
  const registry = new AgentRegistry();
  const eventBus = new EventBus();
  return new IncidentController(registry, eventBus);
}

const criticalIncident: ServiceInputs = {
  serviceId: 'api-service',
  timestamp: Date.now(),
  incident: { alertId: 'inc-001', severity: 'critical', message: 'Complete API outage', source: 'gateway', timestamp: Date.now() },
  monitors: { cpuPercent: 95, memoryPercent: 90, diskIoMbps: 10, networkMbps: 5 },
  perfLog: { p50Latency: 100, p99Latency: 950, errorRate: 0.15, throughput: 50 },
};

const lowSeverityIncident: ServiceInputs = {
  serviceId: 'batch-service',
  timestamp: Date.now(),
  incident: { alertId: 'inc-002', severity: 'low', message: 'Minor delay in batch job', source: 'scheduler', timestamp: Date.now() },
};

describe('IncidentController', () => {
  it('has correct id', () => {
    const c = makeController();
    expect(c.id).toBe('incident-controller');
  });

  it('runs pipeline and returns results array', async () => {
    const c = makeController();
    const result = await c.orchestrate(lowSeverityIncident);
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('ReportingAgent always included in results', async () => {
    const c = makeController();
    const result = await c.orchestrate(lowSeverityIncident);
    expect(result.results.some((r) => r.agentId === 'reporting')).toBe(true);
  });

  it('escalates for critical incident and still includes report', async () => {
    const c = makeController();
    const result = await c.orchestrate(criticalIncident);
    expect(result.status).toBe('escalated');
    expect(result.escalatedBy).toBeDefined();
    expect(result.results.some((r) => r.agentId === 'reporting')).toBe(true);
  });

  it('report output contains markdown and json', async () => {
    const c = makeController();
    const result = await c.orchestrate(lowSeverityIncident);
    const reportResult = result.results.find((r) => r.agentId === 'reporting');
    expect(reportResult).toBeDefined();
    const o = reportResult!.output as { markdown: string; json: Record<string, unknown> };
    expect(typeof o.markdown).toBe('string');
    expect(o.markdown).toContain('# Incident Report');
    expect(typeof o.json).toBe('object');
  });

  it('orchestration includes timing and session metadata', async () => {
    const c = makeController();
    const result = await c.orchestrate(lowSeverityIncident);
    expect(result.orchestration.sessionId).toBeDefined();
    expect(typeof result.orchestration.durationMs).toBe('number');
  });
});
