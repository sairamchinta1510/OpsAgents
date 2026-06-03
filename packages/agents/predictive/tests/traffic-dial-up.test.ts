import { describe, it, expect, beforeEach } from 'vitest';
import { AgentCategory } from '@opsagents/core';
import { TrafficDialUpAgent } from '../src/traffic-dial-up.js';

function makeCtx(inputs: Record<string, unknown>) {
  return { trigger: { type: 'manual' as const, serviceId: 'svc', timestamp: 1000 }, inputs };
}

describe('TrafficDialUpAgent', () => {
  let agent: TrafficDialUpAgent;
  beforeEach(() => { agent = new TrafficDialUpAgent(); });

  it('has correct id, category, acceptedInputs', () => {
    expect(agent.id).toBe('traffic-dial-up');
    expect(agent.category).toBe(AgentCategory.PREDICTIVE);
    expect(agent.acceptedInputs).toContain('perf-log');
    expect(agent.acceptedInputs).toContain('machine-params');
  });

  it('skips when both perfLog and machineParams absent', async () => {
    const result = await agent.execute(makeCtx({}));
    expect(result.status).toBe('skipped');
  });

  it('should dial up when throughput high and cpu has headroom', async () => {
    const result = await agent.execute(makeCtx({
      perfLog: { p50Latency: 100, p99Latency: 300, errorRate: 0.01, throughput: 6000 },
      machineParams: { cpuPercent: 50, memoryPercent: 60 }
    }));
    expect(result.status).toBe('success');
    expect((result.output as { shouldDialUp: boolean }).shouldDialUp).toBe(true);
    expect((result.output as { dialUpPercent: number }).dialUpPercent).toBe(10);
  });

  it('escalates when throughput high and cpu already stressed', async () => {
    const result = await agent.execute(makeCtx({
      perfLog: { p50Latency: 200, p99Latency: 500, errorRate: 0.02, throughput: 7000 },
      machineParams: { cpuPercent: 80, memoryPercent: 75 }
    }));
    expect(result.escalate).toBe(true);
  });

  it('does not dial up when throughput below threshold', async () => {
    const result = await agent.execute(makeCtx({
      perfLog: { p50Latency: 50, p99Latency: 100, errorRate: 0.01, throughput: 1000 },
      machineParams: { cpuPercent: 30, memoryPercent: 40 }
    }));
    expect(result.status).toBe('failure');
    expect((result.output as { shouldDialUp: boolean }).shouldDialUp).toBe(false);
  });
});
