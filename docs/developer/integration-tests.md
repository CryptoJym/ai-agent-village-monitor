# Developer Guide: Running Integration Tests Locally

This guide explains how to run and debug the backend integration tests locally using Docker. It complements the server notes in `packages/server/docs/INTEGRATION_TESTS.md`.

## Prerequisites

- Node.js 18+
- pnpm installed
- Docker Desktop or a Docker daemon available

## Option A: Testcontainers (recommended)

Testcontainers spins ephemeral Postgres/Redis containers just for the test process and tears them down automatically.

Commands:

```
# Only container-backed integration tests
USE_TESTCONTAINERS=true pnpm -C packages/server test:int

# Or the full server suite (unit + e2e + integration)
USE_TESTCONTAINERS=true pnpm -C packages/server test
```

Notes:

- The tests will create containers, run Prisma migrations, then execute Supertest/Socket.IO flows.
- Each file manages its own containers; parallel runs are safe.
- See `packages/server/docs/INTEGRATION_TESTS.md` for more details.

## Option B: Docker Compose (manual Postgres/Redis)

If you’d rather run services yourself, use a minimal Docker Compose file:

```yaml
# docker-compose.yml (example)
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: agent_village_test
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 3s
      timeout: 5s
      retries: 10
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 3s
      timeout: 5s
      retries: 10
```

Then:

```
docker compose up -d postgres redis

# Example env (adjust DB name if needed)
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agent_village_test?schema=public
export REDIS_URL=redis://localhost:6379

# Run integration tests against your local services
pnpm -C packages/server test:int
```

## Running individual tests & debugging

```
# Single file
USE_TESTCONTAINERS=true pnpm -C packages/server vitest run packages/server/src/__tests__/integration.test.ts

# Watch mode (unit/dev)
pnpm -C packages/server vitest

# Verbose + filtered by name
USE_TESTCONTAINERS=true pnpm -C packages/server vitest run --reporter=verbose -t "village"
```

Container logs:

```
docker compose logs -f postgres

docker compose logs -f redis
```

## WebSocket tests

- WS integration may be skipped by default to keep CI stable; unskip when running locally.
- Ensure no port conflicts; when using Testcontainers, tests run server on a random port.

## Troubleshooting

- Docker permission errors: ensure your user can access the Docker socket and Docker Desktop is running.
- Prisma migration failures: double-check `TEST_DATABASE_URL` and that Postgres is healthy.
- Port conflicts: stop locally running Postgres/Redis (brew services, other projects) or change published ports in Compose.
- Mac networking quirks: use `localhost` (not `host.docker.internal`) unless otherwise configured.
- EPERM in CI: run container-backed tests only where Docker is available.

## References

- packages/server/docs/INTEGRATION_TESTS.md
- docs/STAGING.md
- docs/DEPLOYMENT.md
