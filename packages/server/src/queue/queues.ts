import { Queue, type JobsOptions, QueueEvents } from 'bullmq';
import { getRedis } from './redis';

export type AppQueues = {
  agentCommands: Queue;
  githubSync: Queue;
  repoAnalysis: Queue;
  events: {
    agentCommands: QueueEvents;
    githubSync: QueueEvents;
    repoAnalysis: QueueEvents;
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
    defaultJobOptions: { ...defaultJobOpts, attempts: 5 },
  });
  const githubSync = new Queue('github-sync', {
    connection,
    defaultJobOptions: { ...defaultJobOpts, attempts: 8 },
  });
  const repoAnalysis = new Queue('repo-analysis', {
    connection,
    defaultJobOptions: { ...defaultJobOpts, attempts: 5 },
  });

  const events = {
    agentCommands: new QueueEvents('agent-commands', { connection }),
    githubSync: new QueueEvents('github-sync', { connection }),
    repoAnalysis: new QueueEvents('repo-analysis', { connection }),
  };

  return { agentCommands, githubSync, repoAnalysis, events, defaultJobOpts };
}
