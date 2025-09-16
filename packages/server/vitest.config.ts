import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Enable coverage in CI or when VITEST_COVERAGE=true is set locally
      enabled: process.env.CI === 'true' || process.env.VITEST_COVERAGE === 'true',
      thresholds: {
        lines: 0.8,
        functions: 0.8,
        statements: 0.8,
        branches: 0.7,
      },
      exclude: ['src/__tests__/**', 'test/**'],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
