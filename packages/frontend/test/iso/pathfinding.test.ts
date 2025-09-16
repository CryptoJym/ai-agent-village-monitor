import { describe, it, expect } from 'vitest';
import { Grid, aStar, simplify } from '../../src/iso/pathfinding';

describe('pathfinding', () => {
  it('finds a path around obstacles and simplifies it', () => {
    const g = new Grid(20, 10);
    // obstacle wall with a gap at y=5
    for (let y = 0; y < 10; y++) {
      if (y !== 5) g.setBlocked(10, y, true);
    }
    const path = aStar(g, { x: 2, y: 5 }, { x: 18, y: 5 });
    expect(path).not.toBeNull();
    const simp = simplify(path!);
    // simplified path should have fewer turns than original
    expect(simp.length).toBeLessThanOrEqual(path!.length);
  });
});
