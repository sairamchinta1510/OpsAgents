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
    _enabled = true;
    _metrics = {
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
    async execute(context) {
        if (!this._enabled) {
            const result = {
                agentId: this.id,
                status: 'skipped',
                output: { reason: 'Agent disabled' },
                durationMs: 0,
            };
            this.updateMetrics(result, new Date());
            return result;
        }
        if (!this.canHandle(context.inputs)) {
            const result = {
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
        let result;
        try {
            const runResult = await this.run(context);
            this._status = AgentStatus.IDLE;
            result = { ...runResult, durationMs: Date.now() - start };
        }
        catch (err) {
            this._status = AgentStatus.ERROR;
            result = {
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
        this.updateMetrics(result, new Date());
        return result;
    }
    canHandle(inputs) {
        return this.acceptedInputs.some((type) => inputs[INPUT_TYPE_TO_KEY[type]] !== undefined);
    }
    enable() {
        this._enabled = true;
    }
    disable() {
        this._enabled = false;
    }
    isEnabled() {
        return this._enabled;
    }
    getMetrics() {
        return { ...this._metrics };
    }
    getStatus() {
        return this._status;
    }
    async healthCheck() {
        return true;
    }
    updateMetrics(result, runAt) {
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
//# sourceMappingURL=base-agent.js.map