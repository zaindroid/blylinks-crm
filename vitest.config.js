import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    environmentMatchGlobs: [
      ['server/**', 'node']
    ],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 15000,
    hookTimeout: 30000,
    // Server tests share one Postgres instance and a couple of files rely on
    // running before any other file has inserted a user (bootstrap semantics) --
    // keep file execution sequential rather than fighting that with more setup.
    fileParallelism: false
  }
});
