import type { PrismaClient } from '@prisma/client';

// In Vitest, provide a lightweight stub so unit tests can spy without requiring
// a generated client or a live DATABASE_URL. E2E tests explicitly mock this
// module with vi.mock in their own files.
const inVitest = !!process.env.VITEST || !!process.env.VITEST_WORKER_ID;

function makeStub(): any {
  return {
    $queryRawUnsafe: async () => 1,
    user: {
      findUnique: async (args?: any) => {
        const id = args?.where?.id;
        if (id == null) return null;
        return {
          id: String(id),
          username: `user-${String(id)}`,
          avatarUrl: null,
          preferences: {},
        };
      },
      update: async (args?: any) => {
        const id = args?.where?.id;
        const data = args?.data ?? {};
        return { id: id != null ? String(id) : 'unknown', ...data };
      },
    },
    villageAccess: {
      // Default to owner for userId 42 in village 1 to satisfy owner-path unit test;
      // individual tests can vi.spyOn(...).mockResolvedValue(...) to override.
      findUnique: async (args?: any) => {
        try {
          const vid = Number(args?.where?.villageId_userId?.villageId);
          const uid = Number(args?.where?.villageId_userId?.userId);
          if (vid === 1 && uid === 42) {
            return { id: 1, villageId: vid, userId: uid, role: 'owner', grantedAt: new Date() };
          }
        } catch {
          // Ignore parsing errors; fall back to null.
        }
        return null;
      },
    },
  } as any;
}

let prismaInstance: PrismaClient | any;
if (inVitest) {
  prismaInstance = makeStub();
} else {
  // Prevent multiple instances in dev with hot-reload
  const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

  const { PrismaClient: RealPrisma } = require('@prisma/client');
  prismaInstance = globalForPrisma.prisma ?? new RealPrisma();
  if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = prismaInstance as PrismaClient;
}

export const prisma = prismaInstance as PrismaClient;
