import Phaser from 'phaser';
import { AGENT_STATE_COLORS, type AgentConfig, type AgentState } from './types';
import { hashTint } from '../assets/AssetManager';

export class Agent extends Phaser.GameObjects.Container {
  public readonly nameText: Phaser.GameObjects.Text;
  private circle: Phaser.GameObjects.Arc;
  private ring: Phaser.GameObjects.Arc;
  private tooltip?: Phaser.GameObjects.Container;
  private contextMenu?: Phaser.GameObjects.Container;
  private dialog?: Phaser.GameObjects.Container;
  private currentState: AgentState = 'idle';

  constructor(scene: Phaser.Scene, x: number, y: number, config: AgentConfig) {
    super(scene, x, y);
    scene.add.existing(this);

    // Base body (agent)
    const tint = hashTint(config.name || 'agent');
    this.circle = scene.add.circle(0, 0, 14, tint);
    this.ring = scene.add.circle(0, 0, 18);
    this.ring.setStrokeStyle(3, AGENT_STATE_COLORS['idle'], 1);

    this.nameText = scene.add.text(0, 20, config.name, {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '10px',
    });
    this.nameText.setOrigin(0.5, 0);

    this.add([this.ring, this.circle, this.nameText]);
    this.setSize(36, 36);
    this.setAgentState(config.state ?? 'idle');

    // Interactions
    this.setInteractive(new Phaser.Geom.Circle(0, 0, 18), Phaser.Geom.Circle.Contains);
    this.scene.input.setDraggable(this);

    this.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      this.setPosition(dragX, dragY);
    });
    this.on('dragend', () => {
      // Emit a drop event for scene to handle assignment detection
      const { x, y } = this;

      const { eventBus } = require('../realtime/EventBus');
      eventBus.emit('agent_drop', { x, y });
    });

    this.on('pointerover', () => this.showTooltip());
    this.on('pointerout', () => this.hideTooltip());

    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.toggleContextMenu(pointer.worldX, pointer.worldY);
      } else {
        this.openDialog();
      }
    });
  }

  get agentState(): AgentState {
    return this.currentState;
  }

  setAgentState(next: AgentState) {
    if (this.currentState === next) return;
    this.currentState = next;
    // Update ring color
    const color = AGENT_STATE_COLORS[next];
    this.ring.setStrokeStyle(3, color, 1);

    // Stop all tweens related to this
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.circle);

    // Start animations per state
    switch (next) {
      case 'idle':
        this.scene.tweens.add({
          targets: this,
          y: this.y - 3,
          yoyo: true,
          duration: 800,
          repeat: -1,
          ease: 'sine.inOut',
        });
        break;
      case 'working':
        this.scene.tweens.add({
          targets: this.circle,
          scale: 1.1,
          yoyo: true,
          duration: 250,
          repeat: -1,
          ease: 'sine.inOut',
        });
        break;
      case 'debugging':
        this.scene.tweens.add({
          targets: this.ring,
          alpha: 0.4,
          yoyo: true,
          duration: 200,
          repeat: -1,
          ease: 'sine.inOut',
        });
        break;
      case 'error':
        this.scene.tweens.add({
          targets: this,
          x: this.x + 3,
          yoyo: true,
          duration: 80,
          repeat: -1,
          ease: 'sine.inOut',
        });
        break;
    }
  }

  walkTo(x: number, y: number) {
    // Simple linear walk tween
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      x,
      y,
      duration: Phaser.Math.Distance.Between(this.x, this.y, x, y) * 8,
      onComplete: () => {
        if (this.currentState === 'working') return;
        this.setAgentState('idle');
      },
    });
    this.setAgentState('working');
  }

  walkPath(points: { x: number; y: number }[]) {
    if (!points || points.length === 0) return;
    this.scene.tweens.killTweensOf(this);
    const segs = points.map((p) => ({ x: p.x, y: p.y }));
    const speed = 120; // px/s baseline
    const run = (i: number) => {
      if (i >= segs.length) {
        this.setState('idle');
        return;
      }
      const from = i === 0 ? { x: this.x, y: this.y } : segs[i - 1];
      const to = segs[i];
      const dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
      const duration = (dist / speed) * 1000;
      this.scene.tweens.add({
        targets: this,
        x: to.x,
        y: to.y,
        duration,
        onComplete: () => run(i + 1),
      });
    };
    this.setAgentState('working');
    run(1);
  }

  private showTooltip() {
    if (this.tooltip) return;
    const bg = this.scene.add.rectangle(0, -28, 110, 20, 0x0b1220, 0.9);
    bg.setStrokeStyle(1, 0x334155, 1);
    bg.setOrigin(0.5);
    const text = this.scene.add.text(0, -28, `${this.nameText.text} • ${this.currentState}`, {
      color: '#e2e8f0',
      fontFamily: 'monospace',
      fontSize: '10px',
    });
    text.setOrigin(0.5);
    this.tooltip = this.scene.add.container(0, 0, [bg, text]);
    this.add(this.tooltip);
  }

  private hideTooltip() {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = undefined;
    }
  }

  private toggleContextMenu(worldX: number, worldY: number) {
    // Close if open
    if (this.contextMenu) {
      this.contextMenu.destroy();
      this.contextMenu = undefined;
      return;
    }
    const scene = this.scene;
    const menu = scene.add.container(worldX, worldY);
    const bg = scene.add.rectangle(0, 0, 140, 80, 0x0f172a, 0.95).setOrigin(0);
    bg.setStrokeStyle(1, 0x334155, 1);
    const mkItem = (label: string, y: number, onClick: () => void) => {
      const t = scene.add.text(8, y, label, {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '12px',
      });
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        onClick();
        menu.destroy();
        this.contextMenu = undefined;
      });
      return t;
    };
    const i1 = mkItem('Start working', 6, () => this.setAgentState('working'));
    const i2 = mkItem('Start debugging', 26, () => this.setAgentState('debugging'));
    const i3 = mkItem('Stop (idle)', 46, () => this.setAgentState('idle'));
    menu.add([bg, i1, i2, i3]);
    scene.add.existing(menu);
    this.contextMenu = menu;
  }

  private openDialog() {
    if (this.dialog) return;
    const scene = this.scene;
    const overlay = scene.add.rectangle(
      scene.cameras.main.centerX,
      scene.cameras.main.centerY,
      scene.scale.width,
      scene.scale.height,
      0x000000,
      0.4,
    );
    overlay.setInteractive();

    const panel = scene.add.container(scene.cameras.main.centerX, scene.cameras.main.centerY);
    const bg = scene.add.rectangle(0, 0, 280, 160, 0x0f172a, 0.98).setOrigin(0.5);
    bg.setStrokeStyle(1, 0x334155, 1);
    const title = scene.add
      .text(0, -60, this.nameText.text, {
        color: '#e2e8f0',
        fontSize: '14px',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    const status = scene.add
      .text(0, -30, `status: ${this.currentState}`, {
        color: '#94a3b8',
        fontSize: '12px',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    const close = scene.add
      .text(0, 50, 'Close', { color: '#93c5fd', fontSize: '12px', fontFamily: 'monospace' })
      .setOrigin(0.5);
    close.setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
      this.dialog = undefined;
    });

    panel.add([bg, title, status, close]);
    scene.add.existing(panel);
    this.dialog = panel;

    overlay.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
      this.dialog = undefined;
    });
  }
}
