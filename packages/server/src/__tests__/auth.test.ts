import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('auth middleware and access control', () => {
  let createApp: any;
  let requireAuth: any;
  let signAccessToken: (id: number, username: string) => string;
  let app: any;
  let token: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    ({ createApp } = await import('../app'));
    ({ requireAuth } = await import('../auth/middleware'));
    ({ signAccessToken } = await import('../auth/jwt'));
    app = createApp();
    token = signAccessToken(42, 'tester');
  });

  it('requireAuth denies when missing token', async () => {
    const express = (await import('express')).default;
    const testApp = express();
    testApp.get('/protected', requireAuth, (_req: any, res: any) => res.json({ ok: true }));
    const res = await request(testApp).get('/protected');
    expect(res.status).toBe(401);
  });

  it('requireAuth allows with valid token', async () => {
    const express = (await import('express')).default;
    const testApp = express();
    testApp.get('/protected', requireAuth, (req: any, res: any) => res.json({ user: req.user }));
    const res = await request(testApp).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body?.user?.sub).toBe(String(42));
  });

  it('GET /api/villages responds 401 without token', async () => {
    const res = await request(app).get('/api/villages');
    expect(res.status).toBe(401);
  });

  it('requireVillageRole enforces owner role', async () => {
    const express = (await import('express')).default;
    const mod = await import('../auth/middleware');
    mod.__setRoleResolver(async () => 'owner' as any);
    const testApp = express();
    testApp.get('/v/:id', requireAuth, mod.requireVillageRole((req: any) => Number(req.params.id), ['owner']), (_req: any, res: any) => res.json({ ok: true }));
    const res = await request(testApp).get('/v/1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    mod.__setRoleResolver(null);
  });

  it('requireVillageRole denies when no access', async () => {
    const express = (await import('express')).default;
    const testApp = express();
    vi.doMock('../db', () => ({
      prisma: {
        villageAccess: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      },
    }), { virtual: true });
    const { requireVillageRole } = await import('../auth/middleware');
    testApp.get('/v/:id', requireAuth, requireVillageRole((req: any) => Number(req.params.id), ['owner', 'member']), (_req: any, res: any) => res.json({ ok: true }));
    const res = await request(testApp).get('/v/2').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    vi.resetModules();
  });
});
