import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from '../config';
import { prisma } from '../db/client';
import { audit } from '../audit/logger';
import { pkceChallengeFromVerifier, randomString, sha256Hex } from './utils';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from './jwt';
import { saveProviderToken } from './tokenStore';

const router = express.Router();
router.use(cookieParser());

// Ephemeral in-memory refresh token store for MVP
// Maps userId -> hashed current refresh token
const refreshStore = new Map<string, string>();

function cookieOptions(days = 30) {
  const isProd = config.NODE_ENV === 'production';
  const maxAge = days * 24 * 60 * 60 * 1000;
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
    // Use domain if provided to allow cross-subdomain cookies in prod
    domain: config.COOKIE_DOMAIN || undefined,
  };
}

function getRedirectUri() {
  if (config.OAUTH_REDIRECT_URI) return config.OAUTH_REDIRECT_URI;
  const host = config.PUBLIC_SERVER_URL || `http://localhost:${config.PORT}`;
  return `${host}/auth/github/callback`;
}

router.get('/auth/login', async (req, res) => {
  const clientId = config.GITHUB_OAUTH_CLIENT_ID;
  const secret = config.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !secret) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }
  // Generate state and PKCE
  const state = randomString(16);
  const codeVerifier = randomString(32);
  const codeChallenge = pkceChallengeFromVerifier(codeVerifier);

  // Set temporary cookies for state and verifier
  res.cookie('oauth_state', state, { ...cookieOptions(1), maxAge: 10 * 60 * 1000, signed: true });
  res.cookie('oauth_verifier', codeVerifier, {
    ...cookieOptions(1),
    maxAge: 10 * 60 * 1000,
    signed: true,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: config.OAUTH_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, url);
});

router.get('/auth/github/callback', async (req, res, next) => {
  try {
    const clientId = config.GITHUB_OAUTH_CLIENT_ID;
    const secret = config.GITHUB_OAUTH_CLIENT_SECRET;
    if (!clientId || !secret) return res.status(500).json({ error: 'GitHub OAuth not configured' });

    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const cookieState = String(
      (req.signedCookies?.oauth_state as string) || (req.cookies?.oauth_state as string) || '',
    );
    const verifier = String(
      (req.signedCookies?.oauth_verifier as string) ||
        (req.cookies?.oauth_verifier as string) ||
        '',
    );
    if (!code || !state || !cookieState || state !== cookieState) {
      return res.status(400).json({ error: 'Invalid OAuth state' });
    }

    // Exchange code for token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: secret,
        code,
        redirect_uri: getRedirectUri(),
        code_verifier: verifier,
      }),
    });
    if (!tokenRes.ok) {
      // Do not leak upstream response details
      return res.status(502).json({ error: 'Token exchange failed' });
    }
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
    };
    const ghToken = tokenJson.access_token;
    if (!ghToken) return res.status(502).json({ error: 'No access token returned' });

    // Fetch user
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' },
    });
    if (!userRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch GitHub user' });
    }
    const user = (await userRes.json()) as { id: number; login: string; avatar_url?: string };

    // Upsert user
    const ghId = BigInt(user.id);
    const username = user.login;
    const avatar = user.avatar_url ?? null;
    const salt = config.GITHUB_TOKEN_SALT || config.JWT_SECRET || '';
    const tokenHash = sha256Hex(ghToken + salt); // salted sha256, no plaintext persistence

    const dbUser = await prisma.user.upsert({
      where: { githubId: ghId },
      update: { username, avatarUrl: avatar ?? undefined, accessTokenHash: tokenHash },
      create: { githubId: ghId, username, avatarUrl: avatar, accessTokenHash: tokenHash },
    });

    // Securely persist provider token (encrypted if TOKEN_ENCRYPTION_KEY is set, otherwise as hashed reference)
    try {
      await saveProviderToken({
        userKey: username,
        provider: 'github',
        token: ghToken,
        scopes: tokenJson.scope || undefined,
      });
    } catch {}

    // Issue JWTs and set cookies
    const access = signAccessToken(dbUser.id, dbUser.username);
    const refreshId = randomString(32);
    const refresh = signRefreshToken(dbUser.id, dbUser.username, refreshId);
    refreshStore.set(String(dbUser.id), sha256Hex(refreshId));

    res.cookie('access_token', access, {
      ...cookieOptions(1),
      maxAge: 60 * 60 * 1000,
      signed: true,
    });
    res.cookie('refresh_token', refresh, { ...cookieOptions(30), signed: true });

    // Audit (no PII beyond stable username/id)
    audit.log('auth.login', { actorId: String(dbUser.id), username: dbUser.username });

    // Clear temporary cookies
    res.clearCookie('oauth_state');
    res.clearCookie('oauth_verifier');

    // For MVP, redirect to frontend root
    const appUrl = config.PUBLIC_APP_URL || '/';
    const redirectTo = appUrl.endsWith('/') ? appUrl : `${appUrl}/`;
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, redirectTo);
  } catch (e) {
    next(e);
  }
});

router.get('/auth/me', async (req, res) => {
  const raw =
    (req.signedCookies?.access_token as string) || (req.cookies?.access_token as string) || '';
  if (!raw) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const payload = verifyAccessToken(raw);
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user || typeof (user as any).id !== 'number') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(401).json({ error: 'unauthorized' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ id: user.id, username: user.username, avatarUrl: user.avatarUrl });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(401).json({ error: 'unauthorized' });
  }
});

// Refresh endpoint: rotate refresh token and issue new access token
router.post('/auth/refresh', async (req, res) => {
  try {
    const raw =
      (req.signedCookies?.refresh_token as string) || (req.cookies?.refresh_token as string) || '';
    if (!raw) return res.status(401).json({ error: 'unauthorized' });

    // Validate refresh token and detect reuse via jti check
    const payload = verifyRefreshToken(raw);
    const userId = String(payload.sub || '');
    const providedJti = payload.jti || '';
    if (!userId || !providedJti) return res.status(401).json({ error: 'unauthorized' });

    const currentHash = refreshStore.get(userId);
    if (!currentHash) return res.status(401).json({ error: 'unauthorized' });
    if (currentHash !== sha256Hex(providedJti)) {
      // Reuse detected: revoke family by clearing current entry
      refreshStore.delete(userId);
       
      console.info('[auth] token_reuse_detected', { userId });
      return res.status(401).json({ error: 'unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) return res.status(401).json({ error: 'unauthorized' });

    // Rotate tokens
    const newJti = randomString(32);
    const newAccess = signAccessToken(user.id, user.username);
    const newRefresh = signRefreshToken(user.id, user.username, newJti);
    refreshStore.set(userId, sha256Hex(newJti));

    res.cookie('access_token', newAccess, {
      ...cookieOptions(1),
      maxAge: 60 * 60 * 1000,
      signed: true,
    });
    res.cookie('refresh_token', newRefresh, { ...cookieOptions(30), signed: true });
    audit.log('auth.refresh.rotate', { actorId: userId });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
});

router.post('/auth/logout', async (req, res) => {
  // Clear cookies and revoke refresh
  const raw = (req.cookies?.access_token as string) || '';
  if (raw) {
    try {
      const parts = JSON.parse(Buffer.from(raw.split('.')[1], 'base64').toString('utf-8')) as any;
      if (parts?.sub) refreshStore.delete(String(parts.sub));
    } catch {}
  }
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  try {
    const parts = raw
      ? (JSON.parse(Buffer.from(raw.split('.')[1], 'base64').toString('utf-8')) as any)
      : null;
    const actorId = parts?.sub ? String(parts.sub) : undefined;
    audit.log('auth.logout', { actorId });
  } catch {}
  res.setHeader('Cache-Control', 'no-store');
  return res.status(204).end();
});

// Rotate refresh token and issue a new access token
router.post('/auth/refresh', async (req, res) => {
  try {
    const raw =
      (req.signedCookies?.refresh_token as string) || (req.cookies?.refresh_token as string) || '';
    if (!raw) return res.status(401).json({ error: 'unauthorized' });

    const payload = verifyRefreshToken(raw);
    const userId = String(payload.sub);
    const jti = String(payload.jti || '');
    if (!jti) return res.status(401).json({ error: 'unauthorized' });

    // Verify rotation state (hashed jti match)
    const expected = refreshStore.get(userId);
    if (!expected || expected !== sha256Hex(jti)) {
      // Token reuse or invalid; revoke the family and force re-login
      refreshStore.delete(userId);
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(401).json({ error: 'unauthorized' });
    }

    // Issue new tokens
    // For MVP we do not hit DB; we reuse the opaque username in JWT (or blank)
    const access = signAccessToken(Number(userId), '');
    const newRefreshId = randomString(32);
    const refresh = signRefreshToken(Number(userId), '', newRefreshId);
    refreshStore.set(userId, sha256Hex(newRefreshId));

    res.cookie('access_token', access, {
      ...cookieOptions(1),
      maxAge: 60 * 60 * 1000,
      signed: true,
    });
    res.cookie('refresh_token', refresh, { ...cookieOptions(30), signed: true });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ status: 'rotated' });
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
});

export { router as authRouter };
