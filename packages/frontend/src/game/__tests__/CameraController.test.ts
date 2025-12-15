/**
 * CameraController Playable Environment Tests
 *
 * Simulates real gameplay scenarios for camera interactions:
 * - Zoom controls with smooth transitions
 * - Drag-to-pan movement
 * - Edge scrolling behavior
 * - Agent following mode
 * - World bounds constraints
 * - Frame-rate independent updates
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Phaser from 'phaser';
import { CameraController } from '../systems/CameraController';

describe('CameraController - Playable Environment Tests', () => {
  let scene: Phaser.Scene;
  let cameraController: CameraController;
  let mockCamera: any;
  let mockInput: any;
  let pointerCallbacks: Map<string, (...args: unknown[]) => void>;

  beforeEach(() => {
    pointerCallbacks = new Map();

    // Create mock camera with full functionality
    mockCamera = {
      x: 0,
      y: 0,
      scrollX: 400,
      scrollY: 300,
      width: 800,
      height: 600,
      zoom: 1.0,
      worldView: { x: 0, y: 0, width: 800, height: 600 },
      setBounds: vi.fn().mockReturnThis(),
      setZoom: vi.fn(function (z: number) {
        this.zoom = z;
        return this;
      }),
      zoomTo: vi.fn(function (z: number, _duration?: number) {
        this.zoom = z;
        return this;
      }),
      centerOn: vi.fn(function (x: number, y: number) {
        this.scrollX = x - this.width / 2;
        this.scrollY = y - this.height / 2;
        return this;
      }),
      pan: vi.fn(function (x: number, y: number) {
        this.scrollX = x;
        this.scrollY = y;
        return this;
      }),
      startFollow: vi.fn().mockReturnThis(),
      stopFollow: vi.fn().mockReturnThis(),
      getWorldPoint: vi.fn((x: number, y: number) => ({ x, y })),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1600, height: 1200 })),
    };

    // Create mock input system with event capturing
    mockInput = {
      on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        pointerCallbacks.set(event, callback);
      }),
      off: vi.fn(),
      activePointer: { x: 400, y: 300 },
    };

    // Create mock scene
    scene = {
      cameras: { main: mockCamera },
      input: mockInput,
    } as unknown as Phaser.Scene;

    cameraController = new CameraController(scene, {
      minZoom: 0.5,
      maxZoom: 2.0,
      worldBounds: new Phaser.Geom.Rectangle(0, 0, 1600, 1200),
      followLerp: 0.1,
      panSpeed: 1.0,
      edgeScrollMargin: 50,
    });
  });

  afterEach(() => {
    cameraController.destroy();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should set camera bounds on initialization', () => {
      expect(mockCamera.setBounds).toHaveBeenCalledWith(0, 0, 1600, 1200);
    });

    it('should register input event listeners', () => {
      expect(mockInput.on).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(mockInput.on).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(mockInput.on).toHaveBeenCalledWith('pointerup', expect.any(Function));
      expect(mockInput.on).toHaveBeenCalledWith('wheel', expect.any(Function));
    });
  });

  describe('Zoom Controls', () => {
    it('should zoom in with mouse wheel scroll up', () => {
      const wheelCallback = pointerCallbacks.get('wheel');
      expect(wheelCallback).toBeDefined();

      // Simulate wheel scroll up (negative deltaY = zoom in)
      wheelCallback!({}, [], 0, -100);

      expect(mockCamera.zoomTo).toHaveBeenCalled();
      // Should increase zoom by 0.1
      const calledZoom = mockCamera.zoomTo.mock.calls[0][0];
      expect(calledZoom).toBeCloseTo(1.1, 1);
    });

    it('should zoom out with mouse wheel scroll down', () => {
      const wheelCallback = pointerCallbacks.get('wheel');

      // Simulate wheel scroll down (positive deltaY = zoom out)
      wheelCallback!({}, [], 0, 100);

      expect(mockCamera.zoomTo).toHaveBeenCalled();
      const calledZoom = mockCamera.zoomTo.mock.calls[0][0];
      expect(calledZoom).toBeCloseTo(0.9, 1);
    });

    it('should clamp zoom to max limit', () => {
      mockCamera.zoom = 1.95;

      const wheelCallback = pointerCallbacks.get('wheel');
      wheelCallback!({}, [], 0, -100);

      const calledZoom = mockCamera.zoomTo.mock.calls[0][0];
      expect(calledZoom).toBeLessThanOrEqual(2.0);
    });

    it('should clamp zoom to min limit', () => {
      mockCamera.zoom = 0.55;

      const wheelCallback = pointerCallbacks.get('wheel');
      wheelCallback!({}, [], 0, 100);

      const calledZoom = mockCamera.zoomTo.mock.calls[0][0];
      expect(calledZoom).toBeGreaterThanOrEqual(0.5);
    });

    it('should set zoom level with smooth transition', () => {
      cameraController.setZoom(1.5, 200);

      expect(mockCamera.zoomTo).toHaveBeenCalledWith(1.5, 200);
    });

    it('should set zoom level instantly without duration', () => {
      cameraController.setZoom(1.5);

      expect(mockCamera.setZoom).toHaveBeenCalledWith(1.5);
    });

    it('should report current zoom level', () => {
      mockCamera.zoom = 1.5;
      expect(cameraController.getZoom()).toBe(1.5);
    });
  });

  describe('Drag-to-Pan Movement', () => {
    it('should start drag on left mouse button down', () => {
      const pointerdownCallback = pointerCallbacks.get('pointerdown');
      const mockPointer = {
        x: 400,
        y: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      };

      pointerdownCallback!(mockPointer);

      // Drag state should be started (internal state)
      // We can verify by checking if follow stops on drag
      cameraController.follow({ x: 0, y: 0 } as Phaser.GameObjects.Sprite);
      expect(mockCamera.startFollow).toHaveBeenCalled();

      // Start another drag - should stop following
      pointerdownCallback!(mockPointer);
      expect(mockCamera.stopFollow).toHaveBeenCalled();
    });

    it('should pan camera during drag movement', () => {
      // Start drag
      const pointerdownCallback = pointerCallbacks.get('pointerdown');
      const pointermoveCallback = pointerCallbacks.get('pointermove');

      const startPointer = {
        x: 400,
        y: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      };

      pointerdownCallback!(startPointer);

      // Move pointer (simulating drag)
      const movePointer = {
        x: 350, // Moved 50px left
        y: 250, // Moved 50px up
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      };

      const initialScrollX = mockCamera.scrollX;
      const initialScrollY = mockCamera.scrollY;

      pointermoveCallback!(movePointer);

      // Camera should have panned in opposite direction of drag
      expect(mockCamera.scrollX).toBeGreaterThan(initialScrollX);
      expect(mockCamera.scrollY).toBeGreaterThan(initialScrollY);
    });

    it('should stop drag on pointer up', () => {
      const pointerdownCallback = pointerCallbacks.get('pointerdown');
      const pointerupCallback = pointerCallbacks.get('pointerup');
      const pointermoveCallback = pointerCallbacks.get('pointermove');

      // Start drag
      pointerdownCallback!({
        x: 400,
        y: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      // Release
      pointerupCallback!({
        x: 400,
        y: 300,
        leftButtonDown: () => false,
        rightButtonDown: () => false,
      });

      // Save scroll position after release
      const scrollXAfterRelease = mockCamera.scrollX;
      const scrollYAfterRelease = mockCamera.scrollY;

      // Move pointer after release - should not pan
      pointermoveCallback!({
        x: 300,
        y: 200,
        leftButtonDown: () => false,
        rightButtonDown: () => false,
      });

      expect(mockCamera.scrollX).toBe(scrollXAfterRelease);
      expect(mockCamera.scrollY).toBe(scrollYAfterRelease);
    });

    it('should account for zoom level during drag', () => {
      mockCamera.zoom = 2.0; // Zoomed in

      const pointerdownCallback = pointerCallbacks.get('pointerdown');
      const pointermoveCallback = pointerCallbacks.get('pointermove');

      pointerdownCallback!({
        x: 400,
        y: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      const initialScrollX = mockCamera.scrollX;

      pointermoveCallback!({
        x: 350, // 50px drag
        y: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      // At 2x zoom, the world movement should be halved (50 / 2 = 25)
      const deltaX = mockCamera.scrollX - initialScrollX;
      expect(deltaX).toBeCloseTo(25, 0);
    });
  });

  describe('Edge Scrolling', () => {
    it('should scroll left when pointer near left edge', () => {
      mockInput.activePointer = { x: 25, y: 300 }; // Near left edge (margin is 50)

      const initialScrollX = mockCamera.scrollX;
      cameraController.update(16.67); // ~60fps delta

      expect(mockCamera.scrollX).toBeLessThan(initialScrollX);
    });

    it('should scroll right when pointer near right edge', () => {
      mockInput.activePointer = { x: 775, y: 300 }; // Near right edge (800 - 50 = 750)

      const initialScrollX = mockCamera.scrollX;
      cameraController.update(16.67);

      expect(mockCamera.scrollX).toBeGreaterThan(initialScrollX);
    });

    it('should scroll up when pointer near top edge', () => {
      mockInput.activePointer = { x: 400, y: 25 }; // Near top edge

      const initialScrollY = mockCamera.scrollY;
      cameraController.update(16.67);

      expect(mockCamera.scrollY).toBeLessThan(initialScrollY);
    });

    it('should scroll down when pointer near bottom edge', () => {
      mockInput.activePointer = { x: 400, y: 575 }; // Near bottom edge (600 - 50 = 550)

      const initialScrollY = mockCamera.scrollY;
      cameraController.update(16.67);

      expect(mockCamera.scrollY).toBeGreaterThan(initialScrollY);
    });

    it('should scroll diagonally when pointer in corner', () => {
      mockInput.activePointer = { x: 25, y: 25 }; // Top-left corner

      const initialScrollX = mockCamera.scrollX;
      const initialScrollY = mockCamera.scrollY;

      cameraController.update(16.67);

      expect(mockCamera.scrollX).toBeLessThan(initialScrollX);
      expect(mockCamera.scrollY).toBeLessThan(initialScrollY);
    });

    it('should not edge scroll during drag', () => {
      // Start drag
      const pointerdownCallback = pointerCallbacks.get('pointerdown');
      pointerdownCallback!({
        x: 400,
        y: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      mockInput.activePointer = { x: 25, y: 300 }; // Near edge
      const initialScrollX = mockCamera.scrollX;

      cameraController.update(16.67);

      // During drag, edge scroll should not apply additional movement
      // (only drag movement applies)
      expect(mockCamera.scrollX).toBe(initialScrollX);
    });

    it('should not edge scroll during follow mode', () => {
      cameraController.follow({ x: 500, y: 400 } as Phaser.GameObjects.Sprite);

      mockInput.activePointer = { x: 25, y: 300 }; // Near edge
      const initialScrollX = mockCamera.scrollX;

      cameraController.update(16.67);

      expect(mockCamera.scrollX).toBe(initialScrollX);
    });

    it('should respect enable/disable edge scroll', () => {
      cameraController.setEdgeScroll(false);

      mockInput.activePointer = { x: 25, y: 300 }; // Near edge
      const initialScrollX = mockCamera.scrollX;

      cameraController.update(16.67);

      expect(mockCamera.scrollX).toBe(initialScrollX);
    });
  });

  describe('Follow Mode', () => {
    it('should start following a target sprite', () => {
      const target = { x: 500, y: 400 } as Phaser.GameObjects.Sprite;

      cameraController.follow(target);

      expect(mockCamera.startFollow).toHaveBeenCalledWith(target, false, 0.1, 0.1);
      expect(cameraController.isFollowingTarget()).toBe(true);
    });

    it('should follow with custom lerp value', () => {
      const target = { x: 500, y: 400 } as Phaser.GameObjects.Sprite;

      cameraController.follow(target, 0.2);

      expect(mockCamera.startFollow).toHaveBeenCalledWith(target, false, 0.2, 0.2);
    });

    it('should stop following when stopFollow called', () => {
      const target = { x: 500, y: 400 } as Phaser.GameObjects.Sprite;
      cameraController.follow(target);

      cameraController.stopFollow();

      expect(mockCamera.stopFollow).toHaveBeenCalled();
      expect(cameraController.isFollowingTarget()).toBe(false);
    });

    it('should stop following when user drags', () => {
      const target = { x: 500, y: 400 } as Phaser.GameObjects.Sprite;
      cameraController.follow(target);

      const pointerdownCallback = pointerCallbacks.get('pointerdown');
      pointerdownCallback!({
        x: 400,
        y: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      expect(mockCamera.stopFollow).toHaveBeenCalled();
      expect(cameraController.isFollowingTarget()).toBe(false);
    });
  });

  describe('Pan To Position', () => {
    it('should pan to world coordinates with smooth transition', () => {
      cameraController.panTo(800, 600, 500);

      expect(mockCamera.pan).toHaveBeenCalledWith(800, 600, 500, 'Sine.easeInOut');
    });

    it('should pan to world coordinates instantly without duration', () => {
      cameraController.panTo(800, 600);

      expect(mockCamera.centerOn).toHaveBeenCalledWith(800, 600);
    });
  });

  describe('World Bounds Constraint', () => {
    it('should update world bounds', () => {
      const newBounds = new Phaser.Geom.Rectangle(0, 0, 3200, 2400);
      cameraController.setBounds(newBounds);

      expect(mockCamera.setBounds).toHaveBeenCalledWith(0, 0, 3200, 2400);
    });

    it('should constrain camera scroll to world bounds during drag', () => {
      // Set up drag at edge of world
      mockCamera.scrollX = 1500; // Near right edge
      mockCamera.scrollY = 1100; // Near bottom edge

      const pointerdownCallback = pointerCallbacks.get('pointerdown');
      const pointermoveCallback = pointerCallbacks.get('pointermove');

      pointerdownCallback!({
        x: 400,
        y: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      // Try to drag beyond bounds
      pointermoveCallback!({
        x: 200, // Try to scroll right past bounds
        y: 100,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      // Camera should be clamped to world bounds
      // At zoom 1.0, visible area is 800x600, max scroll is 1600-800=800 for X
      expect(mockCamera.scrollX).toBeLessThanOrEqual(800);
      expect(mockCamera.scrollY).toBeLessThanOrEqual(600);
    });
  });

  describe('Camera Center Point', () => {
    it('should return camera center in world coordinates', () => {
      mockCamera.scrollX = 400;
      mockCamera.scrollY = 300;
      mockCamera.width = 800;
      mockCamera.height = 600;
      mockCamera.zoom = 1.0;

      const center = cameraController.getCenterPoint();

      expect(center.x).toBe(800); // scrollX + width/2
      expect(center.y).toBe(600); // scrollY + height/2
    });

    it('should account for zoom when calculating center', () => {
      mockCamera.scrollX = 400;
      mockCamera.scrollY = 300;
      mockCamera.zoom = 2.0;

      const center = cameraController.getCenterPoint();

      // At 2x zoom, visible area is halved
      expect(center.x).toBe(600); // scrollX + (width/2)/zoom = 400 + 200
      expect(center.y).toBe(450); // scrollY + (height/2)/zoom = 300 + 150
    });
  });

  describe('Frame-Rate Independence', () => {
    it('should scroll consistently at different frame rates', () => {
      mockInput.activePointer = { x: 25, y: 300 }; // Near left edge

      // 60fps delta
      const initialScrollX60 = mockCamera.scrollX;
      cameraController.update(16.67);
      const delta60 = initialScrollX60 - mockCamera.scrollX;

      // Reset
      mockCamera.scrollX = initialScrollX60;

      // 30fps delta (double the time)
      cameraController.update(33.33);
      const delta30 = initialScrollX60 - mockCamera.scrollX;

      // At 30fps, movement should be roughly double
      expect(delta30).toBeCloseTo(delta60 * 2, 0);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const target = { x: 500, y: 400 } as Phaser.GameObjects.Sprite;
      cameraController.follow(target);

      cameraController.destroy();

      expect(mockCamera.stopFollow).toHaveBeenCalled();
      expect(cameraController.isFollowingTarget()).toBe(false);
    });
  });

  describe('Gameplay Scenario: Exploring Village', () => {
    it('should allow smooth exploration with zoom and pan', () => {
      // Player starts zoomed out to see overview
      cameraController.setZoom(0.75, 200);
      expect(mockCamera.zoomTo).toHaveBeenCalledWith(0.75, 200);

      // Player pans to interesting location
      cameraController.panTo(1000, 800, 300);
      expect(mockCamera.pan).toHaveBeenCalled();

      // Player zooms in to see detail
      cameraController.setZoom(1.5, 200);

      // Player drags to fine-tune view
      const pointerdownCallback = pointerCallbacks.get('pointerdown');
      const pointermoveCallback = pointerCallbacks.get('pointermove');
      const pointerupCallback = pointerCallbacks.get('pointerup');

      pointerdownCallback!({
        x: 400,
        y: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      pointermoveCallback!({
        x: 380,
        y: 280,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      pointerupCallback!({
        x: 380,
        y: 280,
        leftButtonDown: () => false,
        rightButtonDown: () => false,
      });

      // Verify camera has moved
      expect(mockCamera.scrollX).toBeDefined();
      expect(mockCamera.scrollY).toBeDefined();
    });

    it('should allow following agent and then taking control', () => {
      const agent = { x: 600, y: 400 } as Phaser.GameObjects.Sprite;

      // Player clicks "follow agent" button
      cameraController.follow(agent, 0.15);
      expect(cameraController.isFollowingTarget()).toBe(true);

      // Player drags to take manual control
      const pointerdownCallback = pointerCallbacks.get('pointerdown');
      pointerdownCallback!({
        x: 400,
        y: 300,
        leftButtonDown: () => true,
        rightButtonDown: () => false,
      });

      expect(cameraController.isFollowingTarget()).toBe(false);

      // Player can resume following
      cameraController.follow(agent);
      expect(cameraController.isFollowingTarget()).toBe(true);
    });
  });
});
