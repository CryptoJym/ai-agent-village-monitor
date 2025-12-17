/**
 * Test Data Fixtures
 * Lightweight helpers for API + DB integration tests.
 */

export type VillageCreateBody = {
  name: string;
  githubOrgId: string;
};

export type HouseCreateBody = {
  villageId: string;
  repoName: string;
  githubRepoId?: string;
  primaryLanguage?: string;
  stars?: number;
  openIssues?: number;
  commitSha?: string;
  buildingSize?: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
  complexity?: number;
};

export type RoomCreateBody = {
  houseId: string;
  name: string;
  roomType?: 'entrance' | 'hallway' | 'workspace' | 'library' | 'vault' | 'laboratory' | 'archive';
  moduleType?:
    | 'component'
    | 'service'
    | 'repository'
    | 'controller'
    | 'utility'
    | 'config'
    | 'type_def'
    | 'test'
    | 'asset'
    | 'root';
  modulePath?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AgentCreateBody = {
  name: string;
  positionX?: number;
  positionY?: number;
  currentStatus?: string;
  personality?: {
    introversion?: number;
    diligence?: number;
    creativity?: number;
    patience?: number;
  };
};

export type UserCreateData = {
  id?: string;
  githubId?: bigint;
  username?: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
};

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function createVillageCreateData(
  options: Partial<VillageCreateBody> = {},
): VillageCreateBody {
  const suffix = uniqueSuffix();
  return {
    name: options.name || `Test Village ${suffix}`,
    // Router accepts either a numeric id string or an org login; both become a BigInt.
    githubOrgId: options.githubOrgId || `org-${suffix}`,
  };
}

export function createHouseCreateData(options: Partial<HouseCreateBody> = {}): HouseCreateBody {
  const suffix = uniqueSuffix();
  return {
    villageId: options.villageId || 'missing-village-id',
    repoName: options.repoName || `repo-${suffix}`,
    githubRepoId: options.githubRepoId,
    primaryLanguage: options.primaryLanguage,
    stars: options.stars,
    openIssues: options.openIssues,
    commitSha: options.commitSha,
    buildingSize: options.buildingSize,
    complexity: options.complexity,
  };
}

export function createRoomCreateData(options: Partial<RoomCreateBody> = {}): RoomCreateBody {
  const suffix = uniqueSuffix();
  return {
    houseId: options.houseId || 'missing-house-id',
    name: options.name || `room-${suffix}`,
    roomType: options.roomType,
    moduleType: options.moduleType,
    modulePath: options.modulePath,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 10,
    height: options.height ?? 10,
  };
}

export function createAgentCreateData(options: Partial<AgentCreateBody> = {}): AgentCreateBody {
  const suffix = uniqueSuffix();
  return {
    name: options.name || `Test Agent ${suffix}`,
    positionX: options.positionX,
    positionY: options.positionY,
    currentStatus: options.currentStatus,
    personality: options.personality,
  };
}

export function createUserCreateData(options: UserCreateData = {}) {
  const suffix = uniqueSuffix();
  return {
    id: options.id,
    githubId: options.githubId || BigInt(Math.floor(Math.random() * 1_000_000_000)),
    username: options.username || `testuser-${suffix}`,
    email: options.email || `test-${suffix}@example.com`,
    name: options.name || `Test User ${suffix}`,
    avatarUrl: options.avatarUrl || 'https://example.com/avatar.png',
  };
}
