/**
 * Room Placement within BSP Nodes
 * Places rooms in leaf nodes with margins
 */
import { SeededRNG } from './rng';
import { getLeafNodes } from './bsp';
import {
  BSPNode,
  BSPOptions,
  DEFAULT_BSP_OPTIONS,
  RoomData,
  Point,
  ModuleInfo,
  moduleTypeToRoomType,
  calculateRoomSize,
} from './types';

let roomIdCounter = 0;

/**
 * Generate unique room ID
 */
function generateRoomId(): string {
  return `room-${++roomIdCounter}`;
}

/**
 * Reset room ID counter (for testing)
 */
export function resetRoomIdCounter(): void {
  roomIdCounter = 0;
}

/**
 * Place rooms within BSP leaf nodes
 */
export function placeRoomsInBSP(
  root: BSPNode,
  modules: ModuleInfo[],
  rng: SeededRNG,
  options: Partial<BSPOptions> = {}
): RoomData[] {
  const opts = { ...DEFAULT_BSP_OPTIONS, ...options };
  const leaves = getLeafNodes(root);
  const rooms: RoomData[] = [];

  // Sort modules by complexity (larger rooms first for better placement)
  const sortedModules = [...modules].sort((a, b) => b.complexity - a.complexity);

  // Assign modules to leaves
  const moduleCount = Math.min(sortedModules.length, leaves.length);

  // Shuffle leaves for variety
  const shuffledLeaves = rng.shuffled(leaves);

  for (let i = 0; i < moduleCount; i++) {
    const leaf = shuffledLeaves[i];
    const module = sortedModules[i];

    const room = createRoomInNode(leaf, module, rng, opts);
    if (room) {
      leaf.room = room;
      rooms.push(room);
    }
  }

  // Create entrance room if we have extra leaves
  if (moduleCount < leaves.length) {
    const entranceLeaf = shuffledLeaves[moduleCount];
    const entranceRoom = createEntranceRoom(entranceLeaf, rng, opts);
    if (entranceRoom) {
      entranceLeaf.room = entranceRoom;
      rooms.push(entranceRoom);
    }
  }

  return rooms;
}

/**
 * Create a room within a BSP leaf node
 */
function createRoomInNode(
  leaf: BSPNode,
  module: ModuleInfo,
  rng: SeededRNG,
  options: BSPOptions
): RoomData | null {
  const { bounds } = leaf;
  const { roomMargin, minRoomSize } = options;

  // Calculate available space after margins
  const availableWidth = bounds.width - roomMargin * 2;
  const availableHeight = bounds.height - roomMargin * 2;

  if (availableWidth < minRoomSize || availableHeight < minRoomSize) {
    return null;
  }

  // Calculate room size based on module complexity
  const { width: targetWidth, height: targetHeight } = calculateRoomSize(module, options);

  // Clamp to available space
  const roomWidth = Math.min(targetWidth, availableWidth);
  const roomHeight = Math.min(targetHeight, availableHeight);

  // Center room with some random offset
  const maxOffsetX = availableWidth - roomWidth;
  const maxOffsetY = availableHeight - roomHeight;

  const offsetX = maxOffsetX > 0 ? rng.nextInt(0, maxOffsetX) : 0;
  const offsetY = maxOffsetY > 0 ? rng.nextInt(0, maxOffsetY) : 0;

  const roomX = bounds.x + roomMargin + offsetX;
  const roomY = bounds.y + roomMargin + offsetY;

  const roomBounds = {
    x: roomX,
    y: roomY,
    width: roomWidth,
    height: roomHeight,
  };

  const center: Point = {
    x: roomX + roomWidth / 2,
    y: roomY + roomHeight / 2,
  };

  return {
    id: generateRoomId(),
    name: module.name,
    bounds: roomBounds,
    center,
    roomType: moduleTypeToRoomType(module.type),
    moduleType: module.type,
    modulePath: module.path,
    fileCount: module.fileCount,
    totalSize: module.totalSize,
    complexity: module.complexity,
    doors: [],
    decorations: [],
  };
}

/**
 * Create an entrance room
 */
function createEntranceRoom(
  leaf: BSPNode,
  rng: SeededRNG,
  options: BSPOptions
): RoomData | null {
  const { bounds } = leaf;
  const { roomMargin, minRoomSize } = options;

  const availableWidth = bounds.width - roomMargin * 2;
  const availableHeight = bounds.height - roomMargin * 2;

  if (availableWidth < minRoomSize || availableHeight < minRoomSize) {
    return null;
  }

  // Entrance is medium-sized
  const roomWidth = Math.min(availableWidth, minRoomSize + 4);
  const roomHeight = Math.min(availableHeight, minRoomSize + 4);

  // Center the entrance
  const roomX = bounds.x + roomMargin + Math.floor((availableWidth - roomWidth) / 2);
  const roomY = bounds.y + roomMargin + Math.floor((availableHeight - roomHeight) / 2);

  const roomBounds = {
    x: roomX,
    y: roomY,
    width: roomWidth,
    height: roomHeight,
  };

  const center: Point = {
    x: roomX + roomWidth / 2,
    y: roomY + roomHeight / 2,
  };

  return {
    id: generateRoomId(),
    name: 'Entrance',
    bounds: roomBounds,
    center,
    roomType: 'entrance',
    doors: [],
    decorations: [],
  };
}

/**
 * Get all rooms from a BSP tree
 */
export function getRoomsFromBSP(root: BSPNode): RoomData[] {
  const rooms: RoomData[] = [];

  function traverse(node: BSPNode): void {
    if (node.room) {
      rooms.push(node.room);
    }
    if (node.left) traverse(node.left);
    if (node.right) traverse(node.right);
  }

  traverse(root);
  return rooms;
}

/**
 * Find room by ID
 */
export function findRoomById(rooms: RoomData[], id: string): RoomData | undefined {
  return rooms.find((r) => r.id === id);
}

/**
 * Get room at position
 */
export function getRoomAtPosition(rooms: RoomData[], x: number, y: number): RoomData | undefined {
  return rooms.find((room) => {
    const { bounds } = room;
    return (
      x >= bounds.x &&
      x < bounds.x + bounds.width &&
      y >= bounds.y &&
      y < bounds.y + bounds.height
    );
  });
}

/**
 * Calculate distance between two rooms (center to center)
 */
export function roomDistance(a: RoomData, b: RoomData): number {
  const dx = a.center.x - b.center.x;
  const dy = a.center.y - b.center.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find nearest room to a given room
 */
export function findNearestRoom(
  room: RoomData,
  rooms: RoomData[]
): RoomData | undefined {
  let nearest: RoomData | undefined;
  let minDistance = Infinity;

  for (const other of rooms) {
    if (other.id === room.id) continue;

    const dist = roomDistance(room, other);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = other;
    }
  }

  return nearest;
}

export default placeRoomsInBSP;
