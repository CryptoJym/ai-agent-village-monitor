import Phaser from 'phaser';
import { alphaForProgress } from './progress';
import { ensureBugTextures } from '../assets/bugTextures';

export type BugSeverity = 'low' | 'medium' | 'high';

const SEVERITY_STYLE: Record<BugSeverity, { color: number; radius: number }> = {
  low: { color: 0x60a5fa, radius: 8 },
  medium: { color: 0xf59e0b, radius: 10 },
  high: { color: 0xef4444, radius: 12 },
};

export class BugBot extends Phaser.GameObjects.Container {
  public readonly id: string;
  public readonly sprite: Phaser.GameObjects.Image;
  private pulse?: Phaser.Tweens.Tween;
  private pulseEnabled = false;
  private progress = 0; // 0..1 (monotonic)
  private readonly baseColor: number;
  private readonly radius: number;
  private readonly ring: Phaser.GameObjects.Graphics;
  private ringAnim?: Phaser.Tweens.Tween;
  private ringAnimState = { p: 0 };
  private alphaTween?: Phaser.Tweens.Tween;
  private isHovered = false;

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
    this.baseColor = style.color;
    this.radius = style.radius;
    ensureBugTextures(scene);
    const key = `bugtex_${severity}`;
    this.sprite = scene.add.image(0, 0, key);
    this.sprite.setOrigin(0.5);
    // Progress ring graphics (drawn above sprite)
    this.ring = scene.add.graphics();
    this.add([this.sprite, this.ring]);
    const minSize = Math.max(style.radius * 2 + 4, 44);
    this.setSize(minSize, minSize);
    this.setInteractive({ useHandCursor: true });

    // Pulse disabled by default; manager enables selectively for perf
    this.setPulse(false);

    // Click to request assignment (fallback to drag)
    this.on('pointerdown', () => {
       
      const { eventBus } = require('../realtime/EventBus');
      eventBus.emit('bug_bot_assign_request', { id: this.id });
    });

    // Tooltip hint + hover state for keyboard flow
    this.on('pointerover', () => {
      this.isHovered = true;
      const hint = scene.add
        .text(0, -18, 'Assign (drag or Enter)', {
          color: '#e2e8f0',
          fontFamily: 'monospace',
          fontSize: '9px',
          backgroundColor: 'rgba(11,18,32,0.9)',
        })
        .setOrigin(0.5);
      this.add(hint);
      this.once('pointerout', () => {
        this.isHovered = false;
        hint.destroy();
      });
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

  setProgress(p: number) {
    // Guard against out-of-order events; allow tiny backsteps for smoothing
    const target = Phaser.Math.Clamp(p, 0, 1);
    if (target + 0.02 < this.progress) return; // ignore stale
    this.progress = Math.max(this.progress, target);

    // Smoothly tween alpha from 1.0 at 0% to ~0.2 at 100%
    const targetAlpha = alphaForProgress(this.progress);
    this.alphaTween?.stop();
    this.alphaTween = this.scene.tweens.add({
      targets: this,
      alpha: targetAlpha,
      duration: 100,
      ease: 'Linear',
    });

    // Optional: subtle scale as proxy for progress (visual feedback without per-frame recolor)
    const s = 1 - this.progress * 0.1;
    this.sprite.setScale(s);

    // Animate progress ring to target
    const start = this.ringAnimState.p;
    const end = this.progress;
    this.ringAnim?.stop();
    this.ringAnim = this.scene.tweens.add({
      targets: this.ringAnimState,
      p: end,
      duration: 100,
      ease: 'Linear',
      onUpdate: () => this.drawRing(this.ringAnimState.p),
      onComplete: () => this.drawRing(end),
    });
  }

  private drawRing(p: number) {
    const r = this.radius + 6;
    this.ring.clear();
    // Background ring
    this.ring.lineStyle(2, 0x334155, 0.6);
    this.ring.strokeCircle(0, 0, r);
    // Foreground progress arc (start at top, clockwise)
    this.ring.lineStyle(3, 0x93c5fd, 0.95);
    this.ring.beginPath();
    this.ring.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2, false);
    this.ring.strokePath();
  }

  fadeOutAndDestroy(duration = 500) {
    this.scene.tweens.add({ targets: this, alpha: 0, duration, onComplete: () => this.destroy() });
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
}
