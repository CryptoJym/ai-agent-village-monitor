# AI Agent Village Monitor - System Architecture v2.0

> **Vision**: Transform any GitHub repository into an explorable RPG world where code structure becomes architecture, agents are living entities, and development becomes a multiplayer experience.

---

## Table of Contents
1. [High-Level Architecture](#1-high-level-architecture)
2. [Repository-to-Building Pipeline](#2-repository-to-building-pipeline)
3. [Procedural World Generation](#3-procedural-world-generation)
4. [Agent Behavior System](#4-agent-behavior-system)
5. [Sprite Generation System](#5-sprite-generation-system)
6. [Multiplayer Architecture](#6-multiplayer-architecture)
7. [Data Models](#7-data-models)
8. [API Design](#8-api-design)
9. [Implementation Phases](#9-implementation-phases)
10. [Testing Strategy](#10-testing-strategy)
11. [Performance Targets](#11-performance-targets)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │   Phaser.js     │  │   React 18      │  │   Yjs CRDT      │                 │
│  │   Game Engine   │  │   UI Layer      │  │   State Sync    │                 │
│  │                 │  │                 │  │                 │                 │
│  │  • WorldScene   │  │  • DialogueUI   │  │  • Y.Doc        │                 │
│  │  • BuildingInt  │  │  • ControlPanel │  │  • Y.Map        │                 │
│  │  • AgentSprites │  │  • WorldMap     │  │  • Awareness    │                 │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                 │
│           │                    │                    │                          │
│           └──────────────┬─────┴────────────────────┘                          │
│                          ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                     WebSocket + Socket.io                                │   │
│  │              (Real-time Events + CRDT Sync Provider)                    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SERVER LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │   Express.js    │  │  Socket.io      │  │   Bull MQ       │                 │
│  │   REST API      │  │  WS Server      │  │   Job Queue     │                 │
│  │                 │  │                 │  │                 │                 │
│  │  • Auth Routes  │  │  • Rooms        │  │  • RepoAnalysis │                 │
│  │  • Repo Routes  │  │  • Presence     │  │  • SpriteGen    │                 │
│  │  • Agent Routes │  │  • Broadcasting │  │  • WorldGen     │                 │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                 │
│           │                    │                    │                          │
│           └──────────────┬─────┴────────────────────┘                          │
│                          ▼                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                        Core Services                                       │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │ │
│  │  │ RepoAnalyzer │ │ WorldGenSvc  │ │ AgentBehavior│ │ SpriteGenSvc │     │ │
│  │  │              │ │              │ │              │ │              │     │ │
│  │  │ • GitHub API │ │ • BSP Trees  │ │ • XState v5  │ │ • PixelLab   │     │ │
│  │  │ • Tree-sitter│ │ • Graph/MST  │ │ • Yuka.js    │ │ • Replicate  │     │ │
│  │  │ • go-enry    │ │ • Seeded RNG │ │ • Steering   │ │ • Cache      │     │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘     │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │   PostgreSQL    │  │     Redis       │  │   S3/R2         │                 │
│  │   Primary DB    │  │   Cache/Queue   │  │   Asset Store   │                 │
│  │                 │  │                 │  │                 │                 │
│  │  • Repos        │  │  • Sessions     │  │  • Sprites      │                 │
│  │  • Buildings    │  │  • Presence     │  │  • Tilemaps     │                 │
│  │  • Agents       │  │  • Rate Limits  │  │  • Thumbnails   │                 │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │   GitHub API    │  │   PixelLab.ai   │  │   Replicate     │                 │
│  │   GraphQL v4    │  │   Sprite Gen    │  │   Fallback Gen  │                 │
│  │                 │  │                 │  │                 │                 │
│  │  • Repo Trees   │  │  • Characters   │  │  • Retro Diff   │                 │
│  │  • File Content │  │  • Buildings    │  │  • Nano Banana  │                 │
│  │  • Webhooks     │  │  • Tiles        │  │                 │                 │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Repository-to-Building Pipeline

### 2.1 Overview

The core innovation: **deterministic transformation** of any GitHub repository into navigable architecture.

```
GitHub Repo → Analyze → Generate Layout → Create Assets → Render World
     │            │           │               │              │
     ▼            ▼           ▼               ▼              ▼
  GraphQL    Tree-sitter   BSP+Graph      PixelLab      Phaser.js
  API v4     Parsing       Algorithm      Sprites       Tilemaps
```

### 2.2 GitHub Analysis Pipeline

```typescript
// packages/server/src/services/RepoAnalyzer.ts

interface RepoAnalysisResult {
  // Metadata
  id: string;
  fullName: string;
  defaultBranch: string;

  // Structure (from GraphQL)
  tree: FileTreeNode[];
  totalFiles: number;
  totalDirectories: number;

  // Language Analysis (go-enry)
  languages: LanguageBreakdown[];
  primaryLanguage: string;

  // Semantic Structure (Tree-sitter)
  modules: ModuleDefinition[];
  exports: ExportDefinition[];
  dependencies: DependencyGraph;

  // Computed Metrics
  complexity: number;  // 1-10 scale
  activityScore: number;
  healthScore: number;
}

interface FileTreeNode {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  language?: string;
  children?: FileTreeNode[];

  // Semantic enrichment
  moduleType?: 'component' | 'service' | 'util' | 'config' | 'test';
  importance: number;  // 0-1 based on imports/exports
}
```

### 2.3 GitHub GraphQL Query Strategy

```graphql
# Efficient tree fetching (single query, ~2 points)
query RepositoryTree($owner: String!, $name: String!, $expression: String!) {
  repository(owner: $owner, name: $name) {
    id
    name
    description
    defaultBranchRef {
      name
      target {
        ... on Commit {
          oid
          tree {
            entries {
              name
              type
              mode
              object {
                ... on Blob {
                  byteSize
                  isBinary
                }
                ... on Tree {
                  entries {
                    name
                    type
                    # Recursive expansion up to 3 levels
                  }
                }
              }
            }
          }
        }
      }
    }
    languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
      edges {
        size
        node { name color }
      }
    }
  }
}
```

### 2.4 Tree-sitter Integration

```typescript
// packages/server/src/services/SemanticAnalyzer.ts

import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
// ... 160+ language grammars available

interface SemanticAnalyzer {
  // Parse file and extract structure
  analyzeFile(content: string, language: string): FileSemantics;

  // Extract module boundaries
  findModules(tree: FileTreeNode[]): ModuleDefinition[];

  // Build dependency graph
  buildDependencyGraph(modules: ModuleDefinition[]): DependencyGraph;

  // Identify architectural layers
  classifyLayers(graph: DependencyGraph): ArchitecturalLayer[];
}

interface FileSemantics {
  imports: ImportStatement[];
  exports: ExportStatement[];
  classes: ClassDefinition[];
  functions: FunctionDefinition[];
  complexity: number;
}

interface ModuleDefinition {
  id: string;
  path: string;
  name: string;
  type: ModuleType;
  exports: string[];
  imports: string[];
  loc: number;
  complexity: number;
}

type ModuleType =
  | 'component'    // UI components
  | 'service'      // Business logic
  | 'repository'   // Data access
  | 'controller'   // API handlers
  | 'utility'      // Helper functions
  | 'config'       // Configuration
  | 'type'         // Type definitions
  | 'test';        // Test files
```

---

## 3. Procedural World Generation

### 3.1 Algorithm Overview

**Hybrid approach**: BSP for room placement + Delaunay/MST for corridors + seeded RNG for determinism.

```
Repository Structure → Room Graph → BSP Partitioning → Corridor Generation → Tilemap
        │                  │              │                   │               │
        ▼                  ▼              ▼                   ▼               ▼
   Modules          Node/Edges     Binary Split        Delaunay/MST      Phaser Map
   → Rooms          → Weights       → Regions          → Paths           → Collision
```

### 3.2 Seeded Random Number Generator

```typescript
// packages/shared/src/rng.ts

// Mulberry32 - fast, deterministic, excellent distribution
export function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Seed generation from repository
export function repoSeed(repoFullName: string, commitSha: string): number {
  // Deterministic: same repo + commit = same world
  const str = `${repoFullName}:${commitSha}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Prando wrapper for complex sequences
import Prando from 'prando';

export class DeterministicRNG {
  private rng: Prando;

  constructor(seed: string) {
    this.rng = new Prando(seed);
  }

  next(): number { return this.rng.next(); }
  nextInt(min: number, max: number): number { return this.rng.nextInt(min, max); }
  nextArrayItem<T>(array: T[]): T { return this.rng.nextArrayItem(array); }
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
```

### 3.3 BSP Room Generation

```typescript
// packages/server/src/services/WorldGenerator/BSPGenerator.ts

interface BSPNode {
  x: number;
  y: number;
  width: number;
  height: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
  module?: ModuleDefinition;  // Linked semantic data
}

interface Room {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: RoomType;
  moduleId?: string;
  doors: Door[];
}

type RoomType =
  | 'entrance'      // Main entry
  | 'hallway'       // Corridor/connection
  | 'workspace'     // Component room
  | 'library'       // Utils/dependencies
  | 'vault'         // Config/secrets
  | 'laboratory'    // Test suite
  | 'archive';      // Legacy code

class BSPGenerator {
  private rng: DeterministicRNG;
  private minRoomSize = 6;
  private maxRoomSize = 20;
  private splitRatio = { min: 0.35, max: 0.65 };

  constructor(seed: string) {
    this.rng = new DeterministicRNG(seed);
  }

  generate(
    width: number,
    height: number,
    modules: ModuleDefinition[]
  ): { rooms: Room[]; corridors: Corridor[] } {
    // 1. Create BSP tree
    const root = this.createBSP({ x: 0, y: 0, width, height }, modules.length);

    // 2. Assign modules to leaf nodes (by importance)
    const sortedModules = [...modules].sort((a, b) => b.complexity - a.complexity);
    this.assignModules(root, sortedModules);

    // 3. Generate rooms within partitions
    this.generateRooms(root);

    // 4. Collect all rooms
    const rooms = this.collectRooms(root);

    // 5. Generate corridors using Delaunay + MST
    const corridors = this.generateCorridors(rooms);

    return { rooms, corridors };
  }

  private createBSP(bounds: Bounds, targetRooms: number, depth = 0): BSPNode {
    const node: BSPNode = { ...bounds };

    // Stop splitting if small enough or deep enough
    if (depth >= Math.ceil(Math.log2(targetRooms)) + 1) {
      return node;
    }

    // Determine split direction (alternate, with randomness)
    const horizontal = bounds.width < bounds.height
      ? true
      : bounds.width > bounds.height
        ? false
        : this.rng.next() > 0.5;

    // Calculate split position
    const ratio = this.rng.next() * (this.splitRatio.max - this.splitRatio.min) + this.splitRatio.min;

    if (horizontal) {
      const splitY = Math.floor(bounds.y + bounds.height * ratio);
      if (splitY - bounds.y < this.minRoomSize || bounds.y + bounds.height - splitY < this.minRoomSize) {
        return node;
      }
      node.left = this.createBSP(
        { x: bounds.x, y: bounds.y, width: bounds.width, height: splitY - bounds.y },
        targetRooms, depth + 1
      );
      node.right = this.createBSP(
        { x: bounds.x, y: splitY, width: bounds.width, height: bounds.y + bounds.height - splitY },
        targetRooms, depth + 1
      );
    } else {
      const splitX = Math.floor(bounds.x + bounds.width * ratio);
      if (splitX - bounds.x < this.minRoomSize || bounds.x + bounds.width - splitX < this.minRoomSize) {
        return node;
      }
      node.left = this.createBSP(
        { x: bounds.x, y: bounds.y, width: splitX - bounds.x, height: bounds.height },
        targetRooms, depth + 1
      );
      node.right = this.createBSP(
        { x: splitX, y: bounds.y, width: bounds.x + bounds.width - splitX, height: bounds.height },
        targetRooms, depth + 1
      );
    }

    return node;
  }

  private generateCorridors(rooms: Room[]): Corridor[] {
    // 1. Create Delaunay triangulation of room centers
    const points = rooms.map(r => [r.x + r.width/2, r.y + r.height/2]);
    const delaunay = Delaunay.from(points);

    // 2. Extract edges with weights (distance)
    const edges: WeightedEdge[] = [];
    for (let i = 0; i < rooms.length; i++) {
      for (const j of delaunay.neighbors(i)) {
        if (j > i) {
          const dist = Math.hypot(
            points[i][0] - points[j][0],
            points[i][1] - points[j][1]
          );
          edges.push({ from: i, to: j, weight: dist });
        }
      }
    }

    // 3. Compute MST for guaranteed connectivity
    const mst = this.kruskalMST(edges, rooms.length);

    // 4. Add some extra edges for loops (architectural interest)
    const extraEdges = edges
      .filter(e => !mst.includes(e))
      .slice(0, Math.floor(rooms.length * 0.15));  // ~15% extra connections

    // 5. Generate corridor geometry
    return [...mst, ...extraEdges].map(edge =>
      this.createCorridor(rooms[edge.from], rooms[edge.to])
    );
  }

  private kruskalMST(edges: WeightedEdge[], nodeCount: number): WeightedEdge[] {
    // Union-Find for Kruskal's algorithm
    const parent = Array.from({ length: nodeCount }, (_, i) => i);
    const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]));
    const union = (x: number, y: number) => { parent[find(x)] = find(y); };

    const sorted = [...edges].sort((a, b) => a.weight - b.weight);
    const mst: WeightedEdge[] = [];

    for (const edge of sorted) {
      if (find(edge.from) !== find(edge.to)) {
        mst.push(edge);
        union(edge.from, edge.to);
        if (mst.length === nodeCount - 1) break;
      }
    }

    return mst;
  }
}
```

### 3.4 Tilemap Generation

```typescript
// packages/server/src/services/WorldGenerator/TilemapGenerator.ts

interface TilemapConfig {
  tileSize: number;        // 16 or 32 pixels
  width: number;           // tiles
  height: number;          // tiles
  biome: BiomeType;        // visual theme
}

type BiomeType =
  | 'castle'       // C++, Rust (stone, formal)
  | 'cottage'      // JavaScript, Python (wood, cozy)
  | 'laboratory'   // TypeScript, Go (metal, modern)
  | 'garden'       // Ruby, Elixir (nature, organic)
  | 'library'      // Java, Kotlin (books, scholarly)
  | 'workshop';    // PHP, Perl (industrial, practical)

class TilemapGenerator {
  private tilesets: Map<BiomeType, TilesetDefinition>;

  generate(
    config: TilemapConfig,
    rooms: Room[],
    corridors: Corridor[]
  ): TilemapData {
    const { width, height, tileSize, biome } = config;
    const tileset = this.tilesets.get(biome)!;

    // Initialize with void tiles
    const layers = {
      ground: new Uint16Array(width * height),
      walls: new Uint16Array(width * height),
      objects: new Uint16Array(width * height),
      collision: new Uint8Array(width * height),
    };

    // Fill rooms
    for (const room of rooms) {
      this.fillRoom(layers, room, tileset);
    }

    // Fill corridors
    for (const corridor of corridors) {
      this.fillCorridor(layers, corridor, tileset);
    }

    // Auto-tile walls
    this.autoTileWalls(layers, tileset);

    // Place decorations based on room type
    this.placeDecorations(layers, rooms, tileset);

    return {
      width,
      height,
      tileSize,
      layers,
      tileset: tileset.name,
    };
  }

  private autoTileWalls(layers: TilemapLayers, tileset: TilesetDefinition) {
    // 4-bit or 8-bit auto-tiling based on neighbors
    // Creates proper corners, edges, and inner walls
    for (let y = 0; y < layers.height; y++) {
      for (let x = 0; x < layers.width; x++) {
        const idx = y * layers.width + x;
        if (layers.collision[idx] === 1) {
          const neighbors = this.getNeighborMask(layers.collision, x, y);
          layers.walls[idx] = tileset.wallTiles[neighbors];
        }
      }
    }
  }
}
```

---

## 4. Agent Behavior System

### 4.1 State Machine Design (XState v5)

```typescript
// packages/frontend/src/agents/AgentMachine.ts

import { createMachine, assign, fromPromise } from 'xstate';
import type { AgentContext, AgentEvent } from './types';

export const agentMachine = createMachine({
  id: 'agent',
  initial: 'idle',
  context: {
    agentId: '',
    position: { x: 0, y: 0 },
    targetPosition: null,
    currentTask: null,
    mood: 'neutral',
    energy: 100,
    workHistory: [],
  } as AgentContext,

  states: {
    idle: {
      entry: ['playIdleAnimation', 'startWandering'],
      on: {
        TASK_ASSIGNED: { target: 'thinking', actions: 'assignTask' },
        MOVE_TO: { target: 'moving', actions: 'setTarget' },
        INTERACT: { target: 'interacting' },
      },
      after: {
        // Random wandering while idle
        WANDER_DELAY: { target: 'wandering' },
      },
    },

    wandering: {
      entry: 'pickWanderTarget',
      invoke: {
        src: 'moveToTarget',
        onDone: { target: 'idle' },
        onError: { target: 'idle' },
      },
    },

    thinking: {
      entry: ['playThinkingAnimation', 'showThinkingEmote'],
      after: {
        // Simulate thinking time
        THINKING_DELAY: [
          { target: 'executing', guard: 'hasValidPlan' },
          { target: 'stuck', guard: 'noPlanFound' },
        ],
      },
      on: {
        CANCEL_TASK: { target: 'idle', actions: 'clearTask' },
      },
    },

    executing: {
      entry: ['playWorkingAnimation', 'showWorkingEmote'],
      invoke: {
        src: 'executeTask',
        onDone: [
          { target: 'success', guard: 'taskSucceeded' },
          { target: 'error', guard: 'taskFailed' },
        ],
        onError: { target: 'error' },
      },
      on: {
        PROGRESS_UPDATE: { actions: 'updateProgress' },
        CANCEL_TASK: { target: 'idle', actions: 'clearTask' },
      },
    },

    success: {
      entry: ['playSuccessAnimation', 'showSuccessEmote', 'logSuccess'],
      after: {
        CELEBRATION_DELAY: { target: 'idle', actions: 'clearTask' },
      },
    },

    error: {
      entry: ['playErrorAnimation', 'showErrorEmote', 'logError'],
      on: {
        RETRY: { target: 'thinking' },
        DISMISS: { target: 'idle', actions: 'clearTask' },
      },
    },

    stuck: {
      entry: ['playConfusedAnimation', 'showStuckEmote', 'requestHelp'],
      on: {
        GUIDANCE_RECEIVED: { target: 'thinking' },
        CANCEL_TASK: { target: 'idle', actions: 'clearTask' },
      },
    },

    moving: {
      invoke: {
        src: 'moveToTarget',
        onDone: { target: 'idle' },
        onError: { target: 'idle' },
      },
      on: {
        INTERRUPT: { target: 'idle' },
      },
    },

    interacting: {
      entry: 'openDialogue',
      on: {
        DIALOGUE_CLOSED: { target: 'idle' },
        COMMAND_RECEIVED: { target: 'thinking', actions: 'assignTask' },
      },
    },
  },
}, {
  actions: {
    playIdleAnimation: ({ context }) => {
      // Trigger Phaser sprite animation
      eventBus.emit('agent:animation', {
        agentId: context.agentId,
        animation: 'idle'
      });
    },
    showThinkingEmote: ({ context }) => {
      eventBus.emit('agent:emote', {
        agentId: context.agentId,
        emote: 'thinking',
        duration: 2000,
      });
    },
    // ... more actions
  },
  guards: {
    hasValidPlan: ({ context }) => context.currentTask?.plan != null,
    taskSucceeded: (_, event) => event.data?.success === true,
  },
  delays: {
    WANDER_DELAY: ({ context }) => 3000 + Math.random() * 5000,
    THINKING_DELAY: ({ context }) => 1000 + context.currentTask?.complexity * 500,
    CELEBRATION_DELAY: 2000,
  },
});
```

### 4.2 Steering Behaviors (Yuka.js)

```typescript
// packages/frontend/src/agents/SteeringController.ts

import {
  Vehicle,
  EntityManager,
  WanderBehavior,
  SeekBehavior,
  ArriveBehavior,
  ObstacleAvoidanceBehavior,
  Path,
  FollowPathBehavior,
} from 'yuka';

class AgentSteeringController {
  private entityManager: EntityManager;
  private vehicles: Map<string, Vehicle>;

  constructor() {
    this.entityManager = new EntityManager();
    this.vehicles = new Map();
  }

  createAgent(id: string, position: { x: number; y: number }): Vehicle {
    const vehicle = new Vehicle();
    vehicle.position.set(position.x, position.y, 0);
    vehicle.maxSpeed = 3;
    vehicle.maxForce = 5;

    // Add obstacle avoidance
    const avoidance = new ObstacleAvoidanceBehavior();
    avoidance.weight = 2;
    vehicle.steering.add(avoidance);

    this.vehicles.set(id, vehicle);
    this.entityManager.add(vehicle);

    return vehicle;
  }

  setWandering(id: string, area: { x: number; y: number; radius: number }) {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return;

    // Clear existing behaviors
    vehicle.steering.clear();

    // Add wander behavior
    const wander = new WanderBehavior();
    wander.radius = 2;
    wander.distance = 5;
    wander.jitter = 5;
    vehicle.steering.add(wander);

    // Constrain to area
    // Custom behavior to stay within bounds
  }

  moveTo(id: string, target: { x: number; y: number }, onArrive?: () => void) {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return;

    vehicle.steering.clear();

    const arrive = new ArriveBehavior(new Vector3(target.x, target.y, 0));
    arrive.deceleration = 1.5;
    vehicle.steering.add(arrive);

    // Check for arrival
    const checkInterval = setInterval(() => {
      const dist = vehicle.position.distanceTo(new Vector3(target.x, target.y, 0));
      if (dist < 1) {
        clearInterval(checkInterval);
        onArrive?.();
      }
    }, 100);
  }

  followPath(id: string, waypoints: { x: number; y: number }[]) {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return;

    vehicle.steering.clear();

    const path = new Path();
    for (const wp of waypoints) {
      path.add(new Vector3(wp.x, wp.y, 0));
    }

    const follow = new FollowPathBehavior(path);
    follow.nextWaypointDistance = 0.5;
    vehicle.steering.add(follow);
  }

  update(deltaTime: number) {
    this.entityManager.update(deltaTime);
  }
}
```

### 4.3 Emote System

```typescript
// packages/frontend/src/agents/EmoteSystem.ts

interface EmoteConfig {
  sprite: string;
  duration: number;
  animation?: string;
  sound?: string;
  particle?: string;
}

const EMOTES: Record<string, EmoteConfig> = {
  thinking: {
    sprite: 'emote_thinking',
    duration: 2000,
    animation: 'pulse',
  },
  success: {
    sprite: 'emote_success',
    duration: 1500,
    animation: 'bounce',
    particle: 'confetti',
  },
  error: {
    sprite: 'emote_error',
    duration: 2000,
    animation: 'shake',
  },
  stuck: {
    sprite: 'emote_confused',
    duration: 3000,
    animation: 'spin',
  },
  working: {
    sprite: 'emote_gear',
    duration: 0,  // Persistent while working
    animation: 'rotate',
  },
  chatting: {
    sprite: 'emote_speech',
    duration: 1000,
    animation: 'float',
  },
};

class EmoteSystem {
  private scene: Phaser.Scene;
  private activeEmotes: Map<string, Phaser.GameObjects.Sprite>;

  show(agentId: string, emoteType: string, position: { x: number; y: number }) {
    const config = EMOTES[emoteType];
    if (!config) return;

    // Remove existing emote
    this.hide(agentId);

    const emote = this.scene.add.sprite(position.x, position.y - 40, config.sprite);
    emote.setDepth(1000);

    if (config.animation) {
      this.playAnimation(emote, config.animation);
    }

    if (config.particle) {
      this.playParticle(position, config.particle);
    }

    this.activeEmotes.set(agentId, emote);

    if (config.duration > 0) {
      this.scene.time.delayedCall(config.duration, () => this.hide(agentId));
    }
  }

  hide(agentId: string) {
    const emote = this.activeEmotes.get(agentId);
    if (emote) {
      emote.destroy();
      this.activeEmotes.delete(agentId);
    }
  }
}
```

---

## 5. Sprite Generation System

### 5.1 PixelLab.ai Integration (Primary)

```typescript
// packages/server/src/services/SpriteGenerator/PixelLabClient.ts

interface PixelLabConfig {
  apiKey: string;
  baseUrl: string;
  defaultStyle: 'retro-16' | 'retro-32' | 'modern';
}

interface SpriteRequest {
  type: 'character' | 'building' | 'tile' | 'object';
  prompt: string;
  style?: string;
  size?: { width: number; height: number };
  animation?: boolean;
  frameCount?: number;
  seed?: number;  // For determinism
}

interface SpriteResult {
  imageUrl: string;
  base64?: string;
  metadata: {
    width: number;
    height: number;
    frames?: number;
    palette?: string[];
  };
}

class PixelLabClient {
  private config: PixelLabConfig;
  private cache: SpriteCache;

  constructor(config: PixelLabConfig) {
    this.config = config;
    this.cache = new SpriteCache();
  }

  async generateCharacter(params: {
    name: string;
    role: 'developer' | 'reviewer' | 'tester' | 'architect';
    mood: string;
    seed: number;
  }): Promise<SpriteResult> {
    const cacheKey = `char:${params.name}:${params.role}:${params.seed}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const prompt = this.buildCharacterPrompt(params);

    const response = await fetch(`${this.config.baseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        style: this.config.defaultStyle,
        width: 32,
        height: 48,
        animation: true,
        frames: 4,  // Idle animation
        seed: params.seed,
      }),
    });

    const result = await response.json();
    await this.cache.set(cacheKey, result);

    return result;
  }

  async generateBuilding(params: {
    language: string;
    size: 'small' | 'medium' | 'large';
    style: string;
    seed: number;
  }): Promise<SpriteResult> {
    const prompt = this.buildBuildingPrompt(params);

    // Building sizes
    const sizes = {
      small: { width: 64, height: 64 },
      medium: { width: 96, height: 96 },
      large: { width: 128, height: 128 },
    };

    const response = await fetch(`${this.config.baseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        style: 'isometric-building',
        ...sizes[params.size],
        seed: params.seed,
      }),
    });

    return response.json();
  }

  private buildCharacterPrompt(params: {
    name: string;
    role: string;
    mood: string;
  }): string {
    const roleStyles = {
      developer: 'casual tech worker, hoodie, laptop',
      reviewer: 'smart professional, glasses, clipboard',
      tester: 'detective style, magnifying glass',
      architect: 'formal attire, blueprints, hard hat',
    };

    return `16-bit pixel art character sprite, ${roleStyles[params.role]},
            ${params.mood} expression, RPG game style, transparent background,
            4-frame idle animation, clean pixel art`;
  }

  private buildBuildingPrompt(params: {
    language: string;
    size: string;
    style: string;
  }): string {
    const languageThemes = {
      typescript: 'modern glass office, blue accents',
      javascript: 'colorful cottage, yellow details',
      python: 'cozy library, green vines',
      rust: 'industrial forge, orange glow',
      go: 'minimalist warehouse, cyan trim',
      java: 'corporate tower, red brick',
    };

    const theme = languageThemes[params.language] || 'generic medieval house';

    return `isometric ${params.size} building, ${theme},
            pixel art style, RPG game asset, ${params.style},
            detailed roof, windows with lights`;
  }
}
```

### 5.2 Replicate Fallback

```typescript
// packages/server/src/services/SpriteGenerator/ReplicateClient.ts

import Replicate from 'replicate';

class ReplicateClient {
  private replicate: Replicate;
  private modelId = 'RetroAI/retro-diffusion';  // Or Nano Banana

  constructor(apiKey: string) {
    this.replicate = new Replicate({ auth: apiKey });
  }

  async generateSprite(prompt: string, seed: number): Promise<SpriteResult> {
    const output = await this.replicate.run(this.modelId, {
      input: {
        prompt: `${prompt}, pixel art, 16-bit style, game sprite`,
        negative_prompt: 'blurry, realistic, 3d render',
        width: 128,
        height: 128,
        num_inference_steps: 30,
        seed,
      },
    });

    return {
      imageUrl: output[0] as string,
      metadata: { width: 128, height: 128 },
    };
  }
}
```

### 5.3 Sprite Cache & CDN

```typescript
// packages/server/src/services/SpriteGenerator/SpriteCache.ts

interface SpriteCacheConfig {
  redisUrl: string;
  s3Bucket: string;
  cdnBaseUrl: string;
  ttlSeconds: number;
}

class SpriteCache {
  private redis: Redis;
  private s3: S3Client;
  private config: SpriteCacheConfig;

  async get(key: string): Promise<SpriteResult | null> {
    // Check Redis for metadata
    const cached = await this.redis.get(`sprite:${key}`);
    if (cached) {
      const metadata = JSON.parse(cached);
      return {
        imageUrl: `${this.config.cdnBaseUrl}/${metadata.s3Key}`,
        metadata,
      };
    }
    return null;
  }

  async set(key: string, result: SpriteResult): Promise<void> {
    // Upload to S3
    const s3Key = `sprites/${key}/${Date.now()}.png`;

    const imageBuffer = await fetch(result.imageUrl).then(r => r.arrayBuffer());

    await this.s3.send(new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: s3Key,
      Body: Buffer.from(imageBuffer),
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000',
    }));

    // Store metadata in Redis
    await this.redis.setex(
      `sprite:${key}`,
      this.config.ttlSeconds,
      JSON.stringify({ ...result.metadata, s3Key })
    );
  }
}
```

---

## 6. Multiplayer Architecture

### 6.1 Socket.io + Yjs CRDT Setup

```typescript
// packages/server/src/realtime/MultiplayerServer.ts

import { Server as SocketServer } from 'socket.io';
import * as Y from 'yjs';
import { setupWSConnection } from 'y-websocket/bin/utils';

interface RoomState {
  doc: Y.Doc;
  agents: Y.Map<AgentState>;
  players: Y.Map<PlayerState>;
  awareness: awarenessProtocol.Awareness;
}

class MultiplayerServer {
  private io: SocketServer;
  private rooms: Map<string, RoomState>;

  constructor(httpServer: Server) {
    this.io = new SocketServer(httpServer, {
      cors: { origin: '*' },
      pingInterval: 10000,
      pingTimeout: 5000,
    });

    this.rooms = new Map();
    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.on('connection', (socket) => {
      socket.on('join_room', (roomId: string, userId: string) => {
        this.handleJoinRoom(socket, roomId, userId);
      });

      socket.on('leave_room', (roomId: string) => {
        this.handleLeaveRoom(socket, roomId);
      });

      socket.on('agent_update', (data: AgentUpdateData) => {
        this.handleAgentUpdate(socket, data);
      });

      socket.on('player_move', (data: PlayerMoveData) => {
        this.handlePlayerMove(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private getOrCreateRoom(roomId: string): RoomState {
    if (!this.rooms.has(roomId)) {
      const doc = new Y.Doc();
      const agents = doc.getMap('agents');
      const players = doc.getMap('players');
      const awareness = new awarenessProtocol.Awareness(doc);

      this.rooms.set(roomId, { doc, agents, players, awareness });
    }
    return this.rooms.get(roomId)!;
  }

  private handleJoinRoom(socket: Socket, roomId: string, userId: string) {
    const room = this.getOrCreateRoom(roomId);

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = userId;

    // Add player to room state
    room.players.set(userId, {
      id: userId,
      position: { x: 400, y: 300 },
      cursor: null,
      lastSeen: Date.now(),
    });

    // Send initial state
    socket.emit('room_state', {
      agents: Object.fromEntries(room.agents),
      players: Object.fromEntries(room.players),
    });

    // Notify others
    socket.to(roomId).emit('player_joined', {
      userId,
      position: { x: 400, y: 300 },
    });
  }

  private handlePlayerMove(socket: Socket, data: PlayerMoveData) {
    const { roomId, userId } = socket.data;
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Update CRDT state
    const player = room.players.get(userId);
    if (player) {
      room.players.set(userId, {
        ...player,
        position: data.position,
        lastSeen: Date.now(),
      });
    }

    // Broadcast to room (spatial filtering)
    this.broadcastToNearby(roomId, data.position, 'player_moved', {
      userId,
      position: data.position,
    });
  }

  private broadcastToNearby(
    roomId: string,
    position: { x: number; y: number },
    event: string,
    data: any
  ) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const AOI_RADIUS = 75;  // Area of Interest radius in tiles

    for (const [playerId, player] of room.players) {
      const dist = Math.hypot(
        player.position.x - position.x,
        player.position.y - position.y
      );

      if (dist <= AOI_RADIUS) {
        this.io.to(roomId).emit(event, data);
      }
    }
  }
}
```

### 6.2 Spatial Partitioning

```typescript
// packages/server/src/realtime/SpatialGrid.ts

interface SpatialCell {
  players: Set<string>;
  entities: Set<string>;
}

class SpatialGrid {
  private cells: Map<string, SpatialCell>;
  private cellSize: number;

  constructor(cellSize = 100) {
    this.cells = new Map();
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  private getOrCreateCell(key: string): SpatialCell {
    if (!this.cells.has(key)) {
      this.cells.set(key, { players: new Set(), entities: new Set() });
    }
    return this.cells.get(key)!;
  }

  addPlayer(id: string, x: number, y: number) {
    const key = this.getCellKey(x, y);
    const cell = this.getOrCreateCell(key);
    cell.players.add(id);
  }

  movePlayer(id: string, oldX: number, oldY: number, newX: number, newY: number) {
    const oldKey = this.getCellKey(oldX, oldY);
    const newKey = this.getCellKey(newX, newY);

    if (oldKey !== newKey) {
      this.cells.get(oldKey)?.players.delete(id);
      this.getOrCreateCell(newKey).players.add(id);
    }
  }

  getNearbyPlayers(x: number, y: number, radius: number): string[] {
    const players: string[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const cell = this.cells.get(`${cx + dx},${cy + dy}`);
        if (cell) {
          players.push(...cell.players);
        }
      }
    }

    return players;
  }
}
```

### 6.3 Client-Side Sync

```typescript
// packages/frontend/src/multiplayer/SyncProvider.ts

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Awareness } from 'y-protocols/awareness';

class MultiplayerSync {
  private doc: Y.Doc;
  private provider: WebsocketProvider;
  private awareness: Awareness;

  constructor(roomId: string, wsUrl: string) {
    this.doc = new Y.Doc();
    this.provider = new WebsocketProvider(wsUrl, roomId, this.doc);
    this.awareness = this.provider.awareness;

    this.setupObservers();
  }

  private setupObservers() {
    const players = this.doc.getMap('players');
    const agents = this.doc.getMap('agents');

    // React to player changes
    players.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add') {
          eventBus.emit('player:joined', players.get(key));
        } else if (change.action === 'delete') {
          eventBus.emit('player:left', key);
        } else if (change.action === 'update') {
          eventBus.emit('player:updated', players.get(key));
        }
      });
    });

    // React to agent changes
    agents.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        const agent = agents.get(key);
        eventBus.emit('agent:stateChanged', agent);
      });
    });

    // Awareness for cursors and presence
    this.awareness.on('change', () => {
      const states = this.awareness.getStates();
      eventBus.emit('awareness:updated', states);
    });
  }

  updateLocalPlayer(state: Partial<PlayerState>) {
    this.awareness.setLocalStateField('player', state);
  }

  getPlayers(): Map<string, PlayerState> {
    return this.doc.getMap('players');
  }
}
```

---

## 7. Data Models

### 7.1 Prisma Schema

```prisma
// packages/server/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// === Authentication & Users ===

model User {
  id            String   @id @default(cuid())
  githubId      Int      @unique
  username      String
  email         String?
  avatarUrl     String?
  accessToken   String?  // Encrypted
  refreshToken  String?  // Encrypted

  // Relations
  ownedVillages Village[]  @relation("VillageOwner")
  memberships   VillageMember[]
  agentSessions AgentSession[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// === Villages (GitHub Orgs) ===

model Village {
  id           String   @id @default(cuid())
  githubOrgId  Int      @unique
  name         String
  slug         String   @unique
  description  String?
  avatarUrl    String?
  isPublic     Boolean  @default(false)

  // World Generation
  worldSeed    String?
  worldVersion Int      @default(1)
  worldConfig  Json?    // TilemapConfig, biome, etc.

  // Relations
  owner        User     @relation("VillageOwner", fields: [ownerId], references: [id])
  ownerId      String
  members      VillageMember[]
  houses       House[]
  agents       Agent[]
  bugBots      BugBot[]

  lastSyncedAt DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model VillageMember {
  id        String   @id @default(cuid())
  role      Role     @default(MEMBER)

  village   Village  @relation(fields: [villageId], references: [id])
  villageId String
  user      User     @relation(fields: [userId], references: [id])
  userId    String

  joinedAt  DateTime @default(now())

  @@unique([villageId, userId])
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  VISITOR
}

// === Houses (Repositories) ===

model House {
  id             String   @id @default(cuid())
  githubRepoId   BigInt   @unique
  name           String
  fullName       String
  description    String?

  // Repository Metadata
  primaryLanguage String?
  languages       Json?    // { "TypeScript": 45000, "JavaScript": 12000 }
  stars           Int      @default(0)
  forks           Int      @default(0)
  openIssues      Int      @default(0)

  // Semantic Analysis
  moduleCount     Int      @default(0)
  complexity      Float    @default(0)
  structure       Json?    // FileTreeNode[]

  // Building Data
  buildingType    BuildingType @default(COTTAGE)
  buildingSize    BuildingSize @default(MEDIUM)
  buildingSeed    Int?
  buildingSprite  String?  // CDN URL

  // Position in Village
  positionX       Float?
  positionY       Float?

  // Generated Interior
  roomCount       Int      @default(0)
  interiorData    Json?    // Room[], Corridor[]

  // Relations
  village         Village  @relation(fields: [villageId], references: [id])
  villageId       String
  rooms           Room[]
  bugBots         BugBot[]

  lastAnalyzedAt  DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum BuildingType {
  COTTAGE      // JavaScript, Python
  CASTLE       // C++, Rust
  LABORATORY   // TypeScript, Go
  GARDEN       // Ruby, Elixir
  LIBRARY      // Java, Kotlin
  WORKSHOP     // PHP, Perl
}

enum BuildingSize {
  TINY         // < 10 files
  SMALL        // 10-50 files
  MEDIUM       // 50-200 files
  LARGE        // 200-1000 files
  HUGE         // 1000+ files
}

// === Rooms (Modules/Components) ===

model Room {
  id           String   @id @default(cuid())
  name         String
  path         String   // File path
  type         RoomType

  // Semantic Data
  exports      Json?    // ExportDefinition[]
  imports      Json?    // string[]
  complexity   Float    @default(0)
  loc          Int      @default(0)

  // Room Layout
  positionX    Float
  positionY    Float
  width        Float
  height       Float

  // Relations
  house        House    @relation(fields: [houseId], references: [id])
  houseId      String

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum RoomType {
  ENTRANCE
  HALLWAY
  WORKSPACE
  LIBRARY
  VAULT
  LABORATORY
  ARCHIVE
}

// === Agents ===

model Agent {
  id             String   @id @default(cuid())
  name           String
  avatarUrl      String?
  spriteUrl      String?  // Generated sprite

  // MCP Configuration
  mcpServerUrl   String?
  mcpConfig      Json?

  // Current State
  status         AgentStatus @default(IDLE)
  currentTask    String?
  positionX      Float?
  positionY      Float?
  mood           String?
  energy         Float    @default(100)

  // Relations
  village        Village  @relation(fields: [villageId], references: [id])
  villageId      String
  sessions       AgentSession[]
  assignedBugs   BugBot[]

  lastActiveAt   DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

enum AgentStatus {
  IDLE
  THINKING
  EXECUTING
  SUCCESS
  ERROR
  STUCK
  OFFLINE
}

model AgentSession {
  id           String   @id @default(cuid())
  token        String   @unique @default(cuid())
  status       SessionStatus @default(ACTIVE)

  // Relations
  agent        Agent    @relation(fields: [agentId], references: [id])
  agentId      String
  user         User     @relation(fields: [userId], references: [id])
  userId       String
  events       WorkStreamEvent[]

  startedAt    DateTime @default(now())
  endedAt      DateTime?
}

enum SessionStatus {
  ACTIVE
  PAUSED
  ENDED
  ERROR
}

model WorkStreamEvent {
  id         String   @id @default(cuid())
  type       String   // tool_call, result, error, message
  content    String?
  metadata   Json?

  session    AgentSession @relation(fields: [sessionId], references: [id])
  sessionId  String

  timestamp  DateTime @default(now())

  @@index([sessionId, timestamp])
}

// === Bug Bots ===

model BugBot {
  id             String   @id @default(cuid())
  githubIssueId  Int
  issueNumber    Int
  title          String
  body           String?
  severity       BugSeverity @default(MEDIUM)
  status         BugStatus   @default(OPEN)

  // Position
  positionX      Float?
  positionY      Float?

  // Relations
  village        Village  @relation(fields: [villageId], references: [id])
  villageId      String
  house          House?   @relation(fields: [houseId], references: [id])
  houseId        String?
  assignedAgent  Agent?   @relation(fields: [assignedAgentId], references: [id])
  assignedAgentId String?

  createdAt      DateTime @default(now())
  resolvedAt     DateTime?

  @@unique([villageId, githubIssueId])
}

enum BugSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum BugStatus {
  OPEN
  ASSIGNED
  IN_PROGRESS
  RESOLVED
  WONT_FIX
}
```

---

## 8. API Design

### 8.1 REST Endpoints

```typescript
// === Repository Analysis ===
POST   /api/repos/analyze
       Body: { owner: string, repo: string }
       Response: { analysisId: string, status: 'queued' }

GET    /api/repos/:id/analysis
       Response: RepoAnalysisResult

GET    /api/repos/:id/structure
       Response: { tree: FileTreeNode[], modules: ModuleDefinition[] }

// === World Generation ===
POST   /api/villages/:id/generate
       Body: { seed?: string, config?: WorldConfig }
       Response: { jobId: string }

GET    /api/villages/:id/world
       Response: WorldMapData

GET    /api/houses/:id/interior
       Response: { rooms: Room[], corridors: Corridor[], tilemap: TilemapData }

// === Agents ===
GET    /api/villages/:id/agents
       Response: Agent[]

POST   /api/agents
       Body: { villageId: string, name: string, mcpServerUrl: string }
       Response: Agent

POST   /api/agents/:id/start
       Response: { sessionId: string, token: string }

POST   /api/agents/:id/command
       Body: { command: string, params?: object }
       Response: { eventId: string }

GET    /api/agents/:id/stream
       Response: SSE stream of WorkStreamEvent

// === Sprites ===
POST   /api/sprites/generate
       Body: SpriteRequest
       Response: { jobId: string }

GET    /api/sprites/:jobId
       Response: SpriteResult

// === Multiplayer ===
GET    /api/rooms/:id/state
       Response: { players: PlayerState[], agents: AgentState[] }

POST   /api/rooms/:id/join
       Body: { userId: string }
       Response: { token: string, wsUrl: string }
```

### 8.2 WebSocket Events

```typescript
// Client → Server
interface ClientEvents {
  'join_room': { roomId: string; token: string };
  'leave_room': { roomId: string };
  'player_move': { position: { x: number; y: number } };
  'player_action': { action: string; target?: string };
  'agent_command': { agentId: string; command: string; params?: object };
  'chat_message': { content: string; channel: 'global' | 'room' | 'whisper' };
}

// Server → Client
interface ServerEvents {
  'room_state': { players: PlayerState[]; agents: AgentState[] };
  'player_joined': { player: PlayerState };
  'player_left': { playerId: string };
  'player_moved': { playerId: string; position: { x: number; y: number } };
  'agent_update': { agentId: string; state: AgentState };
  'work_stream': { sessionId: string; event: WorkStreamEvent };
  'bug_bot_spawn': { bugBot: BugBot };
  'bug_bot_resolved': { bugBotId: string };
  'chat_message': { from: string; content: string; channel: string };
  'error': { code: string; message: string };
}
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
**Goal**: Core infrastructure and basic world generation

```
Week 1: Project Setup & GitHub Analysis
├── [ ] Initialize monorepo with pnpm
├── [ ] Set up PostgreSQL + Prisma schema
├── [ ] Implement GitHub OAuth flow
├── [ ] Build GitHub GraphQL client
├── [ ] Create basic Tree-sitter analyzer
└── [ ] Write unit tests for analysis

Week 2: Procedural Generation
├── [ ] Implement seeded RNG (Mulberry32/Prando)
├── [ ] Build BSP room generator
├── [ ] Create Delaunay/MST corridor system
├── [ ] Implement tilemap generation
├── [ ] Add auto-tiling for walls
└── [ ] Write generation tests

Week 3: Frontend Foundation
├── [ ] Set up Phaser.js with React
├── [ ] Create world rendering scene
├── [ ] Implement camera controls (pan/zoom)
├── [ ] Build basic tilemap renderer
├── [ ] Add collision detection
└── [ ] Write rendering tests
```

### Phase 2: Agent System (Weeks 4-6)
**Goal**: Intelligent agent behavior and sprites

```
Week 4: Agent State Machine
├── [ ] Implement XState v5 agent machine
├── [ ] Build state-animation mapping
├── [ ] Create emote system
├── [ ] Add work stream integration
├── [ ] Implement task assignment
└── [ ] Write behavior tests

Week 5: Steering & Movement
├── [ ] Integrate Yuka.js
├── [ ] Implement pathfinding (A*)
├── [ ] Add obstacle avoidance
├── [ ] Create wander behavior
├── [ ] Build follow/seek behaviors
└── [ ] Write movement tests

Week 6: Sprite Generation
├── [ ] Set up PixelLab.ai client
├── [ ] Implement sprite caching (Redis + S3)
├── [ ] Build building sprite generator
├── [ ] Create character sprite generator
├── [ ] Add fallback to Replicate
└── [ ] Write generation tests
```

### Phase 3: Multiplayer (Weeks 7-9)
**Goal**: Real-time collaboration and presence

```
Week 7: Socket.io Infrastructure
├── [ ] Set up Socket.io server
├── [ ] Implement room management
├── [ ] Build presence tracking
├── [ ] Create spatial grid partitioning
├── [ ] Add rate limiting
└── [ ] Write socket tests

Week 8: CRDT Integration
├── [ ] Set up Yjs documents
├── [ ] Implement WebSocket provider
├── [ ] Build awareness protocol
├── [ ] Create state sync observers
├── [ ] Add conflict resolution
└── [ ] Write sync tests

Week 9: Client Integration
├── [ ] Build multiplayer sync provider
├── [ ] Implement player rendering
├── [ ] Add cursor awareness
├── [ ] Create chat system
├── [ ] Build presence UI
└── [ ] Write integration tests
```

### Phase 4: Polish & Launch (Weeks 10-12)
**Goal**: Production-ready release

```
Week 10: Performance Optimization
├── [ ] Profile and optimize rendering
├── [ ] Implement sprite batching
├── [ ] Add LOD system
├── [ ] Optimize network messages
├── [ ] Reduce bundle size
└── [ ] Run load tests

Week 11: UX & Onboarding
├── [ ] Create onboarding flow
├── [ ] Build settings UI
├── [ ] Add keyboard shortcuts
├── [ ] Implement error handling
├── [ ] Create help documentation
└── [ ] User testing

Week 12: Deployment & Launch
├── [ ] Set up CI/CD
├── [ ] Deploy to production
├── [ ] Configure monitoring
├── [ ] Security audit
├── [ ] Create launch assets
└── [ ] Launch! 🚀
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
// packages/server/src/services/__tests__/BSPGenerator.test.ts

describe('BSPGenerator', () => {
  it('generates deterministic rooms with same seed', () => {
    const gen1 = new BSPGenerator('test-seed');
    const gen2 = new BSPGenerator('test-seed');

    const result1 = gen1.generate(100, 100, mockModules);
    const result2 = gen2.generate(100, 100, mockModules);

    expect(result1.rooms).toEqual(result2.rooms);
    expect(result1.corridors).toEqual(result2.corridors);
  });

  it('respects minimum room size constraints', () => {
    const gen = new BSPGenerator('size-test');
    const { rooms } = gen.generate(100, 100, mockModules);

    for (const room of rooms) {
      expect(room.width).toBeGreaterThanOrEqual(6);
      expect(room.height).toBeGreaterThanOrEqual(6);
    }
  });

  it('creates fully connected graph', () => {
    const gen = new BSPGenerator('connectivity');
    const { rooms, corridors } = gen.generate(100, 100, mockModules);

    const graph = buildGraph(rooms, corridors);
    expect(isConnected(graph)).toBe(true);
  });
});
```

### 10.2 Integration Tests

```typescript
// packages/server/src/__tests__/worldGeneration.integration.test.ts

describe('World Generation Pipeline', () => {
  it('generates complete world from GitHub repo', async () => {
    // Mock GitHub API
    nock('https://api.github.com')
      .post('/graphql')
      .reply(200, mockRepoResponse);

    // Run analysis
    const analysis = await repoAnalyzer.analyze('owner', 'repo');

    // Generate world
    const world = await worldGenerator.generate(analysis, { seed: 'test' });

    expect(world.tilemap).toBeDefined();
    expect(world.rooms.length).toBeGreaterThan(0);
    expect(world.corridors.length).toBeGreaterThan(0);
  });
});
```

### 10.3 Visual Regression Tests

```typescript
// packages/frontend/src/__tests__/rendering.visual.test.ts

import { toMatchImageSnapshot } from 'jest-image-snapshot';

describe('World Rendering', () => {
  it('renders village consistently', async () => {
    const scene = await renderScene(mockWorldData);
    const screenshot = await scene.screenshot();

    expect(screenshot).toMatchImageSnapshot({
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    });
  });
});
```

---

## 11. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial Load | < 3s | Lighthouse |
| FPS (100 sprites) | 60 | Phaser stats |
| FPS (500 sprites) | 45+ | Phaser stats |
| WebSocket Latency | < 100ms | Custom metric |
| Room Generation | < 500ms | Server timing |
| Sprite Generation | < 5s | API timing |
| World Generation | < 10s | Job completion |
| Memory (Frontend) | < 200MB | DevTools |
| Bundle Size | < 500KB gzip | Vite build |

---

## Appendix A: Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Game Engine | Phaser.js 3.80+ | 2D rendering, physics |
| UI Framework | React 18 | Settings, dialogs |
| State Machine | XState v5 | Agent behavior |
| Steering | Yuka.js | Movement, pathfinding |
| Backend | Express.js + TypeScript | REST API |
| Database | PostgreSQL 15+ | Primary data |
| Cache | Redis 7+ | Sessions, rate limiting |
| Queue | BullMQ | Job processing |
| Realtime | Socket.io + Yjs | Multiplayer sync |
| GitHub | GraphQL API v4 | Repo analysis |
| Parsing | Tree-sitter | Code semantics |
| Sprites | PixelLab.ai + Replicate | Asset generation |
| Storage | S3/R2 | Asset CDN |
| Deployment | Vercel + Railway | Hosting |

---

## Appendix B: External API Costs

| Service | Cost | Usage Estimate |
|---------|------|----------------|
| PixelLab.ai | $0.007-0.015/image | ~$50/month |
| Replicate (fallback) | $0.0023/second | ~$20/month |
| GitHub API | Free (5000 req/hr) | N/A |
| Railway (server) | ~$20/month | Standard plan |
| Vercel (frontend) | Free tier | Pro if needed |
| R2 (storage) | $0.015/GB | ~$5/month |
| **Total** | | **~$95/month** |

---

*Document Version: 2.0*
*Last Updated: December 2025*
*Author: Architecture Agent + Research Team*
