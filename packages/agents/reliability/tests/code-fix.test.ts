import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeFixAgent } from '../src/code-fix.js';
import type { AgentContext } from '@opsagents/core';

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    sessionId: 'sess-001',
    serviceId: 'epg-service',
    triggeredBy: 'incident-controller',
    inputs: {
      serviceId: 'epg-service',
      timestamp: Date.now(),
      codeRepo: 'acme/epg-service',
    },
    sharedState: {
      priorResults: [
        {
          agentId: 'root-cause-analysis',
          status: 'success',
          output: {
            topHypothesis: {
              hypothesis: 'Null pointer in schedule parser',
              confidence: 'high',
              suggestedFix: 'Add null-check for programme.end_time',
              evidenceSignals: ['commit abc123'],
            },
            summary: 'Top hypothesis: null pointer',
          },
          durationMs: 0,
        },
      ],
    },
    ...overrides,
  };
}

describe('CodeFixAgent', () => {
  let mockShell: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockShell = vi.fn().mockReturnValue('https://github.com/acme/epg-service/pull/42');
  });

  it('returns success and pr_url when shell commands succeed', async () => {
    const agent = new CodeFixAgent(mockShell);
    const result = await agent.execute(makeCtx());
    expect(result.status).toBe('success');
    expect((result.output as Record<string, unknown>).pr_url).toBe(
      'https://github.com/acme/epg-service/pull/42',
    );
  });

  it('branch name contains auto-patch prefix', async () => {
    const agent = new CodeFixAgent(mockShell);
    await agent.execute(makeCtx());
    const checkoutCall = (mockShell.mock.calls as string[][]).find((args) =>
      (args[0] as string).includes('checkout'),
    );
    expect(checkoutCall?.[0]).toMatch(/git checkout -b fix\/auto-patch-/);
  });

  it('files_changed is populated', async () => {
    const agent = new CodeFixAgent(mockShell);
    const result = await agent.execute(makeCtx());
    expect((result.output as Record<string, unknown>).files_changed).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
  });

  it('escalates when no codeRepo in inputs', async () => {
    const agent = new CodeFixAgent(mockShell);
    const ctx = makeCtx();
    ctx.inputs.codeRepo = undefined;
    const result = await agent.execute(ctx);
    expect(result.status).toBe('escalate');
    expect(result.escalate).toBe(true);
  });

  it('skips when no RCA result in priorResults', async () => {
    const agent = new CodeFixAgent(mockShell);
    const ctx = makeCtx({ sharedState: { priorResults: [] } });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });

  it('escalates when shell throws (gh CLI unavailable)', async () => {
    const failingShell = vi.fn().mockImplementation(() => {
      throw new Error('gh: command not found');
    });
    const agent = new CodeFixAgent(failingShell);
    const result = await agent.execute(makeCtx());
    expect(result.status).toBe('escalate');
    expect(result.escalate).toBe(true);
    expect((result.output as Record<string, unknown>).error).toContain('gh: command not found');
  });
});
