import { describe, it, expect } from 'vitest';
import { HardwarePlannerAgent } from '../src/hardware-planner.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

function ctx(inputs: ServiceInputs): AgentContext {
  return { sessionId: 'test', serviceId: inputs.serviceId, triggeredBy: 'test', inputs, sharedState: {} };
}

describe('HardwarePlannerAgent', () => {
  it('has correct id and category', () => {
    const a = new HardwarePlannerAgent();
    expect(a.id).toBe('hardware-planner');
    expect(a.category).toBe('infrastructure');
  });

  it('skips with no relevant inputs', async () => {
    const a = new HardwarePlannerAgent();
    const r = await a.execute(ctx({ serviceId: 'svc', timestamp: 0 }));
    expect(r.status).toBe('skipped');
  });

  it('recommends scale-up on high CPU', async () => {
    const a = new HardwarePlannerAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 85, memoryPercent: 50, nodeCount: 3, instanceType: 'm5.large', region: 'us-east-1', availabilityZone: 'us-east-1a' },
    }));
    expect(r.status).toBe('success');
    const o = r.output as { scalingDecision: { action: string; targetNodeCount: number } };
    expect(o.scalingDecision.action).toBe('scale-up');
    expect(o.scalingDecision.targetNodeCount).toBeGreaterThan(3);
  });

  it('recommends scale-down on low utilization', async () => {
    const a = new HardwarePlannerAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 10, memoryPercent: 15, nodeCount: 5, instanceType: 't3.medium', region: 'us-east-1', availabilityZone: 'us-east-1a' },
    }));
    const o = r.output as { scalingDecision: { action: string } };
    expect(o.scalingDecision.action).toBe('scale-down');
  });

  it('returns no-change within normal range', async () => {
    const a = new HardwarePlannerAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 45, memoryPercent: 55, nodeCount: 3, instanceType: 'm5.large', region: 'us-east-1', availabilityZone: 'us-east-1a' },
    }));
    const o = r.output as { scalingDecision: { action: string } };
    expect(o.scalingDecision.action).toBe('no-change');
  });

  it('escalates when already at max node count and scaling up', async () => {
    const a = new HardwarePlannerAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 90, memoryPercent: 88, nodeCount: 9, instanceType: 'm5.xlarge', region: 'us-east-1', availabilityZone: 'us-east-1a' },
    }));
    expect(r.escalate).toBe(true);
  });

  it('output includes job schedule', async () => {
    const a = new HardwarePlannerAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 40, memoryPercent: 40, nodeCount: 2, instanceType: 't3.medium', region: 'us-east-1', availabilityZone: 'us-east-1a' },
    }));
    const o = r.output as { jobSchedule: unknown[] };
    expect(Array.isArray(o.jobSchedule)).toBe(true);
    expect(o.jobSchedule.length).toBeGreaterThan(0);
  });
});
