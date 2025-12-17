/**
 * Authentication Test Utilities
 * Provides mock JWT authentication for tests
 */

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { signAccessToken } from '../../auth/jwt';

/**
 * Resolve the JWT secret used by the server auth middleware.
 */
function getTestJwtSecret(): string {
  return process.env.JWT_SECRET || 'testsecret';
}

/**
 * Test user payload
 */
export interface TestUserPayload {
  id: string;
  githubId: bigint;
  username: string;
  email?: string;
}

/**
 * Generate a test JWT token
 */
export function generateTestToken(payload: Partial<TestUserPayload> = {}): string {
  const userId = payload.id || 'test-user-id';
  const username = payload.username || 'testuser';
  return signAccessToken(userId, username);
}

/**
 * Generate an expired test token
 */
export function generateExpiredTestToken(payload: Partial<TestUserPayload> = {}): string {
  const userId = payload.id || 'test-user-id';
  const username = payload.username || 'testuser';
  return jwt.sign({ sub: String(userId), username, type: 'access' }, getTestJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: '-1h',
  });
}

/**
 * Generate authorization headers for testing
 */
export function getAuthHeaders(token?: string): Record<string, string> {
  const authToken = token || generateTestToken();
  return {
    Authorization: `Bearer ${authToken}`,
  };
}

/**
 * Generate cookie headers for testing
 */
export function getCookieHeaders(token?: string): Record<string, string> {
  const authToken = token || generateTestToken();
  return {
    Cookie: `access_token=${authToken}`,
  };
}

/**
 * Mock authentication middleware
 * Use this to bypass authentication in tests
 */
export function mockAuthMiddleware(user: Partial<TestUserPayload> = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.user = {
      sub: String(user.id || 'test-user-id'),
      username: user.username || 'testuser',
      type: 'access',
    } as any;
    next();
  };
}

/**
 * Mock GitHub OAuth response
 */
export function mockGitHubUser(override: Record<string, any> = {}) {
  return {
    id: 123456789,
    login: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.png',
    bio: 'Test bio',
    company: 'Test Company',
    location: 'Test Location',
    ...override,
  };
}

/**
 * Mock GitHub OAuth token response
 */
export function mockGitHubTokenResponse(override: Record<string, any> = {}) {
  return {
    access_token: 'gho_test_token_1234567890',
    token_type: 'bearer',
    scope: 'read:user,user:email,read:org',
    ...override,
  };
}

/**
 * Create test session data
 */
export function createTestSession(userId: string = 'test-user-id') {
  return {
    id: `session-${Date.now()}`,
    userId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Decode a test token without verification
 * Useful for inspecting token contents in tests
 */
export function decodeTestToken(token: string): any {
  return jwt.decode(token);
}

/**
 * Verify a test token
 */
export function verifyTestToken(token: string): any {
  return jwt.verify(token, getTestJwtSecret());
}

/**
 * Create mock request with authentication
 */
export function createAuthenticatedRequest(
  user: Partial<TestUserPayload> = {},
  options: {
    method?: string;
    path?: string;
    body?: any;
    query?: any;
    params?: any;
  } = {},
): Partial<Request> {
  return {
    method: options.method || 'GET',
    path: options.path || '/',
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    headers: getAuthHeaders(),
    user: {
      sub: String(user.id || 'test-user-id'),
      username: user.username || 'testuser',
      type: 'access',
    } as any,
  } as Partial<Request>;
}

/**
 * Create mock response for testing
 */
export function createMockResponse(): Partial<Response> {
  const res: any = {
    status: function (code: number) {
      res.statusCode = code;
      return res;
    },
    json: function (data: any) {
      res.body = data;
      return res;
    },
    send: function (data: any) {
      res.body = data;
      return res;
    },
    cookie: function (name: string, value: string, options?: any) {
      res.cookies = res.cookies || {};
      res.cookies[name] = { value, options };
      return res;
    },
    clearCookie: function (name: string) {
      res.clearedCookies = res.clearedCookies || [];
      res.clearedCookies.push(name);
      return res;
    },
    redirect: function (url: string) {
      res.redirectUrl = url;
      return res;
    },
    set: function (field: string, value: string) {
      res.headers = res.headers || {};
      res.headers[field] = value;
      return res;
    },
  };
  return res;
}
