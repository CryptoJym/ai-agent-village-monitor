/**
 * Test helper functions
 * Provides utilities for creating test data and mocking dependencies
 */

import type { PrismaClient, Village, Agent, House, Room, User } from '@prisma/client';

/**
 * Test data factories
 */

export interface CreateTestVillageOptions {
  name?: string;
  githubOrgId?: string;
  ownerId?: number;
  visibility?: 'PUBLIC' | 'PRIVATE';
}

export function createTestVillageData(options: CreateTestVillageOptions = {}) {
  return {
    orgName: options.name || `test-village-${Date.now()}`,
    githubOrgId: options.githubOrgId || String(Math.floor(Math.random() * 1000000)),
    ownerId: options.ownerId || 1,
    visibility: options.visibility || 'PUBLIC',
  };
}

export interface CreateTestAgentOptions {
  githubRepoId?: string;
  name?: string;
  villageId?: number;
  status?: 'ACTIVE' | 'IDLE' | 'OFFLINE';
}

export function createTestAgentData(options: CreateTestAgentOptions = {}) {
  return {
    githubRepoId: options.githubRepoId || String(Math.floor(Math.random() * 1000000)),
    name: options.name || `test-agent-${Date.now()}`,
    villageId: options.villageId || 1,
    status: options.status || 'ACTIVE',
    lastSeenAt: new Date(),
  };
}

export interface CreateTestHouseOptions {
  villageId?: number;
  x?: number;
  y?: number;
  houseType?: string;
}

export function createTestHouseData(options: CreateTestHouseOptions = {}) {
  return {
    villageId: options.villageId || 1,
    x: options.x || Math.floor(Math.random() * 100),
    y: options.y || Math.floor(Math.random() * 100),
    houseType: options.houseType || 'COTTAGE',
  };
}

export interface CreateTestRoomOptions {
  houseId?: number;
  name?: string;
  roomType?: string;
}

export function createTestRoomData(options: CreateTestRoomOptions = {}) {
  return {
    houseId: options.houseId || 1,
    name: options.name || `test-room-${Date.now()}`,
    roomType: options.roomType || 'OFFICE',
  };
}

export interface CreateTestUserOptions {
  githubId?: bigint;
  username?: string;
  email?: string;
}

export function createTestUserData(options: CreateTestUserOptions = {}) {
  return {
    githubId: options.githubId || BigInt(Math.floor(Math.random() * 1000000)),
    username: options.username || `testuser-${Date.now()}`,
    email: options.email || `test-${Date.now()}@example.com`,
  };
}

/**
 * Database test helpers
 */

export async function createTestVillage(
  prisma: PrismaClient,
  options: CreateTestVillageOptions = {},
): Promise<Village> {
  const data = createTestVillageData(options);
  return await prisma.village.create({ data });
}

export async function createTestAgent(
  prisma: PrismaClient,
  options: CreateTestAgentOptions = {},
): Promise<Agent> {
  const data = createTestAgentData(options);
  return await prisma.agent.create({ data });
}

export async function createTestHouse(
  prisma: PrismaClient,
  options: CreateTestHouseOptions = {},
): Promise<House> {
  const data = createTestHouseData(options);
  return await prisma.house.create({ data });
}

export async function createTestRoom(
  prisma: PrismaClient,
  options: CreateTestRoomOptions = {},
): Promise<Room> {
  const data = createTestRoomData(options);
  return await prisma.room.create({ data });
}

export async function createTestUser(
  prisma: PrismaClient,
  options: CreateTestUserOptions = {},
): Promise<User> {
  const data = createTestUserData(options);
  return await prisma.user.create({ data });
}

/**
 * Clean up test data
 */

export async function cleanupTestData(prisma: PrismaClient) {
  // Delete in reverse order of dependencies
  await prisma.room.deleteMany({});
  await prisma.house.deleteMany({});
  await prisma.agent.deleteMany({});
  await prisma.village.deleteMany({});
  await prisma.user.deleteMany({});
}

/**
 * Mock data generators
 */

export function generateMockVillage(override: Partial<Village> = {}): Village {
  return {
    id: 1,
    name: 'Mock Village',
    githubOrgId: '123456',
    ownerId: 1,
    visibility: 'PUBLIC',
    createdAt: new Date(),
    updatedAt: new Date(),
    layout: null,
    ...override,
  } as Village;
}

export function generateMockAgent(override: Partial<Agent> = {}): Agent {
  return {
    id: 1,
    githubRepoId: '789012',
    name: 'Mock Agent',
    villageId: 1,
    houseId: null,
    status: 'ACTIVE',
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    x: null,
    y: null,
    ...override,
  } as Agent;
}

export function generateMockHouse(override: Partial<House> = {}): House {
  return {
    id: 1,
    villageId: 1,
    x: 10,
    y: 20,
    houseType: 'COTTAGE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...override,
  } as House;
}

export function generateMockRoom(override: Partial<Room> = {}): Room {
  return {
    id: 1,
    houseId: 1,
    name: 'Mock Room',
    roomType: 'OFFICE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...override,
  } as Room;
}

export function generateMockUser(override: Partial<User> = {}): User {
  return {
    id: 1,
    githubId: BigInt(123456),
    username: 'mockuser',
    email: 'mock@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...override,
  } as User;
}

/**
 * Wait for async operations
 */

export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry helper for flaky operations
 */

export async function retry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delay?: number } = {},
): Promise<T> {
  const { retries = 3, delay = 100 } = options;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await waitFor(delay);
    }
  }

  throw new Error('Retry failed');
}
