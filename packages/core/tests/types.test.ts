import { describe, it, expect } from 'vitest';
import {
  AgentCategory,
  AgentStatus,
  InputType,
} from '../src/types.js';

describe('AgentCategory', () => {
  it('has all five categories', () => {
    expect(AgentCategory.DEPLOYMENT).toBe('deployment');
    expect(AgentCategory.PREDICTIVE).toBe('predictive');
    expect(AgentCategory.MONITORING).toBe('monitoring');
    expect(AgentCategory.RELIABILITY).toBe('reliability');
    expect(AgentCategory.INFRASTRUCTURE).toBe('infrastructure');
  });
});

describe('AgentStatus', () => {
  it('has idle, running, error statuses', () => {
    expect(AgentStatus.IDLE).toBe('idle');
    expect(AgentStatus.RUNNING).toBe('running');
    expect(AgentStatus.ERROR).toBe('error');
  });
});

describe('InputType', () => {
  it('has all five input types', () => {
    const types: InputType[] = ['code', 'perf-log', 'monitor', 'machine-params', 'incident'];
    expect(types).toHaveLength(5);
  });
});
