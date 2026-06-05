import fs from 'fs';
import path from 'path';
import { ErrorRecord } from '@opsagents/core';

export type ErrorCallback = (error: ErrorRecord) => void;

export class LogWatcher {
  private watchers: Map<string, NodeJS.Timeout> = new Map();
  private positions: Map<string, number> = new Map();
  private language: string;
  private onError: ErrorCallback;
  private intervalMs: number;

  constructor(language: string, onError: ErrorCallback, intervalMs = 500) {
    this.language = language;
    this.onError = onError;
    this.intervalMs = intervalMs;
  }

  startWatching(logPaths: string[]): void {
    for (const logPath of logPaths) {
      if (this.watchers.has(logPath)) continue;
      const stat = fs.existsSync(logPath) ? fs.statSync(logPath) : null;
      this.positions.set(logPath, stat?.size ?? 0);

      const timer = setInterval(() => {
        this.pollFile(logPath);
      }, this.intervalMs);

      this.watchers.set(logPath, timer);
    }
  }

  stopWatching(): void {
    for (const [, timer] of this.watchers) {
      clearInterval(timer);
    }
    this.watchers.clear();
    this.positions.clear();
  }

  private pollFile(logPath: string): void {
    if (!fs.existsSync(logPath)) return;
    const stat = fs.statSync(logPath);
    const pos = this.positions.get(logPath) ?? 0;
    if (stat.size <= pos) return;

    const fd = fs.openSync(logPath, 'r');
    const buf = Buffer.alloc(stat.size - pos);
    fs.readSync(fd, buf, 0, buf.length, pos);
    fs.closeSync(fd);
    this.positions.set(logPath, stat.size);

    const newText = buf.toString('utf8');
    const errors = this.parseErrors(newText, logPath);
    for (const err of errors) {
      this.onError(err);
    }
  }

  parseErrors(text: string, logFile: string): ErrorRecord[] {
    const results: ErrorRecord[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const record = this.parseLine(line, lines, i, logFile);
      if (record) {
        results.push(record);
        // skip lines consumed as stack trace
        i += record.stackTrace.length;
      }
    }
    return results;
  }

  private parseLine(line: string, allLines: string[], idx: number, logFile: string): ErrorRecord | null {
    // TypeScript / Node.js error patterns
    if (this.language === 'typescript' || this.language === 'unknown') {
      const tsMatch = line.match(/(?:ERROR|Error|Uncaught)\s+(\w*Error|\w*Exception|TypeError|ReferenceError|SyntaxError|RangeError):\s+(.+)/);
      if (tsMatch) {
        const stackTrace = this.collectStackTrace(allLines, idx + 1, /^\s+at\s/);
        const fileRef = this.extractFileRef(stackTrace);
        return {
          ts: Date.now(),
          errorType: tsMatch[1],
          message: tsMatch[2].trim(),
          file: fileRef?.file,
          line: fileRef?.line,
          column: fileRef?.column,
          stackTrace,
          logFile,
          language: 'typescript'
        };
      }
    }

    // Java / JVM patterns
    if (this.language === 'java' || this.language === 'unknown') {
      const javaMatch = line.match(/Exception in thread|(\w+\.)+(\w*Exception|\w*Error):\s+(.+)/);
      if (javaMatch) {
        const stackTrace = this.collectStackTrace(allLines, idx + 1, /^\s+at\s/);
        const excName = line.match(/(\w*Exception|\w*Error)/)?.[0] ?? 'Exception';
        return {
          ts: Date.now(),
          errorType: excName,
          message: line.split(':').slice(1).join(':').trim() || line.trim(),
          stackTrace,
          logFile,
          language: 'java'
        };
      }
    }

    // Python patterns
    if (this.language === 'python' || this.language === 'unknown') {
      const pyMatch = line.match(/^(\w+Error|\w+Exception|Traceback):/);
      if (pyMatch) {
        const stackTrace = this.collectStackTrace(allLines, idx + 1, /^\s+File\s/);
        return {
          ts: Date.now(),
          errorType: pyMatch[1],
          message: line.split(':').slice(1).join(':').trim(),
          stackTrace,
          logFile,
          language: 'python'
        };
      }
    }

    // C / segfault patterns
    if (this.language === 'c' || this.language === 'unknown') {
      if (/Segmentation fault|segfault|SIGSEGV|Aborted/.test(line)) {
        return {
          ts: Date.now(),
          errorType: 'segfault',
          message: line.trim(),
          stackTrace: [],
          logFile,
          language: 'c'
        };
      }
    }

    return null;
  }

  private collectStackTrace(lines: string[], startIdx: number, pattern: RegExp): string[] {
    const stack: string[] = [];
    for (let i = startIdx; i < lines.length && i < startIdx + 30; i++) {
      if (pattern.test(lines[i])) {
        // Skip framework frames
        if (/node_modules|java\.|sun\.|jdk\.|<anonymous>|internal\/|dist\//.test(lines[i])) continue;
        stack.push(lines[i].trim());
      } else {
        break;
      }
    }
    return stack;
  }

  private extractFileRef(stackTrace: string[]): { file: string; line?: number; column?: number } | null {
    if (!stackTrace.length) return null;
    // TypeScript: "at functionName (file.ts:10:5)"
    const match = stackTrace[0].match(/\((.+):(\d+):(\d+)\)$/) ?? stackTrace[0].match(/\((.+):(\d+)\)$/);
    if (!match) return null;
    return {
      file: match[1],
      line: parseInt(match[2], 10),
      column: match[3] ? parseInt(match[3], 10) : undefined
    };
  }
}
