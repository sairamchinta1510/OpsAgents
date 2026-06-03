import { AgentCategory, BaseAgent } from '@opsagents/core';
import type { AgentContext, AgentResult, MachineParamsInput, MonitorInput, ServiceInputs } from '@opsagents/core';

const CPU_HEALTHY_THRESHOLD = 85;
const MEMORY_HEALTHY_THRESHOLD = 85;
const MIN_NODE_COUNT = 1;

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
}

export interface HealthCheckOutput {
  healthy: boolean;
  checks: HealthCheck[];
  summary: string;
}

export class HealthCheckAgent extends BaseAgent {
  readonly id = 'health-check';
  readonly name = 'Health Check Agent';
  readonly category = AgentCategory.MONITORING;
  readonly acceptedInputs = ['machine-params' as const, 'monitor' as const];
  readonly version = '0.1.0';

  override canHandle(inputs: ServiceInputs): boolean {
    return !!(inputs.machineParams || inputs.monitors);
  }

  protected async run(context: AgentContext): Promise<AgentResult> {
    const machineParams = context.inputs.machineParams as MachineParamsInput | undefined;
    const monitors = context.inputs.monitors as MonitorInput | undefined;

    if (!machineParams && !monitors) {
      return {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'No machineParams or monitors data' },
        durationMs: 0,
      };
    }

    const checks: HealthCheck[] = [];

    if (monitors) {
      const cpuOk = monitors.cpuPercent < CPU_HEALTHY_THRESHOLD;
      checks.push({
        name: 'cpu-utilization',
        status: cpuOk ? 'healthy' : monitors.cpuPercent < 95 ? 'degraded' : 'unhealthy',
        message: cpuOk
          ? `CPU at ${monitors.cpuPercent}% — within healthy range`
          : `CPU at ${monitors.cpuPercent}% — exceeds ${CPU_HEALTHY_THRESHOLD}% threshold`,
      });

      const memOk = monitors.memoryPercent < MEMORY_HEALTHY_THRESHOLD;
      checks.push({
        name: 'memory-utilization',
        status: memOk ? 'healthy' : monitors.memoryPercent < 95 ? 'degraded' : 'unhealthy',
        message: memOk
          ? `Memory at ${monitors.memoryPercent}% — within healthy range`
          : `Memory at ${monitors.memoryPercent}% — exceeds ${MEMORY_HEALTHY_THRESHOLD}% threshold`,
      });
    }

    if (machineParams) {
      const nodeCount = machineParams.nodeCount ?? 1;
      const nodesOk = nodeCount >= MIN_NODE_COUNT;
      checks.push({
        name: 'node-availability',
        status: nodesOk ? 'healthy' : 'unhealthy',
        message: nodesOk
          ? `${nodeCount} node(s) available`
          : 'No healthy nodes available — cluster is down',
      });
    }

    const hasUnhealthy = checks.some((c) => c.status === 'unhealthy');
    const hasDegraded = checks.some((c) => c.status === 'degraded');
    const healthy = !hasUnhealthy;

    const output: HealthCheckOutput = {
      healthy,
      checks,
      summary: healthy
        ? `All ${checks.length} health check(s) passed`
        : `${checks.filter((c) => c.status !== 'healthy').length} check(s) failed`,
    };

    return {
      agentId: this.id,
      status: hasUnhealthy ? 'failure' : 'success',
      output,
      escalate: hasUnhealthy,
      recommendations: hasUnhealthy
        ? checks.filter((c) => c.status === 'unhealthy').map((c) => `Remediate ${c.name}: ${c.message}`)
        : hasDegraded
          ? checks.filter((c) => c.status === 'degraded').map((c) => `Monitor ${c.name}: ${c.message}`)
          : [],
      durationMs: 0,
    };
  }
}
