/**
 * Tilemap Generator
 *
 * Main entry point for generating complete tilemaps from BSP room layouts.
 * Orchestrates floor, wall, door, and decoration placement.
 */

import {
  Room,
  Corridor,
  TilemapData,
  TilemapLayer,
  TilemapOptions,
  SeededRNG,
  LAYER_NAMES,
} from './types';

import { generateFloorLayer } from './floors';
import {
  generateWallGrid,
  generateWallLayer,
  generateShadowLayer,
  cutDoorOpenings,
  generateCollisionFromWalls,
} from './walls';
import { generateDoors, generateDoorLayer, Door } from './doors';
import {
  generateDecorations,
  generateDecorationLayer,
  addDecorationCollision,
} from './decorations';

/**
 * Result of tilemap generation including all layers and metadata
 */
export interface TilemapGenerationResult {
  /** Complete tilemap data */
  tilemap: TilemapData;
  /** Generated doors for interaction */
  doors: Door[];
  /** Wall grid for debugging/visualization */
  wallGrid: boolean[][];
}

/**
 * Generate a complete tilemap from rooms and corridors
 *
 * This is the main entry point for the tilemap generation system.
 * It orchestrates all subsystems to create a fully playable map.
 *
 * @param rooms - Array of rooms from BSP generation
 * @param corridors - Array of corridors connecting rooms
 * @param rng - Seeded random number generator for reproducibility
 * @param options - Tilemap generation options
 * @returns Complete tilemap data with all layers
 */
export function generateTilemap(
  rooms: Room[],
  corridors: Corridor[],
  rng: SeededRNG,
  options: TilemapOptions
): TilemapGenerationResult {
  // Calculate map dimensions
  const { width, height } = calculateMapDimensions(rooms, corridors);

  const layers: TilemapLayer[] = [];
  const doors: Door[] = [];

  // Determine which layers to generate
  const layerConfig = options.layers ?? {
    ground: true,
    walls: true,
    decorations: true,
    abovePlayer: true,
  };

  // ===== GROUND LAYER =====
  let floorData: number[] = [];
  if (layerConfig.ground) {
    floorData = generateFloorLayer(
      rooms,
      corridors,
      width,
      height,
      options.tileMapping,
      rng,
      {
        includeTransitions: true,
      }
    );

    layers.push({
      name: LAYER_NAMES.GROUND,
      data: floorData,
      width,
      height,
      visible: true,
      opacity: 1,
      zIndex: 0,
    });
  }

  // ===== WALL LAYER =====
  let wallGrid: boolean[][] = [];
  let collision: boolean[] = [];

  if (layerConfig.walls) {
    // Generate doors first so we can cut openings
    doors.push(...generateDoors(rooms, corridors, options.tileMapping));

    // Generate wall grid
    wallGrid = generateWallGrid(rooms, corridors, width, height, floorData);

    // Cut door openings in walls
    cutDoorOpenings(
      wallGrid,
      doors.map((d) => ({
        x: d.position.x,
        y: d.position.y,
        direction: d.direction,
      }))
    );

    // Generate auto-tiled wall layer
    const wallData = generateWallLayer(wallGrid, options.tileMapping, {
      includeShadows: options.includeShadows,
    });

    layers.push({
      name: LAYER_NAMES.WALLS,
      data: wallData,
      width,
      height,
      visible: true,
      opacity: 1,
      zIndex: 1,
    });

    // Generate collision data from walls
    collision = generateCollisionFromWalls(wallGrid);

    // Optional: Shadow layer
    if (options.includeShadows && options.tileMapping.shadowTiles) {
      const shadowData = generateShadowLayer(wallGrid, options.tileMapping);

      layers.push({
        name: 'shadows',
        data: shadowData,
        width,
        height,
        visible: true,
        opacity: 0.5,
        zIndex: 2,
      });
    }
  } else {
    // If walls not generated, still need collision data
    wallGrid = Array.from({ length: height }, () => Array(width).fill(false));
    collision = new Array(width * height).fill(false);
  }

  // ===== DOOR LAYER =====
  if (doors.length > 0) {
    const doorData = generateDoorLayer(
      doors,
      width,
      height,
      options.tileMapping
    );

    layers.push({
      name: 'doors',
      data: doorData,
      width,
      height,
      visible: true,
      opacity: 1,
      zIndex: 3,
    });
  }

  // ===== DECORATION LAYER =====
  if (layerConfig.decorations && options.includeDecorations) {
    const decorations = generateDecorations(
      rooms,
      wallGrid,
      width,
      height,
      rng,
      {
        density: options.decorationDensity ?? 1.0,
      }
    );

    const decorationData = generateDecorationLayer(decorations, width, height);

    layers.push({
      name: LAYER_NAMES.DECORATIONS,
      data: decorationData,
      width,
      height,
      visible: true,
      opacity: 1,
      zIndex: 4,
    });

    // Update collision with decorations
    addDecorationCollision(decorations, collision, width);
  }

  // ===== ABOVE PLAYER LAYER =====
  // This layer renders on top of the player (e.g., ceiling beams, overhead decorations)
  if (layerConfig.abovePlayer) {
    const aboveData = new Array(width * height).fill(0);

    layers.push({
      name: LAYER_NAMES.ABOVE_PLAYER,
      data: aboveData,
      width,
      height,
      visible: true,
      opacity: 1,
      zIndex: 10,
    });
  }

  // ===== CONSTRUCT FINAL TILEMAP =====
  const tilemap: TilemapData = {
    width,
    height,
    tileWidth: options.tileWidth,
    tileHeight: options.tileHeight,
    layers,
    collision,
    properties: {
      ...options.properties,
      roomCount: rooms.length,
      corridorCount: corridors.length,
      doorCount: doors.length,
      seed: rng.getSeed(),
    },
  };

  return {
    tilemap,
    doors,
    wallGrid,
  };
}

/**
 * Calculate the dimensions needed to fit all rooms and corridors
 *
 * @param rooms - Array of rooms
 * @param corridors - Array of corridors
 * @param padding - Extra padding around the map
 * @returns Map width and height
 */
export function calculateMapDimensions(
  rooms: Room[],
  corridors: Corridor[],
  padding: number = 2
): { width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Check rooms
  for (const room of rooms) {
    const { x, y, width, height } = room.bounds;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  // Check corridors
  for (const corridor of corridors) {
    const points = [corridor.start, corridor.end];

    if (corridor.segments) {
      for (const segment of corridor.segments) {
        points.push(segment.start, segment.end);
      }
    }

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  // Handle empty inputs - return minimum dimensions
  if (minX === Infinity || maxX === -Infinity) {
    return { width: padding * 2 + 1, height: padding * 2 + 1 };
  }

  // Add padding
  return {
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/**
 * Create a simple seeded RNG implementation for testing
 * Uses a basic Linear Congruential Generator (LCG)
 *
 * @param seed - String or number seed
 * @returns SeededRNG instance
 */
export function createSeededRNG(seed: string | number): SeededRNG {
  // Convert string seed to number
  let state = typeof seed === 'string'
    ? seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : seed;

  const originalSeed = String(seed);

  // LCG parameters (same as Java's Random)
  const a = 1103515245;
  const c = 12345;
  const m = 2 ** 31;

  function next(): number {
    state = (a * state + c) % m;
    return state / m;
  }

  return {
    random(): number {
      return next();
    },

    randomInt(min: number, max: number): number {
      return Math.floor(next() * (max - min)) + min;
    },

    pick<T>(array: T[]): T {
      const index = Math.floor(next() * array.length);
      return array[index];
    },

    shuffle<T>(array: T[]): T[] {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },

    getSeed(): string {
      return originalSeed;
    },
  };
}

/**
 * Validate tilemap data integrity
 *
 * @param tilemap - Tilemap to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateTilemap(tilemap: TilemapData): string[] {
  const errors: string[] = [];

  // Check dimensions
  if (tilemap.width <= 0 || tilemap.height <= 0) {
    errors.push('Invalid map dimensions');
  }

  if (tilemap.tileWidth <= 0 || tilemap.tileHeight <= 0) {
    errors.push('Invalid tile dimensions');
  }

  // Check layers
  if (!tilemap.layers || tilemap.layers.length === 0) {
    errors.push('No layers defined');
  }

  for (const layer of tilemap.layers) {
    if (layer.width !== tilemap.width || layer.height !== tilemap.height) {
      errors.push(`Layer ${layer.name} has mismatched dimensions`);
    }

    const expectedSize = tilemap.width * tilemap.height;
    if (layer.data.length !== expectedSize) {
      errors.push(
        `Layer ${layer.name} has incorrect data size: expected ${expectedSize}, got ${layer.data.length}`
      );
    }
  }

  // Check collision
  const expectedCollisionSize = tilemap.width * tilemap.height;
  if (tilemap.collision.length !== expectedCollisionSize) {
    errors.push(
      `Collision data has incorrect size: expected ${expectedCollisionSize}, got ${tilemap.collision.length}`
    );
  }

  return errors;
}

/**
 * Get a tile ID at a specific position in a layer
 *
 * @param layer - Tilemap layer
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Tile ID or 0 if out of bounds
 */
export function getTileAt(
  layer: TilemapLayer,
  x: number,
  y: number
): number {
  if (x < 0 || x >= layer.width || y < 0 || y >= layer.height) {
    return 0;
  }

  return layer.data[y * layer.width + x];
}

/**
 * Set a tile ID at a specific position in a layer
 *
 * @param layer - Tilemap layer (modified in place)
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param tileId - Tile ID to set
 */
export function setTileAt(
  layer: TilemapLayer,
  x: number,
  y: number,
  tileId: number
): void {
  if (x < 0 || x >= layer.width || y < 0 || y >= layer.height) {
    return;
  }

  layer.data[y * layer.width + x] = tileId;
}

/**
 * Find a layer by name
 *
 * @param tilemap - Tilemap to search
 * @param layerName - Name of the layer
 * @returns Layer or undefined if not found
 */
export function findLayer(
  tilemap: TilemapData,
  layerName: string
): TilemapLayer | undefined {
  return tilemap.layers.find((layer) => layer.name === layerName);
}
