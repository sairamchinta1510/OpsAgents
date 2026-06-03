import { BaseAgent, AgentCategory } from '@opsagents/core';
const CPU_WARNING_THRESHOLD = 85;
const CPU_CRITICAL_THRESHOLD = 95;
const MEM_WARNING_THRESHOLD = 85;
const MEM_CRITICAL_THRESHOLD = 95;
export class DeploymentValidationAgent extends BaseAgent {
    id = 'deployment-validation';
    name = 'Deployment Validation Agent';
    category = AgentCategory.DEPLOYMENT;
    acceptedInputs = ['monitor'];
    version = '0.1.0';
    async run(context) {
        const { monitors } = context.inputs;
        if (!monitors) {
            return {
                agentId: this.id,
                status: 'skipped',
                output: { reason: 'No monitors input provided' },
                durationMs: 0,
            };
        }
        const { cpuPercent, memoryPercent } = monitors;
        const issues = [];
        if (cpuPercent > CPU_CRITICAL_THRESHOLD || memoryPercent > MEM_CRITICAL_THRESHOLD) {
            return {
                agentId: this.id,
                status: 'failure',
                output: {
                    validated: false,
                    healthScore: 0,
                    cpuPercent,
                    memoryPercent,
                    issues: [`Critical resource exhaustion: cpu=${cpuPercent}%, mem=${memoryPercent}%`],
                },
                recommendations: ['Immediate scale-out required', 'Consider rollback'],
                escalate: true,
                durationMs: 0,
            };
        }
        if (cpuPercent >= CPU_WARNING_THRESHOLD) {
            issues.push(`CPU ${cpuPercent}% exceeds ${CPU_WARNING_THRESHOLD}% threshold`);
        }
        if (memoryPercent >= MEM_WARNING_THRESHOLD) {
            issues.push(`Memory ${memoryPercent}% exceeds ${MEM_WARNING_THRESHOLD}% threshold`);
        }
        const validated = cpuPercent < CPU_WARNING_THRESHOLD && memoryPercent < MEM_WARNING_THRESHOLD;
        const healthScore = Math.max(0, 100 - Math.max(0, cpuPercent - 50) - Math.max(0, memoryPercent - 50));
        return {
            agentId: this.id,
            status: validated ? 'success' : 'failure',
            output: { validated, healthScore, cpuPercent, memoryPercent, issues },
            recommendations: validated ? [] : ['Scale resources before completing rollout'],
            durationMs: 0,
        };
    }
}
//# sourceMappingURL=deployment-validation.js.map