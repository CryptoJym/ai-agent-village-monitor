import Phaser from 'phaser';
import { AnimationManager } from './AnimationManager';

export interface SpriteSheet {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  frames?: number;
}

export interface TextureAtlas {
  key: string;
  texturePath: string;
  atlasPath: string;
}

export interface SpriteConfig {
  key: string;
  frame?: string | number;
  animations?: string[];
}

/**
 * SpriteManager - Sprite lifecycle and texture management
 *
 * Features:
 * - Load sprite sheets and texture atlases
 * - Create and manage sprite instances
 * - Handle animation definitions
 * - Runtime sprite generation hook for PixelLab
 * - Sprite pooling for performance
 */
export class SpriteManager {
  private scene: Phaser.Scene;
  private animationManager: AnimationManager;
  private loadedSheets: Set<string> = new Set();
  private loadedAtlases: Set<string> = new Set();
  private spritePool: Map<string, Phaser.GameObjects.Sprite[]> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.animationManager = new AnimationManager(scene);
  }

  /**
   * Load a spritesheet
   */
  loadSpriteSheet(config: SpriteSheet): void {
    if (this.loadedSheets.has(config.key)) {
      console.warn(`[SpriteManager] Spritesheet ${config.key} already loaded`);
      return;
    }

    this.scene.load.spritesheet(config.key, config.path, {
      frameWidth: config.frameWidth,
      frameHeight: config.frameHeight,
    });

    this.loadedSheets.add(config.key);
  }

  /**
   * Load a texture atlas
   */
  loadTextureAtlas(config: TextureAtlas): void {
    if (this.loadedAtlases.has(config.key)) {
      console.warn(`[SpriteManager] Atlas ${config.key} already loaded`);
      return;
    }

    this.scene.load.atlas(config.key, config.texturePath, config.atlasPath);
    this.loadedAtlases.add(config.key);
  }

  /**
   * Create a sprite instance
   */
  createSprite(x: number, y: number, config: SpriteConfig): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(x, y, config.key, config.frame);

    // Note: Animations should be registered via AnimationManager.createAgentAnimations()
    // or other animation creation methods before creating sprites
    // config.animations is just for documentation/tracking purposes

    return sprite;
  }

  /**
   * Create a sprite from pool (performance optimization)
   */
  getSprite(x: number, y: number, config: SpriteConfig): Phaser.GameObjects.Sprite {
    const poolKey = config.key;
    let pool = this.spritePool.get(poolKey);

    if (!pool) {
      pool = [];
      this.spritePool.set(poolKey, pool);
    }

    // Try to reuse an inactive sprite
    let sprite = pool.find((s) => !s.active);

    if (sprite) {
      sprite.setPosition(x, y);
      sprite.setActive(true);
      sprite.setVisible(true);
      if (config.frame !== undefined) {
        sprite.setFrame(config.frame);
      }
    } else {
      // Create new sprite
      sprite = this.createSprite(x, y, config);
      pool.push(sprite);
    }

    return sprite;
  }

  /**
   * Return sprite to pool
   */
  releaseSprite(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setActive(false);
    sprite.setVisible(false);
  }

  /**
   * Create agent sprite with animations
   */
  createAgentSprite(x: number, y: number, agentType: string = 'default'): Phaser.GameObjects.Sprite {
    const sprite = this.createSprite(x, y, {
      key: 'agents',
      frame: 0,
    });

    // Register agent animations
    this.animationManager.createAgentAnimations('agents', agentType);

    return sprite;
  }

  /**
   * Create building sprite
   */
  createBuildingSprite(x: number, y: number, buildingType: string): Phaser.GameObjects.Sprite {
    return this.createSprite(x, y, {
      key: 'buildings',
      frame: 0,
    });
  }

  /**
   * Generate runtime sprite using PixelLab (hook for future integration)
   */
  async generateRuntimeSprite(
    key: string,
    prompt: string,
    width: number,
    height: number
  ): Promise<void> {
    console.log(`[SpriteManager] Generating runtime sprite: ${key}`);
    console.log(`[SpriteManager] Prompt: ${prompt}, Size: ${width}x${height}`);

    // TODO: Integrate with PixelLab API
    // For now, create a placeholder texture
    const graphics = this.scene.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x808080);
    graphics.fillRect(0, 0, width, height);

    graphics.generateTexture(key, width, height);
    graphics.destroy();

    console.log(`[SpriteManager] Placeholder texture created for ${key}`);
  }

  /**
   * Check if a spritesheet is loaded
   */
  hasSheet(key: string): boolean {
    return this.loadedSheets.has(key);
  }

  /**
   * Check if a texture atlas is loaded
   */
  hasAtlas(key: string): boolean {
    return this.loadedAtlases.has(key);
  }

  /**
   * Get animation manager instance
   */
  getAnimationManager(): AnimationManager {
    return this.animationManager;
  }

  /**
   * Clear sprite pool
   */
  clearPool(key?: string): void {
    if (key) {
      const pool = this.spritePool.get(key);
      if (pool) {
        pool.forEach((sprite) => sprite.destroy());
        this.spritePool.delete(key);
      }
    } else {
      this.spritePool.forEach((pool) => {
        pool.forEach((sprite) => sprite.destroy());
      });
      this.spritePool.clear();
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clearPool();
    this.loadedSheets.clear();
    this.loadedAtlases.clear();
  }
}
