import { BaseController, type AgentContext, type AgentResult, type OrchestrationResult, type ServiceInputs, type Trigger, AgentRegistry, EventBus } from '@opsagents/core';
import {
  CiCdGovernanceAgent,
  DeploymentValidationAgent,
  LagIndicationAgent,
  OnDemandTestingAgent,
} from '@opsagents/agents-deployment';

export interface DeploymentControllerResult {
  status: 'success' | 'failure' | 'escalated';
  results: AgentResult[];
  escalatedBy?: string;
  orchestration: OrchestrationResult;
}

export class DeploymentController extends BaseController {
  readonly id = 'deployment-controller';
  readonly name = 'Deployment Controller';

  constructor(
    private readonly registry: AgentRegistry,
    private readonly eventBus: EventBus,
  ) {
    super();

    const agents = [
      new CiCdGovernanceAgent(),
      new DeploymentValidationAgent(),
      new LagIndicationAgent(),
      new OnDemandTestingAgent(),
    ];

    for (const agent of agents) {
      this.registry.register(agent);
      this.registerAgent(agent);
    }
  }

  async orchestrate(inputs: ServiceInputs): Promise<DeploymentControllerResult>;
  override async orchestrate(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult>;
  override async orchestrate(
    triggerOrInputs: Trigger | ServiceInputs,
    maybeInputs?: ServiceInputs,
  ): Promise<DeploymentControllerResult | OrchestrationResult> {
    if (maybeInputs) {
      return super.orchestrate(triggerOrInputs as Trigger, maybeInputs);
    }

    const inputs = triggerOrInputs as ServiceInputs;
    const trigger = {
      type: 'manual' as const,
      reason: `manual deployment for ${inputs.serviceId ?? 'unknown'}`,
      serviceId: inputs.serviceId ?? 'unknown',
      timestamp: Date.now(),
    };

    const orchestration = await super.orchestrate(trigger, inputs);
    const escalatedBy = orchestration.agentResults.find((result) => result.escalate)?.agentId;

    return {
      status: orchestration.overallStatus === 'success'
        ? 'success'
        : orchestration.overallStatus === 'escalated'
          ? 'escalated'
          : 'failure',
      results: orchestration.agentResults,
      escalatedBy,
      orchestration,
    };
  }

  protected override async runOrchestration(
    trigger: Trigger,
    inputs: ServiceInputs,
    sessionId: string,
  ): Promise<AgentResult[]> {
    const ctx: AgentContext = {
      sessionId,
      serviceId: inputs.serviceId,
      triggeredBy: this.id,
      inputs: {
        serviceId: inputs.serviceId,
        timestamp: inputs.timestamp,
        code: inputs.code,
        perfLog: inputs.perfLog,
        monitors: inputs.monitors,
        machineParams: inputs.machineParams,
      },
      sharedState: { trigger },
    };

    const results: AgentResult[] = [];

    for (const agent of this.getRegisteredAgents()) {
      this.eventBus.publish('deployment-controller:agent-started', { controllerId: this.id, agentId: agent.id, trigger });
      const result = await agent.execute(ctx);
      results.push(result);
      this.eventBus.publish('deployment-controller:agent-completed', { controllerId: this.id, agentId: agent.id, result });

      if (result.escalate === true) {
        break;
      }
    }

    return results;
  }
}
