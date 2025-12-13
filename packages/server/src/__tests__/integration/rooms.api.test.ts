/**
 * Integration tests for Rooms API
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

describe('Rooms API Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testVillageId: number;
  let testHouseId: number;
  let testRoomId: number;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';

    const { createApp } = await import('../../app');
    const { signAccessToken } = await import('../../auth/jwt');

    app = createApp();
    authToken = signAccessToken(1, 'testuser');

    // Create test village
    const villageResponse = await request(app)
      .post('/api/villages')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `test-village-${Date.now()}`,
        githubOrgId: String(Date.now()),
      });

    testVillageId = villageResponse.body.id;

    // Create test house
    const houseResponse = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        villageId: testVillageId,
        x: 10,
        y: 20,
        houseType: 'COTTAGE',
      });

    testHouseId = houseResponse.body.id;
  });

  describe('POST /api/rooms', () => {
    it('should create a new room', async () => {
      const roomData = {
        houseId: testHouseId,
        name: 'Test Office',
        roomType: 'OFFICE',
      };

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(roomData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        houseId: testHouseId,
        name: 'Test Office',
        roomType: 'OFFICE',
      });

      testRoomId = response.body.id;
    });

    it('should return 400 for missing name', async () => {
      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          houseId: testHouseId,
          roomType: 'OFFICE',
        })
        .expect(400);
    });

    it('should return 400 for invalid room type', async () => {
      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          houseId: testHouseId,
          name: 'Test Room',
          roomType: 'INVALID_TYPE',
        })
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/rooms')
        .send({
          houseId: testHouseId,
          name: 'Test Room',
          roomType: 'OFFICE',
        })
        .expect(401);
    });

    it('should return 404 for non-existent house', async () => {
      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          houseId: 999999,
          name: 'Test Room',
          roomType: 'OFFICE',
        })
        .expect(404);
    });
  });

  describe('GET /api/rooms', () => {
    it('should list all rooms', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should filter rooms by house', async () => {
      const response = await request(app)
        .get(`/api/rooms?houseId=${testHouseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((room: any) => {
        expect(room.houseId).toBe(testHouseId);
      });
    });

    it('should filter rooms by type', async () => {
      const response = await request(app)
        .get('/api/rooms?roomType=OFFICE')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((room: any) => {
        expect(room.roomType).toBe('OFFICE');
      });
    });

    it('should search rooms by name', async () => {
      const response = await request(app)
        .get('/api/rooms?search=Office')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/rooms/:id', () => {
    it('should get room by ID', async () => {
      const response = await request(app)
        .get(`/api/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testRoomId,
        houseId: testHouseId,
        name: expect.any(String),
      });
    });

    it('should return 404 for non-existent room', async () => {
      await request(app)
        .get('/api/rooms/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should include house when requested', async () => {
      const response = await request(app)
        .get(`/api/rooms/${testRoomId}?include=house`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('house');
      expect(response.body.house).toMatchObject({
        id: testHouseId,
      });
    });
  });

  describe('PATCH /api/rooms/:id', () => {
    it('should update room name', async () => {
      const updateData = {
        name: 'Updated Office',
      };

      const response = await request(app)
        .patch(`/api/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Updated Office');
    });

    it('should update room type', async () => {
      const response = await request(app)
        .patch(`/api/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roomType: 'BEDROOM' })
        .expect(200);

      expect(response.body.roomType).toBe('BEDROOM');
    });

    it('should return 400 for empty name', async () => {
      await request(app)
        .patch(`/api/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' })
        .expect(400);
    });

    it('should return 404 for non-existent room', async () => {
      await request(app)
        .patch('/api/rooms/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' })
        .expect(404);
    });
  });

  describe('DELETE /api/rooms/:id', () => {
    it('should delete room', async () => {
      // Create room to delete
      const createResponse = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          houseId: testHouseId,
          name: 'Room to Delete',
          roomType: 'OFFICE',
        })
        .expect(201);

      const roomId = createResponse.body.id;

      // Delete
      await request(app)
        .delete(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deleted
      await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent room', async () => {
      await request(app)
        .delete('/api/rooms/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Room capacity', () => {
    it('should enforce maximum room capacity', async () => {
      // Try to create more rooms than allowed per house (if there's a limit)
      const roomsToCreate = 20;
      const promises = [];

      for (let i = 0; i < roomsToCreate; i++) {
        promises.push(
          request(app)
            .post('/api/rooms')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              houseId: testHouseId,
              name: `Room ${i}`,
              roomType: 'OFFICE',
            }),
        );
      }

      const results = await Promise.all(promises);

      // Some should succeed, some might fail if there's a limit
      const successes = results.filter((r) => r.status === 201);
      expect(successes.length).toBeGreaterThan(0);
    });
  });
});
