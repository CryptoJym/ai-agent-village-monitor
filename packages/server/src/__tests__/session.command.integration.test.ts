import request from 'supertest';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';

const hasDb = !!process.env.DATABASE_URL;
const hasRedis = !!process.env.REDIS_URL;

describe('integration: session start → command → stop', () => {
  let app: any;
  let stop: any;
  let token = '';
  let agentId = 1;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const m = await import('../app');
    app = m.createApp();
    if (hasRedis) {
      const workers = await import('../queue/workers');
      const handles = workers.startWorkers();
      stop = () => workers.stopWorkers(handles || undefined);
    }
    if (hasDb) {
      const { prisma } = await import('../db/client');
      // Create user + village + agent
      const u = await prisma.user.create({ data: { githubId: BigInt(Date.now()), username: 'integ' } as any });
      const v = await prisma.village.create({ data: { orgName: 'v-integ', githubOrgId: BigInt(999), ownerId: (u as any).id, isPublic: false } as any });
      const a = await prisma.agent.create({ data: { villageId: (v as any).id, name: 'a-integ', currentStatus: 'idle' } as any });
      agentId = (a as any).id || agentId;
      const { signAccessToken } = await import('../auth/jwt');
      token = signAccessToken(Number((u as any).id || 1), (u as any).username || 'integ');
    }
  });

  afterAll(async () => {
    if (typeof stop === 'function') await stop();
  });

  it.skipIf(!hasRedis || !hasDb)('runs command lifecycle', async () => {
    // start
    const s = await request(app).post(`/api/agents/${encodeURIComponent(String(agentId))}/start`).set('Authorization', `Bearer ${token}`);
    expect([200, 202]).toContain(s.status);
    // command
    const c = await request(app)
      .post(`/api/agents/${encodeURIComponent(String(agentId))}/command`)
      .set('Authorization', `Bearer ${token}`)
      .send({ command: 'run_tool', args: { tool: 'echo', payload: 'hello' }, clientRequestId: 'test-1' } as any);
    expect([200, 202]).toContain(c.status);
    // stop
    const t = await request(app).post(`/api/agents/${encodeURIComponent(String(agentId))}/stop`).set('Authorization', `Bearer ${token}`);
    expect([200, 202]).toContain(t.status);
  });
});

