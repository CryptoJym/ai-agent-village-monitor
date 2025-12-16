# Database Schema Reference

## Overview

The AI Agent Village Monitor uses Prisma with SQLite (development) or PostgreSQL (production) to persist game world state, agent behavior, and repository metadata. The database represents a virtual RPG world where GitHub organizations become villages, repositories become houses, code modules become rooms, and AI agents perform development tasks.

**Database Provider:** SQLite (development) / PostgreSQL (production)
**ORM:** Prisma Client v6.16.1
**Schema Location:** `packages/server/prisma/schema.prisma`

---

## Quick Start

### Running Migrations

```bash
# Development: Apply migrations and update dev database
pnpm -C packages/server db:migrate

# Production: Push schema changes without migration files
pnpm -C packages/server db:push

# Reset database (WARNING: Deletes all data)
pnpm -C packages/server db:reset

# Generate Prisma Client after schema changes
pnpm -C packages/server prisma:generate
```

### Seeding the Database

```bash
# Standard seed (creates demo villages and agents)
pnpm -C packages/server db:seed

# Load testing seed (configurable volume)
SEED_VILLAGES=10 SEED_HOUSES_PER=20 SEED_AGENTS_PER=5 SEED_BUGS_PER=15 pnpm -C packages/server db:seed:load

# Synthetic data seed (for stress testing)
pnpm -C packages/server db:seed:synthetic
```

**Environment Variables:**

- `DATABASE_URL` - PostgreSQL connection string (required for production)
- For local development, defaults to `file:./prisma/dev.db`

### Running Tests

```bash
# All tests
pnpm -C packages/server test

# Unit tests only (excludes integration)
pnpm -C packages/server test:unit

# Integration tests only (requires database)
pnpm -C packages/server test:integration

# With coverage report
pnpm -C packages/server test:coverage
```

**Test Database:** Tests use `file:./prisma/test.db` via `DATABASE_URL` environment variable.

**Test Utilities:** See `src/__tests__/utils/db.ts` for:

- `setupTestDatabase()` - Initialize test database connection
- `cleanDatabase()` - Clear all test data
- `setupTransactionalTests()` - Transaction-based test isolation
- `seedTestData()` - Create basic test fixtures

---

## Enums

### BugStatus

Status lifecycle for bug/issue tracking.

- `open` - Newly created, unassigned
- `assigned` - Assigned to an agent
- `in_progress` - Agent is actively working on it
- `resolved` - Fixed and closed

### BugSeverity

Priority classification for bugs.

- `low` - Minor issues, low priority
- `medium` - Standard bugs
- `high` - Critical bugs requiring immediate attention

### WorldNodeType

Generic world hierarchy node types.

- `VILLAGE` - Top-level organization node
- `HOUSE` - Repository node
- `ROOM` - Code module node
- `DUNGEON` - Special challenge/quest area

### RoomType

Visual room types for the RPG world.

- `entrance` - Main entry point (always present)
- `hallway` - Connecting corridors
- `workspace` - Component/service implementation rooms
- `library` - Utility and shared code
- `vault` - Configuration and secrets
- `laboratory` - Test suites
- `archive` - Legacy/deprecated code

### ModuleType

Semantic classification of code modules.

- `component` - UI components (React/Vue/Svelte)
- `service` - Business logic, API clients
- `repository` - Data access, database models
- `controller` - Request handlers, routes
- `utility` - Helper functions, shared utilities
- `config` - Configuration files
- `type_def` - Type definitions (TypeScript interfaces, etc.)
- `test` - Test files
- `asset` - Static assets (images, fonts, etc.)
- `root` - Root-level files (package.json, README, etc.)

### AgentState

XState v5 state machine states for agent behavior.

- `idle` - Waiting for tasks
- `working` - Actively coding/implementing
- `thinking` - Planning or analyzing code
- `frustrated` - Encountering errors repeatedly
- `celebrating` - Successful completion
- `resting` - Taking a break (low energy)
- `socializing` - Interacting with other agents
- `traveling` - Moving between locations
- `observing` - Watching other agents or code changes

### BuildingSize

Building footprint based on repository complexity score.

- `tiny` - < 10 complexity score
- `small` - < 30 complexity score
- `medium` - < 80 complexity score
- `large` - < 200 complexity score
- `huge` - >= 200 complexity score

---

## Models

### User

Authenticated users who own villages and agents.

**Table Name:** `User`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Unique user identifier |
| `email` | String | @unique, nullable | User email address |
| `githubId` | BigInt | @unique, nullable | GitHub user ID |
| `username` | String | @unique, nullable | GitHub username |
| `name` | String | nullable | Display name |
| `avatarUrl` | String | nullable | Profile picture URL |
| `accessTokenHash` | String | nullable | Hashed GitHub access token |
| `preferences` | Json | nullable | User preferences (theme, etc.) |
| `createdAt` | DateTime | @default(now()) | Account creation timestamp |
| `updatedAt` | DateTime | @updatedAt | Last update timestamp |

**Relations:**

- `villages` → VillageAccess[] - Villages user has access to
- `agents` → Agent[] - Agents owned by user

---

### OAuthToken

Encrypted OAuth tokens for GitHub integration.

**Table Name:** `oauth_tokens` (mapped via @@map)

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Token record ID |
| `userKey` | String | | User identifier for this token |
| `provider` | String | | OAuth provider (e.g., "github") |
| `scopes` | String | nullable | Space-delimited OAuth scopes |
| `encCiphertext` | Bytes | | Encrypted token ciphertext (AES-256-GCM) |
| `encIv` | Bytes | | Encryption initialization vector |
| `encTag` | Bytes | | Encryption authentication tag |
| `version` | Int | @default(1) | Encryption version for key rotation |
| `createdAt` | DateTime | @default(now()) | Token creation time |
| `lastUsedAt` | DateTime | nullable | Last time token was used |

**Indexes:**

- Unique on (`userKey`, `provider`) - One token per provider per user
- Index on `provider` - Fast provider lookups

---

### VillageAccess

Junction table for user-village access control.

**Table Name:** `VillageAccess`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `villageId` | String | PK (composite) | Village ID |
| `userId` | String | PK (composite) | User ID |
| `role` | String | @default("viewer") | Access role (viewer/editor/owner) |

**Relations:**

- `village` → Village (onDelete: Cascade)
- `user` → User (onDelete: Cascade)

**Indexes:**

- Composite PK on (`villageId`, `userId`)
- Index on `userId` - Fast user access lookups

---

### Village

Top-level organization representing a GitHub organization or team.

**Table Name:** `Village`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Unique village ID |
| `orgName` | String | | Organization name |
| `githubOrgId` | BigInt | @unique, nullable | GitHub organization ID |
| `seed` | String | nullable | Deterministic world generation seed |
| `createdAt` | DateTime | @default(now()) | Village creation time |
| `updatedAt` | DateTime | @updatedAt | Last update time |
| `config` | Json | nullable | Village configuration (theme, etc.) |
| `layoutVersion` | Int | @default(0) | Layout versioning for concurrency |
| `provider` | String | @default("github") | Provider type (github, gitlab, etc.) |
| `externalId` | String | nullable | Provider-specific external ID |

**Relations:**

- `houses` → House[] - Repositories in this village
- `bugBots` → BugBot[] - Bugs tracked in this village
- `access` → VillageAccess[] - Users with access
- `worldMap` → WorldMap? - Generated world map

**Indexes:**

- Index on `orgName` - Fast organization lookups
- Index on (`provider`, `externalId`) - Provider-specific queries

---

### WorldMap

Generated 2D tilemap for the village world.

**Table Name:** `WorldMap`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Map ID |
| `villageId` | String | @unique | Owning village (one map per village) |
| `width` | Int | | World width in tiles |
| `height` | Int | | World height in tiles |
| `tileSize` | Int | @default(16) | Pixels per tile |
| `seed` | String | | Generation seed for reproducibility |
| `groundLayer` | Json | nullable | Floor tile data (serialized TypedArray) |
| `objectLayer` | Json | nullable | Trees, rocks, paths (serialized TypedArray) |
| `collisionData` | Json | nullable | Passability map for pathfinding |
| `housePlacements` | Json | nullable | Array of {houseId, x, y, rotation} |
| `generatedAt` | DateTime | @default(now()) | Initial generation timestamp |
| `generationVersion` | Int | @default(1) | Generation algorithm version |
| `createdAt` | DateTime | @default(now()) | Record creation time |
| `updatedAt` | DateTime | @updatedAt | Last update time |

**Relations:**

- `village` → Village (onDelete: Cascade)

---

### House

Repository representation as a building in the village.

**Table Name:** `House`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Unique house ID |
| `villageId` | String | | Parent village |
| `repoName` | String | | Repository name |
| `githubRepoId` | BigInt | @unique, nullable | GitHub repository ID |
| `primaryLanguage` | String | nullable | Main programming language |
| `stars` | Int | nullable | GitHub star count |
| `openIssues` | Int | nullable | Number of open issues |
| `commitSha` | String | nullable | Last analyzed commit SHA |
| `buildingSize` | BuildingSize | @default(medium), nullable | Building footprint size |
| `seed` | String | nullable | Generation seed (repoId + commitSha hash) |
| `complexity` | Int | nullable | Calculated complexity score (1-100) |
| `positionX` | Float | nullable | X coordinate in world |
| `positionY` | Float | nullable | Y coordinate in world |
| `footprintWidth` | Int | nullable | Building footprint width in tiles |
| `footprintHeight` | Int | nullable | Building footprint height in tiles |
| `spriteOrientation` | String | nullable | Building rotation/facing direction |
| `spriteVariant` | String | nullable | Visual style variant |
| `spriteScale` | Float | nullable | Display scale multiplier |
| `spriteUrl` | String | nullable | Generated building sprite URL |
| `lastMovedAt` | DateTime | nullable | Last manual position change |
| `lastMovedBy` | String | nullable | User who last moved the building |
| `interiorWidth` | Int | nullable | Interior tilemap width |
| `interiorHeight` | Int | nullable | Interior tilemap height |
| `interiorTilemap` | Json | nullable | Full interior tilemap data |
| `tilesetId` | String | nullable | Tileset used for interior |
| `provider` | String | @default("github") | Provider type |
| `externalId` | String | nullable | Provider-specific ID |
| `metadata` | Json | nullable | Additional metadata |
| `createdAt` | DateTime | @default(now()) | Creation time |
| `updatedAt` | DateTime | @updatedAt | Last update time |

**Relations:**

- `village` → Village (onDelete: Cascade)
- `rooms` → Room[] - Rooms inside this house
- `agents` → HouseAgent[] - Agents assigned to this house

**Indexes:**

- Index on `villageId` - Fast village queries
- Index on (`positionX`, `positionY`) - Spatial queries
- Index on (`provider`, `externalId`) - Provider lookups

---

### Room

Code module representation as a room inside a house.

**Table Name:** `Room`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Unique room ID |
| `houseId` | String | | Parent house |
| `name` | String | | Display name (e.g., "components", "utils") |
| `roomType` | RoomType | @default(workspace) | Visual room type |
| `moduleType` | ModuleType | nullable | Code module type |
| `modulePath` | String | nullable | Original code path (e.g., "src/components") |
| `x` | Int | | Room X position in house tilemap |
| `y` | Int | | Room Y position in house tilemap |
| `width` | Int | | Room width in tiles |
| `height` | Int | | Room height in tiles |
| `doors` | Json | nullable | Array of {x, y, direction, connectsToRoomId} |
| `corridorData` | Json | nullable | Corridor paths connecting rooms |
| `decorations` | Json | nullable | Array of {type, x, y, tileId, rotation} |
| `fileCount` | Int | nullable | Number of files in module |
| `totalSize` | Int | nullable | Total bytes of module |
| `complexity` | Int | nullable | Complexity score (1-10) |
| `imports` | Json | nullable | Module IDs this depends on |
| `exports` | Json | nullable | Public API surface |
| `createdAt` | DateTime | @default(now()) | Creation time |
| `updatedAt` | DateTime | @updatedAt | Last update time |

**Relations:**

- `house` → House (onDelete: Cascade)

**Indexes:**

- Index on `houseId` - Fast house queries
- Index on `roomType` - Filter by room type
- Index on `modulePath` - Code path lookups

---

### Agent

AI agent that performs development tasks (testing, coding, reviewing).

**Table Name:** `Agent`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Unique agent ID |
| `name` | String | | Agent display name |
| `userId` | String | nullable | Owning user |
| `spriteKey` | String | nullable | Sprite sheet identifier |
| `spriteConfig` | Json | nullable | Animation/visual config |
| `spriteOrientation` | String | nullable | Current facing direction |
| `spriteVariant` | String | nullable | Visual style variant |
| `spriteScale` | Float | nullable | Display scale |
| `positionX` | Float | nullable | X coordinate in world |
| `positionY` | Float | nullable | Y coordinate in world |
| `currentRoomId` | String | nullable | Current room if inside house |
| `currentHouseId` | String | nullable | Current house if inside building |
| `currentState` | AgentState | @default(idle) | XState v5 state |
| `previousState` | AgentState | nullable | Previous state for transitions |
| `stateHistory` | Json | nullable | Recent state transitions |
| `personality` | Json | nullable | {introversion, diligence, creativity, patience} |
| `energy` | Float | @default(100) | Energy level (0-100) |
| `frustration` | Float | @default(0) | Frustration level (0-100) |
| `workload` | Float | @default(0) | Current task load (0-100) |
| `streak` | Int | @default(0) | Consecutive successes |
| `errorStreak` | Int | @default(0) | Consecutive errors |
| `behaviorConfig` | Json | nullable | Yuka.js steering behavior settings |
| `locationContext` | Json | nullable | {villageId, houseId, roomId, taskDescription} |
| `lastMovedAt` | DateTime | nullable | Last position update |
| `lastMovedBy` | String | nullable | User who last moved agent |
| `status` | String | @default("idle") | Legacy status field |
| `config` | Json | nullable | Legacy config field |
| `createdAt` | DateTime | @default(now()) | Creation time |
| `updatedAt` | DateTime | @updatedAt | Last update time |

**Relations:**

- `user` → User (onDelete: SetNull)
- `sessions` → AgentSession[] - Activity sessions
- `events` → WorkStreamEvent[] - Event stream
- `houses` → HouseAgent[] - House assignments

---

### HouseAgent

Junction table for agent-house assignments.

**Table Name:** `HouseAgent`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `houseId` | String | PK (composite) | House ID |
| `agentId` | String | PK (composite) | Agent ID |
| `role` | String | @default("developer") | Agent role (developer/reviewer/tester) |
| `assignedAt` | DateTime | @default(now()) | Assignment timestamp |

**Relations:**

- `house` → House (onDelete: Cascade)
- `agent` → Agent (onDelete: Cascade)

**Indexes:**

- Composite PK on (`houseId`, `agentId`)
- Index on `agentId` - Fast agent lookups

---

### AgentSession

Tracks agent activity sessions (login/logout).

**Table Name:** `AgentSession`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Session ID |
| `agentId` | String | | Owning agent |
| `startedAt` | DateTime | @default(now()) | Session start time |
| `endedAt` | DateTime | nullable | Session end time (null if active) |
| `state` | String | nullable | Session state metadata |

**Relations:**

- `agent` → Agent (onDelete: Cascade)

**Indexes:**

- Index on `agentId` - Fast agent queries
- Index on `startedAt` - Temporal queries
- Composite index on (`agentId`, `startedAt`) - Agent timeline

---

### WorkStreamEvent

Event stream for agent activities (commits, builds, errors).

**Table Name:** `WorkStreamEvent`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Event ID |
| `agentId` | String | | Associated agent |
| `eventType` | String | nullable | Event type (commit, pr_opened, build_failed, etc.) |
| `message` | String | | Human-readable event message |
| `severity` | String | nullable | Severity (info, warning, error, success) |
| `metadata` | Json | nullable | Additional event data |
| `ts` | DateTime | @default(now()) | Event timestamp |

**Relations:**

- `agent` → Agent (onDelete: Cascade)

**Indexes:**

- Index on `agentId` - Fast agent queries
- Index on `ts` - Temporal queries
- Composite index on (`agentId`, `ts`) - Agent timeline
- Index on `eventType` - Filter by event type

---

### BugBot

Bug/issue representation as a visual entity in the world.

**Table Name:** `bug_bots` (mapped via @@map)

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Unique bug ID |
| `villageId` | String | | Parent village |
| `provider` | String | | Issue provider (github, jira, etc.) |
| `repoId` | String | nullable | Repository ID |
| `issueId` | String | | External issue ID |
| `issueNumber` | Int | nullable | Human-readable issue number |
| `title` | String | nullable | Issue title |
| `description` | String | nullable | Issue description |
| `status` | BugStatus | @default(open) | Current status |
| `severity` | BugSeverity | nullable | Bug severity |
| `assignedAgentId` | String | nullable | Assigned agent ID |
| `metadata` | Json | nullable | Additional metadata |
| `createdAt` | DateTime | @default(now()) | Creation time |
| `updatedAt` | DateTime | @updatedAt | Last update time |
| `resolvedAt` | DateTime | nullable | Resolution timestamp |
| `x` | Float | nullable | X position in world |
| `y` | Float | nullable | Y position in world |

**Relations:**

- `village` → Village (onDelete: Cascade)

**Indexes:**

- Unique on (`provider`, `issueId`) - Prevent duplicates per upstream issue
- Index on `villageId` (named `idx_village`) - Fast village queries

---

### WorldNode

Generic tree structure for hierarchical world organization.

**Table Name:** `WorldNode`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Node ID |
| `parentId` | String | nullable | Parent node ID |
| `type` | WorldNodeType | | Node type (VILLAGE/HOUSE/ROOM/DUNGEON) |
| `provider` | String | @default("github") | Provider type |
| `externalId` | String | | Provider-specific ID |
| `name` | String | | Display name |
| `config` | Json | nullable | Node configuration |
| `visualContext` | Json | nullable | Visual rendering data (Nano Banana) |
| `assets` | Json | nullable | Asset references |
| `createdAt` | DateTime | @default(now()) | Creation time |
| `updatedAt` | DateTime | @updatedAt | Last update time |

**Relations:**

- `parent` → WorldNode? (self-relation "NodeHierarchy", onDelete: Cascade)
- `children` → WorldNode[] (self-relation "NodeHierarchy")

**Indexes:**

- Unique on (`provider`, `externalId`) - Prevent duplicates
- Index on `parentId` - Fast child lookups

---

### GeneratedSprite

Tracks AI-generated sprites for entities.

**Table Name:** `GeneratedSprite`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Sprite record ID |
| `entityType` | String | | Entity type (agent, building, decoration) |
| `entityId` | String | | Entity ID this sprite belongs to |
| `prompt` | String | | Generation prompt |
| `seed` | Int | | Generation seed for reproducibility |
| `style` | String | nullable | Style (pixel_art, rpg, etc.) |
| `spriteUrl` | String | | Output sprite URL |
| `width` | Int | | Sprite width in pixels |
| `height` | Int | | Sprite height in pixels |
| `frames` | Int | @default(1) | Number of frames (for animations) |
| `generatedAt` | DateTime | @default(now()) | Generation timestamp |
| `expiresAt` | DateTime | nullable | Cache expiration time |
| `provider` | String | @default("pixellab") | Generation provider (pixellab, replicate, etc.) |
| `cost` | Float | nullable | Generation cost (API credits) |
| `metadata` | Json | nullable | Additional metadata |
| `createdAt` | DateTime | @default(now()) | Record creation time |
| `updatedAt` | DateTime | @updatedAt | Last update time |

**Indexes:**

- Unique on (`entityType`, `entityId`) - One sprite per entity
- Index on `entityType` - Filter by entity type
- Index on `expiresAt` - Cache cleanup queries

---

### Tileset

Tileset definitions for building interiors.

**Table Name:** `Tileset`

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, @default(cuid()) | Tileset ID |
| `name` | String | @unique | Tileset name |
| `description` | String | nullable | Description |
| `imageUrl` | String | | Tileset image URL |
| `tileWidth` | Int | @default(16) | Tile width in pixels |
| `tileHeight` | Int | @default(16) | Tile height in pixels |
| `columns` | Int | | Tiles per row in image |
| `rows` | Int | | Rows in image |
| `wallTiles` | Json | | {mask: tileId} for 4-bit auto-tiling |
| `floorTiles` | Json | | Array of floor tile IDs |
| `doorTiles` | Json | | {north, south, east, west} door tile IDs |
| `decorations` | Json | nullable | {itemName: tileId} decoration mappings |
| `languages` | Json | nullable | Array of programming languages this suits |
| `theme` | String | nullable | Theme (modern, medieval, sci-fi, etc.) |
| `createdAt` | DateTime | @default(now()) | Creation time |
| `updatedAt` | DateTime | @updatedAt | Last update time |

---

## Entity Relationship Diagram (Text)

```
User
├── villages (via VillageAccess) → Village
│   ├── houses → House
│   │   ├── rooms → Room
│   │   └── agents (via HouseAgent) → Agent
│   ├── bugBots → BugBot
│   └── worldMap → WorldMap
└── agents → Agent
    ├── sessions → AgentSession
    ├── events → WorkStreamEvent
    └── houses (via HouseAgent) → House

OAuthToken (linked to User via userKey)

WorldNode (self-referencing tree)
├── parent → WorldNode
└── children → WorldNode[]

GeneratedSprite (polymorphic via entityType/entityId)

Tileset (referenced by House.tilesetId)
```

---

## Development Workflows

### Adding a New Model

1. Edit `packages/server/prisma/schema.prisma`
2. Generate Prisma Client: `pnpm -C packages/server prisma:generate`
3. Create migration: `pnpm -C packages/server db:migrate`
4. Update this documentation (`docs/DB_SCHEMA.md`)

### Querying the Database

```typescript
import { prisma } from '@/db/client';

// Example: Get all villages with houses
const villages = await prisma.village.findMany({
  include: {
    houses: true,
    bugBots: true,
  },
});
```

### Debugging with Prisma Studio

```bash
pnpm -C packages/server prisma:studio
```

Opens a web UI at `http://localhost:5555` for browsing and editing database records.

---

## Seed Scripts

### Standard Seed (`seed.js`)

Creates demo data with:

- 3 villages (Demo Org, Acme Org, org)
- 2-3 houses per village
- 2 agents (Claude, Sonnet)
- Bug bots for each house

**Run:** `pnpm -C packages/server db:seed`

### Load Testing Seed (`seed.load.cjs`)

Generates configurable volume of test data.

**Environment Variables:**

- `SEED_VILLAGES` (default: 5) - Number of villages
- `SEED_HOUSES_PER` (default: 10) - Houses per village
- `SEED_AGENTS_PER` (default: 3) - Agents per village
- `SEED_BUGS_PER` (default: 8) - Bugs per village

**Run:** `SEED_VILLAGES=20 pnpm -C packages/server db:seed:load`

### Synthetic Seed (`seed.synthetic.cjs`)

Generates high-volume synthetic data for stress testing (implementation may vary).

**Run:** `pnpm -C packages/server db:seed:synthetic`

---

## Migration History

Migrations are located in `packages/server/prisma/migrations/`:

1. **20250915123339_init_session_event** - Initial session and event tracking
2. **20250915124406_session_idempotency** - Add idempotency for session commands
3. **20250915230100_agent_ts_index** - Add timestamp indexes for agent queries
4. **20250918183000_add_house_analytics** - Add analytics fields to houses

**View Migration:** `cat packages/server/prisma/migrations/<migration_name>/migration.sql`

---

## Additional Resources

- **Prisma Documentation:** https://www.prisma.io/docs
- **Schema File:** `packages/server/prisma/schema.prisma`
- **Test Utilities:** `packages/server/src/__tests__/utils/db.ts`
- **Integration Tests:** `packages/server/src/__tests__/integration/`

---

**Last Updated:** 2025-12-16
