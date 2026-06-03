import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

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

    auditLog.push(`Coverage: ${coverage}% (threshold: 70%)`);
    auditLog.push(`Error rate: ${(errorRate * 100).toFixed(2)}% (threshold: 5%)`);

    if (coverage < 50) {
      auditLog.push('CRITICAL: Coverage below 50% — escalating');
      return {
        agentId: this.id,
        status: 'failure',
        output: {
          approved: false,
          coverage,
          errorRate,
          reason: 'Coverage critically low (<50%)',
          auditLog,
        } satisfies CiCdGovernanceOutput,
        recommendations: ['Add unit tests before deploying', 'Minimum 70% coverage required'],
        escalate: true,
        durationMs: 0,
      };
    }

    const approved = coverage >= 70 && errorRate <= 0.05;

    if (!approved) {
      const reasons: string[] = [];
      if (coverage < 70) reasons.push(`Coverage ${coverage}% below 70% threshold`);
      if (errorRate > 0.05) reasons.push(`Error rate ${(errorRate * 100).toFixed(2)}% above 5% threshold`);
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
