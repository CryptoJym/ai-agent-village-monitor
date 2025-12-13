/**
 * Types for BSP Building Generation
 */

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface BSPNode {
  bounds: Bounds;
  left?: BSPNode;
  right?: BSPNode;
  room?: RoomData;
  isLeaf: boolean;
  depth: number;
}

export type RoomType =
  | 'entrance'
  | 'hallway'
  | 'workspace'
  | 'library'
  | 'vault'
  | 'laboratory'
  | 'archive';

export type ModuleType =
  | 'component'
  | 'service'
  | 'repository'
  | 'controller'
  | 'utility'
  | 'config'
  | 'type_def'
  | 'test'
  | 'asset'
  | 'root';

export interface RoomData {
  id: string;
  name: string;
  bounds: Bounds;
  center: Point;
  roomType: RoomType;
  moduleType?: ModuleType;
  modulePath?: string;
  fileCount?: number;
  totalSize?: number;
  complexity?: number;
  doors: DoorData[];
  decorations: DecorationData[];
}

export interface DoorData {
  x: number;
  y: number;
  direction: 'north' | 'south' | 'east' | 'west';
  connectsTo?: string; // Room ID
}

export interface DecorationData {
  type: string;
  x: number;
  y: number;
  tileId?: number;
  rotation?: number;
}

export interface CorridorData {
  id: string;
  fromRoomId: string;
  toRoomId: string;
  path: Point[];
  width: number;
}

export interface Edge {
  from: Point;
  to: Point;
  fromRoomId: string;
  toRoomId: string;
  distance: number;
}

export interface BSPOptions {
  minRoomSize: number;
  maxRoomSize?: number;
  splitRatioMin: number;
  splitRatioMax: number;
  maxDepth: number;
  roomMargin: number;
  corridorWidth: number;
  extraEdgeRatio: number; // 0.3 = add 30% extra edges for loops
}

export const DEFAULT_BSP_OPTIONS: BSPOptions = {
  minRoomSize: 6,
  maxRoomSize: 20,
  splitRatioMin: 0.45,
  splitRatioMax: 0.55,
  maxDepth: 6,
  roomMargin: 1,
  corridorWidth: 2,
  extraEdgeRatio: 0.3,
};

export interface ModuleInfo {
  path: string;
  name: string;
  type: ModuleType;
  fileCount: number;
  totalSize: number;
  complexity: number; // 1-10
  imports: string[];
  exports: string[];
}

export interface BuildingGenerationInput {
  repoId: string;
  commitSha?: string;
  modules: ModuleInfo[];
  buildingWidth: number;
  buildingHeight: number;
  options?: Partial<BSPOptions>;
}

export interface BuildingGenerationOutput {
  seed: string;
  bspTree: BSPNode;
  rooms: RoomData[];
  corridors: CorridorData[];
  tilemap: TilemapData;
}

export interface TilemapLayer {
  name: string;
  data: number[];
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
}

export interface TilemapData {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  layers: TilemapLayer[];
  collision: boolean[];
  properties: Record<string, unknown>;
}

/**
 * Map ModuleType to RoomType
 */
export function moduleTypeToRoomType(moduleType: ModuleType): RoomType {
  switch (moduleType) {
    case 'component':
    case 'service':
    case 'controller':
      return 'workspace';
    case 'utility':
    case 'repository':
      return 'library';
    case 'config':
      return 'vault';
    case 'test':
      return 'laboratory';
    case 'asset':
    case 'type_def':
      return 'archive';
    case 'root':
      return 'entrance';
    default:
      return 'workspace';
  }
}

/**
 * Calculate room size based on module complexity
 */
export function calculateRoomSize(
  module: ModuleInfo,
  options: BSPOptions
): { width: number; height: number } {
  const { minRoomSize, maxRoomSize = 20 } = options;

  // Scale based on complexity (1-10 -> minRoomSize to maxRoomSize)
  const complexityFactor = (module.complexity - 1) / 9;
  const baseSize = minRoomSize + complexityFactor * (maxRoomSize - minRoomSize);

  // Add some variation based on file count
  const fileBonus = Math.min(2, Math.floor(module.fileCount / 10));

  const size = Math.round(baseSize + fileBonus);

  return {
    width: Math.max(minRoomSize, Math.min(maxRoomSize, size)),
    height: Math.max(minRoomSize, Math.min(maxRoomSize, size)),
  };
}
