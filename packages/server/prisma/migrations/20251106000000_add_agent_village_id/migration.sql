-- Add villageId to Agent model to enable proper authorization
-- This fixes the critical security issue where agents had no village association

-- Step 1: Add villageId column as nullable first (to handle existing agents)
ALTER TABLE "public"."Agent" ADD COLUMN "villageId" TEXT;

-- Step 2: Backfill villageId for existing agents
-- Strategy: Assign agents to their user's first owned village, or delete orphaned agents
-- Delete agents that have no userId or whose user has no villages
DELETE FROM "public"."Agent"
WHERE "userId" IS NULL
   OR "userId" NOT IN (SELECT "id" FROM "public"."User");

-- Assign remaining agents to their user's first village (by createdAt)
UPDATE "public"."Agent" a
SET "villageId" = (
  SELECT v."id"
  FROM "public"."Village" v
  WHERE v."ownerId" = a."userId"
  ORDER BY v."createdAt" ASC
  LIMIT 1
)
WHERE a."villageId" IS NULL AND a."userId" IS NOT NULL;

-- Delete any agents that still don't have a villageId (users with no villages)
DELETE FROM "public"."Agent" WHERE "villageId" IS NULL;

-- Step 3: Make villageId NOT NULL after backfilling
ALTER TABLE "public"."Agent" ALTER COLUMN "villageId" SET NOT NULL;

-- Step 4: Add foreign key constraint with CASCADE delete
ALTER TABLE "public"."Agent" ADD CONSTRAINT "Agent_villageId_fkey"
  FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Add index for villageId lookups (important for authorization queries)
CREATE INDEX "Agent_villageId_idx" ON "public"."Agent"("villageId");

-- Step 6: Add index for userId lookups if it doesn't exist
CREATE INDEX IF NOT EXISTS "Agent_userId_idx" ON "public"."Agent"("userId");
