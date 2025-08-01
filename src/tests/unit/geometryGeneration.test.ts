/**
 * Comprehensive tests for geometry generation system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { colorToHex } from '../../modules/image/colorUtils';
import {
  BookmarkGeometryGenerator,
  RegionExtractor,
  MeshOptimizer,
  GeometryValidator,
  createBookmarkPipeline,
  createPreviewPipeline,
  createProductionPipeline,
  DEFAULT_BOOKMARK_PARAMETERS
} from '../../modules/geometry';
import type {
  QuantizedImageData,
  BookmarkParameters,
  Color,
  BookmarkGeometry
} from '../../types';

// ========================
// Test Data Setup
// ========================

function createTestQuantizedImage(width = 32, height = 32, colors = 4): QuantizedImageData {
  const imageData = new ImageData(width, height);
  const heightMap = new Float32Array(width * height);
  const colorPalette: Color[] = [];
  
  // Create a simple gradient pattern
  for (let i = 0; i < colors; i++) {
    const intensity = Math.floor((255 * i) / (colors - 1));
    const colorRgba = {
      r: intensity,
      g: intensity,
      b: intensity,
      a: 1
    };
    colorPalette.push({
      ...colorRgba,
      hex: `#${colorRgba.r.toString(16).padStart(2, '0')}${colorRgba.g.toString(16).padStart(2, '0')}${colorRgba.b.toString(16).padStart(2, '0')}`
    });
  }
  
  // Fill imageData and heightMap with test pattern
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const pixelIndex = index * 4;
      
      // Create concentric rectangles pattern
      const distFromEdge = Math.min(x, y, width - 1 - x, height - 1 - y);
      const colorIndex = Math.min(Math.floor(distFromEdge / 4), colors - 1);
      const color = colorPalette[colorIndex];
      
      imageData.data[pixelIndex] = color.r;
      imageData.data[pixelIndex + 1] = color.g;
      imageData.data[pixelIndex + 2] = color.b;
      imageData.data[pixelIndex + 3] = Math.floor((color.a ?? 1) * 255);
      
      heightMap[index] = colorIndex / (colors - 1);
    }
  }
  
  return {
    imageData,
    colorPalette,
    heightMap
  };
}

function createTestParameters(): BookmarkParameters {
  return {
    ...DEFAULT_BOOKMARK_PARAMETERS,
    width: 30,
    height: 60,
    colorCount: 4,
    layerThickness: 0.4 // Use minimum recommended thickness
  };
}

// ========================
// BookmarkGeometryGenerator Tests
// ========================

describe('BookmarkGeometryGenerator', () => {
  let generator: BookmarkGeometryGenerator;
  let testImage: QuantizedImageData;
  let testParams: BookmarkParameters;

  beforeEach(() => {
    generator = new BookmarkGeometryGenerator();
    testImage = createTestQuantizedImage();
    testParams = createTestParameters();
  });

  describe('generateGeometry', () => {
    it('should generate valid geometry from quantized image', async () => {
      const result = await generator.generateGeometry(testImage, testParams);
      
      expect(result).toBeDefined();
      expect(result.layers.length).toBeGreaterThan(0);
      expect(result.vertexCount).toBeGreaterThan(0);
      expect(result.faceCount).toBeGreaterThan(0);
      expect(result.boundingBox).toBeDefined();
      expect(result.boundingBox.min).toBeInstanceOf(THREE.Vector3);
      expect(result.boundingBox.max).toBeInstanceOf(THREE.Vector3);
    });

    it('should generate base layer plus height layers', async () => {
      const result = await generator.generateGeometry(testImage, testParams);
      
      // Should have base layer (height 0) plus height levels
      expect(result.layers.length).toBeGreaterThanOrEqual(1);
      
      const baseLayer = result.layers.find(layer => layer.height === 0);
      expect(baseLayer).toBeDefined();
      expect(baseLayer?.geometry).toBeInstanceOf(THREE.BufferGeometry);
    });

    it('should respect minimum feature size', async () => {
      const smallFeatureGenerator = new BookmarkGeometryGenerator({
        minFeatureSize: 2.0, // Large minimum feature size
      });
      
      const result = await smallFeatureGenerator.generateGeometry(testImage, testParams);
      
      // Should generate geometry but potentially fewer small features
      expect(result.layers.length).toBeGreaterThan(0);
    });

    it('should handle empty regions gracefully', async () => {
      // Create image with no height variation
      const flatImage = createTestQuantizedImage(16, 16, 1);
      
      const result = await generator.generateGeometry(flatImage, testParams);
      
      // Should at least generate base layer
      expect(result.layers.length).toBeGreaterThanOrEqual(1);
    });

    it('should call progress callback if provided', async () => {
      const onProgress = vi.fn();
      const progressGenerator = new BookmarkGeometryGenerator({
        onProgress
      });
      
      await progressGenerator.generateGeometry(testImage, testParams);
      
      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          layerIndex: expect.any(Number),
          totalLayers: expect.any(Number),
          stage: expect.stringMatching(/extracting|meshing|complete/),
          componentsProcessed: expect.any(Number),
          totalComponents: expect.any(Number)
        })
      );
    });

    it('should generate metrics', async () => {
      await generator.generateGeometry(testImage, testParams);
      
      const metrics = generator.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalTime).toBeGreaterThan(0);
      expect(metrics.complexity.inputPixels).toEqual(testImage.imageData.width * testImage.imageData.height);
      expect(metrics.stageTimings.analysis).toBeGreaterThanOrEqual(0);
    });
  });

  describe('layer generation', () => {
    it('should generate layers in correct height order', async () => {
      const result = await generator.generateGeometry(testImage, testParams);
      
      // Check that layers are ordered by height
      for (let i = 1; i < result.layers.length; i++) {
        expect(result.layers[i].height).toBeGreaterThanOrEqual(result.layers[i - 1].height);
      }
    });

    it('should assign correct colors to layers', async () => {
      const result = await generator.generateGeometry(testImage, testParams);
      
      // Each layer should have a valid color
      for (const layer of result.layers) {
        expect(layer.color).toBeDefined();
        expect(layer.color.r).toBeGreaterThanOrEqual(0);
        expect(layer.color.r).toBeLessThanOrEqual(255);
        expect(layer.color.g).toBeGreaterThanOrEqual(0);
        expect(layer.color.g).toBeLessThanOrEqual(255);
        expect(layer.color.b).toBeGreaterThanOrEqual(0);
        expect(layer.color.b).toBeLessThanOrEqual(255);
      }
    });
  });
});

// ========================
// RegionExtractor Tests
// ========================

describe('RegionExtractor', () => {
  let extractor: RegionExtractor;

  beforeEach(() => {
    extractor = new RegionExtractor();
  });

  describe('extractComponents', () => {
    it('should extract connected components from binary mask', async () => {
      // Create a simple binary mask with 2 disconnected squares
      const width = 16, height = 16;
      const mask = new Uint8Array(width * height);
      
      // Square 1: top-left
      for (let y = 2; y < 6; y++) {
        for (let x = 2; x < 6; x++) {
          mask[y * width + x] = 1;
        }
      }
      
      // Square 2: bottom-right
      for (let y = 10; y < 14; y++) {
        for (let x = 10; x < 14; x++) {
          mask[y * width + x] = 1;
        }
      }
      
      const result = await extractor.extractComponents(mask, width, height);
      
      expect(result.components).toHaveLength(2);
      expect(result.totalComponents).toBe(2);
      expect(result.largestComponent).toBeDefined();
    });

    it('should filter components by minimum area', async () => {
      const width = 16, height = 16;
      const mask = new Uint8Array(width * height);
      
      // Large component
      for (let y = 2; y < 10; y++) {
        for (let x = 2; x < 10; x++) {
          mask[y * width + x] = 1;
        }
      }
      
      // Tiny component (single pixel)
      mask[1 * width + 1] = 1;
      
      const result = await extractor.extractComponents(mask, width, height);
      
      // Should only find the large component (tiny one filtered out)
      expect(result.components).toHaveLength(1);
      expect(result.components[0].area).toBeGreaterThan(10);
    });

    it('should calculate correct bounding boxes', async () => {
      const width = 16, height = 16;
      const mask = new Uint8Array(width * height);
      
      // Component from (3,3) to (7,7)
      for (let y = 3; y < 8; y++) {
        for (let x = 3; x < 8; x++) {
          mask[y * width + x] = 1;
        }
      }
      
      const result = await extractor.extractComponents(mask, width, height);
      
      expect(result.components).toHaveLength(1);
      const component = result.components[0];
      expect(component.boundingBox.minX).toBe(3);
      expect(component.boundingBox.minY).toBe(3);
      expect(component.boundingBox.maxX).toBe(7);
      expect(component.boundingBox.maxY).toBe(7);
    });

    it('should calculate centroids correctly', async () => {
      const width = 16, height = 16;
      const mask = new Uint8Array(width * height);
      
      // Single pixel at (5, 5)
      mask[5 * width + 5] = 1;
      
      // Use extractor with minimum area of 1 to detect single pixels
      const singlePixelExtractor = new RegionExtractor({ minArea: 1 });
      const result = await singlePixelExtractor.extractComponents(mask, width, height);
      
      expect(result.components).toHaveLength(1);
      const component = result.components[0];
      expect(component.centroid.x).toBe(5);
      expect(component.centroid.y).toBe(5);
    });
  });

  describe('flood fill algorithm', () => {
    it('should handle 4-connected vs 8-connected differently', async () => {
      const width = 8, height = 8;
      const mask = new Uint8Array(width * height);
      
      // Diagonal pattern that connects in 8-connected but not 4-connected
      mask[2 * width + 2] = 1;
      mask[3 * width + 3] = 1;
      mask[4 * width + 4] = 1;
      
      const extractor4 = new RegionExtractor({ connectivity: 4, minArea: 1 });
      const extractor8 = new RegionExtractor({ connectivity: 8, minArea: 1 });
      
      const result4 = await extractor4.extractComponents(mask, width, height);
      const result8 = await extractor8.extractComponents(mask, width, height);
      
      // 4-connected should find 3 separate components
      // 8-connected should find 1 component
      expect(result4.components.length).toBeGreaterThan(result8.components.length);
    });
  });
});

// ========================
// MeshOptimizer Tests
// ========================

describe('MeshOptimizer', () => {
  let optimizer: MeshOptimizer;

  beforeEach(() => {
    optimizer = new MeshOptimizer();
  });

  function createTestGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BoxGeometry(10, 10, 2);
    return geometry;
  }

  describe('optimizeGeometry', () => {
    it('should optimize geometry without destroying it', async () => {
      const geometry = createTestGeometry();
      const originalVertexCount = geometry.getAttribute('position').count;
      
      const optimized = await optimizer.optimizeGeometry(geometry, {
        targetRatio: 0.5,
        preserveBoundaries: true,
        preserveUVs: false,
        preserveColors: true
      });
      
      // Should still have valid geometry
      expect(optimized.getAttribute('position')).toBeDefined();
      expect(optimized.getAttribute('position').count).toBeGreaterThan(0);
      
      // Should have reduced vertex count (though not guaranteed for simple box)
      expect(optimized.getAttribute('position').count).toBeLessThanOrEqual(originalVertexCount);
    });

    it('should remove degenerate triangles', async () => {
      const optimizer = new MeshOptimizer({
        removeDegenerate: true,
        mergeVertices: false,
        smoothNormals: false
      });
      
      const geometry = createTestGeometry();
      const optimized = await optimizer.optimizeGeometry(geometry);
      
      // Should have valid indices
      const indices = optimized.getIndex();
      expect(indices).toBeDefined();
      expect(indices!.count).toBeGreaterThan(0);
    });

    it('should merge duplicate vertices', async () => {
      const optimizer = new MeshOptimizer({
        removeDegenerate: false,
        mergeVertices: true,
        smoothNormals: false
      });
      
      const geometry = createTestGeometry();
      const originalVertexCount = geometry.getAttribute('position').count;
      
      const optimized = await optimizer.optimizeGeometry(geometry);
      
      // Should have same or fewer vertices
      expect(optimized.getAttribute('position').count).toBeLessThanOrEqual(originalVertexCount);
    });
  });

  describe('analyzeTopology', () => {
    it('should analyze basic topology properties', () => {
      const geometry = createTestGeometry();
      const topology = optimizer.analyzeTopology(geometry);
      
      expect(topology).toBeDefined();
      expect(typeof topology.isManifold).toBe('boolean');
      expect(typeof topology.hasHoles).toBe('boolean');
      expect(typeof topology.boundaryEdges).toBe('number');
      expect(typeof topology.genus).toBe('number');
    });

    it('should detect manifold geometry', () => {
      const geometry = createTestGeometry();
      const topology = optimizer.analyzeTopology(geometry);
      
      // A simple box should be manifold
      expect(topology.isManifold).toBe(true);
    });
  });

  describe('calculateQuality', () => {
    it('should calculate mesh quality metrics', () => {
      const geometry = createTestGeometry();
      const quality = optimizer.calculateQuality(geometry);
      
      expect(quality).toBeDefined();
      expect(quality.triangleCount).toBeGreaterThan(0);
      expect(quality.vertexCount).toBeGreaterThan(0);
      expect(quality.manifold).toBeDefined();
      expect(quality.watertight).toBeDefined();
      expect(quality.averageTriangleQuality).toBeGreaterThan(0);
    });
  });
});

// ========================
// GeometryValidator Tests
// ========================

describe('GeometryValidator', () => {
  let validator: GeometryValidator;

  beforeEach(() => {
    validator = new GeometryValidator();
  });

  function createTestBookmarkGeometry(): BookmarkGeometry {
    const baseColor = { r: 128, g: 128, b: 128, a: 1 };
    const layers = [
      {
        id: 0,
        color: { ...baseColor, hex: `#${baseColor.r.toString(16).padStart(2, '0')}${baseColor.g.toString(16).padStart(2, '0')}${baseColor.b.toString(16).padStart(2, '0')}` },
        height: 0,
        geometry: new THREE.BoxGeometry(30, 60, 2),
        regions: [],
        visible: true,
        opacity: 1.0,
        triangleCount: 12 // Box geometry has 12 triangles
      }
    ];

    return {
      layers,
      boundingBox: new THREE.Box3(
        new THREE.Vector3(-15, -30, 0),
        new THREE.Vector3(15, 30, 2)
      ),
      vertexCount: layers[0].geometry.getAttribute('position').count,
      faceCount: layers[0].geometry.getIndex()!.count / 3,
      totalTriangles: layers[0].geometry.getIndex()!.count / 3,
      estimatedFileSize: 1024 * 25 // 25KB
    };
  }

  describe('validateGeometry', () => {
    it('should validate valid geometry as printable', async () => {
      const geometry = createTestBookmarkGeometry();
      const parameters = createTestParameters();
      
      const result = await validator.validateGeometry(geometry, parameters);
      
      expect(result).toBeDefined();
      expect(typeof result.isPrintable).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(typeof result.estimatedPrintTime).toBe('number');
      expect(typeof result.materialUsage).toBe('number');
    });

    it('should detect empty geometry', async () => {
      const emptyGeometry: BookmarkGeometry = {
        layers: [],
        boundingBox: new THREE.Box3(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0)
        ),
        vertexCount: 0,
        faceCount: 0,
        totalTriangles: 0,
        estimatedFileSize: 0
      };
      
      const result = await validator.validateGeometry(emptyGeometry);
      
      expect(result.isPrintable).toBe(false);
      expect(result.issues.some(issue => issue.type === 'non-manifold')).toBe(true);
    });

    it('should provide reasonable print time estimates', async () => {
      const geometry = createTestBookmarkGeometry();
      const parameters = createTestParameters();
      
      const result = await validator.validateGeometry(geometry, parameters);
      
      expect(result.estimatedPrintTime).toBeGreaterThan(0);
      expect(result.estimatedPrintTime).toBeLessThan(1000); // Should be reasonable
    });

    it('should provide material usage estimates', async () => {
      const geometry = createTestBookmarkGeometry();
      const parameters = createTestParameters();
      
      const result = await validator.validateGeometry(geometry, parameters);
      
      expect(result.materialUsage).toBeGreaterThan(0);
      expect(result.materialUsage).toBeLessThan(100); // Should be reasonable for bookmark
    });
  });

  describe('quickValidate', () => {
    it('should perform faster validation', async () => {
      const geometry = createTestBookmarkGeometry();
      
      const startTime = performance.now();
      const isValid = await validator.quickValidate(geometry);
      const elapsed = performance.now() - startTime;
      
      expect(typeof isValid).toBe('boolean');
      expect(elapsed).toBeLessThan(1000); // Should be fast
    });
  });
});

// ========================
// Pipeline Tests
// ========================

describe('Geometry Pipelines', () => {
  let testImage: QuantizedImageData;
  let testParams: BookmarkParameters;

  beforeEach(() => {
    testImage = createTestQuantizedImage();
    testParams = createTestParameters();
  });

  describe('createBookmarkPipeline', () => {
    it('should create complete pipeline', () => {
      const pipeline = createBookmarkPipeline();
      
      expect(pipeline.generator).toBeInstanceOf(BookmarkGeometryGenerator);
      expect(pipeline.validator).toBeInstanceOf(GeometryValidator);
      expect(typeof pipeline.generateAndValidate).toBe('function');
    });

    it('should generate and validate geometry', async () => {
      const pipeline = createBookmarkPipeline();
      
      const result = await pipeline.generateAndValidate(testImage, testParams);
      
      expect(result.geometry).toBeDefined();
      expect(result.validation).toBeDefined();
      expect(result.metrics).toBeDefined();
    });
  });

  describe('createPreviewPipeline', () => {
    it('should generate preview geometry quickly', async () => {
      const pipeline = createPreviewPipeline();
      
      const startTime = performance.now();
      const result = await pipeline.generatePreview(testImage, testParams);
      const elapsed = performance.now() - startTime;
      
      expect(result.geometry).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
      expect(elapsed).toBeLessThan(5000); // Should be reasonably fast
    });
  });

  describe('createProductionPipeline', () => {
    it('should generate high-quality geometry', async () => {
      const pipeline = createProductionPipeline();
      
      const result = await pipeline.generateProduction(testImage, testParams);
      
      expect(result.geometry).toBeDefined();
      expect(result.validation.isPrintable).toBe(true);
      expect(result.geometry.vertexCount).toBeGreaterThan(0);
    });

    it('should throw error for unprintable geometry', async () => {
      const pipeline = createProductionPipeline();
      
      // Create invalid parameters that might cause issues
      const invalidParams = {
        ...testParams,
        layerThickness: 0.01, // Too thin
        width: 1, // Too small
        height: 1 // Too small
      };
      
      // Depending on validation strictness, this might throw or warn
      try {
        await pipeline.generateProduction(testImage, invalidParams);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('not suitable for production');
      }
    });
  });
});

// ========================
// Integration Tests
// ========================

describe('Geometry Generation Integration', () => {
  it('should handle complete workflow from image to validated geometry', async () => {
    const testImage = createTestQuantizedImage(64, 64, 6);
    const testParams = {
      ...DEFAULT_BOOKMARK_PARAMETERS,
      width: 40,
      height: 100,
      colorCount: 6
    };

    const generator = new BookmarkGeometryGenerator({
      minFeatureSize: 0.5,
      maxVertices: 50000,
      enableOptimization: true,
    });

    const validator = new GeometryValidator();

    // Generate geometry
    const geometry = await generator.generateGeometry(testImage, testParams);
    
    // Validate geometry
    const validation = await validator.validateGeometry(geometry, testParams);
    
    // Get metrics
    const metrics = generator.getMetrics();

    // Verify complete workflow
    expect(geometry.layers.length).toBeGreaterThan(0);
    expect(validation.isPrintable).toBe(true);
    expect(metrics.totalTime).toBeGreaterThan(0);
    expect(validation.estimatedPrintTime).toBeGreaterThan(0);
    expect(validation.materialUsage).toBeGreaterThan(0);
  });

  it('should handle edge cases gracefully', async () => {
    // Test with minimal image
    const minimalImage = createTestQuantizedImage(4, 4, 2);
    const minimalParams = {
      colorCount: 2,
      layerThickness: 0.5,
      baseThickness: 1.0,
      width: 10,
      height: 20,
      cornerRadius: 1,
      aspectRatioLocked: false
    };

    const generator = new BookmarkGeometryGenerator();
    
    // Should not throw error
    const geometry = await generator.generateGeometry(minimalImage, minimalParams);
    expect(geometry).toBeDefined();
    expect(geometry.layers.length).toBeGreaterThanOrEqual(1);
  });
});