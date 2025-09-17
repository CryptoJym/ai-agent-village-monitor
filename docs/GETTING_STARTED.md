# Getting Started

## Prerequisites

- Node.js 18+ and pnpm 9+
- GitHub token (optional, for higher API limits)

## Setup

1. Clone repo and install deps:
   - `pnpm install`
2. Copy `.env.example` → `.env` and set variables (see `docs/ENVIRONMENT.md`).
3. Optional DB (SQLite):
   - `cd packages/server && export DATABASE_URL="file:./dev.db" && pnpm prisma:generate && pnpm db:migrate`

## Run

- Dev (concurrently): `pnpm dev` (root script starts server/frontend in parallel if configured)
- Or run explicitly:
  - Server: `pnpm -C packages/server dev`
  - Frontend: `pnpm -C packages/frontend dev` (default http://localhost:5173)

Open http://localhost:5173 and verify the village scene renders. The server runs on http://localhost:3000.

## Tests

- Server tests: `pnpm -C packages/server test`
- Frontend unit tests: `pnpm -C packages/frontend test`

## API Docs

- OpenAPI JSON: `GET http://localhost:3000/api/openapi.json`
- Swagger UI: `GET http://localhost:3000/api/docs`

