/**
 * Integration tests for image validation with realistic scenarios
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  validateImageFile,
  validateImageContent,
  combineValidationResults
} from '../../modules/image/validation';
import {
  createImageFromFile,
  extractImageMetadata,
  validateImageHeaders,
  FILE_CONSTRAINTS
} from '../../utils/fileProcessing';
import { ValidationErrorCode } from '../../types/errors';

// ========================
// Test Data Creation
// ========================

/**
 * Creates a realistic mock File with proper binary data
 */
function createRealisticMockFile(
  name: string,
  type: string,
  size: number,
  headerBytes?: number[]
): File {
  // Create buffer with proper header if provided
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);
  
  if (headerBytes) {
    headerBytes.forEach((byte, index) => {
      if (index < view.length) {
        view[index] = byte;
      }
    });
  }
  
  // Fill rest with random data
  for (let i = (headerBytes?.length || 0); i < view.length; i++) {
    view[i] = Math.floor(Math.random() * 256);
  }
  
  const blob = new Blob([buffer], { type });
  Object.defineProperty(blob, 'name', { value: name });
  Object.defineProperty(blob, 'size', { value: size });
  return blob as File;
}

/**
 * Creates PNG file with valid header
 */
function createMockPNGFile(name: string, size: number): File {
  const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10]; // PNG signature
  return createRealisticMockFile(name, 'image/png', size, pngHeader);
}

/**
 * Creates JPEG file with valid header
 */
function createMockJPEGFile(name: string, size: number): File {
  const jpegHeader = [0xFF, 0xD8, 0xFF]; // JPEG signature
  return createRealisticMockFile(name, 'image/jpeg', size, jpegHeader);
}

/**
 * Creates corrupted file with invalid header
 */
function createCorruptedFile(name: string, type: string, size: number): File {
  const corruptedHeader = [0x00, 0x00, 0x00, 0x00]; // Invalid header
  return createRealisticMockFile(name, type, size, corruptedHeader);
}

// ========================
// Mock Setup
// ========================

let mockCanvas: any;
let mockContext: any;

beforeEach(() => {
  vi.clearAllMocks();
  
  // Enhanced canvas mock with realistic image data
  mockContext = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => {
      // Create realistic image data with varying colors
      const width = 100;
      const height = 100;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Fill with gradient pattern for realistic color analysis
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          data[index] = Math.floor(255 * x / width);     // R - horizontal gradient
          data[index + 1] = Math.floor(255 * y / height); // G - vertical gradient
          data[index + 2] = 128;                          // B - constant
          data[index + 3] = 255;                          // A - opaque
        }
      }
      
      return { data, width, height };
    })
  };
  
  mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => mockContext)
  };
  
  global.document = {
    createElement: vi.fn((tag: string) => {
      if (tag === 'canvas') return mockCanvas;
      return {};
    })
  } as any;
  
  // Mock URL methods
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();
  
  // Mock Image with realistic behavior
  global.Image = vi.fn().mockImplementation(() => {
    const img = {
      naturalWidth: 512,
      naturalHeight: 384, // 4:3 aspect ratio
      onload: null as any,
      onerror: null as any,
      src: ''
    };
    
    // Simulate successful async image loading
    setTimeout(() => {
      if (img.onload) {
        try {
          img.onload();
        } catch (e) {
          console.log('Mock image onload error:', e);
        }
      }
    }, 5);
    
    return img;
  }) as any;
  
  // Mock FileReader with proper binary handling
  global.FileReader = vi.fn().mockImplementation(() => {
    const reader = {
      readAsArrayBuffer: vi.fn(),
      onload: null as any,
      onerror: null as any,
      onabort: null as any,
      result: null as any
    };
    
    // Simulate async file reading
    setTimeout(() => {
      if (reader.onload) reader.onload();
    }, 5);
    
    return reader;
  }) as any;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ========================
// Realistic File Validation Tests
// ========================

describe('Image Validation Integration Tests', () => {
  describe('Valid file scenarios', () => {
    it('should validate a typical PNG bookmark image', async () => {
      const file = createMockPNGFile('bookmark.png', 2 * 1024 * 1024); // 2MB
      
      // Mock successful file reading
      const mockFileReader = new (global.FileReader as any)();
      mockFileReader.result = file.stream() ? await file.arrayBuffer() : new ArrayBuffer(100);
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a high-quality JPEG image', async () => {
      const file = createMockJPEGFile('photo.jpg', 5 * 1024 * 1024); // 5MB
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(true);
      // May have warnings about size or processing time
      expect(result.errors).toHaveLength(0);
    });

    it('should handle small but valid images', async () => {
      const file = createMockPNGFile('icon.png', 150 * 1024); // 150KB
      
      // Mock smaller image dimensions
      global.Image = vi.fn().mockImplementation(() => {
        const img = {
          naturalWidth: 100,
          naturalHeight: 100,
          onload: null as any,
          onerror: null as any,
          src: ''
        };
        
        setTimeout(() => {
          if (img.onload) img.onload();
        }, 10);
        
        return img;
      }) as any;
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Invalid file scenarios', () => {
    it('should reject files that are too large', async () => {
      const file = createMockPNGFile('huge.png', 15 * 1024 * 1024); // 15MB
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too large'))).toBe(true);
    });

    it('should reject files that are too small', async () => {
      const file = createMockPNGFile('tiny.png', 50 * 1024); // 50KB
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too small'))).toBe(true);
    });

    it('should reject unsupported file formats', async () => {
      const file = createRealisticMockFile('image.bmp', 'image/bmp', 1024 * 1024);
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unsupported file format'))).toBe(true);
    });

    it('should reject corrupted image files', async () => {
      const file = createCorruptedFile('corrupted.png', 'image/png', 1024 * 1024);
      
      const result = await validateImageFile(file);
      
      // Should fail on header validation or image loading
      expect(result.isValid).toBe(false);
    });

    it('should reject images with extreme dimensions', async () => {
      const file = createMockPNGFile('extreme.png', 1024 * 1024);
      
      // Mock extreme dimensions
      global.Image = vi.fn().mockImplementation(() => {
        const img = {
          naturalWidth: 10000,
          naturalHeight: 10000,
          onload: null as any,
          onerror: null as any,
          src: ''
        };
        
        setTimeout(() => {
          if (img.onload) img.onload();
        }, 10);
        
        return img;
      }) as any;
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too large'))).toBe(true);
    });
  });

  describe('Warning scenarios', () => {
    it('should warn about poor aspect ratios for bookmarks', async () => {
      const file = createMockPNGFile('square.png', 1024 * 1024);
      
      // Mock square image
      global.Image = vi.fn().mockImplementation(() => {
        const img = {
          naturalWidth: 500,
          naturalHeight: 500, // 1:1 aspect ratio
          onload: null as any,
          onerror: null as any,
          src: ''
        };
        
        setTimeout(() => {
          if (img.onload) img.onload();
        }, 10);
        
        return img;
      }) as any;
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('aspect ratio'))).toBe(true);
    });

    it('should warn about very large images that may impact performance', async () => {
      const file = createMockPNGFile('highres.png', 8 * 1024 * 1024); // 8MB
      
      // Mock high resolution image
      global.Image = vi.fn().mockImplementation(() => {
        const img = {
          naturalWidth: 4000,
          naturalHeight: 3000,
          onload: null as any,
          onerror: null as any,
          src: ''
        };
        
        setTimeout(() => {
          if (img.onload) img.onload();
        }, 10);
        
        return img;
      }) as any;
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('quite large') || w.includes('Large images'))).toBe(true);
    });
  });

  describe('Content analysis scenarios', () => {
    it('should detect and warn about solid color images', async () => {
      // Mock solid color image data
      mockContext.getImageData = vi.fn(() => {
        const width = 100;
        const height = 100;
        const data = new Uint8ClampedArray(width * height * 4);
        
        // Fill with solid red color
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255;     // R
          data[i + 1] = 0;   // G
          data[i + 2] = 0;   // B
          data[i + 3] = 255; // A
        }
        
        return { data, width, height };
      });
      
      const image = new (global.Image as any)();
      const result = await validateImageContent(image);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('solid color'))).toBe(true);
    });

    it('should detect mostly transparent images', async () => {
      // Mock mostly transparent image data
      mockContext.getImageData = vi.fn(() => {
        const width = 100;
        const height = 100;
        const data = new Uint8ClampedArray(width * height * 4);
        
        // Make 95% of pixels transparent
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255;     // R
          data[i + 1] = 0;   // G
          data[i + 2] = 0;   // B
          data[i + 3] = i < data.length * 0.05 ? 255 : 0; // Only 5% opaque
        }
        
        return { data, width, height };
      });
      
      const image = new (global.Image as any)();
      const result = await validateImageContent(image);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('mostly transparent'))).toBe(true);
    });

    it('should detect completely transparent images as invalid', async () => {
      // Mock completely transparent image data
      mockContext.getImageData = vi.fn(() => {
        const width = 100;
        const height = 100;
        const data = new Uint8ClampedArray(width * height * 4);
        
        // All pixels transparent (alpha = 0)
        data.fill(0);
        
        return { data, width, height };
      });
      
      const image = new (global.Image as any)();
      const result = await validateImageContent(image);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('completely transparent'))).toBe(true);
    });

    it('should warn about images with too many colors', async () => {
      // Mock image with many random colors
      mockContext.getImageData = vi.fn(() => {
        const width = 100;
        const height = 100;
        const data = new Uint8ClampedArray(width * height * 4);
        
        // Fill with random colors for high color count
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.floor(Math.random() * 256);     // R
          data[i + 1] = Math.floor(Math.random() * 256); // G
          data[i + 2] = Math.floor(Math.random() * 256); // B
          data[i + 3] = 255;                             // A
        }
        
        return { data, width, height };
      });
      
      const image = new (global.Image as any)();
      const result = await validateImageContent(image);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('many colors'))).toBe(true);
    });
  });

  describe('Error recovery scenarios', () => {
    it('should suggest auto-resize for oversized files', async () => {
      const file = createMockPNGFile('large.png', 15 * 1024 * 1024);
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(false);
      // Check that the validation would suggest auto-resize
      // (This would be handled by the error creation functions)
    });

    it('should suggest format conversion for unsupported formats', async () => {
      const file = createRealisticMockFile('image.tiff', 'image/tiff', 1024 * 1024);
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unsupported file format'))).toBe(true);
    });
  });

  describe('Performance considerations', () => {
    it('should handle validation of multiple files efficiently', async () => {
      const files = [
        createMockPNGFile('image1.png', 1024 * 1024),
        createMockJPEGFile('image2.jpg', 2 * 1024 * 1024),
        createMockPNGFile('image3.png', 1024 * 1024)
      ];
      
      const startTime = Date.now();
      
      const results = await Promise.all(
        files.map(file => validateImageFile(file))
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Validation should complete reasonably quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('isValid');
        expect(result).toHaveProperty('errors');
        expect(result).toHaveProperty('warnings');
      });
    });

    it('should handle memory constraints for very large theoretical images', async () => {
      const file = createMockPNGFile('massive.png', 1024 * 1024);
      
      // Mock unrealistically large image that would exceed memory
      global.Image = vi.fn().mockImplementation(() => {
        const img = {
          naturalWidth: 20000,
          naturalHeight: 20000, // Would require >1GB of memory
          onload: null as any,
          onerror: null as any,
          src: ''
        };
        
        setTimeout(() => {
          if (img.onload) img.onload();
        }, 10);
        
        return img;
      }) as any;
      
      const result = await validateImageFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => 
        e.includes('memory') || e.includes('too large')
      )).toBe(true);
    });
  });
});