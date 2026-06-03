import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';
export interface DeploymentValidationOutput {
    validated: boolean;
    healthScore: number;
    cpuPercent: number;
    memoryPercent: number;
    issues: string[];
}
export declare class DeploymentValidationAgent extends BaseAgent {
    readonly id = "deployment-validation";
    readonly name = "Deployment Validation Agent";
    readonly category = AgentCategory.DEPLOYMENT;
    readonly acceptedInputs: "monitor"[];
    readonly version = "0.1.0";
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=deployment-validation.d.ts.map