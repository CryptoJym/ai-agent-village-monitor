import { Router } from 'express';
import { validateBody, validateQuery } from '../middleware/validation';
import { RequeueSchema, DlqDeleteBodySchema, DlqDeleteQuerySchema } from '../schemas/http';
import { getRedis } from '../queue/redis';

export const queuesRouter = Router();

function ensureRedis() {
  const r = getRedis();
  if (!r) throw new Error('queue unavailable');
  return r;
}

queuesRouter.get('/queues/agent-commands/dlq', async (_req, res) => {
  try {
    ensureRedis();
    const { Queue } = await import('bullmq');
    const dlq = new Queue('agent-commands-dlq', { connection: getRedis()! });
    const jobs = await dlq.getJobs(['waiting', 'delayed', 'active'], 0, 49);
    const out = jobs.map((j: any) => ({
      id: j.id,
      name: j.name,
      data: j.data,
      failedReason: (j as any).failedReason,
    }));
    return res.json({ ok: true, jobs: out });
  } catch (e: any) {
    const msg = (e?.message || '').toLowerCase();
    if (msg.includes('queue unavailable'))
      return res.status(503).json({ error: 'queue unavailable', code: 'UNAVAILABLE' });
    return res.status(500).json({ error: 'internal error' });
  }
});

queuesRouter.post(
  '/queues/agent-commands/dlq/requeue',
  validateBody(RequeueSchema),
  async (req, res) => {
    try {
      ensureRedis();
      const { Queue } = await import('bullmq');
      const dlq = new Queue('agent-commands-dlq', { connection: getRedis()! });
      const main = new Queue('agent-commands', { connection: getRedis()! });
      const jobId = String((req as any).validatedBody.jobId);
      if (!jobId) return res.status(400).json({ error: 'jobId required', code: 'BAD_REQUEST' });
      const job = await dlq.getJob(jobId);
      if (!job) return res.status(404).json({ error: 'job not found', code: 'NOT_FOUND' });
      await main.add(job.name, job.data, {
        removeOnComplete: { count: 500, age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      });
      await job.remove();
      return res.json({ ok: true });
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('queue unavailable'))
        return res.status(503).json({ error: 'queue unavailable', code: 'UNAVAILABLE' });
      return res.status(500).json({ error: 'internal error' });
    }
  },
);

queuesRouter.delete(
  '/queues/agent-commands/dlq',
  validateBody(DlqDeleteBodySchema),
  validateQuery(DlqDeleteQuerySchema),
  async (req, res) => {
    try {
      ensureRedis();
      const { Queue } = await import('bullmq');
      const dlq = new Queue('agent-commands-dlq', { connection: getRedis()! });
      const jobId = (req as any).validatedBody?.jobId
        ? String((req as any).validatedBody.jobId)
        : '';
      if (jobId) {
        const job = await dlq.getJob(jobId);
        if (!job) return res.status(404).json({ error: 'job not found', code: 'NOT_FOUND' });
        await job.remove();
        return res.json({ ok: true });
      }
      if ((req as any).validatedQuery?.all !== 'true')
        return res.status(400).json({ error: 'missing all=true to purge', code: 'BAD_REQUEST' });
      const jobs = await dlq.getJobs(['waiting', 'delayed', 'active'], 0, 999);
      await Promise.all(jobs.map((j: any) => j.remove()));
      return res.json({ ok: true, purged: jobs.length });
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('queue unavailable'))
        return res.status(503).json({ error: 'queue unavailable', code: 'UNAVAILABLE' });
      return res.status(500).json({ error: 'internal error' });
    }
  },
);
