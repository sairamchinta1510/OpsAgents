import type { ErrorRecord } from '@opsagents/core';

export interface RemediationAction {
  type: 'config-change' | 'restart' | 'scale-up' | 'rollback' | 'notify' | 'code-fix';
  description: string;
  details: Record<string, unknown>;
  automated: boolean;  // can be applied without human review
}

export interface RemediationResult {
  errorRecord: ErrorRecord;
  actions: RemediationAction[];
  requiresHumanReview: boolean;
  summary: string;
}

export class AutoRemediationAgent {
  remediate(errorRecord: ErrorRecord): RemediationResult {
    const actions = this.selectActions(errorRecord);
    const requiresHumanReview = actions.some(a => !a.automated);
    const summary = this.buildSummary(errorRecord, actions);
    return { errorRecord, actions, requiresHumanReview, summary };
  }

  private selectActions(error: ErrorRecord): RemediationAction[] {
    const actions: RemediationAction[] = [];

    // Memory / heap errors → scale up + notify
    if (/OutOfMemoryError|heap|ENOMEM/.test(error.message) || /OutOfMemory/.test(error.errorType)) {
      actions.push({
        type: 'scale-up',
        description: 'Increase memory allocation',
        details: { reason: error.message },
        automated: true
      });
    }

    // Segfault / crash → restart
    if (error.errorType === 'segfault' || /SIGSEGV|Aborted|Segmentation fault/.test(error.message)) {
      actions.push({
        type: 'restart',
        description: 'Restart service after crash',
        details: { reason: error.errorType },
        automated: true
      });
    }

    // NullPointerException / TypeError → code-fix (needs review)
    if (/NullPointer|TypeError|ReferenceError/.test(error.errorType)) {
      actions.push({
        type: 'code-fix',
        description: `Apply auto-patch for ${error.errorType}`,
        details: { errorType: error.errorType, file: error.file, line: error.line },
        automated: false  // requires human review (diff shown in UI)
      });
    }

    // Config errors → config-change
    if (/ConfigError|ENOENT|ECONNREFUSED|EADDRINUSE/.test(error.message) ||
        /ConfigError/.test(error.errorType)) {
      actions.push({
        type: 'config-change',
        description: 'Update configuration to fix connection/path error',
        details: { error: error.message },
        automated: false
      });
    }

    // SyntaxError → rollback
    if (error.errorType === 'SyntaxError') {
      actions.push({
        type: 'rollback',
        description: 'Rollback to last known good version',
        details: { reason: 'SyntaxError suggests bad deployment' },
        automated: false
      });
    }

    // Always add notify for any error
    actions.push({
      type: 'notify',
      description: `Notify on-call: ${error.errorType} in ${error.logFile}`,
      details: { message: error.message, ts: error.ts },
      automated: true
    });

    return actions;
  }

  private buildSummary(error: ErrorRecord, actions: RemediationAction[]): string {
    const automated = actions.filter(a => a.automated).length;
    const manual = actions.filter(a => !a.automated).length;
    return `${error.errorType}: ${actions.length} action(s) — ${automated} automated, ${manual} require review`;
  }
}
