import { BaseAgent, AgentCategory } from '@opsagents/core';
const CPU_WARNING_THRESHOLD = 85;
const MEM_WARNING_THRESHOLD = 85;
const CPU_CRITICAL_THRESHOLD = 95;
const MEM_CRITICAL_THRESHOLD = 95;
export class DeploymentValidationAgent extends BaseAgent {
    id = 'deployment-validation';
    name = 'Deployment Validation Agent';
    category = AgentCategory.DEPLOYMENT;
    acceptedInputs = ['machine-params'];
    version = '0.1.0';
    async run(context) {
        const machineParams = context.inputs.machineParams;
        if (!machineParams) {
            return {
                agentId: this.id,
                status: 'skipped',
                output: { reason: 'No machineParams input provided' },
            };
        }
        const { cpuPercent, memoryPercent } = machineParams;
        const validated = cpuPercent < CPU_WARNING_THRESHOLD && memoryPercent < MEM_WARNING_THRESHOLD;
        const escalate = cpuPercent > CPU_CRITICAL_THRESHOLD || memoryPercent > MEM_CRITICAL_THRESHOLD;
        const reason = escalate
            ? `CPU at ${cpuPercent}%, memory at ${memoryPercent}% — CPU/memory critical`
            : validated
                ? `CPU at ${cpuPercent}%, memory at ${memoryPercent}% — within thresholds`
                : `CPU at ${cpuPercent}%, memory at ${memoryPercent}% — CPU/memory elevated`;
        const output = {
            validated,
            cpuPercent,
            memoryPercent,
            reason,
        };
        return {
            agentId: this.id,
            status: escalate ? 'escalate' : validated ? 'success' : 'failure',
            output,
            escalate,
            recommendations: escalate
                ? ['Reduce resource pressure before proceeding with rollout']
                : validated
                    ? []
                    : ['Review deployment capacity before continuing'],
        };
    }
}
//# sourceMappingURL=deployment-validation.js.map