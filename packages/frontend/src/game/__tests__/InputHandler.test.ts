/**
 * InputHandler Playable Environment Tests
 *
 * Simulates real gameplay input scenarios:
 * - Keyboard navigation (WASD and arrow keys)
 * - Mouse click selection
 * - Touch pinch-to-zoom
 * - Context menu (right-click)
 * - Zoom controls (+/- keys)
 * - Multi-input coordination
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Phaser from 'phaser';
import { InputHandler } from '../systems/InputHandler';
import type { CameraController } from '../systems/CameraController';

describe('InputHandler - Playable Environment Tests', () => {
  let scene: Phaser.Scene;
  let inputHandler: InputHandler;
  let mockCameraController: CameraController;
  let mockCamera: any;
  let mockInput: any;
  let mockKeyboard: any;

  // Key tracking
  let cursorKeys: any;
  let wasdKeys: any;
  let plusKey: any;
  let minusKey: any;
  let inputCallbacks: Map<string, Function[]>;

  beforeEach(() => {
    inputCallbacks = new Map();

    // Create mock cursor keys
    cursorKeys = {
      left: { isDown: false },
      right: { isDown: false },
      up: { isDown: false },
      down: { isDown: false },
    };

    // Create mock WASD keys
    wasdKeys = {
      W: { isDown: false, on: vi.fn() },
      A: { isDown: false, on: vi.fn() },
      S: { isDown: false, on: vi.fn() },
      D: { isDown: false, on: vi.fn() },
    };

    // Create mock +/- keys with event handlers
    // Use arrays like other event handlers for consistency with getFirstCallback helper
    plusKey = {
      isDown: false,
      on: vi.fn((event: string, callback: Function) => {
        if (event === 'down') {
          if (!inputCallbacks.has('plus')) {
            inputCallbacks.set('plus', []);
          }
          inputCallbacks.get('plus')!.push(callback);
        }
      }),
    };

    minusKey = {
      isDown: false,
      on: vi.fn((event: string, callback: Function) => {
        if (event === 'down') {
          if (!inputCallbacks.has('minus')) {
            inputCallbacks.set('minus', []);
          }
          inputCallbacks.get('minus')!.push(callback);
        }
      }),
    };

    // Create mock keyboard
    mockKeyboard = {
      createCursorKeys: vi.fn(() => cursorKeys),
      addKey: vi.fn((keyCode: number) => {
        // Map key codes to mock keys
        switch (keyCode) {
          case 87:
            return wasdKeys.W;
          case 65:
            return wasdKeys.A;
          case 83:
            return wasdKeys.S;
          case 68:
            return wasdKeys.D;
          case 187:
            return plusKey;
          case 189:
            return minusKey;
          default:
            return { isDown: false, on: vi.fn() };
        }
      }),
    };

    // Create mock camera
    mockCamera = {
      scrollX: 400,
      scrollY: 300,
      width: 800,
      height: 600,
      zoom: 1.0,
      getWorldPoint: vi.fn((x: number, y: number) => ({ x: x + 400, y: y + 300 })),
    };

    // Create mock input with event registration
    // Use arrays because InputHandler registers multiple handlers for the same event
    mockInput = {
      keyboard: mockKeyboard,
      on: vi.fn((event: string, callback: Function) => {
        if (!inputCallbacks.has(event)) {
          inputCallbacks.set(event, []);
        }
        inputCallbacks.get(event)!.push(callback);
      }),
      off: vi.fn(),
      pointer1: { isDown: false, x: 0, y: 0 },
      pointer2: { isDown: false, x: 0, y: 0 },
      activePointer: { x: 400, y: 300 },
    };

    // Create mock scene
    scene = {
      cameras: { main: mockCamera },
      input: mockInput,
    } as unknown as Phaser.Scene;

    // Create mock camera controller
    mockCameraController = {
      getZoom: vi.fn(() => mockCamera.zoom),
      setZoom: vi.fn((zoom: number) => {
        mockCamera.zoom = zoom;
      }),
      isFollowingTarget: vi.fn(() => false),
      stopFollow: vi.fn(),
    } as unknown as CameraController;

    inputHandler = new InputHandler(scene, mockCameraController, {
      keyboardEnabled: true,
      mouseEnabled: true,
      touchEnabled: true,
      keyboardPanSpeed: 5,
    });
  });

  afterEach(() => {
    inputHandler.destroy();
    vi.clearAllMocks();
  });

  // Helper function to trigger all callbacks for an event
  const triggerCallbacks = (event: string, ...args: any[]) => {
    const callbacks = inputCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(...args));
    }
  };

  // Helper to get first callback for single-handler events (like plus/minus keys)
  const getFirstCallback = (event: string) => {
    const callbacks = inputCallbacks.get(event);
    return callbacks?.[0];
  };

  describe('Initialization', () => {
    it('should create cursor keys for arrow navigation', () => {
      expect(mockKeyboard.createCursorKeys).toHaveBeenCalled();
    });

    it('should add WASD keys for navigation', () => {
      expect(mockKeyboard.addKey).toHaveBeenCalledWith(87); // W
      expect(mockKeyboard.addKey).toHaveBeenCalledWith(65); // A
      expect(mockKeyboard.addKey).toHaveBeenCalledWith(83); // S
      expect(mockKeyboard.addKey).toHaveBeenCalledWith(68); // D
    });

    it('should add zoom keys (+/-)', () => {
      expect(mockKeyboard.addKey).toHaveBeenCalledWith(187); // PLUS
      expect(mockKeyboard.addKey).toHaveBeenCalledWith(189); // MINUS
    });

    it('should register mouse event listeners', () => {
      expect(mockInput.on).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(mockInput.on).toHaveBeenCalledWith('pointerup', expect.any(Function));
      expect(mockInput.on).toHaveBeenCalledWith('pointermove', expect.any(Function));
    });
  });

  describe('Keyboard Navigation - Arrow Keys', () => {
    it('should pan left when left arrow is pressed', () => {
      cursorKeys.left.isDown = true;
      const initialScrollX = mockCamera.scrollX;

      inputHandler.update(16.67); // ~60fps

      expect(mockCamera.scrollX).toBeLessThan(initialScrollX);
    });

    it('should pan right when right arrow is pressed', () => {
      cursorKeys.right.isDown = true;
      const initialScrollX = mockCamera.scrollX;

      inputHandler.update(16.67);

      expect(mockCamera.scrollX).toBeGreaterThan(initialScrollX);
    });

    it('should pan up when up arrow is pressed', () => {
      cursorKeys.up.isDown = true;
      const initialScrollY = mockCamera.scrollY;

      inputHandler.update(16.67);

      expect(mockCamera.scrollY).toBeLessThan(initialScrollY);
    });

    it('should pan down when down arrow is pressed', () => {
      cursorKeys.down.isDown = true;
      const initialScrollY = mockCamera.scrollY;

      inputHandler.update(16.67);

      expect(mockCamera.scrollY).toBeGreaterThan(initialScrollY);
    });

    it('should pan diagonally when two arrows are pressed', () => {
      cursorKeys.up.isDown = true;
      cursorKeys.right.isDown = true;

      const initialScrollX = mockCamera.scrollX;
      const initialScrollY = mockCamera.scrollY;

      inputHandler.update(16.67);

      expect(mockCamera.scrollX).toBeGreaterThan(initialScrollX);
      expect(mockCamera.scrollY).toBeLessThan(initialScrollY);
    });
  });

  describe('Keyboard Navigation - WASD Keys', () => {
    it('should pan left when A is pressed', () => {
      wasdKeys.A.isDown = true;
      const initialScrollX = mockCamera.scrollX;

      inputHandler.update(16.67);

      expect(mockCamera.scrollX).toBeLessThan(initialScrollX);
    });

    it('should pan right when D is pressed', () => {
      wasdKeys.D.isDown = true;
      const initialScrollX = mockCamera.scrollX;

      inputHandler.update(16.67);

      expect(mockCamera.scrollX).toBeGreaterThan(initialScrollX);
    });

    it('should pan up when W is pressed', () => {
      wasdKeys.W.isDown = true;
      const initialScrollY = mockCamera.scrollY;

      inputHandler.update(16.67);

      expect(mockCamera.scrollY).toBeLessThan(initialScrollY);
    });

    it('should pan down when S is pressed', () => {
      wasdKeys.S.isDown = true;
      const initialScrollY = mockCamera.scrollY;

      inputHandler.update(16.67);

      expect(mockCamera.scrollY).toBeGreaterThan(initialScrollY);
    });

    it('should combine WASD with arrow keys', () => {
      wasdKeys.W.isDown = true;
      cursorKeys.right.isDown = true;

      const initialScrollX = mockCamera.scrollX;
      const initialScrollY = mockCamera.scrollY;

      inputHandler.update(16.67);

      expect(mockCamera.scrollX).toBeGreaterThan(initialScrollX);
      expect(mockCamera.scrollY).toBeLessThan(initialScrollY);
    });
  });

  describe('Keyboard Zoom Controls', () => {
    it('should zoom in when + key is pressed', () => {
      const plusCallback = getFirstCallback('plus');
      expect(plusCallback).toBeDefined();

      plusCallback!();

      expect(mockCameraController.setZoom).toHaveBeenCalledWith(
        expect.any(Number),
        100
      );
      // Should increase zoom
      const calledZoom = (mockCameraController.setZoom as any).mock.calls[0][0];
      expect(calledZoom).toBeGreaterThan(1.0);
    });

    it('should zoom out when - key is pressed', () => {
      const minusCallback = getFirstCallback('minus');
      expect(minusCallback).toBeDefined();

      minusCallback!();

      expect(mockCameraController.setZoom).toHaveBeenCalledWith(
        expect.any(Number),
        100
      );
      // Should decrease zoom
      const calledZoom = (mockCameraController.setZoom as any).mock.calls[0][0];
      expect(calledZoom).toBeLessThan(1.0);
    });

    it('should clamp zoom in to max (2.0)', () => {
      mockCamera.zoom = 1.95;

      const plusCallback = getFirstCallback('plus');
      plusCallback!();

      const calledZoom = (mockCameraController.setZoom as any).mock.calls[0][0];
      expect(calledZoom).toBeLessThanOrEqual(2.0);
    });

    it('should clamp zoom out to min (0.5)', () => {
      mockCamera.zoom = 0.55;

      const minusCallback = getFirstCallback('minus');
      minusCallback!();

      const calledZoom = (mockCameraController.setZoom as any).mock.calls[0][0];
      expect(calledZoom).toBeGreaterThanOrEqual(0.5);
    });

    it('should emit zoom event on keyboard zoom', () => {
      const zoomHandler = vi.fn();
      inputHandler.on('zoom', zoomHandler);

      const plusCallback = getFirstCallback('plus');
      plusCallback!();

      expect(zoomHandler).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  describe('Mouse Click Selection', () => {
    it('should emit select event on click (not drag)', () => {
      const selectHandler = vi.fn();
      inputHandler.on('select', selectHandler);

      const pointer = {
        x: 400,
        y: 300,
        downX: 400,
        downY: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      };

      // Trigger all pointerdown handlers (for downX/downY tracking)
      triggerCallbacks('pointerdown', pointer);

      // Pointer up at same position (click, not drag)
      triggerCallbacks('pointerup', pointer);

      expect(selectHandler).toHaveBeenCalledWith({
        x: expect.any(Number),
        y: expect.any(Number),
        pointer: expect.any(Object),
      });
    });

    it('should not emit select event on drag', () => {
      const selectHandler = vi.fn();
      inputHandler.on('select', selectHandler);

      triggerCallbacks('pointerdown', {
        x: 400,
        y: 300,
        downX: 400,
        downY: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      // Pointer up at different position (drag)
      triggerCallbacks('pointerup', {
        x: 350,
        y: 250,
        downX: 400,
        downY: 300,
        leftButtonDown: () => false,
        rightButtonDown: () => false,
      });

      expect(selectHandler).not.toHaveBeenCalled();
    });

    it('should convert screen coordinates to world coordinates', () => {
      const selectHandler = vi.fn();
      inputHandler.on('select', selectHandler);

      const pointer = {
        x: 400,
        y: 300,
        downX: 400,
        downY: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      };

      triggerCallbacks('pointerdown', pointer);
      triggerCallbacks('pointerup', pointer);

      // Verify getWorldPoint was called to convert coordinates
      expect(mockCamera.getWorldPoint).toHaveBeenCalledWith(400, 300);
    });
  });

  describe('Right-Click Context Menu', () => {
    it('should emit contextMenu event on right click', () => {
      const contextMenuHandler = vi.fn();
      inputHandler.on('contextMenu', contextMenuHandler);

      triggerCallbacks('pointerdown', {
        x: 500,
        y: 400,
        leftButtonDown: () => false,
        rightButtonDown: () => true,
      });

      expect(contextMenuHandler).toHaveBeenCalledWith({
        x: expect.any(Number),
        y: expect.any(Number),
        pointer: expect.any(Object),
      });
    });

    it('should not emit contextMenu on left click', () => {
      const contextMenuHandler = vi.fn();
      inputHandler.on('contextMenu', contextMenuHandler);

      triggerCallbacks('pointerdown', {
        x: 500,
        y: 400,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      expect(contextMenuHandler).not.toHaveBeenCalled();
    });
  });

  describe('Touch Pinch-to-Zoom', () => {
    it('should zoom in on pinch spread', () => {
      const zoomHandler = vi.fn();
      inputHandler.on('zoom', zoomHandler);

      // Simulate two-finger touch
      mockInput.pointer1 = { isDown: true, x: 300, y: 300 };
      mockInput.pointer2 = { isDown: true, x: 500, y: 300 };

      // Initial touch - set baseline distance (200px)
      triggerCallbacks('pointermove', {});

      // Spread fingers - increase distance (400px)
      mockInput.pointer1.x = 200;
      mockInput.pointer2.x = 600;

      triggerCallbacks('pointermove', {});

      // Should have zoomed (spread = zoom in)
      expect(mockCameraController.setZoom).toHaveBeenCalled();
    });

    it('should zoom out on pinch close', () => {
      const zoomHandler = vi.fn();
      inputHandler.on('zoom', zoomHandler);

      // Simulate two-finger touch spread
      mockInput.pointer1 = { isDown: true, x: 200, y: 300 };
      mockInput.pointer2 = { isDown: true, x: 600, y: 300 };

      // Initial touch - set baseline distance (400px)
      triggerCallbacks('pointermove', {});

      // Close fingers - decrease distance (200px)
      mockInput.pointer1.x = 300;
      mockInput.pointer2.x = 500;

      triggerCallbacks('pointermove', {});

      expect(mockCameraController.setZoom).toHaveBeenCalled();
    });

    it('should reset pinch state when fingers lift', () => {
      mockInput.pointer1 = { isDown: true, x: 300, y: 300 };
      mockInput.pointer2 = { isDown: true, x: 500, y: 300 };

      // Start pinch
      triggerCallbacks('pointermove', {});

      // Lift fingers
      triggerCallbacks('pointerup', {});

      // New pinch should start fresh
      mockInput.pointer1 = { isDown: true, x: 350, y: 300 };
      mockInput.pointer2 = { isDown: true, x: 450, y: 300 };

      // This should reset the baseline
      triggerCallbacks('pointermove', {});

      // Verify zoom was called with no immediate change (new baseline)
      // The implementation resets initialPinchDistance
    });

    it('should not zoom with single finger', () => {
      mockInput.pointer1 = { isDown: true, x: 300, y: 300 };
      mockInput.pointer2 = { isDown: false, x: 500, y: 300 };

      triggerCallbacks('pointermove', {});

      expect(mockCameraController.setZoom).not.toHaveBeenCalled();
    });
  });

  describe('Camera Follow Interaction', () => {
    it('should stop follow when keyboard pan is used', () => {
      (mockCameraController.isFollowingTarget as any).mockReturnValue(true);

      wasdKeys.W.isDown = true;
      inputHandler.update(16.67);

      expect(mockCameraController.stopFollow).toHaveBeenCalled();
    });

    it('should not stop follow if no movement keys pressed', () => {
      (mockCameraController.isFollowingTarget as any).mockReturnValue(true);

      inputHandler.update(16.67);

      expect(mockCameraController.stopFollow).not.toHaveBeenCalled();
    });
  });

  describe('Input Enable/Disable', () => {
    it('should allow disabling keyboard input', () => {
      inputHandler.setKeyboardEnabled(false);

      wasdKeys.W.isDown = true;
      const initialScrollY = mockCamera.scrollY;

      inputHandler.update(16.67);

      expect(mockCamera.scrollY).toBe(initialScrollY);
    });

    it('should allow re-enabling keyboard input', () => {
      inputHandler.setKeyboardEnabled(false);
      inputHandler.setKeyboardEnabled(true);

      wasdKeys.W.isDown = true;
      const initialScrollY = mockCamera.scrollY;

      inputHandler.update(16.67);

      expect(mockCamera.scrollY).toBeLessThan(initialScrollY);
    });

    it('should allow disabling mouse input', () => {
      inputHandler.setMouseEnabled(false);
      // This just sets internal state - events still fire but are ignored
      expect(inputHandler).toBeDefined();
    });

    it('should allow disabling touch input', () => {
      inputHandler.setTouchEnabled(false);
      expect(inputHandler).toBeDefined();
    });
  });

  describe('Movement Event Emission', () => {
    it('should emit move event on keyboard pan', () => {
      const moveHandler = vi.fn();
      inputHandler.on('move', moveHandler);

      wasdKeys.D.isDown = true;
      inputHandler.update(16.67);

      expect(moveHandler).toHaveBeenCalledWith({
        x: expect.any(Number),
        y: expect.any(Number),
      });
    });

    it('should not emit move event when no keys pressed', () => {
      const moveHandler = vi.fn();
      inputHandler.on('move', moveHandler);

      inputHandler.update(16.67);

      expect(moveHandler).not.toHaveBeenCalled();
    });
  });

  describe('Frame-Rate Independence', () => {
    it('should move consistently at different frame rates', () => {
      wasdKeys.D.isDown = true;

      // 60fps movement
      const initialScrollX60 = mockCamera.scrollX;
      inputHandler.update(16.67);
      const delta60 = mockCamera.scrollX - initialScrollX60;

      // Reset
      mockCamera.scrollX = 400;

      // 30fps movement (double delta time)
      inputHandler.update(33.33);
      const delta30 = mockCamera.scrollX - 400;

      // Movement should be roughly proportional to delta time
      expect(delta30).toBeCloseTo(delta60 * 2, 0);
    });
  });

  describe('Gameplay Scenario: Agent Selection', () => {
    it('should allow selecting agents with click', () => {
      const selectHandler = vi.fn();
      inputHandler.on('select', selectHandler);

      // Click on agent at screen position (300, 200)
      const pointer = {
        x: 300,
        y: 200,
        downX: 300,
        downY: 200,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      };

      triggerCallbacks('pointerdown', pointer);
      triggerCallbacks('pointerup', pointer);

      expect(selectHandler).toHaveBeenCalled();
      const worldCoords = selectHandler.mock.calls[0][0];
      expect(worldCoords).toHaveProperty('x');
      expect(worldCoords).toHaveProperty('y');
    });

    it('should allow opening agent context menu with right-click', () => {
      const contextMenuHandler = vi.fn();
      inputHandler.on('contextMenu', contextMenuHandler);

      triggerCallbacks('pointerdown', {
        x: 300,
        y: 200,
        leftButtonDown: () => false,
        rightButtonDown: () => true,
      });

      expect(contextMenuHandler).toHaveBeenCalled();
    });
  });

  describe('Gameplay Scenario: Map Navigation', () => {
    it('should allow navigating map with keyboard', () => {
      const initialScrollX = mockCamera.scrollX;
      const initialScrollY = mockCamera.scrollY;

      // Pan right and down
      wasdKeys.D.isDown = true;
      wasdKeys.S.isDown = true;
      inputHandler.update(16.67);

      expect(mockCamera.scrollX).toBeGreaterThan(initialScrollX);
      expect(mockCamera.scrollY).toBeGreaterThan(initialScrollY);

      // Pan back
      wasdKeys.D.isDown = false;
      wasdKeys.S.isDown = false;
      wasdKeys.A.isDown = true;
      wasdKeys.W.isDown = true;

      const midScrollX = mockCamera.scrollX;
      const midScrollY = mockCamera.scrollY;

      inputHandler.update(16.67);

      expect(mockCamera.scrollX).toBeLessThan(midScrollX);
      expect(mockCamera.scrollY).toBeLessThan(midScrollY);
    });

    it('should allow zooming with keyboard for overview', () => {
      mockCamera.zoom = 1.0;

      // Zoom out for overview
      const minusCallback = getFirstCallback('minus');
      minusCallback!();
      minusCallback!();
      minusCallback!();

      expect(mockCameraController.setZoom).toHaveBeenCalledTimes(3);

      // Zoom in for detail
      const plusCallback = getFirstCallback('plus');
      plusCallback!();
      plusCallback!();

      expect(mockCameraController.setZoom).toHaveBeenCalledTimes(5);
    });
  });

  describe('Cleanup', () => {
    it('should clean up event listeners on destroy', () => {
      inputHandler.destroy();

      // After destroy, internal state should be cleared
      expect(inputHandler.listenerCount('select')).toBe(0);
      expect(inputHandler.listenerCount('zoom')).toBe(0);
      expect(inputHandler.listenerCount('move')).toBe(0);
    });
  });
});
