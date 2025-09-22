#!/bin/bash

# AI Agent Village Monitor - Post-Deployment Setup Script
# Run this after the initial deployment is complete

set -e

echo "🔧 Running post-deployment setup..."

# Generate Prisma client
echo "📦 Generating Prisma client..."
railway run pnpm --filter @ai-agent-village-monitor/server prisma:generate

# Run database migrations
echo "🗄️  Running database migrations..."
railway run pnpm --filter @ai-agent-village-monitor/server db:migrate

# Optional: Seed the database
read -p "Do you want to seed the database with initial data? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 Seeding database..."
    railway run pnpm --filter @ai-agent-village-monitor/server db:seed
fi

echo ""
echo "✅ Post-deployment setup complete!"
echo ""
echo "📋 Final steps:"
echo "   1. Get your Railway service URL from the dashboard"
echo "   2. Update these environment variables in Railway:"
echo "      - PUBLIC_SERVER_URL=https://your-service.up.railway.app"
echo "      - OAUTH_REDIRECT_URI=https://your-service.up.railway.app/auth/github/callback"
echo "   3. Configure GitHub App webhook URL:"
echo "      - Webhook URL: https://your-service.up.railway.app/api/webhooks/github"
echo "   4. Test the deployment with:"
echo "      curl -X GET https://your-service.up.railway.app/health"
echo ""
