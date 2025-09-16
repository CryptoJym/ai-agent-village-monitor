import Phaser from 'phaser';
import { ATLAS_MANIFEST, PRELOAD_AUDIO } from '../assets/atlases';

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super('PreloaderScene');
  }

  preload() {
    const width = this.scale.width;
    const height = this.scale.height;
    const barBg = this.add
      .rectangle(width / 2, height / 2, Math.min(360, width * 0.8), 12, 0x1f2937)
      .setOrigin(0.5);
    const bar = this.add
      .rectangle(barBg.x - barBg.width / 2, barBg.y, 2, 8, 0x60a5fa)
      .setOrigin(0, 0.5);
    const label = this.add
      .text(barBg.x, barBg.y - 20, 'Loading… 0%', {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: '12px',
      })
      .setOrigin(0.5);

    this.load.on('progress', (p: number) => {
      bar.width = barBg.width * p;
      label.setText(`Loading… ${Math.round(p * 100)}%`);
    });

    // Queue assets
    for (const a of ATLAS_MANIFEST) {
      if (a.type === 'spritesheet' && a.frameConfig)
        this.load.spritesheet(a.key, a.url, a.frameConfig);
      else if (a.type === 'atlas') this.load.atlas(a.key, a.url, a.dataUrl || '');
      else if (a.type === 'image') this.load.image(a.key, a.url);
    }
    for (const a of PRELOAD_AUDIO) {
      this.load.audio(a.key, a.url);
    }
  }

  create() {
    // Define global animations
    try {
      const { AssetManager } =
        require('../assets/AssetManager') as typeof import('../assets/AssetManager');
      AssetManager.defineAnimations(this);
    } catch {}
    // After preload, move to WorldMap → MainScene flow; WorldMapScene is first
    this.scene.start('WorldMapScene');
  }
}
