import { AgentCategory, BaseAgent } from '@opsagents/core';
// Shared singleton graph (in-memory — neo4j adapter stub for Phase 2)
const globalGraph = { nodes: new Map(), edges: [] };
export function getKnowledgeGraph() {
    return globalGraph;
}
export class KnowledgeGraphAgent extends BaseAgent {
    id = 'knowledge-graph';
    name = 'Knowledge Graph Agent';
    category = AgentCategory.INFRASTRUCTURE;
    acceptedInputs = ['code', 'monitor', 'perf-log', 'incident', 'machine-params'];
    version = '0.1.0';
    canHandle(_inputs) {
        return true; // always runs — updates graph from any inputs
    }
    async run(context) {
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
            .filter(Boolean);
        const recommendations = [];
        if (serviceIncidents.length > 3) {
            recommendations.push(`Service ${serviceId} has ${serviceIncidents.length} incidents in graph — consider architectural review`);
        }
        const output = {
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
//# sourceMappingURL=knowledge-graph.js.map