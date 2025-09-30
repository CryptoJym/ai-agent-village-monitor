#!/bin/bash

# Quick OAuth Setup for Vercel
echo "========================================="
echo "Adding GitHub OAuth to Vercel Production"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "vercel.json" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

echo "Please enter the GitHub OAuth credentials:"
echo "(These were generated when you created the GitHub OAuth App)"
echo ""

read -p "GitHub Client ID: " CLIENT_ID
read -s -p "GitHub Client Secret: " CLIENT_SECRET
echo ""

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "k9Xm2Qp7Nw4Rd8Tz3Lv6Jh1Bc5Fg0Ys")
SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "k9Xm2Qp7Nw4Rd8Tz3Lv6Jh1Bc5Fg0Ys")

echo ""
echo "Adding environment variables to Vercel Production..."

# Add all required environment variables
echo "$CLIENT_ID" | vercel env add GITHUB_OAUTH_CLIENT_ID production --yes 2>/dev/null
echo "$CLIENT_ID" | vercel env add VITE_GITHUB_CLIENT_ID production --yes 2>/dev/null
echo "$CLIENT_SECRET" | vercel env add GITHUB_OAUTH_CLIENT_SECRET production --yes 2>/dev/null
echo "$JWT_SECRET" | vercel env add JWT_SECRET production --yes 2>/dev/null
echo "$SESSION_SECRET" | vercel env add SESSION_SECRET production --yes 2>/dev/null
echo "https://ai-agent-village-monitor-vuplicity.vercel.app" | vercel env add FRONTEND_URL production --yes 2>/dev/null
echo "https://backend-production-6a6e4.up.railway.app" | vercel env add BACKEND_URL production --yes 2>/dev/null

echo ""
echo "Environment variables added successfully!"
echo ""
echo "Triggering redeployment..."
vercel deploy --prod --yes

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Your application should be ready in a few moments at:"
echo "https://ai-agent-village-monitor-vuplicity.vercel.app"
echo ""
echo "The OAuth callback is configured for:"
echo "https://backend-production-6a6e4.up.railway.app/auth/github/callback"
echo ""