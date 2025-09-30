# Railway Backend Environment Variables Setup

## Critical Issue Found
The OAuth "invalid auth state" error is occurring because the **backend on Railway** doesn't have the required environment variables. While we added them to Vercel (frontend), the actual OAuth handling happens on the Railway backend.

## Required Railway Environment Variables

You need to add these environment variables to your Railway backend deployment:

### OAuth Credentials (from GitHub OAuth App)
```
GITHUB_OAUTH_CLIENT_ID=Iv23lisWjMXr1REc3c5M
GITHUB_OAUTH_CLIENT_SECRET=6e9d235a487ef824f5b835eb9d881d4833f7d0a0
```

### Security Secrets (generate new ones or use these)
```
JWT_SECRET=k9Xm2Qp7Nw4Rd8Tz3Lv6Jh1Bc5Fg0Ys
SESSION_SECRET=xR8Tz3Lv6Jh1Bc5Fg0Ysk9Xm2Qp7Nw4d
```

### URLs
```
PUBLIC_SERVER_URL=https://backend-production-6a6e4.up.railway.app
PUBLIC_APP_URL=https://ai-agent-village-monitor-vuplicity.vercel.app
FRONTEND_URL=https://ai-agent-village-monitor-vuplicity.vercel.app
```

### Optional but Recommended
```
GITHUB_TOKEN_SALT=generate-a-random-string-here
TOKEN_ENCRYPTION_KEY=generate-32-byte-hex-key-if-you-want-encryption
```

## How to Add to Railway

### Option 1: Railway Dashboard (Easiest)
1. Go to your Railway dashboard: https://railway.app/dashboard
2. Select your project
3. Click on the backend service
4. Go to the "Variables" tab
5. Add each variable above (click "Add Variable" for each)
6. Railway will automatically redeploy after adding variables

### Option 2: Railway CLI
```bash
# Install Railway CLI if you haven't
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Add variables one by one
railway variables set GITHUB_OAUTH_CLIENT_ID=Iv23lisWjMXr1REc3c5M
railway variables set GITHUB_OAUTH_CLIENT_SECRET=6e9d235a487ef824f5b835eb9d881d4833f7d0a0
railway variables set JWT_SECRET=k9Xm2Qp7Nw4Rd8Tz3Lv6Jh1Bc5Fg0Ys
railway variables set SESSION_SECRET=xR8Tz3Lv6Jh1Bc5Fg0Ysk9Xm2Qp7Nw4d
railway variables set PUBLIC_SERVER_URL=https://backend-production-6a6e4.up.railway.app
railway variables set PUBLIC_APP_URL=https://ai-agent-village-monitor-vuplicity.vercel.app
railway variables set FRONTEND_URL=https://ai-agent-village-monitor-vuplicity.vercel.app

# Deploy
railway up
```

## Why This Fixes the Issue

The OAuth flow works like this:
1. Frontend (Vercel) redirects user to `/auth/login` which proxies to Railway backend
2. Backend generates a state parameter and signs a cookie with `JWT_SECRET`
3. User authorizes on GitHub
4. GitHub redirects back to backend callback URL
5. Backend verifies the state from the cookie (needs `JWT_SECRET` to verify signature)
6. Backend exchanges code for token (needs `GITHUB_OAUTH_CLIENT_SECRET`)

Without these variables on Railway, the backend:
- Can't sign/verify cookies → "Invalid OAuth state" error
- Can't exchange OAuth codes → Authentication fails

## Verify It's Working

After adding the variables to Railway:
1. Wait for Railway to redeploy (usually takes 1-2 minutes)
2. Clear your browser cookies for the domain
3. Try logging in again at https://ai-agent-village-monitor-vuplicity.vercel.app

The OAuth flow should now work correctly!

## Troubleshooting

If it still doesn't work:
1. Check Railway logs for any errors
2. Ensure all variables are exactly as shown (no extra spaces)
3. Make sure the GitHub OAuth app callback URL is exactly:
   `https://backend-production-6a6e4.up.railway.app/auth/github/callback`
4. Try an incognito/private browser window to avoid cookie conflicts