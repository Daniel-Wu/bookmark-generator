/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './src/tests'),
    },
  },
  test: {
    name: 'e2e',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts', './src/tests/e2e/setup.ts'],
    include: ['src/tests/e2e/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 60000, // E2E tests can take longer
    hookTimeout: 30000,
    teardownTimeout: 15000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // E2E tests should run sequentially
      },
    },
    logHeapUsage: true,
    reporters: ['verbose'],
    retry: 3, // E2E tests are more prone to flakiness
    bail: 1, // Stop on first failure for faster feedback
  },
});
