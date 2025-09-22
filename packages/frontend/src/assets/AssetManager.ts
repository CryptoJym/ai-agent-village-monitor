import type Phaser from 'phaser';
import type { AssetManifest, AtlasEntry, ImageEntry, SheetEntry, AudioEntry } from './manifest';
import {
  pixellabManifest,
  type CharacterManifest,
  type Direction4,
  type Direction8,
} from './pixellabManifest';

const toFrameName = (index: number) => index.toString().padStart(3, '0');

export function hashTint(seed: string): number {
  let h = 2166136261 >>> 0; // FNV-1a base
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rgb = (h >>> 8) & 0xffffff;
  const min = 0x223344;
  return (rgb & 0xffffff) < min ? (rgb ^ 0x335577) & 0xffffff : rgb;
}

const loadedPixellabKeys = new Set<string>();

const buildRotationKey = (entry: CharacterManifest, direction: Direction4 | Direction8) =>
  `pixellab:${entry.category}:${entry.key}:rot:${direction}`;

const buildFrameKey = (
  entry: CharacterManifest,
  animation: string,
  direction: Direction4 | Direction8,
  frameIndex: number,
) => `pixellab:${entry.category}:${entry.key}:anim:${animation}:${direction}:${frameIndex}`;

const buildAnimationKey = (
  entry: CharacterManifest,
  animation: string,
  direction: Direction4 | Direction8,
) => `pixellab:${entry.category}:${entry.key}:${animation}:${direction}`;

const iterateCharacters = (): CharacterManifest[] => [
  ...pixellabManifest.agents,
  ...pixellabManifest.emotes,
  ...pixellabManifest.bugBots,
];

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

  static queuePixellabAssets(scene: Phaser.Scene) {
    for (const entry of iterateCharacters()) {
      for (const direction of entry.directions) {
        const rotKey = buildRotationKey(entry, direction);
        if (!loadedPixellabKeys.has(rotKey)) {
          scene.load.image(rotKey, `${entry.basePath}/rotations/${direction}.png`);
          loadedPixellabKeys.add(rotKey);
        }
        if (entry.animation) {
          const totalFrames =
            entry.animation.framesByDirection?.[direction] ?? entry.animation.frameCount;
          for (let i = 0; i < totalFrames; i++) {
            const frameKey = buildFrameKey(entry, entry.animation.name, direction, i);
            if (loadedPixellabKeys.has(frameKey)) continue;
            const framePath = `${entry.basePath}/animations/${entry.animation.name}/${direction}/frame_${toFrameName(
              i,
            )}.png`;
            scene.load.image(frameKey, framePath);
            loadedPixellabKeys.add(frameKey);
          }
        }
      }
    }
  }

  static registerPixellabAnimations(scene: Phaser.Scene) {
    for (const entry of iterateCharacters()) {
      if (!entry.animation) continue;
      for (const direction of entry.directions) {
        const animKey = buildAnimationKey(entry, entry.animation.name, direction);
        if (scene.anims.exists(animKey)) continue;
        const totalFrames =
          entry.animation.framesByDirection?.[direction] ?? entry.animation.frameCount;
        const frames = Array.from({ length: totalFrames }, (_, i) => ({
          key: buildFrameKey(entry, entry.animation!.name, direction, i),
        }));
        scene.anims.create({
          key: animKey,
          frames,
          frameRate: entry.animation.frameRate,
          repeat: entry.animation.repeat,
        });
      }
    }
  }

  static rotationTextureKey(entry: CharacterManifest, direction: Direction4 | Direction8) {
    return buildRotationKey(entry, direction);
  }

  static animationKey(entry: CharacterManifest, direction: Direction4 | Direction8) {
    if (!entry.animation) return undefined;
    return buildAnimationKey(entry, entry.animation.name, direction);
  }

  static tintForAgentId(id: string): number {
    return hashTint(id);
  }

  static prepare(_scene: Phaser.Scene) {
    if (AssetManager.prepared) return;
    AssetManager.prepared = true;
  }

  static defineAnimations(scene: Phaser.Scene) {
    AssetManager.prepare(scene);
  }

  static getHouseTextureKey(lang: string): string {
    const map: Record<string, string> = {
      js: 'house_js',
      ts: 'house_ts',
      py: 'house_py',
      go: 'house_go',
      rb: 'house_rb',
      java: 'house_java',
      cs: 'house_cs',
      generic: 'house_generic',
    };
    const key = (lang || '').toLowerCase();
    return map[key] || 'house_generic';
  }
}

export { buildAnimationKey, buildRotationKey, buildFrameKey };
