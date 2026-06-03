import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';
export interface DeploymentValidationOutput {
    validated: boolean;
    cpuPercent: number;
    memoryPercent: number;
    reason: string;
}
export declare class DeploymentValidationAgent extends BaseAgent {
    readonly id = "deployment-validation";
    readonly name = "Deployment Validation Agent";
    readonly category = AgentCategory.DEPLOYMENT;
    readonly acceptedInputs: "machine-params"[];
    readonly version = "0.1.0";
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=deployment-validation.d.ts.map