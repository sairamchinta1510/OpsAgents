import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';
export interface OnDemandTestingOutput {
    passed: boolean;
    coverage: number;
    testCount: number;
    failedTests: string[];
    summary: string;
}
export declare class OnDemandTestingAgent extends BaseAgent {
    readonly id = "on-demand-testing";
    readonly name = "On-Demand Testing Agent";
    readonly category = AgentCategory.DEPLOYMENT;
    readonly acceptedInputs: ("code" | "monitor")[];
    readonly version = "0.1.0";
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=on-demand-testing.d.ts.map