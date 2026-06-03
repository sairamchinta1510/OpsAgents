import { describe, it, expect } from 'vitest';
import { SpareTierRedundancyAgent } from '../src/spare-tier-redundancy.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

function makeCtx(inputs: ServiceInputs): AgentContext {
  return { sessionId: 'test', serviceId: inputs.serviceId, triggeredBy: 'test', inputs, sharedState: {} };
}

describe('SpareTierRedundancyAgent', () => {
  it('has correct id and category', () => {
    const a = new SpareTierRedundancyAgent();
    expect(a.id).toBe('spare-tier-redundancy');
    expect(a.category).toBe('reliability');
  });

  it('returns skipped with no machineParams', async () => {
    const a = new SpareTierRedundancyAgent();
    const r = await a.execute(makeCtx({ serviceId: 'svc', timestamp: 0 }));
    expect(r.status).toBe('skipped');
  });

  it('returns DR ready for fully configured HA cluster', async () => {
    const a = new SpareTierRedundancyAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 30, memoryPercent: 40, nodeCount: 3, availabilityZone: 'eu-west-1a' },
    }));
    expect(r.status).toBe('success');
    const o = r.output as { drReady: boolean };
    expect(o.drReady).toBe(true);
  });

  it('escalates when single-node (no HA)', async () => {
    const a = new SpareTierRedundancyAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 30, memoryPercent: 40, nodeCount: 1 },
    }));
    expect(r.status).toBe('failure');
    expect(r.escalate).toBe(true);
    const o = r.output as { drReady: boolean };
    expect(o.drReady).toBe(false);
  });

  it('reports degraded but not unavailable when no AZ specified', async () => {
    const a = new SpareTierRedundancyAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 30, memoryPercent: 40, nodeCount: 2 },
    }));
    expect(r.status).toBe('success'); // no unavailable checks
    const o = r.output as { checks: { name: string; status: string }[] };
    const azCheck = o.checks.find((c) => c.name === 'multi-az');
    expect(azCheck?.status).toBe('degraded');
  });
});
