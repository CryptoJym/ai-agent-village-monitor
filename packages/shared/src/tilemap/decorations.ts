/**
 * Decoration Placement System
 *
 * Handles placement of furniture and decorative elements in rooms.
 * Each room type has its own decoration catalog with placement rules.
 */

import {
  Room,
  Decoration,
  DecorationCatalog,
  DecorationItem,
  PlacementRule,
  RoomType,
  SeededRNG,
  Rectangle,
} from './types';

/**
 * Default decoration catalogs for each room type
 */
export const DEFAULT_DECORATION_CATALOGS: Record<RoomType, DecorationCatalog> = {
  workspace: {
    roomType: 'workspace',
    items: [
      {
        id: 'desk',
        name: 'Desk',
        tileId: 100,
        placement: 'against-wall',
        blocksMovement: true,
        size: { width: 2, height: 1 },
        probability: 0.8,
        minRoomSize: 16,
      },
      {
        id: 'monitor',
        name: 'Monitor',
        tileId: 102,
        placement: 'against-wall',
        blocksMovement: false,
        size: { width: 1, height: 1 },
        probability: 0.6,
        minRoomSize: 16,
      },
      {
        id: 'keyboard',
        name: 'Keyboard',
        tileId: 103,
        placement: 'against-wall',
        blocksMovement: false,
        size: { width: 1, height: 1 },
        probability: 0.5,
      },
      {
        id: 'chair',
        name: 'Office Chair',
        tileId: 104,
        placement: 'scattered',
        blocksMovement: true,
        size: { width: 1, height: 1 },
        probability: 0.7,
      },
    ],
  },
  library: {
    roomType: 'library',
    items: [
      {
        id: 'bookshelf',
        name: 'Bookshelf',
        tileId: 110,
        placement: 'against-wall',
        blocksMovement: true,
        size: { width: 2, height: 1 },
        probability: 0.9,
        minRoomSize: 20,
      },
      {
        id: 'reading-table',
        name: 'Reading Table',
        tileId: 112,
        placement: 'centered',
        blocksMovement: true,
        size: { width: 2, height: 2 },
        probability: 0.6,
        minRoomSize: 32,
      },
      {
        id: 'book-stack',
        name: 'Stack of Books',
        tileId: 114,
        placement: 'scattered',
        blocksMovement: false,
        size: { width: 1, height: 1 },
        probability: 0.4,
      },
    ],
  },
  vault: {
    roomType: 'vault',
    items: [
      {
        id: 'safe',
        name: 'Safe',
        tileId: 120,
        placement: 'against-wall',
        blocksMovement: true,
        size: { width: 2, height: 2 },
        probability: 0.9,
        minRoomSize: 24,
      },
      {
        id: 'filing-cabinet',
        name: 'Filing Cabinet',
        tileId: 122,
        placement: 'against-wall',
        blocksMovement: true,
        size: { width: 1, height: 1 },
        probability: 0.7,
        minRoomSize: 16,
      },
      {
        id: 'security-console',
        name: 'Security Console',
        tileId: 124,
        placement: 'corner',
        blocksMovement: true,
        size: { width: 2, height: 1 },
        probability: 0.5,
        minRoomSize: 20,
      },
    ],
  },
  laboratory: {
    roomType: 'laboratory',
    items: [
      {
        id: 'lab-table',
        name: 'Laboratory Table',
        tileId: 130,
        placement: 'centered',
        blocksMovement: true,
        size: { width: 3, height: 1 },
        probability: 0.8,
        minRoomSize: 32,
      },
      {
        id: 'equipment-rack',
        name: 'Equipment Rack',
        tileId: 133,
        placement: 'against-wall',
        blocksMovement: true,
        size: { width: 2, height: 1 },
        probability: 0.7,
        minRoomSize: 20,
      },
      {
        id: 'test-tubes',
        name: 'Test Tubes',
        tileId: 135,
        placement: 'scattered',
        blocksMovement: false,
        size: { width: 1, height: 1 },
        probability: 0.5,
      },
    ],
  },
  hallway: {
    roomType: 'hallway',
    items: [
      {
        id: 'plant',
        name: 'Potted Plant',
        tileId: 140,
        placement: 'corner',
        blocksMovement: true,
        size: { width: 1, height: 1 },
        probability: 0.3,
      },
    ],
  },
  entrance: {
    roomType: 'entrance',
    items: [
      {
        id: 'reception-desk',
        name: 'Reception Desk',
        tileId: 150,
        placement: 'centered',
        blocksMovement: true,
        size: { width: 3, height: 2 },
        probability: 0.9,
        minRoomSize: 40,
      },
      {
        id: 'waiting-chair',
        name: 'Waiting Chair',
        tileId: 153,
        placement: 'against-wall',
        blocksMovement: true,
        size: { width: 1, height: 1 },
        probability: 0.6,
      },
    ],
  },
};

/**
 * Check if a decoration can be placed at a position without overlapping
 *
 * @param position - Proposed position
 * @param size - Decoration size
 * @param occupiedGrid - Grid of occupied positions
 * @param wallGrid - Grid of wall positions
 * @param roomBounds - Room boundaries
 * @returns True if placement is valid
 */
export function canPlaceDecoration(
  position: { x: number; y: number },
  size: { width: number; height: number },
  occupiedGrid: boolean[][],
  wallGrid: boolean[][],
  roomBounds: Rectangle,
): boolean {
  const { x, y } = position;
  const { width, height } = size;
  const gridHeight = occupiedGrid.length;
  const gridWidth = occupiedGrid[0]?.length ?? 0;

  // Check bounds
  if (
    x < roomBounds.x + 1 ||
    y < roomBounds.y + 1 ||
    x + width > roomBounds.x + roomBounds.width - 1 ||
    y + height > roomBounds.y + roomBounds.height - 1
  ) {
    return false;
  }

  // Check for overlaps with occupied spaces or walls
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const checkX = x + dx;
      const checkY = y + dy;

      if (checkX < 0 || checkX >= gridWidth || checkY < 0 || checkY >= gridHeight) {
        return false;
      }

      if (occupiedGrid[checkY][checkX] || wallGrid[checkY][checkX]) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Mark a decoration's space as occupied
 *
 * @param position - Decoration position
 * @param size - Decoration size
 * @param occupiedGrid - Grid to mark (modified in place)
 */
function markOccupied(
  position: { x: number; y: number },
  size: { width: number; height: number },
  occupiedGrid: boolean[][],
): void {
  const { x, y } = position;
  const { width, height } = size;

  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const markX = x + dx;
      const markY = y + dy;

      if (
        markY >= 0 &&
        markY < occupiedGrid.length &&
        markX >= 0 &&
        markX < occupiedGrid[0].length
      ) {
        occupiedGrid[markY][markX] = true;
      }
    }
  }
}

/**
 * Find valid positions for a decoration based on placement rule
 *
 * @param item - Decoration item to place
 * @param room - Room to place decoration in
 * @param occupiedGrid - Grid of occupied positions
 * @param wallGrid - Grid of wall positions
 * @param rng - Random number generator
 * @returns Array of valid positions
 */
function findValidPositions(
  item: DecorationItem,
  room: Room,
  occupiedGrid: boolean[][],
  wallGrid: boolean[][],
  rng: SeededRNG,
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const { x, y, width, height } = room.bounds;

  switch (item.placement) {
    case 'against-wall':
      // Find positions adjacent to walls
      // Top wall
      for (let rx = x + 1; rx < x + width - 1 - item.size.width; rx++) {
        const pos = { x: rx, y: y + 1 };
        if (canPlaceDecoration(pos, item.size, occupiedGrid, wallGrid, room.bounds)) {
          positions.push(pos);
        }
      }
      // Bottom wall
      for (let rx = x + 1; rx < x + width - 1 - item.size.width; rx++) {
        const pos = { x: rx, y: y + height - 1 - item.size.height };
        if (canPlaceDecoration(pos, item.size, occupiedGrid, wallGrid, room.bounds)) {
          positions.push(pos);
        }
      }
      // Left wall
      for (let ry = y + 1; ry < y + height - 1 - item.size.height; ry++) {
        const pos = { x: x + 1, y: ry };
        if (canPlaceDecoration(pos, item.size, occupiedGrid, wallGrid, room.bounds)) {
          positions.push(pos);
        }
      }
      // Right wall
      for (let ry = y + 1; ry < y + height - 1 - item.size.height; ry++) {
        const pos = { x: x + width - 1 - item.size.width, y: ry };
        if (canPlaceDecoration(pos, item.size, occupiedGrid, wallGrid, room.bounds)) {
          positions.push(pos);
        }
      }
      break;

    case 'centered':
      // Place in center of room
      {
        const centerX = Math.floor(x + (width - item.size.width) / 2);
        const centerY = Math.floor(y + (height - item.size.height) / 2);
        const centerPos = { x: centerX, y: centerY };

        if (canPlaceDecoration(centerPos, item.size, occupiedGrid, wallGrid, room.bounds)) {
          positions.push(centerPos);
        }
      }
      break;

    case 'corner':
      // Try all four corners
      {
        const corners = [
          { x: x + 1, y: y + 1 }, // Top-left
          { x: x + width - 1 - item.size.width, y: y + 1 }, // Top-right
          { x: x + 1, y: y + height - 1 - item.size.height }, // Bottom-left
          { x: x + width - 1 - item.size.width, y: y + height - 1 - item.size.height }, // Bottom-right
        ];

        for (const corner of corners) {
          if (canPlaceDecoration(corner, item.size, occupiedGrid, wallGrid, room.bounds)) {
            positions.push(corner);
          }
        }
      }
      break;

    case 'scattered':
      // Try random positions throughout the room
      for (let ry = y + 1; ry < y + height - 1 - item.size.height; ry++) {
        for (let rx = x + 1; rx < x + width - 1 - item.size.width; rx++) {
          const pos = { x: rx, y: ry };
          if (canPlaceDecoration(pos, item.size, occupiedGrid, wallGrid, room.bounds)) {
            positions.push(pos);
          }
        }
      }
      break;
  }

  return positions;
}

/**
 * Place decorations in a room
 *
 * @param room - Room to decorate
 * @param catalog - Decoration catalog for this room type
 * @param occupiedGrid - Grid of occupied positions (modified in place)
 * @param wallGrid - Grid of wall positions
 * @param rng - Random number generator
 * @param density - Decoration density multiplier (0-1)
 * @returns Array of placed decorations
 */
export function placeRoomDecorations(
  room: Room,
  catalog: DecorationCatalog,
  occupiedGrid: boolean[][],
  wallGrid: boolean[][],
  rng: SeededRNG,
  density: number = 1.0,
): Decoration[] {
  const decorations: Decoration[] = [];
  const roomArea = room.bounds.width * room.bounds.height;

  // Shuffle items to randomize placement order
  const items = rng.shuffle([...catalog.items]);

  for (const item of items) {
    // Check room size requirement
    if (item.minRoomSize && roomArea < item.minRoomSize) {
      continue;
    }

    // Check probability (scaled by density)
    if (rng.random() > item.probability * density) {
      continue;
    }

    // Find valid positions
    const validPositions = findValidPositions(item, room, occupiedGrid, wallGrid, rng);

    if (validPositions.length === 0) {
      continue;
    }

    // Pick a random valid position
    const position = rng.pick(validPositions);

    // Select tile ID (handle arrays)
    const tileId = Array.isArray(item.tileId) ? rng.pick(item.tileId) : item.tileId;

    // Create decoration
    const decoration: Decoration = {
      tileId,
      position,
      blocksMovement: item.blocksMovement,
      dimensions: item.size.width > 1 || item.size.height > 1 ? item.size : undefined,
    };

    decorations.push(decoration);

    // Mark space as occupied
    markOccupied(position, item.size, occupiedGrid);
  }

  return decorations;
}

/**
 * Generate decorations for all rooms
 *
 * @param rooms - All rooms in the map
 * @param wallGrid - Grid of wall positions
 * @param width - Map width in tiles
 * @param height - Map height in tiles
 * @param rng - Random number generator
 * @param options - Decoration options
 * @returns Array of all decorations
 */
export function generateDecorations(
  rooms: Room[],
  wallGrid: boolean[][],
  width: number,
  height: number,
  rng: SeededRNG,
  options: {
    catalogs?: Partial<Record<RoomType, DecorationCatalog>>;
    density?: number;
  } = {},
): Decoration[] {
  const allDecorations: Decoration[] = [];
  const occupiedGrid: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));

  // Initialize occupied grid with walls
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      occupiedGrid[y][x] = wallGrid[y][x];
    }
  }

  const density = options.density ?? 1.0;

  for (const room of rooms) {
    // Get catalog for this room type
    const catalog = options.catalogs?.[room.type] ?? DEFAULT_DECORATION_CATALOGS[room.type];

    if (!catalog) {
      continue;
    }

    const roomDecorations = placeRoomDecorations(
      room,
      catalog,
      occupiedGrid,
      wallGrid,
      rng,
      density,
    );

    allDecorations.push(...roomDecorations);
  }

  return allDecorations;
}

/**
 * Convert decorations to a tilemap layer
 *
 * @param decorations - Array of decorations
 * @param width - Map width in tiles
 * @param height - Map height in tiles
 * @returns Flat array of decoration tile IDs
 */
export function generateDecorationLayer(
  decorations: Decoration[],
  width: number,
  height: number,
): number[] {
  const decorationData = new Array(width * height).fill(0);

  for (const decoration of decorations) {
    const { x, y } = decoration.position;
    const dims = decoration.dimensions ?? { width: 1, height: 1 };

    // Place decoration tiles
    for (let dy = 0; dy < dims.height; dy++) {
      for (let dx = 0; dx < dims.width; dx++) {
        const tileX = x + dx;
        const tileY = y + dy;

        if (tileX >= 0 && tileX < width && tileY >= 0 && tileY < height) {
          const index = tileY * width + tileX;
          // For multi-tile decorations, adjust tile ID based on position
          const tileOffset = dy * dims.width + dx;
          decorationData[index] = decoration.tileId + tileOffset;
        }
      }
    }
  }

  return decorationData;
}

/**
 * Update collision data with decorations
 *
 * @param decorations - Array of decorations
 * @param collision - Collision array to update (modified in place)
 * @param width - Map width in tiles
 */
export function addDecorationCollision(
  decorations: Decoration[],
  collision: boolean[],
  width: number,
): void {
  for (const decoration of decorations) {
    if (!decoration.blocksMovement) {
      continue;
    }

    const { x, y } = decoration.position;
    const dims = decoration.dimensions ?? { width: 1, height: 1 };

    for (let dy = 0; dy < dims.height; dy++) {
      for (let dx = 0; dx < dims.width; dx++) {
        const index = (y + dy) * width + (x + dx);
        if (index >= 0 && index < collision.length) {
          collision[index] = true;
        }
      }
    }
  }
}
