import { Router } from 'express';
import crypto from 'node:crypto';
import { getRedis } from '../queue/redis';

export const analyticsRouter = Router();

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function hash(input: string) {
  const salt = process.env.ANALYTICS_SALT || process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(input + salt).digest('hex');
}

analyticsRouter.post('/analytics/collect', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body || !Array.isArray(body.events)) return res.status(400).json({ error: 'bad_request' });
    if (!body.consent) return res.status(202).json({ ok: true }); // ignore if no consent
    const r = getRedis();
    const today = dayKey();
    for (const ev of body.events) {
      if (!ev || typeof ev.type !== 'string') continue;
      // privacy: hash userId; limit command text length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e: any = { ...ev };
      if (e.userId) e.userId = hash(String(e.userId));
      if (e.command && typeof e.command === 'string' && e.command.length > 64) e.command = e.command.slice(0, 64);
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
            break;
          case 'session_end':
            if (typeof e.durationMs === 'number') await r.incrby(`kpi:day:${today}:session_ms`, Math.max(0, Math.floor(e.durationMs)));
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
    const [villages, dialogue, commands, sessionMs] = await Promise.all([
      r.scard(`kpi:day:${today}:villages`),
      r.get(`kpi:day:${today}:dialogue_opens`).then((v) => Number(v || 0)),
      r.get(`kpi:day:${today}:commands`).then((v) => Number(v || 0)),
      r.get(`kpi:day:${today}:session_ms`).then((v) => Number(v || 0)),
    ]);
    const avgSessionSec = villages > 0 ? Math.round((sessionMs / 1000) / Math.max(1, villages)) : 0;
    return res.json({ ok: true, daily_active_villages: villages, dialogue_opens: dialogue, commands_executed: commands, avg_session_sec: avgSessionSec });
  } catch {
    return res.status(500).json({ error: 'internal_error' });
  }
});

