import { describe, it, expect } from 'vitest';
import { LagIndicationAgent } from '../src/lag-indication.js';
import { AgentCategory } from '@opsagents/core';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

const makeCtx = (inputs: ServiceInputs): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: inputs.serviceId,
  triggeredBy: 'test',
  inputs,
  sharedState: {},
});

describe('LagIndicationAgent', () => {
  const agent = new LagIndicationAgent();

  it('has correct id, category, and acceptedInputs', () => {
    expect(agent.id).toBe('lag-indication');
    expect(agent.category).toBe(AgentCategory.DEPLOYMENT);
    expect(agent.acceptedInputs).toContain('perf-log');
  });

  it('returns success with low risk when p99 < 150ms and errorRate < 0.01', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 30, p99Latency: 100, errorRate: 0.005, throughput: 1000 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const out = result.output as { riskScore: number; riskLevel: string };
    expect(out.riskLevel).toBe('low');
    expect(out.riskScore).toBeLessThan(0.3);
    expect(result.escalate).toBeFalsy();
  });

  it('returns the raw riskScore without rounding near the low-to-medium threshold', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: {
        p50Latency: 100,
        p99Latency: 243.33333333333334,
        errorRate: 0.01,
        throughput: 800,
      },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const out = result.output as { riskScore: number; riskLevel: string };
    const expectedRiskScore = 243.33333333333334 / 500 * 0.6 + 0.01 * 0.4;
    expect(out.riskLevel).toBe('low');
    expect(out.riskScore).toBeCloseTo(expectedRiskScore, 12);
    expect(out.riskScore).toBeLessThan(0.3);
  });

  it('returns success with medium risk recommendations when riskScore is 0.3–0.7', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 100, p99Latency: 300, errorRate: 0.05, throughput: 800 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const out = result.output as { riskLevel: string };
    expect(out.riskLevel).toBe('medium');
    expect(result.recommendations?.length).toBeGreaterThan(0);
    expect(result.escalate).toBeFalsy();
  });

  it('escalates when riskScore > 0.7', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 300, p99Latency: 800, errorRate: 0.2, throughput: 200 },
    });
    const result = await agent.execute(ctx);
    const out = result.output as { riskLevel: string };
    expect(out.riskLevel).toBe('high');
    expect(result.escalate).toBe(true);
  });

  it('skips when perfLog input is absent', async () => {
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });
});
