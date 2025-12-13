import Phaser from 'phaser';

export interface TilemapData {
  tilemap: Phaser.Tilemaps.Tilemap;
  collisionLayers: string[];
  tileSize: number;
}

export interface TriggerZone {
  id: string;
  bounds: Phaser.Geom.Rectangle;
  callback: () => void;
  enabled: boolean;
  data?: Record<string, any>;
}

export interface CollisionResult {
  collides: boolean;
  tile?: Phaser.Tilemaps.Tile;
  layer?: string;
  x?: number;
  y?: number;
}

/**
 * CollisionSystem - Physics and collision detection system
 *
 * Features:
 * - Create collision layer from tilemap data
 * - Agent collision detection with walls
 * - Trigger zones for doors/portals
 * - Pathfinding obstacle map generation
 * - Support for dynamic collision updates
 */
export class CollisionSystem {
  private scene: Phaser.Scene;
  private tilemap?: Phaser.Tilemaps.Tilemap;
  private collisionLayers: Map<string, Phaser.Tilemaps.TilemapLayer> = new Map();
  private obstacleMap: boolean[][] = [];
  private triggerZones: Map<string, TriggerZone> = new Map();
  private tileSize: number = 32;
  private mapWidth: number = 0;
  private mapHeight: number = 0;

  // Dynamic collision bodies (for moving obstacles)
  private dynamicBodies: Map<string, Phaser.GameObjects.Rectangle> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Create collision system from tilemap data
   */
  createFromTilemap(tilemapData: TilemapData): void {
    this.tilemap = tilemapData.tilemap;
    this.tileSize = tilemapData.tileSize;
    this.mapWidth = this.tilemap.width;
    this.mapHeight = this.tilemap.height;

    console.log(
      `[CollisionSystem] Initializing collision for map ${this.mapWidth}x${this.mapHeight} (tile size: ${this.tileSize})`
    );

    // Setup collision for each specified layer
    tilemapData.collisionLayers.forEach((layerName) => {
      const layer = this.tilemap?.getLayer(layerName);
      if (layer && layer.tilemapLayer) {
        this.addCollisionLayer(layerName, layer.tilemapLayer);
      } else {
        console.warn(`[CollisionSystem] Layer '${layerName}' not found in tilemap`);
      }
    });

    // Generate obstacle map
    this.generateObstacleMap();
  }

  /**
   * Add a collision layer
   */
  private addCollisionLayer(name: string, layer: Phaser.Tilemaps.TilemapLayer): void {
    // Set collision by property (tiles with collides=true)
    layer.setCollisionByProperty({ collides: true });

    // Store reference
    this.collisionLayers.set(name, layer);

    console.log(`[CollisionSystem] Added collision layer: ${name}`);
  }

  /**
   * Check if a rectangle collides with any tiles
   */
  checkCollision(x: number, y: number, width: number, height: number): CollisionResult {
    const bounds = new Phaser.Geom.Rectangle(x, y, width, height);

    // Check against all collision layers
    for (const [layerName, layer] of this.collisionLayers) {
      const tiles = layer.getTilesWithinShape(bounds);

      for (const tile of tiles) {
        if (tile.collides) {
          return {
            collides: true,
            tile,
            layer: layerName,
            x: tile.pixelX,
            y: tile.pixelY,
          };
        }
      }
    }

    // Check against dynamic bodies
    for (const [id, body] of this.dynamicBodies) {
      const bodyBounds = body.getBounds();
      if (Phaser.Geom.Rectangle.Overlaps(bounds, bodyBounds)) {
        return {
          collides: true,
          layer: 'dynamic',
        };
      }
    }

    return { collides: false };
  }

  /**
   * Check if a point collides with any tiles
   */
  checkPointCollision(x: number, y: number): CollisionResult {
    return this.checkCollision(x, y, 1, 1);
  }

  /**
   * Check if a circle collides with any tiles
   */
  checkCircleCollision(centerX: number, centerY: number, radius: number): CollisionResult {
    return this.checkCollision(centerX - radius, centerY - radius, radius * 2, radius * 2);
  }

  /**
   * Get tile at world position
   */
  getTileAtWorldXY(x: number, y: number, layerName?: string): Phaser.Tilemaps.Tile | null {
    if (layerName) {
      const layer = this.collisionLayers.get(layerName);
      if (layer) {
        return layer.getTileAtWorldXY(x, y, true);
      }
    } else {
      // Check all layers
      for (const layer of this.collisionLayers.values()) {
        const tile = layer.getTileAtWorldXY(x, y, true);
        if (tile) {
          return tile;
        }
      }
    }
    return null;
  }

  /**
   * Add a trigger zone
   */
  addTriggerZone(
    id: string,
    bounds: Phaser.Geom.Rectangle,
    callback: () => void,
    data?: Record<string, any>
  ): void {
    const triggerZone: TriggerZone = {
      id,
      bounds,
      callback,
      enabled: true,
      data,
    };

    this.triggerZones.set(id, triggerZone);
    console.log(`[CollisionSystem] Added trigger zone: ${id}`);
  }

  /**
   * Remove a trigger zone
   */
  removeTriggerZone(id: string): void {
    if (this.triggerZones.delete(id)) {
      console.log(`[CollisionSystem] Removed trigger zone: ${id}`);
    }
  }

  /**
   * Enable/disable a trigger zone
   */
  setTriggerZoneEnabled(id: string, enabled: boolean): void {
    const zone = this.triggerZones.get(id);
    if (zone) {
      zone.enabled = enabled;
    }
  }

  /**
   * Check if a point is inside any trigger zones
   */
  checkTriggerZones(x: number, y: number): TriggerZone | null {
    for (const zone of this.triggerZones.values()) {
      if (zone.enabled && zone.bounds.contains(x, y)) {
        return zone;
      }
    }
    return null;
  }

  /**
   * Check if a rectangle overlaps any trigger zones
   */
  checkTriggerZonesRect(bounds: Phaser.Geom.Rectangle): TriggerZone[] {
    const overlapping: TriggerZone[] = [];

    for (const zone of this.triggerZones.values()) {
      if (zone.enabled && Phaser.Geom.Rectangle.Overlaps(bounds, zone.bounds)) {
        overlapping.push(zone);
      }
    }

    return overlapping;
  }

  /**
   * Trigger a specific zone by ID
   */
  triggerZone(id: string): void {
    const zone = this.triggerZones.get(id);
    if (zone && zone.enabled) {
      zone.callback();
      console.log(`[CollisionSystem] Triggered zone: ${id}`);
    }
  }

  /**
   * Generate obstacle map for pathfinding
   * Returns a 2D boolean array where true = obstacle
   */
  getObstacleMap(): boolean[][] {
    return this.obstacleMap.map((row) => [...row]); // Return a copy
  }

  /**
   * Generate the obstacle map from collision layers
   */
  private generateObstacleMap(): void {
    if (!this.tilemap) {
      console.warn('[CollisionSystem] Cannot generate obstacle map - no tilemap');
      return;
    }

    // Initialize obstacle map
    this.obstacleMap = Array.from({ length: this.mapHeight }, () =>
      Array.from({ length: this.mapWidth }, () => false)
    );

    // Mark collision tiles as obstacles
    for (const layer of this.collisionLayers.values()) {
      for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          const tile = layer.getTileAt(x, y, true);
          if (tile && tile.collides) {
            this.obstacleMap[y][x] = true;
          }
        }
      }
    }

    console.log(`[CollisionSystem] Generated obstacle map: ${this.mapWidth}x${this.mapHeight}`);
  }

  /**
   * Update obstacle at specific tile coordinates
   */
  setObstacle(tileX: number, tileY: number, isObstacle: boolean): void {
    if (tileX >= 0 && tileX < this.mapWidth && tileY >= 0 && tileY < this.mapHeight) {
      this.obstacleMap[tileY][tileX] = isObstacle;
    }
  }

  /**
   * Check if a tile position is an obstacle
   */
  isObstacle(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) {
      return true; // Out of bounds = obstacle
    }
    return this.obstacleMap[tileY][tileX];
  }

  /**
   * Convert world coordinates to tile coordinates
   */
  worldToTile(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: Math.floor(worldX / this.tileSize),
      y: Math.floor(worldY / this.tileSize),
    };
  }

  /**
   * Convert tile coordinates to world coordinates (center of tile)
   */
  tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
    return {
      x: tileX * this.tileSize + this.tileSize / 2,
      y: tileY * this.tileSize + this.tileSize / 2,
    };
  }

  /**
   * Add a dynamic collision body (for moving obstacles)
   */
  addDynamicBody(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.Rectangle {
    const body = this.scene.add.rectangle(x, y, width, height);
    body.setVisible(false); // Invisible collision body
    this.scene.physics.add.existing(body, true); // Add as static body

    this.dynamicBodies.set(id, body);
    console.log(`[CollisionSystem] Added dynamic body: ${id}`);

    return body;
  }

  /**
   * Remove a dynamic collision body
   */
  removeDynamicBody(id: string): void {
    const body = this.dynamicBodies.get(id);
    if (body) {
      body.destroy();
      this.dynamicBodies.delete(id);
      console.log(`[CollisionSystem] Removed dynamic body: ${id}`);
    }
  }

  /**
   * Update dynamic body position
   */
  updateDynamicBody(id: string, x: number, y: number): void {
    const body = this.dynamicBodies.get(id);
    if (body) {
      body.setPosition(x, y);
    }
  }

  /**
   * Get collision layers
   */
  getCollisionLayers(): Map<string, Phaser.Tilemaps.TilemapLayer> {
    return this.collisionLayers;
  }

  /**
   * Get trigger zones
   */
  getTriggerZones(): Map<string, TriggerZone> {
    return this.triggerZones;
  }

  /**
   * Get map dimensions in tiles
   */
  getMapDimensions(): { width: number; height: number } {
    return { width: this.mapWidth, height: this.mapHeight };
  }

  /**
   * Get tile size
   */
  getTileSize(): number {
    return this.tileSize;
  }

  /**
   * Debug: Draw collision tiles
   */
  debugDrawCollisions(graphics: Phaser.GameObjects.Graphics, color: number = 0xff0000): void {
    graphics.clear();
    graphics.lineStyle(2, color, 0.5);

    for (const layer of this.collisionLayers.values()) {
      const tiles = layer.getTilesWithin();
      tiles.forEach((tile) => {
        if (tile.collides) {
          graphics.strokeRect(tile.pixelX, tile.pixelY, this.tileSize, this.tileSize);
        }
      });
    }
  }

  /**
   * Debug: Draw trigger zones
   */
  debugDrawTriggerZones(graphics: Phaser.GameObjects.Graphics, color: number = 0x00ff00): void {
    graphics.lineStyle(2, color, 0.8);

    for (const zone of this.triggerZones.values()) {
      if (zone.enabled) {
        graphics.strokeRect(zone.bounds.x, zone.bounds.y, zone.bounds.width, zone.bounds.height);
      }
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.collisionLayers.clear();
    this.triggerZones.clear();
    this.dynamicBodies.forEach((body) => body.destroy());
    this.dynamicBodies.clear();
    this.obstacleMap = [];
    console.log('[CollisionSystem] Destroyed collision system');
  }
}
