import Phaser from 'phaser';
import { CameraController } from '../systems/CameraController';
import { InputHandler } from '../systems/InputHandler';
import { eventBus } from '../../realtime/EventBus';

/**
 * VillageScene - World Map View
 *
 * Responsibilities:
 * - Render village tilemap
 * - Display house buildings
 * - Show agents moving around the village
 * - Handle house click interactions to enter buildings
 * - Manage camera controls and input
 */
export class VillageScene extends Phaser.Scene {
  private cameraController!: CameraController;
  private inputHandler!: InputHandler;
  private tilemap?: Phaser.Tilemaps.Tilemap;
  private houses: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private agents: Map<string, Phaser.GameObjects.Sprite> = new Map();

  constructor() {
    super({ key: 'VillageScene' });
  }

  create() {
    console.log('[VillageScene] Creating village...');

    // Set world bounds
    const worldWidth = 1600;
    const worldHeight = 1200;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Create background
    this.add.rectangle(0, 0, worldWidth, worldHeight, 0x4a7c59).setOrigin(0);

    // Initialize camera controller
    this.cameraController = new CameraController(this, {
      minZoom: 0.5,
      maxZoom: 2.0,
      worldBounds: new Phaser.Geom.Rectangle(0, 0, worldWidth, worldHeight),
    });

    // Initialize input handler
    this.inputHandler = new InputHandler(this, this.cameraController);

    // Create tilemap (if available)
    this.createTilemap();

    // Create houses
    this.createHouses();

    // Set initial camera position
    this.cameraController.setZoom(1.0);
    this.cameraController.panTo(worldWidth / 2, worldHeight / 2, 0);

    // Listen for agent updates from event bus
    this.setupEventListeners();

    console.log('[VillageScene] Village ready');
  }

  private createTilemap() {
    // TODO: Load actual tilemap when available
    // For now, create a simple grid background
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x3a5c49, 0.3);

    const gridSize = 32;
    const worldWidth = 1600;
    const worldHeight = 1200;

    for (let x = 0; x <= worldWidth; x += gridSize) {
      gridGraphics.lineBetween(x, 0, x, worldHeight);
    }
    for (let y = 0; y <= worldHeight; y += gridSize) {
      gridGraphics.lineBetween(0, y, worldWidth, y);
    }
  }

  private createHouses() {
    // Create sample houses
    const housePositions = [
      { id: 'house_python', x: 400, y: 300, color: 0x3776ab },
      { id: 'house_javascript', x: 800, y: 300, color: 0xf7df1e },
      { id: 'house_typescript', x: 1200, y: 300, color: 0x3178c6 },
      { id: 'house_go', x: 400, y: 700, color: 0x00add8 },
      { id: 'house_rust', x: 800, y: 700, color: 0xce422b },
      { id: 'house_java', x: 1200, y: 700, color: 0x007396 },
    ];

    housePositions.forEach(({ id, x, y, color }) => {
      const house = this.add.rectangle(x, y, 96, 96, color);
      house.setInteractive({ useHandCursor: true });
      house.setData('houseId', id);

      // Add house label
      this.add
        .text(x, y + 60, id.replace('house_', '').toUpperCase(), {
          fontSize: '12px',
          color: '#ffffff',
          backgroundColor: '#00000088',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5);

      // Handle house click
      house.on('pointerdown', () => {
        this.enterHouse(id);
      });

      this.houses.set(id, house as any);
    });
  }

  private setupEventListeners() {
    // Listen for agent position updates
    eventBus.on('agentMoved', (data: { agentId: string; x: number; y: number }) => {
      this.updateAgentPosition(data.agentId, data.x, data.y);
    });

    // Listen for agent removal
    eventBus.on('agentRemoved', (data: { agentId: string }) => {
      this.removeAgent(data.agentId);
    });
  }

  private updateAgentPosition(agentId: string, x: number, y: number) {
    let agent = this.agents.get(agentId);

    if (!agent) {
      // Create new agent sprite (use circle as placeholder)
      const circle = this.add.circle(x, y, 8, 0xffffff);
      agent = circle as any as Phaser.GameObjects.Sprite;
      this.agents.set(agentId, agent);
    } else {
      // Animate to new position
      this.tweens.add({
        targets: agent,
        x,
        y,
        duration: 200,
        ease: 'Linear',
      });
    }
  }

  private removeAgent(agentId: string) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.destroy();
      this.agents.delete(agentId);
    }
  }

  private enterHouse(houseId: string) {
    console.log(`[VillageScene] Entering house: ${houseId}`);
    eventBus.emit('houseEntered', { houseId });

    // Transition to HouseScene
    this.scene.start('HouseScene', { houseId });
  }

  update(time: number, delta: number) {
    // Update input handler
    if (this.inputHandler) {
      this.inputHandler.update(delta);
    }
  }

  shutdown() {
    // Clean up event listeners
    eventBus.off('agentMoved');
    eventBus.off('agentRemoved');

    // Clean up sprites
    this.houses.clear();
    this.agents.clear();
  }
}
