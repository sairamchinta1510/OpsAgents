import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, IncidentInput } from '@opsagents/core';

export type EscalationChannel = 'email' | 'slack' | 'pagerduty' | 'none';

export interface EscalationAction {
  channel: EscalationChannel;
  target: string;
  message: string;
  sent: boolean;
}

export interface EscalationOutput {
  escalated: boolean;
  actions: EscalationAction[];
  slaBreached: boolean;
  summary: string;
}

/** SLA thresholds (ms) per severity before human escalation is required */
const SLA_THRESHOLDS_MS: Record<string, number> = {
  critical: 5 * 60 * 1_000,   // 5 minutes
  high: 15 * 60 * 1_000,      // 15 minutes
  medium: 60 * 60 * 1_000,    // 1 hour
  low: 4 * 60 * 60 * 1_000,   // 4 hours
};

export class EscalationAgent extends BaseAgent {
  readonly id = 'escalation';
  readonly name = 'Escalation Agent';
  readonly category = AgentCategory.RELIABILITY;
  readonly acceptedInputs = ['incident' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const incident = context.inputs.incident as IncidentInput | undefined;

    if (!incident) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No incident data — nothing to escalate' },
        durationMs: 0,
      };
    }

    const ageMs = Date.now() - incident.timestamp;
    const slaMs = SLA_THRESHOLDS_MS[incident.severity] ?? SLA_THRESHOLDS_MS['medium'];
    const slaBreached = ageMs > slaMs;

    const mustEscalate = incident.severity === 'critical' || incident.severity === 'high' || slaBreached;

    const actions: EscalationAction[] = [];

    if (mustEscalate) {
      // PagerDuty stub for critical/high
      if (incident.severity === 'critical' || incident.severity === 'high') {
        actions.push({
          channel: 'pagerduty',
          target: 'oncall-rotation',
          message: `[${incident.severity.toUpperCase()}] ${incident.message} (Alert: ${incident.alertId})`,
          sent: true, // stub — would call PagerDuty API
        });
      }

      // Slack stub for all escalations
      actions.push({
        channel: 'slack',
        target: '#incident-response',
        message: `🚨 Incident escalated: ${incident.message} | Severity: ${incident.severity} | Source: ${incident.source}`,
        sent: true, // stub — would call Slack webhook
      });

      // Email stub if SLA breached
      if (slaBreached) {
        actions.push({
          channel: 'email',
          target: 'ops-team@company.com',
          message: `SLA BREACHED for incident ${incident.alertId}. Unresolved for ${Math.round(ageMs / 60_000)}min (SLA: ${Math.round(slaMs / 60_000)}min).`,
          sent: true, // stub — would call email API
        });
      }
    }

    const output: EscalationOutput = {
      escalated: mustEscalate,
      actions,
      slaBreached,
      summary: mustEscalate
        ? `Escalated via ${actions.map((a) => a.channel).join(', ')} — ${slaBreached ? 'SLA BREACHED' : 'within SLA'}`
        : 'No escalation required',
    };

    return {
      agentId: this.id,
      status: 'success',
      output,
      recommendations: mustEscalate ? ['Monitor incident channel for response', 'Update incident status in runbook'] : [],
      durationMs: 0,
    };
  }
}
