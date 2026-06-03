import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export interface OnDemandTestingOutput {
  passed: boolean;
  coverage: number;
  testCount: number;
  failedTests: string[];
  summary: string;
}

export class OnDemandTestingAgent extends BaseAgent {
  readonly id = 'on-demand-testing';
  readonly name = 'On-Demand Testing Agent';
  readonly category = AgentCategory.DEPLOYMENT;
  readonly acceptedInputs = ['code' as const, 'monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { code } = context.inputs;

    if (!code) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No code input provided' },
        durationMs: 0,
      };
    }

    const coverage = code.coverage ?? 0;
    const testCount = Math.round(coverage * 2);
    const failedTests: string[] = [];

    if (coverage < 40) {
      failedTests.push('CRITICAL: Insufficient test coverage for safe deployment');
      return {
        agentId: this.id,
        status: 'failure',
        output: {
          passed: false,
          coverage,
          testCount,
          failedTests,
          summary: `Critical: ${coverage}% coverage is below minimum 40% threshold`,
        } satisfies OnDemandTestingOutput,
        recommendations: ['Add tests before deploying — minimum 60% coverage required'],
        escalate: true,
        durationMs: 0,
      };
    }

    if (coverage < 60) {
      failedTests.push(`Coverage ${coverage}% below 60% pass threshold`);
    }

    const passed = failedTests.length === 0;

    return {
      agentId: this.id,
      status: passed ? 'success' : 'failure',
      output: {
        passed,
        coverage,
        testCount,
        failedTests,
        summary: passed
          ? `All ${testCount} simulated tests passed with ${coverage}% coverage`
          : `${failedTests.length} test criteria failed`,
      } satisfies OnDemandTestingOutput,
      recommendations: passed ? [] : ['Improve test coverage to at least 60%'],
      durationMs: 0,
    };
  }
}
