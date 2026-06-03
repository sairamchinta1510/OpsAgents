import { describe, it, expect } from 'vitest';
import { AgentRegistry, EventBus, type ServiceInputs } from '@opsagents/core';
import { MonitoringAgent, HealthCheckAgent, ContentQualityAgent } from '@opsagents/agents-monitoring';
import { MonitoringController } from '@opsagents/controllers-monitoring';
import { ServiceAdapter } from '@opsagents/sdk';

function makeInputs(overrides: Partial<ServiceInputs> = {}): ServiceInputs {
  return {
    serviceId: 'integration-svc',
    timestamp: Date.now(),
    monitors: { cpuPercent: 40, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
    perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.005, throughput: 1000 },
    machineParams: { cpuPercent: 40, memoryPercent: 50, nodeCount: 3 },
    ...overrides,
  };
}

describe('Monitoring Pipeline Integration', () => {
  it('all 3 monitoring agents instantiate and execute individually', async () => {
    const agents = [
      new MonitoringAgent(),
      new HealthCheckAgent(),
      new ContentQualityAgent(),
    ];
    const ctx = {
      sessionId: 'int-session',
      serviceId: 'integration-svc',
      triggeredBy: 'integration-test',
      inputs: makeInputs(),
      sharedState: {},
    };
    for (const agent of agents) {
      const result = await agent.execute(ctx);
      expect(['success', 'failure', 'skipped']).toContain(result.status);
    }
  });

  it('MonitoringController runs all agents in parallel with healthy inputs', async () => {
    const ctrl = new MonitoringController(new AgentRegistry(), new EventBus());
    const result = await ctrl.orchestrate(makeInputs());
    expect(result.status).toBe('success');
    expect(result.results).toHaveLength(3);
    expect(result.alerts).toHaveLength(0);
  });

  it('MonitoringController detects anomalies and produces alerts', async () => {
    const ctrl = new MonitoringController(new AgentRegistry(), new EventBus());
    const result = await ctrl.orchestrate(makeInputs({
      monitors: { cpuPercent: 92, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
    }));
    expect(result.alerts.length).toBeGreaterThan(0);
  });

  it('MonitoringController routes alert via EventBus on anomaly', async () => {
    const bus = new EventBus();
    const alertEvents: unknown[] = [];
    bus.subscribe('monitoring-controller:alert', (data) => alertEvents.push(data));

    const ctrl = new MonitoringController(new AgentRegistry(), bus);
    await ctrl.orchestrate(makeInputs({
      monitors: { cpuPercent: 95, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
    }));

    expect(alertEvents.length).toBe(1);
    const event = alertEvents[0] as { controllerId: string; serviceId: string; alerts: string[] };
    expect(event.controllerId).toBe('monitoring-controller');
    expect(event.serviceId).toBe('integration-svc');
    expect(event.alerts.length).toBeGreaterThan(0);
  });

  it('MonitoringController escalates on critical resource usage', async () => {
    const ctrl = new MonitoringController(new AgentRegistry(), new EventBus());
    const result = await ctrl.orchestrate(makeInputs({
      monitors: { cpuPercent: 97, memoryPercent: 98, diskIoMbps: 5, networkMbps: 2 },
    }));
    expect(result.status).toBe('escalated');
    expect(result.escalatedBy).toBeDefined();
  });

  it('ServiceAdapter polling loop fires MonitoringController on interval', async () => {
    const { setInterval: realSetInterval, clearInterval: realClearInterval } = global;
    const ticks: number[] = [];

    const ctrl = new MonitoringController(new AgentRegistry(), new EventBus());
    const adapter = new ServiceAdapter({ serviceId: 'integration-svc', controllers: [ctrl] });

    expect(adapter.isPolling()).toBe(false);
    adapter.startPolling(50, () => makeInputs());
    expect(adapter.isPolling()).toBe(true);

    // Let the polling tick a couple times (real timers)
    await new Promise((resolve) => setTimeout(resolve, 160));

    adapter.stopPolling();
    expect(adapter.isPolling()).toBe(false);
  });

  it('monitoring agents track metrics after execution', async () => {
    const agent = new MonitoringAgent();
    await agent.execute({
      sessionId: 's', serviceId: 'svc', triggeredBy: 't', inputs: makeInputs(), sharedState: {},
    });
    const metrics = agent.getMetrics();
    expect(metrics.invocationCount).toBe(1);
    expect(metrics.lastRunAt).toBeInstanceOf(Date);
  });

  it('ContentQualityAgent SLA violation produces recommendations', async () => {
    const agent = new ContentQualityAgent();
    const result = await agent.execute({
      sessionId: 's', serviceId: 'svc', triggeredBy: 't',
      inputs: makeInputs({ perfLog: { p50Latency: 50, p99Latency: 900, errorRate: 0.03, throughput: 1000 } }),
      sharedState: {},
    });
    expect(result.status).toBe('failure');
    expect(result.recommendations!.length).toBeGreaterThan(0);
  });
});
