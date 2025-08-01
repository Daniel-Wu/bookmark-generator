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
    name: 'a11y',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts', './src/tests/a11y/setup.ts'],
    include: ['src/tests/a11y/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 20000, // A11y tests can be slower due to axe scans
    hookTimeout: 10000,
    teardownTimeout: 5000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    logHeapUsage: true,
    reporters: ['verbose'],
    retry: 1, // A11y tests should be deterministic
  },
});
