import type { Socket } from 'socket.io';
import type { NextFunction } from 'express';
import { config } from '../config';
import { verifyAccessToken, type JwtPayload } from '../auth/jwt';

declare module 'socket.io' {
  interface Socket {
    data: {
      user?: JwtPayload;
      [key: string]: any;
    };
  }
}

/**
 * Socket.IO middleware to authenticate connections using a JWT provided via
 * handshake auth (preferred) or query param fallback.
 *
 * In development, if no JWT secret is configured, the middleware allows
 * connections but logs a warning for visibility.
 */
export function socketAuth(socket: Socket, next: NextFunction) {
  const token =
    (socket.handshake.auth as Record<string, unknown> | undefined)?.token ??
    (socket.handshake.query?.token as string | undefined);

  if (!config.JWT_SECRET) {
    // Allow connection in dev/test without strict auth to ease local iteration
    console.warn('[ws] JWT_SECRET is not set; allowing unauthenticated WebSocket connection');
    return next();
  }

  try {
    if (typeof token !== 'string' || token.length === 0) {
      // Allow anonymous socket; join handlers will enforce access rules
      return next();
    }
    const payload = verifyAccessToken(token);
    socket.data.user = payload;
    return next();
  } catch {
    const err = new Error('unauthorized: invalid token');
    // @ts-expect-error attach code for client-side handling
    err.data = { code: 'WS_INVALID_TOKEN' };
    return next(err);
  }
}
