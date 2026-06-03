import { describe, it, expect } from 'vitest';
import { DeploymentValidationAgent } from '../src/deployment-validation.js';
import { AgentCategory } from '@opsagents/core';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

const makeCtx = (inputs: ServiceInputs): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: inputs.serviceId,
  triggeredBy: 'test',
  inputs,
  sharedState: {},
});

describe('DeploymentValidationAgent', () => {
  const agent = new DeploymentValidationAgent();

  it('has correct id and acceptedInputs', () => {
    expect(agent.id).toBe('deployment-validation');
    expect(agent.category).toBe(AgentCategory.DEPLOYMENT);
    expect(agent.acceptedInputs).toContain('monitor');
  });

  it('validates successfully when cpu < 85 and memory < 85', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 10, networkMbps: 20 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    expect((result.output as { validated: boolean }).validated).toBe(true);
    expect(result.escalate).toBeFalsy();
  });

  it('returns failure when cpu >= 85', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 88, memoryPercent: 50, diskIoMbps: 10, networkMbps: 20 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    expect((result.output as { validated: boolean }).validated).toBe(false);
    expect(result.escalate).toBeFalsy();
  });

  it('escalates when cpu > 95', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 97, memoryPercent: 50, diskIoMbps: 10, networkMbps: 20 },
    });
    const result = await agent.execute(ctx);
    expect(result.escalate).toBe(true);
  });

  it('escalates when memory > 95', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 50, memoryPercent: 96, diskIoMbps: 10, networkMbps: 20 },
    });
    const result = await agent.execute(ctx);
    expect(result.escalate).toBe(true);
  });

  it('skips when monitors input is absent', async () => {
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });

  it('returns failure at exactly cpu=85 (boundary)', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 85, memoryPercent: 50, diskIoMbps: 10, networkMbps: 20 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    expect((result.output as { validated: boolean }).validated).toBe(false);
    expect(result.escalate).toBeFalsy();
  });

  it('does not escalate at exactly cpu=95 (boundary — must be > 95)', async () => {
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 95, memoryPercent: 50, diskIoMbps: 10, networkMbps: 20 },
    });
    const result = await agent.execute(ctx);
    // 95 is NOT > 95, so should NOT escalate — should be failure only
    expect(result.escalate).toBeFalsy();
    expect(result.status).toBe('failure');
  });
});
