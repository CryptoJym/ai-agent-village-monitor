// Lazy require phaser at runtime to cooperate with test mocks
 
const PhaserLib = require('phaser').default as typeof import('phaser');
import { AssetManager } from '../assets/AssetManager';

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
  private smoke?: Phaser.GameObjects.Arc;
  private tooltip?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, props: HouseProps) {
    super(scene, x, y);
    this.id = props.id;
    this.name = props.name;
    this.language = props.language;

    const tex = AssetManager.getHouseTextureKey(props.language || 'js');
    this.sprite = scene.add.image(0, 0, tex).setOrigin(0.5, 1);
    this.sprite.setDisplaySize(54, 40);
    this.label = scene.add
      .text(0, 4, props.name, {
        color: '#cbd5e1',
        fontFamily: 'monospace',
        fontSize: '10px',
        align: 'center',
      })
      .setOrigin(0.5, 0);
    this.add([this.sprite, this.label]);

    // Optional window light overlay (small yellow rect)
    this.windowLight = scene.add.rectangle(-8, -18, 10, 8, 0xfde68a, 0.0).setOrigin(0.5, 0.5);
    this.add(this.windowLight);

    // Interactivity
    this.setSize(60, 60);
    this.setInteractive({
      useHandCursor: true,
      pixelPerfect: false,
      hitArea: new PhaserLib.Geom.Rectangle(-30, -40, 60, 60),
      hitAreaCallback: PhaserLib.Geom.Rectangle.Contains,
    });
    this.on('pointerover', () => this.showTooltip(props));
    this.on('pointerout', () => this.hideTooltip());
  }

  onClickZoom(panTo: (x: number, y: number) => void) {
    this.on('pointerdown', () => panTo(this.x, this.y));
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

  setHealth(issues: number) {
    // If many issues, tint sprite slightly red as scaffolded indicator
    if (issues >= 10) {
      this.sprite.setTint(0xfca5a5);
    } else {
      this.sprite.clearTint();
    }
  }

  private showTooltip(props: HouseProps) {
    if (this.tooltip) return;
    const text = `${props.name}\n★ ${props.stars ?? 0} • ${props.language}${typeof props.issues === 'number' ? ` • ${props.issues} issues` : ''}`;
    const box = this.scene.add
      .text(0, -54, text, {
        color: '#e5e7eb',
        fontFamily: 'monospace',
        fontSize: '10px',
        backgroundColor: 'rgba(15,23,42,0.9)',
      })
      .setOrigin(0.5, 1);
    this.tooltip = this.scene.add.container(0, 0, [box]);
    this.add(this.tooltip);
  }

  private hideTooltip() {
    if (this.tooltip) {
      this.tooltip.destroy(true);
      this.tooltip = undefined;
    }
  }
}
