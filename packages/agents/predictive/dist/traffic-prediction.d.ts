import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs } from '@opsagents/core';
export interface TrafficPredictionOutput {
    predicted: boolean;
    score: number;
    p99Latency: number;
    throughput: number;
    recommendation: string;
}
export declare class TrafficPredictionAgent extends BaseAgent {
    readonly id = "traffic-prediction";
    readonly name = "Traffic Prediction Agent";
    readonly category = AgentCategory.PREDICTIVE;
    readonly acceptedInputs: "perf-log"[];
    readonly version = "0.1.0";
    canHandle(_inputs: ServiceInputs): boolean;
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=traffic-prediction.d.ts.map