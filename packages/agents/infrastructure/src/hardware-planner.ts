import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, MachineParamsInput, MonitorInput } from '@opsagents/core';

const CPU_SCALE_UP_THRESHOLD = 75;
const MEM_SCALE_UP_THRESHOLD = 80;
const CPU_SCALE_DOWN_THRESHOLD = 20;
const MIN_NODES = 2;
const MAX_NODES = 10;

export interface ScalingDecision {
  action: 'scale-up' | 'scale-down' | 'no-change';
  targetNodeCount: number;
  reason: string;
}

export interface HardwarePlannerOutput {
  currentNodeCount: number;
  scalingDecision: ScalingDecision;
  jobSchedule: { job: string; scheduledAt: string; priority: 'high' | 'normal' | 'low' }[];
  summary: string;
}

export class HardwarePlannerAgent extends BaseAgent {
  readonly id = 'hardware-planner';
  readonly name = 'Hardware Planner Agent';
  readonly category = AgentCategory.INFRASTRUCTURE;
  readonly acceptedInputs = ['machine-params' as const, 'monitor' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const machine = context.inputs.machineParams as MachineParamsInput | undefined;
    const monitors = context.inputs.monitors as MonitorInput | undefined;

    if (!machine && !monitors) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No machineParams or monitors data' },
        durationMs: 0,
      };
    }

    const cpuPercent = machine?.cpuPercent ?? monitors?.cpuPercent ?? 0;
    const memPercent = machine?.memoryPercent ?? monitors?.memoryPercent ?? 0;
    const currentNodeCount = machine?.nodeCount ?? 1;

    let scalingDecision: ScalingDecision;

    if (cpuPercent >= CPU_SCALE_UP_THRESHOLD || memPercent >= MEM_SCALE_UP_THRESHOLD) {
      const targetNodeCount = Math.min(currentNodeCount + 2, MAX_NODES);
      scalingDecision = {
        action: 'scale-up',
        targetNodeCount,
        reason: `High resource pressure: CPU ${cpuPercent}%, Memory ${memPercent}%`,
      };
    } else if (cpuPercent <= CPU_SCALE_DOWN_THRESHOLD && currentNodeCount > MIN_NODES) {
      const targetNodeCount = Math.max(currentNodeCount - 1, MIN_NODES);
      scalingDecision = {
        action: 'scale-down',
        targetNodeCount,
        reason: `Low utilization: CPU ${cpuPercent}% — consolidating to save cost`,
      };
    } else {
      scalingDecision = {
        action: 'no-change',
        targetNodeCount: currentNodeCount,
        reason: `Utilization within normal range: CPU ${cpuPercent}%, Memory ${memPercent}%`,
      };
    }

    // Stub job schedule: priority jobs assigned based on resource state
    const now = new Date().toISOString();
    const jobSchedule = [
      {
        job: 'db-backup',
        scheduledAt: now,
        priority: cpuPercent < 50 ? 'normal' as const : 'low' as const,
      },
      {
        job: 'log-rotation',
        scheduledAt: now,
        priority: 'low' as const,
      },
      {
        job: 'health-snapshot',
        scheduledAt: now,
        priority: 'high' as const,
      },
    ];

    const output: HardwarePlannerOutput = {
      currentNodeCount,
      scalingDecision,
      jobSchedule,
      summary: `Scaling: ${scalingDecision.action} → ${scalingDecision.targetNodeCount} nodes. ${scalingDecision.reason}`,
    };

    return {
      agentId: this.id,
      status: 'success',
      output,
      escalate: scalingDecision.action === 'scale-up' && scalingDecision.targetNodeCount >= MAX_NODES,
      recommendations: scalingDecision.action === 'scale-up'
        ? [`Scale cluster to ${scalingDecision.targetNodeCount} nodes immediately`]
        : scalingDecision.action === 'scale-down'
          ? [`Safely drain and terminate ${currentNodeCount - scalingDecision.targetNodeCount} node(s)`]
          : [],
      durationMs: 0,
    };
  }
}
