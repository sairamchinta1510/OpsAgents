import { describe, it, expect } from 'vitest';
import type {
  ServiceInputs,
  AgentContext,
  AgentResult,
  OrchestrationResult,
  Trigger,
  IAgent,
  IController,
} from '../src/interfaces.js';
import { AgentCategory, AgentStatus, InputType } from '../src/types.js';

describe('ServiceInputs shape', () => {
  it('accepts a minimal service input with only serviceId and timestamp', () => {
    const input: ServiceInputs = {
      serviceId: 'my-service',
      timestamp: Date.now(),
    };
    expect(input.serviceId).toBe('my-service');
  });

  it('accepts full input with all optional fields', () => {
    const input: ServiceInputs = {
      serviceId: 'svc',
      timestamp: 1000,
      code: { diff: 'diff --git ...', commitSha: 'abc123', files: ['src/app.ts'], coverage: 85 },
      perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 0.01, throughput: 1000 },
      monitors: { cpuPercent: 40, memoryPercent: 60, diskIoMbps: 10, networkMbps: 100 },
      machineParams: {
        cpuPercent: 40,
        memoryPercent: 60,
        instanceType: 't3.medium',
        region: 'us-east-1',
        availabilityZone: 'us-east-1a',
        nodeCount: 3,
      },
      incident: { alertId: 'alert-1', severity: 'high', message: 'p99 spike', source: 'cloudwatch', timestamp: 1000 },
    };
    expect(input.perfLog?.p99Latency).toBe(200);
    expect(input.incident?.severity).toBe('high');
  });
});

describe('AgentResult shape', () => {
  it('requires agentId, status, output, durationMs', () => {
    const result: AgentResult = {
      agentId: 'test-agent',
      status: 'success',
      output: { verified: true },
      durationMs: 100,
    };
    expect(result.status).toBe('success');
  });
});

describe('Trigger union', () => {
  it('covers all four trigger types', () => {
    const t1: Trigger = { type: 'deployment', artifact: 'my-service:v1.2.3' };
    const t2: Trigger = { type: 'alert', severity: 'critical' };
    const t3: Trigger = { type: 'schedule', cronExpression: '0 * * * *' };
    const t4: Trigger = { type: 'manual', reason: 'hotfix test' };
    expect([t1.type, t2.type, t3.type, t4.type]).toEqual(['deployment', 'alert', 'schedule', 'manual']);
  });
});
