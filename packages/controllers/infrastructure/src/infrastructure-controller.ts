import {
  BaseController,
  AgentRegistry,
  EventBus,
  type AgentContext,
  type AgentResult,
  type OrchestrationResult,
  type ServiceInputs,
  type Trigger,
} from '@opsagents/core';
import {
  HardwarePlannerAgent,
  SecurityComplianceAgent,
  CostOptimizationAgent,
  KnowledgeGraphAgent,
} from '@opsagents/agents-infrastructure';

export interface InfrastructureControllerResult {
  status: 'success' | 'partial' | 'failure' | 'escalated';
  results: AgentResult[];
  escalatedBy?: string;
  orchestration: OrchestrationResult;
}

export class InfrastructureController extends BaseController {
  readonly id = 'infrastructure-controller';
  readonly name = 'Infrastructure Controller';

  constructor(
    private readonly registry: AgentRegistry,
    private readonly eventBus: EventBus,
  ) {
    super();

    const agents = [
      new HardwarePlannerAgent(),
      new SecurityComplianceAgent(),
      new CostOptimizationAgent(),
      new KnowledgeGraphAgent(),
    ];

    for (const agent of agents) {
      this.registry.register(agent);
      this.registerAgent(agent);
    }
  }

  async orchestrate(inputs: ServiceInputs): Promise<InfrastructureControllerResult>;
  override async orchestrate(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult>;
  override async orchestrate(
    triggerOrInputs: Trigger | ServiceInputs,
    maybeInputs?: ServiceInputs,
  ): Promise<InfrastructureControllerResult | OrchestrationResult> {
    if (maybeInputs) {
      return super.orchestrate(triggerOrInputs as Trigger, maybeInputs);
    }

    const inputs = triggerOrInputs as ServiceInputs;
    const trigger: Trigger = {
      type: 'schedule',
      cronExpression: 'on-demand',
    };

    const orchestration = await super.orchestrate(trigger, inputs);
    const escalatedBy = orchestration.agentResults.find((r) => r.escalate)?.agentId;

    return {
      status: orchestration.overallStatus,
      results: orchestration.agentResults,
      escalatedBy,
      orchestration,
    };
  }

  /** Agents run in parallel — all infra agents are independent. */
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
        monitors: inputs.monitors,
        machineParams: inputs.machineParams,
        perfLog: inputs.perfLog,
        incident: inputs.incident,
      },
      sharedState: { trigger },
    };

    const agents = this.getRegisteredAgents();
    this.eventBus.publish('infrastructure-controller:started', { controllerId: this.id, agentCount: agents.length });

    const settled = await Promise.allSettled(agents.map((a) => a.execute(ctx)));

    const results: AgentResult[] = settled.map((s, i) => {
      const agent = agents[i];
      if (s.status === 'fulfilled') {
        this.eventBus.publish('infrastructure-controller:agent-completed', { agentId: agent.id, result: s.value });
        return s.value;
      }
      return {
        agentId: agent.id,
        status: 'failure' as const,
        output: { error: String(s.reason) },
        durationMs: 0,
      };
    });

    return results;
  }
}
