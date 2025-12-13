import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

const hasDb = !!process.env.DATABASE_URL && process.env.DISABLE_DB_TESTS !== 'true';

describe.skipIf(!hasDb)('Village access and visibility', () => {
  let app: any;
  let prisma: any;
  let signAccessToken: (id: number, username: string) => string;

  let ownerId = 0;
  let memberId = 0;
  let visitorId = 0;
  let ownerToken = '';
  let memberToken = '';
  let visitorToken = '';
  let villageId = 0;

  beforeAll(async () => {
    const mod = await import('../app');
    app = mod.createApp();
    prisma = (await import('../db/client')).prisma;
    ({ signAccessToken } = await import('../auth/jwt'));

    const uOwner = await prisma.user.create({ data: { githubId: BigInt(Date.now() + 1), username: 'owner_user' } });
    const uMember = await prisma.user.create({ data: { githubId: BigInt(Date.now() + 2), username: 'member_user' } });
    const uVisitor = await prisma.user.create({ data: { githubId: BigInt(Date.now() + 3), username: 'visitor_user' } });
    ownerId = uOwner.id; memberId = uMember.id; visitorId = uVisitor.id;
    ownerToken = signAccessToken(ownerId, uOwner.username);
    memberToken = signAccessToken(memberId, uMember.username);
    visitorToken = signAccessToken(visitorId, uVisitor.username);

    const v = await prisma.village.create({ data: { githubOrgId: BigInt(Date.now() + 10), orgName: 'perm-village', ownerId: ownerId, isPublic: false } });
    villageId = v.id;
    await prisma.villageAccess.create({ data: { villageId, userId: memberId, role: 'member' } });
    await prisma.villageAccess.create({ data: { villageId, userId: visitorId, role: 'visitor' } });
  });

  it('owner can list access; non-owners cannot', async () => {
    const ok = await request(app).get(`/api/villages/${villageId}/access`).set('Authorization', `Bearer ${ownerToken}`);
    expect(ok.status).toBe(200);
    const names = (ok.body as any[]).map((r) => r.username || r.userId);
    expect(names.length).toBeGreaterThanOrEqual(2);

    const mem = await request(app).get(`/api/villages/${villageId}/access`).set('Authorization', `Bearer ${memberToken}`);
    expect(mem.status).toBe(403);

    const vis = await request(app).get(`/api/villages/${villageId}/access`).set('Authorization', `Bearer ${visitorToken}`);
    expect(vis.status).toBe(403);
  });

  it('owner can add/update/remove access; non-owners are forbidden', async () => {
    // add
    const tmp = await prisma.user.create({ data: { githubId: BigInt(Date.now() + 100), username: 'invitee' } });
    const add = await request(app)
      .post(`/api/villages/${villageId}/access`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: tmp.id, role: 'member' });
    expect(add.status).toBe(201);

    // update role
    const upd = await request(app)
      .put(`/api/villages/${villageId}/access/${tmp.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'visitor' });
    expect(upd.status).toBe(200);
    expect(upd.body.role).toBe('visitor');

    // non-owner cannot mutate
    const forbidden = await request(app)
      .post(`/api/villages/${villageId}/access`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ userId: tmp.id, role: 'member' });
    expect(forbidden.status).toBe(403);

    // delete
    const del = await request(app)
      .delete(`/api/villages/${villageId}/access/${tmp.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(del.status).toBe(204);
  });

  it('public toggle affects unauthenticated visibility', async () => {
    // when private, unauthenticated GET is 401
    const before = await request(app).get(`/api/villages/${villageId}`);
    expect([401, 403]).toContain(before.status);

    // owner makes it public
    const put = await request(app)
      .put(`/api/villages/${villageId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isPublic: true });
    expect(put.status).toBe(200);
    expect(put.body.isPublic).toBe(true);

    // unauthenticated can view
    const pub = await request(app).get(`/api/villages/${villageId}`);
    expect(pub.status).toBe(200);
  });
});

