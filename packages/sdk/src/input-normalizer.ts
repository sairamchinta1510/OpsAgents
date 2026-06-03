import type { ServiceInputs } from '@opsagents/core';

export interface InputNormalizer {
  normalize(raw: ServiceInputs): ServiceInputs;
}

export class DefaultInputNormalizer implements InputNormalizer {
  normalize(raw: ServiceInputs): ServiceInputs {
    if (!raw.serviceId) {
      throw new Error('serviceId is required');
    }

    const normalized: ServiceInputs = {
      ...raw,
      timestamp: raw.timestamp ?? Date.now(),
    };

    if (normalized.perfLog) {
      normalized.perfLog = {
        ...normalized.perfLog,
        errorRate: Math.min(1, Math.max(0, normalized.perfLog.errorRate)),
      };
    }

    return normalized;
  }
}
