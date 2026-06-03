import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, MonitorInput, PerfLogInput, ServiceInputs } from '@opsagents/core';

const CPU_WARNING_THRESHOLD = 70;
const CPU_CRITICAL_THRESHOLD = 90;
const MEMORY_WARNING_THRESHOLD = 75;
const MEMORY_CRITICAL_THRESHOLD = 90;
const P99_WARNING_THRESHOLD_MS = 500;
const P99_CRITICAL_THRESHOLD_MS = 1_000;
const ERROR_RATE_WARNING = 0.02;
const ERROR_RATE_CRITICAL = 0.05;

export interface Anomaly {
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
}

export interface MonitoringAgentOutput {
  anomalies: Anomaly[];
  alertLevel: 'none' | 'warning' | 'critical';
  summary: string;
}

export class MonitoringAgent extends BaseAgent {
  readonly id = 'monitoring';
  readonly name = 'Monitoring Agent';
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

    const anomalies: Anomaly[] = [];

    if (monitors) {
      if (monitors.cpuPercent >= CPU_CRITICAL_THRESHOLD) {
        anomalies.push({ metric: 'cpuPercent', value: monitors.cpuPercent, threshold: CPU_CRITICAL_THRESHOLD, severity: 'critical' });
      } else if (monitors.cpuPercent >= CPU_WARNING_THRESHOLD) {
        anomalies.push({ metric: 'cpuPercent', value: monitors.cpuPercent, threshold: CPU_WARNING_THRESHOLD, severity: 'warning' });
      }

      if (monitors.memoryPercent >= MEMORY_CRITICAL_THRESHOLD) {
        anomalies.push({ metric: 'memoryPercent', value: monitors.memoryPercent, threshold: MEMORY_CRITICAL_THRESHOLD, severity: 'critical' });
      } else if (monitors.memoryPercent >= MEMORY_WARNING_THRESHOLD) {
        anomalies.push({ metric: 'memoryPercent', value: monitors.memoryPercent, threshold: MEMORY_WARNING_THRESHOLD, severity: 'warning' });
      }
    }

    if (perfLog) {
      if (perfLog.p99Latency >= P99_CRITICAL_THRESHOLD_MS) {
        anomalies.push({ metric: 'p99Latency', value: perfLog.p99Latency, threshold: P99_CRITICAL_THRESHOLD_MS, severity: 'critical' });
      } else if (perfLog.p99Latency >= P99_WARNING_THRESHOLD_MS) {
        anomalies.push({ metric: 'p99Latency', value: perfLog.p99Latency, threshold: P99_WARNING_THRESHOLD_MS, severity: 'warning' });
      }

      if (perfLog.errorRate >= ERROR_RATE_CRITICAL) {
        anomalies.push({ metric: 'errorRate', value: perfLog.errorRate, threshold: ERROR_RATE_CRITICAL, severity: 'critical' });
      } else if (perfLog.errorRate >= ERROR_RATE_WARNING) {
        anomalies.push({ metric: 'errorRate', value: perfLog.errorRate, threshold: ERROR_RATE_WARNING, severity: 'warning' });
      }
    }

    const hasCritical = anomalies.some((a) => a.severity === 'critical');
    const hasWarning = anomalies.some((a) => a.severity === 'warning');
    const alertLevel: 'none' | 'warning' | 'critical' = hasCritical ? 'critical' : hasWarning ? 'warning' : 'none';

    const output: MonitoringAgentOutput = {
      anomalies,
      alertLevel,
      summary: anomalies.length === 0
        ? 'All metrics within normal bounds'
        : `${anomalies.length} anomaly(ies) detected — alert level: ${alertLevel}`,
    };

    return {
      agentId: this.id,
      status: hasCritical ? 'failure' : 'success',
      output,
      escalate: hasCritical,
      recommendations: hasCritical
        ? anomalies.filter((a) => a.severity === 'critical').map((a) => `Investigate ${a.metric}: ${a.value} exceeds critical threshold ${a.threshold}`)
        : [],
      durationMs: 0,
    };
  }
}
