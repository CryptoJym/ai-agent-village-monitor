import type Phaser from 'phaser';
import type { AssetManifest, AtlasEntry, ImageEntry, SheetEntry, AudioEntry } from './manifest';

// Deterministic tint color (0x000000..0xFFFFFF) based on a seed
export function hashTint(seed: string): number {
  let h = 2166136261 >>> 0; // FNV-1a base
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Spread bits and clamp to RGB space
  const rgb = (h >>> 8) & 0xffffff;
  // Avoid too-dark colors: lift lower bound
  const min = 0x223344;
  return (rgb & 0xffffff) < min ? (rgb ^ 0x335577) & 0xffffff : rgb;
}

export class AssetManager {
  private static prepared = false;

  constructor(private scene: Phaser.Scene) {}

  preload(manifest: AssetManifest) {
    if (!manifest) return;
    manifest.atlases.forEach((a: AtlasEntry) => {
      this.scene.load.atlas(a.key, a.image, a.atlasJson);
    });
    manifest.images.forEach((i: ImageEntry) => {
      this.scene.load.image(i.key, i.path);
    });
    manifest.sheets.forEach((s: SheetEntry) => {
      this.scene.load.spritesheet(s.key, s.path, s.frameConfig);
    });
    manifest.audio.forEach((a: AudioEntry) => {
      this.scene.load.audio(a.key, a.path);
    });
  }

  static tintForAgentId(id: string): number {
    return hashTint(id);
  }

  static prepare(scene: Phaser.Scene) {
    if (AssetManager.prepared) return;
    // Define default animations here when atlases/sheets are present.
    const ensure = (key: string, sheet: string, start = 0, end = 3, frameRate = 8) => {
      if (scene.anims.exists(key)) return;
      try {
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(sheet, { start, end }),
          frameRate,
          repeat: -1,
        });
      } catch (e) {
        void e;
      }
    };
    // Try to define a few common animations if sheets are present
    ensure('agent_idle', 'agent_sheet', 0, 3, 4);
    ensure('agent_walk', 'agent_sheet', 0, 3, 8);
    ensure('agent_work', 'agent_sheet', 0, 3, 10);
    ensure('sparkle_anim', 'sparkle', 0, 3, 12);
    AssetManager.prepared = true;
  }

  static defineAnimations(scene: Phaser.Scene) {
    AssetManager.prepare(scene);
  }

  // Resolve a texture key for a house based on primary language
  static getHouseTextureKey(lang: string): string {
    const map: Record<string, string> = {
      js: 'house_js',
      ts: 'house_ts',
      py: 'house_py',
      go: 'house_go',
      rb: 'house_rb',
      java: 'house_java',
      cs: 'house_cs',
    };
    const key = (lang || '').toLowerCase();
    return map[key] || 'house_generic';
  }
}
