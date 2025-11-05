# TypeScript Type Errors - Implementation Action Plan

**Report Date**: 2025-11-05  
**Total Errors**: 78 (excluding duplicates)  
**Estimated Fix Time**: 2-3 hours  
**Complexity**: Medium (mostly straightforward fixes)

---

## QUICK START

### 1. Install Missing Type Definitions (5 min)
```bash
cd /home/user/ai-agent-village-monitor/packages/server
pnpm add -D @types/cors @types/compression @types/morgan @types/cookie-parser @types/jsonwebtoken
```

---

## PHASE 1: CRITICAL FIXES (30-45 min)

These fixes will resolve 28 errors (36% of total).

### Task 1.1: Fix AuditLogger Method Calls
**Files**: 
- `src/agents/session.ts` 
- `src/queue/workers.ts`

**Issue**: 13 instances of `audit(...)` should be `audit.log(...)`

**Implementation**:
```bash
# Search for all audit calls
grep -n "audit(" src/agents/session.ts src/queue/workers.ts

# Replace audit( with audit.log(
sed -i "s/audit('/audit.log('/g" src/agents/session.ts src/queue/workers.ts
sed -i "s/audit({/audit.log({/g" src/agents/session.ts src/queue/workers.ts
```

**Lines to fix**:
- `src/agents/session.ts`: 70, 89, 102
- `src/queue/workers.ts`: 50, 54, 74, 76, 88, 107, 119, 130, 207, 223, 233, 289

### Task 1.2: Fix Express Request Type Augmentation
**File**: `src/github/middleware.ts`

**Current**:
```typescript
declare module 'express-serve-static-core' {
  interface Request {
    github?: GitHubClient;
  }
}
```

**Fixed**:
```typescript
declare global {
  namespace Express {
    interface Request {
      github?: GitHubClient;
    }
  }
}
```

### Task 1.3: Add Type Annotations to CORS Callback
**File**: `src/app.ts` line 117

**Current**:
```typescript
origin: (origin, callback) => {
```

**Fixed**:
```typescript
origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
```

---

## PHASE 2: HIGH PRIORITY FIXES (45-60 min)

These fixes will resolve 22 errors (28% of total).

### Task 2.1: Fix Socket.IO Type Augmentation
**File**: `src/realtime/auth.ts`

**Current**:
```typescript
declare module 'socket.io' {
  interface Socket {
    data: Socket['data'] & {
      user?: JwtPayload;
    };
  }
}
```

**Fixed**:
```typescript
declare module 'socket.io' {
  interface SocketData {
    user?: JwtPayload;
  }
}

// Remove the Socket.data augmentation that causes conflicts
```

### Task 2.2: Fix Socket.IO CORS Error Handling
**File**: `src/realtime/server.ts` line 57

**Current**:
```typescript
allowRequest: (req, fn) => {
  const origin = req.headers.origin as string | undefined;
  if (!origin) return fn(null, true);
  const ok = allowedOrigins.includes(origin);
  return fn(ok ? null : new Error('CORS origin not allowed'), ok);
},
```

**Fixed**:
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

### Task 2.3: Fix Socket.IO Middleware NextFunction Type
**File**: `src/realtime/auth.ts` line 21

**Current**:
```typescript
export function socketAuth(socket: Socket, next: NextFunction) {
```

**Fixed**:
```typescript
export function socketAuth(socket: Socket, next: (err?: Error | undefined) => void) {
```

### Task 2.4: Add CommandResult Type Definition
**File**: `src/queue/workers.ts` (add near top of file)

**Add**:
```typescript
export interface CommandResult {
  ok: boolean;
  error?: string;
  data?: any;
  jobId?: string;
}
```

**Update line 140**:
```typescript
const result: CommandResult = await runWithStream(runner);
```

### Task 2.5: Fix BullMQ Job Options Type
**File**: `src/queue/queues.ts` lines 26, 30

**Option 1** - If timeout is NOT in BullMQ's JobsOptions:
```typescript
interface JobsOptionsWithTimeout extends JobsOptions {
  timeout?: number;
}

const agentCommands = new Queue('agent-commands', {
  connection,
  defaultJobOptions: { 
    ...defaultJobOpts, 
    attempts: 5, 
    timeout: 30_000 
  } as JobsOptionsWithTimeout,
});
```

**Option 2** - If timeout should work:
Check BullMQ types: `node_modules/bullmq/dist/cjs/types/index.d.ts`

---

## PHASE 3: MEDIUM PRIORITY FIXES (30-45 min)

These fixes will resolve 18 errors (23% of total).

### Task 3.1: Fix Implicit Any Parameters
**File**: `src/villages/router.ts`

**Lines 64, 74**: forEach callback
```typescript
// BEFORE
counts.forEach((entry) => {

// AFTER
counts.forEach((entry: ReturnType<typeof prisma.house.groupBy>[0]) => {
```

**Lines 115, 118**: map callback
```typescript
// BEFORE
villages.map((v) => {

// AFTER
villages.map((v: Awaited<ReturnType<typeof prisma.village.findMany>>[0]) => {
```

### Task 3.2: Fix Implicit Any in villages/sync.ts
**Line 33-34**: Map callback
```typescript
// BEFORE
const byRepoId = new Map(existing.map((h) => [String(h.githubRepoId), h]));

// AFTER
const byRepoId = new Map(existing.map((h: typeof existing[0]) => [String(h.githubRepoId), h]));
```

### Task 3.3: Fix GitHub Client Type Assertions
**File**: `src/github/client.ts` lines 114, 186, 248

**Current**:
```typescript
this.trackRate((res as any)?.headers);
```

**Fixed**:
```typescript
const response = await this.withRetry(...) as { headers?: Record<string, any> };
this.trackRate(response?.headers);
```

### Task 3.4: Fix Duplicate sanitizeString Identifier
**File**: `src/villages/router.ts`

**Lines 8, 425**: There's both an import and definition of sanitizeString

**Solution**: Remove the local definition at line 425 and use the imported one
```typescript
// DELETE this section around line 425
function sanitizeString(str: string): string {
  // ...
}
```

---

## PHASE 4: POLISH & VALIDATION (15-30 min)

### Task 4.1: Fix Property Access Type Issues
**File**: `src/villages/sync.ts` line 73

**Current**:
```typescript
const sorted = [...repos].sort(
  (a, b) => b.stargazers - a.stargazers || a.name.localeCompare(b.name),
);
```

**Fixed**:
```typescript
const sorted = [...repos].sort(
  (a, b) => (b.stargazers ?? 0) - (a.stargazers ?? 0) || a.name.localeCompare(b.name),
);
```

### Task 4.2: Review Probot Middleware
**File**: `src/probot/app.ts` line 109

**Note**: This may require checking the probot types. Current code:
```typescript
const middleware = createNodeMiddleware(appFn as any, { probot } as ApplicationFunctionOptions);
```

Should be fine if probot types define ApplicationFunctionOptions properly.

### Task 4.3: Fix Metrics Element Access
**File**: `src/metrics.ts` line 119

Ensure buckets is properly typed as a Record.

### Task 4.4: Review Socket.IO Handler Return Types
**File**: `src/realtime/server.ts` lines 197, 219, 241

Verify handlers always return `{ ok: true, ... }` format or update Socket.IO handler type definitions.

---

## PHASE 5: TSCONFIG & FINAL VERIFICATION

### Task 5.1: Review tsconfig.json
**File**: `tsconfig.json`

Verify it includes proper configuration. Current should be fine with `skipLibCheck: true`.

### Task 5.2: Run Final Typecheck
```bash
npm run typecheck
```

Should show no errors after all fixes.

---

## TESTING & VALIDATION

### Before Making Changes
```bash
npm run typecheck 2>&1 | tee typecheck-before.txt
```

### After Each Phase
```bash
npm run typecheck
```

### Final Verification
```bash
npm run typecheck && echo "✓ All types pass"
npm run build
npm run test
```

---

## ESTIMATED TIMELINE

| Phase | Task | Time | Errors Fixed |
|-------|------|------|--------------|
| 1 | AuditLogger + Express + CORS | 30-45 min | 28 |
| 2 | Socket.IO + BullMQ + Result types | 45-60 min | 22 |
| 3 | Implicit any + duplicates + assertions | 30-45 min | 18 |
| 4 | Property access + handlers | 15-30 min | 8 |
| 5 | tsconfig + verification | 10-15 min | 2 |
| **Total** | **All Fixes** | **2-3 hours** | **78** |

---

## CRITICAL DEPENDENCIES

- ✓ Install @types packages (MUST DO FIRST)
- ✓ AuditLogger fixes (blocking other fixes)
- ✓ Express Request augmentation (needed for app.ts)
- → Socket.IO fixes (independent)
- → BullMQ type fixes (independent)
- → Import sorting/cleanup (polish phase)

---

## ROLLBACK PLAN

If issues arise:
```bash
git stash           # Undo all changes
npm run typecheck   # Back to original state
git checkout HEAD~1 # Revert to previous commit if needed
```

---

## NOTES & WARNINGS

1. **AuditLogger method calls**: Ensure all `audit(...)` become `audit.log(...)` - this is the most error-prone fix
2. **Socket.IO types**: The SocketData augmentation must replace Socket['data'] augmentation to avoid conflicts
3. **Express augmentation**: Must use `declare global { namespace Express }` not `declare module 'express-serve-static-core'`
4. **Type safety**: These fixes improve type safety without changing runtime behavior
5. **Testing**: Run full test suite after fixes to ensure no runtime regressions

---

## HELPFUL COMMANDS

```bash
# Find all audit calls
grep -rn "audit(" packages/server/src --include="*.ts" | grep -v "audit.log"

# Check for remaining type errors
npm run typecheck 2>&1 | grep "error TS"

# Count errors by file
npm run typecheck 2>&1 | grep "error TS" | cut -d: -f1 | sort | uniq -c

# View specific file errors
npm run typecheck 2>&1 | grep "src/agents/session.ts"
```

---

**Next Step**: Begin with Task 1.1 (AuditLogger fixes) as it blocks other validations.
