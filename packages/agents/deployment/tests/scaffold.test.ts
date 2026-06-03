import { describe, expect, it } from 'vitest';
import * as deploymentPackage from '../src/index.js';

describe('deployment agent package scaffold', () => {
  it('exposes an importable entrypoint', () => {
    expect(deploymentPackage).toBeDefined();
  });

  it('exports CiCdGovernanceAgent from the package entrypoint', () => {
    expect(deploymentPackage.CiCdGovernanceAgent).toBeDefined();
  });
});
