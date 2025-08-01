/**
 * Vitest test setup file - Global setup for all test environments
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi, expect } from 'vitest';

// Import canvas for Node.js Canvas API support
import { createCanvas, loadImage, ImageData as NodeImageData } from 'canvas';

// Mock WebGL context function
function createMockWebGLContext(isWebGL2: boolean = false) {
  const mockContext = {
    // WebGL constants
    MAX_TEXTURE_SIZE: 0x0D33,
    MAX_VERTEX_ATTRIBS: 0x8869,
    MAX_FRAGMENT_UNIFORM_VECTORS: 0x8DFD,
    
    // Mock methods
    getParameter: vi.fn((param: number) => {
      switch (param) {
        case 0x0D33: return 4096; // MAX_TEXTURE_SIZE
        case 0x8869: return 16;   // MAX_VERTEX_ATTRIBS
        case 0x8DFD: return 256;  // MAX_FRAGMENT_UNIFORM_VECTORS
        default: return 0;
      }
    }),
    getExtension: vi.fn((name: string) => {
      if (name === 'WEBGL_debug_renderer_info') {
        return {
          UNMASKED_RENDERER_WEBGL: 0x9246,
          UNMASKED_VENDOR_WEBGL: 0x9245,
        };
      }
      return null;
    }),
    getSupportedExtensions: vi.fn(() => ['WEBGL_debug_renderer_info']),
    
    // WebGL context properties
    canvas: createCanvas(300, 150),
    drawingBufferWidth: 300,
    drawingBufferHeight: 150,
    
    // Additional WebGL methods
    createShader: vi.fn(() => ({})),
    createProgram: vi.fn(() => ({})),
    createBuffer: vi.fn(() => ({})),
    createTexture: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    useProgram: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    drawArrays: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    viewport: vi.fn(),
    
    // WebGL2 specific methods (if needed)
    ...(isWebGL2 ? {
      createVertexArray: vi.fn(() => ({})),
      bindVertexArray: vi.fn(),
    } : {}),
  };
  
  // Add WebGL2RenderingContext check for instanceof
  if (isWebGL2) {
    Object.setPrototypeOf(mockContext, WebGL2RenderingContext.prototype);
  } else {
    Object.setPrototypeOf(mockContext, WebGLRenderingContext.prototype);
  }
  
  return mockContext;
}

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
  // Mock WebGL context constructors
  global.WebGLRenderingContext = function() {} as any;
  global.WebGL2RenderingContext = function() {} as any;
  
  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  
  // Mock window.URL.createObjectURL and revokeObjectURL
  Object.defineProperty(global.URL, 'createObjectURL', {
    writable: true,
    value: vi.fn(() => 'mock-object-url'),
  });
  Object.defineProperty(global.URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(),
  });
  
  // Mock Performance API
  global.performance = {
    ...global.performance,
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 10000000,
      jsHeapSizeLimit: 100000000,
    },
  } as any;
  
  // Mock navigator.deviceMemory
  Object.defineProperty(navigator, 'deviceMemory', {
    writable: true,
    value: 4,
  });
  
  // Mock navigator.hardwareConcurrency
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    writable: true,
    value: 4,
  });
  
  // Mock FileReader
  global.FileReader = class MockFileReader implements Partial<FileReader> {
    result: string | ArrayBuffer | null = null;
    error: any = null;
    readyState: 0 | 1 | 2 = 0;
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    onloadstart: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    
    readAsDataURL(file: Blob): void {
      setTimeout(() => {
        this.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
        this.readyState = 2;
        if (this.onload) {
          const progressEvent = new ProgressEvent('load', {
            lengthComputable: false,
            loaded: 0,
            total: 0
          });
          Object.defineProperty(progressEvent, 'target', { value: this, writable: false });
          this.onload.call(this as any, progressEvent as ProgressEvent<FileReader>);
        }
      }, 0);
    }
    
    readAsArrayBuffer(file: Blob): void {
      setTimeout(() => {
        this.result = new ArrayBuffer(8);
        this.readyState = 2;
        if (this.onload) {
          const progressEvent = new ProgressEvent('load', {
            lengthComputable: false,
            loaded: 0,
            total: 0
          });
          Object.defineProperty(progressEvent, 'target', { value: this, writable: false });
          this.onload.call(this as any, progressEvent as ProgressEvent<FileReader>);
        }
      }, 0);
    }
    
    readAsBinaryString(file: Blob): void {
      // Implementation for completeness
    }
    
    readAsText(file: Blob, encoding?: string): void {
      // Implementation for completeness
    }
    
    abort(): void {
      this.readyState = 2;
    }
    
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
    
    // Constants
    static readonly EMPTY = 0;
    static readonly LOADING = 1;
    static readonly DONE = 2;
    
    readonly EMPTY = 0;
    readonly LOADING = 1;
    readonly DONE = 2;
  } as any;

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,  // Default to false, tests can override
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ImageData constructor using Node Canvas
  global.ImageData = NodeImageData as any;

  // Mock Canvas API with real Canvas functionality
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextType: string, options?: any) => {
    const canvas = createCanvas(300, 150); // Default canvas size
    const ctx = canvas.getContext('2d');
    
    if (contextType === '2d') {
      return ctx;
    } else if (contextType === 'webgl' || contextType === 'webgl2') {
      // Mock WebGL context
      return createMockWebGLContext(contextType === 'webgl2');
    }
    return null;
  });

  // Mock HTMLCanvasElement methods
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock');
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
    callback?.(new Blob(['mock'], { type: 'image/png' }));
  });

  // Mock document.createElement for canvas
  const originalCreateElement = document.createElement;
  document.createElement = vi.fn().mockImplementation((tagName: string) => {
    if (tagName.toLowerCase() === 'canvas') {
      const canvas = createCanvas(300, 150);
      // Add missing HTMLCanvasElement properties and methods
      (canvas as any).width = 300;
      (canvas as any).height = 150;
      (canvas as any).toDataURL = () => 'data:image/png;base64,mock';
      (canvas as any).toBlob = (callback: any) => {
        callback?.(new Blob(['mock'], { type: 'image/png' }));
      };
      return canvas as any;
    }
    return originalCreateElement.call(document, tagName);
  });

  // Mock Three.js WebGLRenderer
  vi.mock('three', async () => {
    const actual = await vi.importActual('three');
    return {
      ...actual,
      WebGLRenderer: vi.fn().mockImplementation(() => ({
        domElement: createCanvas(300, 150),
        setSize: vi.fn(),
        render: vi.fn(),
        dispose: vi.fn(),
        getContext: vi.fn(() => createMockWebGLContext()),
        setClearColor: vi.fn(),
        setPixelRatio: vi.fn(),
        shadowMap: {
          enabled: false,
          type: 'PCFSoftShadowMap',
        },
        capabilities: {
          maxTextures: 16,
          maxTextureSize: 4096,
        },
        info: {
          memory: {
            geometries: 0,
            textures: 0,
          },
          render: {
            frame: 0,
            calls: 0,
            triangles: 0,
            points: 0,
            lines: 0,
          },
        },
      })),
    };
  });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Custom Vitest matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeBetween(min: number, max: number): T
  }
  interface ExpectStatic {
    oneOf<T>(values: T[]): T
  }
}

// Extend expect with custom matchers
expect.extend({
  toBeBetween(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received} not to be between ${min} and ${max}`
          : `Expected ${received} to be between ${min} and ${max}`
    };
  }
});

// Add oneOf to expect
(expect as any).oneOf = (values: any[]) => {
  return expect.objectContaining({
    [Symbol.for('vitest.asymmetricMatcher')]: true,
    asymmetricMatch: (actual: any) => values.includes(actual),
    toString: () => `oneOf(${values.map(v => JSON.stringify(v)).join(', ')})`
  });
};
