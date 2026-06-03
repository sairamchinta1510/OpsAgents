import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs } from '@opsagents/core';
export interface KgNode {
    id: string;
    type: 'service' | 'agent' | 'incident' | 'component' | 'metric';
    label: string;
    properties: Record<string, unknown>;
    updatedAt: string;
}
export interface KgEdge {
    from: string;
    to: string;
    relationship: string;
    weight: number;
}
export interface KnowledgeGraph {
    nodes: Map<string, KgNode>;
    edges: KgEdge[];
}
export declare function getKnowledgeGraph(): KnowledgeGraph;
export interface KnowledgeGraphOutput {
    nodesAdded: number;
    edgesAdded: number;
    graphSize: {
        nodes: number;
        edges: number;
    };
    neo4jAdapterStatus: 'stub' | 'connected';
    recommendations: string[];
    summary: string;
}
export declare class KnowledgeGraphAgent extends BaseAgent {
    readonly id = "knowledge-graph";
    readonly name = "Knowledge Graph Agent";
    readonly category = AgentCategory.INFRASTRUCTURE;
    readonly acceptedInputs: ("code" | "perf-log" | "monitor" | "machine-params" | "incident")[];
    readonly version = "0.1.0";
    canHandle(_inputs: ServiceInputs): boolean;
    protected run(context: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=knowledge-graph.d.ts.map