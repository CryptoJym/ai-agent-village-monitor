import Phaser from 'phaser';

export type DoorType = 'building-entrance' | 'room-door' | 'exit';

export interface Portal {
  id: string;
  position: { x: number; y: number };
  targetScene: string;
  targetPosition: { x: number; y: number };
  doorType: DoorType;
  animation?: string;
  enabled?: boolean;
  interactionRadius?: number;
  requiresKey?: string;
  metadata?: Record<string, any>;
}

export interface PortalSystemConfig {
  defaultInteractionRadius?: number;
  promptStyle?: Phaser.Types.GameObjects.Text.TextStyle;
  promptOffsetY?: number;
  interactionKey?: string;
  autoCloseDelay?: number;
}

/**
 * PortalSystem - Manages doors, portals, and scene transitions
 *
 * Features:
 * - Door detection and proximity checking
 * - Player interaction prompts
 * - Door animations (open/close)
 * - Portal activation and data management
 * - Keyboard interaction support
 *
 * Usage:
 * ```typescript
 * const portalSystem = new PortalSystem(scene, {
 *   defaultInteractionRadius: 50,
 *   interactionKey: 'E'
 * });
 *
 * portalSystem.registerPortal({
 *   id: 'house-entrance',
 *   position: { x: 400, y: 300 },
 *   targetScene: 'HouseScene',
 *   targetPosition: { x: 100, y: 100 },
 *   doorType: 'building-entrance'
 * });
 *
 * // In update loop
 * portalSystem.update(playerX, playerY);
 * ```
 */
export class PortalSystem extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  private config: Required<PortalSystemConfig>;
  private portals: Map<string, Portal> = new Map();

  // Visual elements
  private doorSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private interactionPrompt?: Phaser.GameObjects.Container;
  private promptText?: Phaser.GameObjects.Text;
  private promptBackground?: Phaser.GameObjects.Rectangle;

  // State
  private nearbyPortal: Portal | null = null;
  private interactionKey?: Phaser.Input.Keyboard.Key;
  private isPromptVisible = false;

  // Animation state
  private openDoors: Set<string> = new Set();
  private doorAnimations: Map<string, Phaser.Tweens.Tween> = new Map();

  constructor(scene: Phaser.Scene, config: PortalSystemConfig = {}) {
    super();

    this.scene = scene;
    this.config = {
      defaultInteractionRadius: config.defaultInteractionRadius ?? 50,
      promptOffsetY: config.promptOffsetY ?? -40,
      interactionKey: config.interactionKey ?? 'E',
      autoCloseDelay: config.autoCloseDelay ?? 2000,
      promptStyle: config.promptStyle ?? {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
        padding: { x: 8, y: 4 },
      },
    };

    this.initialize();
  }

  private initialize(): void {
    // Create interaction prompt (hidden by default)
    this.createInteractionPrompt();

    // Set up keyboard input
    this.setupKeyboard();

    console.log('[PortalSystem] Initialized');
  }

  private setupKeyboard(): void {
    if (!this.scene.input.keyboard) {
      console.warn('[PortalSystem] Keyboard not available');
      return;
    }

    const keyCode = Phaser.Input.Keyboard.KeyCodes[this.config.interactionKey as keyof typeof Phaser.Input.Keyboard.KeyCodes];
    if (keyCode !== undefined) {
      this.interactionKey = this.scene.input.keyboard.addKey(keyCode);

      this.interactionKey.on('down', () => {
        if (this.nearbyPortal && this.isPromptVisible) {
          this.activatePortal(this.nearbyPortal);
        }
      });
    }
  }

  private createInteractionPrompt(): void {
    const container = this.scene.add.container(0, 0);
    container.setDepth(1000); // Ensure it's always on top
    container.setVisible(false);

    // Background
    const bg = this.scene.add.rectangle(0, 0, 150, 30, 0x000000, 0.7);
    bg.setStrokeStyle(2, 0xffffff, 0.8);

    // Text
    const text = this.scene.add.text(0, 0, '', this.config.promptStyle);
    text.setOrigin(0.5);

    container.add([bg, text]);

    this.interactionPrompt = container;
    this.promptBackground = bg;
    this.promptText = text;
  }

  /**
   * Register a new portal in the system
   */
  registerPortal(portal: Portal): void {
    const fullPortal: Portal = {
      ...portal,
      enabled: portal.enabled !== undefined ? portal.enabled : true,
      interactionRadius: portal.interactionRadius ?? this.config.defaultInteractionRadius,
    };

    this.portals.set(portal.id, fullPortal);

    // Create door sprite if needed
    if (portal.doorType !== 'exit') {
      this.createDoorSprite(fullPortal);
    }

    console.log(`[PortalSystem] Registered portal: ${portal.id}`);
    this.emit('portalRegistered', fullPortal);
  }

  /**
   * Remove a portal from the system
   */
  unregisterPortal(portalId: string): void {
    const portal = this.portals.get(portalId);
    if (!portal) return;

    // Clean up door sprite
    const doorSprite = this.doorSprites.get(portalId);
    if (doorSprite) {
      doorSprite.destroy();
      this.doorSprites.delete(portalId);
    }

    // Clean up animations
    const animation = this.doorAnimations.get(portalId);
    if (animation) {
      animation.remove();
      this.doorAnimations.delete(portalId);
    }

    this.portals.delete(portalId);
    this.openDoors.delete(portalId);

    console.log(`[PortalSystem] Unregistered portal: ${portalId}`);
    this.emit('portalUnregistered', portal);
  }

  /**
   * Create a visual representation of a door
   */
  private createDoorSprite(portal: Portal): void {
    // For now, create a simple colored rectangle to represent doors
    // In production, you would load actual door sprites/animations
    const color = this.getDoorColor(portal.doorType);
    const width = portal.doorType === 'building-entrance' ? 64 : 32;
    const height = portal.doorType === 'building-entrance' ? 80 : 48;

    const door = this.scene.add.rectangle(
      portal.position.x,
      portal.position.y,
      width,
      height,
      color
    );
    door.setStrokeStyle(2, 0x000000);
    door.setOrigin(0.5);
    door.setData('portalId', portal.id);

    // Add a label
    const label = this.scene.add.text(
      portal.position.x,
      portal.position.y - height / 2 - 10,
      portal.doorType === 'building-entrance' ? 'DOOR' : 'door',
      {
        fontSize: portal.doorType === 'building-entrance' ? '12px' : '10px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 2 },
      }
    );
    label.setOrigin(0.5);

    // Store as sprite (using rectangle for now)
    this.doorSprites.set(portal.id, door as any as Phaser.GameObjects.Sprite);
  }

  private getDoorColor(doorType: DoorType): number {
    switch (doorType) {
      case 'building-entrance':
        return 0x8b4513; // Brown for building entrance
      case 'room-door':
        return 0xa0522d; // Lighter brown for room doors
      case 'exit':
        return 0x228b22; // Green for exits
      default:
        return 0x808080;
    }
  }

  /**
   * Update the portal system - call this in your scene's update loop
   */
  update(playerX: number, playerY: number): void {
    // Check proximity to all portals
    const nearestPortal = this.checkProximity(playerX, playerY);

    if (nearestPortal !== this.nearbyPortal) {
      // Portal changed
      if (this.nearbyPortal) {
        this.hidePrompt();
        this.closeDoor(this.nearbyPortal.id);
      }

      this.nearbyPortal = nearestPortal;

      if (nearestPortal) {
        this.showPrompt(nearestPortal);
        this.openDoor(nearestPortal.id);
      }
    }

    // Update prompt position if visible
    if (this.isPromptVisible && this.nearbyPortal && this.interactionPrompt) {
      this.interactionPrompt.setPosition(
        this.nearbyPortal.position.x,
        this.nearbyPortal.position.y + this.config.promptOffsetY
      );
    }
  }

  /**
   * Check if player is near any portal
   */
  checkProximity(playerX: number, playerY: number): Portal | null {
    let nearestPortal: Portal | null = null;
    let nearestDistance = Infinity;

    this.portals.forEach((portal) => {
      if (!portal.enabled) return;

      const distance = Phaser.Math.Distance.Between(
        playerX,
        playerY,
        portal.position.x,
        portal.position.y
      );

      if (distance <= portal.interactionRadius! && distance < nearestDistance) {
        nearestDistance = distance;
        nearestPortal = portal;
      }
    });

    return nearestPortal;
  }

  /**
   * Show interaction prompt for a portal
   */
  showPrompt(portal: Portal): void {
    if (!this.interactionPrompt || !this.promptText) return;

    // Check if portal requires a key
    if (portal.requiresKey) {
      this.promptText.setText(`Press ${this.config.interactionKey} (Locked)`);
      this.promptText.setColor('#ff6b6b');
    } else {
      this.promptText.setText(`Press ${this.config.interactionKey} to Enter`);
      this.promptText.setColor('#ffffff');
    }

    // Resize background to fit text
    if (this.promptBackground) {
      const padding = 16;
      this.promptBackground.setSize(
        this.promptText.width + padding,
        this.promptText.height + padding
      );
    }

    this.interactionPrompt.setPosition(
      portal.position.x,
      portal.position.y + this.config.promptOffsetY
    );
    this.interactionPrompt.setVisible(true);
    this.isPromptVisible = true;

    this.emit('promptShown', portal);
  }

  /**
   * Hide interaction prompt
   */
  hidePrompt(): void {
    if (this.interactionPrompt) {
      this.interactionPrompt.setVisible(false);
      this.isPromptVisible = false;
      this.emit('promptHidden');
    }
  }

  /**
   * Open door animation
   */
  private openDoor(portalId: string): void {
    if (this.openDoors.has(portalId)) return;

    const door = this.doorSprites.get(portalId);
    if (!door) return;

    // Cancel any existing animation
    const existingAnim = this.doorAnimations.get(portalId);
    if (existingAnim) {
      existingAnim.remove();
    }

    // Animate door opening (fade out slightly and scale)
    const tween = this.scene.tweens.add({
      targets: door,
      alpha: 0.5,
      scaleX: 0.9,
      duration: 200,
      ease: 'Sine.easeOut',
    });

    this.doorAnimations.set(portalId, tween);
    this.openDoors.add(portalId);
    this.emit('doorOpened', portalId);
  }

  /**
   * Close door animation
   */
  private closeDoor(portalId: string): void {
    if (!this.openDoors.has(portalId)) return;

    const door = this.doorSprites.get(portalId);
    if (!door) return;

    // Cancel any existing animation
    const existingAnim = this.doorAnimations.get(portalId);
    if (existingAnim) {
      existingAnim.remove();
    }

    // Animate door closing
    const tween = this.scene.tweens.add({
      targets: door,
      alpha: 1,
      scaleX: 1,
      duration: 200,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.doorAnimations.delete(portalId);
      },
    });

    this.doorAnimations.set(portalId, tween);
    this.openDoors.delete(portalId);
    this.emit('doorClosed', portalId);
  }

  /**
   * Activate a portal (trigger transition)
   */
  activatePortal(portal: Portal): void {
    // Check if portal requires a key
    if (portal.requiresKey) {
      console.warn(`[PortalSystem] Portal ${portal.id} requires key: ${portal.requiresKey}`);
      this.emit('portalLocked', portal);
      return;
    }

    if (!portal.enabled) {
      console.warn(`[PortalSystem] Portal ${portal.id} is disabled`);
      return;
    }

    console.log(`[PortalSystem] Activating portal: ${portal.id}`);

    // Hide prompt immediately
    this.hidePrompt();

    // Emit activation event (scene will handle transition)
    this.emit('portalActivated', {
      portal,
      targetScene: portal.targetScene,
      targetPosition: portal.targetPosition,
      metadata: portal.metadata,
    });
  }

  /**
   * Enable or disable a portal
   */
  setPortalEnabled(portalId: string, enabled: boolean): void {
    const portal = this.portals.get(portalId);
    if (portal) {
      portal.enabled = enabled;

      const door = this.doorSprites.get(portalId);
      if (door) {
        door.setAlpha(enabled ? 1 : 0.5);
      }

      console.log(`[PortalSystem] Portal ${portalId} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get a portal by ID
   */
  getPortal(portalId: string): Portal | undefined {
    return this.portals.get(portalId);
  }

  /**
   * Get all registered portals
   */
  getAllPortals(): Portal[] {
    return Array.from(this.portals.values());
  }

  /**
   * Get portals by type
   */
  getPortalsByType(doorType: DoorType): Portal[] {
    return Array.from(this.portals.values()).filter((p) => p.doorType === doorType);
  }

  /**
   * Check if currently near any portal
   */
  isNearPortal(): boolean {
    return this.nearbyPortal !== null;
  }

  /**
   * Get the currently nearby portal
   */
  getNearbyPortal(): Portal | null {
    return this.nearbyPortal;
  }

  /**
   * Manually trigger portal activation by ID
   */
  triggerPortal(portalId: string): void {
    const portal = this.portals.get(portalId);
    if (portal) {
      this.activatePortal(portal);
    } else {
      console.warn(`[PortalSystem] Portal not found: ${portalId}`);
    }
  }

  /**
   * Update portal properties
   */
  updatePortal(portalId: string, updates: Partial<Portal>): void {
    const portal = this.portals.get(portalId);
    if (portal) {
      Object.assign(portal, updates);

      // Update door sprite position if changed
      if (updates.position) {
        const door = this.doorSprites.get(portalId);
        if (door) {
          door.setPosition(updates.position.x, updates.position.y);
        }
      }

      console.log(`[PortalSystem] Updated portal: ${portalId}`);
      this.emit('portalUpdated', portal);
    }
  }

  /**
   * Clean up the portal system
   */
  destroy(): void {
    // Remove all portals
    this.portals.forEach((_, id) => this.unregisterPortal(id));

    // Destroy prompt
    if (this.interactionPrompt) {
      this.interactionPrompt.destroy();
    }

    // Clean up keyboard
    if (this.interactionKey) {
      this.interactionKey.removeAllListeners();
    }

    // Clear state
    this.portals.clear();
    this.doorSprites.clear();
    this.doorAnimations.clear();
    this.openDoors.clear();

    this.removeAllListeners();

    console.log('[PortalSystem] Destroyed');
  }
}
