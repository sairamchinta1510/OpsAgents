import { describe, it, expect } from 'vitest';
import { IssueIdentificationAgent } from '../src/issue-identification.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

function makeCtx(inputs: ServiceInputs): AgentContext {
  return { sessionId: 'test', serviceId: inputs.serviceId, triggeredBy: 'test', inputs, sharedState: {} };
}

describe('IssueIdentificationAgent', () => {
  it('has correct id and category', () => {
    const a = new IssueIdentificationAgent();
    expect(a.id).toBe('issue-identification');
    expect(a.category).toBe('reliability');
  });

  it('returns skipped with no inputs', async () => {
    const a = new IssueIdentificationAgent();
    const r = await a.execute(makeCtx({ serviceId: 'svc', timestamp: 0 }));
    expect(r.status).toBe('skipped');
  });

  it('returns success with low severity incident', async () => {
    const a = new IssueIdentificationAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      incident: { alertId: 'a1', severity: 'low', message: 'minor issue', source: 'api', timestamp: Date.now() },
    }));
    expect(r.status).toBe('success');
  });

  it('escalates on critical blast radius', async () => {
    const a = new IssueIdentificationAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      incident: { alertId: 'a1', severity: 'critical', message: 'outage', source: 'api', timestamp: Date.now() },
      monitors: { cpuPercent: 90, memoryPercent: 85, diskIoMbps: 5, networkMbps: 2 },
      perfLog: { p50Latency: 50, p99Latency: 900, errorRate: 0.1, throughput: 500 },
    }));
    expect(r.escalate).toBe(true);
    const o = r.output as { blastRadius: string };
    expect(o.blastRadius).toBe('cross-service');
  });

  it('computes contained blast radius for single component', async () => {
    const a = new IssueIdentificationAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      incident: { alertId: 'a2', severity: 'medium', message: 'slow queries', source: 'db', timestamp: Date.now() },
    }));
    const o = r.output as { blastRadius: string };
    expect(o.blastRadius).toBe('contained');
  });
});
