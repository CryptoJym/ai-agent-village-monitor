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
}

export interface CharacterManifest {
  key: string;
  basePath: string;
  preview: string;
  category: 'agent' | 'emote' | 'bug-bot';
  directions: ReadonlyArray<Direction4 | Direction8>;
  animation?: AnimationConfig;
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
  directions: DIRECTION8,
  animation: DEFAULT_AGENT_ANIMATION,
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
  directions: DIRECTION4,
  animation,
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
  animation,
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
