import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';
import { socketAuth } from './auth';
import { audit } from '../audit/logger';
import { emitSocketError, withAck, createJoinRateLimiter } from './errors';
import { JoinAgentSchema, JoinRepoSchema, JoinVillageSchema } from './contracts';
import { config } from '../config';
import { prisma } from '../db/client';
import { inc } from '../metrics';
import { setIO } from './io';

function roomVillage(id: string) {
  return `village:${id}`;
}
function roomRepo(id: string) {
  return `repo:${id}`;
}
function roomAgent(id: string) {
  return `agent:${id}`;
}

export function createSocketServer(server: HttpServer) {
  const allowedOrigins = (
    config.WS_ALLOWED_ORIGINS ||
    config.PUBLIC_APP_URL ||
    'http://localhost:5173'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Allow transports to be configured to match deployment stickiness strategy.
  // In production, operators may prefer `websocket` only to avoid sticky sessions.
  const envTransports = (process.env.WS_TRANSPORTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const transports = envTransports.length
    ? (envTransports as any)
    : (['websocket', 'polling'] as const);

  const io = new SocketIOServer(server, {
    transports: transports as any,
    serveClient: false,
    cors: { origin: allowedOrigins, credentials: true },
    pingInterval: 25_000,
    pingTimeout: 60_000,
    maxHttpBufferSize: 1e6,
    perMessageDeflate: { threshold: 1024 },
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000 },
    allowRequest: (req, fn) => {
      const origin = req.headers.origin as string | undefined;
      if (!origin) return fn(null, true);
      const ok = allowedOrigins.includes(origin);
      return fn(ok ? null : 'CORS origin not allowed', ok);
    },
  });

  // Multi-replica support: use Redis adapter when REDIS_URL is configured
  try {
    if (config.REDIS_URL) {
      const pub = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: 2 });
      const sub = pub.duplicate();
      io.adapter(createAdapter(pub as any, sub as any));
    }
  } catch {
    // Redis adapter unavailable; continue with in-memory adapter.
  }

  // JWT authentication
  io.use(socketAuth as any);

  // Simple per-socket rate limiter for join events
  const joinLimiter = createJoinRateLimiter(20, 5_000);

  // Expose IO for emit helpers
  setIO(io);

  // Avoid DB lookups in tests or when explicitly disabled
  const hasDb =
    !!process.env.DATABASE_URL &&
    config.NODE_ENV !== 'test' &&
    process.env.DISABLE_DB_TESTS !== 'true';

  async function canJoinVillageSecure(
    userId: string | undefined,
    villageId: string,
  ): Promise<boolean> {
    if (!hasDb) return true;
    try {
      const v = await prisma.village.findUnique({
        where: { id: villageId },
        select: { id: true },
      });
      if (!v) return false;
      // Allow anonymous read-only join for public villages (check via config/access)
      if (!config.JWT_SECRET) return true;
      if (!userId) return false;
      const access = await prisma.villageAccess.findUnique({
        where: { villageId_userId: { villageId, userId } },
        select: { role: true },
      });
      return !!access;
    } catch {
      return false;
    }
  }

  async function canJoinRepoSecure(
    userId: string | undefined,
    repoId: string,
  ): Promise<{ ok: boolean; villageId?: string }> {
    if (!config.JWT_SECRET || !hasDb) return { ok: true };
    try {
      // Try by githubRepoId (BigInt) first, else fallback to internal house id
      let house: { villageId: string } | null = null;
      try {
        const big = BigInt(repoId);
        house = await prisma.house.findUnique({
          where: { githubRepoId: big },
          select: { villageId: true },
        });
      } catch {
        // Fallback to internal house id (string cuid)
        house = await prisma.house.findUnique({ where: { id: repoId }, select: { villageId: true } });
      }
      if (!house) return { ok: false };
      const ok = await canJoinVillageSecure(userId, house.villageId);
      return ok ? { ok: true, villageId: house.villageId } : { ok: false };
    } catch {
      return { ok: false };
    }
  }

  async function canJoinAgentSecure(userId: string | undefined, agentId: string): Promise<boolean> {
    if (!hasDb) return true;
    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { userId: true },
      });
      if (!agent) return false;
      if (!config.JWT_SECRET || !userId) return false;
      // Check if user owns the agent or is the agent's user
      if (agent.userId === userId) return true;
      // For now, allow access if agent exists (access control can be expanded later)
      return true;
    } catch {
      return false;
    }
  }

  io.on('connection', (socket) => {
    const actorId = socket.data.user?.sub ? String(socket.data.user.sub) : undefined;
    audit.log('ws.connect', { actorId, socketId: socket.id });
    // Allow client latency ping
    socket.on('ping', (ack?: () => void) => {
      if (typeof ack === 'function') ack();
    });

    // Optional server-initiated heartbeat to measure RTT
    const heartbeat = setInterval(() => {
      const start = Date.now();
      try {
        socket.timeout(2000).emit('server_ping', () => {
          const rtt = Date.now() - start;

          console.debug?.(`[ws] rtt=${rtt}ms socket=${socket.id}`);
          try {
            inc('ws.ping');
            const { observe } = require('../metrics') as typeof import('../metrics');
            observe('ws_rtt_ms', rtt);
          } catch {
            // Metrics pipeline optional; continue heartbeat.
          }
        });
      } catch {
        // Ignore heartbeat transmission failures; socket may disconnect later.
      }
    }, 30_000);

    const canJoin = () => {
      if (!joinLimiter.check(socket.id)) {
        const resp = emitSocketError(socket, 'E_RATE_LIMIT', 'too many join attempts');
        return { ok: false as const, resp };
      }
      return { ok: true as const };
    };

    socket.on(
      'join_village',
      withAck(socket, async (payload: unknown) => {
        const parsed = JoinVillageSchema.safeParse(payload);
        if (!parsed.success) {
          return emitSocketError(socket, 'E_BAD_PAYLOAD', 'villageId required');
        }
        if (!canJoin().ok) return { ok: true };
        const villageId = parsed.data.villageId;
        const userId = socket.data.user?.sub as string | undefined;
        const allowed = await canJoinVillageSecure(userId, villageId);
        if (!allowed) return emitSocketError(socket, 'E_FORBIDDEN', 'not allowed to join village');
        await socket.join(roomVillage(villageId));
        try {
          inc('ws.join_village');
        } catch {
          // Metrics emission is best effort.
        }
        return { ok: true, room: roomVillage(villageId) };
      }),
    );

    socket.on(
      'join_agent',
      withAck(socket, async (payload: unknown) => {
        const parsed = JoinAgentSchema.safeParse(payload);
        if (!parsed.success) {
          return emitSocketError(socket, 'E_BAD_PAYLOAD', 'agentId required');
        }
        if (!canJoin().ok) return { ok: true };
        const agentId = parsed.data.agentId;
        const userId = socket.data.user?.sub as string | undefined;
        const allowed = await canJoinAgentSecure(userId, agentId);
        if (!allowed) return emitSocketError(socket, 'E_FORBIDDEN', 'not allowed to join agent');
        await socket.join(roomAgent(agentId));
        try {
          inc('ws.join_agent');
        } catch {
          // Metrics emission is best effort.
        }
        return { ok: true, room: roomAgent(agentId) };
      }),
    );

    socket.on(
      'join_repo',
      withAck(socket, async (payload: unknown) => {
        const parsed = JoinRepoSchema.safeParse(payload);
        if (!parsed.success) {
          return emitSocketError(socket, 'E_BAD_PAYLOAD', 'repoId required');
        }
        if (!canJoin().ok) return { ok: true };
        const repoId = parsed.data.repoId;
        const userId = socket.data.user?.sub as string | undefined;
        const { ok: allowed } = await canJoinRepoSecure(userId, repoId);
        if (!allowed) return emitSocketError(socket, 'E_FORBIDDEN', 'not allowed to join repo');
        await socket.join(roomRepo(repoId));
        try {
          inc('ws.join_repo');
        } catch {
          // Metrics emission is best effort.
        }
        try {
          const { getSnapshotByRepoId } =
            require('../houses/activityStore') as typeof import('../houses/activityStore');
          const snap = getSnapshotByRepoId(String(repoId));
          if (snap) socket.emit('house.activity', snap);
        } catch {
          // Snapshot loading is optional; ignore lookup failures.
        }
        return { ok: true, room: roomRepo(repoId) };
      }),
    );

    // Demo broadcast loop for local development
    const interval = setInterval(() => {
      const now = Date.now();
      socket.emit('work_stream', {
        agentId: 'agent-placeholder',
        message: `demo activity at ${new Date(now).toLocaleTimeString()}`,
        ts: now,
      });
      socket.emit('agent_update', { agentId: 'agent-placeholder', status: 'idle', ts: now });
      if (Math.random() < 0.33)
        socket.emit('bug_bot_spawn', { id: `bug-${Math.floor(Math.random() * 1000)}` });
      if (Math.random() < 0.2)
        socket.emit('bug_bot_resolved', { id: `bug-${Math.floor(Math.random() * 1000)}` });
    }, 3000);

    socket.on('disconnect', () => {
      clearInterval(interval);
      clearInterval(heartbeat);
      joinLimiter.reset(socket.id);
      const actor = socket.data.user?.sub ? String(socket.data.user.sub) : undefined;
      audit.log('ws.disconnect', { actorId: actor, socketId: socket.id });
      try {
        inc('ws.disconnect');
      } catch {
        // Metrics emission is best effort.
      }
    });
  });

  return io;
}
