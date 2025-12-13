/**
 * Jest configuration for backend testing
 *
 * Note: This project primarily uses Vitest (see vitest.config.ts).
 * This Jest config is provided as an alternative for teams preferring Jest.
 *
 * To use Jest instead of Vitest:
 * 1. Install: pnpm add -D jest ts-jest @types/jest jest-mock-extended
 * 2. Update package.json scripts to use jest instead of vitest
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Root directory
  rootDir: '.',

  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/test/**/*.test.ts',
  ],

  // TypeScript configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },

  // Module paths
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}',
    '!src/types/**',
    '!src/index.ts',
  ],

  coverageThresholds: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
  ],

  // Test timeout
  testTimeout: 10000,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],

  // Globals
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
};
