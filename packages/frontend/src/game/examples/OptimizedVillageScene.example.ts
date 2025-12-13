import Phaser from 'phaser';
import { CameraController } from '../systems/CameraController';
import { InputHandler } from '../systems/InputHandler';
import { LayerManager } from '../rendering/LayerManager';
import { RenderOptimizer } from '../rendering/RenderOptimizer';
import { LODSystem, LODLevel } from '../rendering/LODSystem';
import { PerformanceMonitor } from '../ui/PerformanceMonitor';
import { eventBus } from '../../realtime/EventBus';

/**
 * OptimizedVillageScene - Example showing how to integrate all rendering optimizations
 *
 * This example demonstrates:
 * 1. LayerManager with viewport culling
 * 2. RenderOptimizer with object pooling
 * 3. LODSystem for distance-based detail levels
 * 4. PerformanceMonitor for real-time metrics
 * 5. Efficient rendering with batch optimization
 */
export class OptimizedVillageScene extends Phaser.Scene {
  private cameraController!: CameraController;
  private inputHandler!: InputHandler;
  private layerManager!: LayerManager;
  private renderOptimizer!: RenderOptimizer;
  private lodSystem!: LODSystem;
  private performanceMonitor!: PerformanceMonitor;

  private houses: Map<string, Phaser.GameObjects.Container> = new Map();
  private agents: Map<string, Phaser.GameObjects.Sprite> = new Map();

  constructor() {
    super({ key: 'OptimizedVillageScene' });
  }

  create() {
    console.log('[OptimizedVillageScene] Creating optimized village...');

    // Set world bounds
    const worldWidth = 3200; // Larger world to demonstrate culling
    const worldHeight = 2400;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Initialize rendering systems
    this.initializeRenderingSystems();

    // Create background
    this.createBackground(worldWidth, worldHeight);

    // Create houses with LOD
    this.createHousesWithLOD();

    // Initialize camera controller
    this.cameraController = new CameraController(this, {
      minZoom: 0.5,
      maxZoom: 2.0,
      worldBounds: new Phaser.Geom.Rectangle(0, 0, worldWidth, worldHeight),
    });

    // Initialize input handler
    this.inputHandler = new InputHandler(this, this.cameraController);

    // Set initial camera position
    this.cameraController.setZoom(1.0);
    this.cameraController.panTo(worldWidth / 2, worldHeight / 2, 0);

    // Listen for agent updates
    this.setupEventListeners();

    // Setup keyboard shortcuts for performance monitoring
    this.setupKeyboardShortcuts();

    console.log('[OptimizedVillageScene] Optimized village ready');
    console.log('[OptimizedVillageScene] Press P to toggle performance monitor');
    console.log('[OptimizedVillageScene] Press C to toggle culling');
  }

  /**
   * Initialize all rendering optimization systems
   */
  private initializeRenderingSystems(): void {
    // Create layer manager with culling enabled
    this.layerManager = new LayerManager(this);
    this.layerManager.initializeStandardLayers();
    this.layerManager.enableCulling(true);
    this.layerManager.setCullPadding(128); // Extra padding around viewport

    // Create render optimizer with object pooling
    this.renderOptimizer = new RenderOptimizer(this);
    this.renderOptimizer.enableCulling(this.cameras.main, 1);
    this.renderOptimizer.setAutoQuality(true);

    // Create agent sprite pool
    this.renderOptimizer.createPool('agent', {
      initialSize: 20,
      maxSize: 100,
      createFunc: () => {
        const circle = this.add.circle(0, 0, 8, 0xffffff);
        return circle as any;
      },
      resetFunc: (obj: Phaser.GameObjects.GameObject) => {
        const circle = obj as any;
        circle.setPosition(0, 0);
        circle.setAlpha(1.0);
      },
    });

    // Create decoration pool for reusable decorations
    this.renderOptimizer.createPool('decoration', {
      initialSize: 50,
      maxSize: 200,
      createFunc: () => {
        const rect = this.add.rectangle(0, 0, 16, 16, 0x88aa88);
        return rect as any;
      },
      resetFunc: (obj: Phaser.GameObjects.GameObject) => {
        const rect = obj as any;
        rect.setPosition(0, 0);
        rect.setAlpha(1.0);
      },
    });

    // Create LOD system
    this.lodSystem = new LODSystem(this, {
      highDetailDistance: 300,
      mediumDetailDistance: 600,
      lowDetailDistance: 1200,
      zoomHighThreshold: 1.5,
      zoomMediumThreshold: 1.0,
      zoomLowThreshold: 0.5,
    });
    this.lodSystem.setCamera(this.cameras.main);
    this.lodSystem.setUpdateInterval(5); // Update every 5 frames

    // Create performance monitor
    this.performanceMonitor = new PerformanceMonitor(this, {
      visible: true,
      position: { x: 10, y: 10 },
      updateInterval: 500,
      showDetailed: false,
    });
    this.performanceMonitor.setRenderOptimizer(this.renderOptimizer);
    this.performanceMonitor.setLayerManager(this.layerManager);
    this.performanceMonitor.setLODSystem(this.lodSystem);
  }

  /**
   * Create background with grid
   */
  private createBackground(width: number, height: number): void {
    const groundLayer = this.layerManager.getLayer(LayerManager.LAYERS.GROUND.name);
    if (!groundLayer) return;

    // Create background color
    const background = this.add.rectangle(0, 0, width, height, 0x4a7c59);
    background.setOrigin(0);
    groundLayer.add(background);

    // Create grid
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x3a5c49, 0.3);

    const gridSize = 32;
    for (let x = 0; x <= width; x += gridSize) {
      gridGraphics.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      gridGraphics.lineBetween(0, y, width, y);
    }

    groundLayer.add(gridGraphics);
  }

  /**
   * Create houses with LOD support
   */
  private createHousesWithLOD(): void {
    const decorationsLayer = this.layerManager.getLayer(LayerManager.LAYERS.DECORATIONS.name);
    if (!decorationsLayer) return;

    // Create a grid of houses to demonstrate culling
    const houseConfigs = [
      { id: 'house_python', color: 0x3776ab, name: 'Python' },
      { id: 'house_javascript', color: 0xf7df1e, name: 'JavaScript' },
      { id: 'house_typescript', color: 0x3178c6, name: 'TypeScript' },
      { id: 'house_go', color: 0x00add8, name: 'Go' },
      { id: 'house_rust', color: 0xce422b, name: 'Rust' },
      { id: 'house_java', color: 0x007396, name: 'Java' },
    ];

    // Create multiple houses in a grid
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const configIndex = (row * 6 + col) % houseConfigs.length;
        const config = houseConfigs[configIndex];
        const x = 300 + col * 400;
        const y = 300 + row * 500;
        const id = `${config.id}_${row}_${col}`;

        this.createHouseWithLOD(id, x, y, config.color, config.name, decorationsLayer);
      }
    }
  }

  /**
   * Create a single house with LOD levels
   */
  private createHouseWithLOD(
    id: string,
    x: number,
    y: number,
    color: number,
    name: string,
    layer: Phaser.GameObjects.Container
  ): void {
    // Create container for house
    const houseContainer = this.add.container(x, y);

    // Main house body
    const houseBody = this.add.rectangle(0, 0, 96, 96, color);
    houseBody.setStrokeStyle(2, 0x000000);
    houseBody.setInteractive({ useHandCursor: true });
    houseBody.setData('houseId', id);
    houseContainer.add(houseBody);

    // Decorative windows (hidden at low LOD)
    const decorativeElements: Phaser.GameObjects.GameObject[] = [];
    const window1 = this.add.rectangle(-24, -24, 16, 16, 0xffffcc);
    const window2 = this.add.rectangle(24, -24, 16, 16, 0xffffcc);
    const door = this.add.rectangle(0, 24, 24, 32, 0x8b4513);
    decorativeElements.push(window1, window2, door);
    houseContainer.add([window1, window2, door]);

    // House label
    const label = this.add.text(0, 60, name, {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    });
    label.setOrigin(0.5);
    houseContainer.add(label);

    // Handle house click
    houseBody.on('pointerdown', () => {
      this.enterHouse(id);
    });

    // Add to layer
    layer.add(houseContainer);
    this.houses.set(id, houseContainer);

    // Register with LOD system
    const lodCallbacks = this.lodSystem.createComplexObjectCallbacks(
      houseContainer,
      decorativeElements
    );
    this.lodSystem.registerObject(id, houseContainer, lodCallbacks);
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    // Toggle performance monitor
    this.input.keyboard?.on('keydown-P', () => {
      this.performanceMonitor.toggle();
    });

    // Toggle culling
    this.input.keyboard?.on('keydown-C', () => {
      const stats = this.layerManager.getCullingStats();
      this.layerManager.enableCulling(!stats.enabled);
      console.log(`[OptimizedVillageScene] Culling: ${!stats.enabled ? 'ON' : 'OFF'}`);
    });

    // Toggle LOD detailed view
    this.input.keyboard?.on('keydown-D', () => {
      this.performanceMonitor.toggleDetailedView();
    });
  }

  /**
   * Setup event listeners for agent updates
   */
  private setupEventListeners(): void {
    eventBus.on('agentMoved', (data: { agentId: string; x: number; y: number }) => {
      this.updateAgentPosition(data.agentId, data.x, data.y);
    });

    eventBus.on('agentRemoved', (data: { agentId: string }) => {
      this.removeAgent(data.agentId);
    });
  }

  /**
   * Update or create agent using object pool
   */
  private updateAgentPosition(agentId: string, x: number, y: number): void {
    let agent: Phaser.GameObjects.Sprite | undefined = this.agents.get(agentId);

    if (!agent) {
      // Get from pool instead of creating new
      const pooledAgent = this.renderOptimizer.getFromPool<Phaser.GameObjects.Sprite>('agent');
      if (!pooledAgent) {
        console.warn('[OptimizedVillageScene] Agent pool exhausted');
        return;
      }
      agent = pooledAgent;

      this.agents.set(agentId, agent);

      // Add to entities layer
      const entitiesLayer = this.layerManager.getLayer(LayerManager.LAYERS.ENTITIES.name);
      if (entitiesLayer) {
        entitiesLayer.add(agent);
      }
    }

    // Animate to new position
    this.tweens.add({
      targets: agent,
      x,
      y,
      duration: 200,
      ease: 'Linear',
    });
  }

  /**
   * Remove agent and return to pool
   */
  private removeAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.renderOptimizer.returnToPool(agent);
      this.agents.delete(agentId);
    }
  }

  /**
   * Enter house transition
   */
  private enterHouse(houseId: string): void {
    console.log(`[OptimizedVillageScene] Entering house: ${houseId}`);
    eventBus.emit('houseEntered', { houseId });
    this.scene.start('HouseScene', { houseId });
  }

  /**
   * Update loop - integrate all optimization systems
   */
  update(time: number, delta: number): void {
    // Update input handler
    if (this.inputHandler) {
      this.inputHandler.update(delta);
    }

    // Update layer culling (automatically culls objects outside viewport)
    if (this.layerManager) {
      this.layerManager.update(this.cameras.main);
    }

    // Update render optimizer
    if (this.renderOptimizer) {
      this.renderOptimizer.update();
    }

    // Update LOD system
    if (this.lodSystem) {
      this.lodSystem.update();
    }

    // Update performance monitor
    if (this.performanceMonitor) {
      this.performanceMonitor.update(time, delta);
    }
  }

  /**
   * Cleanup
   */
  shutdown(): void {
    // Clean up event listeners
    eventBus.off('agentMoved');
    eventBus.off('agentRemoved');

    // Clean up optimization systems
    if (this.layerManager) {
      this.layerManager.destroy();
    }
    if (this.renderOptimizer) {
      this.renderOptimizer.destroy();
    }
    if (this.lodSystem) {
      this.lodSystem.destroy();
    }
    if (this.performanceMonitor) {
      this.performanceMonitor.destroy();
    }

    // Clean up sprites
    this.houses.clear();
    this.agents.clear();
  }
}
