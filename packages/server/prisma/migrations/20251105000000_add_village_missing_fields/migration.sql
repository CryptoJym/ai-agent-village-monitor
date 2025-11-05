-- Add missing fields to Village model
ALTER TABLE "public"."Village" ADD COLUMN "name" TEXT;
ALTER TABLE "public"."Village" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "public"."Village" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."Village" ADD COLUMN "lastSynced" TIMESTAMP(3);

-- Backfill name from orgName for existing villages
UPDATE "public"."Village" SET "name" = "orgName" WHERE "name" IS NULL;

-- Make name NOT NULL after backfilling
ALTER TABLE "public"."Village" ALTER COLUMN "name" SET NOT NULL;

-- Add foreign key for ownerId
ALTER TABLE "public"."Village" ADD CONSTRAINT "Village_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add index for ownerId lookups
CREATE INDEX "Village_ownerId_idx" ON "public"."Village"("ownerId");

-- Add grantedAt to VillageAccess
ALTER TABLE "public"."VillageAccess" ADD COLUMN "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
