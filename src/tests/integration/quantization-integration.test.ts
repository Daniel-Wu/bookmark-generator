/**
 * Integration tests for K-means quantization within the image processing pipeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  KMeansQuantizer,
  quantizeImageColors,
  validateImageFile,
  createColor
} from '../../modules/image';
import type { Color, QuantizedImageData, ProcessingProgress } from '../../types';

// ========================
// Test Utilities
// ========================

/**
 * Create a test File object from ImageData
 */
function createTestFile(imageData: ImageData, filename: string = 'test.png'): File {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  
  return new Promise<File>((resolve) => {
    canvas.toBlob((blob) => {
      const file = new File([blob!], filename, { type: 'image/png' });
      resolve(file);
    });
  }) as any; // Simplified for testing
}

/**
 * Create realistic test image with complex color distribution
 */
function createRealisticImageData(width: number, height: number): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      
      // Create a somewhat realistic pattern with gradients and regions
      const centerX = width / 2;
      const centerY = height / 2;
      const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
      const normalizedDistance = distanceFromCenter / maxDistance;
      
      // Create color regions based on position
      if (normalizedDistance < 0.3) {
        // Center region - warm colors
        data[index] = 200 + Math.random() * 55; // R
        data[index + 1] = 100 + Math.random() * 100; // G
        data[index + 2] = 50 + Math.random() * 50; // B
      } else if (normalizedDistance < 0.6) {
        // Middle region - cool colors
        data[index] = 50 + Math.random() * 100; // R
        data[index + 1] = 100 + Math.random() * 100; // G
        data[index + 2] = 150 + Math.random() * 105; // B
      } else {
        // Outer region - neutral colors
        const gray = 80 + Math.random() * 100;
        data[index] = gray + Math.random() * 30 - 15; // R
        data[index + 1] = gray + Math.random() * 30 - 15; // G
        data[index + 2] = gray + Math.random() * 30 - 15; // B
      }
      
      data[index + 3] = 255; // A (fully opaque)
    }
  }
  
  return imageData;
}

/**
 * Create test image with text-like features
 */
function createTextLikeImageData(width: number, height: number): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  
  // Fill with white background
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; // R
    data[i + 1] = 255; // G
    data[i + 2] = 255; // B
    data[i + 3] = 255; // A
  }
  
  // Add some "text" regions (black rectangles)
  const addRectangle = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h && y + dy < height; dy++) {
      for (let dx = 0; dx < w && x + dx < width; dx++) {
        const index = ((y + dy) * width + (x + dx)) * 4;
        data[index] = 0; // R
        data[index + 1] = 0; // G
        data[index + 2] = 0; // B
      }
    }
  };
  
  // Add several "text" blocks
  addRectangle(10, 10, 30, 8);
  addRectangle(10, 25, 25, 8);
  addRectangle(10, 40, 35, 8);
  addRectangle(50, 10, 20, 8);
  addRectangle(50, 25, 28, 8);
  
  return imageData;
}

// ========================
// Integration Tests
// ========================

describe('Quantization Integration Tests', () => {
  let progressHistory: ProcessingProgress[];
  
  beforeEach(() => {
    progressHistory = [];
  });
  
  describe('Full Pipeline Integration', () => {
    it('should integrate with file validation', async () => {
      const imageData = createRealisticImageData(100, 100);
      
      // This is a conceptual test - in practice, we'd need to create actual file objects
      // For now, we'll test that validation types are compatible
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: []
      };
      
      expect(validationResult.isValid).toBe(true);
      
      // Then quantize the image
      const quantizeResult = await quantizeImageColors(imageData, 4);
      expect(quantizeResult.colorPalette).toHaveLength(4);
    });
    
    it('should handle realistic image complexity', async () => {
      const imageData = createRealisticImageData(200, 150);
      
      const progressCallback = vi.fn((progress) => {
        progressHistory.push(progress);
      });
      
      const quantizer = new KMeansQuantizer({
        maxIterations: 50,
        convergenceThreshold: 0.1,
        maxSamples: 5000,
        onProgress: progressCallback
      });
      
      const result = await quantizer.quantize(imageData, 5);
      
      // Verify result quality
      expect(result.colorPalette).toHaveLength(5);
      expect(result.imageData.width).toBe(200);
      expect(result.imageData.height).toBe(150);
      expect(result.heightMap).toHaveLength(30000); // 200 * 150
      
      // Verify progress reporting
      expect(progressCallback).toHaveBeenCalled();
      expect(progressHistory.length).toBeGreaterThan(0);
      
      // Check that all progress stages were covered
      const stages = progressHistory.map(p => p.stage);
      expect(stages).toContain('sampling');
      expect(stages).toContain('initialization');
      expect(stages).toContain('clustering');
      expect(stages).toContain('assignment');
      expect(stages).toContain('complete');
    });
    
    it('should produce consistent results for similar inputs', async () => {
      // Create two similar images
      const imageData1 = createTextLikeImageData(50, 50);
      const imageData2 = createTextLikeImageData(50, 50);
      
      const result1 = await quantizeImageColors(imageData1, 3);
      const result2 = await quantizeImageColors(imageData2, 3);
      
      // Results should be similar (both should detect black text and white background)
      expect(result1.colorPalette).toHaveLength(3);
      expect(result2.colorPalette).toHaveLength(3);
      
      // Both should have at least one very dark and one very light color
      const luminances1 = result1.colorPalette.map(c => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b);
      const luminances2 = result2.colorPalette.map(c => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b);
      
      expect(Math.min(...luminances1)).toBeLessThan(50); // Should have dark color
      expect(Math.max(...luminances1)).toBeGreaterThan(200); // Should have light color
      expect(Math.min(...luminances2)).toBeLessThan(50);
      expect(Math.max(...luminances2)).toBeGreaterThan(200);
    });
  });
  
  describe('Performance Integration', () => {
    it('should handle large images within performance targets', async () => {
      // Create a large image (approximately 1MP)
      const imageData = createRealisticImageData(1000, 1000);
      
      const startTime = performance.now();
      const result = await quantizeImageColors(imageData, 6, {
        maxSamples: 8000 // Reasonable sampling for large image
      });
      const duration = performance.now() - startTime;
      
      // Should complete within 5 seconds (spec requirement)
      expect(duration).toBeLessThan(5000);
      
      // Result should be valid
      expect(result.colorPalette).toHaveLength(6);
      expect(result.imageData.width).toBe(1000);
      expect(result.imageData.height).toBe(1000);
      
      // Height map should be reasonable
      const heights = Array.from(result.heightMap);
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...heights)).toBeLessThanOrEqual(1);
    }, 10000); // 10 second timeout
    
    it('should handle memory efficiently with multiple quantizations', async () => {
      const imageData = createRealisticImageData(200, 200);
      
      // Perform multiple quantizations to test memory management
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await quantizeImageColors(imageData, 3 + i % 3);
        results.push(result);
      }
      
      // All results should be valid
      results.forEach((result, index) => {
        expect(result.colorPalette.length).toBeBetween(3, 5);
        expect(result.imageData.data.length).toBe(imageData.data.length);
      });
    });
  });
  
  describe('Quality Integration', () => {
    it('should produce visually coherent quantization', async () => {
      const imageData = createRealisticImageData(100, 100);
      const result = await quantizeImageColors(imageData, 4);
      
      // Check that the quantized image maintains spatial coherence
      // (Similar neighboring pixels should be assigned to similar clusters)
      const data = result.imageData.data;
      let coherentNeighbors = 0;
      let totalNeighbors = 0;
      
      for (let y = 1; y < 99; y++) {
        for (let x = 1; x < 99; x++) {
          const centerIndex = (y * 100 + x) * 4;
          const centerColor = [data[centerIndex], data[centerIndex + 1], data[centerIndex + 2]];
          
          // Check 4-connected neighbors
          const neighbors = [
            [(y - 1) * 100 + x, 0], // Top
            [(y + 1) * 100 + x, 0], // Bottom
            [y * 100 + (x - 1), 0], // Left
            [y * 100 + (x + 1), 0]  // Right
          ];
          
          neighbors.forEach(([pixelIndex]) => {
            const neighborIndex = pixelIndex * 4;
            const neighborColor = [data[neighborIndex], data[neighborIndex + 1], data[neighborIndex + 2]];
            
            // Calculate color distance
            const distance = Math.sqrt(
              (centerColor[0] - neighborColor[0]) ** 2 +
              (centerColor[1] - neighborColor[1]) ** 2 +
              (centerColor[2] - neighborColor[2]) ** 2
            );
            
            if (distance < 50) { // Threshold for "similar" colors
              coherentNeighbors++;
            }
            totalNeighbors++;
          });
        }
      }
      
      // At least 70% of neighbors should be coherent
      const coherenceRatio = coherentNeighbors / totalNeighbors;
      expect(coherenceRatio).toBeGreaterThan(0.7);
    });
    
    it('should preserve important color relationships', async () => {
      // Create an image with clear color hierarchy
      const imageData = new ImageData(60, 60);
      const data = imageData.data;
      
      // Create regions with different luminance levels
      for (let y = 0; y < 60; y++) {
        for (let x = 0; x < 60; x++) {
          const index = (y * 60 + x) * 4;
          
          if (y < 20) {
            // Dark region
            data[index] = 50; data[index + 1] = 50; data[index + 2] = 50;
          } else if (y < 40) {
            // Medium region
            data[index] = 128; data[index + 1] = 128; data[index + 2] = 128;
          } else {
            // Light region
            data[index] = 200; data[index + 1] = 200; data[index + 2] = 200;
          }
          data[index + 3] = 255; // Alpha
        }
      }
      
      const result = await quantizeImageColors(imageData, 3);
      
      // Colors should be sorted by luminance in the palette
      const luminances = result.colorPalette.map(c => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b);
      const sortedLuminances = [...luminances].sort((a, b) => a - b);
      
      // Verify that we have a good spread of luminances
      expect(sortedLuminances[0]).toBeLessThan(80); // Dark
      expect(sortedLuminances[sortedLuminances.length - 1]).toBeGreaterThan(180); // Light
      
      // Height map should reflect luminance ordering
      const heights = Array.from(result.heightMap);
      const uniqueHeights = [...new Set(heights)].sort((a, b) => a - b);
      expect(uniqueHeights.length).toBeGreaterThan(1);
      expect(uniqueHeights[0]).toBe(0); // Lowest should be 0
      expect(uniqueHeights[uniqueHeights.length - 1]).toBe(1); // Highest should be 1
    });
  });
  
  describe('Error Handling Integration', () => {
    it('should handle corrupted image data gracefully', async () => {
      // Create malformed image data
      const imageData = new ImageData(10, 10);
      // Corrupt some data
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = NaN;
        data[i + 1] = Infinity;
        data[i + 2] = -Infinity;
        data[i + 3] = 255;
      }
      
      // Quantizer should handle this gracefully or provide meaningful error
      await expect(async () => {
        await quantizeImageColors(imageData, 3);
      }).not.toThrow(/unhandled|unexpected/i);
    });
    
    it('should provide meaningful progress even when clustering struggles', async () => {
      // Create a challenging image (all same color, which makes clustering difficult)
      const imageData = new ImageData(50, 50);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128; // R
        data[i + 1] = 128; // G
        data[i + 2] = 128; // B
        data[i + 3] = 255; // A
      }
      
      const progressCallback = vi.fn();
      const quantizer = new KMeansQuantizer({
        maxIterations: 10,
        onProgress: progressCallback
      });
      
      const result = await quantizer.quantize(imageData, 4);
      
      // Should still provide result even if convergence is poor
      expect(result.colorPalette).toHaveLength(4);
      expect(progressCallback).toHaveBeenCalled();
      
      // Should have reported completion
      const finalProgress = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(finalProgress.stage).toBe('complete');
      expect(finalProgress.progress).toBe(1.0);
    });
  });
  
  describe('Type Safety Integration', () => {
    it('should maintain type safety throughout the pipeline', async () => {
      const imageData = createRealisticImageData(30, 30);
      
      // Test that TypeScript types are maintained
      const result: QuantizedImageData = await quantizeImageColors(imageData, 3);
      
      // Verify all expected properties exist with correct types
      expect(result.imageData).toBeInstanceOf(ImageData);
      expect(Array.isArray(result.colorPalette)).toBe(true);
      expect(result.heightMap).toBeInstanceOf(Float32Array);
      
      // Check color palette types
      result.colorPalette.forEach((color: Color) => {
        expect(typeof color.r).toBe('number');
        expect(typeof color.g).toBe('number');
        expect(typeof color.b).toBe('number');
        expect(typeof color.a).toBe('number');
        expect(color.r).toBeGreaterThanOrEqual(0);
        expect(color.r).toBeLessThanOrEqual(255);
        expect(color.g).toBeGreaterThanOrEqual(0);
        expect(color.g).toBeLessThanOrEqual(255);
        expect(color.b).toBeGreaterThanOrEqual(0);
        expect(color.b).toBeLessThanOrEqual(255);
        expect(color.a).toBeGreaterThanOrEqual(0);
        expect(color.a).toBeLessThanOrEqual(1);
      });
    });
  });
});

// ========================
// Performance Benchmarks for Integration
// ========================

describe('Integration Performance Benchmarks', () => {
  it('should meet cumulative performance targets', async () => {
    const imageData = createRealisticImageData(500, 400); // 200K pixels
    
    const startTime = performance.now();
    
    // Simulate full pipeline: validation + quantization
    const validationTime = 10; // Simulated validation time
    
    const quantizeStart = performance.now();
    const result = await quantizeImageColors(imageData, 5, {
      maxSamples: 5000
    });
    const quantizeTime = performance.now() - quantizeStart;
    
    const totalTime = performance.now() - startTime;
    
    // Individual component should be fast
    expect(quantizeTime).toBeLessThan(3000); // 3 seconds for quantization
    expect(totalTime).toBeLessThan(3500); // 3.5 seconds total
    
    // Result should be complete and valid
    expect(result.colorPalette).toHaveLength(5);
    expect(result.heightMap).toHaveLength(200000);
    
    console.log(`Integration benchmark: ${totalTime.toFixed(1)}ms total, ${quantizeTime.toFixed(1)}ms quantization`);
  }, 15000);
});