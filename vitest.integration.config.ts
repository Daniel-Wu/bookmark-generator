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
    name: 'integration',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts', './src/tests/integration/setup.ts'],
    include: ['src/tests/integration/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 30000,
    hookTimeout: 15000,
    teardownTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/integration',
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'src/vite-env.d.ts',
        'src/main.tsx',
      ],
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Integration tests may have shared state
      },
    },
    logHeapUsage: true,
    reporters: ['verbose'],
    retry: 2, // Retry flaky integration tests
  },
});
