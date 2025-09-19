import type { Request, Response } from 'express';
import { getRedis } from '../queue/redis';
import { inc } from '../metrics';

const localSeen = new Map<string, NodeJS.Timeout>();

function localRemember(id: string, ttlMs: number): boolean {
  if (localSeen.has(id)) return false;
  const t = setTimeout(() => {
    localSeen.delete(id);
  }, ttlMs);
  localSeen.set(id, t);
  return true;
}

export async function rememberDelivery(
  deliveryId: string,
  ttlMs = 24 * 60 * 60 * 1000,
): Promise<boolean> {
  if (!deliveryId) return true;
  try {
    const r = getRedis();
    if (!r) return localRemember(deliveryId, ttlMs);
    // @ts-ignore ioredis allows extended args for PX/NX
    const ok = await r.set(`gh:delivery:${deliveryId}`, '1', 'PX', ttlMs, 'NX');
    return !!ok;
  } catch {
    return localRemember(deliveryId, ttlMs);
  }
}

// Express helper to short-circuit duplicates after signature verification
export async function shortCircuitDuplicate(req: Request, res: Response): Promise<boolean> {
  const delivery = String(req.header('x-github-delivery') || '');
  inc('webhook_seen_total', { route: 'github' }, 1);
  const first = await rememberDelivery(delivery);
  if (!first) {
    inc('webhook_duplicate_total', { route: 'github' }, 1);
    res.status(202).json({ ok: true, deduped: true });
    return true;
  }
  return false;
}
