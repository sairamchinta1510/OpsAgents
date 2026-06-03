import { AgentStatus } from './types.js';
// Maps InputType values to the corresponding ServiceInputs property key
const INPUT_TYPE_TO_KEY = {
    'code': 'code',
    'perf-log': 'perfLog',
    'monitor': 'monitors',
    'machine-params': 'machineParams',
    'incident': 'incident',
};
export class BaseAgent {
    _status = AgentStatus.IDLE;
    async execute(context) {
        this._status = AgentStatus.RUNNING;
        const start = Date.now();
        try {
            const result = await this.run(context);
            this._status = AgentStatus.IDLE;
            return { ...result, durationMs: Date.now() - start };
        }
        catch (err) {
            this._status = AgentStatus.ERROR;
            return {
                agentId: this.id,
                status: 'failure',
                output: { error: err instanceof Error ? err.message : String(err) },
                durationMs: Date.now() - start,
            };
        }
        finally {
            if (this._status === AgentStatus.RUNNING) {
                this._status = AgentStatus.IDLE;
            }
        }
    }
    canHandle(inputs) {
        return this.acceptedInputs.some((type) => inputs[INPUT_TYPE_TO_KEY[type]] !== undefined);
    }
    getStatus() {
        return this._status;
    }
    async healthCheck() {
        return true;
    }
}
//# sourceMappingURL=base-agent.js.map