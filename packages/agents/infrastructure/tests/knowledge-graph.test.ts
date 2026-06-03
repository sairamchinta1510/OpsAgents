import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGraphAgent, getKnowledgeGraph } from '../src/knowledge-graph.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

function ctx(inputs: ServiceInputs): AgentContext {
  return { sessionId: 'sess-abcdef12', serviceId: inputs.serviceId, triggeredBy: 'test', inputs, sharedState: {} };
}

// Clear the global graph before each test to avoid cross-test pollution
beforeEach(() => {
  const graph = getKnowledgeGraph();
  graph.nodes.clear();
  graph.edges.length = 0;
});

describe('KnowledgeGraphAgent', () => {
  it('has correct id and category', () => {
    const a = new KnowledgeGraphAgent();
    expect(a.id).toBe('knowledge-graph');
    expect(a.category).toBe('infrastructure');
  });

  it('always returns success (canHandle returns true)', async () => {
    const a = new KnowledgeGraphAgent();
    const r = await a.execute(ctx({ serviceId: 'svc', timestamp: 0 }));
    expect(r.status).toBe('success');
  });

  it('adds service node to graph', async () => {
    const a = new KnowledgeGraphAgent();
    await a.execute(ctx({ serviceId: 'svc-1', timestamp: 0 }));
    expect(getKnowledgeGraph().nodes.has('svc-1')).toBe(true);
  });

  it('adds incident node and edge when incident input present', async () => {
    const a = new KnowledgeGraphAgent();
    await a.execute(ctx({
      serviceId: 'svc-2', timestamp: 0,
      incident: { alertId: 'inc-99', severity: 'high', message: 'Down', source: 'api', timestamp: Date.now() },
    }));
    const graph = getKnowledgeGraph();
    expect(graph.nodes.has('inc-99')).toBe(true);
    expect(graph.edges.some((e) => e.from === 'svc-2' && e.to === 'inc-99')).toBe(true);
  });

  it('adds component nodes from monitors input', async () => {
    const a = new KnowledgeGraphAgent();
    await a.execute(ctx({
      serviceId: 'svc-3', timestamp: 0,
      monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 5, networkMbps: 2 },
    }));
    expect(getKnowledgeGraph().nodes.has('compute-layer')).toBe(true);
  });

  it('reports neo4j adapter as stub', async () => {
    const a = new KnowledgeGraphAgent();
    const r = await a.execute(ctx({ serviceId: 'svc', timestamp: 0 }));
    const o = r.output as { neo4jAdapterStatus: string };
    expect(o.neo4jAdapterStatus).toBe('stub');
  });

  it('output includes graph size', async () => {
    const a = new KnowledgeGraphAgent();
    await a.execute(ctx({ serviceId: 'svc', timestamp: 0 }));
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      incident: { alertId: 'inc-1', severity: 'low', message: 'blip', source: 'cron', timestamp: Date.now() },
    }));
    const o = r.output as { graphSize: { nodes: number; edges: number } };
    expect(o.graphSize.nodes).toBeGreaterThan(0);
    expect(o.graphSize.edges).toBeGreaterThan(0);
  });
});
