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
import { audit } from './audit/logger';
import { getMetrics, inc, setGauge } from './metrics';
import { enqueueAgentJob } from './agents/queue';
import { getUserVillageRole } from './auth/middleware';

let isReady = false;
export function setReady(ready: boolean) {
  isReady = ready;
}

export function createApp(): Express {
  const app = express();

  // Core middleware
  app.use(requestId);
  app.use(helmet());
  // Minimal request metrics/logging first
  app.use(requestLogger());
  // Minimal CSP to discourage inline execution by default
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
      },
    })
  );
  // Enforce HSTS in production
  if (config.NODE_ENV === 'production') {
    app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true, preload: true }));
  }
  // Strict CORS: allow only configured origins; reflect exactly one
  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const defaults = [config.PUBLIC_APP_URL || ''];
  if (config.NODE_ENV !== 'production') defaults.push('http://localhost:5173', 'http://127.0.0.1:5173');
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
    })
  );
  app.use(compression());
  app.use(express.json({
    verify: (req, _res, buf) => {
      // Preserve raw body for webhook signature verification
      (req as any).rawBody = buf;
    },
  }));
  // Sign cookies if JWT secret is available
  app.use(cookieParser(config.JWT_SECRET));
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
      } catch {}
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
    if (process.env.REDIS_URL && config.NODE_ENV !== 'test' && process.env.DISABLE_REDIS_READINESS !== 'true') {
      redisOk = await pingRedis();
    }
    const ready = isReady && dbOk && redisOk;
    const body: HealthStatus = { status: ready ? 'ok' : 'error', timestamp: nowIso() };
    res.status(ready ? 200 : 503).json(body);
  });

  // E2E auth helper (disabled unless E2E_TEST_MODE=true)
  if (process.env.E2E_TEST_MODE === 'true') {
    app.get('/test/login/:id', (req, res) => {
      try {
        const id = Number(req.params.id) || 1;
        const username = String((req.query.username as string) || 'e2e-user');
        const access = signAccessToken(id, username);
        const refresh = signRefreshToken(id, username, randomString(16));
        const isProd = config.NODE_ENV === 'production';
        const cookieBase = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
        res.cookie('access_token', access, { ...cookieBase, maxAge: 60 * 60 * 1000 });
        res.cookie('refresh_token', refresh, { ...cookieBase, maxAge: 30 * 24 * 60 * 60 * 1000 });
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
      const data = await svc.listOrgReposPreferGraphQLWithFallback(v.data.org, { bypassCache: noCache });
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  // GitHub webhooks (minimal MVP) and public repo reconcile endpoint (used in tests)
  app.post('/api/webhooks/github', githubWebhook);
  // Optional Probot app mount (separate route, raw body for signature verification)
  if (process.env.PROBOT_ENABLED === 'true') {
    (async () => {
      try {
        const { getProbotMiddleware } = await import('./probot/app');
        const mw = await getProbotMiddleware();
        const raw = require('express').raw;
        app.use('/api/webhooks/probot', raw({ type: '*/*' }), mw);
      } catch (e) {
        // eslint-disable-next-line no-console
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

  // Protect API routes with auth (exclude webhooks/reconcile which are public)
  app.use('/api', requireAuth);

  // GitHub Actions: workflow_dispatch bridge (Task 56/75)
  app.post('/api/github/dispatch', async (req, res) => {
    try {
      const body = req.body ?? {};
      const owner = String(body.owner || '').trim();
      const repo = String(body.repo || '').trim();
      const workflowId = String(body.workflowId || body.workflow_id || '').trim();
      const ref = String(body.ref || 'main').trim();
      const inputs = (body.inputs && typeof body.inputs === 'object') ? body.inputs : undefined;
      if (!owner || !repo || !workflowId) {
        return res.status(400).json({ error: 'owner, repo, workflowId required', code: 'BAD_REQUEST' });
      }
      if (!req.github) {
        return res.status(503).json({ error: 'GitHub client unavailable', code: 'UNAVAILABLE' });
      }
      await req.github.triggerDispatch(owner, repo, workflowId, ref, inputs).catch((e: any) => {
        const msg = e?.message || 'dispatch failed';
        throw new Error(msg);
      });
      return res.status(202).json({ status: 'accepted', owner, repo, workflowId, ref });
    } catch (e: any) {
      return res.status(502).json({ error: e?.message || 'dispatch failed', code: 'UPSTREAM' });
    }
  });

  // Admin endpoints (auth required) — tolerate absence in minimal builds
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require('./admin/router').adminRouter;
    app.use('/api/admin', requireAuth, admin);
  } catch {
    const express = require('express');
    app.use('/api/admin', requireAuth, express.Router());
  }

  // Villages endpoints (protected)
  app.use('/api/villages', villagesRouter);

  // Agents endpoints (protected)
  app.use('/api', agentsRouter);
  // Queue inspection endpoints (protected)
  app.use('/api', queuesRouter);
  // Analytics collector and KPIs (protected collector, internal summary)
  app.use('/api', analyticsRouter);

  // Bug bot endpoints (protected)
  app.use('/api', bugRouter);

  // Auth endpoints
  app.use(authRouter);

  // Feedback endpoint (rate-limited)
  const FeedbackSchema = z.object({
    category: z.enum(['bug','idea','question','other']),
    description: z.string().min(5),
    email: z.string().email().optional(),
  });
  const feedbackRate = new Map<string, { ts: number; count: number }>();
  app.post('/api/feedback', async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'local';
    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const maxPerWindow = 5;
    const slot = feedbackRate.get(ip) || { ts: now, count: 0 };
    if (now - slot.ts > windowMs) { slot.ts = now; slot.count = 0; }
    slot.count += 1;
    feedbackRate.set(ip, slot);
    if (slot.count > maxPerWindow) return res.status(429).json({ error: 'rate_limited' });

    const parsed = FeedbackSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
    const payload = parsed.data;
    try {
      // Try to persist to Redis list if available
      const { getRedis } = require('./queue/redis');
      const r = getRedis();
      if (r) {
        await r.lpush('feedback', JSON.stringify({ ...payload, ts: new Date().toISOString(), userId: (req as any).user?.sub || null }));
      }
    } catch {}
    try {
      // eslint-disable-next-line no-console
      console.info('[feedback]', { ...payload, userId: (req as any).user?.sub || null });
    } catch {}
    return res.status(202).json({ ok: true });
  });

  // User preferences (auth required)
  app.get('/api/users/me/preferences', requireAuth, async (req, res) => {
    const userId = String((req as any).user?.sub || '');
    const defaults = { lod: 'high', maxFps: 60, colorblind: false, theme: 'dark', keybindings: { talk: 'T' } };
    try {
      const row = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
      const prefs = row?.preferences && typeof row.preferences === 'object' ? { ...defaults, ...(row.preferences as any) } : defaults;
      return res.json(prefs);
    } catch {
      return res.json(defaults);
    }
  });

  app.put('/api/users/me/preferences', requireAuth, async (req, res) => {
    const userId = String((req as any).user?.sub || '');
    const parsed = UserPreferencesSchema.safeParse((req.body as any) || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid body', code: 'BAD_REQUEST', details: parsed.error.flatten() });
    const incoming = parsed.data;
    try {
      await prisma.user.update({ where: { id: userId }, data: { preferences: incoming } });
      return res.json({ ok: true });
    } catch {
      return res.status(200).json({ ok: true });
    }
  });

  app.post('/api/agents/:id/command', requireAgentVillageRole(['owner', 'member']), async (req, res) => {
    const { id } = req.params;
    const body = req.body ?? {};
    const parsed = AgentCommandSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid command payload', code: 'BAD_REQUEST' });
    const actorId = Number((req as any).user?.sub);
    // Authorization: if agent is tied to a village, require at least member role
    try {
      const agentRow = await prisma.agent.findUnique({ where: { id } } as any);
      if (agentRow && (agentRow as any).villageId) {
        const role = await getUserVillageRole(actorId, (agentRow as any).villageId);
        if (!role || (role !== 'owner' && role !== 'member')) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'no access to agent' } });
      }
    } catch {}
    const cmd = parsed.data;
    try { const { audit } = require('./audit/logger'); audit({ type: 'agent.command', ts: Date.now(), data: { actorId, agentId: id, cmd } }); } catch {}
    const result = await enqueueAgentJob({ kind: 'command', agentId: id, command: (cmd as any).command || (cmd as any).type, args: cmd });
    return res.status(202).json({ status: 'enqueued', agentId: id, jobId: (result as any).jobId ?? null, timestamp: nowIso() });
  });

  app.post('/api/agents/:id/start', requireAgentVillageRole(['owner', 'member']), async (req, res) => {
    const { id } = req.params;
    const restart = String((req.query.restart ?? req.body?.restart ?? '')).toLowerCase() === 'true';
    const actorId = Number((req as any).user?.sub);
    try {
      const agentRow = await prisma.agent.findUnique({ where: { id } } as any);
      if (agentRow && (agentRow as any).villageId) {
        const role = await getUserVillageRole(actorId, (agentRow as any).villageId);
        if (!role || (role !== 'owner' && role !== 'member')) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'no access to agent' } });
      }
    } catch {}
    audit.log('agent.command', { actorId, agentId: id, cmd: 'start', restart });
    const result = await enqueueAgentJob({ kind: 'start', agentId: id, restart });
    if ((result as any).jobId) {
      res.setHeader('Idempotency-Key', String((result as any).jobId));
      res.setHeader('Idempotency-Status', (result as any).enqueued === false ? 'reused' : 'new');
    }
    return res.status(202).json({ status: 'enqueued', agentId: id, jobId: (result as any).jobId ?? null, timestamp: nowIso(), restart });
  });

  app.post('/api/agents/:id/stop', requireAgentVillageRole(['owner', 'member']), async (req, res) => {
    const { id } = req.params;
    const actorId = Number((req as any).user?.sub);
    try {
      const agentRow = await prisma.agent.findUnique({ where: { id } } as any);
      if (agentRow && (agentRow as any).villageId) {
        const role = await getUserVillageRole(actorId, (agentRow as any).villageId);
        if (!role || (role !== 'owner' && role !== 'member')) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'no access to agent' } });
      }
    } catch {}
    audit.log('agent.command', { actorId, agentId: id, cmd: 'stop' });
    const result = await enqueueAgentJob({ kind: 'stop', agentId: id });
    if ((result as any).jobId) {
      res.setHeader('Idempotency-Key', String((result as any).jobId));
      res.setHeader('Idempotency-Status', (result as any).enqueued === false ? 'reused' : 'new');
    }
    return res.status(202).json({ status: 'enqueued', agentId: id, jobId: (result as any).jobId ?? null, timestamp: nowIso() });
  });

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).setReady = (ready: boolean) => {
    isReady = ready;
  };

  return app;
}
