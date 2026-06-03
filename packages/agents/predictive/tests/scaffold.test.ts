import { describe, expect, it } from 'vitest';
import * as predictivePackage from '../src/index.js';

describe('predictive agent package scaffold', () => {
  it('exposes an importable entrypoint', () => {
    expect(predictivePackage).toBeDefined();
  });
});
