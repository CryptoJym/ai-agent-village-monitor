export type AtlasEntry = {
  key: string;
  type: 'atlas' | 'spritesheet' | 'image' | 'audio';
  url: string;
  dataUrl?: string; // for multi-file atlases
  frameConfig?: { frameWidth: number; frameHeight: number; start?: number; end?: number };
};

export const ATLAS_MANIFEST: AtlasEntry[] = [
  // Agents (placeholder spritesheet)
  {
    key: 'agent_sheet',
    type: 'spritesheet',
    url: '/assets/agent_sheet.png',
    frameConfig: { frameWidth: 32, frameHeight: 32 },
  },
  // Bug bot (placeholder)
  {
    key: 'bug_bot_sheet',
    type: 'spritesheet',
    url: '/assets/bug_bot_sheet.png',
    frameConfig: { frameWidth: 24, frameHeight: 24 },
  },
  // House variants by language (placeholder images)
  { key: 'house_js', type: 'image', url: '/assets/houses/house_js.png' },
  { key: 'house_py', type: 'image', url: '/assets/houses/house_py.png' },
  { key: 'house_go', type: 'image', url: '/assets/houses/house_go.png' },
  // Effects
  {
    key: 'sparkle',
    type: 'spritesheet',
    url: '/assets/effects/sparkle.png',
    frameConfig: { frameWidth: 16, frameHeight: 16 },
  },
];

export const PRELOAD_AUDIO: AtlasEntry[] = [
  { key: 'celebrate', type: 'audio', url: '/assets/audio/celebrate.mp3' },
];
