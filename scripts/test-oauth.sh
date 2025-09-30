#!/bin/bash

echo "Testing OAuth Flow..."
echo "===================="
echo ""

# Test 1: Backend Health
echo "1. Testing backend health..."
curl -s https://backend-production-6a6e4.up.railway.app/healthz | jq . || echo "Backend health check response"
echo ""

# Test 2: Check if OAuth login endpoint works
echo "2. Testing OAuth login redirect..."
curl -s -I -L --max-redirs 0 https://backend-production-6a6e4.up.railway.app/auth/login | head -20
echo ""

# Test 3: Check frontend
echo "3. Testing frontend..."
curl -s -I https://ai-agent-village-monitor-vuplicity.vercel.app | head -10
echo ""

echo "===================="
echo "OAuth Test Complete"
echo ""
echo "To fully test:"
echo "1. Open: https://ai-agent-village-monitor-vuplicity.vercel.app"
echo "2. Click 'Login with GitHub'"
echo "3. Authorize the app"
echo "4. Check if you're logged in successfully"