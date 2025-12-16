# Database Schema Reference

This document provides comprehensive documentation for the AI Agent Village Monitor Prisma schema, covering all models, relationships, enums, and operational workflows.

## Quick Start

```bash
# Generate Prisma client
pnpm -C packages/server prisma:generate

# Push schema changes (development)
pnpm -C packages/server db:push

# Run migrations (production)
pnpm -C packages/server db:migrate

# Seed database
pnpm -C packages/server db:seed

# Open Prisma Studio (visual DB editor)
pnpm -C packages/server prisma:studio
```

## Entity Relationship Overview

```
User (1)─────────────────────(N) Agent
  │                               │
  │                               │ (N:N via HouseAgent)
  │                               │
  └──(N) VillageAccess (N)──Village (1)──(1) WorldMap
                              │
                              │ (1:N)
                              │
                            House (1)──(N) Room
                              │
                              └──(N) HouseAgent (N)── Agent
                              │
                              └──(N) BugBot
```

## Core Domain Models

### Village

The top-level organizational entity representing a GitHub organization or team.

| Field           | Type          | Description                             |
| --------------- | ------------- | --------------------------------------- |
| `id`            | String (cuid) | Primary key                             |
| `orgName`       | String        | Organization/team name                  |
| `githubOrgId`   | BigInt?       | GitHub organization ID (unique)         |
| `seed`          | String?       | Deterministic seed for world generation |
| `layoutVersion` | Int           | Optimistic locking for layout changes   |
| `provider`      | String        | Auth provider (default: "github")       |
| `externalId`    | String?       | External provider ID                    |
| `config`        | Json?         | Village configuration settings          |
| `createdAt`     | DateTime      | Creation timestamp                      |
| `updatedAt`     | DateTime      | Last update timestamp                   |

**Relations:**

- `houses` (1:N) - Houses in the village
- `worldMap` (1:1) - The village's world map
- `access` (1:N) - User access permissions
- `bugBots` (1:N) - Bug tracking entities

**Indexes:**

- `orgName` - Fast org lookup
- `(provider, externalId)` - External ID lookup

---

### WorldMap

Stores the 2D tilemap data for a village's world.

| Field               | Type            | Description                   |
| ------------------- | --------------- | ----------------------------- |
| `id`                | String (cuid)   | Primary key                   |
| `villageId`         | String (unique) | Parent village (1:1)          |
| `width`             | Int             | World width in tiles          |
| `height`            | Int             | World height in tiles         |
| `tileSize`          | Int             | Pixels per tile (default: 16) |
| `seed`              | String          | Generation seed               |
| `groundLayer`       | Json?           | Floor tiles data              |
| `objectLayer`       | Json?           | Trees, rocks, paths           |
| `collisionData`     | Json?           | Passability map               |
| `housePlacements`   | Json?           | Array of house positions      |
| `generationVersion` | Int             | Generation algorithm version  |
| `generatedAt`       | DateTime        | Last generation timestamp     |

**Cascade:** Deleted when parent Village is deleted.

---

### House

Represents a GitHub repository as a building in the village.

| Field             | Type          | Description                        |
| ----------------- | ------------- | ---------------------------------- |
| `id`              | String (cuid) | Primary key                        |
| `villageId`       | String        | Parent village                     |
| `repoName`        | String        | Repository name (e.g., "org/repo") |
| `githubRepoId`    | BigInt?       | GitHub repository ID (unique)      |
| `primaryLanguage` | String?       | Primary programming language       |
| `stars`           | Int?          | GitHub stars count                 |
| `openIssues`      | Int?          | Open issues count                  |
| `commitSha`       | String?       | Last analyzed commit SHA           |
| `buildingSize`    | BuildingSize? | Visual size category               |
| `seed`            | String?       | Deterministic generation seed      |
| `complexity`      | Int?          | Calculated complexity (1-100)      |
| `positionX`       | Float?        | X position in world                |
| `positionY`       | Float?        | Y position in world                |
| `footprintWidth`  | Int?          | Building width in tiles            |
| `footprintHeight` | Int?          | Building height in tiles           |
| `spriteUrl`       | String?       | Generated building sprite URL      |
| `interiorTilemap` | Json?         | Interior room layout data          |

**Relations:**

- `village` (N:1) - Parent village
- `rooms` (1:N) - Rooms inside the house
- `agents` (N:N via HouseAgent) - Assigned agents

**Indexes:**

- `villageId` - Village filtering
- `(positionX, positionY)` - Spatial queries
- `(provider, externalId)` - External lookups

---

### Room

Represents a code module as a room inside a house.

| Field          | Type          | Description                |
| -------------- | ------------- | -------------------------- |
| `id`           | String (cuid) | Primary key                |
| `houseId`      | String        | Parent house               |
| `name`         | String        | Display name               |
| `roomType`     | RoomType      | Visual room category       |
| `moduleType`   | ModuleType?   | Code module classification |
| `modulePath`   | String?       | Original file path         |
| `x`            | Int           | X position in house grid   |
| `y`            | Int           | Y position in house grid   |
| `width`        | Int           | Room width in tiles        |
| `height`       | Int           | Room height in tiles       |
| `doors`        | Json?         | Door connections           |
| `corridorData` | Json?         | Corridor paths             |
| `decorations`  | Json?         | Room decorations           |
| `fileCount`    | Int?          | Files in module            |
| `totalSize`    | Int?          | Total bytes                |
| `complexity`   | Int?          | Complexity score (1-10)    |
| `imports`      | Json?         | Module dependencies        |
| `exports`      | Json?         | Public API surface         |

**Indexes:**

- `houseId` - House filtering
- `roomType` - Type filtering
- `modulePath` - Path lookup

---

### Agent

Represents an AI agent or user avatar with XState v5 behavior.

| Field             | Type          | Description                |
| ----------------- | ------------- | -------------------------- |
| `id`              | String (cuid) | Primary key                |
| `name`            | String        | Agent display name         |
| `userId`          | String?       | Associated user (nullable) |
| `spriteKey`       | String?       | Sprite sheet identifier    |
| `spriteConfig`    | Json?         | Animation configuration    |
| `positionX`       | Float?        | World X position           |
| `positionY`       | Float?        | World Y position           |
| `currentRoomId`   | String?       | Current room location      |
| `currentHouseId`  | String?       | Current house location     |
| `currentState`    | AgentState    | XState machine state       |
| `previousState`   | AgentState?   | Previous state             |
| `stateHistory`    | Json?         | State transition log       |
| `personality`     | Json?         | Personality traits         |
| `energy`          | Float         | Energy level (0-100)       |
| `frustration`     | Float         | Frustration level (0-100)  |
| `workload`        | Float         | Task load (0-100)          |
| `streak`          | Int           | Consecutive successes      |
| `errorStreak`     | Int           | Consecutive failures       |
| `behaviorConfig`  | Json?         | Yuka.js behavior settings  |
| `locationContext` | Json?         | Current work context       |

**Personality JSON Schema:**

```json
{
  "introversion": 0.4, // 0-1, higher = more introverted
  "diligence": 0.85, // 0-1, higher = more thorough
  "creativity": 0.7, // 0-1, higher = more creative
  "patience": 0.6 // 0-1, higher = more patient
}
```

**Indexes:**

- `currentHouseId` - House-based queries
- `currentRoomId` - Room-based queries
- `currentState` - State filtering
- `userId` - User association

**Relations:**

- `user` (N:1, SetNull) - Optional user association
- `houses` (N:N via HouseAgent) - House assignments
- `sessions` (1:N) - Agent sessions
- `events` (1:N) - Work stream events

---

### HouseAgent (Junction Table)

Many-to-many relationship between Agents and Houses with role assignment.

| Field        | Type     | Description          |
| ------------ | -------- | -------------------- |
| `houseId`    | String   | House reference      |
| `agentId`    | String   | Agent reference      |
| `role`       | String   | Assignment role      |
| `assignedAt` | DateTime | Assignment timestamp |

**Roles:** `developer`, `reviewer`, `tester`, `lead_developer`, `maintainer`

---

## Enums

### AgentState

XState v5 machine states for agent behavior.

| Value         | Description                |
| ------------- | -------------------------- |
| `idle`        | Default rest state         |
| `working`     | Actively performing tasks  |
| `thinking`    | Processing/analyzing       |
| `frustrated`  | Error recovery state       |
| `celebrating` | Success celebration        |
| `resting`     | Energy recovery            |
| `socializing` | Agent-to-agent interaction |
| `traveling`   | Moving between locations   |
| `observing`   | Passive monitoring         |

### RoomType

Visual categorization for room appearance.

| Value        | Description                 |
| ------------ | --------------------------- |
| `entrance`   | Main entry (always present) |
| `hallway`    | Connecting corridors        |
| `workspace`  | Component/service rooms     |
| `library`    | Utility/shared code         |
| `vault`      | Config/secrets              |
| `laboratory` | Test suites                 |
| `archive`    | Legacy/deprecated           |

### ModuleType

Semantic classification of code modules.

| Value        | Description      |
| ------------ | ---------------- |
| `component`  | UI components    |
| `service`    | Business logic   |
| `repository` | Data access      |
| `controller` | Request handlers |
| `utility`    | Helper functions |
| `config`     | Configuration    |
| `type_def`   | Type definitions |
| `test`       | Test files       |
| `asset`      | Static assets    |
| `root`       | Root-level files |

### BuildingSize

Repository complexity-based building sizes.

| Value    | Score Range | Description      |
| -------- | ----------- | ---------------- |
| `tiny`   | < 10        | Very small repos |
| `small`  | < 30        | Small repos      |
| `medium` | < 80        | Medium repos     |
| `large`  | < 200       | Large repos      |
| `huge`   | >= 200      | Very large repos |

---

## Supporting Models

### User

GitHub OAuth user account.

| Field             | Type          | Description             |
| ----------------- | ------------- | ----------------------- |
| `id`              | String (cuid) | Primary key             |
| `email`           | String?       | Email (unique)          |
| `githubId`        | BigInt?       | GitHub user ID (unique) |
| `username`        | String?       | Username (unique)       |
| `name`            | String?       | Display name            |
| `avatarUrl`       | String?       | Profile image URL       |
| `accessTokenHash` | String?       | Hashed access token     |
| `preferences`     | Json?         | User settings           |

### VillageAccess

User permissions for villages.

| Field       | Type   | Description       |
| ----------- | ------ | ----------------- |
| `villageId` | String | Village reference |
| `userId`    | String | User reference    |
| `role`      | String | Permission role   |

**Roles:** `owner`, `admin`, `editor`, `viewer`

### BugBot

Issue tracking entities mapped to bugs.

| Field         | Type          | Description          |
| ------------- | ------------- | -------------------- |
| `id`          | String (cuid) | Primary key          |
| `villageId`   | String        | Parent village       |
| `provider`    | String        | Issue provider       |
| `issueId`     | String        | External issue ID    |
| `issueNumber` | Int?          | Issue number         |
| `title`       | String?       | Issue title          |
| `status`      | BugStatus     | Bug lifecycle status |
| `severity`    | BugSeverity?  | Priority level       |
| `x`           | Float?        | World position X     |
| `y`           | Float?        | World position Y     |

---

## Migration Workflow

### Development (Local)

```bash
# Quick schema sync (no migration history)
pnpm -C packages/server db:push

# Reset database (drops all data)
pnpm -C packages/server db:reset
```

### Production/Staging

```bash
# Create new migration
pnpm -C packages/server db:migrate --name your_migration_name

# Apply pending migrations
pnpm -C packages/server db:migrate
```

### Migration Files

Located in `packages/server/prisma/migrations/`:

| Migration                            | Description                         |
| ------------------------------------ | ----------------------------------- |
| `20250915123339_init_session_event`  | Initial schema with all core models |
| `20250915124406_session_idempotency` | Session uniqueness constraints      |
| `20250915230100_agent_ts_index`      | Agent timestamp indexing            |
| `20250918183000_add_house_analytics` | House analytics fields              |

---

## Seeding

### Basic Seed (Development)

```bash
pnpm -C packages/server db:seed
```

Creates:

- Demo users
- Sample villages with houses
- Basic agents with events
- Bug tracking entities

### Synthetic Load Data

```bash
# Configure via environment
SY_ORGS=5 SY_REPOS_PER_ORG=10 SY_AGENTS_PER_VILLAGE=20 \
pnpm -C packages/server db:seed:synthetic
```

---

## Testing

### Database Test Utilities

Located in `packages/server/src/__tests__/utils/db.ts`:

```typescript
import { setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../utils/db';

describe('My Tests', () => {
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
});
```

### Running Tests

```bash
# All tests
pnpm -C packages/server test

# Integration tests only
pnpm -C packages/server test:integration

# With coverage
pnpm -C packages/server test:coverage
```

---

## Performance Considerations

### Indexed Fields

All foreign keys have indexes for efficient joins:

- `House.villageId`
- `Room.houseId`
- `Agent.userId`, `Agent.currentHouseId`, `Agent.currentRoomId`
- `HouseAgent.agentId`

### Spatial Queries

House positions are indexed: `@@index([positionX, positionY])`

### Event Time-Series

WorkStreamEvent has composite index: `@@index([agentId, ts])`

---

## Environment Variables

```bash
# SQLite (development)
DATABASE_URL="file:./dev.db"

# PostgreSQL (production)
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"
```

See `docs/ENVIRONMENT.md` for complete configuration.
