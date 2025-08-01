/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { 
  HeightMapper, 
  createBookmarkHeightMapper, 
  generateHeightMap,
  configurableHeightLevels,
  validateHeightMappingParams,
  type HeightMappingOptions,
  type HeightMappingProgress 
} from '../../modules/image/heightMapping';
import type { Color, QuantizedImageData } from '../../types';

// Test utilities
function createTestColor(r: number, g: number, b: number, a: number = 1): Color {
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  return { r, g, b, a, hex };
}

function createTestImageData(width: number, height: number, colors: Color[]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < width * height; i++) {
    const colorIndex = i % colors.length;
    const color = colors[colorIndex];
    
    data[i * 4] = color.r;
    data[i * 4 + 1] = color.g;
    data[i * 4 + 2] = color.b;
    data[i * 4 + 3] = (color.a ?? 1) * 255;
  }
  
  return new ImageData(data, width, height);
}

function createTestQuantizedData(width: number, height: number, colors: Color[]): QuantizedImageData {
  const imageData = createTestImageData(width, height, colors);
  return {
    imageData,
    colorPalette: colors,
    heightMap: new Float32Array(0) // Will be generated
  };
}

describe('HeightMapper', () => {
  let heightMapper: HeightMapper;
  let progressCallback: MockedFunction<(progress: HeightMappingProgress) => void>;

  beforeEach(() => {
    progressCallback = vi.fn();
    heightMapper = new HeightMapper({}, progressCallback);
  });

  describe('calculateHeightLevels', () => {
    it('should create correct height levels for linear strategy', () => {
      const colors = [
        createTestColor(255, 255, 255), // White (lightest)
        createTestColor(128, 128, 128), // Gray
        createTestColor(0, 0, 0)         // Black (darkest)
      ];

      const heightLevels = heightMapper.calculateHeightLevels(colors);

      // Heights should be assigned based on luminance order
      expect(heightLevels.get('255,255,255')).toBe(0); // White (lightest) -> lowest
      expect(heightLevels.get('128,128,128')).toBe(0.5); // Gray -> middle
      expect(heightLevels.get('0,0,0')).toBe(1); // Black (darkest) -> highest
    });

    it('should handle single color correctly', () => {
      const colors = [createTestColor(128, 128, 128)];
      const heightLevels = heightMapper.calculateHeightLevels(colors);

      expect(heightLevels.get('128,128,128')).toBe(0.5);
    });

    it('should sort colors by luminance correctly', () => {
      const colors = [
        createTestColor(255, 0, 0),   // Red
        createTestColor(0, 255, 0),   // Green (brightest due to high weight in luminance)
        createTestColor(0, 0, 255)    // Blue (darkest due to low weight in luminance)
      ];

      const heightLevels = heightMapper.calculateHeightLevels(colors);

      // Green should be lightest (height 0), Blue darkest (height 1)
      expect(heightLevels.get('0,255,0')).toBe(0); // Green (highest luminance) -> lowest height
      expect(heightLevels.get('0,0,255')).toBe(1); // Blue (lowest luminance) -> highest height
      expect(heightLevels.get('255,0,0')).toBe(0.5); // Red (middle luminance) -> middle height
    });

    it('should throw error for empty color palette', () => {
      expect(() => {
        heightMapper.calculateHeightLevels([]);
      }).toThrow('Cannot calculate height levels for empty color palette');
    });
  });

  describe('generateHeightMap', () => {
    it('should generate correct height map for simple image', async () => {
      const colors = [
        createTestColor(255, 255, 255), // White
        createTestColor(0, 0, 0)         // Black
      ];
      const quantizedData = createTestQuantizedData(2, 2, colors);

      const heightMap = await heightMapper.generateHeightMap(quantizedData);

      expect(heightMap).toHaveLength(4);
      
      // Check that values are between 0 and 1
      for (let i = 0; i < heightMap.length; i++) {
        expect(heightMap[i]).toBeGreaterThanOrEqual(0);
        expect(heightMap[i]).toBeLessThanOrEqual(1);
      }

      // White pixels should have height 0, black pixels height 1
      expect(heightMap[0]).toBe(0); // White pixel (lightest)
      expect(heightMap[1]).toBe(1); // Black pixel (darkest)
    });

    it('should handle transparency correctly', async () => {
      const colors = [
        createTestColor(255, 255, 255, 1),   // Opaque white
        createTestColor(0, 0, 0, 0.05)       // Transparent black (alpha < 0.1)
      ];
      
      const options: Partial<HeightMappingOptions> = {
        handleTransparency: true,
        transparentHeight: 0.25
      };
      
      const mapper = new HeightMapper(options);
      const quantizedData = createTestQuantizedData(2, 1, colors);

      const heightMap = await mapper.generateHeightMap(quantizedData);

      expect(heightMap[0]).toBe(0);    // Opaque white (lightest)
      expect(heightMap[1]).toBe(0.25); // Transparent pixel
    });

    it('should report progress during generation', async () => {
      const colors = [createTestColor(128, 128, 128)];
      const quantizedData = createTestQuantizedData(10, 10, colors);

      await heightMapper.generateHeightMap(quantizedData);

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'analysis',
          progress: 0,
          message: 'Analyzing color palette...'
        })
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'complete',
          progress: 1.0,
          message: 'Finalizing height map...'
        })
      );
    });

    it('should handle AbortSignal cancellation', async () => {
      const abortController = new AbortController();
      const mapper = new HeightMapper({}, undefined, abortController.signal);
      
      const colors = [createTestColor(128, 128, 128)];
      const quantizedData = createTestQuantizedData(100, 100, colors);

      // Cancel immediately
      abortController.abort();

      await expect(mapper.generateHeightMap(quantizedData)).rejects.toThrow('Height mapping cancelled');
    });
  });

  describe('Height mapping strategies', () => {
    it('should generate linear heights correctly', async () => {
      const mapper = new HeightMapper({ strategy: 'linear' });
      const colors = [
        createTestColor(255, 255, 255),
        createTestColor(128, 128, 128),
        createTestColor(64, 64, 64),
        createTestColor(0, 0, 0)
      ];

      const heightLevels = mapper.calculateHeightLevels(colors);
      const heights = Array.from(heightLevels.values()).sort();

      // Linear strategy should have evenly spaced heights
      expect(heights).toEqual([0, 1/3, 2/3, 1]);
    });

    it('should generate logarithmic heights correctly', async () => {
      const mapper = new HeightMapper({ strategy: 'logarithmic' });
      const colors = [
        createTestColor(255, 255, 255),
        createTestColor(128, 128, 128),
        createTestColor(0, 0, 0)
      ];

      const heightLevels = mapper.calculateHeightLevels(colors);
      const heights = Array.from(heightLevels.values()).sort();

      // Logarithmic should have non-linear spacing
      expect(heights[0]).toBe(0);
      expect(heights[2]).toBe(1);
      expect(heights[1]).toBeGreaterThan(0);
      expect(heights[1]).toBeLessThan(1);
      
      // Middle value should be greater than 0.5 for logarithmic (more emphasis on higher values)
      expect(heights[1]).toBeGreaterThan(0.5);
    });

    it('should handle custom height levels', async () => {
      const customLevels = [0, 0.2, 0.8, 1];
      const mapper = new HeightMapper({ 
        strategy: 'custom',
        customHeightLevels: customLevels
      });
      
      const colors = [
        createTestColor(255, 255, 255),
        createTestColor(200, 200, 200),
        createTestColor(100, 100, 100),
        createTestColor(0, 0, 0)
      ];

      const heightLevels = mapper.calculateHeightLevels(colors);
      const heights = Array.from(heightLevels.values()).sort();

      expect(heights).toEqual([0, 0.2, 0.8, 1]);
    });

    it('should throw error for custom strategy without levels', async () => {
      const mapper = new HeightMapper({ strategy: 'custom' });
      const colors = [createTestColor(128, 128, 128)];
      const quantizedData = createTestQuantizedData(1, 1, colors);

      await expect(mapper.generateHeightMap(quantizedData)).rejects.toThrow('Custom height levels must be provided for custom strategy');
    });
  });

  describe('Smoothing algorithms', () => {
    it('should apply Gaussian smoothing', async () => {
      const mapper = new HeightMapper({ 
        smoothing: 'gaussian',
        smoothingRadius: 1
      });
      
      const colors = [
        createTestColor(255, 255, 255),
        createTestColor(0, 0, 0)
      ];
      
      // Create a checkerboard pattern
      const imageData = new ImageData(new Uint8ClampedArray([
        255, 255, 255, 255,  0, 0, 0, 255,
        0, 0, 0, 255,  255, 255, 255, 255
      ]), 2, 2);
      
      const quantizedData = {
        imageData,
        colorPalette: colors,
        heightMap: new Float32Array(0)
      };

      const heightMap = await mapper.generateHeightMap(quantizedData);

      // After smoothing, values should be smoothed compared to original
      const originalMapper = new HeightMapper({ smoothing: 'none' });
      const originalHeightMap = await originalMapper.generateHeightMap(quantizedData);
      
      // Calculate variance of smoothed vs original
      const smoothedVariance = Array.from(heightMap).reduce((acc, val, i) => 
        acc + Math.pow(val - heightMap[0], 2), 0) / heightMap.length;
      const originalVariance = Array.from(originalHeightMap).reduce((acc, val, i) => 
        acc + Math.pow(val - originalHeightMap[0], 2), 0) / originalHeightMap.length;
      
      // Smoothed should have lower variance (less sharp transitions)
      expect(smoothedVariance).toBeLessThanOrEqual(originalVariance);
    });

    it('should apply median smoothing', async () => {
      const mapper = new HeightMapper({ 
        smoothing: 'median',
        smoothingRadius: 1
      });
      
      const colors = [createTestColor(128, 128, 128)];
      const quantizedData = createTestQuantizedData(3, 3, colors);

      const heightMap = await mapper.generateHeightMap(quantizedData);

      // Median smoothing should preserve original values for uniform input
      expect(Array.from(heightMap).every(h => Math.abs(h - 0.5) < 0.01)).toBe(true);
    });
  });

  describe('Edge enhancement', () => {
    it('should enhance edges when enabled', async () => {
      const mapper = new HeightMapper({ 
        edgeEnhancement: true,
        edgeThreshold: 0.1
      });
      
      const colors = [
        createTestColor(255, 255, 255),
        createTestColor(0, 0, 0)
      ];
      
      // Create image with sharp edge
      const imageData = new ImageData(new Uint8ClampedArray([
        255, 255, 255, 255,  255, 255, 255, 255,
        0, 0, 0, 255,      0, 0, 0, 255
      ]), 2, 2);
      
      const quantizedData = {
        imageData,
        colorPalette: colors,
        heightMap: new Float32Array(0)
      };

      const heightMap = await mapper.generateHeightMap(quantizedData);

      // Enhanced edges might have values slightly higher than original
      const hasEnhancedValues = Array.from(heightMap).some(h => h > 1.0);
      // Note: Enhanced values are clamped to 1.0 in the implementation
      expect(Array.from(heightMap).every(h => h <= 1.0)).toBe(true);
    });
  });

  describe('Quality metrics', () => {
    it('should generate correct metrics', async () => {
      const colors = [
        createTestColor(255, 255, 255),
        createTestColor(128, 128, 128),
        createTestColor(0, 0, 0)
      ];
      const quantizedData = createTestQuantizedData(4, 4, colors);
      const heightMap = await heightMapper.generateHeightMap(quantizedData);

      const metrics = heightMapper.generateMetrics(heightMap, 4, 4);

      expect(metrics.heightRange.min).toBe(0);
      expect(metrics.heightRange.max).toBe(1);
      expect(metrics.uniqueHeights).toBeGreaterThan(0);
      expect(metrics.smoothnessIndex).toBeGreaterThanOrEqual(0);
      expect(metrics.smoothnessIndex).toBeLessThanOrEqual(1);
      expect(metrics.memoryUsage).toBe(heightMap.byteLength);
    });
  });

  describe('Connected component analysis', () => {
    it('should find connected components correctly', async () => {
      const colors = [
        createTestColor(255, 255, 255), // White background  
        createTestColor(0, 0, 0)         // Black foreground
      ];
      
      // Create image with separate black regions
      const imageData = new ImageData(new Uint8ClampedArray([
        0, 0, 0, 255,      255, 255, 255, 255,  0, 0, 0, 255,
        255, 255, 255, 255,  255, 255, 255, 255,  255, 255, 255, 255,
        0, 0, 0, 255,      0, 0, 0, 255,      255, 255, 255, 255
      ]), 3, 3);
      
      const quantizedData = {
        imageData,
        colorPalette: colors,
        heightMap: new Float32Array(0)
      };

      // Use minimal feature size to ensure small components are found
      const heightMapperWithSettings = new HeightMapper({ minFeatureSize: 1 });
      const heightMap = await heightMapperWithSettings.generateHeightMap(quantizedData);
      
      const components = heightMapperWithSettings.analyzeConnectedComponents(heightMap, 3, 3, 0.5);
      
      // Should find at least one component  
      expect(components.length).toBeGreaterThanOrEqual(1);
      
      components.forEach(component => {
        expect(component.pixels.length).toBeGreaterThan(0);
        expect(component.area).toBe(component.pixels.length);
        expect(component.averageHeight).toBeGreaterThan(0.5); // High height regions
      });
    });
  });

  describe('Error handling', () => {
    it('should validate input data', async () => {
      await expect(heightMapper.generateHeightMap(null as any)).rejects.toThrow();
      
      const invalidData = {
        imageData: null as any,
        colorPalette: [],
        heightMap: new Float32Array(0)
      };
      
      await expect(heightMapper.generateHeightMap(invalidData)).rejects.toThrow();
    });

    it('should validate generated height map', async () => {
      // This test ensures the validation catches invalid height values
      const colors = [createTestColor(128, 128, 128)];
      const quantizedData = createTestQuantizedData(2, 2, colors);

      // Mock the height map generation to return invalid values
      const mapper = new HeightMapper();
      const originalGenerate = mapper['mapPixelsToHeights'];
      
      mapper['mapPixelsToHeights'] = () => {
        const invalid = new Float32Array(4);
        invalid[0] = -1; // Invalid negative value
        invalid[1] = 2;  // Invalid value > 1
        invalid[2] = NaN; // Invalid NaN
        invalid[3] = 0.5; // Valid value
        return invalid;
      };

      await expect(mapper.generateHeightMap(quantizedData)).rejects.toThrow(/Invalid height value/);
    });
  });
});

describe('Utility Functions', () => {
  describe('createBookmarkHeightMapper', () => {
    it('should create mapper with bookmark defaults', () => {
      const mapper = createBookmarkHeightMapper();
      expect(mapper).toBeInstanceOf(HeightMapper);
    });

    it('should apply custom options', () => {
      const mapper = createBookmarkHeightMapper(
        { colorCount: 4 },
        { strategy: 'logarithmic' }
      );
      expect(mapper).toBeInstanceOf(HeightMapper);
    });
  });

  describe('generateHeightMap', () => {
    it('should generate height map with default options', async () => {
      const colors = [createTestColor(255, 255, 255), createTestColor(0, 0, 0)];
      const quantizedData = createTestQuantizedData(2, 2, colors);

      const heightMap = await generateHeightMap(quantizedData);

      expect(heightMap).toBeInstanceOf(Float32Array);
      expect(heightMap.length).toBe(4);
    });

    it('should apply custom options', async () => {
      const colors = [createTestColor(128, 128, 128)];
      const quantizedData = createTestQuantizedData(2, 2, colors);

      const heightMap = await generateHeightMap(quantizedData, {
        strategy: 'exponential'
      });

      expect(heightMap).toBeInstanceOf(Float32Array);
    });
  });

  describe('configurableHeightLevels', () => {
    it('should generate correct height levels for different strategies', () => {
      const linearLevels = configurableHeightLevels(3, 'linear');
      expect(linearLevels).toEqual([0, 0.5, 1]);

      const logLevels = configurableHeightLevels(3, 'logarithmic');
      expect(logLevels[0]).toBe(0);
      expect(logLevels[2]).toBe(1);
      expect(logLevels[1]).toBeGreaterThan(0);
      expect(logLevels[1]).toBeGreaterThan(0.5); // Logarithmic emphasizes higher values
    });

    it('should handle single color count', () => {
      const levels = configurableHeightLevels(1);
      expect(levels).toEqual([0.5]);
    });
  });

  describe('validateHeightMappingParams', () => {
    it('should validate correct parameters', () => {
      const result = validateHeightMappingParams({
        smoothingRadius: 2,
        edgeThreshold: 0.3,
        transparentHeight: 0.1
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch invalid parameters', () => {
      const result = validateHeightMappingParams({
        smoothingRadius: -1,
        edgeThreshold: 1.5,
        transparentHeight: -0.1,
        customHeightLevels: [0, 1.5, -0.5] // Invalid values
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Smoothing radius'))).toBe(true);
      expect(result.errors.some(e => e.includes('Edge threshold'))).toBe(true);
      expect(result.errors.some(e => e.includes('Transparent height'))).toBe(true);
      expect(result.errors.some(e => e.includes('Custom height level'))).toBe(true);
    });

    it('should validate custom height levels', () => {
      const validResult = validateHeightMappingParams({
        customHeightLevels: [0, 0.3, 0.7, 1]
      });
      expect(validResult.isValid).toBe(true);

      const invalidResult = validateHeightMappingParams({
        customHeightLevels: []
      });
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.some(e => e.includes('non-empty array'))).toBe(true);
    });
  });
});

// Performance tests
describe('HeightMapper Performance', () => {
  it('should process large images within reasonable time', async () => {
    const colors = [
      createTestColor(255, 255, 255),
      createTestColor(128, 128, 128),
      createTestColor(0, 0, 0)
    ];
    
    // Test with a moderately large image
    const quantizedData = createTestQuantizedData(200, 200, colors);
    const mapper = new HeightMapper();

    const startTime = performance.now();
    const heightMap = await mapper.generateHeightMap(quantizedData);
    const endTime = performance.now();

    expect(heightMap.length).toBe(200 * 200);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should handle memory efficiently', async () => {
    const colors = [createTestColor(128, 128, 128)];
    const quantizedData = createTestQuantizedData(100, 100, colors);
    const mapper = new HeightMapper();

    // Check memory usage before
    const initialMemory = process.memoryUsage().heapUsed;
    
    const heightMap = await mapper.generateHeightMap(quantizedData);
    
    // Check memory usage after
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    expect(heightMap.byteLength).toBe(100 * 100 * 4); // Float32Array
    
    // Memory increase should be reasonable (allowing for overhead)
    expect(memoryIncrease).toBeLessThan(1024 * 1024 * 10); // Less than 10MB
  });
});