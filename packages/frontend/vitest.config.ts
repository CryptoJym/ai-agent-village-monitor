import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
      // Stub Phaser in tests to avoid Canvas dependency in jsdom
      phaser: path.resolve(__dirname, 'test/stubs/phaser.ts'),
    },
  },
});
