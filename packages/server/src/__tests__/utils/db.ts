/**
 * Database Test Utilities
 * Provides test database setup with transaction rollback support
 */

import { PrismaClient } from '@prisma/client';
import { beforeEach, afterEach } from 'vitest';

let prisma: PrismaClient;
let testPrisma: PrismaClient;

/**
 * Get or create the test Prisma client
 */
export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'file:./test.db',
        },
      },
    });
  }
  return testPrisma;
}

/**
 * Setup database for tests
 * Call this in your test setup
 */
export async function setupTestDatabase() {
  prisma = getTestPrisma();
  await prisma.$connect();
  return prisma;
}

/**
 * Teardown database after tests
 * Call this in your test teardown
 */
export async function teardownTestDatabase() {
  if (prisma) {
    await prisma.$disconnect();
  }
}

/**
 * Clean all data from the database
 * Useful for ensuring test isolation
 */
export async function cleanDatabase(prismaClient: PrismaClient = prisma) {
  // Delete in reverse order of dependencies
  const tablenames = [
    'Decoration',
    'RoomMetric',
    'Room',
    'AgentMetric',
    'AgentActivity',
    'Agent',
    'House',
    'VillageMetric',
    'VillageAccess',
    'Village',
    'Session',
    'User',
    'Bug',
    'WorldNode',
  ];

  for (const tablename of tablenames) {
    try {
      await prismaClient.$executeRawUnsafe(`DELETE FROM "${tablename}"`);
    } catch (error) {
      // Table might not exist, ignore
      console.warn(`Could not clean table ${tablename}:`, error);
    }
  }

  // Reset sequences if using PostgreSQL
  // For SQLite, this is not necessary as IDs will auto-increment
}

/**
 * Transaction-based test isolation
 * Each test runs in a transaction that is rolled back after completion
 */
export function setupTransactionalTests() {
  let rollback: (() => Promise<void>) | null = null;

  beforeEach(async () => {
    prisma = getTestPrisma();

    // Start a transaction and store rollback function
    await prisma.$executeRaw`BEGIN`;

    rollback = async () => {
      await prisma.$executeRaw`ROLLBACK`;
    };
  });

  afterEach(async () => {
    if (rollback) {
      await rollback();
      rollback = null;
    }
  });

  return () => prisma;
}

/**
 * Execute a function within a test transaction
 */
export async function withTestTransaction<T>(
  callback: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  const prisma = getTestPrisma();

  try {
    await prisma.$executeRaw`BEGIN`;
    const result = await callback(prisma);
    await prisma.$executeRaw`ROLLBACK`;
    return result;
  } catch (error) {
    await prisma.$executeRaw`ROLLBACK`;
    throw error;
  }
}

/**
 * Seed basic test data
 */
export async function seedTestData(prismaClient: PrismaClient = prisma) {
  // Create test user
  const user = await prismaClient.user.create({
    data: {
      githubId: BigInt(123456789),
      username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.png',
    },
  });

  // Create test village
  const village = await prismaClient.village.create({
    data: {
      name: 'Test Village',
      githubOrgId: '987654321',
      ownerId: user.id,
      visibility: 'PUBLIC',
    },
  });

  // Create test house
  const house = await prismaClient.house.create({
    data: {
      villageId: village.id,
      repoId: BigInt(111222333),
      name: 'Test House',
      x: 0,
      y: 0,
      size: 'medium',
    },
  });

  // Create test agent
  const agent = await prismaClient.agent.create({
    data: {
      githubRepoId: '444555666',
      repoId: BigInt(444555666),
      name: 'Test Agent',
      villageId: village.id,
      houseId: house.id,
      ownerId: user.id,
      state: 'idle',
      x: 0,
      y: 0,
    },
  });

  // Create test room
  const room = await prismaClient.room.create({
    data: {
      houseId: house.id,
      path: '/src/index.ts',
      name: 'index.ts',
      roomType: 'entrance',
      moduleType: 'root',
      complexity: 5,
      x: 0,
      y: 0,
    },
  });

  return { user, village, house, agent, room };
}

/**
 * Wait for database operations to complete
 */
export async function waitForDb(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
