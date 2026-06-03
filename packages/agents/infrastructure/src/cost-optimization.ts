import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, MachineParamsInput, MonitorInput } from '@opsagents/core';

const INSTANCE_HOURLY_RATES: Record<string, number> = {
  't3.micro': 0.0104,
  't3.small': 0.0208,
  't3.medium': 0.0416,
  't3.large': 0.0832,
  'm5.large': 0.096,
  'm5.xlarge': 0.192,
  'c5.large': 0.085,
  'c5.xlarge': 0.17,
};
const DEFAULT_HOURLY_RATE = 0.05;
const HOURS_PER_MONTH = 730;

export interface CostLineItem {
  resource: string;
  monthlyCostUsd: number;
  utilizationPercent: number;
  recommendation?: string;
}

export interface CostOptimizationOutput {
  currentMonthlyCostUsd: number;
  projectedSavingsUsd: number;
  lineItems: CostLineItem[];
  rightsizingRecommendations: string[];
  summary: string;
}

export class CostOptimizationAgent extends BaseAgent {
  readonly id = 'cost-optimization';
  readonly name = 'Cost Optimization Agent';
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
        output: { reason: 'No machineParams or monitors data for cost analysis' },
        durationMs: 0,
      };
    }

    const instanceType = machine?.instanceType ?? 'unknown';
    const nodeCount = machine?.nodeCount ?? 1;
    const cpuPercent = machine?.cpuPercent ?? monitors?.cpuPercent ?? 0;
    const memPercent = machine?.memoryPercent ?? monitors?.memoryPercent ?? 0;

    const hourlyRate = INSTANCE_HOURLY_RATES[instanceType] ?? DEFAULT_HOURLY_RATE;
    const currentMonthlyCostUsd = hourlyRate * HOURS_PER_MONTH * nodeCount;

    const lineItems: CostLineItem[] = [
      {
        resource: `${instanceType} × ${nodeCount} nodes`,
        monthlyCostUsd: currentMonthlyCostUsd,
        utilizationPercent: Math.round((cpuPercent + memPercent) / 2),
        recommendation: cpuPercent < 25 && memPercent < 40
          ? `Downsize to smaller instance type (avg utilization ${Math.round((cpuPercent + memPercent) / 2)}%)`
          : undefined,
      },
    ];

    // Network costs estimate
    const networkCost = (monitors?.networkMbps ?? 0) * 0.01 * HOURS_PER_MONTH;
    if (networkCost > 0) {
      lineItems.push({ resource: 'network-egress', monthlyCostUsd: networkCost, utilizationPercent: 0 });
    }

    const rightsizingRecommendations: string[] = [];
    let projectedSavingsUsd = 0;

    // Underutilized: suggest downsize
    if (cpuPercent < 25 && memPercent < 40) {
      // Estimate 40% savings from downsizing
      const savings = currentMonthlyCostUsd * 0.4;
      projectedSavingsUsd += savings;
      rightsizingRecommendations.push(
        `Downsize ${instanceType} — avg utilization ${Math.round((cpuPercent + memPercent) / 2)}%. Estimated saving: $${savings.toFixed(2)}/mo`,
      );
    }

    // Too many nodes at low load
    if (nodeCount > 2 && cpuPercent < 30) {
      const removableNodes = nodeCount - 2;
      const nodeSavings = hourlyRate * HOURS_PER_MONTH * removableNodes;
      projectedSavingsUsd += nodeSavings;
      rightsizingRecommendations.push(
        `Remove ${removableNodes} idle node(s). Estimated saving: $${nodeSavings.toFixed(2)}/mo`,
      );
    }

    const output: CostOptimizationOutput = {
      currentMonthlyCostUsd: Math.round(currentMonthlyCostUsd * 100) / 100,
      projectedSavingsUsd: Math.round(projectedSavingsUsd * 100) / 100,
      lineItems,
      rightsizingRecommendations,
      summary: `Monthly cost: $${currentMonthlyCostUsd.toFixed(2)}. Potential savings: $${projectedSavingsUsd.toFixed(2)}/mo.`,
    };

    return {
      agentId: this.id,
      status: 'success',
      output,
      recommendations: rightsizingRecommendations,
      durationMs: 0,
    };
  }
}
