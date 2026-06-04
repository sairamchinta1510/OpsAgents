import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { PatchAgent } from './patch-agent.js';
import type { PatchInput } from './patch-agent.js';
import type { ErrorRecord } from '@opsagents/core';

// Mock fs module
vi.mock('fs');

describe('PatchAgent', () => {
  let agent: PatchAgent;
  let mockShellRunner: ReturnType<typeof vi.fn<[string, string], string>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockShellRunner = vi.fn<[string, string], string>();
    agent = new PatchAgent(mockShellRunner);
  });

  describe('generatePatch - TypeScript', () => {
    it('inserts null-guard for TypeError "Cannot read properties"', () => {
      const error: ErrorRecord = {
        ts: Date.now(),
        errorType: 'TypeError',
        message: "Cannot read properties of undefined (reading 'foo')",
        line: 5,
        stackTrace: [],
        logFile: '/logs/app.log',
        language: 'typescript',
      };
      const source = 'function test() {\n  const x = obj.foo;\n  return x;\n}\n';
      
      const patched = agent.generatePatch(error, source);
      
      expect(patched).toContain('if (!foo) return;  // auto-guard');
      expect(patched.split('\n').length).toBeGreaterThan(source.split('\n').length);
    });

    it('inserts declaration for ReferenceError "is not defined"', () => {
      const error: ErrorRecord = {
        ts: Date.now(),
        errorType: 'ReferenceError',
        message: 'myVar is not defined',
        line: 3,
        stackTrace: [],
        logFile: '/logs/app.log',
        language: 'typescript',
      };
      const source = 'function test() {\n  console.log(myVar);\n}\n';
      
      const patched = agent.generatePatch(error, source);
      
      expect(patched).toContain('let myVar: unknown;  // auto-declared');
      expect(patched.split('\n').length).toBeGreaterThan(source.split('\n').length);
    });
  });

  describe('generatePatch - Java', () => {
    it('inserts null check comment for NullPointerException', () => {
      const error: ErrorRecord = {
        ts: Date.now(),
        errorType: 'NullPointerException',
        message: 'null pointer exception at line 3',
        line: 3,
        stackTrace: [],
        logFile: '/logs/app.log',
        language: 'java',
      };
      const source = 'public class Test {\n  void method() {\n    obj.doSomething();\n  }\n}\n';
      
      const patched = agent.generatePatch(error, source);
      
      expect(patched).toContain('// TODO(auto): add null check here');
    });
  });

  describe('generatePatch - Python', () => {
    it('inserts validation comment for ValueError', () => {
      const error: ErrorRecord = {
        ts: Date.now(),
        errorType: 'ValueError',
        message: 'invalid literal for int()',
        line: 4,
        stackTrace: [],
        logFile: '/logs/app.log',
        language: 'python',
      };
      const source = 'def test():\n  x = int(value)\n  return x\n';
      
      const patched = agent.generatePatch(error, source);
      
      expect(patched).toContain('# TODO(auto): add input validation');
    });
  });

  describe('generatePatch - Unknown language', () => {
    it('returns unchanged source for unknown language', () => {
      const error: ErrorRecord = {
        ts: Date.now(),
        errorType: 'SomeError',
        message: 'some error',
        stackTrace: [],
        logFile: '/logs/app.log',
        language: 'rust',
      };
      const source = 'fn main() { println!("test"); }';
      
      const patched = agent.generatePatch(error, source);
      
      expect(patched).toBe(source);
    });
  });

  describe('applyPatch', () => {
    it('calls git checkout -b, git add, git commit in order', () => {
      const input: PatchInput = {
        errorRecord: {
          ts: Date.now(),
          errorType: 'TypeError',
          message: 'test error',
          stackTrace: [],
          logFile: '/logs/app.log',
          language: 'typescript',
        },
        cloneDir: 'C:\\Users\\schinta\\repo',
        repoUrl: 'https://github.com/test/repo',
        originalContent: 'const x = 1;',
        patchedContent: 'const x = 2;',
        targetFile: 'C:\\Users\\schinta\\repo\\src\\file.ts',
      };

      mockShellRunner.mockReturnValue('');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = agent.applyPatch(input);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(input.targetFile, input.patchedContent, 'utf8');
      
      // Verify git commands were called in order
      const calls = mockShellRunner.mock.calls;
      expect(calls[0][0]).toMatch(/^git checkout -b fix\/auto-patch-\d+$/);
      expect(calls[0][1]).toBe(input.cloneDir);
      
      expect(calls[1][0]).toContain('git add');
      expect(calls[1][1]).toBe(input.cloneDir);
      
      expect(calls[2][0]).toContain('git commit -m');
      expect(calls[2][1]).toBe(input.cloneDir);
    });

    it('returns success: false when shellRunner throws', () => {
      const input: PatchInput = {
        errorRecord: {
          ts: Date.now(),
          errorType: 'TypeError',
          message: 'test error',
          stackTrace: [],
          logFile: '/logs/app.log',
          language: 'typescript',
        },
        cloneDir: 'C:\\Users\\schinta\\repo',
        repoUrl: 'https://github.com/test/repo',
        originalContent: 'const x = 1;',
        patchedContent: 'const x = 2;',
        targetFile: 'C:\\Users\\schinta\\repo\\src\\file.ts',
      };

      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = agent.applyPatch(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Error');
    });
  });

  describe('computeDiff', () => {
    it('returns diff string with --- and +++ headers', () => {
      const error: ErrorRecord = {
        ts: Date.now(),
        errorType: 'TypeError',
        message: 'test error',
        stackTrace: [],
        logFile: '/logs/app.log',
        language: 'typescript',
      };
      const original = 'line1\nline2\nline3';
      const patched = 'line1\nline2-modified\nline3';
      
      const input: PatchInput = {
        errorRecord: error,
        cloneDir: 'C:\\Users\\schinta\\repo',
        repoUrl: 'https://github.com/test/repo',
        originalContent: original,
        patchedContent: patched,
        targetFile: 'C:\\Users\\schinta\\repo\\src\\test.ts',
      };

      mockShellRunner.mockReturnValue('');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = agent.applyPatch(input);

      expect(result.success).toBe(true);
      expect(result.diff).toContain('--- a/test.ts');
      expect(result.diff).toContain('+++ b/test.ts');
      expect(result.diff).toContain('-line2');
      expect(result.diff).toContain('+line2-modified');
    });
  });
});
