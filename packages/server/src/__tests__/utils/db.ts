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
 *
 * Tables are deleted in reverse order of dependencies to avoid FK constraint violations.
 * This list matches the actual Prisma schema models.
 */
export async function cleanDatabase(prismaClient: PrismaClient = prisma) {
  // Delete in reverse order of dependencies (leaf tables first, root tables last)
  const tablenames = [
    // Events and sessions (leaf nodes)
    'WorkStreamEvent',
    'AgentSession',
    // Junction tables
    'HouseAgent',
    'VillageAccess',
    // Entity tables (in dependency order)
    'GeneratedSprite',
    'Room',
    'Agent',
    'House',
    'WorldMap',
    'WorldNode',
    'bug_bots', // Using actual table name from @@map
    'Tileset',
    'Village',
    'oauth_tokens', // Using actual table name from @@map
    'User',
  ];

  for (const tablename of tablenames) {
    try {
      await prismaClient.$executeRawUnsafe(`DELETE FROM "${tablename}"`);
    } catch (error) {
      // Table might not exist or be empty, continue
      // Only log in debug mode to reduce noise
      if (process.env.DEBUG_DB_CLEANUP) {
        console.warn(`Could not clean table ${tablename}:`, (error as Error).message);
      }
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
  callback: (prisma: PrismaClient) => Promise<T>,
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
 * Creates a complete entity hierarchy for testing:
 * User -> Village + VillageAccess -> House -> Room
 *         \-> Agent (via HouseAgent junction)
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

  // Create test village with VillageAccess for user
  const village = await prismaClient.village.create({
    data: {
      orgName: 'Test Org',
      githubOrgId: BigInt(987654321),
      seed: 'test-seed-123',
      provider: 'github',
      access: {
        create: {
          userId: user.id,
          role: 'owner',
        },
      },
    },
  });

  // Create test house
  const house = await prismaClient.house.create({
    data: {
      villageId: village.id,
      repoName: 'test-org/test-repo',
      githubRepoId: BigInt(111222333),
      primaryLanguage: 'TypeScript',
      stars: 100,
      buildingSize: 'medium',
      positionX: 10.0,
      positionY: 20.0,
      footprintWidth: 5,
      footprintHeight: 4,
    },
  });

  // Create test agent
  const agent = await prismaClient.agent.create({
    data: {
      name: 'Test Agent',
      userId: user.id,
      spriteKey: 'agent-default',
      currentState: 'idle',
      positionX: 15.0,
      positionY: 25.0,
      currentHouseId: house.id,
      energy: 100,
      frustration: 0,
      workload: 0,
      streak: 0,
      errorStreak: 0,
      personality: JSON.stringify({
        introversion: 0.5,
        diligence: 0.8,
        creativity: 0.6,
        patience: 0.7,
      }),
    },
  });

  // Assign agent to house via HouseAgent junction
  await prismaClient.houseAgent.create({
    data: {
      houseId: house.id,
      agentId: agent.id,
      role: 'developer',
    },
  });

  // Create test room
  const room = await prismaClient.room.create({
    data: {
      houseId: house.id,
      name: 'Main Entrance',
      roomType: 'entrance',
      moduleType: 'root',
      modulePath: 'src/index.ts',
      x: 0,
      y: 0,
      width: 10,
      height: 8,
      complexity: 5,
      fileCount: 1,
      totalSize: 2048,
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
