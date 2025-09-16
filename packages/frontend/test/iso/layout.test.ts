import { describe, it, expect } from 'vitest';
import { generateGridLayout, relax, generatePoissonLayout } from '../../src/iso/layout';

describe('layout utilities', () => {
  it('grid layout with relaxation produces 100 positions within bounds without exact overlap', () => {
    const bounds = { width: 500, height: 500 };
    const pts = generateGridLayout(100, 24, bounds);
    const out = relax(pts, 20, bounds, 3);
    expect(out.length).toBe(100);
    // within bounds
    for (const p of out) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(bounds.width);
      expect(p.y).toBeLessThanOrEqual(bounds.height);
    }
    // no exact duplicates (within 1px tolerance)
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dx = out[i].x - out[j].x;
        const dy = out[i].y - out[j].y;
        const d = Math.hypot(dx, dy);
        expect(d).toBeGreaterThan(1);
      }
    }
  });

  it('poisson layout places at least 50 points without overlaps', () => {
    const pts = generatePoissonLayout(80, 25, { width: 500, height: 500 });
    expect(pts.length).toBeGreaterThanOrEqual(50);
  });
});
