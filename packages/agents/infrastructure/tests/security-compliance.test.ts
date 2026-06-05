import { describe, it, expect } from 'vitest';
import { SecurityComplianceAgent } from '../src/security-compliance.js';
import type { AgentContext, ServiceInputs } from '@opsagents/core';

function ctx(inputs: ServiceInputs): AgentContext {
  return { sessionId: 'test', serviceId: inputs.serviceId, triggeredBy: 'test', inputs, sharedState: {} };
}

describe('SecurityComplianceAgent', () => {
  it('has correct id and category', () => {
    const a = new SecurityComplianceAgent();
    expect(a.id).toBe('security-compliance');
    expect(a.category).toBe('infrastructure');
  });

  it('skips with no relevant inputs', async () => {
    const a = new SecurityComplianceAgent();
    const r = await a.execute(ctx({ serviceId: 'svc', timestamp: 0 }));
    expect(r.status).toBe('skipped');
  });

  it('passes clean code scan with good coverage', async () => {
    const a = new SecurityComplianceAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      code: { commitSha: 'abc123', coverage: 90 },
    }));
    expect(r.status).toBe('success');
    const o = r.output as { complianceScore: number };
    expect(o.complianceScore).toBeGreaterThanOrEqual(80);
  });

  it('detects secret in diff and escalates', async () => {
    const a = new SecurityComplianceAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      code: { commitSha: 'bad1', diff: 'const password = "hunter2"', coverage: 85 },
    }));
    expect(r.status).toBe('failure');
    expect(r.escalate).toBe(true);
    const o = r.output as { vulnerabilities: { id: string }[] };
    expect(o.vulnerabilities.some((v) => v.id === 'SEC-001')).toBe(true);
  });

  it('fails check for low coverage', async () => {
    const a = new SecurityComplianceAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      code: { commitSha: 'abc', coverage: 40 },
    }));
    const o = r.output as { checks: { name: string; status: string }[] };
    const cov = o.checks.find((c) => c.name === 'test-coverage');
    expect(cov?.status).toBe('fail');
  });

  it('rotates secrets when machineParams provided', async () => {
    const a = new SecurityComplianceAgent();
    const r = await a.execute(ctx({
      serviceId: 'svc', timestamp: 0,
      machineParams: { cpuPercent: 30, memoryPercent: 40, nodeCount: 2, instanceType: 'm5.large', region: 'us-east-1', availabilityZone: 'us-east-1a' },
    }));
    const o = r.output as { secretsRotated: string[] };
    expect(o.secretsRotated.length).toBeGreaterThan(0);
  });
});
