#!/bin/bash

# Fix OAuth Environment Variables
echo "========================================="
echo "Fixing OAuth Environment Variables"
echo "========================================="
echo ""

# OAuth credentials from the GitHub app
CLIENT_ID="Iv23lisWjMXr1REc3c5M"
CLIENT_SECRET="6e9d235a487ef824f5b835eb9d881d4833f7d0a0"

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "k9Xm2Qp7Nw4Rd8Tz3Lv6Jh1Bc5Fg0Ys")
SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "xR8Tz3Lv6Jh1Bc5Fg0Ysk9Xm2Qp7Nw4d")

echo "Adding OAuth environment variables to Vercel Production..."
echo ""

# Remove existing variables first (if any)
echo "Removing any existing OAuth variables..."
vercel env rm GITHUB_OAUTH_CLIENT_ID production --yes 2>/dev/null || true
vercel env rm GITHUB_OAUTH_CLIENT_SECRET production --yes 2>/dev/null || true
vercel env rm VITE_GITHUB_CLIENT_ID production --yes 2>/dev/null || true
vercel env rm JWT_SECRET production --yes 2>/dev/null || true
vercel env rm SESSION_SECRET production --yes 2>/dev/null || true
vercel env rm FRONTEND_URL production --yes 2>/dev/null || true

echo ""
echo "Adding new OAuth variables..."

# Add all required environment variables
echo -n "$CLIENT_ID" | vercel env add GITHUB_OAUTH_CLIENT_ID production
echo -n "$CLIENT_ID" | vercel env add VITE_GITHUB_CLIENT_ID production
echo -n "$CLIENT_SECRET" | vercel env add GITHUB_OAUTH_CLIENT_SECRET production
echo -n "$JWT_SECRET" | vercel env add JWT_SECRET production
echo -n "$SESSION_SECRET" | vercel env add SESSION_SECRET production
echo -n "https://ai-agent-village-monitor-vuplicity.vercel.app" | vercel env add FRONTEND_URL production

echo ""
echo "Verifying variables were added..."
vercel env ls production 2>/dev/null | grep -E "(GITHUB|JWT|SESSION|FRONTEND)" || echo "No OAuth variables found!"

echo ""
echo "========================================="
echo "Environment variables fixed!"
echo "Now run: vercel deploy --prod --yes"
echo "========================================="