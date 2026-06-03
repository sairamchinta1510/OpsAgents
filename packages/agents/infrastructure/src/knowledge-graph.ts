import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs } from '@opsagents/core';

// ── In-memory knowledge graph ────────────────────────────────────────────────

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

// Shared singleton graph (in-memory — neo4j adapter stub for Phase 2)
const globalGraph: KnowledgeGraph = { nodes: new Map(), edges: [] };

export function getKnowledgeGraph(): KnowledgeGraph {
  return globalGraph;
}

export interface KnowledgeGraphOutput {
  nodesAdded: number;
  edgesAdded: number;
  graphSize: { nodes: number; edges: number };
  neo4jAdapterStatus: 'stub' | 'connected';
  recommendations: string[];
  summary: string;
}

export class KnowledgeGraphAgent extends BaseAgent {
  readonly id = 'knowledge-graph';
  readonly name = 'Knowledge Graph Agent';
  readonly category = AgentCategory.INFRASTRUCTURE;
  readonly acceptedInputs = ['code' as const, 'monitor' as const, 'perf-log' as const, 'incident' as const, 'machine-params' as const];
  readonly version = '0.1.0';

  override canHandle(_inputs: ServiceInputs): boolean {
    return true; // always runs — updates graph from any inputs
  }

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { serviceId, sessionId, inputs } = context;
    const graph = globalGraph;
    const now = new Date().toISOString();
    let nodesAdded = 0;
    let edgesAdded = 0;

    // Upsert service node
    if (!graph.nodes.has(serviceId)) {
      graph.nodes.set(serviceId, { id: serviceId, type: 'service', label: serviceId, properties: {}, updatedAt: now });
      nodesAdded++;
    }

    // Incident node
    if (inputs.incident) {
      const incId = inputs.incident.alertId;
      graph.nodes.set(incId, {
        id: incId,
        type: 'incident',
        label: inputs.incident.message,
        properties: { severity: inputs.incident.severity, source: inputs.incident.source },
        updatedAt: now,
      });
      nodesAdded++;
      graph.edges.push({ from: serviceId, to: incId, relationship: 'HAS_INCIDENT', weight: 1 });
      edgesAdded++;
    }

    // Component nodes from monitors
    if (inputs.monitors) {
      const components = ['compute-layer', 'memory-subsystem', 'network-layer', 'disk-layer'];
      for (const comp of components) {
        if (!graph.nodes.has(comp)) {
          graph.nodes.set(comp, { id: comp, type: 'component', label: comp, properties: {}, updatedAt: now });
          nodesAdded++;
        }
        if (!graph.edges.some((e) => e.from === serviceId && e.to === comp)) {
          graph.edges.push({ from: serviceId, to: comp, relationship: 'USES', weight: 1 });
          edgesAdded++;
        }
      }
    }

    // Metric nodes from perfLog
    if (inputs.perfLog) {
      const metricId = `${serviceId}:perf:${sessionId.slice(0, 8)}`;
      graph.nodes.set(metricId, {
        id: metricId,
        type: 'metric',
        label: 'perf-snapshot',
        properties: {
          p99Latency: inputs.perfLog.p99Latency,
          errorRate: inputs.perfLog.errorRate,
          throughput: inputs.perfLog.throughput,
        },
        updatedAt: now,
      });
      nodesAdded++;
      graph.edges.push({ from: serviceId, to: metricId, relationship: 'HAS_METRIC', weight: 1 });
      edgesAdded++;
    }

    // Derive cross-incident recommendations from graph topology
    const serviceIncidents = graph.edges
      .filter((e) => e.from === serviceId && e.relationship === 'HAS_INCIDENT')
      .map((e) => graph.nodes.get(e.to))
      .filter(Boolean) as KgNode[];

    const recommendations: string[] = [];
    if (serviceIncidents.length > 3) {
      recommendations.push(`Service ${serviceId} has ${serviceIncidents.length} incidents in graph — consider architectural review`);
    }

    const output: KnowledgeGraphOutput = {
      nodesAdded,
      edgesAdded,
      graphSize: { nodes: graph.nodes.size, edges: graph.edges.length },
      neo4jAdapterStatus: 'stub',
      recommendations,
      summary: `Graph updated: +${nodesAdded} nodes, +${edgesAdded} edges. Total: ${graph.nodes.size} nodes, ${graph.edges.length} edges.`,
    };

    return {
      agentId: this.id,
      status: 'success',
      output,
      recommendations,
      durationMs: 0,
    };
  }
}
