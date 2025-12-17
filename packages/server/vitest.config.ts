import { defineConfig } from 'vitest/config';
import path from 'path';

const isIntegrationRun = process.env.VITEST_SUITE === 'integration';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['test/setup.ts'],
    pool: 'forks',
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html', 'json'],
      // Enable coverage in CI or when VITEST_COVERAGE=true is set locally
      enabled: process.env.CI === 'true' || process.env.VITEST_COVERAGE === 'true',
      include: ['src/**/*.{ts,js}'],
      exclude: [
        'src/__tests__/**',
        'src/**/*.test.{ts,js}',
        'src/**/*.spec.{ts,js}',
        'src/index.ts',
        'src/**/*.d.ts',
        'src/types/**',
        'src/db.ts',
        'src/config.ts',
        'test/**',
      ],
      thresholds: isIntegrationRun
        ? {
            // Integration runs report coverage, but shouldn't gate on global thresholds.
            lines: 0,
            functions: 0,
            statements: 0,
            branches: 0,
          }
        : {
            // Legacy server surface area is large; enforce gradual improvement instead of blocking CI
            lines: 40,
            functions: 40,
            statements: 40,
            branches: 35,
          },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
