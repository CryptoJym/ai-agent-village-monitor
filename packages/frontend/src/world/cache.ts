import { hashToUnit } from './random';
import type { WorldMapCacheEntry, WorldMapData } from './types';

const STORAGE_KEY = 'ai-village-world-map-cache-v1';
const MAX_ENTRIES = 5;

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readEntries(): WorldMapCacheEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is WorldMapCacheEntry => Boolean(entry?.data?.seed));
  } catch {
    return [];
  }
}

function writeEntries(entries: WorldMapCacheEntry[]) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // ignore storage quota errors
  }
}

export function makeSignature(seed: string, villageIds: string[]): string {
  const normalized = villageIds.slice().sort().join('|');
  return `${seed}:${hashToUnit(normalized).toFixed(6)}`;
}

export function loadFromCache(seed: string, signature: string): WorldMapData | null {
  const entries = readEntries();
  const found = entries.find((entry) => entry.data.seed === seed && entry.signature === signature);
  return found ? found.data : null;
}

export function saveToCache(seed: string, signature: string, data: WorldMapData) {
  const entries = readEntries();
  const filtered = entries.filter(
    (entry) => entry.data.seed !== seed || entry.signature !== signature,
  );
  filtered.unshift({ signature, data });
  writeEntries(filtered);
}
