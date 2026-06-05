import { BaseController, AgentRegistry, EventBus, type AgentResult, type OrchestrationResult, type ServiceInputs, type Trigger } from '@opsagents/core';
export interface InfrastructureControllerResult {
    status: 'success' | 'partial' | 'failure' | 'escalated';
    results: AgentResult[];
    escalatedBy?: string;
    orchestration: OrchestrationResult;
}
export declare class InfrastructureController extends BaseController {
    private readonly registry;
    private readonly eventBus;
    readonly id = "infrastructure-controller";
    readonly name = "Infrastructure Controller";
    constructor(registry: AgentRegistry, eventBus: EventBus);
    orchestrate(inputs: ServiceInputs): Promise<InfrastructureControllerResult>;
    orchestrate(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult>;
    /** Agents run in parallel — all infra agents are independent. */
    protected runOrchestration(trigger: Trigger, inputs: ServiceInputs, sessionId: string): Promise<AgentResult[]>;
}
//# sourceMappingURL=infrastructure-controller.d.ts.map