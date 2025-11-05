import type { ApplicationFunctionOptions } from 'probot';

export function registerProbotHandlers(app: any) {
  app.on('issues.opened', async (context: any) => {
    const { rememberDelivery } = await import('../webhooks/dedupe');
    const first = await rememberDelivery(String(context.id || ''));
    if (!first) return;
    try {
      const issue = context.payload.issue;
      const repo = context.payload.repository;
      const id = `${repo?.full_name || repo?.name || 'repo'}/${issue?.number}`;
      const { createBugBot } = await import('../bugs/service');
      const { resolveVillageAndHouse } = await import('../github/mapping');
      const mapping = await resolveVillageAndHouse(context.payload);
      await createBugBot({
        id,
        villageId: mapping.villageId,
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
    } catch {
      // Ignore failures creating bug bot; webhook already acknowledged.
    }
  });

  app.on('issues.closed', async (context: any) => {
    const { rememberDelivery } = await import('../webhooks/dedupe');
    const first = await rememberDelivery(String(context.id || ''));
    if (!first) return;
    try {
      const issue = context.payload.issue;
      const repo = context.payload.repository;
      const id = `${repo?.full_name || repo?.name || 'repo'}/${issue?.number}`;
      const { updateBugStatus } = await import('../bugs/service');
      await updateBugStatus(id, 'resolved');
    } catch {
      // Ignore failures updating bug status; webhook already acknowledged.
    }
  });

  app.on('check_run.completed', async (context: any) => {
    const { rememberDelivery } = await import('../webhooks/dedupe');
    const first = await rememberDelivery(String(context.id || ''));
    if (!first) return;
    try {
      const cr = context.payload.check_run;
      const repo = context.payload.repository;
      const conclusion = String(cr?.conclusion || '').toLowerCase();
      const failed = ['failure', 'timed_out', 'action_required', 'cancelled', 'stalled'].includes(
        conclusion,
      );
      if (!failed) return; // only create bot on failed conclusions

      const sha = String(cr?.head_sha || 'unknown');
      const name = String(cr?.name || 'check');
      const id = `${repo?.full_name || repo?.name || 'repo'}/${sha}/check:${name}`;
      const title = `CI failed: ${name}`;
      const summary = String(cr?.output?.summary || cr?.output?.title || '');
      const detailsUrl = String(cr?.details_url || '');
      const description = summary || (detailsUrl ? `See details: ${detailsUrl}` : '');

      const { createBugBot } = await import('../bugs/service');
      const { resolveVillageAndHouse } = await import('../github/mapping');
      const mapping = await resolveVillageAndHouse(context.payload);
      await createBugBot({
        id,
        villageId: mapping.villageId,
        provider: 'github',
        repoId: String(repo?.id ?? ''),
        issueId: id,
        issueNumber: null as any,
        title,
        description,
        severity: 'high' as any,
        x: mapping.x,
        y: mapping.y,
        ...(mapping.houseId ? { houseId: mapping.houseId } : {}),
      });
    } catch {
      // Ignore failures creating bug bot; webhook already acknowledged.
    }
  });
}

export async function getProbotMiddleware() {
  // Dynamic ESM import to keep CJS compatibility
  const { Probot, createNodeMiddleware } = await import('probot');
  const appFn = (app: any) => registerProbotHandlers(app);

  const appId = process.env.GITHUB_APP_ID as string | undefined;
  const privateKey = process.env.GITHUB_PRIVATE_KEY as string | undefined;
  const secret = (process.env.GITHUB_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET) as
    | string
    | undefined;
  if (!appId || !privateKey || !secret) {
    throw new Error(
      'Probot env missing (GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET)',
    );
  }
  const probot = new Probot({ appId, privateKey, secret });
  const middleware = createNodeMiddleware(appFn as any, { probot } as any);
  return middleware;
}
