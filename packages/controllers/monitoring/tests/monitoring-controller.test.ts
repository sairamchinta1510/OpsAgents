import { describe, it, expect, vi } from 'vitest';
import { MonitoringController } from '../src/monitoring-controller.js';
import { AgentRegistry, EventBus } from '@opsagents/core';
import type { ServiceInputs } from '@opsagents/core';

function makeInputs(overrides: Partial<ServiceInputs> = {}): ServiceInputs {
  return {
    serviceId: 'test-svc',
    timestamp: Date.now(),
    monitors: { cpuPercent: 40, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
    perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.005, throughput: 1000 },
    machineParams: { cpuPercent: 40, memoryPercent: 50, nodeCount: 2 },
    ...overrides,
  };
}

describe('MonitoringController', () => {
  it('has id "monitoring-controller" and registers 3 agents', () => {
    const ctrl = new MonitoringController(new AgentRegistry(), new EventBus());
    expect(ctrl.id).toBe('monitoring-controller');
    expect(ctrl.getRegisteredAgents()).toHaveLength(3);
  });

  it('orchestrates successfully with healthy inputs', async () => {
    const ctrl = new MonitoringController(new AgentRegistry(), new EventBus());
    const result = await ctrl.orchestrate(makeInputs());
    expect(result.status).toBe('success');
    expect(result.results.length).toBe(3);
  });

  it('runs agents in parallel (all complete)', async () => {
    const ctrl = new MonitoringController(new AgentRegistry(), new EventBus());
    const result = await ctrl.orchestrate(makeInputs());
    // All 3 agents should produce a result
    const agentIds = result.results.map((r) => r.agentId);
    expect(agentIds).toContain('monitoring');
    expect(agentIds).toContain('health-check');
    expect(agentIds).toContain('content-quality');
  });

  it('publishes alert event when anomalies detected', async () => {
    const bus = new EventBus();
    const published: unknown[] = [];
    bus.subscribe('monitoring-controller:alert', (data) => published.push(data));

    const ctrl = new MonitoringController(new AgentRegistry(), bus);
    await ctrl.orchestrate(makeInputs({
      monitors: { cpuPercent: 95, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
    }));

    expect(published.length).toBeGreaterThan(0);
    const alert = published[0] as { alerts: string[] };
    expect(alert.alerts.length).toBeGreaterThan(0);
  });

  it('escalates when critical anomaly is present', async () => {
    const ctrl = new MonitoringController(new AgentRegistry(), new EventBus());
    const result = await ctrl.orchestrate(makeInputs({
      monitors: { cpuPercent: 95, memoryPercent: 95, diskIoMbps: 5, networkMbps: 2 },
    }));
    expect(result.status).toBe('escalated');
    expect(result.escalatedBy).toBeDefined();
  });
});
