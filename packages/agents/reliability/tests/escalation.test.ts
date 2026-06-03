import { describe, it, expect } from 'vitest';
import { EscalationAgent } from '../src/escalation.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

function makeCtx(inputs: ServiceInputs): AgentContext {
  return { sessionId: 'test', serviceId: inputs.serviceId, triggeredBy: 'test', inputs, sharedState: {} };
}

describe('EscalationAgent', () => {
  it('has correct id and category', () => {
    const a = new EscalationAgent();
    expect(a.id).toBe('escalation');
    expect(a.category).toBe('reliability');
  });

  it('returns skipped with no incident', async () => {
    const a = new EscalationAgent();
    const r = await a.execute(makeCtx({ serviceId: 'svc', timestamp: 0 }));
    expect(r.status).toBe('skipped');
  });

  it('escalates critical incident via pagerduty and slack', async () => {
    const a = new EscalationAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      incident: { alertId: 'a1', severity: 'critical', message: 'DB outage', source: 'db', timestamp: Date.now() },
    }));
    expect(r.status).toBe('success');
    const o = r.output as { escalated: boolean; actions: { channel: string }[] };
    expect(o.escalated).toBe(true);
    expect(o.actions.some((a) => a.channel === 'pagerduty')).toBe(true);
    expect(o.actions.some((a) => a.channel === 'slack')).toBe(true);
  });

  it('does not escalate low-severity recent incident', async () => {
    const a = new EscalationAgent();
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      incident: { alertId: 'a2', severity: 'low', message: 'minor', source: 'cron', timestamp: Date.now() },
    }));
    const o = r.output as { escalated: boolean };
    expect(o.escalated).toBe(false);
  });

  it('sends email when SLA is breached', async () => {
    const a = new EscalationAgent();
    // Simulate a medium incident created 2 hours ago (SLA = 1 hour)
    const oldTimestamp = Date.now() - 2 * 60 * 60 * 1_000;
    const r = await a.execute(makeCtx({
      serviceId: 'svc', timestamp: 0,
      incident: { alertId: 'a3', severity: 'medium', message: 'slow responses', source: 'api', timestamp: oldTimestamp },
    }));
    const o = r.output as { slaBreached: boolean; actions: { channel: string }[] };
    expect(o.slaBreached).toBe(true);
    expect(o.actions.some((a) => a.channel === 'email')).toBe(true);
  });
});
