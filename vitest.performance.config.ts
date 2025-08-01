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
    name: 'performance',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts', './src/tests/performance/setup.ts'],
    include: ['src/tests/performance/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 120000, // Performance tests can take much longer
    hookTimeout: 30000,
    teardownTimeout: 15000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Performance tests need consistent execution environment
        minThreads: 1,
        maxThreads: 1,
      },
    },
    logHeapUsage: true,
    reporters: ['verbose', 'json'],
    retry: 0, // No retries for performance tests to get consistent results
    sequence: {
      shuffle: false, // Deterministic order for performance comparisons
    },
  },
});