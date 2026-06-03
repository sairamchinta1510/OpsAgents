export class AgentRegistry {
    agents = new Map();
    register(agent) {
        if (this.agents.has(agent.id)) {
            throw new Error(`Agent with id "${agent.id}" is already registered`);
        }
        this.agents.set(agent.id, agent);
    }
    unregister(id) {
        this.agents.delete(id);
    }
    get(id) {
        return this.agents.get(id);
    }
    list() {
        return [...this.agents.values()];
    }
    listByCategory(category) {
        return Array.from(this.agents.values()).filter((a) => a.category === category);
    }
}
//# sourceMappingURL=agent-registry.js.map