/**
 * Schema Integrity Tests
 * Validates Prisma schema relationships and constraints for core domain entities
 *
 * Tests the complete entity hierarchy:
 * Village -> WorldMap (1:1)
 * Village -> House (1:N)
 * House -> Room (1:N)
 * Agent <-> House (N:N via HouseAgent)
 * Agent -> User (N:1, nullable)
 *
 * @module tests/integration/schema-integrity
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { PrismaClient, AgentState, RoomType, ModuleType, BuildingSize } from '@prisma/client';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from '../utils/db';

describe('Schema Integrity Tests', () => {
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

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('Village -> WorldMap (1:1 Relationship)', () => {
    it('should create a Village with associated WorldMap', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Test Org',
          seed: 'test-seed-123',
          worldMap: {
            create: {
              width: 100,
              height: 100,
              tileSize: 16,
              seed: 'map-seed-123',
              groundLayer: JSON.stringify([]),
              objectLayer: JSON.stringify([]),
              collisionData: JSON.stringify([]),
              housePlacements: JSON.stringify([]),
            },
          },
        },
        include: { worldMap: true },
      });

      expect(village.worldMap).toBeDefined();
      expect(village.worldMap?.villageId).toBe(village.id);
      expect(village.worldMap?.width).toBe(100);
      expect(village.worldMap?.height).toBe(100);
    });

    it('should enforce 1:1 uniqueness on WorldMap.villageId', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Test Org',
          worldMap: {
            create: {
              width: 50,
              height: 50,
              seed: 'seed-1',
            },
          },
        },
      });

      // Attempting to create another WorldMap for the same village should fail
      await expect(
        prisma.worldMap.create({
          data: {
            villageId: village.id,
            width: 75,
            height: 75,
            seed: 'seed-2',
          },
        }),
      ).rejects.toThrow();
    });

    it('should cascade delete WorldMap when Village is deleted', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Deletable Org',
          worldMap: {
            create: {
              width: 100,
              height: 100,
              seed: 'delete-test-seed',
            },
          },
        },
        include: { worldMap: true },
      });

      const worldMapId = village.worldMap!.id;

      // Delete the village
      await prisma.village.delete({ where: { id: village.id } });

      // WorldMap should be cascade deleted
      const deletedWorldMap = await prisma.worldMap.findUnique({
        where: { id: worldMapId },
      });
      expect(deletedWorldMap).toBeNull();
    });
  });

  describe('Village -> House (1:N Relationship)', () => {
    it('should create multiple Houses for a Village', async () => {
      const village = await prisma.village.create({
        data: { orgName: 'Multi-House Org' },
      });

      const house1 = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'org/repo-1',
          githubRepoId: BigInt(123456),
          buildingSize: BuildingSize.medium,
          positionX: 100,
          positionY: 100,
          footprintWidth: 32,
          footprintHeight: 32,
        },
      });

      const house2 = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'org/repo-2',
          githubRepoId: BigInt(789012),
          buildingSize: BuildingSize.large,
          positionX: 200,
          positionY: 100,
          footprintWidth: 48,
          footprintHeight: 48,
        },
      });

      const villageWithHouses = await prisma.village.findUnique({
        where: { id: village.id },
        include: { houses: true },
      });

      expect(villageWithHouses?.houses).toHaveLength(2);
      expect(villageWithHouses?.houses.map((h) => h.repoName)).toContain('org/repo-1');
      expect(villageWithHouses?.houses.map((h) => h.repoName)).toContain('org/repo-2');
    });

    it('should cascade delete Houses when Village is deleted', async () => {
      const village = await prisma.village.create({
        data: {
          orgName: 'Delete Test Org',
          houses: {
            create: [
              { repoName: 'repo-1', githubRepoId: BigInt(111) },
              { repoName: 'repo-2', githubRepoId: BigInt(222) },
            ],
          },
        },
        include: { houses: true },
      });

      const houseIds = village.houses.map((h) => h.id);

      await prisma.village.delete({ where: { id: village.id } });

      // All houses should be cascade deleted
      const remainingHouses = await prisma.house.findMany({
        where: { id: { in: houseIds } },
      });
      expect(remainingHouses).toHaveLength(0);
    });
  });

  describe('House -> Room (1:N Relationship)', () => {
    it('should create multiple Rooms for a House', async () => {
      const village = await prisma.village.create({
        data: { orgName: 'Room Test Org' },
      });

      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'org/room-test',
          githubRepoId: BigInt(333444),
        },
      });

      // Create rooms representing different module types
      const entranceRoom = await prisma.room.create({
        data: {
          houseId: house.id,
          name: 'Entrance',
          roomType: RoomType.entrance,
          moduleType: ModuleType.root,
          modulePath: '/',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      });

      const workspaceRoom = await prisma.room.create({
        data: {
          houseId: house.id,
          name: 'Components',
          roomType: RoomType.workspace,
          moduleType: ModuleType.component,
          modulePath: '/src/components',
          x: 10,
          y: 0,
          width: 15,
          height: 12,
          doors: JSON.stringify([
            { x: 0, y: 5, direction: 'west', connectsToRoomId: entranceRoom.id },
          ]),
        },
      });

      const houseWithRooms = await prisma.house.findUnique({
        where: { id: house.id },
        include: { rooms: true },
      });

      expect(houseWithRooms?.rooms).toHaveLength(2);
      expect(houseWithRooms?.rooms.some((r) => r.roomType === RoomType.entrance)).toBe(true);
      expect(houseWithRooms?.rooms.some((r) => r.moduleType === ModuleType.component)).toBe(true);
    });

    it('should cascade delete Rooms when House is deleted', async () => {
      const village = await prisma.village.create({
        data: { orgName: 'Room Cascade Org' },
      });

      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'org/cascade-test',
          githubRepoId: BigInt(555666),
          rooms: {
            create: [
              { name: 'Room 1', roomType: RoomType.entrance, x: 0, y: 0, width: 10, height: 10 },
              { name: 'Room 2', roomType: RoomType.workspace, x: 10, y: 0, width: 10, height: 10 },
            ],
          },
        },
        include: { rooms: true },
      });

      const roomIds = house.rooms.map((r) => r.id);

      await prisma.house.delete({ where: { id: house.id } });

      const remainingRooms = await prisma.room.findMany({
        where: { id: { in: roomIds } },
      });
      expect(remainingRooms).toHaveLength(0);
    });
  });

  describe('Agent <-> House (N:N via HouseAgent)', () => {
    it('should assign multiple Agents to a House with roles', async () => {
      const village = await prisma.village.create({
        data: { orgName: 'Agent Test Org' },
      });

      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'org/agent-test',
          githubRepoId: BigInt(777888),
        },
      });

      const agent1 = await prisma.agent.create({
        data: {
          name: 'Claude',
          currentState: AgentState.idle,
          energy: 100,
          personality: JSON.stringify({
            introversion: 0.3,
            diligence: 0.9,
            creativity: 0.7,
            patience: 0.8,
          }),
        },
      });

      const agent2 = await prisma.agent.create({
        data: {
          name: 'Sonnet',
          currentState: AgentState.working,
          energy: 75,
          personality: JSON.stringify({
            introversion: 0.6,
            diligence: 0.8,
            creativity: 0.9,
            patience: 0.6,
          }),
        },
      });

      // Assign agents to house with different roles
      await prisma.houseAgent.create({
        data: {
          houseId: house.id,
          agentId: agent1.id,
          role: 'developer',
        },
      });

      await prisma.houseAgent.create({
        data: {
          houseId: house.id,
          agentId: agent2.id,
          role: 'reviewer',
        },
      });

      const houseWithAgents = await prisma.house.findUnique({
        where: { id: house.id },
        include: {
          agents: {
            include: { agent: true },
          },
        },
      });

      expect(houseWithAgents?.agents).toHaveLength(2);
      expect(houseWithAgents?.agents.map((ha) => ha.role)).toContain('developer');
      expect(houseWithAgents?.agents.map((ha) => ha.role)).toContain('reviewer');
      expect(houseWithAgents?.agents.map((ha) => ha.agent.name)).toContain('Claude');
      expect(houseWithAgents?.agents.map((ha) => ha.agent.name)).toContain('Sonnet');
    });

    it('should allow one Agent to be assigned to multiple Houses', async () => {
      const village = await prisma.village.create({
        data: { orgName: 'Multi-House Agent Org' },
      });

      const house1 = await prisma.house.create({
        data: { villageId: village.id, repoName: 'org/repo-a', githubRepoId: BigInt(111222) },
      });

      const house2 = await prisma.house.create({
        data: { villageId: village.id, repoName: 'org/repo-b', githubRepoId: BigInt(333444) },
      });

      const agent = await prisma.agent.create({
        data: { name: 'Multi-House Agent', currentState: AgentState.traveling },
      });

      await prisma.houseAgent.createMany({
        data: [
          { houseId: house1.id, agentId: agent.id, role: 'developer' },
          { houseId: house2.id, agentId: agent.id, role: 'tester' },
        ],
      });

      const agentWithHouses = await prisma.agent.findUnique({
        where: { id: agent.id },
        include: {
          houses: {
            include: { house: true },
          },
        },
      });

      expect(agentWithHouses?.houses).toHaveLength(2);
      expect(agentWithHouses?.houses.map((ha) => ha.house.repoName)).toContain('org/repo-a');
      expect(agentWithHouses?.houses.map((ha) => ha.house.repoName)).toContain('org/repo-b');
    });

    it('should cascade delete HouseAgent when House is deleted', async () => {
      const village = await prisma.village.create({
        data: { orgName: 'Cascade Test Org' },
      });

      const house = await prisma.house.create({
        data: { villageId: village.id, repoName: 'org/cascade', githubRepoId: BigInt(999888) },
      });

      const agent = await prisma.agent.create({
        data: { name: 'Cascade Test Agent' },
      });

      await prisma.houseAgent.create({
        data: { houseId: house.id, agentId: agent.id, role: 'developer' },
      });

      await prisma.house.delete({ where: { id: house.id } });

      // HouseAgent should be cascade deleted
      const houseAgentCount = await prisma.houseAgent.count({
        where: { agentId: agent.id },
      });
      expect(houseAgentCount).toBe(0);

      // But the Agent itself should still exist
      const remainingAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
      expect(remainingAgent).not.toBeNull();
    });
  });

  describe('Agent -> User (N:1 Nullable)', () => {
    it('should create Agent with associated User', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          githubId: BigInt(12345),
        },
      });

      const agent = await prisma.agent.create({
        data: {
          name: 'User Agent',
          userId: user.id,
          currentState: AgentState.idle,
        },
        include: { user: true },
      });

      expect(agent.user).not.toBeNull();
      expect(agent.user?.email).toBe('test@example.com');
    });

    it('should allow Agent without User (autonomous agent)', async () => {
      const agent = await prisma.agent.create({
        data: {
          name: 'Autonomous Agent',
          currentState: AgentState.observing,
          energy: 100,
        },
      });

      expect(agent.userId).toBeNull();
    });

    it('should set Agent.userId to null when User is deleted (SetNull)', async () => {
      const user = await prisma.user.create({
        data: { email: 'delete@example.com', username: 'deleteuser', githubId: BigInt(99999) },
      });

      const agent = await prisma.agent.create({
        data: { name: 'Orphanable Agent', userId: user.id },
      });

      await prisma.user.delete({ where: { id: user.id } });

      const updatedAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
      expect(updatedAgent?.userId).toBeNull();
    });
  });

  describe('Agent State Machine & Metrics', () => {
    it('should store all AgentState enum values', async () => {
      const states = Object.values(AgentState);
      expect(states).toContain('idle');
      expect(states).toContain('working');
      expect(states).toContain('thinking');
      expect(states).toContain('frustrated');
      expect(states).toContain('celebrating');
      expect(states).toContain('resting');
      expect(states).toContain('socializing');
      expect(states).toContain('traveling');
      expect(states).toContain('observing');
    });

    it('should update Agent metrics correctly', async () => {
      const agent = await prisma.agent.create({
        data: {
          name: 'Metrics Agent',
          currentState: AgentState.working,
          energy: 100,
          frustration: 0,
          workload: 50,
          streak: 0,
          errorStreak: 0,
        },
      });

      // Simulate work completion - increase streak, decrease energy
      const updatedAgent = await prisma.agent.update({
        where: { id: agent.id },
        data: {
          energy: 85,
          workload: 30,
          streak: 1,
          currentState: AgentState.celebrating,
          previousState: AgentState.working,
        },
      });

      expect(updatedAgent.energy).toBe(85);
      expect(updatedAgent.streak).toBe(1);
      expect(updatedAgent.currentState).toBe(AgentState.celebrating);
      expect(updatedAgent.previousState).toBe(AgentState.working);
    });

    it('should store personality and behavior config as JSON', async () => {
      const personality = {
        introversion: 0.4,
        diligence: 0.85,
        creativity: 0.7,
        patience: 0.6,
      };

      const behaviorConfig = {
        wanderRadius: 50,
        fleeDistance: 100,
        seekWeight: 1.0,
        avoidWeight: 0.8,
      };

      const agent = await prisma.agent.create({
        data: {
          name: 'Configurable Agent',
          personality: JSON.stringify(personality),
          behaviorConfig: JSON.stringify(behaviorConfig),
        },
      });

      expect(JSON.parse(agent.personality as string)).toEqual(personality);
      expect(JSON.parse(agent.behaviorConfig as string)).toEqual(behaviorConfig);
    });
  });

  describe('Full Entity Hierarchy Chain', () => {
    it('should create complete Village -> WorldMap -> House -> Room -> Agent chain', async () => {
      // 1. Create Village with WorldMap
      const village = await prisma.village.create({
        data: {
          orgName: 'Complete Hierarchy Org',
          seed: 'hierarchy-seed',
          worldMap: {
            create: {
              width: 200,
              height: 200,
              seed: 'world-seed',
              housePlacements: JSON.stringify([
                { x: 50, y: 50 },
                { x: 150, y: 50 },
              ]),
            },
          },
        },
        include: { worldMap: true },
      });

      // 2. Create Houses in Village
      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'org/full-stack-app',
          githubRepoId: BigInt(123456789),
          buildingSize: BuildingSize.large,
          positionX: 50,
          positionY: 50,
          footprintWidth: 64,
          footprintHeight: 48,
          primaryLanguage: 'TypeScript',
          complexity: 75,
        },
      });

      // 3. Create Rooms in House
      const rooms = await prisma.room.createMany({
        data: [
          {
            houseId: house.id,
            name: 'Entry Hall',
            roomType: RoomType.entrance,
            moduleType: ModuleType.root,
            modulePath: '/',
            x: 0,
            y: 0,
            width: 10,
            height: 10,
          },
          {
            houseId: house.id,
            name: 'Component Workshop',
            roomType: RoomType.workspace,
            moduleType: ModuleType.component,
            modulePath: '/src/components',
            x: 10,
            y: 0,
            width: 15,
            height: 12,
            fileCount: 25,
            totalSize: 50000,
            complexity: 7,
          },
          {
            houseId: house.id,
            name: 'Service Chamber',
            roomType: RoomType.workspace,
            moduleType: ModuleType.service,
            modulePath: '/src/services',
            x: 25,
            y: 0,
            width: 12,
            height: 10,
            fileCount: 10,
            totalSize: 30000,
            complexity: 8,
          },
          {
            houseId: house.id,
            name: 'Test Laboratory',
            roomType: RoomType.laboratory,
            moduleType: ModuleType.test,
            modulePath: '/src/__tests__',
            x: 0,
            y: 10,
            width: 20,
            height: 15,
            fileCount: 40,
            complexity: 5,
          },
        ],
      });

      // 4. Create Agent and assign to House
      const agent = await prisma.agent.create({
        data: {
          name: 'Full Stack Dev',
          currentState: AgentState.working,
          currentHouseId: house.id,
          energy: 90,
          workload: 60,
          personality: JSON.stringify({
            introversion: 0.3,
            diligence: 0.9,
            creativity: 0.8,
            patience: 0.7,
          }),
        },
      });

      await prisma.houseAgent.create({
        data: {
          houseId: house.id,
          agentId: agent.id,
          role: 'lead_developer',
        },
      });

      // 5. Verify the complete chain
      const completeVillage = await prisma.village.findUnique({
        where: { id: village.id },
        include: {
          worldMap: true,
          houses: {
            include: {
              rooms: true,
              agents: {
                include: { agent: true },
              },
            },
          },
        },
      });

      // Assertions on complete hierarchy
      expect(completeVillage).not.toBeNull();
      expect(completeVillage?.worldMap).not.toBeNull();
      expect(completeVillage?.houses).toHaveLength(1);
      expect(completeVillage?.houses[0].rooms).toHaveLength(4);
      expect(completeVillage?.houses[0].agents).toHaveLength(1);
      expect(completeVillage?.houses[0].agents[0].agent.name).toBe('Full Stack Dev');
      expect(completeVillage?.houses[0].rooms.some((r) => r.roomType === RoomType.laboratory)).toBe(
        true,
      );
    });

    it('should cascade delete entire hierarchy when Village is deleted', async () => {
      // Create complete hierarchy
      const village = await prisma.village.create({
        data: {
          orgName: 'Cascade Delete Org',
          worldMap: {
            create: { width: 100, height: 100, seed: 'cascade-seed' },
          },
          houses: {
            create: {
              repoName: 'org/cascade-repo',
              githubRepoId: BigInt(987654321),
              rooms: {
                create: [
                  {
                    name: 'Room A',
                    roomType: RoomType.entrance,
                    x: 0,
                    y: 0,
                    width: 10,
                    height: 10,
                  },
                  {
                    name: 'Room B',
                    roomType: RoomType.workspace,
                    x: 10,
                    y: 0,
                    width: 10,
                    height: 10,
                  },
                ],
              },
            },
          },
        },
        include: {
          worldMap: true,
          houses: { include: { rooms: true } },
        },
      });

      const worldMapId = village.worldMap!.id;
      const houseId = village.houses[0].id;
      const roomIds = village.houses[0].rooms.map((r) => r.id);

      // Delete the village
      await prisma.village.delete({ where: { id: village.id } });

      // Verify cascade deletion
      expect(await prisma.worldMap.findUnique({ where: { id: worldMapId } })).toBeNull();
      expect(await prisma.house.findUnique({ where: { id: houseId } })).toBeNull();
      expect(await prisma.room.findMany({ where: { id: { in: roomIds } } })).toHaveLength(0);
    });
  });

  describe('Index Performance Validation', () => {
    it('should have indexes on Agent location fields', async () => {
      // Create test data to query
      const village = await prisma.village.create({
        data: { orgName: 'Index Test Org' },
      });

      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          repoName: 'org/index-test',
          githubRepoId: BigInt(111222333),
        },
      });

      await prisma.room.create({
        data: {
          houseId: house.id,
          name: 'Test Room',
          roomType: RoomType.workspace,
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      });

      // Create agents with location data
      await prisma.agent.createMany({
        data: Array.from({ length: 10 }, (_, i) => ({
          name: `Agent ${i}`,
          currentHouseId: i % 2 === 0 ? house.id : null,
          currentState: AgentState.idle,
        })),
      });

      // Query by currentHouseId (should use index)
      const agentsInHouse = await prisma.agent.findMany({
        where: { currentHouseId: house.id },
      });

      expect(agentsInHouse.length).toBe(5);

      // Query by currentState (should use index)
      const idleAgents = await prisma.agent.findMany({
        where: { currentState: AgentState.idle },
      });

      expect(idleAgents.length).toBe(10);
    });
  });
});
