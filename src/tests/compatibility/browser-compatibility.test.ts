/**
 * Browser Compatibility Testing Suite
 * 
 * Tests browser feature detection, WebGL capabilities,
 * API support, and compatibility across different browsers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { browserCapabilities, PolyfillManager } from '../../utils/browserCapabilities';

describe('Browser Compatibility', () => {
  let originalUserAgent: string;
  let originalPerformance: Performance;
  
  beforeEach(() => {
    originalUserAgent = navigator.userAgent;
    originalPerformance = window.performance;
  });
  
  afterEach(() => {
    // Restore original values
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    (window as any).performance = originalPerformance;
  });
  
  describe('Browser Detection', () => {
    it('should detect Chrome correctly', () => {
      // Mock Chrome user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        configurable: true,
      });
      
      const browserInfo = browserCapabilities.detectBrowserInfo();
      
      expect(browserInfo.name).toBe('Chrome');
      expect(parseInt(browserInfo.version)).toBeGreaterThanOrEqual(90);
      expect(browserInfo.engine).toBe('Blink');
      expect(browserInfo.supported).toBe(true);
    });
    
    it('should detect Firefox correctly', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        configurable: true,
      });
      
      const browserInfo = browserCapabilities.detectBrowserInfo();
      
      expect(browserInfo.name).toBe('Firefox');
      expect(parseInt(browserInfo.version)).toBeGreaterThanOrEqual(88);
      expect(browserInfo.engine).toBe('Gecko');
      expect(browserInfo.supported).toBe(true);
    });
    
    it('should detect Safari correctly', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        configurable: true,
      });
      
      const browserInfo = browserCapabilities.detectBrowserInfo();
      
      expect(browserInfo.name).toBe('Safari');
      expect(parseInt(browserInfo.version)).toBeGreaterThanOrEqual(14);
      expect(browserInfo.engine).toBe('WebKit');
      expect(browserInfo.supported).toBe(true);
    });
    
    it('should detect Edge correctly', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
        configurable: true,
      });
      
      const browserInfo = browserCapabilities.detectBrowserInfo();
      
      expect(browserInfo.name).toBe('Edge');
      expect(parseInt(browserInfo.version)).toBeGreaterThanOrEqual(90);
      expect(browserInfo.engine).toBe('Blink');
      expect(browserInfo.supported).toBe(true);
    });
    
    it('should detect mobile browsers', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
        configurable: true,
      });
      
      const browserInfo = browserCapabilities.detectBrowserInfo();
      
      expect(browserInfo.mobile).toBe(true);
      expect(browserInfo.platform).toBe('iOS');
    });
    
    it('should mark unsupported browser versions', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36',
        configurable: true,
      });
      
      const browserInfo = browserCapabilities.detectBrowserInfo();
      
      expect(browserInfo.supported).toBe(false);
      expect(browserInfo.warnings.length).toBeGreaterThan(0);
    });
  });
  
  describe('WebGL Detection', () => {
    it('should detect WebGL support', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      expect(capabilities.webgl).toBeDefined();
      expect(typeof capabilities.webgl.supported).toBe('boolean');
      
      if (capabilities.webgl.supported) {
        expect(capabilities.webgl.version).toBeOneOf(['1.0', '2.0']);
        expect(capabilities.webgl.maxTextureSize).toBeGreaterThan(0);
        expect(Array.isArray(capabilities.webgl.extensions)).toBe(true);
      }
    });
    
    it('should handle WebGL context creation failure', () => {
      // Mock failed WebGL context
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
      
      const capabilities = browserCapabilities.detectCapabilities();
      
      expect(capabilities).resolves.toHaveProperty('webgl.supported', false);
      
      // Restore original method
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });
  });
  
  describe('File API Detection', () => {
    it('should detect File API support', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      expect(capabilities.fileApi).toBeDefined();
      expect(typeof capabilities.fileApi.fileReader).toBe('boolean');
      expect(typeof capabilities.fileApi.blob).toBe('boolean');
      expect(typeof capabilities.fileApi.dragDrop).toBe('boolean');
      expect(capabilities.fileApi.maxFileSize).toBeGreaterThan(0);
      expect(Array.isArray(capabilities.fileApi.supportedTypes)).toBe(true);
    });
    
    it('should detect drag and drop support', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      // Most modern browsers support drag and drop
      expect(capabilities.fileApi.dragDrop).toBe(true);
    });
  });
  
  describe('Canvas Detection', () => {
    it('should detect Canvas support', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      expect(capabilities.canvas).toBeDefined();
      expect(typeof capabilities.canvas.supported).toBe('boolean');
      expect(typeof capabilities.canvas.offscreenCanvas).toBe('boolean');
      expect(typeof capabilities.canvas.imageBitmap).toBe('boolean');
      expect(typeof capabilities.canvas.webp).toBe('boolean');
      expect(capabilities.canvas.maxCanvasSize).toBeGreaterThan(0);
    });
    
    it('should handle canvas context creation failure', async () => {
      // Mock failed canvas context
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
      
      const capabilities = await browserCapabilities.detectCapabilities();
      
      expect(capabilities.canvas.supported).toBe(false);
      
      // Restore original method
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });
  });
  
  describe('Web Workers Detection', () => {
    it('should detect Web Workers support', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      expect(capabilities.webWorkers).toBeDefined();
      expect(typeof capabilities.webWorkers.supported).toBe('boolean');
      expect(typeof capabilities.webWorkers.sharedWorkers).toBe('boolean');
      expect(typeof capabilities.webWorkers.serviceWorkers).toBe('boolean');
      expect(typeof capabilities.webWorkers.transferableObjects).toBe('boolean');
    });
  });
  
  describe('Storage Detection', () => {
    it('should detect storage capabilities', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      expect(capabilities.storage).toBeDefined();
      expect(typeof capabilities.storage.localStorage).toBe('boolean');
      expect(typeof capabilities.storage.sessionStorage).toBe('boolean');
      expect(typeof capabilities.storage.indexedDB).toBe('boolean');
      expect(capabilities.storage.quota).toBeGreaterThan(0);
    });
    
    it('should handle storage access failure', async () => {
      // Mock localStorage failure
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage disabled');
      });
      
      const capabilities = await browserCapabilities.detectCapabilities();
      
      expect(capabilities.storage.localStorage).toBe(false);
      
      // Restore original method
      Storage.prototype.setItem = originalSetItem;
    });
  });
  
  describe('Performance API Detection', () => {
    it('should detect performance API capabilities', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      expect(capabilities.performance).toBeDefined();
      expect(typeof capabilities.performance.performanceAPI).toBe('boolean');
      expect(typeof capabilities.performance.performanceObserver).toBe('boolean');
      expect(typeof capabilities.performance.userTiming).toBe('boolean');
      expect(typeof capabilities.performance.navigationTiming).toBe('boolean');
      expect(typeof capabilities.performance.resourceTiming).toBe('boolean');
      expect(typeof capabilities.performance.memoryAPI).toBe('boolean');
    });
    
    it('should handle missing performance API', async () => {
      // Mock missing performance API
      const originalPerformance = window.performance;
      delete (window as any).performance;
      
      const capabilities = await browserCapabilities.detectCapabilities();
      
      expect(capabilities.performance.performanceAPI).toBe(false);
      
      // Restore performance API
      (window as any).performance = originalPerformance;
    });
  });
  
  describe('Media Features Detection', () => {
    it('should detect media features', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      expect(capabilities.mediaFeatures).toBeDefined();
      expect(typeof capabilities.mediaFeatures.prefersReducedMotion).toBe('boolean');
      expect(['light', 'dark', 'no-preference']).toContain(capabilities.mediaFeatures.prefersColorScheme);
      expect(typeof capabilities.mediaFeatures.highContrast).toBe('boolean');
      expect(typeof capabilities.mediaFeatures.forcedColors).toBe('boolean');
    });
  });
  
  describe('Touch Support Detection', () => {
    it('should detect touch capabilities', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      expect(capabilities.touchSupport).toBeDefined();
      expect(typeof capabilities.touchSupport.supported).toBe('boolean');
      expect(typeof capabilities.touchSupport.maxTouchPoints).toBe('number');
      expect(typeof capabilities.touchSupport.pointerEvents).toBe('boolean');
      expect(typeof capabilities.touchSupport.gestureEvents).toBe('boolean');
    });
  });
  
  describe('Compatibility Report', () => {
    it('should generate comprehensive compatibility report', async () => {
      const report = await browserCapabilities.getCompatibilityReport();
      
      expect(typeof report).toBe('string');
      expect(report).toContain('Browser Compatibility Report');
      expect(report).toContain('Browser Information');
      expect(report).toContain('Core Capabilities');
      expect(report).toContain('WebGL Details');
      expect(report).toContain('Warnings');
    });
    
    it('should provide feature recommendations', async () => {
      const recommendations = await browserCapabilities.getFeatureRecommendations();
      
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
  
  describe('Polyfill Manager', () => {
    it('should load performance API polyfill', async () => {
      // Mock missing performance API
      delete (window as any).performance;
      
      await PolyfillManager.loadPolyfill('performanceAPI');
      
      expect(window.performance).toBeDefined();
      expect(typeof window.performance.now).toBe('function');
    });
    
    it('should load required polyfills automatically', async () => {
      await PolyfillManager.loadRequiredPolyfills();
      
      // Should complete without errors
      expect(true).toBe(true);
    });
    
    it('should handle unknown polyfills gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await PolyfillManager.loadPolyfill('unknownFeature');
      
      expect(consoleSpy).toHaveBeenCalledWith('Unknown polyfill requested: unknownFeature');
      
      consoleSpy.mockRestore();
    });
  });
});

describe('Cross-Browser Feature Tests', () => {
  describe('WebGL Consistency', () => {
    it('should have consistent WebGL behavior across browsers', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      if (capabilities.webgl.supported) {
        // Basic WebGL consistency checks
        expect(capabilities.webgl.maxTextureSize).toBeGreaterThanOrEqual(1024);
        expect(capabilities.webgl.maxVertexAttribs).toBeGreaterThanOrEqual(8);
        expect(capabilities.webgl.extensions.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('File API Consistency', () => {
    it('should have consistent File API behavior', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      if (capabilities.fileApi.fileReader) {
        expect(capabilities.fileApi.blob).toBe(true);
        expect(capabilities.fileApi.supportedTypes).toContain('image/jpeg');
        expect(capabilities.fileApi.supportedTypes).toContain('image/png');
      }
    });
  });
  
  describe('Canvas Consistency', () => {
    it('should have consistent Canvas behavior', async () => {
      const capabilities = await browserCapabilities.detectCapabilities();
      
      if (capabilities.canvas.supported) {
        expect(capabilities.canvas.maxCanvasSize).toBeGreaterThanOrEqual(1024);
      }
    });
  });
});

describe('Performance Requirements', () => {
  it('should meet minimum performance requirements', async () => {
    const capabilities = await browserCapabilities.detectCapabilities();
    
    // Check that performance-critical features are available
    if (capabilities.webgl.supported) {
      expect(capabilities.webgl.maxTextureSize).toBeGreaterThanOrEqual(2048);
    }
    
    if (capabilities.canvas.supported) {
      expect(capabilities.canvas.maxCanvasSize).toBeGreaterThanOrEqual(2048);
    }
    
    // Check that file handling is adequate
    expect(capabilities.fileApi.maxFileSize).toBeGreaterThanOrEqual(10 * 1024 * 1024); // 10MB
  });
});

describe('Accessibility Requirements', () => {
  it('should detect accessibility preferences', async () => {
    const capabilities = await browserCapabilities.detectCapabilities();
    
    // Ensure accessibility features are detected
    expect(capabilities.mediaFeatures.prefersReducedMotion).toBeDefined();
    expect(capabilities.mediaFeatures.prefersColorScheme).toBeDefined();
    expect(capabilities.mediaFeatures.highContrast).toBeDefined();
    expect(capabilities.mediaFeatures.forcedColors).toBeDefined();
  });
});

describe('Mobile Compatibility', () => {
  it('should handle mobile browser limitations', async () => {
    // Mock mobile user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    
    const browserInfo = browserCapabilities.detectBrowserInfo();
    const capabilities = await browserCapabilities.detectCapabilities();
    
    expect(browserInfo.mobile).toBe(true);
    
    // Mobile browsers might have limitations
    if (capabilities.storage.quota < 50 * 1024 * 1024) { // Less than 50MB
      expect(browserInfo.warnings.length).toBeGreaterThan(0);
    }
  });
});

describe('Feature Detection Edge Cases', () => {
  it('should handle partial feature support', async () => {
    // Test scenarios where some features are available but others aren't
    const capabilities = await browserCapabilities.detectCapabilities();
    
    // WebGL might be supported but with limited extensions
    if (capabilities.webgl.supported && capabilities.webgl.extensions.length === 0) {
      expect(capabilities.webgl.version).toBeDefined();
    }
    
    // Canvas might be supported but with size limitations
    if (capabilities.canvas.supported && capabilities.canvas.maxCanvasSize < 4096) {
      expect(capabilities.canvas.maxCanvasSize).toBeGreaterThan(0);
    }
  });
  
  it('should handle feature detection errors gracefully', async () => {
    // Mock various API failures
    const originalCreateElement = document.createElement;
    document.createElement = vi.fn().mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        throw new Error('Canvas creation failed');
      }
      return originalCreateElement.call(document, tagName);
    });
    
    const capabilities = await browserCapabilities.detectCapabilities();
    
    // Should not throw and should have sensible defaults
    expect(capabilities).toBeDefined();
    expect(capabilities.canvas.supported).toBe(false);
    
    // Restore original method
    document.createElement = originalCreateElement;
  });
});