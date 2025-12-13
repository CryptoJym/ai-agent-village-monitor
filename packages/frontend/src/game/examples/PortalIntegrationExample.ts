import Phaser from 'phaser';
import { PortalSystem, SceneTransitionManager, createFadeTransition } from '../systems';

/**
 * Example scene demonstrating PortalSystem integration with SceneTransitionManager
 *
 * This example shows:
 * 1. Setting up PortalSystem in a scene
 * 2. Registering portals/doors
 * 3. Handling portal activation with scene transitions
 * 4. Managing player position and state across transitions
 */
export class PortalIntegrationExample extends Phaser.Scene {
  private portalSystem!: PortalSystem;
  private transitionManager!: SceneTransitionManager;
  private player!: Phaser.GameObjects.Rectangle;
  private playerPosition = { x: 400, y: 300 };

  constructor() {
    super({ key: 'PortalIntegrationExample' });
  }

  create(data?: any) {
    console.log('[PortalIntegrationExample] Creating scene with data:', data);

    // Initialize systems
    this.transitionManager = new SceneTransitionManager();
    this.portalSystem = new PortalSystem(this, {
      defaultInteractionRadius: 60,
      interactionKey: 'E',
    });

    // Create world
    this.createWorld();

    // Create player
    this.createPlayer(data?.spawnPosition);

    // Register portals
    this.registerPortals();

    // Set up portal event handlers
    this.setupPortalHandlers();

    // Handle transition in effect
    if (data?.fromScene) {
      this.handleTransitionIn(data);
    }
  }

  private createWorld(): void {
    const worldWidth = 1600;
    const worldHeight = 1200;

    // Set bounds
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Background
    this.add.rectangle(0, 0, worldWidth, worldHeight, 0x4a7c59).setOrigin(0);

    // Add some visual elements
    this.add.text(worldWidth / 2, 50, 'Village Scene', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  private createPlayer(spawnPosition?: { x: number; y: number }): void {
    // Use spawn position if provided, otherwise use default
    if (spawnPosition) {
      this.playerPosition = spawnPosition;
    }

    // Create simple player rectangle
    this.player = this.add.rectangle(
      this.playerPosition.x,
      this.playerPosition.y,
      32,
      32,
      0xff0000
    );

    // Center camera on player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  private registerPortals(): void {
    // Building entrance portal
    this.portalSystem.registerPortal({
      id: 'house-entrance',
      position: { x: 400, y: 400 },
      targetScene: 'HouseInteriorScene',
      targetPosition: { x: 100, y: 500 },
      doorType: 'building-entrance',
      metadata: {
        houseId: 'house_1',
        houseName: 'Main House',
      },
    });

    // Another building entrance
    this.portalSystem.registerPortal({
      id: 'shop-entrance',
      position: { x: 800, y: 400 },
      targetScene: 'ShopInteriorScene',
      targetPosition: { x: 100, y: 500 },
      doorType: 'building-entrance',
      metadata: {
        shopId: 'shop_1',
        shopName: 'General Store',
      },
    });

    // Locked door example
    this.portalSystem.registerPortal({
      id: 'locked-building',
      position: { x: 1200, y: 400 },
      targetScene: 'SecretRoomScene',
      targetPosition: { x: 400, y: 300 },
      doorType: 'building-entrance',
      requiresKey: 'golden_key',
      metadata: {
        description: 'This door is locked. You need the Golden Key.',
      },
    });

    // Exit portal (back to world map, for example)
    this.portalSystem.registerPortal({
      id: 'village-exit',
      position: { x: 800, y: 1100 },
      targetScene: 'WorldMapScene',
      targetPosition: { x: 400, y: 300 },
      doorType: 'exit',
    });
  }

  private setupPortalHandlers(): void {
    // Listen for portal activation
    this.portalSystem.on('portalActivated', async (data: any) => {
      console.log('[PortalIntegrationExample] Portal activated:', data);

      // Prepare transition data
      const transitionData = {
        spawnPosition: data.targetPosition,
        fromScene: this.scene.key,
        ...data.metadata,
      };

      // Execute transition with fade effect
      await this.transitionManager.transitionTo(
        this,
        data.targetScene,
        createFadeTransition(500, 0x000000),
        transitionData
      );
    });

    // Listen for locked portal attempts
    this.portalSystem.on('portalLocked', (portal: any) => {
      console.log('[PortalIntegrationExample] Portal is locked:', portal);

      // Show message to player
      this.showMessage(`This door is locked! You need: ${portal.requiresKey}`);
    });

    // Optional: Listen for door open/close events
    this.portalSystem.on('doorOpened', (portalId: string) => {
      console.log('[PortalIntegrationExample] Door opened:', portalId);
    });

    this.portalSystem.on('doorClosed', (portalId: string) => {
      console.log('[PortalIntegrationExample] Door closed:', portalId);
    });
  }

  private handleTransitionIn(data: any): void {
    console.log('[PortalIntegrationExample] Handling transition in from:', data.fromScene);

    // Apply transition in effect
    this.transitionManager.transitionIn(this, createFadeTransition(500, 0x000000));

    // Restore previous state if requested
    if (data.restoreState && data.previousState) {
      this.transitionManager.restoreSceneState(this, data.previousState);
    }
  }

  private showMessage(message: string): void {
    const text = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 100,
      message,
      {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 16, y: 8 },
        fontFamily: 'monospace',
      }
    );
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(1000);

    // Fade out and destroy after 2 seconds
    this.tweens.add({
      targets: text,
      alpha: 0,
      duration: 1000,
      delay: 2000,
      onComplete: () => {
        text.destroy();
      },
    });
  }

  update(time: number, delta: number): void {
    // Update player movement (simple keyboard controls)
    this.updatePlayerMovement(delta);

    // Update portal system with player position
    this.portalSystem.update(this.playerPosition.x, this.playerPosition.y);
  }

  private updatePlayerMovement(delta: number): void {
    const speed = 0.2 * delta;
    const cursors = this.input.keyboard?.createCursorKeys();

    if (!cursors) return;

    let moved = false;

    if (cursors.left.isDown) {
      this.playerPosition.x -= speed;
      moved = true;
    }
    if (cursors.right.isDown) {
      this.playerPosition.x += speed;
      moved = true;
    }
    if (cursors.up.isDown) {
      this.playerPosition.y -= speed;
      moved = true;
    }
    if (cursors.down.isDown) {
      this.playerPosition.y += speed;
      moved = true;
    }

    if (moved) {
      this.player.setPosition(this.playerPosition.x, this.playerPosition.y);
    }
  }

  shutdown(): void {
    // Clean up systems
    if (this.portalSystem) {
      this.portalSystem.destroy();
    }
    // Note: Don't destroy transitionManager here if it's shared across scenes
  }
}

/**
 * Example of a target scene (House Interior)
 */
export class HouseInteriorScene extends Phaser.Scene {
  private portalSystem!: PortalSystem;
  private transitionManager!: SceneTransitionManager;
  private player!: Phaser.GameObjects.Rectangle;
  private playerPosition = { x: 100, y: 500 };

  constructor() {
    super({ key: 'HouseInteriorScene' });
  }

  create(data?: any) {
    console.log('[HouseInteriorScene] Creating interior with data:', data);

    // Initialize systems
    this.transitionManager = new SceneTransitionManager();
    this.portalSystem = new PortalSystem(this, {
      defaultInteractionRadius: 50,
      interactionKey: 'E',
    });

    // Create interior
    this.createInterior(data);

    // Create player at spawn position
    this.createPlayer(data?.spawnPosition);

    // Register exit portal
    this.registerExitPortal();

    // Set up handlers
    this.setupPortalHandlers();

    // Transition in effect
    this.transitionManager.transitionIn(this, createFadeTransition(500, 0x000000));
  }

  private createInterior(data?: any): void {
    const worldWidth = 800;
    const worldHeight = 600;

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Interior background
    this.add.rectangle(0, 0, worldWidth, worldHeight, 0x8b7355).setOrigin(0);

    // Title
    const houseName = data?.houseName || 'House Interior';
    this.add.text(worldWidth / 2, 50, houseName, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  private createPlayer(spawnPosition?: { x: number; y: number }): void {
    if (spawnPosition) {
      this.playerPosition = spawnPosition;
    }

    this.player = this.add.rectangle(
      this.playerPosition.x,
      this.playerPosition.y,
      32,
      32,
      0xff0000
    );

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  private registerExitPortal(): void {
    // Exit door to go back to village
    this.portalSystem.registerPortal({
      id: 'exit-to-village',
      position: { x: 100, y: 550 },
      targetScene: 'PortalIntegrationExample',
      targetPosition: { x: 400, y: 350 }, // Spawn just below the entrance
      doorType: 'exit',
    });

    // Room door example
    this.portalSystem.registerPortal({
      id: 'room-door',
      position: { x: 600, y: 300 },
      targetScene: 'RoomScene',
      targetPosition: { x: 100, y: 300 },
      doorType: 'room-door',
    });
  }

  private setupPortalHandlers(): void {
    this.portalSystem.on('portalActivated', async (data: any) => {
      console.log('[HouseInteriorScene] Portal activated:', data);

      await this.transitionManager.transitionTo(
        this,
        data.targetScene,
        createFadeTransition(500, 0x000000),
        {
          spawnPosition: data.targetPosition,
          fromScene: this.scene.key,
          ...data.metadata,
        }
      );
    });
  }

  update(time: number, delta: number): void {
    this.updatePlayerMovement(delta);
    this.portalSystem.update(this.playerPosition.x, this.playerPosition.y);
  }

  private updatePlayerMovement(delta: number): void {
    const speed = 0.2 * delta;
    const cursors = this.input.keyboard?.createCursorKeys();

    if (!cursors) return;

    let moved = false;

    if (cursors.left.isDown) {
      this.playerPosition.x -= speed;
      moved = true;
    }
    if (cursors.right.isDown) {
      this.playerPosition.x += speed;
      moved = true;
    }
    if (cursors.up.isDown) {
      this.playerPosition.y -= speed;
      moved = true;
    }
    if (cursors.down.isDown) {
      this.playerPosition.y += speed;
      moved = true;
    }

    if (moved) {
      this.player.setPosition(this.playerPosition.x, this.playerPosition.y);
    }
  }

  shutdown(): void {
    if (this.portalSystem) {
      this.portalSystem.destroy();
    }
  }
}
