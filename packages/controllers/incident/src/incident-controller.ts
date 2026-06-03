import {
  BaseController,
  type AgentContext,
  type AgentResult,
  type OrchestrationResult,
  type ServiceInputs,
  type Trigger,
  AgentRegistry,
  EventBus,
} from '@opsagents/core';
import {
  IssueIdentificationAgent,
  RootCauseAnalysisAgent,
  CodeFixAgent,
  SpareTierRedundancyAgent,
  EscalationAgent,
  ReportingAgent,
  ExecutiveCommunicationAgent,
  type ShellRunner,
} from '@opsagents/agents-reliability';

export interface IncidentControllerOptions {
  codeFixShellRunner?: ShellRunner;
}

export interface IncidentControllerResult {
  status: 'success' | 'failure' | 'escalated';
  results: AgentResult[];
  escalatedBy?: string;
  orchestration: OrchestrationResult;
}

export class IncidentController extends BaseController {
  readonly id = 'incident-controller';
  readonly name = 'Incident Controller';

  constructor(
    private readonly registry: AgentRegistry,
    private readonly eventBus: EventBus,
    options?: IncidentControllerOptions,
  ) {
    super();

    const agents = [
      new IssueIdentificationAgent(),
      new RootCauseAnalysisAgent(),
      new CodeFixAgent(options?.codeFixShellRunner),
      new SpareTierRedundancyAgent(),
      new EscalationAgent(),
      new ReportingAgent(),
      new ExecutiveCommunicationAgent(),
    ];

    for (const agent of agents) {
      this.registry.register(agent);
      this.registerAgent(agent);
    }
  }

  async orchestrate(inputs: ServiceInputs): Promise<IncidentControllerResult>;
  override async orchestrate(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult>;
  override async orchestrate(
    triggerOrInputs: Trigger | ServiceInputs,
    maybeInputs?: ServiceInputs,
  ): Promise<IncidentControllerResult | OrchestrationResult> {
    if (maybeInputs) {
      return super.orchestrate(triggerOrInputs as Trigger, maybeInputs);
    }

    const inputs = triggerOrInputs as ServiceInputs;
    const trigger: Trigger = {
      type: 'alert',
      severity: inputs.incident?.severity ?? 'medium',
    };

    const orchestration = await super.orchestrate(trigger, inputs);
    const escalatedBy = orchestration.agentResults.find((r) => r.escalate)?.agentId;

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
        incident: inputs.incident,
        monitors: inputs.monitors,
        perfLog: inputs.perfLog,
        code: inputs.code,
        machineParams: inputs.machineParams,
        codeRepo: inputs.codeRepo,
      },
      sharedState: { trigger },
    };

    const results: AgentResult[] = [];
    const agents = this.getRegisteredAgents();
    const ALWAYS_RUN_IDS = new Set(['reporting', 'executive-communication']);
    let escalated = false;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const isAlwaysRun = ALWAYS_RUN_IDS.has(agent.id);

      if (escalated && !isAlwaysRun) continue;

      this.eventBus.publish('incident-controller:agent-started', { controllerId: this.id, agentId: agent.id, trigger });
      const result = await agent.execute(ctx);
      results.push(result);
      // Keep prior results available for downstream agents
      ctx.sharedState['priorResults'] = [...results];
      this.eventBus.publish('incident-controller:agent-completed', { controllerId: this.id, agentId: agent.id, result });

      if (result.escalate === true && !escalated) {
        escalated = true;
        // continue loop to pick up always-run agents
      }
    }

    return results;
  }
}
