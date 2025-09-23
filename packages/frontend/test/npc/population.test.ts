import { describe, expect, it } from 'vitest';
import { computeNpcTint, deriveRoles, estimateNpcCount } from '../../src/npc/population';
import type { HouseSnapshot } from '../../src/npc/types';

const baseHouse: HouseSnapshot = {
  id: 'house-1',
  name: 'core-lib',
  language: 'ts',
  position: { x: 100, y: 120 },
  metadata: {
    stars: 120,
    issues: 8,
    agents: [
      { id: 'agent-1', name: 'Alice' },
      { id: 'agent-2', name: 'Bob' },
    ],
    components: ['api', 'types', 'docs'],
  },
};

describe('npc population helpers', () => {
  it('estimates count based on metadata', () => {
    const count = estimateNpcCount(baseHouse);
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(8);
  });

  it('derives role mix with metrics influence', () => {
    const roles = deriveRoles(4, baseHouse);
    expect(roles).toHaveLength(4);
    expect(roles).toContain('bot');
    expect(roles).toContain('engineer');
  });

  it('produces stable tint per house/role/index', () => {
    const a = computeNpcTint('house-1', 'engineer', 0);
    const b = computeNpcTint('house-1', 'engineer', 0);
    const c = computeNpcTint('house-1', 'bot', 0);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
