/**
 * Building Generator Service
 * Orchestrates the full BSP building generation pipeline
 * Modules -> BSP -> Rooms -> Corridors -> Tilemap
 */

import { PrismaClient, BuildingSize } from '@prisma/client';
import { SeededRNG } from '../../../shared/src/generation/rng';
import { generateBSPTree } from '../../../shared/src/generation/bsp';
import { placeRoomsInBSP } from '../../../shared/src/generation/rooms';
import { generateCorridors, validateConnectivity } from '../../../shared/src/generation/corridors';
import {
  ModuleInfo,
  BuildingGenerationInput,
  BuildingGenerationOutput,
  TilemapData,
} from '../../../shared/src/generation/types';

const prisma = new PrismaClient();

/**
 * Building dimensions based on size
 */
const BUILDING_DIMENSIONS: Record<BuildingSize, { width: number; height: number }> = {
  tiny: { width: 24, height: 24 },
  small: { width: 32, height: 32 },
  medium: { width: 48, height: 48 },
  large: { width: 64, height: 64 },
  huge: { width: 96, height: 96 },
};

/**
 * Determine building size based on complexity score
 */
export function determineBuildingSize(complexityScore: number): BuildingSize {
  if (complexityScore < 10) return 'tiny';
  if (complexityScore < 30) return 'small';
  if (complexityScore < 80) return 'medium';
  if (complexityScore < 200) return 'large';
  return 'huge';
}

/**
 * Calculate complexity score from modules
 */
export function calculateComplexityScore(modules: ModuleInfo[]): number {
  const totalFiles = modules.reduce((sum, m) => sum + m.fileCount, 0);
  const avgComplexity =
    modules.length > 0 ? modules.reduce((sum, m) => sum + m.complexity, 0) / modules.length : 0;

  // Score = fileCount * 0.6 + avgComplexity * modules.length * 0.4
  return Math.round(totalFiles * 0.6 + avgComplexity * modules.length * 0.4);
}

/**
 * Generate complete building interior
 */
export async function generateBuilding(
  input: BuildingGenerationInput,
): Promise<BuildingGenerationOutput> {
  const { repoId, commitSha, modules, buildingWidth, buildingHeight, options } = input;

  // Create deterministic seed
  const seed = SeededRNG.generateSeed(repoId, commitSha || 'default');
  const rng = new SeededRNG(seed);

  // 1. Generate BSP tree
  const bspTree = generateBSPTree(buildingWidth, buildingHeight, rng, options);

  // 2. Place rooms in BSP leaves
  const rooms = placeRoomsInBSP(bspTree, modules, rng, options);

  // 3. Generate corridors connecting rooms
  const corridors = generateCorridors(rooms, rng, options);

  // 4. Validate connectivity
  const isConnected = validateConnectivity(rooms, corridors);
  if (!isConnected) {
    console.warn(`Building ${repoId} has disconnected rooms`);
  }

  // 5. Generate tilemap
  const tilemap = generateTilemap(buildingWidth, buildingHeight, rooms, corridors);

  return {
    seed,
    bspTree,
    rooms,
    corridors,
    tilemap,
  };
}

/**
 * Generate tilemap from rooms and corridors
 */
function generateTilemap(
  width: number,
  height: number,
  rooms: any[],
  corridors: any[],
): TilemapData {
  // Initialize layers
  const groundData = new Array(width * height).fill(0); // 0 = empty/void
  const wallData = new Array(width * height).fill(0);
  const objectData = new Array(width * height).fill(0);
  const collision = new Array(width * height).fill(true); // true = blocked

  // Fill rooms
  for (const room of rooms) {
    const { bounds } = room;
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = y * width + x;
          groundData[idx] = 1; // 1 = floor tile
          collision[idx] = false; // Rooms are passable
        }
      }
    }
  }

  // Carve corridors
  for (const corridor of corridors) {
    const { path, width: corridorWidth } = corridor;
    const halfWidth = Math.floor(corridorWidth / 2);

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];

      // Carve line between points
      const dx = Math.abs(to.x - from.x);
      const dy = Math.abs(to.y - from.y);
      const steps = Math.max(dx, dy);

      for (let step = 0; step <= steps; step++) {
        const t = steps === 0 ? 0 : step / steps;
        const cx = Math.round(from.x + (to.x - from.x) * t);
        const cy = Math.round(from.y + (to.y - from.y) * t);

        // Carve with width
        for (let wx = -halfWidth; wx <= halfWidth; wx++) {
          for (let wy = -halfWidth; wy <= halfWidth; wy++) {
            const x = cx + wx;
            const y = cy + wy;

            if (x >= 0 && x < width && y >= 0 && y < height) {
              const idx = y * width + x;
              groundData[idx] = 1; // Floor
              collision[idx] = false; // Passable
            }
          }
        }
      }
    }
  }

  // Add walls around rooms and corridors using auto-tiling
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (collision[idx]) {
        // Check if adjacent to a passable tile
        const hasPassableNeighbor =
          (x > 0 && !collision[y * width + (x - 1)]) ||
          (x < width - 1 && !collision[y * width + (x + 1)]) ||
          (y > 0 && !collision[(y - 1) * width + x]) ||
          (y < height - 1 && !collision[(y + 1) * width + x]);

        if (hasPassableNeighbor) {
          wallData[idx] = 1; // Wall tile
        }
      }
    }
  }

  return {
    width,
    height,
    tileWidth: 16,
    tileHeight: 16,
    layers: [
      {
        name: 'ground',
        data: groundData,
        width,
        height,
        visible: true,
        opacity: 1,
      },
      {
        name: 'walls',
        data: wallData,
        width,
        height,
        visible: true,
        opacity: 1,
      },
      {
        name: 'objects',
        data: objectData,
        width,
        height,
        visible: true,
        opacity: 1,
      },
    ],
    collision,
    properties: {},
  };
}

/**
 * Save building to database
 */
export async function saveBuildingToDatabase(
  houseId: string,
  output: BuildingGenerationOutput,
  buildingSize: BuildingSize,
): Promise<void> {
  const { seed, rooms, corridors, tilemap } = output;

  // Update house with building data
  await prisma.house.update({
    where: { id: houseId },
    data: {
      seed,
      buildingSize,
      interiorWidth: tilemap.width,
      interiorHeight: tilemap.height,
      interiorTilemap: tilemap as any, // JSON
      tilesetId: 'default',
    },
  });

  // Delete existing rooms
  await prisma.room.deleteMany({
    where: { houseId },
  });

  // Create room records
  for (const room of rooms) {
    await prisma.room.create({
      data: {
        houseId,
        name: room.name,
        roomType: room.roomType,
        moduleType: room.moduleType,
        modulePath: room.modulePath,
        x: room.bounds.x,
        y: room.bounds.y,
        width: room.bounds.width,
        height: room.bounds.height,
        doors: room.doors as any, // JSON
        corridorData: corridors.filter(
          (c) => c.fromRoomId === room.id || c.toRoomId === room.id,
        ) as any, // JSON
        decorations: room.decorations as any, // JSON
        fileCount: room.fileCount,
        totalSize: room.totalSize,
        complexity: room.complexity,
        imports: room.moduleType ? [] : undefined, // TODO: Extract from module analysis
        exports: room.moduleType ? [] : undefined, // TODO: Extract from module analysis
      },
    });
  }
}

/**
 * Generate and save building for a house
 */
export async function generateAndSaveBuilding(
  houseId: string,
  repoId: string,
  commitSha: string | null,
  modules: ModuleInfo[],
): Promise<BuildingGenerationOutput> {
  // Calculate complexity and determine size
  const complexityScore = calculateComplexityScore(modules);
  const buildingSize = determineBuildingSize(complexityScore);
  const dimensions = BUILDING_DIMENSIONS[buildingSize];

  // Generate building
  const output = await generateBuilding({
    repoId,
    commitSha: commitSha || undefined,
    modules,
    buildingWidth: dimensions.width,
    buildingHeight: dimensions.height,
    options: {
      minRoomSize: 6,
      maxRoomSize: 20,
      splitRatioMin: 0.45,
      splitRatioMax: 0.55,
      maxDepth: 6,
      roomMargin: 1,
      corridorWidth: 2,
      extraEdgeRatio: 0.3,
    },
  });

  // Save to database
  await saveBuildingToDatabase(houseId, output, buildingSize);

  return output;
}

/**
 * Regenerate building (useful for debugging or re-analysis)
 */
export async function regenerateBuilding(houseId: string): Promise<BuildingGenerationOutput> {
  const house = await prisma.house.findUnique({
    where: { id: houseId },
    include: {
      rooms: true,
    },
  });

  if (!house) {
    throw new Error(`House ${houseId} not found`);
  }

  // TODO: Fetch modules from repository analysis
  // For now, use existing rooms as modules
  const modules: ModuleInfo[] = house.rooms.map((room) => ({
    path: room.modulePath || '',
    name: room.name,
    type: room.moduleType || 'root',
    fileCount: room.fileCount || 1,
    totalSize: room.totalSize || 1000,
    complexity: room.complexity || 5,
    imports: [],
    exports: [],
  }));

  return generateAndSaveBuilding(
    houseId,
    String(house.githubRepoId || house.id),
    house.commitSha,
    modules,
  );
}

export default {
  generateBuilding,
  generateAndSaveBuilding,
  regenerateBuilding,
  determineBuildingSize,
  calculateComplexityScore,
};
