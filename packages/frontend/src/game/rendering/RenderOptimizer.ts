import Phaser from 'phaser';

export interface PerformanceMetrics {
  fps: number;
  drawCalls: number;
  objects: number;
  textureMemory: number;
  culledObjects: number;
  pooledObjects: number;
}

export interface QualitySettings {
  particlesEnabled: boolean;
  shadowsEnabled: boolean;
  postProcessingEnabled: boolean;
  maxVisibleObjects: number;
  cullPadding: number;
}

export interface PoolConfig {
  initialSize: number;
  maxSize: number;
  createFunc: () => Phaser.GameObjects.GameObject;
  resetFunc?: (obj: Phaser.GameObjects.GameObject) => void;
}

/**
 * RenderOptimizer - Performance optimization system for Phaser rendering
 *
 * Features:
 * - Frustum culling for off-screen tiles and objects
 * - Object pooling for sprites and game objects
 * - Texture atlas management
 * - Frame rate monitoring and auto-quality adjustment
 * - Memory management and cleanup
 * - Performance metrics tracking
 */
export class RenderOptimizer {
  private scene: Phaser.Scene;
  private camera?: Phaser.Cameras.Scene2D.Camera;
  private pools: Map<string, Phaser.GameObjects.GameObject[]> = new Map();
  private poolConfigs: Map<string, PoolConfig> = new Map();
  private activeFromPool: Map<Phaser.GameObjects.GameObject, string> = new Map();

  // Performance tracking
  private metrics: PerformanceMetrics = {
    fps: 60,
    drawCalls: 0,
    objects: 0,
    textureMemory: 0,
    culledObjects: 0,
    pooledObjects: 0,
  };

  private fpsHistory: number[] = [];
  private fpsHistorySize = 60; // Track last 60 frames
  private autoQualityEnabled = true;
  private qualitySettings: QualitySettings = {
    particlesEnabled: true,
    shadowsEnabled: true,
    postProcessingEnabled: true,
    maxVisibleObjects: 1000,
    cullPadding: 1,
  };

  // Culling
  private cullingEnabled = true;
  private cullBounds?: Phaser.Geom.Rectangle;
  private culledObjects = new Set<Phaser.GameObjects.GameObject>();

  // Texture atlases
  private textureAtlases: Map<string, string[]> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Enable frustum culling for a camera
   */
  enableCulling(camera: Phaser.Cameras.Scene2D.Camera, padding: number = 1): void {
    this.camera = camera;
    this.cullingEnabled = true;
    this.qualitySettings.cullPadding = padding;

    console.log('[RenderOptimizer] Enabled frustum culling with padding:', padding);
  }

  /**
   * Disable frustum culling
   */
  disableCulling(): void {
    this.cullingEnabled = false;
    this.culledObjects.clear();
    console.log('[RenderOptimizer] Disabled frustum culling');
  }

  /**
   * Update culling bounds based on camera position
   */
  updateCulling(): void {
    if (!this.cullingEnabled || !this.camera) return;

    const cam = this.camera;
    const padding = this.qualitySettings.cullPadding;

    // Calculate visible bounds with padding
    const worldView = cam.worldView;
    const tileSize = 32; // Assuming standard tile size
    const paddingPixels = tileSize * padding;

    this.cullBounds = new Phaser.Geom.Rectangle(
      worldView.x - paddingPixels,
      worldView.y - paddingPixels,
      worldView.width + paddingPixels * 2,
      worldView.height + paddingPixels * 2
    );
  }

  /**
   * Check if an object should be culled
   */
  shouldCull(
    x: number,
    y: number,
    width: number = 0,
    height: number = 0
  ): boolean {
    if (!this.cullingEnabled || !this.cullBounds) return false;

    return !this.cullBounds.contains(x, y) &&
           !this.cullBounds.contains(x + width, y + height);
  }

  /**
   * Cull objects outside camera view
   */
  cullObjects(objects: Phaser.GameObjects.GameObject[]): void {
    if (!this.cullingEnabled || !this.cullBounds) return;

    let culledCount = 0;

    objects.forEach((obj) => {
      if ('x' in obj && 'y' in obj) {
        const x = (obj as any).x;
        const y = (obj as any).y;
        const width = (obj as any).width || 0;
        const height = (obj as any).height || 0;

        const shouldCull = this.shouldCull(x, y, width, height);
        const sprite = obj as Phaser.GameObjects.Sprite;

        if (shouldCull && sprite.visible) {
          sprite.setVisible(false);
          this.culledObjects.add(obj);
          culledCount++;
        } else if (!shouldCull && !sprite.visible && this.culledObjects.has(obj)) {
          sprite.setVisible(true);
          this.culledObjects.delete(obj);
        }
      }
    });

    this.metrics.culledObjects = culledCount;
  }

  /**
   * Create an object pool
   */
  createPool(type: string, config: PoolConfig): void {
    if (this.pools.has(type)) {
      console.warn(`[RenderOptimizer] Pool '${type}' already exists`);
      return;
    }

    const pool: Phaser.GameObjects.GameObject[] = [];

    // Pre-create initial objects
    for (let i = 0; i < config.initialSize; i++) {
      const obj = config.createFunc();
      obj.setActive(false);
      (obj as Phaser.GameObjects.Sprite).setVisible(false);
      pool.push(obj);
    }

    this.pools.set(type, pool);
    this.poolConfigs.set(type, config);

    console.log(`[RenderOptimizer] Created pool '${type}' with ${config.initialSize} objects`);
  }

  /**
   * Get an object from the pool
   */
  getFromPool<T extends Phaser.GameObjects.GameObject>(type: string): T | null {
    const pool = this.pools.get(type);
    const config = this.poolConfigs.get(type);

    if (!pool || !config) {
      console.warn(`[RenderOptimizer] Pool '${type}' not found`);
      return null;
    }

    // Find inactive object in pool
    let obj = pool.find((o) => !o.active);

    // Create new object if pool is empty and under max size
    if (!obj && pool.length < config.maxSize) {
      obj = config.createFunc();
      pool.push(obj);
    }

    if (obj) {
      obj.setActive(true);
      (obj as Phaser.GameObjects.Sprite).setVisible(true);
      this.activeFromPool.set(obj, type);

      // Reset object if reset function provided
      if (config.resetFunc) {
        config.resetFunc(obj);
      }

      this.metrics.pooledObjects = this.activeFromPool.size;
      return obj as T;
    }

    console.warn(`[RenderOptimizer] Pool '${type}' exhausted`);
    return null;
  }

  /**
   * Return an object to the pool
   */
  returnToPool(obj: Phaser.GameObjects.GameObject): void {
    const poolType = this.activeFromPool.get(obj);

    if (!poolType) {
      console.warn('[RenderOptimizer] Object not from pool');
      return;
    }

    obj.setActive(false);
    (obj as Phaser.GameObjects.Sprite).setVisible(false);
    this.activeFromPool.delete(obj);
    this.metrics.pooledObjects = this.activeFromPool.size;
  }

  /**
   * Clear all pools
   */
  clearPools(): void {
    this.pools.forEach((pool, type) => {
      pool.forEach((obj) => obj.destroy());
      console.log(`[RenderOptimizer] Cleared pool '${type}'`);
    });

    this.pools.clear();
    this.poolConfigs.clear();
    this.activeFromPool.clear();
    this.metrics.pooledObjects = 0;
  }

  /**
   * Register a texture atlas
   */
  registerTextureAtlas(atlasKey: string, textureKeys: string[]): void {
    this.textureAtlases.set(atlasKey, textureKeys);
    console.log(`[RenderOptimizer] Registered texture atlas '${atlasKey}' with ${textureKeys.length} textures`);
  }

  /**
   * Get texture atlas info
   */
  getTextureAtlas(atlasKey: string): string[] | undefined {
    return this.textureAtlases.get(atlasKey);
  }

  /**
   * Unload unused textures
   */
  unloadUnusedTextures(): void {
    const textures = this.scene.textures;
    const textureKeys = textures.list;

    // This is a simplified version - in production, you'd track texture usage
    console.log('[RenderOptimizer] Texture cleanup - checking for unused textures...');

    // Example: Remove textures not in any atlas
    Object.keys(textureKeys).forEach((key) => {
      if (key !== '__DEFAULT' && key !== '__MISSING' && key !== '__WHITE') {
        // Check if texture is in any atlas
        let inAtlas = false;
        for (const [, textures] of this.textureAtlases) {
          if (textures.includes(key)) {
            inAtlas = true;
            break;
          }
        }

        // In production, you'd also check if the texture is currently being used
        // For now, we just log potential candidates for removal
        if (!inAtlas) {
          // textures.remove(key); // Commented out for safety
          console.log(`[RenderOptimizer] Texture '${key}' could be unloaded`);
        }
      }
    });
  }

  /**
   * Update performance metrics
   */
  updateMetrics(): void {
    const game = this.scene.game;
    const displayList = this.scene.children;

    // Get FPS from game loop
    this.metrics.fps = Math.round(game.loop.actualFps);

    // Track FPS history
    this.fpsHistory.push(this.metrics.fps);
    if (this.fpsHistory.length > this.fpsHistorySize) {
      this.fpsHistory.shift();
    }

    // Count visible objects
    this.metrics.objects = displayList.length;

    // Estimate draw calls (simplified - actual count depends on batching)
    this.metrics.drawCalls = Math.ceil(this.metrics.objects / 16); // Assuming batch size of 16

    // Update texture memory estimate (simplified)
    const textures = this.scene.textures;
    this.metrics.textureMemory = Object.keys(textures.list).length * 1024; // Rough estimate

    // Auto-adjust quality if enabled
    if (this.autoQualityEnabled) {
      this.autoAdjustQuality();
    }
  }

  /**
   * Auto-adjust quality based on performance
   */
  private autoAdjustQuality(): void {
    if (this.fpsHistory.length < this.fpsHistorySize) return;

    const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    // Reduce quality if FPS drops below 30
    if (avgFps < 30 && this.qualitySettings.particlesEnabled) {
      this.qualitySettings.particlesEnabled = false;
      console.log('[RenderOptimizer] Auto-adjusted: Disabled particles');
    }

    if (avgFps < 25 && this.qualitySettings.shadowsEnabled) {
      this.qualitySettings.shadowsEnabled = false;
      console.log('[RenderOptimizer] Auto-adjusted: Disabled shadows');
    }

    if (avgFps < 20 && this.qualitySettings.postProcessingEnabled) {
      this.qualitySettings.postProcessingEnabled = false;
      console.log('[RenderOptimizer] Auto-adjusted: Disabled post-processing');
    }

    // Increase quality if performance is good
    if (avgFps > 55 && !this.qualitySettings.particlesEnabled) {
      this.qualitySettings.particlesEnabled = true;
      console.log('[RenderOptimizer] Auto-adjusted: Enabled particles');
    }

    if (avgFps > 58 && !this.qualitySettings.shadowsEnabled) {
      this.qualitySettings.shadowsEnabled = true;
      console.log('[RenderOptimizer] Auto-adjusted: Enabled shadows');
    }
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current quality settings
   */
  getQualitySettings(): QualitySettings {
    return { ...this.qualitySettings };
  }

  /**
   * Set quality settings manually
   */
  setQualitySettings(settings: Partial<QualitySettings>): void {
    this.qualitySettings = { ...this.qualitySettings, ...settings };
    console.log('[RenderOptimizer] Quality settings updated:', this.qualitySettings);
  }

  /**
   * Enable/disable auto quality adjustment
   */
  setAutoQuality(enabled: boolean): void {
    this.autoQualityEnabled = enabled;
    console.log('[RenderOptimizer] Auto quality adjustment:', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Get average FPS
   */
  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60;
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }

  /**
   * Reset performance tracking
   */
  resetMetrics(): void {
    this.fpsHistory = [];
    this.metrics = {
      fps: 60,
      drawCalls: 0,
      objects: 0,
      textureMemory: 0,
      culledObjects: 0,
      pooledObjects: 0,
    };
    console.log('[RenderOptimizer] Metrics reset');
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): Record<string, { total: number; active: number; inactive: number }> {
    const stats: Record<string, { total: number; active: number; inactive: number }> = {};

    this.pools.forEach((pool, type) => {
      const active = pool.filter((obj) => obj.active).length;
      stats[type] = {
        total: pool.length,
        active,
        inactive: pool.length - active,
      };
    });

    return stats;
  }

  /**
   * Update (call in scene's update loop)
   */
  update(): void {
    this.updateCulling();
    this.updateMetrics();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clearPools();
    this.culledObjects.clear();
    this.textureAtlases.clear();
    this.fpsHistory = [];
    console.log('[RenderOptimizer] Destroyed render optimizer');
  }
}
