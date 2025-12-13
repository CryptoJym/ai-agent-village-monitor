import Phaser from 'phaser';

export enum LODLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  MINIMAL = 'minimal',
}

export interface LODConfig {
  highDetailDistance: number; // Distance threshold for HIGH detail (pixels)
  mediumDetailDistance: number; // Distance threshold for MEDIUM detail
  lowDetailDistance: number; // Distance threshold for LOW detail
  zoomHighThreshold: number; // Zoom level threshold for HIGH detail
  zoomMediumThreshold: number; // Zoom level threshold for MEDIUM detail
  zoomLowThreshold: number; // Zoom level threshold for LOW detail
}

export interface LODObject {
  gameObject: Phaser.GameObjects.GameObject;
  highDetail?: () => void;
  mediumDetail?: () => void;
  lowDetail?: () => void;
  minimalDetail?: () => void;
  currentLevel: LODLevel;
}

/**
 * LODSystem - Level of Detail management for optimizing rendering
 *
 * Features:
 * - Distance-based LOD switching
 * - Zoom-based LOD switching
 * - Custom LOD callbacks for objects
 * - Automatic detail reduction for distant objects
 * - Progressive loading for large buildings
 * - Texture quality scaling
 */
export class LODSystem {
  private scene: Phaser.Scene;
  private camera?: Phaser.Cameras.Scene2D.Camera;
  private lodObjects: Map<string, LODObject> = new Map();
  private config: LODConfig = {
    highDetailDistance: 200,
    mediumDetailDistance: 400,
    lowDetailDistance: 800,
    zoomHighThreshold: 1.5,
    zoomMediumThreshold: 1.0,
    zoomLowThreshold: 0.5,
  };

  // Performance tracking
  private updateCount: number = 0;
  private updateInterval: number = 10; // Update LOD every N frames
  private currentFrame: number = 0;

  constructor(scene: Phaser.Scene, config?: Partial<LODConfig>) {
    this.scene = scene;
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Set the camera for distance calculations
   */
  setCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.camera = camera;
  }

  /**
   * Update LOD configuration
   */
  updateConfig(config: Partial<LODConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[LODSystem] Configuration updated:', this.config);
  }

  /**
   * Register an object for LOD management
   */
  registerObject(
    id: string,
    gameObject: Phaser.GameObjects.GameObject,
    callbacks: {
      highDetail?: () => void;
      mediumDetail?: () => void;
      lowDetail?: () => void;
      minimalDetail?: () => void;
    }
  ): void {
    const lodObject: LODObject = {
      gameObject,
      highDetail: callbacks.highDetail,
      mediumDetail: callbacks.mediumDetail,
      lowDetail: callbacks.lowDetail,
      minimalDetail: callbacks.minimalDetail,
      currentLevel: LODLevel.HIGH,
    };

    this.lodObjects.set(id, lodObject);
  }

  /**
   * Unregister an object from LOD management
   */
  unregisterObject(id: string): void {
    this.lodObjects.delete(id);
  }

  /**
   * Calculate LOD level based on distance from camera
   */
  private calculateLODByDistance(x: number, y: number): LODLevel {
    if (!this.camera) return LODLevel.HIGH;

    const camX = this.camera.scrollX + this.camera.width / 2;
    const camY = this.camera.scrollY + this.camera.height / 2;
    const distance = Phaser.Math.Distance.Between(x, y, camX, camY);

    if (distance < this.config.highDetailDistance) {
      return LODLevel.HIGH;
    } else if (distance < this.config.mediumDetailDistance) {
      return LODLevel.MEDIUM;
    } else if (distance < this.config.lowDetailDistance) {
      return LODLevel.LOW;
    } else {
      return LODLevel.MINIMAL;
    }
  }

  /**
   * Calculate LOD level based on camera zoom
   */
  private calculateLODByZoom(): LODLevel {
    if (!this.camera) return LODLevel.HIGH;

    const zoom = this.camera.zoom;

    if (zoom >= this.config.zoomHighThreshold) {
      return LODLevel.HIGH;
    } else if (zoom >= this.config.zoomMediumThreshold) {
      return LODLevel.MEDIUM;
    } else if (zoom >= this.config.zoomLowThreshold) {
      return LODLevel.LOW;
    } else {
      return LODLevel.MINIMAL;
    }
  }

  /**
   * Determine final LOD level (takes the lowest between distance and zoom)
   */
  private determineLODLevel(x: number, y: number): LODLevel {
    const distanceLOD = this.calculateLODByDistance(x, y);
    const zoomLOD = this.calculateLODByZoom();

    // Use the lower detail level between distance and zoom
    const lodPriority = {
      [LODLevel.HIGH]: 0,
      [LODLevel.MEDIUM]: 1,
      [LODLevel.LOW]: 2,
      [LODLevel.MINIMAL]: 3,
    };

    return lodPriority[distanceLOD] > lodPriority[zoomLOD] ? distanceLOD : zoomLOD;
  }

  /**
   * Update LOD for a specific object
   */
  private updateObjectLOD(id: string, lodObject: LODObject): void {
    const obj = lodObject.gameObject as any;

    // Skip if object doesn't have position
    if (!('x' in obj) || !('y' in obj)) return;

    const x = obj.x;
    const y = obj.y;

    const newLevel = this.determineLODLevel(x, y);

    // Only update if LOD level changed
    if (newLevel !== lodObject.currentLevel) {
      lodObject.currentLevel = newLevel;

      // Call appropriate callback
      switch (newLevel) {
        case LODLevel.HIGH:
          lodObject.highDetail?.();
          break;
        case LODLevel.MEDIUM:
          lodObject.mediumDetail?.();
          break;
        case LODLevel.LOW:
          lodObject.lowDetail?.();
          break;
        case LODLevel.MINIMAL:
          lodObject.minimalDetail?.();
          break;
      }

      this.updateCount++;
    }
  }

  /**
   * Update all registered LOD objects
   */
  update(): void {
    if (!this.camera) return;

    this.currentFrame++;

    // Only update every N frames to reduce overhead
    if (this.currentFrame % this.updateInterval !== 0) return;

    this.lodObjects.forEach((lodObject, id) => {
      this.updateObjectLOD(id, lodObject);
    });
  }

  /**
   * Set LOD update interval (in frames)
   */
  setUpdateInterval(interval: number): void {
    this.updateInterval = Math.max(1, interval);
  }

  /**
   * Force update all LOD objects immediately
   */
  forceUpdate(): void {
    this.lodObjects.forEach((lodObject, id) => {
      this.updateObjectLOD(id, lodObject);
    });
  }

  /**
   * Get LOD statistics
   */
  getStats(): {
    totalObjects: number;
    highDetail: number;
    mediumDetail: number;
    lowDetail: number;
    minimalDetail: number;
    updateCount: number;
  } {
    const stats = {
      totalObjects: this.lodObjects.size,
      highDetail: 0,
      mediumDetail: 0,
      lowDetail: 0,
      minimalDetail: 0,
      updateCount: this.updateCount,
    };

    this.lodObjects.forEach((lodObject) => {
      switch (lodObject.currentLevel) {
        case LODLevel.HIGH:
          stats.highDetail++;
          break;
        case LODLevel.MEDIUM:
          stats.mediumDetail++;
          break;
        case LODLevel.LOW:
          stats.lowDetail++;
          break;
        case LODLevel.MINIMAL:
          stats.minimalDetail++;
          break;
      }
    });

    return stats;
  }

  /**
   * Helper: Create standard LOD callbacks for sprites
   * Reduces scale and alpha for distant objects
   */
  createSpriteCallbacks(
    sprite: Phaser.GameObjects.Sprite
  ): {
    highDetail: () => void;
    mediumDetail: () => void;
    lowDetail: () => void;
    minimalDetail: () => void;
  } {
    const originalScale = sprite.scale;
    const originalAlpha = sprite.alpha;

    return {
      highDetail: () => {
        sprite.setScale(originalScale);
        sprite.setAlpha(originalAlpha);
      },
      mediumDetail: () => {
        sprite.setScale(originalScale * 0.9);
        sprite.setAlpha(originalAlpha * 0.9);
      },
      lowDetail: () => {
        sprite.setScale(originalScale * 0.75);
        sprite.setAlpha(originalAlpha * 0.75);
      },
      minimalDetail: () => {
        sprite.setScale(originalScale * 0.5);
        sprite.setAlpha(originalAlpha * 0.5);
      },
    };
  }

  /**
   * Helper: Create LOD callbacks for complex objects (buildings, structures)
   * Can hide decorative elements at lower LOD levels
   */
  createComplexObjectCallbacks(
    container: Phaser.GameObjects.Container,
    decorativeChildren?: Phaser.GameObjects.GameObject[]
  ): {
    highDetail: () => void;
    mediumDetail: () => void;
    lowDetail: () => void;
    minimalDetail: () => void;
  } {
    return {
      highDetail: () => {
        container.setAlpha(1.0);
        decorativeChildren?.forEach((child) => (child as Phaser.GameObjects.Sprite).setVisible(true));
      },
      mediumDetail: () => {
        container.setAlpha(0.95);
        decorativeChildren?.forEach((child) => (child as Phaser.GameObjects.Sprite).setVisible(true));
      },
      lowDetail: () => {
        container.setAlpha(0.85);
        decorativeChildren?.forEach((child) => (child as Phaser.GameObjects.Sprite).setVisible(false));
      },
      minimalDetail: () => {
        container.setAlpha(0.7);
        decorativeChildren?.forEach((child) => (child as Phaser.GameObjects.Sprite).setVisible(false));
      },
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.lodObjects.clear();
    this.updateCount = 0;
    this.currentFrame = 0;
    console.log('[LODSystem] Destroyed');
  }
}
