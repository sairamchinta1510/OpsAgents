import { describe, it, expect } from 'vitest';
import { ReportingAgent } from '../src/reporting.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

function makeCtx(inputs: ServiceInputs, priorResults: unknown[] = []): AgentContext {
  return {
    sessionId: 'test-session-123',
    serviceId: inputs.serviceId,
    triggeredBy: 'test',
    inputs,
    sharedState: { priorResults },
  };
}

describe('ReportingAgent', () => {
  it('has correct id and category', () => {
    const a = new ReportingAgent();
    expect(a.id).toBe('reporting');
    expect(a.category).toBe('reliability');
  });

  it('always returns success even with no inputs', async () => {
    const a = new ReportingAgent();
    const r = await a.execute(makeCtx({ serviceId: 'svc', timestamp: 0 }));
    expect(r.status).toBe('success');
  });

  it('output contains valid JSON structure', async () => {
    const a = new ReportingAgent();
    const r = await a.execute(makeCtx({ serviceId: 'svc', timestamp: 0 }));
    const o = r.output as { json: Record<string, unknown> };
    expect(o.json).toBeDefined();
    expect(typeof o.json).toBe('object');
    expect(o.json.serviceId).toBe('svc');
    expect(o.json.generatedAt).toBeDefined();
  });

  it('output contains markdown report string', async () => {
    const a = new ReportingAgent();
    const r = await a.execute(makeCtx({ serviceId: 'svc', timestamp: 0 }));
    const o = r.output as { markdown: string };
    expect(typeof o.markdown).toBe('string');
    expect(o.markdown).toContain('# Incident Report');
  });

  it('includes incident details when incident input provided', async () => {
    const a = new ReportingAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      incident: { alertId: 'inc-42', severity: 'high', message: 'DB overload', source: 'db', timestamp: Date.now() },
    }));
    const o = r.output as { incidentId: string; markdown: string };
    expect(o.incidentId).toBe('inc-42');
    expect(o.markdown).toContain('inc-42');
  });

  it('incorporates prior agent results into sections', async () => {
    const a = new ReportingAgent();
    const priorResults = [
      { agentId: 'issue-identification', status: 'success', recommendations: ['Check DB connections'], escalate: false },
      { agentId: 'escalation', status: 'success', recommendations: ['Page on-call'], escalate: true },
    ];
    const r = await a.execute(makeCtx({ serviceId: 'svc', timestamp: 0 }, priorResults));
    const o = r.output as { sections: { title: string }[]; json: { overallStatus: string } };
    expect(o.sections.some((s) => s.title === 'Agent Timeline')).toBe(true);
    expect(o.sections.some((s) => s.title === 'Recommendations')).toBe(true);
    expect(o.json.overallStatus).toBe('escalated');
  });
});
