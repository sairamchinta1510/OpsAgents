import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';
export interface CiCdGovernanceOutput {
    approved: boolean;
    coverage: number;
    errorRate: number;
    reason: string;
    auditLog: string[];
}
export declare class CiCdGovernanceAgent extends BaseAgent {
    readonly id = "ci-cd-governance";
    readonly name = "CI/CD Governance Agent";
    readonly category = AgentCategory.DEPLOYMENT;
    readonly acceptedInputs: ("code" | "perf-log")[];
    readonly version = "0.1.0";
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=ci-cd-governance.d.ts.map