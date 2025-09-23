import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pixellabManifest,
  pixellabTileMetadata,
  pixellabInteriorMetadata,
} from '../../src/assets/pixellabManifest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(testDir, '..', '..', '..', '..');
const assetsRoot = join(projectRoot, 'packages', 'frontend', 'public', 'assets');

describe('pixellab asset metadata', () => {
  it('has matching directories for character manifests', () => {
    for (const [category, manifests] of Object.entries(pixellabManifest)) {
      for (const manifest of manifests) {
        const dir = join(assetsRoot, category === 'bugBots' ? 'bug-bots' : category, manifest.key);
        expect(existsSync(dir), `missing character asset dir: ${dir}`).toBe(true);
      }
    }
  });

  it('references tile metadata files that exist', () => {
    for (const [category, entries] of Object.entries(pixellabTileMetadata)) {
      for (const [key, meta] of Object.entries(entries)) {
        const dir = join(assetsRoot, 'tiles', category, key);
        expect(existsSync(dir), `missing tileset dir: ${dir}`).toBe(true);
        expect(existsSync(join(dir, meta.files.image)), `missing tileset image for ${key}`).toBe(
          true,
        );
        if (meta.files.definition) {
          expect(
            existsSync(join(dir, meta.files.definition)),
            `missing tileset definition for ${key}`,
          ).toBe(true);
        }
      }
    }
  });

  it('references interior props that exist', () => {
    for (const [theme, interior] of Object.entries(pixellabInteriorMetadata)) {
      const baseDir = join(assetsRoot, 'interiors', theme);
      expect(existsSync(baseDir), `missing interior dir: ${baseDir}`).toBe(true);
      for (const prop of interior.props) {
        const propPath = join(baseDir, prop.file);
        expect(existsSync(propPath), `missing interior prop ${prop.key} at ${propPath}`).toBe(true);
      }
    }
  });
});
