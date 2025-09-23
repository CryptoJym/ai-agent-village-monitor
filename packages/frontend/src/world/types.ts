import type { PixellabTileMetadata } from '../assets/pixellabManifest';

export type BiomeKey = keyof PixellabTileMetadata['biome'];

export interface VillageDescriptor {
  id: string;
  name: string;
  language?: string;
  houseCount?: number;
  totalStars?: number;
}

export type TileVariant = 'lower' | 'upper' | 'transition';

export interface TileSample {
  x: number;
  y: number;
  biome: BiomeKey;
  height: number;
  textureKey: string;
  frame: string;
  variant: TileVariant;
  passable: boolean;
}

export interface DecorationPlacement {
  id: string;
  kind: 'banner' | 'sign' | 'tree' | 'bridge';
  textureKey: string;
  frame?: string;
  x: number;
  y: number;
}

export interface VillagePlacement extends VillageDescriptor {
  x: number;
  y: number;
  biome: BiomeKey;
  tint: number;
}

export interface WorldMapData {
  version: number;
  seed: string;
  width: number;
  height: number;
  tileSize: number;
  tiles: TileSample[];
  decorations: DecorationPlacement[];
  villages: VillagePlacement[];
  generatedAt: string;
}

export interface WorldMapCacheEntry {
  signature: string;
  data: WorldMapData;
}
