import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

describe('role-based visibility and flows', () => {
  let createApp: any;
  let prisma: any;
  let signAccessToken: (id: number, username: string) => string;
  let app: any;

  const hasDb = !!process.env.DATABASE_URL && process.env.DISABLE_DB_TESTS !== 'true';

  let owner: { id: number; username: string } | null = null;
  let member: { id: number; username: string } | null = null;
  let other: { id: number; username: string } | null = null;
  let villageId = 0;
  let ownerToken = '';
  let memberToken = '';

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    ({ createApp } = await import('../app'));
    ({ prisma } = await import('../db/client'));
    ({ signAccessToken } = await import('../auth/jwt'));
    app = createApp();
    if (!hasDb) return;
    // Users
    const ts = Date.now();
    owner = await prisma.user.create({ data: { githubId: BigInt(ts), username: `owner_${ts}` } });
    member = await prisma.user.create({ data: { githubId: BigInt(ts + 1), username: `member_${ts}` } });
    other = await prisma.user.create({ data: { githubId: BigInt(ts + 2), username: `other_${ts}` } });
    ownerToken = signAccessToken(owner!.id, owner!.username);
    memberToken = signAccessToken(member!.id, member!.username);
    // Village (private by default)
    const v = await prisma.village.create({ data: { name: 'role-test', githubOrgId: BigInt(ts + 3), ownerId: owner!.id, isPublic: false } });
    villageId = v.id;
    // Member access
    await prisma.villageAccess.create({ data: { villageId: v.id, userId: member!.id, role: 'member' } });
  });

  it.skipIf(!hasDb)('owner sees private village with viewerRole=owner', async () => {
    const res = await request(app).get(`/api/villages/${villageId}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body?.viewerRole).toBe('owner');
    expect(res.body?.isPublic).toBe(false);
  });

  it.skipIf(!hasDb)('member sees private village with viewerRole=member', async () => {
    const res = await request(app).get(`/api/villages/${villageId}`).set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body?.viewerRole).toBe('member');
  });

  it.skipIf(!hasDb)('unauthenticated cannot access private village', async () => {
    const res = await request(app).get(`/api/villages/${villageId}`);
    expect([401,403]).toContain(res.status);
  });

  it.skipIf(!hasDb)('owner can toggle public; unauthenticated sees viewerRole=visitor', async () => {
    const up = await request(app)
      .put(`/api/villages/${villageId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isPublic: true });
    expect(up.status).toBe(200);
    expect(up.body?.isPublic).toBe(true);
    const res = await request(app).get(`/api/villages/${villageId}`);
    expect(res.status).toBe(200);
    expect(res.body?.viewerRole).toBe('visitor');
  });

  it.skipIf(!hasDb)('non-owner cannot list access entries', async () => {
    const r1 = await request(app).get(`/api/villages/${villageId}/access`).set('Authorization', `Bearer ${memberToken}`);
    expect([403,404]).toContain(r1.status);
  });

  it.skipIf(!hasDb)('owner can list and update roles', async () => {
    const list = await request(app).get(`/api/villages/${villageId}/access`).set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    const rows: Array<{ userId: number; role: string }> = list.body;
    const target = rows.find((r) => r.userId === member!.id);
    expect(target?.role).toBe('member');
    const up = await request(app)
      .put(`/api/villages/${villageId}/access/${member!.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'visitor' });
    expect(up.status).toBe(200);
    expect(up.body?.role).toBe('visitor');
  });
});

