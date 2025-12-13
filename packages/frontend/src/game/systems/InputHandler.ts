import Phaser from 'phaser';
import type { CameraController } from './CameraController';

export interface InputConfig {
  keyboardEnabled?: boolean;
  mouseEnabled?: boolean;
  touchEnabled?: boolean;
  keyboardPanSpeed?: number;
}

/**
 * InputHandler - Unified input management system
 *
 * Handles:
 * - Keyboard: WASD/Arrow keys for camera movement
 * - Mouse: Click to interact, drag handled by CameraController
 * - Touch: Pinch to zoom, swipe to pan
 * - Event emission for game actions
 */
export class InputHandler extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  private cameraController: CameraController;
  private config: Required<InputConfig>;

  // Keyboard
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  // Touch/Pinch zoom
  private initialPinchDistance = 0;
  private initialZoom = 1;

  constructor(scene: Phaser.Scene, cameraController: CameraController, config: InputConfig = {}) {
    super();

    this.scene = scene;
    this.cameraController = cameraController;

    this.config = {
      keyboardEnabled: config.keyboardEnabled ?? true,
      mouseEnabled: config.mouseEnabled ?? true,
      touchEnabled: config.touchEnabled ?? true,
      keyboardPanSpeed: config.keyboardPanSpeed ?? 5,
    };

    this.initialize();
  }

  private initialize() {
    if (this.config.keyboardEnabled) {
      this.setupKeyboard();
    }

    if (this.config.mouseEnabled) {
      this.setupMouse();
    }

    if (this.config.touchEnabled) {
      this.setupTouch();
    }
  }

  private setupKeyboard() {
    if (!this.scene.input.keyboard) {
      console.warn('[InputHandler] Keyboard not available');
      return;
    }

    // Arrow keys
    this.cursors = this.scene.input.keyboard.createCursorKeys();

    // WASD keys
    this.wasdKeys = {
      W: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Add zoom keys
    const plusKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
    const minusKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);

    plusKey.on('down', () => {
      const newZoom = Math.min(2.0, this.cameraController.getZoom() + 0.1);
      this.cameraController.setZoom(newZoom, 100);
      this.emit('zoom', newZoom);
    });

    minusKey.on('down', () => {
      const newZoom = Math.max(0.5, this.cameraController.getZoom() - 0.1);
      this.cameraController.setZoom(newZoom, 100);
      this.emit('zoom', newZoom);
    });
  }

  private setupMouse() {
    const input = this.scene.input;

    // Click interactions (not drag - that's handled by CameraController)
    input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Store the pointer down position to detect clicks vs drags
      pointer.downX = pointer.x;
      pointer.downY = pointer.y;
    });

    input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // Only emit click if pointer didn't move much (not a drag)
      const dragDistance = Phaser.Math.Distance.Between(
        pointer.downX || pointer.x,
        pointer.downY || pointer.y,
        pointer.x,
        pointer.y
      );

      if (dragDistance < 10) {
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.emit('select', { x: worldPoint.x, y: worldPoint.y, pointer });
      }
    });

    // Right click for context menu (could be used for agent actions)
    input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.emit('contextMenu', { x: worldPoint.x, y: worldPoint.y, pointer });
      }
    });
  }

  private setupTouch() {
    const input = this.scene.input;

    // Pinch to zoom
    input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (input.pointer1.isDown && input.pointer2.isDown) {
        this.handlePinchZoom();
      }
    });

    input.on('pointerup', () => {
      // Reset pinch state when fingers lift
      this.initialPinchDistance = 0;
    });
  }

  private handlePinchZoom() {
    const pointer1 = this.scene.input.pointer1;
    const pointer2 = this.scene.input.pointer2;

    if (!pointer1.isDown || !pointer2.isDown) return;

    const distance = Phaser.Math.Distance.Between(
      pointer1.x,
      pointer1.y,
      pointer2.x,
      pointer2.y
    );

    if (this.initialPinchDistance === 0) {
      this.initialPinchDistance = distance;
      this.initialZoom = this.cameraController.getZoom();
      return;
    }

    const zoomFactor = distance / this.initialPinchDistance;
    const newZoom = Phaser.Math.Clamp(this.initialZoom * zoomFactor, 0.5, 2.0);

    this.cameraController.setZoom(newZoom, 0);
    this.emit('zoom', newZoom);
  }

  /**
   * Update method to be called in scene's update loop
   */
  update(delta: number): void {
    if (this.config.keyboardEnabled) {
      this.updateKeyboard(delta);
    }
  }

  private updateKeyboard(delta: number): void {
    if (!this.cursors || !this.wasdKeys) return;

    const speed = this.config.keyboardPanSpeed * delta / 16; // Normalize to 60fps
    const camera = this.scene.cameras.main;

    let moveX = 0;
    let moveY = 0;

    // Check arrow keys
    if (this.cursors.left.isDown) moveX -= speed;
    if (this.cursors.right.isDown) moveX += speed;
    if (this.cursors.up.isDown) moveY -= speed;
    if (this.cursors.down.isDown) moveY += speed;

    // Check WASD keys
    if (this.wasdKeys.A.isDown) moveX -= speed;
    if (this.wasdKeys.D.isDown) moveX += speed;
    if (this.wasdKeys.W.isDown) moveY -= speed;
    if (this.wasdKeys.S.isDown) moveY += speed;

    if (moveX !== 0 || moveY !== 0) {
      // Stop camera follow when using keyboard
      if (this.cameraController.isFollowingTarget()) {
        this.cameraController.stopFollow();
      }

      camera.scrollX += moveX;
      camera.scrollY += moveY;

      // Emit move event
      this.emit('move', { x: moveX, y: moveY });
    }
  }

  /**
   * Enable or disable keyboard input
   */
  setKeyboardEnabled(enabled: boolean): void {
    this.config.keyboardEnabled = enabled;
  }

  /**
   * Enable or disable mouse input
   */
  setMouseEnabled(enabled: boolean): void {
    this.config.mouseEnabled = enabled;
  }

  /**
   * Enable or disable touch input
   */
  setTouchEnabled(enabled: boolean): void {
    this.config.touchEnabled = enabled;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.removeAllListeners();

    if (this.cursors) {
      this.cursors = undefined;
    }

    if (this.wasdKeys) {
      this.wasdKeys = undefined;
    }
  }
}
