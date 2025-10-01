#!/bin/bash

echo "Direct Database Fix for P2022 Error"
echo "===================================="
echo ""
echo "This script will connect directly to the Railway PostgreSQL database"
echo "and ensure the schema matches what Prisma expects."
echo ""

# Run this SQL via Railway's psql
railway run --service backend psql "$DATABASE_URL" << 'EOF'

-- Check current User table schema
\d "User";

-- If columns are missing, add them
DO $$
BEGIN
    -- Check and add githubId if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'githubId'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "githubId" BIGINT UNIQUE;
        RAISE NOTICE 'Added githubId column';
    END IF;

    -- Check and add accessTokenHash if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'accessTokenHash'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "accessTokenHash" TEXT;
        RAISE NOTICE 'Added accessTokenHash column';
    END IF;

    -- Check and add username if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'username'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "username" TEXT UNIQUE;
        RAISE NOTICE 'Added username column';
    END IF;

    -- Check and add avatarUrl if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'avatarUrl'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
        RAISE NOTICE 'Added avatarUrl column';
    END IF;
END $$;

-- Show updated schema
\d "User";

-- Check if migrations table exists
SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;

EOF

echo ""
echo "===================================="
echo "Database fix script complete"
echo ""
echo "Now try logging in again at:"
echo "https://backend-production-6a6e4.up.railway.app/auth/login"