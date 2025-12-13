import crypto from 'crypto';
import { getPrisma } from '../db';
import { getRedis } from '../queue/redis';
import { audit } from '../audit/logger';

// Distributed per-agent lock using Redis; falls back to process-local chaining.
const localLocks = new Map<string, Promise<void>>();

async function withAgentLock(agentId: number | string, fn: () => Promise<any>, ttlMs = 15000) {
  const key = `lock:agent:${agentId}:session`;
  const redis = getRedis();
  if (!redis) {
    const prev = localLocks.get(key) || Promise.resolve();
    let release: () => void;
    const p = new Promise<void>((res) => {
      release = res;
    });
    localLocks.set(
      key,
      prev.then(() => p),
    );
    try {
      return await fn();
    } finally {
      release!();
      const next = localLocks.get(key);
      if (next === p) localLocks.delete(key);
    }
  }
  const token = crypto.randomBytes(16).toString('hex');
  const start = Date.now();
  while (Date.now() - start < 5000) {
    // try up to 5s to acquire
    // @ts-ignore ioredis allows extended args
    const ok = await redis.set(key, token, 'PX', ttlMs, 'NX');
    if (ok) {
      try {
        return await fn();
      } finally {
        try {
          const v = await redis.get(key);
          if (v === token) await redis.del(key);
        } catch {
          // Ignore Redis cleanup failure; lock will expire via TTL.
        }
      }
    }
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 50));
  }
  return fn();
}

export async function ensureActiveSession(agentId: number | string, opts?: { restart?: boolean }) {
  const prisma = getPrisma();
  if (!prisma) return { id: 0 } as any;
  const agentIdStr = String(agentId);
  const { restart } = opts || {};
  return withAgentLock(agentIdStr, async () => {
    return prisma.$transaction(async (tx: any) => {
      const existing = await tx.agentSession.findFirst({
        where: { agentId: agentIdStr, endedAt: null },
      });
      if (existing && !restart) return existing;
      if (existing && restart) {
        await tx.agentSession.update({ where: { id: existing.id }, data: { endedAt: new Date() } });
      }
      const created = await tx.agentSession.create({
        data: { agentId: agentIdStr, startedAt: new Date(), endedAt: null },
      });
      audit.log('session.created', { agentId: agentIdStr, sessionId: created.id });
      return created;
    });
  });
}

export async function getOrCreateActiveSession(agentId: number | string) {
  return ensureActiveSession(agentId, { restart: false });
}

export async function endActiveSession(agentId: number | string) {
  const prisma = getPrisma();
  if (!prisma) return;
  const agentIdStr = String(agentId);
  const existing = await prisma.agentSession.findFirst({
    where: { agentId: agentIdStr, endedAt: null },
  });
  if (!existing) return;
  await prisma.agentSession.update({ where: { id: existing.id }, data: { endedAt: new Date() } });
  audit.log('session.ended', { agentId: agentIdStr, sessionId: existing.id });
}

export async function appendEvent(sessionId: number | string, eventType: string, content?: string) {
  const prisma = getPrisma();
  if (!prisma) return;
  const sid = String(sessionId);
  try {
    const session = await prisma.agentSession.findUnique({ where: { id: sid } });
    const agentId = session?.agentId ?? null;
    if (!agentId) return;
    const message = content ? `${eventType}: ${content}` : eventType;
    await prisma.workStreamEvent.create({ data: { agentId, message } });
    audit.log('session.event', { sessionId: sid, agentId, eventType });
  } catch {
    // swallow to avoid breaking worker paths
  }
}
