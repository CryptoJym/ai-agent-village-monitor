import Phaser from 'phaser';

export interface CameraControllerConfig {
  minZoom?: number;
  maxZoom?: number;
  worldBounds?: Phaser.Geom.Rectangle;
  followLerp?: number;
  panSpeed?: number;
  edgeScrollMargin?: number;
}

/**
 * CameraController - Advanced camera control system
 *
 * Features:
 * - Smooth zoom with lerp interpolation (0.5x to 2x)
 * - Pan via click-drag and edge scrolling
 * - World bounds constraint
 * - Optional agent following mode
 * - Smooth transitions between zoom levels
 */
export class CameraController {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private config: Required<CameraControllerConfig>;

  // Follow mode
  private followTarget: Phaser.GameObjects.Sprite | null = null;
  private isFollowing = false;

  // Pan state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartScrollX = 0;
  private dragStartScrollY = 0;

  // Edge scroll
  private edgeScrollEnabled = true;

  constructor(scene: Phaser.Scene, config: CameraControllerConfig = {}) {
    this.scene = scene;
    this.camera = scene.cameras.main;

    // Apply default config
    this.config = {
      minZoom: config.minZoom ?? 0.5,
      maxZoom: config.maxZoom ?? 2.0,
      worldBounds: config.worldBounds ?? new Phaser.Geom.Rectangle(0, 0, 1600, 1200),
      followLerp: config.followLerp ?? 0.1,
      panSpeed: config.panSpeed ?? 1.0,
      edgeScrollMargin: config.edgeScrollMargin ?? 50,
    };

    this.initialize();
  }

  private initialize() {
    // Set camera bounds
    this.camera.setBounds(
      this.config.worldBounds.x,
      this.config.worldBounds.y,
      this.config.worldBounds.width,
      this.config.worldBounds.height,
    );

    // Setup input listeners
    this.setupInputListeners();
  }

  private setupInputListeners() {
    const input = this.scene.input;

    // Mouse drag to pan
    input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.startDrag(pointer);
      }
    });

    input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.updateDrag(pointer);
      }
    });

    input.on('pointerup', (_pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.stopDrag();
      }
    });

    // Mouse wheel zoom
    input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _gameObjects: any[], _deltaX: number, deltaY: number) => {
        const zoomDelta = deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Phaser.Math.Clamp(
          this.camera.zoom + zoomDelta,
          this.config.minZoom,
          this.config.maxZoom,
        );
        this.setZoom(newZoom, 200);
      },
    );
  }

  private startDrag(pointer: Phaser.Input.Pointer) {
    this.isDragging = true;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.dragStartScrollX = this.camera.scrollX;
    this.dragStartScrollY = this.camera.scrollY;

    // Stop following when user drags
    if (this.isFollowing) {
      this.stopFollow();
    }
  }

  private updateDrag(pointer: Phaser.Input.Pointer) {
    const deltaX = (this.dragStartX - pointer.x) / this.camera.zoom;
    const deltaY = (this.dragStartY - pointer.y) / this.camera.zoom;

    this.camera.scrollX = this.dragStartScrollX + deltaX;
    this.camera.scrollY = this.dragStartScrollY + deltaY;

    this.constrainToBounds();
  }

  private stopDrag() {
    this.isDragging = false;
  }

  private constrainToBounds() {
    const bounds = this.config.worldBounds;
    const camWidth = this.camera.width / this.camera.zoom;
    const camHeight = this.camera.height / this.camera.zoom;

    // Constrain scroll to world bounds
    this.camera.scrollX = Phaser.Math.Clamp(
      this.camera.scrollX,
      bounds.x,
      Math.max(bounds.x, bounds.width - camWidth),
    );

    this.camera.scrollY = Phaser.Math.Clamp(
      this.camera.scrollY,
      bounds.y,
      Math.max(bounds.y, bounds.height - camHeight),
    );
  }

  /**
   * Set camera zoom level with optional smooth transition
   */
  setZoom(level: number, duration?: number): void {
    const targetZoom = Phaser.Math.Clamp(level, this.config.minZoom, this.config.maxZoom);

    if (duration && duration > 0) {
      this.camera.zoomTo(targetZoom, duration);
    } else {
      this.camera.setZoom(targetZoom);
    }
  }

  /**
   * Pan camera to world coordinates
   */
  panTo(x: number, y: number, duration?: number): void {
    if (duration && duration > 0) {
      this.camera.pan(x, y, duration, 'Sine.easeInOut');
    } else {
      this.camera.centerOn(x, y);
    }

    this.constrainToBounds();
  }

  /**
   * Follow a target sprite with smooth lerp
   */
  follow(target: Phaser.GameObjects.Sprite, lerp?: number): void {
    this.followTarget = target;
    this.isFollowing = true;

    const lerpValue = lerp ?? this.config.followLerp;
    this.camera.startFollow(target, false, lerpValue, lerpValue);
  }

  /**
   * Stop following current target
   */
  stopFollow(): void {
    this.isFollowing = false;
    this.followTarget = null;
    this.camera.stopFollow();
  }

  /**
   * Set world bounds for camera constraint
   */
  setBounds(bounds: Phaser.Geom.Rectangle): void {
    this.config.worldBounds = bounds;
    this.camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  /**
   * Enable or disable edge scrolling
   */
  setEdgeScroll(enabled: boolean): void {
    this.edgeScrollEnabled = enabled;
  }

  /**
   * Update method to be called in scene's update loop
   */
  update(delta: number): void {
    if (this.edgeScrollEnabled && !this.isDragging && !this.isFollowing) {
      this.updateEdgeScroll(delta);
    }
  }

  private updateEdgeScroll(delta: number): void {
    const pointer = this.scene.input.activePointer;
    const margin = this.config.edgeScrollMargin;
    const speed = (this.config.panSpeed * delta) / this.camera.zoom;

    let scrollX = 0;
    let scrollY = 0;

    if (pointer.x < margin) {
      scrollX = -speed;
    } else if (pointer.x > this.camera.width - margin) {
      scrollX = speed;
    }

    if (pointer.y < margin) {
      scrollY = -speed;
    } else if (pointer.y > this.camera.height - margin) {
      scrollY = speed;
    }

    if (scrollX !== 0 || scrollY !== 0) {
      this.camera.scrollX += scrollX;
      this.camera.scrollY += scrollY;
      this.constrainToBounds();
    }
  }

  /**
   * Get current camera center in world coordinates
   */
  getCenterPoint(): { x: number; y: number } {
    return {
      x: this.camera.scrollX + this.camera.width / 2 / this.camera.zoom,
      y: this.camera.scrollY + this.camera.height / 2 / this.camera.zoom,
    };
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.camera.zoom;
  }

  /**
   * Check if camera is currently following a target
   */
  isFollowingTarget(): boolean {
    return this.isFollowing;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopFollow();
    this.isDragging = false;
  }
}
