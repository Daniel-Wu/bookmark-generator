/**
 * WebGL Fallback Testing Suite
 * 
 * Tests WebGL feature detection and appropriate fallback handling
 * for devices with limited or no WebGL support.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { performanceOptimizer, isFeatureSupported } from '../../utils/performanceOptimization';

// ========================
// WebGL Context Mocking
// ========================

class WebGLMocker {
  private originalHTMLCanvasElement: any;
  private contextType: 'webgl2' | 'webgl' | 'none';
  private extensions: string[];
  private parameters: Map<number, any>;

  constructor() {
    this.originalHTMLCanvasElement = global.HTMLCanvasElement;
    this.contextType = 'webgl2';
    this.extensions = [];
    this.parameters = new Map();
  }

  setContextType(type: 'webgl2' | 'webgl' | 'none'): void {
    this.contextType = type;
  }

  setAvailableExtensions(extensions: string[]): void {
    this.extensions = extensions;
  }

  setParameters(params: { [key: number]: any }): void {
    this.parameters = new Map(Object.entries(params).map(([k, v]) => [parseInt(k), v]));
  }

  mock(): void {
    const self = this;
    
    Object.defineProperty(global, 'HTMLCanvasElement', {
      value: class MockCanvas {
        width = 300;
        height = 150;
        
        getContext(contextType: string): any {
          if (self.contextType === 'none') {
            return null;
          }
          
          if (contextType === 'webgl2' && self.contextType === 'webgl2') {
            return self.createWebGL2Context();
          } else if ((contextType === 'webgl' || contextType === 'experimental-webgl') && 
                     (self.contextType === 'webgl' || self.contextType === 'webgl2')) {
            return self.createWebGLContext();
          } else if (contextType === '2d') {
            return self.create2DContext();
          }
          
          return null;
        }
        
        toDataURL() {
          return 'data:image/png;base64,mock';
        }
      },
      configurable: true,
    });
    
    // Mock document.createElement for canvas
    const originalCreateElement = document.createElement;
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'canvas') {
        return new (global as any).HTMLCanvasElement();
      }
      return originalCreateElement.call(document, tagName);
    }) as any;
  }

  private createWebGL2Context(): WebGL2RenderingContext {
    return {
      // WebGL2 specific constants
      READ_FRAMEBUFFER: 0x8CA8,
      DRAW_FRAMEBUFFER: 0x8CA9,
      
      // Standard WebGL constants
      MAX_TEXTURE_SIZE: 0x0D33,
      MAX_VERTEX_ATTRIBS: 0x8869,
      MAX_TEXTURE_IMAGE_UNITS: 0x8872,
      MAX_RENDERBUFFER_SIZE: 0x84E8,
      
      getParameter: vi.fn((param: number) => {
        if (this.parameters.has(param)) {
          return this.parameters.get(param);
        }
        
        switch (param) {
          case 0x0D33: return 4096; // MAX_TEXTURE_SIZE
          case 0x8869: return 16;   // MAX_VERTEX_ATTRIBS
          case 0x8872: return 16;   // MAX_TEXTURE_IMAGE_UNITS
          case 0x84E8: return 4096; // MAX_RENDERBUFFER_SIZE
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
        return this.extensions.includes(name) ? {} : null;
      }),
      
      getSupportedExtensions: vi.fn(() => this.extensions),
      
      // WebGL2 specific methods
      getUniformBlockIndex: vi.fn(() => 0),
      uniformBlockBinding: vi.fn(),
      createVertexArray: vi.fn(() => ({})),
      bindVertexArray: vi.fn(),
      deleteVertexArray: vi.fn(),
      
      // Common WebGL methods
      createShader: vi.fn(() => ({})),
      createProgram: vi.fn(() => ({})),
      createBuffer: vi.fn(() => ({})),
      createTexture: vi.fn(() => ({})),
      
      getShaderParameter: vi.fn(() => true),
      getProgramParameter: vi.fn(() => true),
      getShaderInfoLog: vi.fn(() => ''),
      getProgramInfoLog: vi.fn(() => ''),
      
      // Context loss simulation
      isContextLost: vi.fn(() => false),
      getContextAttributes: vi.fn(() => ({
        alpha: true,
        antialias: true,
        depth: true,
        failIfMajorPerformanceCaveat: false,
        powerPreference: 'default',
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        stencil: false,
      })),
    } as any;
  }

  private createWebGLContext(): WebGLRenderingContext {
    const webgl2Context = this.createWebGL2Context();
    
    // Remove WebGL2-specific methods
    const webglContext = { ...webgl2Context };
    delete (webglContext as any).getUniformBlockIndex;
    delete (webglContext as any).uniformBlockBinding;
    delete (webglContext as any).createVertexArray;
    delete (webglContext as any).bindVertexArray;
    delete (webglContext as any).deleteVertexArray;
    delete (webglContext as any).READ_FRAMEBUFFER;
    delete (webglContext as any).DRAW_FRAMEBUFFER;
    
    return webglContext as any;
  }

  private create2DContext(): CanvasRenderingContext2D {
    return {
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
      
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4),
      })),
      putImageData: vi.fn(),
      
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      
      measureText: vi.fn(() => ({ width: 100 })),
      fillText: vi.fn(),
      strokeText: vi.fn(),
    } as any;
  }

  restore(): void {
    Object.defineProperty(global, 'HTMLCanvasElement', {
      value: this.originalHTMLCanvasElement,
      configurable: true,
    });
  }
}

// ========================
// Test Suite
// ========================

describe('WebGL Fallback Tests', () => {
  let webglMocker: WebGLMocker;

  beforeEach(() => {
    webglMocker = new WebGLMocker();
  });

  afterEach(() => {
    webglMocker.restore();
  });

  describe('WebGL2 Support Detection', () => {
    test('should detect WebGL2 support when available', () => {
      webglMocker.setContextType('webgl2');
      webglMocker.setAvailableExtensions(['OES_texture_float', 'WEBGL_debug_renderer_info']);
      webglMocker.mock();

      const optimizer = new (performanceOptimizer.constructor as any)();
      const gpu = optimizer.getMetrics().deviceCapabilities.gpu;

      expect(gpu.webglVersion).toBe('webgl2');
      expect(gpu.maxTextureSize).toBe(4096);
      expect(gpu.extensions).toContain('OES_texture_float');
    });

    test('should use advanced features when WebGL2 is available', () => {
      webglMocker.setContextType('webgl2');
      webglMocker.mock();

      expect(isFeatureSupported('webgl2')).toBe(true);
      expect(isFeatureSupported('webgl')).toBe(true);
    });
  });

  describe('WebGL1 Fallback', () => {
    test('should fallback to WebGL1 when WebGL2 is unavailable', () => {
      webglMocker.setContextType('webgl');
      webglMocker.setAvailableExtensions(['OES_texture_float']);
      webglMocker.mock();

      const optimizer = new (performanceOptimizer.constructor as any)();
      const gpu = optimizer.getMetrics().deviceCapabilities.gpu;

      expect(gpu.webglVersion).toBe('webgl');
      expect(gpu.maxTextureSize).toBeGreaterThan(0);
      expect(isFeatureSupported('webgl2')).toBe(false);
      expect(isFeatureSupported('webgl')).toBe(true);
    });

    test('should adapt rendering settings for WebGL1', () => {
      webglMocker.setContextType('webgl');
      webglMocker.mock();

      const optimizer = new (performanceOptimizer.constructor as any)();
      const settings = optimizer.optimizeRenderingSettings();

      // WebGL1 typically gets more conservative settings
      expect(settings.powerPreference).toBe('low-power');
      expect(settings.shadowMapEnabled).toBeDefined();
    });
  });

  describe('No WebGL Support', () => {
    test('should handle complete WebGL absence', () => {
      webglMocker.setContextType('none');
      webglMocker.mock();

      const optimizer = new (performanceOptimizer.constructor as any)();
      const gpu = optimizer.getMetrics().deviceCapabilities.gpu;

      expect(gpu.webglVersion).toBe('none');
      expect(gpu.maxTextureSize).toBe(0);
      expect(gpu.extensions).toEqual([]);
      expect(gpu.renderer).toBe('none');
    });

    test('should set potato performance level without WebGL', () => {
      webglMocker.setContextType('none');
      webglMocker.mock();

      const optimizer = new (performanceOptimizer.constructor as any)();
      const performance = optimizer.getMetrics().deviceCapabilities.performance;

      expect(performance).toBe('potato');
    });

    test('should provide fallback recommendations without WebGL', () => {
      webglMocker.setContextType('none');
      webglMocker.mock();

      const optimizer = new (performanceOptimizer.constructor as any)();
      
      expect(isFeatureSupported('webgl')).toBe(false);
      expect(isFeatureSupported('webgl2')).toBe(false);
    });
  });

  describe('Extension Detection', () => {
    test('should detect float texture support', () => {
      webglMocker.setContextType('webgl2');
      webglMocker.setAvailableExtensions(['OES_texture_float', 'OES_texture_half_float']);
      webglMocker.mock();

      expect(isFeatureSupported('float_textures')).toBe(true);
    });

    test('should handle missing float texture support', () => {
      webglMocker.setContextType('webgl');
      webglMocker.setAvailableExtensions([]);
      webglMocker.mock();

      expect(isFeatureSupported('float_textures')).toBe(false);
    });

    test('should detect instancing support', () => {
      webglMocker.setContextType('webgl');
      webglMocker.setAvailableExtensions(['ANGLE_instanced_arrays']);
      webglMocker.mock();

      expect(isFeatureSupported('instancing')).toBe(true);
    });
  });

  describe('Context Limitations', () => {
    test('should handle low texture size limits', () => {
      webglMocker.setContextType('webgl');
      webglMocker.setParameters({
        0x0D33: 1024, // MAX_TEXTURE_SIZE
      });
      webglMocker.mock();

      const optimizer = new (performanceOptimizer.constructor as any)();
      const gpu = optimizer.getMetrics().deviceCapabilities.gpu;

      expect(gpu.maxTextureSize).toBe(1024);
      
      // Should get low or potato performance with small texture limits
      const performance = optimizer.getMetrics().deviceCapabilities.performance;
      expect(['low', 'potato']).toContain(performance);
    });

    test('should handle limited vertex attributes', () => {
      webglMocker.setContextType('webgl');
      webglMocker.setParameters({
        0x8869: 8, // MAX_VERTEX_ATTRIBS - very low
      });
      webglMocker.mock();

      const optimizer = new (performanceOptimizer.constructor as any)();
      const gpu = optimizer.getMetrics().deviceCapabilities.gpu;

      expect(gpu.maxVertexAttribs).toBe(8);
    });
  });

  describe('Context Loss Handling', () => {
    test('should detect context loss', () => {
      webglMocker.setContextType('webgl2');
      webglMocker.mock();

      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      
      expect(gl).not.toBeNull();
      expect(gl!.isContextLost()).toBe(false);
    });

    test('should handle context restoration', () => {
      webglMocker.setContextType('webgl2');
      webglMocker.mock();

      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      
      // Mock context loss
      vi.mocked(gl!.isContextLost).mockReturnValue(true);
      expect(gl!.isContextLost()).toBe(true);
      
      // Mock restoration
      vi.mocked(gl!.isContextLost).mockReturnValue(false);
      expect(gl!.isContextLost()).toBe(false);
    });
  });

  describe('Performance Adaptation', () => {
    test('should adapt image processing for limited GPU', () => {
      webglMocker.setContextType('webgl');
      webglMocker.setParameters({
        0x0D33: 512, // Very small texture limit
      });
      webglMocker.mock();

      const optimizer = new (performanceOptimizer.constructor as any)();
      
      // Create mock image larger than GPU limit
      const mockImage = {
        width: 1024,
        height: 1024,
      } as HTMLImageElement;

      const result = optimizer.optimizeImageForProcessing(mockImage);
      
      expect(result.scaleFactor).toBeLessThan(1);
    });

    test('should simplify geometry for limited GPU', () => {
      webglMocker.setContextType('webgl');
      webglMocker.setParameters({
        0x8869: 8, // Limited vertex attributes
      });
      webglMocker.mock();

      const optimizer = new (performanceOptimizer.constructor as any)();
      const quality = optimizer.getRecommendedQuality();
      
      expect(['low', 'potato']).toContain(quality);
    });
  });

  describe('Canvas 2D Fallback', () => {
    test('should use Canvas 2D when WebGL is unavailable', () => {
      webglMocker.setContextType('none');
      webglMocker.mock();

      const canvas = document.createElement('canvas');
      const webglContext = canvas.getContext('webgl');
      const canvas2d = canvas.getContext('2d');

      expect(webglContext).toBeNull();
      expect(canvas2d).not.toBeNull();
    });

    test('should provide 2D canvas functionality', () => {
      webglMocker.setContextType('none');
      webglMocker.mock();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      expect(ctx).not.toBeNull();
      expect(typeof ctx!.fillRect).toBe('function');
      expect(typeof ctx!.drawImage).toBe('function');
      expect(typeof ctx!.getImageData).toBe('function');
    });
  });

  describe('Progressive Enhancement', () => {
    test('should provide better experience with better GPU support', () => {
      const results: Array<{ context: string; performance: string }> = [];

      // Test with no WebGL
      webglMocker.setContextType('none');
      webglMocker.mock();
      let optimizer = new (performanceOptimizer.constructor as any)();
      results.push({
        context: 'none',
        performance: optimizer.getMetrics().deviceCapabilities.performance,
      });

      // Test with WebGL1
      webglMocker.setContextType('webgl');
      webglMocker.mock();
      optimizer = new (performanceOptimizer.constructor as any)();
      results.push({
        context: 'webgl',
        performance: optimizer.getMetrics().deviceCapabilities.performance,
      });

      // Test with WebGL2
      webglMocker.setContextType('webgl2');
      webglMocker.mock();
      optimizer = new (performanceOptimizer.constructor as any)();
      results.push({
        context: 'webgl2',
        performance: optimizer.getMetrics().deviceCapabilities.performance,
      });

      // Performance should generally improve with better WebGL support
      expect(results[0].performance).toBe('potato'); // No WebGL
      expect(['low', 'medium', 'high']).toContain(results[1].performance); // WebGL1
      expect(['medium', 'high']).toContain(results[2].performance); // WebGL2
    });
  });

  describe('Error Handling', () => {
    test('should handle WebGL context creation errors gracefully', () => {
      // Mock a situation where getContext throws
      webglMocker.mock();
      
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = vi.fn(() => {
        throw new Error('WebGL not supported');
      });

      expect(() => {
        const optimizer = new (performanceOptimizer.constructor as any)();
        const gpu = optimizer.getMetrics().deviceCapabilities.gpu;
      }).not.toThrow();

      // Restore
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    test('should handle parameter query failures', () => {
      webglMocker.setContextType('webgl2');
      webglMocker.mock();

      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      
      // Mock parameter query to throw
      vi.mocked(gl!.getParameter).mockImplementation(() => {
        throw new Error('Parameter query failed');
      });

      expect(() => {
        const optimizer = new (performanceOptimizer.constructor as any)();
        const gpu = optimizer.getMetrics().deviceCapabilities.gpu;
      }).not.toThrow();
    });
  });
});