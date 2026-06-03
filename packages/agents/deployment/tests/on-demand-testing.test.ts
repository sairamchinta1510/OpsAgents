import { describe, it, expect } from 'vitest';
import { OnDemandTestingAgent } from '../src/on-demand-testing.js';
import { AgentCategory } from '@opsagents/core';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

const makeCtx = (inputs: ServiceInputs): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: inputs.serviceId,
  triggeredBy: 'test',
  inputs,
  sharedState: {},
});

describe('OnDemandTestingAgent', () => {
  const agent = new OnDemandTestingAgent();

  it('has correct id, category, and acceptedInputs', () => {
    expect(agent.id).toBe('on-demand-testing');
    expect(agent.category).toBe(AgentCategory.DEPLOYMENT);
    expect(agent.acceptedInputs).toContain('code');
  });

  it('passes when coverage >= 60', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 75, diff: 'some diff', commitSha: 'abc' },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    expect((result.output as { passed: boolean }).passed).toBe(true);
    expect(result.escalate).toBeFalsy();
  });

  it('returns failure when coverage < 60', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 55 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    expect((result.output as { passed: boolean }).passed).toBe(false);
    expect(result.escalate).toBeFalsy();
  });

  it('escalates when coverage < 40', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      code: { coverage: 25 },
    });
    const result = await agent.execute(ctx);
    expect(result.escalate).toBe(true);
  });

  it('skips when code input is absent', async () => {
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });
});
