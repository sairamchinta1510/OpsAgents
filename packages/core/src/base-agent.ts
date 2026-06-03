import type { AgentContext, AgentMetrics, AgentResult, IAgent, ServiceInputs } from './interfaces.js';
import type { AgentCategory, InputType } from './types.js';
import { AgentStatus } from './types.js';

// Maps InputType values to the corresponding ServiceInputs property key
const INPUT_TYPE_TO_KEY: Record<InputType, keyof ServiceInputs> = {
  'code': 'code',
  'perf-log': 'perfLog',
  'monitor': 'monitors',
  'machine-params': 'machineParams',
  'incident': 'incident',
};

export abstract class BaseAgent implements IAgent {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly category: AgentCategory;
  abstract readonly acceptedInputs: InputType[];
  abstract readonly version: string;

  private _status: AgentStatus = AgentStatus.IDLE;
  private _enabled = true;
  private _metrics: AgentMetrics = {
    invocationCount: 0,
    successCount: 0,
    failureCount: 0,
    skipCount: 0,
    escalateCount: 0,
    totalDurationMs: 0,
    avgDurationMs: 0,
    lastRunAt: null,
    lastStatus: null,
  };

  // Subclasses implement this instead of execute()
  protected abstract run(context: AgentContext): Promise<AgentResult>;

  async execute(context: AgentContext): Promise<AgentResult> {
    if (!this._enabled) {
      const result: AgentResult = {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'Agent disabled' },
        durationMs: 0,
      };
      this.updateMetrics(result, new Date());
      return result;
    }

    if (!this.canHandle(context.inputs)) {
      const result: AgentResult = {
        agentId: this.id,
        status: 'skipped',
        output: { reason: 'Unsupported inputs' },
        durationMs: 0,
      };
      this.updateMetrics(result, new Date());
      return result;
    }

    this._status = AgentStatus.RUNNING;
    const start = Date.now();
    let result: AgentResult;
    try {
      const runResult = await this.run(context);
      this._status = AgentStatus.IDLE;
      result = { ...runResult, durationMs: Date.now() - start };
    } catch (err) {
      this._status = AgentStatus.ERROR;
      result = {
        agentId: this.id,
        status: 'failure',
        output: { error: err instanceof Error ? err.message : String(err) },
        durationMs: Date.now() - start,
      };
    } finally {
      if (this._status === AgentStatus.RUNNING) {
        this._status = AgentStatus.IDLE;
      }
    }

    this.updateMetrics(result, new Date());
    return result;
  }

  canHandle(inputs: ServiceInputs): boolean {
    return this.acceptedInputs.some((type) => inputs[INPUT_TYPE_TO_KEY[type]] !== undefined);
  }

  enable(): void {
    this._enabled = true;
  }

  disable(): void {
    this._enabled = false;
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  getMetrics(): AgentMetrics {
    return {
      ...this._metrics,
      lastRunAt: this._metrics.lastRunAt ? new Date(this._metrics.lastRunAt.getTime()) : null,
    };
  }

  getStatus(): AgentStatus {
    return this._status;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  private updateMetrics(result: AgentResult, runAt: Date): void {
    this._metrics.invocationCount += 1;

    switch (result.status) {
      case 'success':
        this._metrics.successCount += 1;
        break;
      case 'failure':
        this._metrics.failureCount += 1;
        break;
      case 'skipped':
        this._metrics.skipCount += 1;
        break;
      case 'escalate':
        this._metrics.escalateCount += 1;
        break;
    }

    if (result.escalate === true && result.status !== 'escalate') {
      this._metrics.escalateCount += 1;
    }

    this._metrics.totalDurationMs += result.durationMs;
    this._metrics.avgDurationMs = this._metrics.totalDurationMs / this._metrics.invocationCount;
    this._metrics.lastRunAt = runAt;
    this._metrics.lastStatus = result.status;
  }
}
