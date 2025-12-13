# Repository-to-Building Algorithm Specification

> Deterministic transformation of any GitHub repository into a navigable building with rooms.

## Overview

This algorithm converts a repository's structure into a procedurally-generated building interior. The same repository at the same commit always generates the identical layout.

## Pipeline Stages

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   GitHub    │───▶│   Analyze   │───▶│  Generate   │───▶│   Render    │
│   Fetch     │    │   & Parse   │    │   Layout    │    │   Assets    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     │                   │                  │                  │
     ▼                   ▼                  ▼                  ▼
  GraphQL           Tree-sitter         BSP + MST          Phaser.js
  API v4            Semantics           Algorithm          Tilemaps
```

---

## Stage 1: Repository Fetch

### 1.1 GraphQL Query

```graphql
query FetchRepository($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    id
    databaseId
    name
    description
    defaultBranchRef {
      name
      target {
        ... on Commit {
          oid  # Used for seeding
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
                    object {
                      ... on Blob { byteSize }
                      ... on Tree {
                        entries { name type }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
      edges {
        size
        node { name color }
      }
    }
  }
}
```

### 1.2 Output Structure

```typescript
interface RepositoryData {
  id: string;
  databaseId: number;
  name: string;
  commitSha: string;        // For deterministic seeding
  tree: FileTreeEntry[];
  languages: LanguageEntry[];
}

interface FileTreeEntry {
  path: string;
  name: string;
  type: 'blob' | 'tree';
  size?: number;
  isBinary?: boolean;
  children?: FileTreeEntry[];
}

interface LanguageEntry {
  name: string;
  color: string;
  bytes: number;
  percentage: number;
}
```

---

## Stage 2: Semantic Analysis

### 2.1 Module Classification

Each directory/file is classified into a module type:

```typescript
type ModuleType =
  | 'component'    // React/Vue/Svelte components
  | 'service'      // Business logic, APIs
  | 'repository'   // Data access, models
  | 'controller'   // Request handlers
  | 'utility'      // Helpers, shared functions
  | 'config'       // Configuration files
  | 'type'         // Type definitions
  | 'test'         // Test files
  | 'asset'        // Static assets
  | 'root';        // Root-level files
```

### 2.2 Classification Rules

```typescript
function classifyModule(entry: FileTreeEntry): ModuleType {
  const name = entry.name.toLowerCase();
  const path = entry.path.toLowerCase();

  // Test files
  if (
    name.includes('.test.') ||
    name.includes('.spec.') ||
    path.includes('__tests__') ||
    path.includes('/test/') ||
    path.includes('/tests/')
  ) {
    return 'test';
  }

  // Configuration
  if (
    name.endsWith('.config.js') ||
    name.endsWith('.config.ts') ||
    name.includes('rc.') ||
    ['package.json', 'tsconfig.json', '.env'].includes(name)
  ) {
    return 'config';
  }

  // Type definitions
  if (
    name.endsWith('.d.ts') ||
    path.includes('/types/') ||
    path.includes('/interfaces/')
  ) {
    return 'type';
  }

  // Components (UI)
  if (
    path.includes('/components/') ||
    path.includes('/ui/') ||
    path.includes('/views/') ||
    path.includes('/pages/')
  ) {
    return 'component';
  }

  // Services (Business logic)
  if (
    path.includes('/services/') ||
    path.includes('/api/') ||
    path.includes('/lib/')
  ) {
    return 'service';
  }

  // Data access
  if (
    path.includes('/models/') ||
    path.includes('/repos/') ||
    path.includes('/db/')
  ) {
    return 'repository';
  }

  // Controllers
  if (
    path.includes('/routes/') ||
    path.includes('/controllers/') ||
    path.includes('/handlers/')
  ) {
    return 'controller';
  }

  // Utilities
  if (
    path.includes('/utils/') ||
    path.includes('/helpers/') ||
    path.includes('/shared/')
  ) {
    return 'utility';
  }

  // Assets
  if (
    path.includes('/assets/') ||
    path.includes('/public/') ||
    path.includes('/static/')
  ) {
    return 'asset';
  }

  return 'root';
}
```

### 2.3 Complexity Scoring

Each module receives a complexity score (1-10):

```typescript
interface ComplexityFactors {
  fileCount: number;       // More files = more complex
  totalSize: number;       // Larger = more complex
  depth: number;           // Deeper nesting = more complex
  importCount: number;     // More imports = more complex
  exportCount: number;     // More exports = more important
}

function calculateComplexity(module: ModuleDefinition): number {
  const weights = {
    fileCount: 0.2,
    totalSize: 0.2,
    depth: 0.15,
    importCount: 0.25,
    exportCount: 0.2,
  };

  const normalized = {
    fileCount: Math.min(module.fileCount / 50, 1),
    totalSize: Math.min(module.totalSize / 100000, 1),
    depth: Math.min(module.depth / 5, 1),
    importCount: Math.min(module.importCount / 20, 1),
    exportCount: Math.min(module.exportCount / 10, 1),
  };

  const score = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + normalized[key] * weight,
    0
  );

  return Math.ceil(score * 10);
}
```

### 2.4 Output: Module Graph

```typescript
interface ModuleDefinition {
  id: string;              // Unique identifier
  path: string;            // Directory path
  name: string;            // Display name
  type: ModuleType;
  files: string[];         // File paths in module
  fileCount: number;
  totalSize: number;       // Bytes
  depth: number;           // Nesting level
  complexity: number;      // 1-10
  imports: string[];       // Module IDs this depends on
  exports: string[];       // Public API surface
  children: string[];      // Sub-module IDs
}

interface ModuleGraph {
  modules: Map<string, ModuleDefinition>;
  edges: Array<{ from: string; to: string; type: 'import' | 'parent' }>;
  rootModules: string[];   // Entry points
}
```

---

## Stage 3: Building Generation

### 3.1 Building Size Calculation

```typescript
type BuildingSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge';

function determineBuildingSize(modules: ModuleDefinition[]): BuildingSize {
  const totalFiles = modules.reduce((sum, m) => sum + m.fileCount, 0);
  const totalComplexity = modules.reduce((sum, m) => sum + m.complexity, 0);

  const score = totalFiles * 0.6 + totalComplexity * 0.4;

  if (score < 10) return 'tiny';
  if (score < 30) return 'small';
  if (score < 80) return 'medium';
  if (score < 200) return 'large';
  return 'huge';
}

const BUILDING_DIMENSIONS: Record<BuildingSize, { width: number; height: number }> = {
  tiny:   { width: 24, height: 24 },   // ~576 tiles
  small:  { width: 32, height: 32 },   // ~1024 tiles
  medium: { width: 48, height: 48 },   // ~2304 tiles
  large:  { width: 64, height: 64 },   // ~4096 tiles
  huge:   { width: 96, height: 96 },   // ~9216 tiles
};
```

### 3.2 Seed Generation

```typescript
function generateSeed(repoId: string, commitSha: string): string {
  // Deterministic seed from repo + commit
  return `${repoId}:${commitSha}`;
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
```

### 3.3 BSP Tree Generation

Binary Space Partitioning creates non-overlapping regions for rooms.

```typescript
interface BSPNode {
  x: number;
  y: number;
  width: number;
  height: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
  moduleId?: string;
}

class BSPGenerator {
  private rng: SeededRNG;
  private minRoomSize = 6;
  private splitRatio = { min: 0.35, max: 0.65 };

  constructor(seed: string) {
    this.rng = new SeededRNG(seed);
  }

  generate(
    width: number,
    height: number,
    targetRooms: number
  ): BSPNode {
    return this.split(
      { x: 0, y: 0, width, height },
      targetRooms,
      0
    );
  }

  private split(
    bounds: Bounds,
    targetRooms: number,
    depth: number
  ): BSPNode {
    const node: BSPNode = { ...bounds };

    // Stop conditions
    const maxDepth = Math.ceil(Math.log2(targetRooms)) + 2;
    if (depth >= maxDepth) return node;
    if (bounds.width < this.minRoomSize * 2 || bounds.height < this.minRoomSize * 2) {
      return node;
    }

    // Determine split direction
    const horizontal = this.chooseSplitDirection(bounds);

    // Calculate split position
    const ratio = this.rng.next() * (this.splitRatio.max - this.splitRatio.min) + this.splitRatio.min;

    if (horizontal) {
      const splitY = Math.floor(bounds.y + bounds.height * ratio);

      // Check minimum sizes
      if (splitY - bounds.y < this.minRoomSize || bounds.y + bounds.height - splitY < this.minRoomSize) {
        return node;
      }

      node.left = this.split(
        { x: bounds.x, y: bounds.y, width: bounds.width, height: splitY - bounds.y },
        targetRooms,
        depth + 1
      );
      node.right = this.split(
        { x: bounds.x, y: splitY, width: bounds.width, height: bounds.y + bounds.height - splitY },
        targetRooms,
        depth + 1
      );
    } else {
      const splitX = Math.floor(bounds.x + bounds.width * ratio);

      if (splitX - bounds.x < this.minRoomSize || bounds.x + bounds.width - splitX < this.minRoomSize) {
        return node;
      }

      node.left = this.split(
        { x: bounds.x, y: bounds.y, width: splitX - bounds.x, height: bounds.height },
        targetRooms,
        depth + 1
      );
      node.right = this.split(
        { x: splitX, y: bounds.y, width: bounds.x + bounds.width - splitX, height: bounds.height },
        targetRooms,
        depth + 1
      );
    }

    return node;
  }

  private chooseSplitDirection(bounds: Bounds): boolean {
    // Prefer splitting the longer dimension
    if (bounds.width / bounds.height >= 1.25) return false; // Split vertically
    if (bounds.height / bounds.width >= 1.25) return true;  // Split horizontally
    return this.rng.next() > 0.5; // Random if roughly square
  }
}
```

### 3.4 Room Generation

Each BSP leaf node gets a room:

```typescript
interface Room {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: RoomType;
  moduleId?: string;
  moduleName?: string;
  doors: Door[];
}

interface Door {
  x: number;
  y: number;
  direction: 'north' | 'south' | 'east' | 'west';
  connectsTo: string;  // Room ID
}

type RoomType =
  | 'entrance'      // Main entry (always present)
  | 'hallway'       // Connecting corridors
  | 'workspace'     // Component/service rooms
  | 'library'       // Utility/shared code
  | 'vault'         // Config/secrets
  | 'laboratory'    // Test suites
  | 'archive';      // Legacy/deprecated code

function generateRooms(bspRoot: BSPNode, modules: ModuleDefinition[]): Room[] {
  const leaves = collectLeafNodes(bspRoot);
  const rooms: Room[] = [];

  // Sort modules by importance (complexity × exports)
  const sortedModules = [...modules].sort((a, b) =>
    (b.complexity * b.exports.length) - (a.complexity * a.exports.length)
  );

  // Assign modules to BSP leaves
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    const module = sortedModules[i];

    // Generate room within BSP bounds (with padding)
    const padding = 1;
    const room: Room = {
      id: module?.id || `room_${i}`,
      x: leaf.x + padding,
      y: leaf.y + padding,
      width: leaf.width - padding * 2,
      height: leaf.height - padding * 2,
      type: module ? moduleTypeToRoomType(module.type) : 'hallway',
      moduleId: module?.id,
      moduleName: module?.name,
      doors: [],
    };

    rooms.push(room);
  }

  // Always add an entrance room
  if (!rooms.find(r => r.type === 'entrance')) {
    rooms[0].type = 'entrance';
  }

  return rooms;
}

function moduleTypeToRoomType(type: ModuleType): RoomType {
  const mapping: Record<ModuleType, RoomType> = {
    component: 'workspace',
    service: 'workspace',
    repository: 'library',
    controller: 'workspace',
    utility: 'library',
    config: 'vault',
    type: 'library',
    test: 'laboratory',
    asset: 'archive',
    root: 'hallway',
  };
  return mapping[type];
}
```

### 3.5 Corridor Generation

Using Delaunay triangulation + Minimum Spanning Tree:

```typescript
import { Delaunay } from 'd3-delaunay';

interface Corridor {
  id: string;
  from: string;     // Room ID
  to: string;       // Room ID
  path: Point[];    // Path waypoints
  width: number;    // Corridor width in tiles
}

function generateCorridors(rooms: Room[], rng: SeededRNG): Corridor[] {
  // 1. Get room centers
  const centers = rooms.map(r => ({
    id: r.id,
    x: r.x + r.width / 2,
    y: r.y + r.height / 2,
  }));

  // 2. Create Delaunay triangulation
  const points = centers.map(c => [c.x, c.y]);
  const delaunay = Delaunay.from(points);

  // 3. Extract edges with weights
  const edges: WeightedEdge[] = [];
  for (let i = 0; i < centers.length; i++) {
    for (const j of delaunay.neighbors(i)) {
      if (j > i) {
        const dist = Math.hypot(
          centers[i].x - centers[j].x,
          centers[i].y - centers[j].y
        );
        edges.push({
          from: i,
          to: j,
          weight: dist,
        });
      }
    }
  }

  // 4. Compute MST using Kruskal's algorithm
  const mst = kruskalMST(edges, centers.length);

  // 5. Add ~15% extra edges for loops
  const extraCount = Math.floor(rooms.length * 0.15);
  const extraEdges = edges
    .filter(e => !mst.some(m => m.from === e.from && m.to === e.to))
    .sort((a, b) => a.weight - b.weight)
    .slice(0, extraCount);

  // 6. Generate corridor paths
  const allEdges = [...mst, ...extraEdges];
  const corridors: Corridor[] = [];

  for (const edge of allEdges) {
    const roomA = rooms[edge.from];
    const roomB = rooms[edge.to];

    corridors.push({
      id: `corridor_${roomA.id}_${roomB.id}`,
      from: roomA.id,
      to: roomB.id,
      path: generateCorridorPath(roomA, roomB, rng),
      width: 2,
    });

    // Add door entries to rooms
    addDoorsForCorridor(roomA, roomB, corridors[corridors.length - 1]);
  }

  return corridors;
}

function generateCorridorPath(roomA: Room, roomB: Room, rng: SeededRNG): Point[] {
  // L-shaped corridor
  const startX = roomA.x + roomA.width / 2;
  const startY = roomA.y + roomA.height / 2;
  const endX = roomB.x + roomB.width / 2;
  const endY = roomB.y + roomB.height / 2;

  // Randomly choose horizontal-first or vertical-first
  if (rng.next() > 0.5) {
    return [
      { x: startX, y: startY },
      { x: endX, y: startY },
      { x: endX, y: endY },
    ];
  } else {
    return [
      { x: startX, y: startY },
      { x: startX, y: endY },
      { x: endX, y: endY },
    ];
  }
}

function kruskalMST(edges: WeightedEdge[], nodeCount: number): WeightedEdge[] {
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
```

---

## Stage 4: Tilemap Generation

### 4.1 Tilemap Layers

```typescript
interface TilemapData {
  width: number;           // In tiles
  height: number;          // In tiles
  tileSize: number;        // 16 or 32 pixels
  layers: {
    ground: Uint16Array;   // Floor tiles
    walls: Uint16Array;    // Wall tiles
    objects: Uint16Array;  // Furniture, decorations
    overlay: Uint16Array;  // Ceiling effects
  };
  collision: Uint8Array;   // 0 = passable, 1 = blocked
  tileset: string;         // Tileset identifier
}
```

### 4.2 Auto-Tiling Algorithm

4-bit auto-tiling for seamless wall connections:

```typescript
// Neighbor flags
const N  = 1;  // North
const E  = 2;  // East
const S  = 4;  // South
const W  = 8;  // West

function autoTile(
  collision: Uint8Array,
  width: number,
  height: number,
  tileset: TilesetDefinition
): Uint16Array {
  const walls = new Uint16Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (collision[idx] === 1) {
        // Check neighbors
        let mask = 0;
        if (y > 0 && collision[(y - 1) * width + x] === 1) mask |= N;
        if (x < width - 1 && collision[y * width + (x + 1)] === 1) mask |= E;
        if (y < height - 1 && collision[(y + 1) * width + x] === 1) mask |= S;
        if (x > 0 && collision[y * width + (x - 1)] === 1) mask |= W;

        // Look up tile from tileset
        walls[idx] = tileset.wallTiles[mask];
      }
    }
  }

  return walls;
}

// Tileset must define tiles for all 16 combinations (0-15)
interface TilesetDefinition {
  name: string;
  wallTiles: Record<number, number>;  // mask -> tile ID
  floorTiles: number[];               // Array of floor tile IDs
  doorTiles: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}
```

### 4.3 Room Decoration

```typescript
interface RoomDecoration {
  type: 'furniture' | 'plant' | 'computer' | 'bookshelf' | 'desk';
  x: number;
  y: number;
  tileId: number;
  rotation?: number;
}

function decorateRoom(
  room: Room,
  rng: SeededRNG,
  tileset: TilesetDefinition
): RoomDecoration[] {
  const decorations: RoomDecoration[] = [];

  const decorationSets: Record<RoomType, DecorationSet> = {
    entrance: {
      items: ['welcome_mat', 'coat_rack', 'plant'],
      density: 0.1,
    },
    workspace: {
      items: ['desk', 'computer', 'chair', 'whiteboard'],
      density: 0.25,
    },
    library: {
      items: ['bookshelf', 'reading_chair', 'lamp'],
      density: 0.3,
    },
    vault: {
      items: ['safe', 'server_rack', 'monitor'],
      density: 0.2,
    },
    laboratory: {
      items: ['test_tube', 'microscope', 'lab_bench'],
      density: 0.25,
    },
    archive: {
      items: ['filing_cabinet', 'box', 'dusty_shelf'],
      density: 0.35,
    },
    hallway: {
      items: ['plant', 'painting', 'bench'],
      density: 0.05,
    },
  };

  const set = decorationSets[room.type];
  const area = room.width * room.height;
  const count = Math.floor(area * set.density);

  for (let i = 0; i < count; i++) {
    const item = rng.nextArrayItem(set.items);
    const x = room.x + 1 + rng.nextInt(0, room.width - 3);
    const y = room.y + 1 + rng.nextInt(0, room.height - 3);

    decorations.push({
      type: item as any,
      x,
      y,
      tileId: tileset.decorations[item],
    });
  }

  return decorations;
}
```

---

## Stage 5: Asset Generation

### 5.1 Building Exterior Sprite

```typescript
interface BuildingSpriteRequest {
  language: string;        // Primary programming language
  size: BuildingSize;
  activityLevel: number;   // 0-1, affects lighting
  seed: number;
}

async function generateBuildingSprite(
  request: BuildingSpriteRequest
): Promise<SpriteResult> {
  const languageThemes: Record<string, string> = {
    typescript: 'modern glass office building, blue neon accents, tech startup style',
    javascript: 'colorful creative cottage, yellow and orange details, playful design',
    python: 'cozy academic library, green vines, warm lighting, scholarly atmosphere',
    rust: 'industrial forge, orange glow, metal and stone, robust construction',
    go: 'minimalist warehouse, cyan trim, efficient design, clean lines',
    java: 'corporate tower, red brick, formal architecture, enterprise feel',
    cpp: 'medieval castle, stone walls, defensive towers, ancient power',
    ruby: 'gem-encrusted mansion, red accents, elegant Victorian style',
    default: 'generic medieval house, wooden construction, thatched roof',
  };

  const theme = languageThemes[request.language.toLowerCase()] || languageThemes.default;

  const prompt = `isometric ${request.size} building, ${theme}, pixel art style,
    RPG game asset, detailed roof, windows ${request.activityLevel > 0.5 ? 'with warm lights' : 'dark'},
    transparent background, 32-bit color`;

  return await spriteGenerator.generate({
    prompt,
    width: BUILDING_SPRITE_SIZES[request.size].width,
    height: BUILDING_SPRITE_SIZES[request.size].height,
    seed: request.seed,
  });
}

const BUILDING_SPRITE_SIZES: Record<BuildingSize, { width: number; height: number }> = {
  tiny: { width: 48, height: 48 },
  small: { width: 64, height: 64 },
  medium: { width: 96, height: 96 },
  large: { width: 128, height: 128 },
  huge: { width: 192, height: 192 },
};
```

---

## Example Output

For a typical TypeScript monorepo:

```json
{
  "building": {
    "id": "bld_abc123",
    "repoId": "repo_xyz",
    "seed": "owner/repo:abc123def",
    "size": "medium",
    "dimensions": { "width": 48, "height": 48 },
    "language": "typescript",
    "spriteUrl": "https://cdn.example.com/sprites/bld_abc123.png"
  },
  "rooms": [
    {
      "id": "room_entrance",
      "type": "entrance",
      "x": 20, "y": 2,
      "width": 8, "height": 6,
      "doors": [{ "direction": "south", "connectsTo": "room_src_components" }]
    },
    {
      "id": "room_src_components",
      "type": "workspace",
      "moduleName": "components",
      "x": 2, "y": 10,
      "width": 12, "height": 10,
      "doors": [...]
    },
    {
      "id": "room_src_services",
      "type": "workspace",
      "moduleName": "services",
      "x": 16, "y": 10,
      "width": 10, "height": 8,
      "doors": [...]
    },
    {
      "id": "room_tests",
      "type": "laboratory",
      "moduleName": "__tests__",
      "x": 28, "y": 8,
      "width": 8, "height": 12,
      "doors": [...]
    }
  ],
  "corridors": [
    {
      "id": "corridor_entrance_components",
      "from": "room_entrance",
      "to": "room_src_components",
      "path": [{ "x": 24, "y": 8 }, { "x": 8, "y": 8 }, { "x": 8, "y": 10 }],
      "width": 2
    }
  ],
  "tilemap": {
    "width": 48,
    "height": 48,
    "tileSize": 16,
    "tileset": "laboratory_blue",
    "layers": { /* ... */ }
  }
}
```

---

## Determinism Guarantees

1. **Same seed = same layout**: Repository ID + commit SHA generates identical buildings
2. **Reproducible RNG**: Mulberry32/Prando with fixed seed
3. **Stable ordering**: Modules sorted by deterministic criteria before assignment
4. **No external randomness**: All random decisions use seeded RNG

## Performance Considerations

| Operation | Target Time | Optimization |
|-----------|-------------|--------------|
| GitHub fetch | < 2s | GraphQL batching, caching |
| Semantic analysis | < 1s | Incremental parsing, workers |
| BSP generation | < 100ms | Iterative (not recursive in hot path) |
| Corridor generation | < 50ms | Efficient Delaunay implementation |
| Tilemap generation | < 200ms | TypedArrays, no allocations in loop |
| Sprite generation | < 5s | Async, cached, queue-managed |

---

*Document Version: 1.0*
*Last Updated: December 2025*
