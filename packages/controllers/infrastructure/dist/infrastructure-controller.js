import { BaseController, } from '@opsagents/core';
import { HardwarePlannerAgent, SecurityComplianceAgent, CostOptimizationAgent, KnowledgeGraphAgent, } from '@opsagents/agents-infrastructure';
export class InfrastructureController extends BaseController {
    registry;
    eventBus;
    id = 'infrastructure-controller';
    name = 'Infrastructure Controller';
    constructor(registry, eventBus) {
        super();
        this.registry = registry;
        this.eventBus = eventBus;
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
    async orchestrate(triggerOrInputs, maybeInputs) {
        if (maybeInputs) {
            return super.orchestrate(triggerOrInputs, maybeInputs);
        }
        const inputs = triggerOrInputs;
        const trigger = {
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
    async runOrchestration(trigger, inputs, sessionId) {
        const ctx = {
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
        const results = settled.map((s, i) => {
            const agent = agents[i];
            if (s.status === 'fulfilled') {
                this.eventBus.publish('infrastructure-controller:agent-completed', { agentId: agent.id, result: s.value });
                return s.value;
            }
            return {
                agentId: agent.id,
                status: 'failure',
                output: { error: String(s.reason) },
                durationMs: 0,
            };
        });
        return results;
    }
}
//# sourceMappingURL=infrastructure-controller.js.map