#!/bin/bash

echo "Pushing Prisma schema to Railway database"
echo "=========================================="
echo ""
echo "This will sync the database schema with schema.prisma"
echo "without using migrations (good for fixing schema drift)"
echo ""

cd packages/server

echo "Running prisma db push..."
railway run --service backend npx prisma db push --accept-data-loss

echo ""
echo "Generating Prisma Client..."
railway run --service backend npx prisma generate

echo ""
echo "=========================================="
echo "Schema push complete!"
echo ""
echo "Test the OAuth flow at:"
echo "https://backend-production-6a6e4.up.railway.app/auth/login"