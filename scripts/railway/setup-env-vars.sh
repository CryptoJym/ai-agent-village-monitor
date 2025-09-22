#!/bin/bash

# AI Agent Village Monitor - Railway Environment Variables Setup
# This script helps set up all required environment variables

set -e

echo "⚙️  Setting up Railway environment variables..."

# Function to prompt for variable if not provided
prompt_for_var() {
    local var_name=$1
    local description=$2
    local is_secret=${3:-false}
    
    if [ -z "${!var_name}" ]; then
        echo ""
        echo "📝 $description"
        if [ "$is_secret" = true ]; then
            read -s -p "Enter $var_name: " var_value
            echo ""
        else
            read -p "Enter $var_name: " var_value
        fi
        export $var_name="$var_value"
    fi
}

# Core application settings (already set by deploy script)
echo "✅ Core settings (NODE_ENV, PORT, etc.) should already be set"

# GitHub OAuth settings
prompt_for_var "GITHUB_OAUTH_CLIENT_ID" "GitHub OAuth Client ID (from your GitHub App)"
prompt_for_var "GITHUB_OAUTH_CLIENT_SECRET" "GitHub OAuth Client Secret (from your GitHub App)" true

# GitHub App settings
prompt_for_var "GITHUB_APP_ID" "GitHub App ID (numeric ID from your GitHub App)"
prompt_for_var "WEBHOOK_SECRET" "GitHub Webhook Secret (set in your GitHub App)" true

# GitHub Private Key (multiline)
if [ -z "$GITHUB_PRIVATE_KEY" ]; then
    echo ""
    echo "📝 GitHub Private Key (PEM content)"
    echo "Paste your GitHub App private key (including -----BEGIN/END----- lines):"
    echo "Press Ctrl+D when finished:"
    GITHUB_PRIVATE_KEY=$(cat)
fi

# Public URLs (will be updated after deployment)
RAILWAY_SERVICE_URL="https://your-service.up.railway.app"
prompt_for_var "PUBLIC_APP_URL" "Frontend URL (where your frontend is hosted)"

# Set all variables in Railway
echo ""
echo "🚀 Setting variables in Railway..."

railway variables set GITHUB_OAUTH_CLIENT_ID="$GITHUB_OAUTH_CLIENT_ID"
railway variables set GITHUB_OAUTH_CLIENT_SECRET="$GITHUB_OAUTH_CLIENT_SECRET"
railway variables set GITHUB_APP_ID="$GITHUB_APP_ID"
railway variables set WEBHOOK_SECRET="$WEBHOOK_SECRET"
railway variables set GITHUB_PRIVATE_KEY="$GITHUB_PRIVATE_KEY"
railway variables set PUBLIC_APP_URL="$PUBLIC_APP_URL"

# These will need to be updated after deployment
railway variables set PUBLIC_SERVER_URL="$RAILWAY_SERVICE_URL"
railway variables set OAUTH_REDIRECT_URI="$RAILWAY_SERVICE_URL/auth/github/callback"

# Optional variables
read -p "Do you want to set optional GitHub tokens (PATs)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    prompt_for_var "GITHUB_TOKENS" "Comma-separated GitHub Personal Access Tokens (fallback)" true
    railway variables set GITHUB_TOKENS="$GITHUB_TOKENS"
fi

echo ""
echo "✅ Environment variables configured!"
echo ""
echo "⚠️  IMPORTANT: After deployment completes, you MUST:"
echo "   1. Get your actual Railway service URL"
echo "   2. Update PUBLIC_SERVER_URL and OAUTH_REDIRECT_URI with the real URL"
echo "   3. Configure your GitHub App webhook URL to point to your Railway service"
echo ""
