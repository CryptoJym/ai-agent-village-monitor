/**
 * Phaser Tilemap Export
 *
 * Converts internal tilemap data to Tiled JSON format compatible with Phaser.
 * Phaser uses the Tiled map editor's JSON format for tilemap loading.
 */

import { TilemapData, TilemapLayer, TilesetReference } from './types';

/**
 * Tiled JSON format structures (subset used by Phaser)
 */

interface TiledLayer {
  id: number;
  name: string;
  type: 'tilelayer' | 'objectgroup';
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data: number[];
  properties?: TiledProperty[];
}

interface TiledTileset {
  firstgid: number;
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  margin?: number;
  spacing?: number;
  tiles?: TiledTileData[];
}

interface TiledTileData {
  id: number;
  properties?: TiledProperty[];
  animation?: Array<{ tileid: number; duration: number }>;
}

interface TiledProperty {
  name: string;
  type: string;
  value: any;
}

interface TiledMap {
  version: string;
  tiledversion: string;
  type: 'map';
  orientation: 'orthogonal' | 'isometric' | 'staggered' | 'hexagonal';
  renderorder: 'right-down' | 'right-up' | 'left-down' | 'left-up';
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  infinite: boolean;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
  nextlayerid: number;
  nextobjectid: number;
}

/**
 * Export tilemap data to Tiled JSON format for Phaser
 *
 * @param tilemap - Internal tilemap data
 * @param tilesetConfig - Optional tileset configuration
 * @returns Tiled JSON format object
 */
export function exportToPhaser(
  tilemap: TilemapData,
  tilesetConfig?: {
    name?: string;
    image?: string;
    tileWidth?: number;
    tileHeight?: number;
    columns?: number;
    tileCount?: number;
  }
): TiledMap {
  // Convert layers
  const tiledLayers: TiledLayer[] = tilemap.layers.map((layer, index) =>
    convertLayer(layer, index + 1)
  );

  // Add collision layer if needed
  if (tilemap.collision && tilemap.collision.length > 0) {
    tiledLayers.push(createCollisionLayer(tilemap, tiledLayers.length + 1));
  }

  // Create tileset
  const tilesets: TiledTileset[] = [];

  if (tilemap.tilesets && tilemap.tilesets.length > 0) {
    // Use provided tilesets
    tilesets.push(...tilemap.tilesets.map(convertTileset));
  } else {
    // Create default tileset
    tilesets.push(createDefaultTileset(tilemap, tilesetConfig));
  }

  // Convert properties
  const properties = convertProperties(tilemap.properties);

  // Construct Tiled map
  const tiledMap: TiledMap = {
    version: '1.10',
    tiledversion: '1.10.0',
    type: 'map',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width: tilemap.width,
    height: tilemap.height,
    tilewidth: tilemap.tileWidth,
    tileheight: tilemap.tileHeight,
    infinite: false,
    layers: tiledLayers,
    tilesets,
    properties,
    nextlayerid: tiledLayers.length + 1,
    nextobjectid: 1,
  };

  return tiledMap;
}

/**
 * Convert internal layer to Tiled layer format
 */
function convertLayer(layer: TilemapLayer, id: number): TiledLayer {
  return {
    id,
    name: layer.name,
    type: 'tilelayer',
    visible: layer.visible,
    opacity: layer.opacity,
    x: 0,
    y: 0,
    width: layer.width,
    height: layer.height,
    data: layer.data,
    properties: layer.properties ? convertProperties(layer.properties) : undefined,
  };
}

/**
 * Create a collision layer from collision data
 */
function createCollisionLayer(tilemap: TilemapData, id: number): TiledLayer {
  // Convert boolean collision to tile IDs (0 = passable, 1 = blocked)
  const collisionData = tilemap.collision.map((blocked) => (blocked ? 1 : 0));

  return {
    id,
    name: 'collision',
    type: 'tilelayer',
    visible: false, // Hidden by default
    opacity: 0.5,
    x: 0,
    y: 0,
    width: tilemap.width,
    height: tilemap.height,
    data: collisionData,
    properties: [
      {
        name: 'collides',
        type: 'bool',
        value: true,
      },
    ],
  };
}

/**
 * Convert internal tileset reference to Tiled format
 */
function convertTileset(tileset: TilesetReference): TiledTileset {
  return {
    firstgid: tileset.firstgid,
    name: tileset.name,
    tilewidth: tileset.tileWidth,
    tileheight: tileset.tileHeight,
    tilecount: tileset.tileCount,
    columns: tileset.columns,
    image: tileset.image,
  };
}

/**
 * Create a default tileset configuration
 */
function createDefaultTileset(
  tilemap: TilemapData,
  config?: {
    name?: string;
    image?: string;
    tileWidth?: number;
    tileHeight?: number;
    columns?: number;
    tileCount?: number;
  }
): TiledTileset {
  const columns = config?.columns ?? 16;
  const tileCount = config?.tileCount ?? 256;
  const tileWidth = config?.tileWidth ?? tilemap.tileWidth;
  const tileHeight = config?.tileHeight ?? tilemap.tileHeight;

  return {
    firstgid: 1,
    name: config?.name ?? 'tileset',
    tilewidth: tileWidth,
    tileheight: tileHeight,
    tilecount: tileCount,
    columns,
    image: config?.image ?? 'tileset.png',
    imagewidth: columns * tileWidth,
    imageheight: Math.ceil(tileCount / columns) * tileHeight,
    margin: 0,
    spacing: 0,
  };
}

/**
 * Convert properties object to Tiled properties array
 */
function convertProperties(props: Record<string, any>): TiledProperty[] {
  return Object.entries(props).map(([name, value]) => {
    let type: string;
    let convertedValue: any = value;

    if (typeof value === 'boolean') {
      type = 'bool';
    } else if (typeof value === 'number') {
      type = Number.isInteger(value) ? 'int' : 'float';
    } else if (typeof value === 'string') {
      type = 'string';
    } else {
      // Complex types stored as JSON strings
      type = 'string';
      convertedValue = JSON.stringify(value);
    }

    return { name, type, value: convertedValue };
  });
}

/**
 * Export tilemap as JSON string
 *
 * @param tilemap - Internal tilemap data
 * @param tilesetConfig - Optional tileset configuration
 * @param pretty - Whether to format the JSON (default: true)
 * @returns JSON string
 */
export function exportToPhaserJSON(
  tilemap: TilemapData,
  tilesetConfig?: {
    name?: string;
    image?: string;
    tileWidth?: number;
    tileHeight?: number;
    columns?: number;
    tileCount?: number;
  },
  pretty: boolean = true
): string {
  const tiledMap = exportToPhaser(tilemap, tilesetConfig);
  return JSON.stringify(tiledMap, null, pretty ? 2 : 0);
}

/**
 * Load a Tiled JSON map into internal format
 * Useful for round-trip testing or loading existing maps
 *
 * @param tiledMap - Tiled JSON map object
 * @returns Internal tilemap data
 */
export function importFromPhaser(tiledMap: TiledMap): TilemapData {
  // Convert layers
  const layers: TilemapLayer[] = tiledMap.layers
    .filter((layer) => layer.type === 'tilelayer')
    .map((layer) => ({
      name: layer.name,
      data: layer.data,
      width: layer.width,
      height: layer.height,
      visible: layer.visible,
      opacity: layer.opacity,
      zIndex: layer.id,
      properties: layer.properties
        ? importProperties(layer.properties)
        : undefined,
    }));

  // Extract collision layer
  const collisionLayer = tiledMap.layers.find((l) => l.name === 'collision');
  const collision = collisionLayer
    ? collisionLayer.data.map((tile) => tile !== 0)
    : new Array(tiledMap.width * tiledMap.height).fill(false);

  // Convert tilesets
  const tilesets: TilesetReference[] | undefined = tiledMap.tilesets.map(
    (tileset) => ({
      firstgid: tileset.firstgid,
      name: tileset.name,
      image: tileset.image,
      tileWidth: tileset.tilewidth,
      tileHeight: tileset.tileheight,
      tileCount: tileset.tilecount,
      columns: tileset.columns,
    })
  );

  return {
    width: tiledMap.width,
    height: tiledMap.height,
    tileWidth: tiledMap.tilewidth,
    tileHeight: tiledMap.tileheight,
    layers,
    collision,
    tilesets,
    properties: tiledMap.properties
      ? importProperties(tiledMap.properties)
      : {},
  };
}

/**
 * Import Tiled properties array to object
 */
function importProperties(props: TiledProperty[]): Record<string, any> {
  const result: Record<string, any> = {};

  for (const prop of props) {
    let value = prop.value;

    // Try to parse JSON strings back to objects
    if (prop.type === 'string' && typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object') {
          value = parsed;
        }
      } catch {
        // Not JSON, keep as string
      }
    }

    result[prop.name] = value;
  }

  return result;
}

/**
 * Create a Phaser 3 compatible tilemap configuration
 * This can be used directly with Phaser's tilemap loader
 *
 * @param tilemap - Internal tilemap data
 * @param key - Asset key for the tilemap
 * @param tilesetKey - Asset key for the tileset image
 * @returns Configuration object for Phaser
 */
export function createPhaserConfig(
  tilemap: TilemapData,
  key: string = 'map',
  tilesetKey: string = 'tiles'
): {
  key: string;
  data: TiledMap;
  tilesetKey: string;
} {
  return {
    key,
    data: exportToPhaser(tilemap, { name: tilesetKey }),
    tilesetKey,
  };
}

/**
 * Generate TypeScript code for loading the tilemap in Phaser
 *
 * @param mapKey - Key for the map asset
 * @param tilesetKey - Key for the tileset image
 * @param tilesetName - Name of the tileset in the map
 * @returns TypeScript code snippet
 */
export function generatePhaserLoadCode(
  mapKey: string = 'map',
  tilesetKey: string = 'tiles',
  tilesetName: string = 'tileset'
): string {
  return `
// In preload()
this.load.tilemapTiledJSON('${mapKey}', 'path/to/map.json');
this.load.image('${tilesetKey}', 'path/to/tileset.png');

// In create()
const map = this.make.tilemap({ key: '${mapKey}' });
const tileset = map.addTilesetImage('${tilesetName}', '${tilesetKey}');

// Create layers
const groundLayer = map.createLayer('ground', tileset, 0, 0);
const wallsLayer = map.createLayer('walls', tileset, 0, 0);
const decorationsLayer = map.createLayer('decorations', tileset, 0, 0);

// Set collision
wallsLayer.setCollisionByProperty({ collides: true });
`.trim();
}
