/**
 * 4-bit Auto-Tiling System
 *
 * Implements seamless wall transitions using a 4-bit bitmask system.
 * Each tile checks its 4 cardinal neighbors (N, E, S, W) and generates
 * a mask that determines which tile variant to use.
 *
 * Bit Layout:
 * - Bit 0 (1): North neighbor is a wall
 * - Bit 1 (2): East neighbor is a wall
 * - Bit 2 (4): South neighbor is a wall
 * - Bit 3 (8): West neighbor is a wall
 *
 * Example: A wall with neighbors to the North and East would have mask 3 (0011)
 */

import { TileMapping, AUTOTILE_MASKS } from './types';

/**
 * Calculate the 4-bit bitmask for a tile based on its neighbors
 *
 * @param grid - 2D boolean grid where true = wall/solid tile
 * @param x - X coordinate of the tile
 * @param y - Y coordinate of the tile
 * @returns 4-bit mask (0-15) representing adjacent walls
 */
export function calculateWallMask(
  grid: boolean[][],
  x: number,
  y: number
): number {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  // If the current tile isn't a wall, return 0
  if (!grid[y]?.[x]) {
    return AUTOTILE_MASKS.NONE;
  }

  let mask = 0;

  // Check North (bit 0)
  if (y > 0 && grid[y - 1][x]) {
    mask |= 1;
  }

  // Check East (bit 1)
  if (x < width - 1 && grid[y][x + 1]) {
    mask |= 2;
  }

  // Check South (bit 2)
  if (y < height - 1 && grid[y + 1][x]) {
    mask |= 4;
  }

  // Check West (bit 3)
  if (x > 0 && grid[y][x - 1]) {
    mask |= 8;
  }

  return mask;
}

/**
 * Get the appropriate tile ID for a given wall mask
 *
 * @param mask - 4-bit mask (0-15)
 * @param mapping - Tile mapping configuration
 * @returns Tile ID to use for this wall configuration
 */
export function getWallTileId(mask: number, mapping: TileMapping): number {
  // Clamp mask to valid range
  const clampedMask = Math.max(0, Math.min(15, mask));

  // Look up tile ID in mapping
  const tileId = mapping.wallTiles[clampedMask];

  // Return mapped tile or fall back to base wall tile
  return tileId ?? mapping.wallTiles[AUTOTILE_MASKS.ALL] ?? 16;
}

/**
 * Generate complete wall auto-tiling data for a grid
 *
 * @param grid - 2D boolean grid where true = wall
 * @param mapping - Tile mapping configuration
 * @returns Flat array of tile IDs in row-major order
 */
export function autoTileWalls(
  grid: boolean[][],
  mapping: TileMapping
): number[] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const result: number[] = new Array(width * height).fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x]) {
        const mask = calculateWallMask(grid, x, y);
        const tileId = getWallTileId(mask, mapping);
        result[y * width + x] = tileId;
      }
    }
  }

  return result;
}

/**
 * Calculate extended 8-neighbor mask (includes diagonals)
 * Useful for more complex tiling scenarios
 *
 * @param grid - 2D boolean grid
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns 8-bit mask representing all 8 neighbors
 */
export function calculateExtendedMask(
  grid: boolean[][],
  x: number,
  y: number
): number {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  if (!grid[y]?.[x]) {
    return 0;
  }

  let mask = 0;

  // Cardinal directions (bits 0-3)
  if (y > 0 && grid[y - 1][x]) mask |= 1;                    // N
  if (x < width - 1 && grid[y][x + 1]) mask |= 2;            // E
  if (y < height - 1 && grid[y + 1][x]) mask |= 4;           // S
  if (x > 0 && grid[y][x - 1]) mask |= 8;                    // W

  // Diagonal directions (bits 4-7)
  if (y > 0 && x < width - 1 && grid[y - 1][x + 1]) mask |= 16;      // NE
  if (y < height - 1 && x < width - 1 && grid[y + 1][x + 1]) mask |= 32;  // SE
  if (y < height - 1 && x > 0 && grid[y + 1][x - 1]) mask |= 64;     // SW
  if (y > 0 && x > 0 && grid[y - 1][x - 1]) mask |= 128;             // NW

  return mask;
}

/**
 * Check if a position is on the outer edge of a wall cluster
 * Useful for determining if shadow tiles should be placed
 *
 * @param grid - 2D boolean grid
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns True if this wall tile is on the outer edge
 */
export function isOuterWall(
  grid: boolean[][],
  x: number,
  y: number
): boolean {
  if (!grid[y]?.[x]) {
    return false;
  }

  const mask = calculateWallMask(grid, x, y);

  // A wall is "outer" if it doesn't have walls on all sides
  return mask !== AUTOTILE_MASKS.ALL;
}

/**
 * Detect corners in wall layouts
 * Returns corner type for special corner tile placement
 *
 * @param grid - 2D boolean grid
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Corner type or null if not a corner
 */
export function detectCornerType(
  grid: boolean[][],
  x: number,
  y: number
): 'inner-ne' | 'inner-se' | 'inner-sw' | 'inner-nw' |
   'outer-ne' | 'outer-se' | 'outer-sw' | 'outer-nw' | null {
  if (!grid[y]?.[x]) {
    return null;
  }

  const mask = calculateWallMask(grid, x, y);

  // Inner corners (3 sides filled, forming an L)
  if (mask === (1 | 2)) return 'inner-ne'; // N + E
  if (mask === (4 | 2)) return 'inner-se'; // S + E
  if (mask === (4 | 8)) return 'inner-sw'; // S + W
  if (mask === (1 | 8)) return 'inner-nw'; // N + W

  // Outer corners (surrounded by walls but with diagonal gap)
  const extMask = calculateExtendedMask(grid, x, y);
  const hasAllCardinals = mask === AUTOTILE_MASKS.ALL;

  if (hasAllCardinals) {
    if (!(extMask & 16)) return 'outer-ne'; // Missing NE diagonal
    if (!(extMask & 32)) return 'outer-se'; // Missing SE diagonal
    if (!(extMask & 64)) return 'outer-sw'; // Missing SW diagonal
    if (!(extMask & 128)) return 'outer-nw'; // Missing NW diagonal
  }

  return null;
}

/**
 * Create a default tile mapping for testing/fallback
 * Maps each 4-bit mask to a tile ID (base + mask)
 *
 * @param baseTileId - Starting tile ID for walls
 * @returns Complete tile mapping
 */
export function createDefaultTileMapping(baseTileId: number = 16): TileMapping {
  const wallTiles: Record<number, number> = {};

  // Map each mask (0-15) to sequential tile IDs
  for (let mask = 0; mask <= 15; mask++) {
    wallTiles[mask] = baseTileId + mask;
  }

  return {
    wallTiles,
    floorTiles: [1, 2, 3, 4], // Generic floor tiles
    doorTiles: {
      north: 32,
      south: 33,
      east: 34,
      west: 35,
    },
    decorationTiles: {},
    shadowTiles: {
      wallShadow: 48,
      cornerShadow: 49,
    },
  };
}

/**
 * Visualize a 4-bit mask as ASCII art for debugging
 *
 * @param mask - 4-bit mask value
 * @returns ASCII representation of the mask
 */
export function visualizeMask(mask: number): string {
  const n = (mask & 1) ? '█' : ' ';
  const e = (mask & 2) ? '█' : ' ';
  const s = (mask & 4) ? '█' : ' ';
  const w = (mask & 8) ? '█' : ' ';

  return `
 ${n}
${w}█${e}
 ${s}
`.trim();
}

/**
 * Get a human-readable description of a mask
 *
 * @param mask - 4-bit mask value
 * @returns Description like "North + East" or "All directions"
 */
export function describeMask(mask: number): string {
  if (mask === 0) return 'Isolated';
  if (mask === 15) return 'All directions';

  const directions: string[] = [];
  if (mask & 1) directions.push('North');
  if (mask & 2) directions.push('East');
  if (mask & 4) directions.push('South');
  if (mask & 8) directions.push('West');

  return directions.join(' + ');
}
