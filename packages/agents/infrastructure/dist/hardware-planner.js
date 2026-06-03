import { AgentCategory, BaseAgent } from '@opsagents/core';
const CPU_SCALE_UP_THRESHOLD = 75;
const MEM_SCALE_UP_THRESHOLD = 80;
const CPU_SCALE_DOWN_THRESHOLD = 20;
const MIN_NODES = 2;
const MAX_NODES = 10;
export class HardwarePlannerAgent extends BaseAgent {
    id = 'hardware-planner';
    name = 'Hardware Planner Agent';
    category = AgentCategory.INFRASTRUCTURE;
    acceptedInputs = ['machine-params', 'monitor'];
    version = '0.1.0';
    async run(context) {
        const machine = context.inputs.machineParams;
        const monitors = context.inputs.monitors;
        if (!machine && !monitors) {
            return {
                agentId: this.id,
                status: 'skipped',
                output: { reason: 'No machineParams or monitors data' },
                durationMs: 0,
            };
        }
        const cpuPercent = machine?.cpuPercent ?? monitors?.cpuPercent ?? 0;
        const memPercent = machine?.memoryPercent ?? monitors?.memoryPercent ?? 0;
        const currentNodeCount = machine?.nodeCount ?? 1;
        let scalingDecision;
        if (cpuPercent >= CPU_SCALE_UP_THRESHOLD || memPercent >= MEM_SCALE_UP_THRESHOLD) {
            const targetNodeCount = Math.min(currentNodeCount + 2, MAX_NODES);
            scalingDecision = {
                action: 'scale-up',
                targetNodeCount,
                reason: `High resource pressure: CPU ${cpuPercent}%, Memory ${memPercent}%`,
            };
        }
        else if (cpuPercent <= CPU_SCALE_DOWN_THRESHOLD && currentNodeCount > MIN_NODES) {
            const targetNodeCount = Math.max(currentNodeCount - 1, MIN_NODES);
            scalingDecision = {
                action: 'scale-down',
                targetNodeCount,
                reason: `Low utilization: CPU ${cpuPercent}% — consolidating to save cost`,
            };
        }
        else {
            scalingDecision = {
                action: 'no-change',
                targetNodeCount: currentNodeCount,
                reason: `Utilization within normal range: CPU ${cpuPercent}%, Memory ${memPercent}%`,
            };
        }
        // Stub job schedule: priority jobs assigned based on resource state
        const now = new Date().toISOString();
        const jobSchedule = [
            {
                job: 'db-backup',
                scheduledAt: now,
                priority: cpuPercent < 50 ? 'normal' : 'low',
            },
            {
                job: 'log-rotation',
                scheduledAt: now,
                priority: 'low',
            },
            {
                job: 'health-snapshot',
                scheduledAt: now,
                priority: 'high',
            },
        ];
        const output = {
            currentNodeCount,
            scalingDecision,
            jobSchedule,
            summary: `Scaling: ${scalingDecision.action} → ${scalingDecision.targetNodeCount} nodes. ${scalingDecision.reason}`,
        };
        return {
            agentId: this.id,
            status: 'success',
            output,
            escalate: scalingDecision.action === 'scale-up' && scalingDecision.targetNodeCount >= MAX_NODES,
            recommendations: scalingDecision.action === 'scale-up'
                ? [`Scale cluster to ${scalingDecision.targetNodeCount} nodes immediately`]
                : scalingDecision.action === 'scale-down'
                    ? [`Safely drain and terminate ${currentNodeCount - scalingDecision.targetNodeCount} node(s)`]
                    : [],
            durationMs: 0,
        };
    }
}
//# sourceMappingURL=hardware-planner.js.map