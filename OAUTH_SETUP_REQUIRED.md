# ⚠️ GitHub OAuth Setup Required

The authentication error you're seeing is because the GitHub OAuth app needs to be created and configured.

## Quick Setup (2 minutes)

### Option 1: Manual Setup

1. **Create GitHub OAuth App** (1 minute)
   - Go to: https://github.com/settings/developers
   - Click "OAuth Apps" → "New OAuth App"
   - Copy and paste these values:
   ```
   Application name: AI Agent Village Monitor Beta
   Homepage URL: https://ai-agent-village-monitor-vuplicity.vercel.app
   Authorization callback URL: https://backend-production-6a6e4.up.railway.app/auth/github/callback
   ```
   - Click "Register application"

2. **Get Credentials** (30 seconds)
   - Copy the **Client ID** shown on the page
   - Click "Generate a new client secret"
   - Copy the **Client Secret** (⚠️ save it now, you can't see it again!)

3. **Run Setup Script** (30 seconds)
   ```bash
   ./scripts/setup-oauth.sh
   ```
   - Paste your Client ID when prompted
   - Paste your Client Secret when prompted
   - The script will automatically deploy with the new credentials

### Option 2: Direct Vercel Setup

If you prefer to set it up directly in Vercel:

1. Create the GitHub OAuth App (same as step 1 above)

2. Go to: https://vercel.com/vuplicity/ai-agent-village-monitor-vuplicity/settings/environment-variables

3. Add these Production environment variables:
   ```
   GITHUB_OAUTH_CLIENT_ID = [your-client-id]
   GITHUB_OAUTH_CLIENT_SECRET = [your-client-secret]
   VITE_GITHUB_CLIENT_ID = [your-client-id]
   JWT_SECRET = k9Xm2Qp7Nw4Rd8Tz3Lv6Jh1Bc5Fg0Ys
   SESSION_SECRET = k9Xm2Qp7Nw4Rd8Tz3Lv6Jh1Bc5Fg0Ys
   FRONTEND_URL = https://ai-agent-village-monitor-vuplicity.vercel.app
   ```

4. Redeploy:
   ```bash
   vercel deploy --prod
   ```

## Why This Is Happening

The error "invalid auth state" occurs because:
- The backend server needs GitHub OAuth credentials to validate login attempts
- These credentials must match between GitHub and your deployed application
- The callback URL must exactly match what's configured in GitHub

Once you complete either option above, authentication will work immediately.

## Need Help?

If you encounter any issues:
1. Double-check the callback URL is exactly: `https://backend-production-6a6e4.up.railway.app/auth/github/callback`
2. Ensure you're adding variables to the Production environment in Vercel
3. Wait 30 seconds after deploying for changes to propagate

The whole process takes less than 2 minutes and you'll be able to log in immediately after!