// Lightweight Prisma accessor used where a DB may or may not be configured
// (e.g., unit tests without DATABASE_URL). Prefer importing { prisma } from
// '../db' for places that assume a connected Prisma client, and use getPrisma()
// where DB-less operation is acceptable.

let prismaInstance: any | undefined;

export function getPrisma(): any | undefined {
  if (prismaInstance !== undefined) return prismaInstance;
  // Only initialize when DB configured, and guard require so test envs without
  // codegen don't error.
  if (process.env.VITEST || process.env.VITEST_WORKER_ID) return undefined;
  if (process.env.DISABLE_DB_TESTS === 'true') return undefined;
  if (!process.env.DATABASE_URL) return undefined;
  try {
    const { PrismaClient } = require('@prisma/client');
    prismaInstance = new PrismaClient({ log: ['warn', 'error'] });
    return prismaInstance;
  } catch {
    return undefined;
  }
}

// Re-export the shared Prisma singleton so `import { prisma } from '../db'` works
import { prisma as prismaClient } from './db/client';
export const prisma = prismaClient;

export type PrismaClientType = ReturnType<typeof getPrisma>;
