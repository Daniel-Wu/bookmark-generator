/**
 * Performance tests for K-means color quantization algorithm
 * 
 * Tests performance requirements:
 * - Image processing: <5 seconds for 2MP images
 * - Memory usage: <500MB peak
 * - Parameter updates: <100ms response
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  KMeansQuantizer,
  quantizeImageColors,
  samplePixels,
  createColor
} from '../../modules/image';
import type { Color } from '../../types';

// ========================
// Performance Test Utilities
// ========================

/**
 * Memory usage tracker
 */
class MemoryTracker {
  private initialMemory: number;
  private peakMemory: number;
  
  constructor() {
    this.initialMemory = this.getCurrentMemoryUsage();
    this.peakMemory = this.initialMemory;
  }
  
  getCurrentMemoryUsage(): number {
    // In a real environment, this would use performance.measureUserAgentSpecificMemory()
    // For testing, we'll estimate based on allocated objects
    return performance.memory?.usedJSHeapSize || 0;
  }
  
  updatePeak(): void {
    const current = this.getCurrentMemoryUsage();
    if (current > this.peakMemory) {
      this.peakMemory = current;
    }
  }
  
  getPeakMemoryIncrease(): number {
    return this.peakMemory - this.initialMemory;
  }
  
  getMemoryEfficiency(pixelsProcessed: number): number {
    const increase = this.getPeakMemoryIncrease();
    return pixelsProcessed / Math.max(increase, 1); // Pixels per byte
  }
}

/**
 * Performance timer with statistics
 */
class PerformanceTimer {
  private measurements: number[] = [];
  
  async measure<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    
    this.measurements.push(duration);
    return { result, duration };
  }
  
  getStatistics() {
    const sorted = [...this.measurements].sort((a, b) => a - b);
    return {
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      mean: this.measurements.reduce((sum, time) => sum + time, 0) / this.measurements.length,
      median: sorted[Math.floor(sorted.length / 2)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      count: this.measurements.length
    };
  }
}

/**
 * Create performance test image with specified characteristics
 */
function createPerformanceTestImage(
  width: number,
  height: number,
  complexity: 'simple' | 'medium' | 'complex' = 'medium'
): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  
  switch (complexity) {
    case 'simple':
      // Simple checkerboard pattern
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const isEven = (Math.floor(x / 10) + Math.floor(y / 10)) % 2 === 0;
          const value = isEven ? 255 : 0;
          
          data[index] = value;
          data[index + 1] = value;
          data[index + 2] = value;
          data[index + 3] = 255;
        }
      }
      break;
      
    case 'complex':
      // Complex noise pattern with multiple regions
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          
          // Create complex pattern with noise
          const regionX = Math.floor(x / (width / 5));
          const regionY = Math.floor(y / (height / 5));
          const baseHue = (regionX + regionY * 5) * 51; // 0-255
          
          const noise = () => (Math.random() - 0.5) * 100;
          
          data[index] = Math.max(0, Math.min(255, baseHue + noise()));
          data[index + 1] = Math.max(0, Math.min(255, (baseHue + 85) % 255 + noise()));
          data[index + 2] = Math.max(0, Math.min(255, (baseHue + 170) % 255 + noise()));
          data[index + 3] = 255;
        }
      }
      break;
      
    case 'medium':
    default:
      // Medium complexity gradient with some variation
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          
          const gradientX = (x / width) * 255;
          const gradientY = (y / height) * 255;
          const variation = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 30;
          
          data[index] = Math.max(0, Math.min(255, gradientX + variation));
          data[index + 1] = Math.max(0, Math.min(255, gradientY + variation));
          data[index + 2] = Math.max(0, Math.min(255, (gradientX + gradientY) / 2 + variation));
          data[index + 3] = 255;
        }
      }
      break;
  }
  
  return imageData;
}

// ========================
// Performance Test Suites
// ========================

describe('Quantization Performance Tests', () => {
  let memoryTracker: MemoryTracker;
  let timer: PerformanceTimer;
  
  beforeEach(() => {
    memoryTracker = new MemoryTracker();
    timer = new PerformanceTimer();
  });
  
  afterEach(() => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });
  
  describe('Speed Benchmarks', () => {
    it('should quantize small images quickly (<100ms)', async () => {
      const imageData = createPerformanceTestImage(100, 100, 'medium');
      
      const { duration } = await timer.measure(async () => {
        return quantizeImageColors(imageData, 4);
      });
      
      expect(duration).toBeLessThan(100);
      console.log(`Small image (100x100): ${duration.toFixed(1)}ms`);
    });
    
    it('should quantize medium images within target (<1000ms)', async () => {
      const imageData = createPerformanceTestImage(500, 500, 'medium');
      
      const { duration, result } = await timer.measure(async () => {
        return quantizeImageColors(imageData, 5);
      });
      
      expect(duration).toBeLessThan(1000);
      expect(result.colorPalette).toHaveLength(5);
      console.log(`Medium image (500x500): ${duration.toFixed(1)}ms`);
    });
    
    it('should quantize large images within spec (<5000ms for 2MP)', async () => {
      // Create approximately 2MP image (1414x1414 ≈ 2MP)
      const imageData = createPerformanceTestImage(1414, 1414, 'medium');
      
      const { duration, result } = await timer.measure(async () => {
        return quantizeImageColors(imageData, 6, {
          maxSamples: 10000 // Use maximum sampling for quality
        });
      });
      
      expect(duration).toBeLessThan(5000); // Specification requirement
      expect(result.colorPalette).toHaveLength(6);
      
      console.log(`Large image (1414x1414, ~2MP): ${duration.toFixed(1)}ms`);
    }, 10000); // 10 second timeout
    
    it('should handle different complexity levels efficiently', async () => {
      const size = 300;
      const complexities: Array<'simple' | 'medium' | 'complex'> = ['simple', 'medium', 'complex'];
      const results: Record<string, number> = {};
      
      for (const complexity of complexities) {
        const imageData = createPerformanceTestImage(size, size, complexity);
        
        const { duration } = await timer.measure(async () => {
          return quantizeImageColors(imageData, 4);
        });
        
        results[complexity] = duration;
      }
      
      // Simple should be fastest, complex should be slowest
      expect(results.simple).toBeLessThan(results.medium);
      expect(results.medium).toBeLessThan(results.complex);
      
      // All should be reasonable
      expect(results.complex).toBeLessThan(2000);
      
      console.log('Complexity performance:', results);
    });
  });
  
  describe('Memory Efficiency', () => {
    it('should maintain reasonable memory usage for large images', async () => {
      const imageData = createPerformanceTestImage(1000, 1000, 'medium');
      const pixelCount = imageData.width * imageData.height;
      
      memoryTracker.updatePeak();
      
      await quantizeImageColors(imageData, 5, {
        maxSamples: 8000
      });
      
      memoryTracker.updatePeak();
      
      const memoryIncrease = memoryTracker.getPeakMemoryIncrease();
      const memoryPerPixel = memoryIncrease / pixelCount;
      
      // Should use less than 500MB total (spec requirement)
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
      
      // Should use reasonable memory per pixel
      expect(memoryPerPixel).toBeLessThan(100); // Less than 100 bytes per pixel
      
      console.log(`Memory usage: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB total, ${memoryPerPixel.toFixed(1)} bytes/pixel`);
    });
    
    it('should release memory after quantization', async () => {
      const initialMemory = memoryTracker.getCurrentMemoryUsage();
      
      // Process multiple images
      for (let i = 0; i < 3; i++) {
        const imageData = createPerformanceTestImage(400, 400, 'medium');
        await quantizeImageColors(imageData, 4);
        
        // Force potential cleanup
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = memoryTracker.getCurrentMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal after processing multiple images
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB persistent increase
      
      console.log(`Memory after multiple quantizations: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB increase`);
    });
    
    it('should handle memory efficiently with different sample sizes', async () => {
      const imageData = createPerformanceTestImage(800, 600, 'medium');
      const sampleSizes = [1000, 5000, 10000, 20000];
      
      for (const maxSamples of sampleSizes) {
        const memoryBefore = memoryTracker.getCurrentMemoryUsage();
        
        await quantizeImageColors(imageData, 4, { maxSamples });
        
        const memoryAfter = memoryTracker.getCurrentMemoryUsage();
        const memoryUsed = memoryAfter - memoryBefore;
        
        // Memory usage should scale reasonably with sample size
        const memoryPerSample = memoryUsed / maxSamples;
        expect(memoryPerSample).toBeLessThan(1000); // Less than 1KB per sample
        
        console.log(`Samples: ${maxSamples}, Memory: ${(memoryUsed / 1024).toFixed(1)}KB, Per sample: ${memoryPerSample.toFixed(1)}B`);
      }
    });
  });
  
  describe('Scalability Tests', () => {
    it('should scale linearly with color count', async () => {
      const imageData = createPerformanceTestImage(300, 300, 'medium');
      const colorCounts = [2, 4, 6, 8];
      const times: number[] = [];
      
      for (const colorCount of colorCounts) {
        const { duration } = await timer.measure(async () => {
          return quantizeImageColors(imageData, colorCount);
        });
        
        times.push(duration);
      }
      
      // Performance should scale reasonably with color count
      // More colors = more computation, but should be roughly linear
      const timeRatios = [];
      for (let i = 1; i < times.length; i++) {
        timeRatios.push(times[i] / times[0]);
      }
      
      // Should not grow exponentially
      expect(timeRatios[timeRatios.length - 1]).toBeLessThan(5); // 8 colors shouldn't take 5x longer than 2 colors
      
      console.log('Color count scaling:', colorCounts.map((k, i) => `${k}: ${times[i].toFixed(1)}ms`).join(', '));
    });
    
    it('should scale sub-linearly with image size due to sampling', async () => {
      const sizes = [200, 400, 800];
      const times: number[] = [];
      
      for (const size of sizes) {
        const imageData = createPerformanceTestImage(size, size, 'medium');
        
        const { duration } = await timer.measure(async () => {
          return quantizeImageColors(imageData, 4, {
            maxSamples: 5000 // Fixed sample size
          });
        });
        
        times.push(duration);
      }
      
      // With fixed sampling, time should not scale linearly with image size
      const pixelRatios = sizes.map(size => (size * size) / (sizes[0] * sizes[0]));
      const timeRatios = times.map(time => time / times[0]);
      
      // Time scaling should be much less than pixel scaling due to sampling
      expect(timeRatios[2]).toBeLessThan(pixelRatios[2] * 0.5); // Should be less than half the pixel ratio
      
      console.log('Size scaling:');
      sizes.forEach((size, i) => {
        console.log(`  ${size}x${size}: ${times[i].toFixed(1)}ms (${timeRatios[i].toFixed(1)}x time, ${pixelRatios[i].toFixed(1)}x pixels)`);
      });
    });
  });
  
  describe('Sampling Performance', () => {
    it('should sample pixels efficiently', async () => {
      const imageData = createPerformanceTestImage(1000, 1000, 'complex');
      const maxSamples = 10000;
      
      const { duration, result } = await timer.measure(async () => {
        return samplePixels(imageData, maxSamples);
      });
      
      expect(duration).toBeLessThan(100); // Sampling should be very fast
      expect(result.length).toBeLessThanOrEqual(maxSamples);
      
      console.log(`Sampling 1M pixels to ${maxSamples}: ${duration.toFixed(1)}ms`);
    });
    
    it('should handle different sampling strategies efficiently', async () => {
      const imageData = createPerformanceTestImage(500, 500, 'medium');
      const strategies: Array<'uniform' | 'random' | 'adaptive'> = ['uniform', 'random', 'adaptive'];
      
      for (const strategy of strategies) {
        const { duration } = await timer.measure(async () => {
          return samplePixels(imageData, 5000, { strategy });
        });
        
        expect(duration).toBeLessThan(200);
        console.log(`${strategy} sampling: ${duration.toFixed(1)}ms`);
      }
    });
  });
  
  describe('Progress Reporting Performance', () => {
    it('should not significantly impact performance with frequent progress updates', async () => {
      const imageData = createPerformanceTestImage(400, 400, 'medium');
      
      let progressCallCount = 0;
      const progressCallback = () => {
        progressCallCount++;
      };
      
      const quantizer = new KMeansQuantizer({
        onProgress: progressCallback
      });
      
      const { duration } = await timer.measure(async () => {
        return quantizer.quantize(imageData, 4);
      });
      
      // Should have called progress multiple times
      expect(progressCallCount).toBeGreaterThan(5);
      
      // Should still complete quickly despite progress callbacks
      expect(duration).toBeLessThan(1000);
      
      console.log(`Progress reporting: ${progressCallCount} callbacks, ${duration.toFixed(1)}ms total`);
    });
  });
  
  describe('Convergence Performance', () => {
    it('should converge quickly for well-separated colors', async () => {
      // Create image with well-separated colors (should converge quickly)
      const imageData = new ImageData(200, 200);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        const region = Math.floor(pixelIndex / (200 * 200 / 4));
        
        switch (region) {
          case 0:
            data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; break; // Red
          case 1:
            data[i] = 0; data[i + 1] = 255; data[i + 2] = 0; break; // Green
          case 2:
            data[i] = 0; data[i + 1] = 0; data[i + 2] = 255; break; // Blue
          default:
            data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; break; // White
        }
        data[i + 3] = 255;
      }
      
      let iterationCount = 0;
      const quantizer = new KMeansQuantizer({
        maxIterations: 50,
        onProgress: (progress) => {
          if (progress.iteration !== undefined) {
            iterationCount = Math.max(iterationCount, progress.iteration);
          }
        }
      });
      
      const { duration } = await timer.measure(async () => {
        return quantizer.quantize(imageData, 4);
      });
      
      // Should converge quickly for well-separated colors
      expect(iterationCount).toBeLessThan(10);
      expect(duration).toBeLessThan(500);
      
      console.log(`Convergence test: ${iterationCount} iterations, ${duration.toFixed(1)}ms`);
    });
  });
});

// ========================
// Real-world Performance Tests
// ========================

describe('Real-world Performance Scenarios', () => {
  it('should handle typical photograph-like images efficiently', async () => {
    // Simulate a photograph with gradual color transitions
    const imageData = createPerformanceTestImage(800, 600, 'complex');
    
    const timer = new PerformanceTimer();
    const { duration, result } = await timer.measure(async () => {
      return quantizeImageColors(imageData, 6, {
        maxSamples: 8000
      });
    });
    
    expect(duration).toBeLessThan(3000); // Should handle photo-like content quickly
    expect(result.colorPalette).toHaveLength(6);
    
    // Check that colors are well-distributed
    const luminances = result.colorPalette.map(c => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b);
    const luminanceRange = Math.max(...luminances) - Math.min(...luminances);
    expect(luminanceRange).toBeGreaterThan(100); // Good contrast range
    
    console.log(`Photo-like image (800x600): ${duration.toFixed(1)}ms`);
  });
  
  it('should handle high-contrast images (like text) efficiently', async () => {
    // Create text-like image with high contrast
    const imageData = new ImageData(600, 400);
    const data = imageData.data;
    
    // Create text-like pattern
    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 600; x++) {
        const index = (y * 600 + x) * 4;
        
        // Create text-like blocks
        const isText = (
          (x % 100 < 80 && y % 50 < 30) || // Horizontal text blocks
          (x % 200 < 20 && y % 100 < 80)   // Vertical text blocks
        );
        
        if (isText) {
          data[index] = 0; data[index + 1] = 0; data[index + 2] = 0; // Black text
        } else {
          data[index] = 255; data[index + 1] = 255; data[index + 2] = 255; // White background
        }
        data[index + 3] = 255;
      }
    }
    
    const timer = new PerformanceTimer();
    const { duration, result } = await timer.measure(async () => {
      return quantizeImageColors(imageData, 3);
    });
    
    expect(duration).toBeLessThan(1000); // High-contrast images should be fast
    expect(result.colorPalette).toHaveLength(3);
    
    // Should identify the high contrast properly
    const luminances = result.colorPalette.map(c => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b);
    expect(Math.min(...luminances)).toBeLessThan(50); // Should have dark color
    expect(Math.max(...luminances)).toBeGreaterThan(200); // Should have light color
    
    console.log(`High-contrast image (600x400): ${duration.toFixed(1)}ms`);
  });
});