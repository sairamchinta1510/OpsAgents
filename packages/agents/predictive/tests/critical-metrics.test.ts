import { describe, it, expect, beforeEach } from 'vitest';
import { AgentCategory } from '@opsagents/core';
import { CriticalMetricsAgent } from '../src/critical-metrics.js';

function makeCtx(inputs: Record<string, unknown>) {
  return { trigger: { type: 'manual' as const, serviceId: 'svc', timestamp: 1000 }, inputs };
}

describe('CriticalMetricsAgent', () => {
  let agent: CriticalMetricsAgent;
  beforeEach(() => { agent = new CriticalMetricsAgent(); });

  it('has correct id, category, acceptedInputs', () => {
    expect(agent.id).toBe('critical-metrics');
    expect(agent.category).toBe(AgentCategory.PREDICTIVE);
    expect(agent.acceptedInputs).toContain('monitor');
    expect(agent.acceptedInputs).toContain('perf-log');
  });

  it('skips when both monitors and perfLog absent', async () => {
    const result = await agent.execute(makeCtx({}));
    expect(result.status).toBe('skipped');
  });

  it('succeeds when all metrics are within bounds', async () => {
    const result = await agent.execute(makeCtx({
      monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 10, networkMbps: 5 },
      perfLog: { p50Latency: 100, p99Latency: 500, errorRate: 0.01, throughput: 1000 }
    }));
    expect(result.status).toBe('success');
    expect((result.output as { hasCritical: boolean }).hasCritical).toBe(false);
  });

  it('fails (not escalate) when one metric is critical', async () => {
    const result = await agent.execute(makeCtx({
      monitors: { cpuPercent: 95, memoryPercent: 60, diskIoMbps: 10, networkMbps: 5 }
    }));
    expect(result.status).toBe('failure');
    expect((result.output as { criticalFlags: string[] }).criticalFlags).toContain('cpu');
    expect(result.escalate).toBeFalsy();
  });

  it('escalates when 2+ metrics are critical', async () => {
    const result = await agent.execute(makeCtx({
      monitors: { cpuPercent: 95, memoryPercent: 92, diskIoMbps: 10, networkMbps: 5 },
      perfLog: { p50Latency: 500, p99Latency: 2500, errorRate: 0.02, throughput: 1000 }
    }));
    expect(result.escalate).toBe(true);
    expect((result.output as { criticalFlags: string[] }).criticalFlags.length).toBeGreaterThanOrEqual(2);
  });

  it('flags p99-latency and error-rate from perfLog', async () => {
    const result = await agent.execute(makeCtx({
      perfLog: { p50Latency: 500, p99Latency: 2500, errorRate: 0.15, throughput: 1000 }
    }));
    const flags = (result.output as { criticalFlags: string[] }).criticalFlags;
    expect(flags).toContain('p99-latency');
    expect(flags).toContain('error-rate');
    expect(result.escalate).toBe(true);
  });
});
