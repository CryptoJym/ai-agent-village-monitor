import Phaser from 'phaser';
import { TilesetLoader } from './TilesetLoader';

export interface LayerConfig {
  name: string;
  depth?: number;
  alpha?: number;
  visible?: boolean;
  scrollFactor?: { x: number; y: number };
}

export interface RenderConfig {
  cullPadding?: number;
  skipCull?: boolean;
  enableCollision?: boolean;
}

/**
 * TilemapRenderer - Render Phaser tilemaps with optimizations
 *
 * Features:
 * - Create and render Phaser.Tilemaps
 * - Layer ordering (ground, walls, decorations, above)
 * - Culling for performance
 * - Parallax scrolling support
 * - Dynamic layer visibility
 */
export class TilemapRenderer {
  private scene: Phaser.Scene;
  private tilesetLoader: TilesetLoader;
  private renderedLayers: Map<string, Phaser.Tilemaps.TilemapLayer> = new Map();
  private currentTilemap?: Phaser.Tilemaps.Tilemap;

  // Standard layer ordering
  private readonly LAYER_DEPTHS = {
    ground: 0,
    floor: 10,
    walls: 20,
    decorations: 30,
    objects: 40,
    above: 50,
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.tilesetLoader = new TilesetLoader(scene);
  }

  /**
   * Render a complete tilemap
   */
  renderTilemap(
    tilemapKey: string,
    tilesetConfigs: Array<{ name: string; imageKey: string }>,
    layerConfigs: LayerConfig[],
    renderConfig: RenderConfig = {}
  ): Phaser.Tilemaps.Tilemap | null {
    // Create tilemap
    const tilemap = this.tilesetLoader.createTilemap(tilemapKey);

    if (!tilemap) {
      console.error(`[TilemapRenderer] Failed to create tilemap: ${tilemapKey}`);
      return null;
    }

    this.currentTilemap = tilemap;

    // Add tilesets
    const tilesets: Phaser.Tilemaps.Tileset[] = [];
    tilesetConfigs.forEach((config) => {
      const tileset = this.tilesetLoader.addTileset(tilemap, {
        name: config.name,
        imageKey: config.imageKey,
      });

      if (tileset) {
        tilesets.push(tileset);
      }
    });

    if (tilesets.length === 0) {
      console.error('[TilemapRenderer] No tilesets were loaded');
      return null;
    }

    // Create layers
    layerConfigs.forEach((config) => {
      this.renderLayer(tilemap, config, tilesets, renderConfig);
    });

    return tilemap;
  }

  /**
   * Render a single layer
   */
  renderLayer(
    tilemap: Phaser.Tilemaps.Tilemap,
    config: LayerConfig,
    tilesets: Phaser.Tilemaps.Tileset[],
    renderConfig: RenderConfig = {}
  ): Phaser.Tilemaps.TilemapLayer | null {
    const layer = this.tilesetLoader.createLayer(tilemap, config.name, tilesets);

    if (!layer) {
      return null;
    }

    // Apply layer configuration
    this.configureLayer(layer, config, renderConfig);

    // Store reference
    this.renderedLayers.set(config.name, layer);

    console.log(`[TilemapRenderer] Rendered layer: ${config.name}`);
    return layer;
  }

  /**
   * Configure layer properties
   */
  private configureLayer(
    layer: Phaser.Tilemaps.TilemapLayer,
    config: LayerConfig,
    renderConfig: RenderConfig
  ): void {
    // Set depth based on layer name or config
    const depth = config.depth ?? this.getDepthForLayer(config.name);
    layer.setDepth(depth);

    // Set alpha
    if (config.alpha !== undefined) {
      layer.setAlpha(config.alpha);
    }

    // Set visibility
    if (config.visible !== undefined) {
      layer.setVisible(config.visible);
    }

    // Set scroll factor for parallax
    if (config.scrollFactor) {
      layer.setScrollFactor(config.scrollFactor.x, config.scrollFactor.y);
    }

    // Configure culling
    if (!renderConfig.skipCull) {
      const cullPadding = renderConfig.cullPadding ?? 1;
      layer.setCullPadding(cullPadding, cullPadding);
    }

    // Enable collision if specified
    if (renderConfig.enableCollision) {
      this.tilesetLoader.setCollisionByProperty(layer, { collides: true });
    }
  }

  /**
   * Get default depth for layer based on name
   */
  private getDepthForLayer(layerName: string): number {
    const lowerName = layerName.toLowerCase();

    if (lowerName.includes('ground') || lowerName.includes('floor')) {
      return this.LAYER_DEPTHS.ground;
    } else if (lowerName.includes('wall')) {
      return this.LAYER_DEPTHS.walls;
    } else if (lowerName.includes('decoration')) {
      return this.LAYER_DEPTHS.decorations;
    } else if (lowerName.includes('above') || lowerName.includes('roof')) {
      return this.LAYER_DEPTHS.above;
    } else if (lowerName.includes('object')) {
      return this.LAYER_DEPTHS.objects;
    }

    return this.LAYER_DEPTHS.floor; // Default
  }

  /**
   * Set layer visibility
   */
  setLayerVisible(layerName: string, visible: boolean): void {
    const layer = this.renderedLayers.get(layerName);
    if (layer) {
      layer.setVisible(visible);
    }
  }

  /**
   * Set layer alpha
   */
  setLayerAlpha(layerName: string, alpha: number): void {
    const layer = this.renderedLayers.get(layerName);
    if (layer) {
      layer.setAlpha(alpha);
    }
  }

  /**
   * Get layer by name
   */
  getLayer(layerName: string): Phaser.Tilemaps.TilemapLayer | undefined {
    return this.renderedLayers.get(layerName);
  }

  /**
   * Get all rendered layers
   */
  getAllLayers(): Phaser.Tilemaps.TilemapLayer[] {
    return Array.from(this.renderedLayers.values());
  }

  /**
   * Enable collision for layer
   */
  enableCollision(layerName: string, tiles?: number[]): void {
    const layer = this.renderedLayers.get(layerName);
    if (!layer) return;

    if (tiles) {
      this.tilesetLoader.setCollision(layer, tiles);
    } else {
      this.tilesetLoader.setCollisionByProperty(layer, { collides: true });
    }
  }

  /**
   * Convert world coordinates to tile coordinates
   */
  worldToTile(layerName: string, worldX: number, worldY: number): { x: number; y: number } | null {
    const layer = this.renderedLayers.get(layerName);
    if (!layer) return null;

    const tile = layer.worldToTileXY(worldX, worldY);
    return tile ? { x: tile.x, y: tile.y } : null;
  }

  /**
   * Convert tile coordinates to world coordinates
   */
  tileToWorld(layerName: string, tileX: number, tileY: number): { x: number; y: number } | null {
    const layer = this.renderedLayers.get(layerName);
    if (!layer) return null;

    const world = layer.tileToWorldXY(tileX, tileY);
    return world ? { x: world.x, y: world.y } : null;
  }

  /**
   * Get tile at world position
   */
  getTileAtWorldXY(layerName: string, worldX: number, worldY: number): Phaser.Tilemaps.Tile | null {
    const layer = this.renderedLayers.get(layerName);
    if (!layer) return null;

    return this.tilesetLoader.getTileAtWorldXY(layer, worldX, worldY);
  }

  /**
   * Clear all rendered layers
   */
  clear(): void {
    this.renderedLayers.forEach((layer) => {
      layer.destroy();
    });
    this.renderedLayers.clear();
    this.currentTilemap = undefined;
  }

  /**
   * Get current tilemap
   */
  getCurrentTilemap(): Phaser.Tilemaps.Tilemap | undefined {
    return this.currentTilemap;
  }

  /**
   * Get tileset loader
   */
  getTilesetLoader(): TilesetLoader {
    return this.tilesetLoader;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clear();
    this.tilesetLoader.destroy();
  }
}
