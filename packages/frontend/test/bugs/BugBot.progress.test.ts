import { describe, it, expect } from 'vitest';
import { alphaForProgress } from '../../src/bugs/progress';

describe('BugBot progress → alpha mapping', () => {
  it('maps 0 → 1.0 alpha and 1 → ~0.2 alpha', () => {
    expect(alphaForProgress(0)).toBeCloseTo(1.0, 5);
    expect(alphaForProgress(1)).toBeCloseTo(0.2, 5);
  });

  it('is clamped to [0,1] input domain', () => {
    expect(alphaForProgress(-1)).toBeCloseTo(1.0, 5);
    expect(alphaForProgress(2)).toBeCloseTo(0.2, 5);
  });

  it('is monotonic decreasing over progress', () => {
    const values = [0, 0.25, 0.5, 0.75, 1].map(alphaForProgress);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
  });
});
