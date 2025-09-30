#!/bin/bash

# GitHub OAuth Setup Script for AI Agent Village Monitor
# This script helps you set up the required environment variables

echo "========================================="
echo "GitHub OAuth Setup for AI Agent Village Monitor"
echo "========================================="
echo ""
echo "STEP 1: Create a GitHub OAuth App"
echo "---------------------------------"
echo "1. Go to: https://github.com/settings/developers"
echo "2. Click 'OAuth Apps' → 'New OAuth App'"
echo "3. Fill in these EXACT values:"
echo ""
echo "   Application name: AI Agent Village Monitor Beta"
echo "   Homepage URL: https://ai-agent-village-monitor-vuplicity.vercel.app"
echo "   Authorization callback URL: https://backend-production-6a6e4.up.railway.app/auth/github/callback"
echo "   Description: Visual control center for AI development workflows"
echo ""
echo "4. Click 'Register application'"
echo "5. Copy the Client ID"
echo "6. Click 'Generate a new client secret' and copy it"
echo ""
echo "Press Enter when you have completed these steps..."
read

echo ""
echo "STEP 2: Enter Your Credentials"
echo "------------------------------"
echo "Please enter the values from your GitHub OAuth App:"
echo ""

read -p "GitHub Client ID: " CLIENT_ID
read -s -p "GitHub Client Secret: " CLIENT_SECRET
echo ""

# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo ""
echo "Generated JWT Secret: $JWT_SECRET"
echo ""

echo "STEP 3: Adding to Vercel"
echo "------------------------"
echo "Adding environment variables to Vercel..."

# Add GitHub OAuth Client ID
echo "$CLIENT_ID" | vercel env add GITHUB_OAUTH_CLIENT_ID production
echo "$CLIENT_ID" | vercel env add VITE_GITHUB_CLIENT_ID production

# Add GitHub OAuth Client Secret
echo "$CLIENT_SECRET" | vercel env add GITHUB_OAUTH_CLIENT_SECRET production

# Add JWT Secret
echo "$JWT_SECRET" | vercel env add JWT_SECRET production

# Add Frontend URL
echo "https://ai-agent-village-monitor-vuplicity.vercel.app" | vercel env add FRONTEND_URL production

# Add Session Secret (same as JWT for consistency)
echo "$JWT_SECRET" | vercel env add SESSION_SECRET production

echo ""
echo "STEP 4: Redeploying"
echo "-------------------"
echo "Triggering a new deployment with updated environment variables..."
vercel deploy --prod

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Your GitHub OAuth app is configured and the application has been redeployed."
echo "You can now log in at: https://ai-agent-village-monitor-vuplicity.vercel.app"
echo ""
echo "If you need to update these values later, go to:"
echo "https://vercel.com/vuplicity/ai-agent-village-monitor-vuplicity/settings/environment-variables"
echo ""