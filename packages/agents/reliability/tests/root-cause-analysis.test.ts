import { describe, it, expect } from 'vitest';
import { RootCauseAnalysisAgent } from '../src/root-cause-analysis.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

function makeCtx(inputs: ServiceInputs): AgentContext {
  return { sessionId: 'test', serviceId: inputs.serviceId, triggeredBy: 'test', inputs, sharedState: {} };
}

describe('RootCauseAnalysisAgent', () => {
  it('has correct id and category', () => {
    const a = new RootCauseAnalysisAgent();
    expect(a.id).toBe('root-cause-analysis');
    expect(a.category).toBe('reliability');
  });

  it('returns skipped with no inputs', async () => {
    const a = new RootCauseAnalysisAgent();
    const r = await a.execute(makeCtx({ serviceId: 'svc', timestamp: 0 }));
    expect(r.status).toBe('skipped');
  });

  it('generates commit-regression hypothesis from code input', async () => {
    const a = new RootCauseAnalysisAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      code: { commitSha: 'abc123', coverage: 45 },
    }));
    expect(r.status).toBe('success');
    const o = r.output as { hypotheses: { hypothesis: string; confidence: string }[] };
    expect(o.hypotheses.some((h) => h.hypothesis.includes('abc123'))).toBe(true);
    expect(o.hypotheses.find((h) => h.hypothesis.includes('abc123'))?.confidence).toBe('high');
  });

  it('generates cascading failure hypothesis from high error rate', async () => {
    const a = new RootCauseAnalysisAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      perfLog: { p50Latency: 50, p99Latency: 400, errorRate: 0.08, throughput: 500 },
    }));
    const o = r.output as { topHypothesis: { hypothesis: string } };
    expect(o.topHypothesis.hypothesis).toContain('cascading');
  });

  it('includes top hypothesis in output', async () => {
    const a = new RootCauseAnalysisAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      incident: { alertId: 'a1', severity: 'critical', message: 'DB down', source: 'db', timestamp: Date.now() },
    }));
    const o = r.output as { topHypothesis: unknown };
    expect(o.topHypothesis).not.toBeNull();
  });

  it('produces low-confidence fallback when no signals', async () => {
    const a = new RootCauseAnalysisAgent();
    // Provide incident with low severity — no perf or code signals
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      incident: { alertId: 'a2', severity: 'low', message: 'minor blip', source: 'cron', timestamp: Date.now() },
    }));
    const o = r.output as { topHypothesis: { confidence: string } };
    expect(o.topHypothesis.confidence).toBe('low');
  });
});
