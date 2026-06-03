import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult, MonitorInput, PerfLogInput } from '@opsagents/core';

const CPU_CRITICAL = 90;
const MEMORY_CRITICAL = 90;
const P99_CRITICAL_MS = 2_000;
const ERROR_RATE_CRITICAL = 0.1;

export interface CriticalMetricsOutput {
  hasCritical: boolean;
  criticalFlags: string[];
  summary: string;
}

export class CriticalMetricsAgent extends BaseAgent {
  readonly id = 'critical-metrics';
  readonly name = 'Critical Metrics Agent';
  readonly category = AgentCategory.PREDICTIVE;
  readonly acceptedInputs = ['monitor' as const, 'perf-log' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const monitors = context.inputs.monitors as MonitorInput | undefined;
    const perfLog = context.inputs.perfLog as PerfLogInput | undefined;

    if (!monitors && !perfLog) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No monitors or perfLog input provided' },
      } as AgentResult;
    }

    const criticalFlags: string[] = [];

    if (monitors) {
      if (monitors.cpuPercent >= CPU_CRITICAL) criticalFlags.push('cpu');
      if (monitors.memoryPercent >= MEMORY_CRITICAL) criticalFlags.push('memory');
    }

    if (perfLog) {
      if (perfLog.p99Latency >= P99_CRITICAL_MS) criticalFlags.push('p99-latency');
      if (perfLog.errorRate >= ERROR_RATE_CRITICAL) criticalFlags.push('error-rate');
    }

    const hasCritical = criticalFlags.length > 0;
    const escalate = criticalFlags.length >= 2;
    const output: CriticalMetricsOutput = {
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
    } as AgentResult;
  }
}
