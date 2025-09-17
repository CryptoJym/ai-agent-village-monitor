Backend Integration Tests (Testcontainers)

Overview
- Uses testcontainers-node to spin ephemeral Postgres and Redis for end-to-end API tests.
- Supertest drives HTTP routes; Socket.IO client validates WebSocket side-effects.
- Prisma migrations run against the container DB before tests.

Prereqs
- Docker available locally or in CI runner.
- Node 18+, pnpm installed.

Install dev deps
```
pnpm -C packages/server i -D testcontainers pg
```

Run integration tests locally
```
# Only run container-backed integration tests
USE_TESTCONTAINERS=true pnpm -C packages/server test:int

# Or run the full server test suite (unit + e2e + integration) if desired
USE_TESTCONTAINERS=true pnpm -C packages/server test
```

What gets tested
- REST round-trip: create village → fetch by id using the containerized DB.
- WebSocket: join agent room, POST /api/agents/:id/start, observe agent_update/work_stream.

Isolation & teardown
- Each file starts its own containers, sets DATABASE_URL/REDIS_URL, and stops containers in afterAll.
- Prisma client disconnects on teardown; Socket.IO server and workers are shut down.

CI tips
- Gate container tests behind USE_TESTCONTAINERS=true to keep unit tests fast by default.
- Run in a dedicated job with Docker available. Example GitHub Actions step:
```
- name: Integration tests
  run: USE_TESTCONTAINERS=true pnpm -C packages/server test:int
```
- For parallelization, split test files across matrix entries; each will manage its own isolated containers.

