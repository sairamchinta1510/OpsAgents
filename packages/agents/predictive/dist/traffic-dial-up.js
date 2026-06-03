import { BaseAgent, AgentCategory } from '@opsagents/core';
const DIAL_UP_THROUGHPUT_THRESHOLD = 5_000;
const DIAL_UP_CPU_THRESHOLD = 70;
const DIAL_UP_STEP_PERCENT = 10;
export class TrafficDialUpAgent extends BaseAgent {
    id = 'traffic-dial-up';
    name = 'Traffic Dial Up Agent';
    category = AgentCategory.PREDICTIVE;
    acceptedInputs = ['perf-log', 'machine-params'];
    version = '0.1.0';
    async run(context) {
        const perfLog = context.inputs.perfLog;
        const machineParams = context.inputs.machineParams;
        if (!perfLog && !machineParams) {
            return {
                agentId: this.id,
                status: 'skipped',
                output: { reason: 'No perfLog or machineParams input provided' },
            };
        }
        const throughput = perfLog?.throughput ?? 0;
        const cpu = machineParams?.cpuPercent ?? 0;
        const shouldDialUp = throughput >= DIAL_UP_THROUGHPUT_THRESHOLD && cpu < DIAL_UP_CPU_THRESHOLD;
        const escalate = cpu >= DIAL_UP_CPU_THRESHOLD && throughput >= DIAL_UP_THROUGHPUT_THRESHOLD;
        const recommendation = shouldDialUp
            ? `Dial up traffic by ${DIAL_UP_STEP_PERCENT}% — machines have headroom`
            : escalate
                ? 'Cannot dial up — machines at capacity, scale first'
                : 'Traffic below dial-up threshold — no action needed';
        const output = {
            shouldDialUp,
            dialUpPercent: shouldDialUp ? DIAL_UP_STEP_PERCENT : 0,
            currentThroughput: throughput,
            cpuPercent: cpu,
            recommendation,
        };
        return {
            agentId: this.id,
            status: shouldDialUp ? 'success' : 'failure',
            output,
            recommendations: [recommendation],
            escalate,
        };
    }
}
//# sourceMappingURL=traffic-dial-up.js.map