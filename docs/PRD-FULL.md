# AI Agent Village Monitor - Product Requirements Document (PRD)

## Executive Summary

**Product**: AI Agent Village Monitor  
**Version**: MVP 1.0  
**Target Launch**: 6-8 weeks from start  
**Vision**: Transform AI agent monitoring from boring dashboards into an engaging, spatial RPG experience where developers control their AI workforce through an immersive village interface.

### The Big Idea
GitHub organizations become living villages where repositories are houses, AI agents are interactive sprites, and developers can walk around, talk to agents, control their work, and manage issues through gamified Bug Bots—all while maintaining full Omnara-level control capabilities.

---

## 1. Product Overview

### 1.1 Problem Statement
- **Current State**: AI agent monitoring is fragmented across terminal windows, logs, and static dashboards
- **Pain Points**: No spatial awareness of agent activity, difficult to see what agents are working on, hard to control multiple agents efficiently
- **Market Gap**: Existing tools (Omnara, etc.) provide control but lack engaging visualization and community features

### 1.2 Solution Vision
A **gamified control center** that provides:
- **Spatial Intelligence**: See all your agents and repos in one visual space
- **Real-time Interaction**: Click agents to see streaming work threads and control them directly
- **Community Features**: Org members can visit villages, Bug Bots gamify issue resolution
- **Full Control Parity**: Match Omnara's capabilities for starting, stopping, and directing agents
- **Scalable UX**: World map for multi-org power users

### 1.3 Target Users

#### Primary Users
- **Individual Developers**: Solo developers managing AI agents across personal projects
- **Small Team Leads**: 2-10 person teams using AI agents for development tasks
- **Open Source Maintainers**: Managing AI agents for community projects

#### Secondary Users  
- **Org Members**: Team members who want visibility into AI agent activity
- **Enterprise Users**: Large organizations with multiple repos and complex workflows

### 1.4 Success Criteria
- **Engagement**: Users check their village daily (vs. weekly dashboard visits)
- **Control**: Full feature parity with Omnara for agent management
- **Community**: 500+ villages created in first 3 months
- **Retention**: 70%+ weekly active rate for village owners

---

## 2. User Stories & Use Cases

### 2.1 Core User Journeys

#### Journey 1: New User Setup
```
As a developer with AI agents,
I want to connect my GitHub org and see my repos as houses,
So that I can visualize my development ecosystem spatially.

Acceptance Criteria:
- OAuth GitHub login in under 30 seconds
- Auto-generate village from org repos
- See agent sprites for connected MCP servers
- Working village within 2 minutes of signup
```

#### Journey 2: Agent Interaction
```
As a village owner,
I want to click an agent and see what they're working on,
So that I can understand and direct their current tasks.

Acceptance Criteria:
- Click agent → RPG dialogue opens in <300ms
- Live streaming work thread with timestamps
- "Control Panel" tab with Run Tool, Commit, PR buttons
- Can ask questions and get contextual responses
```

#### Journey 3: Issue Resolution
```
As a developer,
I want Bug Bots to appear when issues are created,
So that I can assign agents to fix problems visually.

Acceptance Criteria:
- New GitHub issue → Bug Bot spawns on repo house
- Click bug bot → see issue details
- Assign agent → bot follows agent, fades as progress is made
- Issue closed → bot disappears with celebration
```

#### Journey 4: Multi-Org Management
```
As a power user with multiple orgs,
I want a world map to navigate between villages,
So that I can manage all my organizations efficiently.

Acceptance Criteria:
- World map shows all accessible orgs as regions
- Click/teleport between villages instantly
- Persistent agent state across navigation
- Performance remains smooth with 10+ orgs
```

### 2.2 User Personas

#### "Solo Sam" - Individual Developer
- **Background**: Freelance developer, 3-5 personal repos, uses Claude Code for coding tasks
- **Goals**: Wants to see which agents are idle vs. working, easily assign new tasks
- **Pain Points**: Loses track of what agents are doing, switches between many terminal windows
- **Village Needs**: Single org, clean interface, quick agent control

#### "Team Lead Taylor" - Small Team Manager
- **Background**: Leads 5-person dev team, 15 active repos, manages AI agents for the team
- **Goals**: Team visibility into AI agent work, prevent conflicts, coordinate efforts
- **Pain Points**: Team members don't know what agents are doing, duplicate work
- **Village Needs**: Multi-user access, clear activity visualization, team coordination

#### "Maintainer Morgan" - Open Source Leader
- **Background**: Maintains popular OSS project, 50+ contributors, multiple AI agents for triage
- **Goals**: Showcase AI usage publicly, gamify contribution process, manage issues efficiently
- **Pain Points**: Too many issues to triage manually, community wants transparency
- **Village Needs**: Public village mode, Bug Bot showcase, community engagement features

---

## 3. Feature Specifications

### 3.1 Core Features (MVP Required)

#### Feature 1: Village Visualization Engine
**Description**: Isometric village where repos are houses, agents are sprites
**Priority**: P0 (Critical Path)

**Technical Requirements**:
- Phaser.js game engine with isometric tilemap support
- 60 FPS performance with 100+ sprites
- Responsive design (1024x768 minimum)
- Smooth pan/zoom controls

**User Requirements**:
- Houses visually represent repo characteristics (language, activity, size)
- Agent sprites show status (working, idle, debugging) through color/animation
- Hover effects show preview information
- Click interactions feel responsive and natural

**Acceptance Criteria**:
- [ ] Village renders from GitHub org data in <3 seconds
- [ ] Houses show correct repo names and basic stats
- [ ] Agent sprites animate and show status indicators
- [ ] Pan/zoom works smoothly on desktop and mobile
- [ ] Village persists state between sessions

#### Feature 2: RPG Dialogue System
**Description**: Bottom-panel interface for agent interaction
**Priority**: P0 (Critical Path)

**Technical Requirements**:
- Slides up from bottom (30% screen height)
- Real-time streaming text updates
- Multiple tabs (Thread, Control, Info)
- Text input for user questions

**User Requirements**:
- Click agent → dialogue opens immediately
- See live work thread with timestamps
- Ask questions and get contextual responses
- Control buttons for common actions
- ESC key or click-away to close

**Acceptance Criteria**:
- [ ] Dialogue opens in <300ms after agent click
- [ ] Work thread updates in real-time via WebSocket
- [ ] Control buttons (Run Tool, Commit, PR) work end-to-end
- [ ] Text input accepts questions and shows responses
- [ ] Clean, readable design that doesn't obstruct village view

#### Feature 3: MCP Agent Integration
**Description**: Full control parity with Omnara for agent management
**Priority**: P0 (Critical Path)

**Technical Requirements**:
- MCP client SDK for tool invocation
- WebSocket streaming for real-time updates
- Command queue for reliable execution
- Error handling and retry logic

**User Requirements**:
- Start/stop agent sessions
- See live tool usage and outputs
- Run custom tools with parameters
- Execute multi-step tasks
- Get status updates and error reports

**Acceptance Criteria**:
- [ ] Can connect to existing MCP servers
- [ ] Tool execution streams results to dialogue
- [ ] Session management (start/stop/restart) works reliably
- [ ] Error states are clearly communicated
- [ ] All core Omnara features are accessible

#### Feature 4: GitHub Integration
**Description**: Repository data, issue tracking, and action triggers
**Priority**: P0 (Critical Path)

**Technical Requirements**:
- GitHub OAuth for authentication
- REST API for repo data and operations
- Webhook support for real-time updates
- Actions integration for CI triggers

**User Requirements**:
- OAuth login with GitHub
- Repos automatically become houses
- File operations reflect in real-time
- Can trigger GitHub Actions from village
- Issue data feeds Bug Bot system

**Acceptance Criteria**:
- [ ] OAuth flow completes in <30 seconds
- [ ] Repo data syncs and updates automatically
- [ ] File changes by agents update house status
- [ ] GitHub Actions can be triggered from dialogue
- [ ] Issues appear as Bug Bots within 10 seconds

### 3.2 Enhanced Features (MVP Nice-to-Have)

#### Feature 5: Bug Bot System
**Description**: Gamified issue management through bot sprites
**Priority**: P1 (High Value)

**Technical Requirements**:
- Probot GitHub App for issue webhooks
- Sprite spawning system
- Agent assignment logic
- Progress tracking

**User Requirements**:
- Issues create Bug Bot sprites
- Bots appear on relevant repo houses
- Can assign agents to bots
- Bots fade as issues are resolved
- Celebration when bugs are fixed

**Acceptance Criteria**:
- [ ] New issues spawn Bug Bots within 10 seconds
- [ ] Bug Bots show issue severity and type
- [ ] Agent-to-bot assignment works via drag/click
- [ ] Progress updates affect bot appearance
- [ ] Resolved issues remove bots with animation

#### Feature 6: World Map System
**Description**: Multi-org navigation for power users
**Priority**: P1 (Power User Feature)

**Technical Requirements**:
- Tiled world map composition
- Chunked loading for performance
- Fast travel between villages
- State persistence across transitions

**User Requirements**:
- Access multiple GitHub orgs
- Navigate between villages quickly
- Maintain agent states during travel
- Overview map for spatial awareness
- Teleport/fast travel options

**Acceptance Criteria**:
- [ ] World map loads orgs as distinct regions
- [ ] Travel between villages takes <2 seconds
- [ ] Agent states persist across navigation
- [ ] Performance remains smooth with 10+ orgs
- [ ] Mini-map shows current location

### 3.3 Community Features (Post-MVP)

#### Feature 7: Village Sharing
- Public village gallery
- Screenshot sharing
- Village templates
- Achievement system

#### Feature 8: Collaborative Features  
- Org member access controls
- Team chat integration
- Shared agent coordination
- Activity notifications

---

## 4. Technical Architecture

### 4.1 System Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │   Integrations  │
│                 │    │                  │    │                 │
│ • Phaser.js     │◄──►│ • Node.js/Express│◄──►│ • GitHub API    │
│ • React (UI)    │    │ • PostgreSQL     │    │ • MCP Servers   │
│ • WebSocket     │    │ • Redis (cache)  │    │ • Probot App    │
│ • Service Worker│    │ • WebSocket      │    │ • GitHub Actions│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 4.2 Technology Stack

#### Frontend
- **Game Engine**: Phaser.js 3.70+ for village rendering
- **UI Framework**: React 18+ for settings/auth UI
- **Real-time**: Native WebSocket + Socket.io fallback
- **Build Tool**: Vite for fast development
- **Deployment**: Vercel for global CDN

#### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with middleware
- **Database**: PostgreSQL 15+ for relational data
- **Cache**: Redis for sessions and real-time state
- **Queue**: Bull/BullMQ for async task processing

#### Integrations
- **MCP Client**: Official TypeScript SDK
- **GitHub**: REST API + GraphQL for complex queries
- **GitHub App**: Probot framework for webhooks
- **Auth**: GitHub OAuth 2.0 with JWT tokens

### 4.3 Database Schema

#### Core Entities
```sql
-- Users and authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    github_id INTEGER UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    access_token_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- GitHub organizations as villages
CREATE TABLE villages (
    id SERIAL PRIMARY KEY,
    github_org_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    owner_id INTEGER REFERENCES users(id),
    is_public BOOLEAN DEFAULT false,
    village_config JSONB,
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Repositories as houses
CREATE TABLE houses (
    id SERIAL PRIMARY KEY,
    village_id INTEGER REFERENCES villages(id),
    github_repo_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    primary_language VARCHAR(100),
    stars INTEGER DEFAULT 0,
    position_x FLOAT,
    position_y FLOAT,
    house_style JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI agents
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    village_id INTEGER REFERENCES villages(id),
    name VARCHAR(255) NOT NULL,
    mcp_server_url VARCHAR(500),
    agent_config JSONB,
    current_status VARCHAR(100) DEFAULT 'idle',
    position_x FLOAT,
    position_y FLOAT,
    sprite_config JSONB,
    last_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Agent work sessions and streams
CREATE TABLE agent_sessions (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id),
    session_token VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);

CREATE TABLE work_stream_events (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES agent_sessions(id),
    event_type VARCHAR(100) NOT NULL,
    content TEXT,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Bug bots from GitHub issues
CREATE TABLE bug_bots (
    id SERIAL PRIMARY KEY,
    house_id INTEGER REFERENCES houses(id),
    github_issue_id INTEGER UNIQUE NOT NULL,
    title VARCHAR(500),
    severity VARCHAR(50),
    assigned_agent_id INTEGER REFERENCES agents(id),
    status VARCHAR(50) DEFAULT 'open',
    position_x FLOAT,
    position_y FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Permissions and access control
CREATE TABLE village_access (
    id SERIAL PRIMARY KEY,
    village_id INTEGER REFERENCES villages(id),
    user_id INTEGER REFERENCES users(id),
    role VARCHAR(50) NOT NULL, -- 'owner', 'member', 'visitor'
    granted_at TIMESTAMP DEFAULT NOW()
);
```

### 4.4 API Design

#### REST Endpoints
```typescript
// Authentication
POST /auth/github/callback
GET  /auth/me
POST /auth/logout

// Villages
GET    /api/villages              // List user's accessible villages
POST   /api/villages              // Create new village from GitHub org
GET    /api/villages/:id          // Get village details
PUT    /api/villages/:id          // Update village settings
DELETE /api/villages/:id          // Delete village

// Houses (Repositories)
GET  /api/villages/:id/houses     // Get all houses in village
POST /api/villages/:id/houses/sync // Sync with GitHub repos

// Agents
GET    /api/villages/:id/agents   // Get all agents in village
POST   /api/villages/:id/agents   // Add new agent
PUT    /api/agents/:id            // Update agent config
DELETE /api/agents/:id            // Remove agent

// Agent Control
POST /api/agents/:id/start        // Start agent session
POST /api/agents/:id/stop         // Stop agent session
POST /api/agents/:id/command      // Send command to agent
GET  /api/agents/:id/stream       // Get work stream events

// Bug Bots
GET  /api/villages/:id/bugs       // Get all bug bots
POST /api/bugs/:id/assign         // Assign agent to bug
PUT  /api/bugs/:id/status         // Update bug status

// GitHub Integration
POST /api/github/webhook          // GitHub webhook handler
POST /api/github/dispatch         // Trigger repository dispatch
```

#### WebSocket Events
```typescript
// Client → Server
{
  "type": "join_village",
  "village_id": "123",
  "user_token": "jwt_token"
}

{
  "type": "agent_command",
  "agent_id": "456",
  "command": "run_tool",
  "params": { "tool": "file_search", "query": "auth" }
}

// Server → Client
{
  "type": "agent_update",
  "agent_id": "456",
  "status": "working",
  "position": { "x": 100, "y": 200 }
}

{
  "type": "work_stream",
  "session_id": "789",
  "event": {
    "type": "tool_call",
    "content": "Searching files for 'auth'...",
    "timestamp": "2025-09-13T22:45:00Z"
  }
}

{
  "type": "bug_bot_spawn",
  "house_id": "321",
  "bug": {
    "id": "111",
    "title": "Login form validation error",
    "severity": "medium"
  }
}
```

### 4.5 MCP Integration

#### Agent Control Service
```typescript
class MCPAgentController {
  private clients: Map<string, MCPClient> = new Map();

  async connectAgent(agentId: string, serverUrl: string) {
    const client = new MCPClient();
    await client.connect({ url: serverUrl });
    
    // Subscribe to work stream
    client.on('tool_call', (event) => {
      this.broadcastWorkEvent(agentId, 'tool_call', event);
    });
    
    client.on('result', (event) => {
      this.broadcastWorkEvent(agentId, 'result', event);
    });
    
    this.clients.set(agentId, client);
  }

  async runTool(agentId: string, toolName: string, params: any) {
    const client = this.clients.get(agentId);
    if (!client) throw new Error('Agent not connected');
    
    return await client.callTool(toolName, params);
  }

  async runTask(agentId: string, taskDescription: string) {
    const client = this.clients.get(agentId);
    if (!client) throw new Error('Agent not connected');
    
    // Orchestrate multi-step task
    return await client.sendMessage({
      role: 'user',
      content: taskDescription
    });
  }

  private broadcastWorkEvent(agentId: string, type: string, data: any) {
    // Emit to WebSocket clients
    this.wsServer.to(`agent:${agentId}`).emit('work_stream', {
      agent_id: agentId,
      type,
      data,
      timestamp: new Date().toISOString()
    });
  }
}
```

### 4.6 GitHub Integration

#### Probot App for Bug Bots
```typescript
// probot-app.ts
export default (app: Probot) => {
  // New issue creates Bug Bot
  app.on('issues.opened', async (context) => {
    const issue = context.payload.issue;
    const repo = context.payload.repository;
    
    await createBugBot({
      repo_id: repo.id,
      issue_id: issue.id,
      title: issue.title,
      severity: determineSeverity(issue.labels),
      created_by: issue.user.login
    });
    
    // Notify village via WebSocket
    websocketServer.to(`repo:${repo.id}`).emit('bug_bot_spawn', {
      issue_id: issue.id,
      title: issue.title,
      severity: determineSeverity(issue.labels)
    });
  });

  // Issue closed removes Bug Bot
  app.on('issues.closed', async (context) => {
    const issue = context.payload.issue;
    
    await removeBugBot(issue.id);
    
    websocketServer.to(`repo:${context.payload.repository.id}`).emit('bug_bot_resolved', {
      issue_id: issue.id
    });
  });

  // Check run failure creates Bug Bot
  app.on('check_run.completed', async (context) => {
    const checkRun = context.payload.check_run;
    
    if (checkRun.conclusion === 'failure') {
      await createBugBot({
        repo_id: context.payload.repository.id,
        check_run_id: checkRun.id,
        title: `CI Failure: ${checkRun.name}`,
        severity: 'high',
        type: 'ci_failure'
      });
    }
  });
};
```

---

## 5. User Experience Design

### 5.1 Visual Design System

#### Village Aesthetics
- **Art Style**: Isometric pixel art, clean and modern
- **Color Palette**: 
  - Primary: #3498db (agent blue)
  - Success: #2ecc71 (working green)  
  - Warning: #f39c12 (debugging orange)
  - Error: #e74c3c (error red)
  - Neutral: #95a5a6 (idle gray)

#### House Variations
- **Language-based**: Different architectural styles per programming language
- **Activity-based**: Windows light up during commits, chimneys smoke during builds
- **Health-based**: Scaffolding appears for repos with many issues

#### Agent Sprites
- **Status Indicators**: Color-coded rings around agents
- **Animations**: Idle bobbing, walking between houses, working gestures
- **Customization**: Generated sprites based on agent ID for uniqueness

### 5.2 Interaction Patterns

#### Village Navigation
- **Pan**: Click and drag to move around village
- **Zoom**: Mouse wheel or pinch to zoom in/out (0.5x to 2x)
- **Minimap**: Small overview in corner for large villages
- **Fast Travel**: Double-click house to center view

#### Agent Interaction
- **Hover**: Show agent name and current status
- **Click**: Open RPG dialogue panel
- **Drag**: Move agent between houses (visual only)
- **Right-click**: Quick action menu

#### Dialogue System
- **Slide Animation**: 300ms ease-out from bottom
- **Tab Navigation**: Thread | Control | Info tabs
- **Auto-scroll**: New messages scroll to bottom
- **Input Focus**: Click input area or press 'T' to talk

### 5.3 Responsive Design

#### Desktop (1024px+)
- Full village view with dialogue panel
- All controls accessible
- Keyboard shortcuts enabled

#### Tablet (768px - 1023px)  
- Scaled village with touch controls
- Dialogue panel adapts to screen size
- Touch-friendly buttons

#### Mobile (< 768px)
- Portrait mode supported
- Dialogue takes 50% of screen
- Simplified controls

---

## 6. Development Plan

### 6.1 Phase 1: Foundation (Weeks 1-2)

#### Week 1: Village Rendering Engine
**Goal**: Basic village visualization with static data

**Tasks**:
- [ ] Set up Phaser.js project with TypeScript
- [ ] Create isometric tilemap system
- [ ] Implement house sprites for different repo types
- [ ] Add agent sprites with basic animations
- [ ] Build pan/zoom camera controls
- [ ] Create responsive canvas sizing

**Deliverables**:
- Working village demo with mock data
- 60 FPS performance benchmark
- Mobile-responsive rendering

**Success Criteria**:
- Village renders 50+ houses smoothly
- Camera controls feel natural
- Houses show distinct visual styles

#### Week 2: RPG Dialogue System
**Goal**: Interactive dialogue interface with agent communication

**Tasks**:
- [ ] Build DialogueUI component with slide animation
- [ ] Create tabbed interface (Thread, Control, Info)
- [ ] Implement real-time message streaming
- [ ] Add user input system
- [ ] Connect to mock MCP client
- [ ] Style dialogue for readability

**Deliverables**:
- Functional dialogue system
- Mock work thread streaming
- Basic agent control buttons

**Success Criteria**:
- Dialogue opens/closes smoothly
- Messages stream in real-time
- User can send questions to agents

### 6.2 Phase 2: Integration (Weeks 3-4)

#### Week 3: MCP & GitHub Integration
**Goal**: Real agent control and GitHub data

**Tasks**:
- [ ] Integrate MCP TypeScript SDK
- [ ] Build agent session management
- [ ] Connect GitHub OAuth and API
- [ ] Sync repos to houses automatically
- [ ] Implement basic agent commands
- [ ] Add error handling and retries

**Deliverables**:
- Live MCP agent connections
- GitHub repo data synchronization
- Working agent control commands

**Success Criteria**:
- Can start/stop real MCP agents
- Village updates from GitHub data
- Tool commands execute successfully

#### Week 4: Bug Bot System
**Goal**: Gamified issue management

**Tasks**:
- [ ] Set up Probot GitHub App
- [ ] Create bug bot sprite system
- [ ] Implement issue webhook handling
- [ ] Build agent assignment logic
- [ ] Add bot lifecycle management
- [ ] Create resolution celebrations

**Deliverables**:
- Working Probot app
- Bug bot spawning system
- Agent-to-bot assignment

**Success Criteria**:
- Issues create bots within 10 seconds
- Agents can be assigned to bots
- Resolved issues remove bots

### 6.3 Phase 3: Polish & Launch (Weeks 5-6)

#### Week 5: Performance & UX
**Goal**: Production-ready performance and user experience

**Tasks**:
- [ ] Optimize rendering performance
- [ ] Add loading states and error handling
- [ ] Implement user onboarding flow
- [ ] Create settings and preferences
- [ ] Add keyboard shortcuts
- [ ] Write comprehensive documentation

**Deliverables**:
- Performance optimizations
- Smooth user onboarding
- Complete documentation

**Success Criteria**:
- 60 FPS with 100+ sprites
- New users can set up village in <2 minutes
- All major features documented

#### Week 6: Testing & Deployment
**Goal**: Launch-ready product with monitoring

**Tasks**:
- [ ] End-to-end testing suite
- [ ] Security audit and fixes
- [ ] Set up production monitoring
- [ ] Deploy to production infrastructure
- [ ] Create feedback collection system
- [ ] Plan launch communications

**Deliverables**:
- Production deployment
- Monitoring dashboards
- Launch announcement

**Success Criteria**:
- All tests passing
- Security vulnerabilities addressed
- Production environment stable

---

## 7. Success Metrics & KPIs

### 7.1 Engagement Metrics

#### Primary Metrics
- **Daily Active Villages**: Number of villages viewed per day
- **Session Duration**: Average time spent in village per session (target: 5+ minutes)
- **Agent Interactions**: Number of agent dialogues opened per session (target: 3+)
- **Command Execution**: Number of successful agent commands per week (target: 50+)

#### Secondary Metrics
- **Village Creation Rate**: New villages created per week
- **Bug Bot Engagement**: Percentage of bug bots that get assigned to agents
- **Return Rate**: Users who return within 7 days of first visit (target: 60%)
- **Feature Usage**: Adoption rate of different features (dialogue, controls, world map)

### 7.2 Technical Metrics

#### Performance
- **Load Time**: Village initial render time (target: <3 seconds)
- **Frame Rate**: Consistent 60 FPS with 100+ sprites
- **WebSocket Latency**: Real-time updates (target: <200ms)
- **Error Rate**: Successful API calls (target: >99%)

#### Reliability
- **Uptime**: Service availability (target: 99.9%)
- **Data Accuracy**: GitHub sync accuracy (target: >99.5%)
- **Agent Connectivity**: MCP connection success rate (target: >95%)

### 7.3 Business Metrics

#### Growth
- **User Acquisition**: New users per week
- **Organic Growth**: Users who discover through community sharing
- **GitHub App Installs**: Probot app installation rate
- **API Usage**: Third-party integrations built

#### Retention
- **Weekly Active Rate**: Users active within 7 days (target: 70%)
- **Monthly Retention**: Users still active after 30 days (target: 40%)
- **Feature Stickiness**: Users who use advanced features regularly
- **Community Engagement**: Village sharing and showcase participation

---

## 8. Risk Assessment & Mitigation

### 8.1 Technical Risks

#### Risk: MCP Server Reliability
**Impact**: Medium - Agents may become unresponsive
**Probability**: Medium - Third-party servers can be unstable
**Mitigation**: 
- Implement robust error handling and reconnection logic
- Provide clear offline/error states in UI
- Support multiple MCP server connections per agent

#### Risk: Performance with Large Orgs
**Impact**: High - Poor UX for power users
**Probability**: Medium - Some orgs have 100+ repos
**Mitigation**:
- Implement sprite culling and level-of-detail system
- Use chunked loading for world map
- Add performance monitoring and optimization tools

#### Risk: WebSocket Connection Issues
**Impact**: Medium - Real-time updates may fail
**Probability**: Medium - Network issues, corporate firewalls
**Mitigation**:
- Implement fallback to HTTP polling
- Add connection status indicators
- Graceful degradation for offline scenarios

### 8.2 Product Risks

#### Risk: Complex User Onboarding
**Impact**: High - Users may abandon before seeing value
**Probability**: Medium - GitHub OAuth + MCP setup can be complex
**Mitigation**:
- Create guided onboarding with progress indicators
- Provide demo mode with sample data
- Build comprehensive documentation and video tutorials

#### Risk: Lack of Agent Adoption
**Impact**: High - Empty villages aren't engaging
**Probability**: Low - Assumes users already use AI agents
**Mitigation**:
- Partner with popular AI agent tools
- Provide sample MCP servers and demo agents
- Create content showing agent setup and benefits

#### Risk: GitHub Rate Limiting
**Impact**: Medium - Sync issues and delayed updates
**Probability**: Low - With proper caching and optimization
**Mitigation**:
- Implement intelligent caching and rate limit handling
- Use GraphQL for efficient data fetching
- Add retry logic with exponential backoff

### 8.3 Business Risks

#### Risk: Low Community Engagement
**Impact**: Medium - Reduced viral growth
**Probability**: Medium - Community features require critical mass
**Mitigation**:
- Focus on individual user value first
- Create showcase events and competitions
- Partner with developer communities for initial adoption

#### Risk: Competition from Omnara
**Impact**: Medium - May limit growth potential
**Probability**: Medium - Similar feature set
**Mitigation**:
- Focus on unique village/RPG experience
- Build strong community and open-source ecosystem
- Emphasize visual and collaborative features

---

## 9. Future Roadmap

### 9.1 Post-MVP Features (Months 2-6)

#### Advanced Village Features
- **Seasonal Events**: Halloween haunted repos, Christmas decorations
- **Weather System**: Visual indicators of repo health and activity
- **Village Customization**: Themes, decorations, layout preferences
- **Animation System**: More sophisticated agent behaviors and interactions

#### Collaboration Features
- **Team Villages**: Multiple owners for org villages
- **Visitor Mode**: Read-only access for org members
- **Chat Integration**: Discord/Slack connectivity for team coordination
- **Activity Feeds**: Notifications and summaries of agent work

#### Analytics & Insights
- **Agent Productivity**: Metrics on agent performance and efficiency
- **Repo Health**: Visual indicators of code quality and maintenance
- **Team Insights**: Collaboration patterns and bottleneck identification
- **Historical Data**: Trends and patterns over time

### 9.2 Long-term Vision (6+ Months)

#### Enterprise Features
- **Multi-tenant Architecture**: Support for large organizations
- **Advanced Permissions**: Fine-grained access control
- **Audit Logging**: Complete activity tracking for compliance
- **Custom Integrations**: API for third-party tool connections

#### Community Platform
- **Village Marketplace**: Share configurations and templates
- **Agent Library**: Community-contributed MCP servers
- **Plugin System**: Third-party extensions and customizations
- **Events & Competitions**: Community challenges and showcases

#### AI Enhancement
- **Natural Language Control**: Voice commands for agent management
- **Predictive Analytics**: AI-driven insights and recommendations
- **Intelligent Automation**: Auto-assignment of agents to tasks
- **Code Understanding**: Deep integration with code analysis tools

---

## 10. Conclusion

The AI Agent Village Monitor represents a unique opportunity to transform developer tooling through gamification and spatial visualization. By combining the proven control capabilities of tools like Omnara with an engaging, community-driven experience, we can create a product that developers actually enjoy using daily.

The MVP focuses on delivering core value—spatial awareness of AI agents and streamlined control—while laying the foundation for advanced community and collaboration features. With careful attention to performance, user experience, and integration reliability, this product can establish a new category in developer tooling.

**Success depends on**:
1. **Flawless core experience**: Village visualization and agent control must work perfectly
2. **Strong community**: Early adopters who share and showcase their villages
3. **Reliable integrations**: Seamless GitHub and MCP connectivity
4. **Continuous iteration**: Rapid response to user feedback and needs

The technical architecture is sound, the user need is validated, and the competitive differentiation is clear. With focused execution on this roadmap, the AI Agent Village Monitor can become the premier platform for AI-assisted development workflow management.

---

*Document Version: 1.0*  
*Last Updated: September 13, 2025*  
*Next Review: After MVP completion*

and import plotly.graph_objects as go
import pandas as pd

# Define the tasks data
tasks_data = [
    dict(Task="Village Render", Start_Week=1, Duration=1, Type="Frontend", Description="Phaser.js setup"),
    dict(Task="RPG Dialogue", Start_Week=2, Duration=1, Type="Frontend", Description="UI panel system"),
    dict(Task="MCP Integration", Start_Week=3, Duration=1, Type="Backend", Description="Real agents"),
    dict(Task="Bug Bot System", Start_Week=4, Duration=1, Type="Backend", Description="Probot app"),
    dict(Task="Performance", Start_Week=5, Duration=1, Type="DevOps", Description="Optimization"),
    dict(Task="Test & Launch", Start_Week=6, Duration=1, Type="Testing", Description="QA & deploy")
]

# Create DataFrame
df = pd.DataFrame(tasks_data)

# Color mapping using specified brand colors
color_map = {
    "Frontend": "#2E8B57",    # Sea green
    "Backend": "#1FB8CD",     # Strong cyan
    "DevOps": "#D2BA4C",      # Moderate yellow (orange-ish)
    "Testing": "#944454"      # Pink-red (purple-ish)
}

# Create the figure
fig = go.Figure()

# Add task bars spanning their duration
for i, row in df.iterrows():
    # Add main task bar
    fig.add_trace(go.Bar(
        x=[row['Duration']],
        y=[row['Task']],
        orientation='h',
        marker_color=color_map[row['Type']],
        name=row['Type'],
        legendgroup=row['Type'],
        showlegend=True,
        width=0.5,
        base=row['Start_Week'] - 0.5  # Position bar at correct week
    ))

# Remove duplicate legend entries by tracking what's been added
legend_added = set()
for trace in fig.data:
    if trace.name in legend_added:
        trace.showlegend = False
    else:
        legend_added.add(trace.name)

# Add milestone diamonds
milestones = [
    dict(week=2.5, task="RPG Dialogue", label="Core UI Done"),
    dict(week=4.5, task="Bug Bot System", label="Full Integr'n"),
    dict(week=6.5, task="Test & Launch", label="MVP Ready")
]

task_positions = {task: i for i, task in enumerate(df['Task'])}

for milestone in milestones:
    y_pos = task_positions[milestone['task']]
    fig.add_trace(go.Scatter(
        x=[milestone['week']],
        y=[y_pos],
        mode='markers+text',
        marker=dict(
            symbol='diamond',
            size=12,
            color='#DB4545',
            line=dict(color='black', width=1)
        ),
        text=milestone['label'],
        textposition="top center",
        textfont=dict(size=10, color='black'),
        showlegend=False,
        name='Milestone'
    ))

# Add dependency arrows between consecutive tasks
for i in range(len(df) - 1):
    current_task = df.iloc[i]
    next_task = df.iloc[i + 1]
    
    # Arrow from end of current task to start of next task
    fig.add_annotation(
        x=next_task['Start_Week'] - 0.5,
        y=i + 1,
        ax=current_task['Start_Week'] + current_task['Duration'] - 0.5,
        ay=i,
        arrowhead=2,
        arrowsize=1,
        arrowwidth=2,
        arrowcolor='gray',
        opacity=0.7
    )

# Update layout
fig.update_layout(
    title="6-Week MVP Development Plan",
    xaxis=dict(
        title="Timeline",
        tickmode='array',
        tickvals=[1, 2, 3, 4, 5, 6],
        ticktext=['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
        range=[0.5, 7]
    ),
    yaxis=dict(
        title="Dev Tracks",
        categoryorder="array",
        categoryarray=list(reversed(df['Task'].tolist()))
    ),
    barmode='overlay',
    legend=dict(
        orientation='h',
        yanchor='bottom',
        y=1.05,
        xanchor='center',
        x=0.5
    )
)

# Update traces
fig.update_traces(cliponaxis=False)

# Save the chart
fig.write_image("gantt_chart.png")
fig.write_image("gantt_chart.svg", format="svg")

fig.show()

and implementation_checklist.md
Generated File
AI Agent Village Monitor - Implementation Checklist
Phase 1: Foundation (Weeks 1-2)
Week 1: Village Rendering Engine ✅
Frontend Setup
 Initialize Phaser.js 3.70+ project with TypeScript

 Configure Vite build system with hot reload

 Set up responsive canvas with viewport management

 Create isometric coordinate conversion utilities

 Implement smooth pan/zoom camera controls

Village Visualization
 Design and create house sprite templates (10+ variations)

 Generate agent sprites with status color coding

 Build tilemap system for village ground/paths

 Create sprite animation system (idle, walking, working)

 Implement hover effects and status indicators

Performance Baseline
 Achieve 60 FPS with 100+ sprites

 Implement sprite culling for off-screen objects

 Add performance monitoring and FPS counter

 Test on mobile devices (iOS/Android)

Success Criteria: Working village demo with mock data, smooth interactions

Week 2: RPG Dialogue System ✅
Dialogue Interface
 Create DialogueUI container component

 Implement slide-up animation (300ms ease-out)

 Build tabbed interface (Thread, Control, Info)

 Add auto-scrolling message history

 Create responsive design for mobile

Streaming System
 Set up WebSocket client connection

 Implement real-time message streaming

 Add message queuing and offline handling

 Create typing indicators and status updates

 Build user input system with text suggestions

Mock Integration
 Create mock MCP client for testing

 Generate realistic work thread data

 Simulate agent responses to user questions

 Add error states and loading indicators

Success Criteria: Functional dialogue system with simulated streaming

Phase 2: Integration (Weeks 3-4)
Week 3: MCP & GitHub Integration ✅
MCP Client Integration
 Install and configure MCP TypeScript SDK

 Build agent session management system

 Implement tool invocation with parameter passing

 Add real-time event streaming from MCP servers

 Create error handling and reconnection logic

GitHub Integration
 Set up GitHub OAuth 2.0 flow

 Build GitHub API client with rate limiting

 Implement repository data synchronization

 Add webhook handling for real-time updates

 Create permission system based on GitHub access

Backend Services
 Set up Node.js/Express server with TypeScript

 Configure PostgreSQL database with schemas

 Implement Redis for session and cache management

 Build WebSocket server for real-time communication

 Add JWT authentication and authorization

Success Criteria: Real MCP agents controllable from village interface

Week 4: Bug Bot System ✅
Probot GitHub App
 Create and configure Probot application

 Set up GitHub App permissions and webhooks

 Implement issue tracking and event handling

 Add CI failure detection and reporting

 Build security alert integration

Bug Bot Mechanics
 Design bug bot sprite variations (severity levels)

 Implement spawn/despawn animation system

 Create agent-to-bot assignment mechanics

 Add progress tracking and status updates

 Build resolution celebration effects

Integration Testing
 Test end-to-end issue → bot → assignment → resolution

 Verify webhook reliability and error handling

 Load test with multiple simultaneous issues

 Validate GitHub App permissions and security

Success Criteria: Working issue-to-bot pipeline with agent assignment

Phase 3: Polish & Launch (Weeks 5-6)
Week 5: Performance & UX ✅
Performance Optimization
 Profile and optimize rendering performance

 Implement efficient sprite batching

 Add level-of-detail (LOD) system for distant objects

 Optimize WebSocket message handling

 Reduce bundle size and improve load times

User Experience
 Create guided onboarding flow

 Add keyboard shortcuts and accessibility

 Implement settings and preferences system

 Build comprehensive help documentation

 Add user feedback collection system

Error Handling
 Implement graceful error recovery

 Add offline mode with cached data

 Create clear error messages and help text

 Build connection status indicators

 Add retry mechanisms for failed operations

Success Criteria: Production-ready UX with smooth onboarding

Week 6: Testing & Deployment ✅
Quality Assurance
 Write comprehensive unit test suite

 Create end-to-end testing scenarios

 Perform security audit and penetration testing

 Load test with simulated user traffic

 Cross-browser compatibility testing

Production Deployment
 Set up CI/CD pipeline (GitHub Actions)

 Configure production infrastructure (Vercel + Railway)

 Implement monitoring and alerting (DataDog/NewRelic)

 Set up error tracking (Sentry)

 Create backup and disaster recovery procedures

Launch Preparation
 Prepare launch announcement and demo videos

 Create developer documentation and API reference

 Set up community channels (Discord/GitHub Discussions)

 Plan initial user acquisition strategy

 Prepare customer support processes

Success Criteria: Stable production deployment ready for users

Technical Specifications
Frontend Architecture
text
src/
├── game/
│   ├── scenes/
│   │   ├── VillageScene.ts        # Main village rendering
│   │   ├── WorldMapScene.ts       # Multi-org world map
│   │   └── LoadingScene.ts        # Asset loading
│   ├── entities/
│   │   ├── Agent.ts               # Agent sprite class
│   │   ├── House.ts               # Repository house class
│   │   ├── BugBot.ts              # Issue bug bot class
│   │   └── Village.ts             # Village container
│   ├── ui/
│   │   ├── DialogueUI.ts          # RPG dialogue panel
│   │   ├── ControlPanel.ts        # Agent control interface
│   │   └── WorldMap.ts            # Navigation UI
│   └── managers/
│       ├── AssetManager.ts        # Sprite and resource loading
│       ├── InputManager.ts        # Keyboard and mouse handling
│       └── PerformanceManager.ts  # FPS and optimization
├── services/
│   ├── MCPService.ts              # MCP client integration
│   ├── GitHubService.ts          # GitHub API client
│   ├── WebSocketService.ts       # Real-time communication
│   └── AuthService.ts            # Authentication handling
└── utils/
    ├── isometric.ts              # Coordinate conversion
    ├── pathfinding.ts            # A* pathfinding
    └── animations.ts             # Sprite animation helpers
Backend Architecture
text
server/
├── routes/
│   ├── auth.ts                   # GitHub OAuth endpoints
│   ├── villages.ts               # Village CRUD operations
│   ├── agents.ts                 # Agent management
│   └── webhooks.ts               # GitHub webhook handlers
├── services/
│   ├── MCPController.ts          # MCP server communication
│   ├── GitHubService.ts          # GitHub API integration
│   ├── ProBotService.ts          # Issue and PR handling
│   └── WebSocketServer.ts        # Real-time event broadcasting
├── models/
│   ├── User.ts                   # User data model
│   ├── Village.ts                # Village/org model
│   ├── Agent.ts                  # Agent configuration
│   └── BugBot.ts                 # Issue tracking
└── middleware/
    ├── auth.ts                   # JWT authentication
    ├── rateLimit.ts              # API rate limiting
    └── validation.ts             # Request validation
Database Schema Summary
users: GitHub authentication and preferences

villages: GitHub organizations as game villages

houses: Repositories as village buildings

agents: AI agent configurations and status

agent_sessions: Active MCP connections

work_stream_events: Real-time agent activity

bug_bots: GitHub issues as game entities

village_access: Permission and role management

API Endpoints Summary
Auth: /auth/github/* - OAuth flow and session management

Villages: /api/villages/* - Village CRUD and synchronization

Agents: /api/agents/* - Agent control and monitoring

GitHub: /api/github/* - Webhook and repository operations

WebSocket: Real-time events for village updates

Performance Requirements
Load Time: Village renders in <3 seconds

Frame Rate: Consistent 60 FPS with 100+ sprites

Latency: WebSocket updates in <200ms

Reliability: >99% uptime, <1% error rate

Scale: Support 1000+ concurrent villages

Security Considerations
GitHub OAuth with minimal required permissions

JWT token-based authentication with refresh

Rate limiting on all API endpoints

Input validation and SQL injection prevention

HTTPS/WSS encryption for all communications

Audit logging for all agent commands

This implementation plan provides a clear roadmap from concept to production-ready MVP in 6 weeks! 🚀 and import plotly.graph_objects as go
import pandas as pd

# Define the tasks data
tasks_data = [
    dict(Task="Village Render", Start_Week=1, Duration=1, Type="Frontend", Description="Phaser.js setup"),
    dict(Task="RPG Dialogue", Start_Week=2, Duration=1, Type="Frontend", Description="UI panel system"),
    dict(Task="MCP Integration", Start_Week=3, Duration=1, Type="Backend", Description="Real agents"),
    dict(Task="Bug Bot System", Start_Week=4, Duration=1, Type="Backend", Description="Probot app"),
    dict(Task="Performance", Start_Week=5, Duration=1, Type="DevOps", Description="Optimization"),
    dict(Task="Test & Launch", Start_Week=6, Duration=1, Type="Testing", Description="QA & deploy")
]

# Create DataFrame
df = pd.DataFrame(tasks_data)

# Color mapping using specified brand colors
color_map = {
    "Frontend": "#2E8B57",    # Sea green
    "Backend": "#1FB8CD",     # Strong cyan
    "DevOps": "#D2BA4C",      # Moderate yellow (orange-ish)
    "Testing": "#944454"      # Pink-red (purple-ish)
}

# Create the figure
fig = go.Figure()

# Add task bars spanning their duration
for i, row in df.iterrows():
    # Add main task bar
    fig.add_trace(go.Bar(
        x=[row['Duration']],
        y=[row['Task']],
        orientation='h',
        marker_color=color_map[row['Type']],
        name=row['Type'],
        legendgroup=row['Type'],
        showlegend=True,
        width=0.5,
        base=row['Start_Week'] - 0.5  # Position bar at correct week
    ))

# Remove duplicate legend entries by tracking what's been added
legend_added = set()
for trace in fig.data:
    if trace.name in legend_added:
        trace.showlegend = False
    else:
        legend_added.add(trace.name)

# Add milestone diamonds
milestones = [
    dict(week=2.5, task="RPG Dialogue", label="Core UI Done"),
    dict(week=4.5, task="Bug Bot System", label="Full Integr'n"),
    dict(week=6.5, task="Test & Launch", label="MVP Ready")
]

task_positions = {task: i for i, task in enumerate(df['Task'])}

for milestone in milestones:
    y_pos = task_positions[milestone['task']]
    fig.add_trace(go.Scatter(
        x=[milestone['week']],
        y=[y_pos],
        mode='markers+text',
        marker=dict(
            symbol='diamond',
            size=12,
            color='#DB4545',
            line=dict(color='black', width=1)
        ),
        text=milestone['label'],
        textposition="top center",
        textfont=dict(size=10, color='black'),
        showlegend=False,
        name='Milestone'
    ))

# Add dependency arrows between consecutive tasks
for i in range(len(df) - 1):
    current_task = df.iloc[i]
    next_task = df.iloc[i + 1]
    
    # Arrow from end of current task to start of next task
    fig.add_annotation(
        x=next_task['Start_Week'] - 0.5,
        y=i + 1,
        ax=current_task['Start_Week'] + current_task['Duration'] - 0.5,
        ay=i,
        arrowhead=2,
        arrowsize=1,
        arrowwidth=2,
        arrowcolor='gray',
        opacity=0.7
    )

# Update layout
fig.update_layout(
    title="6-Week MVP Development Plan",
    xaxis=dict(
        title="Timeline",
        tickmode='array',
        tickvals=[1, 2, 3, 4, 5, 6],
        ticktext=['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
        range=[0.5, 7]
    ),
    yaxis=dict(
        title="Dev Tracks",
        categoryorder="array",
        categoryarray=list(reversed(df['Task'].tolist()))
    ),
    barmode='overlay',
    legend=dict(
        orientation='h',
        yanchor='bottom',
        y=1.05,
        xanchor='center',
        x=0.5
    )
)

# Update traces
fig.update_traces(cliponaxis=False)

# Save the chart
fig.write_image("gantt_chart.png")
fig.write_image("gantt_chart.svg", format="svg")

fig.show(). THen build it using task-master to help
