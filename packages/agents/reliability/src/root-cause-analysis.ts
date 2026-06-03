import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, CodeInput, IncidentInput, PerfLogInput } from '@opsagents/core';

export interface RcaHypothesis {
  hypothesis: string;
  confidence: 'low' | 'medium' | 'high';
  evidenceSignals: string[];
  suggestedFix: string;
}

export interface RootCauseAnalysisOutput {
  hypotheses: RcaHypothesis[];
  topHypothesis: RcaHypothesis | null;
  requiresLlmAnalysis: boolean;
  summary: string;
}

export class RootCauseAnalysisAgent extends BaseAgent {
  readonly id = 'root-cause-analysis';
  readonly name = 'Root Cause Analysis Agent';
  readonly category = AgentCategory.RELIABILITY;
  readonly acceptedInputs = ['incident' as const, 'code' as const, 'perf-log' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const incident = context.inputs.incident as IncidentInput | undefined;
    const code = context.inputs.code as CodeInput | undefined;
    const perfLog = context.inputs.perfLog as PerfLogInput | undefined;

    if (!incident && !code && !perfLog) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No incident, code, or perfLog data to analyze' },
        durationMs: 0,
      };
    }

    const hypotheses: RcaHypothesis[] = [];

    // Code-change-correlated hypothesis
    if (code?.commitSha) {
      const lowCoverage = (code.coverage ?? 100) < 70;
      hypotheses.push({
        hypothesis: `Recent commit ${code.commitSha} introduced a regression`,
        confidence: lowCoverage ? 'high' : 'medium',
        evidenceSignals: [
          `Commit SHA: ${code.commitSha}`,
          ...(lowCoverage ? [`Low test coverage: ${code.coverage}%`] : []),
        ],
        suggestedFix: 'Roll back to previous stable commit or hot-patch the regression',
      });
    }

    // Perf-degradation hypothesis
    if (perfLog) {
      if (perfLog.errorRate > 0.05) {
        hypotheses.push({
          hypothesis: 'Upstream dependency returning errors — cascading failure',
          confidence: 'high',
          evidenceSignals: [`Error rate: ${(perfLog.errorRate * 100).toFixed(1)}%`, `p99: ${perfLog.p99Latency}ms`],
          suggestedFix: 'Enable circuit breaker, check upstream service health dashboard',
        });
      } else if (perfLog.p99Latency > 500) {
        hypotheses.push({
          hypothesis: 'Database or cache saturation causing tail latency',
          confidence: 'medium',
          evidenceSignals: [`p99 latency: ${perfLog.p99Latency}ms`, `Throughput: ${perfLog.throughput} req/s`],
          suggestedFix: 'Review slow query log, scale read replicas, or flush cache',
        });
      }
    }

    // Incident-severity hypothesis
    if (incident) {
      if (incident.severity === 'critical' || incident.severity === 'high') {
        hypotheses.push({
          hypothesis: `${incident.source} triggered ${incident.severity} alert: ${incident.message}`,
          confidence: incident.severity === 'critical' ? 'high' : 'medium',
          evidenceSignals: [`Alert ID: ${incident.alertId}`, `Source: ${incident.source}`],
          suggestedFix: 'Review runbook for alert source, check recent infrastructure changes',
        });
      }
    }

    // Fall back: generic hypothesis when no specific signals
    if (hypotheses.length === 0) {
      hypotheses.push({
        hypothesis: 'Unknown root cause — insufficient telemetry data',
        confidence: 'low',
        evidenceSignals: ['No strong correlating signals found'],
        suggestedFix: 'Increase observability: add tracing, structured logging, and custom metrics',
      });
    }

    // Top hypothesis = highest confidence
    const order: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const sorted = [...hypotheses].sort((a, b) => order[b.confidence] - order[a.confidence]);
    const topHypothesis = sorted[0] ?? null;

    const needsLlm = hypotheses.every((h) => h.confidence === 'low');

    const output: RootCauseAnalysisOutput = {
      hypotheses,
      topHypothesis,
      requiresLlmAnalysis: needsLlm,
      summary: topHypothesis
        ? `Top hypothesis (${topHypothesis.confidence} confidence): ${topHypothesis.hypothesis}`
        : 'No hypotheses generated',
    };

    return {
      agentId: this.id,
      status: topHypothesis?.confidence === 'low' ? 'failure' : 'success',
      output,
      escalate: needsLlm && !!incident && (incident.severity === 'critical' || incident.severity === 'high'),
      recommendations: topHypothesis ? [topHypothesis.suggestedFix] : [],
      durationMs: 0,
    };
  }
}
