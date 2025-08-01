/**
 * Browser Compatibility Testing Suite
 * 
 * Comprehensive tests for cross-browser compatibility including:
 * - WebGL feature detection and fallbacks
 * - File API compatibility
 * - Touch event handling
 * - Canvas performance testing
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { performanceOptimizer } from '../../utils/performanceOptimization';

// ========================
// Mock Browser Environments
// ========================

interface MockBrowserEnvironment {
  userAgent: string;
  webglSupport: 'webgl2' | 'webgl' | 'none';
  deviceMemory?: number;
  maxTouchPoints?: number;
  fileApiSupport: boolean;
  canvasSupport: boolean;
}

const BROWSER_ENVIRONMENTS: MockBrowserEnvironment[] = [
  // Chrome 90+
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
    webglSupport: 'webgl2',
    deviceMemory: 8,
    fileApiSupport: true,
    canvasSupport: true,
  },
  // Firefox 88+
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0',
    webglSupport: 'webgl2',
    deviceMemory: 4,
    fileApiSupport: true,
    canvasSupport: true,
  },
  // Safari 14+
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15',
    webglSupport: 'webgl',
    deviceMemory: undefined,
    fileApiSupport: true,
    canvasSupport: true,
  },
  // iOS Safari 14+
  {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    webglSupport: 'webgl',
    maxTouchPoints: 5,
    fileApiSupport: true,
    canvasSupport: true,
  },
  // Chrome Android 90+
  {
    userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Mobile Safari/537.36',
    webglSupport: 'webgl',
    deviceMemory: 2,
    maxTouchPoints: 10,
    fileApiSupport: true,
    canvasSupport: true,
  },
  // Old Chrome (should fail)
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36',
    webglSupport: 'webgl',
    deviceMemory: 4,
    fileApiSupport: true,
    canvasSupport: true,
  },
  // IE 11 (should fail completely)
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; AS; rv:11.0) like Gecko',
    webglSupport: 'none',
    fileApiSupport: false,
    canvasSupport: true,
  },
];

// ========================
// Test Utilities
// ========================

class BrowserMocker {
  private originalNavigator: any;
  private originalDocument: any;
  private originalWindow: any;
  private mockCanvas?: HTMLCanvasElement;
  private mockContext?: WebGLRenderingContext | WebGL2RenderingContext;

  constructor() {
    this.originalNavigator = global.navigator;
    this.originalDocument = global.document;
    this.originalWindow = global.window;
  }

  mockEnvironment(env: MockBrowserEnvironment): void {
    // Mock Navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        ...this.originalNavigator,
        userAgent: env.userAgent,
        deviceMemory: env.deviceMemory,
        maxTouchPoints: env.maxTouchPoints || 0,
      },
      configurable: true,
    });

    // Mock Document
    this.mockCanvas = this.createMockCanvas(env);
    Object.defineProperty(global, 'document', {
      value: {
        ...this.originalDocument,
        createElement: vi.fn((tag: string) => {
          if (tag === 'canvas') {
            return this.mockCanvas;
          }
          return this.originalDocument.createElement(tag);
        }),
        querySelectorAll: vi.fn(() => []),
      },
      configurable: true,
    });

    // Mock Window APIs
    Object.defineProperty(global, 'window', {
      value: {
        ...this.originalWindow,
        devicePixelRatio: env.maxTouchPoints ? 2 : 1, // Mobile devices typically have higher DPI
        performance: {
          now: () => Date.now(),
          memory: env.deviceMemory ? {
            usedJSHeapSize: env.deviceMemory * 1024 * 1024 * 0.1, // 10% used
            totalJSHeapSize: env.deviceMemory * 1024 * 1024 * 0.5, // 50% available
          } : undefined,
        },
        File: env.fileApiSupport ? File : undefined,
        FileReader: env.fileApiSupport ? FileReader : undefined,
        Blob: env.fileApiSupport ? Blob : undefined,
      },
      configurable: true,
    });
  }

  private createMockCanvas(env: MockBrowserEnvironment): HTMLCanvasElement {
    const canvas = {
      getContext: vi.fn((type: string) => {
        if (!env.canvasSupport) return null;
        
        if (type === 'webgl2' && env.webglSupport === 'webgl2') {
          return this.createMockWebGLContext(true);
        } else if ((type === 'webgl' || type === 'experimental-webgl') && 
                   (env.webglSupport === 'webgl' || env.webglSupport === 'webgl2')) {
          return this.createMockWebGLContext(false);
        } else if (type === '2d' && env.canvasSupport) {
          return this.createMock2DContext();
        }
        return null;
      }),
      width: 100,
      height: 100,
      toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
    } as any;

    // Set up property behavior
    Object.defineProperty(canvas, 'width', {
      get: function() { return this._width || 100; },
      set: function(value) { this._width = value; },
    });

    Object.defineProperty(canvas, 'height', {
      get: function() { return this._height || 100; },
      set: function(value) { this._height = value; },
    });

    return canvas;
  }

  private createMockWebGLContext(isWebGL2: boolean): WebGLRenderingContext | WebGL2RenderingContext {
    const baseContext = {
      // WebGL constants
      MAX_TEXTURE_SIZE: 0x0D33,
      MAX_VERTEX_ATTRIBS: 0x8869,
      MAX_TEXTURE_IMAGE_UNITS: 0x8872,
      
      // Mock methods
      getParameter: vi.fn((param: number) => {
        switch (param) {
          case 0x0D33: // MAX_TEXTURE_SIZE
            return isWebGL2 ? 4096 : 2048;
          case 0x8869: // MAX_VERTEX_ATTRIBS
            return 16;
          case 0x8872: // MAX_TEXTURE_IMAGE_UNITS
            return 8;
          default:
            return 0;
        }
      }),
      
      getExtension: vi.fn((name: string) => {
        const supportedExtensions = isWebGL2 
          ? ['OES_texture_float', 'OES_texture_half_float', 'WEBGL_debug_renderer_info']
          : ['OES_texture_float', 'WEBGL_debug_renderer_info'];
        
        if (name === 'WEBGL_debug_renderer_info') {
          return {
            UNMASKED_RENDERER_WEBGL: 0x9246,
            UNMASKED_VENDOR_WEBGL: 0x9245,
          };
        }
        
        return supportedExtensions.includes(name) ? {} : null;
      }),
      
      getSupportedExtensions: vi.fn(() => 
        isWebGL2 
          ? ['OES_texture_float', 'OES_texture_half_float', 'WEBGL_debug_renderer_info']
          : ['OES_texture_float', 'WEBGL_debug_renderer_info']
      ),
    };

    if (isWebGL2) {
      // Add WebGL2-specific methods
      Object.assign(baseContext, {
        getUniformBlockIndex: vi.fn(),
        uniformBlockBinding: vi.fn(),
      });
    }

    return baseContext as any;
  }

  private createMock2DContext(): CanvasRenderingContext2D {
    return {
      drawImage: vi.fn(),
      putImageData: vi.fn(),
      getImageData: vi.fn(() => ({
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4),
      })),
      fillRect: vi.fn(),
      clearRect: vi.fn(),
    } as any;
  }

  restore(): void {
    Object.defineProperty(global, 'navigator', {
      value: this.originalNavigator,
      configurable: true,
    });
    Object.defineProperty(global, 'document', {
      value: this.originalDocument,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: this.originalWindow,
      configurable: true,
    });
  }
}

// ========================
// Test Suite
// ========================

describe('Browser Compatibility Tests', () => {
  let browserMocker: BrowserMocker;

  beforeEach(() => {
    browserMocker = new BrowserMocker();
  });

  afterEach(() => {
    browserMocker.restore();
  });

  describe('WebGL Support Detection', () => {
    test.each(BROWSER_ENVIRONMENTS.slice(0, 5))('should detect WebGL capabilities in $userAgent', (env) => {
      browserMocker.mockEnvironment(env);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const metrics = optimizer.getMetrics();
      
      expect(metrics.deviceCapabilities.gpu.webglVersion).toBe(env.webglSupport);
      
      if (env.webglSupport !== 'none') {
        expect(metrics.deviceCapabilities.gpu.maxTextureSize).toBeGreaterThan(0);
        expect(metrics.deviceCapabilities.gpu.extensions).toBeInstanceOf(Array);
      }
    });

    test('should handle WebGL context creation failure gracefully', () => {
      const envWithoutWebGL = {
        ...BROWSER_ENVIRONMENTS[0],
        webglSupport: 'none' as const,
      };
      
      browserMocker.mockEnvironment(envWithoutWebGL);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const metrics = optimizer.getMetrics();
      
      expect(metrics.deviceCapabilities.gpu.webglVersion).toBe('none');
      expect(metrics.deviceCapabilities.gpu.maxTextureSize).toBe(0);
      expect(metrics.deviceCapabilities.performance).toBe('potato');
    });
  });

  describe('Device Memory Detection', () => {
    test('should detect device memory when available', () => {
      const envWithMemory = BROWSER_ENVIRONMENTS[0]; // Chrome with 8GB
      browserMocker.mockEnvironment(envWithMemory);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const metrics = optimizer.getMetrics();
      
      expect(metrics.deviceCapabilities.memory.deviceMemory).toBe(8);
      expect(metrics.deviceCapabilities.memory.estimatedAvailable).toBeGreaterThan(1000);
    });

    test('should fallback when device memory is unavailable', () => {
      const envWithoutMemory = BROWSER_ENVIRONMENTS[2]; // Safari without deviceMemory
      browserMocker.mockEnvironment(envWithoutMemory);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const metrics = optimizer.getMetrics();
      
      expect(metrics.deviceCapabilities.memory.deviceMemory).toBeUndefined();
      expect(metrics.deviceCapabilities.memory.estimatedAvailable).toBe(200); // Conservative default
    });
  });

  describe('Touch Event Support', () => {
    test('should detect touch support on mobile devices', () => {
      const mobileEnv = BROWSER_ENVIRONMENTS[3]; // iOS Safari
      browserMocker.mockEnvironment(mobileEnv);
      
      expect(navigator.maxTouchPoints).toBeGreaterThan(0);
    });

    test('should handle absence of touch support on desktop', () => {
      const desktopEnv = BROWSER_ENVIRONMENTS[0]; // Chrome desktop
      browserMocker.mockEnvironment(desktopEnv);
      
      expect(navigator.maxTouchPoints).toBe(0);
    });
  });

  describe('File API Support', () => {
    test('should verify File API availability', () => {
      BROWSER_ENVIRONMENTS.slice(0, 5).forEach(env => {
        browserMocker.mockEnvironment(env);
        
        expect(typeof window.File).toBe(env.fileApiSupport ? 'function' : 'undefined');
        expect(typeof window.FileReader).toBe(env.fileApiSupport ? 'function' : 'undefined');
        expect(typeof window.Blob).toBe(env.fileApiSupport ? 'function' : 'undefined');
      });
    });

    test('should handle file reading capabilities', () => {
      const supportedEnv = BROWSER_ENVIRONMENTS[0];
      browserMocker.mockEnvironment(supportedEnv);
      
      expect(() => new FileReader()).not.toThrow();
    });
  });

  describe('Canvas Performance', () => {
    test('should measure canvas creation performance', () => {
      BROWSER_ENVIRONMENTS.slice(0, 3).forEach(env => {
        browserMocker.mockEnvironment(env);
        
        const start = performance.now();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const duration = performance.now() - start;
        
        expect(canvas).toBeDefined();
        expect(ctx).toBeDefined();
        expect(duration).toBeLessThan(100); // Should be fast
      });
    });

    test('should test canvas size limits', () => {
      const env = BROWSER_ENVIRONMENTS[0];
      browserMocker.mockEnvironment(env);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const maxSize = optimizer.getMetrics().deviceCapabilities.memory.maxCanvasSize;
      
      expect(maxSize).toBeGreaterThan(1024);
      expect(maxSize).toBeLessThanOrEqual(8192);
    });
  });

  describe('Performance Level Classification', () => {
    test('should classify high-performance devices correctly', () => {
      const highPerfEnv = BROWSER_ENVIRONMENTS[0]; // Chrome with WebGL2 and 8GB RAM
      browserMocker.mockEnvironment(highPerfEnv);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const level = optimizer.getMetrics().deviceCapabilities.performance;
      
      expect(level).toBe('high');
    });

    test('should classify medium-performance devices correctly', () => {
      const mediumPerfEnv = BROWSER_ENVIRONMENTS[2]; // Safari with WebGL1
      browserMocker.mockEnvironment(mediumPerfEnv);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const level = optimizer.getMetrics().deviceCapabilities.performance;
      
      expect(['medium', 'low']).toContain(level);
    });

    test('should classify low-performance devices correctly', () => {
      const lowPerfEnv = {
        ...BROWSER_ENVIRONMENTS[4], // Android Chrome
        deviceMemory: 1, // Very low memory
      };
      browserMocker.mockEnvironment(lowPerfEnv);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const level = optimizer.getMetrics().deviceCapabilities.performance;
      
      expect(['low', 'potato']).toContain(level);
    });
  });

  describe('Feature Detection', () => {
    test('should detect WebGL2 features correctly', () => {
      const webgl2Env = BROWSER_ENVIRONMENTS[0];
      browserMocker.mockEnvironment(webgl2Env);
      
      // Import the feature detection function
      const { isFeatureSupported } = require('../../utils/performanceOptimization');
      
      expect(isFeatureSupported('webgl2')).toBe(true);
      expect(isFeatureSupported('webgl')).toBe(true);
    });

    test('should detect WebGL1-only features correctly', () => {
      const webgl1Env = BROWSER_ENVIRONMENTS[2]; // Safari
      browserMocker.mockEnvironment(webgl1Env);
      
      const { isFeatureSupported } = require('../../utils/performanceOptimization');
      
      expect(isFeatureSupported('webgl2')).toBe(false);
      expect(isFeatureSupported('webgl')).toBe(true);
    });

    test('should handle no WebGL support', () => {
      const noWebGLEnv = BROWSER_ENVIRONMENTS[6]; // IE 11
      browserMocker.mockEnvironment(noWebGLEnv);
      
      const { isFeatureSupported } = require('../../utils/performanceOptimization');
      
      expect(isFeatureSupported('webgl2')).toBe(false);
      expect(isFeatureSupported('webgl')).toBe(false);
    });
  });

  describe('Browser Version Requirements', () => {
    test('should pass minimum version requirements', () => {
      const modernBrowsers = BROWSER_ENVIRONMENTS.slice(0, 5);
      
      modernBrowsers.forEach(env => {
        browserMocker.mockEnvironment(env);
        
        const optimizer = new (performanceOptimizer.constructor as any)();
        const capabilities = optimizer.getMetrics().deviceCapabilities;
        
        // Modern browsers should support at least WebGL
        expect(capabilities.gpu.webglVersion).not.toBe('none');
        expect(capabilities.performance).not.toBe('potato');
      });
    });

    test('should fail with outdated browsers', () => {
      const oldBrowser = BROWSER_ENVIRONMENTS[6]; // IE 11
      browserMocker.mockEnvironment(oldBrowser);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const capabilities = optimizer.getMetrics().deviceCapabilities;
      
      expect(capabilities.gpu.webglVersion).toBe('none');
      expect(capabilities.performance).toBe('potato');
    });
  });

  describe('Mobile-Specific Tests', () => {
    test('should handle iOS Safari correctly', () => {
      const iOSEnv = BROWSER_ENVIRONMENTS[3];
      browserMocker.mockEnvironment(iOSEnv);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const settings = optimizer.optimizeRenderingSettings();
      
      expect(settings.powerPreference).toBe('low-power'); // Battery optimization
      expect(settings.pixelRatio).toBe(2); // High DPI
    });

    test('should handle Android Chrome correctly', () => {
      const androidEnv = BROWSER_ENVIRONMENTS[4];
      browserMocker.mockEnvironment(androidEnv);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const settings = optimizer.optimizeRenderingSettings();
      
      expect(settings.antialias).toBeDefined();
      expect(settings.shadowMapEnabled).toBeDefined();
    });
  });

  describe('Memory Constraints', () => {
    test('should adapt to low-memory devices', () => {
      const lowMemoryEnv = {
        ...BROWSER_ENVIRONMENTS[4],
        deviceMemory: 1, // 1GB device
      };
      browserMocker.mockEnvironment(lowMemoryEnv);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const mockImage = new Image();
      mockImage.width = 2048;
      mockImage.height = 2048;
      
      const result = optimizer.optimizeImageForProcessing(mockImage);
      
      expect(result.scaleFactor).toBeLessThan(1);
    });

    test('should maintain quality on high-memory devices', () => {
      const highMemoryEnv = BROWSER_ENVIRONMENTS[0]; // 8GB device
      browserMocker.mockEnvironment(highMemoryEnv);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const mockImage = new Image();
      mockImage.width = 1024;
      mockImage.height = 1024;
      
      const result = optimizer.optimizeImageForProcessing(mockImage);
      
      expect(result.scaleFactor).toBe(1);
    });
  });
});

// ========================
// Integration Tests
// ========================

describe('Browser Compatibility Integration', () => {
  let browserMocker: BrowserMocker;

  beforeEach(() => {
    browserMocker = new BrowserMocker();
  });

  afterEach(() => {
    browserMocker.restore();
  });

  test('should provide consistent experience across supported browsers', () => {
    const supportedBrowsers = BROWSER_ENVIRONMENTS.slice(0, 5);
    
    const results = supportedBrowsers.map(env => {
      browserMocker.mockEnvironment(env);
      
      const optimizer = new (performanceOptimizer.constructor as any)();
      const metrics = optimizer.getMetrics();
      
      return {
        userAgent: env.userAgent,
        performance: metrics.deviceCapabilities.performance,
        webglSupport: metrics.deviceCapabilities.gpu.webglVersion,
        canRun: metrics.deviceCapabilities.gpu.webglVersion !== 'none',
      };
    });
    
    // All supported browsers should be able to run the application
    expect(results.every(r => r.canRun)).toBe(true);
    
    // At least 80% should have medium or better performance
    const goodPerformance = results.filter(r => 
      r.performance === 'high' || r.performance === 'medium'
    );
    expect(goodPerformance.length / results.length).toBeGreaterThanOrEqual(0.8);
  });

  test('should gracefully degrade for unsupported browsers', () => {
    const unsupportedBrowser = BROWSER_ENVIRONMENTS[6]; // IE 11
    browserMocker.mockEnvironment(unsupportedBrowser);
    
    const optimizer = new (performanceOptimizer.constructor as any)();
    const metrics = optimizer.getMetrics();
    
    expect(metrics.deviceCapabilities.gpu.webglVersion).toBe('none');
    expect(metrics.deviceCapabilities.performance).toBe('potato');
    
    // Should still provide recommendations for fallback
    const recommendations = optimizer.generateOptimizationRecommendations();
    expect(recommendations).toContain('Use simplified rendering mode');
  });
});

// ========================
// Regression Tests
// ========================

describe('Browser Compatibility Regression Tests', () => {
  let browserMocker: BrowserMocker;

  beforeEach(() => {
    browserMocker = new BrowserMocker();
  });

  afterEach(() => {
    browserMocker.restore();
  });

  test('should maintain compatibility with Chrome 90+', () => {
    const chromeEnv = BROWSER_ENVIRONMENTS[0];
    browserMocker.mockEnvironment(chromeEnv);
    
    const optimizer = new (performanceOptimizer.constructor as any)();
    const capabilities = optimizer.getMetrics().deviceCapabilities;
    
    expect(capabilities.gpu.webglVersion).toBe('webgl2');
    expect(capabilities.performance).toBe('high');
  });

  test('should maintain compatibility with Firefox 88+', () => {
    const firefoxEnv = BROWSER_ENVIRONMENTS[1];
    browserMocker.mockEnvironment(firefoxEnv);
    
    const optimizer = new (performanceOptimizer.constructor as any)();
    const capabilities = optimizer.getMetrics().deviceCapabilities;
    
    expect(capabilities.gpu.webglVersion).toBe('webgl2');
    expect(['high', 'medium']).toContain(capabilities.performance);
  });

  test('should maintain compatibility with Safari 14+', () => {
    const safariEnv = BROWSER_ENVIRONMENTS[2];
    browserMocker.mockEnvironment(safariEnv);
    
    const optimizer = new (performanceOptimizer.constructor as any)();
    const capabilities = optimizer.getMetrics().deviceCapabilities;
    
    expect(['webgl', 'webgl2']).toContain(capabilities.gpu.webglVersion);
    expect(['high', 'medium', 'low']).toContain(capabilities.performance);
  });
});