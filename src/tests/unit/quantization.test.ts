/**
 * Unit tests for K-means color quantization algorithm
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  KMeansQuantizer,
  quantizeImageColors,
  suggestColorCount,
  validateQuantizationParams,
  createColor,
  calculateLuminance,
  euclideanDistance,
  samplePixels
} from '../../modules/image';
import type { Color, QuantizedImageData } from '../../types';

// ========================
// Test Utilities
// ========================

/**
 * Create test image data with specified colors
 */
function createTestImageData(width: number, height: number, colors: Color[]): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const colorIndex = pixelIndex % colors.length;
    const color = colors[colorIndex];
    
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
    data[i + 3] = Math.round((color.a ?? 1) * 255);
  }
  
  return imageData;
}

/**
 * Create gradient image data for testing
 */
function createGradientImageData(width: number, height: number): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const value = Math.floor((x / width) * 255);
      
      data[index] = value; // R
      data[index + 1] = value; // G
      data[index + 2] = value; // B
      data[index + 3] = 255; // A
    }
  }
  
  return imageData;
}

/**
 * Create noisy image data for robustness testing
 */
function createNoisyImageData(width: number, height: number, baseColor: Color, noiseLevel: number = 20): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const noise = () => (Math.random() - 0.5) * noiseLevel * 2;
    
    data[i] = Math.max(0, Math.min(255, baseColor.r + noise()));
    data[i + 1] = Math.max(0, Math.min(255, baseColor.g + noise()));
    data[i + 2] = Math.max(0, Math.min(255, baseColor.b + noise()));
    data[i + 3] = Math.round((baseColor.a ?? 1) * 255);
  }
  
  return imageData;
}

// ========================
// Test Data
// ========================

const testColors = {
  red: createColor(255, 0, 0, 1),
  green: createColor(0, 255, 0, 1),
  blue: createColor(0, 0, 255, 1),
  black: createColor(0, 0, 0, 1),
  white: createColor(255, 255, 255, 1),
  gray: createColor(128, 128, 128, 1),
  transparent: createColor(0, 0, 0, 0),
  semitransparent: createColor(128, 128, 128, 0.5)
};

// ========================
// Color Utilities Tests
// ========================

describe('Color Utilities', () => {
  describe('createColor', () => {
    it('should create valid color objects', () => {
      const color = createColor(100, 150, 200, 0.8);
      
      expect(color.r).toBe(100);
      expect(color.g).toBe(150);
      expect(color.b).toBe(200);
      expect(color.a).toBe(0.8);
    });
    
    it('should clamp values to valid ranges', () => {
      const color = createColor(-10, 300, 150, 1.5);
      
      expect(color.r).toBe(0);
      expect(color.g).toBe(255);
      expect(color.b).toBe(150);
      expect(color.a).toBe(1);
    });
    
    it('should round RGB values to integers', () => {
      const color = createColor(100.7, 150.3, 200.9);
      
      expect(color.r).toBe(101);
      expect(color.g).toBe(150);
      expect(color.b).toBe(201);
    });
  });
  
  describe('calculateLuminance', () => {
    it('should calculate correct luminance for primary colors', () => {
      expect(calculateLuminance(testColors.red)).toBeCloseTo(76.245, 2);
      expect(calculateLuminance(testColors.green)).toBeCloseTo(149.685, 2);
      expect(calculateLuminance(testColors.blue)).toBeCloseTo(29.07, 2);
    });
    
    it('should calculate correct luminance for grayscale colors', () => {
      expect(calculateLuminance(testColors.black)).toBe(0);
      expect(calculateLuminance(testColors.white)).toBe(255);
      expect(calculateLuminance(testColors.gray)).toBeCloseTo(128, 1);
    });
  });
  
  describe('euclideanDistance', () => {
    it('should calculate zero distance for identical colors', () => {
      const distance = euclideanDistance(testColors.red, testColors.red);
      expect(distance).toBe(0);
    });
    
    it('should calculate correct distance between different colors', () => {
      const distance = euclideanDistance(testColors.black, testColors.white);
      expect(distance).toBeCloseTo(441.67, 1); // sqrt(255^2 + 255^2 + 255^2)
    });
    
    it('should be symmetric', () => {
      const d1 = euclideanDistance(testColors.red, testColors.blue);
      const d2 = euclideanDistance(testColors.blue, testColors.red);
      expect(d1).toBe(d2);
    });
  });
});

// ========================
// Sampling Tests
// ========================

describe('Pixel Sampling', () => {
  it('should sample all pixels for small images', () => {
    const imageData = createTestImageData(10, 10, [testColors.red, testColors.blue]);
    const samples = samplePixels(imageData, 1000);
    
    expect(samples).toHaveLength(100); // 10x10 = 100 pixels
  });
  
  it('should limit samples for large images', () => {
    const imageData = createTestImageData(100, 100, [testColors.red, testColors.blue]);
    const samples = samplePixels(imageData, 500);
    
    expect(samples.length).toBeLessThanOrEqual(500);
    expect(samples.length).toBeGreaterThan(0);
  });
  
  it('should exclude transparent pixels when requested', () => {
    const colors = [testColors.red, testColors.transparent, testColors.blue];
    const imageData = createTestImageData(30, 30, colors);
    const samples = samplePixels(imageData, 1000, { excludeTransparent: true });
    
    // Should have fewer samples due to transparent pixels being excluded
    expect(samples.length).toBeLessThan(900);
    // All samples should be opaque
    samples.forEach(sample => {
      expect(sample.color.a).toBeGreaterThan(0.1);
    });
  });
  
  it('should include corner pixels when preserveCorners is true', () => {
    const imageData = createTestImageData(50, 50, [testColors.red]);
    const samples = samplePixels(imageData, 100, { preserveCorners: true });
    
    // Check if corner positions are included
    const positions = samples.map(s => `${s.position.x},${s.position.y}`);
    expect(positions).toContain('0,0'); // Top-left
    expect(positions).toContain('49,0'); // Top-right
    expect(positions).toContain('0,49'); // Bottom-left
    expect(positions).toContain('49,49'); // Bottom-right
  });
});

// ========================
// K-Means Quantizer Tests
// ========================

describe('KMeansQuantizer', () => {
  let quantizer: KMeansQuantizer;
  let progressCallback: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    progressCallback = vi.fn();
    quantizer = new KMeansQuantizer({
      maxIterations: 10,
      convergenceThreshold: 0.1,
      maxSamples: 1000,
      onProgress: progressCallback
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Input Validation', () => {
    it('should reject invalid image data', async () => {
      await expect(
        quantizer.quantize(null as any, 4)
      ).rejects.toThrow('Invalid image data provided');
    });
    
    it('should reject invalid color counts', async () => {
      const imageData = createTestImageData(10, 10, [testColors.red]);
      
      await expect(quantizer.quantize(imageData, 1)).rejects.toThrow('Color count must be between 2 and 8');
      await expect(quantizer.quantize(imageData, 9)).rejects.toThrow('Color count must be between 2 and 8');
    });
    
    it('should reject images with invalid dimensions', async () => {
      const imageData = new ImageData(0, 0);
      
      await expect(quantizer.quantize(imageData, 4)).rejects.toThrow('Image dimensions must be positive');
    });
  });
  
  describe('Basic Functionality', () => {
    it('should quantize simple two-color image', async () => {
      const imageData = createTestImageData(20, 20, [testColors.red, testColors.blue]);
      const result = await quantizer.quantize(imageData, 2);
      
      expect(result.colorPalette).toHaveLength(2);
      expect(result.imageData.width).toBe(20);
      expect(result.imageData.height).toBe(20);
      expect(result.heightMap).toHaveLength(400); // 20x20
    });
    
    it('should handle single color images', async () => {
      const imageData = createTestImageData(10, 10, [testColors.red]);
      const result = await quantizer.quantize(imageData, 2);
      
      expect(result.colorPalette).toHaveLength(2);
      // All pixels should be assigned to one cluster
      const uniqueColors = new Set();
      for (let i = 0; i < result.imageData.data.length; i += 4) {
        const r = result.imageData.data[i];
        const g = result.imageData.data[i + 1];
        const b = result.imageData.data[i + 2];
        uniqueColors.add(`${r},${g},${b}`);
      }
      expect(uniqueColors.size).toBeLessThanOrEqual(2);
    });
    
    it('should generate appropriate height map', async () => {
      const colors = [testColors.black, testColors.gray, testColors.white];
      const imageData = createTestImageData(10, 10, colors);
      const result = await quantizer.quantize(imageData, 3);
      
      // Height map should have values between 0 and 1
      for (let i = 0; i < result.heightMap.length; i++) {
        expect(result.heightMap[i]).toBeGreaterThanOrEqual(0);
        expect(result.heightMap[i]).toBeLessThanOrEqual(1);
      }
      
      // Should have different height levels
      const uniqueHeights = new Set(Array.from(result.heightMap));
      expect(uniqueHeights.size).toBeGreaterThan(1);
    });
  });
  
  describe('Progress Reporting', () => {
    it('should report progress during quantization', async () => {
      const imageData = createTestImageData(50, 50, [testColors.red, testColors.green, testColors.blue]);
      await quantizer.quantize(imageData, 3);
      
      expect(progressCallback).toHaveBeenCalled();
      
      // Check that all stages are reported
      const stages = progressCallback.mock.calls.map(call => call[0].stage);
      expect(stages).toContain('sampling');
      expect(stages).toContain('initialization');
      expect(stages).toContain('clustering');
      expect(stages).toContain('assignment');
      expect(stages).toContain('complete');
    });
    
    it('should report progress values between 0 and 1', async () => {
      const imageData = createTestImageData(30, 30, [testColors.red, testColors.blue]);
      await quantizer.quantize(imageData, 2);
      
      progressCallback.mock.calls.forEach(call => {
        const progress = call[0].progress;
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(1);
      });
    });
  });
  
  describe('Performance', () => {
    it('should complete small image quantization quickly', async () => {
      const imageData = createTestImageData(50, 50, [testColors.red, testColors.green, testColors.blue]);
      const startTime = performance.now();
      
      await quantizer.quantize(imageData, 3);
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
    
    it('should handle noisy images without crashing', async () => {
      const imageData = createNoisyImageData(100, 100, testColors.gray, 50);
      
      await expect(quantizer.quantize(imageData, 4)).resolves.toBeDefined();
    });
  });
  
  describe('Algorithm Quality', () => {
    it('should converge for gradient images', async () => {
      const imageData = createGradientImageData(50, 20);
      const result = await quantizer.quantize(imageData, 4);
      
      // Palette should span the gradient range
      const luminances = result.colorPalette.map(calculateLuminance).sort((a, b) => a - b);
      expect(luminances[0]).toBeLessThan(luminances[luminances.length - 1]);
      
      // Should have reasonable spread
      const range = luminances[luminances.length - 1] - luminances[0];
      expect(range).toBeGreaterThan(50); // Reasonable contrast
    });
    
    it('should preserve transparency when requested', async () => {
      const quantizer = new KMeansQuantizer({ preserveTransparency: true });
      const colors = [testColors.red, testColors.transparent, testColors.blue];
      const imageData = createTestImageData(20, 20, colors);
      
      const result = await quantizer.quantize(imageData, 3);
      
      // Should have some transparent pixels in output
      let hasTransparent = false;
      for (let i = 3; i < result.imageData.data.length; i += 4) {
        if (result.imageData.data[i] < 128) { // Alpha < 0.5
          hasTransparent = true;
          break;
        }
      }
      expect(hasTransparent).toBe(true);
    });
  });
  
  describe('Cancellation', () => {
    it('should support cancellation via AbortSignal', async () => {
      const controller = new AbortController();
      const quantizer = new KMeansQuantizer({ signal: controller.signal });
      const imageData = createTestImageData(1000, 1000, [testColors.red, testColors.green, testColors.blue]);
      
      // Cancel immediately
      controller.abort();
      
      await expect(quantizer.quantize(imageData, 4)).rejects.toThrow('Quantization cancelled');
    });
  });
});

// ========================
// Convenience Functions Tests
// ========================

describe('Convenience Functions', () => {
  describe('quantizeImageColors', () => {
    it('should work as a convenience wrapper', async () => {
      const imageData = createTestImageData(20, 20, [testColors.red, testColors.blue]);
      const result = await quantizeImageColors(imageData, 2);
      
      expect(result.colorPalette).toHaveLength(2);
      expect(result.imageData).toBeDefined();
      expect(result.heightMap).toBeDefined();
    });
  });
  
  describe('suggestColorCount', () => {
    it('should suggest reasonable color counts', () => {
      // Simple two-color image
      const simpleImage = createTestImageData(20, 20, [testColors.red, testColors.blue]);
      const simpleCount = suggestColorCount(simpleImage);
      expect(simpleCount).toBeGreaterThanOrEqual(2);
      expect(simpleCount).toBeLessThanOrEqual(8);
      
      // Complex gradient image
      const complexImage = createGradientImageData(100, 100);
      const complexCount = suggestColorCount(complexImage);
      expect(complexCount).toBeGreaterThan(simpleCount);
    });
  });
  
  describe('validateQuantizationParams', () => {
    it('should validate valid parameters', () => {
      const imageData = createTestImageData(20, 20, [testColors.red]);
      const result = validateQuantizationParams(imageData, 4);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should catch invalid parameters', () => {
      const imageData = createTestImageData(20, 20, [testColors.red]);
      
      // Invalid color count
      let result = validateQuantizationParams(imageData, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Invalid image data
      result = validateQuantizationParams(null as any, 4);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ========================
// Edge Cases and Robustness Tests
// ========================

describe('Edge Cases and Robustness', () => {
  it('should handle images with all transparent pixels', async () => {
    const quantizer = new KMeansQuantizer({ preserveTransparency: false });
    const imageData = createTestImageData(10, 10, [testColors.transparent]);
    
    await expect(quantizer.quantize(imageData, 2)).rejects.toThrow();
  });
  
  it('should handle very small images', async () => {
    const imageData = createTestImageData(2, 2, [testColors.red, testColors.blue]);
    const result = await quantizeImageColors(imageData, 2);
    
    expect(result.colorPalette).toHaveLength(2);
    expect(result.heightMap).toHaveLength(4);
  });
  
  it('should handle images with more colors than requested clusters', async () => {
    const colors = [testColors.red, testColors.green, testColors.blue, testColors.black, testColors.white];
    const imageData = createTestImageData(25, 25, colors);
    const result = await quantizeImageColors(imageData, 3);
    
    expect(result.colorPalette).toHaveLength(3);
  });
  
  it('should be deterministic with fixed seed (conceptually)', async () => {
    // Note: Due to Math.random() usage, exact determinism would require 
    // a seeded random number generator, but we can test consistency
    const imageData = createTestImageData(20, 20, [testColors.red, testColors.blue]);
    
    const result1 = await quantizeImageColors(imageData, 2);
    const result2 = await quantizeImageColors(imageData, 2);
    
    // Results should be similar (same number of colors, similar color values)
    expect(result1.colorPalette).toHaveLength(result2.colorPalette.length);
  });
});

// ========================
// Performance Benchmarks
// ========================

describe('Performance Benchmarks', () => {
  it('should meet performance targets for large images', async () => {
    // Create a large test image (but within processing limits)
    const imageData = createTestImageData(500, 500, [
      testColors.red, testColors.green, testColors.blue, testColors.black, testColors.white
    ]);
    
    const startTime = performance.now();
    const result = await quantizeImageColors(imageData, 4, {
      maxSamples: 8000 // Use reasonable sampling for large image
    });
    const duration = performance.now() - startTime;
    
    // Should complete within 3 seconds
    expect(duration).toBeLessThan(3000);
    expect(result.colorPalette).toHaveLength(4);
  }, 5000); // 5 second timeout for this test
  
  it('should handle memory efficiently', async () => {
    const imageData = createTestImageData(500, 500, [
      testColors.red, testColors.green, testColors.blue
    ]);
    
    // This test mainly ensures no memory leaks cause the test to fail
    const result = await quantizeImageColors(imageData, 3);
    expect(result).toBeDefined();
    
    // Cleanup should happen automatically
    expect(result.imageData.data.length).toBeGreaterThan(0);
  });
});

// ========================
// Integration-like Tests
// ========================

describe('Integration with Type System', () => {
  it('should return properly typed QuantizedImageData', async () => {
    const imageData = createTestImageData(10, 10, [testColors.red, testColors.blue]);
    const result = await quantizeImageColors(imageData, 2);
    
    // Check type structure
    expect(result).toHaveProperty('imageData');
    expect(result).toHaveProperty('colorPalette');
    expect(result).toHaveProperty('heightMap');
    
    // Check imageData structure
    expect(result.imageData).toHaveProperty('width');
    expect(result.imageData).toHaveProperty('height');
    expect(result.imageData).toHaveProperty('data');
    
    // Check color palette structure
    result.colorPalette.forEach(color => {
      expect(color).toHaveProperty('r');
      expect(color).toHaveProperty('g');
      expect(color).toHaveProperty('b');
      expect(color).toHaveProperty('a');
      expect(typeof color.r).toBe('number');
      expect(typeof color.g).toBe('number');
      expect(typeof color.b).toBe('number');
      expect(typeof color.a).toBe('number');
    });
    
    // Check height map
    expect(result.heightMap).toBeInstanceOf(Float32Array);
  });
});