import type { Socket } from 'socket.io';

export type WsErrorCode =
  | 'E_UNAUTH'
  | 'E_BAD_PAYLOAD'
  | 'E_FORBIDDEN'
  | 'E_RATE_LIMIT'
  | 'E_INTERNAL';

export function emitSocketError(socket: Socket, code: WsErrorCode, message: string, meta?: Record<string, unknown>) {
  const payload = { ok: false, error: { code, message, ...(meta ?? {}) } };
  // Namespaced error event for clients that want to listen globally
  socket.emit('ws_error', payload);
  return payload;
}

// Curry the socket into the handler so Socket.IO can pass (payload, ack)
export function withAck<TPayload>(
  socket: Socket,
  handler: (payload: TPayload) => Promise<{ ok: boolean; [k: string]: unknown }> | { ok: boolean; [k: string]: unknown },
) {
  return async (payload: TPayload, ack?: (resp: unknown) => void) => {
    try {
      const result = await handler(payload);
      if (typeof ack === 'function') ack(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'internal error';
      const resp = emitSocketError(socket, 'E_INTERNAL', message);
      if (typeof ack === 'function') ack(resp);
    }
  };
}

export function createJoinRateLimiter(maxEvents: number, windowMs: number) {
  const buckets = new Map<string, { count: number; windowStart: number }>();
  return {
    check(socketId: string) {
      const now = Date.now();
      const b = buckets.get(socketId) ?? { count: 0, windowStart: now };
      if (now - b.windowStart > windowMs) {
        b.count = 0; b.windowStart = now;
      }
      b.count += 1;
      buckets.set(socketId, b);
      return b.count <= maxEvents;
    },
    reset(socketId: string) {
      buckets.delete(socketId);
    },
  };
}
