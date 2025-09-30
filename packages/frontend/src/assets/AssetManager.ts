import type Phaser from 'phaser';
import type { AssetManifest, AtlasEntry, ImageEntry, SheetEntry, AudioEntry } from './manifest';
import {
  pixellabManifest,
  pixellabTileMetadata,
  pixellabInteriorMetadata,
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
const loadedTileTextures = new Set<string>();
const loadedTileDefinitions = new Set<string>();
const loadedInteriorProps = new Set<string>();

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

const getAnimationFrameCount = (entry: CharacterManifest, direction: Direction4 | Direction8) => {
  const animation = entry.animation;
  if (!animation) return 0;
  if (animation.framesByDirection) {
    return animation.framesByDirection[direction] ?? 0;
  }
  return animation.frameCount;
};

const getAnimationDirections = (entry: CharacterManifest): Array<Direction4 | Direction8> => {
  if (entry.animation?.framesByDirection) {
    return Object.keys(entry.animation.framesByDirection) as Array<Direction4 | Direction8>;
  }
  return entry.directions;
};

const buildTileTextureKey = (category: string, key: string) => `pixellabTile:${category}:${key}`;
const buildTileDefinitionKey = (category: string, key: string) =>
  `${buildTileTextureKey(category, key)}:wang`;
const buildInteriorPropTextureKey = (theme: string, propKey: string) =>
  `pixellabInterior:${theme}:${propKey}`;

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
      const animationDirections = getAnimationDirections(entry);
      for (const direction of entry.directions) {
        const rotKey = buildRotationKey(entry, direction);
        if (!loadedPixellabKeys.has(rotKey)) {
          scene.load.image(rotKey, `${entry.basePath}/rotations/${direction}.png`);
          loadedPixellabKeys.add(rotKey);
        }
        if (entry.animation) {
          if (!animationDirections.includes(direction)) {
            continue;
          }
          const totalFrames = getAnimationFrameCount(entry, direction);
          if (totalFrames <= 0) {
            continue;
          }
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

    for (const [category, entries] of Object.entries(pixellabTileMetadata)) {
      for (const [key, metadata] of Object.entries(entries)) {
        const textureKey = buildTileTextureKey(category, key);
        if (!loadedTileTextures.has(textureKey)) {
          const basePath = `/assets/tiles/${category}/${key}`;
          scene.load.image(textureKey, `${basePath}/${metadata.files.image}`);
          loadedTileTextures.add(textureKey);
        }
        const definitionKey = buildTileDefinitionKey(category, key);
        if (!loadedTileDefinitions.has(definitionKey) && metadata.files.definition) {
          const basePath = `/assets/tiles/${category}/${key}`;
          scene.load.json(definitionKey, `${basePath}/${metadata.files.definition}`);
          loadedTileDefinitions.add(definitionKey);
        }
      }
    }

    for (const [theme, interior] of Object.entries(pixellabInteriorMetadata)) {
      for (const prop of interior.props || []) {
        const textureKey = buildInteriorPropTextureKey(theme, prop.key);
        if (loadedInteriorProps.has(textureKey)) continue;
        const basePath = `/assets/interiors/${theme}`;
        scene.load.image(textureKey, `${basePath}/${prop.file}`);
        loadedInteriorProps.add(textureKey);
      }
    }
  }

  static registerPixellabAnimations(scene: Phaser.Scene) {
    for (const entry of iterateCharacters()) {
      if (!entry.animation) continue;
      const animationDirections = getAnimationDirections(entry);
      for (const direction of animationDirections) {
        const animKey = buildAnimationKey(entry, entry.animation.name, direction);
        if (scene.anims.exists(animKey)) continue;
        const totalFrames = getAnimationFrameCount(entry, direction);
        if (totalFrames <= 0) {
          continue;
        }
        const frames = Array.from({ length: totalFrames }, (_, i) => ({
          key: buildFrameKey(entry, entry.animation!.name, direction, i),
        }));
        if (frames.length === 0) {
          continue;
        }
        scene.anims.create({
          key: animKey,
          frames,
          frameRate: entry.animation.frameRate,
          repeat: entry.animation.repeat,
        });
      }
    }
  }

  static registerPixellabTiles(scene: Phaser.Scene) {
    for (const [category, entries] of Object.entries(pixellabTileMetadata)) {
      for (const [key, metadata] of Object.entries(entries)) {
        if (!metadata?.files?.definition) continue;
        const textureKey = buildTileTextureKey(category, key);
        if (!scene.textures.exists(textureKey)) continue;
        const texture = scene.textures.get(textureKey);
        const definitionKey = buildTileDefinitionKey(category, key);
        const definition = definitionKey ? scene.cache.json.get(definitionKey) : null;
        const tiles = definition?.tileset_data?.tiles;
        if (!Array.isArray(tiles)) continue;
        for (const tile of tiles) {
          const bbox = tile?.bounding_box;
          if (!bbox || typeof tile.id !== 'string') continue;
          if (texture.has(tile.id)) continue;
          texture.add(tile.id, 0, bbox.x, bbox.y, bbox.width, bbox.height);
        }
      }
    }
  }

  static rotationTextureKey(entry: CharacterManifest, direction: Direction4 | Direction8) {
    return buildRotationKey(entry, direction);
  }

  static animationKey(entry: CharacterManifest, direction: Direction4 | Direction8) {
    if (!entry.animation) return undefined;
    const animationDirections = getAnimationDirections(entry);
    if (!animationDirections.includes(direction)) {
      return undefined;
    }
    if (getAnimationFrameCount(entry, direction) <= 0) {
      return undefined;
    }
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

  static interiorPropTextureKey(theme: string, propKey: string): string {
    const normalizedTheme = (theme || '').toLowerCase();
    return buildInteriorPropTextureKey(normalizedTheme, propKey);
  }
}

export { buildAnimationKey, buildRotationKey, buildFrameKey };
