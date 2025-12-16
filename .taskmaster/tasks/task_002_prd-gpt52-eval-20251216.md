# Task ID: 2

**Title:** Create Village CRUD endpoints

**Status:** done

**Dependencies:** 1

**Priority:** high

**Description:** Implement full REST API for villages with nested house loading

**Details:**

Use Fastify v5.3.0 with TypeScript. Endpoints: GET /api/villages (pagination, filtering), POST /api/villages (validation with Zod v3.23.8), GET /api/villages/:id (include houses with Prisma populate), PUT/DELETE. Add input validation, error handling, and Prisma transactions for atomic operations.

**Test Strategy:**

Jest integration tests covering all endpoints with 80% coverage. Mock Prisma with @prisma/client mock library. Test edge cases, validation errors, and relations.
