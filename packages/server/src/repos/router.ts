import { Router } from 'express';
import { z } from 'zod';
import { createBugBot, getBugsForVillage, updateBugStatus } from '../bugs/service';
import { requireAuth } from '../auth/middleware';
import { githubMiddleware } from '../github/middleware';

export const reposRouter = Router();

const ReconcileBody = z.object({
  villageId: z.string().min(1),
  openIssues: z.array(z.number()).default([]),
});

// Public reconcile endpoint used by tests to align bug state with GitHub issues
reposRouter.post('/repos/:org/:repo/reconcile', async (req, res, next) => {
  try {
    const parsed = ReconcileBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid body', code: 'BAD_REQUEST' });
    }
    const { villageId, openIssues } = parsed.data;
    const { org, repo } = req.params;

    const existing = await getBugsForVillage(villageId);
    const existingNums = new Set<number>();
    const prefix = `${org}/${repo}/`;
    for (const b of existing as any[]) {
      if (typeof b.id === 'string' && b.id.startsWith(prefix)) {
        const num = Number(b.id.slice(prefix.length));
        if (!Number.isNaN(num)) existingNums.add(num);
      }
    }

    // Create missing open issues as bugs
    for (const num of openIssues) {
      if (!existingNums.has(num)) {
        await createBugBot({
          id: `${org}/${repo}/${num}`,
          villageId,
          issueId: String(num),
          issueNumber: num,
        });
      }
    }

    // Resolve bugs that are no longer open
    for (const num of existingNums) {
      if (!openIssues.includes(num)) {
        await updateBugStatus(`${org}/${repo}/${num}`, 'resolved' as any);
      }
    }

    return res.json({ ok: true, open: openIssues.length });
  } catch (e) {
    next(e);
  }
});

// Repository dispatch endpoint: triggers a GitHub Actions workflow_dispatch
// Requires authentication and configured GitHub client (from githubMiddleware)
const DispatchBody = z.object({
  workflow: z.string().min(1),
  ref: z.string().min(1).default('main'),
  inputs: z.record(z.string()).optional(),
});

reposRouter.post('/repos/:org/:repo/dispatch', requireAuth, githubMiddleware(), async (req, res, next) => {
  try {
    const body = DispatchBody.safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: 'invalid body', code: 'BAD_REQUEST', details: body.error.flatten() });
    const { org, repo } = req.params;
    const { workflow, ref, inputs } = body.data;
    // Use Octokit from middleware-attached GitHub client
    const client = req.github!;
    // Prefer REST API; fallback or log failure
    const ok = await client
      .octokit()
      .actions.createWorkflowDispatch({ owner: org, repo, workflow_id: workflow, ref, inputs: inputs as any })
      .then(() => true)
      .catch(() => false);
    if (!ok) return res.status(502).json({ error: 'dispatch_failed', code: 'BAD_GATEWAY' });
    return res.status(202).json({ status: 'accepted', org, repo, workflow, ref, inputs: inputs || {} });
  } catch (e) {
    next(e);
  }
});
