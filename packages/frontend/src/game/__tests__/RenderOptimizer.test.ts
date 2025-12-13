/**
 * RenderOptimizer Performance Testing Suite
 *
 * Simulates performance optimization scenarios for a playable village:
 * - Frustum culling for off-screen objects
 * - Object pooling for sprites
 * - Performance metrics tracking
 * - Auto-quality adjustment
 * - Texture atlas management
 * - Memory optimization
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Phaser from 'phaser';
import { RenderOptimizer, PoolConfig, PerformanceMetrics, QualitySettings } from '../rendering/RenderOptimizer';

describe('RenderOptimizer - Performance Tests', () => {
  let scene: Phaser.Scene;
  let renderOptimizer: RenderOptimizer;
  let mockCamera: any;
  let mockGame: any;

  beforeEach(() => {
    // Create mock camera
    mockCamera = {
      worldView: { x: 0, y: 0, width: 800, height: 600 },
      zoom: 1.0,
      scrollX: 0,
      scrollY: 0,
    };

    // Create mock game loop for FPS tracking
    mockGame = {
      loop: {
        actualFps: 60,
      },
    };

    // Create mock scene
    scene = {
      cameras: { main: mockCamera },
      game: mockGame,
      children: { length: 100 },
      textures: {
        list: {
          '__DEFAULT': {},
          '__MISSING': {},
          'agent-sprite': {},
          'tile-atlas': {},
        },
      },
    } as unknown as Phaser.Scene;

    renderOptimizer = new RenderOptimizer(scene);
  });

  afterEach(() => {
    renderOptimizer.destroy();
    vi.clearAllMocks();
  });

  describe('Frustum Culling', () => {
    beforeEach(() => {
      renderOptimizer.enableCulling(mockCamera, 1);
    });

    it('should enable culling with padding', () => {
      expect(renderOptimizer.getQualitySettings().cullPadding).toBe(1);
    });

    it('should disable culling', () => {
      renderOptimizer.disableCulling();

      // After disable, shouldCull should always return false
      expect(renderOptimizer.shouldCull(2000, 2000)).toBe(false);
    });

    it('should not cull objects inside viewport', () => {
      renderOptimizer.updateCulling();

      // Object at center of viewport
      expect(renderOptimizer.shouldCull(400, 300)).toBe(false);

      // Object at corner of viewport
      expect(renderOptimizer.shouldCull(0, 0)).toBe(false);
    });

    it('should cull objects outside viewport', () => {
      renderOptimizer.updateCulling();

      // Object far outside viewport
      expect(renderOptimizer.shouldCull(2000, 2000)).toBe(true);
    });

    it('should account for object size in culling', () => {
      renderOptimizer.updateCulling();

      // Object just outside viewport but with size overlapping
      const objectWidth = 100;
      const objectHeight = 100;

      // Object starting at edge should not be culled if part overlaps
      expect(renderOptimizer.shouldCull(-50, -50, objectWidth, objectHeight)).toBe(false);
    });

    it('should cull array of objects', () => {
      renderOptimizer.updateCulling();

      const objects = [
        { x: 400, y: 300, visible: true, setVisible: vi.fn() }, // Inside
        { x: 100, y: 100, visible: true, setVisible: vi.fn() }, // Inside
        { x: 2000, y: 2000, visible: true, setVisible: vi.fn() }, // Outside
        { x: -500, y: -500, visible: true, setVisible: vi.fn() }, // Outside
      ];

      renderOptimizer.cullObjects(objects as any);

      // Objects inside should remain visible
      expect(objects[0].setVisible).not.toHaveBeenCalled();
      expect(objects[1].setVisible).not.toHaveBeenCalled();

      // Objects outside should be hidden
      expect(objects[2].setVisible).toHaveBeenCalledWith(false);
      expect(objects[3].setVisible).toHaveBeenCalledWith(false);
    });

    it('should restore visibility when objects enter viewport', () => {
      renderOptimizer.updateCulling();

      const obj = {
        x: 2000,
        y: 2000,
        visible: true, // Start visible so it can be culled first
        setVisible: vi.fn(function (this: any, v: boolean) {
          this.visible = v;
        }),
      };

      // First cull - obj is outside and visible, so it gets culled (hidden)
      renderOptimizer.cullObjects([obj] as any);
      expect(obj.setVisible).toHaveBeenCalledWith(false);
      expect(obj.visible).toBe(false);

      // Move obj inside viewport
      obj.x = 400;
      obj.y = 300;

      // Update culling
      renderOptimizer.updateCulling();
      renderOptimizer.cullObjects([obj] as any);

      // Should have been made visible since it was previously culled by the system
      expect(obj.setVisible).toHaveBeenCalledWith(true);
    });

    it('should track culled objects count', () => {
      renderOptimizer.updateCulling();

      const objects = [
        { x: 400, y: 300, visible: true, setVisible: vi.fn() },
        { x: 2000, y: 2000, visible: true, setVisible: vi.fn() },
        { x: 3000, y: 3000, visible: true, setVisible: vi.fn() },
      ];

      renderOptimizer.cullObjects(objects as any);

      const metrics = renderOptimizer.getPerformanceMetrics();
      expect(metrics.culledObjects).toBe(2);
    });
  });

  describe('Object Pooling', () => {
    let createFunc: () => any;
    let resetFunc: (obj: any) => void;

    beforeEach(() => {
      createFunc = vi.fn(() => ({
        x: 0,
        y: 0,
        active: false,
        setActive: vi.fn(function (a: boolean) {
          this.active = a;
          return this;
        }),
        setVisible: vi.fn(),
        destroy: vi.fn(),
      }));

      resetFunc = vi.fn((obj: any) => {
        obj.x = 0;
        obj.y = 0;
      });
    });

    it('should create pool with initial objects', () => {
      renderOptimizer.createPool('bullets', {
        initialSize: 10,
        maxSize: 50,
        createFunc,
        resetFunc,
      });

      expect(createFunc).toHaveBeenCalledTimes(10);

      const stats = renderOptimizer.getPoolStats();
      expect(stats.bullets.total).toBe(10);
      expect(stats.bullets.inactive).toBe(10);
    });

    it('should not create duplicate pools', () => {
      renderOptimizer.createPool('bullets', {
        initialSize: 10,
        maxSize: 50,
        createFunc,
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderOptimizer.createPool('bullets', {
        initialSize: 5,
        maxSize: 20,
        createFunc,
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should get object from pool', () => {
      renderOptimizer.createPool('agents', {
        initialSize: 5,
        maxSize: 20,
        createFunc,
        resetFunc,
      });

      const obj = renderOptimizer.getFromPool('agents');

      expect(obj).toBeDefined();
      expect(obj?.active).toBe(true);
      expect(resetFunc).toHaveBeenCalledWith(obj);

      const stats = renderOptimizer.getPoolStats();
      expect(stats.agents.active).toBe(1);
      expect(stats.agents.inactive).toBe(4);
    });

    it('should create new object when pool is empty', () => {
      renderOptimizer.createPool('effects', {
        initialSize: 2,
        maxSize: 10,
        createFunc,
      });

      // Get all initial objects
      renderOptimizer.getFromPool('effects');
      renderOptimizer.getFromPool('effects');

      // Getting one more should create new
      const newObj = renderOptimizer.getFromPool('effects');

      expect(newObj).toBeDefined();
      expect(createFunc).toHaveBeenCalledTimes(3); // 2 initial + 1 new
    });

    it('should return null when pool is exhausted', () => {
      renderOptimizer.createPool('limited', {
        initialSize: 2,
        maxSize: 2,
        createFunc,
      });

      renderOptimizer.getFromPool('limited');
      renderOptimizer.getFromPool('limited');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const exhausted = renderOptimizer.getFromPool('limited');

      expect(exhausted).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return object to pool', () => {
      renderOptimizer.createPool('reusable', {
        initialSize: 5,
        maxSize: 10,
        createFunc,
      });

      const obj = renderOptimizer.getFromPool('reusable');
      renderOptimizer.returnToPool(obj!);

      expect(obj!.active).toBe(false);

      const stats = renderOptimizer.getPoolStats();
      expect(stats.reusable.inactive).toBe(5);
    });

    it('should track pooled objects in metrics', () => {
      renderOptimizer.createPool('tracked', {
        initialSize: 5,
        maxSize: 10,
        createFunc,
      });

      renderOptimizer.getFromPool('tracked');
      renderOptimizer.getFromPool('tracked');

      const metrics = renderOptimizer.getPerformanceMetrics();
      expect(metrics.pooledObjects).toBe(2);
    });

    it('should clear all pools', () => {
      renderOptimizer.createPool('poolA', {
        initialSize: 5,
        maxSize: 10,
        createFunc,
      });

      renderOptimizer.createPool('poolB', {
        initialSize: 3,
        maxSize: 10,
        createFunc,
      });

      renderOptimizer.clearPools();

      const stats = renderOptimizer.getPoolStats();
      expect(Object.keys(stats).length).toBe(0);
    });

    it('should warn when returning non-pooled object', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const nonPooledObj = { x: 0, y: 0, active: true };
      renderOptimizer.returnToPool(nonPooledObj as any);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Performance Metrics', () => {
    it('should track FPS', () => {
      mockGame.loop.actualFps = 58;
      renderOptimizer.updateMetrics();

      const metrics = renderOptimizer.getPerformanceMetrics();
      expect(metrics.fps).toBe(58);
    });

    it('should track FPS history', () => {
      // Simulate multiple frames
      for (let i = 0; i < 30; i++) {
        mockGame.loop.actualFps = 55 + (i % 10);
        renderOptimizer.updateMetrics();
      }

      const avgFps = renderOptimizer.getAverageFPS();
      expect(avgFps).toBeGreaterThan(50);
      expect(avgFps).toBeLessThan(70);
    });

    it('should track object count', () => {
      (scene.children as any).length = 250;
      renderOptimizer.updateMetrics();

      const metrics = renderOptimizer.getPerformanceMetrics();
      expect(metrics.objects).toBe(250);
    });

    it('should estimate draw calls', () => {
      (scene.children as any).length = 160;
      renderOptimizer.updateMetrics();

      const metrics = renderOptimizer.getPerformanceMetrics();
      // Estimated as objects / 16 (batch size)
      expect(metrics.drawCalls).toBe(10);
    });

    it('should reset metrics', () => {
      mockGame.loop.actualFps = 30;
      renderOptimizer.updateMetrics();

      renderOptimizer.resetMetrics();

      const metrics = renderOptimizer.getPerformanceMetrics();
      expect(metrics.fps).toBe(60); // Default value
      expect(renderOptimizer.getAverageFPS()).toBe(60);
    });
  });

  describe('Auto-Quality Adjustment', () => {
    it('should disable particles when FPS drops below 30', () => {
      renderOptimizer.setAutoQuality(true);

      // Simulate low FPS for 60 frames
      for (let i = 0; i < 60; i++) {
        mockGame.loop.actualFps = 28;
        renderOptimizer.updateMetrics();
      }

      const settings = renderOptimizer.getQualitySettings();
      expect(settings.particlesEnabled).toBe(false);
    });

    it('should disable shadows when FPS drops below 25', () => {
      renderOptimizer.setAutoQuality(true);

      for (let i = 0; i < 60; i++) {
        mockGame.loop.actualFps = 23;
        renderOptimizer.updateMetrics();
      }

      const settings = renderOptimizer.getQualitySettings();
      expect(settings.shadowsEnabled).toBe(false);
    });

    it('should disable post-processing when FPS drops below 20', () => {
      renderOptimizer.setAutoQuality(true);

      for (let i = 0; i < 60; i++) {
        mockGame.loop.actualFps = 18;
        renderOptimizer.updateMetrics();
      }

      const settings = renderOptimizer.getQualitySettings();
      expect(settings.postProcessingEnabled).toBe(false);
    });

    it('should re-enable particles when FPS recovers above 55', () => {
      renderOptimizer.setAutoQuality(true);

      // First, drop FPS to disable particles
      for (let i = 0; i < 60; i++) {
        mockGame.loop.actualFps = 25;
        renderOptimizer.updateMetrics();
      }

      // Then recover
      for (let i = 0; i < 60; i++) {
        mockGame.loop.actualFps = 58;
        renderOptimizer.updateMetrics();
      }

      const settings = renderOptimizer.getQualitySettings();
      expect(settings.particlesEnabled).toBe(true);
    });

    it('should allow manual quality settings', () => {
      renderOptimizer.setQualitySettings({
        particlesEnabled: false,
        maxVisibleObjects: 500,
      });

      const settings = renderOptimizer.getQualitySettings();
      expect(settings.particlesEnabled).toBe(false);
      expect(settings.maxVisibleObjects).toBe(500);
    });

    it('should disable auto-quality when requested', () => {
      renderOptimizer.setAutoQuality(false);

      // Simulate bad FPS
      for (let i = 0; i < 60; i++) {
        mockGame.loop.actualFps = 15;
        renderOptimizer.updateMetrics();
      }

      // Quality should not change
      const settings = renderOptimizer.getQualitySettings();
      expect(settings.particlesEnabled).toBe(true);
      expect(settings.shadowsEnabled).toBe(true);
    });
  });

  describe('Texture Atlas Management', () => {
    it('should register texture atlas', () => {
      renderOptimizer.registerTextureAtlas('characters', [
        'hero-idle',
        'hero-walk',
        'hero-run',
        'npc-idle',
      ]);

      const textures = renderOptimizer.getTextureAtlas('characters');
      expect(textures).toContain('hero-idle');
      expect(textures?.length).toBe(4);
    });

    it('should return undefined for non-existent atlas', () => {
      const textures = renderOptimizer.getTextureAtlas('nonexistent');
      expect(textures).toBeUndefined();
    });

    it('should support multiple atlases', () => {
      renderOptimizer.registerTextureAtlas('characters', ['hero', 'npc']);
      renderOptimizer.registerTextureAtlas('tiles', ['grass', 'dirt', 'water']);
      renderOptimizer.registerTextureAtlas('effects', ['explosion', 'sparkle']);

      expect(renderOptimizer.getTextureAtlas('characters')?.length).toBe(2);
      expect(renderOptimizer.getTextureAtlas('tiles')?.length).toBe(3);
      expect(renderOptimizer.getTextureAtlas('effects')?.length).toBe(2);
    });
  });

  describe('Update Loop Integration', () => {
    it('should update culling and metrics in update()', () => {
      renderOptimizer.enableCulling(mockCamera, 1);

      // Mock low FPS
      mockGame.loop.actualFps = 45;

      renderOptimizer.update();

      const metrics = renderOptimizer.getPerformanceMetrics();
      expect(metrics.fps).toBe(45);
    });
  });

  describe('Performance Scenarios', () => {
    it('should handle village with many agents', () => {
      // Create agent pool
      const createAgent = vi.fn(() => ({
        x: 0,
        y: 0,
        active: false,
        visible: true, // Start visible so they can be culled
        setActive: vi.fn(function (this: any, a: boolean) { this.active = a; }),
        setVisible: vi.fn(function (this: any, v: boolean) { this.visible = v; }),
        destroy: vi.fn(),
      }));

      renderOptimizer.createPool('agents', {
        initialSize: 50,
        maxSize: 200,
        createFunc: createAgent,
      });

      // Spawn many agents spread across the world (many outside viewport)
      const activeAgents: any[] = [];
      for (let i = 0; i < 100; i++) {
        const agent = renderOptimizer.getFromPool('agents');
        if (agent) {
          // Place some inside viewport (0-800, 0-600) and many outside
          // Using deterministic positions so we know some will be outside
          agent.x = (i % 5) * 400; // 0, 400, 800, 1200, 1600
          agent.y = Math.floor(i / 5) * 100; // 0, 100, 200, ... 1900
          agent.visible = true; // Make sure it's visible to be culled
          activeAgents.push(agent);
        }
      }

      const stats = renderOptimizer.getPoolStats();
      expect(stats.agents.active).toBe(100);

      // Enable culling and check
      renderOptimizer.enableCulling(mockCamera, 1);
      renderOptimizer.updateCulling();
      renderOptimizer.cullObjects(activeAgents);

      // Many should be culled (outside 800x600 viewport)
      // Agents at x=1200, x=1600, or y>=700 should be culled
      const metrics = renderOptimizer.getPerformanceMetrics();
      expect(metrics.culledObjects).toBeGreaterThan(0);
    });

    it('should handle tile chunk loading simulation', () => {
      // Create tile pool
      const createTile = vi.fn(() => ({
        x: 0,
        y: 0,
        active: false,
        setActive: vi.fn(function (a: boolean) { this.active = a; }),
        setVisible: vi.fn(),
        destroy: vi.fn(),
      }));

      renderOptimizer.createPool('tiles', {
        initialSize: 100,
        maxSize: 500,
        createFunc: createTile,
      });

      // Load visible chunk (25x20 tiles at 32px)
      const visibleTiles: any[] = [];
      for (let row = 0; row < 20; row++) {
        for (let col = 0; col < 25; col++) {
          const tile = renderOptimizer.getFromPool('tiles');
          if (tile) {
            tile.x = col * 32;
            tile.y = row * 32;
            visibleTiles.push(tile);
          }
        }
      }

      expect(visibleTiles.length).toBe(500);

      // When player moves, return old tiles and get new ones
      const tilesToReturn = visibleTiles.slice(0, 25); // First row
      tilesToReturn.forEach((tile) => renderOptimizer.returnToPool(tile));

      const stats = renderOptimizer.getPoolStats();
      expect(stats.tiles.inactive).toBe(25);
    });

    it('should maintain 60fps with optimizations', () => {
      // Simulate 60fps with optimizations
      mockGame.loop.actualFps = 60;
      (scene.children as any).length = 500;

      renderOptimizer.enableCulling(mockCamera, 1);
      renderOptimizer.setAutoQuality(true);

      // Run for several seconds worth of frames
      for (let i = 0; i < 300; i++) {
        mockGame.loop.actualFps = 58 + Math.random() * 4;
        renderOptimizer.update();
      }

      const settings = renderOptimizer.getQualitySettings();
      // All features should remain enabled at good FPS
      expect(settings.particlesEnabled).toBe(true);
      expect(settings.shadowsEnabled).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should clean up all resources on destroy', () => {
      // Create pools
      renderOptimizer.createPool('test', {
        initialSize: 10,
        maxSize: 20,
        createFunc: () => ({ active: false, setActive: vi.fn(), setVisible: vi.fn(), destroy: vi.fn() }),
      });

      // Register atlas
      renderOptimizer.registerTextureAtlas('test-atlas', ['tex1', 'tex2']);

      // Destroy
      renderOptimizer.destroy();

      // Verify cleanup
      const stats = renderOptimizer.getPoolStats();
      expect(Object.keys(stats).length).toBe(0);

      expect(renderOptimizer.getTextureAtlas('test-atlas')).toBeUndefined();
    });
  });
});
