/**
 * Test Data Fixtures
 * Provides factories for creating consistent test data
 */

import type {
  Village,
  House,
  Agent,
  Room,
  User,
  Decoration,
  VillageAccess,
} from '@prisma/client';

/**
 * Village Fixtures
 */
export interface VillageFixtureOptions {
  id?: number;
  name?: string;
  githubOrgId?: string;
  ownerId?: string;
  visibility?: 'PUBLIC' | 'PRIVATE';
  layout?: any;
}

export function createVillageFixture(options: VillageFixtureOptions = {}): Partial<Village> {
  return {
    id: options.id || 1,
    name: options.name || `Test Village ${Date.now()}`,
    githubOrgId: options.githubOrgId || String(Math.floor(Math.random() * 1000000)),
    ownerId: options.ownerId || 'user-1',
    visibility: options.visibility || 'PUBLIC',
    layout: options.layout || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createVillageCreateData(options: VillageFixtureOptions = {}) {
  return {
    name: options.name || `Test Village ${Date.now()}`,
    githubOrgId: options.githubOrgId || String(Math.floor(Math.random() * 1000000)),
    // API infers owner from token, but we might send it in some tests?
    // API ignores visibility
  };
}

export function createVillageDbData(options: VillageFixtureOptions = {}) {
  return {
    orgName: options.name || `Test Village ${Date.now()}`,
    githubOrgId: options.githubOrgId || String(Math.floor(Math.random() * 1000000)),
  };
}

/**
 * House Fixtures
 */
export interface HouseFixtureOptions {
  id?: number;
  villageId?: number;
  repoId?: bigint;
  name?: string;
  x?: number;
  y?: number;
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
}

export function createHouseFixture(options: HouseFixtureOptions = {}): Partial<House> {
  return {
    id: options.id || 1,
    villageId: options.villageId || 1,
    repoId: options.repoId || BigInt(Math.floor(Math.random() * 1000000)),
    name: options.name || `Test House ${Date.now()}`,
    x: options.x ?? Math.floor(Math.random() * 100),
    y: options.y ?? Math.floor(Math.random() * 100),
    size: options.size || 'medium',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createHouseCreateData(options: HouseFixtureOptions = {}) {
  return {
    villageId: options.villageId || 1,
    repoId: options.repoId || BigInt(Math.floor(Math.random() * 1000000)),
    name: options.name || `Test House ${Date.now()}`,
    x: options.x ?? Math.floor(Math.random() * 100),
    y: options.y ?? Math.floor(Math.random() * 100),
    size: options.size || 'medium',
  };
}

/**
 * Agent Fixtures
 */
export interface AgentFixtureOptions {
  id?: number;
  githubRepoId?: string;
  repoId?: bigint;
  name?: string;
  villageId?: number;
  houseId?: number | null;
  ownerId?: string;
  state?: 'idle' | 'working' | 'thinking' | 'frustrated' | 'celebrating' | 'resting' | 'socializing' | 'traveling' | 'observing';
  x?: number;
  y?: number;
}

export function createAgentFixture(options: AgentFixtureOptions = {}): Partial<Agent> {
  return {
    id: options.id || 1,
    githubRepoId: options.githubRepoId || String(Math.floor(Math.random() * 1000000)),
    repoId: options.repoId || BigInt(Math.floor(Math.random() * 1000000)),
    name: options.name || `Test Agent ${Date.now()}`,
    villageId: options.villageId || 1,
    houseId: options.houseId ?? null,
    ownerId: options.ownerId || 'user-1',
    state: options.state || 'idle',
    x: options.x ?? 0,
    y: options.y ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createAgentCreateData(options: AgentFixtureOptions = {}) {
  return {
    githubRepoId: options.githubRepoId || String(Math.floor(Math.random() * 1000000)),
    repoId: options.repoId || BigInt(Math.floor(Math.random() * 1000000)),
    name: options.name || `Test Agent ${Date.now()}`,
    villageId: options.villageId || 1,
    houseId: options.houseId ?? null,
    ownerId: options.ownerId || 'user-1',
    state: options.state || 'idle',
    x: options.x ?? 0,
    y: options.y ?? 0,
  };
}

/**
 * Room Fixtures
 */
export interface RoomFixtureOptions {
  id?: number;
  houseId?: number;
  path?: string;
  name?: string;
  roomType?: 'entrance' | 'hallway' | 'workspace' | 'library' | 'vault' | 'laboratory' | 'archive';
  moduleType?: 'component' | 'service' | 'repository' | 'controller' | 'utility' | 'config' | 'type_def' | 'test' | 'asset' | 'root';
  complexity?: number;
  x?: number;
  y?: number;
}

export function createRoomFixture(options: RoomFixtureOptions = {}): Partial<Room> {
  return {
    id: options.id || 1,
    houseId: options.houseId || 1,
    path: options.path || `/src/test-${Date.now()}.ts`,
    name: options.name || `test-${Date.now()}.ts`,
    roomType: options.roomType || 'workspace',
    moduleType: options.moduleType || 'component',
    complexity: options.complexity ?? 5,
    x: options.x ?? 0,
    y: options.y ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createRoomCreateData(options: RoomFixtureOptions = {}) {
  return {
    houseId: options.houseId || 1,
    path: options.path || `/src/test-${Date.now()}.ts`,
    name: options.name || `test-${Date.now()}.ts`,
    roomType: options.roomType || 'workspace',
    moduleType: options.moduleType || 'component',
    complexity: options.complexity ?? 5,
    x: options.x ?? 0,
    y: options.y ?? 0,
  };
}

/**
 * User Fixtures
 */
export interface UserFixtureOptions {
  id?: string;
  githubId?: bigint;
  username?: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

export function createUserFixture(options: UserFixtureOptions = {}): Partial<User> {
  const timestamp = Date.now();
  return {
    id: options.id || `user-${timestamp}`,
    githubId: options.githubId || BigInt(Math.floor(Math.random() * 1000000)),
    username: options.username || `testuser-${timestamp}`,
    email: options.email || `test-${timestamp}@example.com`,
    name: options.name || `Test User ${timestamp}`,
    avatarUrl: options.avatarUrl || 'https://example.com/avatar.png',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createUserCreateData(options: UserFixtureOptions = {}) {
  const timestamp = Date.now();
  return {
    githubId: options.githubId || BigInt(Math.floor(Math.random() * 1000000)),
    username: options.username || `testuser-${timestamp}`,
    email: options.email || `test-${timestamp}@example.com`,
    name: options.name || `Test User ${timestamp}`,
    avatarUrl: options.avatarUrl || 'https://example.com/avatar.png',
  };
}

/**
 * Decoration Fixtures
 */
export interface DecorationFixtureOptions {
  id?: number;
  roomId?: number;
  decorationType?: string;
  x?: number;
  y?: number;
}

export function createDecorationFixture(options: DecorationFixtureOptions = {}): Partial<Decoration> {
  return {
    id: options.id || 1,
    roomId: options.roomId || 1,
    decorationType: options.decorationType || 'plant',
    x: options.x ?? 0,
    y: options.y ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createDecorationCreateData(options: DecorationFixtureOptions = {}) {
  return {
    roomId: options.roomId || 1,
    decorationType: options.decorationType || 'plant',
    x: options.x ?? 0,
    y: options.y ?? 0,
  };
}

/**
 * Village Access Fixtures
 */
export interface VillageAccessFixtureOptions {
  id?: number;
  villageId?: number;
  userId?: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export function createVillageAccessFixture(
  options: VillageAccessFixtureOptions = {}
): Partial<VillageAccess> {
  return {
    id: options.id || 1,
    villageId: options.villageId || 1,
    userId: options.userId || 'user-1',
    role: options.role || 'MEMBER',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createVillageAccessCreateData(options: VillageAccessFixtureOptions = {}) {
  return {
    villageId: options.villageId || 1,
    userId: options.userId || 'user-1',
    role: options.role || 'MEMBER',
  };
}

/**
 * Batch fixture creators
 */
export function createMultipleVillageFixtures(count: number): Partial<Village>[] {
  return Array.from({ length: count }, (_, i) =>
    createVillageFixture({ id: i + 1, name: `Village ${i + 1}` })
  );
}

export function createMultipleAgentFixtures(
  count: number,
  villageId: number = 1
): Partial<Agent>[] {
  return Array.from({ length: count }, (_, i) =>
    createAgentFixture({ id: i + 1, villageId, name: `Agent ${i + 1}` })
  );
}

export function createMultipleHouseFixtures(
  count: number,
  villageId: number = 1
): Partial<House>[] {
  return Array.from({ length: count }, (_, i) =>
    createHouseFixture({ id: i + 1, villageId, name: `House ${i + 1}` })
  );
}

export function createMultipleRoomFixtures(
  count: number,
  houseId: number = 1
): Partial<Room>[] {
  return Array.from({ length: count }, (_, i) =>
    createRoomFixture({ id: i + 1, houseId, name: `room-${i + 1}.ts` })
  );
}
