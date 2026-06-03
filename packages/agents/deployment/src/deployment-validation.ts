import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult, MachineParamsInput } from '@opsagents/core';

const CPU_WARNING_THRESHOLD = 85;
const MEM_WARNING_THRESHOLD = 85;
const CPU_CRITICAL_THRESHOLD = 95;
const MEM_CRITICAL_THRESHOLD = 95;

export interface DeploymentValidationOutput {
  validated: boolean;
  cpuPercent: number;
  memoryPercent: number;
  reason: string;
}

export class DeploymentValidationAgent extends BaseAgent {
  readonly id = 'deployment-validation';
  readonly name = 'Deployment Validation Agent';
  readonly category = AgentCategory.DEPLOYMENT;
  readonly acceptedInputs = ['machine-params' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const machineParams: MachineParamsInput | undefined = context.inputs.machineParams;

    if (!machineParams) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No machineParams input provided' },
      } as AgentResult;
    }

    const { cpuPercent, memoryPercent } = machineParams;
    const validated = cpuPercent < CPU_WARNING_THRESHOLD && memoryPercent < MEM_WARNING_THRESHOLD;
    const escalate = cpuPercent > CPU_CRITICAL_THRESHOLD || memoryPercent > MEM_CRITICAL_THRESHOLD;

    const reason = escalate
      ? `CPU at ${cpuPercent}%, memory at ${memoryPercent}% — CPU/memory critical`
      : validated
        ? `CPU at ${cpuPercent}%, memory at ${memoryPercent}% — within thresholds`
        : `CPU at ${cpuPercent}%, memory at ${memoryPercent}% — CPU/memory elevated`;

    const output: DeploymentValidationOutput = {
      validated,
      cpuPercent,
      memoryPercent,
      reason,
    };

    return {
      agentId: this.id,
      status: escalate ? 'escalate' : validated ? 'success' : 'failure',
      output,
      escalate,
      recommendations: escalate
        ? ['Reduce resource pressure before proceeding with rollout']
        : validated
          ? []
          : ['Review deployment capacity before continuing'],
    } as AgentResult;
  }
}
