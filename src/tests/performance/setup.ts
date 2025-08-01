/**
 * Performance test setup - Additional setup for performance benchmarking
 */

import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  // High-resolution timer mock for performance measurements
  const startTime = performance.now();
  
  global.performance.now = vi.fn(() => {
    return Date.now() - startTime;
  });

  // Mock performance.mark for detailed performance tracking
  const marks = new Map<string, number>();
  global.performance.mark = vi.fn((name: string) => {
    marks.set(name, performance.now());
  });

  // Mock performance.measure for performance intervals
  global.performance.measure = vi.fn((name: string, startMark?: string, endMark?: string) => {
    const startTime = startMark ? marks.get(startMark) || 0 : 0;
    const endTime = endMark ? marks.get(endMark) || performance.now() : performance.now();
    return {
      name,
      duration: endTime - startTime,
      startTime,
    };
  });

  // Mock performance.getEntriesByName
  global.performance.getEntriesByName = vi.fn((name: string) => {
    return [{
      name,
      duration: 100, // Mock duration
      startTime: performance.now(),
      entryType: 'measure',
    }];
  });

  // Mock requestIdleCallback for background processing tests
  global.requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
    const id = setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => 50, // Mock 50ms remaining
      });
    }, 0);
    return id as any;
  });

  global.cancelIdleCallback = vi.fn((id: number) => {
    clearTimeout(id);
  });

  // Mock requestAnimationFrame for rendering performance tests
  let rafId = 0;
  global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = ++rafId;
    setTimeout(() => callback(performance.now()), 16); // ~60fps
    return id;
  });

  global.cancelAnimationFrame = vi.fn((id: number) => {
    // Mock cancellation
  });

  // Mock memory usage tracking
  Object.defineProperty(performance, 'memory', {
    value: {
      get usedJSHeapSize() { return 1024 * 1024; }, // 1MB
      get totalJSHeapSize() { return 2 * 1024 * 1024; }, // 2MB
      get jsHeapSizeLimit() { return 4 * 1024 * 1024; }, // 4MB
    },
    writable: true,
  });

  // Mock Worker for background processing tests
  global.Worker = class MockWorker extends EventTarget {
    onmessage: ((this: Worker, ev: MessageEvent) => any) | null = null;
    onerror: ((this: Worker, ev: ErrorEvent) => any) | null = null;
    
    constructor(scriptURL: string | URL, options?: WorkerOptions) {
      super();
    }
    
    postMessage(message: any): void {
      // Mock worker message handling
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage(new MessageEvent('message', { data: message }));
        }
      }, 10);
    }
    
    terminate(): void {
      // Mock worker termination
    }
  } as any;
});