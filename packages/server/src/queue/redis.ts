import IORedis from 'ioredis';
import { config } from '../config';

let redisSingleton: IORedis | null = null;

export function getRedis(): IORedis | null {
  if (!config.REDIS_URL) return null;
  if (!redisSingleton) {
    redisSingleton = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }
  return redisSingleton;
}

export async function pingRedis(): Promise<boolean> {
  const client = getRedis();
  if (!client) return true; // no redis configured → treat as ok
  try {
    const res = await client.ping();
    return res?.toUpperCase() === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis() {
  if (redisSingleton) {
    try {
      await redisSingleton.quit();
    } catch {
      try { await redisSingleton.disconnect(); } catch {}
    }
    redisSingleton = null;
  }
}

