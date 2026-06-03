import { randomUUID } from 'node:crypto';
export class BaseController {
    agents = [];
    registerAgent(agent) {
        this.agents.push(agent);
    }
    getRegisteredAgents() {
        return [...this.agents];
    }
    async orchestrate(trigger, inputs) {
        const sessionId = randomUUID();
        const start = Date.now();
        const agentResults = await this.runOrchestration(trigger, inputs, sessionId);
        const successes = agentResults.filter((r) => r.status === 'success').length;
        const failures = agentResults.filter((r) => r.status === 'failure').length;
        const escalations = agentResults.filter((r) => r.escalate === true).length;
        let overallStatus;
        if (escalations > 0) {
            overallStatus = 'escalated';
        }
        else if (failures === 0) {
            overallStatus = 'success';
        }
        else if (successes === 0) {
            overallStatus = 'failure';
        }
        else {
            overallStatus = 'partial';
        }
        return {
            controllerId: this.id,
            sessionId,
            trigger,
            agentResults,
            overallStatus,
            durationMs: Date.now() - start,
            summary: `${successes} succeeded, ${failures} failed, ${escalations} escalated out of ${agentResults.length} agents`,
        };
    }
}
//# sourceMappingURL=base-controller.js.map