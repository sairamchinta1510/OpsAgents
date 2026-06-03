import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

const COVERAGE_APPROVAL_THRESHOLD = 70;
const COVERAGE_CRITICAL_THRESHOLD = 50;
const ERROR_RATE_THRESHOLD = 0.05;

export interface CiCdGovernanceOutput {
  approved: boolean;
  coverage: number;
  errorRate: number;
  reason: string;
  auditLog: string[];
}

export class CiCdGovernanceAgent extends BaseAgent {
  readonly id = 'ci-cd-governance';
  readonly name = 'CI/CD Governance Agent';
  readonly category = AgentCategory.DEPLOYMENT;
  readonly acceptedInputs = ['code' as const, 'perf-log' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { code, perfLog } = context.inputs;

    if (!code) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No code input provided' },
        durationMs: 0,
      };
    }

    const coverage = code.coverage ?? 0;
    const errorRate = perfLog?.errorRate ?? 0;
    const auditLog: string[] = [];

    auditLog.push(`Coverage: ${coverage}% (threshold: ${COVERAGE_APPROVAL_THRESHOLD}%)`);
    auditLog.push(`Error rate: ${(errorRate * 100).toFixed(2)}% (threshold: ${ERROR_RATE_THRESHOLD * 100}%)`);

    if (coverage < COVERAGE_CRITICAL_THRESHOLD) {
      auditLog.push(`CRITICAL: Coverage below ${COVERAGE_CRITICAL_THRESHOLD}% — escalating`);
      return {
        agentId: this.id,
        status: 'failure',
        output: {
          approved: false,
          coverage,
          errorRate,
          reason: `Coverage critically low (<${COVERAGE_CRITICAL_THRESHOLD}%)`,
          auditLog,
        } satisfies CiCdGovernanceOutput,
        recommendations: ['Add unit tests before deploying', `Minimum ${COVERAGE_APPROVAL_THRESHOLD}% coverage required`],
        escalate: true,
        durationMs: 0,
      };
    }

    const approved = coverage >= COVERAGE_APPROVAL_THRESHOLD && errorRate <= ERROR_RATE_THRESHOLD;

    if (!approved) {
      const reasons: string[] = [];
      if (coverage < COVERAGE_APPROVAL_THRESHOLD) {
        reasons.push(`Coverage ${coverage}% below ${COVERAGE_APPROVAL_THRESHOLD}% threshold`);
      }
      if (errorRate > ERROR_RATE_THRESHOLD) {
        reasons.push(`Error rate ${(errorRate * 100).toFixed(2)}% above ${ERROR_RATE_THRESHOLD * 100}% threshold`);
      }
      auditLog.push(`REJECTED: ${reasons.join('; ')}`);
    } else {
      auditLog.push('APPROVED: All governance checks passed');
    }

    return {
      agentId: this.id,
      status: approved ? 'success' : 'failure',
      output: {
        approved,
        coverage,
        errorRate,
        reason: approved ? 'All checks passed' : 'Governance checks failed',
        auditLog,
      } satisfies CiCdGovernanceOutput,
      recommendations: approved ? [] : ['Improve test coverage', 'Investigate error rate'],
      durationMs: 0,
    };
  }
}
