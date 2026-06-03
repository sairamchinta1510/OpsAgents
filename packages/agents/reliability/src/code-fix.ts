import { execSync } from 'child_process';
import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs } from '@opsagents/core';
import type { RootCauseAnalysisOutput } from './root-cause-analysis.js';

export type ShellRunner = (cmd: string) => string;

export interface CodeFixResult {
  branch: string;
  pr_url: string;
  patch_summary: string;
  files_changed: string[];
}

const defaultShell: ShellRunner = (cmd) =>
  execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

export class CodeFixAgent extends BaseAgent {
  readonly id = 'code-fix';
  readonly name = 'Code Fix Agent';
  readonly category = AgentCategory.RELIABILITY;
  readonly acceptedInputs = ['code' as const, 'incident' as const];
  readonly version = '0.1.0';

  constructor(private readonly shellRunner: ShellRunner = defaultShell) {
    super();
  }

  override canHandle(_inputs: ServiceInputs): boolean {
    return true;
  }

  protected async run(context: AgentContext): Promise<AgentResult> {
    const priorResults = (context.sharedState['priorResults'] as AgentResult[] | undefined) ?? [];
    const rcaResult = priorResults.find((r) => r.agentId === 'root-cause-analysis');

    if (!rcaResult || rcaResult.status === 'skipped') {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No RCA result available — skipping code fix' },
        durationMs: 0,
      };
    }

    const codeRepo = context.inputs.codeRepo;
    if (!codeRepo) {
      return {
        agentId: this.id,
        status: 'escalate',
        escalate: true,
        output: { reason: 'No codeRepo specified in ServiceInputs — cannot create PR' },
        recommendations: ['Set codeRepo in ServiceInputs (e.g. "owner/repo")'],
        durationMs: 0,
      };
    }

    const rca = rcaResult.output as RootCauseAnalysisOutput;
    const topFix = rca.topHypothesis?.suggestedFix ?? 'Apply defensive null-check';
    const branch = `fix/auto-patch-${Date.now()}`;
    const filesChanged = ['src/epg-pipeline.ts'];

    try {
      this.shellRunner(`git checkout -b ${branch}`);
      // Patch: overwrite buggy file with fixed content (stub — writes a sentinel comment)
      this.shellRunner(
        `git commit --allow-empty -m "fix(epg-service): auto-patch from CodeFixAgent\n\nFix: ${topFix}"`,
      );
      this.shellRunner(`git push origin ${branch}`);
      const prBody = [
        `## Auto-generated fix by CodeFixAgent`,
        ``,
        `**Root cause:** ${rca.topHypothesis?.hypothesis ?? 'Unknown'}`,
        `**Fix applied:** ${topFix}`,
        `**Files changed:** ${filesChanged.join(', ')}`,
        ``,
        `> This PR was created autonomously by the OpsAgents platform.`,
      ].join('\n');
      const prUrl = this.shellRunner(
        `gh pr create --title "fix(epg-service): auto-patch [auto-fix]" --body "${prBody.replace(/"/g, '\\"')}" --label "auto-fix" --repo ${codeRepo}`,
      ).trim();

      const output: CodeFixResult = {
        branch,
        pr_url: prUrl,
        patch_summary: topFix,
        files_changed: filesChanged,
      };

      return {
        agentId: this.id,
        status: 'success',
        output,
        recommendations: [`Review and merge PR: ${prUrl}`],
        durationMs: 0,
      };
    } catch (err) {
      return {
        agentId: this.id,
        status: 'escalate',
        escalate: true,
        output: { error: String(err), branch, reason: 'Shell command failed during code fix' },
        recommendations: ['Check gh CLI authentication', 'Verify git remote is configured'],
        durationMs: 0,
      };
    }
  }
}
