/**
 * LayerManager Visual Testing Suite
 *
 * Simulates multi-layer rendering for a playable village environment:
 * - Layer creation and z-ordering
 * - Object management across layers
 * - Visibility and alpha controls
 * - Parallax scrolling support
 * - Viewport culling optimization
 * - Standard layer initialization
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Phaser from 'phaser';
import { LayerManager, RenderLayerConfig } from '../rendering/LayerManager';

describe('LayerManager - Visual Rendering Tests', () => {
  let scene: Phaser.Scene;
  let layerManager: LayerManager;
  let mockContainers: Map<string, any>;
  let containerCounter: number;

  beforeEach(() => {
    containerCounter = 0;
    mockContainers = new Map();

    // Create mock scene with container factory
    scene = {
      add: {
        container: vi.fn((x: number, y: number) => {
          const id = `container-${containerCounter++}`;
          const container = {
            id,
            x,
            y,
            depth: 0,
            visible: true,
            alpha: 1.0,
            name: '',
            scrollFactorX: 1,
            scrollFactorY: 1,
            children: [] as any[],
            setName: vi.fn(function (name: string) {
              this.name = name;
              return this;
            }),
            setDepth: vi.fn(function (depth: number) {
              this.depth = depth;
              return this;
            }),
            setVisible: vi.fn(function (visible: boolean) {
              this.visible = visible;
              return this;
            }),
            setAlpha: vi.fn(function (alpha: number) {
              this.alpha = alpha;
              return this;
            }),
            setScrollFactor: vi.fn(function (x: number, y: number) {
              this.scrollFactorX = x;
              this.scrollFactorY = y;
              return this;
            }),
            add: vi.fn(function (obj: any) {
              this.children.push(obj);
              return this;
            }),
            remove: vi.fn(function (obj: any) {
              const idx = this.children.indexOf(obj);
              if (idx > -1) this.children.splice(idx, 1);
              return this;
            }),
            removeAll: vi.fn(function (destroyChildren: boolean) {
              if (destroyChildren) {
                this.children.forEach((c: any) => c.destroy?.());
              }
              this.children = [];
              return this;
            }),
            destroy: vi.fn(function () {
              this.children = [];
            }),
            iterate: vi.fn(function (callback: (child: any) => void) {
              this.children.forEach(callback);
            }),
          };
          mockContainers.set(id, container);
          return container;
        }),
      },
    } as unknown as Phaser.Scene;

    layerManager = new LayerManager(scene);
  });

  afterEach(() => {
    layerManager.destroy();
    vi.clearAllMocks();
  });

  describe('Layer Creation', () => {
    it('should create a layer with container at position (0,0)', () => {
      const layer = layerManager.addLayer('ground', 0);

      expect(scene.add.container).toHaveBeenCalledWith(0, 0);
      expect(layer).toBeDefined();
    });

    it('should set correct depth (z-index) on layer', () => {
      const layer = layerManager.addLayer('walls', 10);

      expect(layer.setDepth).toHaveBeenCalledWith(10);
      expect(layerManager.getLayerConfig('walls')?.zIndex).toBe(10);
    });

    it('should set layer name on container', () => {
      const layer = layerManager.addLayer('entities', 30);

      expect(layer.setName).toHaveBeenCalledWith('entities');
    });

    it('should create layer with custom visibility', () => {
      const layer = layerManager.addLayer('debug', 100, { visible: false });

      expect(layer.setVisible).toHaveBeenCalledWith(false);
    });

    it('should create layer with custom alpha', () => {
      const layer = layerManager.addLayer('fog', 45, { alpha: 0.5 });

      expect(layer.setAlpha).toHaveBeenCalledWith(0.5);
    });

    it('should create layer with scroll factor for parallax', () => {
      const layer = layerManager.addLayer('background', -10, {
        scrollFactor: { x: 0.5, y: 0.5 },
      });

      expect(layer.setScrollFactor).toHaveBeenCalledWith(0.5, 0.5);
    });

    it('should not create duplicate layers', () => {
      layerManager.addLayer('ground', 0);
      const duplicate = layerManager.addLayer('ground', 5);

      // Should return existing layer
      expect(layerManager.getLayerCount()).toBe(1);
      expect(scene.add.container).toHaveBeenCalledTimes(1);
    });

    it('should track layer count', () => {
      layerManager.addLayer('ground', 0);
      layerManager.addLayer('walls', 10);
      layerManager.addLayer('entities', 30);

      expect(layerManager.getLayerCount()).toBe(3);
    });
  });

  describe('Standard Layers', () => {
    it('should initialize all standard layers', () => {
      layerManager.initializeStandardLayers();

      expect(layerManager.hasLayer('ground')).toBe(true);
      expect(layerManager.hasLayer('floor')).toBe(true);
      expect(layerManager.hasLayer('walls')).toBe(true);
      expect(layerManager.hasLayer('decorations')).toBe(true);
      expect(layerManager.hasLayer('entities')).toBe(true);
      expect(layerManager.hasLayer('above-player')).toBe(true);
      expect(layerManager.hasLayer('ui')).toBe(true);
    });

    it('should set correct z-indices for standard layers', () => {
      layerManager.initializeStandardLayers();

      expect(layerManager.getLayerConfig('ground')?.zIndex).toBe(0);
      expect(layerManager.getLayerConfig('floor')?.zIndex).toBe(5);
      expect(layerManager.getLayerConfig('walls')?.zIndex).toBe(10);
      expect(layerManager.getLayerConfig('decorations')?.zIndex).toBe(20);
      expect(layerManager.getLayerConfig('entities')?.zIndex).toBe(30);
      expect(layerManager.getLayerConfig('above-player')?.zIndex).toBe(40);
      expect(layerManager.getLayerConfig('ui')?.zIndex).toBe(50);
    });

    it('should return render order sorted by z-index', () => {
      layerManager.initializeStandardLayers();

      const order = layerManager.getRenderOrder();

      expect(order[0]).toBe('ground');
      expect(order[order.length - 1]).toBe('ui');

      // Verify ascending z-index order
      for (let i = 1; i < order.length; i++) {
        const prevZ = layerManager.getLayerConfig(order[i - 1])?.zIndex ?? 0;
        const currZ = layerManager.getLayerConfig(order[i])?.zIndex ?? 0;
        expect(currZ).toBeGreaterThanOrEqual(prevZ);
      }
    });
  });

  describe('Layer Retrieval', () => {
    it('should retrieve layer by name', () => {
      const created = layerManager.addLayer('walls', 10);
      const retrieved = layerManager.getLayer('walls');

      expect(retrieved).toBe(created);
    });

    it('should return null for non-existent layer', () => {
      const layer = layerManager.getLayer('nonexistent');

      expect(layer).toBeNull();
    });

    it('should retrieve layer config', () => {
      layerManager.addLayer('walls', 10, { visible: true, alpha: 0.9 });
      const config = layerManager.getLayerConfig('walls');

      expect(config?.name).toBe('walls');
      expect(config?.zIndex).toBe(10);
      expect(config?.visible).toBe(true);
      expect(config?.alpha).toBe(0.9);
    });

    it('should return all layer names', () => {
      layerManager.addLayer('ground', 0);
      layerManager.addLayer('walls', 10);
      layerManager.addLayer('entities', 30);

      const names = layerManager.getLayerNames();

      expect(names).toContain('ground');
      expect(names).toContain('walls');
      expect(names).toContain('entities');
      expect(names.length).toBe(3);
    });

    it('should check if layer exists', () => {
      layerManager.addLayer('ground', 0);

      expect(layerManager.hasLayer('ground')).toBe(true);
      expect(layerManager.hasLayer('sky')).toBe(false);
    });
  });

  describe('Layer Properties', () => {
    it('should update layer visibility', () => {
      const layer = layerManager.addLayer('debug', 100);
      layerManager.setLayerVisible('debug', false);

      expect(layer.setVisible).toHaveBeenCalledWith(false);
      expect(layerManager.getLayerConfig('debug')?.visible).toBe(false);
    });

    it('should update layer alpha', () => {
      const layer = layerManager.addLayer('fog', 45);
      layerManager.setLayerAlpha('fog', 0.3);

      expect(layer.setAlpha).toHaveBeenCalledWith(0.3);
      expect(layerManager.getLayerConfig('fog')?.alpha).toBe(0.3);
    });

    it('should update layer scroll factor', () => {
      const layer = layerManager.addLayer('parallax', -5);
      layerManager.setLayerScrollFactor('parallax', 0.25, 0.25);

      expect(layer.setScrollFactor).toHaveBeenCalledWith(0.25, 0.25);
    });

    it('should update layer z-index and re-sort', () => {
      layerManager.addLayer('ground', 0);
      layerManager.addLayer('walls', 10);
      layerManager.addLayer('special', 5);

      // Change special layer to be above walls
      layerManager.setLayerZIndex('special', 15);

      const order = layerManager.getRenderOrder();
      expect(order.indexOf('special')).toBeGreaterThan(order.indexOf('walls'));
    });
  });

  describe('Object Management', () => {
    it('should add game object to layer', () => {
      const layer = layerManager.addLayer('entities', 30);
      const mockSprite = { x: 100, y: 100, destroy: vi.fn() };

      layerManager.addToLayer('entities', mockSprite as any);

      expect(layer.add).toHaveBeenCalledWith(mockSprite);
    });

    it('should remove game object from layer', () => {
      const layer = layerManager.addLayer('entities', 30);
      const mockSprite = { x: 100, y: 100, destroy: vi.fn() };

      layerManager.addToLayer('entities', mockSprite as any);
      layerManager.removeFromLayer('entities', mockSprite as any);

      expect(layer.remove).toHaveBeenCalledWith(mockSprite);
    });

    it('should clear all objects from layer', () => {
      const layer = layerManager.addLayer('entities', 30);
      layerManager.addToLayer('entities', { x: 0, y: 0 } as any);
      layerManager.addToLayer('entities', { x: 10, y: 10 } as any);

      layerManager.clearLayer('entities');

      expect(layer.removeAll).toHaveBeenCalledWith(true);
    });

    it('should warn when adding to non-existent layer', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      layerManager.addToLayer('nonexistent', {} as any);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Layer Removal', () => {
    it('should remove layer and destroy container', () => {
      const layer = layerManager.addLayer('temp', 50);
      layerManager.removeLayer('temp');

      expect(layer.destroy).toHaveBeenCalled();
      expect(layerManager.hasLayer('temp')).toBe(false);
    });

    it('should update render order after removal', () => {
      layerManager.addLayer('a', 0);
      layerManager.addLayer('b', 10);
      layerManager.addLayer('c', 20);

      layerManager.removeLayer('b');

      const order = layerManager.getRenderOrder();
      expect(order).not.toContain('b');
      expect(order.length).toBe(2);
    });
  });

  describe('Viewport Culling', () => {
    let mockCamera: any;

    beforeEach(() => {
      mockCamera = {
        worldView: { x: 0, y: 0, width: 800, height: 600 },
        zoom: 1.0,
      };
    });

    it('should enable culling', () => {
      layerManager.enableCulling(true);

      const stats = layerManager.getCullingStats();
      expect(stats.enabled).toBe(true);
    });

    it('should disable culling', () => {
      layerManager.enableCulling(false);

      const stats = layerManager.getCullingStats();
      expect(stats.enabled).toBe(false);
    });

    it('should set cull padding', () => {
      layerManager.setCullPadding(128);

      const stats = layerManager.getCullingStats();
      expect(stats.padding).toBe(128);
    });

    it('should check if position is in viewport', () => {
      layerManager.enableCulling(true);
      layerManager.updateCullingBounds(mockCamera);

      // Inside viewport (with default padding)
      expect(layerManager.isInViewport(400, 300)).toBe(true);

      // Outside viewport
      expect(layerManager.isInViewport(2000, 2000)).toBe(false);
    });

    it('should cull objects outside viewport', () => {
      layerManager.enableCulling(true);
      const layer = layerManager.addLayer('entities', 30);

      // Create visible object inside viewport
      const insideObj = {
        x: 400,
        y: 300,
        width: 32,
        height: 32,
        visible: true,
        setVisible: vi.fn(function (v: boolean) {
          this.visible = v;
        }),
        getData: () => false,
      };

      // Create visible object outside viewport
      const outsideObj = {
        x: 2000,
        y: 2000,
        width: 32,
        height: 32,
        visible: true,
        setVisible: vi.fn(function (v: boolean) {
          this.visible = v;
        }),
        getData: () => false,
      };

      layer.children = [insideObj, outsideObj];

      const culledCount = layerManager.cullLayer('entities', mockCamera);

      expect(outsideObj.setVisible).toHaveBeenCalledWith(false);
      expect(insideObj.setVisible).not.toHaveBeenCalled();
      expect(culledCount).toBe(1);
    });

    it('should restore visibility when objects re-enter viewport', () => {
      layerManager.enableCulling(true);
      const layer = layerManager.addLayer('entities', 30);

      // Object initially outside
      const obj = {
        x: 2000,
        y: 2000,
        width: 32,
        height: 32,
        visible: true,
        setVisible: vi.fn(function (v: boolean) {
          this.visible = v;
        }),
        getData: () => false,
      };

      layer.children = [obj];

      // First cull - should hide
      layerManager.cullLayer('entities', mockCamera);
      expect(obj.visible).toBe(false);

      // Move object into view
      obj.x = 400;
      obj.y = 300;

      // Second cull - should show
      layerManager.cullLayer('entities', mockCamera);
      expect(obj.setVisible).toHaveBeenCalledWith(true);
    });

    it('should not cull UI layer', () => {
      layerManager.enableCulling(true);
      layerManager.initializeStandardLayers();

      const uiLayer = layerManager.getLayer('ui');
      const uiObj = {
        x: 2000,
        y: 2000,
        width: 100,
        height: 30,
        visible: true,
        setVisible: vi.fn(),
        getData: () => false,
      };

      (uiLayer as any).children = [uiObj];

      layerManager.cullAllLayers(mockCamera);

      expect(uiObj.setVisible).not.toHaveBeenCalled();
    });

    it('should track culling statistics', () => {
      layerManager.enableCulling(true);
      const layer = layerManager.addLayer('entities', 30);

      // Add objects, some outside viewport
      layer.children = [
        { x: 400, y: 300, visible: true, setVisible: vi.fn(), getData: () => false },
        {
          x: 2000,
          y: 2000,
          visible: true,
          setVisible: vi.fn(function (v: boolean) {
            this.visible = v;
          }),
          getData: () => false,
        },
        {
          x: 3000,
          y: 3000,
          visible: true,
          setVisible: vi.fn(function (v: boolean) {
            this.visible = v;
          }),
          getData: () => false,
        },
      ];

      layerManager.cullAllLayers(mockCamera);

      const stats = layerManager.getCullingStats();
      expect(stats.culledCount).toBe(2);
    });

    it('should update during scene update loop', () => {
      layerManager.enableCulling(true);
      const layer = layerManager.addLayer('entities', 30);

      const obj = {
        x: 2000,
        y: 2000,
        visible: true,
        setVisible: vi.fn(function (v: boolean) {
          this.visible = v;
        }),
        getData: () => false,
      };

      layer.children = [obj];

      layerManager.update(mockCamera);

      expect(obj.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('Rendering Scenarios', () => {
    it('should support village scene layer setup', () => {
      // Ground layer for grass/terrain
      layerManager.addLayer('terrain', 0);

      // Floor layer for paths/roads
      layerManager.addLayer('paths', 5);

      // Building walls
      layerManager.addLayer('buildings', 10);

      // Interior decorations
      layerManager.addLayer('furniture', 20);

      // Agents walking around
      layerManager.addLayer('agents', 30);

      // Building roofs (above player when outside)
      layerManager.addLayer('roofs', 40);

      // Name labels
      layerManager.addLayer('labels', 50);

      const order = layerManager.getRenderOrder();

      expect(order).toEqual([
        'terrain',
        'paths',
        'buildings',
        'furniture',
        'agents',
        'roofs',
        'labels',
      ]);
    });

    it('should support parallax background', () => {
      // Far background - moves slowly
      layerManager.addLayer('sky', -20, { scrollFactor: { x: 0.1, y: 0.1 } });

      // Mid background - moves moderately
      layerManager.addLayer('mountains', -10, { scrollFactor: { x: 0.3, y: 0.3 } });

      // Near background - moves faster
      layerManager.addLayer('trees', -5, { scrollFactor: { x: 0.6, y: 0.6 } });

      // Main game layer - moves with camera
      layerManager.addLayer('game', 0);

      const sky = layerManager.getLayer('sky');
      const mountains = layerManager.getLayer('mountains');
      const trees = layerManager.getLayer('trees');

      expect(sky?.setScrollFactor).toHaveBeenCalledWith(0.1, 0.1);
      expect(mountains?.setScrollFactor).toHaveBeenCalledWith(0.3, 0.3);
      expect(trees?.setScrollFactor).toHaveBeenCalledWith(0.6, 0.6);
    });

    it('should support building interior visibility toggle', () => {
      layerManager.initializeStandardLayers();

      // When player enters building, hide roof
      layerManager.setLayerVisible('above-player', false);
      expect(layerManager.getLayerConfig('above-player')?.visible).toBe(false);

      // When player exits, show roof
      layerManager.setLayerVisible('above-player', true);
      expect(layerManager.getLayerConfig('above-player')?.visible).toBe(true);
    });

    it('should support fog of war effect', () => {
      layerManager.initializeStandardLayers();

      // Add fog layer above entities
      layerManager.addLayer('fog', 35, { alpha: 0.7 });

      // Gradually reveal areas
      layerManager.setLayerAlpha('fog', 0.5);
      layerManager.setLayerAlpha('fog', 0.3);
      layerManager.setLayerAlpha('fog', 0.0);

      expect(layerManager.getLayerConfig('fog')?.alpha).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should destroy all layers on cleanup', () => {
      layerManager.initializeStandardLayers();

      const layers = layerManager.getLayerNames().map((name) => layerManager.getLayer(name));

      layerManager.destroy();

      layers.forEach((layer) => {
        expect(layer?.destroy).toHaveBeenCalled();
      });

      expect(layerManager.getLayerCount()).toBe(0);
    });
  });
});
