import Phaser from 'phaser';
import type { CameraController } from './CameraController';

export interface InputConfig {
  keyboardEnabled?: boolean;
  mouseEnabled?: boolean;
  touchEnabled?: boolean;
  gamepadEnabled?: boolean;
  keyboardPanSpeed?: number;
  gamepadPanSpeed?: number;
  gamepadDeadzone?: number;
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

  // Gamepad
  private activeGamepad?: Phaser.Input.Gamepad.Gamepad;
  private onGamepadConnected?: (pad: Phaser.Input.Gamepad.Gamepad) => void;
  private onGamepadDisconnected?: (pad: Phaser.Input.Gamepad.Gamepad) => void;

  constructor(scene: Phaser.Scene, cameraController: CameraController, config: InputConfig = {}) {
    super();

    this.scene = scene;
    this.cameraController = cameraController;

    this.config = {
      keyboardEnabled: config.keyboardEnabled ?? true,
      mouseEnabled: config.mouseEnabled ?? true,
      touchEnabled: config.touchEnabled ?? true,
      gamepadEnabled: config.gamepadEnabled ?? true,
      keyboardPanSpeed: config.keyboardPanSpeed ?? 5,
      gamepadPanSpeed: config.gamepadPanSpeed ?? 8,
      gamepadDeadzone: config.gamepadDeadzone ?? 0.15,
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

    if (this.config.gamepadEnabled) {
      this.setupGamepad();
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
        pointer.y,
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

    const distance = Phaser.Math.Distance.Between(pointer1.x, pointer1.y, pointer2.x, pointer2.y);

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

  private setupGamepad() {
    const gamepad = (this.scene.input as any).gamepad as
      | Phaser.Input.Gamepad.GamepadPlugin
      | undefined;
    if (!gamepad) return;

    this.onGamepadConnected = (pad) => {
      this.activeGamepad = pad;
      this.emit('gamepadConnected', { id: (pad as any).id ?? 'unknown' });
    };

    this.onGamepadDisconnected = (pad) => {
      if (this.activeGamepad === pad) this.activeGamepad = undefined;
      this.emit('gamepadDisconnected', { id: (pad as any).id ?? 'unknown' });
    };

    gamepad.on('connected', this.onGamepadConnected);
    gamepad.on('disconnected', this.onGamepadDisconnected);

    // If a pad is already connected, use it immediately.
    try {
      const existing = (gamepad as any).pads?.find((p: any) => p?.connected);
      if (existing) this.activeGamepad = existing;
    } catch {
      // Ignore inspection failures; the connected event will set active pad.
    }
  }

  /**
   * Update method to be called in scene's update loop
   */
  update(delta: number): void {
    if (this.config.keyboardEnabled) {
      this.updateKeyboard(delta);
    }

    if (this.config.gamepadEnabled) {
      this.updateGamepad(delta);
    }
  }

  private updateKeyboard(delta: number): void {
    if (!this.cursors || !this.wasdKeys) return;

    const speed = (this.config.keyboardPanSpeed * delta) / 16; // Normalize to 60fps
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

  private updateGamepad(delta: number): void {
    const plugin = (this.scene.input as any).gamepad as any;
    if (!plugin) return;

    const pad: any =
      this.activeGamepad ||
      plugin.pad1 ||
      (Array.isArray(plugin.pads) ? plugin.pads.find((p: any) => p?.connected) : undefined);
    if (!pad) return;

    const axis0 = pad.axes?.[0];
    const axis1 = pad.axes?.[1];
    const rawX = typeof axis0?.getValue === 'function' ? axis0.getValue() : (pad.leftStick?.x ?? 0);
    const rawY = typeof axis1?.getValue === 'function' ? axis1.getValue() : (pad.leftStick?.y ?? 0);

    const deadzone = this.config.gamepadDeadzone;
    const x = Math.abs(rawX) >= deadzone ? rawX : 0;
    const y = Math.abs(rawY) >= deadzone ? rawY : 0;
    if (!x && !y) return;

    const speed = (this.config.gamepadPanSpeed * delta) / 16;
    const camera = this.scene.cameras.main;

    // Stop camera follow when using gamepad
    if (this.cameraController.isFollowingTarget()) {
      this.cameraController.stopFollow();
    }

    camera.scrollX += x * speed;
    camera.scrollY += y * speed;
    this.emit('move', { x: x * speed, y: y * speed, source: 'gamepad' });
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
   * Enable or disable gamepad input
   */
  setGamepadEnabled(enabled: boolean): void {
    this.config.gamepadEnabled = enabled;
    if (enabled) this.setupGamepad();
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

    try {
      const gamepad = (this.scene.input as any).gamepad as any;
      if (gamepad && this.onGamepadConnected) gamepad.off('connected', this.onGamepadConnected);
      if (gamepad && this.onGamepadDisconnected)
        gamepad.off('disconnected', this.onGamepadDisconnected);
    } catch {
      // Ignore teardown issues.
    }
  }
}
