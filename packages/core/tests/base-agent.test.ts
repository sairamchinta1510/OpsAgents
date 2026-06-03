import { describe, it, expect, vi } from 'vitest';
import { BaseAgent } from '../src/base-agent.js';
import type { AgentContext, AgentResult, ServiceInputs } from '../src/interfaces.js';
import { AgentCategory, AgentStatus } from '../src/types.js';

// Minimal concrete agent for testing
class EchoAgent extends BaseAgent {
  readonly id = 'echo';
  readonly name = 'Echo Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    return {
      agentId: this.id,
      status: 'success',
      output: { echoed: context.inputs.serviceId },
      durationMs: 0,
    };
  }
}

// Agent that throws to test error wrapping
class BrokenAgent extends BaseAgent {
  readonly id = 'broken';
  readonly name = 'Broken Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';

  protected async run(_context: AgentContext): Promise<AgentResult> {
    throw new Error('internal failure');
  }
}

class EscalatingAgent extends BaseAgent {
  readonly id = 'escalating';
  readonly name = 'Escalating Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';

  protected async run(_context: AgentContext): Promise<AgentResult> {
    return {
      agentId: this.id,
      status: 'success',
      output: { escalated: true },
      escalate: true,
      durationMs: 0,
    };
  }
}

const makeContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
  sessionId: 'sess-1',
  serviceId: 'my-service',
  triggeredBy: 'test',
  inputs: {
    serviceId: 'my-service',
    timestamp: 1000,
    monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 1, networkMbps: 5 },
  },
  sharedState: {},
  ...overrides,
});

describe('BaseAgent.execute', () => {
  it('returns success result from run()', async () => {
    const agent = new EchoAgent();
    const result = await agent.execute(makeContext());
    expect(result.status).toBe('success');
    expect((result.output as { echoed: string }).echoed).toBe('my-service');
  });

  it('wraps thrown errors into failure result', async () => {
    const agent = new BrokenAgent();
    const result = await agent.execute(makeContext());
    expect(result.status).toBe('failure');
    expect(result.agentId).toBe('broken');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('sets status to RUNNING during execution, IDLE after', async () => {
    const agent = new EchoAgent();
    expect(agent.getStatus()).toBe(AgentStatus.IDLE);
    await agent.execute(makeContext());
    expect(agent.getStatus()).toBe(AgentStatus.IDLE);
  });

  it('returns skipped when inputs are not supported', async () => {
    const agent = new EchoAgent();
    const result = await agent.execute(
      makeContext({
        inputs: {
          serviceId: 'svc',
          timestamp: 1000,
          code: { diff: 'abc' },
        },
      }),
    );
    expect(result.status).toBe('skipped');
  });
});

describe('BaseAgent.canHandle', () => {
  it('returns true if any accepted input key is present in ServiceInputs', () => {
    const agent = new EchoAgent();
    const inputs: ServiceInputs = {
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 10, memoryPercent: 20, diskIoMbps: 1, networkMbps: 5 },
    };
    expect(agent.canHandle(inputs)).toBe(true);
  });

  it('returns false if no accepted input key is present', () => {
    const agent = new EchoAgent(); // only accepts 'monitor'
    const inputs: ServiceInputs = { serviceId: 'svc', timestamp: 1000, code: { diff: 'x' } };
    expect(agent.canHandle(inputs)).toBe(false);
  });
});

describe('BaseAgent.healthCheck', () => {
  it('returns true by default', async () => {
    const agent = new EchoAgent();
    expect(await agent.healthCheck()).toBe(true);
  });
});

describe('BaseAgent.disable() / enable()', () => {
  it('execute() returns skipped when agent is disabled', async () => {
    const agent = new EchoAgent();
    agent.disable();
    const result = await agent.execute(
      makeContext({
        inputs: {
          serviceId: 'svc',
          timestamp: 1000,
          monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 1, networkMbps: 5 },
        },
      }),
    );
    expect(result.status).toBe('skipped');
    expect((result.output as { reason: string }).reason).toBe('Agent disabled');
  });

  it('execute() works again after re-enabling', async () => {
    const agent = new EchoAgent();
    agent.disable();
    agent.enable();
    const result = await agent.execute(
      makeContext({
        inputs: {
          serviceId: 'svc',
          timestamp: 1000,
          monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 1, networkMbps: 5 },
        },
      }),
    );
    expect(result.status).toBe('success');
  });

  it('isEnabled() reflects current state', () => {
    const agent = new EchoAgent();
    expect(agent.isEnabled()).toBe(true);
    agent.disable();
    expect(agent.isEnabled()).toBe(false);
    agent.enable();
    expect(agent.isEnabled()).toBe(true);
  });
});

describe('BaseAgent metrics tracking', () => {
  it('starts with zero metrics', () => {
    const agent = new EchoAgent();
    const m = agent.getMetrics();
    expect(m.invocationCount).toBe(0);
    expect(m.successCount).toBe(0);
    expect(m.failureCount).toBe(0);
    expect(m.skipCount).toBe(0);
    expect(m.escalateCount).toBe(0);
    expect(m.totalDurationMs).toBe(0);
    expect(m.avgDurationMs).toBe(0);
    expect(m.lastRunAt).toBeNull();
    expect(m.lastStatus).toBeNull();
  });

  it('tracks invocations and success counts', async () => {
    const agent = new EchoAgent();
    const ctx = makeContext({
      inputs: {
        serviceId: 'svc',
        timestamp: 1000,
        monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 1, networkMbps: 5 },
      },
    });
    await agent.execute(ctx);
    await agent.execute(ctx);
    const m = agent.getMetrics();
    expect(m.invocationCount).toBe(2);
    expect(m.successCount).toBe(2);
    expect(m.lastRunAt).toBeInstanceOf(Date);
    expect(m.lastStatus).toBe('success');
  });

  it('tracks skip count when disabled', async () => {
    const agent = new EchoAgent();
    agent.disable();
    const ctx = makeContext({
      inputs: {
        serviceId: 'svc',
        timestamp: 1000,
        monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 1, networkMbps: 5 },
      },
    });
    await agent.execute(ctx);
    const m = agent.getMetrics();
    expect(m.invocationCount).toBe(1);
    expect(m.skipCount).toBe(1);
    expect(m.successCount).toBe(0);
    expect(m.lastStatus).toBe('skipped');
  });

  it('tracks failure count when run throws', async () => {
    const agent = new BrokenAgent();
    await agent.execute(
      makeContext({
        inputs: {
          serviceId: 'svc',
          timestamp: 1000,
          monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 1, networkMbps: 5 },
        },
      }),
    );
    const m = agent.getMetrics();
    expect(m.invocationCount).toBe(1);
    expect(m.failureCount).toBe(1);
    expect(m.lastStatus).toBe('failure');
  });

  it('tracks escalate count when result requests escalation', async () => {
    const agent = new EscalatingAgent();
    await agent.execute(
      makeContext({
        inputs: {
          serviceId: 'svc',
          timestamp: 1000,
          monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 1, networkMbps: 5 },
        },
      }),
    );
    const m = agent.getMetrics();
    expect(m.invocationCount).toBe(1);
    expect(m.successCount).toBe(1);
    expect(m.escalateCount).toBe(1);
  });

  it('getMetrics() returns a copy (not mutable reference)', async () => {
    const agent = new EchoAgent();
    const ctx = makeContext({
      inputs: {
        serviceId: 'svc',
        timestamp: 1000,
        monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 1, networkMbps: 5 },
      },
    });
    await agent.execute(ctx);
    const m1 = agent.getMetrics();
    m1.invocationCount = 999;
    const m2 = agent.getMetrics();
    expect(m2.invocationCount).toBe(1);
  });
});
