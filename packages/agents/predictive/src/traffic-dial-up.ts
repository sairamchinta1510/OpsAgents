import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult, MachineParamsInput, PerfLogInput } from '@opsagents/core';

const DIAL_UP_THROUGHPUT_THRESHOLD = 5_000;
const DIAL_UP_CPU_THRESHOLD = 70;
const DIAL_UP_STEP_PERCENT = 10;

type TrafficDialUpMachineParams = MachineParamsInput & {
  cpuPercent?: number;
  memoryPercent?: number;
};

export interface TrafficDialUpOutput {
  shouldDialUp: boolean;
  dialUpPercent: number;
  currentThroughput: number;
  cpuPercent: number;
  recommendation: string;
}

export class TrafficDialUpAgent extends BaseAgent {
  readonly id = 'traffic-dial-up';
  readonly name = 'Traffic Dial Up Agent';
  readonly category = AgentCategory.PREDICTIVE;
  readonly acceptedInputs = ['perf-log' as const, 'machine-params' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const perfLog = context.inputs.perfLog as PerfLogInput | undefined;
    const machineParams = context.inputs.machineParams as TrafficDialUpMachineParams | undefined;

    if (!perfLog && !machineParams) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No perfLog or machineParams input provided' },
      } as AgentResult;
    }

    const throughput = perfLog?.throughput ?? 0;
    const cpu = machineParams?.cpuPercent ?? 0;

    const shouldDialUp = throughput >= DIAL_UP_THROUGHPUT_THRESHOLD && cpu < DIAL_UP_CPU_THRESHOLD;
    const escalate = cpu >= DIAL_UP_CPU_THRESHOLD && throughput >= DIAL_UP_THROUGHPUT_THRESHOLD;

    const recommendation = shouldDialUp
      ? `Dial up traffic by ${DIAL_UP_STEP_PERCENT}% — machines have headroom`
      : escalate
        ? 'Cannot dial up — machines at capacity, scale first'
        : 'Traffic below dial-up threshold — no action needed';

    const output: TrafficDialUpOutput = {
      shouldDialUp,
      dialUpPercent: shouldDialUp ? DIAL_UP_STEP_PERCENT : 0,
      currentThroughput: throughput,
      cpuPercent: cpu,
      recommendation,
    };

    return {
      agentId: this.id,
      status: shouldDialUp ? 'success' : 'failure',
      output,
      recommendations: [recommendation],
      escalate,
    } as AgentResult;
  }
}
