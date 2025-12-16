# Task ID: 1

**Title:** Migrate database to Prisma with comprehensive schema

**Status:** review

**Dependencies:** None

**Priority:** high

**Description:** Create Prisma schema for Village, House, Room, Agent, and WorldMap models with all specified relations

**Details:**

Use Prisma v5.17.0. Define models: Village (id, seed, name, worldMapId), House (id, villageId, githubRepoId, position, footprint), Room (id, houseId, moduleType, modulePath, position, size, connections), Agent (id, houseId, name, spriteKey, personality, position, state, energy), WorldMap (id, villageId, mapData). Generate Prisma client with `npx prisma generate`. Run migrations with `npx prisma migrate dev`. Add indexes on foreign keys and frequent query fields.
<info added on 2025-12-16T18:45:03.900Z>
Audit (2025-12-16): Prisma/DB foundation already exists in base. Canonical schema is in packages/server/prisma/schema.prisma; Prisma client singleton is in packages/server/src/db/client.ts (Vitest-safe stub) with a guard accessor in packages/server/src/db.ts. Prisma workflows are scripted in packages/server/package.json (prisma:generate, prisma:studio, db:migrate, db:push, db:reset, db:seed, db:seed:load, db:seed:synthetic) and seeds live under packages/server/prisma (seed.js, seed.load.cjs, seed.synthetic.cjs). Current server deps pin prisma and @prisma/client to ^6.16.1 (not v5.17.0). DB documentation is maintained in docs/DB_SCHEMA.md (references schema.prisma as canonical). Preferred completion work is PR #44 (schema refinements, DB-relations tests, docs/DB_SCHEMA.md rewrite); PR #43 overlaps but is older. Task is in review pending merge; subtasks 1.4-1.6 are done, remaining subtasks are in review.
</info added on 2025-12-16T18:45:03.900Z>

**Test Strategy:**

Test schema generation, relation integrity, and migration with `prisma db push` in test env. Verify all relations with integration tests using test database.

## Subtasks

### 1.1. Define initial Prisma data model schema for core entities

**Status:** review  
**Dependencies:** None  

Create the initial Prisma schema with Village, House, Room, Agent, and WorldMap models and all fields described in the parent task.

**Details:**

In packages/server/prisma/schema.prisma, define models Village, House, Room, Agent, and WorldMap with the specified scalar fields: Village (id, seed, name, worldMapId), House (id, villageId, githubRepoId, position, footprint), Room (id, houseId, moduleType, modulePath, position, size, connections), Agent (id, houseId, name, spriteKey, personality, position, state, energy), WorldMap (id, villageId, mapData). Choose appropriate Prisma types (e.g., Int, String, Json) and ID strategies, and ensure naming conventions match existing code where applicable.

### 1.2. Model relations and referential actions between entities

**Status:** review  
**Dependencies:** 1.1  

Add all required relations and referential actions among Village, House, Room, Agent, and WorldMap models in the Prisma schema.

**Details:**

In packages/server/prisma/schema.prisma, define relation fields and foreign keys: Village has many House and one WorldMap; House belongs to Village and has many Room and Agent; Room belongs to House; Agent belongs to House; WorldMap belongs to Village. Configure relation attributes (fields, references) and appropriate onDelete/onUpdate behaviors (e.g., cascading deletes for child records where desired). Ensure worldMapId and villageId are properly wired to their respective relations without circular optionality issues.

### 1.3. Add indexes and unique constraints for foreign keys and query hotspots

**Status:** review  
**Dependencies:** 1.2  

Optimize the Prisma schema with indexes and uniques on foreign keys and frequently queried fields.

**Details:**

In packages/server/prisma/schema.prisma, add @@index or @index on foreign key fields such as villageId, houseId, worldMapId, githubRepoId, and any other fields known to be frequent query filters (e.g., name on Village, moduleType on Room if used in lookups). Add @@unique constraints where domain rules require uniqueness (e.g., one WorldMap per Village if applicable). Ensure index names are explicit to ease future migrations.

### 1.4. Generate initial Prisma migration and client

**Status:** done  
**Dependencies:** 1.3  

Create the initial database migration from the schema and generate the Prisma client.

**Details:**

From packages/server, run Prisma CLI commands using the repo’s pinned Prisma 6.x version (via existing scripts or npx): generate an initial migration with `npx prisma migrate dev --name init_core_models --schema=./prisma/schema.prisma` targeting the development database, and ensure SQL files are created under packages/server/prisma/migrations. Then run `npx prisma generate --schema=./prisma/schema.prisma` to regenerate the Prisma client. Verify that the generated client is in the expected output directory and that TypeScript compiles.

### 1.5. Implement seed script for core world data using Prisma client

**Status:** done  
**Dependencies:** 1.4  

Create a seed script that populates example Village, House, Room, Agent, and WorldMap records using the new schema.

**Details:**

In packages/server/src, add a seed script file (e.g., src/prisma/seed.ts) that imports the generated PrismaClient from the correct path and inserts a coherent data set: at least one Village with seed and name, associated WorldMap with mapData JSON, multiple Houses with githubRepoId, position, footprint, Rooms with moduleType/modulePath/position/size/connections, and Agents tied to Houses with personality, state, and energy fields. Ensure relations are created in the correct order and handle upserts or idempotence if the script may be rerun.

### 1.6. Wire Prisma client and schema into server application layer

**Status:** done  
**Dependencies:** 1.4  

Integrate the generated Prisma client into the server codebase so that existing or new services use the new models.

**Details:**

In packages/server/src, create or update a Prisma client singleton (e.g., src/prisma/client.ts) that exports a configured PrismaClient instance. Update or add repository/service modules that will access Village, House, Room, Agent, and WorldMap records to use this client and new model names. Ensure the DATABASE_URL and environment configuration align with the Prisma schema and existing app config, and avoid introducing new dependencies beyond Prisma and Vitest already in the repo.

### 1.7. Create Vitest integration tests for schema relations and constraints

**Status:** review  
**Dependencies:** 1.5, 1.6  

Add tests to verify that Prisma enforces the intended relations, cascades, and constraints using a test database.

**Details:**

Under packages/server/src (e.g., src/prisma/__tests__/schema.integration.test.ts), write Vitest tests that spin up PrismaClient pointing at a dedicated test database. Ensure tests run migrations for the test DB (using `npx prisma migrate dev` or `prisma db push` in a test-specific setup) before executing. Test that creating a Village allows Houses, Rooms, Agents, and WorldMap to be created correctly; verify referential integrity errors when foreign keys are invalid; and confirm cascade or restricted deletes behave as configured. Use transactions and cleanup logic to keep tests isolated.

### 1.8. Document Prisma migration, seeding, and testing workflows

**Status:** review  
**Dependencies:** 1.4, 1.5, 1.7  

Add concise documentation describing how to work with the new Prisma schema, migrations, seeds, and tests.

**Details:**

In packages/server (e.g., in README.md or docs/prisma.md), document how to: modify packages/server/prisma/schema.prisma, create new migrations with `npx prisma migrate dev`, generate the client with `npx prisma generate`, run seeds (command and entrypoint file path), and execute Vitest integration tests for the database layer. Include notes about using the existing Prisma 6.x version, where the schema and migrations live, and any environment variables required for dev vs test databases. Keep instructions specific and aligned with current repo scripts.
