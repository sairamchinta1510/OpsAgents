import { describe, it, expect } from 'vitest';
import { HealthCheckAgent } from '../src/health-check.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

function makeCtx(inputs: ServiceInputs): AgentContext {
  return {
    sessionId: 'test',
    serviceId: inputs.serviceId,
    triggeredBy: 'test',
    inputs,
    sharedState: {},
  };
}

describe('HealthCheckAgent', () => {
  it('has correct id and category', () => {
    const agent = new HealthCheckAgent();
    expect(agent.id).toBe('health-check');
    expect(agent.category).toBe('monitoring');
  });

  it('returns skipped when no machineParams or monitors', async () => {
    const agent = new HealthCheckAgent();
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });

  it('returns healthy for normal resource utilization', async () => {
    const agent = new HealthCheckAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 40, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
      machineParams: { cpuPercent: 40, memoryPercent: 50, nodeCount: 3 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const output = result.output as { healthy: boolean };
    expect(output.healthy).toBe(true);
  });

  it('returns degraded checks for high resource usage', async () => {
    const agent = new HealthCheckAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 88, memoryPercent: 87, diskIoMbps: 5, networkMbps: 2 },
    });
    const result = await agent.execute(ctx);
    // degraded but not unhealthy → still success but with degraded checks
    expect(result.status).toBe('success');
    const output = result.output as { checks: { status: string }[] };
    const degraded = output.checks.filter((c) => c.status === 'degraded');
    expect(degraded.length).toBeGreaterThan(0);
  });

  it('escalates when a node is unhealthy (cpu >= 95)', async () => {
    const agent = new HealthCheckAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 97, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    expect(result.escalate).toBe(true);
  });

  it('canHandle returns false with no relevant inputs', () => {
    const agent = new HealthCheckAgent();
    expect(agent.canHandle({ serviceId: 'svc', timestamp: 0 })).toBe(false);
  });
});
