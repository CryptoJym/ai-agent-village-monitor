import Phaser from 'phaser';

export type TransitionEffect = 'fade' | 'slide' | 'iris' | 'none';
export type SlideDirection = 'left' | 'right' | 'up' | 'down';

export interface TransitionOptions {
  effect: TransitionEffect;
  duration: number;
  color?: number;
  direction?: SlideDirection;
  easing?: string;
}

export interface SceneState {
  sceneKey: string;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  playerPosition?: { x: number; y: number };
  visitedRooms?: Set<string>;
  customData?: Record<string, any>;
  timestamp: number;
}

export interface TransitionData {
  targetScene: string;
  spawnPosition?: { x: number; y: number };
  fromScene?: string;
  previousState?: SceneState;
  customData?: Record<string, any>;
}

/**
 * SceneTransitionManager - Handles scene transitions with various effects
 *
 * Features:
 * - Multiple transition effects (fade, slide, iris, none)
 * - Scene state persistence (camera, player position, visited rooms)
 * - Loading screen support for async transitions
 * - Back navigation support
 * - Smooth animations and effects
 *
 * Usage:
 * ```typescript
 * const transitionManager = new SceneTransitionManager();
 *
 * // In your scene
 * await transitionManager.transitionTo(
 *   this,
 *   'HouseScene',
 *   {
 *     effect: 'fade',
 *     duration: 500,
 *     color: 0x000000
 *   },
 *   {
 *     spawnPosition: { x: 100, y: 100 },
 *     customData: { houseId: 'house_1' }
 *   }
 * );
 * ```
 */
export class SceneTransitionManager {
  private sceneHistory: SceneState[] = [];
  private currentTransition: Phaser.GameObjects.Rectangle | null = null;
  private transitionInProgress = false;
  private maxHistorySize = 10;

  constructor() {
    console.log('[SceneTransitionManager] Initialized');
  }

  /**
   * Transition to a new scene with the specified effect
   */
  async transitionTo(
    scene: Phaser.Scene,
    targetScene: string,
    options: TransitionOptions,
    data?: Record<string, any>
  ): Promise<void> {
    if (this.transitionInProgress) {
      console.warn('[SceneTransitionManager] Transition already in progress');
      return;
    }

    this.transitionInProgress = true;

    try {
      // Save current scene state
      this.saveSceneState(scene);

      // Prepare transition data
      const transitionData: TransitionData = {
        targetScene,
        fromScene: scene.scene.key,
        spawnPosition: data?.spawnPosition,
        customData: data,
        previousState: this.sceneHistory[this.sceneHistory.length - 1],
      };

      // Execute transition effect
      await this.executeTransitionOut(scene, options);

      // Switch scenes
      scene.scene.start(targetScene, transitionData);

      // Note: Transition in will be handled by the target scene calling transitionIn()
    } catch (error) {
      console.error('[SceneTransitionManager] Transition failed:', error);
      throw error;
    } finally {
      this.transitionInProgress = false;
    }
  }

  /**
   * Execute the transition-out effect (leaving current scene)
   */
  private async executeTransitionOut(
    scene: Phaser.Scene,
    options: TransitionOptions
  ): Promise<void> {
    switch (options.effect) {
      case 'fade':
        await this.createFadeEffect(scene, options.duration, options.color ?? 0x000000, true);
        break;
      case 'slide':
        await this.createSlideEffect(scene, options.direction ?? 'left', options.duration, true);
        break;
      case 'iris':
        await this.createIrisEffect(scene, options.duration, true);
        break;
      case 'none':
        // No effect, just wait a frame
        await new Promise((resolve) => scene.time.delayedCall(16, resolve));
        break;
      default:
        console.warn(`[SceneTransitionManager] Unknown effect: ${options.effect}`);
    }
  }

  /**
   * Execute the transition-in effect (entering new scene)
   */
  async transitionIn(scene: Phaser.Scene, options: TransitionOptions): Promise<void> {
    switch (options.effect) {
      case 'fade':
        await this.createFadeEffect(scene, options.duration, options.color ?? 0x000000, false);
        break;
      case 'slide':
        await this.createSlideEffect(scene, options.direction ?? 'left', options.duration, false);
        break;
      case 'iris':
        await this.createIrisEffect(scene, options.duration, false);
        break;
      case 'none':
        // No effect
        break;
    }
  }

  /**
   * Create a fade transition effect
   */
  createFadeEffect(
    scene: Phaser.Scene,
    duration: number,
    color: number = 0x000000,
    fadeOut: boolean = true
  ): Promise<void> {
    return new Promise((resolve) => {
      const { width, height } = scene.cameras.main;

      // Create overlay rectangle
      const overlay = scene.add.rectangle(0, 0, width, height, color);
      overlay.setOrigin(0);
      overlay.setDepth(9999);
      overlay.setScrollFactor(0);
      overlay.setAlpha(fadeOut ? 0 : 1);

      this.currentTransition = overlay;

      // Tween alpha
      scene.tweens.add({
        targets: overlay,
        alpha: fadeOut ? 1 : 0,
        duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (!fadeOut) {
            overlay.destroy();
            this.currentTransition = null;
          }
          resolve();
        },
      });
    });
  }

  /**
   * Create a slide transition effect
   */
  createSlideEffect(
    scene: Phaser.Scene,
    direction: SlideDirection,
    duration: number,
    slideOut: boolean = true
  ): Promise<void> {
    return new Promise((resolve) => {
      const camera = scene.cameras.main;
      const { width, height } = camera;

      // Determine slide positions
      let startX = 0,
        startY = 0,
        endX = 0,
        endY = 0;

      if (slideOut) {
        // Sliding out - camera moves
        switch (direction) {
          case 'left':
            endX = -width;
            break;
          case 'right':
            endX = width;
            break;
          case 'up':
            endY = -height;
            break;
          case 'down':
            endY = height;
            break;
        }
      } else {
        // Sliding in - camera starts offset and moves to center
        switch (direction) {
          case 'left':
            startX = width;
            break;
          case 'right':
            startX = -width;
            break;
          case 'up':
            startY = height;
            break;
          case 'down':
            startY = -height;
            break;
        }
      }

      // Create overlay for slide effect
      const overlay = scene.add.rectangle(
        slideOut ? 0 : startX,
        slideOut ? 0 : startY,
        width,
        height,
        0x000000
      );
      overlay.setOrigin(0);
      overlay.setDepth(9999);
      overlay.setScrollFactor(0);

      this.currentTransition = overlay;

      // Animate
      scene.tweens.add({
        targets: overlay,
        x: slideOut ? endX : 0,
        y: slideOut ? endY : 0,
        duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (!slideOut) {
            overlay.destroy();
            this.currentTransition = null;
          }
          resolve();
        },
      });
    });
  }

  /**
   * Create an iris wipe transition effect
   */
  createIrisEffect(scene: Phaser.Scene, duration: number, closeIris: boolean = true): Promise<void> {
    return new Promise((resolve) => {
      const camera = scene.cameras.main;
      const { width, height } = camera;
      const centerX = width / 2;
      const centerY = height / 2;

      // Calculate diagonal for full coverage
      const maxRadius = Math.sqrt(width * width + height * height) / 2;

      // Create graphics for iris effect
      const graphics = scene.add.graphics();
      graphics.setDepth(9999);
      graphics.setScrollFactor(0);

      const startRadius = closeIris ? maxRadius : 0;
      const endRadius = closeIris ? 0 : maxRadius;

      // Draw function
      const drawIris = (radius: number) => {
        graphics.clear();
        graphics.fillStyle(0x000000, 1);

        // Fill entire screen
        graphics.fillRect(0, 0, width, height);

        // Cut out circle (reverse fill)
        if (radius > 0) {
          graphics.fillStyle(0x000000, 0);
          graphics.beginPath();
          graphics.arc(centerX, centerY, radius, 0, Math.PI * 2);
          graphics.closePath();

          // Use blend mode to create cutout effect
          const circle = scene.add.circle(centerX, centerY, radius, 0x000000);
          circle.setDepth(10000);
          circle.setScrollFactor(0);
          circle.setBlendMode(Phaser.BlendModes.ERASE);

          scene.time.delayedCall(duration, () => {
            circle.destroy();
          });
        }
      };

      // Initial draw
      drawIris(startRadius);

      // Animate radius
      const tweenData = { radius: startRadius };
      scene.tweens.add({
        targets: tweenData,
        radius: endRadius,
        duration,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          drawIris(tweenData.radius);
        },
        onComplete: () => {
          if (!closeIris) {
            graphics.destroy();
          }
          resolve();
        },
      });
    });
  }

  /**
   * Save the current scene state
   */
  saveSceneState(scene: Phaser.Scene): void {
    const camera = scene.cameras.main;

    const state: SceneState = {
      sceneKey: scene.scene.key,
      cameraX: camera.scrollX,
      cameraY: camera.scrollY,
      cameraZoom: camera.zoom,
      timestamp: Date.now(),
    };

    // Store in history
    this.sceneHistory.push(state);

    // Limit history size
    if (this.sceneHistory.length > this.maxHistorySize) {
      this.sceneHistory.shift();
    }

    console.log(`[SceneTransitionManager] Saved state for scene: ${scene.scene.key}`);
  }

  /**
   * Restore a previously saved scene state
   */
  restoreSceneState(scene: Phaser.Scene, state?: SceneState): void {
    if (!state) {
      // Try to find the last state for this scene
      const sceneStates = this.sceneHistory.filter((s) => s.sceneKey === scene.scene.key);
      state = sceneStates[sceneStates.length - 1];
    }

    if (!state) {
      console.warn(`[SceneTransitionManager] No state to restore for scene: ${scene.scene.key}`);
      return;
    }

    const camera = scene.cameras.main;
    camera.scrollX = state.cameraX;
    camera.scrollY = state.cameraY;
    camera.zoom = state.cameraZoom;

    console.log(`[SceneTransitionManager] Restored state for scene: ${scene.scene.key}`);
  }

  /**
   * Get the previous scene state (for back navigation)
   */
  getPreviousState(): SceneState | undefined {
    if (this.sceneHistory.length < 2) return undefined;
    return this.sceneHistory[this.sceneHistory.length - 2];
  }

  /**
   * Navigate back to the previous scene
   */
  async goBack(scene: Phaser.Scene, options: TransitionOptions): Promise<void> {
    const previousState = this.getPreviousState();

    if (!previousState) {
      console.warn('[SceneTransitionManager] No previous scene to go back to');
      return;
    }

    // Remove current state from history
    this.sceneHistory.pop();

    // Transition to previous scene
    await this.transitionTo(scene, previousState.sceneKey, options, {
      restoreState: true,
      previousState,
    });
  }

  /**
   * Create a loading screen overlay
   */
  createLoadingScreen(scene: Phaser.Scene, message: string = 'Loading...'): Phaser.GameObjects.Container {
    const { width, height } = scene.cameras.main;

    const container = scene.add.container(width / 2, height / 2);
    container.setDepth(9998);
    container.setScrollFactor(0);

    // Background
    const bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.8);
    bg.setOrigin(0.5);

    // Loading text
    const text = scene.add.text(0, 0, message, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
    });
    text.setOrigin(0.5);

    // Spinner (simple rotating circle)
    const spinner = scene.add.graphics();
    spinner.lineStyle(4, 0xffffff, 1);
    spinner.arc(0, -60, 30, 0, Math.PI * 1.5);
    spinner.setRotation(0);

    // Animate spinner
    scene.tweens.add({
      targets: spinner,
      rotation: Math.PI * 2,
      duration: 1000,
      repeat: -1,
      ease: 'Linear',
    });

    container.add([bg, spinner, text]);

    return container;
  }

  /**
   * Remove loading screen
   */
  removeLoadingScreen(loadingScreen: Phaser.GameObjects.Container): void {
    loadingScreen.destroy();
  }

  /**
   * Clear scene history
   */
  clearHistory(): void {
    this.sceneHistory = [];
    console.log('[SceneTransitionManager] History cleared');
  }

  /**
   * Get scene history
   */
  getHistory(): SceneState[] {
    return [...this.sceneHistory];
  }

  /**
   * Check if a transition is in progress
   */
  isTransitioning(): boolean {
    return this.transitionInProgress;
  }

  /**
   * Clean up any active transitions
   */
  cleanup(): void {
    if (this.currentTransition) {
      this.currentTransition.destroy();
      this.currentTransition = null;
    }
    this.transitionInProgress = false;
  }

  /**
   * Destroy the transition manager
   */
  destroy(): void {
    this.cleanup();
    this.clearHistory();
    console.log('[SceneTransitionManager] Destroyed');
  }
}

/**
 * Helper function to create a default fade transition
 */
export function createFadeTransition(duration: number = 500, color: number = 0x000000): TransitionOptions {
  return {
    effect: 'fade',
    duration,
    color,
  };
}

/**
 * Helper function to create a slide transition
 */
export function createSlideTransition(
  direction: SlideDirection = 'left',
  duration: number = 500
): TransitionOptions {
  return {
    effect: 'slide',
    duration,
    direction,
  };
}

/**
 * Helper function to create an iris transition
 */
export function createIrisTransition(duration: number = 800): TransitionOptions {
  return {
    effect: 'iris',
    duration,
  };
}

/**
 * Helper function to create an instant transition
 */
export function createInstantTransition(): TransitionOptions {
  return {
    effect: 'none',
    duration: 0,
  };
}
