import { describe, it, expect, vi } from 'vitest';
import { ServiceAdapter } from '../src/service-adapter.js';
import { BaseController, BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult, OrchestrationResult, ServiceInputs, Trigger } from '@opsagents/core';

class EchoAgent extends BaseAgent {
  readonly id = 'echo';
  readonly name = 'Echo Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';
  protected async run(ctx: AgentContext): Promise<AgentResult> {
    return { agentId: this.id, status: 'success', output: { serviceId: ctx.inputs.serviceId }, durationMs: 1 };
  }
}

class PassController extends BaseController {
  readonly id = 'pass-ctrl';
  readonly name = 'Pass Controller';
  protected async runOrchestration(trigger: Trigger, inputs: ServiceInputs, sessionId: string): Promise<AgentResult[]> {
    const ctx: AgentContext = {
      sessionId, serviceId: inputs.serviceId, triggeredBy: this.id, inputs, sharedState: {},
    };
    const results: AgentResult[] = [];
    for (const agent of this.getRegisteredAgents()) {
      results.push(await agent.execute(ctx));
    }
    return results;
  }
}

describe('ServiceAdapter', () => {
  it('run() dispatches to controllers and returns all OrchestrationResults', async () => {
    const ctrl = new PassController();
    ctrl.registerAgent(new EchoAgent());

    const adapter = new ServiceAdapter({ serviceId: 'svc-1', controllers: [ctrl] });
    const results = await adapter.run(
      { type: 'manual', reason: 'test' },
      { serviceId: 'svc-1', timestamp: 1000, monitors: { cpuPercent: 10, memoryPercent: 20, diskIoMbps: 1, networkMbps: 5 } },
    );

    expect(results).toHaveLength(1);
    expect(results[0].overallStatus).toBe('success');
    expect(results[0].agentResults[0].agentId).toBe('echo');
  });

  it('normalizes inputs before passing to controllers', async () => {
    const ctrl = new PassController();
    ctrl.registerAgent(new EchoAgent());

    const adapter = new ServiceAdapter({ serviceId: 'svc-1', controllers: [ctrl] });
    const raw = { serviceId: 'svc-1', monitors: { cpuPercent: 10, memoryPercent: 20, diskIoMbps: 1, networkMbps: 5 } } as ServiceInputs;
    const results = await adapter.run({ type: 'manual', reason: 'test' }, raw);
    expect(results[0].agentResults[0].status).toBe('success');
  });

  it('throws if adapter serviceId does not match inputs serviceId', async () => {
    const ctrl = new PassController();
    const adapter = new ServiceAdapter({ serviceId: 'svc-1', controllers: [ctrl] });
    const inputs: ServiceInputs = { serviceId: 'other-svc', timestamp: 1000 };
    await expect(adapter.run({ type: 'manual', reason: 'test' }, inputs)).rejects.toThrow(
      'serviceId mismatch',
    );
  });
});
