import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requireAuth, requireVillageRole } from '../auth/middleware';
import { sanitizeString } from '../middleware/sanitize';
import { enqueueHouseRepoAnalysis } from './repoAnalysisQueue';

export const housesRouter = Router();

// Input validation schemas
const CreateHouseSchema = z.object({
  villageId: z.string().min(1),
  repoName: z
    .string()
    .min(1)
    .max(200)
    .transform((v) => sanitizeString(v, { maxLen: 200 })),
  githubRepoId: z
    .string()
    .optional()
    .transform((v) => (v ? BigInt(v) : undefined)),
  primaryLanguage: z.string().optional(),
  stars: z.number().int().optional(),
  openIssues: z.number().int().optional(),
  commitSha: z.string().optional(),
  buildingSize: z.enum(['tiny', 'small', 'medium', 'large', 'huge']).optional(),
  complexity: z.number().int().min(1).max(100).optional(),
});

const UpdateHouseSchema = z.object({
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  spriteOrientation: z.string().optional(),
  spriteVariant: z.string().optional(),
  spriteScale: z.number().optional(),
  buildingSize: z.enum(['tiny', 'small', 'medium', 'large', 'huge']).optional(),
});

// List houses (with optional village filter)
housesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const villageId = req.query.villageId ? String(req.query.villageId) : undefined;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 500) : 100;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const where = villageId ? { villageId } : {};

    const [houses, total] = await Promise.all([
      prisma.house.findMany({
        where,
        include: {
          _count: {
            select: { rooms: true, agents: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.house.count({ where }),
    ]);

    res.json({
      items: houses,
      total,
      limit,
      offset,
    });
  } catch (e) {
    next(e);
  }
});

// Create house with repo analysis trigger
housesRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = CreateHouseSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid body',
        code: 'BAD_REQUEST',
        details: parsed.error.flatten(),
      });
    }

    const { villageId, repoName, githubRepoId, ...rest } = parsed.data;

    // Verify village exists and user has access
    const village = await prisma.village.findUnique({
      where: { id: villageId },
      include: { access: { where: { userId: String((req as any).user?.sub) } } },
    });

    if (!village) {
      return res.status(404).json({ error: 'Village not found', code: 'NOT_FOUND' });
    }

    if (!village.access.length) {
      return res.status(403).json({ error: 'No access to village', code: 'FORBIDDEN' });
    }

    // Generate deterministic seed from repo metadata
    const seed = githubRepoId ? `repo-${githubRepoId}` : `repo-${repoName}-${Date.now()}`;

    // Create house
    const house = await prisma.house.create({
      data: {
        villageId,
        repoName,
        githubRepoId,
        seed,
        ...rest,
      },
      include: {
        _count: {
          select: { rooms: true, agents: true },
        },
      },
    });

    // Trigger background repo analysis job to populate rooms + interior tilemap.
    // Best-effort: failures should not block house creation.
    try {
      await enqueueHouseRepoAnalysis({ houseId: house.id });
    } catch {
      // Ignore queue failures; UI can retry analysis via admin tooling later.
    }

    res.status(201).json(house);
  } catch (e) {
    next(e);
  }
});

// Get house with rooms and agents
housesRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);

    const house = await prisma.house.findUnique({
      where: { id },
      include: {
        rooms: {
          orderBy: { name: 'asc' },
        },
        agents: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                currentState: true,
                energy: true,
                frustration: true,
              },
            },
          },
        },
        village: {
          select: {
            id: true,
            orgName: true,
          },
        },
      },
    });

    if (!house) {
      return res.status(404).json({ error: 'House not found', code: 'NOT_FOUND' });
    }

    res.json(house);
  } catch (e) {
    next(e);
  }
});

// Get all rooms in a house
housesRouter.get('/:id/rooms', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);

    const house = await prisma.house.findUnique({
      where: { id },
      select: { id: true, villageId: true },
    });

    if (!house) {
      return res.status(404).json({ error: 'House not found', code: 'NOT_FOUND' });
    }

    const rooms = await prisma.room.findMany({
      where: { houseId: id },
      orderBy: [{ roomType: 'asc' }, { name: 'asc' }],
    });

    res.json(rooms);
  } catch (e) {
    next(e);
  }
});

// Get interior tilemap data
housesRouter.get('/:id/interior', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);

    const house = await prisma.house.findUnique({
      where: { id },
      select: {
        id: true,
        interiorWidth: true,
        interiorHeight: true,
        interiorTilemap: true,
        tilesetId: true,
      },
    });

    if (!house) {
      return res.status(404).json({ error: 'House not found', code: 'NOT_FOUND' });
    }

    if (!house.interiorTilemap) {
      return res.status(404).json({
        error: 'Interior not generated',
        code: 'NOT_FOUND',
        message: 'House interior has not been generated yet',
      });
    }

    res.json({
      width: house.interiorWidth,
      height: house.interiorHeight,
      tilemap: house.interiorTilemap,
      tilesetId: house.tilesetId,
    });
  } catch (e) {
    next(e);
  }
});

// Update house position/orientation
housesRouter.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const parsed = UpdateHouseSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid body',
        code: 'BAD_REQUEST',
        details: parsed.error.flatten(),
      });
    }

    // Check house exists and get villageId for auth
    const existing = await prisma.house.findUnique({
      where: { id },
      select: { villageId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'House not found', code: 'NOT_FOUND' });
    }

    // Check user has access to village
    const userId = String((req as any).user?.sub);
    const access = await prisma.villageAccess.findUnique({
      where: {
        villageId_userId: {
          villageId: existing.villageId,
          userId,
        },
      },
    });

    if (!access || (access.role !== 'owner' && access.role !== 'member')) {
      return res.status(403).json({ error: 'No access to house', code: 'FORBIDDEN' });
    }

    const updated = await prisma.house.update({
      where: { id },
      data: {
        ...parsed.data,
        lastMovedAt: new Date(),
        lastMovedBy: userId,
      },
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Delete house
housesRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);

    // Check house exists and get villageId for auth
    const existing = await prisma.house.findUnique({
      where: { id },
      select: { villageId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'House not found', code: 'NOT_FOUND' });
    }

    // Check user is owner of village
    const userId = String((req as any).user?.sub);
    const access = await prisma.villageAccess.findUnique({
      where: {
        villageId_userId: {
          villageId: existing.villageId,
          userId,
        },
      },
    });

    if (!access || access.role !== 'owner') {
      return res.status(403).json({
        error: 'Only village owners can delete houses',
        code: 'FORBIDDEN',
      });
    }

    // Delete house (cascade will delete rooms and agent associations)
    await prisma.house.delete({
      where: { id },
    });

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
