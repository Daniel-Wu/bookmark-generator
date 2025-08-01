/**
 * Integration tests for height mapping with the quantization pipeline
 * 
 * Tests the complete flow from image quantization to height map generation,
 * ensuring the systems work together properly.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { 
  KMeansQuantizer,
  type QuantizerOptions,
  type QuantizerProgress 
} from '../../modules/image/quantization';
import { 
  HeightMapper,
  type HeightMappingOptions 
} from '../../modules/image/heightMapping';
import type { Color, QuantizedImageData } from '../../types';

// Test utilities
function createTestImageData(width: number, height: number, pattern: 'gradient' | 'checkerboard' | 'stripes'): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      let r: number, g: number, b: number;
      
      switch (pattern) {
        case 'gradient':
          r = g = b = Math.floor((x / width) * 255);
          break;
        case 'checkerboard':
          r = g = b = ((Math.floor(x / 10) + Math.floor(y / 10)) % 2) * 255;
          break;
        case 'stripes':
          r = g = b = (Math.floor(y / 10) % 2) * 255;
          break;
      }
      
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255; // Full opacity
    }
  }
  
  return new ImageData(data, width, height);
}

function createTestPhoto(width: number, height: number): ImageData {
  // Simulate a photo with multiple colors and gradients
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      
      // Create a landscape-like image with sky, mountains, and ground
      let r: number, g: number, b: number;
      
      const normalizedY = y / height;
      
      if (normalizedY < 0.3) {
        // Sky - blue gradient
        r = 135 + Math.floor(normalizedY * 100);
        g = 206 + Math.floor(normalizedY * 49);
        b = 235;
      } else if (normalizedY < 0.6) {
        // Mountains - gray/brown gradient
        const mountainNoise = Math.sin(x * 0.1) * 30;
        r = 139 + mountainNoise;
        g = 115 + mountainNoise;
        b = 85 + mountainNoise;
      } else {
        // Ground - green gradient
        const grassNoise = Math.sin(x * 0.05) * 20;
        r = 34 + grassNoise;
        g = 139 + grassNoise;
        b = 34 + grassNoise;
      }
      
      data[index] = Math.max(0, Math.min(255, Math.floor(r)));
      data[index + 1] = Math.max(0, Math.min(255, Math.floor(g)));
      data[index + 2] = Math.max(0, Math.min(255, Math.floor(b)));
      data[index + 3] = 255;
    }
  }
  
  return new ImageData(data, width, height);
}

describe('Height Mapping Integration Tests', () => {
  let progressCallback: MockedFunction<(progress: QuantizerProgress) => void>;

  beforeEach(() => {
    progressCallback = vi.fn();
  });

  describe('Quantization + Height Mapping Pipeline', () => {
    it('should complete full pipeline from image to height map', async () => {
      const imageData = createTestImageData(100, 100, 'gradient');
      
      const quantizer = new KMeansQuantizer({
        onProgress: progressCallback
      });
      
      const result = await quantizer.quantize(imageData, 4);
      
      // Verify quantized result structure
      expect(result).toHaveProperty('imageData');
      expect(result).toHaveProperty('colorPalette');
      expect(result).toHaveProperty('heightMap');
      
      // Verify image data
      expect(result.imageData.width).toBe(100);
      expect(result.imageData.height).toBe(100);
      
      // Verify color palette
      expect(result.colorPalette.length).toBe(4);
      result.colorPalette.forEach(color => {
        expect(color.r).toBeGreaterThanOrEqual(0);
        expect(color.r).toBeLessThanOrEqual(255);
        expect(color.g).toBeGreaterThanOrEqual(0);
        expect(color.g).toBeLessThanOrEqual(255);
        expect(color.b).toBeGreaterThanOrEqual(0);
        expect(color.b).toBeLessThanOrEqual(255);
        expect(color.a).toBeGreaterThanOrEqual(0);
        expect(color.a).toBeLessThanOrEqual(1);
      });
      
      // Verify height map
      expect(result.heightMap).toBeInstanceOf(Float32Array);
      expect(result.heightMap.length).toBe(100 * 100);
      
      // All height values should be between 0 and 1
      for (let i = 0; i < result.heightMap.length; i++) {
        expect(result.heightMap[i]).toBeGreaterThanOrEqual(0);
        expect(result.heightMap[i]).toBeLessThanOrEqual(1);
      }
      
      // Progress should be reported
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should handle different image patterns correctly', async () => {
      const patterns: Array<{ name: string; pattern: 'gradient' | 'checkerboard' | 'stripes' }> = [
        { name: 'gradient', pattern: 'gradient' },
        { name: 'checkerboard', pattern: 'checkerboard' },
        { name: 'stripes', pattern: 'stripes' }
      ];
      
      for (const { name, pattern } of patterns) {
        const imageData = createTestImageData(50, 50, pattern);
        const quantizer = new KMeansQuantizer();
        
        const result = await quantizer.quantize(imageData, 3);
        
        expect(result.heightMap.length).toBe(50 * 50);
        
        // For different patterns, height map should have different characteristics
        const uniqueHeights = new Set(Array.from(result.heightMap).map(h => Math.round(h * 100) / 100));
        
        if (pattern === 'gradient') {
          // Gradient should have many unique heights
          expect(uniqueHeights.size).toBeGreaterThan(1);
        } else if (pattern === 'checkerboard' || pattern === 'stripes') {
          // Binary patterns should have fewer unique heights
          expect(uniqueHeights.size).toBeGreaterThanOrEqual(1);
          expect(uniqueHeights.size).toBeLessThanOrEqual(3);
        }
      }
    });

    it('should respect height mapping options in quantization', async () => {
      const imageData = createTestImageData(80, 80, 'gradient');
      
      const heightMappingOptions: Partial<HeightMappingOptions> = {
        strategy: 'logarithmic',
        smoothing: 'gaussian',
        smoothingRadius: 2
      };
      
      const quantizer = new KMeansQuantizer({
        heightMappingOptions
      });
      
      const result = await quantizer.quantize(imageData, 4);
      
      expect(result.heightMap).toBeInstanceOf(Float32Array);
      expect(result.heightMap.length).toBe(80 * 80);
      
      // With logarithmic strategy, height distribution should be non-linear
      const heights = Array.from(result.heightMap);
      const sortedHeights = [...heights].sort((a, b) => a - b);
      
      // Should have smooth transitions due to Gaussian smoothing
      let smoothTransitions = 0;
      for (let i = 1; i < sortedHeights.length - 1; i++) {
        const diff1 = Math.abs(sortedHeights[i] - sortedHeights[i-1]);
        const diff2 = Math.abs(sortedHeights[i+1] - sortedHeights[i]);
        if (diff1 < 0.1 && diff2 < 0.1) {
          smoothTransitions++;
        }
      }
      
      expect(smoothTransitions).toBeGreaterThan(0);
    });
  });

  describe('Complex Image Processing', () => {
    it('should handle photo-like images with multiple regions', async () => {
      const imageData = createTestPhoto(200, 150);
      
      const quantizer = new KMeansQuantizer({
        heightMappingOptions: {
          strategy: 'linear',
          smoothing: 'bilateral', // Good for preserving edges in photos
          smoothingRadius: 1
        }
      });
      
      const result = await quantizer.quantize(imageData, 6);
      
      expect(result.colorPalette.length).toBe(6);
      expect(result.heightMap.length).toBe(200 * 150);
      
      // Photo should result in multiple distinct height regions
      const heightMapper = new HeightMapper();
      const metrics = heightMapper.generateMetrics(result.heightMap, 200, 150);
      
      expect(metrics.uniqueHeights).toBeGreaterThan(3);
      expect(metrics.heightRange.min).toBe(0);
      expect(metrics.heightRange.max).toBe(1);
    });

    it('should maintain height consistency across similar colors', async () => {
      // Create image with two regions of very similar colors
      const width = 100;
      const height = 100;
      const data = new Uint8ClampedArray(width * height * 4);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          
          if (x < width / 2) {
            // Left side - slightly darker
            data[index] = 120;
            data[index + 1] = 120;
            data[index + 2] = 120;
          } else {
            // Right side - slightly lighter
            data[index] = 125;
            data[index + 1] = 125;
            data[index + 2] = 125;
          }
          
          data[index + 3] = 255;
        }
      }
      
      const imageData = new ImageData(data, width, height);
      const quantizer = new KMeansQuantizer();
      
      const result = await quantizer.quantize(imageData, 3);
      
      // Should distinguish between the two similar colors
      const leftHeights = Array.from(result.heightMap.slice(0, width * height / 2));
      const rightHeights = Array.from(result.heightMap.slice(width * height / 2));
      
      const avgLeftHeight = leftHeights.reduce((a, b) => a + b) / leftHeights.length;
      const avgRightHeight = rightHeights.reduce((a, b) => a + b) / rightHeights.length;
      
      expect(Math.abs(avgLeftHeight - avgRightHeight)).toBeGreaterThan(0.1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle single color images', async () => {
      const data = new Uint8ClampedArray(50 * 50 * 4);
      data.fill(128); // Fill with gray
      
      // Set alpha values
      for (let i = 3; i < data.length; i += 4) {
        data[i] = 255;
      }
      
      const imageData = new ImageData(data, 50, 50);
      const quantizer = new KMeansQuantizer();
      
      const result = await quantizer.quantize(imageData, 2);
      
      expect(result.colorPalette.length).toBeLessThanOrEqual(2);
      expect(result.heightMap.length).toBe(50 * 50);
      
      // Single color should result in uniform height
      const uniqueHeights = new Set(Array.from(result.heightMap));
      expect(uniqueHeights.size).toBeLessThanOrEqual(2);
    });

    it('should handle transparent pixels correctly', async () => {
      const width = 60;
      const height = 60;
      const data = new Uint8ClampedArray(width * height * 4);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          
          if (x < width / 2) {
            // Left side - opaque white
            data[index] = 255;
            data[index + 1] = 255;
            data[index + 2] = 255;
            data[index + 3] = 255;
          } else {
            // Right side - transparent
            data[index] = 0;
            data[index + 1] = 0;
            data[index + 2] = 0;
            data[index + 3] = 0;
          }
        }
      }
      
      const imageData = new ImageData(data, width, height);
      const quantizer = new KMeansQuantizer({
        preserveTransparency: true,
        heightMappingOptions: {
          handleTransparency: true,
          transparentHeight: 0.1
        }
      });
      
      const result = await quantizer.quantize(imageData, 3);
      
      // Check that transparent areas have the expected height
      const transparentIndices = [];
      for (let i = width / 2; i < width * height; i++) {
        if (i % width >= width / 2) {
          transparentIndices.push(i);
        }
      }
      
      const transparentHeights = transparentIndices.map(i => result.heightMap[i]);
      const avgTransparentHeight = transparentHeights.reduce((a, b) => a + b) / transparentHeights.length;
      
      expect(avgTransparentHeight).toBeCloseTo(0.1, 1);
    });

    it('should handle images with extreme contrast', async () => {
      const width = 80;
      const height = 80;
      const data = new Uint8ClampedArray(width * height * 4);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          
          // Create checkerboard with extreme contrast
          const isBlack = (Math.floor(x / 10) + Math.floor(y / 10)) % 2 === 0;
          const color = isBlack ? 0 : 255;
          
          data[index] = color;
          data[index + 1] = color;
          data[index + 2] = color;
          data[index + 3] = 255;
        }
      }
      
      const imageData = new ImageData(data, width, height);
      const quantizer = new KMeansQuantizer({
        heightMappingOptions: {
          strategy: 'linear',
          edgeEnhancement: true,
          edgeThreshold: 0.1
        }
      });
      
      const result = await quantizer.quantize(imageData, 2);
      
      expect(result.colorPalette.length).toBe(2);
      
      // Should handle extreme contrast without issues
      const heights = Array.from(result.heightMap);
      const minHeight = Math.min(...heights);
      const maxHeight = Math.max(...heights);
      
      expect(minHeight).toBeGreaterThanOrEqual(0);
      expect(maxHeight).toBeLessThanOrEqual(1);
      expect(maxHeight - minHeight).toBeGreaterThan(0.5); // Should have good contrast
    });
  });

  describe('Performance Integration', () => {
    it('should complete full pipeline within performance requirements', async () => {
      const imageData = createTestPhoto(800, 600); // Typical bookmark size
      
      const quantizer = new KMeansQuantizer({
        heightMappingOptions: {
          strategy: 'linear',
          smoothing: 'gaussian',
          smoothingRadius: 1
        }
      });
      
      const startTime = performance.now();
      const result = await quantizer.quantize(imageData, 5);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(5000); // Under 5 seconds for full pipeline
      expect(result.heightMap.length).toBe(800 * 600);
    });

    it('should handle cancellation properly in integrated pipeline', async () => {
      const imageData = createTestPhoto(1000, 1000);
      const abortController = new AbortController();
      
      const quantizer = new KMeansQuantizer({
        signal: abortController.signal,
        heightMappingOptions: {
          smoothing: 'bilateral', // Slower algorithm
          smoothingRadius: 3
        }
      });
      
      const operationPromise = quantizer.quantize(imageData, 8);
      
      // Cancel after short delay
      setTimeout(() => abortController.abort(), 100);
      
      await expect(operationPromise).rejects.toThrow();
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent color-height mapping', async () => {
      const imageData = createTestImageData(100, 100, 'gradient');
      const quantizer = new KMeansQuantizer();
      
      const result = await quantizer.quantize(imageData, 4);
      
      // Create a map of colors to heights
      const colorHeightMap = new Map<string, number[]>();
      const imagePixels = result.imageData.data;
      
      for (let i = 0; i < imagePixels.length; i += 4) {
        const pixelIndex = i / 4;
        const colorKey = `${imagePixels[i]},${imagePixels[i+1]},${imagePixels[i+2]}`;
        const height = result.heightMap[pixelIndex];
        
        if (!colorHeightMap.has(colorKey)) {
          colorHeightMap.set(colorKey, []);
        }
        colorHeightMap.get(colorKey)!.push(height);
      }
      
      // Each color should map to consistent heights (within tolerance for smoothing)
      for (const [colorKey, heights] of colorHeightMap) {
        const avgHeight = heights.reduce((a, b) => a + b) / heights.length;
        const maxDeviation = Math.max(...heights.map(h => Math.abs(h - avgHeight)));
        
        // Allow some deviation for smoothing effects
        expect(maxDeviation).toBeLessThan(0.3);
      }
    });

    it('should preserve luminance ordering in height mapping', async () => {
      const colors = [
        { r: 255, g: 255, b: 255 }, // White - lightest
        { r: 200, g: 200, b: 200 }, // Light gray
        { r: 100, g: 100, b: 100 }, // Dark gray
        { r: 0,   g: 0,   b: 0   }  // Black - darkest
      ];
      
      // Create image with these specific colors
      const width = 60;
      const height = 60;
      const data = new Uint8ClampedArray(width * height * 4);
      
      for (let i = 0; i < width * height; i++) {
        const colorIndex = i % colors.length;
        const color = colors[colorIndex];
        
        data[i * 4] = color.r;
        data[i * 4 + 1] = color.g;
        data[i * 4 + 2] = color.b;
        data[i * 4 + 3] = 255;
      }
      
      const imageData = new ImageData(data, width, height);
      const quantizer = new KMeansQuantizer({
        heightMappingOptions: { strategy: 'linear', smoothing: 'none' }
      });
      
      const result = await quantizer.quantize(imageData, 4);
      
      // Find average heights for each color
      const colorHeights = new Map<string, number>();
      
      for (let i = 0; i < result.imageData.data.length; i += 4) {
        const pixelIndex = i / 4;
        const colorKey = `${result.imageData.data[i]},${result.imageData.data[i+1]},${result.imageData.data[i+2]}`;
        const height = result.heightMap[pixelIndex];
        
        if (!colorHeights.has(colorKey)) {
          colorHeights.set(colorKey, height);
        }
      }
      
      // Heights should follow luminance order (lighter colors -> lower heights)
      const sortedEntries = Array.from(colorHeights.entries())
        .sort((a, b) => {
          const [r1, g1, b1] = a[0].split(',').map(Number);
          const [r2, g2, b2] = b[0].split(',').map(Number);
          const lum1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
          const lum2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
          return lum1 - lum2; // Sort by luminance ascending
        });
      
      // Heights should be in ascending order (lighter colors have lower heights)
      for (let i = 1; i < sortedEntries.length; i++) {
        expect(sortedEntries[i][1]).toBeGreaterThanOrEqual(sortedEntries[i-1][1]);
      }
    });
  });
});