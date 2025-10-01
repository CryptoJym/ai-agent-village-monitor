#!/bin/bash

echo "Running Prisma migrations on Railway..."
echo "======================================="
echo ""

# Navigate to server directory
cd packages/server

# Show current environment
echo "Environment: production"
echo "Service: backend"
echo ""

# Run migrations via Railway
echo "Executing migrations..."
railway run --service backend npx prisma migrate deploy

# Check migration status
echo ""
echo "Checking migration status..."
railway run --service backend npx prisma migrate status

echo ""
echo "======================================="
echo "Migration script complete"