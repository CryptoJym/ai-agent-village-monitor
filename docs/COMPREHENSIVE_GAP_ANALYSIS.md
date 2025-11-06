# AI Agent Village Monitor - Comprehensive Gap Analysis

## Executive Summary

The AI Agent Village Monitor codebase is **60-70% feature complete** relative to the PRD vision. Core infrastructure is solid with well-structured code, but critical architectural issues remain that prevent full operability. The project shows signs of recent emergency fixes addressing fundamental schema-code mismatches discovered during development.

**Date of Audit**: November 6, 2025
**Status**: Main features working but critical blockers remain
**Test Coverage**: 85 test files across codebase
**Recent Fixes**: Security/TypeScript/Schema consistency (commits 79f6611, cf36475, 77b6e53)

---

## Feature-by-Feature Analysis

### 1. Village Visualization Engine (Phaser.js isometric rendering)

**Priority**: P0 | **Status**: IMPLEMENTED (90% complete)

#### What Works
- ✅ **Core Phaser.js Setup**: Fully configured with TypeScript support
- ✅ **Isometric Rendering**: Utility functions for iso coordinate conversion (`src/iso/iso.ts`, `src/utils/iso.ts`)
- ✅ **MainScene**: Complex 1,855-line implementation with:
  - Agent sprite rendering with state colors and animations
  - House sprite rendering with language-based styling
  - Pan/zoom camera controls with zoom limits (0.5x to 2.0x)
  - Spatial hashing for view culling and performance
  - Village state persistence
  - Accessibility support (ARIA live regions)
- ✅ **House Entities**: Full House class with:
  - Language-specific visual styles
  - Window light and smoke animations
  - Health indicators (scaffolding overlay)
  - Build status visualization
  - Hover tooltips and double-click zoom interaction
- ✅ **Agent Entities**: Complete Agent class with:
  - Character spritesheet animation system
  - 8-directional movement support
  - Status indicator rings (color-coded)
  - Drag-and-drop positioning
  - Name labels and tooltips
  - State management (idle, working, debugging)
- ✅ **Performance Optimization**:
  - Sprite culling with configurable margins (48px default)
  - View culling to reduce draw calls under load
  - Batch processing for spawn events
  - Level-of-detail system for distant objects
- ✅ **Mini-map**: Implemented in overlays
- ✅ **WorldMapScene**: 284-line scene for multi-org navigation with terrain generation

#### Known Issues/Gaps
- 🟡 **Limited Animation Complexity**: Agent animations are driven by sprite sheets but lack sophisticated movement patterns (e.g., natural path-following AI)
- 🟡 **House Interior System**: InteriorScene exists (21KB file) but integration with main village incomplete
- ⚠️ **Responsive Design**: Mobile optimization present but limited testing on actual devices

#### Test Coverage
- **Coverage**: Multiple scene tests present
- **Gap**: No specific visual regression tests for isometric rendering

---

### 2. RPG Dialogue System (bottom panel for agent interaction)

**Priority**: P0 | **Status**: IMPLEMENTED (85% complete)

#### What Works
- ✅ **DialogueUI Component**: Fully implemented React component with:
  - Slide-up animation from bottom (300ms ease-out)
  - 30% screen height on desktop, 50% on mobile
  - Three tabbed interface:
    - **Thread Tab**: Work stream display with message history, real-time streaming, user input
    - **Control Tab**: Agent command execution (start/stop, GitHub workflows, custom commands)
    - **Info Tab**: Agent information display
  - Keyboard shortcuts (ESC to close, 1/2/3 for tabs)
  - Focus management and accessibility (ARIA modal, labels)
  - Responsive design with resize detection
- ✅ **ThreadTab**: Shows real-time work stream with:
  - Connection status indicator (connecting/connected/disconnected)
  - Latency display in milliseconds
  - Message queuing and batch rendering on requestAnimationFrame
  - Accessibility announcements for new messages
  - Auto-scroll to latest message
- ✅ **ControlTab**: Command interface with:
  - GitHub Actions workflow fetching and triggering
  - Custom command inputs (owner/repo/ref)
  - Role-based access control (owner-only)
  - Loading states and error handling
  - Toast notifications for feedback
- ✅ **InfoTab**: Agent information display

#### Partial Implementation
- 🟡 **WebSocket Real-Time Updates**: EventBus integrated but streaming may be unreliable:
  - Service exists: `WebSocketService` 
  - Integration: Events fire from `eventBus.on('work_stream')` 
  - **Gap**: No end-to-end test of work stream updates from MCP server to dialogue

#### Known Issues/Gaps
- ⚠️ **Action Registry Stubs**: `ActionRegistry.ts` shows default stub implementations for several actions
  ```typescript
  // Lines 52-54: "Stub behavior for now: emit a toast and a synthetic event"
  // Lines 79-124: Default implementations for startAgent, stopAgent, runRecentTool, etc.
  ```
  These emit UI events but don't execute actual backend commands in all cases
  
- 🟡 **Missing Features from PRD**:
  - No "execution context awareness" - dialogue doesn't show which house/repo agent is working on
  - No "step-by-step task breakdown" in control panel
  - No history of previous conversations

#### Test Coverage
- **Coverage**: DialogueUI component tested
- **Gap**: No end-to-end tests of work stream integration with real MCP servers

---

### 3. MCP Agent Integration (full Omnara-level control)

**Priority**: P0 | **Status**: PARTIAL (50% complete)

#### What Works
- ✅ **MCP Client Architecture**: 
  - `HttpMCPAgentController` class for HTTP-based MCP servers
  - `MockMCPAgentController` for testing/development
  - Pluggable design via `getAgentController()` factory
- ✅ **Core Control Operations**:
  - `start(agentId)`: Start MCP agent session
  - `stop(agentId)`: Stop agent session
  - `runCommand(agentId, command, args, opts)`: Execute commands
  - `runTool(agentId, tool, params, opts)`: Invoke tools
  - `runTask(agentId, description, opts)`: Execute multi-step tasks
- ✅ **Streaming Support**:
  - Server-Sent Events (SSE) streaming for real-time command output
  - Event parsing with fallback to JSON array response
  - Stream event callbacks: `onEvent()` callback system
- ✅ **Backend Agent Management** (`packages/server/src/agents/`):
  - `AgentManager` class with lifecycle management
  - Session creation/tracking
  - Exponential backoff retry logic for reconnections
  - Audit logging for all operations
  - Metrics tracking (connect attempts, latency, errors)

#### Critical Blockers (🔴 BLOCKING)
- ⚠️ **Agent.villageId Missing From Schema**:
  - **Root Cause**: Schema lacks `villageId` field on Agent model
  - **Impact**: 11 references in agents module cannot work correctly
  - **Specific Issue**: Authorization checks fail because cannot determine which village agent belongs to
  - **Location**: `packages/server/prisma/schema.prisma` line ~113 (Agent model)
  - **Status**: TODO items in `agents/router.ts:*` and `villages/router.ts:*` note this needs fixing
  - **Security Risk**: HIGH - could allow cross-village agent manipulation
  - **PR Evidence**:
    ```
    Commit 41a85f6: "Agent.villageId Does Not Exist (🔴 CRITICAL)"
    - Schema: Agent has NO villageId field
    - Code: 19 files try to access agent.villageId
    - Impact: Agent authorization BYPASSED
    ```

#### Partial Implementation
- 🟡 **MockMCPAgentController Used in Development**:
  - Frontend defaults to mock controller (lines 94-101 in `controller.ts`)
  - Real HTTP integration requires `MCP_HTTP_ENDPOINT` environment variable
  - Means most development/testing likely uses stubs, not real agents

- 🟡 **Limited Tool Parameter Support**:
  - Basic tool invocation works but no schema validation for tool parameters
  - No tool discovery mechanism (no `GET /tools` equivalent)

- 🟡 **Missing Session State Persistence**:
  - Sessions tracked in-memory via `AgentManager.runtimes` Map
  - No database persistence of session state
  - Sessions lost on server restart

#### Test Coverage
- **Coverage**: 
  - `agents.integration.test.ts`: Tests agent CRUD operations
  - `agent-manager.reconnect.test.ts`: Tests reconnection logic
  - `agent-manager.shutdown.test.ts`: Tests session cleanup
  - `session.command.integration.test.ts`: Tests command execution
- **Gaps**: 
  - No tests with real MCP servers
  - No tests for villageId authorization (because field doesn't exist)
  - No cross-org agent isolation tests

---

### 4. GitHub Integration (OAuth, repos as houses, webhooks)

**Priority**: P0 | **Status**: IMPLEMENTED (80% complete)

#### What Works
- ✅ **GitHub OAuth 2.0 Flow**:
  - `/auth/github` initiation endpoint
  - `/auth/github/callback` with state validation
  - JWT token generation and refresh token support
  - Cookie-based session persistence
  - Scope-based permission handling
  - Access token encryption via `OAuthToken` model with AES-GCM

- ✅ **Repository Synchronization**:
  - GraphQL-based repo listing with automatic REST fallback
  - Caching system with TTL policies
  - Pagination support for large orgs (100+ repos)
  - Language detection and storage
  - GitHub API rate-limit handling with backoff strategies
  - Scheduler for periodic sync (configurable intervals)

- ✅ **Webhook Integration**:
  - Multiple webhook handlers for:
    - Issue opens/closes → Bug Bot spawning/removal
    - Check run failures → High-severity bug bot creation
    - PR events (tracked in probot handlers)
  - Webhook deduplication to prevent double-processing
  - Proper error handling (ignores failures, acknowledges quickly)

- ✅ **Repository Operations**:
  - Workflow listing (`/api/github/workflows`)
  - Workflow triggering via repository dispatch
  - Action execution with branch/ref support

#### Partial Implementation
- 🟡 **Visitor Mode Not Fully Implemented**:
  - Schema supports role-based access (owner/member/viewer) via `VillageAccess`
  - Frontend checks role: `canControl = !villageId || role === 'owner'`
  - **Gap**: Not all features respect viewer-only constraints

- 🟡 **Cross-Organization Support Missing**:
  - Can manage one org at a time
  - No world map linking between org villages (WorldMapScene exists but isolated)
  - User can have multiple villages but switching requires page navigation

- 🟡 **Permission Sync Gap**:
  - OAuth scopes hardcoded (no dynamic scope updating)
  - User membership changes not automatically synced
  - Need manual re-auth to see new repos in org

#### Test Coverage
- **Coverage**: 
  - `github.etag.test.ts`: Tests caching
  - `github.cache_backoff.test.ts`: Tests rate limiting
  - `github.graphql_retry.test.ts`: Tests fallback
  - `github.dispatch.test.ts`: Tests workflow triggering
  - `webhooks.signature.e2e.test.ts`: Tests webhook validation
  - `auth.test.ts`, `auth.e2e.test.ts`: OAuth flow tests
- **Gaps**:
  - No real GitHub API integration tests
  - No multi-org synchronization tests
  - Limited webhook event variety testing

---

### 5. Bug Bot System (issues spawn bots, gamified resolution)

**Priority**: P1 | **Status**: IMPLEMENTED (75% complete)

#### What Works
- ✅ **Bug Bot Creation**:
  - Probot GitHub App triggers on issue.opened
  - Issue metadata captured (title, number, body, severity)
  - Bot spawned near house with position calculated from repo location
  - Supported event types:
    - GitHub issues (open/close)
    - CI check run failures
  - Idempotent creation via unique constraint on (provider, issueId)

- ✅ **Bug Bot Lifecycle**:
  - BugBot class with visual states: spawn, assigned, progress, resolved
  - Severity levels: low (blue, 8px), medium (orange, 10px), high (red, 12px)
  - Visual progression:
    - Ring color reflects state (STATE_RING_COLOR map)
    - Progress bar on ring (0..1)
    - Alpha fades with resolution
  - Animations: pulse, ring animation, resolution celebration

- ✅ **Agent Assignment**:
  - Drag-and-drop assignment of agents to bots
  - Click-based assignment trigger
  - Status transition to 'assigned' when agent assigned
  - Progress tracking as agent works

- ✅ **Real-time Updates**:
  - WebSocket events: `bug_bot_spawn`, `bug_bot_progress`, `bug_bot_resolved`
  - Broadcast to room: `village:{villageId}`
  - Deduplication to prevent duplicate processing

- ✅ **Database Schema**:
  - BugBot model with all required fields
  - Status enum: open → assigned → in_progress → resolved
  - Severity enum: low/medium/high
  - Foreign keys to House and Agent (optional)
  - Position tracking (x, y)

#### Partial Implementation
- 🟡 **Limited Severity Detection**:
  - Severity currently hardcoded as null or 'high' for CI failures
  - No automatic severity calculation from issue labels
  - Users cannot manually set severity

- 🟡 **Progress Tracking Incomplete**:
  - Frontend has `alphaForProgress()` function for visual progression
  - Backend has `progress` field but no update mechanism
  - Progress must be manually sent via WebSocket (no auto-update from agent work)

- 🟡 **Missing Features**:
  - No "celebration animation" on resolution (PRD mentions "celebration when bugs are fixed")
  - No progress notifications to issue comments
  - No reward/gamification system mentioned in PRD

#### Test Coverage
- **Coverage**: 
  - `bugs.test.ts`: Basic bug operations
  - Probot app has webhook handlers but limited direct testing
- **Gaps**:
  - No end-to-end issue spawn → bot display test
  - No multi-bot stress testing
  - No celebration animation testing

---

### 6. WebSocket Real-time Updates

**Priority**: P0 | **Status**: IMPLEMENTED (70% complete)

#### What Works
- ✅ **Socket.IO Integration**:
  - Server: Express app with Socket.IO server on `/socket.io`
  - Client: `WebSocketService` class for connection management
  - Authentication via JWT tokens passed in query or cookies
  - Room-based broadcasting:
    - `village:{villageId}`: All users viewing village
    - `agent:{agentId}`: Updates for specific agent
    - `repo:{repoId}`: Updates for specific repo

- ✅ **Event Types**:
  - `work_stream`: Agent activity (work_stream emitted from agent manager)
  - `agent_update`: Agent state changes (status, position)
  - `bug_bot_spawn`: New bug appears
  - `bug_bot_progress`: Bug work in progress
  - `bug_bot_resolved`: Bug fixed with celebration
  - `house_update`: Repository metadata changes

- ✅ **Real-time Broadcasting**:
  - Implemented in `realtime/io.ts`:
    ```typescript
    export function emitToVillage(villageId: string, event: string, payload: any) {
      io?.to(`village:${villageId}`).emit(event, payload);
    }
    ```
  - Used throughout codebase for all real-time events

- ✅ **Frontend Integration**:
  - `WebSocketService` handles connection/reconnection
  - `EventBus` for cross-component communication
  - Batch rendering on `requestAnimationFrame` to reduce layout churn
  - Offline mode with request queuing

#### Partial Implementation
- 🟡 **Unreliable Work Stream**:
  - ThreadTab subscribes to `work_stream` events via EventBus
  - **Gap**: No source of work_stream events from MCP servers
  - Currently only mock data and manual emission
  - No actual agent execution streaming

- 🟡 **Missing Connection Quality Indicators**:
  - ThreadTab shows connection status but no:
    - Automatic reconnection ui
    - Connection failure retry UI
    - Offline buffer depth indicator
    - WebSocket ping/pong monitoring

- 🟡 **No Message Ordering Guarantees**:
  - Events processed as received, no sequence numbers
  - Could lose causality if events arrive out of order

#### Test Coverage
- **Coverage**: 
  - `ws.test.ts`, `ws.integration.test.ts`: WebSocket tests
  - Socket.IO authentication tested
- **Gaps**:
  - No high-load stress tests (PRD requires 1000+ concurrent villages)
  - No network failure simulation tests
  - No message ordering tests

---

### 7. World Map System (multi-org navigation)

**Priority**: P1 | **Status**: PARTIAL (40% complete)

#### What Works
- ✅ **WorldMapScene**:
  - 284-line Phaser scene for world-level view
  - Terrain generation algorithm
  - Village placement and rendering
  - Camera controls and viewport management
  - Performance profiling built-in (`?profileWorld` query param)
  - Double-click to enter village

- ✅ **World Generation**:
  - `generateWorldMap()` function that creates terrain
  - Tiled composition of villages
  - Performance optimized for 10+ villages

#### Critical Gaps (🔴 MISSING)
- ❌ **No Multi-org Data Loading**:
  - `fetchVillages()` stub exists but returns empty array
  - No API endpoint to list user's villages for world view
  - Each village isolated, no world coordination

- ❌ **No Persistent World State**:
  - World is procedurally generated each time
  - No village metadata persistence (location, accessibility)
  - No player avatar or cross-org state

- ❌ **No Fast Travel Implementation**:
  - Scene transitions exist but state not persisted
  - Agent positions reset when switching villages
  - House positions/assignments reset

- ❌ **No Performance Optimization for Large Orgs**:
  - World generation unoptimized for power users with 50+ orgs
  - No chunked loading or lazy rendering
  - Camera positioning algorithm simplistic

#### Test Coverage
- **Coverage**: Basic WorldMapScene tests
- **Gaps**: No world generation tests, no multi-org navigation tests

---

## Cross-Cutting Issues

### 🔴 Critical Security Issues

#### 1. Agent Authorization Bypass (Severity: HIGH)
**Status**: KNOWN (documented in commit 41a85f6)

- **Problem**: Agent.villageId field missing from Prisma schema
- **Impact**: 
  - Cannot verify that user owns agent's village before start/stop/delete
  - Authorization checks skip because villageId is undefined
  - Any authenticated user can control any agent
- **Affected Code**:
  - `/api/agents/:id/start` - no village check
  - `/api/agents/:id/stop` - no village check
  - `/api/agents/:id/command` - no village check
  - WebSocket agent commands - no permission checks
- **Fix Required**: Add Agent.villageId field to schema and migration
- **Timeline**: Blocking MVP launch

#### 2. WebSocket Authentication Gap
**Status**: MEDIUM

- Socket.IO auth implemented but:
  - No per-message authorization checks
  - User can emit commands to any agent
  - No rate limiting per user

---

### 🟡 Architectural Issues

#### 1. Agent-Village Relationship Incomplete
**Status**: KNOWN

- Agent model lacks:
  - villageId (critical - see security issue above)
  - mcp_server_url (from PRD schema)
  - Current status tracking
- **Impact**: Cannot assign agents to villages, no multi-agent coordination
- **Fix**: Schema update + migration + code updates in agents/router.ts, villages/router.ts

#### 2. Mock Data Still Active
**Status**: KNOWN

- Frontend defaults to MockMCPAgentController
- Backend has fallback to in-memory stores when no database
- Production readiness unclear
- **Impact**: Most demo features may not work with real systems

#### 3. Inconsistent ID Types
**Status**: PARTIALLY FIXED (commit cf36475)

- Mix of String and Number IDs throughout code
- TypeScript fixes applied but runtime behavior needs verification
- Database uses String (CUID) throughout

---

### 📊 Test Coverage Summary

| Area | Test Files | Coverage Status |
|------|-----------|-----------------|
| Authentication | 6 files | Good - oauth, refresh, cookies tested |
| Villages | 5+ files | Partial - basic ops, needs multi-org tests |
| Agents | 6+ files | Good - CRUD, sessions, manager lifecycle |
| Bugs | 1-2 files | Minimal - basic operations only |
| GitHub | 5+ files | Good - OAuth, webhooks, rate limiting |
| WebSocket | 2 files | Basic - connection, auth only |
| Frontend scenes | Multiple | Minimal - mostly unit level |
| **Total** | **85 files** | **60-70% coverage** |

---

## Missing Features by PRD Section

### Phase 1: Foundation (Expected Complete ✅)
- [x] Village rendering engine - IMPLEMENTED
- [x] RPG dialogue system - IMPLEMENTED  
- [ ] Performance targets (60 FPS, 100+ sprites) - UNTESTED
- [ ] Mobile responsiveness - BASIC

### Phase 2: Integration (Expected Complete ✅)
- [x] MCP integration - PARTIAL (blockers exist)
- [x] GitHub integration - IMPLEMENTED
- [x] Bug bot system - IMPLEMENTED
- [ ] Probot GitHub App - DEPLOYED but untested

### Phase 3: Polish & Launch (Expected Complete ✅)
- [ ] Onboarding flow - PARTIAL
- [ ] Settings and preferences - IMPLEMENTED
- [ ] Keyboard shortcuts - IMPLEMENTED
- [ ] Production monitoring - BASIC

---

## Summary by Implementation Level

### IMPLEMENTED (Ready for Production)
- ✅ Village visualization with agents and houses
- ✅ RPG dialogue system with three tabs
- ✅ GitHub OAuth and repo synchronization
- ✅ Issue tracking and Bug Bot creation
- ✅ WebSocket real-time updates (infrastructure)
- ✅ Database schema (mostly correct)
- ✅ Access control framework

### PARTIAL (Needs Work Before Production)
- 🟡 MCP agent control (auth blocking, mock usage in dev)
- 🟡 Work stream integration (no real data flow)
- 🟡 Bug bot gamification (progress tracking incomplete)
- 🟡 World map system (no multi-org data loading)
- 🟡 Control panel features (some stubs present)

### MISSING (Post-MVP)
- ❌ Advanced agent orchestration
- ❌ Public village gallery
- ❌ Team collaboration features
- ❌ Advanced analytics
- ❌ CI/CD integration showcase

---

## Critical Path to Production

### Must Fix Before Launch
1. **Add Agent.villageId field** - Unblock authorization (1-2 days)
2. **Implement real MCP integration** - Get actual agents working (2-3 days)
3. **Complete work stream flow** - Real data from agents to dialogue (1-2 days)
4. **E2E testing** - Verify multi-org navigation (2-3 days)

### Nice to Have Before Launch
1. Celebration animations for bug resolution
2. Advanced progress tracking
3. Team member invitations
4. Comprehensive onboarding

### Post-MVP
1. Village marketplace
2. Achievement system
3. Community showcases

---

## Detailed File Path Reference

### Frontend
- Game Scenes: `/packages/frontend/src/scenes/{MainScene,WorldMapScene,InteriorScene,PreloaderScene}.ts`
- UI Components: `/packages/frontend/src/ui/{DialogueUI,ThreadTab,ControlTab,InfoTab}.tsx`
- Game Entities: `/packages/frontend/src/{agents,houses,bugs}/{Agent,House,BugBot}.ts`
- Services: `/packages/frontend/src/{api,realtime,services}/*.ts`
- Utilities: `/packages/frontend/src/{utils,iso,world}/*.ts`

### Backend
- Routes: `/packages/server/src/{agents,villages,bugs,github}/router.ts`
- Services: `/packages/server/src/{agents,bugs,github,villages}/service.ts`
- Database: `/packages/server/prisma/schema.prisma`
- WebSocket: `/packages/server/src/{realtime,ws}.ts`
- Probot: `/packages/server/src/probot/app.ts`
- Auth: `/packages/server/src/auth/{middleware,jwt}.ts`

### Tests
- Server: `/packages/server/src/__tests__/*.test.ts` (85 files)
- Frontend: `/packages/frontend/test/**/*.test.ts`

---

## Recommendations

1. **Immediate**: Deploy Agent.villageId schema change - blocks security fixes
2. **High Priority**: Complete MCP real-time integration - core feature
3. **Medium Priority**: World map multi-org loading - nice-to-have
4. **Low Priority**: Advanced gamification features - post-MVP

