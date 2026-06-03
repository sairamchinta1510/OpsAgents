import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, MachineParamsInput } from '@opsagents/core';

const MIN_NODE_COUNT_FOR_HA = 2;

export interface RedundancyCheck {
  name: string;
  status: 'active' | 'degraded' | 'unavailable';
  message: string;
}

export interface SpareTierOutput {
  drReady: boolean;
  checks: RedundancyCheck[];
  nodeCount: number;
  summary: string;
}

export class SpareTierRedundancyAgent extends BaseAgent {
  readonly id = 'spare-tier-redundancy';
  readonly name = 'Spare Tier & Redundancy Validation Agent';
  readonly category = AgentCategory.RELIABILITY;
  readonly acceptedInputs = ['machine-params' as const];
  readonly version = '0.1.0';

  protected async run(context: AgentContext): Promise<AgentResult> {
    const machineParams = context.inputs.machineParams as MachineParamsInput | undefined;

    if (!machineParams) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No machineParams data' },
        durationMs: 0,
      };
    }

    const nodeCount = machineParams.nodeCount ?? 1;
    const checks: RedundancyCheck[] = [];

    // Node HA check
    checks.push({
      name: 'node-ha',
      status: nodeCount >= MIN_NODE_COUNT_FOR_HA ? 'active' : 'unavailable',
      message: nodeCount >= MIN_NODE_COUNT_FOR_HA
        ? `${nodeCount} nodes active — HA configuration confirmed`
        : `Only ${nodeCount} node(s) — no HA, failover path unavailable`,
    });

    // Multi-AZ check (inferred from machineParams.availabilityZone being set)
    const hasAz = !!machineParams.availabilityZone;
    checks.push({
      name: 'multi-az',
      status: hasAz ? 'active' : 'degraded',
      message: hasAz
        ? `Availability zone declared: ${machineParams.availabilityZone}`
        : 'No availability zone specified — single-AZ deployment assumed',
    });

    // Spare capacity check (low CPU means spare headroom exists)
    const hasSpareCpu = machineParams.cpuPercent < 60;
    checks.push({
      name: 'spare-compute-capacity',
      status: hasSpareCpu ? 'active' : 'degraded',
      message: hasSpareCpu
        ? `CPU at ${machineParams.cpuPercent}% — spare capacity available`
        : `CPU at ${machineParams.cpuPercent}% — insufficient spare capacity for failover traffic`,
    });

    const hasUnavailable = checks.some((c) => c.status === 'unavailable');
    const hasDegraded = checks.some((c) => c.status === 'degraded');
    const drReady = !hasUnavailable;

    const output: SpareTierOutput = {
      drReady,
      checks,
      nodeCount,
      summary: drReady
        ? `Failover paths validated (${checks.filter((c) => c.status === 'active').length}/${checks.length} checks active)`
        : `DR NOT READY — ${checks.filter((c) => c.status === 'unavailable').length} failover path(s) unavailable`,
    };

    return {
      agentId: this.id,
      status: hasUnavailable ? 'failure' : 'success',
      output,
      escalate: hasUnavailable,
      recommendations: hasUnavailable
        ? checks.filter((c) => c.status === 'unavailable').map((c) => `Restore ${c.name}: ${c.message}`)
        : hasDegraded
          ? checks.filter((c) => c.status === 'degraded').map((c) => `Improve ${c.name}: ${c.message}`)
          : [],
      durationMs: 0,
    };
  }
}
