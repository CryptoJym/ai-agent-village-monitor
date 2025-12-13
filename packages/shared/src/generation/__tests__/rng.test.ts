/**
 * Tests for Seeded Random Number Generator
 * Verifies determinism and distribution
 */

import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../rng';

describe('SeededRNG', () => {
  describe('Determinism', () => {
    it('should produce same sequence with same seed', () => {
      const seed = 'test-seed-123';
      const rng1 = new SeededRNG(seed);
      const rng2 = new SeededRNG(seed);

      const sequence1 = Array.from({ length: 10 }, () => rng1.next());
      const sequence2 = Array.from({ length: 10 }, () => rng2.next());

      expect(sequence1).toEqual(sequence2);
    });

    it('should produce different sequences with different seeds', () => {
      const rng1 = new SeededRNG('seed-1');
      const rng2 = new SeededRNG('seed-2');

      const sequence1 = Array.from({ length: 10 }, () => rng1.next());
      const sequence2 = Array.from({ length: 10 }, () => rng2.next());

      expect(sequence1).not.toEqual(sequence2);
    });

    it('should reset to initial state', () => {
      const seed = 'reset-test';
      const rng = new SeededRNG(seed);

      const initial = Array.from({ length: 5 }, () => rng.next());
      rng.reset();
      const afterReset = Array.from({ length: 5 }, () => rng.next());

      expect(initial).toEqual(afterReset);
    });

    it('should generate same repo building with same commit SHA', () => {
      const repoId = 'owner/repo';
      const commitSha = 'abc123def456';

      const rng1 = SeededRNG.fromRepoMetadata(repoId, commitSha);
      const rng2 = SeededRNG.fromRepoMetadata(repoId, commitSha);

      const sequence1 = Array.from({ length: 20 }, () => rng1.next());
      const sequence2 = Array.from({ length: 20 }, () => rng2.next());

      expect(sequence1).toEqual(sequence2);
    });
  });

  describe('next()', () => {
    it('should generate numbers between 0 and 1', () => {
      const rng = new SeededRNG('test');

      for (let i = 0; i < 100; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it('should have reasonable distribution', () => {
      const rng = new SeededRNG('distribution-test');
      const buckets = new Array(10).fill(0);

      for (let i = 0; i < 1000; i++) {
        const val = rng.next();
        const bucket = Math.floor(val * 10);
        buckets[bucket]++;
      }

      // Each bucket should have roughly 100 values (within 40%)
      for (const count of buckets) {
        expect(count).toBeGreaterThan(60);
        expect(count).toBeLessThan(140);
      }
    });
  });

  describe('nextInt()', () => {
    it('should generate integers in range [min, max] inclusive', () => {
      const rng = new SeededRNG('int-test');
      const min = 5;
      const max = 15;

      for (let i = 0; i < 100; i++) {
        const val = rng.nextInt(min, max);
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(min);
        expect(val).toBeLessThanOrEqual(max);
      }
    });

    it('should handle single value range', () => {
      const rng = new SeededRNG('single');
      const val = rng.nextInt(7, 7);
      expect(val).toBe(7);
    });
  });

  describe('nextFloat()', () => {
    it('should generate floats in range [min, max)', () => {
      const rng = new SeededRNG('float-test');
      const min = 10.5;
      const max = 20.7;

      for (let i = 0; i < 100; i++) {
        const val = rng.nextFloat(min, max);
        expect(val).toBeGreaterThanOrEqual(min);
        expect(val).toBeLessThan(max);
      }
    });
  });

  describe('nextBoolean()', () => {
    it('should generate booleans with default 50% probability', () => {
      const rng = new SeededRNG('bool-test');
      const results = Array.from({ length: 1000 }, () => rng.nextBoolean());

      const trueCount = results.filter((v) => v).length;
      expect(trueCount).toBeGreaterThan(400);
      expect(trueCount).toBeLessThan(600);
    });

    it('should respect custom probability', () => {
      const rng = new SeededRNG('prob-test');
      const results = Array.from({ length: 1000 }, () => rng.nextBoolean(0.8));

      const trueCount = results.filter((v) => v).length;
      expect(trueCount).toBeGreaterThan(700); // Should be around 80%
      expect(trueCount).toBeLessThan(900);
    });
  });

  describe('pick()', () => {
    it('should pick random element from array', () => {
      const rng = new SeededRNG('pick-test');
      const arr = ['a', 'b', 'c', 'd', 'e'];

      for (let i = 0; i < 20; i++) {
        const val = rng.pick(arr);
        expect(arr).toContain(val);
      }
    });

    it('should throw on empty array', () => {
      const rng = new SeededRNG('empty');
      expect(() => rng.pick([])).toThrow();
    });

    it('should have reasonable distribution', () => {
      const rng = new SeededRNG('pick-dist');
      const arr = ['a', 'b', 'c'];
      const counts: Record<string, number> = { a: 0, b: 0, c: 0 };

      for (let i = 0; i < 300; i++) {
        const val = rng.pick(arr);
        counts[val]++;
      }

      // Each should be picked roughly 100 times
      expect(counts.a).toBeGreaterThan(70);
      expect(counts.a).toBeLessThan(130);
      expect(counts.b).toBeGreaterThan(70);
      expect(counts.b).toBeLessThan(130);
      expect(counts.c).toBeGreaterThan(70);
      expect(counts.c).toBeLessThan(130);
    });
  });

  describe('shuffle()', () => {
    it('should shuffle array in-place', () => {
      const rng = new SeededRNG('shuffle-test');
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const original = [...arr];

      const result = rng.shuffle(arr);

      expect(result).toBe(arr); // Same reference
      // Check same elements (sort copies before comparing to avoid mutating result)
      expect([...result].sort((a, b) => a - b)).toEqual([...original].sort((a, b) => a - b));
      // Check that at least some elements moved (shuffle changed something)
      // With 10 elements and a seeded RNG, it's extremely unlikely to be identical
      let changedPositions = 0;
      for (let i = 0; i < result.length; i++) {
        if (result[i] !== original[i]) changedPositions++;
      }
      expect(changedPositions).toBeGreaterThan(0); // At least one element moved
    });

    it('should be deterministic', () => {
      const seed = 'shuffle-det';
      const arr1 = [1, 2, 3, 4, 5];
      const arr2 = [1, 2, 3, 4, 5];

      const rng1 = new SeededRNG(seed);
      const rng2 = new SeededRNG(seed);

      rng1.shuffle(arr1);
      rng2.shuffle(arr2);

      expect(arr1).toEqual(arr2);
    });
  });

  describe('shuffled()', () => {
    it('should return shuffled copy without modifying original', () => {
      const rng = new SeededRNG('shuffled-test');
      const arr = [1, 2, 3, 4, 5];
      const original = [...arr];

      const result = rng.shuffled(arr);

      expect(arr).toEqual(original); // Original unchanged
      expect(result).not.toBe(arr); // Different reference
      expect(result.sort()).toEqual(original.sort()); // Same elements
    });
  });

  describe('weightedPick()', () => {
    it('should pick based on weights', () => {
      const rng = new SeededRNG('weighted-test');
      const options = ['common', 'rare', 'epic'];
      const weights = [0.7, 0.25, 0.05]; // 70%, 25%, 5%

      const counts: Record<string, number> = { common: 0, rare: 0, epic: 0 };

      for (let i = 0; i < 1000; i++) {
        const val = rng.weightedPick(options, weights);
        counts[val]++;
      }

      // Check rough distribution
      expect(counts.common).toBeGreaterThan(600);
      expect(counts.common).toBeLessThan(800);
      expect(counts.rare).toBeGreaterThan(150);
      expect(counts.rare).toBeLessThan(350);
      expect(counts.epic).toBeGreaterThan(10);
      expect(counts.epic).toBeLessThan(100);
    });

    it('should throw on mismatched lengths', () => {
      const rng = new SeededRNG('mismatch');
      expect(() => rng.weightedPick(['a', 'b'], [1])).toThrow();
    });

    it('should throw on empty options', () => {
      const rng = new SeededRNG('empty');
      expect(() => rng.weightedPick([], [])).toThrow();
    });
  });

  describe('generateSeed()', () => {
    it('should combine parts into seed string', () => {
      const seed = SeededRNG.generateSeed('repo', '123', 'commit');
      expect(seed).toBe('repo-123-commit');
    });

    it('should handle numbers and bigints', () => {
      const seed = SeededRNG.generateSeed('owner/repo', 12345n, 'abc123');
      expect(seed).toContain('12345');
    });
  });

  describe('fromRepoMetadata()', () => {
    it('should create RNG from repo metadata', () => {
      const rng = SeededRNG.fromRepoMetadata('owner/repo', 'abc123');
      expect(rng).toBeInstanceOf(SeededRNG);
      expect(rng.getSeed()).toContain('owner/repo');
      expect(rng.getSeed()).toContain('abc123');
    });

    it('should use default when no commit SHA', () => {
      const rng = SeededRNG.fromRepoMetadata('owner/repo');
      expect(rng).toBeInstanceOf(SeededRNG);
      expect(rng.getSeed()).toContain('default');
    });
  });
});
