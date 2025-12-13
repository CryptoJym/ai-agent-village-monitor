import Phaser from 'phaser';

export interface RenderLayerConfig {
  name: string;
  zIndex: number;
  visible?: boolean;
  alpha?: number;
  scrollFactor?: { x: number; y: number };
}

export interface LayerInfo {
  container: Phaser.GameObjects.Container;
  config: RenderLayerConfig;
}

/**
 * LayerManager - Multi-layer rendering system
 *
 * Features:
 * - Layer stack management (ground, walls, decorations, entities, above-player)
 * - Z-ordering and depth sorting
 * - Per-layer visibility toggles
 * - Render order control
 * - Support for parallax scrolling via scroll factors
 *
 * Standard Layer Order:
 * - ground (0-9): Terrain, floor tiles
 * - walls (10-19): Wall tiles, barriers
 * - decorations (20-29): Furniture, props
 * - entities (30-39): Agents, dynamic objects
 * - above-player (40-49): Roofs, overlays
 * - ui (50+): UI elements, labels
 */
export class LayerManager {
  private scene: Phaser.Scene;
  private layers: Map<string, LayerInfo> = new Map();
  private renderOrder: string[] = [];

  // Culling optimization
  private cullingEnabled: boolean = true;
  private cullBounds?: Phaser.Geom.Rectangle;
  private culledObjectsCount: number = 0;
  private cullPadding: number = 64; // Extra padding in pixels around viewport

  // Standard layer names and z-indices
  public static readonly LAYERS = {
    GROUND: { name: 'ground', zIndex: 0 },
    FLOOR: { name: 'floor', zIndex: 5 },
    WALLS: { name: 'walls', zIndex: 10 },
    DECORATIONS: { name: 'decorations', zIndex: 20 },
    ENTITIES: { name: 'entities', zIndex: 30 },
    ABOVE_PLAYER: { name: 'above-player', zIndex: 40 },
    UI: { name: 'ui', zIndex: 50 },
  } as const;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Add a new layer to the rendering system
   */
  addLayer(name: string, zIndex: number, config?: Partial<RenderLayerConfig>): Phaser.GameObjects.Container {
    // Check if layer already exists
    if (this.layers.has(name)) {
      console.warn(`[LayerManager] Layer '${name}' already exists. Returning existing layer.`);
      return this.layers.get(name)!.container;
    }

    // Create container for this layer
    const container = this.scene.add.container(0, 0);
    container.setName(name);
    container.setDepth(zIndex);

    // Build full config
    const fullConfig: RenderLayerConfig = {
      name,
      zIndex,
      visible: config?.visible !== undefined ? config.visible : true,
      alpha: config?.alpha !== undefined ? config.alpha : 1.0,
      scrollFactor: config?.scrollFactor,
    };

    // Apply configuration
    container.setVisible(fullConfig.visible ?? true);
    container.setAlpha(fullConfig.alpha ?? 1.0);

    if (fullConfig.scrollFactor) {
      container.setScrollFactor(fullConfig.scrollFactor.x, fullConfig.scrollFactor.y);
    }

    // Store layer info
    const layerInfo: LayerInfo = { container, config: fullConfig };
    this.layers.set(name, layerInfo);

    // Update render order
    this.updateRenderOrder();

    console.log(`[LayerManager] Added layer '${name}' with z-index ${zIndex}`);
    return container;
  }

  /**
   * Get layer container by name
   */
  getLayer(name: string): Phaser.GameObjects.Container | null {
    const layerInfo = this.layers.get(name);
    return layerInfo ? layerInfo.container : null;
  }

  /**
   * Get layer configuration by name
   */
  getLayerConfig(name: string): RenderLayerConfig | null {
    const layerInfo = this.layers.get(name);
    return layerInfo ? layerInfo.config : null;
  }

  /**
   * Set layer visibility
   */
  setLayerVisible(name: string, visible: boolean): void {
    const layerInfo = this.layers.get(name);
    if (layerInfo) {
      layerInfo.container.setVisible(visible);
      layerInfo.config.visible = visible;
      console.log(`[LayerManager] Set layer '${name}' visible: ${visible}`);
    } else {
      console.warn(`[LayerManager] Layer '${name}' not found`);
    }
  }

  /**
   * Set layer alpha
   */
  setLayerAlpha(name: string, alpha: number): void {
    const layerInfo = this.layers.get(name);
    if (layerInfo) {
      layerInfo.container.setAlpha(alpha);
      layerInfo.config.alpha = alpha;
    } else {
      console.warn(`[LayerManager] Layer '${name}' not found`);
    }
  }

  /**
   * Set layer scroll factor for parallax effects
   */
  setLayerScrollFactor(name: string, x: number, y: number): void {
    const layerInfo = this.layers.get(name);
    if (layerInfo) {
      layerInfo.container.setScrollFactor(x, y);
      layerInfo.config.scrollFactor = { x, y };
    } else {
      console.warn(`[LayerManager] Layer '${name}' not found`);
    }
  }

  /**
   * Update layer z-index and re-sort
   */
  setLayerZIndex(name: string, zIndex: number): void {
    const layerInfo = this.layers.get(name);
    if (layerInfo) {
      layerInfo.container.setDepth(zIndex);
      layerInfo.config.zIndex = zIndex;
      this.updateRenderOrder();
      console.log(`[LayerManager] Updated layer '${name}' z-index to ${zIndex}`);
    } else {
      console.warn(`[LayerManager] Layer '${name}' not found`);
    }
  }

  /**
   * Add a game object to a specific layer
   */
  addToLayer(layerName: string, gameObject: Phaser.GameObjects.GameObject): void {
    const layerInfo = this.layers.get(layerName);
    if (layerInfo) {
      layerInfo.container.add(gameObject);
    } else {
      console.warn(`[LayerManager] Cannot add object to layer '${layerName}' - layer not found`);
    }
  }

  /**
   * Remove a game object from a specific layer
   */
  removeFromLayer(layerName: string, gameObject: Phaser.GameObjects.GameObject): void {
    const layerInfo = this.layers.get(layerName);
    if (layerInfo) {
      layerInfo.container.remove(gameObject);
    } else {
      console.warn(`[LayerManager] Cannot remove object from layer '${layerName}' - layer not found`);
    }
  }

  /**
   * Sort layers by z-index
   */
  sortLayers(): void {
    this.updateRenderOrder();
  }

  /**
   * Update the render order based on z-indices
   */
  private updateRenderOrder(): void {
    this.renderOrder = Array.from(this.layers.entries())
      .sort((a, b) => a[1].config.zIndex - b[1].config.zIndex)
      .map(([name]) => name);
  }

  /**
   * Get all layer names in render order
   */
  getRenderOrder(): string[] {
    return [...this.renderOrder];
  }

  /**
   * Render all layers (called in scene's render method if needed)
   * Note: Phaser handles rendering automatically based on depth,
   * this is more for debugging or custom rendering pipelines
   */
  renderAll(): void {
    // Phaser handles rendering automatically via depth sorting
    // This method can be used for custom rendering logic if needed
    this.renderOrder.forEach((layerName) => {
      const layerInfo = this.layers.get(layerName);
      if (layerInfo && layerInfo.config.visible) {
        // Custom rendering logic could go here
        // For now, Phaser's depth sorting handles everything
      }
    });
  }

  /**
   * Get all layer names
   */
  getLayerNames(): string[] {
    return Array.from(this.layers.keys());
  }

  /**
   * Get layer count
   */
  getLayerCount(): number {
    return this.layers.size;
  }

  /**
   * Check if layer exists
   */
  hasLayer(name: string): boolean {
    return this.layers.has(name);
  }

  /**
   * Remove a layer
   */
  removeLayer(name: string): void {
    const layerInfo = this.layers.get(name);
    if (layerInfo) {
      layerInfo.container.destroy();
      this.layers.delete(name);
      this.updateRenderOrder();
      console.log(`[LayerManager] Removed layer '${name}'`);
    } else {
      console.warn(`[LayerManager] Cannot remove layer '${name}' - not found`);
    }
  }

  /**
   * Clear all objects from a layer
   */
  clearLayer(name: string): void {
    const layerInfo = this.layers.get(name);
    if (layerInfo) {
      layerInfo.container.removeAll(true);
      console.log(`[LayerManager] Cleared layer '${name}'`);
    } else {
      console.warn(`[LayerManager] Cannot clear layer '${name}' - not found`);
    }
  }

  /**
   * Initialize standard layers
   */
  initializeStandardLayers(): void {
    // Create standard layers in order
    this.addLayer(LayerManager.LAYERS.GROUND.name, LayerManager.LAYERS.GROUND.zIndex);
    this.addLayer(LayerManager.LAYERS.FLOOR.name, LayerManager.LAYERS.FLOOR.zIndex);
    this.addLayer(LayerManager.LAYERS.WALLS.name, LayerManager.LAYERS.WALLS.zIndex);
    this.addLayer(LayerManager.LAYERS.DECORATIONS.name, LayerManager.LAYERS.DECORATIONS.zIndex);
    this.addLayer(LayerManager.LAYERS.ENTITIES.name, LayerManager.LAYERS.ENTITIES.zIndex);
    this.addLayer(LayerManager.LAYERS.ABOVE_PLAYER.name, LayerManager.LAYERS.ABOVE_PLAYER.zIndex);
    this.addLayer(LayerManager.LAYERS.UI.name, LayerManager.LAYERS.UI.zIndex);

    console.log('[LayerManager] Initialized standard layers');
  }

  /**
   * Enable viewport culling for all layers
   */
  enableCulling(enabled: boolean = true): void {
    this.cullingEnabled = enabled;
    console.log(`[LayerManager] Viewport culling ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set culling padding (extra pixels around viewport)
   */
  setCullPadding(padding: number): void {
    this.cullPadding = padding;
  }

  /**
   * Update culling bounds based on camera viewport
   */
  updateCullingBounds(camera: Phaser.Cameras.Scene2D.Camera): void {
    if (!this.cullingEnabled) return;

    const worldView = camera.worldView;
    this.cullBounds = new Phaser.Geom.Rectangle(
      worldView.x - this.cullPadding,
      worldView.y - this.cullPadding,
      worldView.width + this.cullPadding * 2,
      worldView.height + this.cullPadding * 2
    );
  }

  /**
   * Check if an object is within the viewport (with padding)
   */
  isInViewport(x: number, y: number, width: number = 0, height: number = 0): boolean {
    if (!this.cullingEnabled || !this.cullBounds) return true;

    // Check if object bounds intersect with cull bounds
    const objBounds = new Phaser.Geom.Rectangle(x, y, width, height);
    return Phaser.Geom.Rectangle.Overlaps(this.cullBounds, objBounds);
  }

  /**
   * Cull objects in a specific layer based on camera viewport
   * Returns the number of objects culled
   */
  cullLayer(layerName: string, camera: Phaser.Cameras.Scene2D.Camera): number {
    if (!this.cullingEnabled) return 0;

    const layerInfo = this.layers.get(layerName);
    if (!layerInfo) return 0;

    // Update culling bounds first
    this.updateCullingBounds(camera);

    let culledCount = 0;
    const container = layerInfo.container;

    // Iterate through all objects in the container
    container.iterate((child: Phaser.GameObjects.GameObject) => {
      // Skip if object doesn't have position
      if (!('x' in child) || !('y' in child)) return;

      const obj = child as any;
      const x = obj.x;
      const y = obj.y;
      const width = obj.width || 32;
      const height = obj.height || 32;

      const inViewport = this.isInViewport(x, y, width, height);

      // Only modify visibility if it needs to change
      if (!inViewport && obj.visible) {
        obj.setVisible(false);
        culledCount++;
      } else if (inViewport && !obj.visible && !obj.getData('manuallyHidden')) {
        obj.setVisible(true);
      }
    });

    return culledCount;
  }

  /**
   * Cull all layers based on camera viewport
   * Returns total number of objects culled
   */
  cullAllLayers(camera: Phaser.Cameras.Scene2D.Camera): number {
    if (!this.cullingEnabled) return 0;

    let totalCulled = 0;

    // Skip UI layer as it's usually fixed to camera
    this.layers.forEach((layerInfo, layerName) => {
      if (layerName !== LayerManager.LAYERS.UI.name) {
        totalCulled += this.cullLayer(layerName, camera);
      }
    });

    this.culledObjectsCount = totalCulled;
    return totalCulled;
  }

  /**
   * Get culling statistics
   */
  getCullingStats(): { enabled: boolean; culledCount: number; padding: number } {
    return {
      enabled: this.cullingEnabled,
      culledCount: this.culledObjectsCount,
      padding: this.cullPadding,
    };
  }

  /**
   * Update layers (call in scene's update loop for culling)
   */
  update(camera?: Phaser.Cameras.Scene2D.Camera): void {
    if (this.cullingEnabled && camera) {
      this.cullAllLayers(camera);
    }
  }

  /**
   * Cleanup all layers
   */
  destroy(): void {
    this.layers.forEach((layerInfo) => {
      layerInfo.container.destroy();
    });
    this.layers.clear();
    this.renderOrder = [];
    this.cullBounds = undefined;
    this.culledObjectsCount = 0;
    console.log('[LayerManager] Destroyed all layers');
  }
}
