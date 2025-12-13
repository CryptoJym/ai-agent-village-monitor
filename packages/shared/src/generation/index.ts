/**
 * Building Generation Module
 * Orchestrates BSP tree -> Room placement -> Corridor generation
 */

// Re-export all types
export * from './types';

// Re-export RNG
export { SeededRNG } from './rng';

// Re-export BSP
export {
  generateBSPTree,
  getLeafNodes,
  countLeafNodes,
  getTreeDepth,
  traverseBSP,
  findSibling,
  getNodeAtPosition,
  validateBSPTree,
} from './bsp';

// Re-export Room placement
export {
  placeRoomsInBSP,
  getRoomsFromBSP,
  findRoomById,
  getRoomAtPosition,
  roomDistance,
  findNearestRoom,
  resetRoomIdCounter,
} from './rooms';

// Re-export Corridor generation
export {
  generateCorridors,
  carveCorridorIntoGrid,
  validateConnectivity,
  resetCorridorIdCounter,
} from './corridors';

// Import for building generator
import { SeededRNG } from './rng';
import { generateBSPTree } from './bsp';
import { placeRoomsInBSP, resetRoomIdCounter } from './rooms';
import { generateCorridors, validateConnectivity, resetCorridorIdCounter } from './corridors';
import {
  BuildingGenerationInput,
  BuildingGenerationOutput,
  BSPOptions,
  DEFAULT_BSP_OPTIONS,
  TilemapData,
  TilemapLayer,
} from './types';

/**
 * Generate a complete building from modules
 * This is the main entry point for building generation
 */
export function generateBuilding(input: BuildingGenerationInput): BuildingGenerationOutput {
  const {
    repoId,
    commitSha,
    modules,
    buildingWidth,
    buildingHeight,
    options = {},
  } = input;

  // Reset ID counters for determinism
  resetRoomIdCounter();
  resetCorridorIdCounter();

  // Create seeded RNG
  const rng = SeededRNG.fromRepoMetadata(repoId, commitSha);

  // Merge options with defaults
  const opts: BSPOptions = { ...DEFAULT_BSP_OPTIONS, ...options };

  // Adjust max depth based on module count
  const targetRooms = modules.length + 1; // +1 for entrance
  const estimatedDepth = Math.ceil(Math.log2(targetRooms)) + 1;
  opts.maxDepth = Math.max(opts.maxDepth, estimatedDepth);

  // Generate BSP tree
  const bspTree = generateBSPTree(buildingWidth, buildingHeight, rng, opts);

  // Place rooms in BSP leaves
  const rooms = placeRoomsInBSP(bspTree, modules, rng, opts);

  // Generate corridors connecting rooms
  const corridors = generateCorridors(rooms, rng, opts);

  // Validate connectivity
  if (!validateConnectivity(rooms, corridors)) {
    console.warn('Building generation: Not all rooms are connected');
  }

  // Generate basic tilemap
  const tilemap = generateBasicTilemap(buildingWidth, buildingHeight, rooms, corridors);

  return {
    seed: rng.getSeed(),
    bspTree,
    rooms,
    corridors,
    tilemap,
  };
}

/**
 * Generate a basic tilemap from rooms and corridors
 * This creates a simple representation - the full tilemap system will add more detail
 */
function generateBasicTilemap(
  width: number,
  height: number,
  rooms: BuildingGenerationOutput['rooms'],
  corridors: BuildingGenerationOutput['corridors']
): TilemapData {
  const tileWidth = 16;
  const tileHeight = 16;

  // Initialize collision grid (true = blocked, false = passable)
  const collision = new Array(width * height).fill(true);

  // Carve out rooms
  for (const room of rooms) {
    const { bounds } = room;
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          collision[y * width + x] = false;
        }
      }
    }
  }

  // Carve out corridors
  for (const corridor of corridors) {
    const halfWidth = Math.floor(corridor.width / 2);
    for (let i = 0; i < corridor.path.length - 1; i++) {
      const from = corridor.path[i];
      const to = corridor.path[i + 1];

      // Simple line carving
      const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        const x = Math.round(from.x + (to.x - from.x) * t);
        const y = Math.round(from.y + (to.y - from.y) * t);

        // Carve corridor width
        for (let wx = -halfWidth; wx <= halfWidth; wx++) {
          for (let wy = -halfWidth; wy <= halfWidth; wy++) {
            const cx = x + wx;
            const cy = y + wy;
            if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
              collision[cy * width + cx] = false;
            }
          }
        }
      }
    }
  }

  // Create ground layer (1 = floor, 0 = void)
  const groundData = collision.map((blocked) => (blocked ? 0 : 1));

  // Create wall layer (2 = wall, 0 = no wall)
  const wallData = new Array(width * height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!collision[idx]) {
        // Check neighbors for walls
        const neighbors = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            wallData[idx] = 2; // Edge of map
            break;
          }
          const nidx = ny * width + nx;
          if (collision[nidx]) {
            wallData[idx] = 2; // Adjacent to blocked
            break;
          }
        }
      }
    }
  }

  const groundLayer: TilemapLayer = {
    name: 'ground',
    data: groundData,
    width,
    height,
    visible: true,
    opacity: 1,
  };

  const wallLayer: TilemapLayer = {
    name: 'walls',
    data: wallData,
    width,
    height,
    visible: true,
    opacity: 1,
  };

  return {
    width,
    height,
    tileWidth,
    tileHeight,
    layers: [groundLayer, wallLayer],
    collision,
    properties: {
      roomCount: rooms.length,
      corridorCount: corridors.length,
    },
  };
}

/**
 * Calculate building size based on module count and complexity
 */
export function calculateBuildingSize(modules: { complexity: number }[]): {
  width: number;
  height: number;
} {
  // Base size
  const baseSize = 40;

  // Add size based on module count
  const moduleBonus = modules.length * 4;

  // Add size based on average complexity
  const avgComplexity = modules.length > 0
    ? modules.reduce((sum, m) => sum + m.complexity, 0) / modules.length
    : 5;
  const complexityBonus = Math.floor(avgComplexity * 2);

  const size = Math.max(40, Math.min(120, baseSize + moduleBonus + complexityBonus));

  return { width: size, height: size };
}

export default generateBuilding;
