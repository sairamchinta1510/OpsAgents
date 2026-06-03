import { BaseController, EventBus } from '@opsagents/core';
import type { AgentResult, IController, OrchestrationResult, ServiceInputs, Trigger } from '@opsagents/core';

export interface ControllerSlaConfig {
  controllerId: string;
  slaMs: number; // max allowed duration; escalate if exceeded
}

export interface MetaOrchestrationResult extends OrchestrationResult {
  slaBreaches: string[];
  escalations: { controllerId: string; reason: string }[];
  controllerHealthSummary: Record<string, 'healthy' | 'degraded' | 'failed'>;
}

const DEFAULT_SLA_MS = 30_000; // 30 seconds per controller

export class MetaController extends BaseController {
  readonly id = 'meta-controller';
  readonly name = 'Meta Controller';

  private readonly domainControllers: IController[] = [];
  private readonly slaConfigs: Map<string, number> = new Map();
  private readonly eventBus: EventBus;

  constructor(eventBus?: EventBus) {
    super();
    this.eventBus = eventBus ?? new EventBus();
  }

  addDomainController(controller: IController, slaMs?: number): void {
    this.domainControllers.push(controller);
    this.slaConfigs.set(controller.id, slaMs ?? DEFAULT_SLA_MS);
  }

  getDomainControllers(): IController[] {
    return [...this.domainControllers];
  }

  getSlaConfig(controllerId: string): number {
    return this.slaConfigs.get(controllerId) ?? DEFAULT_SLA_MS;
  }

  protected async runOrchestration(
    trigger: Trigger,
    inputs: ServiceInputs,
    sessionId: string,
  ): Promise<AgentResult[]> {
    const slaBreaches: string[] = [];
    const escalations: { controllerId: string; reason: string }[] = [];
    const controllerHealthSummary: Record<string, 'healthy' | 'degraded' | 'failed'> = {};

    this.eventBus.publish('meta-controller:started', {
      controllerId: this.id,
      sessionId,
      domainControllerCount: this.domainControllers.length,
    });

    // Run all domain controllers concurrently with per-controller SLA watchdog
    const settled = await Promise.allSettled(
      this.domainControllers.map(async (ctrl) => {
        const slaMs = this.slaConfigs.get(ctrl.id) ?? DEFAULT_SLA_MS;
        const start = Date.now();

        const slaTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`SLA_BREACH:${ctrl.id}:exceeded ${slaMs}ms`)), slaMs),
        );

        this.eventBus.publish('meta-controller:controller-started', { controllerId: ctrl.id, slaMs });
        const result = await Promise.race([ctrl.orchestrate(trigger, inputs), slaTimeout]);
        const elapsed = Date.now() - start;

        this.eventBus.publish('meta-controller:controller-completed', { controllerId: ctrl.id, elapsed, overallStatus: result.overallStatus });
        return result;
      }),
    );

    const results: AgentResult[] = settled.map((settled, i) => {
      const ctrl = this.domainControllers[i];

      if (settled.status === 'fulfilled') {
        const orch = settled.value;

        // SLA breach: succeeded but took longer than allowed
        const elapsed = orch.durationMs;
        const slaMs = this.slaConfigs.get(ctrl.id) ?? DEFAULT_SLA_MS;
        if (elapsed > slaMs) {
          slaBreaches.push(ctrl.id);
          escalations.push({ controllerId: ctrl.id, reason: `Exceeded SLA: ${elapsed}ms > ${slaMs}ms` });
        }

        if (orch.overallStatus === 'escalated') {
          escalations.push({ controllerId: ctrl.id, reason: `Agent requested escalation` });
        }

        const health: 'healthy' | 'degraded' | 'failed' =
          orch.overallStatus === 'success' ? 'healthy' :
          orch.overallStatus === 'escalated' ? 'degraded' : 'failed';
        controllerHealthSummary[ctrl.id] = health;

        return {
          agentId: ctrl.id,
          status: orch.overallStatus === 'failure' ? 'failure' : 'success',
          output: orch,
          durationMs: orch.durationMs,
          escalate: orch.overallStatus === 'escalated' || slaBreaches.includes(ctrl.id),
          recommendations: orch.overallStatus === 'escalated'
            ? [`Controller ${ctrl.id} escalated — review agent results`]
            : [],
        } satisfies AgentResult;
      } else {
        const errorMsg = String(settled.reason);
        const isSla = errorMsg.startsWith('SLA_BREACH:');

        if (isSla) {
          slaBreaches.push(ctrl.id);
          escalations.push({ controllerId: ctrl.id, reason: errorMsg.replace('SLA_BREACH:', '') });
        }
        controllerHealthSummary[ctrl.id] = 'failed';

        this.eventBus.publish('meta-controller:controller-failed', { controllerId: ctrl.id, error: errorMsg });

        return {
          agentId: ctrl.id,
          status: 'failure',
          output: { error: errorMsg, slaBreached: isSla },
          durationMs: 0,
          escalate: true,
          recommendations: [`Controller ${ctrl.id} failed — investigate and restart`],
        } satisfies AgentResult;
      }
    });

    // Publish meta-level summary
    this.eventBus.publish('meta-controller:completed', {
      controllerId: this.id,
      sessionId,
      slaBreaches,
      escalations,
      controllerHealthSummary,
    });

    // Attach meta-data to sharedState so callers can read it
    (results as AgentResult[] & { _meta?: unknown })._meta = { slaBreaches, escalations, controllerHealthSummary };

    return results;
  }
}

