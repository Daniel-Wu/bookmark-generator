/**
 * Unit tests for image validation functions
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  validateFileFormat,
  validateFileSize,
  validateImageDimensions,
  validateImageFile,
  createFormatError,
  createSizeError,
  createDimensionError,
  combineValidationResults
} from '../../modules/image/validation';
import { ValidationErrorCode } from '../../types/errors';
import { FILE_CONSTRAINTS } from '../../utils/fileProcessing';

// ========================
// Test Utilities
// ========================

function createMockFile(
  name: string,
  type: string,
  size: number,
  content: string = 'mock content'
): File {
  const blob = new Blob([content], { type });
  Object.defineProperty(blob, 'name', { value: name });
  Object.defineProperty(blob, 'size', { value: size });
  return blob as File;
}

function createMockImage(width: number, height: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'naturalWidth', { value: width });
  Object.defineProperty(img, 'naturalHeight', { value: height });
  return img;
}

// Mock canvas and context
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(100 * 100 * 4).fill(128), // Gray image
      width: 100,
      height: 100
    }))
  }))
};

// Mock document.createElement
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn((tag: string) => {
      if (tag === 'canvas') return mockCanvas;
      return {};
    })
  }
});

// ========================
// File Format Validation Tests
// ========================

describe('validateFileFormat', () => {
  it('should accept valid PNG files', () => {
    const file = createMockFile('test.png', 'image/png', 1000);
    const result = validateFileFormat(file);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept valid JPEG files', () => {
    const file = createMockFile('test.jpg', 'image/jpeg', 1000);
    const result = validateFileFormat(file);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept valid GIF files', () => {
    const file = createMockFile('test.gif', 'image/gif', 1000);
    const result = validateFileFormat(file);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept valid WebP files', () => {
    const file = createMockFile('test.webp', 'image/webp', 1000);
    const result = validateFileFormat(file);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject unsupported formats', () => {
    const file = createMockFile('test.bmp', 'image/bmp', 1000);
    const result = validateFileFormat(file);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(2); // MIME type + extension
    expect(result.errors[0]).toContain('Unsupported file format');
  });

  it('should reject files with invalid extensions', () => {
    const file = createMockFile('test.txt', 'text/plain', 1000);
    const result = validateFileFormat(file);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(2); // Both MIME type and extension
  });

  it('should warn when MIME type is missing but extension is valid', () => {
    const file = createMockFile('test.png', '', 1000);
    const result = validateFileFormat(file);
    
    expect(result.isValid).toBe(true); // Should be valid with good extension
    expect(result.warnings).toContain('File type could not be determined from MIME type');
  });

  it('should handle mismatched MIME type and extension', () => {
    const file = createMockFile('test.png', 'image/jpeg', 1000);
    const result = validateFileFormat(file);
    
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('File extension does not match MIME type, but MIME type is valid');
  });
});

// ========================
// File Size Validation Tests
// ========================

describe('validateFileSize', () => {
  it('should accept files within size limits', () => {
    const file = createMockFile('test.png', 'image/png', 1024 * 1024); // 1MB
    const result = validateFileSize(file);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject files that are too small', () => {
    const file = createMockFile('test.png', 'image/png', 1000); // 1KB
    const result = validateFileSize(file);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('too small');
  });

  it('should reject files that are too large', () => {
    const file = createMockFile('test.png', 'image/png', 20 * 1024 * 1024); // 20MB
    const result = validateFileSize(file);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('too large');
  });

  it('should warn about large files that may impact performance', () => {
    const file = createMockFile('test.png', 'image/png', 9 * 1024 * 1024); // 9MB (80% of limit)
    const result = validateFileSize(file);
    
    expect(result.isValid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('quite large');
  });
});

// ========================
// Image Dimension Validation Tests
// ========================

describe('validateImageDimensions', () => {
  it('should accept images with valid dimensions', () => {
    const image = createMockImage(512, 512);
    const result = validateImageDimensions(image);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject images that are too small', () => {
    const image = createMockImage(30, 30);
    const result = validateImageDimensions(image);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('too small');
  });

  it('should reject images that are too large', () => {
    const image = createMockImage(5000, 5000);
    const result = validateImageDimensions(image);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('too large');
  });

  it('should warn about unsuitable aspect ratios for bookmarks', () => {
    const image = createMockImage(100, 500); // 1:5 ratio
    const result = validateImageDimensions(image);
    
    expect(result.isValid).toBe(true);
    expect(result.warnings.some(w => w.includes('Aspect ratio'))).toBe(true);
  });

  it('should warn about very large images that may impact performance', () => {
    const image = createMockImage(3000, 3000); // 9MP
    const result = validateImageDimensions(image);
    
    expect(result.isValid).toBe(true);
    expect(result.warnings.some(w => w.includes('Large images'))).toBe(true);
  });

  it('should accept bookmark-suitable aspect ratios', () => {
    const image = createMockImage(300, 150); // 2:1 ratio
    const result = validateImageDimensions(image);
    
    expect(result.isValid).toBe(true);
    expect(result.warnings.filter(w => w.includes('Aspect ratio'))).toHaveLength(0);
  });
});

// ========================
// Error Creation Tests
// ========================

describe('createFormatError', () => {
  it('should create FileFormatError with suggestions', () => {
    const file = createMockFile('test.bmp', 'image/bmp', 1000);
    const error = createFormatError(file);
    
    expect(error.code).toBe(ValidationErrorCode.INVALID_FORMAT);
    expect(error.suggestions.length).toBeGreaterThanOrEqual(2);
    expect(error.recoverable).toBe(true);
  });
});

describe('createSizeError', () => {
  it('should create FileSizeError with auto-resize suggestion', () => {
    const file = createMockFile('test.png', 'image/png', 20 * 1024 * 1024);
    const error = createSizeError(file);
    
    expect(error.code).toBe(ValidationErrorCode.FILE_TOO_LARGE);
    expect(error.suggestions).toHaveLength(3); // Auto-resize + 2 manual suggestions
    expect(error.suggestions.some(s => s.autoApplicable)).toBe(true);
  });
});

describe('createDimensionError', () => {
  it('should create DimensionError with auto-resize suggestion', () => {
    const error = createDimensionError(5000, 5000);
    
    expect(error.code).toBe(ValidationErrorCode.DIMENSIONS_TOO_LARGE);
    expect(error.suggestions.length).toBeGreaterThanOrEqual(1); // At least auto-resize
    expect(error.suggestions.some(s => s.autoApplicable)).toBe(true);
  });
});

// ========================
// Validation Result Combination Tests
// ========================

describe('combineValidationResults', () => {
  it('should combine multiple validation results correctly', () => {
    const result1 = { isValid: true, errors: [], warnings: ['Warning 1'] };
    const result2 = { isValid: false, errors: ['Error 1'], warnings: [] };
    const result3 = { isValid: true, errors: [], warnings: ['Warning 2'] };
    
    const combined = combineValidationResults(result1, result2, result3);
    
    expect(combined.isValid).toBe(false);
    expect(combined.errors).toEqual(['Error 1']);
    expect(combined.warnings).toEqual(['Warning 1', 'Warning 2']);
  });

  it('should return valid result when all inputs are valid', () => {
    const result1 = { isValid: true, errors: [], warnings: ['Warning 1'] };
    const result2 = { isValid: true, errors: [], warnings: ['Warning 2'] };
    
    const combined = combineValidationResults(result1, result2);
    
    expect(combined.isValid).toBe(true);
    expect(combined.errors).toHaveLength(0);
    expect(combined.warnings).toEqual(['Warning 1', 'Warning 2']);
  });
});

// ========================
// Integration Tests
// ========================

describe('validateImageFile integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    
    // Mock Image constructor
    global.Image = vi.fn().mockImplementation(() => {
      const img = {
        naturalWidth: 512,
        naturalHeight: 512,
        onload: null as any,
        onerror: null as any,
        src: ''
      };
      
      // Simulate successful image loading
      setTimeout(() => {
        if (img.onload) img.onload();
      }, 0);
      
      return img;
    }) as any;
    
    // Mock FileReader
    global.FileReader = vi.fn().mockImplementation(() => ({
      readAsArrayBuffer: vi.fn(),
      onload: null as any,
      onerror: null as any,
      onabort: null as any,
      result: new ArrayBuffer(100)
    })) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should validate a good image file successfully', async () => {
    const file = createMockFile('test.png', 'image/png', 1024 * 1024);
    
    // Mock header validation to return valid
    const mockFileReader = {
      readAsArrayBuffer: vi.fn(),
      onload: null as any,
      onerror: null as any,
      result: new ArrayBuffer(100)
    };
    
    global.FileReader = vi.fn(() => mockFileReader) as any;
    
    // Simulate successful file reading
    setTimeout(() => {
      const view = new DataView(new ArrayBuffer(100));
      // Set PNG signature
      view.setUint8(0, 137);
      view.setUint8(1, 80);
      view.setUint8(2, 78);
      view.setUint8(3, 71);
      
      mockFileReader.result = view.buffer;
      if (mockFileReader.onload) mockFileReader.onload();
    }, 0);
    
    const result = await validateImageFile(file);
    
    expect(result.isValid).toBe(true);
  });

  it('should reject files with invalid format', async () => {
    const file = createMockFile('test.txt', 'text/plain', 1000);
    
    const result = await validateImageFile(file);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Unsupported file format'))).toBe(true);
  });
});

// ========================
// Edge Case Tests
// ========================

describe('Edge cases', () => {
  it('should handle files without extensions', () => {
    const file = createMockFile('test', 'image/png', 1024 * 1024);
    const result = validateFileFormat(file);
    
    expect(result.isValid).toBe(true);
    // No warnings expected since MIME type is valid
  });

  it('should handle zero-byte files', () => {
    const file = createMockFile('test.png', 'image/png', 0);
    const result = validateFileSize(file);
    
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('too small');
  });

  it('should handle square images (1:1 aspect ratio)', () => {
    const image = createMockImage(512, 512);
    const result = validateImageDimensions(image);
    
    expect(result.isValid).toBe(true);
    // Should warn about aspect ratio for bookmarks
    expect(result.warnings.some(w => w.includes('aspect ratio'))).toBe(true);
  });

  it('should handle exact boundary dimensions', () => {
    const minImage = createMockImage(FILE_CONSTRAINTS.MIN_DIMENSION, FILE_CONSTRAINTS.MIN_DIMENSION);
    const minResult = validateImageDimensions(minImage);
    expect(minResult.isValid).toBe(true);
    
    const maxImage = createMockImage(FILE_CONSTRAINTS.MAX_DIMENSION, FILE_CONSTRAINTS.MAX_DIMENSION);
    const maxResult = validateImageDimensions(maxImage);
    expect(maxResult.isValid).toBe(true);
  });
});