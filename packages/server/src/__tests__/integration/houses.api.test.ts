/**
 * Integration tests for Houses API
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

describe('Houses API Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testVillageId: number;
  let testHouseId: number;

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
  });

  describe('POST /api/houses', () => {
    it('should create a new house', async () => {
      const houseData = {
        villageId: testVillageId,
        x: 10,
        y: 20,
        houseType: 'COTTAGE',
      };

      const response = await request(app)
        .post('/api/houses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(houseData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        villageId: testVillageId,
        x: 10,
        y: 20,
        houseType: 'COTTAGE',
      });

      testHouseId = response.body.id;
    });

    it('should return 400 for invalid coordinates', async () => {
      await request(app)
        .post('/api/houses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          villageId: testVillageId,
          x: -1, // Invalid coordinate
          y: 20,
          houseType: 'COTTAGE',
        })
        .expect(400);
    });

    it('should return 400 for invalid house type', async () => {
      await request(app)
        .post('/api/houses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          villageId: testVillageId,
          x: 10,
          y: 20,
          houseType: 'INVALID_TYPE',
        })
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/houses')
        .send({
          villageId: testVillageId,
          x: 10,
          y: 20,
          houseType: 'COTTAGE',
        })
        .expect(401);
    });
  });

  describe('GET /api/houses', () => {
    it('should list all houses', async () => {
      const response = await request(app)
        .get('/api/houses')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should filter houses by village', async () => {
      const response = await request(app)
        .get(`/api/houses?villageId=${testVillageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((house: any) => {
        expect(house.villageId).toBe(testVillageId);
      });
    });

    it('should filter houses by type', async () => {
      const response = await request(app)
        .get('/api/houses?houseType=COTTAGE')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((house: any) => {
        expect(house.houseType).toBe('COTTAGE');
      });
    });
  });

  describe('GET /api/houses/:id', () => {
    it('should get house by ID', async () => {
      const response = await request(app)
        .get(`/api/houses/${testHouseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testHouseId,
        villageId: testVillageId,
      });
    });

    it('should return 404 for non-existent house', async () => {
      await request(app)
        .get('/api/houses/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should include rooms when requested', async () => {
      const response = await request(app)
        .get(`/api/houses/${testHouseId}?include=rooms`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('rooms');
      expect(response.body.rooms).toBeInstanceOf(Array);
    });
  });

  describe('PATCH /api/houses/:id', () => {
    it('should update house position', async () => {
      const updateData = {
        x: 30,
        y: 40,
      };

      const response = await request(app)
        .patch(`/api/houses/${testHouseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testHouseId,
        x: 30,
        y: 40,
      });
    });

    it('should update house type', async () => {
      const response = await request(app)
        .patch(`/api/houses/${testHouseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ houseType: 'MANSION' })
        .expect(200);

      expect(response.body.houseType).toBe('MANSION');
    });

    it('should return 400 for invalid coordinates', async () => {
      await request(app)
        .patch(`/api/houses/${testHouseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ x: -100 })
        .expect(400);
    });
  });

  describe('DELETE /api/houses/:id', () => {
    it('should delete house', async () => {
      // Create house to delete
      const createResponse = await request(app)
        .post('/api/houses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          villageId: testVillageId,
          x: 50,
          y: 60,
          houseType: 'COTTAGE',
        })
        .expect(201);

      const houseId = createResponse.body.id;

      // Delete
      await request(app)
        .delete(`/api/houses/${houseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deleted
      await request(app)
        .get(`/api/houses/${houseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should cascade delete rooms', async () => {
      // Create house with room
      const houseResponse = await request(app)
        .post('/api/houses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          villageId: testVillageId,
          x: 70,
          y: 80,
          houseType: 'COTTAGE',
        })
        .expect(201);

      const houseId = houseResponse.body.id;

      // Create room
      const roomResponse = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          houseId,
          name: 'Test Room',
          roomType: 'OFFICE',
        })
        .expect(201);

      const roomId = roomResponse.body.id;

      // Delete house
      await request(app)
        .delete(`/api/houses/${houseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify room is also deleted
      await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/houses/:id/agents', () => {
    it('should get agents in house', async () => {
      const response = await request(app)
        .get(`/api/houses/${testHouseId}/agents`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });
});
