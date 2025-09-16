import { Router } from 'express';
import { createGitHubClientFromEnv } from './client';

export const githubRouter = Router();

// GET /api/github/orgs - list orgs for authenticated token (env-based fallback)
githubRouter.get('/orgs', async (_req, res, next) => {
  try {
    const client = createGitHubClientFromEnv();
    // Use REST: orgs for authenticated user
    // @ts-expect-error using internal octokit wrapper
    const octo = (client as any).octokit as any;
    if (!octo) return res.status(503).json({ error: 'GitHub client unavailable' });
    const { data } = await octo.orgs.listForAuthenticatedUser({ per_page: 100 });
    const out = (data || []).map((o: any) => ({ login: o.login }));
    return res.json(out);
  } catch (e) {
    next(e);
  }
});

