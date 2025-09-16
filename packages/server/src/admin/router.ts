import { Router } from 'express';

export const adminRouter = Router();

// Minimal placeholder routes for tests and integration sanity checks
adminRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

adminRouter.get('/config', (_req, res) => {
  res.json({ ok: true, features: {} });
});

// Simple internal analytics dashboard (HTML)
adminRouter.get('/analytics', async (_req, res) => {
  try {
    const { getRedis } = require('../queue/redis') as typeof import('../queue/redis');
    const r = getRedis();
    if (!r) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send('<h1>Analytics</h1><p>Redis not configured.</p>');
    }
    const today = new Date().toISOString().slice(0, 10);
    const [villages, dialogue, commands, sessionMs] = await Promise.all([
      r.scard(`kpi:day:${today}:villages`),
      r.get(`kpi:day:${today}:dialogue_opens`).then((v: any) => Number(v || 0)),
      r.get(`kpi:day:${today}:commands`).then((v: any) => Number(v || 0)),
      r.get(`kpi:day:${today}:session_ms`).then((v: any) => Number(v || 0)),
    ]);
    const avgSessionSec = villages > 0 ? Math.round(sessionMs / 1000 / Math.max(1, villages)) : 0;
    const html = `<!doctype html><html><head><title>Analytics</title>
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
      <style>body{font-family:system-ui,sans-serif;background:#0b1220;color:#e2e8f0;padding:20px} .card{background:#0f172a;border:1px solid #1f2937;border-radius:8px;padding:12px;margin:8px 0}</style>
      </head><body>
      <h1>Analytics (Today)</h1>
      <div class="card">Daily Active Villages: <strong>${villages}</strong></div>
      <div class="card">Dialogue Opens: <strong>${dialogue}</strong></div>
      <div class="card">Commands Executed: <strong>${commands}</strong></div>
      <div class="card">Avg Session (sec): <strong>${avgSessionSec}</strong></div>
      </body></html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (e: any) {
    return res.status(500).json({ error: 'internal_error', message: e?.message || 'failed' });
  }
});
