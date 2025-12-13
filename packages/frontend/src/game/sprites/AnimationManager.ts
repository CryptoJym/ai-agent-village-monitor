import Phaser from 'phaser';

export interface AnimationConfig {
  key: string;
  frames: number[] | string[];
  frameRate?: number;
  repeat?: number;
  yoyo?: boolean;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * AnimationManager - Animation definition and management
 *
 * Features:
 * - 4-direction walk/idle/run animations
 * - Work animation for agents
 * - Sleep animation
 * - Emote animations
 * - Custom animation creation
 */
export class AnimationManager {
  private scene: Phaser.Scene;
  private registeredAnimations: Set<string> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Create a custom animation
   */
  createAnimation(config: AnimationConfig, textureKey: string): void {
    if (this.registeredAnimations.has(config.key)) {
      return; // Already registered
    }

    const frames = config.frames.map((frame) => ({
      key: textureKey,
      frame,
    }));

    this.scene.anims.create({
      key: config.key,
      frames,
      frameRate: config.frameRate ?? 10,
      repeat: config.repeat ?? -1,
      yoyo: config.yoyo ?? false,
    });

    this.registeredAnimations.add(config.key);
  }

  /**
   * Create agent animations (4-direction movement + states)
   */
  createAgentAnimations(textureKey: string, agentType: string = 'default'): void {
    const prefix = `${agentType}_`;

    // Idle animations (4 directions)
    this.createDirectionalAnimation(
      `${prefix}idle`,
      textureKey,
      { up: [0], down: [1], left: [2], right: [3] },
      1,
      -1
    );

    // Walk animations (4 directions)
    this.createDirectionalAnimation(
      `${prefix}walk`,
      textureKey,
      {
        up: [4, 5, 6, 7],
        down: [8, 9, 10, 11],
        left: [12, 13, 14, 15],
        right: [16, 17, 18, 19],
      },
      8,
      -1
    );

    // Run animations (4 directions)
    this.createDirectionalAnimation(
      `${prefix}run`,
      textureKey,
      {
        up: [20, 21, 22, 23],
        down: [24, 25, 26, 27],
        left: [28, 29, 30, 31],
        right: [32, 33, 34, 35],
      },
      12,
      -1
    );

    // Work animation (sitting at desk)
    this.createSimpleAnimation(`${prefix}work`, textureKey, [40, 41, 42, 43], 6, -1);

    // Sleep animation
    this.createSimpleAnimation(`${prefix}sleep`, textureKey, [44, 45], 2, -1, true);

    // Emote animations
    this.createEmoteAnimations(prefix, textureKey);
  }

  /**
   * Create directional animations (up, down, left, right)
   */
  private createDirectionalAnimation(
    baseKey: string,
    textureKey: string,
    frameMap: Record<Direction, number[]>,
    frameRate: number,
    repeat: number
  ): void {
    Object.entries(frameMap).forEach(([direction, frames]) => {
      const animKey = `${baseKey}_${direction}`;

      if (this.registeredAnimations.has(animKey)) {
        return;
      }

      this.scene.anims.create({
        key: animKey,
        frames: frames.map((frame) => ({ key: textureKey, frame })),
        frameRate,
        repeat,
      });

      this.registeredAnimations.add(animKey);
    });
  }

  /**
   * Create a simple animation
   */
  private createSimpleAnimation(
    key: string,
    textureKey: string,
    frames: number[],
    frameRate: number,
    repeat: number,
    yoyo: boolean = false
  ): void {
    if (this.registeredAnimations.has(key)) {
      return;
    }

    this.scene.anims.create({
      key,
      frames: frames.map((frame) => ({ key: textureKey, frame })),
      frameRate,
      repeat,
      yoyo,
    });

    this.registeredAnimations.add(key);
  }

  /**
   * Create emote animations
   */
  private createEmoteAnimations(prefix: string, textureKey: string): void {
    const emotes = [
      { name: 'happy', frames: [50, 51, 52] },
      { name: 'sad', frames: [53, 54, 55] },
      { name: 'confused', frames: [56, 57, 58] },
      { name: 'excited', frames: [59, 60, 61] },
    ];

    emotes.forEach(({ name, frames }) => {
      this.createSimpleAnimation(`${prefix}emote_${name}`, textureKey, frames, 8, 0);
    });
  }

  /**
   * Play animation on sprite
   */
  playAnimation(
    sprite: Phaser.GameObjects.Sprite,
    animKey: string,
    ignoreIfPlaying: boolean = true
  ): void {
    if (!this.registeredAnimations.has(animKey)) {
      console.warn(`[AnimationManager] Animation not found: ${animKey}`);
      return;
    }

    sprite.play(animKey, ignoreIfPlaying);
  }

  /**
   * Play directional animation based on movement direction
   */
  playDirectionalAnimation(
    sprite: Phaser.GameObjects.Sprite,
    baseKey: string,
    velocityX: number,
    velocityY: number
  ): void {
    let direction: Direction;

    // Determine direction based on velocity
    if (Math.abs(velocityX) > Math.abs(velocityY)) {
      direction = velocityX > 0 ? 'right' : 'left';
    } else {
      direction = velocityY > 0 ? 'down' : 'up';
    }

    const animKey = `${baseKey}_${direction}`;
    this.playAnimation(sprite, animKey);
  }

  /**
   * Stop animation and show idle frame
   */
  stopAnimation(sprite: Phaser.GameObjects.Sprite, idleKey?: string): void {
    sprite.stop();

    if (idleKey && this.registeredAnimations.has(idleKey)) {
      sprite.setFrame(0);
    }
  }

  /**
   * Check if animation exists
   */
  hasAnimation(key: string): boolean {
    return this.registeredAnimations.has(key);
  }

  /**
   * Get all registered animation keys
   */
  getRegisteredAnimations(): string[] {
    return Array.from(this.registeredAnimations);
  }

  /**
   * Remove animation
   */
  removeAnimation(key: string): void {
    if (this.scene.anims.exists(key)) {
      this.scene.anims.remove(key);
      this.registeredAnimations.delete(key);
    }
  }

  /**
   * Clear all animations
   */
  clearAll(): void {
    this.registeredAnimations.forEach((key) => {
      if (this.scene.anims.exists(key)) {
        this.scene.anims.remove(key);
      }
    });
    this.registeredAnimations.clear();
  }
}
