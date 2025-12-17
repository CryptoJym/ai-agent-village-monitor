/**
 * Integration tests for complete building generation pipeline
 * Tests the full workflow: Modules -> BSP -> Rooms -> Corridors -> Tilemap
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateConnectivity,
  resetRoomIdCounter,
  resetCorridorIdCounter,
  generateBuilding,
  calculateBuildingSize,
} from '../index';
import type { ModuleInfo } from '../types';

describe('Building Generation Integration', () => {
  let sampleModules: ModuleInfo[];

  beforeEach(() => {
    resetRoomIdCounter();
    resetCorridorIdCounter();

    sampleModules = [
      {
        path: 'src/components/Button',
        name: 'Button',
        type: 'component',
        fileCount: 3,
        totalSize: 1500,
        complexity: 5,
        imports: ['src/utils/styles'],
        exports: ['Button', 'ButtonProps'],
      },
      {
        path: 'src/components/Modal',
        name: 'Modal',
        type: 'component',
        fileCount: 5,
        totalSize: 2500,
        complexity: 7,
        imports: ['src/utils/portal', 'src/hooks/useClickOutside'],
        exports: ['Modal', 'ModalProps'],
      },
      {
        path: 'src/services/api',
        name: 'API Service',
        type: 'service',
        fileCount: 8,
        totalSize: 4000,
        complexity: 8,
        imports: ['src/utils/http'],
        exports: ['ApiClient', 'ApiError'],
      },
      {
        path: 'src/utils/http',
        name: 'HTTP Utils',
        type: 'utility',
        fileCount: 4,
        totalSize: 2000,
        complexity: 6,
        imports: [],
        exports: ['get', 'post', 'put', 'delete'],
      },
      {
        path: 'src/utils/styles',
        name: 'Style Utils',
        type: 'utility',
        fileCount: 2,
        totalSize: 800,
        complexity: 3,
        imports: [],
        exports: ['classNames', 'mergeStyles'],
      },
      {
        path: 'tests/unit',
        name: 'Unit Tests',
        type: 'test',
        fileCount: 15,
        totalSize: 7500,
        complexity: 6,
        imports: [],
        exports: [],
      },
    ];
  });

  describe('Full Pipeline', () => {
    it('should generate complete building from modules', () => {
      const repoId = 'owner/test-repo';
      const commitSha = 'abc123def456';
      const dimensions = calculateBuildingSize(sampleModules);

      const result = generateBuilding({
        repoId,
        commitSha,
        modules: sampleModules,
        buildingWidth: dimensions.width,
        buildingHeight: dimensions.height,
      });

      expect(result).toBeDefined();
      expect(result.seed).toBe(`${repoId}-${commitSha}`);
      expect(result.bspTree).toBeDefined();
      expect(result.rooms.length).toBeGreaterThan(0);
      expect(result.corridors.length).toBeGreaterThan(0);
      expect(result.tilemap).toBeDefined();
    });

    it('should create fully connected building', () => {
      const result = generateBuilding({
        repoId: 'test-repo',
        commitSha: 'test-sha',
        modules: sampleModules,
        buildingWidth: 64,
        buildingHeight: 64,
      });

      const isConnected = validateConnectivity(result.rooms, result.corridors);
      expect(isConnected).toBe(true);
    });

    it('should be deterministic with same inputs', () => {
      const repoId = 'owner/repo';
      const commitSha = 'commit123';

      const result1 = generateBuilding({
        repoId,
        commitSha,
        modules: sampleModules,
        buildingWidth: 48,
        buildingHeight: 48,
      });

      const result2 = generateBuilding({
        repoId,
        commitSha,
        modules: sampleModules,
        buildingWidth: 48,
        buildingHeight: 48,
      });

      // Should generate identical results
      expect(result1.seed).toBe(result2.seed);
      expect(result1.rooms.length).toBe(result2.rooms.length);
      expect(result1.corridors.length).toBe(result2.corridors.length);

      // Check room bounds are identical
      for (let i = 0; i < result1.rooms.length; i++) {
        expect(result1.rooms[i].bounds).toEqual(result2.rooms[i].bounds);
        expect(result1.rooms[i].roomType).toBe(result2.rooms[i].roomType);
      }
    });

    it('should generate different buildings for different commits', () => {
      const repoId = 'owner/repo';

      const result1 = generateBuilding({
        repoId,
        commitSha: 'commit-1',
        modules: sampleModules,
        buildingWidth: 48,
        buildingHeight: 48,
      });

      const result2 = generateBuilding({
        repoId,
        commitSha: 'commit-2',
        modules: sampleModules,
        buildingWidth: 48,
        buildingHeight: 48,
      });

      // Should generate different results
      expect(result1.seed).not.toBe(result2.seed);

      // Rooms might be same count but different positions
      let hasDifferentBounds = false;
      for (let i = 0; i < Math.min(result1.rooms.length, result2.rooms.length); i++) {
        if (
          result1.rooms[i].bounds.x !== result2.rooms[i].bounds.x ||
          result1.rooms[i].bounds.y !== result2.rooms[i].bounds.y
        ) {
          hasDifferentBounds = true;
          break;
        }
      }

      expect(hasDifferentBounds).toBe(true);
    });
  });

  describe('Room-Module Mapping', () => {
    it('should map module types to room types correctly', () => {
      // Use larger building size to ensure all modules can be placed
      // (BSP needs enough space for leaves to accommodate all modules)
      const result = generateBuilding({
        repoId: 'test',
        commitSha: 'test',
        modules: sampleModules,
        buildingWidth: 128,
        buildingHeight: 128,
      });

      // Get rooms that have module types (excludes entrance room)
      const roomsWithModules = result.rooms.filter((r) => r.moduleType);

      // Verify that modules are being assigned to rooms
      expect(roomsWithModules.length).toBeGreaterThan(0);
      expect(roomsWithModules.length).toBeLessThanOrEqual(sampleModules.length);

      // Check that at least some module types are correctly mapped
      const componentRooms = result.rooms.filter((r) => r.moduleType === 'component');
      const utilityRooms = result.rooms.filter((r) => r.moduleType === 'utility');

      // Component and utility are most common - should have at least one of each
      expect(componentRooms.length + utilityRooms.length).toBeGreaterThan(0);

      // Check room type mappings for rooms that exist
      for (const room of componentRooms) {
        expect(room.roomType).toBe('workspace');
      }
      for (const room of utilityRooms) {
        expect(room.roomType).toBe('library');
      }

      // Service rooms map to workspace
      const serviceRooms = result.rooms.filter((r) => r.moduleType === 'service');
      for (const room of serviceRooms) {
        expect(room.roomType).toBe('workspace');
      }

      // Test rooms map to laboratory
      const testRooms = result.rooms.filter((r) => r.moduleType === 'test');
      for (const room of testRooms) {
        expect(room.roomType).toBe('laboratory');
      }
    });

    it('should preserve module metadata in rooms', () => {
      const result = generateBuilding({
        repoId: 'test',
        commitSha: 'test',
        modules: sampleModules,
        buildingWidth: 64,
        buildingHeight: 64,
      });

      for (const room of result.rooms) {
        if (room.moduleType) {
          expect(room.fileCount).toBeDefined();
          expect(room.totalSize).toBeDefined();
          expect(room.complexity).toBeDefined();
          expect(room.modulePath).toBeDefined();
        }
      }
    });
  });

  describe('Tilemap Generation', () => {
    it('should generate valid tilemap', () => {
      const result = generateBuilding({
        repoId: 'test',
        commitSha: 'test',
        modules: sampleModules,
        buildingWidth: 48,
        buildingHeight: 48,
      });

      expect(result.tilemap.width).toBe(48);
      expect(result.tilemap.height).toBe(48);
      expect(result.tilemap.layers.length).toBeGreaterThan(0);
      expect(result.tilemap.collision.length).toBe(48 * 48);
    });

    it('should have passable floors in rooms', () => {
      const result = generateBuilding({
        repoId: 'test',
        commitSha: 'test',
        modules: sampleModules,
        buildingWidth: 48,
        buildingHeight: 48,
      });

      const { tilemap, rooms } = result;

      for (const room of rooms) {
        const { bounds } = room;

        // Check center of room is passable
        const centerX = Math.floor(bounds.x + bounds.width / 2);
        const centerY = Math.floor(bounds.y + bounds.height / 2);
        const idx = centerY * tilemap.width + centerX;

        expect(tilemap.collision[idx]).toBe(false);
      }
    });

    it('should have passable corridors', () => {
      const result = generateBuilding({
        repoId: 'test',
        commitSha: 'test',
        modules: sampleModules,
        buildingWidth: 48,
        buildingHeight: 48,
      });

      const { tilemap, corridors } = result;

      for (const corridor of corridors) {
        for (const point of corridor.path) {
          const x = Math.round(point.x);
          const y = Math.round(point.y);

          if (x >= 0 && x < tilemap.width && y >= 0 && y < tilemap.height) {
            const idx = y * tilemap.width + x;
            expect(tilemap.collision[idx]).toBe(false);
          }
        }
      }
    });
  });

  describe('Building Size Calculation', () => {
    it('should calculate appropriate size for modules', () => {
      const size = calculateBuildingSize(sampleModules);

      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
      expect(size.width).toBe(size.height); // Should be square
    });

    it('should scale with module count', () => {
      const fewModules = sampleModules.slice(0, 2);
      const manyModules = [...sampleModules, ...sampleModules, ...sampleModules];

      const smallSize = calculateBuildingSize(fewModules);
      const largeSize = calculateBuildingSize(manyModules);

      expect(largeSize.width).toBeGreaterThan(smallSize.width);
    });

    it('should respect min and max bounds', () => {
      const size = calculateBuildingSize(sampleModules);

      expect(size.width).toBeGreaterThanOrEqual(40);
      expect(size.width).toBeLessThanOrEqual(120);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single module', () => {
      const result = generateBuilding({
        repoId: 'test',
        commitSha: 'test',
        modules: [sampleModules[0]],
        buildingWidth: 32,
        buildingHeight: 32,
      });

      expect(result.rooms.length).toBeGreaterThan(0);
      expect(validateConnectivity(result.rooms, result.corridors)).toBe(true);
    });

    it('should handle many modules', () => {
      const manyModules: ModuleInfo[] = Array.from({ length: 30 }, (_, i) => ({
        path: `module-${i}`,
        name: `Module ${i}`,
        type: 'service',
        fileCount: 5,
        totalSize: 2000,
        complexity: 5,
        imports: [],
        exports: [],
      }));

      const result = generateBuilding({
        repoId: 'test',
        commitSha: 'test',
        modules: manyModules,
        buildingWidth: 96,
        buildingHeight: 96,
      });

      expect(result.rooms.length).toBeGreaterThan(10);
      expect(validateConnectivity(result.rooms, result.corridors)).toBe(true);
    });

    it('should handle small building space', () => {
      const result = generateBuilding({
        repoId: 'test',
        commitSha: 'test',
        modules: sampleModules.slice(0, 3),
        buildingWidth: 24,
        buildingHeight: 24,
      });

      expect(result).toBeDefined();
      expect(result.rooms.length).toBeGreaterThan(0);
    });

    it('should handle large building space', () => {
      const result = generateBuilding({
        repoId: 'test',
        commitSha: 'test',
        modules: sampleModules,
        buildingWidth: 128,
        buildingHeight: 128,
      });

      expect(result).toBeDefined();
      expect(result.rooms.length).toBeGreaterThan(0);
    });
  });

  describe('Properties', () => {
    it('should include metadata in tilemap properties', () => {
      const result = generateBuilding({
        repoId: 'test',
        commitSha: 'test',
        modules: sampleModules,
        buildingWidth: 48,
        buildingHeight: 48,
      });

      expect(result.tilemap.properties).toBeDefined();
      expect(result.tilemap.properties.roomCount).toBe(result.rooms.length);
      expect(result.tilemap.properties.corridorCount).toBe(result.corridors.length);
    });

    it('should maintain consistent IDs', () => {
      const result = generateBuilding({
        repoId: 'test',
        commitSha: 'test',
        modules: sampleModules,
        buildingWidth: 48,
        buildingHeight: 48,
      });

      const roomIds = new Set(result.rooms.map((r) => r.id));
      const corridorRoomIds = new Set<string>();

      for (const corridor of result.corridors) {
        corridorRoomIds.add(corridor.fromRoomId);
        corridorRoomIds.add(corridor.toRoomId);
      }

      // All corridor room IDs should reference actual rooms
      for (const id of corridorRoomIds) {
        expect(roomIds.has(id)).toBe(true);
      }
    });
  });
});
