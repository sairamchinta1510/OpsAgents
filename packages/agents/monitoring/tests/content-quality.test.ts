import { describe, it, expect } from 'vitest';
import { ContentQualityAgent } from '../src/content-quality.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

function makeCtx(inputs: ServiceInputs): AgentContext {
  return {
    sessionId: 'test',
    serviceId: inputs.serviceId,
    triggeredBy: 'test',
    inputs,
    sharedState: {},
  };
}

describe('ContentQualityAgent', () => {
  it('has correct id and category', () => {
    const agent = new ContentQualityAgent();
    expect(agent.id).toBe('content-quality');
    expect(agent.category).toBe('monitoring');
  });

  it('returns skipped when no monitors or perfLog', async () => {
    const agent = new ContentQualityAgent();
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });

  it('returns success and SLA-compliant for healthy metrics', async () => {
    const agent = new ContentQualityAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.005, throughput: 1000 },
      monitors: { cpuPercent: 40, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const output = result.output as { slaCompliant: boolean; qualityScore: number };
    expect(output.slaCompliant).toBe(true);
    expect(output.qualityScore).toBe(1);
  });

  it('detects p99 latency SLA violation', async () => {
    const agent = new ContentQualityAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 50, p99Latency: 900, errorRate: 0.005, throughput: 1000 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    const output = result.output as { violations: { metric: string }[] };
    expect(output.violations.some((v) => v.metric === 'p99Latency')).toBe(true);
  });

  it('escalates when 2+ SLA violations', async () => {
    const agent = new ContentQualityAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 50, p99Latency: 900, errorRate: 0.05, throughput: 1000 },
    });
    const result = await agent.execute(ctx);
    expect(result.escalate).toBe(true);
    const output = result.output as { violations: unknown[] };
    expect(output.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('detects disk I/O SLA violation', async () => {
    const agent = new ContentQualityAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 40, memoryPercent: 50, diskIoMbps: 150, networkMbps: 2 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    const output = result.output as { violations: { metric: string }[] };
    expect(output.violations.some((v) => v.metric === 'diskIoMbps')).toBe(true);
  });
});
