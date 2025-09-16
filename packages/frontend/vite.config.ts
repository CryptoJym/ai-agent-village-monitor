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
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@sentry/browser': path.resolve(__dirname, 'src/observability/sentry.browser.stub.ts'),
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
