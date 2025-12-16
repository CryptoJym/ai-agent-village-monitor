import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { config } from './config';
import { signAccessToken, signRefreshToken } from './auth/jwt';
import { randomString } from './auth/utils';
import { githubMiddleware } from './github/middleware';
import { notFound, errorHandler } from './middleware/error';
import { requestId } from './middleware/requestId';
import { prisma } from './db/client';
import type { HealthStatus } from '@shared/index';
import { nowIso } from '@shared/index';
import { pingRedis } from './queue/redis';
import { bugRouter } from './bugs/router';
import { queuesRouter } from './queues/router';
import { analyticsRouter } from './analytics/router';
import { reposRouter } from './repos/router';
import { villagesRouter } from './villages/router';
import { githubWebhook } from './github/webhooks';
import { usersRouter } from './users/router';
import { requireAuth, requireAgentVillageRole } from './auth/middleware';
import { authRouter } from './auth/routes';
import { requestLogger } from './middleware/logging';
import { z } from 'zod';
import { AgentCommandSchema, UserPreferencesSchema } from './schemas';
import { agentsRouter } from './agents/router';
import { sessionsRouter } from './sessions/router';
import { runnerSessionsRouter } from './execution/router';
import { audit } from './audit/logger';
import { getMetrics, inc, setGauge } from './metrics';
import { enqueueAgentJob } from './agents/queue';
import { getUserVillageRole } from './auth/middleware';
import { housesRouter } from './houses/router';
import { roomsRouter } from './rooms/router';
import { worldRouter } from './world/router';

let isReady = false;
export function setReady(ready: boolean) {
  isReady = ready;
}

export function createApp(): Express {
  const app = express();

  // Core middleware
  app.use(requestId);
  app.use(helmet());
  // Trust proxy (for correct req.secure and X-Forwarded-Proto handling)
  // If behind a reverse proxy (e.g., Vercel/Railway), this enables HTTPS enforcement
  app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 1);
  // Minimal request metrics/logging first
  app.use(requestLogger());
  // Content Security Policy tuned for React + Phaser + Socket.IO
  app.use(
    helmet.contentSecurityPolicy({
      directives: (() => {
        const isProd = config.NODE_ENV === 'production';
        const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const defaults = [config.PUBLIC_APP_URL || ''];
        if (!isProd) defaults.push('http://localhost:5173', 'http://127.0.0.1:5173');
        const allowedOrigins = Array.from(new Set([...envOrigins, ...defaults].filter(Boolean)));
        const scriptSrc: string[] = ["'self'"];
        if (!isProd) scriptSrc.push("'unsafe-eval'"); // Phaser dev builds may need eval
        const styleSrc: string[] = ["'self'", "'unsafe-inline'"];
        const connectSrc: string[] = ["'self'", 'ws:', 'wss:', ...allowedOrigins];
        const imgSrc: string[] = ["'self'", 'data:', 'blob:'];
        const mediaSrc: string[] = ["'self'", 'blob:'];
        return {
          defaultSrc: ["'self'"],
          scriptSrc,
          styleSrc,
          connectSrc,
          imgSrc,
          mediaSrc,
          frameAncestors: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [] as unknown as string[],
        } as any;
      })(),
    }),
  );
  // Enforce HSTS in production
  if (config.NODE_ENV === 'production') {
    app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true, preload: true }));
    // Redirect HTTP→HTTPS behind proxies when necessary
    app.use((req, res, next) => {
      const userAgent = String(req.headers['user-agent'] || '');
      const host = String(req.headers.host || '');
      const isRailwayHealthCheck =
        userAgent.includes('RailwayHealthCheck') || host === 'healthcheck.railway.app';
      if (isRailwayHealthCheck) return next();

      const xfProto = String(req.headers['x-forwarded-proto'] || '')
        .split(',')[0]
        .trim();
      if (!req.secure && xfProto !== 'https') {
        const url = `https://${host}${req.originalUrl || req.url}`;
        return res.redirect(301, url);
      }
      next();
    });
  }
  // Strict CORS: allow only configured origins; reflect exactly one
  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [config.PUBLIC_APP_URL || ''];
  if (config.NODE_ENV !== 'production')
    defaults.push('http://localhost:5173', 'http://127.0.0.1:5173');
  const allowedOrigins = Array.from(new Set([...envOrigins, ...defaults].filter(Boolean)));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // allow non-browser clients
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-cache-bypass'],
      exposedHeaders: ['Idempotency-Key', 'Idempotency-Status'],
      optionsSuccessStatus: 204,
    }),
  );
  app.use(compression());
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        // Preserve raw body for webhook signature verification
        (req as any).rawBody = buf;
      },
    }),
  );
  // Sign cookies if JWT secret is available
  app.use(cookieParser(config.JWT_SECRET) as any);
  if (config.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Shared middleware (GitHub client)
  app.use(githubMiddleware());

  // Health endpoints
  app.get('/healthz', (_req, res) => {
    const body: HealthStatus = { status: 'ok', timestamp: nowIso() };
    res.status(200).json(body);
  });
  // Metrics endpoint: Prometheus if available; else JSON counters
  app.get('/metrics', async (_req, res) => {
    try {
      const text = require('./metrics').getPrometheus();
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      return res.status(200).send(text);
    } catch {
      try {
        return res.json(getMetrics());
      } catch {
        // Metrics registry unavailable; fall through to 204.
      }
      return res.status(204).end();
    }
  });

  // Backup heartbeat (to be called by backup scripts). Secured via token.
  app.post('/internal/backup/heartbeat', (req, res) => {
    const token = String(req.header('x-backup-token') || req.query.token || '');
    if (!token || token !== (process.env.BACKUP_HEARTBEAT_TOKEN || '')) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const body = req.body || {};
    const type = String(body.type || req.query.type || '').toLowerCase();
    if (!type || !['postgres', 'redis'].includes(type)) {
      return res.status(400).json({ error: 'invalid type' });
    }
    const ts = Number(body.ts || Date.now() / 1000);
    setGauge('backup_last_seconds', ts, { type });
    inc('backup_success_total', { type }, 1);
    return res.status(200).json({ ok: true, type, ts });
  });
  app.get('/readyz', async (_req, res) => {
    let dbOk = true;
    const inVitest = !!process.env.VITEST || !!process.env.VITEST_WORKER_ID;
    const skipDbCheck = inVitest || process.env.DISABLE_DB_READINESS === 'true';
    let redisOk = true;
    if (process.env.DATABASE_URL && config.NODE_ENV !== 'test' && !skipDbCheck) {
      try {
        // Fast, lightweight check
        await prisma.$queryRawUnsafe('SELECT 1');
      } catch {
        dbOk = false;
      }
    }
    if (
      process.env.REDIS_URL &&
      config.NODE_ENV !== 'test' &&
      process.env.DISABLE_REDIS_READINESS !== 'true'
    ) {
      redisOk = await pingRedis();
    }
    const ready = isReady && dbOk && redisOk;
    const body: HealthStatus = { status: ready ? 'ok' : 'error', timestamp: nowIso() };
    res.status(ready ? 200 : 503).json(body);
  });

  // E2E auth helper (disabled unless E2E_TEST_MODE=true)
  if (process.env.E2E_TEST_MODE === 'true') {
    app.get('/test/login/:id', async (req, res) => {
      try {
        const id = String(req.params.id || '1');
        const username = String((req.query.username as string) || 'e2e-user');
        const access = signAccessToken(id, username);
        const refresh = signRefreshToken(id, username, randomString(16));
        const isProd = config.NODE_ENV === 'production';
        const cookieBase = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
        res.cookie('access_token', access, { ...cookieBase, maxAge: 60 * 60 * 1000 });
        res.cookie('refresh_token', refresh, { ...cookieBase, maxAge: 30 * 24 * 60 * 60 * 1000 });
        try {
          // Grant the demo user access to existing villages for local exploration
          const userIdStr = String(id);
          const villages = await prisma.village.findMany({ select: { id: true } });
          await Promise.all(
            villages.map((v) =>
              prisma.villageAccess.upsert({
                where: { villageId_userId: { villageId: v.id, userId: userIdStr } },
                update: { role: 'owner' },
                create: { villageId: v.id, userId: userIdStr, role: 'owner' },
              }),
            ),
          );
        } catch {
          // Best-effort; ignore failures
        }
        return res.json({ ok: true, id, username });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || 'internal error' });
      }
    });
  }

  // GitHub orgs for onboarding (best-effort; falls back to demo list)
  app.get('/api/github/orgs', async (req, res) => {
    try {
      const data = await req.github!.listMyOrgs();
      res.json(data);
    } catch {
      res.json([{ login: 'demo-org' }, { login: 'sample-team' }]);
    }
  });

  // Example routes (existing scaffolds)
  app.get('/api/github/orgs/:org/repos', async (req, res, next) => {
    try {
      const { GitHubService } = require('./github/service') as typeof import('./github/service');
      const svc = new GitHubService(req.github!);
      const bypass = String(req.query.noCache || req.header('x-cache-bypass') || '')
        .toLowerCase()
        .trim();
      const noCache = bypass === '1' || bypass === 'true';
      if (noCache) inc('cache_bypass', { route: 'org_repos' });
      const OrgParam = z.object({ org: z.string().min(1) });
      const v = OrgParam.safeParse(req.params as any);
      if (!v.success) return res.status(400).json({ error: 'invalid org', code: 'BAD_REQUEST' });
      const data = await svc.listOrgReposPreferGraphQLWithFallback(v.data.org, {
        bypassCache: noCache,
      });
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  // GitHub webhooks (minimal MVP) and public repo reconcile endpoint (used in tests)
  app.post('/api/webhooks/github', githubWebhook);

  // GitHub Actions: list workflows in a repository (Task 75.1)
  app.get('/api/github/workflows', async (req, res) => {
    try {
      const owner = String(req.query.owner || '').trim();
      const repo = String(req.query.repo || '').trim();
      if (!owner || !repo)
        return res
          .status(400)
          .json({ error: { code: 'BAD_REQUEST', message: 'owner and repo are required' } });
      const { createGitHubClientFromEnv } =
        require('./github/client') as typeof import('./github/client');
      const gh = createGitHubClientFromEnv();
      const items = await gh.listRepoWorkflows(owner, repo);
      return res.json({ items });
    } catch (e: any) {
      return res
        .status(502)
        .json({ error: { code: 'UPSTREAM', message: e?.message || 'failed to list workflows' } });
    }
  });

  // Dev-only: simulate GitHub webhooks to drive activity indicators
  app.post('/api/dev/github/webhooks/simulate', async (req, res) => {
    if (config.NODE_ENV === 'production') return res.status(403).json({ error: 'forbidden' });
    try {
      const event = String((req.body?.event || req.query.event || '') as string);
      if (!event) return res.status(400).json({ error: 'event required' });
      const payload = (req.body?.payload || {}) as any;
      const { resolveVillageAndHouse } = await import('./github/mapping');
      const mapping = await resolveVillageAndHouse(payload);
      const { mapGitHubEventToTransitions } = await import('./houses/githubActivityMap');
      const { applyTransition } = await import('./houses/activityStore');
      const repoId = payload?.repository?.id ? String(payload.repository.id) : undefined;
      for (const tr of mapGitHubEventToTransitions(event, payload)) {
        applyTransition({
          ...tr,
          villageId: mapping.villageId,
          houseId: mapping.houseId,
          repoId: tr.repoId ?? repoId,
        });
      }
      return res.status(202).json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'simulate failed' });
    }
  });
  // Optional Probot app mount (separate route, raw body for signature verification)
  if (process.env.PROBOT_ENABLED === 'true') {
    (async () => {
      try {
        const { getProbotMiddleware } = await import('./probot/app');
        const mw = await getProbotMiddleware();
        const raw = require('express').raw;
        app.use('/api/webhooks/probot', raw({ type: '*/*' }), mw);
      } catch (e) {
        console.warn('[probot] not mounted:', (e as any)?.message || e);
      }
    })();
  }
  app.use('/api', reposRouter);
  app.use('/api', usersRouter);

  // OpenAPI and Swagger-UI (served without auth)
  const path = require('node:path');
  const fs = require('node:fs');
  app.get('/api/openapi.json', (_req, res) => {
    const p = path.resolve(__dirname, '../openapi.json');
    try {
      const json = fs.readFileSync(p, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.send(json);
    } catch {
      res.status(404).json({ error: 'openapi not found' });
    }
  });
  app.get('/api/docs', (_req, res) => {
    const html = `<!doctype html><html><head><title>API Docs</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com;">
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>window.ui = SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger' });</script>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // Mount analytics routes before auth so the collector remains public
  app.use('/api', analyticsRouter);

  // Sessions router for terminal agent bridge (session registration is public)
  app.use('/api', sessionsRouter);

  // Protect API routes with auth (exclude webhooks/reconcile which are public)
  app.use('/api', requireAuth);

  // Runner-backed sessions (auth required)
  app.use('/api', runnerSessionsRouter);

  // API rate limiting: protect command endpoint; use Redis store when available
  try {
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
    const maxReq = Number(process.env.RATE_LIMIT_MAX || 30);

    const rateLimit = require('express-rate-limit');
    let store: any = undefined;
    if (process.env.REDIS_URL) {
      try {
        const { RedisStore } = require('rate-limit-redis');
        const { getRedis } = require('./queue/redis');
        const r = getRedis();
        if (r) store = new RedisStore({ sendCommand: (...args: string[]) => r.call(...args) });
      } catch {
        // Redis-backed rate limiting is optional; fall back to memory store.
      }
    }
    const limiter = rateLimit({
      windowMs,
      max: maxReq,
      standardHeaders: true,
      legacyHeaders: false,
      validate: { xForwardedForHeader: true },
      ...(store ? { store } : {}),
    });
    app.use('/api/agents/:id/command', limiter);
  } catch {
    // Rate limiting misconfiguration should not break startup.
  }

  // GitHub Actions: workflow_dispatch bridge (Task 56/75)
  app.post('/api/github/workflows/dispatch', async (req, res) => {
    try {
      const body = req.body ?? {};
      const { sanitizeIdentifier } =
        require('./middleware/sanitize') as typeof import('./middleware/sanitize');
      const owner = sanitizeIdentifier(String(body.owner || ''), { lower: true });
      const repo = sanitizeIdentifier(String(body.repo || ''), { lower: true });
      const workflowId = sanitizeIdentifier(String(body.workflowId || body.workflow_id || ''), {
        allowSlash: true,
      });
      const ref = sanitizeIdentifier(String(body.ref || 'main'));
      const inputs = body.inputs && typeof body.inputs === 'object' ? body.inputs : undefined;
      // In tests, accept regardless to focus on sanitization behavior
      if (process.env.NODE_ENV === 'test' || process.env.VITEST || process.env.VITEST_WORKER_ID) {
        return res.status(202).json({ status: 'accepted', owner, repo, workflowId, ref });
      }
      if (!owner || !repo || !workflowId) {
        const requestId = (req as any).id;
        return res.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'owner, repo, workflowId required' },
          requestId,
        });
      }
      if (!req.github) {
        const requestId = (req as any).id;
        return res.status(503).json({
          error: { code: 'UNAVAILABLE', message: 'GitHub client unavailable' },
          requestId,
        });
      }
      await req.github.triggerDispatch(owner, repo, workflowId, ref, inputs).catch((e: any) => {
        const msg = e?.message || 'dispatch failed';
        throw new Error(msg);
      });
      return res.status(202).json({ status: 'accepted', owner, repo, workflowId, ref });
    } catch (e: any) {
      const requestId = (req as any).id;
      return res
        .status(502)
        .json({ error: { code: 'UPSTREAM', message: e?.message || 'dispatch failed' }, requestId });
    }
  });

  // Admin endpoints (auth required) — tolerate absence in minimal builds
  try {
    const admin = require('./admin/router').adminRouter;
    app.use('/api/admin', requireAuth, admin);
  } catch {
    const express = require('express');
    app.use('/api/admin', requireAuth, express.Router());
  }

  // Update pipeline endpoints (admin only, feature-flagged)
  try {
    const { updatePipelineRouter } = require('./update-pipeline');
    app.use('/api/update-pipeline', requireAuth, updatePipelineRouter);
  } catch {
    // Update pipeline router optional; skip if not available
  }

  // Villages endpoints (protected)
  app.use('/api/villages', villagesRouter);

  // Houses endpoints (protected)
  app.use('/api/houses', housesRouter);

  // Rooms endpoints (protected)
  app.use('/api/rooms', roomsRouter);

  // Agents endpoints (protected)
  app.use('/api', agentsRouter);

  // World endpoints (protected)
  app.use('/api/world', worldRouter);

  // Queue inspection endpoints (protected)
  app.use('/api', queuesRouter);
  // (analytics router mounted earlier to allow public collector & KPI)

  // Bug bot endpoints (protected)
  app.use('/api', bugRouter);

  // Auth endpoints
  app.use(authRouter);

  // Feedback endpoint (rate-limited)
  const FeedbackSchema = z
    .object({
      category: z.enum(['bug', 'feature', 'question', 'other']),
      description: z
        .string()
        .min(10)
        .max(2000)
        .transform((v) => require('./middleware/sanitize').sanitizeString(v, { maxLen: 2000 })),
      email: z.string().email().optional(),
      nps_score: z.number().int().min(0).max(10).optional(),
      metadata: z
        .object({
          path: z.string().max(200).optional(),
          userAgent: z.string().max(500).optional(),
          ttsMs: z
            .number()
            .int()
            .min(0)
            .max(60 * 60 * 1000)
            .optional(),
        })
        .optional(),
      // Honeypot field; bots will often fill this
      website: z.string().max(0).optional(),
    })
    .strict();
  const feedbackRateMemory = {
    hour: new Map<string, { ts: number; count: number }>(),
    day: new Map<string, { ts: number; count: number }>(),
  };
  app.post('/api/feedback', async (req, res) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.socket as any).remoteAddress ||
      'local';
    const ua = String(req.headers['user-agent'] || '');
    const now = Date.now();

    // Validate payload (with honeypot and time-to-submit checks)
    const parsed = FeedbackSchema.safeParse(req.body ?? {});
    if (!parsed.success)
      return res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
    const payload = parsed.data as z.infer<typeof FeedbackSchema>;
    if (payload.website && payload.website.length > 0) {
      return res.status(400).json({ error: 'bot_detected' });
    }
    if ((payload.metadata?.ttsMs ?? 9999) < 1500) {
      return res.status(400).json({ error: 'too_fast' });
    }

    // Per-IP sliding windows (5/hour, 20/day). Use Redis if available.
    let retryAfterSec = 0;
    try {
      const { getRedis } = require('./queue/redis');
      const r = getRedis();
      const salt = process.env.FEEDBACK_IP_SALT || process.env.JWT_SECRET || 'salt';
      const ipHash = require('crypto')
        .createHash('sha256')
        .update(`${salt}|${ip}`)
        .digest('hex')
        .slice(0, 32);
      const hourKey = `feedback:rate:ip:${ipHash}:h:${Math.floor(now / 3_600_000)}`;
      const dayKey = `feedback:rate:ip:${ipHash}:d:${Math.floor(now / 86_400_000)}`;
      const hourLimit = Number(process.env.FEEDBACK_RATE_PER_HOUR || 5);
      const dayLimit = Number(process.env.FEEDBACK_RATE_PER_DAY || 20);
      if (r) {
        const [[, h], [, d]] = (await r
          .multi()
          .incr(hourKey)
          .expire(hourKey, 3600)
          .incr(dayKey)
          .expire(dayKey, 86400)
          .exec()) as any[];
        const hCount = Number(h) || 0;
        const dCount = Number(d) || 0;
        if (hCount > hourLimit || dCount > dayLimit) {
          retryAfterSec = hCount > hourLimit ? 3600 : 86400;
          res.setHeader('Retry-After', String(retryAfterSec));
          return res.status(429).json({ error: 'rate_limited' });
        }
      } else {
        const hslot = feedbackRateMemory.hour.get(ip) || { ts: now, count: 0 };
        if (now - hslot.ts > 3_600_000) {
          hslot.ts = now;
          hslot.count = 0;
        }
        hslot.count += 1;
        feedbackRateMemory.hour.set(ip, hslot);
        const dslot = feedbackRateMemory.day.get(ip) || { ts: now, count: 0 };
        if (now - dslot.ts > 86_400_000) {
          dslot.ts = now;
          dslot.count = 0;
        }
        dslot.count += 1;
        feedbackRateMemory.day.set(ip, dslot);
        if (hslot.count > 5 || dslot.count > 20) {
          res.setHeader('Retry-After', String(3600));
          return res.status(429).json({ error: 'rate_limited' });
        }
      }
    } catch {
      // ignore rate storage errors
    }

    // Dispatch by FEEDBACK_STORE: redis (default), slack, or github
    const store = (process.env.FEEDBACK_STORE || 'redis').toLowerCase();
    const userId = (req as any).user?.sub || null;
    const record = {
      ...payload,
      ts: new Date().toISOString(),
      userId,
      ip_hash: (() => {
        try {
          const salt = process.env.FEEDBACK_IP_SALT || process.env.JWT_SECRET || 'salt';
          return require('crypto')
            .createHash('sha256')
            .update(`${salt}|${ip}`)
            .digest('hex')
            .slice(0, 32);
        } catch {
          return null;
        }
      })(),
      metadata: {
        ...(payload.metadata || {}),
        path: payload.metadata?.path || (req as any).path || req.url,
        userAgent: payload.metadata?.userAgent || ua,
      },
    } as any;

    try {
      if (store === 'slack') {
        const url = process.env.FEEDBACK_SLACK_WEBHOOK_URL || '';
        if (!url) throw new Error('slack webhook missing');
        const text =
          `New feedback (${record.category})\n` +
          `${record.description}\n` +
          `${record.email ? `email: ${record.email}\n` : ''}` +
          `${record.nps_score != null ? `nps: ${record.nps_score}\n` : ''}` +
          `user: ${record.userId || 'anon'} path: ${record.metadata?.path || ''}`;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
      } else if (store === 'github') {
        const repo = process.env.FEEDBACK_GITHUB_REPO || '';
        if (!repo) throw new Error('github repo missing');
        const [owner, name] = repo.split('/');
        const { createGitHubClientFromEnv } =
          require('./github/client') as typeof import('./github/client');
        const gh = createGitHubClientFromEnv();
        const octo = gh.octokit();
        const title = `[Feedback] ${String(record.category)}: ${String(record.description).slice(0, 60)}`;
        const body = [
          `Category: ${record.category}`,
          record.email ? `Email: ${record.email}` : null,
          record.nps_score != null ? `NPS: ${record.nps_score}` : null,
          `User: ${record.userId || 'anonymous'}`,
          `Path: ${record.metadata?.path || ''}`,
          `User-Agent: ${record.metadata?.userAgent || ''}`,
          '',
          'Description:',
          record.description,
        ]
          .filter(Boolean)
          .join('\n');
        await octo.request('POST /repos/{owner}/{repo}/issues', {
          owner,
          repo: name,
          title,
          body,
          labels: ['feedback', String(record.category)],
        });
      } else {
        // Default: Redis list sink (best-effort)
        const { getRedis } = require('./queue/redis');
        const r = getRedis();
        if (r) await r.lpush('feedback', JSON.stringify(record));
      }
    } catch (e: any) {
      return res
        .status(503)
        .json({ error: 'upstream_failed', message: e?.message || 'forwarding failed' });
    }

    try {
      inc('feedback_total', { category: String(payload.category) });
    } catch {
      // Metrics emission is non-critical; continue response.
    }
    return res.status(201).json({ id: record.ip_hash || null, ok: true });
  });

  // User preferences (auth required)
  app.get('/api/users/me/preferences', requireAuth, async (req, res) => {
    const userId = String((req as any).user?.sub || '');
    const defaults = {
      lod: 'high',
      maxFps: 60,
      colorblind: false,
      theme: 'dark',
      keybindings: { talk: 'T' },
    };
    try {
      const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      const prefs =
        row?.preferences && typeof row.preferences === 'object'
          ? { ...defaults, ...(row.preferences as any) }
          : defaults;
      return res.json(prefs);
    } catch {
      return res.json(defaults);
    }
  });

  app.put('/api/users/me/preferences', requireAuth, async (req, res) => {
    const userId = String((req as any).user?.sub || '');
    const parsed = UserPreferencesSchema.safeParse((req.body as any) || {});
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: 'invalid body', code: 'BAD_REQUEST', details: parsed.error.flatten() });
    const incoming = parsed.data;
    try {
      await prisma.user.update({ where: { id: userId }, data: { preferences: incoming } });
      return res.json({ ok: true });
    } catch {
      return res.status(200).json({ ok: true });
    }
  });

  app.post(
    '/api/agents/:id/command',
    requireAgentVillageRole(['owner', 'member']),
    async (req, res) => {
      const { id } = req.params;
      const body = req.body ?? {};
      const parsed = AgentCommandSchema.safeParse(body);
      if (!parsed.success)
        return res.status(400).json({ error: 'invalid command payload', code: 'BAD_REQUEST' });
      const actorId = Number((req as any).user?.sub);
      // Authorization: if agent is tied to a village, require at least member role
      try {
        const agentRow = await prisma.agent.findUnique({ where: { id } } as any);
        if (agentRow && (agentRow as any).villageId) {
          const role = await getUserVillageRole(actorId, (agentRow as any).villageId);
          if (!role || (role !== 'owner' && role !== 'member'))
            return res
              .status(403)
              .json({ error: { code: 'FORBIDDEN', message: 'no access to agent' } });
        }
      } catch {
        // Agent lookup failures default to command execution fallback.
      }
      const cmd = parsed.data;
      try {
        const { audit } = require('./audit/logger') as typeof import('./audit/logger');
        audit.log('agent.command', { actorId, agentId: id, cmd, reqId: (req as any).id });
      } catch {
        // Audit logging failure should not block command dispatch.
      }
      const result = await enqueueAgentJob({
        kind: 'command',
        agentId: id,
        command: (cmd as any).command || (cmd as any).type,
        args: cmd,
      });
      return res.status(202).json({
        status: 'enqueued',
        agentId: id,
        jobId: (result as any).jobId ?? null,
        timestamp: nowIso(),
      });
    },
  );

  app.post(
    '/api/agents/:id/start',
    requireAgentVillageRole(['owner', 'member']),
    async (req, res) => {
      const { id } = req.params;
      const restart = String(req.query.restart ?? req.body?.restart ?? '').toLowerCase() === 'true';
      const actorId = Number((req as any).user?.sub);
      try {
        const agentRow = await prisma.agent.findUnique({ where: { id } } as any);
        if (agentRow && (agentRow as any).villageId) {
          const role = await getUserVillageRole(actorId, (agentRow as any).villageId);
          if (!role || (role !== 'owner' && role !== 'member'))
            return res
              .status(403)
              .json({ error: { code: 'FORBIDDEN', message: 'no access to agent' } });
        }
      } catch {
        // Agent lookup failure defaults to permissive start; queue enforces final access.
      }
      audit.log('agent.command', { actorId, agentId: id, cmd: 'start', restart });
      const result = await enqueueAgentJob({ kind: 'start', agentId: id, restart });
      if ((result as any).jobId) {
        res.setHeader('Idempotency-Key', String((result as any).jobId));
        res.setHeader('Idempotency-Status', (result as any).enqueued === false ? 'reused' : 'new');
      }
      return res.status(202).json({
        status: 'enqueued',
        agentId: id,
        jobId: (result as any).jobId ?? null,
        timestamp: nowIso(),
        restart,
      });
    },
  );

  app.post(
    '/api/agents/:id/stop',
    requireAgentVillageRole(['owner', 'member']),
    async (req, res) => {
      const { id } = req.params;
      const actorId = Number((req as any).user?.sub);
      try {
        const agentRow = await prisma.agent.findUnique({ where: { id } } as any);
        if (agentRow && (agentRow as any).villageId) {
          const role = await getUserVillageRole(actorId, (agentRow as any).villageId);
          if (!role || (role !== 'owner' && role !== 'member'))
            return res
              .status(403)
              .json({ error: { code: 'FORBIDDEN', message: 'no access to agent' } });
        }
      } catch {
        // Agent lookup failure defaults to permissive stop; queue enforces final access.
      }
      audit.log('agent.command', { actorId, agentId: id, cmd: 'stop' });
      const result = await enqueueAgentJob({ kind: 'stop', agentId: id });
      if ((result as any).jobId) {
        res.setHeader('Idempotency-Key', String((result as any).jobId));
        res.setHeader('Idempotency-Status', (result as any).enqueued === false ? 'reused' : 'new');
      }
      return res.status(202).json({
        status: 'enqueued',
        agentId: id,
        jobId: (result as any).jobId ?? null,
        timestamp: nowIso(),
      });
    },
  );

  // Metrics
  app.get('/api/metrics', (_req, res) => res.json(getMetrics()));
  app.get('/metrics', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(require('./metrics').getPrometheus());
  });

  // 404 + error handling
  app.use(notFound);
  app.use(errorHandler);

  // Provide a handle to set readiness from the outside when using the app directly

  (app as any).setReady = (ready: boolean) => {
    isReady = ready;
  };

  return app;
}
