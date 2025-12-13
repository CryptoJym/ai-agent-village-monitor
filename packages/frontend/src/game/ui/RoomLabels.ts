import Phaser from 'phaser';

export interface RoomData {
  id: string;
  name: string;
  centerX: number;
  centerY: number;
  bounds?: Phaser.Geom.Rectangle;
  type?: string;
  description?: string;
  moduleInfo?: {
    agents: number;
    capacity: number;
    status: 'active' | 'idle' | 'offline';
  };
}

export interface RoomLabelConfig {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  padding?: { x: number; y: number };
  offsetY?: number;
  fadeDistance?: number;
  tooltipDelay?: number;
}

export interface RoomLabel {
  room: RoomData;
  text: Phaser.GameObjects.Text;
  visible: boolean;
  alpha: number;
}

/**
 * RoomLabelSystem - Room label and tooltip system
 *
 * Features:
 * - Floating text labels for room names
 * - Auto-positioning above room center
 * - Fade in/out based on camera proximity
 * - Module info tooltip on hover
 * - Configurable appearance and behavior
 */
export class RoomLabelSystem {
  private scene: Phaser.Scene;
  private labels: Map<string, RoomLabel> = new Map();
  private config: Required<RoomLabelConfig>;
  private tooltip?: Phaser.GameObjects.Container;
  private tooltipTimer?: Phaser.Time.TimerEvent;
  private currentHoverRoom?: string;

  constructor(scene: Phaser.Scene, config: RoomLabelConfig = {}) {
    this.scene = scene;

    // Apply default configuration
    this.config = {
      fontSize: config.fontSize ?? 14,
      fontFamily: config.fontFamily ?? 'Arial, sans-serif',
      color: config.color ?? '#ffffff',
      backgroundColor: config.backgroundColor ?? '#000000aa',
      padding: config.padding ?? { x: 8, y: 4 },
      offsetY: config.offsetY ?? -20,
      fadeDistance: config.fadeDistance ?? 300,
      tooltipDelay: config.tooltipDelay ?? 500,
    };
  }

  /**
   * Create labels for multiple rooms
   */
  createLabels(rooms: RoomData[]): void {
    rooms.forEach((room) => this.createLabel(room));
    console.log(`[RoomLabelSystem] Created ${rooms.length} room labels`);
  }

  /**
   * Create a label for a single room
   */
  createLabel(room: RoomData): Phaser.GameObjects.Text {
    // Check if label already exists
    if (this.labels.has(room.id)) {
      console.warn(`[RoomLabelSystem] Label for room '${room.id}' already exists`);
      return this.labels.get(room.id)!.text;
    }

    // Create text object
    const text = this.scene.add.text(
      room.centerX,
      room.centerY + this.config.offsetY,
      room.name,
      {
        fontSize: `${this.config.fontSize}px`,
        fontFamily: this.config.fontFamily,
        color: this.config.color,
        backgroundColor: this.config.backgroundColor,
        padding: this.config.padding,
      }
    );

    text.setOrigin(0.5, 0.5);
    text.setDepth(100); // High depth to appear above most objects

    // Make interactive for hover
    text.setInteractive({ useHandCursor: true });

    // Setup hover events
    text.on('pointerover', () => this.onRoomHover(room.id));
    text.on('pointerout', () => this.onRoomHoverEnd());
    text.on('pointerdown', () => this.onRoomClick(room.id));

    // Store label
    const label: RoomLabel = {
      room,
      text,
      visible: true,
      alpha: 1.0,
    };

    this.labels.set(room.id, label);

    return text;
  }

  /**
   * Update label visibility based on camera position and zoom
   */
  updateVisibility(cameraX: number, cameraY: number, zoom: number): void {
    this.labels.forEach((label) => {
      const distance = Phaser.Math.Distance.Between(
        cameraX,
        cameraY,
        label.room.centerX,
        label.room.centerY
      );

      // Calculate fade based on distance
      const fadeDistance = this.config.fadeDistance / zoom;
      let alpha = 1.0;

      if (distance > fadeDistance) {
        alpha = Math.max(0, 1 - (distance - fadeDistance) / fadeDistance);
      }

      // Scale based on zoom (larger when zoomed in)
      const scale = Math.min(1.5, Math.max(0.7, zoom));
      label.text.setScale(scale);

      // Update alpha
      label.alpha = alpha;
      label.text.setAlpha(alpha);

      // Update visibility
      label.visible = alpha > 0.1;
      label.text.setVisible(label.visible);
    });
  }

  /**
   * Update a label's text
   */
  updateLabel(roomId: string, newText: string): void {
    const label = this.labels.get(roomId);
    if (label) {
      label.text.setText(newText);
      label.room.name = newText;
    }
  }

  /**
   * Update a label's position
   */
  updateLabelPosition(roomId: string, x: number, y: number): void {
    const label = this.labels.get(roomId);
    if (label) {
      label.text.setPosition(x, y + this.config.offsetY);
      label.room.centerX = x;
      label.room.centerY = y;
    }
  }

  /**
   * Show tooltip for a room
   */
  showTooltip(roomId: string): void {
    const label = this.labels.get(roomId);
    if (!label || !label.room.moduleInfo) {
      return;
    }

    // Destroy existing tooltip
    this.hideTooltip();

    const room = label.room;
    const info = room.moduleInfo!; // Safe: early return above ensures moduleInfo exists

    // Create tooltip container
    this.tooltip = this.scene.add.container(room.centerX, room.centerY - 60);
    this.tooltip.setDepth(200);

    // Create background
    const tooltipWidth = 200;
    const tooltipHeight = 100;
    const bg = this.scene.add.rectangle(0, 0, tooltipWidth, tooltipHeight, 0x1a1a1a, 0.95);
    bg.setStrokeStyle(2, 0x60a5fa);

    // Create text content
    const statusColor = this.getStatusColor(info.status);
    const content = [
      room.name,
      '',
      `Status: ${info.status.toUpperCase()}`,
      `Agents: ${info.agents}/${info.capacity}`,
      room.description || '',
    ]
      .filter((line) => line !== '')
      .join('\n');

    const text = this.scene.add.text(0, 0, content, {
      fontSize: '12px',
      fontFamily: this.config.fontFamily,
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: tooltipWidth - 20 },
    });
    text.setOrigin(0.5, 0.5);

    // Add status indicator
    const statusIndicator = this.scene.add.circle(-tooltipWidth / 2 + 15, -tooltipHeight / 2 + 15, 6, statusColor);

    // Add to container
    this.tooltip.add([bg, text, statusIndicator]);

    // Fade in animation
    this.tooltip.setAlpha(0);
    this.scene.tweens.add({
      targets: this.tooltip,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
    });

    console.log(`[RoomLabelSystem] Showing tooltip for room: ${roomId}`);
  }

  /**
   * Hide tooltip
   */
  hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = undefined;
    }

    if (this.tooltipTimer) {
      this.tooltipTimer.remove();
      this.tooltipTimer = undefined;
    }
  }

  /**
   * Handle room hover
   */
  private onRoomHover(roomId: string): void {
    this.currentHoverRoom = roomId;

    // Highlight label
    const label = this.labels.get(roomId);
    if (label) {
      label.text.setStyle({ backgroundColor: '#60a5faaa' });
    }

    // Show tooltip after delay
    this.tooltipTimer = this.scene.time.delayedCall(this.config.tooltipDelay, () => {
      if (this.currentHoverRoom === roomId) {
        this.showTooltip(roomId);
      }
    });
  }

  /**
   * Handle room hover end
   */
  private onRoomHoverEnd(): void {
    const roomId = this.currentHoverRoom;
    this.currentHoverRoom = undefined;

    // Restore label style
    if (roomId) {
      const label = this.labels.get(roomId);
      if (label) {
        label.text.setStyle({ backgroundColor: this.config.backgroundColor });
      }
    }

    // Hide tooltip
    this.hideTooltip();
  }

  /**
   * Handle room click
   */
  private onRoomClick(roomId: string): void {
    const label = this.labels.get(roomId);
    if (label) {
      // Emit event for other systems to handle
      this.scene.events.emit('roomClicked', { roomId, room: label.room });
      console.log(`[RoomLabelSystem] Room clicked: ${roomId}`);
    }
  }

  /**
   * Get color for status indicator
   */
  private getStatusColor(status: 'active' | 'idle' | 'offline'): number {
    switch (status) {
      case 'active':
        return 0x22c55e; // Green
      case 'idle':
        return 0xfbbf24; // Yellow
      case 'offline':
        return 0xef4444; // Red
      default:
        return 0x6b7280; // Gray
    }
  }

  /**
   * Remove a label
   */
  removeLabel(roomId: string): void {
    const label = this.labels.get(roomId);
    if (label) {
      label.text.destroy();
      this.labels.delete(roomId);
      console.log(`[RoomLabelSystem] Removed label for room: ${roomId}`);
    }

    // Hide tooltip if it was for this room
    if (this.currentHoverRoom === roomId) {
      this.hideTooltip();
    }
  }

  /**
   * Clear all labels
   */
  clearLabels(): void {
    this.labels.forEach((label) => {
      label.text.destroy();
    });
    this.labels.clear();
    this.hideTooltip();
    console.log('[RoomLabelSystem] Cleared all labels');
  }

  /**
   * Get label for a room
   */
  getLabel(roomId: string): RoomLabel | undefined {
    return this.labels.get(roomId);
  }

  /**
   * Get all labels
   */
  getAllLabels(): RoomLabel[] {
    return Array.from(this.labels.values());
  }

  /**
   * Update room module info
   */
  updateRoomInfo(roomId: string, moduleInfo: RoomData['moduleInfo']): void {
    const label = this.labels.get(roomId);
    if (label) {
      label.room.moduleInfo = moduleInfo;

      // Update tooltip if currently showing
      if (this.currentHoverRoom === roomId && this.tooltip) {
        this.showTooltip(roomId);
      }
    }
  }

  /**
   * Set label visibility
   */
  setLabelVisible(roomId: string, visible: boolean): void {
    const label = this.labels.get(roomId);
    if (label) {
      label.visible = visible;
      label.text.setVisible(visible);
    }
  }

  /**
   * Set all labels visible/invisible
   */
  setAllLabelsVisible(visible: boolean): void {
    this.labels.forEach((label) => {
      label.visible = visible;
      label.text.setVisible(visible);
    });
  }

  /**
   * Get label count
   */
  getLabelCount(): number {
    return this.labels.size;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clearLabels();
    this.hideTooltip();
    console.log('[RoomLabelSystem] Destroyed label system');
  }
}
