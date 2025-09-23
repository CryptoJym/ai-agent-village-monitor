import Phaser from 'phaser';
import type { CharacterManifest, Direction8 } from '../assets/pixellabManifest';
import { AssetManager } from '../assets/AssetManager';

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

function pickDirection(dx: number, dy: number): Direction8 {
  if (dx === 0 && dy === 0) return 'south';
  const angle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
  const index = ((Math.round(angle / 45) % 8) + 8) % 8;
  return DIRECTION_ORDER[index];
}

export type NpcState = 'idle' | 'wandering' | 'working' | 'talking';

export interface NpcSpriteConfig {
  id: string;
  name: string;
  manifest: CharacterManifest;
  tint?: number;
  ringColor?: number;
}

const RawContainer = (Phaser as any)?.GameObjects?.Container;
const BaseContainer = RawContainer
  ? RawContainer
  : (class {
      scene: Phaser.Scene;
      x: number;
      y: number;
      constructor(scene: Phaser.Scene, x = 0, y = 0) {
        this.scene = scene;
        this.x = x;
        this.y = y;
      }
      add() {
        return this;
      }
      addAt() {
        return this;
      }
      setDepth() {
        return this;
      }
      setVisible() {
        return this;
      }
      destroy() {}
    } as unknown as typeof Phaser.GameObjects.Container);

export class NpcSprite extends BaseContainer {
  readonly npcId: string;
  private state: NpcState = 'idle';
  private direction: Direction8 = 'south';
  private sprite: Phaser.GameObjects.Sprite;
  private nameLabel?: Phaser.GameObjects.Text;
  private ring?: Phaser.GameObjects.Arc;
  private manifest: CharacterManifest;
  private currentTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, config: NpcSpriteConfig) {
    super(scene, x, y);
    this.npcId = config.id;
    this.manifest = config.manifest;

    const rotationKey = AssetManager.rotationTextureKey(this.manifest, this.direction);
    this.sprite = scene.add.sprite(0, 0, rotationKey).setOrigin(0.5, 0.9);
    if (config.tint != null) {
      this.sprite.setTint(config.tint);
    }

    this.add(this.sprite);

    if (scene.scale.width > 720) {
      this.nameLabel = scene.add
        .text(0, 24, config.name, {
          color: '#cbd5e1',
          fontFamily: 'monospace',
          fontSize: '9px',
        })
        .setOrigin(0.5, 0);
      this.add(this.nameLabel);
    }

    this.ring = scene.add
      .arc(0, 8, 18, 0, 360, false, config.ringColor ?? 0x64748b, 0)
      .setStrokeStyle(2, config.ringColor ?? 0x64748b, 0.9)
      .setOrigin(0.5, 0.5);
    this.addAt(this.ring, 0);

    scene.add.existing(this);
  }

  setState(next: NpcState) {
    if (this.state === next) return;
    this.state = next;
    if (next === 'idle' || next === 'talking') {
      this.stopAnimation();
      if (next === 'talking') {
        this.scene.tweens.add({
          targets: this.sprite,
          alpha: { from: 0.95, to: 0.7 },
          duration: 320,
          yoyo: true,
          repeat: 4,
        });
      }
    } else if (next === 'working') {
      this.playAnimation(this.direction);
    }
  }

  walkTo(point: { x: number; y: number }, duration?: number, onComplete?: () => void) {
    this.currentTween?.stop();
    const dx = point.x - this.x;
    const dy = point.y - this.y;
    this.direction = pickDirection(dx, dy);
    this.playAnimation(this.direction);

    const distance = Phaser.Math.Distance.Between(this.x, this.y, point.x, point.y);
    const ms = duration ?? Math.max(180, distance * 12);

    this.currentTween = this.scene.tweens.add({
      targets: this,
      x: point.x,
      y: point.y,
      duration: ms,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.stopAnimation();
        this.state = 'idle';
        onComplete?.();
      },
    });
  }

  walkPath(path: Array<{ x: number; y: number }>) {
    if (!path.length) return;
    const segments = [...path];
    const step = () => {
      if (!segments.length) {
        this.stopAnimation();
        this.state = 'idle';
        return;
      }
      const next = segments.shift()!;
      this.walkTo(next, undefined, step);
    };
    this.state = 'wandering';
    step();
  }

  dispose() {
    this.currentTween?.stop();
    this.destroy(true);
  }

  private playAnimation(direction: Direction8) {
    const key = AssetManager.animationKey(this.manifest, direction);
    if (!key) return;
    if (!this.scene.anims.exists(key)) return;
    if (this.sprite.anims.currentAnim?.key === key) return;
    this.sprite.play({ key, repeat: -1 });
  }

  private stopAnimation() {
    this.sprite.anims?.stop();
    const textureKey = AssetManager.rotationTextureKey(this.manifest, this.direction);
    this.sprite.setTexture(textureKey);
  }
}
