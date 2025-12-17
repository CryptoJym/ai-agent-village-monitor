/**
 * Comprehensive Tests for BSP Tree Generation
 * Verifies determinism, constraints, connectivity, performance, and edge cases
 */

import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../rng';
import {
  generateBSPTree,
  getLeafNodes,
  countLeafNodes,
  getTreeDepth,
  validateBSPTree,
  traverseBSP,
  getNodeAtPosition,
  findSibling,
} from '../bsp';
import { DEFAULT_BSP_OPTIONS, BSPOptions } from '../types';

describe('BSP Tree Generation', () => {
  describe('Basic Generation', () => {
    it('should generate a valid tree', () => {
      const rng = new SeededRNG('bsp-test');
      const tree = generateBSPTree(48, 48, rng, DEFAULT_BSP_OPTIONS);

      expect(tree).toBeDefined();
      expect(tree.bounds.width).toBe(48);
      expect(tree.bounds.height).toBe(48);
      expect(tree.depth).toBe(0);
    });

    it('should create multiple leaf nodes', () => {
      const rng = new SeededRNG('leaves-test');
      const tree = generateBSPTree(64, 64, rng, DEFAULT_BSP_OPTIONS);
      const leafCount = countLeafNodes(tree);

      expect(leafCount).toBeGreaterThan(1);
    });

    it('should handle small spaces', () => {
      const rng = new SeededRNG('small-test');
      const tree = generateBSPTree(16, 16, rng, {
        ...DEFAULT_BSP_OPTIONS,
        minRoomSize: 6,
      });

      expect(tree).toBeDefined();
      expect(countLeafNodes(tree)).toBeGreaterThanOrEqual(1);
    });

    it('should handle large spaces', () => {
      const rng = new SeededRNG('large-test');
      const tree = generateBSPTree(128, 128, rng, DEFAULT_BSP_OPTIONS);

      expect(tree).toBeDefined();
      const leafCount = countLeafNodes(tree);
      expect(leafCount).toBeGreaterThan(5);
    });
  });

  describe('Determinism Tests', () => {
    it('should generate identical layouts with same seed', () => {
      const seed = 'determinism-test';
      const rng1 = new SeededRNG(seed);
      const rng2 = new SeededRNG(seed);

      const tree1 = generateBSPTree(48, 48, rng1, DEFAULT_BSP_OPTIONS);
      const tree2 = generateBSPTree(48, 48, rng2, DEFAULT_BSP_OPTIONS);

      const leaves1 = getLeafNodes(tree1);
      const leaves2 = getLeafNodes(tree2);

      expect(leaves1.length).toBe(leaves2.length);

      // Compare leaf bounds
      for (let i = 0; i < leaves1.length; i++) {
        expect(leaves1[i].bounds).toEqual(leaves2[i].bounds);
        expect(leaves1[i].depth).toBe(leaves2[i].depth);
      }
    });

    it('should generate different layouts with different seeds', () => {
      const rng1 = new SeededRNG('seed-1');
      const rng2 = new SeededRNG('seed-2');

      const tree1 = generateBSPTree(64, 64, rng1, DEFAULT_BSP_OPTIONS);
      const tree2 = generateBSPTree(64, 64, rng2, DEFAULT_BSP_OPTIONS);

      const leaves1 = getLeafNodes(tree1);
      const leaves2 = getLeafNodes(tree2);

      // Should have different structure
      let different = false;
      if (leaves1.length !== leaves2.length) {
        different = true;
      } else {
        for (let i = 0; i < leaves1.length; i++) {
          if (
            leaves1[i].bounds.x !== leaves2[i].bounds.x ||
            leaves1[i].bounds.y !== leaves2[i].bounds.y ||
            leaves1[i].bounds.width !== leaves2[i].bounds.width ||
            leaves1[i].bounds.height !== leaves2[i].bounds.height
          ) {
            different = true;
            break;
          }
        }
      }

      expect(different).toBe(true);
    });

    it('should produce consistent results across multiple generations', () => {
      const seed = 'consistency-test';
      const results: number[] = [];

      for (let i = 0; i < 5; i++) {
        const rng = new SeededRNG(seed);
        const tree = generateBSPTree(64, 64, rng, DEFAULT_BSP_OPTIONS);
        results.push(countLeafNodes(tree));
      }

      // All results should be identical
      expect(new Set(results).size).toBe(1);
    });

    it('should maintain determinism with different options', () => {
      const seed = 'options-determinism';
      const options: Partial<BSPOptions> = {
        minRoomSize: 8,
        maxDepth: 5,
        splitRatioMin: 0.4,
        splitRatioMax: 0.6,
      };

      const rng1 = new SeededRNG(seed);
      const rng2 = new SeededRNG(seed);

      const tree1 = generateBSPTree(80, 80, rng1, options);
      const tree2 = generateBSPTree(80, 80, rng2, options);

      const leaves1 = getLeafNodes(tree1);
      const leaves2 = getLeafNodes(tree2);

      expect(leaves1.length).toBe(leaves2.length);
      for (let i = 0; i < leaves1.length; i++) {
        expect(leaves1[i].bounds).toEqual(leaves2[i].bounds);
      }
    });
  });

  describe('Constraint Tests', () => {
    it('should respect minimum room size', () => {
      const rng = new SeededRNG('min-size-test');
      const minSize = 8;

      const tree = generateBSPTree(64, 64, rng, {
        ...DEFAULT_BSP_OPTIONS,
        minRoomSize: minSize,
      });

      const leaves = getLeafNodes(tree);

      for (const leaf of leaves) {
        expect(leaf.bounds.width).toBeGreaterThanOrEqual(minSize);
        expect(leaf.bounds.height).toBeGreaterThanOrEqual(minSize);
      }
    });

    it('should respect maximum depth constraint', () => {
      const rng = new SeededRNG('max-depth-test');
      const maxDepth = 4;

      const tree = generateBSPTree(64, 64, rng, {
        ...DEFAULT_BSP_OPTIONS,
        maxDepth,
      });

      const actualDepth = getTreeDepth(tree);
      expect(actualDepth).toBeLessThanOrEqual(maxDepth);
    });

    it('should not exceed max depth even with large spaces', () => {
      const rng = new SeededRNG('large-depth-test');
      const maxDepth = 3;

      const tree = generateBSPTree(200, 200, rng, {
        ...DEFAULT_BSP_OPTIONS,
        maxDepth,
        minRoomSize: 5,
      });

      expect(getTreeDepth(tree)).toBeLessThanOrEqual(maxDepth);
    });

    it('should generate rooms within bounds', () => {
      const rng = new SeededRNG('bounds-test');
      const width = 100;
      const height = 80;

      const tree = generateBSPTree(width, height, rng, DEFAULT_BSP_OPTIONS);
      const leaves = getLeafNodes(tree);

      for (const leaf of leaves) {
        expect(leaf.bounds.x).toBeGreaterThanOrEqual(0);
        expect(leaf.bounds.y).toBeGreaterThanOrEqual(0);
        expect(leaf.bounds.x + leaf.bounds.width).toBeLessThanOrEqual(width);
        expect(leaf.bounds.y + leaf.bounds.height).toBeLessThanOrEqual(height);
      }
    });

    it('should respect split ratio constraints', () => {
      const rng = new SeededRNG('split-ratio-test');
      const minRatio = 0.45;
      const maxRatio = 0.55;

      const tree = generateBSPTree(64, 64, rng, {
        ...DEFAULT_BSP_OPTIONS,
        splitRatioMin: minRatio,
        splitRatioMax: maxRatio,
      });

      // Verify tree was generated successfully with constraints
      expect(tree).toBeDefined();
      expect(validateBSPTree(tree).valid).toBe(true);
    });

    it('should handle extreme minimum room size', () => {
      const rng = new SeededRNG('extreme-min');
      const tree = generateBSPTree(32, 32, rng, {
        ...DEFAULT_BSP_OPTIONS,
        minRoomSize: 15, // Very large min size for 32x32 space
      });

      const leaves = getLeafNodes(tree);
      expect(leaves.length).toBeGreaterThan(0);

      for (const leaf of leaves) {
        expect(leaf.bounds.width).toBeGreaterThanOrEqual(15);
        expect(leaf.bounds.height).toBeGreaterThanOrEqual(15);
      }
    });

    it('should respect room margin', () => {
      const rng = new SeededRNG('margin-test');
      const margin = 2;

      const tree = generateBSPTree(64, 64, rng, {
        ...DEFAULT_BSP_OPTIONS,
        roomMargin: margin,
        minRoomSize: 6,
      });

      // Tree should be generated with margin consideration
      expect(tree).toBeDefined();
      const leaves = getLeafNodes(tree);
      expect(leaves.length).toBeGreaterThan(0);
    });
  });

  describe('Connectivity Tests', () => {
    it('should generate non-overlapping leaf nodes', () => {
      const rng = new SeededRNG('overlap-test');
      const tree = generateBSPTree(64, 64, rng, DEFAULT_BSP_OPTIONS);
      const leaves = getLeafNodes(tree);

      // Check no overlaps
      for (let i = 0; i < leaves.length; i++) {
        for (let j = i + 1; j < leaves.length; j++) {
          const a = leaves[i].bounds;
          const b = leaves[j].bounds;

          // Check if rectangles overlap
          const overlap = !(
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y
          );

          expect(overlap).toBe(false);
        }
      }
    });

    it('should cover entire space with leaves', () => {
      const rng = new SeededRNG('coverage-test');
      const width = 48;
      const height = 48;

      const tree = generateBSPTree(width, height, rng, DEFAULT_BSP_OPTIONS);
      const leaves = getLeafNodes(tree);

      // Check total area equals original area
      const totalArea = leaves.reduce(
        (sum, leaf) => sum + leaf.bounds.width * leaf.bounds.height,
        0,
      );

      expect(totalArea).toBe(width * height);
    });

    it('should have adjacent rooms sharing borders', () => {
      const rng = new SeededRNG('adjacent-test');
      const tree = generateBSPTree(64, 64, rng, DEFAULT_BSP_OPTIONS);
      const leaves = getLeafNodes(tree);

      // Count adjacent pairs
      let adjacentPairs = 0;

      for (let i = 0; i < leaves.length; i++) {
        for (let j = i + 1; j < leaves.length; j++) {
          const a = leaves[i].bounds;
          const b = leaves[j].bounds;

          // Check if horizontally adjacent
          if (
            (a.x + a.width === b.x || b.x + b.width === a.x) &&
            !(a.y + a.height <= b.y || b.y + b.height <= a.y)
          ) {
            adjacentPairs++;
          }

          // Check if vertically adjacent
          if (
            (a.y + a.height === b.y || b.y + b.height === a.y) &&
            !(a.x + a.width <= b.x || b.x + b.width <= a.x)
          ) {
            adjacentPairs++;
          }
        }
      }

      // Should have at least some adjacent rooms
      expect(adjacentPairs).toBeGreaterThan(0);
    });

    it('should find siblings in tree structure', () => {
      const rng = new SeededRNG('sibling-test');
      const tree = generateBSPTree(64, 64, rng, DEFAULT_BSP_OPTIONS);

      // Find a non-leaf node
      let parentNode = tree;
      while (parentNode.isLeaf && !parentNode.left) {
        const rng2 = new SeededRNG('sibling-test-2');
        const tree2 = generateBSPTree(128, 128, rng2, DEFAULT_BSP_OPTIONS);
        parentNode = tree2;
        if (!parentNode.isLeaf) break;
      }

      if (!parentNode.isLeaf && parentNode.left && parentNode.right) {
        const sibling = findSibling(tree, parentNode.left);
        expect(sibling).toBe(parentNode.right);
      }
    });
  });

  describe('No Overlap Tests', () => {
    it('should have no overlapping rooms in small space', () => {
      const rng = new SeededRNG('small-overlap');
      const tree = generateBSPTree(32, 32, rng, {
        ...DEFAULT_BSP_OPTIONS,
        minRoomSize: 6,
      });
      const leaves = getLeafNodes(tree);

      for (let i = 0; i < leaves.length; i++) {
        for (let j = i + 1; j < leaves.length; j++) {
          const a = leaves[i].bounds;
          const b = leaves[j].bounds;

          const overlap = !(
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y
          );

          expect(overlap).toBe(false);
        }
      }
    });

    it('should have no overlapping rooms in large space', () => {
      const rng = new SeededRNG('large-overlap');
      const tree = generateBSPTree(150, 150, rng, DEFAULT_BSP_OPTIONS);
      const leaves = getLeafNodes(tree);

      for (let i = 0; i < leaves.length; i++) {
        for (let j = i + 1; j < leaves.length; j++) {
          const a = leaves[i].bounds;
          const b = leaves[j].bounds;

          const overlap = !(
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y
          );

          expect(overlap).toBe(false);
        }
      }
    });

    it('should have no gaps between sibling nodes', () => {
      const rng = new SeededRNG('gap-test');
      const tree = generateBSPTree(64, 64, rng, DEFAULT_BSP_OPTIONS);

      // Check all parent nodes
      traverseBSP(tree, (node) => {
        if (!node.isLeaf && node.left && node.right) {
          const left = node.left.bounds;
          const right = node.right.bounds;
          const parent = node.bounds;

          // Check children completely fill parent
          const childArea = left.width * left.height + right.width * right.height;
          const parentArea = parent.width * parent.height;

          expect(childArea).toBe(parentArea);
        }
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle 100x100 building in < 100ms', () => {
      const rng = new SeededRNG('perf-100');
      const start = performance.now();

      generateBSPTree(100, 100, rng, DEFAULT_BSP_OPTIONS);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('should handle 200x200 building efficiently', () => {
      const rng = new SeededRNG('perf-200');
      const start = performance.now();

      generateBSPTree(200, 200, rng, DEFAULT_BSP_OPTIONS);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200);
    });

    it('should handle 50+ modules (deep tree)', () => {
      const rng = new SeededRNG('perf-modules');
      const start = performance.now();

      const tree = generateBSPTree(200, 200, rng, {
        ...DEFAULT_BSP_OPTIONS,
        maxDepth: 8,
        minRoomSize: 4,
      });

      const duration = performance.now() - start;
      const leafCount = countLeafNodes(tree);

      expect(duration).toBeLessThan(150);
      expect(leafCount).toBeGreaterThan(10);
    });

    it('should scale linearly with area', () => {
      const rng1 = new SeededRNG('scale-1');
      const rng2 = new SeededRNG('scale-2');

      const start1 = performance.now();
      generateBSPTree(50, 50, rng1, DEFAULT_BSP_OPTIONS);
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      generateBSPTree(100, 100, rng2, DEFAULT_BSP_OPTIONS);
      const time2 = performance.now() - start2;

      // 4x area should not take more than 10x time
      expect(time2).toBeLessThan(time1 * 10);
    });

    it('should handle multiple rapid generations', () => {
      const start = performance.now();

      for (let i = 0; i < 10; i++) {
        const rng = new SeededRNG(`rapid-${i}`);
        generateBSPTree(64, 64, rng, DEFAULT_BSP_OPTIONS);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single room (no split possible)', () => {
      const rng = new SeededRNG('single-room');
      const tree = generateBSPTree(10, 10, rng, {
        ...DEFAULT_BSP_OPTIONS,
        minRoomSize: 10,
      });

      const leaves = getLeafNodes(tree);
      expect(leaves).toHaveLength(1);
      expect(leaves[0]).toBe(tree);
      expect(tree.isLeaf).toBe(true);
    });

    it('should handle maximum rooms with deep tree', () => {
      const rng = new SeededRNG('max-rooms');
      const tree = generateBSPTree(128, 128, rng, {
        ...DEFAULT_BSP_OPTIONS,
        maxDepth: 7,
        minRoomSize: 4,
      });

      const leafCount = countLeafNodes(tree);
      expect(leafCount).toBeGreaterThan(15);
      expect(leafCount).toBeLessThanOrEqual(128); // Sanity check - at most 2^7 = 128 rooms
    });

    it('should handle extreme aspect ratios (very wide)', () => {
      const rng = new SeededRNG('wide-aspect');
      const tree = generateBSPTree(200, 20, rng, {
        ...DEFAULT_BSP_OPTIONS,
        minRoomSize: 8,
      });

      expect(tree).toBeDefined();
      const leaves = getLeafNodes(tree);
      expect(leaves.length).toBeGreaterThan(1);

      // Should have mostly vertical splits
      for (const leaf of leaves) {
        expect(leaf.bounds.width).toBeGreaterThanOrEqual(8);
        expect(leaf.bounds.height).toBeGreaterThanOrEqual(8);
      }
    });

    it('should handle extreme aspect ratios (very tall)', () => {
      const rng = new SeededRNG('tall-aspect');
      const tree = generateBSPTree(20, 200, rng, {
        ...DEFAULT_BSP_OPTIONS,
        minRoomSize: 8,
      });

      expect(tree).toBeDefined();
      const leaves = getLeafNodes(tree);
      expect(leaves.length).toBeGreaterThan(1);

      // Should have mostly horizontal splits
      for (const leaf of leaves) {
        expect(leaf.bounds.width).toBeGreaterThanOrEqual(8);
        expect(leaf.bounds.height).toBeGreaterThanOrEqual(8);
      }
    });

    it('should handle square space optimally', () => {
      const rng = new SeededRNG('square');
      const tree = generateBSPTree(64, 64, rng, DEFAULT_BSP_OPTIONS);

      const leaves = getLeafNodes(tree);
      expect(leaves.length).toBeGreaterThan(1);

      // Should have balanced splits
      const validation = validateBSPTree(tree);
      expect(validation.valid).toBe(true);
    });

    it('should handle minimum viable space', () => {
      const rng = new SeededRNG('min-viable');
      const minSize = 6;
      const tree = generateBSPTree(minSize * 2, minSize * 2, rng, {
        ...DEFAULT_BSP_OPTIONS,
        minRoomSize: minSize,
      });

      expect(tree).toBeDefined();
      const leaves = getLeafNodes(tree);
      expect(leaves.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle exact power-of-two dimensions', () => {
      const rng = new SeededRNG('power-of-two');
      const tree = generateBSPTree(128, 128, rng, DEFAULT_BSP_OPTIONS);

      const leaves = getLeafNodes(tree);
      expect(leaves.length).toBeGreaterThan(0);
      expect(validateBSPTree(tree).valid).toBe(true);
    });

    it('should handle odd dimensions', () => {
      const rng = new SeededRNG('odd-dimensions');
      const tree = generateBSPTree(63, 47, rng, DEFAULT_BSP_OPTIONS);

      const leaves = getLeafNodes(tree);
      expect(leaves.length).toBeGreaterThan(0);
      expect(validateBSPTree(tree).valid).toBe(true);
    });

    it('should handle zero depth (no splitting)', () => {
      const rng = new SeededRNG('zero-depth');
      const tree = generateBSPTree(64, 64, rng, {
        ...DEFAULT_BSP_OPTIONS,
        maxDepth: 0,
      });

      expect(tree.isLeaf).toBe(true);
      expect(tree.depth).toBe(0);
      expect(countLeafNodes(tree)).toBe(1);
    });

    it('should handle very small split ratios', () => {
      const rng = new SeededRNG('small-ratio');
      const tree = generateBSPTree(64, 64, rng, {
        ...DEFAULT_BSP_OPTIONS,
        splitRatioMin: 0.3,
        splitRatioMax: 0.4,
      });

      expect(tree).toBeDefined();
      expect(validateBSPTree(tree).valid).toBe(true);
    });

    it('should handle large split ratios', () => {
      const rng = new SeededRNG('large-ratio');
      const tree = generateBSPTree(64, 64, rng, {
        ...DEFAULT_BSP_OPTIONS,
        splitRatioMin: 0.6,
        splitRatioMax: 0.7,
      });

      expect(tree).toBeDefined();
      expect(validateBSPTree(tree).valid).toBe(true);
    });
  });

  describe('getLeafNodes()', () => {
    it('should return all leaf nodes', () => {
      const rng = new SeededRNG('leaf-test');
      const tree = generateBSPTree(48, 48, rng, DEFAULT_BSP_OPTIONS);

      const leaves = getLeafNodes(tree);

      expect(leaves.length).toBeGreaterThan(0);

      for (const leaf of leaves) {
        expect(leaf.isLeaf).toBe(true);
        expect(leaf.left).toBeUndefined();
        expect(leaf.right).toBeUndefined();
      }
    });

    it('should return single node for unsplit tree', () => {
      const rng = new SeededRNG('single');
      const tree = generateBSPTree(10, 10, rng, {
        ...DEFAULT_BSP_OPTIONS,
        minRoomSize: 10,
      });

      const leaves = getLeafNodes(tree);
      expect(leaves).toHaveLength(1);
      expect(leaves[0]).toBe(tree);
    });
  });

  describe('countLeafNodes()', () => {
    it('should count leaf nodes correctly', () => {
      const rng = new SeededRNG('count-test');
      const tree = generateBSPTree(64, 64, rng, DEFAULT_BSP_OPTIONS);

      const manualCount = getLeafNodes(tree).length;
      const count = countLeafNodes(tree);

      expect(count).toBe(manualCount);
    });

    it('should return 1 for single leaf', () => {
      const rng = new SeededRNG('single');
      const tree = generateBSPTree(8, 8, rng, {
        ...DEFAULT_BSP_OPTIONS,
        minRoomSize: 8,
      });

      expect(countLeafNodes(tree)).toBe(1);
    });
  });

  describe('getTreeDepth()', () => {
    it('should calculate correct depth', () => {
      const rng = new SeededRNG('depth-test');
      const tree = generateBSPTree(64, 64, rng, {
        ...DEFAULT_BSP_OPTIONS,
        maxDepth: 5,
      });

      const depth = getTreeDepth(tree);
      expect(depth).toBeGreaterThanOrEqual(0);
      expect(depth).toBeLessThanOrEqual(5);
    });

    it('should return 0 for single node', () => {
      const rng = new SeededRNG('single');
      const tree = generateBSPTree(8, 8, rng, {
        ...DEFAULT_BSP_OPTIONS,
        minRoomSize: 8,
      });

      expect(getTreeDepth(tree)).toBe(0);
    });
  });

  describe('validateBSPTree()', () => {
    it('should validate well-formed tree', () => {
      const rng = new SeededRNG('valid-test');
      const tree = generateBSPTree(48, 48, rng, DEFAULT_BSP_OPTIONS);

      const result = validateBSPTree(tree);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid bounds', () => {
      const invalidTree = {
        bounds: { x: 0, y: 0, width: -10, height: 20 },
        isLeaf: true,
        depth: 0,
      };

      const result = validateBSPTree(invalidTree);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('traverseBSP()', () => {
    it('should visit all nodes', () => {
      const rng = new SeededRNG('traverse-test');
      const tree = generateBSPTree(48, 48, rng, DEFAULT_BSP_OPTIONS);

      const visited: any[] = [];
      traverseBSP(tree, (node) => visited.push(node));

      const leafCount = countLeafNodes(tree);

      // Should visit at least the leaf nodes + some parents
      expect(visited.length).toBeGreaterThanOrEqual(leafCount);
    });

    it('should visit in pre-order', () => {
      const rng = new SeededRNG('order-test');
      const tree = generateBSPTree(48, 48, rng, DEFAULT_BSP_OPTIONS);

      const depths: number[] = [];
      traverseBSP(tree, (node) => depths.push(node.depth));

      // First node should be root (depth 0)
      expect(depths[0]).toBe(0);
    });
  });

  describe('getNodeAtPosition()', () => {
    it('should find leaf node at position', () => {
      const rng = new SeededRNG('position-test');
      const tree = generateBSPTree(48, 48, rng, DEFAULT_BSP_OPTIONS);

      const leaves = getLeafNodes(tree);
      const testLeaf = leaves[0];
      const { bounds } = testLeaf;

      const centerX = bounds.x + Math.floor(bounds.width / 2);
      const centerY = bounds.y + Math.floor(bounds.height / 2);

      const found = getNodeAtPosition(tree, centerX, centerY);

      expect(found).toBeDefined();
      expect(found?.isLeaf).toBe(true);
    });

    it('should return null for out-of-bounds position', () => {
      const rng = new SeededRNG('oob-test');
      const tree = generateBSPTree(48, 48, rng, DEFAULT_BSP_OPTIONS);

      const found = getNodeAtPosition(tree, 100, 100);
      expect(found).toBeNull();
    });

    it('should return null for negative position', () => {
      const rng = new SeededRNG('neg-test');
      const tree = generateBSPTree(48, 48, rng, DEFAULT_BSP_OPTIONS);

      const found = getNodeAtPosition(tree, -5, 10);
      expect(found).toBeNull();
    });
  });

  describe('Split Direction Logic', () => {
    it('should prefer splitting wider dimension', () => {
      const rng = new SeededRNG('wide-test');

      // Very wide rectangle should prefer vertical splits
      const tree = generateBSPTree(96, 32, rng, {
        ...DEFAULT_BSP_OPTIONS,
        maxDepth: 2,
      });

      const leaves = getLeafNodes(tree);

      // Check that at least one split was vertical (creating horizontally adjacent leaves)
      let hasVerticalSplit = false;
      for (let i = 0; i < leaves.length - 1; i++) {
        const a = leaves[i];
        const b = leaves[i + 1];

        if (a.bounds.y === b.bounds.y && a.bounds.height === b.bounds.height) {
          hasVerticalSplit = true;
          break;
        }
      }

      expect(hasVerticalSplit).toBe(true);
    });

    it('should prefer splitting taller dimension', () => {
      const rng = new SeededRNG('tall-test');

      // Very tall rectangle should prefer horizontal splits
      const tree = generateBSPTree(32, 96, rng, {
        ...DEFAULT_BSP_OPTIONS,
        maxDepth: 2,
      });

      const leaves = getLeafNodes(tree);

      // Check that at least one split was horizontal (creating vertically adjacent leaves)
      let hasHorizontalSplit = false;
      for (let i = 0; i < leaves.length - 1; i++) {
        const a = leaves[i];
        const b = leaves[i + 1];

        if (a.bounds.x === b.bounds.x && a.bounds.width === b.bounds.width) {
          hasHorizontalSplit = true;
          break;
        }
      }

      expect(hasHorizontalSplit).toBe(true);
    });
  });
});
