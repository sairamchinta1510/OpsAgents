import { describe, it, expect } from 'vitest';
import { BaseController } from '../src/base-controller.js';
import { BaseAgent } from '../src/base-agent.js';
import type { AgentContext, AgentResult, OrchestrationResult, ServiceInputs, Trigger } from '../src/interfaces.js';
import { AgentCategory } from '../src/types.js';

class PassAgent extends BaseAgent {
  readonly id = 'pass-agent';
  readonly name = 'Pass Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';
  protected async run(ctx: AgentContext): Promise<AgentResult> {
    return { agentId: this.id, status: 'success', output: { ok: true }, durationMs: 5 };
  }
}

class FailAgent extends BaseAgent {
  readonly id = 'fail-agent';
  readonly name = 'Fail Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';
  protected async run(ctx: AgentContext): Promise<AgentResult> {
    return { agentId: this.id, status: 'failure', output: { error: 'bad' }, durationMs: 5 };
  }
}

class SequentialController extends BaseController {
  readonly id = 'seq-ctrl';
  readonly name = 'Sequential Controller';

  protected async runOrchestration(
    trigger: Trigger,
    inputs: ServiceInputs,
    sessionId: string,
  ): Promise<AgentResult[]> {
    const ctx: AgentContext = {
      sessionId,
      serviceId: inputs.serviceId,
      triggeredBy: this.id,
      inputs,
      sharedState: {},
    };
    const results: AgentResult[] = [];
    for (const agent of this.getRegisteredAgents()) {
      results.push(await agent.execute(ctx));
    }
    return results;
  }
}

const makeInputs = (): ServiceInputs => ({
  serviceId: 'test-svc',
  timestamp: 1000,
  monitors: { cpuPercent: 10, memoryPercent: 20, diskIoMbps: 1, networkMbps: 5 },
});

describe('BaseController', () => {
  it('registers agents and lists them', () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new PassAgent());
    expect(ctrl.getRegisteredAgents()).toHaveLength(1);
  });

  it('returns orchestration result with all agent results', async () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new PassAgent());
    const result = await ctrl.orchestrate({ type: 'manual', reason: 'test' }, makeInputs());
    expect(result.agentResults).toHaveLength(1);
    expect(result.agentResults[0].status).toBe('success');
  });

  it('sets overallStatus to "partial" when any agent fails', async () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new PassAgent());
    ctrl.registerAgent(new FailAgent());
    const result = await ctrl.orchestrate({ type: 'manual', reason: 'test' }, makeInputs());
    expect(result.overallStatus).toBe('partial');
  });

  it('sets overallStatus to "success" when all agents pass', async () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new PassAgent());
    const result = await ctrl.orchestrate({ type: 'manual', reason: 'test' }, makeInputs());
    expect(result.overallStatus).toBe('success');
  });

  it('sets overallStatus to "failure" when all agents fail', async () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new FailAgent());
    const result = await ctrl.orchestrate({ type: 'manual', reason: 'test' }, makeInputs());
    expect(result.overallStatus).toBe('failure');
  });

  it('populates controllerId and sessionId in result', async () => {
    const ctrl = new SequentialController();
    ctrl.registerAgent(new PassAgent());
    const result = await ctrl.orchestrate({ type: 'manual', reason: 'test' }, makeInputs());
    expect(result.controllerId).toBe('seq-ctrl');
    expect(typeof result.sessionId).toBe('string');
    expect(result.sessionId.length).toBeGreaterThan(0);
  });
});
