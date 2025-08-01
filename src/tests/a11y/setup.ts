/**
 * A11y test setup - Additional setup for accessibility tests
 */

import { beforeEach, vi } from 'vitest';
import 'vitest-axe/extend-expect';

beforeEach(() => {
  // Mock screen reader APIs
  global.speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
    pending: false,
    speaking: false,
    paused: false,
    onvoiceschanged: null,
  } as any;

  // Mock ARIA live regions behavior
  const mockAnnounce = vi.fn();
  (global as any).ariaMockAnnounce = mockAnnounce;

  // Mock focus management
  let mockFocusedElement: Element | null = null;
  
  Object.defineProperty(document, 'activeElement', {
    get: () => mockFocusedElement,
    configurable: true,
  });

  // Mock element.focus()
  const originalFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = vi.fn().mockImplementation(function(this: HTMLElement) {
    mockFocusedElement = this;
    // Call original focus if available
    if (originalFocus) {
      originalFocus.call(this);
    }
  });

  // Mock element.blur()
  HTMLElement.prototype.blur = vi.fn().mockImplementation(() => {
    mockFocusedElement = null;
  });

  // Mock keyboard event handling
  global.KeyboardEvent = class MockKeyboardEvent extends Event {
    key: string;
    code: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;

    constructor(type: string, eventInitDict?: KeyboardEventInit) {
      super(type, eventInitDict);
      this.key = eventInitDict?.key || '';
      this.code = eventInitDict?.code || '';
      this.ctrlKey = eventInitDict?.ctrlKey || false;
      this.shiftKey = eventInitDict?.shiftKey || false;
      this.altKey = eventInitDict?.altKey || false;
      this.metaKey = eventInitDict?.metaKey || false;
    }
  } as any;

  // Mock high contrast mode detection
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-contrast'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
  });

  // Mock reduced motion preference
  global.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});