import request from 'supertest';
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'testsecret';
});

// Mock prisma client used by the server
vi.mock('../db/client', () => {
  const agents = [
    { id: 'agent-1', villageId: 'village-1', name: 'Alpha', currentStatus: 'idle' },
    { id: 'agent-2', villageId: 'village-1', name: 'Bravo', currentStatus: 'working' },
  ];
  const access = (villageId: string, userId: string) => {
    if (villageId !== 'village-1') return null;
    if (userId === '1') return { villageId, userId, role: 'owner' } as any;
    if (userId === '2') return { villageId, userId, role: 'member' } as any;
    return null;
  };
  return {
    prisma: {
      agent: {
        findMany: vi.fn(async (args?: any) => agents.filter(a => a.villageId === args?.where?.villageId)),
        create: vi.fn(async ({ data }: any) => ({ id: 'agent-3', ...data })),
        findUnique: vi.fn(async ({ where: { id } }: any) => agents.find(a => a.id === id) || null),
        update: vi.fn(async ({ where: { id }, data }: any) => ({ ...(agents.find(a => a.id === id) || { id }), ...data })),
        delete: vi.fn(async ({ where: { id } }: any) => ({ id })),
      },
      village: {
        findUnique: vi.fn(async ({ where: { id } }: any) => (id === 'village-1' ? { id } : null)),
      },
      villageAccess: {
        findUnique: vi.fn(async ({ where: { villageId_userId: { villageId, userId } } }: any) => access(villageId, userId)),
      },
      $queryRawUnsafe: vi.fn().mockResolvedValue(1),
    },
  };
});

describe('Agents REST endpoints', () => {
  let app: import('express').Express;
  let tokenOwner: string;
  let tokenMember: string;
  let tokenVisitor: string;

  beforeAll(async () => {
    const { createApp } = await import('../app');
    const { signAccessToken } = await import('../auth/jwt');
    const { __setRoleResolver } = await import('../auth/middleware');
    app = createApp();
    // Tokens for three users (using string IDs to match schema)
    tokenOwner = signAccessToken('1', 'owner');
    tokenMember = signAccessToken('2', 'member');
    tokenVisitor = signAccessToken('3', 'visitor');
    // Default role resolver: user 1 is owner, user 2 is member, others none
    __setRoleResolver(async (userId: string, villageId: string) => {
      if (villageId !== 'village-1') return null;
      if (userId === '1') return 'owner' as const;
      if (userId === '2') return 'member' as const;
      return null;
    });
  });

  afterAll(async () => {
    const { __setRoleResolver } = await import('../auth/middleware');
    __setRoleResolver(null);
  });

  it('lists agents for village as member', async () => {
    const res = await request(app)
      .get('/api/villages/village-1/agents')
      .set('Authorization', `Bearer ${tokenMember}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('forbids list for non-member', async () => {
    const res = await request(app)
      .get('/api/villages/village-1/agents')
      .set('Authorization', `Bearer ${tokenVisitor}`);
    expect(res.status).toBe(403);
  });

  it('creates agent as owner', async () => {
    const res = await request(app)
      .post('/api/villages/village-1/agents')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'Charlie', mcpServerUrl: 'http://localhost:9999' });
    expect(res.status).toBe(201);
    expect(res.body?.name).toBe('Charlie');
  });

  it('rejects create for member (not owner)', async () => {
    const res = await request(app)
      .post('/api/villages/village-1/agents')
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ name: 'Charlie', mcpServerUrl: 'http://localhost:9999' });
    expect(res.status).toBe(403);
  });

  it('updates agent as owner and forbids as member', async () => {
    const allow = await request(app)
      .put('/api/agents/agent-1')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ currentStatus: 'busy' });
    expect(allow.status).toBe(200);
    expect(allow.body?.currentStatus).toBe('busy');

    const deny = await request(app)
      .put('/api/agents/agent-1')
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ currentStatus: 'idle' });
    expect(deny.status).toBe(403);
  });

  it('deletes agent as owner and forbids as member', async () => {
    const ok = await request(app)
      .delete('/api/agents/agent-2')
      .set('Authorization', `Bearer ${tokenOwner}`);
    expect(ok.status).toBe(204);

    const deny = await request(app)
      .delete('/api/agents/agent-1')
      .set('Authorization', `Bearer ${tokenMember}`);
    expect(deny.status).toBe(403);
  });
});
