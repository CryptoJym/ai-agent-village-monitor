import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';

import { createApp } from '../../app';
import { signAccessToken } from '../../auth/jwt';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from '../utils/db';
import { createUserCreateData, createVillageCreateData } from '../utils/fixtures';

describe('Villages API (SQLite integration)', () => {
  let app: any;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('creates a village and grants owner access', async () => {
    const user = await prisma.user.create({
      data: createUserCreateData({ username: 'owner', email: 'owner@test.com' }),
    });
    const token = signAccessToken(user.id, user.username || 'owner');

    const body = createVillageCreateData({ name: 'My Village' });
    const create = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    expect(create.body).toMatchObject({ name: 'My Village' });
    expect(typeof create.body.id).toBe('string');
    expect(typeof create.body.githubOrgId).toBe('string');

    const access = await prisma.villageAccess.findUnique({
      where: { villageId_userId: { villageId: create.body.id, userId: user.id } },
    });
    expect(access?.role).toBe('owner');
  });

  it('GET /api/villages/:id requires auth and reports viewerRole', async () => {
    const user = await prisma.user.create({
      data: createUserCreateData({ username: 'owner2', email: 'owner2@test.com' }),
    });
    const token = signAccessToken(user.id, user.username || 'owner2');

    const create = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${token}`)
      .send(createVillageCreateData({ name: 'Public Village' }))
      .expect(201);

    const villageId = String(create.body.id);

    await request(app).get(`/api/villages/${villageId}`).expect(401);

    const authed = await request(app)
      .get(`/api/villages/${villageId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(authed.body.viewerRole).toBe('owner');
  });

  it('lists villages for the authenticated user', async () => {
    const user = await prisma.user.create({
      data: createUserCreateData({ username: 'listowner', email: 'listowner@test.com' }),
    });
    const token = signAccessToken(user.id, user.username || 'listowner');

    const create = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${token}`)
      .send(createVillageCreateData({ name: 'List Village' }))
      .expect(201);

    const list = await request(app)
      .get('/api/villages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((v: any) => v.id === create.body.id)).toBe(true);
  });

  it('updates village name (owner)', async () => {
    const user = await prisma.user.create({
      data: createUserCreateData({ username: 'upowner', email: 'upowner@test.com' }),
    });
    const token = signAccessToken(user.id, user.username || 'upowner');

    const create = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${token}`)
      .send(createVillageCreateData({ name: 'Old Name' }))
      .expect(201);

    const villageId = String(create.body.id);

    await request(app)
      .put(`/api/villages/${villageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' })
      .expect(200);

    const get = await request(app)
      .get(`/api/villages/${villageId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(get.body.name).toBe('New Name');
  });

  it('enforces owner-only access management and allows member layout access', async () => {
    const owner = await prisma.user.create({
      data: createUserCreateData({ username: 'owner3', email: 'owner3@test.com' }),
    });
    const member = await prisma.user.create({
      data: createUserCreateData({ username: 'member3', email: 'member3@test.com' }),
    });
    const ownerToken = signAccessToken(owner.id, owner.username || 'owner3');
    const memberToken = signAccessToken(member.id, member.username || 'member3');

    const create = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(createVillageCreateData({ name: 'Perm Village' }))
      .expect(201);

    const villageId = String(create.body.id);

    await request(app)
      .get(`/api/villages/${villageId}/access`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    await request(app)
      .get(`/api/villages/${villageId}/access`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    await request(app)
      .post(`/api/villages/${villageId}/access`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: member.id, role: 'member' })
      .expect(201);

    await request(app)
      .get(`/api/villages/${villageId}/layout`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
  });
});
