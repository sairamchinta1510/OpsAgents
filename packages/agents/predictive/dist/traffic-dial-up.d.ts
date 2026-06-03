import { BaseAgent, AgentCategory } from '@opsagents/core';
import type { AgentContext, AgentResult } from '@opsagents/core';
export interface TrafficDialUpOutput {
    shouldDialUp: boolean;
    dialUpPercent: number;
    currentThroughput: number;
    cpuPercent: number;
    recommendation: string;
}
export declare class TrafficDialUpAgent extends BaseAgent {
    readonly id = "traffic-dial-up";
    readonly name = "Traffic Dial Up Agent";
    readonly category = AgentCategory.PREDICTIVE;
    readonly acceptedInputs: ("perf-log" | "machine-params")[];
    readonly version = "0.1.0";
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=traffic-dial-up.d.ts.map