/**
 * Integration Tests: Rooms API
 * Tests CRUD operations and decorations for rooms
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
  createDecorationCreateData,
  createUserCreateData,
} from '../utils/fixtures';

describe('Rooms Integration Tests', () => {
  let prisma: PrismaClient;
  let testUserId: string;
  let authHeaders: Record<string, string>;
  let villageId: number;
  let houseId: number;

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
      })
    );

    // Create test village and house
    const village = await prisma.village.create({
      data: createVillageCreateData({ name: 'Test Village', ownerId: testUserId }),
    });
    villageId = village.id;

    const house = await prisma.house.create({
      data: createHouseCreateData({ villageId, name: 'Test House' }),
    });
    houseId = house.id;
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('POST /api/houses/:houseId/rooms - Create Room', () => {
    it('should create a new room in house', async () => {
      const roomData = createRoomCreateData({
        houseId,
        name: 'index.ts',
        path: '/src/index.ts',
        roomType: 'entrance',
      });

      const response = await request(app)
        .post(`/api/houses/${houseId}/rooms`)
        .set(authHeaders)
        .send(roomData)
        .expect(201);

      expect(response.body).toMatchObject({
        houseId,
        name: 'index.ts',
        path: '/src/index.ts',
        roomType: 'entrance',
      });
      expect(response.body.id).toBeDefined();
    });

    it('should create rooms with different types', async () => {
      const roomTypes = ['entrance', 'hallway', 'workspace', 'library', 'vault', 'laboratory', 'archive'];

      for (const roomType of roomTypes) {
        const roomData = createRoomCreateData({
          houseId,
          name: `${roomType}.ts`,
          roomType: roomType as any,
        });

        const response = await request(app)
          .post(`/api/houses/${houseId}/rooms`)
          .set(authHeaders)
          .send(roomData)
          .expect(201);

        expect(response.body.roomType).toBe(roomType);
      }
    });

    it('should create rooms with different module types', async () => {
      const moduleTypes = [
        'component',
        'service',
        'repository',
        'controller',
        'utility',
        'config',
        'type_def',
        'test',
        'asset',
        'root',
      ];

      for (const moduleType of moduleTypes) {
        const roomData = createRoomCreateData({
          houseId,
          name: `${moduleType}.ts`,
          moduleType: moduleType as any,
        });

        const response = await request(app)
          .post(`/api/houses/${houseId}/rooms`)
          .set(authHeaders)
          .send(roomData)
          .expect(201);

        expect(response.body.moduleType).toBe(moduleType);
      }
    });

    it('should set room complexity', async () => {
      const roomData = createRoomCreateData({
        houseId,
        name: 'complex.ts',
        complexity: 50,
      });

      const response = await request(app)
        .post(`/api/houses/${houseId}/rooms`)
        .set(authHeaders)
        .send(roomData)
        .expect(201);

      expect(response.body.complexity).toBe(50);
    });

    it('should fail without authentication', async () => {
      const roomData = createRoomCreateData({ houseId });

      await request(app).post(`/api/houses/${houseId}/rooms`).send(roomData).expect(401);
    });

    it('should validate room data', async () => {
      await request(app)
        .post(`/api/houses/${houseId}/rooms`)
        .set(authHeaders)
        .send({ name: '' }) // Invalid: missing required fields
        .expect(400);
    });
  });

  describe('GET /api/houses/:houseId/rooms - List Rooms', () => {
    beforeEach(async () => {
      await prisma.room.createMany({
        data: [
          createRoomCreateData({ houseId, name: 'room1.ts', roomType: 'workspace' }),
          createRoomCreateData({ houseId, name: 'room2.ts', roomType: 'library' }),
          createRoomCreateData({ houseId, name: 'room3.ts', roomType: 'workspace' }),
        ],
      });
    });

    it('should list all rooms in house', async () => {
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
        .get(`/api/houses/${houseId}/rooms?roomType=workspace`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.length).toBe(2);
      expect(response.body.every((r: any) => r.roomType === 'workspace')).toBe(true);
    });

    it('should filter rooms by module type', async () => {
      await prisma.room.create({
        data: createRoomCreateData({
          houseId,
          name: 'test.spec.ts',
          moduleType: 'test',
        }),
      });

      const response = await request(app)
        .get(`/api/houses/${houseId}/rooms?moduleType=test`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.every((r: any) => r.moduleType === 'test')).toBe(true);
    });

    it('should include room coordinates', async () => {
      const response = await request(app)
        .get(`/api/houses/${houseId}/rooms`)
        .set(authHeaders)
        .expect(200);

      expect(response.body[0]).toHaveProperty('x');
      expect(response.body[0]).toHaveProperty('y');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get(`/api/houses/${houseId}/rooms?limit=2`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/rooms/:id - Get Room by ID', () => {
    let roomId: number;

    beforeEach(async () => {
      const room = await prisma.room.create({
        data: createRoomCreateData({
          houseId,
          name: 'test-room.ts',
          path: '/src/test-room.ts',
        }),
      });
      roomId = room.id;
    });

    it('should get room with details', async () => {
      const response = await request(app).get(`/api/rooms/${roomId}`).set(authHeaders).expect(200);

      expect(response.body.id).toBe(roomId);
      expect(response.body.name).toBe('test-room.ts');
      expect(response.body.path).toBe('/src/test-room.ts');
    });

    it('should include house reference', async () => {
      const response = await request(app).get(`/api/rooms/${roomId}`).set(authHeaders).expect(200);

      expect(response.body.houseId).toBe(houseId);
    });

    it('should return 404 for non-existent room', async () => {
      await request(app).get('/api/rooms/999999').set(authHeaders).expect(404);
    });
  });

  describe('PATCH /api/rooms/:id - Update Room', () => {
    let roomId: number;

    beforeEach(async () => {
      const room = await prisma.room.create({
        data: createRoomCreateData({
          houseId,
          name: 'original.ts',
          complexity: 10,
        }),
      });
      roomId = room.id;
    });

    it('should update room name', async () => {
      const response = await request(app)
        .patch(`/api/rooms/${roomId}`)
        .set(authHeaders)
        .send({ name: 'updated.ts' })
        .expect(200);

      expect(response.body.name).toBe('updated.ts');
    });

    it('should update room complexity', async () => {
      const response = await request(app)
        .patch(`/api/rooms/${roomId}`)
        .set(authHeaders)
        .send({ complexity: 75 })
        .expect(200);

      expect(response.body.complexity).toBe(75);
    });

    it('should update room position', async () => {
      const response = await request(app)
        .patch(`/api/rooms/${roomId}`)
        .set(authHeaders)
        .send({ x: 50, y: 60 })
        .expect(200);

      expect(response.body.x).toBe(50);
      expect(response.body.y).toBe(60);
    });

    it('should update room type', async () => {
      const response = await request(app)
        .patch(`/api/rooms/${roomId}`)
        .set(authHeaders)
        .send({ roomType: 'laboratory' })
        .expect(200);

      expect(response.body.roomType).toBe('laboratory');
    });

    it('should fail without authentication', async () => {
      await request(app).patch(`/api/rooms/${roomId}`).send({ name: 'new.ts' }).expect(401);
    });

    it('should validate update data', async () => {
      await request(app)
        .patch(`/api/rooms/${roomId}`)
        .set(authHeaders)
        .send({ complexity: 'invalid' }) // Invalid: should be number
        .expect(400);
    });
  });

  describe('DELETE /api/rooms/:id - Delete Room', () => {
    let roomId: number;

    beforeEach(async () => {
      const room = await prisma.room.create({
        data: createRoomCreateData({ houseId, name: 'to-delete.ts' }),
      });
      roomId = room.id;
    });

    it('should delete room', async () => {
      await request(app).delete(`/api/rooms/${roomId}`).set(authHeaders).expect(204);

      const deletedRoom = await prisma.room.findUnique({
        where: { id: roomId },
      });
      expect(deletedRoom).toBeNull();
    });

    it('should cascade delete decorations', async () => {
      await prisma.decoration.create({
        data: createDecorationCreateData({ roomId }),
      });

      await request(app).delete(`/api/rooms/${roomId}`).set(authHeaders).expect(204);

      const decorations = await prisma.decoration.findMany({
        where: { roomId },
      });
      expect(decorations.length).toBe(0);
    });

    it('should fail without authentication', async () => {
      await request(app).delete(`/api/rooms/${roomId}`).expect(401);
    });
  });

  describe('Room Decorations', () => {
    let roomId: number;

    beforeEach(async () => {
      const room = await prisma.room.create({
        data: createRoomCreateData({ houseId, name: 'decorated-room.ts' }),
      });
      roomId = room.id;

      // Create decorations
      await prisma.decoration.createMany({
        data: [
          createDecorationCreateData({
            roomId,
            decorationType: 'plant',
            x: 10,
            y: 10,
          }),
          createDecorationCreateData({
            roomId,
            decorationType: 'desk',
            x: 20,
            y: 20,
          }),
          createDecorationCreateData({
            roomId,
            decorationType: 'bookshelf',
            x: 30,
            y: 30,
          }),
        ],
      });
    });

    it('should get room with decorations', async () => {
      const response = await request(app)
        .get(`/api/rooms/${roomId}?include=decorations`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.decorations).toBeInstanceOf(Array);
      expect(response.body.decorations.length).toBe(3);
    });

    it('should list decorations for a room', async () => {
      const response = await request(app)
        .get(`/api/rooms/${roomId}/decorations`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      expect(response.body.every((d: any) => d.roomId === roomId)).toBe(true);
    });

    it('should create new decoration', async () => {
      const decorationData = createDecorationCreateData({
        roomId,
        decorationType: 'lamp',
        x: 40,
        y: 40,
      });

      const response = await request(app)
        .post(`/api/rooms/${roomId}/decorations`)
        .set(authHeaders)
        .send(decorationData)
        .expect(201);

      expect(response.body).toMatchObject({
        roomId,
        decorationType: 'lamp',
        x: 40,
        y: 40,
      });
    });

    it('should update decoration position', async () => {
      const decoration = await prisma.decoration.findFirst({
        where: { roomId },
      });

      const response = await request(app)
        .patch(`/api/decorations/${decoration!.id}`)
        .set(authHeaders)
        .send({ x: 100, y: 150 })
        .expect(200);

      expect(response.body.x).toBe(100);
      expect(response.body.y).toBe(150);
    });

    it('should delete decoration', async () => {
      const decoration = await prisma.decoration.findFirst({
        where: { roomId },
      });

      await request(app)
        .delete(`/api/decorations/${decoration!.id}`)
        .set(authHeaders)
        .expect(204);

      const deleted = await prisma.decoration.findUnique({
        where: { id: decoration!.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe('Room Complexity and Metrics', () => {
    let roomId: number;

    beforeEach(async () => {
      const room = await prisma.room.create({
        data: createRoomCreateData({
          houseId,
          name: 'complex-room.ts',
          complexity: 100,
        }),
      });
      roomId = room.id;

      // Create room metrics
      await prisma.roomMetric.createMany({
        data: [
          {
            roomId,
            metricType: 'lines_of_code',
            value: 500,
            timestamp: new Date(),
          },
          {
            roomId,
            metricType: 'cyclomatic_complexity',
            value: 15,
            timestamp: new Date(),
          },
        ],
      });
    });

    it('should fetch room with metrics', async () => {
      const response = await request(app)
        .get(`/api/rooms/${roomId}?include=metrics`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.metrics).toBeDefined();
    });

    it('should calculate complexity score', async () => {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      expect(room?.complexity).toBe(100);
    });

    it('should aggregate metrics across rooms', async () => {
      await prisma.room.createMany({
        data: [
          createRoomCreateData({ houseId, complexity: 50 }),
          createRoomCreateData({ houseId, complexity: 75 }),
        ],
      });

      const rooms = await prisma.room.findMany({ where: { houseId } });
      const totalComplexity = rooms.reduce((sum, r) => sum + (r.complexity || 0), 0);

      expect(totalComplexity).toBeGreaterThanOrEqual(225); // 100 + 50 + 75
    });
  });

  describe('Room Hierarchy and Navigation', () => {
    beforeEach(async () => {
      await prisma.room.createMany({
        data: [
          createRoomCreateData({
            houseId,
            name: 'index.ts',
            path: '/src/index.ts',
            roomType: 'entrance',
          }),
          createRoomCreateData({
            houseId,
            name: 'utils.ts',
            path: '/src/utils/utils.ts',
            roomType: 'library',
          }),
          createRoomCreateData({
            houseId,
            name: 'api.ts',
            path: '/src/api/api.ts',
            roomType: 'workspace',
          }),
        ],
      });
    });

    it('should organize rooms by path hierarchy', async () => {
      const rooms = await prisma.room.findMany({
        where: { houseId },
        orderBy: { path: 'asc' },
      });

      expect(rooms.length).toBe(3);
      // Paths should be ordered
      const paths = rooms.map((r) => r.path);
      expect(paths).toEqual([...paths].sort());
    });

    it('should identify entrance rooms', async () => {
      const entrances = await prisma.room.findMany({
        where: {
          houseId,
          roomType: 'entrance',
        },
      });

      expect(entrances.length).toBeGreaterThanOrEqual(1);
    });

    it('should group rooms by directory', async () => {
      const rooms = await prisma.room.findMany({ where: { houseId } });

      const byDirectory = rooms.reduce((acc, room) => {
        const dir = room.path.split('/').slice(0, -1).join('/') || '/';
        acc[dir] = (acc[dir] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(Object.keys(byDirectory).length).toBeGreaterThan(0);
    });
  });

  describe('Access Control', () => {
    let roomId: number;
    let otherUserId: string;
    let otherAuthHeaders: Record<string, string>;

    beforeEach(async () => {
      const room = await prisma.room.create({
        data: createRoomCreateData({ houseId, name: 'secure-room.ts' }),
      });
      roomId = room.id;

      const otherUser = await prisma.user.create({
        data: createUserCreateData({ username: 'otheruser', email: 'other@test.com' }),
      });
      otherUserId = otherUser.id;
      otherAuthHeaders = getAuthHeaders(
        generateTestToken({
          id: otherUserId,
          githubId: otherUser.githubId || BigInt(789012),
          username: 'otheruser',
        })
      );
    });

    it('should allow village owner to modify rooms', async () => {
      await request(app)
        .patch(`/api/rooms/${roomId}`)
        .set(authHeaders)
        .send({ name: 'updated-by-owner.ts' })
        .expect(200);
    });

    it('should deny non-village-member from modifying rooms', async () => {
      await request(app)
        .patch(`/api/rooms/${roomId}`)
        .set(otherAuthHeaders)
        .send({ name: 'attempted-update.ts' })
        .expect(403);
    });

    it('should allow viewing rooms in public village', async () => {
      const response = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set(otherAuthHeaders)
        .expect(200);

      expect(response.body.id).toBe(roomId);
    });
  });
});
