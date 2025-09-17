// Import Phaser; vitest maps 'phaser' to a stub via alias in tests
import PhaserLib from 'phaser';
import { AssetManager } from '../assets/AssetManager';
import { getLanguageStyle } from './styles';
import { eventBus } from '../realtime/EventBus';

export type HouseProps = {
  id: string;
  name: string;
  language: string;
  stars?: number;
  issues?: number;
  buildStatus?: 'idle' | 'building' | 'failed' | 'passed';
};

export class House extends PhaserLib.GameObjects.Container {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  private label: Phaser.GameObjects.Text;
  private sprite: Phaser.GameObjects.Image;
  private windowLight?: Phaser.GameObjects.Rectangle;
  private scaffold?: Phaser.GameObjects.Graphics;
  private accent?: Phaser.GameObjects.Rectangle;
  private smokeColor: number = 0xe5e7eb;
  private smokeTimer?: Phaser.Time.TimerEvent;
  private lightsTween?: Phaser.Tweens.Tween;
  private banner?: Phaser.GameObjects.Container;
  private tooltip?: Phaser.GameObjects.Container;
  private tooltipTimer?: Phaser.Time.TimerEvent;
  private lastCommitFlashAt?: number;

  constructor(scene: Phaser.Scene, x: number, y: number, props: HouseProps) {
    super(scene, x, y);
    this.id = props.id;
    this.name = props.name;
    this.language = props.language;

    const tex = AssetManager.getHouseTextureKey(props.language || 'js');
    this.sprite = scene.add.image(0, 0, tex).setOrigin(0.5, 1);
    this.sprite.setDisplaySize(54, 40);
    this.label = scene.add
      .text(0, 4, this.ellipsis(props.name, 16), {
        color: '#cbd5e1',
        fontFamily: 'monospace',
        fontSize: '10px',
        align: 'center',
      })
      .setOrigin(0.5, 0);
    // Accent banner (language-based styling)
    this.accent = scene.add.rectangle(0, -30, 22, 3, 0x64748b, 1).setOrigin(0.5, 0.5);
    this.add([this.sprite, this.accent, this.label]);

    // Optional window light overlay (small yellow rect)
    this.windowLight = scene.add.rectangle(-8, -18, 10, 8, 0xfde68a, 0.0).setOrigin(0.5, 0.5);
    this.add(this.windowLight);

    // Scaffolding overlay (health indicator)
    this.scaffold = scene.add.graphics();
    this.scaffold.setAlpha(0);
    this.drawScaffold(this.scaffold);
    this.add(this.scaffold);

    // Interactivity
    this.setSize(60, 60);
    this.setInteractive({
      useHandCursor: true,
      pixelPerfect: false,
      hitArea: new PhaserLib.Geom.Rectangle(-30, -40, 60, 60),
      hitAreaCallback: PhaserLib.Geom.Rectangle.Contains,
    });
    this.on('pointerover', (p: Phaser.Input.Pointer) => this.showTooltip(props, p));
    this.on('pointerout', () => this.hideTooltip());

    // Initial language styling
    this.applyLanguageStyle(props.language);
  }

  onClickZoom(panTo: (x: number, y: number) => void) {
    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const isRightClick =
        pointer && typeof pointer.rightButtonDown === 'function' && pointer.rightButtonDown();
      if (isRightClick) {
        eventBus.emit('house_dashboard_request', { houseId: this.id, source: 'right_click' });
        return;
      }
      panTo(this.x, this.y);
    });
    return this;
  }

  triggerCommitFlash(duration = 600) {
    if (!this.windowLight) return;
    this.scene.tweens.add({
      targets: this.windowLight,
      alpha: { from: 0.0, to: 1.0 },
      yoyo: true,
      duration,
    });
  }

  triggerBuildSmoke(duration = 800) {
    // Small puff moving up and fading out
    const s = this.scene.add.circle(10, -24, 3, 0xe5e7eb, 0.8);
    this.add(s);
    this.scene.tweens.add({
      targets: s,
      y: '-=16',
      alpha: 0,
      duration,
      onComplete: () => s.destroy(),
    });
  }

  setLightsActive(on: boolean) {
    if (!this.windowLight) return;
    if (on) {
      this.windowLight.setAlpha(0.8);
      if (!this.lightsTween) {
        this.lightsTween = this.scene.tweens.add({
          targets: this.windowLight,
          alpha: { from: 0.3, to: 1.0 },
          yoyo: true,
          duration: 600,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    } else {
      if (this.lightsTween) {
        this.lightsTween.stop();
        this.lightsTween = undefined;
      }
      this.windowLight.setAlpha(0);
    }
  }

  setBannerActive(on: boolean, prNumber?: number) {
    if (on) {
      if (!this.banner) {
        const bg = this.scene.add.rectangle(0, -52, 38, 10, 0x0b1220, 0.95).setOrigin(0.5, 1);
        bg.setStrokeStyle(1, 0x334155, 1);
        const label = this.scene.add
          .text(0, -56, prNumber ? `PR #${prNumber}` : 'PR Open', {
            color: '#e5e7eb',
            fontFamily: 'monospace',
            fontSize: '9px',
            align: 'center',
          })
          .setOrigin(0.5, 1);
        this.banner = this.scene.add.container(0, 0, [bg, label]);
        this.banner.setDepth(1000);
        this.banner.setAlpha(0);
        this.add(this.banner);
        this.scene.tweens.add({
          targets: this.banner,
          alpha: 1,
          duration: 180,
          ease: 'Sine.easeOut',
        });
      } else {
        // update text if present
        const t = this.banner.list.find((c: any) => typeof c.setText === 'function');
        (t as any)?.setText(prNumber ? `PR #${prNumber}` : 'PR Open');
      }
    } else {
      if (this.banner) {
        const bn = this.banner;
        this.scene.tweens.add({
          targets: bn,
          alpha: 0,
          duration: 160,
          ease: 'Sine.easeIn',
          onComplete: () => {
            bn.destroy();
            if (this.banner === bn) this.banner = undefined;
          },
        });
      }
    }
  }

  startSmoke(kind: 'building' | 'failed' | 'passed' = 'building') {
    const color = kind === 'passed' ? 0x86efac : kind === 'failed' ? 0xfca5a5 : 0xe5e7eb;
    this.smokeColor = color;
    if (this.smokeTimer) return; // already running
    if (this.scene.time && typeof this.scene.time.addEvent === 'function') {
      this.smokeTimer = this.scene.time.addEvent({
        delay: 600,
        loop: true,
        callback: () => {
          const s = this.scene.add.circle(10, -24, 3, color, 0.9);
          this.add(s);
          this.scene.tweens.add({
            targets: s,
            y: '-=18',
            alpha: 0,
            duration: 900,
            ease: 'Sine.easeOut',
            onComplete: () => s.destroy(),
          });
        },
      });
    } else {
      // Fallback: single puff
      const s = this.scene.add.circle(10, -24, 3, color, 0.9);
      this.add(s);
      this.scene.tweens.add({
        targets: s,
        y: '-=18',
        alpha: 0,
        duration: 900,
        onComplete: () => s.destroy(),
      });
    }
  }

  stopSmoke() {
    if (this.smokeTimer) {
      this.smokeTimer.remove(false);
      this.smokeTimer = undefined;
    }
  }

  setHealth(issues: number) {
    // If many issues, tint sprite slightly red as scaffolded indicator
    if (issues >= 10) {
      this.sprite.setTint(0xfca5a5);
    } else {
      this.sprite.clearTint();
    }
  }

  pulseHighlight() {
    const baseRadius = 42;
    const ring = this.scene.add.circle(0, -18, baseRadius, 0x38bdf8, 0.18).setOrigin(0.5, 1);
    this.addAt(ring, 0);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 0.8, to: 1.35 },
      alpha: { from: 0.6, to: 0 },
      duration: 360,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private showTooltip(props: HouseProps, pointer?: Phaser.Input.Pointer) {
    if (this.tooltip || this.tooltipTimer) return;
    const show = () => {
      const text = `${props.name}\n★ ${props.stars ?? 0} • ${props.language}${
        typeof props.issues === 'number' ? ` • ${props.issues} issues` : ''
      }`;
      const box = this.scene.add
        .text(0, -54, text, {
          color: '#e5e7eb',
          fontFamily: 'monospace',
          fontSize: '10px',
          backgroundColor: 'rgba(15,23,42,0.9)',
        })
        .setOrigin(0.5, 1);
      this.tooltip = this.scene.add.container(0, 0, [box]);
      this.tooltip.setDepth(10000);
      this.add(this.tooltip);
      // Follow pointer if available
      if (pointer) {
        const move = (p: Phaser.Input.Pointer) => {
          const localX = p.worldX - this.x;
          const localY = p.worldY - this.y;
          const clampedX = PhaserLib.Math.Clamp(localX, -40, 40);
          const clampedY = PhaserLib.Math.Clamp(localY - 24, -80, -20);
          this.tooltip?.setPosition(clampedX, clampedY);
        };
        move(pointer);
        this.on('pointermove', move);
        this.once('pointerout', () => this.off('pointermove', move));
      }
    };
    if (this.scene.time && typeof this.scene.time.delayedCall === 'function') {
      this.tooltipTimer = this.scene.time.delayedCall(120, () => {
        this.tooltipTimer = undefined;
        show();
      });
    } else {
      show();
    }
  }

  private hideTooltip() {
    if (this.tooltip) {
      this.tooltip.destroy(true);
      this.tooltip = undefined;
    }
    if (this.tooltipTimer) {
      this.tooltipTimer.remove(false);
      this.tooltipTimer = undefined;
    }
  }

  private drawScaffold(g: Phaser.GameObjects.Graphics) {
    g.clear();
    g.lineStyle(1, 0xf87171, 1);
    const topY = -40;
    const bottomY = 0;
    const leftX = -27;
    const rightX = 27;
    // verticals
    for (let x = leftX; x <= rightX; x += 9) {
      g.lineBetween(x, topY, x, bottomY);
    }
    // horizontals
    for (let y = topY; y <= bottomY; y += 8) {
      g.lineBetween(leftX, y, rightX, y);
    }
  }

  setScaffoldingSeverity(sev: 'none' | 'low' | 'med' | 'high') {
    const a = sev === 'none' ? 0 : sev === 'low' ? 0.25 : sev === 'med' ? 0.45 : 0.65;
    this.scaffold?.setAlpha(a);
  }

  setLabel(name: string) {
    this.label.setText(this.ellipsis(name, 16));
  }

  applyLanguageStyle(lang: string) {
    const style = getLanguageStyle(lang);
    if (style.labelColor) this.label.setColor(style.labelColor);
    if (style.accentColor && this.accent) this.accent.setFillStyle(style.accentColor, 1);
  }

  private ellipsis(s: string, max = 16) {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  applyActivityIndicators(ind: {
    lights?: { active: boolean };
    banner?: { active: boolean; prNumber?: number };
    smoke?: { active: boolean; status?: 'in_progress' | 'failed' | 'passed' };
  }) {
    if (ind.lights) this.setLightsActive(!!ind.lights.active);
    if (ind.banner) this.setBannerActive(!!ind.banner.active, ind.banner.prNumber);
    if (ind.smoke) {
      if (ind.smoke.active) {
        const st = ind.smoke.status || 'in_progress';
        if (st === 'in_progress') this.startSmoke('building');
        else if (st === 'passed') {
          this.startSmoke('passed');
          this.stopSmoke();
        } else {
          this.startSmoke('failed');
          this.stopSmoke();
        }
      } else {
        this.stopSmoke();
      }
    }
  }
}
