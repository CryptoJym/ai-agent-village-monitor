/**
 * Corridor Generation using Delaunay Triangulation + MST
 * Creates connected corridors between rooms
 */
import Delaunator from 'delaunator';
import { SeededRNG } from './rng';
import {
  RoomData,
  CorridorData,
  Edge,
  Point,
  BSPOptions,
  DEFAULT_BSP_OPTIONS,
} from './types';

let corridorIdCounter = 0;

/**
 * Generate unique corridor ID
 */
function generateCorridorId(): string {
  return `corridor-${++corridorIdCounter}`;
}

/**
 * Reset corridor ID counter (for testing)
 */
export function resetCorridorIdCounter(): void {
  corridorIdCounter = 0;
}

/**
 * Generate corridors connecting all rooms
 */
export function generateCorridors(
  rooms: RoomData[],
  rng: SeededRNG,
  options: Partial<BSPOptions> = {}
): CorridorData[] {
  const opts = { ...DEFAULT_BSP_OPTIONS, ...options };

  if (rooms.length < 2) {
    return [];
  }

  // Special case: exactly 2 rooms - direct connection (Delaunator needs 3+ points)
  if (rooms.length === 2) {
    const edge: Edge = {
      from: rooms[0].center,
      to: rooms[1].center,
      fromRoomId: rooms[0].id,
      toRoomId: rooms[1].id,
      distance: distance(rooms[0].center, rooms[1].center),
    };
    return edgesToCorridors([edge], opts.corridorWidth);
  }

  // Get room centers for triangulation
  const points = rooms.map((r) => [r.center.x, r.center.y] as [number, number]);

  // Create Delaunay triangulation
  const delaunay = new Delaunator(points.flat());

  // Extract edges from triangulation
  const edges = extractEdges(delaunay, rooms);

  // Build MST using Kruskal's algorithm
  const mstEdges = buildMST(edges, rooms.length);

  // Add extra edges for loops (30% by default)
  const extraEdges = addExtraEdges(edges, mstEdges, rng, opts.extraEdgeRatio);

  // Combine MST and extra edges
  const allEdges = [...mstEdges, ...extraEdges];

  // Convert edges to corridors
  return edgesToCorridors(allEdges, opts.corridorWidth);
}

/**
 * Extract edges from Delaunay triangulation
 */
function extractEdges(delaunay: Delaunator<number[]>, rooms: RoomData[]): Edge[] {
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  const triangles = delaunay.triangles;

  for (let i = 0; i < triangles.length; i += 3) {
    const indices = [triangles[i], triangles[i + 1], triangles[i + 2]];

    // Add edges for this triangle
    for (let j = 0; j < 3; j++) {
      const a = indices[j];
      const b = indices[(j + 1) % 3];

      // Create canonical key (smaller index first)
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;

      if (!edgeSet.has(key)) {
        edgeSet.add(key);

        const roomA = rooms[a];
        const roomB = rooms[b];

        edges.push({
          from: roomA.center,
          to: roomB.center,
          fromRoomId: roomA.id,
          toRoomId: roomB.id,
          distance: distance(roomA.center, roomB.center),
        });
      }
    }
  }

  return edges;
}

/**
 * Build Minimum Spanning Tree using Kruskal's algorithm
 */
function buildMST(edges: Edge[], nodeCount: number): Edge[] {
  // Sort edges by distance
  const sortedEdges = [...edges].sort((a, b) => a.distance - b.distance);

  // Union-Find data structure
  const parent = new Array(nodeCount).fill(0).map((_, i) => i);
  const rank = new Array(nodeCount).fill(0);

  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]); // Path compression
    }
    return parent[x];
  }

  function union(x: number, y: number): boolean {
    const rootX = find(x);
    const rootY = find(y);

    if (rootX === rootY) return false;

    // Union by rank
    if (rank[rootX] < rank[rootY]) {
      parent[rootX] = rootY;
    } else if (rank[rootX] > rank[rootY]) {
      parent[rootY] = rootX;
    } else {
      parent[rootY] = rootX;
      rank[rootX]++;
    }

    return true;
  }

  // Build node index map
  const nodeIndices = new Map<string, number>();
  let idx = 0;

  for (const edge of sortedEdges) {
    if (!nodeIndices.has(edge.fromRoomId)) {
      nodeIndices.set(edge.fromRoomId, idx++);
    }
    if (!nodeIndices.has(edge.toRoomId)) {
      nodeIndices.set(edge.toRoomId, idx++);
    }
  }

  // Build MST
  const mstEdges: Edge[] = [];

  for (const edge of sortedEdges) {
    const fromIdx = nodeIndices.get(edge.fromRoomId)!;
    const toIdx = nodeIndices.get(edge.toRoomId)!;

    if (union(fromIdx, toIdx)) {
      mstEdges.push(edge);

      // MST is complete when we have n-1 edges
      if (mstEdges.length === nodeCount - 1) {
        break;
      }
    }
  }

  return mstEdges;
}

/**
 * Add extra edges for loops
 */
function addExtraEdges(
  allEdges: Edge[],
  mstEdges: Edge[],
  rng: SeededRNG,
  extraRatio: number
): Edge[] {
  // Get edges not in MST
  const mstSet = new Set(mstEdges.map((e) => edgeKey(e)));
  const nonMstEdges = allEdges.filter((e) => !mstSet.has(edgeKey(e)));

  // Calculate number of extra edges
  const extraCount = Math.floor(mstEdges.length * extraRatio);

  // Shuffle and take first extraCount
  const shuffled = rng.shuffled(nonMstEdges);
  return shuffled.slice(0, extraCount);
}

function edgeKey(edge: Edge): string {
  return edge.fromRoomId < edge.toRoomId
    ? `${edge.fromRoomId}-${edge.toRoomId}`
    : `${edge.toRoomId}-${edge.fromRoomId}`;
}

/**
 * Convert edges to corridor data with paths
 */
function edgesToCorridors(edges: Edge[], width: number): CorridorData[] {
  return edges.map((edge) => ({
    id: generateCorridorId(),
    fromRoomId: edge.fromRoomId,
    toRoomId: edge.toRoomId,
    path: generateCorridorPath(edge.from, edge.to),
    width,
  }));
}

/**
 * Generate L-shaped or straight corridor path
 * Uses deterministic logic based on coordinates (no randomness)
 */
function generateCorridorPath(from: Point, to: Point): Point[] {
  const path: Point[] = [];

  // Start point
  path.push({ x: Math.round(from.x), y: Math.round(from.y) });

  // Decide if L-shaped or straight
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  if (dx < 2 || dy < 2) {
    // Straight corridor
    path.push({ x: Math.round(to.x), y: Math.round(to.y) });
  } else {
    // L-shaped corridor with corner
    // Use deterministic choice based on coordinates (larger delta goes first)
    // This ensures same inputs always produce same outputs
    const horizontalFirst = dx >= dy;

    if (horizontalFirst) {
      // Go horizontal first, then vertical
      path.push({ x: Math.round(to.x), y: Math.round(from.y) });
      path.push({ x: Math.round(to.x), y: Math.round(to.y) });
    } else {
      // Go vertical first, then horizontal
      path.push({ x: Math.round(from.x), y: Math.round(to.y) });
      path.push({ x: Math.round(to.x), y: Math.round(to.y) });
    }
  }

  return path;
}

/**
 * Calculate distance between two points
 */
function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Carve corridor into a 2D grid
 */
export function carveCorridorIntoGrid(
  corridor: CorridorData,
  grid: boolean[][],
  width: number,
  height: number
): void {
  const halfWidth = Math.floor(corridor.width / 2);

  for (let i = 0; i < corridor.path.length - 1; i++) {
    const from = corridor.path[i];
    const to = corridor.path[i + 1];

    // Carve line between points
    carveLine(from, to, halfWidth, grid, width, height);
  }
}

/**
 * Carve a line into the grid (Bresenham's algorithm)
 */
function carveLine(
  from: Point,
  to: Point,
  halfWidth: number,
  grid: boolean[][],
  gridWidth: number,
  gridHeight: number
): void {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx - dy;

  let x = Math.round(from.x);
  let y = Math.round(from.y);

  while (true) {
    // Carve cell and neighbors based on width
    for (let wx = -halfWidth; wx <= halfWidth; wx++) {
      for (let wy = -halfWidth; wy <= halfWidth; wy++) {
        const cx = x + wx;
        const cy = y + wy;

        if (cx >= 0 && cx < gridWidth && cy >= 0 && cy < gridHeight) {
          grid[cy][cx] = false; // false = passable
        }
      }
    }

    if (x === Math.round(to.x) && y === Math.round(to.y)) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * Validate all rooms are connected
 */
export function validateConnectivity(
  rooms: RoomData[],
  corridors: CorridorData[]
): boolean {
  if (rooms.length <= 1) return true;

  // Build adjacency list
  const adjacency = new Map<string, Set<string>>();

  for (const room of rooms) {
    adjacency.set(room.id, new Set());
  }

  for (const corridor of corridors) {
    adjacency.get(corridor.fromRoomId)?.add(corridor.toRoomId);
    adjacency.get(corridor.toRoomId)?.add(corridor.fromRoomId);
  }

  // BFS from first room
  const visited = new Set<string>();
  const queue = [rooms[0].id];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;

    visited.add(current);

    for (const neighbor of adjacency.get(current) || []) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return visited.size === rooms.length;
}

export default generateCorridors;
