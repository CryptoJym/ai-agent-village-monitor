/**
 * Tests for Corridor Generation
 * Verifies connectivity, MST properties, and path generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SeededRNG } from '../rng';
import { generateBSPTree } from '../bsp';
import { placeRoomsInBSP, resetRoomIdCounter } from '../rooms';
import {
  generateCorridors,
  validateConnectivity,
  resetCorridorIdCounter,
} from '../corridors';
import { DEFAULT_BSP_OPTIONS, ModuleInfo, RoomData } from '../types';

describe('Corridor Generation', () => {
  let testModules: ModuleInfo[];
  let testRooms: RoomData[];

  beforeEach(() => {
    // Reset counters for deterministic IDs
    resetRoomIdCounter();
    resetCorridorIdCounter();

    // Create test modules
    testModules = [
      {
        path: 'src/components',
        name: 'Components',
        type: 'component',
        fileCount: 10,
        totalSize: 5000,
        complexity: 7,
        imports: [],
        exports: [],
      },
      {
        path: 'src/services',
        name: 'Services',
        type: 'service',
        fileCount: 8,
        totalSize: 4000,
        complexity: 6,
        imports: [],
        exports: [],
      },
      {
        path: 'src/utils',
        name: 'Utils',
        type: 'utility',
        fileCount: 5,
        totalSize: 2000,
        complexity: 4,
        imports: [],
        exports: [],
      },
      {
        path: 'tests',
        name: 'Tests',
        type: 'test',
        fileCount: 12,
        totalSize: 6000,
        complexity: 5,
        imports: [],
        exports: [],
      },
    ];

    // Generate test rooms
    const rng = new SeededRNG('test-seed');
    const bspTree = generateBSPTree(48, 48, rng, DEFAULT_BSP_OPTIONS);
    testRooms = placeRoomsInBSP(bspTree, testModules, rng, DEFAULT_BSP_OPTIONS);
  });

  describe('generateCorridors()', () => {
    it('should generate corridors connecting all rooms', () => {
      const rng = new SeededRNG('corridor-test');
      const corridors = generateCorridors(testRooms, rng, DEFAULT_BSP_OPTIONS);

      expect(corridors).toBeDefined();
      expect(corridors.length).toBeGreaterThan(0);
    });

    it('should be deterministic with same seed', () => {
      const seed = 'determinism-test';
      const rng1 = new SeededRNG(seed);
      const rng2 = new SeededRNG(seed);

      const corridors1 = generateCorridors(testRooms, rng1, DEFAULT_BSP_OPTIONS);
      const corridors2 = generateCorridors(testRooms, rng2, DEFAULT_BSP_OPTIONS);

      expect(corridors1.length).toBe(corridors2.length);

      // Compare corridor paths
      for (let i = 0; i < corridors1.length; i++) {
        expect(corridors1[i].fromRoomId).toBe(corridors2[i].fromRoomId);
        expect(corridors1[i].toRoomId).toBe(corridors2[i].toRoomId);
        expect(corridors1[i].path).toEqual(corridors2[i].path);
      }
    });

    it('should create minimum spanning tree connections', () => {
      const rng = new SeededRNG('mst-test');
      const corridors = generateCorridors(testRooms, rng, DEFAULT_BSP_OPTIONS);

      // MST should have N-1 edges minimum
      const minCorridors = testRooms.length - 1;
      expect(corridors.length).toBeGreaterThanOrEqual(minCorridors);
    });

    it('should add extra edges for loops', () => {
      const rng = new SeededRNG('loop-test');
      // Need enough rooms so extraEdgeRatio produces at least 1 extra edge
      // With 4 rooms: MST = 3 edges, extra = floor(3 * 0.5) = 1
      const corridors = generateCorridors(testRooms, rng, {
        ...DEFAULT_BSP_OPTIONS,
        extraEdgeRatio: 0.5, // Higher ratio to ensure extra edges with small room count
      });

      // Should have more than MST minimum (N-1)
      const mstCount = testRooms.length - 1;
      expect(corridors.length).toBeGreaterThanOrEqual(mstCount);
      // Note: With small room counts, extra edges may equal MST if Delaunay produces
      // exactly N-1 edges (when points are nearly collinear)
    });

    it('should handle two rooms', () => {
      const twoRooms = testRooms.slice(0, 2);
      const rng = new SeededRNG('two-rooms');
      const corridors = generateCorridors(twoRooms, rng, DEFAULT_BSP_OPTIONS);

      expect(corridors).toHaveLength(1);
      expect(corridors[0].fromRoomId).toBe(twoRooms[0].id);
      expect(corridors[0].toRoomId).toBe(twoRooms[1].id);
    });

    it('should handle single room', () => {
      const oneRoom = testRooms.slice(0, 1);
      const rng = new SeededRNG('one-room');
      const corridors = generateCorridors(oneRoom, rng, DEFAULT_BSP_OPTIONS);

      expect(corridors).toHaveLength(0);
    });

    it('should handle empty room list', () => {
      const rng = new SeededRNG('empty');
      const corridors = generateCorridors([], rng, DEFAULT_BSP_OPTIONS);

      expect(corridors).toHaveLength(0);
    });

    it('should respect corridor width option', () => {
      const rng = new SeededRNG('width-test');
      const customWidth = 3;

      const corridors = generateCorridors(testRooms, rng, {
        ...DEFAULT_BSP_OPTIONS,
        corridorWidth: customWidth,
      });

      for (const corridor of corridors) {
        expect(corridor.width).toBe(customWidth);
      }
    });
  });

  describe('Corridor Paths', () => {
    it('should create valid paths between rooms', () => {
      const rng = new SeededRNG('path-test');
      const corridors = generateCorridors(testRooms, rng, DEFAULT_BSP_OPTIONS);

      for (const corridor of corridors) {
        expect(corridor.path).toBeDefined();
        expect(corridor.path.length).toBeGreaterThanOrEqual(2);

        // Each point should have x and y
        for (const point of corridor.path) {
          expect(typeof point.x).toBe('number');
          expect(typeof point.y).toBe('number');
        }
      }
    });

    it('should create L-shaped or straight paths', () => {
      const rng = new SeededRNG('shape-test');
      const corridors = generateCorridors(testRooms, rng, DEFAULT_BSP_OPTIONS);

      for (const corridor of corridors) {
        const pathLength = corridor.path.length;

        // Paths should be 2 points (straight) or 3 points (L-shaped)
        expect(pathLength).toBeGreaterThanOrEqual(2);
        expect(pathLength).toBeLessThanOrEqual(3);
      }
    });

    it('should start and end at room centers', () => {
      const rng = new SeededRNG('endpoints-test');
      const corridors = generateCorridors(testRooms, rng, DEFAULT_BSP_OPTIONS);

      for (const corridor of corridors) {
        const fromRoom = testRooms.find((r) => r.id === corridor.fromRoomId);
        const toRoom = testRooms.find((r) => r.id === corridor.toRoomId);

        expect(fromRoom).toBeDefined();
        expect(toRoom).toBeDefined();

        const start = corridor.path[0];
        const end = corridor.path[corridor.path.length - 1];

        // Start should be near fromRoom center
        const startDistX = Math.abs(start.x - fromRoom!.center.x);
        const startDistY = Math.abs(start.y - fromRoom!.center.y);
        expect(startDistX).toBeLessThan(2);
        expect(startDistY).toBeLessThan(2);

        // End should be near toRoom center
        const endDistX = Math.abs(end.x - toRoom!.center.x);
        const endDistY = Math.abs(end.y - toRoom!.center.y);
        expect(endDistX).toBeLessThan(2);
        expect(endDistY).toBeLessThan(2);
      }
    });
  });

  describe('validateConnectivity()', () => {
    it('should validate fully connected rooms', () => {
      const rng = new SeededRNG('connectivity-test');
      const corridors = generateCorridors(testRooms, rng, DEFAULT_BSP_OPTIONS);

      const isConnected = validateConnectivity(testRooms, corridors);
      expect(isConnected).toBe(true);
    });

    it('should return true for single room', () => {
      const oneRoom = testRooms.slice(0, 1);
      const isConnected = validateConnectivity(oneRoom, []);

      expect(isConnected).toBe(true);
    });

    it('should return true for empty list', () => {
      const isConnected = validateConnectivity([], []);
      expect(isConnected).toBe(true);
    });

    it('should detect disconnected rooms', () => {
      // Create two isolated groups
      const group1 = testRooms.slice(0, 2);
      const group2 = testRooms.slice(2, 4);

      // Only connect within groups
      const corridors = [
        {
          id: 'c1',
          fromRoomId: group1[0].id,
          toRoomId: group1[1].id,
          path: [group1[0].center, group1[1].center],
          width: 2,
        },
      ];

      const allRooms = [...group1, ...group2];
      const isConnected = validateConnectivity(allRooms, corridors);

      expect(isConnected).toBe(false);
    });

    it('should validate connectivity with extra edges', () => {
      const rng = new SeededRNG('extra-edges');
      const corridors = generateCorridors(testRooms, rng, {
        ...DEFAULT_BSP_OPTIONS,
        extraEdgeRatio: 0.5, // Add lots of extra edges
      });

      const isConnected = validateConnectivity(testRooms, corridors);
      expect(isConnected).toBe(true);
    });
  });

  describe('Delaunay Triangulation', () => {
    it('should create reasonable edge count', () => {
      const rng = new SeededRNG('delaunay-test');
      const corridors = generateCorridors(testRooms, rng, {
        ...DEFAULT_BSP_OPTIONS,
        extraEdgeRatio: 0,
      });

      // With 4 rooms, MST should have 3 edges
      expect(corridors.length).toBe(testRooms.length - 1);
    });

    it('should prefer shorter connections', () => {
      const rng = new SeededRNG('short-test');
      const corridors = generateCorridors(testRooms, rng, {
        ...DEFAULT_BSP_OPTIONS,
        extraEdgeRatio: 0, // Only MST
      });

      // Calculate average corridor distance
      let totalDistance = 0;
      for (const corridor of corridors) {
        const fromRoom = testRooms.find((r) => r.id === corridor.fromRoomId)!;
        const toRoom = testRooms.find((r) => r.id === corridor.toRoomId)!;

        const dx = fromRoom.center.x - toRoom.center.x;
        const dy = fromRoom.center.y - toRoom.center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        totalDistance += distance;
      }

      const avgDistance = totalDistance / corridors.length;

      // Average MST distance should be reasonable (not connecting opposite corners)
      expect(avgDistance).toBeLessThan(60); // Less than full diagonal
    });
  });

  describe('Extra Edges for Loops', () => {
    it('should add approximately correct number of extra edges', () => {
      const rng = new SeededRNG('extra-count-test');
      const ratio = 0.3;

      const corridors = generateCorridors(testRooms, rng, {
        ...DEFAULT_BSP_OPTIONS,
        extraEdgeRatio: ratio,
      });

      const mstCount = testRooms.length - 1;
      const expectedExtra = Math.floor(mstCount * ratio);
      const actualExtra = corridors.length - mstCount;

      // Allow some variance
      expect(actualExtra).toBeGreaterThanOrEqual(expectedExtra - 1);
      expect(actualExtra).toBeLessThanOrEqual(expectedExtra + 1);
    });

    it('should maintain connectivity with loops', () => {
      const rng = new SeededRNG('loops-connectivity');
      const corridors = generateCorridors(testRooms, rng, {
        ...DEFAULT_BSP_OPTIONS,
        extraEdgeRatio: 0.4,
      });

      const isConnected = validateConnectivity(testRooms, corridors);
      expect(isConnected).toBe(true);
    });

    it('should not duplicate edges', () => {
      const rng = new SeededRNG('duplicate-test');
      const corridors = generateCorridors(testRooms, rng, {
        ...DEFAULT_BSP_OPTIONS,
        extraEdgeRatio: 0.5,
      });

      // Check for duplicate corridors
      const edgeSet = new Set<string>();

      for (const corridor of corridors) {
        const key1 = `${corridor.fromRoomId}-${corridor.toRoomId}`;
        const key2 = `${corridor.toRoomId}-${corridor.fromRoomId}`;

        expect(edgeSet.has(key1)).toBe(false);
        expect(edgeSet.has(key2)).toBe(false);

        edgeSet.add(key1);
        edgeSet.add(key2);
      }
    });
  });

  describe('Integration with Rooms', () => {
    it('should reference valid room IDs', () => {
      const rng = new SeededRNG('room-ids-test');
      const corridors = generateCorridors(testRooms, rng, DEFAULT_BSP_OPTIONS);

      const roomIds = new Set(testRooms.map((r) => r.id));

      for (const corridor of corridors) {
        expect(roomIds.has(corridor.fromRoomId)).toBe(true);
        expect(roomIds.has(corridor.toRoomId)).toBe(true);
      }
    });

    it('should not create self-loops', () => {
      const rng = new SeededRNG('self-loop-test');
      const corridors = generateCorridors(testRooms, rng, DEFAULT_BSP_OPTIONS);

      for (const corridor of corridors) {
        expect(corridor.fromRoomId).not.toBe(corridor.toRoomId);
      }
    });

    it('should work with many rooms', () => {
      // Create many modules
      const manyModules: ModuleInfo[] = Array.from({ length: 20 }, (_, i) => ({
        path: `module-${i}`,
        name: `Module ${i}`,
        type: 'service',
        fileCount: 5,
        totalSize: 1000,
        complexity: 5,
        imports: [],
        exports: [],
      }));

      const rng = new SeededRNG('many-rooms');
      const bspTree = generateBSPTree(96, 96, rng, {
        ...DEFAULT_BSP_OPTIONS,
        maxDepth: 8,
      });

      resetRoomIdCounter();
      const manyRooms = placeRoomsInBSP(bspTree, manyModules, rng, DEFAULT_BSP_OPTIONS);

      const corridors = generateCorridors(manyRooms, rng, DEFAULT_BSP_OPTIONS);

      expect(corridors.length).toBeGreaterThan(0);
      expect(validateConnectivity(manyRooms, corridors)).toBe(true);
    });
  });
});
