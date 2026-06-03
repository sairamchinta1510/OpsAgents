import type { AgentContext, AgentResult, IAgent, ServiceInputs } from './interfaces.js';
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

  // Subclasses implement this instead of execute()
  protected abstract run(context: AgentContext): Promise<AgentResult>;

  async execute(context: AgentContext): Promise<AgentResult> {
    this._status = AgentStatus.RUNNING;
    const start = Date.now();
    try {
      const result = await this.run(context);
      this._status = AgentStatus.IDLE;
      return { ...result, durationMs: Date.now() - start };
    } catch (err) {
      this._status = AgentStatus.ERROR;
      return {
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
  }

  canHandle(inputs: ServiceInputs): boolean {
    return this.acceptedInputs.some((type) => inputs[INPUT_TYPE_TO_KEY[type]] !== undefined);
  }

  getStatus(): AgentStatus {
    return this._status;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
