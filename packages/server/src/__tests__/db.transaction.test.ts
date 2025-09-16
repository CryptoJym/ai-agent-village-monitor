import { describe, it, expect } from 'vitest';

// Skip if no DB URL or prisma client unavailable
const hasDb = !!process.env.DATABASE_URL;
let PrismaClient: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  PrismaClient = require('@prisma/client').PrismaClient;
} catch {
  PrismaClient = null;
}

const shouldRun = hasDb && !!PrismaClient;

describe('db transaction', () => {
  it.skipIf(!shouldRun)('rolls back on error', async () => {
    const prisma = new PrismaClient();
    const username = `txn-test-${Math.random().toString(16).slice(2, 8)}`;
    try {
      await prisma.$transaction(async (tx: any) => {
        const user = await tx.user.create({
          data: { githubId: BigInt(Date.now() % 2147483647), username },
        });
        await tx.village.create({
          data: { githubOrgId: BigInt(Date.now() % 2147483647), name: 'txn-village', ownerId: user.id },
        });
        throw new Error('force rollback');
      });
    } catch {
      // expected
    }
    // Assert no user persisted
    const found = await prisma.user.findMany({ where: { username } });
    expect(found.length).toBe(0);
    await prisma.$disconnect();
  });
});

