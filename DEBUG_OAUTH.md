# OAuth State Error Debug Guide

## The Problem
Getting "Invalid OAuth state" error even after setting up environment variables on both Vercel and Railway.

## Root Cause Analysis

### Cookie Flow Issues
1. **Cookie Signing**: The backend signs cookies with `JWT_SECRET` (line 139 in app.ts)
2. **Cookie Setting**: Auth route sets signed cookies with 10-minute expiry (lines 49-54 in auth/routes.ts)
3. **Cookie Reading**: Callback tries to read signed cookies (lines 77-84 in auth/routes.ts)

### Potential Issues

#### 1. JWT_SECRET Mismatch
The cookie is signed with `JWT_SECRET` when set, but if the secret changes or doesn't match between requests, the cookie can't be verified.

**Check on Railway:**
- Ensure `JWT_SECRET` is exactly: `k9Xm2Qp7Nw4Rd8Tz3Lv6Jh1Bc5Fg0Ys`
- No extra spaces or quotes

#### 2. Cookie Domain Issues
Cookies might not be sent back due to domain mismatch:
- Frontend: `ai-agent-village-monitor-vuplicity.vercel.app`
- Backend: `backend-production-6a6e4.up.railway.app`

These are different domains, so cookies set by the backend won't be sent to the frontend by default.

#### 3. SameSite Cookie Policy
The cookies are set with `sameSite: 'lax'` which might block them in cross-domain redirects.

## Solutions to Try

### Solution 1: Verify Railway Environment
Check that Railway has EXACTLY these values (no quotes, no spaces):
```
GITHUB_OAUTH_CLIENT_ID=Iv23lisWjMXr1REc3c5M
GITHUB_OAUTH_CLIENT_SECRET=6e9d235a487ef824f5b835eb9d881d4833f7d0a0
JWT_SECRET=k9Xm2Qp7Nw4Rd8Tz3Lv6Jh1Bc5Fg0Ys
```

### Solution 2: Add SESSION_SECRET to Railway
The backend might need SESSION_SECRET for cookie signing:
```
SESSION_SECRET=xR8Tz3Lv6Jh1Bc5Fg0Ysk9Xm2Qp7Nw4d
```

### Solution 3: Set COOKIE_DOMAIN (if needed)
If cookies aren't being sent, you might need to set:
```
COOKIE_DOMAIN=.railway.app
```

### Solution 4: Debug with Browser DevTools
1. Open DevTools → Network tab
2. Clear all cookies for both domains
3. Start OAuth flow
4. Look for the `/auth/login` request
5. Check Response Headers for `Set-Cookie`
6. When redirected back, check if `Cookie` header includes `oauth_state`

### What Should Happen
1. `/auth/login` sets cookies:
   - `oauth_state` (signed, 10 min expiry)
   - `oauth_verifier` (signed, 10 min expiry)
2. GitHub redirects to `/auth/github/callback?code=XXX&state=YYY`
3. Backend reads `oauth_state` cookie and compares with `state` parameter
4. If they match, OAuth continues; if not, "Invalid OAuth state" error

## Quick Test
Try this in an incognito window:
1. Go to https://backend-production-6a6e4.up.railway.app/auth/login directly
2. This should redirect you to GitHub
3. After authorizing, check if you get the error
4. If yes, the issue is definitely with Railway backend configuration

## Emergency Fix
If nothing else works, the backend code might need adjustment to handle cross-domain cookies better. This would require modifying the cookie options in the backend code.