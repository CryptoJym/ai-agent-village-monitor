import Phaser from 'phaser';
import { AssetManager } from '../../assets/AssetManager';
import { ATLAS_MANIFEST, PRELOAD_AUDIO } from '../../assets/atlases';

/**
 * PreloadScene - Asset Loading with progress display
 *
 * Responsibilities:
 * - Show loading progress bar
 * - Load all game assets (sprites, tilemaps, audio)
 * - Initialize plugins and managers
 * - Transition to VillageScene or MenuScene
 */
export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Rectangle;
  private progressBarBg!: Phaser.GameObjects.Rectangle;
  private loadingText!: Phaser.GameObjects.Text;
  private percentText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    this.createLoadingUI();
    this.setupLoadEvents();
    this.loadAssets();
  }

  private createLoadingUI() {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // Title text
    this.loadingText = this.add
      .text(centerX, centerY - 50, 'AI Agent Village Monitor', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Progress bar background
    const barWidth = Math.min(400, width * 0.7);
    const barHeight = 20;

    this.progressBarBg = this.add
      .rectangle(centerX, centerY, barWidth, barHeight, 0x1f2937)
      .setOrigin(0.5);

    // Progress bar fill
    this.progressBar = this.add
      .rectangle(
        centerX - barWidth / 2,
        centerY,
        4,
        barHeight - 4,
        0x60a5fa
      )
      .setOrigin(0, 0.5);

    // Percentage text
    this.percentText = this.add
      .text(centerX, centerY + 40, '0%', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);
  }

  private setupLoadEvents() {
    this.load.on('progress', (progress: number) => {
      const barWidth = this.progressBarBg.width - 4;
      this.progressBar.width = barWidth * progress;
      this.percentText.setText(`${Math.round(progress * 100)}%`);
    });

    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      console.log(`[PreloadScene] Loading: ${file.key}`);
    });

    this.load.on('complete', () => {
      console.log('[PreloadScene] All assets loaded');
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`[PreloadScene] Error loading: ${file.key}`);
    });
  }

  private loadAssets() {
    // Load atlas manifest assets
    for (const asset of ATLAS_MANIFEST) {
      if (asset.type === 'spritesheet' && asset.frameConfig) {
        this.load.spritesheet(asset.key, asset.url, asset.frameConfig);
      } else if (asset.type === 'atlas') {
        this.load.atlas(asset.key, asset.url, asset.dataUrl || '');
      } else if (asset.type === 'image') {
        this.load.image(asset.key, asset.url);
      }
    }

    // Load audio assets
    for (const audio of PRELOAD_AUDIO) {
      this.load.audio(audio.key, audio.url);
    }

    // Load PixelLab assets
    AssetManager.queuePixellabAssets(this);
  }

  create() {
    console.log('[PreloadScene] Creating animations and registering assets...');

    // Register animations and tiles
    AssetManager.registerPixellabAnimations(this);
    AssetManager.registerPixellabTiles(this);

    // Add a small delay for visual feedback
    this.time.delayedCall(500, () => {
      console.log('[PreloadScene] Starting VillageScene...');
      this.scene.start('VillageScene');
    });
  }
}
