FROM node:20-slim

# Install pnpm globally without Corepack and required system deps
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@9.12.1 && pnpm config set store-dir /root/.pnpm-store

WORKDIR /app

# Copy manifests first for better caching
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages/frontend/package.json packages/frontend/
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/

# Install deps
RUN pnpm config set verify-store-integrity false \
    && pnpm install --frozen-lockfile --ignore-scripts

# Copy the rest of the repo
COPY . .

# Generate Prisma client and build server package
RUN pnpm --filter @ai-agent-village-monitor/server prisma:generate \
    && pnpm --filter @ai-agent-village-monitor/server build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run migrations and then start the server
CMD pnpm --filter @ai-agent-village-monitor/server exec prisma migrate deploy && pnpm --filter @ai-agent-village-monitor/server start
