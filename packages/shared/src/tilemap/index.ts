/**
 * Tilemap Generation System
 *
 * Public API for procedural tilemap generation for the AI Agent Village Monitor RPG.
 *
 * @example
 * ```typescript
 * import { generateTilemap, createSeededRNG, createDefaultTileMapping } from './tilemap';
 *
 * const rooms = [...]; // From BSP generation
 * const corridors = [...];
 * const rng = createSeededRNG('my-seed');
 *
 * const options = {
 *   tileWidth: 16,
 *   tileHeight: 16,
 *   tileMapping: createDefaultTileMapping(),
 *   includeDecorations: true,
 * };
 *
 * const { tilemap, doors } = generateTilemap(rooms, corridors, rng, options);
 * ```
 */

// Core types
export type {
  TilemapLayer,
  TilemapData,
  TilesetReference,
  TileMapping,
  Room,
  RoomType,
  Corridor,
  CorridorSegment,
  Rectangle,
  Decoration,
  DecorationCatalog,
  DecorationItem,
  SeededRNG,
  TilemapOptions,
  PlacementRule,
} from './types';

export { Direction, AUTOTILE_MASKS, DEFAULT_TILE_IDS, LAYER_NAMES } from './types';

// Generator
export {
  generateTilemap,
  calculateMapDimensions,
  createSeededRNG,
  validateTilemap,
  getTileAt,
  setTileAt,
  findLayer,
} from './generator';

export type { TilemapGenerationResult } from './generator';

// Auto-tiling
export {
  calculateWallMask,
  getWallTileId,
  autoTileWalls,
  calculateExtendedMask,
  isOuterWall,
  detectCornerType,
  createDefaultTileMapping,
  visualizeMask,
  describeMask,
} from './autoTile';

// Floors
export {
  placeRoomFloor,
  placeCorridorFloor,
  placeTransitionTiles,
  generateFloorLayer,
  createCheckerboardFloor,
  fillRectWithFloor,
  DEFAULT_FLOOR_STYLES,
} from './floors';

export type { FloorStyle } from './floors';

// Walls
export {
  generateWallGrid,
  generateWallLayer,
  generateShadowLayer,
  cutDoorOpenings,
  addInnerWalls,
  detectOuterWalls,
  generateCollisionFromWalls,
} from './walls';

export type { WallOptions } from './walls';

// Doors
export {
  findDoorPositions,
  findRoomDoorPosition,
  placeDoorTiles,
  createDoor,
  generateDoors,
  generateDoorLayer,
  isInInteractionZone,
  getDoorTileForState,
  createDoorFrame,
} from './doors';

export type { Door } from './doors';

// Decorations
export {
  canPlaceDecoration,
  placeRoomDecorations,
  generateDecorations,
  generateDecorationLayer,
  addDecorationCollision,
  DEFAULT_DECORATION_CATALOGS,
} from './decorations';

// Phaser Export
export {
  exportToPhaser,
  exportToPhaserJSON,
  importFromPhaser,
  createPhaserConfig,
  generatePhaserLoadCode,
} from './phaserExport';
