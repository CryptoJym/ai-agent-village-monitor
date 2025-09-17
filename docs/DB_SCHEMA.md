# Database Schema Reference

The server persists Bug Bots using Prisma when `DATABASE_URL` is set. Otherwise, an in-memory store is used.

## bug_bots

Columns:

- `id` TEXT (PK)
- `villageId` TEXT
- `provider` TEXT (e.g., `github`)
- `repoId` TEXT NULL
- `issueId` TEXT
- `issueNumber` INT NULL
- `title` TEXT NULL
- `description` TEXT NULL
- `status` ENUM(`open`, `assigned`, `in_progress`, `resolved`) DEFAULT `open`
- `severity` ENUM(`low`, `medium`, `high`) NULL
- `assignedAgentId` TEXT NULL
- `metadata` JSON NULL
- `createdAt` DATETIME
- `updatedAt` DATETIME
- `resolvedAt` DATETIME NULL
- `x` FLOAT NULL, `y` FLOAT NULL (last known screen position if relevant)

Indexes:

- `idx_village` on (`villageId`)
- Unique on (`provider`, `issueId`) to prevent duplicates per upstream issue

See `packages/server/prisma/schema.prisma` for canonical schema.

