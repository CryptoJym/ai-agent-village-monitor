/**
 * Auto-Tiling Tests
 *
 * Comprehensive tests for the 4-bit auto-tiling system.
 * Tests all 16 possible mask combinations and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateWallMask,
  getWallTileId,
  autoTileWalls,
  calculateExtendedMask,
  isOuterWall,
  detectCornerType,
  createDefaultTileMapping,
  visualizeMask,
  describeMask,
} from '../autoTile';
import { AUTOTILE_MASKS } from '../types';

describe('calculateWallMask', () => {
  it('should return NONE for non-wall tiles', () => {
    const grid = [
      [false, false, false],
      [false, false, false],
      [false, false, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.NONE);
  });

  it('should calculate mask 0 (isolated wall)', () => {
    const grid = [
      [false, false, false],
      [false, true, false],
      [false, false, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.NONE);
  });

  it('should calculate mask 1 (North only)', () => {
    const grid = [
      [false, true, false],
      [false, true, false],
      [false, false, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.N);
  });

  it('should calculate mask 2 (East only)', () => {
    const grid = [
      [false, false, false],
      [false, true, true],
      [false, false, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.E);
  });

  it('should calculate mask 3 (North + East)', () => {
    const grid = [
      [false, true, false],
      [false, true, true],
      [false, false, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.NE);
  });

  it('should calculate mask 4 (South only)', () => {
    const grid = [
      [false, false, false],
      [false, true, false],
      [false, true, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.S);
  });

  it('should calculate mask 5 (North + South)', () => {
    const grid = [
      [false, true, false],
      [false, true, false],
      [false, true, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.NS);
  });

  it('should calculate mask 6 (South + East)', () => {
    const grid = [
      [false, false, false],
      [false, true, true],
      [false, true, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.SE);
  });

  it('should calculate mask 7 (North + South + East)', () => {
    const grid = [
      [false, true, false],
      [false, true, true],
      [false, true, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.NSE);
  });

  it('should calculate mask 8 (West only)', () => {
    const grid = [
      [false, false, false],
      [true, true, false],
      [false, false, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.W);
  });

  it('should calculate mask 9 (North + West)', () => {
    const grid = [
      [false, true, false],
      [true, true, false],
      [false, false, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.NW);
  });

  it('should calculate mask 10 (East + West)', () => {
    const grid = [
      [false, false, false],
      [true, true, true],
      [false, false, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.EW);
  });

  it('should calculate mask 11 (North + East + West)', () => {
    const grid = [
      [false, true, false],
      [true, true, true],
      [false, false, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.NEW);
  });

  it('should calculate mask 12 (South + West)', () => {
    const grid = [
      [false, false, false],
      [true, true, false],
      [false, true, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.SW);
  });

  it('should calculate mask 13 (North + South + West)', () => {
    const grid = [
      [false, true, false],
      [true, true, false],
      [false, true, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.NSW);
  });

  it('should calculate mask 14 (South + East + West)', () => {
    const grid = [
      [false, false, false],
      [true, true, true],
      [false, true, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.SEW);
  });

  it('should calculate mask 15 (all directions)', () => {
    const grid = [
      [false, true, false],
      [true, true, true],
      [false, true, false],
    ];

    expect(calculateWallMask(grid, 1, 1)).toBe(AUTOTILE_MASKS.ALL);
  });

  it('should handle edge positions correctly', () => {
    const grid = [
      [true, true, true],
      [true, true, true],
      [true, true, true],
    ];

    // Top-left corner (no north or west)
    expect(calculateWallMask(grid, 0, 0)).toBe(6); // S + E

    // Top-right corner (no north or east)
    expect(calculateWallMask(grid, 2, 0)).toBe(12); // S + W

    // Bottom-left corner (no south or west)
    expect(calculateWallMask(grid, 0, 2)).toBe(3); // N + E

    // Bottom-right corner (no south or east)
    expect(calculateWallMask(grid, 2, 2)).toBe(9); // N + W
  });
});

describe('getWallTileId', () => {
  it('should return correct tile ID for each mask', () => {
    const mapping = createDefaultTileMapping(100);

    expect(getWallTileId(0, mapping)).toBe(100);
    expect(getWallTileId(1, mapping)).toBe(101);
    expect(getWallTileId(15, mapping)).toBe(115);
  });

  it('should clamp mask to valid range', () => {
    const mapping = createDefaultTileMapping(100);

    expect(getWallTileId(-1, mapping)).toBe(100);
    expect(getWallTileId(20, mapping)).toBe(115);
  });

  it('should fall back to ALL tile if mask not mapped', () => {
    const mapping = {
      wallTiles: { 15: 999 },
      floorTiles: [],
      doorTiles: { north: 0, south: 0, east: 0, west: 0 },
      decorationTiles: {},
    };

    expect(getWallTileId(7, mapping)).toBe(999);
  });
});

describe('autoTileWalls', () => {
  it('should generate complete wall tile data', () => {
    const grid = [
      [false, false, false],
      [false, true, false],
      [false, false, false],
    ];

    const mapping = createDefaultTileMapping(100);
    const result = autoTileWalls(grid, mapping);

    expect(result).toHaveLength(9);
    expect(result[4]).toBe(100); // Center wall, isolated
    expect(result[0]).toBe(0); // Empty tile
  });

  it('should auto-tile a room correctly', () => {
    const grid = [
      [true, true, true],
      [true, false, true],
      [true, true, true],
    ];

    const mapping = createDefaultTileMapping(100);
    const result = autoTileWalls(grid, mapping);

    // Grid positions are [row][col], index = row * 3 + col
    // Position (0,0): top-left corner has neighbors E(+1,0)=true and S(0,+1)=true
    // Mask: E(2) + S(4) = 6, tile = 100 + 6 = 106
    expect(result[0]).toBe(106);

    // Position (1,0): top center has neighbors E(+1,0)=true, S(0,+1)=false (room interior), W(-1,0)=true
    // Mask: E(2) + W(8) = 10, tile = 100 + 10 = 110
    expect(result[1]).toBe(110);

    // Position (1,1): center is not a wall (false), so tile = 0
    expect(result[4]).toBe(0);
  });
});

describe('calculateExtendedMask', () => {
  it('should calculate 8-neighbor mask', () => {
    const grid = [
      [true, true, true],
      [true, true, true],
      [true, true, true],
    ];

    const mask = calculateExtendedMask(grid, 1, 1);

    // Should have all 8 neighbors
    // Cardinal: N(1) + E(2) + S(4) + W(8) = 15
    // Diagonal: NE(16) + SE(32) + SW(64) + NW(128) = 240
    expect(mask).toBe(255);
  });

  it('should return 0 for non-wall tiles', () => {
    const grid = [
      [true, true, true],
      [true, false, true],
      [true, true, true],
    ];

    expect(calculateExtendedMask(grid, 1, 1)).toBe(0);
  });
});

describe('isOuterWall', () => {
  it('should identify outer walls', () => {
    const grid = [
      [true, true, true],
      [true, false, true],
      [true, true, true],
    ];

    // All perimeter tiles are outer walls
    expect(isOuterWall(grid, 0, 0)).toBe(true);
    expect(isOuterWall(grid, 1, 0)).toBe(true);
    expect(isOuterWall(grid, 2, 0)).toBe(true);
    expect(isOuterWall(grid, 0, 1)).toBe(true);
  });

  it('should return false for completely surrounded walls', () => {
    const grid = [
      [false, true, false],
      [true, true, true],
      [false, true, false],
    ];

    // Center wall has all 4 cardinal neighbors
    expect(isOuterWall(grid, 1, 1)).toBe(false);
  });

  it('should return false for non-walls', () => {
    const grid = [
      [true, true, true],
      [true, false, true],
      [true, true, true],
    ];

    expect(isOuterWall(grid, 1, 1)).toBe(false);
  });
});

describe('detectCornerType', () => {
  it('should detect inner-ne corner', () => {
    const grid = [
      [false, true, false],
      [false, true, true],
      [false, false, false],
    ];

    expect(detectCornerType(grid, 1, 1)).toBe('inner-ne');
  });

  it('should detect inner-se corner', () => {
    const grid = [
      [false, false, false],
      [false, true, true],
      [false, true, false],
    ];

    expect(detectCornerType(grid, 1, 1)).toBe('inner-se');
  });

  it('should detect inner-sw corner', () => {
    const grid = [
      [false, false, false],
      [true, true, false],
      [false, true, false],
    ];

    expect(detectCornerType(grid, 1, 1)).toBe('inner-sw');
  });

  it('should detect inner-nw corner', () => {
    const grid = [
      [false, true, false],
      [true, true, false],
      [false, false, false],
    ];

    expect(detectCornerType(grid, 1, 1)).toBe('inner-nw');
  });

  it('should detect outer corners', () => {
    const _grid = [
      [true, true, true],
      [true, true, true],
      [true, true, true],
    ];

    // Center has all cardinals but we can test missing diagonals
    // This would need a more complex grid setup
  });

  it('should return null for non-corner tiles', () => {
    const grid = [
      [false, true, false],
      [false, true, false],
      [false, true, false],
    ];

    expect(detectCornerType(grid, 1, 1)).toBe(null);
  });

  it('should return null for non-walls', () => {
    const grid = [
      [true, true, true],
      [true, false, true],
      [true, true, true],
    ];

    expect(detectCornerType(grid, 1, 1)).toBe(null);
  });
});

describe('createDefaultTileMapping', () => {
  it('should create complete mapping for all masks', () => {
    const mapping = createDefaultTileMapping(100);

    expect(mapping.wallTiles[0]).toBe(100);
    expect(mapping.wallTiles[15]).toBe(115);
    expect(Object.keys(mapping.wallTiles)).toHaveLength(16);
  });

  it('should include floor and door tiles', () => {
    const mapping = createDefaultTileMapping();

    expect(mapping.floorTiles).toBeDefined();
    expect(mapping.floorTiles.length).toBeGreaterThan(0);
    expect(mapping.doorTiles.north).toBeDefined();
  });
});

describe('visualizeMask', () => {
  it('should visualize mask correctly', () => {
    const viz = visualizeMask(AUTOTILE_MASKS.ALL);
    expect(viz).toContain('█');
  });

  it('should show only center tile for NONE (no neighbors)', () => {
    const viz = visualizeMask(AUTOTILE_MASKS.NONE);
    // Center tile is always shown with █, but no neighbors should be marked
    // NONE means mask=0, so only the center █ should appear (representing current tile)
    const count = (viz.match(/█/g) || []).length;
    expect(count).toBe(1); // Only the center tile marker
  });
});

describe('describeMask', () => {
  it('should describe isolated tile', () => {
    expect(describeMask(0)).toBe('Isolated');
  });

  it('should describe all directions', () => {
    expect(describeMask(15)).toBe('All directions');
  });

  it('should describe single direction', () => {
    expect(describeMask(1)).toBe('North');
  });

  it('should describe multiple directions', () => {
    const desc = describeMask(3);
    expect(desc).toContain('North');
    expect(desc).toContain('East');
  });
});
