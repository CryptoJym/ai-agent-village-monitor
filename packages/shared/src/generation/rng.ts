/**
 * Seeded Random Number Generator
 * Uses Prando for deterministic randomness
 * Same seed ALWAYS produces same sequence
 */
import Prando from 'prando';

export class SeededRNG {
  private prando: Prando;
  private seed: string;

  constructor(seed: string) {
    this.seed = seed;
    this.prando = new Prando(seed);
  }

  /**
   * Get the seed used for this RNG
   */
  getSeed(): string {
    return this.seed;
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.prando = new Prando(this.seed);
  }

  /**
   * Get next random number between 0 and 1
   */
  next(): number {
    return this.prando.next();
  }

  /**
   * Get next random integer in range [min, max] (inclusive)
   */
  nextInt(min: number, max: number): number {
    return this.prando.nextInt(min, max);
  }

  /**
   * Get next random float in range [min, max)
   */
  nextFloat(min: number, max: number): number {
    return min + this.prando.next() * (max - min);
  }

  /**
   * Get next random boolean with optional probability
   */
  nextBoolean(probability: number = 0.5): boolean {
    return this.prando.next() < probability;
  }

  /**
   * Pick a random element from an array
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array');
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Shuffle array in-place using Fisher-Yates
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Create a shuffled copy of an array
   */
  shuffled<T>(array: T[]): T[] {
    return this.shuffle([...array]);
  }

  /**
   * Get random value from weighted options
   * weights array should sum to 1, or will be normalized
   */
  weightedPick<T>(options: T[], weights: number[]): T {
    if (options.length !== weights.length) {
      throw new Error('Options and weights must have same length');
    }
    if (options.length === 0) {
      throw new Error('Cannot pick from empty options');
    }

    const total = weights.reduce((sum, w) => sum + w, 0);
    let random = this.next() * total;

    for (let i = 0; i < options.length; i++) {
      random -= weights[i];
      if (random <= 0) return options[i];
    }

    return options[options.length - 1];
  }

  /**
   * Generate a deterministic seed from multiple inputs
   */
  static generateSeed(...parts: (string | number | bigint)[]): string {
    return parts.map(p => String(p)).join('-');
  }

  /**
   * Create RNG from repo metadata for deterministic building generation
   */
  static fromRepoMetadata(repoId: string | bigint, commitSha?: string): SeededRNG {
    const seed = commitSha
      ? SeededRNG.generateSeed(repoId, commitSha)
      : SeededRNG.generateSeed(repoId, 'default');
    return new SeededRNG(seed);
  }
}

export default SeededRNG;
