import { pixellabTileMetadata } from '../assets/pixellabManifest';
import { createSeededRandom, fractalNoise2D, hashToUnit } from './random';
import { loadFromCache, makeSignature, saveToCache } from './cache';
import type {
  BiomeKey,
  TileSample,
  TileVariant,
  VillageDescriptor,
  VillagePlacement,
  WorldMapData,
} from './types';

const WORLD_VERSION = 1;
const DEFAULT_TILE_SIZE = 32;
const DEFAULT_WIDTH = 96;
const DEFAULT_HEIGHT = 64;

const TILE_TEXTURE_PREFIX = 'pixellabTile:biome:';

type WorldBiomeKind = 'ocean' | 'beach' | 'grass' | 'forest' | 'rock' | 'river' | 'road';

type BiomeConfig = {
  biome: BiomeKey;
  variant: TileVariant;
  passableOverride?: boolean;
};

const BIOME_PRESETS: Record<WorldBiomeKind, BiomeConfig> = {
  ocean: { biome: 'ocean-beach', variant: 'lower', passableOverride: false },
  beach: { biome: 'beach-grass', variant: 'lower' },
  grass: { biome: 'grass-road', variant: 'lower' },
  forest: { biome: 'grass-forest', variant: 'upper', passableOverride: false },
  rock: { biome: 'grass-rock', variant: 'upper', passableOverride: false },
  river: { biome: 'river-grass', variant: 'lower', passableOverride: false },
  road: { biome: 'grass-road', variant: 'upper', passableOverride: true },
};

type BiomeCenter = {
  x: number;
  y: number;
  affinity: WorldBiomeKind;
};

type GenerateOptions = {
  seed?: string;
  width?: number;
  height?: number;
  tileSize?: number;
  forceRegenerate?: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getTileMetadata(config: BiomeConfig) {
  const meta = pixellabTileMetadata.biome[config.biome];
  if (!meta) throw new Error(`Missing tile metadata for biome ${config.biome}`);
  const variantMeta = meta[config.variant];
  if (!variantMeta) throw new Error(`Missing variant ${config.variant} in biome ${config.biome}`);
  if (!('baseTileId' in variantMeta))
    throw new Error(`Variant ${config.variant} has no baseTileId`);
  return {
    textureKey: `${TILE_TEXTURE_PREFIX}${config.biome}`,
    frame: variantMeta.baseTileId,
    passable: config.passableOverride ?? ('passable' in variantMeta ? variantMeta.passable : true),
  };
}

function deriveSeed(villages: VillageDescriptor[], explicit?: string): string {
  if (explicit) return explicit;
  const ids = villages
    .map((v) => v.id)
    .sort()
    .join('|');
  return `villages:${ids || 'default'}`;
}

function createBiomeCenters(width: number, height: number, seed: string): BiomeCenter[] {
  const rng = createSeededRandom(`${seed}:centers`);
  const size = Math.round(clamp(width * height * 0.0008, 6, 16));
  const affinities: WorldBiomeKind[] = ['grass', 'forest', 'rock', 'beach'];
  const centers: BiomeCenter[] = [];
  for (let i = 0; i < size; i++) {
    const affinity = affinities[Math.floor(rng() * affinities.length)] ?? 'grass';
    centers.push({
      x: Math.floor(rng() * width),
      y: Math.floor(rng() * height),
      affinity,
    });
  }
  return centers;
}

function nearestCenter(x: number, y: number, centers: BiomeCenter[]): BiomeCenter | null {
  let best: BiomeCenter | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const center of centers) {
    const dx = center.x - x;
    const dy = center.y - y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      best = center;
      bestDist = dist;
    }
  }
  return best;
}

function computeHeight(x: number, y: number, width: number, height: number, seed: string): number {
  const nx = (x / width) * 2 - 1;
  const ny = (y / height) * 2 - 1;
  const radialFalloff = clamp(1 - Math.pow(Math.sqrt(nx * nx + ny * ny), 2.2), 0, 1);
  const base = fractalNoise2D(x, y, `${seed}:height`, {
    scale: 0.035,
    octaves: 5,
    persistence: 0.55,
  });
  return clamp(base * 0.75 + radialFalloff * 0.35, 0, 1);
}

function classifyBiome(
  height: number,
  center: BiomeCenter | null,
  edgeNoise: number,
): WorldBiomeKind {
  if (height <= 0.28) return 'ocean';
  if (height <= 0.34) return 'beach';
  if (height >= 0.82) return 'rock';
  if (height >= 0.68) return center?.affinity === 'rock' ? 'rock' : 'forest';
  if (height >= 0.52) return center?.affinity === 'forest' ? 'forest' : 'grass';
  if (height <= 0.42) {
    // Lowlands skew towards wetlands vs grass
    return edgeNoise > 0.5 ? 'grass' : 'beach';
  }
  return center?.affinity ?? 'grass';
}

function sampleTile(
  x: number,
  y: number,
  width: number,
  height: number,
  centers: BiomeCenter[],
  seed: string,
): TileSample {
  const heightValue = computeHeight(x, y, width, height, seed);
  const center = nearestCenter(x, y, centers);
  const edgeNoise = fractalNoise2D(x + 13.37, y - 42.1, `${seed}:biome`, {
    scale: 0.12,
    octaves: 2,
    persistence: 0.6,
  });
  const kind = classifyBiome(heightValue, center, edgeNoise);
  const config = BIOME_PRESETS[kind];
  const meta = getTileMetadata(config);
  return {
    x,
    y,
    biome: config.biome,
    height: heightValue,
    textureKey: meta.textureKey,
    frame: meta.frame,
    variant: config.variant,
    passable: meta.passable,
  };
}

function carvePath(
  tiles: TileSample[],
  width: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  let cx = from.x;
  let cy = from.y;
  while (cx !== to.x || cy !== to.y) {
    const idx = cy * width + cx;
    const tile = tiles[idx];
    if (tile) {
      const roadConfig = BIOME_PRESETS.road;
      const roadMeta = getTileMetadata(roadConfig);
      tile.biome = roadConfig.biome;
      tile.textureKey = roadMeta.textureKey;
      tile.frame = roadMeta.frame;
      tile.variant = roadConfig.variant;
      tile.passable = roadMeta.passable;
    }
    if (cx < to.x) cx += 1;
    else if (cx > to.x) cx -= 1;
    if (cy < to.y) cy += 1;
    else if (cy > to.y) cy -= 1;
  }
}

function ensureLandTile(
  tiles: TileSample[],
  width: number,
  height: number,
  startX: number,
  startY: number,
): { x: number; y: number; tile: TileSample } | null {
  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.x}:${current.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (current.x < 0 || current.x >= width || current.y < 0 || current.y >= height) continue;
    const tile = tiles[current.y * width + current.x];
    if (tile && tile.passable) {
      return { ...current, tile };
    }
    queue.push({ x: current.x + 1, y: current.y });
    queue.push({ x: current.x - 1, y: current.y });
    queue.push({ x: current.x, y: current.y + 1 });
    queue.push({ x: current.x, y: current.y - 1 });
  }
  return null;
}

function placeVillages(
  villages: VillageDescriptor[],
  tiles: TileSample[],
  width: number,
  height: number,
  seed: string,
): VillagePlacement[] {
  const placements: VillagePlacement[] = [];
  const occupied = new Set<string>();
  for (const village of villages) {
    const ux = hashToUnit(`${seed}:${village.id}:x`);
    const uy = hashToUnit(`${seed}:${village.id}:y`);
    const baseX = Math.floor(8 + ux * (width - 16));
    const baseY = Math.floor(8 + uy * (height - 16));
    const spot = ensureLandTile(tiles, width, height, baseX, baseY);
    if (!spot) continue;
    let vx = spot.x;
    let vy = spot.y;
    let attempts = 0;
    while (occupied.has(`${vx}:${vy}`) && attempts < 12) {
      vx = Math.min(width - 2, Math.max(1, vx + (attempts % 2 === 0 ? 1 : -1)));
      vy = Math.min(height - 2, Math.max(1, vy + (attempts % 2 === 0 ? -1 : 1)));
      attempts++;
    }
    occupied.add(`${vx}:${vy}`);
    const tile = tiles[vy * width + vx];
    placements.push({
      ...village,
      x: vx,
      y: vy,
      biome: tile?.biome ?? 'grass-road',
      tint: Math.floor(hashToUnit(`${village.id}:tint`) * 0xffffff),
    });
  }
  return placements;
}

function connectVillages(tiles: TileSample[], width: number, villages: VillagePlacement[]) {
  if (villages.length < 2) return;
  type Edge = { a: number; b: number; dist: number };
  const edges: Edge[] = [];
  for (let i = 0; i < villages.length; i++) {
    for (let j = i + 1; j < villages.length; j++) {
      const a = villages[i];
      const b = villages[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      edges.push({ a: i, b: j, dist });
    }
  }
  edges.sort((lhs, rhs) => lhs.dist - rhs.dist);
  const parent = Array.from({ length: villages.length }, (_, idx) => idx);

  const find = (idx: number): number => {
    if (parent[idx] !== idx) parent[idx] = find(parent[idx]);
    return parent[idx];
  };
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  let connected = 0;
  for (const edge of edges) {
    if (find(edge.a) === find(edge.b)) continue;
    unite(edge.a, edge.b);
    carvePath(tiles, width, villages[edge.a], villages[edge.b]);
    connected++;
    if (connected >= villages.length - 1) break;
  }
}

export function generateWorldMap(
  villages: VillageDescriptor[],
  options: GenerateOptions = {},
): WorldMapData {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const tileSize = options.tileSize ?? DEFAULT_TILE_SIZE;
  const baseSeed = deriveSeed(villages, options.seed);
  const signature = makeSignature(
    baseSeed,
    villages.map((v) => v.id),
  );

  if (!options.forceRegenerate) {
    const cached = loadFromCache(baseSeed, signature);
    if (cached) {
      return cached;
    }
  }

  const centers = createBiomeCenters(width, height, baseSeed);
  const tiles: TileSample[] = new Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles[y * width + x] = sampleTile(x, y, width, height, centers, baseSeed);
    }
  }

  // Rivers
  const riverCount = Math.max(1, Math.round(villages.length / 3));
  const rng = createSeededRandom(`${baseSeed}:riv`);
  for (let i = 0; i < riverCount; i++) {
    let startX = Math.floor(rng() * width);
    let startY = Math.floor(rng() * height);
    let bestHeight = -1;
    for (let attempt = 0; attempt < 12; attempt++) {
      const sample = tiles[startY * width + startX];
      if (sample?.height && sample.height > bestHeight) {
        bestHeight = sample.height;
      }
      if (sample && sample.height > 0.7) break;
      startX = Math.floor(rng() * width);
      startY = Math.floor(rng() * height);
    }
    let cx = startX;
    let cy = startY;
    for (let step = 0; step < width * 2; step++) {
      if (cx <= 1 || cy <= 1 || cx >= width - 2 || cy >= height - 2) break;
      const idx = cy * width + cx;
      const tile = tiles[idx];
      if (!tile) break;
      const riverConfig = BIOME_PRESETS.river;
      const riverMeta = getTileMetadata(riverConfig);
      tile.biome = riverConfig.biome;
      tile.textureKey = riverMeta.textureKey;
      tile.frame = riverMeta.frame;
      tile.variant = riverConfig.variant;
      tile.passable = riverMeta.passable;
      let lowest = tile.height;
      let nextX = cx;
      let nextY = cy;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = cx + dx;
        const ny = cy + dy;
        const neighbor = tiles[ny * width + nx];
        if (neighbor && neighbor.height < lowest) {
          lowest = neighbor.height;
          nextX = nx;
          nextY = ny;
        }
      }
      if (nextX === cx && nextY === cy) break;
      cx = nextX;
      cy = nextY;
    }
  }

  const villagePlacements = placeVillages(villages, tiles, width, height, baseSeed);
  connectVillages(tiles, width, villagePlacements);

  const data: WorldMapData = {
    version: WORLD_VERSION,
    seed: baseSeed,
    width,
    height,
    tileSize,
    tiles,
    decorations: [],
    villages: villagePlacements,
    generatedAt: new Date().toISOString(),
  };

  saveToCache(baseSeed, signature, data);
  return data;
}

export type { VillageDescriptor };
