import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import http from 'node:http';
import { io as Client, type Socket } from 'socket.io-client';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { createSocketServer } from '../realtime/server';
import { setIO } from '../realtime/io';
import { startWorkers, stopWorkers, type WorkerHandles } from '../queue/workers';

let server: http.Server | undefined;
let baseUrl = '';
let pg: StartedTestContainer | undefined;
let redis: StartedTestContainer | undefined;
let handles: WorkerHandles | undefined;

let app: any;
let prisma: any;
let signAccessToken: (id: number, username: string) => string;

const USE = process.env.USE_TESTCONTAINERS === 'true';

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
  if (!USE) return; // opt-in only

  // Containers
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

  // Migrate
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { execSync } = require('node:child_process');
  execSync('pnpm prisma migrate deploy --schema=packages/server/prisma/schema.prisma', { stdio: 'inherit' });

  const mod = await import('../app');
  app = mod.createApp();
  ({ prisma } = await import('../db/client'));
  ({ signAccessToken } = await import('../auth/jwt'));

  // HTTP + WS
  server = http.createServer(app);
  const io = createSocketServer(server);
  setIO(io);
  await new Promise<void>((resolve) => server!.listen(0, resolve));
  const port = (server!.address() as any).port as number;
  baseUrl = `http://localhost:${port}`;

  // Workers (use Redis connection)
  handles = startWorkers(console) || undefined;
}, 180_000);

afterAll(async () => {
  if (handles) await stopWorkers(handles);
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  try { await prisma?.$disconnect?.(); } catch {}
  try { await pg?.stop(); } catch {}
  try { await redis?.stop(); } catch {}
}, 120_000);

describe.skipIf(!USE)('WebSocket side-effects', () => {
  it('posting start enqueues and emits agent_update/work_stream to room', async () => {
    // Arrange DB rows
    const u = await prisma.user.create({ data: { githubId: BigInt(Date.now()), username: 'wsuser' } });
    const v = await prisma.village.create({ data: { name: 'wsv', githubOrgId: BigInt(Date.now()+1), ownerId: u.id, isPublic: true } });
    const a = await prisma.agent.create({ data: { villageId: v.id, name: 'ws-agent', currentStatus: 'idle' } });
    const token = signAccessToken(u.id, u.username);

    // Connect socket and join agent room
    const socket: Socket = Client(baseUrl, { transports: ['polling'], auth: { token } });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });
    const join = await new Promise<any>((resolve) => socket.emit('join_agent', { agentId: String(a.id) }, resolve));
    expect(join?.ok).toBe(true);

    // Observe events
    const got = { update: false, stream: false };
    socket.on('agent_update', (p: any) => { if (String(p?.agentId) === String(a.id)) got.update = true; });
    socket.on('work_stream', (p: any) => { if (String(p?.agentId) === String(a.id)) got.stream = true; });

    // Trigger start
    const res = await (await import('supertest')).default(app)
      .post(`/api/agents/${a.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({ restart: true });
    expect(res.status).toBe(202);

    // Wait until events flow
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout waiting for ws events')), 5000);
      const check = () => {
        if (got.update && got.stream) { clearTimeout(timeout); resolve(); }
        else setTimeout(check, 100);
      };
      check();
    });

    socket.disconnect();
  }, 60_000);
});
