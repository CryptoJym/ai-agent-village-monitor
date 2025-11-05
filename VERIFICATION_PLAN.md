# AI Agent Village Monitor - System Verification Plan

## Overview
This document provides a comprehensive checklist to verify all system components are working correctly.

---

## 🏗️ Phase 1: Infrastructure Setup

### Database Connectivity
```bash
# Test PostgreSQL connection
pnpm -C packages/server prisma db push

# Verify schema
pnpm -C packages/server prisma studio
# Should open http://localhost:5555 with all tables visible
```

**Expected Tables:**
- User, Village, VillageAccess, House
- Agent, AgentSession, WorkStreamEvent
- BugBot, OAuthToken
- AuditEvent, Feedback, SystemMetric

### Redis (Optional but Recommended)
```bash
# If using Docker
docker compose up -d redis

# Test connection
redis-cli ping
# Expected: PONG
```

### Environment Variables
```bash
# Verify .env file exists in packages/server/
ls -la packages/server/.env

# Check required vars are set:
# - DATABASE_URL
# - JWT_SECRET
# - GITHUB_OAUTH_CLIENT_ID
# - GITHUB_OAUTH_CLIENT_SECRET
# - PUBLIC_SERVER_URL
# - PUBLIC_APP_URL
```

---

## 🚀 Phase 2: Service Startup

### Start Backend Server
```bash
pnpm -C packages/server dev
```

**Expected Output:**
```
✓ Prisma client generated
✓ Express server listening on port 3000
✓ Socket.IO server initialized
✓ BullMQ queues created (if Redis available)
✓ Workers started
```

**Health Check:**
```bash
curl http://localhost:3000/healthz
# Expected: {"status":"ok"}

curl http://localhost:3000/readyz
# Expected: {"status":"ready","checks":{"db":"ok","redis":"ok"}}
```

### Start Frontend
```bash
pnpm -C packages/frontend dev
```

**Expected Output:**
```
VITE v5.x.x ready in XXX ms
➜ Local: http://localhost:5173/
```

**Browser Check:**
- Open http://localhost:5173
- Should see loading screen → village world
- Console should show WebSocket connection: "Connected to server"

---

## 🔐 Phase 3: Authentication Flow

### GitHub OAuth Setup

**Prerequisites:**
1. Create GitHub OAuth App at https://github.com/settings/developers
2. Set callback URL: `http://localhost:3000/auth/github/callback`
3. Copy Client ID and Secret to `.env`

### Test Login
1. Navigate to http://localhost:5173
2. Click "Login with GitHub"
3. Authorize on GitHub OAuth page
4. Should redirect back with JWT cookies set

**Verification:**
```bash
# Check cookies in DevTools → Application → Cookies
# Should see:
# - access_token (httpOnly, secure)
# - refresh_token (httpOnly, secure)
```

**Database Verification:**
```sql
-- In Prisma Studio or psql
SELECT * FROM "User" LIMIT 5;
SELECT * FROM "Village" LIMIT 5;
SELECT * FROM "VillageAccess" LIMIT 5;
```

---

## 🏘️ Phase 4: Village & House Sync

### Trigger Organization Sync
```bash
# Via API (replace {villageId} with actual ID from database)
curl -X POST http://localhost:3000/api/villages/{villageId}/sync \
  -H "Cookie: access_token=YOUR_JWT_TOKEN"
```

**Expected Behavior:**
1. Job queued in BullMQ (`github-sync` queue)
2. Worker fetches org repos via GitHub GraphQL
3. Houses created in database with positions
4. WebSocket broadcasts `village_updated` event
5. Frontend renders new houses on grid

**Database Verification:**
```sql
SELECT COUNT(*) FROM "House";
-- Should match number of repos in the synced org

SELECT "repoName", "positionX", "positionY", "primaryLanguage"
FROM "House"
LIMIT 10;
-- Should show repo names with grid positions
```

**Frontend Verification:**
- Houses should appear on isometric grid
- Each house sprite matches repo language (house_typescript.png, etc.)
- Hovering shows repo name tooltip

---

## 🤖 Phase 5: Agent Lifecycle

### Create an Agent
```bash
# Via API
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test Agent",
    "villageId": "YOUR_VILLAGE_ID",
    "userId": "YOUR_USER_ID",
    "positionX": 5,
    "positionY": 5
  }'
```

**Expected Response:**
```json
{
  "id": "clxxx...",
  "name": "Test Agent",
  "status": "idle",
  "positionX": 5,
  "positionY": 5
}
```

### Start Agent Session
```bash
curl -X POST http://localhost:3000/api/agents/{agentId}/start \
  -H "Cookie: access_token=YOUR_JWT_TOKEN"
```

**Expected Behavior:**
1. Job queued in `agent-commands` queue
2. Worker creates `AgentSession` record
3. Agent state transitions: `idle` → `connecting` → `connected`
4. WebSocket emits `agent_update` event
5. Frontend shows agent with "working" animation

**Database Verification:**
```sql
SELECT * FROM "AgentSession" WHERE "agentId" = 'YOUR_AGENT_ID';
-- Should show active session with startedAt timestamp

SELECT COUNT(*) FROM "WorkStreamEvent" WHERE "agentId" = 'YOUR_AGENT_ID';
-- Should show work stream events (connection logs, etc.)
```

### Send Command to Agent
```bash
curl -X POST http://localhost:3000/api/agents/{agentId}/command \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=YOUR_JWT_TOKEN" \
  -d '{
    "command": "test-command",
    "args": {"message": "Hello from test"}
  }'
```

**Expected Behavior:**
1. Command queued
2. Worker sends to MCP agent controller
3. Work stream events append to database
4. WebSocket emits `work_stream` events
5. Frontend dialogue updates in real-time

---

## 🐛 Phase 6: Bug Bot System

### Create a Test Issue on GitHub
1. Go to any repo in the synced org
2. Create a new issue: "Test bug for monitoring"
3. GitHub webhook fires → `POST /api/webhooks/github`

**Expected Behavior:**
1. Webhook validated (HMAC signature)
2. Deduplicated via Redis (delivery ID)
3. `BugBot` created in database
4. Spatial position assigned (random available grid cell)
5. WebSocket emits `bug_bot_spawn` event
6. Frontend spawns bug creature sprite with animation

**Database Verification:**
```sql
SELECT * FROM "BugBot" WHERE "status" = 'open';
-- Should show new bug with x, y coordinates
```

**Frontend Verification:**
- Bug bot appears on grid near associated house
- Click bug → shows issue details
- Assign agent → bug status updates to `assigned`

### Resolve Bug
1. Close the GitHub issue
2. Webhook fires with `issue.closed` action

**Expected Behavior:**
1. `BugBot` status updated to `resolved`
2. WebSocket emits `bug_bot_resolved` event
3. Frontend plays celebration animation
4. Bug sprite removed from grid

---

## 📡 Phase 7: Real-Time WebSocket

### Test WebSocket Connection
```javascript
// In browser DevTools console
const socket = io('http://localhost:3000', {
  auth: { token: 'YOUR_JWT_TOKEN' },
  transports: ['websocket', 'polling']
});

socket.on('connect', () => console.log('Connected:', socket.id));
socket.on('work_stream', (data) => console.log('Work stream:', data));
socket.on('agent_update', (data) => console.log('Agent update:', data));
socket.on('bug_bot_spawn', (data) => console.log('Bug spawned:', data));
```

### Test Room Subscriptions
```javascript
// Join village room
socket.emit('subscribe', { room: 'village:YOUR_VILLAGE_ID' });

// Join agent room
socket.emit('subscribe', { room: 'agent:YOUR_AGENT_ID' });
```

**Expected Behavior:**
- Events only received for subscribed rooms
- Multiple clients receive same broadcasts
- Reconnection works after network drop

---

## 🎮 Phase 8: Frontend Interactions

### Spatial Interactions
**Drag Agent:**
1. Click and drag agent sprite
2. Drop on new grid position
3. Should emit `agent_moved` event
4. Database updates `Agent.positionX/Y`
5. Position persists on page reload

**Drag House:**
1. Click and drag house sprite
2. Drop on new grid position
3. Should emit `house_moved` event
4. Database updates `House.positionX/Y`
5. Audit trail recorded in `AuditEvent`

### UI Panels
**Dialogue Panel:**
- Click agent → dialogue opens
- Shows work stream history
- Real-time updates as agent works
- Tabs: Control, Info, Settings

**House Dashboard:**
- Click house → panel opens
- Shows repo metadata (stars, issues, language)
- Actions: View on GitHub, Trigger Sync, View History

**Settings:**
- Open settings modal
- Change preferences (theme, LOD, FPS)
- Should persist to `User.preferences` JSON field

---

## 📊 Phase 9: Observability & Metrics

### Prometheus Metrics
```bash
curl http://localhost:3000/metrics
```

**Expected Metrics:**
```
# HELP agent_connects_total Total agent connection attempts
# TYPE agent_connects_total counter
agent_connects_total 5

# HELP bug_bots_created_total Total bug bots created
# TYPE bug_bots_created_total counter
bug_bots_created_total 3

# HELP websocket_connections Current WebSocket connections
# TYPE websocket_connections gauge
websocket_connections 2
```

### JSON Metrics
```bash
curl http://localhost:3000/api/metrics | jq
```

**Expected Output:**
```json
{
  "agents": {
    "connects": 5,
    "commands": 12,
    "errors": 0
  },
  "bugs": {
    "created": 3,
    "resolved": 1,
    "assigned": 2
  },
  "cache": {
    "hits": 45,
    "misses": 8
  }
}
```

### Audit Logs
```sql
SELECT
  "eventType",
  "userId",
  "villageId",
  "metadata",
  "createdAt"
FROM "AuditEvent"
ORDER BY "createdAt" DESC
LIMIT 20;
```

**Expected Events:**
- `user_login`, `agent_start`, `agent_stop`
- `bug_created`, `bug_assigned`, `bug_resolved`
- `village_synced`, `house_moved`

---

## 🧪 Phase 10: Automated Testing

### Unit Tests
```bash
# Frontend tests
pnpm -C packages/frontend test

# Server tests
pnpm -C packages/server test
```

**Expected:**
- All test suites pass
- Coverage > 70%

### Integration Tests (Testcontainers)
```bash
pnpm -C packages/server test:int
```

**Expected:**
- Spins up PostgreSQL + Redis containers
- Runs integration tests against real services
- Cleans up containers after

### E2E Tests (Playwright)
```bash
pnpm e2e:preview
```

**Expected:**
- Builds production preview
- Runs Playwright tests
- Verifies critical user journeys:
  - Login flow
  - Village rendering
  - Agent creation
  - WebSocket connection

---

## 🔍 Phase 11: Performance & Load Testing

### Load Test Agent Commands
```bash
# Run load test script
pnpm -C packages/server load:run:all
```

**Expected:**
- Creates 50+ concurrent agent sessions
- Sends 100+ commands
- Measures latency (p50, p95, p99)
- No memory leaks or crashes

### WebSocket Stress Test
```javascript
// Create 100 concurrent connections
for (let i = 0; i < 100; i++) {
  const socket = io('http://localhost:3000', {
    auth: { token: 'YOUR_JWT_TOKEN' }
  });
  socket.on('connect', () => console.log(`Client ${i} connected`));
}
```

**Monitor:**
```bash
# Server metrics
curl http://localhost:3000/metrics | grep websocket_connections

# Redis queue depth
redis-cli LLEN bull:agent-commands:wait
```

---

## ✅ Final Verification Checklist

### Infrastructure
- [ ] PostgreSQL connected and migrated
- [ ] Redis connected (if enabled)
- [ ] Environment variables configured
- [ ] Health checks passing

### Services
- [ ] Backend server running on :3000
- [ ] Frontend dev server on :5173
- [ ] WebSocket server accepting connections
- [ ] BullMQ workers processing jobs

### Authentication
- [ ] GitHub OAuth login works
- [ ] JWT tokens issued and validated
- [ ] User record created in database
- [ ] Villages associated with user

### Core Features
- [ ] Village sync creates houses
- [ ] Houses rendered on grid
- [ ] Agents created and positioned
- [ ] Agent sessions start/stop
- [ ] Commands sent to agents
- [ ] Work streams displayed

### GitHub Integration
- [ ] Webhooks validated (HMAC)
- [ ] Bug bots created from issues
- [ ] Bug bots resolved on close
- [ ] Webhook deduplication works

### Real-Time
- [ ] WebSocket connections stable
- [ ] Room subscriptions work
- [ ] Events broadcast to correct clients
- [ ] Reconnection after disconnect

### UI/UX
- [ ] Phaser scenes load assets
- [ ] Isometric grid renders correctly
- [ ] Drag-and-drop persists positions
- [ ] Dialogue panels update live
- [ ] Settings persist preferences

### Observability
- [ ] Prometheus metrics exported
- [ ] JSON metrics available
- [ ] Audit events logged
- [ ] Health endpoints respond

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Load tests complete without errors

---

## 🚨 Common Issues & Troubleshooting

### Database Connection Fails
```
Error: P1001: Can't reach database server
```
**Fix:**
- Check `DATABASE_URL` in .env
- Ensure PostgreSQL is running: `docker compose up -d postgres`
- Test connection: `psql $DATABASE_URL`

### WebSocket Connection Refused
```
WebSocket connection to 'ws://localhost:3000' failed
```
**Fix:**
- Verify server is running
- Check CORS settings in `packages/server/src/realtime/server.ts`
- Ensure `PUBLIC_APP_URL` matches frontend URL

### GitHub Webhooks Not Firing
**Fix:**
- Use ngrok for local testing: `ngrok http 3000`
- Update webhook URL in GitHub org settings
- Verify `WEBHOOK_SECRET` matches

### Bug Bots Not Spawning
**Fix:**
- Check webhook payload in `/api/webhooks/github` logs
- Verify village exists for org
- Check Redis deduplication isn't blocking

### Agents Not Starting
**Fix:**
- Check BullMQ queue: `redis-cli LLEN bull:agent-commands:wait`
- Verify worker is running: check server logs
- Ensure MCP controller is configured

---

## 📈 Success Metrics

When the system is fully operational:

| Metric | Target |
|--------|--------|
| Health Check Uptime | 99.9% |
| WebSocket Connections | Stable, no drops |
| API Response Time (p95) | < 200ms |
| Bug Bot Spawn Latency | < 5s from webhook |
| Agent Command Latency | < 1s |
| Database Query Time (p95) | < 50ms |
| Frontend Load Time | < 3s |
| Test Pass Rate | 100% |

---

## 🎯 Next Steps After Verification

Once all checks pass:

1. **Deploy to Staging** - Follow `docs/STAGING.md`
2. **Set Up CI/CD** - GitHub Actions workflows
3. **Configure Monitoring** - Prometheus + Grafana
4. **Stress Test** - Run load tests at scale
5. **Security Audit** - Review auth, secrets, CORS
6. **User Testing** - Invite beta testers
7. **Production Deploy** - Follow `docs/deploy-production.md`

---

**Last Updated:** 2025-11-05
**Maintained By:** AI Agent Village Monitor Team
