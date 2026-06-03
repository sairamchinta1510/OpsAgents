import { describe, expect, it } from 'vitest';
import * as deploymentPackage from '../src/index.js';
import type { CiCdGovernanceOutput } from '../src/index.js';

describe('deployment agent package scaffold', () => {
  it('exposes all deployment agents from the package entrypoint', () => {
    expect(deploymentPackage).toBeDefined();
    expect(deploymentPackage.CiCdGovernanceAgent).toBeDefined();
    expect(deploymentPackage.DeploymentValidationAgent).toBeDefined();
    expect(deploymentPackage.LagIndicationAgent).toBeDefined();
    expect(deploymentPackage.OnDemandTestingAgent).toBeDefined();
  });

  it('re-exports ci-cd governance types from the package entrypoint', () => {
    const output: CiCdGovernanceOutput = {
      approved: true,
      coverage: 80,
      errorRate: 0,
      reason: 'All checks passed',
      auditLog: [],
    };

    expect(output.approved).toBe(true);
  });
});
