/**
 * Performance tests for height mapping system
 * 
 * Tests performance requirements:
 * - Process height maps in <2 seconds for typical images
 * - Memory efficient Float32Array generation
 * - Real-time preview updates for parameter changes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  HeightMapper, 
  generateHeightMap,
  configurableHeightLevels,
  type HeightMappingOptions 
} from '../../modules/image/heightMapping';
import { createColor } from '../../modules/image/colorUtils';
import type { Color, QuantizedImageData } from '../../types';

function createLargeTestImage(width: number, height: number, colorCount: number): QuantizedImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  const colors: Color[] = [];
  
  // Generate color palette
  for (let i = 0; i < colorCount; i++) {
    const intensity = Math.floor((i * 255) / (colorCount - 1));
    colors.push(createColor(intensity, intensity, intensity));
  }
  
  // Fill image data with pattern
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const colorIndex = (x + y) % colorCount;
      const color = colors[colorIndex];
      
      data[index] = color.r;
      data[index + 1] = color.g;
      data[index + 2] = color.b;
      data[index + 3] = (color.a ?? 1) * 255;
    }
  }
  
  return {
    imageData: new ImageData(data, width, height),
    colorPalette: colors,
    heightMap: new Float32Array(0)
  };
}

// Performance measurement utility
async function measurePerformance<T>(
  operation: () => Promise<T>,
  description: string
): Promise<{ result: T; duration: number; memory: number }> {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  
  const result = await operation();
  
  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;
  
  const duration = endTime - startTime;
  const memory = endMemory - startMemory;
  
  console.log(`${description}: ${duration.toFixed(2)}ms, Memory: ${(memory / 1024 / 1024).toFixed(2)}MB`);
  
  return { result, duration, memory };
}

describe('Height Mapping Performance Tests', () => {
  describe('Processing Time Requirements', () => {
    it('should process 2MP image (1920x1080) in under 2 seconds', async () => {
      const testData = createLargeTestImage(1920, 1080, 8);
      const mapper = new HeightMapper();

      const { duration, result } = await measurePerformance(
        () => mapper.generateHeightMap(testData),
        'Height mapping for 2MP image'
      );

      expect(duration).toBeLessThan(2000); // Under 2 seconds
      expect(result.length).toBe(1920 * 1080);
    });

    it('should process 1MP image (1024x1024) efficiently', async () => {
      const testData = createLargeTestImage(1024, 1024, 6);
      const mapper = new HeightMapper();

      const { duration, result } = await measurePerformance(
        () => mapper.generateHeightMap(testData),
        'Height mapping for 1MP image'
      );

      expect(duration).toBeLessThan(1500); // Under 1.5 seconds
      expect(result.length).toBe(1024 * 1024);
    });

    it('should process typical bookmark image (800x600) quickly', async () => {
      const testData = createLargeTestImage(800, 600, 4);
      const mapper = new HeightMapper();

      const { duration, result } = await measurePerformance(
        () => mapper.generateHeightMap(testData),
        'Height mapping for typical bookmark image'
      );

      expect(duration).toBeLessThan(500); // Under 0.5 seconds
      expect(result.length).toBe(800 * 600);
    });

    it('should handle maximum color count (8 colors) efficiently', async () => {
      const testData = createLargeTestImage(1000, 1000, 8);
      const mapper = new HeightMapper();

      const { duration, result } = await measurePerformance(
        () => mapper.generateHeightMap(testData),
        'Height mapping with 8 colors'
      );

      expect(duration).toBeLessThan(2000);
      expect(result.length).toBe(1000 * 1000);
    });
  });

  describe('Memory Efficiency', () => {
    it('should stay under 500MB peak memory usage', async () => {
      const testData = createLargeTestImage(1920, 1080, 8);
      const mapper = new HeightMapper();

      const { memory, result } = await measurePerformance(
        () => mapper.generateHeightMap(testData),
        'Memory usage test'
      );

      // Memory increase should be reasonable
      expect(memory).toBeLessThan(500 * 1024 * 1024); // Under 500MB
      
      // Result should be memory-efficient Float32Array
      const expectedSize = 1920 * 1080 * 4; // Float32 = 4 bytes per element
      expect(result.byteLength).toBe(expectedSize);
    });

    it('should clean up memory properly', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process multiple images
      for (let i = 0; i < 5; i++) {
        const testData = createLargeTestImage(500, 500, 4);
        const mapper = new HeightMapper();
        await mapper.generateHeightMap(testData);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory shouldn't grow too much after processing multiple images
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Under 50MB
    });

    it('should use efficient Float32Array representation', async () => {
      const width = 1000;
      const height = 1000;
      const testData = createLargeTestImage(width, height, 4);
      const mapper = new HeightMapper();

      const heightMap = await mapper.generateHeightMap(testData);

      // Check that it's actually a Float32Array
      expect(heightMap).toBeInstanceOf(Float32Array);
      expect(heightMap.length).toBe(width * height);
      expect(heightMap.byteLength).toBe(width * height * 4); // 4 bytes per float
      
      // Verify values are properly normalized
      for (let i = 0; i < heightMap.length; i++) {
        expect(heightMap[i]).toBeGreaterThanOrEqual(0);
        expect(heightMap[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Real-time Performance for Preview Updates', () => {
    it('should handle parameter changes quickly for preview', async () => {
      const testData = createLargeTestImage(400, 400, 4);
      
      // Test different strategies
      const strategies: Array<HeightMappingOptions['strategy']> = ['linear', 'logarithmic', 'exponential'];
      
      for (const strategy of strategies) {
        const mapper = new HeightMapper({ strategy });
        
        const { duration } = await measurePerformance(
          () => mapper.generateHeightMap(testData),
          `Preview update with ${strategy} strategy`
        );
        
        // Should be fast enough for real-time preview (under 100ms target)
        expect(duration).toBeLessThan(500); // Allow 500ms for CI environments
      }
    });

    it('should process smoothing options efficiently', async () => {
      const testData = createLargeTestImage(300, 300, 4);
      
      const smoothingOptions: Array<{ algorithm: HeightMappingOptions['smoothing'], radius: number }> = [
        { algorithm: 'none', radius: 0 },
        { algorithm: 'gaussian', radius: 1 },
        { algorithm: 'median', radius: 1 },
        { algorithm: 'bilateral', radius: 1 }
      ];
      
      for (const { algorithm, radius } of smoothingOptions) {
        const mapper = new HeightMapper({ 
          smoothing: algorithm, 
          smoothingRadius: radius 
        });
        
        const { duration } = await measurePerformance(
          () => mapper.generateHeightMap(testData),
          `Smoothing with ${algorithm} (radius ${radius})`
        );
        
        // Even with smoothing, should be reasonably fast
        expect(duration).toBeLessThan(2000);
      }
    });

    it('should handle edge enhancement efficiently', async () => {
      const testData = createLargeTestImage(400, 400, 4);
      
      const mapper = new HeightMapper({ 
        edgeEnhancement: true,
        edgeThreshold: 0.1
      });
      
      const { duration } = await measurePerformance(
        () => mapper.generateHeightMap(testData),
        'Edge enhancement processing'
      );
      
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Algorithmic Performance', () => {
    it('should scale linearly with image size', async () => {
      const sizes = [
        { width: 200, height: 200 },
        { width: 400, height: 400 },
        { width: 800, height: 800 }
      ];
      
      const timings: number[] = [];
      
      for (const { width, height } of sizes) {
        const testData = createLargeTestImage(width, height, 4);
        const mapper = new HeightMapper();
        
        const { duration } = await measurePerformance(
          () => mapper.generateHeightMap(testData),
          `Processing ${width}x${height} image`
        );
        
        timings.push(duration);
      }
      
      // Check that timing roughly scales with image size
      const ratio1 = timings[1] / timings[0]; // 4x pixels should be ~4x time
      const ratio2 = timings[2] / timings[1]; // 4x pixels should be ~4x time
      
      // Allow some variance but should be roughly linear
      expect(ratio1).toBeGreaterThan(2);
      expect(ratio1).toBeLessThan(8);
      expect(ratio2).toBeGreaterThan(2);
      expect(ratio2).toBeLessThan(8);
    });

    it('should handle different color counts efficiently', async () => {
      const colorCounts = [2, 4, 6, 8];
      const timings: number[] = [];
      
      for (const colorCount of colorCounts) {
        const testData = createLargeTestImage(500, 500, colorCount);
        const mapper = new HeightMapper();
        
        const { duration } = await measurePerformance(
          () => mapper.generateHeightMap(testData),
          `Processing with ${colorCount} colors`
        );
        
        timings.push(duration);
      }
      
      // Color count shouldn't dramatically affect performance
      const maxTiming = Math.max(...timings);
      const minTiming = Math.min(...timings);
      
      expect(maxTiming / minTiming).toBeLessThan(3); // Less than 3x difference
    });

    it('should process configurableHeightLevels quickly', async () => {
      const { duration } = await measurePerformance(
        async () => {
          // Test multiple configurations
          for (let colorCount = 2; colorCount <= 8; colorCount++) {
            configurableHeightLevels(colorCount, 'linear');
            configurableHeightLevels(colorCount, 'logarithmic');
            configurableHeightLevels(colorCount, 'exponential');
          }
        },
        'Multiple configurableHeightLevels calls'
      );
      
      // Should be nearly instantaneous
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Cancellation Performance', () => {
    it('should cancel operations quickly', async () => {
      const testData = createLargeTestImage(1000, 1000, 8);
      const abortController = new AbortController();
      const mapper = new HeightMapper({}, undefined, abortController.signal);
      
      // Start the operation
      const operationPromise = mapper.generateHeightMap(testData);
      
      // Cancel after a short delay
      setTimeout(() => abortController.abort(), 50);
      
      const startTime = performance.now();
      
      try {
        await operationPromise;
        expect.fail('Operation should have been cancelled');
      } catch (error) {
        const duration = performance.now() - startTime;
        expect((error as Error).message).toContain('cancelled');
        expect(duration).toBeLessThan(200); // Should cancel quickly
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent height mappings', async () => {
      const promises: Promise<Float32Array>[] = [];
      
      // Start multiple operations concurrently
      for (let i = 0; i < 5; i++) {
        const testData = createLargeTestImage(300, 300, 4);
        const mapper = new HeightMapper();
        promises.push(mapper.generateHeightMap(testData));
      }
      
      const { duration, result } = await measurePerformance(
        () => Promise.all(promises),
        'Concurrent height mapping operations'
      );
      
      expect(result.length).toBe(5);
      result.forEach(heightMap => {
        expect(heightMap.length).toBe(300 * 300);
      });
      
      // Concurrent operations should not take much longer than sequential
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Stress Testing', () => {
    it('should handle maximum resolution images', async () => {
      // Test with very large image (4K resolution)
      const testData = createLargeTestImage(3840, 2160, 8);
      const mapper = new HeightMapper();

      const { duration, memory } = await measurePerformance(
        () => mapper.generateHeightMap(testData),
        'Maximum resolution stress test'
      );

      expect(duration).toBeLessThan(10000); // Under 10 seconds even for 4K
      expect(memory).toBeLessThan(1024 * 1024 * 1024); // Under 1GB
    });

    it('should handle rapid parameter changes', async () => {
      const testData = createLargeTestImage(200, 200, 4);
      
      const { duration } = await measurePerformance(
        async () => {
          // Simulate rapid parameter changes
          for (let i = 0; i < 10; i++) {
            const mapper = new HeightMapper({
              strategy: i % 2 === 0 ? 'linear' : 'logarithmic',
              smoothing: i % 3 === 0 ? 'gaussian' : 'none',
              smoothingRadius: 1 + (i % 3)
            });
            
            await mapper.generateHeightMap(testData);
          }
        },
        'Rapid parameter changes stress test'
      );
      
      expect(duration).toBeLessThan(5000); // Should handle rapid changes
    });
  });
});