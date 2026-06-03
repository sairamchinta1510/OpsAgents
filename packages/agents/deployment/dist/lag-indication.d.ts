import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';
export interface LagIndicationOutput {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    p99Latency: number;
    errorRate: number;
    anomalies: string[];
    recommendation: string;
}
export declare class LagIndicationAgent extends BaseAgent {
    readonly id = "lag-indication";
    readonly name = "Lag Indication Agent";
    readonly category = AgentCategory.DEPLOYMENT;
    readonly acceptedInputs: ("code" | "perf-log")[];
    readonly version = "0.1.0";
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=lag-indication.d.ts.map