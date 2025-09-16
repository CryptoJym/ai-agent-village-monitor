import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../db/client';
import { signAccessToken } from '../auth/jwt';

const hasDb = !!process.env.DATABASE_URL && process.env.DISABLE_DB_TESTS !== 'true';

describe('permissions: village access and public flag', () => {
  const app = createApp();
  let ownerId = 0;
  let memberId = 0;
  let outsiderId = 0;
  let villageId = 0;
  let ownerToken = '';
  let memberToken = '';
  let outsiderToken = '';

  beforeAll(async () => {
    if (!hasDb) return;
    // users
    const owner = await prisma.user.create({ data: { githubId: BigInt(Date.now()), username: 'owner-t' } as any });
    const member = await prisma.user.create({ data: { githubId: BigInt(Date.now() + 1), username: 'member-t' } as any });
    const outsider = await prisma.user.create({ data: { githubId: BigInt(Date.now() + 2), username: 'outsider-t' } as any });
    ownerId = (owner as any).id;
    memberId = (member as any).id;
    outsiderId = (outsider as any).id;
    ownerToken = signAccessToken(ownerId, (owner as any).username || 'owner-t');
    memberToken = signAccessToken(memberId, (member as any).username || 'member-t');
    outsiderToken = signAccessToken(outsiderId, (outsider as any).username || 'outsider-t');
    // village owned by owner
    const v = await prisma.village.create({ data: { name: 'perm-v', githubOrgId: BigInt(4242), ownerId, isPublic: false } as any });
    villageId = (v as any).id;
    // grant member access
    await prisma.villageAccess.create({ data: { villageId, userId: memberId, role: 'member' } as any });
  });

  it.skipIf(!hasDb)('owner can list access; member forbidden', async () => {
    const ownerList = await request(app).get(`/api/villages/${villageId}/access`).set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerList.status).toBe(200);
    const memberList = await request(app).get(`/api/villages/${villageId}/access`).set('Authorization', `Bearer ${memberToken}`);
    expect(memberList.status).toBe(403);
  });

  it.skipIf(!hasDb)('member cannot toggle public; owner can', async () => {
    const memberPut = await request(app)
      .put(`/api/villages/${villageId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ isPublic: true });
    expect(memberPut.status).toBe(403);

    const ownerPut = await request(app)
      .put(`/api/villages/${villageId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isPublic: true });
    expect(ownerPut.status).toBe(200);

    // Now public: allow anonymous GET
    const anonGet = await request(app).get(`/api/villages/${villageId}`);
    expect(anonGet.status).toBe(200);
    expect(anonGet.body).toHaveProperty('isPublic', true);
  });

  it.skipIf(!hasDb)('owner can upsert and update roles; outsider forbidden', async () => {
    // upsert visitor role for outsider (as owner)
    const up = await request(app)
      .post(`/api/villages/${villageId}/access`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: outsiderId, role: 'visitor' });
    expect([200, 201]).toContain(up.status);

    // update role to member
    const upd = await request(app)
      .put(`/api/villages/${villageId}/access/${outsiderId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'member' });
    expect(upd.status).toBe(200);

    // outsider cannot modify
    const outUpd = await request(app)
      .put(`/api/villages/${villageId}/access/${memberId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ role: 'visitor' });
    expect([401, 403]).toContain(outUpd.status);
  });
});

