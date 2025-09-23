import { describe, expect, it } from 'vitest';
import { AssetManager } from '../../src/assets/AssetManager';

describe('AssetManager interior helpers', () => {
  it('builds stable prop texture keys', () => {
    expect(AssetManager.interiorPropTextureKey('JavaScript', 'neon-planter')).toBe(
      'pixellabInterior:javascript:neon-planter',
    );
    expect(AssetManager.interiorPropTextureKey('commons', 'notice-board')).toBe(
      'pixellabInterior:commons:notice-board',
    );
  });
});
