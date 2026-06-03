import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export interface DeploymentValidationOutput {
  validated: boolean;
  healthScore: number;
  cpuPercent: number;
  memoryPercent: number;
  issues: string[];
}

export class DeploymentValidationAgent extends BaseAgent {
  readonly id = 'deployment-validation';
  readonly name = 'Deployment Validation Agent';
  readonly category = AgentCategory.DEPLOYMENT;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { monitors } = context.inputs;

    if (!monitors) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No monitors input provided' },
        durationMs: 0,
      };
    }

    const { cpuPercent, memoryPercent } = monitors;
    const issues: string[] = [];

    if (cpuPercent > 95 || memoryPercent > 95) {
      return {
        agentId: this.id,
        status: 'failure',
        output: {
          validated: false,
          healthScore: 0,
          cpuPercent,
          memoryPercent,
          issues: [`Critical resource exhaustion: cpu=${cpuPercent}%, mem=${memoryPercent}%`],
        } satisfies DeploymentValidationOutput,
        recommendations: ['Immediate scale-out required', 'Consider rollback'],
        escalate: true,
        durationMs: 0,
      };
    }

    if (cpuPercent >= 85) issues.push(`CPU ${cpuPercent}% exceeds 85% threshold`);
    if (memoryPercent >= 85) issues.push(`Memory ${memoryPercent}% exceeds 85% threshold`);

    const validated = cpuPercent < 85 && memoryPercent < 85;
    const healthScore = Math.max(0, 100 - Math.max(0, cpuPercent - 50) - Math.max(0, memoryPercent - 50));

    return {
      agentId: this.id,
      status: validated ? 'success' : 'failure',
      output: { validated, healthScore, cpuPercent, memoryPercent, issues } satisfies DeploymentValidationOutput,
      recommendations: validated ? [] : ['Scale resources before completing rollout'],
      durationMs: 0,
    };
  }
}
