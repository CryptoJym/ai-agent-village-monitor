import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    pool: 'threads',
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html', 'json'],
      // Coverage is expensive in jsdom-heavy suites; enable explicitly when needed.
      enabled: process.env.VITEST_COVERAGE === 'true',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/main.tsx',
        'src/swRegister.ts',
        'src/i18n/**',
        'src/**/*.d.ts',
        'src/types/**',
        'test/**',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
      // Stub Phaser in tests to avoid Canvas dependency in jsdom
      phaser: path.resolve(__dirname, 'test/stubs/phaser.ts'),
      // Stub optional Spector integration pulled by Phaser's WebGLRenderer
      phaser3spectorjs: path.resolve(__dirname, 'test/stubs/phaser3spectorjs.ts'),
    },
  },
});
