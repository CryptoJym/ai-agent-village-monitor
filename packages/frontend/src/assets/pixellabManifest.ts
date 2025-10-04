import { pixellabAnimationMetadata } from './pixellabMetadata';
export {
  pixellabTileMetadata,
  pixellabInteriorMetadata,
  type PixellabTileMetadata,
  type PixellabInteriorMetadata,
} from './pixellabMetadata';

export type Direction4 = 'south' | 'west' | 'east' | 'north';
export type Direction8 =
  | 'south'
  | 'south-west'
  | 'west'
  | 'north-west'
  | 'north'
  | 'north-east'
  | 'east'
  | 'south-east';

export interface AnimationConfig {
  name: string;
  frameCount: number;
  frameRate: number;
  repeat: number;
  framesByDirection?: Record<string, number>;
}

export interface CharacterManifest {
  key: string;
  basePath: string;
  preview: string;
  category: 'agent' | 'emote' | 'bug-bot';
  directions: ReadonlyArray<Direction4 | Direction8>;
  animation?: AnimationConfig;
  [key: string]: unknown; // Allow indexing with string
}

type AssetCategory = keyof typeof pixellabAnimationMetadata;

function deriveAnimationMetadata(
  category: AssetCategory,
  key: string,
  animationName: string,
): { frameCount: number; framesByDirection: Record<string, number> } | undefined {
  const categoryData = pixellabAnimationMetadata[category];
  if (!categoryData) return undefined;
  const animationData = (categoryData as Record<string, any>)[key]?.[animationName];
  if (!animationData) return undefined;
  const framesByDirection: Record<string, number> = {};
  for (const [direction, count] of Object.entries(animationData)) {
    if (typeof count === 'number' && count > 0) {
      framesByDirection[direction] = count;
    }
  }
  const counts = Object.values(framesByDirection);
  if (counts.length === 0) return undefined;
  const frameCount = Math.min(...counts);
  return { frameCount, framesByDirection };
}

function withAnimation(
  defaults: AnimationConfig | undefined,
  assetDir: Extract<AssetCategory, 'agents' | 'emotes' | 'bug-bots'>,
  key: string,
): AnimationConfig | undefined {
  if (!defaults) return undefined;
  const metadata = deriveAnimationMetadata(assetDir, key, defaults.name);
  if (!metadata) {
    return undefined;
  }
  return {
    ...defaults,
    frameCount: metadata.frameCount,
    framesByDirection: metadata.framesByDirection,
  };
}

const DIRECTION8: Direction8[] = [
  'south',
  'south-west',
  'west',
  'north-west',
  'north',
  'north-east',
  'east',
  'south-east',
];

const DIRECTION4: Direction4[] = ['south', 'west', 'east', 'north'];

const DEFAULT_AGENT_ANIMATION: AnimationConfig = {
  name: 'walking',
  frameCount: 6,
  frameRate: 8,
  repeat: -1,
};

function getAvailableDirections(
  category: Extract<AssetCategory, 'agents' | 'emotes' | 'bug-bots'>,
  key: string,
  fallback: ReadonlyArray<Direction4 | Direction8>,
): ReadonlyArray<Direction4 | Direction8> {
  const metadata = (pixellabAnimationMetadata[category] as Record<string, any>)?.[key];
  if (!metadata) return fallback;
  const dirSet = new Set<Direction4 | Direction8>();
  for (const framesByDirection of Object.values(metadata)) {
    if (!framesByDirection) continue;
    for (const dir of Object.keys(framesByDirection)) {
      dirSet.add(dir as Direction4 | Direction8);
    }
  }
  return dirSet.size > 0
    ? (Array.from(dirSet) as ReadonlyArray<Direction4 | Direction8>)
    : fallback;
}

const DEFAULT_EMOTE_CALM: AnimationConfig = {
  name: 'breathing-idle',
  frameCount: 6,
  frameRate: 6,
  repeat: -1,
};

const DEFAULT_EMOTE_ACTION: AnimationConfig = {
  name: 'fight-stance-idle-8-frames',
  frameCount: 8,
  frameRate: 8,
  repeat: -1,
};

const DEFAULT_EMOTE_FIREBALL: AnimationConfig = {
  name: 'fireball',
  frameCount: 8,
  frameRate: 10,
  repeat: 0,
};

const DEFAULT_EMOTE_PUNCH: AnimationConfig = {
  name: 'cross-punch',
  frameCount: 8,
  frameRate: 10,
  repeat: -1,
};

export const agentManifests: CharacterManifest[] = [
  'scholar',
  'artisan',
  'explorer',
  'guardian',
  'mystic',
  'signal-weaver',
].map((key) => ({
  key,
  category: 'agent' as const,
  basePath: `/assets/agents/${key}`,
  preview: `/assets/agents/${key}/preview.png`,
  directions: getAvailableDirections('agents', key, DIRECTION8) as ReadonlyArray<Direction8>,
  animation: withAnimation(DEFAULT_AGENT_ANIMATION, 'agents', key),
}));

export const emoteManifests: CharacterManifest[] = [
  { key: 'awakening', animation: DEFAULT_EMOTE_CALM },
  { key: 'deep-thinking', animation: DEFAULT_EMOTE_CALM },
  { key: 'flow-state', animation: DEFAULT_EMOTE_ACTION },
  { key: 'communication', animation: DEFAULT_EMOTE_CALM },
  { key: 'learning-growth', animation: DEFAULT_EMOTE_CALM },
  { key: 'frustration', animation: DEFAULT_EMOTE_PUNCH },
  { key: 'eureka', animation: DEFAULT_EMOTE_FIREBALL },
  { key: 'dreaming', animation: DEFAULT_EMOTE_CALM },
].map(({ key, animation }) => ({
  key,
  category: 'emote' as const,
  basePath: `/assets/emotes/${key}`,
  preview: `/assets/emotes/${key}/preview.png`,
  directions: getAvailableDirections('emotes', key, DIRECTION4) as ReadonlyArray<Direction4>,
  animation: withAnimation(animation, 'emotes', key),
}));

const DEFAULT_BUG_CALM = DEFAULT_EMOTE_CALM;
const DEFAULT_BUG_ACTION = DEFAULT_EMOTE_ACTION;
const DEFAULT_BUG_FIREBALL = DEFAULT_EMOTE_FIREBALL;

export const bugBotManifests: CharacterManifest[] = [
  { key: 'spawn', animation: DEFAULT_BUG_CALM },
  { key: 'assigned', animation: DEFAULT_BUG_CALM },
  { key: 'progress', animation: DEFAULT_BUG_ACTION },
  { key: 'resolved', animation: DEFAULT_BUG_FIREBALL },
].map(({ key, animation }) => ({
  key,
  category: 'bug-bot' as const,
  basePath: `/assets/bug-bots/${key}`,
  preview: `/assets/bug-bots/${key}/preview.png`,
  directions: DIRECTION4,
  animation: withAnimation(animation, 'bug-bots', key),
}));

export const pixellabManifest = {
  agents: agentManifests,
  emotes: emoteManifests,
  bugBots: bugBotManifests,
};

export type AgentArchetype = (typeof agentManifests)[number]['key'];
export type EmoteKey = (typeof emoteManifests)[number]['key'];
export type BugBotKey = (typeof bugBotManifests)[number]['key'];

export function findAgentManifest(key: string): CharacterManifest | undefined {
  return agentManifests.find((entry) => entry.key === key);
}

export function getRandomAgentManifest(): CharacterManifest {
  return agentManifests[Math.floor(Math.random() * agentManifests.length)];
}
