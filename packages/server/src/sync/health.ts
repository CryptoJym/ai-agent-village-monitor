import { getRedis } from '../queue/redis';

type SyncRun = {
  ts: number;
  repos: number;
  houses: number;
  created: number;
  updated: number;
  archived: number;
  discrepancy: number;
};

// In-memory fallback when Redis is not available (non-persistent)
const mem = new Map<string, SyncRun[]>();

export async function pushSyncRun(villageId: number | string, run: SyncRun, keep = 50) {
  const key = String(villageId);
  const r = getRedis();
  if (!r) {
    const list = mem.get(key) || [];
    list.push(run);
    list.sort((a, b) => b.ts - a.ts);
    mem.set(key, list.slice(0, keep));
    return;
  }
  const zkey = `sync:history:${key}`;
  const s = JSON.stringify(run);
  await r.zadd(zkey, run.ts, s);
  const len = await r.zcard(zkey);
  if (len > keep) {
    await r.zremrangebyrank(zkey, 0, len - keep - 1);
  }
  await r.set(`sync:latest:${key}`, s, 'EX', 3600 * 24);
}

export async function getLatestSync(villageId: number | string): Promise<SyncRun | null> {
  const key = String(villageId);
  const r = getRedis();
  if (!r) {
    const list = mem.get(key) || [];
    return list[0] ?? null;
    }
  try {
    const raw = await r.get(`sync:latest:${key}`);
    return raw ? (JSON.parse(raw) as SyncRun) : null;
  } catch {
    return null;
  }
}

export async function getRecentSyncRuns(villageId: number | string, limit = 20): Promise<SyncRun[]> {
  const key = String(villageId);
  const r = getRedis();
  if (!r) {
    const list = mem.get(key) || [];
    return list.slice(0, limit);
  }
  try {
    const zkey = `sync:history:${key}`;
    const arr = await r.zrevrange(zkey, 0, limit - 1);
    return arr.map((s) => JSON.parse(s) as SyncRun);
  } catch {
    return [];
  }
}

