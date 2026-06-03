import { describe, it, expect, beforeEach } from 'vitest';
import { AgentCategory } from '@opsagents/core';
import { TrafficPredictionAgent } from '../src/traffic-prediction.js';

function makeCtx(inputs: Record<string, unknown>) {
  return { trigger: { type: 'manual' as const, serviceId: 'svc', timestamp: 1000 }, inputs };
}

describe('TrafficPredictionAgent', () => {
  let agent: TrafficPredictionAgent;
  beforeEach(() => { agent = new TrafficPredictionAgent(); });

  it('has correct id, category, acceptedInputs', () => {
    expect(agent.id).toBe('traffic-prediction');
    expect(agent.category).toBe(AgentCategory.PREDICTIVE);
    expect(agent.acceptedInputs).toContain('perf-log');
  });

  it('skips when perfLog is absent', async () => {
    const result = await agent.execute(makeCtx({}));
    expect(result.status).toBe('skipped');
    expect(result.escalate).toBeFalsy();
  });

  it('succeeds (no spike predicted) for low traffic', async () => {
    const result = await agent.execute(makeCtx({
      perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.01, throughput: 1000 }
    }));
    expect(result.status).toBe('success');
    expect((result.output as { predicted: boolean }).predicted).toBe(false);
  });

  it('does not predict a spike when score stays at or below 0.7', async () => {
    const result = await agent.execute(makeCtx({
      perfLog: { p50Latency: 200, p99Latency: 900, errorRate: 0.02, throughput: 8000 }
    }));
    expect(result.status).toBe('success');
    expect((result.output as { predicted: boolean }).predicted).toBe(false);
    expect(result.escalate).toBeFalsy();
  });

  it('fails (spike predicted) for elevated traffic', async () => {
    const result = await agent.execute(makeCtx({
      perfLog: { p50Latency: 200, p99Latency: 900, errorRate: 0.02, throughput: 9000 }
    }));
    expect(result.status).toBe('failure');
    expect((result.output as { predicted: boolean }).predicted).toBe(true);
    expect(result.escalate).toBeFalsy();
  });

  it('escalates for critical traffic pattern', async () => {
    const result = await agent.execute(makeCtx({
      perfLog: { p50Latency: 500, p99Latency: 2000, errorRate: 0.1, throughput: 15000 }
    }));
    expect(result.escalate).toBe(true);
  });

  it('output always contains score, recommendation, p99Latency and throughput', async () => {
    const result = await agent.execute(makeCtx({
      perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.01, throughput: 1000 }
    }));
    const out = result.output as { score: number; recommendation: string; p99Latency: number; throughput: number };
    expect(typeof out.score).toBe('number');
    expect(typeof out.recommendation).toBe('string');
    expect(out.p99Latency).toBe(200);
    expect(out.throughput).toBe(1000);
  });
});
