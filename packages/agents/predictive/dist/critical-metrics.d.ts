import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';
export interface CriticalMetricsOutput {
    hasCritical: boolean;
    criticalFlags: string[];
    summary: string;
}
export declare class CriticalMetricsAgent extends BaseAgent {
    readonly id = "critical-metrics";
    readonly name = "Critical Metrics Agent";
    readonly category = AgentCategory.PREDICTIVE;
    readonly acceptedInputs: ("perf-log" | "monitor")[];
    readonly version = "0.1.0";
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=critical-metrics.d.ts.map