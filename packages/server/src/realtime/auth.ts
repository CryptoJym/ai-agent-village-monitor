import type { Socket, ExtendedError } from 'socket.io';
import { config } from '../config';
import { verifyAccessToken, type JwtPayload } from '../auth/jwt';

// Extend SocketData interface to include user payload
interface SocketData {
  user?: JwtPayload;
}

/**
 * Socket.IO middleware to authenticate connections using a JWT provided via
 * handshake auth (preferred) or query param fallback.
 *
 * In development, if no JWT secret is configured, the middleware allows
 * connections but logs a warning for visibility.
 */
export function socketAuth(
  socket: Socket<any, any, any, SocketData>,
  next: (err?: ExtendedError) => void,
): void {
  const token =
    (socket.handshake.auth as Record<string, unknown> | undefined)?.token ??
    (socket.handshake.query?.token as string | undefined);

  if (!config.JWT_SECRET) {
    // Allow connection in dev/test without strict auth to ease local iteration
    console.warn('[ws] JWT_SECRET is not set; allowing unauthenticated WebSocket connection');
    next();
    return;
  }

  try {
    if (typeof token !== 'string' || token.length === 0) {
      // Allow anonymous socket; join handlers will enforce access rules
      next();
      return;
    }
    const payload = verifyAccessToken(token);
    socket.data.user = payload;
    next();
  } catch {
    const err: ExtendedError = new Error('unauthorized: invalid token');
    err.data = { code: 'WS_INVALID_TOKEN' };
    next(err);
  }
}
