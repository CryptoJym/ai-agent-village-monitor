import { Router } from 'express';
import crypto from 'node:crypto';
import { getRedis } from '../queue/redis';
import { AnalyticsBatchSchema } from './schema';
import { prisma } from '../db/client';

export const analyticsRouter = Router();

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function hash(input: string) {
  const salt = process.env.ANALYTICS_SALT || process.env.JWT_SECRET || '';
  return crypto
    .createHash('sha256')
    .update(input + salt)
    .digest('hex');
}

analyticsRouter.post('/analytics/collect', async (req, res) => {
  try {
    const dnt = String(req.headers['dnt'] ?? '').trim() === '1';
    const gpc =
      String(req.headers['sec-gpc'] ?? '').trim() === '1' ||
      String(req.headers['gpc'] ?? '').trim() === '1';
    const parsed = AnalyticsBatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'bad_request', details: parsed.error.flatten() });
    }
    const body = parsed.data;
    // Respect user privacy: DNT/GPC override any client consent flags
    if (dnt || gpc || body.consent === false) {
      return res.status(202).json({ ok: true });
    }
    // Respect server-side user preference if available
    try {
      const userId = String((req as any).user?.sub || '');
      if (userId) {
        const row = await prisma.user.findUnique({
          where: { id: userId },
          select: { preferences: true },
        });
        const prefs =
          row?.preferences && typeof row.preferences === 'object' ? (row.preferences as any) : {};
        if (prefs?.analytics?.enabled === false) {
          return res.status(202).json({ ok: true });
        }
      }
    } catch (e) {
      // ignore preference lookup errors
      void e;
    }
    const r = getRedis();
    const today = dayKey();
    for (const ev of body.events) {
      // privacy: hash userId and drop any unknown keys (already stripped by zod)
       
      const e: any = { ...ev };
      if (e.userId) e.userId = hash(String(e.userId));
      if (body.clientId) body.clientId = hash(String(body.clientId));
      // aggregate counters in redis when available
      if (r) {
        switch (e.type) {
          case 'village_view':
            await r.sadd(`kpi:day:${today}:villages`, String(e.villageId || 'unknown'));
            break;
          case 'dialogue_open':
            await r.incr(`kpi:day:${today}:dialogue_opens`);
            break;
          case 'command_executed':
            await r.incr(`kpi:day:${today}:commands`);
            try {
              // parse fast_travel:<ms>ms:<source>
              if (typeof e.command === 'string' && e.command.startsWith('fast_travel:')) {
                const parts = e.command.split(':');
                const msPart = parts[1] || '';
                const ms = Number(msPart.replace(/ms$/i, ''));
                if (Number.isFinite(ms)) {
                  await r.incr(`kpi:day:${today}:fast_travel_count`);
                  await r.incrby(`kpi:day:${today}:fast_travel_ms`, Math.max(0, Math.round(ms)));
                  if (ms > 2000) await r.incr(`kpi:day:${today}:fast_travel_over_budget`);
                }
              }
            } catch {}
            break;
          case 'session_end':
            if (typeof e.durationMs === 'number')
              await r.incrby(`kpi:day:${today}:session_ms`, Math.max(0, Math.floor(e.durationMs)));
            break;
          default:
            break;
        }
      }
    }
    return res.status(202).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'internal_error' });
  }
});

analyticsRouter.get('/internal/kpi/summary', async (_req, res) => {
  try {
    const r = getRedis();
    const today = dayKey();
    if (!r) return res.json({ ok: true, info: 'redis not configured' });
    const [villages, dialogue, commands, sessionMs, ftCount, ftMs, ftOver] = await Promise.all([
      r.scard(`kpi:day:${today}:villages`),
      r.get(`kpi:day:${today}:dialogue_opens`).then((v) => Number(v || 0)),
      r.get(`kpi:day:${today}:commands`).then((v) => Number(v || 0)),
      r.get(`kpi:day:${today}:session_ms`).then((v) => Number(v || 0)),
      r.get(`kpi:day:${today}:fast_travel_count`).then((v) => Number(v || 0)),
      r.get(`kpi:day:${today}:fast_travel_ms`).then((v) => Number(v || 0)),
      r.get(`kpi:day:${today}:fast_travel_over_budget`).then((v) => Number(v || 0)),
    ]);
    const avgSessionSec = villages > 0 ? Math.round(sessionMs / 1000 / Math.max(1, villages)) : 0;
    const avgTravelMs = ftCount > 0 ? Math.round(ftMs / ftCount) : 0;
    return res.json({
      ok: true,
      daily_active_villages: villages,
      dialogue_opens: dialogue,
      commands_executed: commands,
      avg_session_sec: avgSessionSec,
      fast_travel: { count: ftCount, avg_ms: avgTravelMs, over_2s: ftOver },
    });
  } catch {
    return res.status(500).json({ error: 'internal_error' });
  }
});
