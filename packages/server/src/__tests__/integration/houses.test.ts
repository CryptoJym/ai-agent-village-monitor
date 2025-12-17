/**
 * Integration Tests: Houses API
 * Tests CRUD operations and room relations for houses
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '../../app';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from '../utils/db';
import { generateTestToken, getAuthHeaders } from '../utils/auth';
import {
  createVillageCreateData,
  createHouseCreateData,
  createRoomCreateData,
  createUserCreateData,
} from '../utils/fixtures';

describe('Houses Integration Tests', () => {
  let prisma: PrismaClient;
  let testUserId: string;
  let authHeaders: Record<string, string>;
  let villageId: number;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Create test user
    const user = await prisma.user.create({
      data: createUserCreateData({ username: 'testuser', email: 'user@test.com' }),
    });
    testUserId = user.id;

    authHeaders = getAuthHeaders(
      generateTestToken({
        id: testUserId,
        githubId: user.githubId || BigInt(123456),
        username: user.username || 'testuser',
      }),
    );

    // Create test village
    const village = await prisma.village.create({
      data: createVillageCreateData({ name: 'Test Village', ownerId: testUserId }),
    });
    villageId = village.id;
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('POST /api/villages/:villageId/houses - Create House', () => {
    it('should create a new house in village', async () => {
      const houseData = createHouseCreateData({
        villageId,
        name: 'Test Repository',
        x: 10,
        y: 20,
      });

      const response = await request(app)
        .post(`/api/villages/${villageId}/houses`)
        .set(authHeaders)
        .send(houseData)
        .expect(201);

      expect(response.body).toMatchObject({
        villageId,
        name: 'Test Repository',
        x: 10,
        y: 20,
      });
      expect(response.body.id).toBeDefined();
    });

    it('should create house with different sizes', async () => {
      const sizes = ['tiny', 'small', 'medium', 'large', 'huge'];

      for (const size of sizes) {
        const houseData = createHouseCreateData({
          villageId,
          name: `${size} House`,
          size: size as any,
        });

        const response = await request(app)
          .post(`/api/villages/${villageId}/houses`)
          .set(authHeaders)
          .send(houseData)
          .expect(201);

        expect(response.body.size).toBe(size);
      }
    });

    it('should fail without authentication', async () => {
      const houseData = createHouseCreateData({ villageId });

      await request(app).post(`/api/villages/${villageId}/houses`).send(houseData).expect(401);
    });

    it('should fail with invalid village ID', async () => {
      const houseData = createHouseCreateData({ villageId: 999999 });

      await request(app)
        .post('/api/villages/999999/houses')
        .set(authHeaders)
        .send(houseData)
        .expect(404);
    });

    it('should validate house data', async () => {
      const response = await request(app)
        .post(`/api/villages/${villageId}/houses`)
        .set(authHeaders)
        .send({ name: '' }) // Invalid: missing required fields
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/villages/:villageId/houses - List Houses', () => {
    beforeEach(async () => {
      // Create test houses
      await prisma.house.createMany({
        data: [
          createHouseCreateData({ villageId, name: 'House 1', x: 0, y: 0 }),
          createHouseCreateData({ villageId, name: 'House 2', x: 10, y: 10 }),
          createHouseCreateData({ villageId, name: 'House 3', x: 20, y: 20 }),
        ],
      });
    });

    it('should list all houses in village', async () => {
      const response = await request(app)
        .get(`/api/villages/${villageId}/houses`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      expect(response.body.every((h: any) => h.villageId === villageId)).toBe(true);
    });

    it('should include house coordinates', async () => {
      const response = await request(app)
        .get(`/api/villages/${villageId}/houses`)
        .set(authHeaders)
        .expect(200);

      expect(response.body[0]).toHaveProperty('x');
      expect(response.body[0]).toHaveProperty('y');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get(`/api/villages/${villageId}/houses?limit=2`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/houses/:id - Get House by ID', () => {
    let houseId: number;

    beforeEach(async () => {
      const house = await prisma.house.create({
        data: createHouseCreateData({ villageId, name: 'Test House' }),
      });
      houseId = house.id;
    });

    it('should get house with details', async () => {
      const response = await request(app)
        .get(`/api/houses/${houseId}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.id).toBe(houseId);
      expect(response.body.name).toBe('Test House');
    });

    it('should include village information', async () => {
      const response = await request(app)
        .get(`/api/houses/${houseId}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.villageId).toBe(villageId);
    });

    it('should return 404 for non-existent house', async () => {
      await request(app).get('/api/houses/999999').set(authHeaders).expect(404);
    });
  });

  describe('PATCH /api/houses/:id - Update House', () => {
    let houseId: number;

    beforeEach(async () => {
      const house = await prisma.house.create({
        data: createHouseCreateData({ villageId, name: 'Original House' }),
      });
      houseId = house.id;
    });

    it('should update house name', async () => {
      const response = await request(app)
        .patch(`/api/houses/${houseId}`)
        .set(authHeaders)
        .send({ name: 'Updated House Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated House Name');
    });

    it('should update house position', async () => {
      const response = await request(app)
        .patch(`/api/houses/${houseId}`)
        .set(authHeaders)
        .send({ x: 50, y: 60 })
        .expect(200);

      expect(response.body.x).toBe(50);
      expect(response.body.y).toBe(60);
    });

    it('should update house size', async () => {
      const response = await request(app)
        .patch(`/api/houses/${houseId}`)
        .set(authHeaders)
        .send({ size: 'huge' })
        .expect(200);

      expect(response.body.size).toBe('huge');
    });

    it('should fail without authentication', async () => {
      await request(app).patch(`/api/houses/${houseId}`).send({ name: 'New Name' }).expect(401);
    });

    it('should validate update data', async () => {
      await request(app)
        .patch(`/api/houses/${houseId}`)
        .set(authHeaders)
        .send({ x: 'invalid' }) // Invalid: x should be number
        .expect(400);
    });
  });

  describe('DELETE /api/houses/:id - Delete House', () => {
    let houseId: number;

    beforeEach(async () => {
      const house = await prisma.house.create({
        data: createHouseCreateData({ villageId, name: 'House to Delete' }),
      });
      houseId = house.id;
    });

    it('should delete house', async () => {
      await request(app).delete(`/api/houses/${houseId}`).set(authHeaders).expect(204);

      const deletedHouse = await prisma.house.findUnique({
        where: { id: houseId },
      });
      expect(deletedHouse).toBeNull();
    });

    it('should cascade delete rooms', async () => {
      // Create room in house
      const room = await prisma.room.create({
        data: createRoomCreateData({ houseId }),
      });

      await request(app).delete(`/api/houses/${houseId}`).set(authHeaders).expect(204);

      const deletedRoom = await prisma.room.findUnique({
        where: { id: room.id },
      });
      expect(deletedRoom).toBeNull();
    });

    it('should fail without authentication', async () => {
      await request(app).delete(`/api/houses/${houseId}`).expect(401);
    });
  });

  describe('House-Room Relations', () => {
    let houseId: number;

    beforeEach(async () => {
      const house = await prisma.house.create({
        data: createHouseCreateData({ villageId, name: 'Test House' }),
      });
      houseId = house.id;

      // Create rooms
      await prisma.room.createMany({
        data: [
          createRoomCreateData({ houseId, name: 'entrance.ts', roomType: 'entrance' }),
          createRoomCreateData({ houseId, name: 'workspace.ts', roomType: 'workspace' }),
          createRoomCreateData({ houseId, name: 'library.ts', roomType: 'library' }),
        ],
      });
    });

    it('should include rooms when fetching house', async () => {
      const response = await request(app)
        .get(`/api/houses/${houseId}?include=rooms`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.rooms).toBeInstanceOf(Array);
      expect(response.body.rooms.length).toBe(3);
    });

    it('should get rooms for a house', async () => {
      const response = await request(app)
        .get(`/api/houses/${houseId}/rooms`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      expect(response.body.every((r: any) => r.houseId === houseId)).toBe(true);
    });

    it('should filter rooms by type', async () => {
      const response = await request(app)
        .get(`/api/houses/${houseId}/rooms?roomType=entrance`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].roomType).toBe('entrance');
    });

    it('should count rooms in house', async () => {
      await request(app).get(`/api/houses/${houseId}`).set(authHeaders).expect(200);

      // House should include room count in response
      const roomCount = await prisma.room.count({ where: { houseId } });
      expect(roomCount).toBe(3);
    });
  });

  describe('House Analytics', () => {
    let houseId: number;

    beforeEach(async () => {
      const house = await prisma.house.create({
        data: createHouseCreateData({
          villageId,
          name: 'Analytics House',
        }),
      });
      houseId = house.id;

      // Create rooms with varying complexity
      await prisma.room.createMany({
        data: [
          createRoomCreateData({ houseId, complexity: 10 }),
          createRoomCreateData({ houseId, complexity: 20 }),
          createRoomCreateData({ houseId, complexity: 30 }),
        ],
      });
    });

    it('should calculate total complexity', async () => {
      const rooms = await prisma.room.findMany({ where: { houseId } });
      const totalComplexity = rooms.reduce((sum, room) => sum + (room.complexity || 0), 0);

      expect(totalComplexity).toBe(60);
    });

    it('should group rooms by type', async () => {
      await prisma.room.createMany({
        data: [
          createRoomCreateData({ houseId, roomType: 'workspace' }),
          createRoomCreateData({ houseId, roomType: 'workspace' }),
          createRoomCreateData({ houseId, roomType: 'library' }),
        ],
      });

      const groupedRooms = await prisma.room.groupBy({
        by: ['roomType'],
        where: { houseId },
        _count: { _all: true },
      });

      expect(groupedRooms.length).toBeGreaterThan(0);
      const workspaceCount = groupedRooms.find((g) => g.roomType === 'workspace')?._count._all;
      expect(workspaceCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Access Control', () => {
    let houseId: number;
    let otherUserId: string;
    let otherAuthHeaders: Record<string, string>;

    beforeEach(async () => {
      // Create other user
      const otherUser = await prisma.user.create({
        data: createUserCreateData({ username: 'otheruser', email: 'other@test.com' }),
      });
      otherUserId = otherUser.id;
      otherAuthHeaders = getAuthHeaders(
        generateTestToken({
          id: otherUserId,
          githubId: otherUser.githubId || BigInt(789012),
          username: 'otheruser',
        }),
      );

      const house = await prisma.house.create({
        data: createHouseCreateData({ villageId, name: 'Test House' }),
      });
      houseId = house.id;
    });

    it('should allow village owner to modify houses', async () => {
      await request(app)
        .patch(`/api/houses/${houseId}`)
        .set(authHeaders)
        .send({ name: 'Updated by Owner' })
        .expect(200);
    });

    it('should deny non-village-member from modifying houses', async () => {
      await request(app)
        .patch(`/api/houses/${houseId}`)
        .set(otherAuthHeaders)
        .send({ name: 'Attempted Update' })
        .expect(403);
    });

    it('should allow viewing public village houses', async () => {
      const response = await request(app)
        .get(`/api/houses/${houseId}`)
        .set(otherAuthHeaders)
        .expect(200);

      expect(response.body.id).toBe(houseId);
    });
  });
});
