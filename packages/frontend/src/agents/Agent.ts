import Phaser from 'phaser';
import type { MainScene } from '../scenes/MainScene';
import { AGENT_STATE_COLORS, type AgentConfig, type AgentState } from './types';
import { AssetManager, hashTint } from '../assets/AssetManager';
import {
  findAgentManifest,
  getRandomAgentManifest,
  type CharacterManifest,
  type Direction8,
} from '../assets/pixellabManifest';
import { executeAction } from '../actions/ActionRegistry';

type PointerContainer = Phaser.GameObjects.Container;

type AgentIdentityUpdate = {
  id?: string;
  name?: string;
  archetype?: string;
};

const DIRECTION_ORDER: Direction8[] = [
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
  'north',
  'north-east',
];

const DEFAULT_DIRECTION: Direction8 = 'south';
const BASE_RING_RADIUS = 22;
const IDLE_FLOAT_OFFSET = 3;
const WALK_DURATION_PER_PIXEL_MS = 8;
const PATH_SPEED_PX_PER_S = 120;

function pickDirectionFromVector(dx: number, dy: number): Direction8 {
  if (dx === 0 && dy === 0) return DEFAULT_DIRECTION;
  const angle = Phaser.Math.Angle.WrapDegrees(Phaser.Math.RadToDeg(Math.atan2(dy, dx)));
  const index = ((Math.round(angle / 45) % 8) + 8) % 8;
  return DIRECTION_ORDER[index];
}

function logActionFailure(action: string, error: unknown) {
  if (typeof console !== 'undefined') {
    console.warn(`[Agent] ${action} action failed`, error);
  }
}

export class Agent extends Phaser.GameObjects.Container {
  public readonly nameText: Phaser.GameObjects.Text;
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private tooltip?: PointerContainer;
  private contextMenu?: PointerContainer;
  private dialog?: PointerContainer;
  private highlightTween?: Phaser.Tweens.Tween;
  private currentState: AgentState = 'idle';
  private currentDirection: Direction8 = DEFAULT_DIRECTION;
  private manifest: CharacterManifest;
  private agentId: string;
  private assignedHouseId?: string;

  constructor(scene: Phaser.Scene, x: number, y: number, config: AgentConfig) {
    super(scene, x, y);
    scene.add.existing(this);

    this.manifest = findAgentManifest(config.archetype ?? '') ?? getRandomAgentManifest();
    this.agentId = String(config.id ?? `agent-${Phaser.Math.RND.uuid().slice(0, 8)}`);
    this.currentDirection = config.direction ?? DEFAULT_DIRECTION;
    if (config.houseId) this.assignedHouseId = config.houseId;

    const tint = hashTint(String(config.id ?? config.name ?? this.agentId));
    const rotationKey = AssetManager.rotationTextureKey(this.manifest, this.currentDirection);

    this.sprite = scene.add.sprite(0, 0, rotationKey);
    this.sprite.setOrigin(0.5, 0.9);
    this.sprite.setTint(tint);

    this.ring = scene.add.circle(0, 6, BASE_RING_RADIUS, 0xffffff, 0);
    this.ring.setStrokeStyle(3, AGENT_STATE_COLORS['idle'], 1);

    this.nameText = scene.add.text(0, BASE_RING_RADIUS + 8, config.name ?? this.agentId, {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '10px',
    });
    this.nameText.setOrigin(0.5, 0);

    this.add([this.ring, this.sprite, this.nameText]);
    this.setSize(BASE_RING_RADIUS * 2 + 8, BASE_RING_RADIUS * 2 + 28);

    this.refreshTexture();
    this.setAgentState(config.state ?? 'idle');

    this.setInteractive(
      new Phaser.Geom.Circle(0, 6, BASE_RING_RADIUS),
      Phaser.Geom.Circle.Contains,
    );
    this.scene.input.setDraggable(this);

    this.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      this.stopAnimation();
      this.setPosition(dragX, dragY);
    });

    this.on('dragend', () => {
      const { x: currentX, y: currentY } = this;
      const { eventBus } = require('../realtime/EventBus');
      eventBus.emit('agent_drop', { x: currentX, y: currentY });
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

  get id(): string {
    return this.agentId;
  }

  get houseId(): string | undefined {
    return this.assignedHouseId;
  }

  setIdentity(next: AgentIdentityUpdate) {
    if (next.id && next.id !== this.agentId) {
      this.agentId = next.id;
      const tint = hashTint(String(next.id));
      this.sprite.setTint(tint);
    }
    if (typeof next.name === 'string' && next.name.length > 0) {
      this.nameText.setText(next.name);
    }
    if (typeof next.archetype === 'string') {
      this.setArchetype(next.archetype);
    }
  }

  setArchetype(archetype: string) {
    const manifest = findAgentManifest(archetype);
    if (!manifest) return;
    this.manifest = manifest;
    this.refreshTexture();
    if (this.currentState === 'working' || this.currentState === 'debugging') {
      this.playAnimation(this.currentDirection);
    }
  }

  setHouseAssignment(houseId?: string) {
    this.assignedHouseId = houseId;
    this.flashHighlight();
  }

  private flashHighlight() {
    this.highlightTween?.stop();
    this.highlightTween = this.scene.tweens.add({
      targets: this.ring,
      alpha: { from: 1, to: 0.2 },
      duration: 220,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.ring.setAlpha(1);
        this.highlightTween = undefined;
      },
    });
  }

  private refreshTexture() {
    const textureKey = AssetManager.rotationTextureKey(this.manifest, this.currentDirection);
    this.sprite.setTexture(textureKey);
  }

  private playAnimation(direction: Direction8) {
    if (!this.manifest.animation) return;
    const animKey = AssetManager.animationKey(this.manifest, direction);
    if (!animKey || !this.scene.anims.exists(animKey)) return;
    if (this.sprite.anims.currentAnim?.key === animKey) return;
    this.sprite.play(animKey);
  }

  private stopAnimation() {
    if (this.sprite.anims?.isPlaying) {
      this.sprite.stop();
    }
    this.refreshTexture();
  }

  setAgentState(next: AgentState) {
    if (this.currentState === next) return;
    this.currentState = next;

    const color = AGENT_STATE_COLORS[next];
    this.ring.setStrokeStyle(3, color, 1);

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.sprite);

    switch (next) {
      case 'idle':
        this.stopAnimation();
        this.sprite.setAlpha(1);
        this.scene.tweens.add({
          targets: this,
          y: this.y - IDLE_FLOAT_OFFSET,
          yoyo: true,
          duration: 800,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
      case 'working':
        this.sprite.setAlpha(1);
        this.playAnimation(this.currentDirection);
        break;
      case 'debugging':
        this.sprite.setAlpha(0.8);
        this.playAnimation(this.currentDirection);
        break;
      case 'error':
        this.sprite.setAlpha(1);
        this.stopAnimation();
        this.scene.tweens.add({
          targets: this,
          x: this.x + 3,
          yoyo: true,
          duration: 80,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
    }
  }

  walkTo(x: number, y: number) {
    const dx = x - this.x;
    const dy = y - this.y;
    const direction = pickDirectionFromVector(dx, dy);
    this.currentDirection = direction;
    this.refreshTexture();

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.sprite);

    if (this.currentState !== 'working') {
      this.setAgentState('working');
    } else {
      this.playAnimation(direction);
    }

    const distance = Phaser.Math.Distance.Between(this.x, this.y, x, y);
    const duration = distance * WALK_DURATION_PER_PIXEL_MS;

    this.scene.tweens.add({
      targets: this,
      x,
      y,
      duration,
      onComplete: () => {
        if (this.currentState !== 'working') {
          this.setAgentState('idle');
        } else {
          this.stopAnimation();
          this.playAnimation(direction);
        }
      },
    });
  }

  walkPath(points: { x: number; y: number }[]) {
    if (!points || points.length === 0) return;

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.sprite);

    const segments = points.map((p) => ({ x: p.x, y: p.y }));
    const first = segments[0];
    const initialDirection = pickDirectionFromVector(first.x - this.x, first.y - this.y);
    this.currentDirection = initialDirection;
    this.refreshTexture();

    if (this.currentState !== 'working') {
      this.setAgentState('working');
    } else {
      this.playAnimation(initialDirection);
    }

    const run = (index: number) => {
      if (index >= segments.length) {
        this.setAgentState('idle');
        return;
      }

      const from = index === 0 ? { x: this.x, y: this.y } : segments[index - 1];
      const to = segments[index];
      const direction = pickDirectionFromVector(to.x - from.x, to.y - from.y);
      this.currentDirection = direction;
      this.refreshTexture();
      this.playAnimation(direction);

      const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
      const duration = (distance / PATH_SPEED_PX_PER_S) * 1000;

      this.scene.tweens.add({
        targets: this,
        x: to.x,
        y: to.y,
        duration,
        onComplete: () => run(index + 1),
      });
    };

    run(0);
  }

  private showTooltip() {
    if (this.tooltip) return;

    const bg = this.scene.add.rectangle(0, -28, 160, 24, 0x0b1220, 0.9);
    bg.setStrokeStyle(1, 0x334155, 1);
    bg.setOrigin(0.5);

    const parts = [`${this.nameText.text}`, `${this.currentState}`];
    if (this.assignedHouseId) parts.push(`house: ${this.assignedHouseId}`);

    const text = this.scene.add.text(0, -28, parts.join(' • '), {
      color: '#e2e8f0',
      fontFamily: 'monospace',
      fontSize: '10px',
    });
    text.setOrigin(0.5);

    this.tooltip = this.scene.add.container(0, 0, [bg, text]);
    this.add(this.tooltip);
  }

  private hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.destroy();
    this.tooltip = undefined;
  }

  private toggleContextMenu(worldX: number, worldY: number) {
    if (this.contextMenu) {
      this.contextMenu.destroy();
      this.contextMenu = undefined;
      return;
    }

    const scene = this.scene;
    const menu = scene.add.container(worldX, worldY);

    const entries: Array<{ label: string; onClick: () => void; enabled?: boolean }> = [];
    const isIdle = this.currentState === 'idle';

    entries.push({
      label: isIdle ? 'Start Agent' : 'Stop Agent',
      onClick: () => {
        if (isIdle) {
          try {
            executeAction('startAgent', { agentId: this.agentId } as any);
          } catch (error) {
            logActionFailure('startAgent', error);
          }
          this.setAgentState('working');
        } else {
          try {
            executeAction('stopAgent', { agentId: this.agentId } as any);
          } catch (error) {
            logActionFailure('stopAgent', error);
          }
          this.setAgentState('idle');
        }
      },
    });

    entries.push({
      label: 'Run Recent Tool',
      onClick: () => {
        try {
          executeAction('runRecentTool', { agentId: this.agentId, toolId: 'last' } as any);
        } catch (error) {
          logActionFailure('runRecentTool', error);
        }
      },
    });

    entries.push({
      label: "Go to Agent's House",
      enabled: !!this.assignedHouseId,
      onClick: () => this.assignedHouseId && this.focusOnHouse(this.assignedHouseId),
    });

    if (this.assignedHouseId) {
      entries.push({
        label: 'Open House Dashboard',
        onClick: () => this.openHouseDashboard(this.assignedHouseId!),
      });
    }

    entries.push({
      label: 'Assign to House…',
      onClick: () => this.requestAssignToHouse(),
    });

    const height = entries.length * 24 + 16;
    const bg = scene.add.rectangle(0, 0, 180, height, 0x0f172a, 0.95).setOrigin(0);
    bg.setStrokeStyle(1, 0x334155, 1);
    menu.add(bg);

    entries.forEach((entry, idx) => {
      const y = 8 + idx * 24;
      const label = scene.add.text(10, y, entry.label, {
        color: entry.enabled === false ? '#475569' : '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '12px',
      });

      if (entry.enabled !== false) {
        label.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          entry.onClick();
          menu.destroy();
          this.contextMenu = undefined;
        });
      }

      menu.add(label);
    });

    scene.add.existing(menu);
    this.contextMenu = menu;
  }

  private focusOnHouse(houseId: string) {
    const scene = this.scene as MainScene;
    if (scene && typeof scene.focusHouseById === 'function') {
      scene.focusHouseById(houseId, { agentId: this.agentId });
    } else {
      try {
        executeAction('navigateToHouse', { houseId } as any);
      } catch (error) {
        logActionFailure('navigateToHouse', error);
      }
    }
  }

  private openHouseDashboard(houseId: string) {
    const scene = this.scene as MainScene;
    if (scene && typeof scene.openHouseDashboard === 'function') {
      scene.openHouseDashboard(houseId, { source: 'agent_context' });
    } else {
      executeAction('openHouseDashboard', { houseId } as any);
    }
  }

  private requestAssignToHouse() {
    const scene = this.scene as MainScene;
    if (scene && typeof scene.promptAgentHouseAssignment === 'function') {
      scene.promptAgentHouseAssignment(this);
    }
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
