import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, PerfLogInput, ServiceInputs } from '@opsagents/core';

const THROUGHPUT_SPIKE_THRESHOLD = 10_000;
const P99_DEGRADATION_THRESHOLD = 1_000;
const ERROR_RATE_THRESHOLD = 0.05;

export interface TrafficPredictionOutput {
  predicted: boolean;
  score: number;
  p99Latency: number;
  throughput: number;
  recommendation: string;
}

export class TrafficPredictionAgent extends BaseAgent {
  readonly id = 'traffic-prediction';
  readonly name = 'Traffic Prediction Agent';
  readonly category = AgentCategory.PREDICTIVE;
  readonly acceptedInputs = ['perf-log' as const];
  readonly version = '0.1.0';

  override canHandle(_inputs: ServiceInputs): boolean {
    return true;
  }

  protected async run(context: AgentContext): Promise<AgentResult> {
    const perfLog = context.inputs.perfLog as PerfLogInput | undefined;

    if (!perfLog) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No perfLog data' },
      } as AgentResult;
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

    const output: TrafficPredictionOutput = {
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
    } as AgentResult;
  }
}
