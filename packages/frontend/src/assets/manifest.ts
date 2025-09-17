export type AtlasEntry = { key: string; image: string; atlasJson: string };
export type ImageEntry = { key: string; path: string };
export type AudioEntry = { key: string; path: string };
export type SheetEntry = {
  key: string;
  path: string;
  frameConfig: { frameWidth: number; frameHeight: number };
};

export type AssetManifest = {
  atlases: AtlasEntry[];
  images: ImageEntry[];
  audio: AudioEntry[];
  sheets: SheetEntry[];
};

export const manifest: AssetManifest = {
  atlases: [],
  images: [],
  audio: [],
  sheets: [],
};
