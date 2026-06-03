import { beforeEach, describe, expect, it } from 'vitest';
import { AgentRegistry, EventBus } from '@opsagents/core';
import { DeploymentController } from '../src/deployment-controller.js';

function makeInputs(overrides = {}) {
  return {
    serviceId: 'test-svc',
    timestamp: 1_700_000_000_000,
    code: { coverage: 80, diff: 'x', commitSha: 'abc' },
    perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.01, throughput: 1000 },
    monitors: { cpuPercent: 40, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
    machineParams: { cpuPercent: 40, memoryPercent: 50 },
    ...overrides,
  };
}

describe('DeploymentController', () => {
  let controller: DeploymentController;
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    controller = new DeploymentController(registry, new EventBus());
  });

  it('has id deployment-controller and registers all 4 deployment agents', () => {
    expect(controller.id).toBe('deployment-controller');
    expect(controller.getRegisteredAgents()).toHaveLength(4);
    expect(registry.list()).toHaveLength(4);
  });

  it('orchestrates all 4 agents successfully with valid inputs', async () => {
    const result = await controller.orchestrate(makeInputs());
    expect(result.status).toBe('success');
    expect(result.results).toHaveLength(4);
    expect(result.escalatedBy).toBeUndefined();
  });

  it('halts and escalates when an agent escalates', async () => {
    const result = await controller.orchestrate(makeInputs({
      machineParams: { cpuPercent: 97, memoryPercent: 50 },
    }));

    expect(result.status).toBe('escalated');
    expect(result.escalatedBy).toBe('deployment-validation');
    expect(result.results.length).toBeLessThan(4);
  });

  it('returns failure status when an agent fails without escalation', async () => {
    const result = await controller.orchestrate(makeInputs({
      code: { coverage: 55, diff: 'x', commitSha: 'abc' },
    }));

    expect(result.status).toBe('failure');
    expect(result.results).toHaveLength(4);
    expect(result.escalatedBy).toBeUndefined();
  });
});
