import { Queue, type JobsOptions, QueueEvents } from 'bullmq';
import { getRedis } from './redis';

export type AppQueues = {
  agentCommands: Queue;
  githubSync: Queue;
  events: {
    agentCommands: QueueEvents;
    githubSync: QueueEvents;
  };
  defaultJobOpts: JobsOptions;
};

export function createQueues(): AppQueues | null {
  const connection = getRedis();
  if (!connection) return null;

  const defaultJobOpts: JobsOptions = {
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600 },
  };

  const agentCommands = new Queue('agent-commands', {
    connection,
    // @ts-expect-error timeout is valid in BullMQ but not in type definition
    defaultJobOptions: { ...defaultJobOpts, attempts: 5, timeout: 30_000 },
  });
  const githubSync = new Queue('github-sync', {
    connection,
    // @ts-expect-error timeout is valid in BullMQ but not in type definition
    defaultJobOptions: { ...defaultJobOpts, attempts: 8, timeout: 120_000 },
    limiter: { max: 5, duration: 1000 },
  });

  const events = {
    agentCommands: new QueueEvents('agent-commands', { connection }),
    githubSync: new QueueEvents('github-sync', { connection }),
  };

  return { agentCommands, githubSync, events, defaultJobOpts };
}
