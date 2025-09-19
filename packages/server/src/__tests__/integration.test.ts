import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import request from 'supertest';

const exec = promisify(execCb);

describe('integration: REST + DB with containers', () => {
  let pg: StartedTestContainer | undefined;
  let redis: StartedTestContainer | undefined;
  let app: any;
  let signAccessToken: (id: number, username: string) => string;
  let prisma: any;
  let token = '';

  const hasDocker = process.env.USE_TESTCONTAINERS === 'true';

  beforeAll(async () => {
    // Ensure JWT secret for auth
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    if (!hasDocker) {
      // Skip container bring-up; tests will be no-op
      return;
    }
    // Start Postgres and Redis
    pg = await new GenericContainer('postgres:16')
      .withEnv('POSTGRES_USER', 'postgres')
      .withEnv('POSTGRES_PASSWORD', 'postgres')
      .withEnv('POSTGRES_DB', 'app')
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
      .start();
    redis = await new GenericContainer('redis:7')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start();

    const pgHost = pg.getHost();
    const pgPort = pg.getMappedPort(5432);
    const redisHost = redis.getHost();
    const redisPort = redis.getMappedPort(6379);

    process.env.DATABASE_URL = `postgresql://postgres:postgres@${pgHost}:${pgPort}/app?schema=public`;
    process.env.REDIS_URL = `redis://:${''}@${redisHost}:${redisPort}/0`;

    // Run Prisma migrations
    await exec(`pnpm prisma migrate deploy --schema=packages/server/prisma/schema.prisma`, {
      env: { ...process.env },
      cwd: process.cwd(),
    });

    // Lazy import after env configured
    const { createApp } = await import('../app');
    ({ signAccessToken } = await import('../auth/jwt'));
    ({ prisma } = await import('../db/client'));
    app = createApp();

    // Create a user and sign a token
    const u = await prisma.user.create({
      data: { githubId: BigInt(Date.now()), username: 'itest' },
    });
    token = signAccessToken(u.id, u.username);
  }, 180_000);

  afterAll(async () => {
    try {
      await prisma?.$disconnect?.();
    } catch {
      // Best-effort cleanup; ignore if already disconnected.
    }
    try {
      await pg?.stop();
    } catch {
      // Container may already be stopped; safe to ignore.
    }
    try {
      await redis?.stop();
    } catch {
      // Container may already be stopped; safe to ignore.
    }
  }, 60_000);

  it('POST /api/villages then GET by id', async () => {
    if (!pg) return; // containers not running, skip
    const create = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'itest-village', githubOrgId: String(Date.now()) });
    expect(create.status).toBe(201);
    const id = create.body.id as number;
    const get = await request(app)
      .get(`/api/villages/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body?.name).toBe('itest-village');
  }, 60_000);
});
