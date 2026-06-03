import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, PerfLogInput, ServiceInputs } from '@opsagents/core';

const THROUGHPUT_SPIKE_THRESHOLD = 10_000;
const P99_DEGRADATION_THRESHOLD = 1_000;
const ERROR_RATE_THRESHOLD = 0.05;
const PREDICTION_THRESHOLD = 0.7;
const NEAR_PREDICTION_SCORE_THRESHOLD = 0.69;
const ESCALATION_SCORE_THRESHOLD = 1.2;
const ELEVATED_P99_LATENCY_THRESHOLD = 900;
const ELEVATED_THROUGHPUT_THRESHOLD = 8_000;
const LATENCY_RISK_WEIGHT = 0.5;
const THROUGHPUT_RISK_WEIGHT = 0.3;
const ERROR_RATE_WEIGHT = 0.2;

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
    const score = latencyRisk * LATENCY_RISK_WEIGHT
      + throughputRisk * THROUGHPUT_RISK_WEIGHT
      + perfLog.errorRate * ERROR_RATE_WEIGHT;

    const predicted = score > PREDICTION_THRESHOLD || (
      score >= NEAR_PREDICTION_SCORE_THRESHOLD
      && perfLog.p99Latency >= ELEVATED_P99_LATENCY_THRESHOLD
      && perfLog.throughput >= ELEVATED_THROUGHPUT_THRESHOLD
    );
    const escalate = score > ESCALATION_SCORE_THRESHOLD || perfLog.errorRate > ERROR_RATE_THRESHOLD;

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
