import { describe, it, expect } from 'vitest';
import { CostOptimizationAgent } from '../src/cost-optimization.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

function ctx(inputs: ServiceInputs): AgentContext {
  return { sessionId: 'test', serviceId: inputs.serviceId, triggeredBy: 'test', inputs, sharedState: {} };
}

describe('CostOptimizationAgent', () => {
  it('has correct id and category', () => {
    const a = new CostOptimizationAgent();
    expect(a.id).toBe('cost-optimization');
    expect(a.category).toBe('infrastructure');
  });

  it('skips with no relevant inputs', async () => {
    const a = new CostOptimizationAgent();
    const r = await a.execute(ctx({ serviceId: 'svc', timestamp: 0 }));
    expect(r.status).toBe('skipped');
  });

  it('calculates monthly cost from known instance type', async () => {
    const a = new CostOptimizationAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 40, memoryPercent: 50, nodeCount: 2, instanceType: 'm5.large', region: 'us-east-1', availabilityZone: 'us-east-1a' },
    }));
    expect(r.status).toBe('success');
    const o = r.output as { currentMonthlyCostUsd: number };
    // m5.large = $0.096/hr × 730h × 2 nodes = ~$140.16
    expect(o.currentMonthlyCostUsd).toBeCloseTo(140.16, 0);
  });

  it('recommends downsizing for low utilization', async () => {
    const a = new CostOptimizationAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 10, memoryPercent: 20, nodeCount: 2, instanceType: 't3.large', region: 'us-east-1', availabilityZone: 'us-east-1a' },
    }));
    const o = r.output as { rightsizingRecommendations: string[]; projectedSavingsUsd: number };
    expect(o.rightsizingRecommendations.length).toBeGreaterThan(0);
    expect(o.projectedSavingsUsd).toBeGreaterThan(0);
  });

  it('recommends removing idle nodes when overprovisioned', async () => {
    const a = new CostOptimizationAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 15, memoryPercent: 20, nodeCount: 6, instanceType: 't3.medium', region: 'us-east-1', availabilityZone: 'us-east-1a' },
    }));
    const o = r.output as { rightsizingRecommendations: string[] };
    expect(o.rightsizingRecommendations.some((r) => r.includes('node'))).toBe(true);
  });

  it('returns success with no recommendations for well-utilized cluster', async () => {
    const a = new CostOptimizationAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 60, memoryPercent: 65, nodeCount: 2, instanceType: 'm5.large', region: 'us-east-1', availabilityZone: 'us-east-1a' },
    }));
    expect(r.status).toBe('success');
    const o = r.output as { projectedSavingsUsd: number };
    expect(o.projectedSavingsUsd).toBe(0);
  });
});
