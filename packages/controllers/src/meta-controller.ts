import { BaseController } from '@opsagents/core';
import type { AgentResult, IController, ServiceInputs, Trigger } from '@opsagents/core';

export class MetaController extends BaseController {
  readonly id = 'meta-controller';
  readonly name = 'Meta Controller';

  private readonly domainControllers: IController[] = [];

  addDomainController(controller: IController): void {
    this.domainControllers.push(controller);
  }

  getDomainControllers(): IController[] {
    return [...this.domainControllers];
  }

  protected async runOrchestration(
    trigger: Trigger,
    inputs: ServiceInputs,
    sessionId: string,
  ): Promise<AgentResult[]> {
    // Each domain controller runs; its OrchestrationResult becomes one AgentResult summary
    const results = await Promise.allSettled(
      this.domainControllers.map((ctrl) => ctrl.orchestrate(trigger, inputs)),
    );

    return results.map((settled, i) => {
      const ctrl = this.domainControllers[i];
      if (settled.status === 'fulfilled') {
        const orch = settled.value;
        return {
          agentId: ctrl.id,
          status: orch.overallStatus === 'failure' ? 'failure' : 'success',
          output: orch,
          durationMs: orch.durationMs,
          escalate: orch.overallStatus === 'escalated',
        } satisfies AgentResult;
      } else {
        return {
          agentId: ctrl.id,
          status: 'failure',
          output: { error: String(settled.reason) },
          durationMs: 0,
        } satisfies AgentResult;
      }
    });
  }
}
