import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';
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
export declare class CostOptimizationAgent extends BaseAgent {
    readonly id = "cost-optimization";
    readonly name = "Cost Optimization Agent";
    readonly category = AgentCategory.INFRASTRUCTURE;
    readonly acceptedInputs: ("monitor" | "machine-params")[];
    readonly version = "0.1.0";
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=cost-optimization.d.ts.map