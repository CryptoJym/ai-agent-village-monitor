export type AtlasEntry = {
  key: string;
  type: 'atlas' | 'spritesheet' | 'image' | 'audio';
  url: string;
  dataUrl?: string; // for multi-file atlases
  frameConfig?: { frameWidth: number; frameHeight: number; start?: number; end?: number };
};

export const ATLAS_MANIFEST: AtlasEntry[] = [
  // House variants by language (Pixellab sprites)
  { key: 'house_js', type: 'image', url: '/assets/houses/house_js.png' },
  { key: 'house_ts', type: 'image', url: '/assets/houses/house_ts.png' },
  { key: 'house_py', type: 'image', url: '/assets/houses/house_py.png' },
  { key: 'house_go', type: 'image', url: '/assets/houses/house_go.png' },
  { key: 'house_rb', type: 'image', url: '/assets/houses/house_rb.png' },
  { key: 'house_java', type: 'image', url: '/assets/houses/house_java.png' },
  { key: 'house_cs', type: 'image', url: '/assets/houses/house_cs.png' },
  { key: 'house_generic', type: 'image', url: '/assets/houses/house_generic.png' },
];

export const PRELOAD_AUDIO: AtlasEntry[] = [];
