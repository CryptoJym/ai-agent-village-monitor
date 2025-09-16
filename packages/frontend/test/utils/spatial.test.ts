import { describe, it, expect } from 'vitest';
import { SpatialHash } from '../../src/utils/spatial';

describe('SpatialHash', () => {
  it('inserts, updates, and queries items', () => {
    type Item = { id: string; x: number; y: number };
    const h = new SpatialHash<Item>(10, (it) => it.id);
    const items: Item[] = [
      { id: 'a', x: 5, y: 5 },
      { id: 'b', x: 25, y: 15 },
      { id: 'c', x: 40, y: 40 },
    ];
    items.forEach((it) => h.insert(it));
    const out: string[] = [];
    h.queryRect(0, 0, 20, 20, out);
    expect(new Set(out)).toEqual(new Set(['a', 'b']));
    h.update('b', 100, 100);
    out.length = 0;
    h.queryRect(0, 0, 20, 20, out);
    expect(new Set(out)).toEqual(new Set(['a']));
    h.remove('a');
    out.length = 0;
    h.queryRect(0, 0, 20, 20, out);
    expect(out.length).toBe(0);
  });
});
