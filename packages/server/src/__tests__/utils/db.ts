/**
 * Database Test Utilities
 * Provides test database setup with transaction rollback support
 */

import { PrismaClient } from '@prisma/client';
import { beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

let prisma: PrismaClient;
let testPrisma: PrismaClient;
let testPrismaUrl: string | null = null;
let schemaEnsured = false;

function resolveTestDatabaseUrl(): string {
  const candidate = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (candidate && candidate.startsWith('file:')) return candidate;
  return 'file:./prisma/tmp-unit.db';
}

function ensureTestDatabaseSchema(databaseUrl: string) {
  if (schemaEnsured) return;

  const prismaBinary = path.resolve(
    process.cwd(),
    process.platform === 'win32' ? 'node_modules/.bin/prisma.cmd' : 'node_modules/.bin/prisma',
  );
  const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');

  const result = spawnSync(
    prismaBinary,
    ['db', 'push', '--schema', schemaPath, '--skip-generate'],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`Failed to provision test DB schema via prisma db push.\n${combined}`);
  }

  schemaEnsured = true;
}

/**
 * Get or create the test Prisma client
 */
export function getTestPrisma(): PrismaClient {
  const databaseUrl = resolveTestDatabaseUrl();
  if (!testPrisma || testPrismaUrl !== databaseUrl) {
    testPrismaUrl = databaseUrl;
    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
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
  ensureTestDatabaseSchema(resolveTestDatabaseUrl());
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
 * This list should match all models in packages/server/prisma/schema.prisma
 */
export async function cleanDatabase(prismaClient: PrismaClient = prisma) {
  // Delete in reverse order of dependencies (children first, then parents)
  const tablenames = [
    // Sprite generation tables
    'GeneratedSprite',
    'Tileset',
    // WorldNode tree (self-referential)
    'WorldNode',
    // Agent-related (depends on Agent, House)
    'WorkStreamEvent',
    'AgentSession',
    'HouseAgent',
    // Room (depends on House)
    'Room',
    // Agent (depends on User, can reference House/Room)
    'Agent',
    // House (depends on Village)
    'House',
    // WorldMap (depends on Village, 1:1)
    'WorldMap',
    // BugBot (depends on Village) - note: @@map("bug_bots")
    'bug_bots',
    // Village access (depends on Village, User)
    'VillageAccess',
    // OAuth tokens - note: @@map("oauth_tokens")
    'oauth_tokens',
    // Village (base entity)
    'Village',
    // User (base entity)
    'User',
  ];

  for (const tablename of tablenames) {
    try {
      await prismaClient.$executeRawUnsafe(`DELETE FROM "${tablename}"`);
    } catch {
      /* ignore */
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
