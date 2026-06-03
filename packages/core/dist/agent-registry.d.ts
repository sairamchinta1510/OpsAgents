import type { IAgent } from './interfaces.js';
import type { AgentCategory } from './types.js';
export declare class AgentRegistry {
    private readonly agents;
    register(agent: IAgent): void;
    unregister(id: string): void;
    get(id: string): IAgent | undefined;
    list(): IAgent[];
    listByCategory(category: AgentCategory): IAgent[];
}
//# sourceMappingURL=agent-registry.d.ts.map