import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requireAuth } from '../auth/middleware';
import { sanitizeString } from '../middleware/sanitize';

export const roomsRouter = Router();

// Zod validation schemas
const RoomTypeSchema = z.enum([
  'entrance',
  'hallway',
  'workspace',
  'library',
  'vault',
  'laboratory',
  'archive',
]);

const ModuleTypeSchema = z.enum([
  'component',
  'service',
  'repository',
  'controller',
  'utility',
  'config',
  'type_def',
  'test',
  'asset',
  'root',
]);

const CreateRoomSchema = z.object({
  houseId: z.string().min(1),
  name: z
    .string()
    .min(1)
    .max(200)
    .transform((v) => sanitizeString(v, { maxLen: 200 })),
  roomType: RoomTypeSchema.default('workspace'),
  moduleType: ModuleTypeSchema.optional(),
  modulePath: z.string().max(500).optional(),
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  doors: z.array(z.unknown()).optional(),
  corridorData: z.unknown().optional(),
  decorations: z.array(z.unknown()).optional(),
  fileCount: z.number().int().min(0).optional(),
  totalSize: z.number().int().min(0).optional(),
  complexity: z.number().int().min(1).max(10).optional(),
  imports: z.array(z.string()).optional(),
  exports: z.array(z.string()).optional(),
});

const UpdateRoomSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .transform((v) => sanitizeString(v, { maxLen: 200 }))
    .optional(),
  roomType: RoomTypeSchema.optional(),
  moduleType: ModuleTypeSchema.optional(),
  modulePath: z.string().max(500).optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  doors: z.array(z.unknown()).optional(),
  corridorData: z.unknown().optional(),
  decorations: z.array(z.unknown()).optional(),
  fileCount: z.number().int().min(0).optional(),
  totalSize: z.number().int().min(0).optional(),
  complexity: z.number().int().min(1).max(10).optional(),
  imports: z.array(z.string()).optional(),
  exports: z.array(z.string()).optional(),
});

const UpdateDecorationsSchema = z.object({
  decorations: z.array(
    z.object({
      type: z.string(),
      x: z.number().int(),
      y: z.number().int(),
      tileId: z.number().int().optional(),
      rotation: z.number().int().min(0).max(3).optional(),
      metadata: z.record(z.any()).optional(),
    }),
  ),
});

// Helper function to check house access
async function checkHouseAccess(
  houseId: string,
  userId: string,
  requiredRoles: ('owner' | 'member')[] = ['owner', 'member'],
): Promise<{ hasAccess: boolean; villageId?: string }> {
  const house = await prisma.house.findUnique({
    where: { id: houseId },
    select: { villageId: true },
  });

  if (!house) {
    return { hasAccess: false };
  }

  const access = await prisma.villageAccess.findUnique({
    where: {
      villageId_userId: {
        villageId: house.villageId,
        userId,
      },
    },
  });

  const hasAccess = access && requiredRoles.includes(access.role as 'owner' | 'member');
  return { hasAccess: !!hasAccess, villageId: house.villageId };
}

// GET /api/rooms - List rooms with optional house/village filter
roomsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const houseId = req.query.houseId ? String(req.query.houseId) : undefined;
    const villageId = req.query.villageId ? String(req.query.villageId) : undefined;
    const roomType = req.query.roomType ? String(req.query.roomType) : undefined;
    const moduleType = req.query.moduleType ? String(req.query.moduleType) : undefined;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 500) : 100;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const where: any = {};

    if (houseId) {
      where.houseId = houseId;
    }

    if (villageId) {
      where.house = { villageId };
    }

    if (roomType) {
      where.roomType = roomType;
    }

    if (moduleType) {
      where.moduleType = moduleType;
    }

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        include: {
          house: {
            select: {
              id: true,
              repoName: true,
              villageId: true,
              village: {
                select: {
                  id: true,
                  orgName: true,
                },
              },
            },
          },
        },
        orderBy: [{ roomType: 'asc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      prisma.room.count({ where }),
    ]);

    res.json({
      items: rooms,
      total,
      limit,
      offset,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/rooms - Create room (requires house access)
roomsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = CreateRoomSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid body',
        code: 'BAD_REQUEST',
        details: parsed.error.flatten(),
      });
    }

    const userId = String((req as any).user?.sub);
    const { houseId, ...roomData } = parsed.data;

    // Check house exists and user has access
    const { hasAccess, villageId } = await checkHouseAccess(houseId, userId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'No access to house',
        code: 'FORBIDDEN',
      });
    }

    // Create room
    const room = await prisma.room.create({
      data: {
        houseId,
        name: roomData.name,
        roomType: roomData.roomType,
        moduleType: roomData.moduleType,
        modulePath: roomData.modulePath,
        x: roomData.x,
        y: roomData.y,
        width: roomData.width,
        height: roomData.height,
        doors: roomData.doors as any,
        corridorData: roomData.corridorData as any,
        decorations: roomData.decorations as any,
        fileCount: roomData.fileCount,
        totalSize: roomData.totalSize,
        complexity: roomData.complexity,
        imports: roomData.imports as any,
        exports: roomData.exports as any,
      },
      include: {
        house: {
          select: {
            id: true,
            repoName: true,
            villageId: true,
            village: {
              select: {
                id: true,
                orgName: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(room);
  } catch (e) {
    next(e);
  }
});

// GET /api/rooms/:id - Get room details with decorations
roomsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        house: {
          select: {
            id: true,
            repoName: true,
            villageId: true,
            village: {
              select: {
                id: true,
                orgName: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found', code: 'NOT_FOUND' });
    }

    res.json(room);
  } catch (e) {
    next(e);
  }
});

// PUT /api/rooms/:id - Update room position/decorations
roomsRouter.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const parsed = UpdateRoomSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid body',
        code: 'BAD_REQUEST',
        details: parsed.error.flatten(),
      });
    }

    // Check room exists and get house info for auth
    const room = await prisma.room.findUnique({
      where: { id },
      select: {
        id: true,
        houseId: true,
        house: {
          select: {
            villageId: true,
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found', code: 'NOT_FOUND' });
    }

    // Check user has access to the village
    const userId = String((req as any).user?.sub);
    const { hasAccess } = await checkHouseAccess(room.houseId, userId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'No access to room',
        code: 'FORBIDDEN',
      });
    }

    // Update room
    const updated = await prisma.room.update({
      where: { id },
      data: {
        name: parsed.data.name,
        roomType: parsed.data.roomType,
        moduleType: parsed.data.moduleType,
        modulePath: parsed.data.modulePath,
        x: parsed.data.x,
        y: parsed.data.y,
        width: parsed.data.width,
        height: parsed.data.height,
        doors: parsed.data.doors as any,
        corridorData: parsed.data.corridorData as any,
        decorations: parsed.data.decorations as any,
        fileCount: parsed.data.fileCount,
        totalSize: parsed.data.totalSize,
        complexity: parsed.data.complexity,
        imports: parsed.data.imports as any,
        exports: parsed.data.exports as any,
      },
      include: {
        house: {
          select: {
            id: true,
            repoName: true,
            villageId: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/rooms/:id - Delete room (owner only)
roomsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);

    // Check room exists and get house info for auth
    const room = await prisma.room.findUnique({
      where: { id },
      select: {
        id: true,
        houseId: true,
        house: {
          select: {
            villageId: true,
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found', code: 'NOT_FOUND' });
    }

    // Check user is owner of village
    const userId = String((req as any).user?.sub);
    const access = await prisma.villageAccess.findUnique({
      where: {
        villageId_userId: {
          villageId: room.house.villageId,
          userId,
        },
      },
    });

    if (!access || access.role !== 'owner') {
      return res.status(403).json({
        error: 'Only village owners can delete rooms',
        code: 'FORBIDDEN',
      });
    }

    // Delete room
    await prisma.room.delete({
      where: { id },
    });

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// GET /api/rooms/:id/decorations - Get room decorations
roomsRouter.get('/:id/decorations', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);

    const room = await prisma.room.findUnique({
      where: { id },
      select: {
        id: true,
        decorations: true,
      },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found', code: 'NOT_FOUND' });
    }

    res.json({
      roomId: room.id,
      decorations: room.decorations || [],
    });
  } catch (e) {
    next(e);
  }
});

// PUT /api/rooms/:id/decorations - Update room decorations
roomsRouter.put('/:id/decorations', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const parsed = UpdateDecorationsSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid body',
        code: 'BAD_REQUEST',
        details: parsed.error.flatten(),
      });
    }

    // Check room exists and get house info for auth
    const room = await prisma.room.findUnique({
      where: { id },
      select: {
        id: true,
        houseId: true,
        house: {
          select: {
            villageId: true,
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found', code: 'NOT_FOUND' });
    }

    // Check user has access to the village
    const userId = String((req as any).user?.sub);
    const { hasAccess } = await checkHouseAccess(room.houseId, userId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'No access to room',
        code: 'FORBIDDEN',
      });
    }

    // Update decorations
    const updated = await prisma.room.update({
      where: { id },
      data: {
        decorations: parsed.data.decorations as any,
      },
      select: {
        id: true,
        decorations: true,
      },
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// GET /api/rooms/by-module/:modulePath(*) - Find room by module path
roomsRouter.get('/by-module/:modulePath(*)', requireAuth, async (req, res, next) => {
  try {
    const modulePath = String(req.params.modulePath);

    if (!modulePath) {
      return res.status(400).json({
        error: 'Module path is required',
        code: 'BAD_REQUEST',
      });
    }

    // Find room by exact match or prefix match
    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { modulePath: modulePath },
          { modulePath: { startsWith: modulePath + '/' } },
          { modulePath: { endsWith: '/' + modulePath } },
          { modulePath: { contains: '/' + modulePath + '/' } },
        ],
      },
      include: {
        house: {
          select: {
            id: true,
            repoName: true,
            villageId: true,
            village: {
              select: {
                id: true,
                orgName: true,
              },
            },
          },
        },
      },
      orderBy: {
        modulePath: 'asc',
      },
    });

    if (rooms.length === 0) {
      return res.status(404).json({
        error: 'No rooms found for module path',
        code: 'NOT_FOUND',
        modulePath,
      });
    }

    // Return best match first (exact match if available)
    const sortedRooms = rooms.sort((a, b) => {
      if (a.modulePath === modulePath) return -1;
      if (b.modulePath === modulePath) return 1;
      return (a.modulePath?.length || 0) - (b.modulePath?.length || 0);
    });

    res.json({
      modulePath,
      rooms: sortedRooms,
      bestMatch: sortedRooms[0],
    });
  } catch (e) {
    next(e);
  }
});
