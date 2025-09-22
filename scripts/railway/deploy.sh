#!/bin/bash

# AI Agent Village Monitor - Railway Deployment Script
# This script automates the Railway deployment process

set -e

echo "🚀 Starting Railway deployment for AI Agent Village Monitor..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if user is logged in to Railway
if ! railway whoami &> /dev/null; then
    echo "🔐 Please log in to Railway..."
    railway login
fi

# Initialize Railway project if not already done
if [ ! -f ".railway" ]; then
    echo "📝 Initializing Railway project..."
    railway init
fi

# Add PostgreSQL plugin
echo "🗄️  Adding PostgreSQL database..."
railway add --plugin postgresql

# Add Redis plugin
echo "🔴 Adding Redis cache..."
railway add --plugin redis

# Set environment variables (user will need to update these)
echo "⚙️  Setting up environment variables..."

# Core application settings
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set PNPM_VERSION=9
railway variables set NIXPACKS_NODE_VERSION=20

# Generate and set JWT secret
JWT_SECRET=$(openssl rand -base64 32)
railway variables set JWT_SECRET="$JWT_SECRET"
echo "✅ Generated JWT_SECRET: $JWT_SECRET"

echo ""
echo "⚠️  IMPORTANT: You still need to provide these values (use scripts/railway/setup-env-vars.sh):"
echo "   - GITHUB_OAUTH_CLIENT_ID"
echo "   - GITHUB_OAUTH_CLIENT_SECRET"
echo "   - GITHUB_APP_ID"
echo "   - GITHUB_PRIVATE_KEY"
echo "   - WEBHOOK_SECRET"
echo "   - PUBLIC_SERVER_URL (fill in once Railway assigns a domain)"
echo "   - PUBLIC_APP_URL (your frontend URL)"
echo ""

# Deploy the application
echo "🚀 Deploying application..."
railway up

echo ""
echo "✅ Deployment initiated! Check Railway dashboard for progress."
echo "📋 Next steps:"
echo "   1. Wait for deployment to complete"
echo "   2. Get your Railway service URL from the dashboard"
echo "   3. Update PUBLIC_SERVER_URL and OAUTH_REDIRECT_URI variables"
echo "   4. Run database migrations (see scripts/railway/post-deploy.sh)"
echo "   5. Configure GitHub App webhook URL"
