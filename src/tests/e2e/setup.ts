/**
 * E2E test setup - Additional setup for end-to-end tests
 */

import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  // Mock browser APIs that might not be available in JSDOM
  global.navigator.clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  } as any;

  // Mock window.print
  global.print = vi.fn();

  // Mock window.open
  global.open = vi.fn().mockReturnValue({
    close: vi.fn(),
    focus: vi.fn(),
    document: {
      write: vi.fn(),
      close: vi.fn(),
    },
  } as any);

  // Mock MediaDevices for potential camera access
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [
          {
            stop: vi.fn(),
            getSettings: () => ({ width: 640, height: 480 }),
          },
        ],
      }),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
    writable: true,
  });

  // Mock Notification API
  global.Notification = class MockNotification {
    static permission = 'granted';
    static requestPermission = vi.fn().mockResolvedValue('granted');
    
    constructor(title: string, options?: NotificationOptions) {
      // Mock notification
    }
    
    close = vi.fn();
  } as any;

  // Mock geolocation
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
    writable: true,
  });
});