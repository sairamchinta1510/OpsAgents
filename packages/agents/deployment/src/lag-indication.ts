import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export interface LagIndicationOutput {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  p99Latency: number;
  errorRate: number;
  anomalies: string[];
  recommendation: string;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export class LagIndicationAgent extends BaseAgent {
  readonly id = 'lag-indication';
  readonly name = 'Lag Indication Agent';
  readonly category = AgentCategory.DEPLOYMENT;
  readonly acceptedInputs = ['perf-log' as const, 'code' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
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
    const anomalies: string[] = [];
    const riskScore = clamp(p99Latency / 500 * 0.6 + errorRate * 0.4, 0, 1);

    if (p99Latency > 300) anomalies.push(`High p99 latency: ${p99Latency}ms (threshold: 300ms)`);
    if (errorRate > 0.05) anomalies.push(`Elevated error rate: ${(errorRate * 100).toFixed(2)}%`);

    const riskLevel: 'low' | 'medium' | 'high' =
      riskScore < 0.3 ? 'low' : riskScore <= 0.7 ? 'medium' : 'high';

    const recommendation =
      riskLevel === 'low'
        ? 'No action required — deployment looks healthy'
        : riskLevel === 'medium'
          ? 'Monitor closely for 10 minutes after full rollout'
          : 'High risk detected — consider rollback before full traffic';

    const output: LagIndicationOutput = {
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
