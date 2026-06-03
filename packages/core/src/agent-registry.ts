import type { IAgent } from './interfaces.js';
import type { AgentCategory } from './types.js';

export class AgentRegistry {
  private readonly agents = new Map<string, IAgent>();

  register(agent: IAgent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with id "${agent.id}" is already registered`);
    }
    this.agents.set(agent.id, agent);
  }

  unregister(id: string): void {
    this.agents.delete(id);
  }

  get(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  list(): IAgent[] {
    return [...this.agents.values()];
  }

  listByCategory(category: AgentCategory): IAgent[] {
    return this.list().filter((a) => a.category === category);
  }
}
