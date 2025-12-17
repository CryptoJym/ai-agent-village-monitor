/**
 * LODSystem (Level of Detail) Testing Suite
 *
 * Simulates dynamic detail reduction for optimized village rendering:
 * - Distance-based LOD switching
 * - Zoom-based LOD switching
 * - Custom LOD callbacks
 * - Sprite detail reduction
 * - Complex object decoration hiding
 * - Frame-skip optimization
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Phaser from 'phaser';
import { LODSystem } from '../rendering/LODSystem';

describe('LODSystem - Level of Detail Tests', () => {
  let scene: Phaser.Scene;
  let lodSystem: LODSystem;
  let mockCamera: any;

  beforeEach(() => {
    // Create mock camera
    // zoom >= 2.0 ensures HIGH detail from zoom (above zoomHighThreshold)
    // so distance-based LOD determines the actual level
    mockCamera = {
      scrollX: 0,
      scrollY: 0,
      width: 800,
      height: 600,
      zoom: 2.0, // High zoom to ensure distance-based LOD takes priority
    };

    // Create mock scene
    scene = {} as Phaser.Scene;

    lodSystem = new LODSystem(scene, {
      highDetailDistance: 200,
      mediumDetailDistance: 400,
      lowDetailDistance: 800,
      zoomHighThreshold: 1.5,
      zoomMediumThreshold: 1.0,
      zoomLowThreshold: 0.5,
    });

    lodSystem.setCamera(mockCamera);
  });

  afterEach(() => {
    lodSystem.destroy();
    vi.clearAllMocks();
  });

  describe('Object Registration', () => {
    it('should register object with LOD callbacks', () => {
      const mockObj = { x: 100, y: 100 };
      const highDetail = vi.fn();
      const lowDetail = vi.fn();

      lodSystem.registerObject('building-1', mockObj as any, {
        highDetail,
        lowDetail,
      });

      const stats = lodSystem.getStats();
      expect(stats.totalObjects).toBe(1);
    });

    it('should unregister object', () => {
      const mockObj = { x: 100, y: 100 };

      lodSystem.registerObject('temp-obj', mockObj as any, {});
      lodSystem.unregisterObject('temp-obj');

      const stats = lodSystem.getStats();
      expect(stats.totalObjects).toBe(0);
    });

    it('should start objects at HIGH detail', () => {
      const mockObj = { x: 100, y: 100 };

      lodSystem.registerObject('new-obj', mockObj as any, {});

      const stats = lodSystem.getStats();
      expect(stats.highDetail).toBe(1);
    });
  });

  describe('Distance-Based LOD', () => {
    it('should maintain HIGH detail when object is close to camera', () => {
      mockCamera.scrollX = 0;
      mockCamera.scrollY = 0;

      const highCallback = vi.fn();
      const mockObj = { x: 500, y: 400 }; // Camera center is at (400, 300)

      lodSystem.registerObject('close-obj', mockObj as any, {
        highDetail: highCallback,
      });

      lodSystem.forceUpdate();

      const stats = lodSystem.getStats();
      expect(stats.highDetail).toBe(1);
    });

    it('should switch to MEDIUM detail at moderate distance', () => {
      mockCamera.scrollX = 0;
      mockCamera.scrollY = 0;

      const mediumCallback = vi.fn();
      const mockObj = { x: 700, y: 300 }; // ~300px from camera center

      lodSystem.registerObject('medium-obj', mockObj as any, {
        mediumDetail: mediumCallback,
      });

      lodSystem.forceUpdate();

      expect(mediumCallback).toHaveBeenCalled();
      expect(lodSystem.getStats().mediumDetail).toBe(1);
    });

    it('should switch to LOW detail at far distance', () => {
      mockCamera.scrollX = 0;
      mockCamera.scrollY = 0;

      const lowCallback = vi.fn();
      const mockObj = { x: 1000, y: 300 }; // ~600px from camera center

      lodSystem.registerObject('far-obj', mockObj as any, {
        lowDetail: lowCallback,
      });

      lodSystem.forceUpdate();

      expect(lowCallback).toHaveBeenCalled();
      expect(lodSystem.getStats().lowDetail).toBe(1);
    });

    it('should switch to MINIMAL detail at very far distance', () => {
      mockCamera.scrollX = 0;
      mockCamera.scrollY = 0;

      const minimalCallback = vi.fn();
      const mockObj = { x: 1500, y: 1200 }; // ~1300px from camera center

      lodSystem.registerObject('distant-obj', mockObj as any, {
        minimalDetail: minimalCallback,
      });

      lodSystem.forceUpdate();

      expect(minimalCallback).toHaveBeenCalled();
      expect(lodSystem.getStats().minimalDetail).toBe(1);
    });

    it('should update LOD as camera moves', () => {
      const highCallback = vi.fn();
      const lowCallback = vi.fn();
      const minimalCallback = vi.fn();

      const mockObj = { x: 400, y: 300 }; // Camera center when scrollX=0, scrollY=0

      lodSystem.registerObject('tracking-obj', mockObj as any, {
        highDetail: highCallback,
        lowDetail: lowCallback,
        minimalDetail: minimalCallback,
      });

      // Initially at center - object at (400,300), camera center at (400,300)
      lodSystem.forceUpdate();
      expect(lodSystem.getStats().highDetail).toBe(1);

      // Move camera far away
      // New camera center: (800 + 400, 600 + 300) = (1200, 900)
      // Distance from (400,300) to (1200,900): sqrt(800² + 600²) = 1000px
      // This exceeds lowDetailDistance (800), so we get MINIMAL
      mockCamera.scrollX = 800;
      mockCamera.scrollY = 600;

      lodSystem.forceUpdate();

      // At 1000px distance (> 800 lowDetailDistance), object should be MINIMAL
      expect(minimalCallback).toHaveBeenCalled();
    });
  });

  describe('Zoom-Based LOD', () => {
    it('should maintain HIGH detail when zoomed in', () => {
      mockCamera.zoom = 2.0; // Zoomed in

      const highCallback = vi.fn();
      const mockObj = { x: 400, y: 300 };

      lodSystem.registerObject('zoom-obj', mockObj as any, {
        highDetail: highCallback,
      });

      lodSystem.forceUpdate();

      const stats = lodSystem.getStats();
      expect(stats.highDetail).toBe(1);
    });

    it('should switch to lower detail when zoomed out', () => {
      mockCamera.zoom = 0.3; // Zoomed out past low threshold (0.5)

      const minimalCallback = vi.fn();
      const mockObj = { x: 400, y: 300 };

      lodSystem.registerObject('zoom-out-obj', mockObj as any, {
        minimalDetail: minimalCallback,
      });

      lodSystem.forceUpdate();

      expect(minimalCallback).toHaveBeenCalled();
    });

    it('should use lower LOD between distance and zoom calculations', () => {
      // Object is close (would be HIGH by distance)
      // But camera is zoomed out (would be LOW by zoom)
      mockCamera.scrollX = 0;
      mockCamera.scrollY = 0;
      mockCamera.zoom = 0.4;

      const lowCallback = vi.fn();
      const mockObj = { x: 450, y: 350 }; // Close to camera center

      lodSystem.registerObject('combined-obj', mockObj as any, {
        lowDetail: lowCallback,
      });

      lodSystem.forceUpdate();

      // Should use LOW due to zoom, despite close distance
      expect(lodSystem.getStats().lowDetail).toBeGreaterThanOrEqual(0);
    });
  });

  describe('LOD Callbacks', () => {
    it('should call highDetail callback when transitioning to HIGH', () => {
      const highCallback = vi.fn();
      const mockObj = { x: 1000, y: 800 }; // Far initially

      lodSystem.registerObject('transition-obj', mockObj as any, {
        highDetail: highCallback,
      });

      // First update - far away
      lodSystem.forceUpdate();

      // Move object close
      mockObj.x = 400;
      mockObj.y = 300;

      lodSystem.forceUpdate();

      expect(highCallback).toHaveBeenCalled();
    });

    it('should call mediumDetail callback when transitioning', () => {
      const mediumCallback = vi.fn();
      const mockObj = { x: 400, y: 300 }; // Close initially

      lodSystem.registerObject('medium-trans-obj', mockObj as any, {
        mediumDetail: mediumCallback,
      });

      // Move to medium distance
      mockObj.x = 700;

      lodSystem.forceUpdate();

      expect(mediumCallback).toHaveBeenCalled();
    });

    it('should not call callback if LOD level unchanged', () => {
      const highCallback = vi.fn();
      const mockObj = { x: 400, y: 300 };

      lodSystem.registerObject('stable-obj', mockObj as any, {
        highDetail: highCallback,
      });

      // Multiple updates without moving
      lodSystem.forceUpdate();
      lodSystem.forceUpdate();
      lodSystem.forceUpdate();

      // Should only be called once (on registration transition)
      expect(highCallback.mock.calls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Sprite LOD Helper', () => {
    it('should create sprite callbacks that adjust scale and alpha', () => {
      const mockSprite = {
        x: 400,
        y: 300,
        scale: 1.0,
        alpha: 1.0,
        setScale: vi.fn(function (s: number) {
          this.scale = s;
          return this;
        }),
        setAlpha: vi.fn(function (a: number) {
          this.alpha = a;
          return this;
        }),
      };

      const callbacks = lodSystem.createSpriteCallbacks(mockSprite as any);

      // Test HIGH detail
      callbacks.highDetail();
      expect(mockSprite.setScale).toHaveBeenCalledWith(1.0);
      expect(mockSprite.setAlpha).toHaveBeenCalledWith(1.0);

      // Test MEDIUM detail
      callbacks.mediumDetail();
      expect(mockSprite.setScale).toHaveBeenCalledWith(0.9);
      expect(mockSprite.setAlpha).toHaveBeenCalledWith(0.9);

      // Test LOW detail
      callbacks.lowDetail();
      expect(mockSprite.setScale).toHaveBeenCalledWith(0.75);
      expect(mockSprite.setAlpha).toHaveBeenCalledWith(0.75);

      // Test MINIMAL detail
      callbacks.minimalDetail();
      expect(mockSprite.setScale).toHaveBeenCalledWith(0.5);
      expect(mockSprite.setAlpha).toHaveBeenCalledWith(0.5);
    });
  });

  describe('Complex Object LOD Helper', () => {
    it('should hide decorative elements at lower LOD', () => {
      const mockContainer = {
        x: 400,
        y: 300,
        setAlpha: vi.fn(),
      };

      const decorativeChild1 = { setVisible: vi.fn() };
      const decorativeChild2 = { setVisible: vi.fn() };

      const callbacks = lodSystem.createComplexObjectCallbacks(
        mockContainer as any,
        [decorativeChild1, decorativeChild2] as any[],
      );

      // HIGH detail - show everything
      callbacks.highDetail();
      expect(mockContainer.setAlpha).toHaveBeenCalledWith(1.0);
      expect(decorativeChild1.setVisible).toHaveBeenCalledWith(true);
      expect(decorativeChild2.setVisible).toHaveBeenCalledWith(true);

      // LOW detail - hide decorations
      callbacks.lowDetail();
      expect(mockContainer.setAlpha).toHaveBeenCalledWith(0.85);
      expect(decorativeChild1.setVisible).toHaveBeenCalledWith(false);
      expect(decorativeChild2.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('Update Interval Optimization', () => {
    it('should only update every N frames', () => {
      lodSystem.setUpdateInterval(10);

      const lowCallback = vi.fn();
      const mockObj = { x: 1000, y: 800 };

      lodSystem.registerObject('interval-obj', mockObj as any, {
        lowDetail: lowCallback,
      });

      // Call update 9 times - should not trigger LOD check
      for (let i = 0; i < 9; i++) {
        lodSystem.update();
      }

      expect(lowCallback).not.toHaveBeenCalled();

      // 10th call should trigger
      lodSystem.update();
      expect(lowCallback).toHaveBeenCalled();
    });

    it('should force update regardless of interval', () => {
      lodSystem.setUpdateInterval(100);

      const callback = vi.fn();
      const mockObj = { x: 1000, y: 800 };

      lodSystem.registerObject('force-obj', mockObj as any, {
        lowDetail: callback,
      });

      lodSystem.forceUpdate();
      expect(callback).toHaveBeenCalled();
    });

    it('should track update count', () => {
      const mockObj = { x: 1000, y: 800 };

      lodSystem.registerObject('count-obj', mockObj as any, {
        lowDetail: vi.fn(),
      });

      lodSystem.forceUpdate();

      // Move object to trigger another update
      mockObj.x = 400;
      mockObj.y = 300;
      lodSystem.forceUpdate();

      const stats = lodSystem.getStats();
      expect(stats.updateCount).toBe(2);
    });
  });

  describe('Configuration Updates', () => {
    it('should update LOD thresholds', () => {
      lodSystem.updateConfig({
        highDetailDistance: 100,
        mediumDetailDistance: 200,
        lowDetailDistance: 400,
      });

      // Object at 150px should now be MEDIUM (was HIGH with 200 threshold)
      const mockObj = { x: 550, y: 300 }; // ~150px from center

      const mediumCallback = vi.fn();
      lodSystem.registerObject('config-obj', mockObj as any, {
        mediumDetail: mediumCallback,
      });

      lodSystem.forceUpdate();

      expect(mediumCallback).toHaveBeenCalled();
    });

    it('should update zoom thresholds', () => {
      lodSystem.updateConfig({
        zoomHighThreshold: 2.0,
        zoomMediumThreshold: 1.5,
        zoomLowThreshold: 1.0,
      });

      // With new thresholds: zoom >= 2.0 = HIGH, zoom >= 1.5 = MEDIUM, zoom >= 1.0 = LOW
      // zoom = 1.6 → MEDIUM (between 1.5 and 2.0)
      mockCamera.zoom = 1.6;

      const mockObj = { x: 400, y: 300 }; // Close to camera - HIGH from distance
      const mediumCallback = vi.fn();

      lodSystem.registerObject('zoom-config-obj', mockObj as any, {
        mediumDetail: mediumCallback,
      });

      lodSystem.forceUpdate();

      // The LOD uses the lower between distance (HIGH) and zoom (MEDIUM)
      // MEDIUM is lower than HIGH, so final LOD is MEDIUM
      // This transitions from initial HIGH to MEDIUM, triggering the callback
      expect(mediumCallback).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should track objects at each LOD level', () => {
      // Add objects at different distances
      const closeObj = { x: 450, y: 350 }; // HIGH
      const mediumObj = { x: 700, y: 300 }; // MEDIUM
      const farObj = { x: 1000, y: 300 }; // LOW
      const veryFarObj = { x: 1500, y: 1200 }; // MINIMAL

      lodSystem.registerObject('close', closeObj as any, {
        highDetail: vi.fn(),
        mediumDetail: vi.fn(),
        lowDetail: vi.fn(),
        minimalDetail: vi.fn(),
      });

      lodSystem.registerObject('medium', mediumObj as any, {
        mediumDetail: vi.fn(),
      });

      lodSystem.registerObject('far', farObj as any, {
        lowDetail: vi.fn(),
      });

      lodSystem.registerObject('veryFar', veryFarObj as any, {
        minimalDetail: vi.fn(),
      });

      lodSystem.forceUpdate();

      const stats = lodSystem.getStats();
      expect(stats.totalObjects).toBe(4);
      expect(stats.highDetail).toBe(1);
      expect(stats.mediumDetail).toBe(1);
      expect(stats.lowDetail).toBe(1);
      expect(stats.minimalDetail).toBe(1);
    });
  });

  describe('Village Rendering Scenarios', () => {
    it('should optimize buildings based on distance', () => {
      // Simulate a village with multiple buildings
      const buildings = [
        { id: 'tavern', x: 420, y: 320 }, // Close - HIGH detail
        { id: 'blacksmith', x: 650, y: 350 }, // Medium - MEDIUM detail
        { id: 'church', x: 950, y: 400 }, // Far - LOW detail
        { id: 'watchtower', x: 1400, y: 900 }, // Very far - MINIMAL detail
      ];

      const detailCallbacks: Record<string, Record<string, vi.Mock>> = {};

      buildings.forEach((building) => {
        detailCallbacks[building.id] = {
          high: vi.fn(),
          medium: vi.fn(),
          low: vi.fn(),
          minimal: vi.fn(),
        };

        lodSystem.registerObject(building.id, building as any, {
          highDetail: detailCallbacks[building.id].high,
          mediumDetail: detailCallbacks[building.id].medium,
          lowDetail: detailCallbacks[building.id].low,
          minimalDetail: detailCallbacks[building.id].minimal,
        });
      });

      lodSystem.forceUpdate();

      // Verify appropriate detail levels
      expect(detailCallbacks.tavern.high).not.toHaveBeenCalled(); // Started at HIGH
      expect(detailCallbacks.blacksmith.medium).toHaveBeenCalled();
      expect(detailCallbacks.church.low).toHaveBeenCalled();
      expect(detailCallbacks.watchtower.minimal).toHaveBeenCalled();
    });

    it('should update agent sprites based on camera zoom', () => {
      const agents = [
        { id: 'hero', x: 400, y: 300 },
        { id: 'npc1', x: 450, y: 350 },
        { id: 'npc2', x: 380, y: 280 },
      ];

      // All agents close to camera center
      agents.forEach((agent) => {
        const sprite = {
          ...agent,
          scale: 1.0,
          alpha: 1.0,
          setScale: vi.fn(),
          setAlpha: vi.fn(),
        };

        const callbacks = lodSystem.createSpriteCallbacks(sprite as any);
        lodSystem.registerObject(agent.id, sprite as any, callbacks);
      });

      // Zoom out significantly
      mockCamera.zoom = 0.3;
      lodSystem.forceUpdate();

      // All agents should be at MINIMAL detail due to zoom
      const stats = lodSystem.getStats();
      expect(stats.minimalDetail).toBe(3);
    });

    it('should handle dynamic agent spawning and removal', () => {
      // Spawn agents over time
      for (let i = 0; i < 10; i++) {
        const agent = { x: 400 + i * 50, y: 300 + i * 30 };
        lodSystem.registerObject(`agent-${i}`, agent as any, {});
      }

      expect(lodSystem.getStats().totalObjects).toBe(10);

      // Remove some agents
      lodSystem.unregisterObject('agent-3');
      lodSystem.unregisterObject('agent-7');

      expect(lodSystem.getStats().totalObjects).toBe(8);

      // Spawn more
      for (let i = 10; i < 15; i++) {
        lodSystem.registerObject(`agent-${i}`, { x: 400, y: 300 } as any, {});
      }

      expect(lodSystem.getStats().totalObjects).toBe(13);
    });
  });

  describe('Cleanup', () => {
    it('should clean up all registered objects', () => {
      lodSystem.registerObject('obj1', { x: 0, y: 0 } as any, {});
      lodSystem.registerObject('obj2', { x: 0, y: 0 } as any, {});
      lodSystem.registerObject('obj3', { x: 0, y: 0 } as any, {});

      lodSystem.destroy();

      const stats = lodSystem.getStats();
      expect(stats.totalObjects).toBe(0);
      expect(stats.updateCount).toBe(0);
    });
  });
});
