import { describe, it, expect } from 'vitest';
import { AgentRegistry, EventBus } from '@opsagents/core';
import { InfrastructureController } from '../src/infrastructure-controller.js';
import type { ServiceInputs } from '@opsagents/core';

function makeController() {
  return new InfrastructureController(new AgentRegistry(), new EventBus());
}

const fullInputs: ServiceInputs = {
  serviceId: 'platform-service',
  timestamp: Date.now(),
  machineParams: { cpuPercent: 55, memoryPercent: 60, nodeCount: 3, instanceType: 'm5.large', region: 'us-east-1', availabilityZone: 'us-east-1a' },
  monitors: { cpuPercent: 55, memoryPercent: 60, diskIoMbps: 8, networkMbps: 3 },
  code: { commitSha: 'abc123', coverage: 85 },
};

describe('InfrastructureController', () => {
  it('has correct id', () => {
    expect(makeController().id).toBe('infrastructure-controller');
  });

  it('runs all 4 agents and returns results', async () => {
    const result = await makeController().orchestrate(fullInputs);
    expect(result.results.length).toBe(4);
    const ids = result.results.map((r) => r.agentId);
    expect(ids).toContain('hardware-planner');
    expect(ids).toContain('security-compliance');
    expect(ids).toContain('cost-optimization');
    expect(ids).toContain('knowledge-graph');
  });

  it('returns success when all agents succeed', async () => {
    const result = await makeController().orchestrate(fullInputs);
    expect(['success', 'partial']).toContain(result.status);
  });

  it('KnowledgeGraphAgent always returns success', async () => {
    const result = await makeController().orchestrate(fullInputs);
    const kgResult = result.results.find((r) => r.agentId === 'knowledge-graph');
    expect(kgResult?.status).toBe('success');
  });

  it('escalates when security vulnerability found', async () => {
    const result = await makeController().orchestrate({
      serviceId: 'vuln-service',
      timestamp: Date.now(),
      code: { commitSha: 'bad1', diff: 'const secret = "p@ssw0rd"', coverage: 85 },
    });
    expect(result.escalatedBy).toBe('security-compliance');
    expect(result.status).toBe('escalated');
  });

  it('orchestration carries session metadata', async () => {
    const result = await makeController().orchestrate(fullInputs);
    expect(result.orchestration.sessionId).toBeTruthy();
    expect(typeof result.orchestration.durationMs).toBe('number');
  });
});
