import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';

import { createApp } from '../../app';
import { signAccessToken } from '../../auth/jwt';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from '../utils/db';
import {
  createUserCreateData,
  createVillageCreateData,
  createHouseCreateData,
} from '../utils/fixtures';

describe('Houses API (SQLite integration)', () => {
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

  it('rejects requests without auth', async () => {
    await request(app).get('/api/houses').expect(401);
  });

  it('creates, lists, reads, updates, and deletes a house', async () => {
    const owner = await prisma.user.create({
      data: createUserCreateData({ username: 'houseowner', email: 'houseowner@test.com' }),
    });
    const token = signAccessToken(owner.id, owner.username || 'houseowner');

    const village = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${token}`)
      .send(createVillageCreateData({ name: 'House Village' }))
      .expect(201);
    const villageId = String(village.body.id);

    const create = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${token}`)
      .send(createHouseCreateData({ villageId, repoName: 'repo-1' }))
      .expect(201);

    const houseId = String(create.body.id);
    expect(create.body).toMatchObject({ villageId, repoName: 'repo-1' });

    const list = await request(app)
      .get(`/api/houses?villageId=${encodeURIComponent(villageId)}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.items).toBeInstanceOf(Array);
    expect(list.body.items.some((h: any) => h.id === houseId)).toBe(true);

    const get = await request(app)
      .get(`/api/houses/${houseId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(get.body).toMatchObject({ id: houseId, villageId });
    expect(get.body.village).toHaveProperty('orgName');
    expect(get.body.rooms).toBeInstanceOf(Array);
    expect(get.body.agents).toBeInstanceOf(Array);

    const updated = await request(app)
      .put(`/api/houses/${houseId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ positionX: 12, positionY: 34, spriteScale: 1.2 })
      .expect(200);
    expect(updated.body.positionX).toBe(12);
    expect(updated.body.positionY).toBe(34);
    expect(updated.body.spriteScale).toBe(1.2);

    await request(app)
      .delete(`/api/houses/${houseId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(app)
      .get(`/api/houses/${houseId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('forbids creating a house without village access', async () => {
    const owner = await prisma.user.create({
      data: createUserCreateData({ username: 'vowner', email: 'vowner@test.com' }),
    });
    const intruder = await prisma.user.create({
      data: createUserCreateData({ username: 'intruder', email: 'intruder@test.com' }),
    });
    const ownerToken = signAccessToken(owner.id, owner.username || 'vowner');
    const intruderToken = signAccessToken(intruder.id, intruder.username || 'intruder');

    const village = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(createVillageCreateData({ name: 'Private Village' }))
      .expect(201);
    const villageId = String(village.body.id);

    await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${intruderToken}`)
      .send(createHouseCreateData({ villageId, repoName: 'repo-forbidden' }))
      .expect(403);
  });
});
