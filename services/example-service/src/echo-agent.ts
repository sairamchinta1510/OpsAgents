import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';

export class EchoAgent extends BaseAgent {
  readonly id = 'echo-agent';
  readonly name = 'Echo Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { cpuPercent, memoryPercent } = context.inputs.monitors ?? {
      cpuPercent: 0,
      memoryPercent: 0,
    };

    return {
      agentId: this.id,
      status: 'success',
      output: {
        message: `example-service health: cpu=${cpuPercent}%, mem=${memoryPercent}%`,
        cpuPercent,
        memoryPercent,
      },
      durationMs: 0,
    };
  }
}
