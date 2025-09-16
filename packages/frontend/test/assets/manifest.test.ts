import { describe, it, expect } from 'vitest';
import { manifest } from '../../src/assets/manifest';
import { hashTint } from '../../src/assets/AssetManager';

describe('assets manifest and utilities', () => {
  it('provides a valid manifest shape', () => {
    expect(manifest).toHaveProperty('atlases');
    expect(manifest).toHaveProperty('images');
    expect(manifest).toHaveProperty('audio');
    expect(manifest).toHaveProperty('sheets');
    expect(Array.isArray(manifest.atlases)).toBe(true);
    expect(Array.isArray(manifest.images)).toBe(true);
    expect(Array.isArray(manifest.audio)).toBe(true);
    expect(Array.isArray(manifest.sheets)).toBe(true);
  });

  it('hashTint is deterministic and within range', () => {
    const a = hashTint('agent-123');
    const b = hashTint('agent-123');
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(0xffffff + 1);
  });
});
