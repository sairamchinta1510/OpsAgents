import { describe, it, expect } from 'vitest';
import { MetaController } from '../src/meta-controller.js';
import { BaseController, EventBus } from '@opsagents/core';
import type { AgentResult, ServiceInputs, Trigger } from '@opsagents/core';

class StubDomainController extends BaseController {
  constructor(
    public readonly id: string,
    public readonly name: string,
    private readonly shouldEscalate = false,
    private readonly delayMs = 0,
  ) { super(); }

  protected async runOrchestration(_trigger: Trigger, _inputs: ServiceInputs, _sessionId: string): Promise<AgentResult[]> {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
    return [{
      agentId: 'stub',
      status: this.shouldEscalate ? 'failure' : 'success',
      output: {},
      durationMs: this.delayMs,
      escalate: this.shouldEscalate,
    }];
  }
}

describe('MetaController', () => {
  it('registers domain controllers', () => {
    const meta = new MetaController();
    meta.addDomainController(new StubDomainController('d1', 'D1'));
    expect(meta.getDomainControllers()).toHaveLength(1);
  });

  it('orchestrate dispatches to all domain controllers when trigger type is "manual"', async () => {
    const meta = new MetaController();
    meta.addDomainController(new StubDomainController('d1', 'D1'));
    meta.addDomainController(new StubDomainController('d2', 'D2'));

    const result = await meta.orchestrate(
      { type: 'manual', reason: 'full sweep' },
      { serviceId: 'svc', timestamp: 1000 },
    );

    expect(result.agentResults).toHaveLength(2);
    expect(result.overallStatus).toBe('success');
  });

  it('has id "meta-controller" and name "Meta Controller"', () => {
    const meta = new MetaController();
    expect(meta.id).toBe('meta-controller');
    expect(meta.name).toBe('Meta Controller');
  });

  it('accepts custom EventBus in constructor', () => {
    const bus = new EventBus();
    const meta = new MetaController(bus);
    expect(meta.id).toBe('meta-controller');
  });

  it('sets escalate flag when a domain controller escalates', async () => {
    const meta = new MetaController();
    meta.addDomainController(new StubDomainController('d1', 'D1', false));
    meta.addDomainController(new StubDomainController('d2', 'D2', true));

    const result = await meta.orchestrate(
      { type: 'manual', reason: 'test' },
      { serviceId: 'svc', timestamp: 1000 },
    );

    const d2Result = result.agentResults.find((r) => r.agentId === 'd2');
    expect(d2Result?.escalate).toBe(true);
  });

  it('respects custom SLA config per controller', () => {
    const meta = new MetaController();
    const ctrl = new StubDomainController('d1', 'D1');
    meta.addDomainController(ctrl, 5_000);
    expect(meta.getSlaConfig('d1')).toBe(5_000);
  });

  it('uses default SLA when no config specified', () => {
    const meta = new MetaController();
    meta.addDomainController(new StubDomainController('d1', 'D1'));
    expect(meta.getSlaConfig('d1')).toBe(30_000);
  });
});
