import { createQueues } from '../queue/queues';
import { prisma } from '../db/client';

export async function registerOrgResyncCron() {
  const queues = createQueues();
  if (!queues) return;
  try {
    const villages = await prisma.village.findMany({ select: { id: true, orgName: true, config: true } });
    for (const v of villages) {
      const cfg: any = v.config || {};
      const org = typeof cfg.org === 'string' ? cfg.org : v.orgName;
      const jobId = `cron:githubSync:village:${v.id}`;
      await queues.githubSync.add('sync', { villageId: v.id, org }, {
        jobId,
        repeat: { every: 15 * 60 * 1000 }, // every 15 minutes
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[scheduler] failed to register org resync cron', e);
  }
}

export async function catchUpOnWebhookGaps(maxAgeMinutes = 30) {
  const queues = createQueues();
  if (!queues) return;
  const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
  try {
    const rows = await prisma.village.findMany({ select: { id: true, orgName: true, config: true, updatedAt: true } });
    for (const v of rows) {
      // If village hasn't been updated recently, enqueue a catch-up sync
      const last = v.updatedAt?.getTime?.() ?? 0;
      if (last < cutoff) {
        const cfg: any = v.config || {};
        const org = typeof cfg.org === 'string' ? cfg.org : v.orgName;
        const jobId = `catchup:githubSync:village:${v.id}`;
        await queues.githubSync.add('sync', { villageId: v.id, org }, { jobId });
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[scheduler] failed to enqueue catch-up syncs', e);
  }
}

