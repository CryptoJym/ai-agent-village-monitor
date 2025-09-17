-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."BugStatus" AS ENUM ('open', 'assigned', 'in_progress', 'resolved');

-- CreateEnum
CREATE TYPE "public"."BugSeverity" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "public"."bug_bots" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "repoId" TEXT,
    "issueId" TEXT NOT NULL,
    "issueNumber" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "status" "public"."BugStatus" NOT NULL DEFAULT 'open',
    "severity" "public"."BugSeverity",
    "assignedAgentId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,

    CONSTRAINT "bug_bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" CITEXT,
    "githubId" BIGINT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Village" (
    "id" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "githubOrgId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "config" JSONB,

    CONSTRAINT "Village_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."House" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "githubRepoId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "config" JSONB,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentSession" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "state" TEXT,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkStreamEvent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkStreamEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VillageAccess" (
    "villageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',

    CONSTRAINT "VillageAccess_pkey" PRIMARY KEY ("villageId","userId")
);

-- CreateTable
CREATE TABLE "public"."oauth_tokens" (
    "id" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "scopes" TEXT,
    "encCiphertext" BYTEA NOT NULL,
    "encIv" BYTEA NOT NULL,
    "encTag" BYTEA NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_village" ON "public"."bug_bots"("villageId");

-- CreateIndex
CREATE UNIQUE INDEX "bug_bots_provider_issueId_key" ON "public"."bug_bots"("provider", "issueId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "public"."User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "Village_githubOrgId_key" ON "public"."Village"("githubOrgId");

-- CreateIndex
CREATE INDEX "Village_orgName_idx" ON "public"."Village"("orgName");

-- CreateIndex
CREATE UNIQUE INDEX "House_githubRepoId_key" ON "public"."House"("githubRepoId");

-- CreateIndex
CREATE INDEX "House_villageId_idx" ON "public"."House"("villageId");

-- CreateIndex
CREATE INDEX "AgentSession_agentId_idx" ON "public"."AgentSession"("agentId");

-- CreateIndex
CREATE INDEX "WorkStreamEvent_agentId_idx" ON "public"."WorkStreamEvent"("agentId");

-- CreateIndex
CREATE INDEX "WorkStreamEvent_ts_idx" ON "public"."WorkStreamEvent"("ts");

-- CreateIndex
CREATE INDEX "VillageAccess_userId_idx" ON "public"."VillageAccess"("userId");

-- CreateIndex
CREATE INDEX "idx_provider" ON "public"."oauth_tokens"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_userKey_provider_key" ON "public"."oauth_tokens"("userKey", "provider");

-- AddForeignKey
ALTER TABLE "public"."bug_bots" ADD CONSTRAINT "bug_bots_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."House" ADD CONSTRAINT "House_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentSession" ADD CONSTRAINT "AgentSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkStreamEvent" ADD CONSTRAINT "WorkStreamEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VillageAccess" ADD CONSTRAINT "VillageAccess_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VillageAccess" ADD CONSTRAINT "VillageAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

