import { describe, it, expect } from 'vitest';
import { AutoRemediationAgent } from './auto-remediation.js';
import type { ErrorRecord } from '@opsagents/core';

const createErrorRecord = (errorType: string, message: string): ErrorRecord => ({
  ts: Date.now(),
  errorType,
  message,
  file: '/app/src/index.ts',
  line: 42,
  column: 10,
  stackTrace: ['at main', 'at init'],
  logFile: '/var/log/app.log',
  language: 'typescript'
});

describe('AutoRemediationAgent', () => {
  const agent = new AutoRemediationAgent();

  it('OutOfMemoryError → includes scale-up action', () => {
    const error = createErrorRecord('OutOfMemoryError', 'Java heap space exceeded');
    const result = agent.remediate(error);

    const scaleUpAction = result.actions.find(a => a.type === 'scale-up');
    expect(scaleUpAction).toBeDefined();
    expect(scaleUpAction?.description).toBe('Increase memory allocation');
    expect(scaleUpAction?.automated).toBe(true);
  });

  it('segfault → includes restart action', () => {
    const error = createErrorRecord('segfault', 'SIGSEGV in native code');
    const result = agent.remediate(error);

    const restartAction = result.actions.find(a => a.type === 'restart');
    expect(restartAction).toBeDefined();
    expect(restartAction?.description).toBe('Restart service after crash');
    expect(restartAction?.automated).toBe(true);
  });

  it('NullPointerException → includes code-fix action with automated=false', () => {
    const error = createErrorRecord('NullPointerException', 'Cannot read property of null');
    const result = agent.remediate(error);

    const codeFixAction = result.actions.find(a => a.type === 'code-fix');
    expect(codeFixAction).toBeDefined();
    expect(codeFixAction?.description).toContain('NullPointerException');
    expect(codeFixAction?.automated).toBe(false);
  });

  it('TypeError → includes code-fix action', () => {
    const error = createErrorRecord('TypeError', 'undefined is not a function');
    const result = agent.remediate(error);

    const codeFixAction = result.actions.find(a => a.type === 'code-fix');
    expect(codeFixAction).toBeDefined();
    expect(codeFixAction?.description).toContain('TypeError');
    expect(codeFixAction?.automated).toBe(false);
  });

  it('SyntaxError → includes rollback action', () => {
    const error = createErrorRecord('SyntaxError', 'Unexpected token }');
    const result = agent.remediate(error);

    const rollbackAction = result.actions.find(a => a.type === 'rollback');
    expect(rollbackAction).toBeDefined();
    expect(rollbackAction?.description).toBe('Rollback to last known good version');
    expect(rollbackAction?.automated).toBe(false);
  });

  it('Any error → always includes notify action', () => {
    const errors = [
      createErrorRecord('OutOfMemoryError', 'heap exhausted'),
      createErrorRecord('TypeError', 'type mismatch'),
      createErrorRecord('segfault', 'crash'),
      createErrorRecord('UnknownError', 'something went wrong')
    ];

    errors.forEach(error => {
      const result = agent.remediate(error);
      const notifyAction = result.actions.find(a => a.type === 'notify');
      expect(notifyAction).toBeDefined();
      expect(notifyAction?.automated).toBe(true);
      expect(notifyAction?.description).toContain('Notify on-call');
    });
  });

  it('requiresHumanReview=true when any action has automated=false; false when all automated', () => {
    // Test case with non-automated action (TypeError)
    const typeError = createErrorRecord('TypeError', 'type mismatch');
    const typeErrorResult = agent.remediate(typeError);
    expect(typeErrorResult.requiresHumanReview).toBe(true);

    // Test case with all automated actions (segfault)
    const segfault = createErrorRecord('segfault', 'SIGSEGV');
    const segfaultResult = agent.remediate(segfault);
    expect(segfaultResult.requiresHumanReview).toBe(false);

    // Test case with memory error (all automated)
    const memError = createErrorRecord('OutOfMemoryError', 'heap exhausted');
    const memResult = agent.remediate(memError);
    expect(memResult.requiresHumanReview).toBe(false);

    // Test case with SyntaxError (has non-automated action)
    const syntaxError = createErrorRecord('SyntaxError', 'unexpected token');
    const syntaxResult = agent.remediate(syntaxError);
    expect(syntaxResult.requiresHumanReview).toBe(true);
  });
});
