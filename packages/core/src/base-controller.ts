import { randomUUID } from 'node:crypto';
import type { AgentResult, IAgent, IController, OrchestrationResult, ServiceInputs, Trigger } from './interfaces.js';

export abstract class BaseController implements IController {
  abstract readonly id: string;
  abstract readonly name: string;

  private readonly agents: IAgent[] = [];

  // Subclasses implement the orchestration logic, returning raw agent results
  protected abstract runOrchestration(
    trigger: Trigger,
    inputs: ServiceInputs,
    sessionId: string,
  ): Promise<AgentResult[]>;

  registerAgent(agent: IAgent): void {
    this.agents.push(agent);
  }

  getRegisteredAgents(): IAgent[] {
    return [...this.agents];
  }

  async orchestrate(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult> {
    const sessionId = randomUUID();
    const start = Date.now();

    const agentResults = await this.runOrchestration(trigger, inputs, sessionId);

    const successes = agentResults.filter((r) => r.status === 'success').length;
    const failures = agentResults.filter((r) => r.status === 'failure').length;
    const escalations = agentResults.filter((r) => r.escalate === true).length;

    let overallStatus: OrchestrationResult['overallStatus'];
    if (escalations > 0) {
      overallStatus = 'escalated';
    } else if (failures === 0) {
      overallStatus = 'success';
    } else if (successes === 0) {
      overallStatus = 'failure';
    } else {
      overallStatus = 'partial';
    }

    return {
      controllerId: this.id,
      sessionId,
      trigger,
      agentResults,
      overallStatus,
      durationMs: Date.now() - start,
      summary: `${successes} succeeded, ${failures} failed, ${escalations} escalated out of ${agentResults.length} agents`,
    };
  }
}
