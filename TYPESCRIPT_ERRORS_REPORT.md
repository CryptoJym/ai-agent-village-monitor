# TypeScript Type Check Error Analysis & Fixes

## Summary
- **Total Errors**: 78 (excluding duplicates)
- **Critical Issues**: 5 categories
- **Files Affected**: 12 core files
- **Status**: Fixable without major refactoring

---

## 1. MISSING TYPE DEFINITION PACKAGES

**Severity**: High | **Count**: 5 errors

### 1.1 Missing @types Packages
The following packages are imported but lack TypeScript definitions:

| Package | Location | Fix |
|---------|----------|-----|
| `cors` | src/app.ts:2 | Install: `pnpm add -D @types/cors` |
| `compression` | src/app.ts:4 | Install: `pnpm add -D @types/compression` |
| `morgan` | src/app.ts:5 | Install: `pnpm add -D @types/morgan` |
| `cookie-parser` | src/app.ts:6 | Install: `pnpm add -D @types/cookie-parser` |
| `jsonwebtoken` | src/auth/jwt.ts:1 | Install: `pnpm add -D @types/jsonwebtoken` |

**Quick Fix Commands**:
```bash
pnpm add -D @types/cors @types/compression @types/morgan @types/cookie-parser @types/jsonwebtoken
```

**Files Affected**:
- `/home/user/ai-agent-village-monitor/packages/server/src/app.ts`
- `/home/user/ai-agent-village-monitor/packages/server/src/auth/jwt.ts`

---

## 2. AUDITLOGGER TYPE MISMATCH

**Severity**: Critical | **Count**: 13 errors

### 2.1 Issue Description
The `AuditLogger` is exported as a class instance, but it's being called as a function. TypeScript sees the variable `audit` as an instance of the class, which is not callable.

**Root Cause**:
```typescript
// audit/logger.ts line 42
export const audit = new AuditLogger();

// Usage attempts to call it as function:
audit('session.created', { ... })  // ERROR: Type 'AuditLogger' has no call signatures
```

### 2.2 Files with AuditLogger Errors (13 instances)
1. `/home/user/ai-agent-village-monitor/packages/server/src/agents/session.ts` (3 errors: lines 70, 89, 102)
2. `/home/user/ai-agent-village-monitor/packages/server/src/queue/workers.ts` (10 errors: lines 50, 54, 74, 76, 88, 107, 119, 130, 207, 223, 233, 289)

### 2.3 Fix Strategy
**Option A** (Recommended): Change function calls to method calls
```typescript
// BEFORE (incorrect):
audit('session.created', { agentId: agentIdStr, sessionId: created.id });
audit('agent.session_starting', { ... });

// AFTER (correct):
audit.log('session.created', { agentId: agentIdStr, sessionId: created.id });
audit.log('agent.session_starting', { ... });
```

**Option B**: Add call signature to AuditLogger class
```typescript
export class AuditLogger {
  log(type: AuditEventType, payload: Record<string, unknown> = {}) { ... }
  
  // Add this method to allow direct calls:
  __call__(type: AuditEventType, payload?: Record<string, unknown>) {
    return this.log(type, payload);
  }
}
```

**Implementation**:
- Search/Replace in affected files:
  - Replace `audit('` with `audit.log(`
  - Replace `audit({` with `audit.log({`
  
Files needing updates:
1. `src/agents/session.ts` - 3 changes at lines 70, 89, 102
2. `src/queue/workers.ts` - Multiple changes throughout (50, 54, 74, 76, 88, 107, 119, 130, 207, 223, 233, 289)

---

## 3. EXPRESS REQUEST TYPE EXTENSIONS

**Severity**: High | **Count**: 6 errors

### 3.1 Issue: Missing GitHub Property on Express Request

**Error Pattern**:
```
Property 'github' does not exist on type 'Request<...>'
```

**Files Affected**:
- `src/app.ts` (lines 231, 242, 411, 418) - 4 errors
- `src/repos/router.ts` (lines 94, 207) - 2 errors

### 3.2 Root Cause
The GitHub middleware declares a module augmentation in `src/github/middleware.ts`, but the import path is incomplete. The module declaration needs to reference the correct express types.

**Current (Broken) Declaration** in `src/github/middleware.ts`:
```typescript
declare module 'express-serve-static-core' {
  interface Request {
    github?: GitHubClient;
  }
}
```

**Problem**: The type augmentation exists, but TypeScript isn't finding the `express-serve-static-core` module in the resolution chain.

### 3.3 Fix
**Option A** (Best): Ensure proper type imports in middleware file:
```typescript
// src/github/middleware.ts
import type { Request, Response, NextFunction } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';
import { createGitHubClientFromEnv, GitHubClient } from './client';

declare global {
  namespace Express {
    interface Request {
      github?: GitHubClient;
    }
  }
}
```

**Option B** (Alternative): Use namespace-based augmentation:
```typescript
declare global {
  namespace Express {
    interface Request {
      github?: GitHubClient;
    }
  }
}
```

**Installation Required**:
Ensure `@types/express` is installed (already in package.json at v4.17.21).

---

## 4. SOCKET.IO TYPE INCOMPATIBILITIES

**Severity**: High | **Count**: 7 errors

### 4.1 Issues and Fixes

#### 4.1.1 SocketData Type Conflict
**File**: `src/realtime/auth.ts:8`
**Error**: `Subsequent property declarations must have the same type. Property 'data' must be of type 'SocketData', but here has type 'any'.`

**Current Code**:
```typescript
declare module 'socket.io' {
  interface Socket {
    data: Socket['data'] & {
      user?: JwtPayload;
    };
  }
}
```

**Fix**:
```typescript
import type { Socket, SocketData } from 'socket.io';
import type { NextFunction } from 'express';
import { config } from '../config';
import { verifyAccessToken, type JwtPayload } from '../auth/jwt';

// Properly extend SocketData
declare module 'socket.io' {
  interface SocketData {
    user?: JwtPayload;
  }
}

// Remove the conflicting Socket.data augmentation
```

#### 4.1.2 Error Type Mismatch in Handler
**File**: `src/realtime/server.ts:57`
**Error**: `Argument of type 'Error | null' is not assignable to parameter of type 'string | null | undefined'`

**Current Code**:
```typescript
allowRequest: (req, fn) => {
  const origin = req.headers.origin as string | undefined;
  if (!origin) return fn(null, true);
  const ok = allowedOrigins.includes(origin);
  return fn(ok ? null : new Error('CORS origin not allowed'), ok);
},
```

**Fix**:
```typescript
allowRequest: (req, fn) => {
  const origin = req.headers.origin as string | undefined;
  if (!origin) return fn(null, true);
  const ok = allowedOrigins.includes(origin);
  return fn(ok ? null : new Error('CORS origin not allowed') as any, ok);
},
```

Or better:
```typescript
allowRequest: (req, fn) => {
  const origin = req.headers.origin as string | undefined;
  if (!origin) return fn(null, true);
  const ok = allowedOrigins.includes(origin);
  if (!ok) {
    return fn(new Error('CORS origin not allowed') as any, false);
  }
  return fn(null, true);
},
```

#### 4.1.3 NextFunction Parameter Type Mismatch
**File**: `src/realtime/server.ts:73`
**Error**: `Types of parameters 'next' and 'next' are incompatible`

**Current Code**:
```typescript
io.use(socketAuth);  // socketAuth has incompatible signature
```

**Fix in `src/realtime/auth.ts`**:
```typescript
import type { Socket } from 'socket.io';
import type { NextFunction } from 'express';
import { config } from '../config';
import { verifyAccessToken, type JwtPayload } from '../auth/jwt';

declare module 'socket.io' {
  interface SocketData {
    user?: JwtPayload;
  }
}

export function socketAuth(socket: Socket, next: (err?: Error | undefined) => void) {
  const token =
    (socket.handshake.auth as Record<string, unknown> | undefined)?.token ??
    (socket.handshake.query?.token as string | undefined);

  if (!config.JWT_SECRET) {
    console.warn('[ws] JWT_SECRET is not set; allowing unauthenticated WebSocket connection');
    return next();
  }

  try {
    if (typeof token !== 'string' || token.length === 0) {
      return next();
    }
    const payload = verifyAccessToken(token);
    socket.data.user = payload;
    return next();
  } catch {
    const err = new Error('unauthorized: invalid token');
    return next(err);
  }
}
```

#### 4.1.4 Handler Return Type Issues
**File**: `src/realtime/server.ts:197, 219, 241`
**Error**: `Argument of type '(payload: unknown) => Promise<{ ok: boolean; error: ...` is not assignable...`

**Issue**: The handler functions return union types with `{ ok: boolean; ... }` but Socket.IO expects always `{ ok: true; ... }`.

**Fix**:
Ensure all successful responses set `ok: true` explicitly:
```typescript
// BEFORE (wrong):
const handler = async (payload: unknown) => {
  if (error) return { ok: false, error: { code, message } };  // ok: false not allowed
  return { ok: true, room };
};

// AFTER (correct):
const handler = async (payload: unknown) => {
  if (error) {
    // Return error response separately or ensure ok is always true
    return { ok: true, error: { code, message } };
  }
  return { ok: true, room };
};
```

Or use type narrowing:
```typescript
interface SuccessResponse { ok: true; [key: string]: unknown }
interface ErrorResponse { ok: true; error: { code: WsErrorCode; message: string } }
type HandlerResponse = SuccessResponse | ErrorResponse;

const handler = async (payload: unknown): Promise<HandlerResponse> => {
  // Always return { ok: true, ... }
};
```

---

## 5. ADDITIONAL TYPE ERRORS

**Severity**: Medium to High | **Count**: 25+ errors

### 5.1 Implicit Any Types

**Files and Fixes**:

1. **`src/app.ts:117`** - CORS callback parameters
```typescript
// BEFORE:
origin: (origin, callback) => {

// AFTER:
origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
```

2. **`src/villages/router.ts`** - Multiple implicit any parameters
```typescript
// Line 64: (entry) 
// Line 74: (entry)
// Line 115: (v)
// Line 118: (v)
// Line 386: (r)

// FIXES:
.forEach((entry: typeof counts[0]) => { ... })
.map((v: typeof villages[0]) => { ... })
.map((r: any) => { ... })  // Type based on usage
```

3. **`src/villages/sync.ts`** - Implicit any in map callbacks
```typescript
// Line 33-34: (h) parameters
const byRepoId = new Map(existing.map((h: typeof existing[0]) => [String(h.githubRepoId), h]));
```

4. **`src/queue/workers.ts:154`** - Event parameter
```typescript
// BEFORE:
onEvent: async (evt) => {

// AFTER:
onEvent: async (evt: { type: string; message?: string; progress?: number; data?: any }) => {
```

### 5.2 Type Assertion Issues

**`src/github/client.ts`** (lines 114, 186, 248)
```typescript
// BEFORE:
this.trackRate((res as any)?.headers);

// AFTER:
this.trackRate((res as unknown as { headers?: Record<string, any> })?.headers);

// OR better - narrow the type at source:
const response = await this.withRetry(...) as { headers?: Record<string, any> };
this.trackRate(response?.headers);
```

### 5.3 Duplicate Identifier Issues

**`src/villages/router.ts`** (lines 8, 425)
```typescript
// PROBLEM: sanitizeString imported at line 8 but defined again at line 425

// SOLUTION: 
// 1. Remove the import at line 8 if you want to use local definition
// 2. OR remove local definition at line 425 if import is correct
// 3. Rename one of them to avoid conflict

// Most likely fix:
// Remove line 425 local definition and use the imported one from line 8
```

### 5.4 Queue Job Options Type Issue

**`src/queue/queues.ts`** (lines 26, 30)
```typescript
// BEFORE:
defaultJobOptions: { ...defaultJobOpts, attempts: 5, timeout: 30_000 }

// AFTER:
defaultJobOptions: { 
  ...defaultJobOpts, 
  attempts: 5, 
  requestTimeout: 30_000  // Use correct property name
}

// OR check BullMQ version - 'timeout' might be in newer versions
// Add to defaultJobOpts type if timeout is valid:
const defaultJobOpts: JobsOptions & { timeout?: number } = {
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
};
```

### 5.5 CommandResult Type Not Found

**`src/queue/workers.ts:140, 171, 189, 202`**
```typescript
// BEFORE:
const result = await runWithStream(runner);  // result is unknown type

// SOLUTION: Define the CommandResult type
export interface CommandResult {
  ok: boolean;
  error?: string;
  data?: any;
  jobId?: string;
}

// Import and use:
const result: CommandResult = await runWithStream(runner);
```

### 5.6 Property Type Issues

**`src/sync/health.ts:28`**
```typescript
// BEFORE:
await r.zadd(zkey, { score: run.ts, value: s });

// AFTER:
await r.zadd(zkey, { score: String(run.ts), value: s });  // score might need string
```

**`src/villages/sync.ts:73, 104`**
```typescript
// Line 73: Property access on possibly undefined
const sorted = [...repos].sort(
  (a, b) => (b.stargazers ?? 0) - (a.stargazers ?? 0) || a.name.localeCompare(b.name)
);

// Line 104: 'id' doesn't exist on empty object
const mapping = await resolveVillageAndHouse(context.payload) as { id: number; villageId: number; x: number; y: number };
```

### 5.7 Metrics Element Access

**`src/metrics.ts:119`**
```typescript
// BEFORE:
const value = buckets[le];  // le is string, buckets is { le: string }

// AFTER:
const value = buckets[le as keyof typeof buckets];

// OR restructure buckets as Record<string, string>:
const buckets: Record<string, string> = { le: '...' };
```

### 5.8 Probot Middleware Type Issue

**`src/probot/app.ts:109`**
```typescript
// BEFORE:
const middleware = createNodeMiddleware(appFn as any, { probot } as ApplicationFunctionOptions);

// AFTER:
import type { MiddlewareOptions } from 'probot';

const middleware = createNodeMiddleware(appFn, { probot } as MiddlewareOptions);

// If MiddlewareOptions requires additional properties:
const middleware = createNodeMiddleware(appFn, { 
  probot,
  // Add any other required properties from MiddlewareOptions
} as MiddlewareOptions);
```

---

## 6. TSCONFIG ROOTDIR ISSUE

**Severity**: Medium | **Count**: 1 error

**File**: `/home/user/ai-agent-village-monitor/packages/server/tsconfig.json`
**Error**: `File is not under 'rootDir'`

### 6.1 Root Cause
The tsconfig includes `../shared/src/**/*` files, but `rootDir` is set to `.` (packages/server). This creates a path conflict.

### 6.2 Fix Options

**Option A** (Recommended): Adjust tsconfig.json
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "dist",
    "rootDir": ".",
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": [
    "src/**/*",
    "../shared/src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "src/__tests__/**",
    "test/**"
  ]
}
```

Add `skipLibCheck: true` to compiler options (already in base, ensure it's set).

**Option B**: Reference shared as composite project
Create separate tsconfig for shared types and reference as composite:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true
  },
  "references": [
    { "path": "../shared" }
  ]
}
```

---

## 7. IMPLEMENTATION PRIORITY

### Phase 1 (Critical - Do First)
1. Install missing @types packages (Section 1)
2. Fix AuditLogger calls from function to method (Section 2)
3. Fix Express Request type extension (Section 3)

### Phase 2 (High Priority)
4. Fix Socket.IO type mismatches (Section 4)
5. Add type definitions for missing types (CommandResult, etc.)

### Phase 3 (Medium Priority)
6. Fix implicit any parameters (Section 5.1)
7. Fix type assertions in client code (Section 5.2)
8. Resolve duplicate identifiers (Section 5.3)

### Phase 4 (Polish)
9. Fix property access type issues
10. Review tsconfig rootDir configuration

---

## 8. QUICK FIX CHECKLIST

```bash
# 1. Install missing types
pnpm add -D @types/cors @types/compression @types/morgan @types/cookie-parser @types/jsonwebtoken

# 2. Fix AuditLogger calls (use find/replace)
# In src/agents/session.ts and src/queue/workers.ts:
# Find: audit(
# Replace: audit.log(
# Find: audit({
# Replace: audit.log({

# 3. Fix Express Request augmentation in src/github/middleware.ts
# Update to use 'declare global { namespace Express { ... } }'

# 4. Fix Socket.IO SocketData augmentation in src/realtime/auth.ts
# Change from Socket['data'] to SocketData interface

# 5. Verify Socket.IO error handling returns proper types

# 6. Run typecheck to verify:
npm run typecheck
```

---

## Summary of Files Requiring Changes

| File | Changes | Priority |
|------|---------|----------|
| `src/agents/session.ts` | audit.log() calls (3) | P1 |
| `src/queue/workers.ts` | audit.log() calls (10+) | P1 |
| `src/app.ts` | CORS types, Request augmentation | P1 |
| `src/github/middleware.ts` | Request augmentation syntax | P1 |
| `src/auth/jwt.ts` | Install @types/jsonwebtoken | P1 |
| `src/realtime/auth.ts` | SocketData augmentation | P2 |
| `src/realtime/server.ts` | Error handling types, handlers | P2 |
| `src/queue/queues.ts` | JobOptions timeout property | P2 |
| `src/github/client.ts` | Type assertions | P2 |
| `src/villages/router.ts` | Duplicate identifier, implicit any | P3 |
| `src/villages/sync.ts` | Undefined properties, type guards | P3 |
| `tsconfig.json` | rootDir configuration | P3 |

