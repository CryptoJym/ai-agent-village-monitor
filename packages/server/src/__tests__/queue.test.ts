import { describe, it, expect } from 'vitest';

const REDIS_URL = process.env.REDIS_URL;
let BullMQ: any;
try {
  BullMQ = require('bullmq');
} catch {
  BullMQ = null;
}

const shouldRun = !!REDIS_URL && !!BullMQ;

describe('queues', () => {
  it.skipIf(!shouldRun)('can enqueue and retrieve a job', async () => {
    const { Queue, Worker } = BullMQ;
    const q = new Queue('test-queue', { connection: { connectionString: REDIS_URL } as any });
    const worker = new Worker('test-queue', async () => ({ ok: true }), {
      connection: { connectionString: REDIS_URL } as any,
    });
    const job = await q.add('hello', { x: 1 });
    expect(job.id).toBeDefined();
    await worker.close();
    await q.close();
  });
});
