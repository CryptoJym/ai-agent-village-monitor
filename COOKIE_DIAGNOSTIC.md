# Cookie Diagnostic Steps

## Browser Cookie Check

### 1. Check Cookie Settings in Chrome
1. Go to Settings → Privacy and security → Cookies and other site data
2. Make sure you're NOT blocking third-party cookies
3. Add these sites to "Always allow cookies":
   - `[*.]vercel.app`
   - `[*.]railway.app`
   - `github.com`

### 2. Check Current Cookies
1. Open DevTools (F12)
2. Go to Application tab → Cookies
3. Check cookies for:
   - `https://ai-agent-village-monitor-vuplicity.vercel.app`
   - `https://backend-production-6a6e4.up.railway.app`

### 3. Test Direct Backend Flow
Open a new incognito window and go directly to:
```
https://backend-production-6a6e4.up.railway.app/auth/login
```

In DevTools Network tab, look for:
1. `/auth/login` request - should set cookies with `SameSite=None`
2. After GitHub auth, `/auth/github/callback` - check if cookies are sent

### 4. Manual Cookie Test
In browser console, run:
```javascript
// Check if cookies are enabled
navigator.cookieEnabled

// Try to set a test cookie
document.cookie = "test=value; SameSite=None; Secure";
document.cookie
```

## What's Likely Happening

Based on the error, one of these is occurring:

1. **Browser blocking third-party cookies** - Chrome/Safari may block SameSite=None cookies
2. **Cookie not being set** - The Set-Cookie header might be ignored
3. **Cookie not being sent back** - Browser not including cookie in callback request
4. **JWT_SECRET mismatch** - Railway might not have the correct secret

## Quick Fix Attempts

### Option 1: Browser Settings
- Chrome: Settings → Privacy → Allow all cookies
- Safari: Preferences → Privacy → Uncheck "Prevent cross-site tracking"

### Option 2: Try Different Browser
- Firefox tends to be more permissive with cross-domain cookies
- Edge might work if Chrome doesn't

### Option 3: Direct Backend Test
Skip the frontend entirely:
1. Go to: `https://backend-production-6a6e4.up.railway.app/auth/login`
2. Complete GitHub auth
3. You should be redirected to the frontend logged in

## Server-Side Issues to Check

The Railway logs should now show debug output like:
```
OAuth callback debug: {
  hasCode: true,
  hasState: true,
  hasCookieState: false,  // <-- This would be the problem
  stateMatch: false,
  cookies: [],
  signedCookies: []
}
```

This will tell us exactly what's missing.