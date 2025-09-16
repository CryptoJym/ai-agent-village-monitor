import { Router } from 'express';

export const adminRouter = Router();

// Minimal placeholder routes for tests and integration sanity checks
adminRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

adminRouter.get('/config', (_req, res) => {
  res.json({ ok: true, features: {} });
});

