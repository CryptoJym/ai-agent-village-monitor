import { createSocketServer } from './realtime/server';
import { config } from './config';
import { createApp, setReady } from './app';
import { setIO } from './realtime/io';
import { createQueues } from './queue/queues';
import { startWorkers, stopWorkers } from './queue/workers';
import { closeRedis } from './queue/redis';
import { defaultAgentManager } from './agents/manager';

const app = createApp();
const server = app.listen(config.PORT, () => {
  // Simulate readiness shortly after startup; replace with real checks as needed
  setTimeout(() => setReady(true), 1000);
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${config.PORT}`);
});

// Build Socket.IO server and register for cross-module emits
const io = createSocketServer(server);
setIO(io);

// Start queues/workers if Redis configured and not running tests
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST || process.env.VITEST_WORKER_ID;
const queues = !isTestEnv ? createQueues() : null;
const workers = !isTestEnv ? startWorkers(console) : null;

// Register periodic org resync cron and catch-up on gaps
if (!isTestEnv) {
  import('./scheduler/syncScheduler').then((m) => {
    m.registerOrgResyncCron().then(() => m.catchUpOnWebhookGaps()).catch(() => {});
  }).catch(() => {});
}

async function gracefulShutdown() {
  // eslint-disable-next-line no-console
  console.log('[server] shutting down...');
  await Promise.allSettled([
    workers ? stopWorkers(workers) : Promise.resolve(),
    queues?.events.agentCommands.close(),
    queues?.events.githubSync.close(),
    defaultAgentManager.shutdown(),
  ]);
  await closeRedis();
  server.close();
}

process.on('SIGTERM', () => void gracefulShutdown());
process.on('SIGINT', () => void gracefulShutdown());
