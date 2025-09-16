// ESLint v9 flat config for monorepo
const js = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');
const globals = require('globals');

const compat = new FlatCompat({ baseDirectory: __dirname, recommendedConfig: js.configs.recommended });

module.exports = [
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.vite/**',
      '**/coverage/**',
      '**/generated/**',
    ],
  },

  // Global language options (Node + modern JS globals)
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2021 },
    },
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules (scoped to TS files)
  ...compat
    .extends('plugin:@typescript-eslint/recommended')
    .map((c) => ({ ...c, files: ['**/*.ts', '**/*.tsx'] })),

  // React only within frontend package
  {
    files: ['packages/frontend/**/*.{ts,tsx,js,jsx}'],
    settings: { react: { version: 'detect' } },
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
  ...compat
    .extends('plugin:react/recommended')
    .map((c) => ({ ...c, files: ['packages/frontend/**/*.{ts,tsx,js,jsx}'] })),
  ...compat
    .extends('plugin:react-hooks/recommended')
    .map((c) => ({ ...c, files: ['packages/frontend/**/*.{ts,tsx,js,jsx}'] })),

  // Project-tuned rule adjustments
  {
    rules: {
      // Avoid failing the repo on empty catch/blocks during early development
      'no-empty': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'prefer-const': 'warn',
    },
  },
  // Service worker globals
  {
    files: ['packages/frontend/public/sw.js'],
    languageOptions: {
      globals: { ...globals.serviceworker },
    },
  },
  // React rule adjustment after plugin presets
  {
    files: ['packages/frontend/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'warn',
    },
  },
  // TS rule adjustments (after presets)
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  // Frontend tests: relax Function type restriction
  {
    files: ['packages/frontend/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },
  // k6 load test globals
  {
    files: ['packages/server/load/**/*.js'],
    languageOptions: {
      globals: { __ENV: 'readonly', __VU: 'readonly', ...globals.es2021 },
    },
  },
  // Server scripts: soften unused vars
  {
    files: ['packages/server/scripts/**/*.js'],
    rules: { 'no-unused-vars': 'warn' },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
