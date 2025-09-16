import { getRedis } from '../queue/redis';
import { inc } from '../metrics';

// Lightweight in-process fallback cache for when Redis is not configured.
// Only used in development/test when REDIS_URL is absent.
type Entry = { v: string; exp: number };
const mem: Map<string, Entry> = new Map();

function now() {
  return Date.now();
}

function memGetRaw(key: string): string | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.exp > 0 && e.exp < now()) {
    mem.delete(key);
    return null;
  }
  return e.v;
}

function memSetRaw(key: string, json: string, ttlSec?: number) {
  const exp = ttlSec && ttlSec > 0 ? now() + ttlSec * 1000 : 0;
  mem.set(key, { v: json, exp });
}

export async function cacheGetJSON<T = unknown>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) {
    const raw = memGetRaw(key);
    if (raw == null) return null;
    try {
      inc('cache_hit', { store: 'memory' });
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  try {
    const raw = await r.get(key);
    if (!raw) {
      inc('cache_miss', { store: 'redis' });
      return null;
    }
    inc('cache_hit', { store: 'redis' });
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJSON(key: string, value: unknown, ttlSec?: number): Promise<boolean> {
  const r = getRedis();
  const raw = JSON.stringify(value);
  if (!r) {
    memSetRaw(key, raw, ttlSec);
    inc('cache_set', { store: 'memory' });
    return true;
  }
  try {
    if (ttlSec && ttlSec > 0) {
      await r.set(key, raw, 'EX', ttlSec);
    } else {
      await r.set(key, raw);
    }
    inc('cache_set', { store: 'redis' });
    return true;
  } catch {
    return false;
  }
}

export async function cacheDel(key: string): Promise<boolean> {
  const r = getRedis();
  if (!r) {
    const ok = mem.delete(key);
    if (ok) inc('cache_invalidate', { store: 'memory' });
    return ok;
  }
  try {
    await r.del(key);
    inc('cache_invalidate', { store: 'redis' });
    return true;
  } catch {
    return false;
  }
}

// Convenience helper: wrap a fetcher with cache get/set.
export async function withCache<T>(key: string, ttlSec: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = await cacheGetJSON<T>(key);
  if (hit !== null) return hit as T;
  const value = await fetcher();
  // Best-effort set; ignore failures
  try { await cacheSetJSON(key, value, ttlSec); } catch {}
  return value;
}
