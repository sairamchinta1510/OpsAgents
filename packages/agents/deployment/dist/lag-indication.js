import { BaseAgent, AgentCategory } from '@opsagents/core';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export class LagIndicationAgent extends BaseAgent {
    id = 'lag-indication';
    name = 'Lag Indication Agent';
    category = AgentCategory.DEPLOYMENT;
    acceptedInputs = ['perf-log', 'code'];
    version = '0.1.0';
    async run(context) {
        const { perfLog } = context.inputs;
        if (!perfLog) {
            return {
                agentId: this.id,
                status: 'skipped',
                output: { reason: 'No perfLog input provided' },
                durationMs: 0,
            };
        }
        const { p99Latency, errorRate } = perfLog;
        const anomalies = [];
        const riskScore = clamp(p99Latency / 500 * 0.6 + errorRate * 0.4, 0, 1);
        if (p99Latency > 300)
            anomalies.push(`High p99 latency: ${p99Latency}ms (threshold: 300ms)`);
        if (errorRate > 0.05)
            anomalies.push(`Elevated error rate: ${(errorRate * 100).toFixed(2)}%`);
        const riskLevel = riskScore < 0.3 ? 'low' : riskScore <= 0.7 ? 'medium' : 'high';
        const recommendation = riskLevel === 'low'
            ? 'No action required — deployment looks healthy'
            : riskLevel === 'medium'
                ? 'Monitor closely for 10 minutes after full rollout'
                : 'High risk detected — consider rollback before full traffic';
        const output = {
            riskScore,
            riskLevel,
            p99Latency,
            errorRate,
            anomalies,
            recommendation,
        };
        if (riskLevel === 'high') {
            return {
                agentId: this.id,
                status: 'escalate',
                output,
                recommendations: [recommendation, 'Review recent commits for performance regressions'],
                escalate: true,
                durationMs: 0,
            };
        }
        return {
            agentId: this.id,
            status: 'success',
            output,
            recommendations: riskLevel === 'medium' ? [recommendation] : [],
            durationMs: 0,
        };
    }
}
//# sourceMappingURL=lag-indication.js.map