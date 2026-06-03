import type { AgentCategory, AgentStatus, InputType } from './types.js';
export interface CodeInput {
    diff?: string;
    commitSha?: string;
    files?: string[];
    coverage?: number;
}
export interface PerfLogInput {
    p50Latency: number;
    p99Latency: number;
    errorRate: number;
    throughput: number;
    raw?: string[];
}
export interface MonitorInput {
    cpuPercent: number;
    memoryPercent: number;
    diskIoMbps: number;
    networkMbps: number;
    customMetrics?: Record<string, number>;
}
export interface MachineParamsInput {
    instanceType: string;
    region: string;
    availabilityZone: string;
    nodeCount: number;
    tags?: Record<string, string>;
}
export interface IncidentInput {
    alertId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    source: string;
    timestamp: number;
}
export interface ServiceInputs {
    serviceId: string;
    timestamp: number;
    code?: CodeInput;
    perfLog?: PerfLogInput;
    monitors?: MonitorInput;
    machineParams?: MachineParamsInput;
    incident?: IncidentInput;
}
export interface AgentContext {
    sessionId: string;
    serviceId: string;
    triggeredBy: string;
    inputs: ServiceInputs;
    sharedState: Record<string, unknown>;
}
export interface AgentResult {
    agentId: string;
    status: 'success' | 'failure' | 'skipped' | 'escalate';
    output: unknown;
    recommendations?: string[];
    escalate?: boolean;
    nextAgents?: string[];
    durationMs: number;
}
export type Trigger = {
    type: 'deployment';
    artifact: string;
} | {
    type: 'alert';
    severity: string;
} | {
    type: 'schedule';
    cronExpression: string;
} | {
    type: 'manual';
    reason: string;
};
export interface OrchestrationResult {
    controllerId: string;
    sessionId: string;
    trigger: Trigger;
    agentResults: AgentResult[];
    overallStatus: 'success' | 'partial' | 'failure' | 'escalated';
    durationMs: number;
    summary: string;
}
export interface IAgent {
    readonly id: string;
    readonly name: string;
    readonly category: AgentCategory;
    readonly acceptedInputs: InputType[];
    readonly version: string;
    execute(context: AgentContext): Promise<AgentResult>;
    canHandle(inputs: ServiceInputs): boolean;
    getStatus(): AgentStatus;
    healthCheck(): Promise<boolean>;
    getMetrics(): AgentMetrics;
    isEnabled(): boolean;
}
export interface AgentMetrics {
    invocationCount: number;
    successCount: number;
    failureCount: number;
    skipCount: number;
    escalateCount: number;
    totalDurationMs: number;
    avgDurationMs: number;
    lastRunAt: Date | null;
    lastStatus: 'success' | 'failure' | 'skipped' | 'escalate' | null;
}
export interface IController {
    readonly id: string;
    readonly name: string;
    registerAgent(agent: IAgent): void;
    orchestrate(trigger: Trigger, inputs: ServiceInputs): Promise<OrchestrationResult>;
    getRegisteredAgents(): IAgent[];
}
//# sourceMappingURL=interfaces.d.ts.map