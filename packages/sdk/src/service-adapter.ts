import type { IController, OrchestrationResult, ServiceInputs, Trigger } from '@opsagents/core';
import { DefaultInputNormalizer, type InputNormalizer } from './input-normalizer.js';

export interface ServiceAdapterConfig {
  serviceId: string;
  controllers: IController[];
  inputNormalizer?: InputNormalizer;
}

export type PollingInputsFactory = () => ServiceInputs | Promise<ServiceInputs>;

export class ServiceAdapter {
  private readonly serviceId: string;
  private readonly controllers: IController[];
  private readonly normalizer: InputNormalizer;

  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: ServiceAdapterConfig) {
    this.serviceId = config.serviceId;
    this.controllers = config.controllers;
    this.normalizer = config.inputNormalizer ?? new DefaultInputNormalizer();
  }

  async run(trigger: Trigger, rawInputs: ServiceInputs): Promise<OrchestrationResult[]> {
    if (rawInputs.serviceId !== this.serviceId) {
      throw new Error(
        `serviceId mismatch: adapter is for "${this.serviceId}" but inputs have "${rawInputs.serviceId}"`,
      );
    }

    const inputs = this.normalizer.normalize(rawInputs);

    return Promise.all(
      this.controllers.map((ctrl) => ctrl.orchestrate(trigger, inputs)),
    );
  }

  /**
   * Start a continuous polling loop that fires all controllers on the given interval.
   * The `inputsFactory` is called each tick to produce fresh ServiceInputs.
   * Results are fire-and-forget; errors in a single tick are swallowed so polling continues.
   */
  startPolling(intervalMs: number, inputsFactory: PollingInputsFactory): void {
    if (this.pollingTimer !== null) {
      throw new Error('Polling is already running. Call stopPolling() first.');
    }

    const tick = async (): Promise<void> => {
      try {
        const raw = await inputsFactory();
        const trigger: Trigger = { type: 'schedule', cronExpression: `every-${intervalMs}ms` };
        await this.run(trigger, raw);
      } catch {
        // Intentionally swallowed: a single-tick failure must not kill the loop
      }
    };

    this.pollingTimer = setInterval(() => { void tick(); }, intervalMs);
  }

  /** Stop the polling loop started by {@link startPolling}. */
  stopPolling(): void {
    if (this.pollingTimer !== null) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /** Returns true if the polling loop is currently active. */
  isPolling(): boolean {
    return this.pollingTimer !== null;
  }
}
