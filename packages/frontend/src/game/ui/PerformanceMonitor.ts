import Phaser from 'phaser';
import { RenderOptimizer, PerformanceMetrics } from '../rendering/RenderOptimizer';
import { LayerManager } from '../rendering/LayerManager';
import { LODSystem } from '../rendering/LODSystem';

export interface PerformanceMonitorConfig {
  visible?: boolean;
  position?: { x: number; y: number };
  updateInterval?: number; // milliseconds
  showDetailed?: boolean;
  backgroundColor?: number;
  textColor?: string;
  fontSize?: number;
}

/**
 * PerformanceMonitor - Real-time performance metrics display
 *
 * Features:
 * - FPS counter with moving average
 * - Draw call counter
 * - Object count display
 * - Memory usage tracking
 * - Culling statistics
 * - LOD statistics
 * - Frame time graph
 * - Toggle detailed/compact view
 */
export class PerformanceMonitor {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private renderOptimizer?: RenderOptimizer;
  private layerManager?: LayerManager;
  private lodSystem?: LODSystem;

  // Configuration
  private config: Required<PerformanceMonitorConfig> = {
    visible: true,
    position: { x: 10, y: 10 },
    updateInterval: 500,
    showDetailed: false,
    backgroundColor: 0x000000,
    textColor: '#00ff00',
    fontSize: 12,
  };

  // UI Elements (initialized in createUI)
  private background!: Phaser.GameObjects.Rectangle;
  private fpsText!: Phaser.GameObjects.Text;
  private drawCallsText!: Phaser.GameObjects.Text;
  private objectsText!: Phaser.GameObjects.Text;
  private culledText!: Phaser.GameObjects.Text;
  private lodText!: Phaser.GameObjects.Text;
  private memoryText!: Phaser.GameObjects.Text;
  private frameTimeGraph?: Phaser.GameObjects.Graphics;

  // Performance tracking
  private lastUpdateTime: number = 0;
  private frameTimeHistory: number[] = [];
  private frameTimeHistorySize: number = 60;
  private lastFrameTime: number = 0;

  constructor(scene: Phaser.Scene, config?: PerformanceMonitorConfig) {
    this.scene = scene;
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Create container
    this.container = this.scene.add.container(
      this.config.position.x,
      this.config.position.y
    );
    this.container.setScrollFactor(0); // Fixed to camera
    this.container.setDepth(10000); // Always on top
    this.container.setVisible(this.config.visible);

    // Create UI elements
    this.createUI();

    console.log('[PerformanceMonitor] Created');
  }

  /**
   * Create the UI elements
   */
  private createUI(): void {
    const textStyle = {
      fontSize: `${this.config.fontSize}px`,
      fontFamily: 'monospace',
      color: this.config.textColor,
      padding: { x: 4, y: 2 },
    };

    // Background
    this.background = this.scene.add.rectangle(
      0,
      0,
      200,
      this.config.showDetailed ? 160 : 100,
      this.config.backgroundColor,
      0.7
    );
    this.background.setOrigin(0, 0);
    this.container.add(this.background);

    // FPS text
    this.fpsText = this.scene.add.text(5, 5, 'FPS: --', textStyle);
    this.container.add(this.fpsText);

    // Draw calls text
    this.drawCallsText = this.scene.add.text(5, 20, 'Draw Calls: --', textStyle);
    this.container.add(this.drawCallsText);

    // Objects text
    this.objectsText = this.scene.add.text(5, 35, 'Objects: --', textStyle);
    this.container.add(this.objectsText);

    // Culled objects text
    this.culledText = this.scene.add.text(5, 50, 'Culled: --', textStyle);
    this.container.add(this.culledText);

    // LOD stats text
    this.lodText = this.scene.add.text(5, 65, 'LOD: --', textStyle);
    this.container.add(this.lodText);

    // Memory text
    this.memoryText = this.scene.add.text(5, 80, 'Memory: --', textStyle);
    this.container.add(this.memoryText);

    // Frame time graph (only in detailed view)
    if (this.config.showDetailed) {
      this.frameTimeGraph = this.scene.add.graphics();
      this.container.add(this.frameTimeGraph);
    }

    // Make background interactive for toggling detailed view
    this.background.setInteractive();
    this.background.on('pointerdown', () => {
      this.toggleDetailedView();
    });
  }

  /**
   * Set the render optimizer to track
   */
  setRenderOptimizer(optimizer: RenderOptimizer): void {
    this.renderOptimizer = optimizer;
  }

  /**
   * Set the layer manager to track
   */
  setLayerManager(layerManager: LayerManager): void {
    this.layerManager = layerManager;
  }

  /**
   * Set the LOD system to track
   */
  setLODSystem(lodSystem: LODSystem): void {
    this.lodSystem = lodSystem;
  }

  /**
   * Toggle detailed view
   */
  toggleDetailedView(): void {
    this.config.showDetailed = !this.config.showDetailed;

    if (this.config.showDetailed) {
      this.background.setSize(200, 160);
      if (!this.frameTimeGraph) {
        this.frameTimeGraph = this.scene.add.graphics();
        this.container.add(this.frameTimeGraph);
      }
      this.frameTimeGraph.setVisible(true);
    } else {
      this.background.setSize(200, 100);
      if (this.frameTimeGraph) {
        this.frameTimeGraph.setVisible(false);
      }
    }

    console.log(`[PerformanceMonitor] Detailed view: ${this.config.showDetailed}`);
  }

  /**
   * Update the performance display
   */
  update(time: number, delta: number): void {
    if (!this.config.visible) return;

    // Track frame time
    this.frameTimeHistory.push(delta);
    if (this.frameTimeHistory.length > this.frameTimeHistorySize) {
      this.frameTimeHistory.shift();
    }

    // Only update display at specified interval
    if (time - this.lastUpdateTime < this.config.updateInterval) return;
    this.lastUpdateTime = time;

    // Get metrics from render optimizer
    let metrics: PerformanceMetrics = {
      fps: Math.round(this.scene.game.loop.actualFps),
      drawCalls: 0,
      objects: this.scene.children.length,
      textureMemory: 0,
      culledObjects: 0,
      pooledObjects: 0,
    };

    if (this.renderOptimizer) {
      metrics = this.renderOptimizer.getPerformanceMetrics();
    }

    // Get culling stats from layer manager
    let culledCount = 0;
    if (this.layerManager) {
      const cullingStats = this.layerManager.getCullingStats();
      culledCount = cullingStats.culledCount;
    }

    // Get LOD stats
    let lodStats = { totalObjects: 0, highDetail: 0, mediumDetail: 0, lowDetail: 0 };
    if (this.lodSystem) {
      lodStats = this.lodSystem.getStats();
    }

    // Update text displays
    const fps = metrics.fps;
    const fpsColor = fps >= 55 ? '#00ff00' : fps >= 30 ? '#ffff00' : '#ff0000';
    this.fpsText.setText(`FPS: ${fps}`);
    this.fpsText.setColor(fpsColor);

    this.drawCallsText.setText(`Draw Calls: ${metrics.drawCalls}`);
    this.objectsText.setText(`Objects: ${metrics.objects}`);
    this.culledText.setText(`Culled: ${culledCount}`);
    this.lodText.setText(`LOD: H${lodStats.highDetail} M${lodStats.mediumDetail} L${lodStats.lowDetail}`);

    // Format memory (rough estimate in KB)
    const memoryKB = Math.round(metrics.textureMemory / 1024);
    this.memoryText.setText(`Memory: ${memoryKB}KB`);

    // Draw frame time graph in detailed view
    if (this.config.showDetailed && this.frameTimeGraph) {
      this.drawFrameTimeGraph();
    }
  }

  /**
   * Draw the frame time graph
   */
  private drawFrameTimeGraph(): void {
    if (!this.frameTimeGraph || this.frameTimeHistory.length === 0) return;

    this.frameTimeGraph.clear();

    // Graph position and size
    const graphX = 5;
    const graphY = 100;
    const graphWidth = 190;
    const graphHeight = 50;

    // Draw background
    this.frameTimeGraph.fillStyle(0x222222, 0.5);
    this.frameTimeGraph.fillRect(graphX, graphY, graphWidth, graphHeight);

    // Draw grid lines
    this.frameTimeGraph.lineStyle(1, 0x444444, 0.3);
    const gridLines = 3;
    for (let i = 1; i <= gridLines; i++) {
      const y = graphY + (graphHeight / (gridLines + 1)) * i;
      this.frameTimeGraph.lineBetween(graphX, y, graphX + graphWidth, y);
    }

    // Draw frame time line
    this.frameTimeGraph.lineStyle(2, 0x00ff00, 1);

    const maxFrameTime = 33.33; // 30 FPS threshold
    const points = this.frameTimeHistory.slice(-60);
    const stepX = graphWidth / points.length;

    this.frameTimeGraph.beginPath();
    points.forEach((frameTime, index) => {
      const x = graphX + index * stepX;
      const normalizedTime = Math.min(frameTime / maxFrameTime, 1);
      const y = graphY + graphHeight - normalizedTime * graphHeight;

      if (index === 0) {
        this.frameTimeGraph!.moveTo(x, y);
      } else {
        this.frameTimeGraph!.lineTo(x, y);
      }
    });
    this.frameTimeGraph.strokePath();

    // Draw 60 FPS line (16.67ms)
    const targetY = graphY + graphHeight - (16.67 / maxFrameTime) * graphHeight;
    this.frameTimeGraph.lineStyle(1, 0xffff00, 0.5);
    this.frameTimeGraph.lineBetween(graphX, targetY, graphX + graphWidth, targetY);
  }

  /**
   * Show/hide the monitor
   */
  setVisible(visible: boolean): void {
    this.config.visible = visible;
    this.container.setVisible(visible);
  }

  /**
   * Toggle visibility
   */
  toggle(): void {
    this.setVisible(!this.config.visible);
  }

  /**
   * Update position
   */
  setPosition(x: number, y: number): void {
    this.config.position = { x, y };
    this.container.setPosition(x, y);
  }

  /**
   * Get current FPS
   */
  getCurrentFPS(): number {
    return Math.round(this.scene.game.loop.actualFps);
  }

  /**
   * Get average frame time
   */
  getAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
    return sum / this.frameTimeHistory.length;
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.frameTimeHistory = [];
    this.lastUpdateTime = 0;
    console.log('[PerformanceMonitor] Statistics reset');
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.container.destroy();
    console.log('[PerformanceMonitor] Destroyed');
  }
}
