import { getRedis } from '../queue/redis';

const memory = new Map<string, number>();

export async function isDuplicate(key: string, ttlSec = 600): Promise<boolean> {
  const now = Date.now();
  const client = getRedis();
  try {
    if (client) {
      const exists = await client.exists(key);
      if (exists) return true;
      await client.set(key, '1', 'EX', ttlSec);
      return false;
    }
  } catch {
    // Redis unavailable; fall back to in-memory dedupe.
  }
  // In-memory fallback
  // purge old
  for (const [k, ts] of memory.entries()) if (now - ts > ttlSec * 1000) memory.delete(k);
  if (memory.has(key)) return true;
  memory.set(key, now);
  return false;
}
