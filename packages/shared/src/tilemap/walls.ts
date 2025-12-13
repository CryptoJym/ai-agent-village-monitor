/**
 * Wall Tile Placement System
 *
 * Handles placement of wall tiles using the 4-bit auto-tiling system.
 * Supports inner walls, outer walls, and shadow effects for depth.
 */

import {
  Room,
  Corridor,
  TileMapping,
  Direction,
} from './types';
import {
  calculateWallMask,
  getWallTileId,
  autoTileWalls,
  isOuterWall,
} from './autoTile';

/**
 * Wall placement options
 */
export interface WallOptions {
  /** Include shadow tiles for depth effect */
  includeShadows?: boolean;
  /** Shadow tile offset (how far from wall) */
  shadowOffset?: number;
  /** Use different tiles for inner vs outer walls */
  useWallVariants?: boolean;
}

/**
 * Generate a boolean grid representing walls for auto-tiling
 *
 * @param rooms - All rooms in the map
 * @param corridors - All corridors in the map
 * @param width - Map width in tiles
 * @param height - Map height in tiles
 * @param floorData - Existing floor data (walls are placed where floors aren't)
 * @returns 2D boolean grid (true = wall)
 */
export function generateWallGrid(
  rooms: Room[],
  corridors: Corridor[],
  width: number,
  height: number,
  floorData?: number[]
): boolean[][] {
  // Initialize grid
  const grid: boolean[][] = Array.from({ length: height }, () =>
    Array(width).fill(false)
  );

  // Mark room perimeters as walls
  for (const room of rooms) {
    markRoomWalls(room, grid);
  }

  // Mark corridor walls
  for (const corridor of corridors) {
    markCorridorWalls(corridor, grid);
  }

  // If floor data provided, ensure walls don't overlap floors
  if (floorData) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (floorData[index] > 0) {
          grid[y][x] = false; // Remove wall where floor exists
        }
      }
    }
  }

  return grid;
}

/**
 * Mark walls around a room perimeter
 */
function markRoomWalls(room: Room, grid: boolean[][]): void {
  const { x, y, width, height } = room.bounds;

  // Top and bottom walls
  for (let rx = x; rx < x + width; rx++) {
    if (y >= 0 && y < grid.length && rx >= 0 && rx < grid[0].length) {
      grid[y][rx] = true; // Top wall
    }
    const bottomY = y + height - 1;
    if (bottomY >= 0 && bottomY < grid.length && rx >= 0 && rx < grid[0].length) {
      grid[bottomY][rx] = true; // Bottom wall
    }
  }

  // Left and right walls
  for (let ry = y; ry < y + height; ry++) {
    if (ry >= 0 && ry < grid.length && x >= 0 && x < grid[0].length) {
      grid[ry][x] = true; // Left wall
    }
    const rightX = x + width - 1;
    if (ry >= 0 && ry < grid.length && rightX >= 0 && rightX < grid[0].length) {
      grid[ry][rightX] = true; // Right wall
    }
  }
}

/**
 * Mark walls around a corridor
 */
function markCorridorWalls(corridor: Corridor, grid: boolean[][]): void {
  if (corridor.segments && corridor.segments.length > 0) {
    // Handle L-shaped corridors
    for (const segment of corridor.segments) {
      markCorridorSegmentWalls(
        segment.start,
        segment.end,
        corridor.width,
        segment.direction,
        grid
      );
    }
  } else {
    // Simple straight corridor
    const isHorizontal =
      Math.abs(corridor.end.x - corridor.start.x) >
      Math.abs(corridor.end.y - corridor.start.y);
    const direction = isHorizontal ? Direction.East : Direction.South;
    markCorridorSegmentWalls(
      corridor.start,
      corridor.end,
      corridor.width,
      direction,
      grid
    );
  }
}

/**
 * Mark walls for a corridor segment
 */
function markCorridorSegmentWalls(
  start: { x: number; y: number },
  end: { x: number; y: number },
  width: number,
  direction: Direction,
  grid: boolean[][]
): void {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const halfWidth = Math.floor(width / 2);

  if (direction === Direction.East || direction === Direction.West) {
    // Horizontal corridor - walls on top and bottom
    const centerY = Math.floor((minY + maxY) / 2);

    for (let x = minX; x <= maxX; x++) {
      const topY = centerY - halfWidth - 1;
      const bottomY = centerY + halfWidth + 1;

      if (topY >= 0 && topY < grid.length && x >= 0 && x < grid[0].length) {
        grid[topY][x] = true;
      }
      if (bottomY >= 0 && bottomY < grid.length && x >= 0 && x < grid[0].length) {
        grid[bottomY][x] = true;
      }
    }
  } else {
    // Vertical corridor - walls on left and right
    const centerX = Math.floor((minX + maxX) / 2);

    for (let y = minY; y <= maxY; y++) {
      const leftX = centerX - halfWidth - 1;
      const rightX = centerX + halfWidth + 1;

      if (y >= 0 && y < grid.length && leftX >= 0 && leftX < grid[0].length) {
        grid[y][leftX] = true;
      }
      if (y >= 0 && y < grid.length && rightX >= 0 && rightX < grid[0].length) {
        grid[y][rightX] = true;
      }
    }
  }
}

/**
 * Generate wall layer using auto-tiling
 *
 * @param wallGrid - Boolean grid of wall positions
 * @param mapping - Tile mapping configuration
 * @param options - Wall placement options
 * @returns Flat array of wall tile IDs
 */
export function generateWallLayer(
  wallGrid: boolean[][],
  mapping: TileMapping,
  options: WallOptions = {}
): number[] {
  return autoTileWalls(wallGrid, mapping);
}

/**
 * Generate shadow layer for walls
 * Shadows are placed adjacent to walls to create depth
 *
 * @param wallGrid - Boolean grid of wall positions
 * @param mapping - Tile mapping configuration
 * @param offset - Shadow offset (1 = directly adjacent)
 * @returns Flat array of shadow tile IDs
 */
export function generateShadowLayer(
  wallGrid: boolean[][],
  mapping: TileMapping,
  offset: number = 1
): number[] {
  const height = wallGrid.length;
  const width = wallGrid[0]?.length ?? 0;
  const shadowData = new Array(width * height).fill(0);

  if (!mapping.shadowTiles) {
    return shadowData;
  }

  const shadowTileId = mapping.shadowTiles.wallShadow;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Check if there's a wall above this position
      if (y >= offset && wallGrid[y - offset][x]) {
        // This is a position below a wall - place shadow
        if (!wallGrid[y][x]) {
          // Don't place shadow on walls themselves
          shadowData[y * width + x] = shadowTileId;
        }
      }
    }
  }

  return shadowData;
}

/**
 * Remove wall tiles at door positions
 * Creates openings in walls for doors
 *
 * @param wallGrid - Boolean grid of wall positions (modified in place)
 * @param doorPositions - Positions where doors should be
 * @param doorWidth - Width of door opening (default 1)
 */
export function cutDoorOpenings(
  wallGrid: boolean[][],
  doorPositions: Array<{ x: number; y: number; direction?: Direction }>,
  doorWidth: number = 1
): void {
  const height = wallGrid.length;
  const width = wallGrid[0]?.length ?? 0;

  for (const door of doorPositions) {
    const { x, y, direction } = door;

    // Remove wall at door position
    if (x >= 0 && x < width && y >= 0 && y < height) {
      wallGrid[y][x] = false;

      // Optionally widen door opening
      if (doorWidth > 1) {
        const halfWidth = Math.floor(doorWidth / 2);

        if (direction === Direction.North || direction === Direction.South) {
          // Horizontal opening for vertical doors
          for (let dx = -halfWidth; dx <= halfWidth; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < width) {
              wallGrid[y][nx] = false;
            }
          }
        } else {
          // Vertical opening for horizontal doors
          for (let dy = -halfWidth; dy <= halfWidth; dy++) {
            const ny = y + dy;
            if (ny >= 0 && ny < height) {
              wallGrid[ny][x] = false;
            }
          }
        }
      }
    }
  }
}

/**
 * Create inner walls for large rooms (decorative)
 * Useful for creating cubicles or subdivisions
 *
 * @param room - Room to add inner walls to
 * @param wallGrid - Boolean grid of wall positions (modified in place)
 * @param pattern - Inner wall pattern ('grid', 'vertical', 'horizontal')
 * @param spacing - Spacing between inner walls
 */
export function addInnerWalls(
  room: Room,
  wallGrid: boolean[][],
  pattern: 'grid' | 'vertical' | 'horizontal',
  spacing: number = 4
): void {
  const { x, y, width, height } = room.bounds;
  const gridHeight = wallGrid.length;
  const gridWidth = wallGrid[0]?.length ?? 0;

  if (pattern === 'grid' || pattern === 'vertical') {
    // Add vertical inner walls
    for (let rx = x + spacing; rx < x + width - 1; rx += spacing) {
      for (let ry = y + 1; ry < y + height - 1; ry++) {
        if (rx >= 0 && rx < gridWidth && ry >= 0 && ry < gridHeight) {
          wallGrid[ry][rx] = true;
        }
      }
    }
  }

  if (pattern === 'grid' || pattern === 'horizontal') {
    // Add horizontal inner walls
    for (let ry = y + spacing; ry < y + height - 1; ry += spacing) {
      for (let rx = x + 1; rx < x + width - 1; rx++) {
        if (rx >= 0 && rx < gridWidth && ry >= 0 && ry < gridHeight) {
          wallGrid[ry][rx] = true;
        }
      }
    }
  }
}

/**
 * Detect and mark outer wall edges for special rendering
 * Outer walls are those exposed to empty space
 *
 * @param wallGrid - Boolean grid of wall positions
 * @returns Boolean grid marking outer wall positions
 */
export function detectOuterWalls(wallGrid: boolean[][]): boolean[][] {
  const height = wallGrid.length;
  const width = wallGrid[0]?.length ?? 0;
  const outerWalls: boolean[][] = Array.from({ length: height }, () =>
    Array(width).fill(false)
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (wallGrid[y][x] && isOuterWall(wallGrid, x, y)) {
        outerWalls[y][x] = true;
      }
    }
  }

  return outerWalls;
}

/**
 * Generate collision data from wall grid
 * Returns a flat boolean array for collision detection
 *
 * @param wallGrid - Boolean grid of wall positions
 * @returns Flat boolean array (true = blocked)
 */
export function generateCollisionFromWalls(wallGrid: boolean[][]): boolean[] {
  const height = wallGrid.length;
  const width = wallGrid[0]?.length ?? 0;
  const collision: boolean[] = new Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      collision[y * width + x] = wallGrid[y][x];
    }
  }

  return collision;
}
