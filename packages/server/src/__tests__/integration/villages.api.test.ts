/**
 * Integration tests for Villages API
 * Tests all village endpoints with Supertest
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

describe('Villages API Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testVillageId: number;

  beforeAll(async () => {
    // Setup test environment
    process.env.JWT_SECRET = 'test-secret';

    // Import app after environment is configured
    const { createApp } = await import('../../app');
    app = createApp();

    // Create test user and get auth token
    // In a real scenario, this would use the actual auth flow
    const { signAccessToken } = await import('../../auth/jwt');
    authToken = signAccessToken(1, 'testuser');
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('POST /api/villages', () => {
    it('should create a new village with valid data', async () => {
      const villageData = {
        name: `test-village-${Date.now()}`,
        githubOrgId: String(Math.floor(Math.random() * 1000000)),
      };

      const response = await request(app)
        .post('/api/villages')
        .set('Authorization', `Bearer ${authToken}`)
        .send(villageData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        name: villageData.name,
        githubOrgId: villageData.githubOrgId,
      });

      testVillageId = response.body.id;
    });

    it('should return 400 for invalid village data', async () => {
      const response = await request(app)
        .post('/api/villages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' }) // Invalid: empty name
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/villages')
        .send({ name: 'test', githubOrgId: '123' })
        .expect(401);
    });

    it('should return 409 for duplicate githubOrgId', async () => {
      const villageData = {
        name: 'test-village',
        githubOrgId: 'duplicate-org-123',
      };

      // Create first village
      await request(app)
        .post('/api/villages')
        .set('Authorization', `Bearer ${authToken}`)
        .send(villageData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/villages')
        .set('Authorization', `Bearer ${authToken}`)
        .send(villageData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/villages', () => {
    it('should list all villages', async () => {
      const response = await request(app)
        .get('/api/villages')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter villages by visibility', async () => {
      const response = await request(app)
        .get('/api/villages?visibility=PUBLIC')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((village: any) => {
        expect(village.visibility).toBe('PUBLIC');
      });
    });

    it('should paginate villages', async () => {
      const response = await request(app)
        .get('/api/villages?limit=10&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeLessThanOrEqual(10);
    });

    it('should search villages by name', async () => {
      const response = await request(app)
        .get('/api/villages?search=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/villages/:id', () => {
    it('should get village by ID', async () => {
      const response = await request(app)
        .get(`/api/villages/${testVillageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testVillageId,
        name: expect.any(String),
      });
    });

    it('should return 404 for non-existent village', async () => {
      const response = await request(app)
        .get('/api/villages/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid ID format', async () => {
      await request(app)
        .get('/api/villages/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('PATCH /api/villages/:id', () => {
    it('should update village', async () => {
      const updateData = {
        name: `updated-village-${Date.now()}`,
      };

      const response = await request(app)
        .patch(`/api/villages/${testVillageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testVillageId,
        name: updateData.name,
      });
    });

    it('should return 400 for invalid update data', async () => {
      const response = await request(app)
        .patch(`/api/villages/${testVillageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' }) // Invalid: empty name
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent village', async () => {
      await request(app)
        .patch('/api/villages/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'test' })
        .expect(404);
    });

    it('should return 403 for unauthorized update', async () => {
      // Create a different auth token (different user)
      const { signAccessToken } = await import('../../auth/jwt');
      const otherUserToken = signAccessToken(999, 'otheruser');

      await request(app)
        .patch(`/api/villages/${testVillageId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ name: 'hacked' })
        .expect(403);
    });
  });

  describe('DELETE /api/villages/:id', () => {
    it('should delete village', async () => {
      // Create a village to delete
      const createResponse = await request(app)
        .post('/api/villages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'village-to-delete',
          githubOrgId: String(Date.now()),
        })
        .expect(201);

      const villageId = createResponse.body.id;

      // Delete the village
      await request(app)
        .delete(`/api/villages/${villageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify it's deleted
      await request(app)
        .get(`/api/villages/${villageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent village', async () => {
      await request(app)
        .delete('/api/villages/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 403 for unauthorized deletion', async () => {
      const { signAccessToken } = await import('../../auth/jwt');
      const otherUserToken = signAccessToken(999, 'otheruser');

      await request(app)
        .delete(`/api/villages/${testVillageId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });
  });

  describe('GET /api/villages/:id/layout', () => {
    it('should get village layout', async () => {
      const response = await request(app)
        .get(`/api/villages/${testVillageId}/layout`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('houses');
      expect(response.body).toHaveProperty('agents');
    });
  });

  describe('POST /api/villages/:id/layout', () => {
    it('should update village layout', async () => {
      const layoutData = {
        houses: [
          { x: 10, y: 20, houseType: 'COTTAGE' },
          { x: 30, y: 40, houseType: 'MANSION' },
        ],
      };

      const response = await request(app)
        .post(`/api/villages/${testVillageId}/layout`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(layoutData)
        .expect(200);

      expect(response.body).toMatchObject(layoutData);
    });

    it('should return 400 for invalid layout data', async () => {
      await request(app)
        .post(`/api/villages/${testVillageId}/layout`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ houses: 'invalid' })
        .expect(400);
    });
  });
});
