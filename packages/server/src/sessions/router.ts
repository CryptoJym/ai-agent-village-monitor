/**
 * Sessions Router
 *
 * Handles agent session registration and event streaming from
 * terminal-based AI agents connected via the village-bridge CLI.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { emitToVillage, emitToAgent } from '../realtime/io';
import { sanitizeString } from '../middleware/sanitize';

export const sessionsRouter = Router();

/**
 * Schema for registering a new agent session
 */
const RegisterSessionSchema = z.object({
  sessionId: z.string().min(1).max(100),
  agentId: z.string().min(1).max(100),
  agentType: z.enum(['claude', 'aider', 'codex', 'cursor', 'custom']),
  agentName: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v ? sanitizeString(v, { maxLen: 200 }) : v)),
  repoPath: z.string().max(500),
  villageId: z.string().min(1).max(100),
});

/**
 * POST /api/sessions
 * Register a new agent session from a terminal bridge
 */
sessionsRouter.post('/sessions', async (req, res, next) => {
  try {
    const parsed = RegisterSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        code: 'BAD_REQUEST',
        details: parsed.error.flatten(),
      });
    }

    const { sessionId, agentId, agentType, agentName, repoPath, villageId } = parsed.data;

    // Verify village exists (if configured with DB)
    try {
      const village = await prisma.village.findUnique({
        where: { id: villageId },
        select: { id: true },
      });
      if (!village) {
        return res.status(404).json({
          error: 'Village not found',
          code: 'NOT_FOUND',
        });
      }
    } catch {
      // Continue if DB check fails (might be disabled)
    }

    // Upsert the agent
    const agent = await prisma.agent.upsert({
      where: { id: agentId },
      update: {
        name: agentName || `${agentType}-agent`,
        status: 'connected',
        updatedAt: new Date(),
        config: {
          agentType,
          repoPath,
          lastSessionId: sessionId,
        } as any,
      },
      create: {
        id: agentId,
        name: agentName || `${agentType}-agent`,
        status: 'connected',
        config: {
          agentType,
          repoPath,
        } as any,
      },
    });

    // Create the session
    const session = await prisma.agentSession.create({
      data: {
        id: sessionId,
        agentId,
        state: JSON.stringify({
          agentType,
          repoPath,
          villageId,
          status: 'active',
        }),
      },
    });

    // Notify the village of the new agent
    emitToVillage(villageId, 'agent_spawn', {
      agentId,
      sessionId,
      agentType,
      agentName: agentName || `${agentType}-agent`,
      repoPath,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
      },
      session: {
        id: session.id,
        agentId: session.agentId,
        startedAt: session.startedAt,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Schema for work stream events
 */
const WorkStreamEventSchema = z.object({
  agentId: z.string().min(1).max(100),
  sessionId: z.string().min(1).max(100),
  type: z.enum([
    'session_start',
    'session_end',
    'thinking',
    'file_read',
    'file_edit',
    'file_create',
    'file_delete',
    'command',
    'tool_use',
    'search',
    'output',
    'error',
    'completed',
    'status_change',
  ]),
  payload: z.record(z.unknown()).optional().default({}),
  timestamp: z.string().datetime().optional(),
});

const BatchEventsSchema = z.object({
  events: z.array(WorkStreamEventSchema).max(100),
});

/**
 * POST /api/events
 * Record a single work stream event
 */
sessionsRouter.post('/events', async (req, res, next) => {
  try {
    const parsed = WorkStreamEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid event',
        code: 'BAD_REQUEST',
        details: parsed.error.flatten(),
      });
    }

    const { agentId, sessionId, type, payload, timestamp } = parsed.data;

    // Create the event
    const event = await prisma.workStreamEvent.create({
      data: {
        agentId,
        message: JSON.stringify({ type, ...payload }),
        ts: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    // Broadcast to subscribers
    emitToAgent(agentId, 'work_stream_event', {
      id: event.id,
      agentId,
      sessionId,
      type,
      payload,
      timestamp: event.ts.toISOString(),
    });

    res.status(201).json({ id: event.id });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/events/batch
 * Record multiple work stream events in a single request
 */
sessionsRouter.post('/events/batch', async (req, res, next) => {
  try {
    const parsed = BatchEventsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid batch request',
        code: 'BAD_REQUEST',
        details: parsed.error.flatten(),
      });
    }

    const { events } = parsed.data;
    const results: string[] = [];

    // Process events in batches
    for (const evt of events) {
      const { agentId, sessionId, type, payload, timestamp } = evt;

      const event = await prisma.workStreamEvent.create({
        data: {
          agentId,
          message: JSON.stringify({ type, ...payload }),
          ts: timestamp ? new Date(timestamp) : new Date(),
        },
      });

      results.push(event.id);

      // Broadcast to subscribers (batched events still get real-time updates)
      emitToAgent(agentId, 'work_stream_event', {
        id: event.id,
        agentId,
        sessionId,
        type,
        payload,
        timestamp: event.ts.toISOString(),
      });
    }

    res.status(201).json({ ids: results, count: results.length });
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/sessions/:id/end
 * End an agent session
 */
sessionsRouter.put('/sessions/:id/end', async (req, res, next) => {
  try {
    const sessionId = req.params.id;

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'NOT_FOUND',
      });
    }

    // Update session
    const updated = await prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        state: JSON.stringify({
          ...(session.state ? JSON.parse(session.state as string) : {}),
          status: 'ended',
        }),
      },
    });

    // Update agent status
    await prisma.agent.update({
      where: { id: session.agentId },
      data: { status: 'offline' },
    });

    // Parse state to get villageId for notification
    let villageId: string | undefined;
    try {
      const state = session.state ? JSON.parse(session.state as string) : {};
      villageId = state.villageId;
    } catch {
      // Ignore parse errors
    }

    if (villageId) {
      emitToVillage(villageId, 'agent_disconnect', {
        agentId: session.agentId,
        sessionId,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      session: {
        id: updated.id,
        agentId: updated.agentId,
        startedAt: updated.startedAt,
        endedAt: updated.endedAt,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/sessions/active
 * List all active agent sessions
 */
sessionsRouter.get('/sessions/active', async (_req, res, next) => {
  try {
    const sessions = await prisma.agentSession.findMany({
      where: {
        endedAt: null,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    res.json(
      sessions.map((s) => {
        let state: Record<string, unknown> = {};
        try {
          state = s.state ? JSON.parse(s.state as string) : {};
        } catch {
          // Ignore parse errors
        }
        return {
          id: s.id,
          agentId: s.agentId,
          agentName: s.agent?.name,
          agentStatus: s.agent?.status,
          agentType: state.agentType,
          repoPath: state.repoPath,
          villageId: state.villageId,
          startedAt: s.startedAt,
        };
      })
    );
  } catch (e) {
    next(e);
  }
});
