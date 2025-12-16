/**
 * Database Relations Integrity Tests
 *
 * Validates:
 * - Prisma client generation
 * - Relation integrity (Village → WorldMap → House → Room → Agent)
 * - Cascade deletes
 * - Unique constraints
 * - Foreign key constraints
 * - Basic CRUD operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from './utils/db';

describe('Database Relations Integrity', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('Prisma Client Generation', () => {
    it('should have Prisma client successfully generated', () => {
      expect(prisma).toBeDefined();
      expect(prisma.village).toBeDefined();
      expect(prisma.worldMap).toBeDefined();
      expect(prisma.house).toBeDefined();
      expect(prisma.room).toBeDefined();
      expect(prisma.agent).toBeDefined();
      expect(prisma.user).toBeDefined();
    });

    it('should have all expected models available', () => {
      const expectedModels = [
        'user',
        'oAuthToken',
        'villageAccess',
        'village',
        'worldMap',
        'house',
        'room',
        'agent',
        'houseAgent',
        'agentSession',
        'workStreamEvent',
        'bugBot',
        'worldNode',
        'generatedSprite',
        'tileset',
      ];

      expectedModels.forEach((model) => {
        expect(prisma).toHaveProperty(model);
      });
    });
  });

  describe('User Management', () => {
    it('should create a user with required fields', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          githubId: BigInt(123456),
          username: 'testuser',
          name: 'Test User',
        },
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.githubId).toBe(BigInt(123456));
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should enforce unique email constraint', async () => {
      await prisma.user.create({
        data: {
          email: 'unique@example.com',
          githubId: BigInt(111),
          username: 'user1',
        },
      });

      await expect(
        prisma.user.create({
          data: {
            email: 'unique@example.com',
            githubId: BigInt(222),
            username: 'user2',
          },
        }),
      ).rejects.toThrow();
    });

    it('should enforce unique githubId constraint', async () => {
      await prisma.user.create({
        data: {
          githubId: BigInt(999888),
          username: 'user1',
          email: 'user1@example.com',
        },
      });

      await expect(
        prisma.user.create({
          data: {
            githubId: BigInt(999888),
            username: 'user2',
            email: 'user2@example.com',
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Village → WorldMap Relationship', () => {
    it('should create Village with associated WorldMap', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Test Org',
          githubOrgId: BigInt(987654),
          worldMap: {
            create: {
              width: 1000,
              height: 1000,
              tileSize: 16,
              seed: 'test-seed-123',
            },
          },
        },
        include: {
          worldMap: true,
        },
      });

      expect(village.worldMap).toBeDefined();
      expect(village.worldMap?.width).toBe(1000);
      expect(village.worldMap?.height).toBe(1000);
      expect(village.worldMap?.seed).toBe('test-seed-123');
    });

    it('should enforce one-to-one relationship between Village and WorldMap', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Test Org',
          githubOrgId: BigInt(111222),
        },
      });

      await prisma.worldMap.create({
        data: {
          villageId: village.id,
          width: 500,
          height: 500,
          seed: 'seed1',
        },
      });

      // Attempting to create another WorldMap for the same village should fail
      await expect(
        prisma.worldMap.create({
          data: {
            villageId: village.id,
            width: 600,
            height: 600,
            seed: 'seed2',
          },
        }),
      ).rejects.toThrow();
    });

    it('should cascade delete WorldMap when Village is deleted', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Delete Test Org',
          githubOrgId: BigInt(333444),
          worldMap: {
            create: {
              width: 800,
              height: 800,
              seed: 'cascade-seed',
            },
          },
        },
        include: {
          worldMap: true,
        },
      });

      const worldMapId = village.worldMap?.id;
      expect(worldMapId).toBeDefined();

      await prisma.village.delete({
        where: { id: village.id },
      });

      const deletedWorldMap = await prisma.worldMap.findUnique({
        where: { id: worldMapId },
      });
      expect(deletedWorldMap).toBeNull();
    });
  });

  describe('Village → House → Room Chain', () => {
    it('should create complete Village → House → Room hierarchy', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Full Hierarchy Org',
          githubOrgId: BigInt(555666),
          houses: {
            create: {
              repoName: 'test-repo',
              githubRepoId: BigInt(777888),
              rooms: {
                create: [
                  {
                    name: 'entrance',
                    roomType: 'entrance',
                    x: 0,
                    y: 0,
                    width: 10,
                    height: 10,
                  },
                  {
                    name: 'workspace',
                    roomType: 'workspace',
                    moduleType: 'component',
                    x: 10,
                    y: 0,
                    width: 15,
                    height: 15,
                  },
                ],
              },
            },
          },
        },
        include: {
          houses: {
            include: {
              rooms: true,
            },
          },
        },
      });

      expect(village.houses).toHaveLength(1);
      expect(village.houses[0].rooms).toHaveLength(2);
      expect(village.houses[0].rooms[0].roomType).toBe('entrance');
      expect(village.houses[0].rooms[1].roomType).toBe('workspace');
    });

    it('should cascade delete Houses when Village is deleted', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Cascade Village',
          githubOrgId: BigInt(123789),
          houses: {
            create: [
              { repoName: 'repo1', githubRepoId: BigInt(111) },
              { repoName: 'repo2', githubRepoId: BigInt(222) },
            ],
          },
        },
        include: {
          houses: true,
        },
      });

      const houseIds = village.houses.map((h) => h.id);
      expect(houseIds).toHaveLength(2);

      await prisma.village.delete({
        where: { id: village.id },
      });

      const remainingHouses = await prisma.house.findMany({
        where: { id: { in: houseIds } },
      });
      expect(remainingHouses).toHaveLength(0);
    });

    it('should cascade delete Rooms when House is deleted', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Room Cascade Org',
          githubOrgId: BigInt(456789),
        },
      });

      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'test-house',
          githubRepoId: BigInt(999),
          rooms: {
            create: [
              { name: 'room1', roomType: 'entrance', x: 0, y: 0, width: 5, height: 5 },
              { name: 'room2', roomType: 'workspace', x: 5, y: 0, width: 5, height: 5 },
            ],
          },
        },
        include: {
          rooms: true,
        },
      });

      const roomIds = house.rooms.map((r) => r.id);
      expect(roomIds).toHaveLength(2);

      await prisma.house.delete({
        where: { id: house.id },
      });

      const remainingRooms = await prisma.room.findMany({
        where: { id: { in: roomIds } },
      });
      expect(remainingRooms).toHaveLength(0);
    });
  });

  describe('Agent Relationships', () => {
    it('should create Agent with User relationship', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'agent-owner@example.com',
          githubId: BigInt(654321),
          username: 'agentowner',
        },
      });

      const agent = await prisma.agent.create({
        data: {
          name: 'Test Agent',
          userId: user.id,
        },
        include: {
          user: true,
        },
      });

      expect(agent.user).toBeDefined();
      expect(agent.user?.id).toBe(user.id);
    });

    it('should handle Agent with HouseAgent junction table', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Agent House Org',
          githubOrgId: BigInt(147258),
        },
      });

      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'agent-house',
          githubRepoId: BigInt(369258),
        },
      });

      const agent = await prisma.agent.create({
        data: {
          name: 'House Agent',
        },
      });

      const houseAgent = await prisma.houseAgent.create({
        data: {
          houseId: house.id,
          agentId: agent.id,
          role: 'developer',
        },
        include: {
          house: true,
          agent: true,
        },
      });

      expect(houseAgent.house.id).toBe(house.id);
      expect(houseAgent.agent.id).toBe(agent.id);
      expect(houseAgent.role).toBe('developer');
    });

    it('should cascade delete HouseAgent when House is deleted', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'HouseAgent Cascade Org',
          githubOrgId: BigInt(852963),
        },
      });

      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'cascade-house',
          githubRepoId: BigInt(741852),
        },
      });

      const agent = await prisma.agent.create({
        data: {
          name: 'Cascade Agent',
        },
      });

      await prisma.houseAgent.create({
        data: {
          houseId: house.id,
          agentId: agent.id,
          role: 'tester',
        },
      });

      await prisma.house.delete({
        where: { id: house.id },
      });

      const remainingHouseAgents = await prisma.houseAgent.findMany({
        where: { houseId: house.id },
      });
      expect(remainingHouseAgents).toHaveLength(0);

      // Agent should still exist
      const remainingAgent = await prisma.agent.findUnique({
        where: { id: agent.id },
      });
      expect(remainingAgent).toBeDefined();
    });

    it('should cascade delete HouseAgent when Agent is deleted', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Agent Delete Org',
          githubOrgId: BigInt(963852),
        },
      });

      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'agent-delete-house',
          githubRepoId: BigInt(159753),
        },
      });

      const agent = await prisma.agent.create({
        data: {
          name: 'Delete Me Agent',
        },
      });

      await prisma.houseAgent.create({
        data: {
          houseId: house.id,
          agentId: agent.id,
          role: 'reviewer',
        },
      });

      await prisma.agent.delete({
        where: { id: agent.id },
      });

      const remainingHouseAgents = await prisma.houseAgent.findMany({
        where: { agentId: agent.id },
      });
      expect(remainingHouseAgents).toHaveLength(0);
    });
  });

  describe('Agent Sessions and Events', () => {
    it('should create AgentSession linked to Agent', async () => {
      const agent = await prisma.agent.create({
        data: {
          name: 'Session Agent',
        },
      });

      const session = await prisma.agentSession.create({
        data: {
          agentId: agent.id,
          state: 'active',
        },
        include: {
          agent: true,
        },
      });

      expect(session.agent.id).toBe(agent.id);
      expect(session.state).toBe('active');
    });

    it('should create WorkStreamEvent linked to Agent', async () => {
      const agent = await prisma.agent.create({
        data: {
          name: 'Event Agent',
        },
      });

      const event = await prisma.workStreamEvent.create({
        data: {
          agentId: agent.id,
          message: 'Test event',
          eventType: 'commit',
          severity: 'info',
        },
        include: {
          agent: true,
        },
      });

      expect(event.agent.id).toBe(agent.id);
      expect(event.message).toBe('Test event');
      expect(event.eventType).toBe('commit');
    });

    it('should cascade delete AgentSessions when Agent is deleted', async () => {
      const agent = await prisma.agent.create({
        data: {
          name: 'Session Delete Agent',
        },
      });

      await prisma.agentSession.create({
        data: {
          agentId: agent.id,
        },
      });

      await prisma.agent.delete({
        where: { id: agent.id },
      });

      const remainingSessions = await prisma.agentSession.findMany({
        where: { agentId: agent.id },
      });
      expect(remainingSessions).toHaveLength(0);
    });

    it('should cascade delete WorkStreamEvents when Agent is deleted', async () => {
      const agent = await prisma.agent.create({
        data: {
          name: 'Event Delete Agent',
        },
      });

      await prisma.workStreamEvent.create({
        data: {
          agentId: agent.id,
          message: 'Will be deleted',
        },
      });

      await prisma.agent.delete({
        where: { id: agent.id },
      });

      const remainingEvents = await prisma.workStreamEvent.findMany({
        where: { agentId: agent.id },
      });
      expect(remainingEvents).toHaveLength(0);
    });
  });

  describe('VillageAccess Junction Table', () => {
    it('should create VillageAccess linking User and Village', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'access@example.com',
          githubId: BigInt(112233),
          username: 'accessuser',
        },
      });

      const village = await prisma.village.create({
        data: {
          orgName: 'Access Village',
          githubOrgId: BigInt(445566),
        },
      });

      const access = await prisma.villageAccess.create({
        data: {
          villageId: village.id,
          userId: user.id,
          role: 'owner',
        },
        include: {
          village: true,
          user: true,
        },
      });

      expect(access.village.id).toBe(village.id);
      expect(access.user.id).toBe(user.id);
      expect(access.role).toBe('owner');
    });

    it('should cascade delete VillageAccess when Village is deleted', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'cascade-access@example.com',
          githubId: BigInt(778899),
          username: 'cascadeuser',
        },
      });

      const village = await prisma.village.create({
        data: {
          orgName: 'Cascade Access Village',
          githubOrgId: BigInt(889977),
        },
      });

      await prisma.villageAccess.create({
        data: {
          villageId: village.id,
          userId: user.id,
          role: 'member',
        },
      });

      await prisma.village.delete({
        where: { id: village.id },
      });

      const remainingAccess = await prisma.villageAccess.findMany({
        where: { villageId: village.id },
      });
      expect(remainingAccess).toHaveLength(0);
    });

    it('should cascade delete VillageAccess when User is deleted', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'user-delete@example.com',
          githubId: BigInt(556677),
          username: 'deleteuser',
        },
      });

      const village = await prisma.village.create({
        data: {
          orgName: 'User Delete Village',
          githubOrgId: BigInt(667788),
        },
      });

      await prisma.villageAccess.create({
        data: {
          villageId: village.id,
          userId: user.id,
          role: 'viewer',
        },
      });

      await prisma.user.delete({
        where: { id: user.id },
      });

      const remainingAccess = await prisma.villageAccess.findMany({
        where: { userId: user.id },
      });
      expect(remainingAccess).toHaveLength(0);
    });
  });

  describe('BugBot Relationships', () => {
    it('should create BugBot linked to Village', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Bug Village',
          githubOrgId: BigInt(334455),
        },
      });

      const bugBot = await prisma.bugBot.create({
        data: {
          villageId: village.id,
          provider: 'github',
          issueId: 'issue-123',
          issueNumber: 42,
          title: 'Test Bug',
          status: 'open',
        },
        include: {
          village: true,
        },
      });

      expect(bugBot.village.id).toBe(village.id);
      expect(bugBot.issueNumber).toBe(42);
      expect(bugBot.status).toBe('open');
    });

    it('should enforce unique constraint on provider + issueId', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Bug Unique Village',
          githubOrgId: BigInt(998877),
        },
      });

      await prisma.bugBot.create({
        data: {
          villageId: village.id,
          provider: 'github',
          issueId: 'unique-issue-456',
        },
      });

      await expect(
        prisma.bugBot.create({
          data: {
            villageId: village.id,
            provider: 'github',
            issueId: 'unique-issue-456',
          },
        }),
      ).rejects.toThrow();
    });

    it('should cascade delete BugBots when Village is deleted', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Bug Cascade Village',
          githubOrgId: BigInt(776655),
        },
      });

      await prisma.bugBot.create({
        data: {
          villageId: village.id,
          provider: 'github',
          issueId: 'cascade-issue-789',
        },
      });

      await prisma.village.delete({
        where: { id: village.id },
      });

      const remainingBugs = await prisma.bugBot.findMany({
        where: { villageId: village.id },
      });
      expect(remainingBugs).toHaveLength(0);
    });
  });

  describe('WorldNode Hierarchy', () => {
    it('should create WorldNode with parent-child relationship', async () => {
      const parent = await prisma.worldNode.create({
        data: {
          type: 'VILLAGE',
          provider: 'github',
          externalId: 'ext-village-1',
          name: 'Parent Village',
        },
      });

      const child = await prisma.worldNode.create({
        data: {
          type: 'HOUSE',
          provider: 'github',
          externalId: 'ext-house-1',
          name: 'Child House',
          parentId: parent.id,
        },
        include: {
          parent: true,
        },
      });

      expect(child.parent).toBeDefined();
      expect(child.parent?.id).toBe(parent.id);
    });

    it('should cascade delete children when parent WorldNode is deleted', async () => {
      const parent = await prisma.worldNode.create({
        data: {
          type: 'VILLAGE',
          provider: 'github',
          externalId: 'cascade-village-2',
          name: 'Cascade Parent',
        },
      });

      const child = await prisma.worldNode.create({
        data: {
          type: 'HOUSE',
          provider: 'github',
          externalId: 'cascade-house-2',
          name: 'Cascade Child',
          parentId: parent.id,
        },
      });

      await prisma.worldNode.delete({
        where: { id: parent.id },
      });

      const remainingChild = await prisma.worldNode.findUnique({
        where: { id: child.id },
      });
      expect(remainingChild).toBeNull();
    });
  });

  describe('Sprite and Tileset Models', () => {
    it('should create GeneratedSprite', async () => {
      const sprite = await prisma.generatedSprite.create({
        data: {
          entityType: 'agent',
          entityId: 'agent-123',
          prompt: 'pixel art robot',
          seed: 42,
          spriteUrl: 'https://example.com/sprite.png',
          width: 32,
          height: 32,
          provider: 'pixellab',
        },
      });

      expect(sprite.entityType).toBe('agent');
      expect(sprite.width).toBe(32);
    });

    it('should enforce unique constraint on entityType + entityId for sprites', async () => {
      await prisma.generatedSprite.create({
        data: {
          entityType: 'building',
          entityId: 'building-999',
          prompt: 'house sprite',
          seed: 100,
          spriteUrl: 'https://example.com/house.png',
          width: 64,
          height: 64,
        },
      });

      await expect(
        prisma.generatedSprite.create({
          data: {
            entityType: 'building',
            entityId: 'building-999',
            prompt: 'different prompt',
            seed: 200,
            spriteUrl: 'https://example.com/house2.png',
            width: 64,
            height: 64,
          },
        }),
      ).rejects.toThrow();
    });

    it('should create Tileset', async () => {
      const tileset = await prisma.tileset.create({
        data: {
          name: 'Modern Office',
          imageUrl: 'https://example.com/tileset.png',
          tileWidth: 16,
          tileHeight: 16,
          columns: 8,
          rows: 8,
          wallTiles: { north: 1, south: 2, east: 3, west: 4 },
          floorTiles: [10, 11, 12],
          doorTiles: { north: 20, south: 21, east: 22, west: 23 },
        },
      });

      expect(tileset.name).toBe('Modern Office');
      expect(tileset.columns).toBe(8);
    });

    it('should enforce unique constraint on tileset name', async () => {
      await prisma.tileset.create({
        data: {
          name: 'Unique Tileset',
          imageUrl: 'https://example.com/tileset1.png',
          columns: 4,
          rows: 4,
          wallTiles: {},
          floorTiles: [],
          doorTiles: {},
        },
      });

      await expect(
        prisma.tileset.create({
          data: {
            name: 'Unique Tileset',
            imageUrl: 'https://example.com/tileset2.png',
            columns: 5,
            rows: 5,
            wallTiles: {},
            floorTiles: [],
            doorTiles: {},
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Complex Multi-Model Operations', () => {
    it('should handle complete ecosystem creation and deletion', async () => {
      // Create a complete ecosystem
      const user = await prisma.user.create({
        data: {
          email: 'ecosystem@example.com',
          githubId: BigInt(998877665),
          username: 'ecosystemuser',
        },
      });

      const village = await prisma.village.create({
        data: {
          orgName: 'Complete Ecosystem',
          githubOrgId: BigInt(112233445),
          worldMap: {
            create: {
              width: 2000,
              height: 2000,
              seed: 'ecosystem-seed',
            },
          },
          houses: {
            create: {
              repoName: 'main-repo',
              githubRepoId: BigInt(556677889),
              rooms: {
                create: [
                  {
                    name: 'main-entrance',
                    roomType: 'entrance',
                    x: 0,
                    y: 0,
                    width: 20,
                    height: 20,
                  },
                ],
              },
            },
          },
          bugBots: {
            create: {
              provider: 'github',
              issueId: 'eco-issue-1',
              title: 'Ecosystem Bug',
            },
          },
        },
        include: {
          worldMap: true,
          houses: {
            include: {
              rooms: true,
            },
          },
          bugBots: true,
        },
      });

      const agent = await prisma.agent.create({
        data: {
          name: 'Ecosystem Agent',
          userId: user.id,
        },
      });

      await prisma.villageAccess.create({
        data: {
          villageId: village.id,
          userId: user.id,
          role: 'owner',
        },
      });

      // Verify creation
      expect(village.worldMap).toBeDefined();
      expect(village.houses).toHaveLength(1);
      expect(village.houses[0].rooms).toHaveLength(1);
      expect(village.bugBots).toHaveLength(1);

      // Delete village should cascade properly
      const villageId = village.id;
      await prisma.village.delete({
        where: { id: villageId },
      });

      // Verify cascades
      const worldMap = await prisma.worldMap.findFirst({
        where: { villageId },
      });
      expect(worldMap).toBeNull();

      const houses = await prisma.house.findMany({
        where: { villageId },
      });
      expect(houses).toHaveLength(0);

      const access = await prisma.villageAccess.findMany({
        where: { villageId },
      });
      expect(access).toHaveLength(0);

      // User and Agent should still exist
      const remainingUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(remainingUser).toBeDefined();

      const remainingAgent = await prisma.agent.findUnique({
        where: { id: agent.id },
      });
      expect(remainingAgent).toBeDefined();
    });
  });

  describe('CRUD Operations', () => {
    it('should perform basic CRUD on Village', async () => {
      // Create
      const village = await prisma.village.create({
        data: {
          orgName: 'CRUD Village',
          githubOrgId: BigInt(123456789),
        },
      });
      expect(village.id).toBeDefined();

      // Read
      const found = await prisma.village.findUnique({
        where: { id: village.id },
      });
      expect(found?.orgName).toBe('CRUD Village');

      // Update
      const updated = await prisma.village.update({
        where: { id: village.id },
        data: { orgName: 'Updated CRUD Village' },
      });
      expect(updated.orgName).toBe('Updated CRUD Village');

      // Delete
      await prisma.village.delete({
        where: { id: village.id },
      });

      const deleted = await prisma.village.findUnique({
        where: { id: village.id },
      });
      expect(deleted).toBeNull();
    });

    it('should perform basic CRUD on House', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'House CRUD Village',
          githubOrgId: BigInt(987654321),
        },
      });

      // Create
      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'crud-repo',
          githubRepoId: BigInt(111222333),
        },
      });
      expect(house.id).toBeDefined();

      // Read
      const found = await prisma.house.findUnique({
        where: { id: house.id },
      });
      expect(found?.repoName).toBe('crud-repo');

      // Update
      const updated = await prisma.house.update({
        where: { id: house.id },
        data: { repoName: 'updated-repo' },
      });
      expect(updated.repoName).toBe('updated-repo');

      // Delete
      await prisma.house.delete({
        where: { id: house.id },
      });

      const deleted = await prisma.house.findUnique({
        where: { id: house.id },
      });
      expect(deleted).toBeNull();
    });

    it('should perform basic CRUD on Room', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Room CRUD Village',
          githubOrgId: BigInt(444555666),
        },
      });

      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'room-house',
          githubRepoId: BigInt(777888999),
        },
      });

      // Create
      const room = await prisma.room.create({
        data: {
          houseId: house.id,
          name: 'crud-room',
          roomType: 'workspace',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      });
      expect(room.id).toBeDefined();

      // Read
      const found = await prisma.room.findUnique({
        where: { id: room.id },
      });
      expect(found?.name).toBe('crud-room');

      // Update
      const updated = await prisma.room.update({
        where: { id: room.id },
        data: { name: 'updated-room' },
      });
      expect(updated.name).toBe('updated-room');

      // Delete
      await prisma.room.delete({
        where: { id: room.id },
      });

      const deleted = await prisma.room.findUnique({
        where: { id: room.id },
      });
      expect(deleted).toBeNull();
    });

    it('should perform basic CRUD on Agent', async () => {
      // Create
      const agent = await prisma.agent.create({
        data: {
          name: 'CRUD Agent',
        },
      });
      expect(agent.id).toBeDefined();

      // Read
      const found = await prisma.agent.findUnique({
        where: { id: agent.id },
      });
      expect(found?.name).toBe('CRUD Agent');

      // Update
      const updated = await prisma.agent.update({
        where: { id: agent.id },
        data: { name: 'Updated CRUD Agent' },
      });
      expect(updated.name).toBe('Updated CRUD Agent');

      // Delete
      await prisma.agent.delete({
        where: { id: agent.id },
      });

      const deleted = await prisma.agent.findUnique({
        where: { id: agent.id },
      });
      expect(deleted).toBeNull();
    });
  });
});
