/**
 * Integration test setup - Additional setup for integration tests
 */

import { beforeEach, vi } from 'vitest';
import { ImageData as NodeImageData } from 'canvas';

beforeEach(() => {
  // Mock localStorage for integration tests
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value.toString();
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      get length() {
        return Object.keys(store).length;
      },
      key: vi.fn((index: number) => Object.keys(store)[index] || null),
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Mock fetch for integration tests
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })
  );

  // Mock performance.now for consistent timing
  global.performance.now = vi.fn(() => Date.now());
  
  // Mock performance.mark and measure
  global.performance.mark = vi.fn();
  global.performance.measure = vi.fn();
  global.performance.getEntriesByName = vi.fn(() => []);

  // Ensure ImageData is available for integration tests
  if (typeof global.ImageData === 'undefined') {
    global.ImageData = NodeImageData as any;
  }
});