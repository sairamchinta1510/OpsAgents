import type { AgentContext, AgentResult, IAgent, ServiceInputs } from './interfaces.js';
import type { AgentCategory, InputType } from './types.js';
import { AgentStatus } from './types.js';
export declare abstract class BaseAgent implements IAgent {
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly category: AgentCategory;
    abstract readonly acceptedInputs: InputType[];
    abstract readonly version: string;
    private _status;
    protected abstract run(context: AgentContext): Promise<AgentResult>;
    execute(context: AgentContext): Promise<AgentResult>;
    canHandle(inputs: ServiceInputs): boolean;
    getStatus(): AgentStatus;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=base-agent.d.ts.map