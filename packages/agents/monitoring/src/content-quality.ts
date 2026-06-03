import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, MonitorInput, PerfLogInput, ServiceInputs } from '@opsagents/core';

const P99_SLA_THRESHOLD_MS = 800;
const ERROR_RATE_SLA_THRESHOLD = 0.01;
const MIN_THROUGHPUT_RPS = 10;
const DISK_IO_SLA_THRESHOLD_MBPS = 100;

export interface SlaViolation {
  metric: string;
  actual: number;
  threshold: number;
  description: string;
}

export interface ContentQualityOutput {
  slaCompliant: boolean;
  violations: SlaViolation[];
  qualityScore: number;
  summary: string;
}

export class ContentQualityAgent extends BaseAgent {
  readonly id = 'content-quality';
  readonly name = 'Content Quality Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const, 'perf-log' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const monitors = context.inputs.monitors as MonitorInput | undefined;
    const perfLog = context.inputs.perfLog as PerfLogInput | undefined;

    if (!monitors && !perfLog) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No monitors or perfLog data' },
        durationMs: 0,
      };
    }

    const violations: SlaViolation[] = [];

    if (perfLog) {
      if (perfLog.p99Latency > P99_SLA_THRESHOLD_MS) {
        violations.push({
          metric: 'p99Latency',
          actual: perfLog.p99Latency,
          threshold: P99_SLA_THRESHOLD_MS,
          description: `p99 latency ${perfLog.p99Latency}ms exceeds SLA of ${P99_SLA_THRESHOLD_MS}ms`,
        });
      }

      if (perfLog.errorRate > ERROR_RATE_SLA_THRESHOLD) {
        violations.push({
          metric: 'errorRate',
          actual: perfLog.errorRate,
          threshold: ERROR_RATE_SLA_THRESHOLD,
          description: `Error rate ${(perfLog.errorRate * 100).toFixed(2)}% exceeds SLA of ${ERROR_RATE_SLA_THRESHOLD * 100}%`,
        });
      }

      if (perfLog.throughput < MIN_THROUGHPUT_RPS) {
        violations.push({
          metric: 'throughput',
          actual: perfLog.throughput,
          threshold: MIN_THROUGHPUT_RPS,
          description: `Throughput ${perfLog.throughput} req/s below minimum ${MIN_THROUGHPUT_RPS} req/s`,
        });
      }
    }

    if (monitors) {
      if (monitors.diskIoMbps > DISK_IO_SLA_THRESHOLD_MBPS) {
        violations.push({
          metric: 'diskIoMbps',
          actual: monitors.diskIoMbps,
          threshold: DISK_IO_SLA_THRESHOLD_MBPS,
          description: `Disk I/O ${monitors.diskIoMbps} MB/s exceeds SLA limit ${DISK_IO_SLA_THRESHOLD_MBPS} MB/s`,
        });
      }
    }

    // Quality score: 1.0 when no violations, decreases per violation
    const qualityScore = Math.max(0, 1 - violations.length * 0.25);
    const slaCompliant = violations.length === 0;

    const output: ContentQualityOutput = {
      slaCompliant,
      violations,
      qualityScore,
      summary: slaCompliant
        ? 'All SLA thresholds met — content quality nominal'
        : `${violations.length} SLA violation(s) detected — quality score: ${qualityScore.toFixed(2)}`,
    };

    return {
      agentId: this.id,
      status: slaCompliant ? 'success' : 'failure',
      output,
      escalate: violations.length >= 2,
      recommendations: violations.map((v) => v.description),
      durationMs: 0,
    };
  }
}
