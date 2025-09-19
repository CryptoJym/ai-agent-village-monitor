import jwt from 'jsonwebtoken';
import { config } from '../config';

let warned = false;
function getJwtSecret(): string {
  const s = process.env.JWT_SECRET || config.JWT_SECRET || '';
  if (!s && !warned) {
    console.warn('[auth] JWT_SECRET not set; auth endpoints will error.');
    warned = true;
  }
  return s;
}

export type JwtPayload = {
  sub: string; // user id
  username: string;
  type: 'access' | 'refresh';
  jti?: string; // token id for refresh rotation
};

export function signAccessToken(userId: number, username: string): string {
  const JWT_SECRET = getJwtSecret();
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  const payload: JwtPayload = { sub: String(userId), username, type: 'access' };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

export function signRefreshToken(userId: number, username: string, jti: string): string {
  const JWT_SECRET = getJwtSecret();
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  const payload: JwtPayload = { sub: String(userId), username, type: 'refresh', jti };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
}

export function verifyAccessToken(token: string): JwtPayload {
  const JWT_SECRET = getJwtSecret();
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  if (decoded.type !== 'access') throw new Error('invalid token type');
  return decoded;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const JWT_SECRET = getJwtSecret();
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  if (decoded.type !== 'refresh') throw new Error('invalid token type');
  return decoded;
}
