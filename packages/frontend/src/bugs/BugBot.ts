import Phaser from 'phaser';
import { alphaForProgress } from './progress';
import { AssetManager } from '../assets/AssetManager';
import {
  bugBotManifests,
  type CharacterManifest,
  type Direction4,
  type BugBotKey,
} from '../assets/pixellabManifest';

export type BugSeverity = 'low' | 'medium' | 'high';
export type BugBotVisualState = BugBotKey; // 'spawn' | 'assigned' | 'progress' | 'resolved'

const BUG_DIRECTION: Direction4 = 'south';

const SEVERITY_STYLE: Record<BugSeverity, { color: number; radius: number }> = {
  low: { color: 0x60a5fa, radius: 8 },
  medium: { color: 0xf59e0b, radius: 10 },
  high: { color: 0xef4444, radius: 12 },
};

const STATE_RING_COLOR: Record<BugBotVisualState, number> = {
  spawn: 0x93c5fd,
  assigned: 0xfbbf24,
  progress: 0x38bdf8,
  resolved: 0x22c55e,
};

const BUG_MANIFEST_MAP: Map<BugBotVisualState, CharacterManifest> = new Map(
  bugBotManifests.map((entry) => [entry.key as BugBotVisualState, entry]),
);

function getBugManifest(key: BugBotVisualState): CharacterManifest {
  return BUG_MANIFEST_MAP.get(key) ?? bugBotManifests[0];
}

export class BugBot extends Phaser.GameObjects.Container {
  public readonly id: string;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private pulse?: Phaser.Tweens.Tween;
  private pulseEnabled = false;
  private progress = 0; // 0..1 (monotonic)
  private readonly severityColor: number;
  private readonly radius: number;
  private ringAnim?: Phaser.Tweens.Tween;
  private ringAnimState = { p: 0 };
  private alphaTween?: Phaser.Tweens.Tween;
  private isHovered = false;
  private hoverHint?: Phaser.GameObjects.Text;
  private currentState: BugBotVisualState = 'spawn';
  private manifest: CharacterManifest;
  private progressStrokeColor: number = STATE_RING_COLOR.spawn;

  constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    severity: BugSeverity = 'low',
  ) {
    super(scene, x, y);
    this.id = id;

    const style = SEVERITY_STYLE[severity];
    this.severityColor = style.color;
    this.radius = style.radius;

    this.manifest = getBugManifest(this.currentState);
    const rotationKey = AssetManager.rotationTextureKey(this.manifest, BUG_DIRECTION);

    this.sprite = scene.add.sprite(0, 0, rotationKey);
    this.sprite.setOrigin(0.5);

    this.ring = scene.add.graphics();

    this.add([this.sprite, this.ring]);
    const minSize = Math.max(style.radius * 2 + 6, 44);
    this.setSize(minSize, minSize);
    this.setInteractive({ useHandCursor: true });

    this.playCurrentAnimation();
    this.drawRing(this.progress);

    // Pulse disabled by default; manager enables selectively for perf
    this.setPulse(false);

    // Click to request assignment (fallback to drag)
    this.on('pointerdown', () => {
      const { eventBus } = require('../realtime/EventBus');
      eventBus.emit('bug_bot_assign_request', { id: this.id });
    });

    this.on('pointerover', () => {
      this.isHovered = true;
      this.showHoverHint();
    });
    this.on('pointerout', () => {
      this.isHovered = false;
      this.hideHoverHint();
    });

    // Keyboard accessibility: when hovered, Enter/Space assigns the bug
    const kb = scene.input.keyboard;
    if (kb) {
      const handler = (ev: KeyboardEvent) => {
        if (!this.isHovered) return;
        if (ev.key === 'Enter' || ev.key === ' ') {
          const { eventBus } = require('../realtime/EventBus');
          eventBus.emit('bug_bot_assign_request', { id: this.id });
        }
      };
      kb.on('keydown', handler);
      this.once(Phaser.GameObjects.Events.DESTROY, () => kb.off('keydown', handler));
    }

    scene.add.existing(this);
  }

  setVisualState(next: BugBotVisualState) {
    if (this.currentState === next) return;
    this.currentState = next;
    const manifest = getBugManifest(next);
    if (!manifest) return;
    this.manifest = manifest;
    this.progressStrokeColor = STATE_RING_COLOR[next] ?? STATE_RING_COLOR.spawn;

    if (next === 'resolved') {
      this.stopAnimation();
      this.sprite.setAlpha(0.9);
    } else {
      this.sprite.setAlpha(1);
      this.playCurrentAnimation(true);
    }
    this.drawRing(this.progress);
  }

  setProgress(p: number) {
    const target = Phaser.Math.Clamp(p, 0, 1);
    if (target + 0.02 < this.progress) return; // ignore stale
    this.progress = Math.max(this.progress, target);

    if (this.progress > 0 && this.currentState !== 'progress' && this.currentState !== 'resolved') {
      this.setVisualState('progress');
    }

    const targetAlpha = alphaForProgress(this.progress);
    this.alphaTween?.stop();
    this.alphaTween = this.scene.tweens.add({
      targets: this,
      alpha: targetAlpha,
      duration: 120,
      ease: 'Linear',
    });

    const scale = 1 - this.progress * 0.1;
    this.sprite.setScale(scale);

    const end = this.progress;
    this.ringAnim?.stop();
    this.ringAnim = this.scene.tweens.add({
      targets: this.ringAnimState,
      p: end,
      duration: 120,
      ease: 'Linear',
      onUpdate: () => this.drawRing(this.ringAnimState.p),
      onComplete: () => this.drawRing(end),
    });
  }

  fadeOutAndDestroy(duration = 500) {
    this.setPulse(false);
    this.stopAnimation();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration,
      ease: 'Sine.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  setPulse(on: boolean) {
    if (on && !this.pulseEnabled) {
      this.pulse = this.scene.tweens.add({
        targets: this.sprite,
        duration: 800,
        scale: { from: 0.95, to: 1.05 },
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.pulseEnabled = true;
    } else if (!on && this.pulseEnabled) {
      this.pulse?.stop();
      this.sprite.setScale(1);
      this.pulse = undefined;
      this.pulseEnabled = false;
    }
  }

  pausePulse() {
    this.pulse?.pause();
  }

  resumePulse() {
    this.pulse?.resume();
  }

  setPulseTimeScale(scale: number) {
    if (this.pulse) this.pulse.timeScale = scale;
  }

  getHitRadius(): number {
    return this.radius + 2;
  }

  destroy(fromScene?: boolean) {
    this.pulse?.stop();
    this.alphaTween?.stop();
    this.ringAnim?.stop();
    this.hoverHint?.destroy();
    this.ring.destroy();
    this.sprite.destroy();
    super.destroy(fromScene);
  }

  private drawRing(progress: number) {
    const r = this.radius + 6;
    this.ring.clear();
    this.ring.lineStyle(2, this.severityColor, 0.65);
    this.ring.strokeCircle(0, 0, r);
    if (progress <= 0) return;
    this.ring.lineStyle(3, this.progressStrokeColor, 0.95);
    this.ring.beginPath();
    this.ring.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2, false);
    this.ring.strokePath();
  }

  private playCurrentAnimation(force = false) {
    const animKey = AssetManager.animationKey(this.manifest, BUG_DIRECTION);
    if (!animKey || !this.scene.anims.exists(animKey)) {
      this.refreshTexture();
      return;
    }
    if (!force && this.sprite.anims.currentAnim?.key === animKey) return;
    this.sprite.play(animKey);
  }

  private stopAnimation() {
    if (this.sprite.anims?.isPlaying) {
      this.sprite.stop();
    }
    this.refreshTexture();
  }

  private refreshTexture() {
    const rotationKey = AssetManager.rotationTextureKey(this.manifest, BUG_DIRECTION);
    this.sprite.setTexture(rotationKey);
  }

  private showHoverHint() {
    if (this.hoverHint) return;
    this.hoverHint = this.scene.add
      .text(0, -18, 'Assign (drag or Enter)', {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '9px',
        backgroundColor: 'rgba(11,18,32,0.9)',
      })
      .setOrigin(0.5);
    this.addAt(this.hoverHint, this.list.length);
  }

  private hideHoverHint() {
    this.hoverHint?.destroy();
    this.hoverHint = undefined;
  }
}
