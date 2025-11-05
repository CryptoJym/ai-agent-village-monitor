# Schema-Code Inconsistencies Report

**Date:** 2025-11-05
**Status:** 🚨 CRITICAL - Multiple runtime bugs expected

---

## Executive Summary

The codebase has **critical inconsistencies** between the Prisma database schema and the TypeScript router code. The API routes are attempting to read/write fields that **do not exist** in the database, which will cause runtime errors when villages are loaded or created.

**Impact:** Villages functionality is likely **broken in production**.

---

## Critical Issues Found

### 1. Village Model - Missing Fields ❌

**Schema** (`packages/server/prisma/schema.prisma` lines 64-79):
```prisma
model Village {
  id            String   @id @default(cuid())
  orgName       String   // ✅ EXISTS
  githubOrgId   BigInt?  @unique
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  config        Json?    // ✅ EXISTS (but code uses wrong name)
  layoutVersion Int      @default(0)

  houses  House[]
  bugBots BugBot[]
  access  VillageAccess[]
}
```

**Code References** (`packages/server/src/villages/router.ts`):
- ❌ Line 123: `name: v.name` - **DOES NOT EXIST** (should be `orgName`)
- ❌ Line 196: `name: (v as any).name ?? (v as any).orgName` - Workaround for missing field
- ❌ Line 170: `if ((v as any).ownerId === authedUserId)` - **DOES NOT EXIST**
- ❌ Line 224: `if ((v as any).ownerId === authedUserId)` - **DOES NOT EXIST**
- ❌ Line 198: `isPublic: v.isPublic` - **DOES NOT EXIST**
- ❌ Line 199: `lastSynced: v.lastSynced` - **DOES NOT EXIST**
- ❌ Line 125: `lastSynced: v.lastSynced` - **DOES NOT EXIST**
- ❌ Line 278: `villageConfig: { org: ... }` - **WRONG NAME** (should be `config`)

**Root Cause:** The schema was simplified but the router code was never updated.

---

### 2. VillageAccess Model - Missing Field ❌

**Schema** (`packages/server/prisma/schema.prisma` lines 155-165):
```prisma
model VillageAccess {
  villageId String
  userId    String
  role      String @default("viewer")

  // ❌ NO grantedAt field!

  village Village @relation(...)
  user    User    @relation(...)

  @@id([villageId, userId])
}
```

**Code References** (`packages/server/src/villages/router.ts`):
- ❌ Line 383: `orderBy: { grantedAt: 'desc' }` - **DOES NOT EXIST**
- ❌ Line 391: `grantedAt: r.grantedAt` - **DOES NOT EXIST**

**Impact:** The `/api/villages/:id/access` endpoint will fail to sort and return `undefined` for `grantedAt`.

---

### 3. Village Service - Broken Function ⚠️

**File:** `packages/server/src/villages/service.ts`

```typescript
export async function setVillageLastSynced(_villageId: string, _at: Date = new Date()) {
  // No-op alignment: the schema has no lastSynced; consider persisting a timestamp in config if needed.
  const v = await prisma.village.findFirst({});
  return v;
}
```

**Issues:**
1. ❌ Function doesn't use the `_villageId` parameter
2. ❌ Returns a random village (`findFirst({})` with no filter!)
3. ❌ Comment admits the field doesn't exist
4. ❌ Function name is misleading (claims to "set" but doesn't)

---

### 4. Village Ownership - No Authorization Model ❌

**Problem:** The code checks for `ownerId` on Village, but this field doesn't exist!

**Affected Routes:**
- `GET /villages/:id/role` - Lines 224, ownership check fails
- `GET /villages/:id` - Line 170, ownership check fails
- All routes using `requireVillageRole` middleware

**Current Behavior:**
- All ownership checks return `false`
- Users can't access their own villages
- Role detection is broken

**Expected Behavior:**
- Village should have `ownerId` field linking to User
- OR Village ownership determined via VillageAccess with role='owner'

---

### 5. Public Villages - Feature Doesn't Work ❌

**Problem:** Code checks `v.isPublic` but field doesn't exist in schema.

**Affected Routes:**
- `GET /villages/:id` - Lines 185-191, public access logic
- `GET /villages/:id/sync/health` - Line 147, public check
- All routes checking public access

**Impact:**
- All villages treated as private
- Public villages feature is non-functional
- Cache headers not set correctly

---

## Data Flow Broken

### When User Creates Village

**POST /villages/** (Line 248-287):
```typescript
const created = await prisma.village.create({
  data: {
    name,                    // ❌ Field doesn't exist!
    githubOrgId,            // ✅ OK
    ownerId,                // ❌ Field doesn't exist!
    isPublic: false,        // ❌ Field doesn't exist!
    villageConfig: { ... }, // ❌ Wrong name! Should be 'config'
  },
});
```

**Result:** Prisma will throw error: `Unknown field 'name', 'ownerId', 'isPublic', 'villageConfig'`

### When User Lists Villages

**GET /villages/** (Line 108-138):
```typescript
const villages = await prisma.village.findMany({
  where: { OR: [
    { ownerId: userId },           // ❌ Field doesn't exist!
    { access: { some: { userId } } } // ✅ OK
  ]},
});
```

**Result:** Query fails or returns empty results.

### When Syncing Village

**POST /villages/:id/houses/sync** → `syncVillageNow()`:
- ✅ Sync logic is actually OK
- ❌ But `setVillageLastSynced()` is broken (doesn't update anything)
- ❌ No way to track last sync time

---

## Root Cause Analysis

### Timeline (Inferred)

1. **Initial Design** - Village had `name`, `ownerId`, `isPublic`, `lastSynced`
2. **Schema Refactor** - Someone simplified the schema to just `orgName`, removed other fields
3. **Migration Gap** - No migration was created to remove old fields or add new ones
4. **Code Not Updated** - Router code still references old schema
5. **Type Safety Bypassed** - Heavy use of `(v as any)` to silence TypeScript errors

### Why TypeScript Didn't Catch This

The code uses type assertions to bypass safety:
```typescript
const ownerId = Number((req.user! as any).sub);  // Forcing types
if ((v as any).ownerId === authedUserId)         // Casting to any
name: (v as any).name ?? (v as any).orgName      // Fallback pattern
```

---

## Required Fixes

### Option A: Update Schema to Match Code (Recommended)

Add missing fields to Village model:

```prisma
model Village {
  id            String   @id @default(cuid())
  name          String   // User-friendly display name
  orgName       String   // GitHub org name (keep for reference)
  githubOrgId   BigInt?  @unique
  ownerId       String   // Owner user ID
  owner         User     @relation(fields: [ownerId], references: [id])
  isPublic      Boolean  @default(false)
  lastSynced    DateTime?
  config        Json?
  layoutVersion Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  houses  House[]
  bugBots BugBot[]
  access  VillageAccess[]

  @@index([ownerId])
}
```

Add `grantedAt` to VillageAccess:

```prisma
model VillageAccess {
  villageId String
  userId    String
  role      String   @default("viewer")
  grantedAt DateTime @default(now())  // ADD THIS

  village Village @relation(...)
  user    User    @relation(...)

  @@id([villageId, userId])
  @@index([userId])
}
```

Update User model:

```prisma
model User {
  id              String          @id @default(cuid())
  email           String?         @unique @db.Citext
  githubId        BigInt?         @unique
  username        String?         @unique
  name            String?
  avatarUrl       String?
  accessTokenHash String?
  preferences     Json?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  ownedVillages   Village[]       // ADD THIS
  villages        VillageAccess[]
  agents          Agent[]
}
```

**Migration Steps:**
1. Create migration: `pnpm prisma migrate dev --name add_village_fields`
2. Backfill existing data:
   - Set `name = orgName` for all villages
   - Set `ownerId` from first VillageAccess with role='owner'
   - Set `isPublic = false` for all
   - Set `grantedAt = createdAt` for all VillageAccess
3. Test all endpoints

### Option B: Update Code to Match Schema

Remove all references to non-existent fields:

1. Replace `v.name` with `v.orgName` everywhere
2. Replace `v.ownerId` checks with VillageAccess query
3. Remove `v.isPublic` checks (or use config JSON)
4. Remove `v.lastSynced` (or store in config JSON)
5. Fix `villageConfig` → `config`
6. Remove `grantedAt` from VillageAccess queries
7. Fix `setVillageLastSynced()` to actually work

**Drawbacks:**
- More complex authorization logic
- No clean way to track ownership
- Public villages require workaround

---

## Recommended Action Plan

### Phase 1: Immediate Fixes (Emergency)
1. ✅ **Fix router to use `orgName` instead of `name`**
2. ✅ **Fix `villageConfig` → `config`**
3. ✅ **Remove `grantedAt` sort/return** (temporary)
4. ✅ **Fix ownership checks to use VillageAccess**
5. ✅ **Document broken features** (isPublic, lastSynced)

### Phase 2: Schema Migration (Proper Fix)
1. Create migration adding missing fields
2. Backfill data with sensible defaults
3. Restore full feature functionality
4. Add integration tests

### Phase 3: Prevent Future Issues
1. Enable strict TypeScript (remove `as any`)
2. Add Prisma type imports to router
3. Add schema validation tests
4. Add pre-commit hook to check schema-code sync

---

## Impact Assessment

### Broken Features (Current State)

| Feature | Status | Severity |
|---------|--------|----------|
| Create Village | ❌ Fails | 🔴 Critical |
| List User's Villages | ⚠️ Returns empty | 🔴 Critical |
| Get Village Details | ⚠️ Missing fields | 🟡 High |
| Check Ownership | ❌ Always fails | 🔴 Critical |
| Public Villages | ❌ Not working | 🟡 High |
| Track Last Sync | ❌ Not working | 🟡 High |
| Village Access List | ⚠️ Missing grantedAt | 🟢 Medium |
| Sync Houses | ✅ Works | ✅ OK |

### User Experience

**Expected:** User logs in → sees their villages → clicks village → sees houses
**Actual:** User logs in → sees no villages → 404 errors → confusion

---

## Files Requiring Changes

### Schema Changes
- `packages/server/prisma/schema.prisma` - Add missing fields
- `packages/server/prisma/migrations/` - Create new migration

### Code Changes
- `packages/server/src/villages/router.ts` - Fix all field references (14 locations)
- `packages/server/src/villages/service.ts` - Fix setVillageLastSynced()
- `packages/server/src/villages/sync.ts` - Update after adding lastSynced
- `packages/server/src/auth/middleware.ts` - Fix requireVillageRole to handle ownerId properly

### Test Changes
- Add integration tests for village CRUD
- Add tests for ownership checks
- Add tests for public village access

---

## Testing Checklist

After fixes:

- [ ] Create village succeeds
- [ ] User can see their villages
- [ ] User can see villages they have access to
- [ ] Owner can manage village
- [ ] Member has correct permissions
- [ ] Visitor has read-only access
- [ ] Public villages are accessible without auth
- [ ] Private villages require auth
- [ ] Sync updates lastSynced timestamp
- [ ] VillageAccess includes grantedAt
- [ ] All TypeScript errors resolved
- [ ] No `as any` casts remain

---

## Conclusion

The villages loading functionality is **fundamentally broken** due to schema-code mismatch. The recommended path forward is **Option A** (update schema) to restore all intended features with proper data modeling.

**Estimated Fix Time:** 2-4 hours
**Risk:** Low (with proper testing)
**Priority:** 🔴 CRITICAL - Blocks core functionality
