import { describe, it, expect } from 'vitest';
import { DefaultInputNormalizer } from '../src/input-normalizer.js';
import type { ServiceInputs } from '@opsagents/core';

describe('DefaultInputNormalizer', () => {
  const normalizer = new DefaultInputNormalizer();

  it('passes through valid ServiceInputs unchanged', () => {
    const inputs: ServiceInputs = {
      serviceId: 'svc',
      timestamp: 1000,
      monitors: { cpuPercent: 50, memoryPercent: 60, diskIoMbps: 5, networkMbps: 10 },
    };
    const result = normalizer.normalize(inputs);
    expect(result).toEqual(inputs);
  });

  it('stamps timestamp if missing', () => {
    const raw = { serviceId: 'svc' } as unknown as ServiceInputs;
    const result = normalizer.normalize(raw);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('throws if serviceId is missing', () => {
    const raw = { timestamp: 1000 } as unknown as ServiceInputs;
    expect(() => normalizer.normalize(raw)).toThrow('serviceId is required');
  });

  it('clamps errorRate to [0,1] range', () => {
    const inputs: ServiceInputs = {
      serviceId: 'svc',
      timestamp: 1000,
      perfLog: { p50Latency: 50, p99Latency: 200, errorRate: 1.5, throughput: 100 },
    };
    const result = normalizer.normalize(inputs);
    expect(result.perfLog?.errorRate).toBe(1);
  });
});
