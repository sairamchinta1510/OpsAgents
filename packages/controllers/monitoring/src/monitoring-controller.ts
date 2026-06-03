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
import { MonitoringAgent, HealthCheckAgent, ContentQualityAgent } from '@opsagents/agents-monitoring';

export interface MonitoringControllerResult {
  status: 'success' | 'partial' | 'failure' | 'escalated';
  results: AgentResult[];
  alerts: string[];
  escalatedBy?: string;
  orchestration: OrchestrationResult;
}

export class MonitoringController extends BaseController {
  readonly id = 'monitoring-controller';
  readonly name = 'Monitoring Controller';

  constructor(
    private readonly registry: AgentRegistry,
    private readonly eventBus: EventBus,
  ) {
    super();

    const agents = [
      new MonitoringAgent(),
      new HealthCheckAgent(),
      new ContentQualityAgent(),
    ];

    for (const agent of agents) {
      this.registry.register(agent);
      this.registerAgent(agent);
    }
  }

  /** Convenience overload: accepts just ServiceInputs (wraps in a schedule trigger). */
  async orchestrate(inputs: ServiceInputs): Promise<MonitoringControllerResult>;
  override async orchestrate(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult>;
  override async orchestrate(
    triggerOrInputs: Trigger | ServiceInputs,
    maybeInputs?: ServiceInputs,
  ): Promise<MonitoringControllerResult | OrchestrationResult> {
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

    // Collect human-readable alerts from recommendations
    const alerts: string[] = orchestration.agentResults.flatMap((r) => r.recommendations ?? []);

    // Publish alert event so IncidentController or other subscribers can react
    if (alerts.length > 0) {
      this.eventBus.publish('monitoring-controller:alert', {
        controllerId: this.id,
        serviceId: inputs.serviceId,
        alerts,
        escalated: !!escalatedBy,
        escalatedBy,
      });
    }

    return {
      status: orchestration.overallStatus,
      results: orchestration.agentResults,
      alerts,
      escalatedBy,
      orchestration,
    };
  }

  /** Agents run in parallel — override to use Promise.allSettled instead of sequential. */
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
        monitors: inputs.monitors,
        perfLog: inputs.perfLog,
        machineParams: inputs.machineParams,
      },
      sharedState: { trigger },
    };

    const agents = this.getRegisteredAgents();

    // All agents run in parallel (monitoring agents are independent)
    this.eventBus.publish('monitoring-controller:started', { controllerId: this.id, agentCount: agents.length });

    const settled = await Promise.allSettled(
      agents.map((agent) => agent.execute(ctx)),
    );

    const results: AgentResult[] = settled.map((s, i) => {
      const agent = agents[i];
      if (s.status === 'fulfilled') {
        this.eventBus.publish('monitoring-controller:agent-completed', { agentId: agent.id, result: s.value });
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
