import { describe, it, expect, beforeEach } from 'vitest';
import { AgentCategory } from '@opsagents/core';
import type { AgentContext, ServiceInputs } from '@opsagents/core';
import { DeploymentValidationAgent } from '../src/deployment-validation.js';

function makeCtx(inputs: Partial<ServiceInputs>): AgentContext {
  return {
    sessionId: 'sess-1',
    serviceId: 'svc',
    triggeredBy: 'test',
    sharedState: {},
    inputs: { serviceId: 'svc', timestamp: 1000, ...inputs },
  };
}

describe('DeploymentValidationAgent', () => {
  let agent: DeploymentValidationAgent;
  beforeEach(() => { agent = new DeploymentValidationAgent(); });

  it('has correct id, category, and acceptedInputs', () => {
    expect(agent.id).toBe('deployment-validation');
    expect(agent.category).toBe(AgentCategory.DEPLOYMENT);
    expect(agent.acceptedInputs).toContain('machine-params');
  });

  it('skips when machineParams is absent', async () => {
    const result = await agent.execute(makeCtx({}));
    expect(result.status).toBe('skipped');
    expect(result.escalate).toBeFalsy();
  });

  it('validates when cpu=50 and memory=60 (normal)', async () => {
    const result = await agent.execute(makeCtx({ machineParams: { cpuPercent: 50, memoryPercent: 60 } }));
    expect(result.status).toBe('success');
    expect((result.output as { validated: boolean }).validated).toBe(true);
  });

  it('fails when cpu=90 (above warning threshold)', async () => {
    const result = await agent.execute(makeCtx({ machineParams: { cpuPercent: 90, memoryPercent: 60 } }));
    expect(result.status).toBe('failure');
    expect((result.output as { validated: boolean }).validated).toBe(false);
    expect(typeof (result.output as { reason: string }).reason).toBe('string');
    expect(result.escalate).toBeFalsy();
  });

  it('escalates when cpu=97 (above critical threshold)', async () => {
    const result = await agent.execute(makeCtx({ machineParams: { cpuPercent: 97, memoryPercent: 60 } }));
    expect(result.status).toBe('escalate');
    expect(typeof (result.output as { reason: string }).reason).toBe('string');
    expect(result.escalate).toBe(true);
  });

  it('validates at cpu=84 (just below warning boundary)', async () => {
    const result = await agent.execute(makeCtx({ machineParams: { cpuPercent: 84, memoryPercent: 60 } }));
    expect((result.output as { validated: boolean }).validated).toBe(true);
  });

  it('fails at cpu=85 (at warning boundary)', async () => {
    const result = await agent.execute(makeCtx({ machineParams: { cpuPercent: 85, memoryPercent: 60 } }));
    expect((result.output as { validated: boolean }).validated).toBe(false);
  });

  it('escalates at memory=96 (above critical threshold)', async () => {
    const result = await agent.execute(makeCtx({ machineParams: { cpuPercent: 50, memoryPercent: 96 } }));
    expect(result.status).toBe('escalate');
    expect(result.escalate).toBe(true);
  });

  it('does not escalate at memory=95 (at critical boundary)', async () => {
    const result = await agent.execute(makeCtx({ machineParams: { cpuPercent: 50, memoryPercent: 95 } }));
    expect(result.escalate).toBeFalsy();
    expect((result.output as { validated: boolean }).validated).toBe(false);
  });

  it('output always contains reason string', async () => {
    const result = await agent.execute(makeCtx({ machineParams: { cpuPercent: 50, memoryPercent: 60 } }));
    expect(typeof (result.output as { reason: string }).reason).toBe('string');
  });
});
