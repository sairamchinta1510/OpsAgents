import { describe, it, expect } from 'vitest';
import { AgentRegistry, EventBus } from '@opsagents/core';
import { InfrastructureController } from '@opsagents/controllers-infrastructure';
import type { ServiceInputs } from '@opsagents/core';

function makeController() {
  return new InfrastructureController(new AgentRegistry(), new EventBus());
}

const wellProvisionedInputs: ServiceInputs = {
  serviceId: 'platform-core',
  timestamp: Date.now(),
  machineParams: {
    cpuPercent: 45,
    memoryPercent: 55,
    nodeCount: 3,
    instanceType: 'm5.large',
    region: 'us-east-1',
    availabilityZone: 'us-east-1a',
  },
  monitors: { cpuPercent: 45, memoryPercent: 55, diskIoMbps: 6, networkMbps: 2 },
  code: { commitSha: 'abc123', coverage: 88 },
  perfLog: { p50Latency: 40, p99Latency: 180, errorRate: 0.005, throughput: 1200 },
};

const overProvisionedInputs: ServiceInputs = {
  serviceId: 'batch-worker',
  timestamp: Date.now(),
  machineParams: {
    cpuPercent: 8,
    memoryPercent: 12,
    nodeCount: 8,
    instanceType: 't3.large',
    region: 'us-east-1',
    availabilityZone: 'us-east-1b',
  },
  monitors: { cpuPercent: 8, memoryPercent: 12, diskIoMbps: 1, networkMbps: 0.5 },
};

describe('Infrastructure Pipeline Integration', () => {
  it('runs all 4 infra agents for normal service', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(wellProvisionedInputs);
    expect(result.results.length).toBe(4);
  });

  it('hardware planner recommends no-change for normal utilization', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(wellProvisionedInputs);
    const hw = result.results.find((r) => r.agentId === 'hardware-planner');
    const o = hw!.output as { scalingDecision: { action: string } };
    expect(o.scalingDecision.action).toBe('no-change');
  });

  it('cost optimization finds savings for over-provisioned cluster', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(overProvisionedInputs);
    const cost = result.results.find((r) => r.agentId === 'cost-optimization');
    const o = cost!.output as { projectedSavingsUsd: number };
    expect(o.projectedSavingsUsd).toBeGreaterThan(0);
  });

  it('knowledge-graph always succeeds', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(wellProvisionedInputs);
    const kg = result.results.find((r) => r.agentId === 'knowledge-graph');
    expect(kg?.status).toBe('success');
    const o = kg!.output as { neo4jAdapterStatus: string };
    expect(o.neo4jAdapterStatus).toBe('stub');
  });

  it('security agent rotates secrets when machineParams present', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(wellProvisionedInputs);
    const sec = result.results.find((r) => r.agentId === 'security-compliance');
    const o = sec!.output as { secretsRotated: string[] };
    expect(o.secretsRotated.length).toBeGreaterThan(0);
  });

  it('overall status is success for healthy service', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(wellProvisionedInputs);
    expect(result.status).toBe('success');
    expect(result.escalatedBy).toBeUndefined();
  });

  it('hardware planner recommends scale-down for over-provisioned cluster', async () => {
    const controller = makeController();
    const result = await controller.orchestrate(overProvisionedInputs);
    const hw = result.results.find((r) => r.agentId === 'hardware-planner');
    const o = hw!.output as { scalingDecision: { action: string } };
    expect(o.scalingDecision.action).toBe('scale-down');
  });
});
