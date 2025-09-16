import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireVillageRole } from '../auth/middleware';
import { enqueueVillageSync } from './sync';
import { prisma } from '../db/client';
import { Queue } from 'bullmq';
import { getRedis } from '../queue/redis';

export const villagesRouter = Router();

// List villages accessible to current user
villagesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.user!.sub);
    const villages = await prisma.village.findMany({
      where: { OR: [{ ownerId: userId }, { access: { some: { userId } } }] },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      villages.map((v) => ({
        id: v.id,
        name: v.name,
        githubOrgId: v.githubOrgId.toString(),
        isPublic: v.isPublic,
        lastSynced: v.lastSynced,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }))
    );
  } catch (e) {
    next(e);
  }
});

// Sync health (latest + recent runs) — public for owners/members; public visitors can read if village isPublic
villagesRouter.get('/:id/sync/health', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const v = await prisma.village.findUnique({ where: { id }, select: { isPublic: true } });
  if (!v) return res.status(404).json({ error: 'Not Found' });
  const authedUserId = Number((req as any).user?.sub || NaN);
  if (!v.isPublic) {
    if (!Number.isFinite(authedUserId)) return res.status(401).json({ error: 'unauthorized' });
    const access = await prisma.villageAccess.findUnique({ where: { villageId_userId: { villageId: id, userId: authedUserId } } });
    if (!access) return res.status(403).json({ error: 'forbidden' });
  }
  const { getLatestSync, getRecentSyncRuns } = require('../sync/health');
  const latest = await getLatestSync(id);
  const recent = await getRecentSyncRuns(id, 20);
  return res.json({ latest, recent });
});

// Get village details (public allowed if isPublic)
villagesRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const v = await prisma.village.findUnique({ where: { id } });
    if (!v) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND' });
    const authedUserId = Number((req as any).user?.sub || NaN);
    // Determine viewer role when possible
    let viewerRole: 'owner' | 'member' | 'visitor' | 'none' = 'none';
    if (Number.isFinite(authedUserId)) {
      if ((v as any).ownerId === authedUserId) viewerRole = 'owner';
      else {
        const access = await prisma.villageAccess.findUnique({ where: { villageId_userId: { villageId: id, userId: authedUserId } } });
        if (access) viewerRole = (['owner','member','visitor'] as const).includes(access.role as any) ? (access.role as any) : 'visitor';
        else if (v.isPublic) viewerRole = 'visitor';
      }
    } else if (v.isPublic) {
      viewerRole = 'visitor';
    }
    // If not public, enforce auth and membership; if public, set light caching
    if (!v.isPublic) {
      if (!Number.isFinite(authedUserId)) return res.status(401).json({ error: 'unauthorized' });
      if (viewerRole === 'none') return res.status(403).json({ error: 'forbidden' });
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60');
    }
    if (v.isPublic) res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      id: v.id,
      name: (v as any).name ?? (v as any).orgName ?? `Village ${v.id}`,
      githubOrgId: v.githubOrgId.toString(),
      isPublic: v.isPublic,
      lastSynced: v.lastSynced,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      viewerRole,
    });
  } catch (e) {
    next(e);
  }
});

// Current user's role for this village
villagesRouter.get('/:id/role', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id', code: 'BAD_REQUEST' });
  const authedUserId = Number((req as any).user?.sub || NaN);
  if (!Number.isFinite(authedUserId)) return res.status(401).json({ error: 'unauthorized' });
  const v = await prisma.village.findUnique({ where: { id } });
  if (!v) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND' });
  let role: 'owner' | 'member' | 'visitor' | null = null;
  if ((v as any).ownerId === authedUserId) role = 'owner';
  else {
    const access = await prisma.villageAccess.findUnique({ where: { villageId_userId: { villageId: id, userId: authedUserId } } });
    if (access) role = (['owner','member','visitor'] as const).includes(access.role as any) ? (access.role as any) : 'visitor';
    else if (v.isPublic) role = 'visitor';
  }
  return res.json({ role });
});

function stableBigIntFromString(s: string): bigint {
  let h = 0n;
  const MOD = (1n << 63n) - 1n;
  for (let i = 0; i < s.length; i++) {
    h = (h * 131n + BigInt(s.charCodeAt(i))) % MOD;
  }
  return h === 0n ? 1n : h;
}

// Create village (owner = current user)
villagesRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const name: string = String(req.body?.name || '').trim();
    const rawOrg = (req.body?.github_org_id ?? req.body?.githubOrgId) as string | number | bigint | undefined;
    if (!name || rawOrg == null) return res.status(400).json({ error: 'name and github_org_id are required' });
    let githubOrgId: bigint;
    if (typeof rawOrg === 'string') {
      // Accept org login string; derive stable bigint id
      const login = rawOrg.trim();
      if (!login) return res.status(400).json({ error: 'invalid github_org_id' });
      githubOrgId = stableBigIntFromString(login);
    } else {
      try { githubOrgId = BigInt(rawOrg as any); } catch { return res.status(400).json({ error: 'invalid github_org_id' }); }
    }
    const ownerId = Number(req.user!.sub);
    const created = await prisma.village.create({
      data: { name, githubOrgId, ownerId, isPublic: false, villageConfig: { org: typeof rawOrg === 'string' ? rawOrg : name } },
    });
    return res.status(201).json({ id: created.id, name: created.name, githubOrgId: created.githubOrgId.toString() });
  } catch (e) {
    next(e);
  }
});

// Trigger a background sync of houses for a village
villagesRouter.post('/:id/houses/sync', requireAuth, requireVillageRole((req) => Number(req.params.id), ['owner', 'member']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { jobId } = await enqueueVillageSync(id);
    return res.status(202).json({ status: 'enqueued', jobId });
  } catch (e: any) {
    const msg = (e?.message || '').toLowerCase();
    if (msg.includes('queue unavailable')) return res.status(503).json({ error: 'queue unavailable', code: 'UNAVAILABLE' });
    if (msg.includes('village not found')) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND' });
    return res.status(500).json({ error: 'Internal Error' });
  }
});

// Sync status for a village (best-effort)
villagesRouter.get('/:id/houses/sync/status', requireAuth, requireVillageRole((req) => Number(req.params.id), ['owner', 'member']), async (req, res) => {
  const id = Number(req.params.id);
  const connection = getRedis();
  if (!connection) return res.json({ state: 'unknown', progress: 0 });
  try {
    const q = new Queue('github-sync', { connection });
    const jobId = `githubSync:village:${id}`;
    const job = await q.getJob(jobId);
    if (!job) return res.json({ state: 'idle', progress: 0 });
    const state = await job.getState();
    const progress = typeof (job as any).progress === 'number' ? (job as any).progress : 0;
    return res.json({ state, progress });
  } catch {
    return res.json({ state: 'unknown', progress: 0 });
  }
});

// Update village (owner only)
const UpdateVillageSchema = z.object({
  name: z.string().min(1).optional(),
  isPublic: z.boolean().optional(),
  villageConfig: z.unknown().optional(),
});

villagesRouter.put('/:id', requireAuth, requireVillageRole((req) => Number(req.params.id), ['owner']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = UpdateVillageSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
    const data = parsed.data;
    const updated = await prisma.village.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        isPublic: typeof data.isPublic === 'boolean' ? data.isPublic : undefined,
        villageConfig: 'villageConfig' in data ? (data.villageConfig as any) : undefined,
      },
    });
    res.json({ id: updated.id, name: updated.name, isPublic: updated.isPublic });
  } catch (e) {
    next(e);
  }
});

// Village access management (owner only)
const RoleSchema = z.enum(['owner', 'member', 'visitor']);
const UpsertAccessSchema = z.object({ userId: z.number().int().positive(), role: RoleSchema });

// List access entries for a village
villagesRouter.get('/:id/access', requireAuth, requireVillageRole((req) => Number(req.params.id), ['owner']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await prisma.villageAccess.findMany({
      where: { villageId: id },
      include: { user: { select: { id: true, username: true, githubId: true, avatarUrl: true } } },
      orderBy: { grantedAt: 'desc' },
    });
    res.json(rows.map((r) => ({ userId: r.userId, username: r.user?.username, githubId: r.user?.githubId?.toString?.(), role: r.role, grantedAt: r.grantedAt })));
  } catch (e) {
    next(e);
  }
});

// Add or update access role for a user (owner only)
villagesRouter.post('/:id/access', requireAuth, requireVillageRole((req) => Number(req.params.id), ['owner']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = UpsertAccessSchema.safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: 'invalid body', details: body.error.flatten() });
    const { userId, role } = body.data;
    const up = await prisma.villageAccess.upsert({
      where: { villageId_userId: { villageId: id, userId } },
      update: { role },
      create: { villageId: id, userId, role },
    });
    res.status(201).json({ userId: up.userId, role: up.role });
  } catch (e) {
    next(e);
  }
});

// Invite by GitHub username (owner only)
const InviteSchema = z.object({ username: z.string().min(1), role: RoleSchema.default('member') });
villagesRouter.post('/:id/invite', requireAuth, requireVillageRole((req) => Number(req.params.id), ['owner']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = InviteSchema.safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: 'invalid body', details: body.error.flatten() });
    const { username, role } = body.data;
    // Username stored as citext, find case-insensitively
    const user = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' as any } } });
    if (!user) return res.status(404).json({ error: 'user not found', code: 'NOT_FOUND' });
    const row = await prisma.villageAccess.upsert({
      where: { villageId_userId: { villageId: id, userId: user.id } },
      update: { role },
      create: { villageId: id, userId: user.id, role },
    });
    res.status(201).json({ userId: row.userId, role: row.role, username: user.username });
  } catch (e) {
    next(e);
  }
});

// Update an existing access role (owner only)
villagesRouter.put('/:id/access/:userId', requireAuth, requireVillageRole((req) => Number(req.params.id), ['owner']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.params.userId);
    const body = z.object({ role: RoleSchema }).safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: 'invalid body', details: body.error.flatten() });
    const exists = await prisma.villageAccess.findUnique({ where: { villageId_userId: { villageId: id, userId } } });
    if (!exists) return res.status(404).json({ error: 'not found' });
    const up = await prisma.villageAccess.update({ where: { villageId_userId: { villageId: id, userId } }, data: { role: body.data.role } });
    res.json({ userId: up.userId, role: up.role });
  } catch (e) {
    next(e);
  }
});

  // Remove access (owner only)
  villagesRouter.delete('/:id/access/:userId', requireAuth, requireVillageRole((req) => Number(req.params.id), ['owner']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.params.userId);
    await prisma.villageAccess.delete({ where: { villageId_userId: { villageId: id, userId } } }).catch(() => {});
    res.status(204).end();
  } catch (e) {
    next(e);
  }
  });

// Layout persistence endpoints
// Load layout (member+)
villagesRouter.get('/:id/layout', requireAuth, requireVillageRole((req) => Number(req.params.id), ['owner', 'member']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const agents = await prisma.agent.findMany({ where: { villageId: String(id) }, select: { id: true, positionX: true, positionY: true, spriteConfig: true, currentStatus: true } });
    const houses = await prisma.house.findMany({ where: { villageId: String(id) }, select: { id: true, positionX: true, positionY: true } });
    res.json({ agents, houses });
  } catch (e) { next(e); }
});

// Save layout (owner only). Payload: { agents?: [{id, x, y, spriteConfig?, status?}], houses?: [{id, x, y}] }
villagesRouter.put('/:id/layout', requireAuth, requireVillageRole((req) => Number(req.params.id), ['owner']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = (req.body ?? {}) as { agents?: Array<any>; houses?: Array<any> };
    const updates: Array<Promise<any>> = [];
    if (Array.isArray(body.agents)) {
      for (const a of body.agents) {
        if (!a || !a.id) continue;
        const data: any = {};
        if (typeof a.x === 'number') data.positionX = a.x;
        if (typeof a.y === 'number') data.positionY = a.y;
        if (a.spriteConfig) data.spriteConfig = a.spriteConfig;
        if (typeof a.status === 'string') data.currentStatus = a.status;
        if (Object.keys(data).length) updates.push(prisma.agent.update({ where: { id: String(a.id) }, data }));
      }
    }
    if (Array.isArray(body.houses)) {
      for (const h of body.houses) {
        if (!h || !h.id) continue;
        const data: any = {};
        if (typeof h.x === 'number') data.positionX = h.x;
        if (typeof h.y === 'number') data.positionY = h.y;
        if (Object.keys(data).length) updates.push(prisma.house.update({ where: { id: String(h.id) }, data }));
      }
    }
    await Promise.allSettled(updates);
    res.status(204).end();
  } catch (e) { next(e); }
});

// Reset layout (owner only)
villagesRouter.post('/:id/layout/reset', requireAuth, requireVillageRole((req) => Number(req.params.id), ['owner']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.house.updateMany({ where: { villageId: String(id) }, data: { positionX: null, positionY: null } });
    await prisma.agent.updateMany({ where: { /* no villageId relation in schema; skip filter */ }, data: { positionX: null, positionY: null, spriteConfig: null } });
    res.status(202).json({ status: 'queued' });
  } catch (e) { next(e); }
});
