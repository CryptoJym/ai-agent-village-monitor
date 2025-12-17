/**
 * Tilemap Generator Tests
 *
 * Tests for the complete tilemap generation pipeline.
 * Validates integration of all subsystems.
 */

import { describe, it, expect } from 'vitest';
import {
  generateTilemap,
  calculateMapDimensions,
  createSeededRNG,
  validateTilemap,
  getTileAt,
  setTileAt,
  findLayer,
} from '../generator';
import { createDefaultTileMapping } from '../autoTile';
import { Room, Corridor, TilemapOptions, LAYER_NAMES } from '../types';

// Test fixtures
function createTestRoom(id: string, x: number, y: number, w: number, h: number): Room {
  return {
    id,
    bounds: { x, y, width: w, height: h },
    type: 'workspace',
    center: { x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) },
  };
}

function createTestCorridor(
  start: { x: number; y: number },
  end: { x: number; y: number },
): Corridor {
  return {
    start,
    end,
    width: 3,
  };
}

function createTestOptions(): TilemapOptions {
  return {
    tileWidth: 16,
    tileHeight: 16,
    tileMapping: createDefaultTileMapping(),
    includeDecorations: true,
    decorationDensity: 0.5,
    includeShadows: true,
  };
}

describe('generateTilemap', () => {
  it('should generate a complete tilemap', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10), createTestRoom('room2', 20, 5, 10, 10)];

    const corridors = [createTestCorridor({ x: 15, y: 9 }, { x: 20, y: 9 })];

    const rng = createSeededRNG('test-seed');
    const options = createTestOptions();

    const result = generateTilemap(rooms, corridors, rng, options);

    expect(result.tilemap).toBeDefined();
    expect(result.doors).toBeDefined();
    expect(result.wallGrid).toBeDefined();
  });

  it('should include all required layers', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10)];
    const corridors: Corridor[] = [];
    const rng = createSeededRNG('test');
    const options = createTestOptions();

    const result = generateTilemap(rooms, corridors, rng, options);

    const layerNames = result.tilemap.layers.map((l) => l.name);

    expect(layerNames).toContain(LAYER_NAMES.GROUND);
    expect(layerNames).toContain(LAYER_NAMES.WALLS);
    expect(layerNames).toContain(LAYER_NAMES.DECORATIONS);
  });

  it('should generate doors between rooms and corridors', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10)];
    const corridors = [createTestCorridor({ x: 5, y: 3 }, { x: 10, y: 3 })];
    const rng = createSeededRNG('test');
    const options = createTestOptions();

    const result = generateTilemap(rooms, corridors, rng, options);

    expect(result.doors.length).toBeGreaterThan(0);
  });

  it('should respect layer configuration', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10)];
    const corridors: Corridor[] = [];
    const rng = createSeededRNG('test');
    const options: TilemapOptions = {
      ...createTestOptions(),
      layers: {
        ground: true,
        walls: false,
        decorations: false,
        abovePlayer: false,
      },
    };

    const result = generateTilemap(rooms, corridors, rng, options);

    expect(result.tilemap.layers.length).toBe(1);
    expect(result.tilemap.layers[0].name).toBe(LAYER_NAMES.GROUND);
  });

  it('should include collision data', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10)];
    const corridors: Corridor[] = [];
    const rng = createSeededRNG('test');
    const options = createTestOptions();

    const result = generateTilemap(rooms, corridors, rng, options);

    expect(result.tilemap.collision).toBeDefined();
    expect(result.tilemap.collision.length).toBe(result.tilemap.width * result.tilemap.height);
  });

  it('should include map properties', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10)];
    const corridors: Corridor[] = [];
    const rng = createSeededRNG('test');
    const options: TilemapOptions = {
      ...createTestOptions(),
      properties: { difficulty: 'hard', theme: 'tech' },
    };

    const result = generateTilemap(rooms, corridors, rng, options);

    expect(result.tilemap.properties.difficulty).toBe('hard');
    expect(result.tilemap.properties.theme).toBe('tech');
    expect(result.tilemap.properties.roomCount).toBe(1);
  });

  it('should generate shadows when enabled', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10)];
    const corridors: Corridor[] = [];
    const rng = createSeededRNG('test');
    const options: TilemapOptions = {
      ...createTestOptions(),
      includeShadows: true,
    };

    const result = generateTilemap(rooms, corridors, rng, options);

    const shadowLayer = result.tilemap.layers.find((l) => l.name === 'shadows');
    expect(shadowLayer).toBeDefined();
  });

  it('should skip decorations when disabled', () => {
    const rooms = [createTestRoom('room1', 5, 5, 15, 15)];
    const corridors: Corridor[] = [];
    const rng = createSeededRNG('test');
    const options: TilemapOptions = {
      ...createTestOptions(),
      includeDecorations: false,
    };

    const result = generateTilemap(rooms, corridors, rng, options);

    const decorationLayer = result.tilemap.layers.find((l) => l.name === LAYER_NAMES.DECORATIONS);
    expect(decorationLayer).toBeUndefined();
  });
});

describe('calculateMapDimensions', () => {
  it('should calculate dimensions from rooms', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10), createTestRoom('room2', 20, 10, 15, 12)];

    const corridors: Corridor[] = [];
    const dims = calculateMapDimensions(rooms, corridors);

    expect(dims.width).toBeGreaterThan(30);
    expect(dims.height).toBeGreaterThan(20);
  });

  it('should include corridors in dimensions', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10)];
    const corridors = [createTestCorridor({ x: 0, y: 0 }, { x: 50, y: 50 })];

    const dims = calculateMapDimensions(rooms, corridors);

    expect(dims.width).toBeGreaterThanOrEqual(50);
    expect(dims.height).toBeGreaterThanOrEqual(50);
  });

  it('should add padding', () => {
    const rooms = [createTestRoom('room1', 0, 0, 10, 10)];
    const corridors: Corridor[] = [];

    const dims = calculateMapDimensions(rooms, corridors, 5);

    expect(dims.width).toBe(10 + 5 * 2);
    expect(dims.height).toBe(10 + 5 * 2);
  });

  it('should handle empty inputs', () => {
    const dims = calculateMapDimensions([], []);

    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  });
});

describe('createSeededRNG', () => {
  it('should generate reproducible random numbers', () => {
    const rng1 = createSeededRNG('test-seed');
    const rng2 = createSeededRNG('test-seed');

    const values1 = Array.from({ length: 10 }, () => rng1.random());
    const values2 = Array.from({ length: 10 }, () => rng2.random());

    expect(values1).toEqual(values2);
  });

  it('should generate different sequences for different seeds', () => {
    const rng1 = createSeededRNG('seed1');
    const rng2 = createSeededRNG('seed2');

    const values1 = Array.from({ length: 10 }, () => rng1.random());
    const values2 = Array.from({ length: 10 }, () => rng2.random());

    expect(values1).not.toEqual(values2);
  });

  it('should generate random integers in range', () => {
    const rng = createSeededRNG('test');

    for (let i = 0; i < 100; i++) {
      const value = rng.randomInt(5, 10);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThan(10);
    }
  });

  it('should pick items from array', () => {
    const rng = createSeededRNG('test');
    const array = ['a', 'b', 'c', 'd'];

    const picked = rng.pick(array);
    expect(array).toContain(picked);
  });

  it('should shuffle arrays', () => {
    const rng = createSeededRNG('test');
    const array = [1, 2, 3, 4, 5];

    const shuffled = rng.shuffle(array);

    expect(shuffled).toHaveLength(array.length);
    expect(shuffled).toEqual(expect.arrayContaining(array));
    // Very unlikely to be in same order
  });

  it('should return the seed', () => {
    const rng = createSeededRNG('my-seed');
    expect(rng.getSeed()).toBe('my-seed');
  });

  it('should handle numeric seeds', () => {
    const rng = createSeededRNG(12345);
    expect(rng.getSeed()).toBe('12345');
  });
});

describe('validateTilemap', () => {
  it('should validate a correct tilemap', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10)];
    const corridors: Corridor[] = [];
    const rng = createSeededRNG('test');
    const options = createTestOptions();

    const result = generateTilemap(rooms, corridors, rng, options);
    const errors = validateTilemap(result.tilemap);

    expect(errors).toHaveLength(0);
  });

  it('should detect invalid dimensions', () => {
    const tilemap = {
      width: -1,
      height: 10,
      tileWidth: 16,
      tileHeight: 16,
      layers: [],
      collision: [],
      properties: {},
    };

    const errors = validateTilemap(tilemap);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('dimensions'))).toBe(true);
  });

  it('should detect missing layers', () => {
    const tilemap = {
      width: 10,
      height: 10,
      tileWidth: 16,
      tileHeight: 16,
      layers: [],
      collision: new Array(100).fill(false),
      properties: {},
    };

    const errors = validateTilemap(tilemap);
    expect(errors.some((e) => e.includes('layers'))).toBe(true);
  });

  it('should detect layer dimension mismatch', () => {
    const tilemap = {
      width: 10,
      height: 10,
      tileWidth: 16,
      tileHeight: 16,
      layers: [
        {
          name: 'test',
          data: new Array(100).fill(0),
          width: 5,
          height: 5,
          visible: true,
          opacity: 1,
        },
      ],
      collision: new Array(100).fill(false),
      properties: {},
    };

    const errors = validateTilemap(tilemap);
    expect(errors.some((e) => e.includes('mismatched dimensions'))).toBe(true);
  });

  it('should detect incorrect data size', () => {
    const tilemap = {
      width: 10,
      height: 10,
      tileWidth: 16,
      tileHeight: 16,
      layers: [
        {
          name: 'test',
          data: new Array(50).fill(0), // Wrong size
          width: 10,
          height: 10,
          visible: true,
          opacity: 1,
        },
      ],
      collision: new Array(100).fill(false),
      properties: {},
    };

    const errors = validateTilemap(tilemap);
    expect(errors.some((e) => e.includes('incorrect data size'))).toBe(true);
  });
});

describe('getTileAt', () => {
  it('should get tile at position', () => {
    const layer = {
      name: 'test',
      data: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      width: 3,
      height: 3,
      visible: true,
      opacity: 1,
    };

    expect(getTileAt(layer, 0, 0)).toBe(1);
    expect(getTileAt(layer, 2, 2)).toBe(9);
    expect(getTileAt(layer, 1, 1)).toBe(5);
  });

  it('should return 0 for out of bounds', () => {
    const layer = {
      name: 'test',
      data: [1, 2, 3, 4],
      width: 2,
      height: 2,
      visible: true,
      opacity: 1,
    };

    expect(getTileAt(layer, -1, 0)).toBe(0);
    expect(getTileAt(layer, 5, 5)).toBe(0);
  });
});

describe('setTileAt', () => {
  it('should set tile at position', () => {
    const layer = {
      name: 'test',
      data: [0, 0, 0, 0],
      width: 2,
      height: 2,
      visible: true,
      opacity: 1,
    };

    setTileAt(layer, 1, 1, 99);
    expect(layer.data[3]).toBe(99);
  });

  it('should ignore out of bounds', () => {
    const layer = {
      name: 'test',
      data: [0, 0, 0, 0],
      width: 2,
      height: 2,
      visible: true,
      opacity: 1,
    };

    setTileAt(layer, 10, 10, 99);
    expect(layer.data).toEqual([0, 0, 0, 0]);
  });
});

describe('findLayer', () => {
  it('should find layer by name', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10)];
    const corridors: Corridor[] = [];
    const rng = createSeededRNG('test');
    const options = createTestOptions();

    const result = generateTilemap(rooms, corridors, rng, options);
    const groundLayer = findLayer(result.tilemap, LAYER_NAMES.GROUND);

    expect(groundLayer).toBeDefined();
    expect(groundLayer?.name).toBe(LAYER_NAMES.GROUND);
  });

  it('should return undefined for missing layer', () => {
    const tilemap = {
      width: 10,
      height: 10,
      tileWidth: 16,
      tileHeight: 16,
      layers: [],
      collision: [],
      properties: {},
    };

    const layer = findLayer(tilemap, 'nonexistent');
    expect(layer).toBeUndefined();
  });
});

describe('Integration: Full Generation Pipeline', () => {
  it('should generate a playable dungeon layout', () => {
    // Create a small dungeon with multiple rooms
    const rooms = [
      createTestRoom('entrance', 5, 5, 12, 12),
      createTestRoom('workspace', 25, 5, 15, 12),
      createTestRoom('vault', 5, 25, 10, 10),
      createTestRoom('library', 25, 25, 15, 15),
    ];

    const corridors = [
      createTestCorridor({ x: 17, y: 10 }, { x: 25, y: 10 }),
      createTestCorridor({ x: 10, y: 17 }, { x: 10, y: 25 }),
      createTestCorridor({ x: 15, y: 30 }, { x: 25, y: 30 }),
    ];

    const rng = createSeededRNG('dungeon-seed-123');
    const options = createTestOptions();

    const result = generateTilemap(rooms, corridors, rng, options);

    // Validate structure
    expect(validateTilemap(result.tilemap)).toHaveLength(0);

    // Check layers exist
    expect(findLayer(result.tilemap, LAYER_NAMES.GROUND)).toBeDefined();
    expect(findLayer(result.tilemap, LAYER_NAMES.WALLS)).toBeDefined();

    // Check doors were generated
    expect(result.doors.length).toBeGreaterThan(0);

    // Check collision data is populated
    const hasCollision = result.tilemap.collision.some((c) => c === true);
    expect(hasCollision).toBe(true);

    // Check some tiles are non-zero
    const groundLayer = findLayer(result.tilemap, LAYER_NAMES.GROUND);
    const hasFloors = groundLayer?.data.some((t) => t > 0);
    expect(hasFloors).toBe(true);
  });

  it('should be reproducible with same seed', () => {
    const rooms = [createTestRoom('room1', 5, 5, 10, 10)];
    const corridors: Corridor[] = [];

    const rng1 = createSeededRNG('same-seed');
    const rng2 = createSeededRNG('same-seed');

    const options = createTestOptions();

    const result1 = generateTilemap(rooms, corridors, rng1, options);
    const result2 = generateTilemap(rooms, corridors, rng2, options);

    // Compare ground layers
    const ground1 = findLayer(result1.tilemap, LAYER_NAMES.GROUND);
    const ground2 = findLayer(result2.tilemap, LAYER_NAMES.GROUND);

    expect(ground1?.data).toEqual(ground2?.data);
  });
});
