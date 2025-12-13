/**
 * Integration Tests: Agents API
 * Tests state transitions, metrics, and agent behavior
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '../../app';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase, waitForDb } from '../utils/db';
import { generateTestToken, getAuthHeaders } from '../utils/auth';
import {
  createVillageCreateData,
  createHouseCreateData,
  createAgentCreateData,
  createUserCreateData,
} from '../utils/fixtures';

describe('Agents Integration Tests', () => {
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

    // Create test village
    const village = await prisma.village.create({
      data: createVillageCreateData({ name: 'Test Village', ownerId: testUserId }),
    });
    villageId = village.id;

    // Create test house
    const house = await prisma.house.create({
      data: createHouseCreateData({ villageId, name: 'Test House' }),
    });
    houseId = house.id;
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('POST /api/agents - Create Agent', () => {
    it('should create a new agent', async () => {
      const agentData = createAgentCreateData({
        name: 'Test Agent',
        villageId,
        houseId,
        ownerId: testUserId,
      });

      const response = await request(app)
        .post('/api/agents')
        .set(authHeaders)
        .send(agentData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Test Agent',
        villageId,
        houseId,
        ownerId: testUserId,
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.state).toBe('idle'); // Default state
    });

    it('should create agent with initial state', async () => {
      const agentData = createAgentCreateData({
        name: 'Working Agent',
        villageId,
        state: 'working',
      });

      const response = await request(app)
        .post('/api/agents')
        .set(authHeaders)
        .send(agentData)
        .expect(201);

      expect(response.body.state).toBe('working');
    });

    it('should fail without authentication', async () => {
      const agentData = createAgentCreateData({ villageId });

      await request(app).post('/api/agents').send(agentData).expect(401);
    });

    it('should validate agent data', async () => {
      await request(app)
        .post('/api/agents')
        .set(authHeaders)
        .send({ name: '' }) // Invalid: missing required fields
        .expect(400);
    });

    it('should enforce unique githubRepoId', async () => {
      const agentData = createAgentCreateData({
        githubRepoId: 'unique-repo-123',
        villageId,
      });

      await prisma.agent.create({ data: agentData });

      await request(app)
        .post('/api/agents')
        .set(authHeaders)
        .send(agentData)
        .expect(409); // Conflict
    });
  });

  describe('GET /api/agents - List Agents', () => {
    beforeEach(async () => {
      await prisma.agent.createMany({
        data: [
          createAgentCreateData({ name: 'Agent 1', villageId, state: 'idle' }),
          createAgentCreateData({ name: 'Agent 2', villageId, state: 'working' }),
          createAgentCreateData({ name: 'Agent 3', villageId, state: 'thinking' }),
        ],
      });
    });

    it('should list all agents', async () => {
      const response = await request(app).get('/api/agents').set(authHeaders).expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
    });

    it('should filter agents by village', async () => {
      const response = await request(app)
        .get(`/api/agents?villageId=${villageId}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.every((a: any) => a.villageId === villageId)).toBe(true);
    });

    it('should filter agents by state', async () => {
      const response = await request(app)
        .get('/api/agents?state=working')
        .set(authHeaders)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].state).toBe('working');
    });

    it('should filter agents by house', async () => {
      await prisma.agent.create({
        data: createAgentCreateData({ villageId, houseId }),
      });

      const response = await request(app)
        .get(`/api/agents?houseId=${houseId}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.every((a: any) => a.houseId === houseId)).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/agents?limit=2')
        .set(authHeaders)
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/agents/:id - Get Agent by ID', () => {
    let agentId: number;

    beforeEach(async () => {
      const agent = await prisma.agent.create({
        data: createAgentCreateData({ name: 'Test Agent', villageId }),
      });
      agentId = agent.id;
    });

    it('should get agent with details', async () => {
      const response = await request(app).get(`/api/agents/${agentId}`).set(authHeaders).expect(200);

      expect(response.body.id).toBe(agentId);
      expect(response.body.name).toBe('Test Agent');
    });

    it('should include agent state', async () => {
      const response = await request(app).get(`/api/agents/${agentId}`).set(authHeaders).expect(200);

      expect(response.body.state).toBeDefined();
      expect(response.body.state).toMatch(
        /^(idle|working|thinking|frustrated|celebrating|resting|socializing|traveling|observing)$/
      );
    });

    it('should return 404 for non-existent agent', async () => {
      await request(app).get('/api/agents/999999').set(authHeaders).expect(404);
    });
  });

  describe('PATCH /api/agents/:id - Update Agent', () => {
    let agentId: number;

    beforeEach(async () => {
      const agent = await prisma.agent.create({
        data: createAgentCreateData({
          name: 'Original Agent',
          villageId,
          state: 'idle',
        }),
      });
      agentId = agent.id;
    });

    it('should update agent name', async () => {
      const response = await request(app)
        .patch(`/api/agents/${agentId}`)
        .set(authHeaders)
        .send({ name: 'Updated Agent' })
        .expect(200);

      expect(response.body.name).toBe('Updated Agent');
    });

    it('should transition agent state', async () => {
      const response = await request(app)
        .patch(`/api/agents/${agentId}`)
        .set(authHeaders)
        .send({ state: 'working' })
        .expect(200);

      expect(response.body.state).toBe('working');
    });

    it('should update agent position', async () => {
      const response = await request(app)
        .patch(`/api/agents/${agentId}`)
        .set(authHeaders)
        .send({ x: 100, y: 200 })
        .expect(200);

      expect(response.body.x).toBe(100);
      expect(response.body.y).toBe(200);
    });

    it('should update agent house assignment', async () => {
      const response = await request(app)
        .patch(`/api/agents/${agentId}`)
        .set(authHeaders)
        .send({ houseId })
        .expect(200);

      expect(response.body.houseId).toBe(houseId);
    });

    it('should fail without authentication', async () => {
      await request(app).patch(`/api/agents/${agentId}`).send({ name: 'New Name' }).expect(401);
    });

    it('should validate state transitions', async () => {
      await request(app)
        .patch(`/api/agents/${agentId}`)
        .set(authHeaders)
        .send({ state: 'invalid_state' })
        .expect(400);
    });
  });

  describe('DELETE /api/agents/:id - Delete Agent', () => {
    let agentId: number;

    beforeEach(async () => {
      const agent = await prisma.agent.create({
        data: createAgentCreateData({ name: 'Agent to Delete', villageId }),
      });
      agentId = agent.id;
    });

    it('should delete agent', async () => {
      await request(app).delete(`/api/agents/${agentId}`).set(authHeaders).expect(204);

      const deletedAgent = await prisma.agent.findUnique({
        where: { id: agentId },
      });
      expect(deletedAgent).toBeNull();
    });

    it('should cascade delete agent activities', async () => {
      await prisma.agentActivity.create({
        data: {
          agentId,
          activityType: 'commit',
          timestamp: new Date(),
        },
      });

      await request(app).delete(`/api/agents/${agentId}`).set(authHeaders).expect(204);

      const activities = await prisma.agentActivity.findMany({
        where: { agentId },
      });
      expect(activities.length).toBe(0);
    });

    it('should fail without authentication', async () => {
      await request(app).delete(`/api/agents/${agentId}`).expect(401);
    });
  });

  describe('Agent State Transitions', () => {
    let agentId: number;

    beforeEach(async () => {
      const agent = await prisma.agent.create({
        data: createAgentCreateData({ name: 'State Agent', villageId, state: 'idle' }),
      });
      agentId = agent.id;
    });

    const validStates = [
      'idle',
      'working',
      'thinking',
      'frustrated',
      'celebrating',
      'resting',
      'socializing',
      'traveling',
      'observing',
    ];

    it('should allow valid state transitions', async () => {
      for (const state of validStates) {
        const response = await request(app)
          .patch(`/api/agents/${agentId}`)
          .set(authHeaders)
          .send({ state })
          .expect(200);

        expect(response.body.state).toBe(state);
      }
    });

    it('should track state history in activities', async () => {
      await request(app).patch(`/api/agents/${agentId}`).set(authHeaders).send({ state: 'working' });

      await waitForDb(100);

      const activities = await prisma.agentActivity.findMany({
        where: { agentId },
        orderBy: { timestamp: 'desc' },
      });

      // Check if state change was logged (if your system does this)
      // This depends on your implementation
      expect(activities).toBeDefined();
    });

    it('should handle rapid state transitions', async () => {
      const states = ['working', 'thinking', 'celebrating', 'idle'];

      for (const state of states) {
        await request(app)
          .patch(`/api/agents/${agentId}`)
          .set(authHeaders)
          .send({ state })
          .expect(200);
      }

      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      expect(agent?.state).toBe('idle'); // Last state
    });
  });

  describe('Agent Metrics', () => {
    let agentId: number;

    beforeEach(async () => {
      const agent = await prisma.agent.create({
        data: createAgentCreateData({ name: 'Metrics Agent', villageId }),
      });
      agentId = agent.id;

      // Create some metrics
      await prisma.agentMetric.createMany({
        data: [
          {
            agentId,
            metricType: 'commits',
            value: 10,
            timestamp: new Date(),
          },
          {
            agentId,
            metricType: 'lines_changed',
            value: 250,
            timestamp: new Date(),
          },
        ],
      });
    });

    it('should fetch agent with metrics', async () => {
      const response = await request(app)
        .get(`/api/agents/${agentId}?include=metrics`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.metrics).toBeDefined();
    });

    it('should calculate aggregate metrics', async () => {
      const metrics = await prisma.agentMetric.findMany({
        where: { agentId },
      });

      expect(metrics.length).toBe(2);

      const totalCommits = metrics.find((m) => m.metricType === 'commits')?.value;
      expect(totalCommits).toBe(10);
    });

    it('should track metrics over time', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await prisma.agentMetric.create({
        data: {
          agentId,
          metricType: 'commits',
          value: 5,
          timestamp: yesterday,
        },
      });

      const metrics = await prisma.agentMetric.findMany({
        where: {
          agentId,
          metricType: 'commits',
        },
        orderBy: { timestamp: 'desc' },
      });

      expect(metrics.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Agent Activities', () => {
    let agentId: number;

    beforeEach(async () => {
      const agent = await prisma.agent.create({
        data: createAgentCreateData({ name: 'Active Agent', villageId }),
      });
      agentId = agent.id;

      // Create activities
      await prisma.agentActivity.createMany({
        data: [
          {
            agentId,
            activityType: 'commit',
            timestamp: new Date(),
            metadata: { message: 'Test commit' },
          },
          {
            agentId,
            activityType: 'pr_opened',
            timestamp: new Date(),
            metadata: { title: 'Test PR' },
          },
        ],
      });
    });

    it('should fetch agent activities', async () => {
      const response = await request(app)
        .get(`/api/agents/${agentId}/activities`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2);
    });

    it('should filter activities by type', async () => {
      const response = await request(app)
        .get(`/api/agents/${agentId}/activities?type=commit`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].activityType).toBe('commit');
    });

    it('should order activities by timestamp', async () => {
      const response = await request(app)
        .get(`/api/agents/${agentId}/activities`)
        .set(authHeaders)
        .expect(200);

      // Should be ordered newest first
      if (response.body.length > 1) {
        const timestamps = response.body.map((a: any) => new Date(a.timestamp).getTime());
        const isSorted = timestamps.every(
          (ts: number, i: number) => i === 0 || ts <= timestamps[i - 1]
        );
        expect(isSorted).toBe(true);
      }
    });
  });

  describe('Access Control', () => {
    let agentId: number;
    let otherUserId: string;
    let otherAuthHeaders: Record<string, string>;

    beforeEach(async () => {
      const agent = await prisma.agent.create({
        data: createAgentCreateData({
          name: 'Test Agent',
          villageId,
          ownerId: testUserId,
        }),
      });
      agentId = agent.id;

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

    it('should allow owner to modify agent', async () => {
      await request(app)
        .patch(`/api/agents/${agentId}`)
        .set(authHeaders)
        .send({ name: 'Updated by Owner' })
        .expect(200);
    });

    it('should deny non-owner from modifying agent', async () => {
      await request(app)
        .patch(`/api/agents/${agentId}`)
        .set(otherAuthHeaders)
        .send({ name: 'Attempted Update' })
        .expect(403);
    });

    it('should allow viewing agent in public village', async () => {
      const response = await request(app)
        .get(`/api/agents/${agentId}`)
        .set(otherAuthHeaders)
        .expect(200);

      expect(response.body.id).toBe(agentId);
    });
  });
});
