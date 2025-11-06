import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'testsecret';
});

// Mock prisma for layout endpoints
vi.mock('../db/client', () => {
  const agents = [
    {
      id: 'a1',
      villageId: 1,
      positionX: 100,
      positionY: 200,
      spriteConfig: null,
      currentStatus: 'idle',
    },
  ];
  const houses = [{ id: 'h1', villageId: 1, positionX: 300, positionY: 400 }];
  const calls: any = { agentUpdate: [], houseUpdate: [], villageUpdate: [] };
  const prisma = {
    agent: {
      findMany: vi.fn(async (args?: any) =>
        agents.filter((a) => String(a.villageId) === String(args?.where?.villageId)),
      ),
      update: vi.fn(async ({ where: { id }, data }: any) => {
        calls.agentUpdate.push({ id, data });
        return { id, ...data };
      }),
      updateMany: vi.fn(async ({ data }: any) => ({ count: agents.length, data })),
    },
    house: {
      findMany: vi.fn(async (args?: any) =>
        houses.filter((h) => String(h.villageId) === String(args?.where?.villageId)),
      ),
      update: vi.fn(async ({ where: { id }, data }: any) => {
        calls.houseUpdate.push({ id, data });
        return { id, ...data };
      }),
      updateMany: vi.fn(async ({ data }: any) => ({ count: houses.length, data })),
    },
    village: {
      _version: 0,
      findUnique: vi.fn(async ({ where: { id } }: any) =>
        String(id) === '1' ? { layoutVersion: (prisma.village as any)._version } : null,
      ),
      update: vi.fn(async ({ where: { id }, data }: any) => {
        if (data?.layoutVersion?.increment)
          (prisma.village as any)._version += data.layoutVersion.increment;
        calls.villageUpdate.push({ id, data });
        return { id, layoutVersion: (prisma.village as any)._version };
      }),
    },
    villageAccess: {
      findUnique: vi.fn(
        async ({
          where: {
            villageId_userId: { villageId, userId },
          },
        }: any) =>
          String(villageId) === '1' && (String(userId) === '1' || String(userId) === '2')
            ? { villageId, userId, role: String(userId) === '1' ? 'owner' : 'member' }
            : null,
      ),
    },
    $queryRawUnsafe: vi.fn().mockResolvedValue(1),
    __calls: calls,
  };
  return { prisma };
});

describe('Villages layout persistence', () => {
  let app: import('express').Express;
  let tokenOwner: string;
  let tokenMember: string;
  let prisma: any;

  beforeAll(async () => {
    const m = await import('../db/client');
    prisma = (m as any).prisma;
    const { createApp } = await import('../app');
    const { signAccessToken } = await import('../auth/jwt');
    const { __setRoleResolver } = await import('../auth/middleware');
    app = createApp();
    tokenOwner = signAccessToken('1', 'owner');
    tokenMember = signAccessToken('2', 'member');
    __setRoleResolver(async (userId: number | string, villageId: number | string) => {
      if (String(villageId) !== '1') return null;
      if (String(userId) === '1') return 'owner' as const;
      if (String(userId) === '2') return 'member' as const;
      return null;
    });
  });

  afterAll(async () => {
    const { __setRoleResolver } = await import('../auth/middleware');
    __setRoleResolver(null);
  });

  it('loads layout for member with version and positions', async () => {
    const res = await request(app)
      .get('/api/villages/1/layout')
      .set('Authorization', `Bearer ${tokenMember}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.version).toBe('number');
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(Array.isArray(res.body.houses)).toBe(true);
  });

  it('saves layout with optimistic version check and increments version', async () => {
    const before = (prisma.village as any)._version;
    const res = await request(app)
      .put('/api/villages/1/layout')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        version: before,
        agents: [{ id: 'a1', x: 111, y: 222 }],
        houses: [{ id: 'h1', x: 333, y: 444 }],
      });
    expect(res.status).toBe(204);
    expect(prisma.__calls.agentUpdate.length).toBeGreaterThan(0);
    expect(prisma.__calls.houseUpdate.length).toBeGreaterThan(0);
    const after = (prisma.village as any)._version;
    expect(after).toBe(before + 1);
  });

  it('rejects save on layout version conflict', async () => {
    const current = (prisma.village as any)._version;
    const res = await request(app)
      .put('/api/villages/1/layout')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ version: current - 1, agents: [{ id: 'a1', x: 1, y: 2 }] });
    expect(res.status).toBe(409);
    expect(res.body?.error?.code).toBe('CONFLICT');
  });

  it('resets layout and increments version', async () => {
    const before = (prisma.village as any)._version;
    const res = await request(app)
      .post('/api/villages/1/layout/reset')
      .set('Authorization', `Bearer ${tokenOwner}`);
    expect(res.status).toBe(202);
    const after = (prisma.village as any)._version;
    expect(after).toBe(before + 1);
  });
});
