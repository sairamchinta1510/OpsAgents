import { describe, it, expect } from 'vitest';
import { CiCdGovernanceAgent } from '../src/ci-cd-governance.js';
import { AgentCategory } from '@opsagents/core';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

const makeCtx = (inputs: ServiceInputs): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: inputs.serviceId,
  triggeredBy: 'test',
  inputs,
  sharedState: {},
});

describe('CiCdGovernanceAgent', () => {
  const agent = new CiCdGovernanceAgent();

  it('has correct id, category, and acceptedInputs', () => {
    expect(agent.id).toBe('ci-cd-governance');
    expect(agent.category).toBe(AgentCategory.DEPLOYMENT);
    expect(agent.acceptedInputs).toContain('code');
    expect(agent.acceptedInputs).toContain('perf-log');
  });

  it('returns success when coverage >= 70 and errorRate <= 0.05', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { diff: '+1 line', commitSha: 'abc', coverage: 80 },
      perfLog: { p50Latency: 50, p99Latency: 150, errorRate: 0.01, throughput: 500 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    expect((result.output as { approved: boolean }).approved).toBe(true);
    expect(result.escalate).toBeFalsy();
  });

  it('returns failure when coverage < 70', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 65 },
      perfLog: { p50Latency: 50, p99Latency: 150, errorRate: 0.01, throughput: 500 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    expect((result.output as { approved: boolean }).approved).toBe(false);
    expect(result.escalate).toBeFalsy();
  });

  it('escalates when coverage < 50 (critically under-tested)', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 30 },
      perfLog: { p50Latency: 50, p99Latency: 150, errorRate: 0.01, throughput: 500 },
    });
    const result = await agent.execute(ctx);
    expect(result.escalate).toBe(true);
  });

  it('returns failure when errorRate > 0.05', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 80 },
      perfLog: { p50Latency: 50, p99Latency: 400, errorRate: 0.1, throughput: 500 },
    });
    const result = await agent.execute(ctx);
    expect((result.output as { approved: boolean }).approved).toBe(false);
  });

  it('defaults errorRate to 0 when perfLog input is absent', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 80 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    expect((result.output as { approved: boolean; errorRate: number }).approved).toBe(true);
    expect((result.output as { approved: boolean; errorRate: number }).errorRate).toBe(0);
  });

  it('skips when code input is absent', async () => {
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });
});
