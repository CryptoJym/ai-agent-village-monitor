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
  createRoomCreateData,
} from '../utils/fixtures';

describe('Rooms API (SQLite integration)', () => {
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

  it('creates a room in a house and supports basic CRUD', async () => {
    const owner = await prisma.user.create({
      data: createUserCreateData({ username: 'roomowner', email: 'roomowner@test.com' }),
    });
    const token = signAccessToken(owner.id, owner.username || 'roomowner');

    const village = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${token}`)
      .send(createVillageCreateData({ name: 'Room Village' }))
      .expect(201);
    const villageId = String(village.body.id);

    const house = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${token}`)
      .send(createHouseCreateData({ villageId, repoName: 'repo-room' }))
      .expect(201);
    const houseId = String(house.body.id);

    const create = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send(
        createRoomCreateData({
          houseId,
          name: 'entrance',
          roomType: 'entrance',
          x: 1,
          y: 2,
          width: 10,
          height: 8,
        }),
      )
      .expect(201);

    const roomId = String(create.body.id);
    expect(create.body).toMatchObject({
      id: roomId,
      houseId,
      name: 'entrance',
      roomType: 'entrance',
    });

    const list = await request(app)
      .get(`/api/rooms?houseId=${encodeURIComponent(houseId)}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.items).toBeInstanceOf(Array);
    expect(list.body.items.some((r: any) => r.id === roomId)).toBe(true);

    const get = await request(app)
      .get(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(get.body).toMatchObject({ id: roomId, houseId });

    const updated = await request(app)
      .put(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'entry', x: 3 })
      .expect(200);
    expect(updated.body.name).toBe('entry');
    expect(updated.body.x).toBe(3);

    const decorations = await request(app)
      .put(`/api/rooms/${roomId}/decorations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ decorations: [{ type: 'plant', x: 1, y: 1, tileId: 5, rotation: 0 }] })
      .expect(200);
    expect(decorations.body).toHaveProperty('decorations');

    await request(app)
      .delete(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    await request(app)
      .get(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('forbids creating a room without village access', async () => {
    const owner = await prisma.user.create({
      data: createUserCreateData({ username: 'roomvowner', email: 'roomvowner@test.com' }),
    });
    const intruder = await prisma.user.create({
      data: createUserCreateData({ username: 'roomintruder', email: 'roomintruder@test.com' }),
    });
    const ownerToken = signAccessToken(owner.id, owner.username || 'roomvowner');
    const intruderToken = signAccessToken(intruder.id, intruder.username || 'roomintruder');

    const village = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(createVillageCreateData({ name: 'No Access Village' }))
      .expect(201);
    const villageId = String(village.body.id);

    const house = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(createHouseCreateData({ villageId, repoName: 'repo-locked' }))
      .expect(201);
    const houseId = String(house.body.id);

    await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${intruderToken}`)
      .send(createRoomCreateData({ houseId, name: 'forbidden', x: 0, y: 0, width: 5, height: 5 }))
      .expect(403);
  });
});
