import Phaser from 'phaser';

export interface TilesetConfig {
  name: string;
  imageKey: string;
  tileWidth?: number;
  tileHeight?: number;
  margin?: number;
  spacing?: number;
}

export interface TilemapLayer {
  name: string;
  data: number[][];
  width: number;
  height: number;
  visible?: boolean;
  opacity?: number;
}

export interface CollisionData {
  layer: string;
  tiles: Set<number>;
}

/**
 * TilesetLoader - Load and parse Tiled JSON tilemaps
 *
 * Features:
 * - Parse Tiled JSON format
 * - Auto-tile support with 4-bit masking
 * - Multiple layer support
 * - Collision data extraction
 * - Custom properties parsing
 */
export class TilesetLoader {
  private scene: Phaser.Scene;
  private loadedTilemaps: Map<string, Phaser.Tilemaps.Tilemap> = new Map();
  private tilesets: Map<string, Phaser.Tilemaps.Tileset> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Load a Tiled JSON tilemap
   */
  loadTilemap(key: string, jsonPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.loadedTilemaps.has(key)) {
        console.warn(`[TilesetLoader] Tilemap ${key} already loaded`);
        resolve();
        return;
      }

      this.scene.load.tilemapTiledJSON(key, jsonPath);

      this.scene.load.once(`filecomplete-tilemapJSON-${key}`, () => {
        console.log(`[TilesetLoader] Loaded tilemap: ${key}`);
        resolve();
      });

      this.scene.load.once('loaderror', (file: Phaser.Loader.File) => {
        if (file.key === key) {
          reject(new Error(`Failed to load tilemap: ${key}`));
        }
      });

      this.scene.load.start();
    });
  }

  /**
   * Create tilemap from loaded JSON
   */
  createTilemap(key: string): Phaser.Tilemaps.Tilemap | null {
    if (this.loadedTilemaps.has(key)) {
      return this.loadedTilemaps.get(key)!;
    }

    try {
      const tilemap = this.scene.make.tilemap({ key });
      this.loadedTilemaps.set(key, tilemap);
      return tilemap;
    } catch (error) {
      console.error(`[TilesetLoader] Error creating tilemap ${key}:`, error);
      return null;
    }
  }

  /**
   * Add tileset to tilemap
   */
  addTileset(
    tilemap: Phaser.Tilemaps.Tilemap,
    config: TilesetConfig
  ): Phaser.Tilemaps.Tileset | null {
    try {
      const tileset = tilemap.addTilesetImage(
        config.name,
        config.imageKey,
        config.tileWidth,
        config.tileHeight,
        config.margin,
        config.spacing
      );

      if (tileset) {
        this.tilesets.set(config.name, tileset);
      }

      return tileset;
    } catch (error) {
      console.error(`[TilesetLoader] Error adding tileset ${config.name}:`, error);
      return null;
    }
  }

  /**
   * Create tilemap layer
   */
  createLayer(
    tilemap: Phaser.Tilemaps.Tilemap,
    layerName: string,
    tileset: Phaser.Tilemaps.Tileset | Phaser.Tilemaps.Tileset[]
  ): Phaser.Tilemaps.TilemapLayer | null {
    try {
      const layer = tilemap.createLayer(layerName, tileset);
      return layer;
    } catch (error) {
      console.warn(`[TilesetLoader] Could not create layer ${layerName}:`, error);
      return null;
    }
  }

  /**
   * Extract collision data from tilemap
   */
  extractCollisionData(tilemap: Phaser.Tilemaps.Tilemap, layerName: string): CollisionData {
    const layer = tilemap.getLayer(layerName);
    const collisionTiles = new Set<number>();

    if (!layer) {
      return { layer: layerName, tiles: collisionTiles };
    }

    // Check each tile in the layer for collision property
    layer.data.forEach((row) => {
      row.forEach((tile) => {
        if (tile.properties && tile.properties.collides) {
          collisionTiles.add(tile.index);
        }
      });
    });

    return { layer: layerName, tiles: collisionTiles };
  }

  /**
   * Set collision for specific tiles
   */
  setCollision(
    layer: Phaser.Tilemaps.TilemapLayer,
    tiles: number | number[],
    collides: boolean = true
  ): void {
    if (Array.isArray(tiles)) {
      layer.setCollision(tiles, collides);
    } else {
      layer.setCollision(tiles, collides);
    }
  }

  /**
   * Set collision by property
   */
  setCollisionByProperty(
    layer: Phaser.Tilemaps.TilemapLayer,
    properties: { [key: string]: any },
    collides: boolean = true
  ): void {
    layer.setCollisionByProperty(properties, collides);
  }

  /**
   * Get tile at world position
   */
  getTileAtWorldXY(
    layer: Phaser.Tilemaps.TilemapLayer,
    worldX: number,
    worldY: number
  ): Phaser.Tilemaps.Tile | null {
    return layer.getTileAtWorldXY(worldX, worldY);
  }

  /**
   * Apply auto-tiling with 4-bit masking
   */
  applyAutoTiling(
    layer: Phaser.Tilemaps.TilemapLayer,
    tileIndex: number,
    autoTileMapping: Map<number, number>
  ): void {
    // Iterate through all tiles in the layer
    for (let y = 0; y < layer.layer.height; y++) {
      for (let x = 0; x < layer.layer.width; x++) {
        const tile = layer.getTileAt(x, y);

        if (tile && tile.index === tileIndex) {
          const mask = this.calculateAutoTileMask(layer, x, y, tileIndex);
          const newIndex = autoTileMapping.get(mask) ?? tileIndex;
          layer.putTileAt(newIndex, x, y);
        }
      }
    }
  }

  /**
   * Calculate 4-bit auto-tile mask
   * Returns a number from 0-15 representing which neighbors have the same tile
   */
  private calculateAutoTileMask(
    layer: Phaser.Tilemaps.TilemapLayer,
    x: number,
    y: number,
    tileIndex: number
  ): number {
    let mask = 0;

    // Check 4 neighbors: up, right, down, left
    const neighbors = [
      { x: x, y: y - 1, bit: 1 }, // up
      { x: x + 1, y: y, bit: 2 }, // right
      { x: x, y: y + 1, bit: 4 }, // down
      { x: x - 1, y: y, bit: 8 }, // left
    ];

    neighbors.forEach(({ x: nx, y: ny, bit }) => {
      const tile = layer.getTileAt(nx, ny);
      if (tile && tile.index === tileIndex) {
        mask |= bit;
      }
    });

    return mask;
  }

  /**
   * Get all layer names in tilemap
   */
  getLayerNames(tilemap: Phaser.Tilemaps.Tilemap): string[] {
    return tilemap.layers.map((layer) => layer.name);
  }

  /**
   * Get tilemap by key
   */
  getTilemap(key: string): Phaser.Tilemaps.Tilemap | undefined {
    return this.loadedTilemaps.get(key);
  }

  /**
   * Get tileset by name
   */
  getTileset(name: string): Phaser.Tilemaps.Tileset | undefined {
    return this.tilesets.get(name);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.loadedTilemaps.clear();
    this.tilesets.clear();
  }
}
