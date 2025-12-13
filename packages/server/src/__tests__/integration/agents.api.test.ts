/**
 * Integration tests for Agents API
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

describe('Agents API Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testVillageId: number;
  let testAgentId: number;

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

  describe('POST /api/agents', () => {
    it('should create a new agent', async () => {
      const agentData = {
        name: `test-agent-${Date.now()}`,
        githubRepoId: String(Math.floor(Math.random() * 1000000)),
        villageId: testVillageId,
      };

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .send(agentData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        name: agentData.name,
        githubRepoId: agentData.githubRepoId,
        villageId: testVillageId,
      });

      testAgentId = response.body.id;
    });

    it('should return 400 for invalid agent data', async () => {
      await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' }) // Missing required fields
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/agents')
        .send({
          name: 'test',
          githubRepoId: '123',
          villageId: testVillageId,
        })
        .expect(401);
    });
  });

  describe('GET /api/agents', () => {
    it('should list all agents', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should filter agents by village', async () => {
      const response = await request(app)
        .get(`/api/agents?villageId=${testVillageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((agent: any) => {
        expect(agent.villageId).toBe(testVillageId);
      });
    });

    it('should filter agents by status', async () => {
      const response = await request(app)
        .get('/api/agents?status=ACTIVE')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((agent: any) => {
        expect(agent.status).toBe('ACTIVE');
      });
    });
  });

  describe('GET /api/agents/:id', () => {
    it('should get agent by ID', async () => {
      const response = await request(app)
        .get(`/api/agents/${testAgentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testAgentId,
        name: expect.any(String),
      });
    });

    it('should return 404 for non-existent agent', async () => {
      await request(app)
        .get('/api/agents/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/agents/:id', () => {
    it('should update agent', async () => {
      const updateData = {
        status: 'IDLE' as const,
      };

      const response = await request(app)
        .patch(`/api/agents/${testAgentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('IDLE');
    });

    it('should return 400 for invalid status', async () => {
      await request(app)
        .patch(`/api/agents/${testAgentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });
  });

  describe('DELETE /api/agents/:id', () => {
    it('should delete agent', async () => {
      // Create agent to delete
      const createResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'agent-to-delete',
          githubRepoId: String(Date.now()),
          villageId: testVillageId,
        })
        .expect(201);

      const agentId = createResponse.body.id;

      // Delete
      await request(app)
        .delete(`/api/agents/${agentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deleted
      await request(app)
        .get(`/api/agents/${agentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/agents/:id/activity', () => {
    it('should get agent activity', async () => {
      const response = await request(app)
        .get(`/api/agents/${testAgentId}/activity`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should filter activity by date range', async () => {
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();

      const response = await request(app)
        .get(`/api/agents/${testAgentId}/activity?from=${from}&to=${to}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/agents/:id/heartbeat', () => {
    it('should update agent heartbeat', async () => {
      const response = await request(app)
        .post(`/api/agents/${testAgentId}/heartbeat`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('lastSeenAt');
    });
  });
});
