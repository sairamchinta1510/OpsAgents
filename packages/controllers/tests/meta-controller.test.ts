import { describe, it, expect } from 'vitest';
import { MetaController } from '../src/meta-controller.js';
import { BaseController, BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs, Trigger } from '@opsagents/core';

class StubDomainController extends BaseController {
  constructor(public readonly id: string, public readonly name: string) { super(); }
  protected async runOrchestration(trigger: Trigger, inputs: ServiceInputs, sessionId: string): Promise<AgentResult[]> {
    return [{ agentId: 'stub', status: 'success', output: {}, durationMs: 1 }];
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

    // MetaController returns one AgentResult per domain controller
    expect(result.agentResults).toHaveLength(2);
    expect(result.overallStatus).toBe('success');
  });

  it('has id "meta-controller" and name "Meta Controller"', () => {
    const meta = new MetaController();
    expect(meta.id).toBe('meta-controller');
    expect(meta.name).toBe('Meta Controller');
  });
});
