import { Worker, type Processor, type WorkerOptions } from 'bullmq';
import { getRedis } from './redis';
import { setVillageLastSynced } from '../villages/service';
import { syncVillageNow } from '../villages/sync';
import { getAgentController } from '../agents/controller';
import { getPrisma } from '../db';
import { audit } from '../audit/logger';
import { appendEvent, endActiveSession, ensureActiveSession } from '../agents/session';

export type WorkerHandles = {
  agentCommands?: Worker;
  githubSync?: Worker;
};

export function startWorkers(log = console): WorkerHandles | null {
  const connection = getRedis();
  if (!connection) return null;

  const baseOpts: WorkerOptions = {
    connection,
    concurrency: 5,
    lockDuration: 30000,
    autorun: true,
  };

  const agentProc: Processor = async (job) => {
    log.info?.(`[worker] agent-commands processing ${job.id} ${job.name}`);
    const data = job.data as any;
    const kind: 'start' | 'stop' | 'command' = job.name as any;
    const agentIdRaw = data?.agentId;
    const agentIdStr = String(agentIdRaw);
    const { emitToAgent } = await import('../realtime/io');
    const prisma = getPrisma();
    const controller = getAgentController();

    try {
      if (kind === 'start') {
        // Persist session + status if DB available
        let sessionId: string | undefined;
        if (prisma) {
          const session = await ensureActiveSession(agentIdStr, { restart: !!data?.restart });
          sessionId = (session as any).id as string;
          try {
            await prisma.agent.update({ where: { id: agentIdStr }, data: { status: 'working' } });
          } catch {
            // Status update failure is non-critical; continue session start.
          }
          await appendEvent(sessionId!, 'session_started', 'agent session started');
        }
        audit('agent.session_starting', { agentId: agentIdStr, jobId: String(job.id), sessionId });
        await controller.start(agentIdRaw);
        try {
          const { audit } = await import('../audit/logger');
          audit({
            type: 'session_started',
            agentId: agentIdStr,
            sessionId,
            jobId: String(job.id),
            ts: Date.now(),
          });
        } catch {
          // Audit logging failure should not block job success.
        }
        emitToAgent(agentIdStr, 'agent_update', {
          agentId: agentIdStr,
          status: 'working',
          ts: Date.now(),
        });
        emitToAgent(agentIdStr, 'work_stream', {
          agentId: agentIdStr,
          message: 'session started',
          ts: Date.now(),
        });
        audit('agent.session_started', { agentId: agentIdStr, jobId: String(job.id), sessionId });
      } else if (kind === 'stop') {
        audit('agent.session_stopping', { agentId: agentIdStr, jobId: String(job.id) });
        await controller.stop(agentIdRaw);
        if (prisma) {
          await endActiveSession(agentIdStr);
          try {
            await prisma.agent.update({ where: { id: agentIdStr }, data: { status: 'idle' } });
          } catch {
            // Status update failure is non-critical; continue shutdown.
          }
        }
        try {
          const { audit } = await import('../audit/logger');
          audit({
            type: 'session_stopped',
            agentId: agentIdStr,
            jobId: String(job.id),
            ts: Date.now(),
          });
        } catch {
          // Audit logging failure should not block job success.
        }
        emitToAgent(agentIdStr, 'work_stream', {
          agentId: agentIdStr,
          message: 'session stopped',
          ts: Date.now(),
        });
        emitToAgent(agentIdStr, 'agent_update', {
          agentId: agentIdStr,
          status: 'idle',
          ts: Date.now(),
        });
        audit('agent.session_stopped', { agentId: agentIdStr, jobId: String(job.id) });
      } else if (kind === 'command') {
        const cmd = String(data?.command || '');
        const args = (data?.args || {}) as Record<string, unknown>;
        let sessionId: string | undefined;
        if (prisma) {
          const session = await ensureActiveSession(agentIdStr);
          sessionId = (session as any).id as string;
          await appendEvent(sessionId!, 'command_received', `command: ${cmd}`, { args });
        }
        try {
          const { audit } = await import('../audit/logger');
          audit({
            type: 'command_enqueued',
            agentId: agentIdStr,
            sessionId,
            jobId: String(job.id),
            data: { cmd },
            ts: Date.now(),
          });
        } catch {
          // Audit logging failure should not block command execution.
        }
        audit('agent.command_started', {
          agentId: agentIdStr,
          jobId: String(job.id),
          command: cmd,
        });
        emitToAgent(agentIdStr, 'work_stream', {
          agentId: agentIdStr,
          message: `command received: ${cmd}`,
          ts: Date.now(),
        });
        const runWithStream = (runner: () => Promise<CommandResult>) => runner();
        const runner = async () => {
          if (controller.runTool && cmd === 'run_tool') {
            const tool = String((args as any)?.tool || '');
            const params = (args as any)?.params || {};
            return controller.runTool(agentIdRaw, tool, params, streamOpts);
          }
          if (controller.runTask && (cmd === 'run_task' || cmd === 'runTask')) {
            const desc = String((args as any)?.description || (args as any)?.text || '');
            return controller.runTask(agentIdRaw, desc, streamOpts);
          }
          return controller.runCommand(agentIdRaw, cmd, args, streamOpts);
        };
        const streamOpts = {
          onEvent: async (evt) => {
            try {
              if (evt.type === 'log' && evt.message) {
                emitToAgent(agentIdStr, 'work_stream', {
                  agentId: agentIdStr,
                  message: evt.message,
                  ts: Date.now(),
                });
                if (prisma && sessionId) await appendEvent(sessionId, 'log', evt.message);
              } else if (evt.type === 'progress') {
                emitToAgent(agentIdStr, 'work_stream', {
                  agentId: agentIdStr,
                  message: `progress: ${Math.round((evt.progress || 0) * 100)}%`,
                  ts: Date.now(),
                  progress: evt.progress,
                });
                if (prisma && sessionId)
                  await appendEvent(sessionId, 'progress', undefined, {
                    progress: evt.progress,
                    data: evt.data,
                  });
              } else if (evt.type === 'status') {
                emitToAgent(agentIdStr, 'agent_update', {
                  agentId: agentIdStr,
                  status: evt.message || 'working',
                  ts: Date.now(),
                });
                if (prisma && sessionId) await appendEvent(sessionId, 'status', evt.message);
              } else if (evt.type === 'error') {
                emitToAgent(agentIdStr, 'work_stream', {
                  agentId: agentIdStr,
                  message: evt.message || 'error',
                  ts: Date.now(),
                });
                if (prisma && sessionId)
                  await appendEvent(sessionId, 'error', evt.message, evt.data);
              }
            } catch {
              // Ignore streaming side-effect failures; continue emitting events.
            }
          },
        } as any;
        const result = await runWithStream(runner);
        if (prisma && sessionId) {
          await appendEvent(
            sessionId,
            result.ok ? 'command_completed' : 'command_failed',
            result.ok ? 'ok' : result.error || 'error',
            result,
          );
        }
        try {
          const { audit } = await import('../audit/logger');
          audit({
            type: result.ok ? 'command_completed' : 'command_failed',
            agentId: agentIdStr,
            sessionId,
            jobId: String(job.id),
            data: { cmd, result: result.ok ? 'ok' : result.error },
            ts: Date.now(),
          });
        } catch {
          // Audit logging failure should not block job completion.
        }
        emitToAgent(agentIdStr, 'work_stream', {
          agentId: agentIdStr,
          message: result.ok ? `command completed: ${cmd}` : `command failed: ${cmd}`,
          ts: Date.now(),
        });
        audit(result.ok ? 'agent.command_completed' : 'agent.command_failed', {
          agentId: agentIdStr,
          jobId: String(job.id),
          command: cmd,
          ok: result.ok,
        });
      }
    } catch (e: any) {
      log.error?.('[worker] agent-commands error', { jobId: job.id, err: e?.message });
      try {
        audit(
          'agent.command_error',
          { agentId: agentIdStr, jobId: String(job.id), error: e?.message },
          'error',
        );
      } catch {
        // Ignore audit logging failure here; rethrow original error.
      }
      throw e;
    }
    return { ok: true, jobId: job.id };
  };

  const syncProc: Processor = async (job) => {
    log.info?.(`[worker] github-sync processing ${job.id} ${job.name}`, { data: job.data });
    const villageId = String((job.data as any)?.villageId || '');
    const org = String((job.data as any)?.org || '');
    if (!villageId || !org)
      throw new Error('invalid job payload');
    const result = await syncVillageNow(villageId, org);
    try {
      await setVillageLastSynced(villageId, new Date());
    } catch (e: any) {
      log.error?.('[worker] github-sync lastSynced update failed', { villageId, err: e?.message });
    }
    log.info?.('[worker] github-sync completed', { jobId: job.id, ...result });
    return { ok: true, jobId: job.id, ...result };
  };

  const agentCommands = new Worker('agent-commands', agentProc, baseOpts);
  // Dead-letter queue for exhausted jobs
  // We create the DLQ lazily here to avoid forcing it elsewhere
  const { Queue } = require('bullmq');
  const dlq = new Queue('agent-commands-dlq', { connection });
  const githubSync = new Worker('github-sync', syncProc, baseOpts);

  agentCommands.on('failed', async (job, err) => {
    log.error?.('[worker] agent-commands failed', { jobId: job?.id, err: err?.message });
    try {
      const attempts = job?.opts?.attempts ?? 1;
      const made = job?.attemptsMade ?? 0;
      if (made >= attempts) {
        await dlq.add(
          'failed',
          { name: job?.name, data: job?.data, failedReason: err?.message },
          { removeOnComplete: 1000, removeOnFail: 1000 },
        );
        const { emitToAgent } = await import('../realtime/io');
        const agentId = String((job?.data as any)?.agentId ?? 'unknown');
        emitToAgent(agentId, 'work_stream', {
          agentId,
          message: `command failed permanently: ${job?.name}`,
          error: err?.message,
          ts: Date.now(),
        });
        try {
          audit(
            'agent.command_dlq',
            { agentId, jobId: String(job?.id), name: job?.name, error: err?.message },
            'error',
          );
        } catch {
          // Ignore audit logging failure; DLQ entry already recorded.
        }
      }
    } catch {
      // Swallow DLQ handling errors to avoid crashing worker listener.
    }
  });
  githubSync.on('failed', (job, err) =>
    log.error?.('[worker] github-sync failed', { jobId: job?.id, err: err?.message }),
  );

  return { agentCommands, githubSync };
}

export async function stopWorkers(handles?: WorkerHandles) {
  if (!handles) return;
  await Promise.allSettled([handles.agentCommands?.close(), handles.githubSync?.close()]);
}
