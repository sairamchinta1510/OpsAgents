import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, IncidentInput, MonitorInput, PerfLogInput } from '@opsagents/core';

const BLAST_RADIUS_CPU_THRESHOLD = 80;
const BLAST_RADIUS_ERROR_THRESHOLD = 0.05;
const BLAST_RADIUS_LATENCY_THRESHOLD = 800;

export type BlastRadius = 'contained' | 'service-wide' | 'cross-service';

export interface IssueIdentificationOutput {
  blastRadius: BlastRadius;
  affectedComponents: string[];
  correlatedSignals: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
}

export class IssueIdentificationAgent extends BaseAgent {
  readonly id = 'issue-identification';
  readonly name = 'Issue Identification Agent';
  readonly category = AgentCategory.RELIABILITY;
  readonly acceptedInputs = ['monitor' as const, 'perf-log' as const, 'incident' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const incident = context.inputs.incident as IncidentInput | undefined;
    const monitors = context.inputs.monitors as MonitorInput | undefined;
    const perfLog = context.inputs.perfLog as PerfLogInput | undefined;

    if (!incident && !monitors && !perfLog) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No incident, monitors, or perfLog data' },
        durationMs: 0,
      };
    }

    const affectedComponents: string[] = [];
    const correlatedSignals: string[] = [];

    if (incident) {
      affectedComponents.push(incident.source);
      correlatedSignals.push(`Alert ${incident.alertId}: ${incident.message}`);
    }

    if (monitors) {
      if (monitors.cpuPercent >= BLAST_RADIUS_CPU_THRESHOLD) {
        affectedComponents.push('compute-layer');
        correlatedSignals.push(`CPU at ${monitors.cpuPercent}%`);
      }
      if (monitors.memoryPercent >= BLAST_RADIUS_CPU_THRESHOLD) {
        affectedComponents.push('memory-subsystem');
        correlatedSignals.push(`Memory at ${monitors.memoryPercent}%`);
      }
    }

    if (perfLog) {
      if (perfLog.errorRate >= BLAST_RADIUS_ERROR_THRESHOLD) {
        affectedComponents.push('api-layer');
        correlatedSignals.push(`Error rate ${(perfLog.errorRate * 100).toFixed(1)}%`);
      }
      if (perfLog.p99Latency >= BLAST_RADIUS_LATENCY_THRESHOLD) {
        affectedComponents.push('latency-sensitive-paths');
        correlatedSignals.push(`p99 latency ${perfLog.p99Latency}ms`);
      }
    }

    const unique = [...new Set(affectedComponents)];
    const blastRadius: BlastRadius = unique.length >= 3
      ? 'cross-service'
      : unique.length >= 2
        ? 'service-wide'
        : 'contained';

    const incidentSeverity = incident?.severity ?? 'medium';
    const severity = (blastRadius === 'cross-service' || incidentSeverity === 'critical')
      ? 'critical'
      : (blastRadius === 'service-wide' || incidentSeverity === 'high')
        ? 'high'
        : incidentSeverity as 'low' | 'medium';

    const output: IssueIdentificationOutput = {
      blastRadius,
      affectedComponents: unique,
      correlatedSignals,
      severity,
      summary: `Blast radius: ${blastRadius}. Affected: ${unique.join(', ') || 'none identified'}`,
    };

    return {
      agentId: this.id,
      status: severity === 'critical' || severity === 'high' ? 'failure' : 'success',
      output,
      escalate: severity === 'critical',
      recommendations: severity === 'critical'
        ? ['Trigger immediate incident response', 'Page on-call engineer']
        : severity === 'high'
          ? ['Investigate affected components', 'Enable circuit breakers']
          : [],
      durationMs: 0,
    };
  }
}
