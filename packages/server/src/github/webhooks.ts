import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { config } from '../config';
import { createBugBot, updateBugStatus } from '../bugs/service';
import { cacheDel } from '../cache/cache';
import { keyRepoIssues } from '../cache/keys';
import { inc } from '../metrics';
import { shortCircuitDuplicate } from '../webhooks/dedupe';
import { getRedis } from '../queue/redis';
import { applyTransition } from '../houses/activityStore';
import { mapGitHubEventToTransitions } from '../houses/githubActivityMap';
import { enqueueGitHubWebhookEvent } from './webhookQueue';

export async function processGitHubWebhookEvent(
  event: string,
  payload: any,
): Promise<{ status: 202 | 204 }> {
  if (!event) return { status: 204 };

  // Resolve village (and house when available)
  const { resolveVillageAndHouse } = await import('./mapping');
  let mapping: any;
  try {
    mapping = await resolveVillageAndHouse(payload);
  } catch {
    return { status: 204 };
  }

  const villageId = mapping?.villageId;
  const repoId = payload?.repository?.id ? String(payload.repository.id) : undefined;

  // Activity indicators mapping (push, pull_request, check_run)
  try {
    const transitions = mapGitHubEventToTransitions(event, payload);
    if (transitions.length) {
      for (const tr of transitions) {
        applyTransition({
          ...tr,
          villageId,
          houseId: mapping.houseId,
          repoId: tr.repoId ?? repoId,
        });
      }
    }
  } catch {
    // Mapping errors should not fail webhook delivery; continue with other handlers.
  }

  if (event === 'issues' && payload?.action === 'opened') {
    if (!villageId) return { status: 202 };
    const issue = payload.issue;
    const repo = payload.repository;
    const id = `${repo?.full_name || repo?.name || 'repo'}/${issue?.number}`;
    await createBugBot({
      id,
      villageId,
      provider: 'github',
      repoId: String(repo?.id ?? ''),
      issueId: String(issue?.id ?? ''),
      issueNumber: Number(issue?.number ?? 0),
      title: String(issue?.title ?? ''),
      description: String(issue?.body ?? ''),
      severity: null,
      x: mapping.x,
      y: mapping.y,
      ...(mapping.houseId ? { houseId: mapping.houseId } : {}),
    });
    // Invalidate cached issue lists for this repo (open/all)
    try {
      const repoKey = String(repo?.id ?? repo?.full_name ?? repo?.name ?? '');
      await Promise.all([
        cacheDel(keyRepoIssues(repoKey, 'open')),
        cacheDel(keyRepoIssues(repoKey, 'all')),
      ]);
      inc('cache_invalidate_webhook', { type: 'issues_opened' });
    } catch {
      // Cache invalidation failures are non-fatal for webhook handling.
    }
    return { status: 202 };
  }

  if (event === 'issues' && payload?.action === 'closed') {
    if (!villageId) return { status: 202 };
    const issue = payload.issue;
    const repo = payload.repository;
    const id = `${repo?.full_name || repo?.name || 'repo'}/${issue?.number}`;
    await updateBugStatus(id, 'resolved');
    // Invalidate cached issue lists for this repo (closed/all)
    try {
      const repoKey = String(repo?.id ?? repo?.full_name ?? repo?.name ?? '');
      await Promise.all([
        cacheDel(keyRepoIssues(repoKey, 'closed')),
        cacheDel(keyRepoIssues(repoKey, 'all')),
      ]);
      inc('cache_invalidate_webhook', { type: 'issues_closed' });
    } catch {
      // Cache invalidation failures are non-fatal for webhook handling.
    }
    return { status: 202 };
  }

  if (event === 'check_run' && payload?.action === 'completed') {
    if (!villageId) return { status: 202 };
    const run = payload.check_run;
    const repo = payload.repository;
    const conclusion = String(run?.conclusion || '').toLowerCase();
    if (conclusion === 'failure') {
      const id = `${repo?.full_name || repo?.name || 'repo'}/check/${run?.id}`;
      await createBugBot({
        id,
        villageId,
        provider: 'github',
        repoId: String(repo?.id ?? ''),
        issueId: String(run?.id ?? ''),
        title: String(run?.name ?? 'Check failure'),
        description: String(run?.output?.summary ?? ''),
        severity: 'high',
        x: undefined,
        y: undefined,
      });
      try {
        inc('bug.created', { source: 'check_run_failure' });
      } catch {
        // Metrics emission best-effort.
      }
      return { status: 202 };
    }
  }

  return { status: 204 };
}

// Minimal GitHub webhook handler for issues events
export async function githubWebhook(req: Request, res: Response) {
  const deliveryId = String(req.header('x-github-delivery') || '');
  // Deduplicate deliveries if Redis is configured
  try {
    const r = getRedis();
    if (r && deliveryId) {
      const key = `gh:webhook:delivery:${deliveryId}`;
      const added = await r.set(key, '1', 'EX', 60 * 5, 'NX'); // 5 min TTL, only set if not exists
      if (added !== 'OK') return res.status(202).json({ ok: true, deduped: true });
    }
  } catch {
    // Redis dedupe unavailable; proceed without early exit.
  }
  // Optional HMAC validation when WEBHOOK_SECRET is configured
  try {
    const secret = (config as any).WEBHOOK_SECRET as string | undefined;
    const sig = req.header('x-hub-signature-256');
    if (secret) {
      if (!sig) return res.status(401).json({ error: 'missing signature' });
      const raw = (req as any).rawBody as Buffer | undefined;
      if (!raw) return res.status(400).json({ error: 'raw body missing' });
      const hmac = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const expected = `sha256=${hmac}`;
      const a = Buffer.from(expected);
      const b = Buffer.from(sig);
      const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!valid) return res.status(401).json({ error: 'invalid signature' });
    }
  } catch {
    return res.status(401).json({ error: 'invalid signature' });
  }
  // Dedupe after signature validation
  if (await shortCircuitDuplicate(req, res)) return;
  const event = String(req.header('x-github-event') || '');
  const signature = String(req.header('x-hub-signature-256') || '');
  const payload = req.body;

  const queued = await enqueueGitHubWebhookEvent({
    deliveryId,
    event,
    signature,
    payload,
    receivedAt: Date.now(),
  });
  if (queued.enqueued) return res.status(202).json({ ok: true, queued: true });

  const out = await processGitHubWebhookEvent(event, payload);
  if (out.status === 202) return res.status(202).json({ ok: true });
  return res.status(204).end();
}
