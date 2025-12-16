import Phaser from 'phaser';
import manifestData from './manifest.json';

export interface AssetManifest {
  version: string;
  spritesheets: Record<string, SpritesheetAsset>;
  tilemaps: Record<string, TilemapAsset>;
  tilesets: Record<string, TilesetAsset>;
  images: Record<string, ImageAsset>;
  audio: Record<string, AudioAsset>;
}

export interface SpritesheetAsset {
  path: string;
  frameWidth: number;
  frameHeight: number;
  description?: string;
}

export interface TilemapAsset {
  path: string;
  description?: string;
}

export interface TilesetAsset {
  path: string;
  description?: string;
}

export interface ImageAsset {
  path: string;
  description?: string;
}

export interface AudioAsset {
  path: string;
  description?: string;
}

export interface LoadProgress {
  key: string;
  type: string;
  progress: number;
  total: number;
  loaded: number;
}

/**
 * AssetLoader - Dynamic asset loading with manifest support
 *
 * Features:
 * - Load assets based on manifest.json
 * - Progress tracking with detailed callbacks
 * - Error handling with fallbacks
 * - Lazy loading for large assets
 * - Asset validation and preloading
 */
export class AssetLoader {
  private scene: Phaser.Scene;
  private manifest: AssetManifest;
  private loadedAssets: Set<string> = new Set();
  private failedAssets: Set<string> = new Set();
  private eventsBound = false;

  // Callbacks
  private onProgressCallback?: (progress: LoadProgress) => void;
  private onCompleteCallback?: () => void;
  private onErrorCallback?: (key: string, error: Error) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.manifest = manifestData as AssetManifest;
  }

  /**
   * Queue all assets from manifest (for use inside a Scene.preload method).
   *
   * Note: does NOT call `this.scene.load.start()`; Phaser will automatically start
   * the loader at the end of `preload()`.
   */
  queueAll(): void {
    this.setupLoadEvents();
    this.loadSpritesheets();
    this.loadTilemaps();
    this.loadTilesets();
    this.loadImages();
    this.loadAudio();
  }

  /**
   * Load all assets from manifest
   */
  loadAll(): Promise<void> {
    return new Promise((resolve) => {
      this.queueAll();

      this.scene.load.once('complete', () => {
        if (this.onCompleteCallback) {
          this.onCompleteCallback();
        }
        resolve();
      });

      this.scene.load.once('loaderror', (file: Phaser.Loader.File) => {
        const error = new Error(`Failed to load: ${file.key}`);
        if (this.onErrorCallback) {
          this.onErrorCallback(file.key, error);
        }
        // Don't reject - continue loading other assets
      });

      this.scene.load.start();
    });
  }

  /**
   * Load specific asset by key
   */
  loadAsset(type: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.loadedAssets.has(key)) {
        resolve();
        return;
      }

      switch (type) {
        case 'spritesheet':
          this.loadSpritesheet(key);
          break;
        case 'tilemap':
          this.loadTilemap(key);
          break;
        case 'tileset':
          this.loadTileset(key);
          break;
        case 'image':
          this.loadImage(key);
          break;
        case 'audio':
          this.loadAudioAsset(key);
          break;
        default:
          reject(new Error(`Unknown asset type: ${type}`));
          return;
      }

      this.scene.load.once('filecomplete-' + type + '-' + key, () => {
        this.loadedAssets.add(key);
        resolve();
      });

      this.scene.load.start();
    });
  }

  private setupLoadEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    this.scene.load.on('progress', (progress: number) => {
      if (this.onProgressCallback) {
        this.onProgressCallback({
          key: 'global',
          type: 'progress',
          progress,
          total: this.scene.load.totalToLoad,
          loaded: this.scene.load.totalComplete,
        });
      }
    });

    this.scene.load.on('fileprogress', (file: Phaser.Loader.File, progress: number) => {
      if (this.onProgressCallback) {
        this.onProgressCallback({
          key: file.key,
          type: file.type,
          progress,
          total: this.scene.load.totalToLoad,
          loaded: this.scene.load.totalComplete,
        });
      }
    });

    this.scene.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`[AssetLoader] Failed to load: ${file.key}`);
      this.failedAssets.add(file.key);

      if (this.onErrorCallback) {
        this.onErrorCallback(file.key, new Error(`Load failed: ${file.key}`));
      }
    });
  }

  private loadSpritesheets() {
    Object.entries(this.manifest.spritesheets).forEach(([key, asset]) => {
      this.loadSpritesheet(key);
    });
  }

  private loadSpritesheet(key: string) {
    const asset = this.manifest.spritesheets[key];
    if (!asset) return;

    try {
      this.scene.load.spritesheet(key, asset.path, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
      });
    } catch (error) {
      console.error(`[AssetLoader] Error loading spritesheet ${key}:`, error);
      this.failedAssets.add(key);
    }
  }

  private loadTilemaps() {
    Object.entries(this.manifest.tilemaps).forEach(([key, asset]) => {
      this.loadTilemap(key);
    });
  }

  private loadTilemap(key: string) {
    const asset = this.manifest.tilemaps[key];
    if (!asset) return;

    try {
      const loader = this.scene.load as any;
      if (typeof loader.tilemapTiledJSON !== 'function') {
        this.failedAssets.add(key);
        console.warn(`[AssetLoader] tilemapTiledJSON not available, skipping ${key}`);
        return;
      }
      loader.tilemapTiledJSON(key, asset.path);
    } catch (error) {
      console.error(`[AssetLoader] Error loading tilemap ${key}:`, error);
      // Use fallback for missing tilemaps
      console.warn(`[AssetLoader] Tilemap ${key} not found, will create placeholder`);
    }
  }

  private loadTilesets() {
    Object.entries(this.manifest.tilesets).forEach(([key, asset]) => {
      this.loadTileset(key);
    });
  }

  private loadTileset(key: string) {
    const asset = this.manifest.tilesets[key];
    if (!asset) return;

    try {
      this.scene.load.image(key, asset.path);
    } catch (error) {
      console.error(`[AssetLoader] Error loading tileset ${key}:`, error);
      this.failedAssets.add(key);
    }
  }

  private loadImages() {
    Object.entries(this.manifest.images).forEach(([key, asset]) => {
      this.loadImage(key);
    });
  }

  private loadImage(key: string) {
    const asset = this.manifest.images[key];
    if (!asset) return;

    try {
      this.scene.load.image(key, asset.path);
    } catch (error) {
      console.warn(`[AssetLoader] Error loading image ${key}:`, error);
    }
  }

  private loadAudio() {
    Object.entries(this.manifest.audio).forEach(([key, asset]) => {
      this.loadAudioAsset(key);
    });
  }

  private loadAudioAsset(key: string) {
    const asset = this.manifest.audio[key];
    if (!asset) return;

    try {
      this.scene.load.audio(key, asset.path);
    } catch (error) {
      console.warn(`[AssetLoader] Error loading audio ${key}:`, error);
    }
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (progress: LoadProgress) => void): this {
    this.onProgressCallback = callback;
    return this;
  }

  /**
   * Set complete callback
   */
  onComplete(callback: () => void): this {
    this.onCompleteCallback = callback;
    return this;
  }

  /**
   * Set error callback
   */
  onError(callback: (key: string, error: Error) => void): this {
    this.onErrorCallback = callback;
    return this;
  }

  /**
   * Check if asset was loaded successfully
   */
  isLoaded(key: string): boolean {
    return this.loadedAssets.has(key);
  }

  /**
   * Check if asset failed to load
   */
  hasFailed(key: string): boolean {
    return this.failedAssets.has(key);
  }

  /**
   * Get manifest
   */
  getManifest(): AssetManifest {
    return this.manifest;
  }

  /**
   * Get loaded asset keys
   */
  getLoadedAssets(): string[] {
    return Array.from(this.loadedAssets);
  }

  /**
   * Get failed asset keys
   */
  getFailedAssets(): string[] {
    return Array.from(this.failedAssets);
  }

  /**
   * Create placeholder textures for known texture assets that failed to load.
   *
   * This keeps sprites/tilesets from hard-failing due to missing assets.
   * (Tilemaps are JSON and cannot be replaced by textures here.)
   */
  registerFallbackTextures(opts?: { size?: number; fill?: string; stroke?: string }): void {
    const size = opts?.size ?? 32;
    const fill = opts?.fill ?? '#ff00ff';
    const stroke = opts?.stroke ?? '#000000';

    const textureKeys = new Set<string>([
      ...Object.keys(this.manifest.images || {}),
      ...Object.keys(this.manifest.tilesets || {}),
      ...Object.keys(this.manifest.spritesheets || {}),
    ]);

    for (const key of textureKeys) {
      if (!this.failedAssets.has(key)) continue;
      if (this.scene.textures.exists(key)) continue;

      try {
        const tex = this.scene.textures.createCanvas(key, size, size);
        if (!tex) continue;
        const ctx = tex.getContext();
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, size - 2, size - 2);
        tex.refresh();
      } catch (error) {
        console.warn(`[AssetLoader] Failed to create fallback texture for ${key}:`, error);
      }
    }
  }
}
