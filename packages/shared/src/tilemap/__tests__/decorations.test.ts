/**
 * Decoration System Tests
 *
 * Comprehensive tests for the room-type specific decoration system.
 * Tests decoration catalogs, placement rules, collision detection, and integration.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DECORATION_CATALOGS,
  canPlaceDecoration,
  placeRoomDecorations,
  generateDecorations,
  generateDecorationLayer,
  addDecorationCollision,
} from '../decorations';
import { createSeededRNG } from '../generator';
import { Room, RoomType, Decoration, DecorationCatalog, DecorationItem, Rectangle } from '../types';

// ===== Test Fixtures =====

/**
 * Create a test room with specified parameters
 */
function createTestRoom(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  type: RoomType = 'workspace',
): Room {
  return {
    id,
    bounds: { x, y, width, height },
    type,
    center: { x: x + Math.floor(width / 2), y: y + Math.floor(height / 2) },
  };
}

/**
 * Create a simple grid filled with false (no walls)
 */
function createEmptyGrid(width: number, height: number): boolean[][] {
  return Array.from({ length: height }, () => Array(width).fill(false));
}

/**
 * Create a grid with walls around the perimeter
 */
function createWalledGrid(width: number, height: number): boolean[][] {
  const grid = createEmptyGrid(width, height);

  // Top and bottom walls
  for (let x = 0; x < width; x++) {
    grid[0][x] = true;
    grid[height - 1][x] = true;
  }

  // Left and right walls
  for (let y = 0; y < height; y++) {
    grid[y][0] = true;
    grid[y][width - 1] = true;
  }

  return grid;
}

/**
 * Create a custom decoration item for testing
 */
function createTestDecorationItem(
  id: string,
  placement: 'against-wall' | 'centered' | 'corner' | 'scattered',
  size: { width: number; height: number },
  probability: number = 1.0,
): DecorationItem {
  return {
    id,
    name: `Test ${id}`,
    tileId: 100,
    placement,
    blocksMovement: true,
    size,
    probability,
  };
}

// ===== Decoration Catalog Tests =====

describe('DEFAULT_DECORATION_CATALOGS', () => {
  const roomTypes: RoomType[] = [
    'workspace',
    'library',
    'vault',
    'laboratory',
    'hallway',
    'entrance',
  ];

  it('should have catalogs for all room types', () => {
    for (const roomType of roomTypes) {
      expect(DEFAULT_DECORATION_CATALOGS[roomType]).toBeDefined();
      expect(DEFAULT_DECORATION_CATALOGS[roomType].roomType).toBe(roomType);
    }
  });

  it('workspace catalog should have appropriate decorations', () => {
    const catalog = DEFAULT_DECORATION_CATALOGS.workspace;

    expect(catalog.items.length).toBeGreaterThan(0);

    const itemIds = catalog.items.map((item) => item.id);
    expect(itemIds).toContain('desk');
    expect(itemIds).toContain('monitor');
    expect(itemIds).toContain('keyboard');
    expect(itemIds).toContain('chair');
  });

  it('library catalog should have appropriate decorations', () => {
    const catalog = DEFAULT_DECORATION_CATALOGS.library;

    expect(catalog.items.length).toBeGreaterThan(0);

    const itemIds = catalog.items.map((item) => item.id);
    expect(itemIds).toContain('bookshelf');
    expect(itemIds).toContain('reading-table');
    expect(itemIds).toContain('book-stack');
  });

  it('vault catalog should have appropriate decorations', () => {
    const catalog = DEFAULT_DECORATION_CATALOGS.vault;

    expect(catalog.items.length).toBeGreaterThan(0);

    const itemIds = catalog.items.map((item) => item.id);
    expect(itemIds).toContain('safe');
    expect(itemIds).toContain('filing-cabinet');
    expect(itemIds).toContain('security-console');
  });

  it('laboratory catalog should have appropriate decorations', () => {
    const catalog = DEFAULT_DECORATION_CATALOGS.laboratory;

    expect(catalog.items.length).toBeGreaterThan(0);

    const itemIds = catalog.items.map((item) => item.id);
    expect(itemIds).toContain('lab-table');
    expect(itemIds).toContain('equipment-rack');
    expect(itemIds).toContain('test-tubes');
  });

  it('hallway catalog should have appropriate decorations', () => {
    const catalog = DEFAULT_DECORATION_CATALOGS.hallway;

    expect(catalog.items.length).toBeGreaterThan(0);

    const itemIds = catalog.items.map((item) => item.id);
    expect(itemIds).toContain('plant');
  });

  it('entrance catalog should have appropriate decorations', () => {
    const catalog = DEFAULT_DECORATION_CATALOGS.entrance;

    expect(catalog.items.length).toBeGreaterThan(0);

    const itemIds = catalog.items.map((item) => item.id);
    expect(itemIds).toContain('reception-desk');
    expect(itemIds).toContain('waiting-chair');
  });

  it('all decorations should have valid properties', () => {
    for (const roomType of roomTypes) {
      const catalog = DEFAULT_DECORATION_CATALOGS[roomType];

      for (const item of catalog.items) {
        // Required properties
        expect(item.id).toBeTruthy();
        expect(item.name).toBeTruthy();
        expect(item.placement).toMatch(/^(against-wall|centered|corner|scattered)$/);
        expect(typeof item.blocksMovement).toBe('boolean');

        // Size validation
        expect(item.size.width).toBeGreaterThan(0);
        expect(item.size.height).toBeGreaterThan(0);

        // Probability validation
        expect(item.probability).toBeGreaterThanOrEqual(0);
        expect(item.probability).toBeLessThanOrEqual(1);

        // Tile ID validation
        if (Array.isArray(item.tileId)) {
          expect(item.tileId.length).toBeGreaterThan(0);
          item.tileId.forEach((id) => {
            expect(typeof id).toBe('number');
          });
        } else {
          expect(typeof item.tileId).toBe('number');
        }

        // Min room size validation (if specified)
        if (item.minRoomSize !== undefined) {
          expect(item.minRoomSize).toBeGreaterThan(0);
        }
      }
    }
  });

  it('against-wall decorations should have appropriate properties', () => {
    const allItems = Object.values(DEFAULT_DECORATION_CATALOGS).flatMap((catalog) => catalog.items);

    const wallItems = allItems.filter((item) => item.placement === 'against-wall');

    expect(wallItems.length).toBeGreaterThan(0);

    // Wall items are typically furniture that makes sense against walls
    // Valid IDs include desk, monitor, keyboard, bookshelf, safe, filing-cabinet,
    // security-console, equipment-rack, reception-desk, waiting-chair
    const validIds = [
      'desk',
      'monitor',
      'keyboard',
      'bookshelf',
      'safe',
      'filing-cabinet',
      'security-console',
      'equipment-rack',
      'reception-desk',
      'waiting-chair',
    ];

    wallItems.forEach((item) => {
      const isValid = validIds.some((validId) => item.id.includes(validId));
      expect(isValid).toBeTruthy();
    });
  });

  it('centered decorations should be larger items', () => {
    const allItems = Object.values(DEFAULT_DECORATION_CATALOGS).flatMap((catalog) => catalog.items);

    const centeredItems = allItems.filter((item) => item.placement === 'centered');

    expect(centeredItems.length).toBeGreaterThan(0);

    // Centered items should typically be larger (2+ tiles in at least one dimension)
    centeredItems.forEach((item) => {
      expect(item.size.width >= 2 || item.size.height >= 2).toBeTruthy();
    });
  });
});

// ===== Placement Validation Tests =====

describe('canPlaceDecoration', () => {
  it('should allow placement in empty space', () => {
    const occupiedGrid = createEmptyGrid(10, 10);
    const wallGrid = createEmptyGrid(10, 10);
    const roomBounds: Rectangle = { x: 0, y: 0, width: 10, height: 10 };

    const result = canPlaceDecoration(
      { x: 5, y: 5 },
      { width: 1, height: 1 },
      occupiedGrid,
      wallGrid,
      roomBounds,
    );

    expect(result).toBe(true);
  });

  it('should reject placement on occupied space', () => {
    const occupiedGrid = createEmptyGrid(10, 10);
    occupiedGrid[5][5] = true;
    const wallGrid = createEmptyGrid(10, 10);
    const roomBounds: Rectangle = { x: 0, y: 0, width: 10, height: 10 };

    const result = canPlaceDecoration(
      { x: 5, y: 5 },
      { width: 1, height: 1 },
      occupiedGrid,
      wallGrid,
      roomBounds,
    );

    expect(result).toBe(false);
  });

  it('should reject placement on walls', () => {
    const occupiedGrid = createEmptyGrid(10, 10);
    const wallGrid = createEmptyGrid(10, 10);
    wallGrid[5][5] = true;
    const roomBounds: Rectangle = { x: 0, y: 0, width: 10, height: 10 };

    const result = canPlaceDecoration(
      { x: 5, y: 5 },
      { width: 1, height: 1 },
      occupiedGrid,
      wallGrid,
      roomBounds,
    );

    expect(result).toBe(false);
  });

  it('should reject placement outside room bounds', () => {
    const occupiedGrid = createEmptyGrid(10, 10);
    const wallGrid = createEmptyGrid(10, 10);
    const roomBounds: Rectangle = { x: 2, y: 2, width: 6, height: 6 };

    // Too far left
    expect(
      canPlaceDecoration(
        { x: 1, y: 3 },
        { width: 1, height: 1 },
        occupiedGrid,
        wallGrid,
        roomBounds,
      ),
    ).toBe(false);

    // Too far up
    expect(
      canPlaceDecoration(
        { x: 3, y: 1 },
        { width: 1, height: 1 },
        occupiedGrid,
        wallGrid,
        roomBounds,
      ),
    ).toBe(false);

    // Too far right
    expect(
      canPlaceDecoration(
        { x: 8, y: 3 },
        { width: 1, height: 1 },
        occupiedGrid,
        wallGrid,
        roomBounds,
      ),
    ).toBe(false);

    // Too far down
    expect(
      canPlaceDecoration(
        { x: 3, y: 8 },
        { width: 1, height: 1 },
        occupiedGrid,
        wallGrid,
        roomBounds,
      ),
    ).toBe(false);
  });

  it('should validate multi-tile decorations', () => {
    const occupiedGrid = createEmptyGrid(10, 10);
    const wallGrid = createEmptyGrid(10, 10);
    const roomBounds: Rectangle = { x: 0, y: 0, width: 10, height: 10 };

    // Should fit
    expect(
      canPlaceDecoration(
        { x: 4, y: 4 },
        { width: 2, height: 2 },
        occupiedGrid,
        wallGrid,
        roomBounds,
      ),
    ).toBe(true);

    // Mark one tile as occupied
    occupiedGrid[5][5] = true;

    // Should not fit anymore
    expect(
      canPlaceDecoration(
        { x: 4, y: 4 },
        { width: 2, height: 2 },
        occupiedGrid,
        wallGrid,
        roomBounds,
      ),
    ).toBe(false);
  });

  it('should check all tiles for multi-tile decorations', () => {
    const occupiedGrid = createEmptyGrid(10, 10);
    const wallGrid = createEmptyGrid(10, 10);
    const roomBounds: Rectangle = { x: 0, y: 0, width: 10, height: 10 };

    // Block bottom-right corner of a 3x2 decoration
    occupiedGrid[6][7] = true;

    const result = canPlaceDecoration(
      { x: 5, y: 5 },
      { width: 3, height: 2 },
      occupiedGrid,
      wallGrid,
      roomBounds,
    );

    expect(result).toBe(false);
  });

  it('should respect room bounds with padding', () => {
    const occupiedGrid = createEmptyGrid(20, 20);
    const wallGrid = createEmptyGrid(20, 20);
    const roomBounds: Rectangle = { x: 5, y: 5, width: 10, height: 10 };

    // Should not place on the exact boundary (needs 1 tile padding)
    expect(
      canPlaceDecoration(
        { x: 5, y: 6 },
        { width: 1, height: 1 },
        occupiedGrid,
        wallGrid,
        roomBounds,
      ),
    ).toBe(false);

    // Should allow placement with proper padding
    expect(
      canPlaceDecoration(
        { x: 6, y: 6 },
        { width: 1, height: 1 },
        occupiedGrid,
        wallGrid,
        roomBounds,
      ),
    ).toBe(true);
  });
});

// ===== Placement Rule Tests =====

describe('placeRoomDecorations - placement rules', () => {
  it('should place against-wall decorations near walls', () => {
    const room = createTestRoom('test', 5, 5, 10, 10, 'workspace');
    const catalog: DecorationCatalog = {
      roomType: 'workspace',
      items: [createTestDecorationItem('desk', 'against-wall', { width: 2, height: 1 }, 1.0)],
    };

    const occupiedGrid = createEmptyGrid(20, 20);
    const wallGrid = createWalledGrid(20, 20);
    const rng = createSeededRNG('test-wall');

    const decorations = placeRoomDecorations(room, catalog, occupiedGrid, wallGrid, rng, 1.0);

    expect(decorations.length).toBeGreaterThan(0);

    // Check that decoration is near a wall
    const decoration = decorations[0];
    const { x, y } = decoration.position;
    const { x: rx, y: ry, width: rw, height: rh } = room.bounds;

    // Should be within 1 tile of a wall
    const nearWall = x === rx + 1 || x === rx + rw - 3 || y === ry + 1 || y === ry + rh - 2;

    expect(nearWall).toBe(true);
  });

  it('should place centered decorations near room center', () => {
    const room = createTestRoom('test', 5, 5, 12, 12, 'library');
    const catalog: DecorationCatalog = {
      roomType: 'library',
      items: [createTestDecorationItem('table', 'centered', { width: 2, height: 2 }, 1.0)],
    };

    const occupiedGrid = createEmptyGrid(20, 20);
    const wallGrid = createWalledGrid(20, 20);
    const rng = createSeededRNG('test-center');

    const decorations = placeRoomDecorations(room, catalog, occupiedGrid, wallGrid, rng, 1.0);

    expect(decorations.length).toBe(1);

    const decoration = decorations[0];
    const { x, y } = decoration.position;
    const expectedX = Math.floor(5 + (12 - 2) / 2);
    const expectedY = Math.floor(5 + (12 - 2) / 2);

    expect(x).toBe(expectedX);
    expect(y).toBe(expectedY);
  });

  it('should place corner decorations in corners', () => {
    const room = createTestRoom('test', 5, 5, 10, 10, 'vault');
    const catalog: DecorationCatalog = {
      roomType: 'vault',
      items: [createTestDecorationItem('safe', 'corner', { width: 2, height: 2 }, 1.0)],
    };

    const occupiedGrid = createEmptyGrid(20, 20);
    const wallGrid = createWalledGrid(20, 20);
    const rng = createSeededRNG('test-corner');

    const decorations = placeRoomDecorations(room, catalog, occupiedGrid, wallGrid, rng, 1.0);

    expect(decorations.length).toBeGreaterThan(0);

    const decoration = decorations[0];
    const { x, y } = decoration.position;
    const { x: rx, y: ry, width: rw, height: rh } = room.bounds;

    // Check if it's in one of the four corners
    const isCorner =
      (x === rx + 1 && y === ry + 1) || // Top-left
      (x === rx + rw - 3 && y === ry + 1) || // Top-right
      (x === rx + 1 && y === ry + rh - 3) || // Bottom-left
      (x === rx + rw - 3 && y === ry + rh - 3); // Bottom-right

    expect(isCorner).toBe(true);
  });

  it('should place scattered decorations throughout room', () => {
    const room = createTestRoom('test', 5, 5, 15, 15, 'workspace');
    const catalog: DecorationCatalog = {
      roomType: 'workspace',
      items: [
        createTestDecorationItem('chair', 'scattered', { width: 1, height: 1 }, 1.0),
        createTestDecorationItem('chair2', 'scattered', { width: 1, height: 1 }, 1.0),
        createTestDecorationItem('chair3', 'scattered', { width: 1, height: 1 }, 1.0),
      ],
    };

    const occupiedGrid = createEmptyGrid(25, 25);
    const wallGrid = createWalledGrid(25, 25);
    const rng = createSeededRNG('test-scatter');

    const decorations = placeRoomDecorations(room, catalog, occupiedGrid, wallGrid, rng, 1.0);

    expect(decorations.length).toBeGreaterThan(0);

    // Scattered items should be distributed
    const positions = decorations.map((d) => d.position);

    // Check that not all decorations are at the same position
    const uniquePositions = new Set(positions.map((p) => `${p.x},${p.y}`));
    expect(uniquePositions.size).toBeGreaterThan(1);
  });
});

// ===== Decoration Overlap Tests =====

describe('placeRoomDecorations - no overlap', () => {
  it('should not overlap decorations', () => {
    const room = createTestRoom('test', 5, 5, 20, 20, 'workspace');
    const catalog: DecorationCatalog = {
      roomType: 'workspace',
      items: [
        createTestDecorationItem('desk1', 'scattered', { width: 2, height: 1 }, 1.0),
        createTestDecorationItem('desk2', 'scattered', { width: 2, height: 1 }, 1.0),
        createTestDecorationItem('desk3', 'scattered', { width: 2, height: 1 }, 1.0),
      ],
    };

    const occupiedGrid = createEmptyGrid(30, 30);
    const wallGrid = createWalledGrid(30, 30);
    const rng = createSeededRNG('test-overlap');

    const decorations = placeRoomDecorations(room, catalog, occupiedGrid, wallGrid, rng, 1.0);

    // Check for overlaps
    const occupiedTiles = new Set<string>();

    for (const decoration of decorations) {
      const { x, y } = decoration.position;
      const dims = decoration.dimensions ?? { width: 1, height: 1 };

      for (let dy = 0; dy < dims.height; dy++) {
        for (let dx = 0; dx < dims.width; dx++) {
          const tileKey = `${x + dx},${y + dy}`;

          // Should not already be occupied
          expect(occupiedTiles.has(tileKey)).toBe(false);

          occupiedTiles.add(tileKey);
        }
      }
    }
  });

  it('should mark occupied grid correctly', () => {
    const room = createTestRoom('test', 5, 5, 10, 10, 'workspace');
    const catalog: DecorationCatalog = {
      roomType: 'workspace',
      items: [createTestDecorationItem('desk', 'centered', { width: 3, height: 2 }, 1.0)],
    };

    const occupiedGrid = createEmptyGrid(20, 20);
    const wallGrid = createWalledGrid(20, 20);
    const rng = createSeededRNG('test-mark');

    const decorations = placeRoomDecorations(room, catalog, occupiedGrid, wallGrid, rng, 1.0);

    expect(decorations.length).toBe(1);

    const { x, y } = decorations[0].position;

    // Check that all tiles occupied by the decoration are marked
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(occupiedGrid[y + dy][x + dx]).toBe(true);
      }
    }
  });
});

// ===== Room Bounds Tests =====

describe('placeRoomDecorations - room bounds', () => {
  it('should keep all decorations within room bounds', () => {
    const room = createTestRoom('test', 10, 10, 15, 15, 'laboratory');
    const catalog = DEFAULT_DECORATION_CATALOGS.laboratory;

    const occupiedGrid = createEmptyGrid(40, 40);
    const wallGrid = createWalledGrid(40, 40);
    const rng = createSeededRNG('test-bounds');

    const decorations = placeRoomDecorations(room, catalog, occupiedGrid, wallGrid, rng, 1.0);

    const { x, y, width, height } = room.bounds;

    for (const decoration of decorations) {
      const { x: dx, y: dy } = decoration.position;
      const dims = decoration.dimensions ?? { width: 1, height: 1 };

      // Check all tiles of the decoration
      for (let tdy = 0; tdy < dims.height; tdy++) {
        for (let tdx = 0; tdx < dims.width; tdx++) {
          const tileX = dx + tdx;
          const tileY = dy + tdy;

          // Should be within room bounds (with 1 tile padding)
          expect(tileX).toBeGreaterThan(x);
          expect(tileX).toBeLessThan(x + width - 1);
          expect(tileY).toBeGreaterThan(y);
          expect(tileY).toBeLessThan(y + height - 1);
        }
      }
    }
  });

  it('should skip decorations that are too large for room', () => {
    const smallRoom = createTestRoom('test', 5, 5, 6, 6, 'entrance');
    const catalog: DecorationCatalog = {
      roomType: 'entrance',
      items: [
        {
          id: 'huge-desk',
          name: 'Huge Reception Desk',
          tileId: 150,
          placement: 'centered',
          blocksMovement: true,
          size: { width: 10, height: 5 },
          probability: 1.0,
          minRoomSize: 100,
        },
      ],
    };

    const occupiedGrid = createEmptyGrid(20, 20);
    const wallGrid = createWalledGrid(20, 20);
    const rng = createSeededRNG('test-size');

    const decorations = placeRoomDecorations(smallRoom, catalog, occupiedGrid, wallGrid, rng, 1.0);

    // Should not place the decoration because room is too small
    expect(decorations.length).toBe(0);
  });

  it('should respect minRoomSize property', () => {
    const room = createTestRoom('test', 5, 5, 4, 4, 'workspace'); // 16 tiles
    const catalog: DecorationCatalog = {
      roomType: 'workspace',
      items: [
        {
          id: 'small-item',
          name: 'Small Item',
          tileId: 100,
          placement: 'centered',
          blocksMovement: false,
          size: { width: 1, height: 1 },
          probability: 1.0,
          minRoomSize: 10,
        },
        {
          id: 'large-item',
          name: 'Large Item',
          tileId: 101,
          placement: 'centered',
          blocksMovement: true,
          size: { width: 1, height: 1 },
          probability: 1.0,
          minRoomSize: 20, // Requires 20 tiles
        },
      ],
    };

    const occupiedGrid = createEmptyGrid(20, 20);
    const wallGrid = createWalledGrid(20, 20);
    const rng = createSeededRNG('test-minsize');

    const decorations = placeRoomDecorations(room, catalog, occupiedGrid, wallGrid, rng, 1.0);

    // Should only place the small item
    expect(decorations.length).toBe(1);
    expect(decorations[0].tileId).toBe(100);
  });
});

// ===== Probability and Density Tests =====

describe('placeRoomDecorations - probability', () => {
  it('should respect probability values', () => {
    const room = createTestRoom('test', 5, 5, 20, 20, 'workspace');

    // Run multiple times to check probability
    const results: number[] = [];

    for (let i = 0; i < 20; i++) {
      const catalog: DecorationCatalog = {
        roomType: 'workspace',
        items: [createTestDecorationItem('item', 'centered', { width: 1, height: 1 }, 0.5)],
      };

      const occupiedGrid = createEmptyGrid(30, 30);
      const wallGrid = createWalledGrid(30, 30);
      const rng = createSeededRNG(`test-prob-${i}`);

      const decorations = placeRoomDecorations(room, catalog, occupiedGrid, wallGrid, rng, 1.0);

      results.push(decorations.length);
    }

    // With 50% probability, should not always be 1 or always be 0
    const placed = results.filter((r) => r > 0).length;

    expect(placed).toBeGreaterThan(0);
    expect(placed).toBeLessThan(20);
  });

  it('should scale probability with density parameter', () => {
    const room = createTestRoom('test', 5, 5, 20, 20, 'workspace');
    const catalog: DecorationCatalog = {
      roomType: 'workspace',
      items: [
        createTestDecorationItem('item1', 'scattered', { width: 1, height: 1 }, 1.0),
        createTestDecorationItem('item2', 'scattered', { width: 1, height: 1 }, 1.0),
        createTestDecorationItem('item3', 'scattered', { width: 1, height: 1 }, 1.0),
        createTestDecorationItem('item4', 'scattered', { width: 1, height: 1 }, 1.0),
      ],
    };

    const rng = createSeededRNG('test-density');

    // Test with full density
    const occupiedGridFull = createEmptyGrid(30, 30);
    const wallGridFull = createWalledGrid(30, 30);
    const decorationsFull = placeRoomDecorations(
      room,
      catalog,
      occupiedGridFull,
      wallGridFull,
      rng,
      1.0,
    );

    // Test with low density
    const rng2 = createSeededRNG('test-density');
    const occupiedGridLow = createEmptyGrid(30, 30);
    const wallGridLow = createWalledGrid(30, 30);
    const decorationsLow = placeRoomDecorations(
      room,
      catalog,
      occupiedGridLow,
      wallGridLow,
      rng2,
      0.3,
    );

    // Low density should typically result in fewer decorations
    // (though RNG could make this flaky, so we just check it's not obviously wrong)
    expect(decorationsLow.length).toBeLessThanOrEqual(decorationsFull.length);
  });

  it('should handle zero probability', () => {
    const room = createTestRoom('test', 5, 5, 10, 10, 'workspace');
    const catalog: DecorationCatalog = {
      roomType: 'workspace',
      items: [createTestDecorationItem('item', 'centered', { width: 1, height: 1 }, 0.0)],
    };

    const occupiedGrid = createEmptyGrid(20, 20);
    const wallGrid = createWalledGrid(20, 20);
    const rng = createSeededRNG('test-zero-prob');

    const decorations = placeRoomDecorations(room, catalog, occupiedGrid, wallGrid, rng, 1.0);

    expect(decorations.length).toBe(0);
  });
});

// ===== Multiple Room Tests =====

describe('generateDecorations', () => {
  it('should decorate multiple rooms', () => {
    const rooms = [
      createTestRoom('room1', 5, 5, 10, 10, 'workspace'),
      createTestRoom('room2', 20, 5, 10, 10, 'library'),
      createTestRoom('room3', 5, 20, 10, 10, 'vault'),
    ];

    const wallGrid = createWalledGrid(40, 40);
    const rng = createSeededRNG('test-multi');

    const decorations = generateDecorations(rooms, wallGrid, 40, 40, rng, {
      density: 0.8,
    });

    expect(decorations.length).toBeGreaterThan(0);

    // Check that decorations are distributed across rooms
    const room1Decorations = decorations.filter(
      (d) => d.position.x >= 5 && d.position.x < 15 && d.position.y >= 5 && d.position.y < 15,
    );

    const room2Decorations = decorations.filter(
      (d) => d.position.x >= 20 && d.position.x < 30 && d.position.y >= 5 && d.position.y < 15,
    );

    const room3Decorations = decorations.filter(
      (d) => d.position.x >= 5 && d.position.x < 15 && d.position.y >= 20 && d.position.y < 30,
    );

    // At least one room should have decorations
    expect(
      room1Decorations.length + room2Decorations.length + room3Decorations.length,
    ).toBeGreaterThan(0);
  });

  it('should use custom catalogs when provided', () => {
    const room = createTestRoom('test', 5, 5, 10, 10, 'workspace');

    const customCatalog: DecorationCatalog = {
      roomType: 'workspace',
      items: [
        {
          id: 'custom-item',
          name: 'Custom Item',
          tileId: 999,
          placement: 'centered',
          blocksMovement: true,
          size: { width: 1, height: 1 },
          probability: 1.0,
        },
      ],
    };

    const wallGrid = createWalledGrid(20, 20);
    const rng = createSeededRNG('test-custom');

    const decorations = generateDecorations([room], wallGrid, 20, 20, rng, {
      catalogs: { workspace: customCatalog },
    });

    expect(decorations.length).toBeGreaterThan(0);
    expect(decorations[0].tileId).toBe(999);
  });

  it('should initialize occupied grid with walls', () => {
    const room = createTestRoom('test', 10, 10, 8, 8, 'workspace');
    const wallGrid = createWalledGrid(30, 30);

    // Add a wall in the middle of the room
    wallGrid[12][12] = true;

    const rng = createSeededRNG('test-wall-init');

    const decorations = generateDecorations([room], wallGrid, 30, 30, rng);

    // No decoration should be placed on the wall
    const onWall = decorations.some((d) => d.position.x === 12 && d.position.y === 12);

    expect(onWall).toBe(false);
  });
});

// ===== Layer Generation Tests =====

describe('generateDecorationLayer', () => {
  it('should create a tile layer from decorations', () => {
    const decorations: Decoration[] = [
      {
        tileId: 100,
        position: { x: 5, y: 5 },
        blocksMovement: true,
      },
      {
        tileId: 110,
        position: { x: 10, y: 10 },
        blocksMovement: false,
      },
    ];

    const layer = generateDecorationLayer(decorations, 20, 20);

    expect(layer.length).toBe(400); // 20x20

    // Check decoration positions
    expect(layer[5 * 20 + 5]).toBe(100);
    expect(layer[10 * 20 + 10]).toBe(110);

    // Check empty tiles
    expect(layer[0]).toBe(0);
    expect(layer[399]).toBe(0);
  });

  it('should handle multi-tile decorations', () => {
    const decorations: Decoration[] = [
      {
        tileId: 100,
        position: { x: 5, y: 5 },
        blocksMovement: true,
        dimensions: { width: 3, height: 2 },
      },
    ];

    const layer = generateDecorationLayer(decorations, 20, 20);

    // Check that all tiles are filled with incrementing tile IDs
    expect(layer[5 * 20 + 5]).toBe(100); // Top-left
    expect(layer[5 * 20 + 6]).toBe(101); // Top-middle
    expect(layer[5 * 20 + 7]).toBe(102); // Top-right
    expect(layer[6 * 20 + 5]).toBe(103); // Bottom-left
    expect(layer[6 * 20 + 6]).toBe(104); // Bottom-middle
    expect(layer[6 * 20 + 7]).toBe(105); // Bottom-right
  });

  it('should handle decorations at map edges', () => {
    const decorations: Decoration[] = [
      {
        tileId: 100,
        position: { x: 0, y: 0 },
        blocksMovement: true,
      },
      {
        tileId: 110,
        position: { x: 19, y: 19 },
        blocksMovement: false,
      },
    ];

    const layer = generateDecorationLayer(decorations, 20, 20);

    expect(layer[0]).toBe(100);
    expect(layer[399]).toBe(110);
  });

  it('should initialize all tiles to 0', () => {
    const decorations: Decoration[] = [];

    const layer = generateDecorationLayer(decorations, 10, 10);

    expect(layer.every((tile) => tile === 0)).toBe(true);
  });
});

// ===== Collision Integration Tests =====

describe('addDecorationCollision', () => {
  it('should mark blocking decorations as collision', () => {
    const decorations: Decoration[] = [
      {
        tileId: 100,
        position: { x: 5, y: 5 },
        blocksMovement: true,
      },
    ];

    const collision = new Array(400).fill(false);

    addDecorationCollision(decorations, collision, 20);

    expect(collision[5 * 20 + 5]).toBe(true);
  });

  it('should not mark non-blocking decorations as collision', () => {
    const decorations: Decoration[] = [
      {
        tileId: 100,
        position: { x: 5, y: 5 },
        blocksMovement: false,
      },
    ];

    const collision = new Array(400).fill(false);

    addDecorationCollision(decorations, collision, 20);

    expect(collision[5 * 20 + 5]).toBe(false);
  });

  it('should handle multi-tile blocking decorations', () => {
    const decorations: Decoration[] = [
      {
        tileId: 100,
        position: { x: 5, y: 5 },
        blocksMovement: true,
        dimensions: { width: 3, height: 2 },
      },
    ];

    const collision = new Array(400).fill(false);

    addDecorationCollision(decorations, collision, 20);

    // All tiles should be marked as collision
    expect(collision[5 * 20 + 5]).toBe(true);
    expect(collision[5 * 20 + 6]).toBe(true);
    expect(collision[5 * 20 + 7]).toBe(true);
    expect(collision[6 * 20 + 5]).toBe(true);
    expect(collision[6 * 20 + 6]).toBe(true);
    expect(collision[6 * 20 + 7]).toBe(true);
  });

  it('should preserve existing collision data', () => {
    const decorations: Decoration[] = [
      {
        tileId: 100,
        position: { x: 10, y: 10 },
        blocksMovement: true,
      },
    ];

    const collision = new Array(400).fill(false);
    collision[5 * 20 + 5] = true; // Existing wall

    addDecorationCollision(decorations, collision, 20);

    // Both should be true
    expect(collision[5 * 20 + 5]).toBe(true);
    expect(collision[10 * 20 + 10]).toBe(true);
  });

  it('should handle mixed blocking and non-blocking decorations', () => {
    const decorations: Decoration[] = [
      {
        tileId: 100,
        position: { x: 5, y: 5 },
        blocksMovement: true,
      },
      {
        tileId: 110,
        position: { x: 6, y: 6 },
        blocksMovement: false,
      },
      {
        tileId: 120,
        position: { x: 7, y: 7 },
        blocksMovement: true,
      },
    ];

    const collision = new Array(400).fill(false);

    addDecorationCollision(decorations, collision, 20);

    expect(collision[5 * 20 + 5]).toBe(true);
    expect(collision[6 * 20 + 6]).toBe(false);
    expect(collision[7 * 20 + 7]).toBe(true);
  });
});

// ===== Integration Tests =====

describe('Decoration System Integration', () => {
  it('should generate complete decoration system for all room types', () => {
    const roomTypes: RoomType[] = [
      'workspace',
      'library',
      'vault',
      'laboratory',
      'hallway',
      'entrance',
    ];

    const rooms = roomTypes.map((type, i) => createTestRoom(`room-${i}`, i * 15, 5, 12, 12, type));

    const wallGrid = createWalledGrid(100, 30);
    const rng = createSeededRNG('integration-test');

    const decorations = generateDecorations(rooms, wallGrid, 100, 30, rng, {
      density: 0.7,
    });

    expect(decorations.length).toBeGreaterThan(0);

    // Generate layer
    const layer = generateDecorationLayer(decorations, 100, 30);
    expect(layer.length).toBe(3000);

    // Add collision
    const collision = new Array(3000).fill(false);
    addDecorationCollision(decorations, collision, 100);

    // At least some tiles should be blocking
    const blockingCount = collision.filter((c) => c).length;
    expect(blockingCount).toBeGreaterThan(0);
  });

  it('should maintain consistency between layer and collision', () => {
    const room = createTestRoom('test', 5, 5, 20, 20, 'workspace');
    const wallGrid = createWalledGrid(35, 35);
    const rng = createSeededRNG('consistency-test');

    const decorations = generateDecorations([room], wallGrid, 35, 35, rng);

    const _layer = generateDecorationLayer(decorations, 35, 35);
    const collision = new Array(35 * 35).fill(false);
    addDecorationCollision(decorations, collision, 35);

    // Every blocking decoration in the layer should have collision
    decorations.forEach((decoration) => {
      if (decoration.blocksMovement) {
        const { x, y } = decoration.position;
        const dims = decoration.dimensions ?? { width: 1, height: 1 };

        for (let dy = 0; dy < dims.height; dy++) {
          for (let dx = 0; dx < dims.width; dx++) {
            const index = (y + dy) * 35 + (x + dx);
            expect(collision[index]).toBe(true);
          }
        }
      }
    });
  });

  it('should work with seeded RNG for reproducible results', () => {
    const room = createTestRoom('test', 5, 5, 15, 15, 'library');
    const wallGrid = createWalledGrid(25, 25);

    const rng1 = createSeededRNG('same-seed');
    const decorations1 = generateDecorations([room], wallGrid, 25, 25, rng1);

    const rng2 = createSeededRNG('same-seed');
    const decorations2 = generateDecorations([room], wallGrid, 25, 25, rng2);

    // Should produce identical results
    expect(decorations1.length).toBe(decorations2.length);

    decorations1.forEach((d1, i) => {
      const d2 = decorations2[i];
      expect(d1.tileId).toBe(d2.tileId);
      expect(d1.position.x).toBe(d2.position.x);
      expect(d1.position.y).toBe(d2.position.y);
      expect(d1.blocksMovement).toBe(d2.blocksMovement);
    });
  });
});
