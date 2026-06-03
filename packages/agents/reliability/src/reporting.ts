import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, ServiceInputs } from '@opsagents/core';

export interface ReportSection {
  title: string;
  content: string;
}

export interface IncidentReport {
  incidentId: string;
  generatedAt: string;
  serviceId: string;
  sections: ReportSection[];
  json: Record<string, unknown>;
  markdown: string;
}

export class ReportingAgent extends BaseAgent {
  readonly id = 'reporting';
  readonly name = 'Reporting Agent';
  readonly category = AgentCategory.RELIABILITY;
  readonly acceptedInputs = ['incident' as const, 'monitor' as const, 'perf-log' as const, 'code' as const, 'machine-params' as const];
  readonly version = '0.1.0';

  override canHandle(_inputs: ServiceInputs): boolean {
    return true; // always capable of generating a report
  }

  protected async run(context: AgentContext): Promise<AgentResult> {
    const { serviceId, sessionId, inputs } = context;
    const priorResults = (context.sharedState['priorResults'] as AgentResult[] | undefined) ?? [];

    const generatedAt = new Date().toISOString();
    const incidentId = inputs.incident?.alertId ?? `auto-${sessionId.slice(0, 8)}`;

    const sections: ReportSection[] = [];

    // Executive Summary
    const successCount = priorResults.filter((r) => r.status === 'success').length;
    const failureCount = priorResults.filter((r) => r.status === 'failure').length;
    const escalated = priorResults.some((r) => r.escalate);

    sections.push({
      title: 'Executive Summary',
      content: [
        `Service: ${serviceId}`,
        `Incident ID: ${incidentId}`,
        `Generated: ${generatedAt}`,
        `Session: ${sessionId}`,
        `Agent results: ${successCount} success, ${failureCount} failure${escalated ? ' — ESCALATED' : ''}`,
        inputs.incident
          ? `Incident: [${inputs.incident.severity.toUpperCase()}] ${inputs.incident.message}`
          : 'No formal incident recorded',
      ].join('\n'),
    });

    // Agent Results Timeline
    if (priorResults.length > 0) {
      const timeline = priorResults.map((r) =>
        `- ${r.agentId}: ${r.status}${r.escalate ? ' (escalated)' : ''}${r.recommendations?.length ? ` → ${r.recommendations[0]}` : ''}`,
      ).join('\n');
      sections.push({ title: 'Agent Timeline', content: timeline });
    }

    // Recommendations
    const allRecs = priorResults.flatMap((r) => r.recommendations ?? []);
    if (allRecs.length > 0) {
      sections.push({
        title: 'Recommendations',
        content: allRecs.map((r, i) => `${i + 1}. ${r}`).join('\n'),
      });
    }

    // Structured JSON payload
    const json: Record<string, unknown> = {
      incidentId,
      serviceId,
      generatedAt,
      sessionId,
      overallStatus: escalated ? 'escalated' : failureCount > 0 ? 'degraded' : 'resolved',
      agentResults: priorResults.map((r) => ({ agentId: r.agentId, status: r.status, escalated: r.escalate ?? false })),
      recommendations: allRecs,
    };

    // Markdown report
    const markdown = [
      `# Incident Report: ${incidentId}`,
      `**Service:** ${serviceId}  `,
      `**Generated:** ${generatedAt}  `,
      `**Status:** ${escalated ? '🔴 ESCALATED' : failureCount > 0 ? '🟡 DEGRADED' : '🟢 RESOLVED'}`,
      '',
      ...sections.map((s) => [`## ${s.title}`, '', s.content, ''].join('\n')),
    ].join('\n');

    const report: IncidentReport = {
      incidentId,
      generatedAt,
      serviceId,
      sections,
      json,
      markdown,
    };

    return {
      agentId: this.id,
      status: 'success',
      output: report,
      recommendations: ['Store report in audit log', 'Share with stakeholders via #incident-response'],
      durationMs: 0,
    };
  }
}
