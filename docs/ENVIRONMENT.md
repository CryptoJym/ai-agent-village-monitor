# Environment Variables and Configuration

This project uses environment variables for configuration. Create a `.env` at the repo root (copy from `.env.example`) and set values accordingly.

## Required/Recommended

- `PORT` (server) — default `3000`.
- `DATABASE_URL` — SQLite path `file:./packages/server/prisma/dev.db` for local, or a Postgres URL in production.
- `JWT_SECRET` — secret for signing/verifying JWTs (WebSocket and any protected routes).

## Optional

- `REDIS_URL` — enables background queues and rate limiting (future). Example: `redis://localhost:6379`.
- `GITHUB_TOKENS` — comma-separated GitHub tokens to increase API quotas.

## AI Provider Keys (for Task Master / MCP usage)

Set at least one of:

- `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `XAI_API_KEY`, `AZURE_OPENAI_API_KEY`, `OLLAMA_API_KEY`.

See `.env.example` for more details.

