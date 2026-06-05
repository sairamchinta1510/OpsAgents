import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs } from '@opsagents/core';

interface ExecCommsOutput {
  slack_payload: object;
  executive_email: string;
  dashboard_summary: object;
  outputDir: string;
}

export class ExecutiveCommunicationAgent extends BaseAgent {
  readonly id = 'executive-communication';
  readonly name = 'Executive Communication Agent';
  readonly category = AgentCategory.RELIABILITY;
  readonly acceptedInputs = ['incident' as const, 'monitor' as const];
  readonly version = '0.1.0';

  override canHandle(_inputs: ServiceInputs): boolean {
    return true;
  }

  protected async run(context: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const outputDir = (context.sharedState['outputDir'] as string) ?? 'dist/exec-comms';

    const allResults = (context.sharedState['priorResults'] as AgentResult[] | undefined) ?? [];
    const rcaResult = allResults.find(r => r.agentId === 'root-cause-analysis');
    const codeFixResult = allResults.find(r => r.agentId === 'code-fix');

    const topHypothesis = (rcaResult?.output as any)?.topHypothesis;
    const rootCause = topHypothesis?.hypothesis ?? 'Under investigation';
    const topHypothesisConfidence = topHypothesis?.confidence ?? 'low';
    const prUrl = (codeFixResult?.output as any)?.pr_url ?? null;
    const affectedServices = context.inputs.serviceId ?? 'unknown';

    const slackPayload = {
      text: `🚨 *Incident Summary* — ${affectedServices}`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `*Root Cause:* ${rootCause}` } },
        { type: 'section', text: { type: 'mrkdwn', text: prUrl ? `*Auto-fix PR:* ${prUrl}` : '*Auto-fix:* Not available' } },
      ],
    };

    const executiveEmail = [
      `# Incident Executive Summary`,
      ``,
      `**Service:** ${affectedServices}`,
      `**Root Cause:** ${rootCause}`,
      `**Auto-fix PR:** ${prUrl ?? 'N/A'}`,
      ``,
      `## Activities`,
      allResults.map(r => `- ${r.agentId}: ${r?.status ?? 'unknown'}`).join('\n'),
    ].join('\n');

    const customerImpactMap: Record<string, string> = {
      high: 'Critical - Immediate action required',
      medium: 'Moderate - Customers affected',
      low: 'Minimal - Limited customer impact',
    };
    const customerImpact = customerImpactMap[topHypothesisConfidence] ?? 'Unknown';

    const dashboardSummary = {
      service: affectedServices,
      rootCause,
      prUrl,
      customerImpact,
      agentResults: Object.fromEntries(
        allResults.map(r => [r.agentId, r?.status ?? 'unknown']),
      ),
      timestamp: new Date().toISOString(),
    };

    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'slack_payload.json'), JSON.stringify(slackPayload, null, 2));
    await writeFile(join(outputDir, 'executive-email.md'), executiveEmail);
    await writeFile(join(outputDir, 'dashboard-summary.json'), JSON.stringify(dashboardSummary, null, 2));

    const output: ExecCommsOutput = {
      slack_payload: slackPayload,
      executive_email: executiveEmail,
      dashboard_summary: dashboardSummary,
      outputDir,
    };

    return {
      agentId: this.id,
      status: 'success',
      output,
      durationMs: Date.now() - start,
    };
  }
}
