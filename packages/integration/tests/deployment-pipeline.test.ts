import { describe, it, expect } from 'vitest';
import { AgentRegistry, EventBus, type AgentContext, type ServiceInputs } from '@opsagents/core';
import { CiCdGovernanceAgent, DeploymentValidationAgent, LagIndicationAgent, OnDemandTestingAgent } from '@opsagents/agents-deployment';
import { TrafficPredictionAgent, TrafficDialUpAgent, CriticalMetricsAgent } from '@opsagents/agents-predictive';
import { DeploymentController } from '@opsagents/controllers-deployment';

function makeInputs(overrides: Partial<ServiceInputs> = {}): ServiceInputs {
  return {
    serviceId: 'integration-svc',
    timestamp: Date.now(),
    code: { coverage: 80, diff: 'x', commitSha: 'abc123' },
    perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.01, throughput: 1000 },
    monitors: { cpuPercent: 40, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
    machineParams: { cpuPercent: 40, memoryPercent: 50 },
    ...overrides,
  };
}

function makeContext(inputs: ServiceInputs = makeInputs()): AgentContext {
  return {
    sessionId: 'integration-session',
    serviceId: inputs.serviceId,
    triggeredBy: 'integration-test',
    inputs,
    sharedState: {},
  };
}

describe('Deployment Pipeline Integration', () => {
  it('all 4 deployment agents can be instantiated and execute individually', async () => {
    const agents = [
      new CiCdGovernanceAgent(),
      new DeploymentValidationAgent(),
      new LagIndicationAgent(),
      new OnDemandTestingAgent(),
    ];
    const ctx = makeContext();
    for (const agent of agents) {
      const result = await agent.execute(ctx);
      expect(['success', 'failure', 'skipped']).toContain(result.status);
    }
  });

  it('all 3 predictive agents can be instantiated and execute individually', async () => {
    const agents = [
      new TrafficPredictionAgent(),
      new TrafficDialUpAgent(),
      new CriticalMetricsAgent(),
    ];
    const ctx = makeContext();
    for (const agent of agents) {
      const result = await agent.execute(ctx);
      expect(['success', 'failure', 'skipped']).toContain(result.status);
    }
  });

  it('DeploymentController orchestrates successfully with healthy inputs', async () => {
    const controller = new DeploymentController(new AgentRegistry(), new EventBus());
    const result = await controller.orchestrate(makeInputs());
    expect(result.status).toBe('success');
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('DeploymentController halts on escalation', async () => {
    const controller = new DeploymentController(new AgentRegistry(), new EventBus());
    const result = await controller.orchestrate(makeInputs({
      machineParams: { cpuPercent: 97, memoryPercent: 50 }
    }));
    expect(result.status).toBe('escalated');
  });

  it('agents track metrics after execution', async () => {
    const agent = new CiCdGovernanceAgent();
    const ctx = makeContext();
    await agent.execute(ctx);
    const metrics = agent.getMetrics();
    expect(metrics.invocationCount).toBe(1);
    expect(metrics.lastRunAt).toBeInstanceOf(Date);
  });

  it('agent enable/disable works across packages', async () => {
    const agent = new LagIndicationAgent();
    const ctx = makeContext();
    agent.disable();
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
    expect(agent.getMetrics().skipCount).toBe(1);
  });

  it('EventBus broadcasts between agents', async () => {
    const bus = new EventBus();
    const received: string[] = [];
    bus.subscribe('test-event', (data: unknown) => {
      received.push((data as { msg: string }).msg);
    });
    bus.publish('test-event', { msg: 'hello from deployment' });
    bus.publish('test-event', { msg: 'hello from predictive' });
    expect(received).toEqual(['hello from deployment', 'hello from predictive']);
  });
});
