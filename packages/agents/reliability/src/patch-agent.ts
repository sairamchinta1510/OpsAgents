import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { ErrorRecord } from '@opsagents/core';

export interface PatchResult {
  success: boolean;
  patchedFile?: string;           // absolute path
  diff?: string;                  // unified diff string
  branchName?: string;
  prUrl?: string;
  error?: string;
}

export interface PatchInput {
  errorRecord: ErrorRecord;
  cloneDir: string;
  repoUrl: string;               // for git remote
  originalContent: string;       // full file content before patch
  patchedContent: string;        // full file content after patch
  targetFile: string;            // absolute path of file to patch
}

export class PatchAgent {
  private shellRunner: (cmd: string, cwd: string) => string;

  constructor(shellRunner?: (cmd: string, cwd: string) => string) {
    this.shellRunner = shellRunner ?? ((cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8' }));
  }

  applyPatch(input: PatchInput): PatchResult {
    try {
      // 1. Write patched content to disk
      fs.writeFileSync(input.targetFile, input.patchedContent, 'utf8');

      // 2. Compute unified diff (inline using diffLines)
      const diff = this.computeDiff(input.originalContent, input.patchedContent, input.targetFile);

      // 3. Create a new branch
      const branchName = `fix/auto-patch-${Date.now()}`;
      this.shellRunner(`git checkout -b ${branchName}`, input.cloneDir);

      // 4. Stage + commit
      const relPath = path.relative(input.cloneDir, input.targetFile);
      this.shellRunner(`git add "${relPath}"`, input.cloneDir);
      const commitMsg = `fix(auto): patch ${input.errorRecord.errorType} in ${path.basename(input.targetFile)}`;
      this.shellRunner(`git commit -m "${commitMsg}"`, input.cloneDir);

      // 5. Push branch
      try {
        this.shellRunner(`git push origin ${branchName}`, input.cloneDir);
      } catch {
        // non-fatal if push fails (no network, etc.)
      }

      return { success: true, patchedFile: input.targetFile, diff, branchName };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  generatePatch(errorRecord: ErrorRecord, sourceContent: string): string {
    // Language-specific patch generation heuristics
    if (errorRecord.language === 'typescript') {
      return this.patchTypeScript(errorRecord, sourceContent);
    }
    if (errorRecord.language === 'java') {
      return this.patchJava(errorRecord, sourceContent);
    }
    if (errorRecord.language === 'python') {
      return this.patchPython(errorRecord, sourceContent);
    }
    return sourceContent; // fallback: no change
  }

  private patchTypeScript(error: ErrorRecord, source: string): string {
    const lines = source.split('\n');

    // TypeError: Cannot read properties of undefined/null
    if (error.errorType === 'TypeError' && /Cannot read propert/.test(error.message)) {
      // Insert null-guard at the offending line
      const targetLine = (error.line ?? 1) - 1;
      if (targetLine >= 0 && targetLine < lines.length) {
        const indent = lines[targetLine].match(/^(\s*)/)?.[1] ?? '';
        const prop = error.message.match(/reading '(\w+)'/)?.[1];
        if (prop) {
          lines.splice(targetLine, 0, `${indent}if (!${prop}) return;  // auto-guard`);
        }
      }
    }

    // ReferenceError: X is not defined → add declaration
    if (error.errorType === 'ReferenceError' && /is not defined/.test(error.message)) {
      const varName = error.message.split(' ')[0];
      const targetLine = (error.line ?? 1) - 1;
      if (targetLine >= 0 && targetLine < lines.length) {
        const indent = lines[targetLine].match(/^(\s*)/)?.[1] ?? '';
        lines.splice(targetLine, 0, `${indent}let ${varName}: unknown;  // auto-declared`);
      }
    }

    return lines.join('\n');
  }

  private patchJava(error: ErrorRecord, source: string): string {
    const lines = source.split('\n');

    // NullPointerException → add null check
    if (error.errorType === 'NullPointerException') {
      const targetLine = (error.line ?? 1) - 1;
      if (targetLine >= 0 && targetLine < lines.length) {
        const indent = lines[targetLine].match(/^(\s*)/)?.[1] ?? '';
        lines.splice(targetLine, 0, `${indent}// TODO(auto): add null check here`);
      }
    }

    return lines.join('\n');
  }

  private patchPython(error: ErrorRecord, source: string): string {
    const lines = source.split('\n');

    // ValueError / TypeError → wrap in try/except
    if (/ValueError|TypeError/.test(error.errorType)) {
      const targetLine = (error.line ?? 1) - 1;
      if (targetLine >= 0 && targetLine < lines.length) {
        const indent = lines[targetLine].match(/^(\s*)/)?.[1] ?? '';
        lines.splice(targetLine, 0, `${indent}# TODO(auto): add input validation`);
      }
    }

    return lines.join('\n');
  }

  computeDiff(original: string, patched: string, filePath: string): string {
    const origLines = original.split('\n');
    const patchedLines = patched.split('\n');
    const fileName = path.basename(filePath);
    const diffLines: string[] = [
      `--- a/${fileName}`,
      `+++ b/${fileName}`,
    ];
    let changed = false;
    for (let i = 0; i < Math.max(origLines.length, patchedLines.length); i++) {
      const o = origLines[i];
      const p = patchedLines[i];
      if (o !== p) {
        changed = true;
        if (o !== undefined) diffLines.push(`-${o}`);
        if (p !== undefined) diffLines.push(`+${p}`);
      }
    }
    if (!changed) diffLines.push(' (no changes)');
    return diffLines.join('\n');
  }
}
