import { BaseAgent, AgentCategory } from '@opsagents/core';
const CPU_CRITICAL = 90;
const MEMORY_CRITICAL = 90;
const P99_CRITICAL_MS = 2_000;
const ERROR_RATE_CRITICAL = 0.1;
export class CriticalMetricsAgent extends BaseAgent {
    id = 'critical-metrics';
    name = 'Critical Metrics Agent';
    category = AgentCategory.PREDICTIVE;
    acceptedInputs = ['monitor', 'perf-log'];
    version = '0.1.0';
    async run(context) {
        const monitors = context.inputs.monitors;
        const perfLog = context.inputs.perfLog;
        if (!monitors && !perfLog) {
            return {
                agentId: this.id,
                status: 'skipped',
                output: { reason: 'No monitors or perfLog input provided' },
            };
        }
        const criticalFlags = [];
        if (monitors) {
            if (monitors.cpuPercent >= CPU_CRITICAL)
                criticalFlags.push('cpu');
            if (monitors.memoryPercent >= MEMORY_CRITICAL)
                criticalFlags.push('memory');
        }
        if (perfLog) {
            if (perfLog.p99Latency >= P99_CRITICAL_MS)
                criticalFlags.push('p99-latency');
            if (perfLog.errorRate >= ERROR_RATE_CRITICAL)
                criticalFlags.push('error-rate');
        }
        const hasCritical = criticalFlags.length > 0;
        const escalate = criticalFlags.length >= 2;
        const output = {
            hasCritical,
            criticalFlags,
            summary: hasCritical
                ? `${criticalFlags.length} critical metric(s): [${criticalFlags.join(', ')}]`
                : 'All metrics within bounds',
        };
        return {
            agentId: this.id,
            status: hasCritical ? 'failure' : 'success',
            output,
            escalate,
        };
    }
}
//# sourceMappingURL=critical-metrics.js.map