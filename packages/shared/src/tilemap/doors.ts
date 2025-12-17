/**
 * Door Placement System
 *
 * Handles placement of doors between rooms and corridors.
 * Doors create openings in walls and provide interaction zones.
 */

import { Room, Corridor, Direction, TileMapping, Rectangle } from './types';

/**
 * A placed door in the map
 */
export interface Door {
  /** Door position in tiles */
  position: { x: number; y: number };
  /** Direction the door faces */
  direction: Direction;
  /** Door tile ID */
  tileId: number;
  /** Whether the door is open */
  isOpen: boolean;
  /** Interaction zone bounds */
  interactionZone?: Rectangle;
  /** Rooms this door connects (if applicable) */
  connects?: [string, string];
}

/**
 * Find potential door positions between a room and corridor
 *
 * @param room - Room to connect
 * @param corridor - Corridor to connect to
 * @returns Array of potential door positions with directions
 */
export function findDoorPositions(
  room: Room,
  corridor: Corridor,
): Array<{ x: number; y: number; direction: Direction }> {
  const positions: Array<{ x: number; y: number; direction: Direction }> = [];
  const { x, y, width, height } = room.bounds;

  // Check if corridor intersects with room boundaries

  // Top wall (North doors)
  if (
    corridor.start.y <= y &&
    corridor.end.y <= y &&
    Math.max(corridor.start.x, corridor.end.x) >= x &&
    Math.min(corridor.start.x, corridor.end.x) < x + width
  ) {
    const doorX = Math.max(
      x + 1,
      Math.min(
        x + width - 2,
        Math.floor(
          (Math.max(corridor.start.x, corridor.end.x) +
            Math.min(corridor.start.x, corridor.end.x)) /
            2,
        ),
      ),
    );
    positions.push({ x: doorX, y, direction: Direction.North });
  }

  // Bottom wall (South doors)
  if (
    corridor.start.y >= y + height - 1 &&
    corridor.end.y >= y + height - 1 &&
    Math.max(corridor.start.x, corridor.end.x) >= x &&
    Math.min(corridor.start.x, corridor.end.x) < x + width
  ) {
    const doorX = Math.max(
      x + 1,
      Math.min(
        x + width - 2,
        Math.floor(
          (Math.max(corridor.start.x, corridor.end.x) +
            Math.min(corridor.start.x, corridor.end.x)) /
            2,
        ),
      ),
    );
    positions.push({ x: doorX, y: y + height - 1, direction: Direction.South });
  }

  // Left wall (West doors)
  if (
    corridor.start.x <= x &&
    corridor.end.x <= x &&
    Math.max(corridor.start.y, corridor.end.y) >= y &&
    Math.min(corridor.start.y, corridor.end.y) < y + height
  ) {
    const doorY = Math.max(
      y + 1,
      Math.min(
        y + height - 2,
        Math.floor(
          (Math.max(corridor.start.y, corridor.end.y) +
            Math.min(corridor.start.y, corridor.end.y)) /
            2,
        ),
      ),
    );
    positions.push({ x, y: doorY, direction: Direction.West });
  }

  // Right wall (East doors)
  if (
    corridor.start.x >= x + width - 1 &&
    corridor.end.x >= x + width - 1 &&
    Math.max(corridor.start.y, corridor.end.y) >= y &&
    Math.min(corridor.start.y, corridor.end.y) < y + height
  ) {
    const doorY = Math.max(
      y + 1,
      Math.min(
        y + height - 2,
        Math.floor(
          (Math.max(corridor.start.y, corridor.end.y) +
            Math.min(corridor.start.y, corridor.end.y)) /
            2,
        ),
      ),
    );
    positions.push({ x: x + width - 1, y: doorY, direction: Direction.East });
  }

  return positions;
}

/**
 * Find door positions between two adjacent rooms
 *
 * @param room1 - First room
 * @param room2 - Second room
 * @returns Door position and direction if rooms are adjacent, null otherwise
 */
export function findRoomDoorPosition(
  room1: Room,
  room2: Room,
): { x: number; y: number; direction: Direction } | null {
  const r1 = room1.bounds;
  const r2 = room2.bounds;

  // Check if rooms share a wall (adjacent)

  // Room 2 is to the right of room 1
  if (r1.x + r1.width === r2.x && overlap1D(r1.y, r1.height, r2.y, r2.height)) {
    const overlapStart = Math.max(r1.y, r2.y);
    const overlapEnd = Math.min(r1.y + r1.height, r2.y + r2.height);
    const doorY = Math.floor((overlapStart + overlapEnd) / 2);

    return { x: r1.x + r1.width - 1, y: doorY, direction: Direction.East };
  }

  // Room 2 is to the left of room 1
  if (r2.x + r2.width === r1.x && overlap1D(r1.y, r1.height, r2.y, r2.height)) {
    const overlapStart = Math.max(r1.y, r2.y);
    const overlapEnd = Math.min(r1.y + r1.height, r2.y + r2.height);
    const doorY = Math.floor((overlapStart + overlapEnd) / 2);

    return { x: r1.x, y: doorY, direction: Direction.West };
  }

  // Room 2 is below room 1
  if (r1.y + r1.height === r2.y && overlap1D(r1.x, r1.width, r2.x, r2.width)) {
    const overlapStart = Math.max(r1.x, r2.x);
    const overlapEnd = Math.min(r1.x + r1.width, r2.x + r2.width);
    const doorX = Math.floor((overlapStart + overlapEnd) / 2);

    return { x: doorX, y: r1.y + r1.height - 1, direction: Direction.South };
  }

  // Room 2 is above room 1
  if (r2.y + r2.height === r1.y && overlap1D(r1.x, r1.width, r2.x, r2.width)) {
    const overlapStart = Math.max(r1.x, r2.x);
    const overlapEnd = Math.min(r1.x + r1.width, r2.x + r2.width);
    const doorX = Math.floor((overlapStart + overlapEnd) / 2);

    return { x: doorX, y: r1.y, direction: Direction.North };
  }

  return null;
}

/**
 * Check if two 1D ranges overlap
 */
function overlap1D(start1: number, length1: number, start2: number, length2: number): boolean {
  return start1 < start2 + length2 && start2 < start1 + length1;
}

/**
 * Place door tiles in the tilemap
 *
 * @param doors - Array of doors to place
 * @param doorData - Flat array of tile IDs for door layer (modified in place)
 * @param width - Map width in tiles
 * @param height - Map height in tiles
 * @param mapping - Tile mapping configuration
 */
export function placeDoorTiles(
  doors: Door[],
  doorData: number[],
  width: number,
  height: number,
  _mapping: TileMapping,
): void {
  for (const door of doors) {
    const { x, y } = door.position;

    if (x >= 0 && x < width && y >= 0 && y < height) {
      const index = y * width + x;
      doorData[index] = door.tileId;
    }
  }
}

/**
 * Create a door object from a position
 *
 * @param position - Door position
 * @param direction - Door direction
 * @param mapping - Tile mapping configuration
 * @param isOpen - Whether door starts open
 * @param connects - Optional room connection info
 * @returns Door object
 */
export function createDoor(
  position: { x: number; y: number },
  direction: Direction,
  mapping: TileMapping,
  isOpen: boolean = false,
  connects?: [string, string],
): Door {
  // Get tile ID based on direction
  let tileId: number;
  switch (direction) {
    case Direction.North:
      tileId = mapping.doorTiles.north;
      break;
    case Direction.South:
      tileId = mapping.doorTiles.south;
      break;
    case Direction.East:
      tileId = mapping.doorTiles.east;
      break;
    case Direction.West:
      tileId = mapping.doorTiles.west;
      break;
    default:
      tileId = mapping.doorTiles.north;
  }

  // Create interaction zone (3x3 area around door)
  const interactionZone: Rectangle = {
    x: position.x - 1,
    y: position.y - 1,
    width: 3,
    height: 3,
  };

  return {
    position,
    direction,
    tileId,
    isOpen,
    interactionZone,
    connects,
  };
}

/**
 * Generate all doors for rooms and corridors
 *
 * @param rooms - All rooms in the map
 * @param corridors - All corridors in the map
 * @param mapping - Tile mapping configuration
 * @returns Array of all doors
 */
export function generateDoors(rooms: Room[], corridors: Corridor[], mapping: TileMapping): Door[] {
  const doors: Door[] = [];

  // Find doors between rooms and corridors
  for (const room of rooms) {
    for (const corridor of corridors) {
      const positions = findDoorPositions(room, corridor);

      for (const pos of positions) {
        const door = createDoor({ x: pos.x, y: pos.y }, pos.direction, mapping, false);
        doors.push(door);
      }
    }
  }

  // Find doors between adjacent rooms
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const pos = findRoomDoorPosition(rooms[i], rooms[j]);
      if (pos) {
        const door = createDoor({ x: pos.x, y: pos.y }, pos.direction, mapping, false, [
          rooms[i].id,
          rooms[j].id,
        ]);
        doors.push(door);
      }
    }
  }

  return doors;
}

/**
 * Generate door layer for the tilemap
 *
 * @param doors - Array of doors
 * @param width - Map width in tiles
 * @param height - Map height in tiles
 * @param mapping - Tile mapping configuration
 * @returns Flat array of door tile IDs
 */
export function generateDoorLayer(
  doors: Door[],
  width: number,
  height: number,
  mapping: TileMapping,
): number[] {
  const doorData = new Array(width * height).fill(0);
  placeDoorTiles(doors, doorData, width, height, mapping);
  return doorData;
}

/**
 * Check if a position is within a door's interaction zone
 *
 * @param position - Position to check
 * @param door - Door to check against
 * @returns True if position is in interaction zone
 */
export function isInInteractionZone(position: { x: number; y: number }, door: Door): boolean {
  if (!door.interactionZone) {
    return false;
  }

  const { x, y, width, height } = door.interactionZone;
  return position.x >= x && position.x < x + width && position.y >= y && position.y < y + height;
}

/**
 * Update door tile based on open/closed state
 * Assumes open tiles are +1 offset from closed tiles
 *
 * @param door - Door to update
 * @param isOpen - New open state
 * @returns Updated tile ID
 */
export function getDoorTileForState(door: Door, isOpen: boolean): number {
  // Simple implementation: closed tile, open tile is +1
  return door.tileId + (isOpen ? 1 : 0);
}

/**
 * Create door frame decorations around a door
 * Returns positions for decorative frame tiles
 *
 * @param door - Door to frame
 * @returns Array of frame tile positions and IDs
 */
export function createDoorFrame(door: Door): Array<{ x: number; y: number; tileId: number }> {
  const frames: Array<{ x: number; y: number; tileId: number }> = [];
  const { x, y } = door.position;

  // Frame tile ID (arbitrary, would be in mapping)
  const frameTileId = 64;

  switch (door.direction) {
    case Direction.North:
    case Direction.South:
      // Vertical door - frames on left and right
      frames.push({ x: x - 1, y, tileId: frameTileId });
      frames.push({ x: x + 1, y, tileId: frameTileId });
      break;

    case Direction.East:
    case Direction.West:
      // Horizontal door - frames on top and bottom
      frames.push({ x, y: y - 1, tileId: frameTileId });
      frames.push({ x, y: y + 1, tileId: frameTileId });
      break;
  }

  return frames;
}
