const FNV_OFFSET = 2166136261 >>> 0;
const FNV_PRIME = 16777619;

function hashString(input: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

export function hashToUnit(value: string): number {
  return (hashString(value) & 0xfffffff) / 0xfffffff;
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRandom(seed: string): () => number {
  return mulberry32(hashString(seed));
}

function valueNoise(x: number, y: number, seed: string): number {
  const key = `${seed}:${Math.floor(x)}:${Math.floor(y)}`;
  return hashToUnit(key);
}

function smoothValueNoise(x: number, y: number, seed: string): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;

  const tl = valueNoise(x0, y0, seed);
  const tr = valueNoise(x0 + 1, y0, seed);
  const bl = valueNoise(x0, y0 + 1, seed);
  const br = valueNoise(x0 + 1, y0 + 1, seed);

  const top = tl + xf * (tr - tl);
  const bottom = bl + xf * (br - bl);
  return top + yf * (bottom - top);
}

export interface NoiseOptions {
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
  scale?: number;
}

const DEFAULT_NOISE: Required<NoiseOptions> = {
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
  scale: 0.05,
};

export function fractalNoise2D(x: number, y: number, seed: string, options?: NoiseOptions): number {
  const opts = { ...DEFAULT_NOISE, ...(options || {}) };
  let amplitude = 1;
  let frequency = opts.scale;
  let value = 0;
  let totalAmplitude = 0;

  for (let octave = 0; octave < opts.octaves; octave++) {
    const noise = smoothValueNoise(x * frequency, y * frequency, `${seed}:${octave}`);
    value += noise * amplitude;
    totalAmplitude += amplitude;
    amplitude *= opts.persistence;
    frequency *= opts.lacunarity;
  }

  return totalAmplitude === 0 ? 0 : value / totalAmplitude;
}

export function jitter(value: number, amount: number, seed: string): number {
  const offset = hashToUnit(`${seed}:${value}`) * 2 - 1;
  return value + offset * amount;
}
