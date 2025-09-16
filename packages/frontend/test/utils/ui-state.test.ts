import { describe, it, expect, beforeEach } from 'vitest';
import { readUIHash, writeUIHash } from '../../src/state/uiState';

describe('uiState hash serialize/parse', () => {
  beforeEach(() => {
    // reset hash and storage
    location.hash = '';
    try {
      localStorage.clear();
    } catch {}
  });

  it('round-trips agent/tab/cam', () => {
    writeUIHash({ agent: 'a-1', tab: 'control', cam: { x: 123, y: 456, z: 1.25 } });
    const got = readUIHash();
    expect(got.agent).toBe('a-1');
    expect(got.tab).toBe('control');
    expect(got.cam?.x).toBe(123);
    expect(got.cam?.y).toBe(456);
    expect(got.cam?.z).toBe(1.25);
  });

  it('handles missing/invalid gracefully', () => {
    location.hash = '#agent=&tab=bogus&cam=not,a,number';
    const got = readUIHash();
    expect(got.agent).toBeUndefined();
    expect(got.tab).toBeUndefined();
    expect(got.cam).toBeUndefined();
  });
});
