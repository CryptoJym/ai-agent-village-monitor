import Phaser from 'phaser';
import { CameraController } from '../systems/CameraController';
import { InputHandler } from '../systems/InputHandler';
import { eventBus } from '../../realtime/EventBus';

/**
 * HouseScene - Building Interior View
 *
 * Responsibilities:
 * - Render interior tilemap for the house
 * - Display rooms with labels
 * - Show agents within rooms
 * - Handle room navigation and interaction
 * - Provide exit back to VillageScene
 */
export class HouseScene extends Phaser.Scene {
  private houseId!: string;
  private cameraController!: CameraController;
  private inputHandler!: InputHandler;
  private rooms: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private agents: Map<string, Phaser.GameObjects.Sprite> = new Map();

  constructor() {
    super({ key: 'HouseScene' });
  }

  init(data: { houseId: string }) {
    this.houseId = data.houseId || 'unknown';
    console.log(`[HouseScene] Initializing interior for: ${this.houseId}`);
  }

  create() {
    // Set world bounds for interior
    const worldWidth = 1200;
    const worldHeight = 800;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Create background
    this.add.rectangle(0, 0, worldWidth, worldHeight, 0x8b7355).setOrigin(0);

    // Initialize camera controller
    this.cameraController = new CameraController(this, {
      minZoom: 0.7,
      maxZoom: 2.0,
      worldBounds: new Phaser.Geom.Rectangle(0, 0, worldWidth, worldHeight),
    });

    // Initialize input handler
    this.inputHandler = new InputHandler(this, this.cameraController);

    // Create interior layout
    this.createInteriorLayout();

    // Create exit button
    this.createExitButton();

    // Set initial camera position
    this.cameraController.setZoom(1.0);
    this.cameraController.panTo(worldWidth / 2, worldHeight / 2, 0);

    // Listen for agent updates
    this.setupEventListeners();

    console.log(`[HouseScene] Interior ready for ${this.houseId}`);
  }

  private createInteriorLayout() {
    // Create sample room layout
    const roomConfig = [
      {
        id: 'living_room',
        x: 200,
        y: 200,
        width: 300,
        height: 250,
        label: 'Living Room',
        color: 0xa67c52,
      },
      { id: 'bedroom', x: 600, y: 200, width: 250, height: 250, label: 'Bedroom', color: 0x9d6b53 },
      { id: 'kitchen', x: 950, y: 200, width: 200, height: 250, label: 'Kitchen', color: 0xb88d67 },
      { id: 'office', x: 200, y: 550, width: 400, height: 200, label: 'Office', color: 0x8c6448 },
      {
        id: 'workshop',
        x: 700,
        y: 550,
        width: 450,
        height: 200,
        label: 'Workshop',
        color: 0x7a5644,
      },
    ];

    roomConfig.forEach(({ id, x, y, width, height, label, color }) => {
      // Create room rectangle
      const room = this.add.rectangle(x, y, width, height, color);
      room.setStrokeStyle(2, 0x5a4636);
      room.setOrigin(0);
      room.setInteractive({ useHandCursor: true });
      room.setData('roomId', id);

      // Add room label
      this.add
        .text(x + width / 2, y + height / 2, label, {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'monospace',
          backgroundColor: '#00000066',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5);

      // Handle room click
      room.on('pointerdown', () => {
        this.onRoomClick(id);
      });

      this.rooms.set(id, room);
    });

    // Add floor grid
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x5a4636, 0.2);

    const gridSize = 32;
    for (let x = 0; x <= 1200; x += gridSize) {
      gridGraphics.lineBetween(x, 0, x, 800);
    }
    for (let y = 0; y <= 800; y += gridSize) {
      gridGraphics.lineBetween(0, y, 1200, y);
    }
  }

  private createExitButton() {
    const buttonWidth = 100;
    const buttonHeight = 40;
    const padding = 20;

    const button = this.add.rectangle(
      padding + buttonWidth / 2,
      padding + buttonHeight / 2,
      buttonWidth,
      buttonHeight,
      0x4a5568,
    );
    button.setScrollFactor(0);
    button.setInteractive({ useHandCursor: true });

    this.add
      .text(padding + buttonWidth / 2, padding + buttonHeight / 2, 'Exit', {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    button.on('pointerover', () => {
      button.setFillStyle(0x5a6678);
    });

    button.on('pointerout', () => {
      button.setFillStyle(0x4a5568);
    });

    button.on('pointerdown', () => {
      this.exitHouse();
    });
  }

  private setupEventListeners() {
    // Listen for agents in this house
    eventBus.on(
      'agentInRoom',
      (data: { agentId: string; roomId: string; x: number; y: number }) => {
        if (data.roomId.startsWith(this.houseId)) {
          this.updateAgentPosition(data.agentId, data.x, data.y);
        }
      },
    );

    eventBus.on('agentLeftRoom', (data: { agentId: string }) => {
      this.removeAgent(data.agentId);
    });
  }

  private updateAgentPosition(agentId: string, x: number, y: number) {
    let agent = this.agents.get(agentId);

    if (!agent) {
      // Create new agent sprite (use circle as placeholder)
      const circle = this.add.circle(x, y, 10, 0xffffff);
      circle.setStrokeStyle(2, 0x000000);
      agent = circle as any as Phaser.GameObjects.Sprite;
      this.agents.set(agentId, agent);
    } else {
      // Animate to new position
      this.tweens.add({
        targets: agent,
        x,
        y,
        duration: 300,
        ease: 'Sine.easeInOut',
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

  private onRoomClick(roomId: string) {
    console.log(`[HouseScene] Room clicked: ${roomId}`);
    eventBus.emit('roomClicked', { houseId: this.houseId, roomId });

    // Get room center and pan camera to it
    const room = this.rooms.get(roomId);
    if (room) {
      const bounds = room.getBounds();
      this.cameraController.panTo(bounds.centerX, bounds.centerY, 400);
    }
  }

  private exitHouse() {
    console.log('[HouseScene] Exiting house...');
    eventBus.emit('houseExited', { houseId: this.houseId });

    // Return to VillageScene
    this.scene.start('VillageScene');
  }

  update(time: number, delta: number) {
    if (this.inputHandler) {
      this.inputHandler.update(delta);
    }
  }

  shutdown() {
    // Clean up event listeners
    eventBus.off('agentInRoom');
    eventBus.off('agentLeftRoom');

    // Clean up sprites
    this.rooms.clear();
    this.agents.clear();
  }
}
