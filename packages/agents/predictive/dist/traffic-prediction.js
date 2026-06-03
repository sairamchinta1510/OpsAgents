import { AgentCategory, BaseAgent } from '@opsagents/core';
const THROUGHPUT_SPIKE_THRESHOLD = 10_000;
const P99_DEGRADATION_THRESHOLD = 1_000;
const ERROR_RATE_THRESHOLD = 0.05;
export class TrafficPredictionAgent extends BaseAgent {
    id = 'traffic-prediction';
    name = 'Traffic Prediction Agent';
    category = AgentCategory.PREDICTIVE;
    acceptedInputs = ['perf-log'];
    version = '0.1.0';
    canHandle(_inputs) {
        return true;
    }
    async run(context) {
        const perfLog = context.inputs.perfLog;
        if (!perfLog) {
            return {
                agentId: this.id,
                status: 'skipped',
                output: { reason: 'No perfLog data' },
            };
        }
        const latencyRisk = perfLog.p99Latency / P99_DEGRADATION_THRESHOLD;
        const throughputRisk = perfLog.throughput / THROUGHPUT_SPIKE_THRESHOLD;
        const score = latencyRisk * 0.5
            + throughputRisk * 0.3
            + perfLog.errorRate * 0.2;
        const predicted = score > 0.7;
        const escalate = score > 1.2 || perfLog.errorRate > ERROR_RATE_THRESHOLD;
        const recommendation = escalate
            ? 'Critical traffic pattern — immediate scale-out required'
            : predicted
                ? 'Traffic spike predicted — consider pre-scaling'
                : 'No traffic spike predicted — maintain current scaling';
        const output = {
            predicted,
            score,
            p99Latency: perfLog.p99Latency,
            throughput: perfLog.throughput,
            recommendation,
        };
        return {
            agentId: this.id,
            status: predicted || escalate ? 'failure' : 'success',
            output,
            escalate,
            recommendations: predicted || escalate ? [recommendation] : [],
        };
    }
}
//# sourceMappingURL=traffic-prediction.js.map