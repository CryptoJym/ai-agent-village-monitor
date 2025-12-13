/**
 * Floor Tile Placement System
 *
 * Handles placement of floor tiles for rooms and corridors.
 * Different room types can have different floor tile styles.
 */

import {
  Room,
  Corridor,
  TileMapping,
  RoomType,
  SeededRNG,
  Rectangle,
} from './types';

/**
 * Floor tile style configuration for different room types
 */
export interface FloorStyle {
  /** Primary floor tile ID */
  primary: number;
  /** Alternate tile IDs for variation */
  alternates?: number[];
  /** Probability of using alternate tiles (0-1) */
  variationChance?: number;
}

/**
 * Default floor styles for each room type
 */
export const DEFAULT_FLOOR_STYLES: Record<RoomType, FloorStyle> = {
  workspace: {
    primary: 1,
    alternates: [2, 3],
    variationChance: 0.1,
  },
  library: {
    primary: 4,
    alternates: [5],
    variationChance: 0.15,
  },
  vault: {
    primary: 6,
    alternates: [7, 8],
    variationChance: 0.05,
  },
  laboratory: {
    primary: 9,
    alternates: [10, 11],
    variationChance: 0.12,
  },
  hallway: {
    primary: 2,
    alternates: [],
    variationChance: 0,
  },
  entrance: {
    primary: 12,
    alternates: [13, 14],
    variationChance: 0.2,
  },
};

/**
 * Place floor tiles for a single room
 *
 * @param room - Room to fill with floor tiles
 * @param floorData - Flat array of tile IDs (modified in place)
 * @param width - Map width in tiles
 * @param height - Map height in tiles
 * @param mapping - Tile mapping configuration
 * @param rng - Random number generator
 * @param styles - Floor style overrides
 */
export function placeRoomFloor(
  room: Room,
  floorData: number[],
  width: number,
  height: number,
  mapping: TileMapping,
  rng: SeededRNG,
  styles: Partial<Record<RoomType, FloorStyle>> = {}
): void {
  const style = styles[room.type] ?? DEFAULT_FLOOR_STYLES[room.type];
  const { x, y, width: roomWidth, height: roomHeight } = room.bounds;

  // Fill room interior with floor tiles (leaving 1-tile border for walls)
  for (let ry = y + 1; ry < y + roomHeight - 1; ry++) {
    for (let rx = x + 1; rx < x + roomWidth - 1; rx++) {
      // Bounds check
      if (rx < 0 || rx >= width || ry < 0 || ry >= height) {
        continue;
      }

      const index = ry * width + rx;

      // Choose tile with variation
      let tileId = style.primary;

      if (
        style.alternates &&
        style.alternates.length > 0 &&
        style.variationChance &&
        rng.random() < style.variationChance
      ) {
        tileId = rng.pick(style.alternates);
      }

      floorData[index] = tileId;
    }
  }
}

/**
 * Place floor tiles for a corridor
 *
 * @param corridor - Corridor to fill with floor tiles
 * @param floorData - Flat array of tile IDs (modified in place)
 * @param width - Map width in tiles
 * @param height - Map height in tiles
 * @param mapping - Tile mapping configuration
 */
export function placeCorridorFloor(
  corridor: Corridor,
  floorData: number[],
  width: number,
  height: number,
  mapping: TileMapping
): void {
  const corridorTile = mapping.floorTiles[1] ?? 2; // Corridor-specific tile

  if (corridor.segments && corridor.segments.length > 0) {
    // Handle L-shaped corridors with segments
    for (const segment of corridor.segments) {
      placeCorridorSegmentFloor(
        segment.start,
        segment.end,
        corridor.width,
        corridorTile,
        floorData,
        width,
        height
      );
    }
  } else {
    // Simple straight corridor
    placeCorridorSegmentFloor(
      corridor.start,
      corridor.end,
      corridor.width,
      corridorTile,
      floorData,
      width,
      height
    );
  }
}

/**
 * Place floor tiles for a single corridor segment
 */
function placeCorridorSegmentFloor(
  start: { x: number; y: number },
  end: { x: number; y: number },
  corridorWidth: number,
  tileId: number,
  floorData: number[],
  mapWidth: number,
  mapHeight: number
): void {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  // Determine if horizontal or vertical
  const isHorizontal = Math.abs(end.x - start.x) > Math.abs(end.y - start.y);

  if (isHorizontal) {
    // Horizontal corridor
    const centerY = Math.floor((minY + maxY) / 2);
    const halfWidth = Math.floor(corridorWidth / 2);

    for (let x = minX; x <= maxX; x++) {
      for (let dy = -halfWidth; dy <= halfWidth; dy++) {
        const y = centerY + dy;
        if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
          floorData[y * mapWidth + x] = tileId;
        }
      }
    }
  } else {
    // Vertical corridor
    const centerX = Math.floor((minX + maxX) / 2);
    const halfWidth = Math.floor(corridorWidth / 2);

    for (let y = minY; y <= maxY; y++) {
      for (let dx = -halfWidth; dx <= halfWidth; dx++) {
        const x = centerX + dx;
        if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
          floorData[y * mapWidth + x] = tileId;
        }
      }
    }
  }
}

/**
 * Place transition tiles at doorways
 * Creates a smooth visual transition between rooms and corridors
 *
 * @param doorPositions - Array of door positions
 * @param floorData - Flat array of tile IDs (modified in place)
 * @param width - Map width in tiles
 * @param height - Map height in tiles
 * @param transitionTileId - Tile ID to use for transitions
 */
export function placeTransitionTiles(
  doorPositions: Array<{ x: number; y: number }>,
  floorData: number[],
  width: number,
  height: number,
  transitionTileId: number
): void {
  for (const door of doorPositions) {
    const { x, y } = door;

    // Place transition tile at door position and adjacent tiles
    const positions = [
      { x, y },
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 },
    ];

    for (const pos of positions) {
      if (pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height) {
        const index = pos.y * width + pos.x;
        // Only place if there's already a floor tile
        if (floorData[index] > 0) {
          floorData[index] = transitionTileId;
        }
      }
    }
  }
}

/**
 * Generate complete floor layer for all rooms and corridors
 *
 * @param rooms - All rooms in the map
 * @param corridors - All corridors in the map
 * @param width - Map width in tiles
 * @param height - Map height in tiles
 * @param mapping - Tile mapping configuration
 * @param rng - Random number generator
 * @param options - Optional configuration
 * @returns Flat array of floor tile IDs
 */
export function generateFloorLayer(
  rooms: Room[],
  corridors: Corridor[],
  width: number,
  height: number,
  mapping: TileMapping,
  rng: SeededRNG,
  options: {
    styles?: Partial<Record<RoomType, FloorStyle>>;
    includeTransitions?: boolean;
    transitionTileId?: number;
  } = {}
): number[] {
  const floorData = new Array(width * height).fill(0);

  // Place room floors
  for (const room of rooms) {
    placeRoomFloor(room, floorData, width, height, mapping, rng, options.styles);
  }

  // Place corridor floors
  for (const corridor of corridors) {
    placeCorridorFloor(corridor, floorData, width, height, mapping);
  }

  // Optionally place transition tiles at doorways
  if (options.includeTransitions && options.transitionTileId) {
    // Extract door positions from rooms/corridors
    // (This would be integrated with door placement system)
    // For now, this is a placeholder
  }

  return floorData;
}

/**
 * Create a checkerboard pattern floor (useful for testing)
 *
 * @param width - Map width in tiles
 * @param height - Map height in tiles
 * @param tile1 - First tile ID
 * @param tile2 - Second tile ID
 * @returns Flat array of floor tile IDs in checkerboard pattern
 */
export function createCheckerboardFloor(
  width: number,
  height: number,
  tile1: number = 1,
  tile2: number = 2
): number[] {
  const floorData = new Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isEven = (x + y) % 2 === 0;
      floorData[y * width + x] = isEven ? tile1 : tile2;
    }
  }

  return floorData;
}

/**
 * Fill a rectangular area with a specific floor tile
 *
 * @param bounds - Rectangle to fill
 * @param floorData - Flat array of tile IDs (modified in place)
 * @param width - Map width in tiles
 * @param height - Map height in tiles
 * @param tileId - Tile ID to fill with
 */
export function fillRectWithFloor(
  bounds: Rectangle,
  floorData: number[],
  width: number,
  height: number,
  tileId: number
): void {
  const { x, y, width: rectWidth, height: rectHeight } = bounds;

  for (let ry = y; ry < y + rectHeight; ry++) {
    for (let rx = x; rx < x + rectWidth; rx++) {
      if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
        floorData[ry * width + rx] = tileId;
      }
    }
  }
}
