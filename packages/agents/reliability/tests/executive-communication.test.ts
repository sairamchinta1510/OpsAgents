import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdir, writeFile } from 'fs/promises';
import { ExecutiveCommunicationAgent } from '../src/executive-communication.js';
import type { AgentContext } from '@opsagents/core';

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    sessionId: 'sess-001',
    serviceId: 'epg-service',
    triggeredBy: 'incident-controller',
    inputs: { serviceId: 'epg-service', timestamp: Date.now() },
    sharedState: {},
    ...overrides,
  };
}

describe('ExecutiveCommunicationAgent', () => {
  beforeEach(() => {
    vi.mocked(mkdir).mockClear();
    vi.mocked(writeFile).mockClear();
  });

  it('always returns success status', async () => {
    const agent = new ExecutiveCommunicationAgent();
    const result = await agent.execute(makeCtx());
    expect(result.status).toBe('success');
  });

  it('writes slack_payload.json to output dir', async () => {
    const agent = new ExecutiveCommunicationAgent();
    await agent.execute(makeCtx());
    expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
      expect.stringContaining('slack_payload.json'),
      expect.any(String),
    );
  });

  it('writes executive-email.md to output dir', async () => {
    const agent = new ExecutiveCommunicationAgent();
    await agent.execute(makeCtx());
    expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
      expect.stringContaining('executive-email.md'),
      expect.any(String),
    );
  });

  it('writes dashboard-summary.json to output dir', async () => {
    const agent = new ExecutiveCommunicationAgent();
    await agent.execute(makeCtx());
    expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
      expect.stringContaining('dashboard-summary.json'),
      expect.any(String),
    );
  });

  it("output dir defaults to 'dist/exec-comms'", async () => {
    const agent = new ExecutiveCommunicationAgent();
    await agent.execute(makeCtx());
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith('dist/exec-comms', { recursive: true });
  });

  it('uses custom outputDir from sharedState', async () => {
    const agent = new ExecutiveCommunicationAgent();
    await agent.execute(makeCtx({ sharedState: { outputDir: 'custom/output' } }));
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith('custom/output', { recursive: true });
  });
});
