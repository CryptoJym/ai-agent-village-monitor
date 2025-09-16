-- CreateTable
CREATE TABLE "bug_bots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "villageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "repoId" TEXT,
    "issueId" TEXT NOT NULL,
    "issueNumber" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "severity" TEXT,
    "assignedAgentId" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "x" REAL,
    "y" REAL
);

-- CreateIndex
CREATE INDEX "idx_village" ON "bug_bots"("villageId");

-- CreateIndex
CREATE UNIQUE INDEX "bug_bots_provider_issueId_key" ON "bug_bots"("provider", "issueId");
