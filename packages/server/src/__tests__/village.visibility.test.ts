import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../db/client';
import { signAccessToken } from '../auth/jwt';

const hasDb = !!process.env.DATABASE_URL && process.env.DISABLE_DB_TESTS !== 'true';

describe('village visibility and roles', () => {
  const app = createApp();
  let ownerToken = '';
  let memberToken = '';
  let outsiderToken = '';
  let villageId = 0;

  beforeAll(async () => {
    if (!hasDb) return;
    const owner = await prisma.user.create({ data: { githubId: BigInt(Date.now()), username: 'v-owner' } });
    const member = await prisma.user.create({ data: { githubId: BigInt(Date.now() + 1), username: 'v-member' } });
    const outsider = await prisma.user.create({ data: { githubId: BigInt(Date.now() + 2), username: 'v-outsider' } });
    ownerToken = signAccessToken(owner.id, owner.username);
    memberToken = signAccessToken(member.id, member.username);
    outsiderToken = signAccessToken(outsider.id, outsider.username);
    const v = await prisma.village.create({ data: { name: 'RBAC Village', githubOrgId: BigInt(4242), ownerId: owner.id, isPublic: false } });
    villageId = v.id;
    await prisma.villageAccess.create({ data: { villageId: v.id, userId: member.id, role: 'member' } });
  });

  it.skipIf(!hasDb)('private village: owner sees owner role; member sees member; outsider forbidden', async () => {
    const ownerRes = await request(app).get(`/api/villages/${villageId}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body?.viewerRole).toBe('owner');

    const memberRes = await request(app).get(`/api/villages/${villageId}`).set('Authorization', `Bearer ${memberToken}`);
    expect(memberRes.status).toBe(200);
    expect(memberRes.body?.viewerRole).toBe('member');

    const outRes = await request(app).get(`/api/villages/${villageId}`).set('Authorization', `Bearer ${outsiderToken}`);
    expect(outRes.status).toBe(403);
  });

  it.skipIf(!hasDb)('public village: no-auth and outsider see visitor role', async () => {
    // Owner makes village public
    const put = await request(app)
      .put(`/api/villages/${villageId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isPublic: true });
    expect(put.status).toBe(200);

    // No auth
    const anon = await request(app).get(`/api/villages/${villageId}`);
    expect(anon.status).toBe(200);
    expect(anon.body?.viewerRole).toBe('visitor');

    // Outsider auth
    const out = await request(app).get(`/api/villages/${villageId}`).set('Authorization', `Bearer ${outsiderToken}`);
    expect(out.status).toBe(200);
    expect(out.body?.viewerRole).toBe('visitor');
  });

  it.skipIf(!hasDb)('member cannot set public flag', async () => {
    const res = await request(app)
      .put(`/api/villages/${villageId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ isPublic: false });
    expect([401,403]).toContain(res.status);
  });
});

