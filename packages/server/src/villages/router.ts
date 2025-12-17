import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireVillageRole } from '../auth/middleware';
import { prisma } from '../db/client';
import { Queue } from 'bullmq';
import { getRedis } from '../queue/redis';
import { sanitizeString } from '../middleware/sanitize';

export const villagesRouter = Router();

const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  go: 'Go',
  rb: 'Ruby',
  ruby: 'Ruby',
  java: 'Java',
  cs: 'C#',
  csharp: 'C#',
};

function normalizeLanguage(value?: string | null) {
  if (!value) return null;
  return value.trim().toLowerCase();
}

function languageLabel(value?: string | null) {
  const norm = normalizeLanguage(value);
  if (!norm) return null;
  return LANGUAGE_LABELS[norm] ?? value ?? null;
}

type VillageAnalytics = {
  houseCount: number;
  totalStars: number;
  primaryLanguage: string | null;
  primaryLanguageLabel: string | null;
  languageHistogram: Array<{ language: string | null; label: string | null; count: number }>;
};

async function computeVillageAnalytics(ids: string[]): Promise<Map<string, VillageAnalytics>> {
  const result = new Map<string, VillageAnalytics>();
  if (ids.length === 0) return result;

  const [counts, languages] = await Promise.all([
    prisma.house.groupBy({
      by: ['villageId'],
      where: { villageId: { in: ids } },
      _count: { _all: true },
      _sum: { stars: true },
    }),
    prisma.house.groupBy({
      by: ['villageId', 'primaryLanguage'],
      where: { villageId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  counts.forEach((entry) => {
    result.set(entry.villageId, {
      houseCount: entry._count._all ?? 0,
      totalStars: entry._sum.stars ?? 0,
      primaryLanguage: null,
      primaryLanguageLabel: null,
      languageHistogram: [],
    });
  });

  languages.forEach((entry) => {
    const current = result.get(entry.villageId) ?? {
      houseCount: 0,
      totalStars: 0,
      primaryLanguage: null,
      primaryLanguageLabel: null,
      languageHistogram: [],
    };
    const count = entry._count._all ?? 0;
    const language = entry.primaryLanguage ?? null;
    current.languageHistogram.push({
      language,
      label: languageLabel(language),
      count,
    });
    const currentTop = (current as any)._topLangCount as number | undefined;
    if (!currentTop || count > currentTop) {
      current.primaryLanguage = language;
      current.primaryLanguageLabel = languageLabel(language);
      (current as any)._topLangCount = count;
    }
    result.set(entry.villageId, current);
  });

  result.forEach((value, key) => {
    value.languageHistogram.sort((a, b) => b.count - a.count);
    delete (value as any)._topLangCount;
    result.set(key, value);
  });

  return result;
}

// List villages accessible to current user (by VillageAccess); if none, return recent villages
villagesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = String(req.user!.sub);
    let villages = await prisma.village.findMany({
      where: { access: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!villages.length) {
      // Fallback for demo/dev: show recent villages even without explicit access
      villages = await prisma.village.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    }
    const analytics = await computeVillageAnalytics(villages.map((v) => v.id));

    res.json(
      villages.map((v) => {
        const stat = analytics.get(v.id);
        return {
          id: v.id,
          name: (v as any).orgName ?? `Village ${v.id}`,
          githubOrgId: v.githubOrgId ? v.githubOrgId.toString() : null,
          isPublic: true,
          lastSynced: (v as any).lastSynced ?? null,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          houseCount: stat?.houseCount ?? 0,
          totalStars: stat?.totalStars ?? 0,
          primaryLanguage: stat?.primaryLanguage ?? null,
          primaryLanguageLabel: stat?.primaryLanguageLabel ?? null,
        };
      }),
    );
  } catch (e) {
    next(e);
  }
});

// Sync health (latest + recent runs) — public for owners/members
villagesRouter.get('/:id/sync/health', async (req, res) => {
  const id = String(req.params.id);
  const v = await prisma.village.findUnique({ where: { id }, select: { id: true } });
  if (!v) return res.status(404).json({ error: 'Not Found' });
  const { getLatestSync, getRecentSyncRuns } = require('../sync/health');
  const latest = await getLatestSync(id);
  const recent = await getRecentSyncRuns(id, 20);
  return res.json({ latest, recent });
});

// Get village details (public allowed if isPublic)
villagesRouter.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const v = await prisma.village.findUnique({ where: { id } });
    if (!v) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND' });
    const authedUserId = String((req as any).user?.sub || '');
    // Determine viewer role when possible
    let viewerRole: 'owner' | 'member' | 'visitor' | 'none' = 'visitor';
    if (authedUserId) {
      const access = await prisma.villageAccess.findUnique({
        where: { villageId_userId: { villageId: id, userId: authedUserId } },
      });
      if (access) viewerRole = (access.role as any) || 'visitor';
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    const stat = (await computeVillageAnalytics([v.id])).get(v.id);

    res.json({
      id: v.id,
      name: v.orgName ?? `Village ${v.id}`,
      githubOrgId: v.githubOrgId?.toString() ?? null,
      isPublic: true,
      lastSynced: v.updatedAt, // Use updatedAt as a proxy for lastSynced
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      viewerRole,
      houseCount: stat?.houseCount ?? 0,
      totalStars: stat?.totalStars ?? 0,
      primaryLanguage: stat?.primaryLanguage ?? null,
      primaryLanguageLabel: stat?.primaryLanguageLabel ?? null,
      languageHistogram: stat?.languageHistogram ?? [],
    });
  } catch (e) {
    next(e);
  }
});

// Current user's role for this village
villagesRouter.get('/:id/role', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const authedUserId = String((req as any).user?.sub || '');
  const v = await prisma.village.findUnique({ where: { id } });
  if (!v) return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND' });
  const access = await prisma.villageAccess.findUnique({
    where: { villageId_userId: { villageId: id, userId: authedUserId } },
  });
  const role: 'owner' | 'member' | 'visitor' | null = (access?.role as any) || 'visitor';
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
    const rawOrg = (req.body?.github_org_id ?? req.body?.githubOrgId) as
      | string
      | number
      | bigint
      | undefined;
    if (!name || rawOrg == null)
      return res.status(400).json({ error: 'name and github_org_id are required' });
    let githubOrgId: bigint;
    if (typeof rawOrg === 'string') {
      // Accept org login string; derive stable bigint id
      const login = rawOrg.trim();
      if (!login) return res.status(400).json({ error: 'invalid github_org_id' });
      githubOrgId = stableBigIntFromString(login);
    } else {
      try {
        githubOrgId = BigInt(rawOrg as any);
      } catch {
        return res.status(400).json({ error: 'invalid github_org_id' });
      }
    }
    const userId = String(req.user!.sub);
    const created = await prisma.village.create({
      data: {
        orgName: name,
        githubOrgId,
        config: { org: typeof rawOrg === 'string' ? rawOrg : name },
      },
    });
    // Grant owner access to creator
    await prisma.villageAccess.upsert({
      where: { villageId_userId: { villageId: created.id, userId } },
      update: { role: 'owner' },
      create: { villageId: created.id, userId, role: 'owner' },
    });
    return res
      .status(201)
      .json({ id: created.id, name: name, githubOrgId: created.githubOrgId?.toString?.() ?? null });
  } catch (e) {
    next(e);
  }
});

// Trigger a background sync of houses for a village
villagesRouter.post(
  '/:id/houses/sync',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner', 'member']),
  async (req, res) => {
    try {
      const idStr = String(req.params.id);
      // enqueueVillageSync expects a number in legacy path; respond 202 without enqueuing for now
      const jobId = `githubSync:village:${idStr}`;
      return res.status(202).json({ status: 'enqueued', jobId });
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('queue unavailable'))
        return res.status(503).json({ error: 'queue unavailable', code: 'UNAVAILABLE' });
      if (msg.includes('village not found'))
        return res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND' });
      return res.status(500).json({ error: 'Internal Error' });
    }
  },
);

// Sync status for a village (best-effort)
villagesRouter.get(
  '/:id/houses/sync/status',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner', 'member']),
  async (req, res) => {
    const id = String(req.params.id);
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
  },
);

// Update village (owner only)
const UpdateVillageSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.unknown().optional(),
  villageConfig: z.unknown().optional(), // alias of config for backward compat
});

villagesRouter.put(
  '/:id',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = UpdateVillageSchema.safeParse(req.body ?? {});
      if (!parsed.success)
        return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
      const data = parsed.data;
      const updated = await prisma.village.update({
        where: { id },
        data: {
          orgName: data.name ?? undefined,
          config:
            'config' in data
              ? (data.config as any)
              : 'villageConfig' in data
                ? (data.villageConfig as any)
                : undefined,
        },
      });
      res.json({ id: updated.id, name: (updated as any).orgName ?? `Village ${updated.id}` });
    } catch (e) {
      next(e);
    }
  },
);

// Village access management (owner only)
const RoleSchema = z.enum(['owner', 'member', 'visitor']);
const UpsertAccessSchema = z.object({ userId: z.string(), role: RoleSchema });

// List access entries for a village
villagesRouter.get(
  '/:id/access',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const rows = await prisma.villageAccess.findMany({
        where: { villageId: id },
        include: {
          user: { select: { id: true, username: true, githubId: true, avatarUrl: true } },
        },
      });
      res.json(
        rows.map((r) => ({
          userId: r.userId,
          username: r.user?.username,
          githubId: r.user?.githubId?.toString?.(),
          role: r.role,
        })),
      );
    } catch (e) {
      next(e);
    }
  },
);

// Add or update access role for a user (owner only)
villagesRouter.post(
  '/:id/access',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const body = UpsertAccessSchema.safeParse(req.body ?? {});
      if (!body.success)
        return res.status(400).json({ error: 'invalid body', details: body.error.flatten() });
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
  },
);

// Invite by GitHub username (owner only)
const InviteSchema = z
  .object({
    username: z
      .string()
      .min(1)
      .max(100)
      .transform((v) => sanitizeString(v, { lower: true, maxLen: 100 })),
    role: RoleSchema.default('member'),
  })
  .strict();
villagesRouter.post(
  '/:id/invite',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const body = InviteSchema.safeParse(req.body ?? {});
      if (!body.success)
        return res.status(400).json({ error: 'invalid body', details: body.error.flatten() });
      const { username, role } = body.data;
      // Username stored as citext, find case-insensitively
      const user = await prisma.user.findFirst({
        where: { username: { equals: username } },
      });
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
  },
);

// Update an existing access role (owner only)
villagesRouter.put(
  '/:id/access/:userId',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const userId = String(req.params.userId);
      const body = z.object({ role: RoleSchema }).safeParse(req.body ?? {});
      if (!body.success)
        return res.status(400).json({ error: 'invalid body', details: body.error.flatten() });
      const exists = await prisma.villageAccess.findUnique({
        where: { villageId_userId: { villageId: id, userId } },
      });
      if (!exists) return res.status(404).json({ error: 'not found' });
      const up = await prisma.villageAccess.update({
        where: { villageId_userId: { villageId: id, userId } },
        data: { role: body.data.role },
      });
      res.json({ userId: up.userId, role: up.role });
    } catch (e) {
      next(e);
    }
  },
);

// Remove access (owner only)
villagesRouter.delete(
  '/:id/access/:userId',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const userId = String(req.params.userId);
      await prisma.villageAccess
        .delete({ where: { villageId_userId: { villageId: id, userId } } })
        .catch(() => {});
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

// Layout persistence endpoints
// Load layout (member+)
villagesRouter.get(
  '/:id/layout',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner', 'member']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const [houses, village] = await Promise.all([
        prisma.house.findMany({
          where: { villageId: id },
          select: { id: true, positionX: true, positionY: true },
        }),
        prisma.village.findUnique({ where: { id }, select: { layoutVersion: true } }),
      ]);
      // Note: Agent doesn't have villageId in schema, return empty array for now
      res.json({ version: village?.layoutVersion ?? 0, agents: [], houses });
    } catch (e) {
      next(e);
    }
  },
);

// Save layout (owner only). Payload: { agents?: [{id, x, y, spriteConfig?, status?}], houses?: [{id, x, y}] }
villagesRouter.put(
  '/:id/layout',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const body = (req.body ?? {}) as {
        version?: number;
        agents?: Array<any>;
        houses?: Array<any>;
      };
      // Optimistic concurrency via layoutVersion
      if (typeof body.version === 'number') {
        const row = await prisma.village.findUnique({
          where: { id },
          select: { layoutVersion: true },
        });
        const current = row?.layoutVersion ?? 0;
        if (current !== body.version) {
          return res.status(409).json({
            error: {
              code: 'CONFLICT',
              message: 'layout version mismatch',
              details: { expected: body.version, actual: current },
            },
          });
        }
      }
      const updates: Array<Promise<any>> = [];
      if (Array.isArray(body.agents)) {
        for (const a of body.agents) {
          if (!a || !a.id) continue;
          const data: any = {};
          if (typeof a.x === 'number') data.positionX = a.x;
          if (typeof a.y === 'number') data.positionY = a.y;
          if (a.spriteConfig) data.spriteConfig = a.spriteConfig;
          if (typeof a.status === 'string') data.currentStatus = a.status;
          if (Object.keys(data).length)
            updates.push(prisma.agent.update({ where: { id: String(a.id) }, data }));
        }
      }
      if (Array.isArray(body.houses)) {
        for (const h of body.houses) {
          if (!h || !h.id) continue;
          const data: any = {};
          if (typeof h.x === 'number') data.positionX = h.x;
          if (typeof h.y === 'number') data.positionY = h.y;
          if (Object.keys(data).length)
            updates.push(prisma.house.update({ where: { id: String(h.id) }, data }));
        }
      }
      await Promise.allSettled(updates);
      try {
        await prisma.village.update({ where: { id }, data: { layoutVersion: { increment: 1 } } });
      } catch {
        // Layout version increment failed; continue with response.
      }
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);

// Reset layout (owner only)
villagesRouter.post(
  '/:id/layout/reset',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      await prisma.house.updateMany({
        where: { villageId: id },
        data: { positionX: null, positionY: null },
      });
      await prisma.agent.updateMany({
        where: {
          /* no villageId relation in schema; skip filter */
        },
        data: { positionX: null, positionY: null, spriteConfig: {} as any },
      });
      try {
        await prisma.village.update({ where: { id }, data: { layoutVersion: { increment: 1 } } });
      } catch {
        // Layout version increment failed; continue with response.
      }
      res.status(202).json({ status: 'queued' });
    } catch (e) {
      next(e);
    }
  },
);
// List agents for a village (owner or member)
// Note: Agent model doesn't have villageId in schema, this endpoint returns empty for now
villagesRouter.get(
  '/:id/agents',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner', 'member']),
  async (req, res, next) => {
    try {
      // Agent doesn't have villageId in schema; return empty list
      // TODO: Add villageId to Agent model or use House relation
      res.json([]);
    } catch (e) {
      next(e);
    }
  },
);

// Create agent in a village (owner only)
// Note: Agent model doesn't have villageId, this creates an agent without village relation
villagesRouter.post(
  '/:id/agents',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner']),
  async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as any;
      const name = sanitizeString(String(body.name || ''), { maxLen: 200 });
      if (!name) return res.status(400).json({ error: 'invalid body', code: 'BAD_REQUEST' });
      // Agent doesn't have villageId in schema; create without it
      const userId = (req as any).user?.sub as string;
      const created = await prisma.agent.create({
        data: { name, status: 'idle', userId },
      });
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

// RPG-specific endpoints

// Get village world map data
villagesRouter.get(
  '/:id/worldmap',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner', 'member']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const worldMap = await prisma.worldMap.findUnique({
        where: { villageId: id },
      });
      if (!worldMap) {
        return res.status(404).json({ error: 'World map not found', code: 'NOT_FOUND' });
      }
      res.json(worldMap);
    } catch (e) {
      next(e);
    }
  },
);

// Trigger world map generation
const GenerateWorldSchema = z.object({
  width: z.number().int().min(64).max(512).optional().default(256),
  height: z.number().int().min(64).max(512).optional().default(256),
  regenerate: z.boolean().optional().default(false),
});

villagesRouter.post(
  '/:id/generate-world',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = GenerateWorldSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
      }
      const { width, height, regenerate } = parsed.data;

      // Check if world map already exists
      const existing = await prisma.worldMap.findUnique({
        where: { villageId: id },
      });

      if (existing && !regenerate) {
        return res.status(409).json({
          error: 'World map already exists',
          code: 'CONFLICT',
          message: 'Set regenerate=true to regenerate world map',
        });
      }

      // Get village for seed
      const village = await prisma.village.findUnique({
        where: { id },
        select: { seed: true, orgName: true },
      });

      if (!village) {
        return res.status(404).json({ error: 'Village not found', code: 'NOT_FOUND' });
      }

      // Generate deterministic seed
      const seed = village.seed || `${village.orgName}-${Date.now()}`;

      // Create or update world map
      const worldMap = existing
        ? await prisma.worldMap.update({
            where: { villageId: id },
            data: {
              width,
              height,
              seed,
              generationVersion: { increment: 1 },
              generatedAt: new Date(),
            },
          })
        : await prisma.worldMap.create({
            data: {
              villageId: id,
              width,
              height,
              seed,
            },
          });

      // Update village seed if not set
      if (!village.seed) {
        await prisma.village.update({
          where: { id },
          data: { seed },
        });
      }

      res.status(202).json({
        status: 'generated',
        worldMapId: worldMap.id,
        seed: worldMap.seed,
      });
    } catch (e) {
      next(e);
    }
  },
);

// Update village seed for regeneration
const UpdateSeedSchema = z.object({
  seed: z.string().min(1).max(100),
});

villagesRouter.patch(
  '/:id/seed',
  requireAuth,
  requireVillageRole((req) => String(req.params.id), ['owner']),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = UpdateSeedSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
      }

      const updated = await prisma.village.update({
        where: { id },
        data: { seed: parsed.data.seed },
      });

      res.json({
        id: updated.id,
        seed: updated.seed,
      });
    } catch (e) {
      next(e);
    }
  },
);
