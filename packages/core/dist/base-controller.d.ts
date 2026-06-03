import type { AgentResult, IAgent, IController, OrchestrationResult, ServiceInputs, Trigger } from './interfaces.js';
export declare abstract class BaseController implements IController {
    abstract readonly id: string;
    abstract readonly name: string;
    private readonly agents;
    protected abstract runOrchestration(trigger: Trigger, inputs: ServiceInputs, sessionId: string): Promise<AgentResult[]>;
    registerAgent(agent: IAgent): void;
    getRegisteredAgents(): IAgent[];
    orchestrate(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult>;
}
//# sourceMappingURL=base-controller.d.ts.map