# Implementation Plan

> Version 2.0 | December 2025
> Phased implementation plan for AI Agent Village Monitor RPG System

## Executive Summary

This document outlines a 12-week implementation plan to transform the AI Agent Village Monitor into a full RPG-like experience. The plan is divided into 4 phases, each building on the previous:

1. **Phase 1: Foundation** (Weeks 1-3) - Core infrastructure and data models
2. **Phase 2: Building Generation** (Weeks 4-6) - Repo-to-building pipeline
3. **Phase 3: Agent System** (Weeks 7-9) - Behavior and animation systems
4. **Phase 4: Multiplayer & Polish** (Weeks 10-12) - Network sync and UX refinement

---

## Phase 1: Foundation (Weeks 1-3)

### Week 1: Database & API Foundation

#### Goals
- Set up production-ready database schema
- Implement core API endpoints
- Establish testing infrastructure

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 1.1.1 | Migrate database to Prisma with new schema | High | 4h | None |
| 1.1.2 | Create Village CRUD endpoints | High | 3h | 1.1.1 |
| 1.1.3 | Create House CRUD endpoints | High | 3h | 1.1.1 |
| 1.1.4 | Create Agent CRUD endpoints | High | 3h | 1.1.1 |
| 1.1.5 | Create Room CRUD endpoints | Medium | 2h | 1.1.1 |
| 1.1.6 | Set up Jest test suite for backend | High | 2h | None |
| 1.1.7 | Write API integration tests | High | 4h | 1.1.2-1.1.5 |
| 1.1.8 | Set up Vitest for frontend | Medium | 2h | None |

#### Deliverables
- [ ] Prisma schema deployed to database
- [ ] All CRUD endpoints functional
- [ ] 80%+ test coverage on API routes
- [ ] CI pipeline running tests

#### Technical Details

```typescript
// prisma/schema.prisma - Core entities

model Village {
  id          String   @id @default(cuid())
  name        String
  description String?
  seed        String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  houses      House[]
  worldMap    WorldMap?
}

model House {
  id           String   @id @default(cuid())
  villageId    String
  village      Village  @relation(fields: [villageId], references: [id])

  githubRepo   String
  githubOwner  String
  name         String
  description  String?
  language     String?

  position     Json     // {x, y}
  footprint    Json     // {width, height}
  style        String   @default("cottage")

  rooms        Room[]
  agents       Agent[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([villageId, githubOwner, githubRepo])
}

model Room {
  id          String   @id @default(cuid())
  houseId     String
  house       House    @relation(fields: [houseId], references: [id])

  name        String
  moduleType  String   // component, service, etc.
  modulePath  String

  position    Json     // {x, y} relative to house
  size        Json     // {width, height}
  connections Json     // [{roomId, direction}]

  decorations Json     // Furniture/items

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Agent {
  id          String   @id @default(cuid())
  houseId     String
  house       House    @relation(fields: [houseId], references: [id])

  name        String
  spriteKey   String?
  personality Json     // Generated traits

  position    Json     // Current {x, y}
  state       String   @default("idle")
  energy      Int      @default(100)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

### Week 2: GitHub Integration

#### Goals
- Implement GitHub API client
- Create repository analysis pipeline
- Set up webhook handling

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 1.2.1 | Create GitHub GraphQL client wrapper | High | 3h | None |
| 1.2.2 | Implement repository tree fetcher | High | 4h | 1.2.1 |
| 1.2.3 | Implement language detection (go-enry) | High | 3h | 1.2.2 |
| 1.2.4 | Create module classifier | High | 4h | 1.2.3 |
| 1.2.5 | Build dependency graph analyzer | Medium | 6h | 1.2.4 |
| 1.2.6 | Set up webhook endpoint | Medium | 3h | 1.1.2 |
| 1.2.7 | Implement webhook event processing | Medium | 4h | 1.2.6 |
| 1.2.8 | Write GitHub integration tests | High | 3h | 1.2.1-1.2.5 |

#### Deliverables
- [ ] GitHub client fetching repo structure
- [ ] Module classification working for major languages
- [ ] Dependency graph extraction functional
- [ ] Webhook events processing to database

#### Technical Details

```typescript
// packages/backend/src/github/GitHubClient.ts

export class GitHubClient {
  private graphql: GraphQLClient;
  private rateLimiter: RateLimiter;

  async getRepositoryTree(owner: string, repo: string, ref: string = 'HEAD'): Promise<TreeEntry[]> {
    const query = `
      query GetRepoTree($owner: String!, $repo: String!, $expression: String!) {
        repository(owner: $owner, name: $repo) {
          object(expression: $expression) {
            ... on Tree {
              entries {
                name
                type
                path
                object {
                  ... on Blob {
                    byteSize
                  }
                  ... on Tree {
                    entries {
                      name
                      type
                      path
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    await this.rateLimiter.acquire();
    return this.graphql.request(query, { owner, repo, expression: `${ref}:` });
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    // Implementation
  }

  async getRecentCommits(owner: string, repo: string, limit: number = 10): Promise<Commit[]> {
    // Implementation
  }
}
```

---

### Week 3: Frontend Foundation

#### Goals
- Set up Phaser.js game scene structure
- Implement basic camera and input handling
- Create asset loading system

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 1.3.1 | Refactor scene structure (Boot, Preload, Village, House) | High | 4h | None |
| 1.3.2 | Implement camera system with zoom/pan | High | 3h | 1.3.1 |
| 1.3.3 | Create input handler (keyboard, mouse, touch) | High | 4h | 1.3.1 |
| 1.3.4 | Build asset manifest system | Medium | 3h | None |
| 1.3.5 | Create sprite loading pipeline | High | 4h | 1.3.4 |
| 1.3.6 | Implement tileset loading | High | 3h | 1.3.4 |
| 1.3.7 | Create basic UI layer (React overlay) | Medium | 4h | 1.3.1 |
| 1.3.8 | Write scene transition tests | Medium | 2h | 1.3.1 |

#### Deliverables
- [ ] Multi-scene Phaser setup working
- [ ] Smooth camera controls (zoom 0.5x-2x, pan with bounds)
- [ ] Asset loading with progress indicator
- [ ] React UI overlay functional

---

## Phase 2: Building Generation (Weeks 4-6)

### Week 4: BSP Generator

#### Goals
- Implement Binary Space Partitioning algorithm
- Create room placement system
- Build corridor generation using Kruskal's MST

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 2.1.1 | Create Prando seeded RNG wrapper | High | 2h | None |
| 2.1.2 | Implement BSP tree generator | High | 6h | 2.1.1 |
| 2.1.3 | Create room placement within BSP leaves | High | 4h | 2.1.2 |
| 2.1.4 | Implement Delaunay triangulation | Medium | 4h | 2.1.3 |
| 2.1.5 | Build Kruskal's MST for corridors | High | 4h | 2.1.4 |
| 2.1.6 | Create corridor path carving | High | 4h | 2.1.5 |
| 2.1.7 | Implement room connection doors | Medium | 3h | 2.1.6 |
| 2.1.8 | Write BSP algorithm tests | High | 3h | 2.1.2-2.1.7 |

#### Deliverables
- [ ] Deterministic BSP generation (same seed = same layout)
- [ ] Rooms sized by module complexity
- [ ] Connected corridor network
- [ ] 100% test coverage on generation algorithms

#### Technical Details

```typescript
// packages/backend/src/generation/BSPGenerator.ts

export interface BSPConfig {
  width: number;
  height: number;
  minRoomSize: number;
  maxRoomSize: number;
  minSplitRatio: number;
  maxSplitRatio: number;
  maxDepth: number;
  corridorWidth: number;
}

export class BSPGenerator {
  private rng: Prando;
  private config: BSPConfig;

  constructor(seed: string, config: Partial<BSPConfig> = {}) {
    this.rng = new Prando(seed);
    this.config = { ...DEFAULT_BSP_CONFIG, ...config };
  }

  generate(modules: ModuleDefinition[]): BuildingLayout {
    // 1. Create initial BSP tree
    const root = this.createBSPTree(
      { x: 0, y: 0, width: this.config.width, height: this.config.height },
      0
    );

    // 2. Collect leaf nodes
    const leaves = this.collectLeaves(root);

    // 3. Sort modules by complexity (largest first)
    const sortedModules = [...modules].sort((a, b) => b.complexity - a.complexity);

    // 4. Assign modules to leaves
    const rooms = this.assignModulesToLeaves(sortedModules, leaves);

    // 5. Generate corridors using Delaunay + MST
    const corridors = this.generateCorridors(rooms);

    return { rooms, corridors, bounds: root.bounds };
  }

  private createBSPTree(bounds: Rectangle, depth: number): BSPNode {
    // Implementation from REPO_TO_BUILDING_ALGORITHM.md
  }

  private generateCorridors(rooms: Room[]): Corridor[] {
    // Delaunay triangulation
    const points = rooms.map(r => [r.center.x, r.center.y]);
    const delaunay = Delaunator.from(points);

    // Extract edges
    const edges = this.extractEdges(delaunay, rooms);

    // Kruskal's MST
    const mst = this.kruskalMST(edges);

    // Add some extra edges for loops (30%)
    const extraEdges = this.addLoopEdges(edges, mst);

    // Carve corridor paths
    return this.carveCorridors([...mst, ...extraEdges]);
  }
}
```

---

### Week 5: Tilemap Generation

#### Goals
- Convert room layouts to tilemaps
- Implement auto-tiling algorithm
- Create decoration placement system

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 2.2.1 | Create tilemap data structure | High | 3h | 2.1.8 |
| 2.2.2 | Implement 4-bit auto-tiling | High | 6h | 2.2.1 |
| 2.2.3 | Create floor tile placement | High | 3h | 2.2.1 |
| 2.2.4 | Implement wall tile placement | High | 4h | 2.2.2 |
| 2.2.5 | Create door tile placement | Medium | 3h | 2.2.4 |
| 2.2.6 | Build decoration placement system | Medium | 4h | 2.2.3 |
| 2.2.7 | Implement room-type decorations | Medium | 4h | 2.2.6 |
| 2.2.8 | Write tilemap generation tests | High | 3h | 2.2.1-2.2.7 |

#### Deliverables
- [ ] Seamless auto-tiled walls
- [ ] Room-appropriate decorations
- [ ] Tilemap export to JSON format
- [ ] Visual testing tool for tilemaps

#### Technical Details

```typescript
// packages/backend/src/generation/TilemapGenerator.ts

export class TilemapGenerator {
  private tileSize: number = 16;
  private tileset: TilesetConfig;

  generateTilemap(layout: BuildingLayout): TilemapData {
    const width = Math.ceil(layout.bounds.width / this.tileSize);
    const height = Math.ceil(layout.bounds.height / this.tileSize);

    // Initialize layers
    const floorLayer = this.createEmptyLayer(width, height);
    const wallLayer = this.createEmptyLayer(width, height);
    const decorationLayer = this.createEmptyLayer(width, height);

    // Fill floor tiles
    for (const room of layout.rooms) {
      this.fillRoomFloor(floorLayer, room);
    }

    // Fill corridor floors
    for (const corridor of layout.corridors) {
      this.fillCorridorFloor(floorLayer, corridor);
    }

    // Auto-tile walls
    this.autoTileWalls(wallLayer, floorLayer);

    // Place decorations
    for (const room of layout.rooms) {
      this.placeRoomDecorations(decorationLayer, room);
    }

    return {
      width,
      height,
      tileSize: this.tileSize,
      layers: [floorLayer, wallLayer, decorationLayer],
      collision: this.generateCollisionMap(wallLayer),
    };
  }

  private autoTileWalls(wallLayer: TileLayer, floorLayer: TileLayer): void {
    for (let y = 0; y < wallLayer.height; y++) {
      for (let x = 0; x < wallLayer.width; x++) {
        if (this.isWallTile(x, y, floorLayer)) {
          const mask = this.calculateNeighborMask(x, y, floorLayer);
          wallLayer.tiles[y][x] = this.tileset.wallTiles[mask];
        }
      }
    }
  }

  private calculateNeighborMask(x: number, y: number, floorLayer: TileLayer): number {
    let mask = 0;
    if (this.hasFloor(x, y - 1, floorLayer)) mask |= 1;  // North
    if (this.hasFloor(x + 1, y, floorLayer)) mask |= 2;  // East
    if (this.hasFloor(x, y + 1, floorLayer)) mask |= 4;  // South
    if (this.hasFloor(x - 1, y, floorLayer)) mask |= 8;  // West
    return mask;
  }
}
```

---

### Week 6: Tilemap Rendering

#### Goals
- Render tilemaps in Phaser
- Implement collision system
- Create room labels and minimap

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 2.3.1 | Create Phaser tilemap renderer | High | 4h | 2.2.8 |
| 2.3.2 | Implement multi-layer rendering | High | 3h | 2.3.1 |
| 2.3.3 | Set up collision layer | High | 3h | 2.3.2 |
| 2.3.4 | Create room label system | Medium | 3h | 2.3.1 |
| 2.3.5 | Implement minimap | Medium | 4h | 2.3.1 |
| 2.3.6 | Build door/portal system | High | 4h | 2.3.3 |
| 2.3.7 | Create scene transitions | High | 3h | 2.3.6 |
| 2.3.8 | Optimize rendering performance | Medium | 4h | 2.3.1-2.3.7 |

#### Deliverables
- [ ] Smooth tilemap rendering at 60fps
- [ ] Working collision detection
- [ ] Interactive minimap
- [ ] Room transitions with fade effects

---

## Phase 3: Agent System (Weeks 7-9)

### Week 7: State Machine Implementation

#### Goals
- Implement XState v5 agent machine
- Create work event processing
- Build state-to-behavior mapping

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 3.1.1 | Set up XState v5 with TypeScript | High | 2h | None |
| 3.1.2 | Implement core agent state machine | High | 6h | 3.1.1 |
| 3.1.3 | Create all state guards | High | 3h | 3.1.2 |
| 3.1.4 | Implement all state actions | High | 4h | 3.1.2 |
| 3.1.5 | Build work stream adapter | High | 4h | 3.1.2 |
| 3.1.6 | Create event-to-state converters | High | 3h | 3.1.5 |
| 3.1.7 | Implement context updaters | Medium | 3h | 3.1.4 |
| 3.1.8 | Write state machine tests | High | 4h | 3.1.2-3.1.7 |

#### Deliverables
- [ ] Complete XState machine with all states
- [ ] Work events triggering state transitions
- [ ] Context accurately tracking agent metrics
- [ ] 100% test coverage on state machine

#### Technical Details

```typescript
// packages/frontend/src/agents/stateMachine/index.ts

export const agentMachine = setup({
  types: {
    context: {} as AgentContext,
    events: {} as AgentEvent,
  },
  guards: { /* from AGENT_BEHAVIOR_SYSTEM.md */ },
  actions: { /* from AGENT_BEHAVIOR_SYSTEM.md */ },
}).createMachine({
  id: 'agent',
  initial: 'idle',
  states: {
    idle: { /* ... */ },
    working: { /* ... */ },
    thinking: { /* ... */ },
    frustrated: { /* ... */ },
    celebrating: { /* ... */ },
    resting: { /* ... */ },
    socializing: { /* ... */ },
    traveling: { /* ... */ },
    observing: { /* ... */ },
  },
});
```

---

### Week 8: Steering & Animation

#### Goals
- Integrate Yuka.js for movement
- Implement animation controller
- Create emote system

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 3.2.1 | Set up Yuka.js entity manager | High | 3h | None |
| 3.2.2 | Create AgentVehicle class | High | 4h | 3.2.1 |
| 3.2.3 | Implement steering controller | High | 6h | 3.2.2 |
| 3.2.4 | Create animation controller | High | 4h | None |
| 3.2.5 | Build sprite animation system | High | 4h | 3.2.4 |
| 3.2.6 | Implement emote manager | Medium | 4h | 3.2.5 |
| 3.2.7 | Create emote trigger rules | Medium | 3h | 3.2.6 |
| 3.2.8 | Write animation/steering tests | High | 3h | 3.2.3-3.2.7 |

#### Deliverables
- [ ] Smooth agent movement with Yuka.js
- [ ] State-appropriate animations
- [ ] Emote bubbles for cognitive states
- [ ] Seamless animation transitions

---

### Week 9: Agent Integration

#### Goals
- Connect state machine to rendering
- Implement agent-room interactions
- Create agent inspector UI

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 3.3.1 | Create AgentEntity (Phaser game object) | High | 4h | 3.2.8 |
| 3.3.2 | Wire state machine to animation | High | 3h | 3.3.1, 3.1.8 |
| 3.3.3 | Wire state machine to steering | High | 3h | 3.3.1, 3.1.8 |
| 3.3.4 | Implement agent-room awareness | Medium | 4h | 3.3.1 |
| 3.3.5 | Create pathfinding integration | Medium | 4h | 3.3.3 |
| 3.3.6 | Build agent inspector panel | Medium | 4h | 3.3.1 |
| 3.3.7 | Implement agent selection/following | Medium | 3h | 3.3.6 |
| 3.3.8 | Performance optimization | Medium | 4h | 3.3.1-3.3.7 |

#### Deliverables
- [ ] Agents moving and animating in rooms
- [ ] Click-to-select agent functionality
- [ ] Agent status panel showing state/metrics
- [ ] Smooth performance with 50+ agents

---

## Phase 4: Multiplayer & Polish (Weeks 10-12)

### Week 10: Network Foundation

#### Goals
- Set up Socket.io server
- Implement Yjs document sync
- Create room-based networking

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 4.1.1 | Set up Socket.io server | High | 3h | None |
| 4.1.2 | Create room management system | High | 4h | 4.1.1 |
| 4.1.3 | Implement Yjs document structure | High | 4h | 4.1.1 |
| 4.1.4 | Create network sync adapter | High | 4h | 4.1.3 |
| 4.1.5 | Implement position interpolation | High | 4h | 4.1.4 |
| 4.1.6 | Build rate limiting system | Medium | 3h | 4.1.4 |
| 4.1.7 | Create reconnection handling | Medium | 3h | 4.1.1 |
| 4.1.8 | Write network integration tests | High | 4h | 4.1.1-4.1.7 |

#### Deliverables
- [ ] Socket.io server handling 100+ connections
- [ ] Yjs CRDT sync working
- [ ] Smooth position interpolation
- [ ] Robust reconnection handling

#### Technical Details

```typescript
// packages/backend/src/multiplayer/MultiplayerServer.ts

export class MultiplayerServer {
  private io: SocketIO.Server;
  private rooms: Map<string, RoomState> = new Map();
  private docs: Map<string, Y.Doc> = new Map();

  async handleJoinHouse(socket: Socket, houseId: string): Promise<void> {
    // Leave current room
    const currentRoom = this.getSocketRoom(socket);
    if (currentRoom) {
      await this.leaveRoom(socket, currentRoom);
    }

    // Join new room
    await socket.join(`house:${houseId}`);

    // Get or create Yjs doc
    let doc = this.docs.get(houseId);
    if (!doc) {
      doc = new Y.Doc();
      this.docs.set(houseId, doc);
    }

    // Send current state
    const state = Y.encodeStateAsUpdate(doc);
    socket.emit('sync:state', state);

    // Broadcast player joined
    socket.to(`house:${houseId}`).emit('player:joined', {
      playerId: socket.data.playerId,
      position: socket.data.position,
    });
  }

  private setupSyncHandlers(socket: Socket): void {
    socket.on('sync:update', (update: Uint8Array) => {
      const houseId = this.getSocketHouse(socket);
      if (!houseId) return;

      const doc = this.docs.get(houseId);
      if (doc) {
        Y.applyUpdate(doc, update);
        socket.to(`house:${houseId}`).emit('sync:update', update);
      }
    });
  }
}
```

---

### Week 11: Sprite Generation

#### Goals
- Integrate PixelLab.ai API
- Create sprite caching system
- Implement fallback generation

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 4.2.1 | Create PixelLab.ai client | High | 4h | None |
| 4.2.2 | Implement sprite cache (Redis) | High | 4h | 4.2.1 |
| 4.2.3 | Create sprite generation queue | High | 4h | 4.2.1 |
| 4.2.4 | Build prompt engineering system | High | 4h | 4.2.1 |
| 4.2.5 | Implement Replicate fallback | Medium | 3h | 4.2.1 |
| 4.2.6 | Create sprite sheet assembler | Medium | 4h | 4.2.1 |
| 4.2.7 | Build sprite preview UI | Medium | 3h | 4.2.6 |
| 4.2.8 | Write sprite generation tests | Medium | 3h | 4.2.1-4.2.7 |

#### Deliverables
- [ ] Working PixelLab.ai integration
- [ ] Sprite caching reducing API calls by 90%
- [ ] Consistent character generation
- [ ] Sprite preview and regeneration UI

#### Technical Details

```typescript
// packages/backend/src/sprites/SpriteGenerator.ts

export class SpriteGenerator {
  private pixellab: PixelLabClient;
  private cache: SpriteCache;
  private queue: Queue<SpriteRequest>;

  async generateAgentSprite(config: AgentSpriteConfig): Promise<SpriteSheet> {
    // Check cache first
    const cacheKey = this.generateCacheKey(config);
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Generate prompt
    const prompt = this.buildPrompt(config);

    // Generate base character
    const baseSprite = await this.pixellab.generate({
      prompt,
      style: 'pixel_art_16bit',
      size: { width: 32, height: 32 },
      options: {
        colorPalette: config.palette ?? 'auto',
        outline: true,
        animated: false,
      },
    });

    // Generate animation frames
    const frames = await this.generateAnimationFrames(baseSprite, config);

    // Assemble sprite sheet
    const spriteSheet = this.assembleSpriteSheet(frames);

    // Cache result
    await this.cache.set(cacheKey, spriteSheet);

    return spriteSheet;
  }

  private buildPrompt(config: AgentSpriteConfig): string {
    const personality = config.personality ?? {};
    const traits = [
      personality.primaryColor ?? 'blue',
      personality.style ?? 'casual',
      personality.accessory ?? 'none',
    ];

    return `Pixel art character, ${traits.join(', ')}, RPG style, 16-bit, front view`;
  }
}
```

---

### Week 12: Polish & Launch

#### Goals
- Performance optimization
- Bug fixes and polish
- Documentation and deployment

#### Tasks

| ID | Task | Priority | Estimate | Dependencies |
|----|------|----------|----------|--------------|
| 4.3.1 | Performance profiling and optimization | High | 6h | All |
| 4.3.2 | Memory leak detection and fixes | High | 4h | 4.3.1 |
| 4.3.3 | Mobile/touch optimization | Medium | 4h | 4.3.1 |
| 4.3.4 | Accessibility improvements | Medium | 3h | None |
| 4.3.5 | Error handling and logging | High | 4h | None |
| 4.3.6 | User documentation | Medium | 4h | None |
| 4.3.7 | API documentation | Medium | 3h | None |
| 4.3.8 | Production deployment setup | High | 4h | All |

#### Deliverables
- [ ] 60fps on mid-range hardware
- [ ] No memory leaks over 1-hour session
- [ ] Touch controls working
- [ ] Full documentation
- [ ] Production deployment ready

---

## Task Master Integration

### Project Structure

```
.taskmaster/
├── tasks/
│   └── tasks.json           # All tasks from this plan
├── docs/
│   └── prd.txt              # Product requirements
└── reports/
    └── task-complexity-report.json
```

### Initializing Task Master

```bash
# Initialize project
npx task-master init --project-root /path/to/ai-agent-village-monitor

# Parse PRD to generate tasks
npx task-master parse-prd --input docs/PRD-FULL.md

# View tasks
npx task-master list

# Start working on next task
npx task-master next
```

### Task Dependencies

```json
{
  "tasks": [
    {
      "id": 1,
      "title": "Set up Prisma schema",
      "status": "pending",
      "dependencies": [],
      "phase": 1,
      "week": 1
    },
    {
      "id": 2,
      "title": "Create Village CRUD endpoints",
      "status": "pending",
      "dependencies": [1],
      "phase": 1,
      "week": 1
    },
    {
      "id": 3,
      "title": "Create GitHub GraphQL client",
      "status": "pending",
      "dependencies": [],
      "phase": 1,
      "week": 2
    }
  ]
}
```

---

## Testing Strategy

### Unit Tests
- **Coverage Target**: 80%+ on all modules
- **Framework**: Jest (backend), Vitest (frontend)
- **Focus Areas**: State machine guards, BSP algorithm, auto-tiling

### Integration Tests
- **Coverage Target**: Core user flows
- **Framework**: Supertest (API), Playwright (E2E)
- **Focus Areas**: GitHub integration, multiplayer sync

### Visual Tests
- **Framework**: Storybook + Chromatic
- **Focus Areas**: Tilemap rendering, agent animations

### Performance Tests
- **Framework**: Artillery (load), Lighthouse (frontend)
- **Targets**:
  - API: < 100ms p95 latency
  - Frontend: 60fps with 100 agents
  - WebSocket: 1000 concurrent connections

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| PixelLab.ai rate limits | High | Medium | Implement aggressive caching, Replicate fallback |
| GitHub API quota exhaustion | High | Low | Implement request batching, webhook-first approach |
| Performance with many agents | Medium | Medium | LOD system, spatial partitioning |
| Multiplayer sync conflicts | Medium | Medium | CRDT (Yjs), server authority |

### Schedule Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| BSP algorithm complexity | +1 week | Use rot.js as reference implementation |
| Sprite generation quality | +1 week | Pre-generate common sprites, allow user regeneration |
| Network edge cases | +1 week | Focus on core functionality first |

---

## Success Criteria

### MVP (Week 6)
- [ ] User can add a GitHub repo and see generated building
- [ ] Building layout is deterministic (same repo = same building)
- [ ] Rooms are labeled with module names
- [ ] Basic navigation works

### Beta (Week 9)
- [ ] Agents move with appropriate behaviors
- [ ] Agent states reflect actual work activity
- [ ] Emotes show cognitive states
- [ ] Single-player fully functional

### Launch (Week 12)
- [ ] Multiplayer functional for 2+ players
- [ ] Generated sprites for agents
- [ ] Stable 60fps performance
- [ ] Production deployment live

---

## Resource Requirements

### Infrastructure
- **Database**: PostgreSQL (existing)
- **Cache**: Redis (new, for sprite caching)
- **File Storage**: S3/R2 (for generated sprites)
- **Compute**: Node.js server (existing), consider scaling

### External APIs
- **PixelLab.ai**: ~$50-100/month estimated
- **GitHub API**: Free tier sufficient
- **Replicate** (fallback): ~$20/month estimated

### Team
- Estimated for 1 full-time developer
- Can parallelize with additional developers on:
  - Week 4-6: Frontend + Backend split
  - Week 10-11: Network + Sprites split

---

*Document Version: 2.0*
*Last Updated: December 2025*
*Author: AI Agent Village Monitor Development Team*
