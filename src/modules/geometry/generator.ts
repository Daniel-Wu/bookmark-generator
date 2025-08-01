/**
 * BookmarkGeometryGenerator - Core geometry generation system
 * Converts height maps into layered 3D printable bookmark models
 */

import * as THREE from 'three';
import { colorToHex } from '../image/colorUtils';
import type { 
  BookmarkParameters, 
  QuantizedImageData, 
  BookmarkGeometry, 
  GeometryLayer,
  Color,
  Point2D,
  BoundingBox 
} from '../../types';
import type {
  LayerProgress,
  MeshQuality,
  GeometryMetrics,
  ComponentAnalysis,
  MeshGenerationOptions,
  ExtrusionParameters,
  BaseGeometryParameters,
  ConnectedComponent
} from '../../types/geometry';
import { RegionExtractor } from './regionExtractor';
import { MeshOptimizer } from './meshOptimizer';
import { GeometryValidator } from './validator';

// ========================
// Generation Options
// ========================

export interface GeometryGenerationOptions {
  minFeatureSize: number; // minimum feature size in mm
  maxVertices: number; // per layer
  enableOptimization: boolean;
  enableSmoothing: boolean;
  simplificationRatio: number; // 0-1
  onProgress?: (progress: LayerProgress) => void;
  onMetrics?: (metrics: GeometryMetrics) => void;
}

const DEFAULT_OPTIONS: GeometryGenerationOptions = {
  minFeatureSize: 0.5, // 0.5mm minimum feature
  maxVertices: 100000,
  enableOptimization: true,
  enableSmoothing: false,
  simplificationRatio: 0.1,
};

// ========================
// BookmarkGeometryGenerator Class
// ========================

export class BookmarkGeometryGenerator {
  private options: GeometryGenerationOptions;
  private regionExtractor: RegionExtractor;
  private meshOptimizer: MeshOptimizer;
  private validator: GeometryValidator;
  private startTime: number = 0;
  private metrics: GeometryMetrics;

  constructor(options: Partial<GeometryGenerationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.regionExtractor = new RegionExtractor();
    this.meshOptimizer = new MeshOptimizer();
    this.validator = new GeometryValidator();
    
    this.metrics = {
      totalTime: 0,
      stageTimings: {
        analysis: 0,
        extraction: 0,
        meshing: 0,
        optimization: 0,
        validation: 0,
      },
      memoryUsage: {
        peak: 0,
        final: 0,
      },
      complexity: {
        inputPixels: 0,
        outputVertices: 0,
        outputFaces: 0,
      },
    };
  }

  /**
   * Generate complete 3D bookmark geometry from quantized image data
   */
  async generateGeometry(
    quantizedImage: QuantizedImageData,
    parameters: BookmarkParameters
  ): Promise<BookmarkGeometry> {
    this.startTime = performance.now();
    this.metrics.complexity.inputPixels = quantizedImage.imageData.width * quantizedImage.imageData.height;

    try {
      // Stage 1: Analyze height levels and color mapping
      const analysisStart = performance.now();
      const heightLevels = this.extractHeightLevels(quantizedImage);
      this.metrics.stageTimings.analysis = performance.now() - analysisStart;

      // Stage 2: Generate base layer geometry
      const baseLayer = await this.generateBaseLayer(parameters);

      // Stage 3: Generate layers for each height level
      const layers = await this.generateLayers(quantizedImage, parameters, heightLevels);

      // Stage 4: Combine all layers
      const allLayers = [baseLayer, ...layers];

      // Stage 5: Calculate final metrics and bounding box
      const geometry = this.assembleBookmarkGeometry(allLayers, parameters);

      // Stage 6: Basic validation
      const validationStart = performance.now();
      this.validateBasicGeometry(geometry);
      this.metrics.stageTimings.validation = performance.now() - validationStart;

      // Final metrics
      this.metrics.totalTime = performance.now() - this.startTime;
      this.options.onMetrics?.(this.metrics);

      return geometry;

    } catch (error) {
      throw new Error(`Geometry generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract unique height levels from the height map
   */
  private extractHeightLevels(quantizedImage: QuantizedImageData): number[] {
    const { heightMap } = quantizedImage;
    const heightSet = new Set<number>();
    
    // Collect all unique height values
    for (let i = 0; i < heightMap.length; i++) {
      heightSet.add(heightMap[i]);
    }

    // Sort heights from lowest to highest
    const heights = Array.from(heightSet).sort((a, b) => a - b);
    
    // Remove base level (0) as it's handled separately
    return heights.filter(h => h > 0);
  }

  /**
   * Generate the base layer with rounded corners
   */
  private async generateBaseLayer(parameters: BookmarkParameters): Promise<GeometryLayer> {
    try {
      const baseParams: BaseGeometryParameters = {
        width: parameters.width,
        height: parameters.height,
        thickness: parameters.baseThickness,
        cornerRadius: parameters.cornerRadius,
      };

      const geometry = this.createRoundedRectangleGeometry(baseParams);
      
      // Ensure geometry has the required attributes
      if (!geometry.getAttribute('position')) {
        throw new Error('Base geometry generation failed: no position attribute');
      }
      
      const baseColorRgb = { r: 128, g: 128, b: 128, a: 1 };
      const baseColorHex = `#${baseColorRgb.r.toString(16).padStart(2, '0')}${baseColorRgb.g.toString(16).padStart(2, '0')}${baseColorRgb.b.toString(16).padStart(2, '0')}`;
      return {
        id: 0,
        color: { ...baseColorRgb, hex: baseColorHex },
        height: 0, // Base level
        geometry,
        regions: [], // Base layer has no regions
        visible: true,
        opacity: 1.0,
        triangleCount: geometry.getAttribute('position') ? geometry.getAttribute('position').count / 3 : 0
      };
    } catch (error) {
      throw new Error(`Base layer generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate geometry layers for each height level
   */
  private async generateLayers(
    quantizedImage: QuantizedImageData,
    parameters: BookmarkParameters,
    heightLevels: number[]
  ): Promise<GeometryLayer[]> {
    const layers: GeometryLayer[] = [];
    const { imageData, heightMap, colorPalette } = quantizedImage;
    
    for (let i = 0; i < heightLevels.length; i++) {
      const heightLevel = heightLevels[i];
      
      this.options.onProgress?.({
        stage: 'extracting',
        progress: i / heightLevels.length,
        details: `Processing layer ${i + 1} of ${heightLevels.length}`,
      });

      // Create binary mask for this height level
      const mask = this.createHeightMask(heightMap, imageData.width, imageData.height, heightLevel);
      
      // Extract connected components
      const extractionStart = performance.now();
      const componentAnalysis = await this.regionExtractor.extractComponents(mask, imageData.width, imageData.height);
      this.metrics.stageTimings.extraction += performance.now() - extractionStart;

      // Filter components by minimum area
      const minAreaPixels = Math.ceil((this.options.minFeatureSize / parameters.width) * imageData.width * 
                                      (this.options.minFeatureSize / parameters.height) * imageData.height);
      const filteredComponents = componentAnalysis.components.filter(comp => comp.area >= minAreaPixels);

      if (filteredComponents.length === 0) {
        continue; // Skip empty layers
      }

      // Find the color for this height level
      const layerColor = this.findColorForHeight(heightLevel, heightMap, colorPalette, imageData);

      this.options.onProgress?.({
        stage: 'meshing',
        progress: i / heightLevels.length,
        details: `Meshing layer ${i + 1} of ${heightLevels.length} (${filteredComponents.length} components)`,
      });

      // Generate geometry for this layer
      const meshingStart = performance.now();
      const layerGeometry = await this.generateLayerGeometry(
        filteredComponents,
        parameters,
        heightLevel
      );
      this.metrics.stageTimings.meshing += performance.now() - meshingStart;

      // Optimize geometry if enabled
      if (this.options.enableOptimization) {
        const optimizationStart = performance.now();
        const optimized = await this.meshOptimizer.optimizeGeometry(layerGeometry, {
          targetRatio: this.options.simplificationRatio,
          preserveBoundaries: true,
          preserveUVs: false,
          preserveColors: false,
        });
        this.metrics.stageTimings.optimization += performance.now() - optimizationStart;
        
        // Update geometry with optimized version
        layerGeometry.setAttribute('position', optimized.getAttribute('position'));
        layerGeometry.setIndex(optimized.getIndex());
      }

      // Convert geometry ConnectedComponents to simpler format for GeometryLayer
      const simpleComponents = filteredComponents.map(comp => ({
        pixels: comp.pixels,
        area: comp.area,
        boundingBox: {
          min: new THREE.Vector3(comp.boundingBox.minX, comp.boundingBox.minY, 0),
          max: new THREE.Vector3(comp.boundingBox.maxX, comp.boundingBox.maxY, 0),
        }
      }));

      layers.push({
        id: i,
        color: layerColor,
        height: heightLevel,
        geometry: layerGeometry,
        regions: simpleComponents,
        visible: true,
        opacity: 1.0,
        triangleCount: layerGeometry.index ? layerGeometry.index.count / 3 : layerGeometry.getAttribute('position').count / 3,
      });

      this.options.onProgress?.({
        stage: 'complete',
        progress: (i + 1) / heightLevels.length,
        details: `Completed layer ${i + 1} of ${heightLevels.length}`,
      });
    }

    return layers;
  }

  /**
   * Create binary mask for specific height level
   */
  private createHeightMask(
    heightMap: Float32Array,
    width: number,
    height: number,
    targetHeight: number
  ): Uint8Array {
    const mask = new Uint8Array(width * height);
    const tolerance = 0.001; // Small tolerance for floating point comparison
    
    for (let i = 0; i < heightMap.length; i++) {
      mask[i] = Math.abs(heightMap[i] - targetHeight) < tolerance ? 1 : 0;
    }
    
    return mask;
  }

  /**
   * Find the dominant color for a specific height level
   */
  private findColorForHeight(
    heightLevel: number,
    heightMap: Float32Array,
    colorPalette: Color[],
    imageData: ImageData
  ): Color {
    const colorCounts = new Map<string, { color: Color; count: number }>();
    const tolerance = 0.001;
    
    // Count colors at this height level
    for (let i = 0; i < heightMap.length; i++) {
      if (Math.abs(heightMap[i] - heightLevel) < tolerance) {
        const pixelIndex = i * 4;
        const colorRgba = {
          r: imageData.data[pixelIndex],
          g: imageData.data[pixelIndex + 1],
          b: imageData.data[pixelIndex + 2],
          a: imageData.data[pixelIndex + 3] / 255,
        };
        const colorHex = `#${colorRgba.r.toString(16).padStart(2, '0')}${colorRgba.g.toString(16).padStart(2, '0')}${colorRgba.b.toString(16).padStart(2, '0')}`;
        const color: Color = {
          ...colorRgba,
          hex: colorHex
        };
        
        const colorKey = `${color.r},${color.g},${color.b}`;
        const existing = colorCounts.get(colorKey);
        if (existing) {
          existing.count++;
        } else {
          colorCounts.set(colorKey, { color, count: 1 });
        }
      }
    }
    
    // Return the most common color
    let maxCount = 0;
    let dominantColor = colorPalette[0]; // fallback
    
    for (const { color, count } of Array.from(colorCounts.values())) {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    }
    
    return dominantColor;
  }

  /**
   * Generate Three.js geometry for a layer from connected components
   */
  private async generateLayerGeometry(
    components: ConnectedComponent[],
    parameters: BookmarkParameters,
    heightLevel: number
  ): Promise<THREE.BufferGeometry> {
    const layerGeometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    
    let vertexOffset = 0;
    
    for (const component of components) {
      // Generate extruded geometry for this component
      const componentGeometry = this.extrudeComponent(component, parameters, heightLevel);
      
      // Merge into layer geometry
      const posAttr = componentGeometry.getAttribute('position') as THREE.BufferAttribute;
      const normalAttr = componentGeometry.getAttribute('normal') as THREE.BufferAttribute;
      const indexAttr = componentGeometry.getIndex() as THREE.BufferAttribute;
      
      // Add positions
      for (let i = 0; i < posAttr.count; i++) {
        positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        normals.push(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i));
      }
      
      // Add indices with offset
      if (indexAttr) {
        for (let i = 0; i < indexAttr.count; i++) {
          indices.push(indexAttr.getX(i) + vertexOffset);
        }
      }
      
      vertexOffset += posAttr.count;
    }
    
    // Set attributes
    layerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    layerGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    layerGeometry.setIndex(indices);
    
    // Compute bounding box and sphere
    layerGeometry.computeBoundingBox();
    layerGeometry.computeBoundingSphere();
    
    return layerGeometry;
  }

  /**
   * Extrude a connected component into 3D geometry
   */
  private extrudeComponent(
    component: ConnectedComponent,
    parameters: BookmarkParameters,
    heightLevel: number
  ): THREE.BufferGeometry {
    // Convert pixel coordinates to world coordinates
    const worldPixels = component.pixels.map(pixel => ({
      x: (pixel.x / parameters.width) * parameters.width - parameters.width / 2,
      y: (pixel.y / parameters.height) * parameters.height - parameters.height / 2,
    }));
    
    // Create contour from pixels (simplified approach - in production would use marching squares)
    const contour = this.pixelsToContour(worldPixels);
    
    // Extrude the contour
    const extrusionHeight = heightLevel * parameters.layerThickness;
    return this.extrudeContour(contour, extrusionHeight);
  }

  /**
   * Convert pixel array to smooth contour
   */
  private pixelsToContour(pixels: Point2D[]): Point2D[] {
    if (pixels.length < 3) return pixels;
    
    // Simple convex hull for now - in production would use proper contour tracing
    return this.convexHull(pixels);
  }

  /**
   * Calculate convex hull using Graham scan
   */
  private convexHull(points: Point2D[]): Point2D[] {
    if (points.length < 3) return points;
    
    // Find the bottom-most point (or left most in case of tie)
    let bottom = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].y < points[bottom].y || 
          (points[i].y === points[bottom].y && points[i].x < points[bottom].x)) {
        bottom = i;
      }
    }
    
    // Swap bottom point to first position
    [points[0], points[bottom]] = [points[bottom], points[0]];
    
    // Sort points by polar angle with respect to bottom point
    const p0 = points[0];
    points.slice(1).sort((a, b) => {
      const angleA = Math.atan2(a.y - p0.y, a.x - p0.x);
      const angleB = Math.atan2(b.y - p0.y, b.x - p0.x);
      return angleA - angleB;
    });
    
    // Graham scan
    const hull: Point2D[] = [points[0], points[1]];
    
    for (let i = 2; i < points.length; i++) {
      while (hull.length > 1 && this.crossProduct(
        hull[hull.length - 2], 
        hull[hull.length - 1], 
        points[i]
      ) <= 0) {
        hull.pop();
      }
      hull.push(points[i]);
    }
    
    return hull;
  }

  /**
   * Calculate cross product for three points
   */
  private crossProduct(o: Point2D, a: Point2D, b: Point2D): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  /**
   * Extrude a 2D contour into 3D geometry
   */
  private extrudeContour(contour: Point2D[], height: number): THREE.BufferGeometry {
    if (contour.length < 3) {
      return new THREE.BufferGeometry(); // Empty geometry for degenerate cases
    }
    
    // Create shape from contour
    const shape = new THREE.Shape();
    shape.moveTo(contour[0].x, contour[0].y);
    for (let i = 1; i < contour.length; i++) {
      shape.lineTo(contour[i].x, contour[i].y);
    }
    shape.lineTo(contour[0].x, contour[0].y); // Close the shape
    
    // Extrude settings
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: height,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.01,
      bevelThickness: 0.01,
    };
    
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }

  /**
   * Create rounded rectangle geometry for base layer
   */
  private createRoundedRectangleGeometry(params: BaseGeometryParameters): THREE.BufferGeometry {
    const { width, height, thickness, cornerRadius } = params;
    
    try {
      // Create rounded rectangle shape
      const shape = new THREE.Shape();
      const x = -width / 2;
      const y = -height / 2;
      const r = Math.max(0, Math.min(cornerRadius, width / 4, height / 4)); // Ensure valid radius
      
      if (r > 0) {
        // Create rounded corners
        shape.moveTo(x + r, y);
        shape.lineTo(x + width - r, y);
        shape.quadraticCurveTo(x + width, y, x + width, y + r);
        shape.lineTo(x + width, y + height - r);
        shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        shape.lineTo(x + r, y + height);
        shape.quadraticCurveTo(x, y + height, x, y + height - r);
        shape.lineTo(x, y + r);
        shape.quadraticCurveTo(x, y, x + r, y);
      } else {
        // Simple rectangle if no radius
        shape.moveTo(x, y);
        shape.lineTo(x + width, y);
        shape.lineTo(x + width, y + height);
        shape.lineTo(x, y + height);
        shape.lineTo(x, y);
      }
      
      // Extrude the shape
      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: thickness,
        bevelEnabled: false,
        steps: 1,
      };
      
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      // Ensure we have proper geometry
      if (!geometry.getAttribute('position') || geometry.getAttribute('position').count === 0) {
        throw new Error('ExtrudeGeometry creation failed');
      }
      
      return geometry;
    } catch (error) {
      // Fallback to simple box geometry if extrusion fails
      console.warn('Rounded rectangle creation failed, using box geometry:', error);
      return new THREE.BoxGeometry(width, height, thickness);
    }
  }

  /**
   * Assemble final bookmark geometry from all layers
   */
  private assembleBookmarkGeometry(
    layers: GeometryLayer[],
    parameters: BookmarkParameters
  ): BookmarkGeometry {
    // Calculate overall bounding box
    const boundingBox = new THREE.Box3(
      new THREE.Vector3(-parameters.width / 2, -parameters.height / 2, 0),
      new THREE.Vector3(
        parameters.width / 2,
        parameters.height / 2,
        parameters.baseThickness + layers.length * parameters.layerThickness
      )
    );

    // Calculate total vertex and face counts
    let totalVertices = 0;
    let totalFaces = 0;
    
    for (const layer of layers) {
      const posAttr = layer.geometry.getAttribute('position') as THREE.BufferAttribute;
      const indexAttr = layer.geometry.getIndex();
      
      totalVertices += posAttr.count;
      totalFaces += indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
    }

    // Update metrics
    this.metrics.complexity.outputVertices = totalVertices;
    this.metrics.complexity.outputFaces = totalFaces;

    return {
      layers,
      boundingBox,
      vertexCount: totalVertices,
      faceCount: totalFaces,
      totalTriangles: totalFaces, // Assuming each face is a triangle
      estimatedFileSize: (totalVertices * 12 + totalFaces * 12) / (1024 * 1024), // Rough estimate in MB
    };
  }

  /**
   * Get current generation metrics
   */
  getMetrics(): GeometryMetrics {
    return { ...this.metrics };
  }

  /**
   * Basic geometry validation
   */
  private validateBasicGeometry(geometry: BookmarkGeometry): void {
    if (geometry.layers.length === 0) {
      throw new Error('No geometry layers generated');
    }
    
    if (geometry.vertexCount === 0) {
      throw new Error('Generated geometry has no vertices');
    }
    
    if (geometry.faceCount === 0) {
      throw new Error('Generated geometry has no faces');
    }

    // Check each layer has valid geometry
    for (let i = 0; i < geometry.layers.length; i++) {
      const layer = geometry.layers[i];
      const positions = layer.geometry.getAttribute('position');
      
      if (!positions) {
        throw new Error(`Layer ${i}: Missing position data`);
      }
      
      if (positions.count === 0) {
        throw new Error(`Layer ${i}: No vertices in geometry`);
      }
    }
  }

  /**
   * Update generation options
   */
  updateOptions(options: Partial<GeometryGenerationOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// ========================
// Factory Functions
// ========================

/**
 * Create a geometry generator with bookmark-optimized settings
 */
export function createBookmarkGeometryGenerator(
  options: Partial<GeometryGenerationOptions> = {}
): BookmarkGeometryGenerator {
  const bookmarkOptions: GeometryGenerationOptions = {
    minFeatureSize: 0.4, // Optimized for FDM 3D printing
    maxVertices: 50000, // Balanced performance/quality
    enableOptimization: true,
    enableSmoothing: false, // Keep sharp edges for bookmarks
    simplificationRatio: 0.05, // Conservative simplification
    ...options,
  };
  
  return new BookmarkGeometryGenerator(bookmarkOptions);
}

/**
 * Generate geometry with progress tracking
 */
export async function generateBookmarkGeometry(
  quantizedImage: QuantizedImageData,
  parameters: BookmarkParameters,
  options: Partial<GeometryGenerationOptions> = {}
): Promise<BookmarkGeometry> {
  const generator = createBookmarkGeometryGenerator(options);
  return generator.generateGeometry(quantizedImage, parameters);
}