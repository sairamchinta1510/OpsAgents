import { describe, it, expect } from 'vitest';
import { MonitoringAgent } from '../src/monitoring.js';
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

describe('MonitoringAgent', () => {
  it('has correct id, name, and category', () => {
    const agent = new MonitoringAgent();
    expect(agent.id).toBe('monitoring');
    expect(agent.name).toBe('Monitoring Agent');
    expect(agent.category).toBe('monitoring');
  });

  it('returns skipped when no monitors or perfLog', async () => {
    const agent = new MonitoringAgent();
    const ctx = makeCtx({ serviceId: 'svc', timestamp: 1000 });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('skipped');
  });

  it('returns success with no anomalies for healthy metrics', async () => {
    const agent = new MonitoringAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 40, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
      perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.005, throughput: 1000 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const output = result.output as { anomalies: unknown[]; alertLevel: string };
    expect(output.anomalies).toHaveLength(0);
    expect(output.alertLevel).toBe('none');
  });

  it('detects warning-level CPU anomaly', async () => {
    const agent = new MonitoringAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 80, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    const output = result.output as { alertLevel: string };
    expect(output.alertLevel).toBe('warning');
  });

  it('detects critical CPU and escalates', async () => {
    const agent = new MonitoringAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 95, memoryPercent: 50, diskIoMbps: 5, networkMbps: 2 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    expect(result.escalate).toBe(true);
    const output = result.output as { alertLevel: string };
    expect(output.alertLevel).toBe('critical');
  });

  it('detects critical error rate', async () => {
    const agent = new MonitoringAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.08, throughput: 1000 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    expect(result.escalate).toBe(true);
  });

  it('detects high p99 latency', async () => {
    const agent = new MonitoringAgent();
    const ctx = makeCtx({
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 50, p99Latency: 1200, errorRate: 0.001, throughput: 1000 },
    });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failure');
    expect(result.escalate).toBe(true);
  });
});
