import type { IController, OrchestrationResult, ServiceInputs, Trigger } from '@opsagents/core';
import { DefaultInputNormalizer, type InputNormalizer } from './input-normalizer.js';

export interface ServiceAdapterConfig {
  serviceId: string;
  controllers: IController[];
  inputNormalizer?: InputNormalizer;
}

export class ServiceAdapter {
  private readonly serviceId: string;
  private readonly controllers: IController[];
  private readonly normalizer: InputNormalizer;

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
}
