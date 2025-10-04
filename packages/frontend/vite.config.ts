import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
const backend = process.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Ensure TS source is used during Vite build to avoid CJS interop issues
      '@shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@sentry/browser': path.resolve(__dirname, 'src/observability/sentry.browser.stub.ts'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('phaser')) return 'vendor-phaser';
            if (id.match(/react|scheduler|react-dom/)) return 'vendor-react';
            if (id.includes('zustand') || id.includes('mitt') || id.includes('zod'))
              return 'vendor-utils';
            return 'vendor';
          }
          if (id.includes(`${path.sep}src${path.sep}scenes${path.sep}`)) return 'scene-chunk';
        },
      },
    },
  },
  server: {
    fs: {
      // Allow serving files from the project root
      allow: [path.resolve(__dirname, '..', '..')],
    },
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/auth': { target: backend, changeOrigin: true },
    },
  },
});
