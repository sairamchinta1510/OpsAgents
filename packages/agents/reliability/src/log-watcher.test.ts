import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LogWatcher } from './log-watcher.js';
import type { ErrorRecord } from '@opsagents/core';
import fs from 'fs';

describe('LogWatcher', () => {
  describe('parseErrors', () => {
    it('detects TypeScript TypeError and extracts file/line from stack', () => {
      const watcher = new LogWatcher('typescript', () => {});
      const logText = `
[2024-01-15 10:30:45] INFO Starting app
[2024-01-15 10:30:46] ERROR TypeError: Cannot read property 'name' of undefined
    at getUserName (/home/app/src/user.ts:42:15)
    at processUser (/home/app/src/handler.ts:18:9)
[2024-01-15 10:30:47] INFO Recovery attempt
`.trim();

      const errors = watcher.parseErrors(logText, '/var/log/app.log');

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        errorType: 'TypeError',
        message: "Cannot read property 'name' of undefined",
        file: '/home/app/src/user.ts',
        line: 42,
        column: 15,
        logFile: '/var/log/app.log',
        language: 'typescript'
      });
      expect(errors[0].stackTrace).toHaveLength(2);
      expect(errors[0].stackTrace[0]).toContain('getUserName');
      expect(errors[0].stackTrace[1]).toContain('processUser');
      expect(errors[0].ts).toBeGreaterThan(0);
    });

    it('detects Java NullPointerException', () => {
      const watcher = new LogWatcher('java', () => {});
      const logText = `
2024-01-15 10:30:45 INFO [main] Application started
java.lang.NullPointerException: Cannot invoke method on null object
    at com.example.UserService.getUser(UserService.java:45)
    at com.example.Handler.process(Handler.java:22)
2024-01-15 10:30:46 WARN Recovery initiated
`.trim();

      const errors = watcher.parseErrors(logText, '/var/log/service.log');

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        errorType: 'NullPointerException',
        message: 'Cannot invoke method on null object',
        logFile: '/var/log/service.log',
        language: 'java'
      });
      expect(errors[0].stackTrace).toHaveLength(2);
      expect(errors[0].stackTrace[0]).toContain('UserService.getUser');
      expect(errors[0].stackTrace[1]).toContain('Handler.process');
    });

    it('detects Python ValueError', () => {
      const watcher = new LogWatcher('python', () => {});
      const logText = `
2024-01-15 10:30:45 - INFO - Starting process
ValueError: invalid literal for int() with base 10: 'abc'
  File "/home/app/main.py", line 42, in parse_input
  File "/home/app/handler.py", line 18, in process
2024-01-15 10:30:46 - ERROR - Process failed
`.trim();

      const errors = watcher.parseErrors(logText, '/var/log/python.log');

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        errorType: 'ValueError',
        message: "invalid literal for int() with base 10: 'abc'",
        logFile: '/var/log/python.log',
        language: 'python'
      });
      expect(errors[0].stackTrace).toHaveLength(2);
      expect(errors[0].stackTrace[0]).toContain('main.py');
      expect(errors[0].stackTrace[1]).toContain('handler.py');
    });

    it('detects C Segmentation fault', () => {
      const watcher = new LogWatcher('c', () => {});
      const logText = `
[2024-01-15 10:30:45] Starting memory operation
[2024-01-15 10:30:46] Segmentation fault (core dumped)
[2024-01-15 10:30:47] Process terminated
`.trim();

      const errors = watcher.parseErrors(logText, '/var/log/app.log');

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        errorType: 'segfault',
        message: '[2024-01-15 10:30:46] Segmentation fault (core dumped)',
        logFile: '/var/log/app.log',
        language: 'c',
        stackTrace: []
      });
    });

    it('returns empty array for lines with no errors', () => {
      const watcher = new LogWatcher('typescript', () => {});
      const logText = `
[2024-01-15 10:30:45] INFO Starting application
[2024-01-15 10:30:46] INFO Processing request 123
[2024-01-15 10:30:47] INFO Request completed successfully
[2024-01-15 10:30:48] DEBUG Cache hit for key: user:456
`.trim();

      const errors = watcher.parseErrors(logText, '/var/log/app.log');

      expect(errors).toHaveLength(0);
    });

    it('filters out node_modules frames from stack trace', () => {
      const watcher = new LogWatcher('typescript', () => {});
      const logText = `
ERROR TypeError: Cannot read property 'id' of null
    at getUserId (/home/app/src/user.ts:10:5)
    at /home/app/node_modules/express/lib/router.js:635:15
    at processRequest (/home/app/src/handler.ts:25:8)
    at /home/app/node_modules/express/lib/application.js:178:3
    at finalHandler (/home/app/src/middleware.ts:42:10)
`.trim();

      const errors = watcher.parseErrors(logText, '/var/log/app.log');

      expect(errors).toHaveLength(1);
      // Should have 3 frames, all node_modules frames filtered out
      expect(errors[0].stackTrace).toHaveLength(3);
      expect(errors[0].stackTrace[0]).toContain('getUserId');
      expect(errors[0].stackTrace[1]).toContain('processRequest');
      expect(errors[0].stackTrace[2]).toContain('finalHandler');
      // Verify no node_modules frames present
      errors[0].stackTrace.forEach(frame => {
        expect(frame).not.toContain('node_modules');
      });
    });
  });

  describe('startWatching and stopWatching with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(fs, 'existsSync');
      vi.spyOn(fs, 'statSync');
      vi.spyOn(fs, 'openSync');
      vi.spyOn(fs, 'readSync');
      vi.spyOn(fs, 'closeSync');
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('sets up interval and calls pollFile after tick', () => {
      const errorCallback = vi.fn();
      const watcher = new LogWatcher('typescript', errorCallback, 500);
      const logPath = '/var/log/app.log';

      // Mock file exists and has initial size
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as fs.Stats);

      watcher.startWatching([logPath]);

      // Initially no errors detected (no polling yet)
      expect(errorCallback).not.toHaveBeenCalled();

      // Mock new content after 500ms
      vi.mocked(fs.statSync).mockReturnValue({ size: 200 } as fs.Stats);
      vi.mocked(fs.openSync).mockReturnValue(3);
      vi.mocked(fs.readSync).mockImplementation((fd, buffer) => {
        const content = Buffer.from('ERROR TypeError: test error\n    at test (/app/src/test.ts:10:5)\n');
        content.copy(buffer as Buffer);
        return content.length;
      });
      vi.mocked(fs.closeSync).mockImplementation(() => {});

      // Advance timer by 500ms
      vi.advanceTimersByTime(500);

      // Now pollFile should have been called and error detected
      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'TypeError',
          message: 'test error',
          file: '/app/src/test.ts',
          line: 10,
          column: 5
        })
      );

      // Cleanup
      watcher.stopWatching();
    });

    it('stopWatching clears all intervals', () => {
      const errorCallback = vi.fn();
      const watcher = new LogWatcher('typescript', errorCallback, 500);
      const logPaths = ['/var/log/app1.log', '/var/log/app2.log', '/var/log/app3.log'];

      // Mock file exists
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as fs.Stats);

      watcher.startWatching(logPaths);

      // Stop watching
      watcher.stopWatching();

      // Mock new content appearing
      vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as fs.Stats);
      vi.mocked(fs.openSync).mockReturnValue(3);
      vi.mocked(fs.readSync).mockImplementation((fd, buffer) => {
        const content = Buffer.from('ERROR TypeError: test\n');
        content.copy(buffer as Buffer);
        return content.length;
      });

      // Advance timer - should NOT trigger any callbacks
      vi.advanceTimersByTime(1000);

      expect(errorCallback).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles unknown language with fallback detection', () => {
      const watcher = new LogWatcher('unknown', () => {});
      const logText = `
ERROR ReferenceError: x is not defined
    at main (/app/index.ts:5:1)
`.trim();

      const errors = watcher.parseErrors(logText, '/var/log/app.log');

      expect(errors).toHaveLength(1);
      expect(errors[0].language).toBe('typescript');
    });

    it('handles multiple errors in same log', () => {
      const watcher = new LogWatcher('typescript', () => {});
      const logText = `
ERROR TypeError: First error
    at funcA (/app/a.ts:10:5)
INFO Some log entry
ERROR ReferenceError: Second error
    at funcB (/app/b.ts:20:8)
`.trim();

      const errors = watcher.parseErrors(logText, '/var/log/app.log');

      expect(errors).toHaveLength(2);
      expect(errors[0].errorType).toBe('TypeError');
      expect(errors[0].message).toBe('First error');
      expect(errors[1].errorType).toBe('ReferenceError');
      expect(errors[1].message).toBe('Second error');
    });
  });
});
