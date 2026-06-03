import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';
export interface ComplianceCheck {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    details: string;
}
export interface SecurityComplianceOutput {
    checks: ComplianceCheck[];
    secretsRotated: string[];
    vulnerabilities: {
        id: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
        description: string;
    }[];
    complianceScore: number;
    summary: string;
}
export declare class SecurityComplianceAgent extends BaseAgent {
    readonly id = "security-compliance";
    readonly name = "Security & Compliance Agent";
    readonly category = AgentCategory.INFRASTRUCTURE;
    readonly acceptedInputs: ("code" | "machine-params")[];
    readonly version = "0.1.0";
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=security-compliance.d.ts.map