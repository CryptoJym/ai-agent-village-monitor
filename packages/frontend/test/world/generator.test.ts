import { beforeEach, describe, expect, it } from 'vitest';
import { generateWorldMap, type VillageDescriptor } from '../../src/world';

beforeEach(() => {
  try {
    window.localStorage?.clear();
  } catch {
    // ignore
  }
});

function sampleVillages(count: number): VillageDescriptor[] {
  return Array.from({ length: count }).map((_, idx) => ({
    id: `v-${idx + 1}`,
    name: `Village ${idx + 1}`,
    language: idx % 2 === 0 ? 'js' : 'go',
    houseCount: 5 + idx,
    totalStars: idx * 3,
  }));
}

describe('generateWorldMap', () => {
  it('produces deterministic output for a given village list', () => {
    const villages = sampleVillages(6);
    const worldA = generateWorldMap(villages, { width: 32, height: 24, forceRegenerate: true });
    const worldB = generateWorldMap(villages, { width: 32, height: 24, forceRegenerate: true });

    expect(worldA.seed).toEqual(worldB.seed);
    expect(worldA.tiles).toHaveLength(worldB.tiles.length);
    expect(worldA.villages).toEqual(worldB.villages);
  });

  it('stores and reuses cached maps for identical signatures', () => {
    const villages = sampleVillages(4);
    const first = generateWorldMap(villages, { width: 24, height: 16, forceRegenerate: true });
    const cached = generateWorldMap(villages, { width: 24, height: 16 });

    expect(cached.generatedAt).toEqual(first.generatedAt);
    expect(cached.tiles.length).toBe(first.tiles.length);
    expect(cached.villages).toEqual(first.villages);
  });

  it('emits valid tile metadata', () => {
    const world = generateWorldMap(sampleVillages(3), {
      width: 16,
      height: 16,
      forceRegenerate: true,
    });
    expect(
      world.tiles.every(
        (tile) => typeof tile.textureKey === 'string' && tile.textureKey.length > 0,
      ),
    ).toBe(true);
    expect(
      world.tiles.every((tile) => typeof tile.frame === 'string' && tile.frame.length > 0),
    ).toBe(true);
    expect(world.tiles.every((tile) => tile.x >= 0 && tile.y >= 0)).toBe(true);
  });
});
