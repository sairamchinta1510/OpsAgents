import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';
export interface ScalingDecision {
    action: 'scale-up' | 'scale-down' | 'no-change';
    targetNodeCount: number;
    reason: string;
}
export interface HardwarePlannerOutput {
    currentNodeCount: number;
    scalingDecision: ScalingDecision;
    jobSchedule: {
        job: string;
        scheduledAt: string;
        priority: 'high' | 'normal' | 'low';
    }[];
    summary: string;
}
export declare class HardwarePlannerAgent extends BaseAgent {
    readonly id = "hardware-planner";
    readonly name = "Hardware Planner Agent";
    readonly category = AgentCategory.INFRASTRUCTURE;
    readonly acceptedInputs: ("monitor" | "machine-params")[];
    readonly version = "0.1.0";
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=hardware-planner.d.ts.map