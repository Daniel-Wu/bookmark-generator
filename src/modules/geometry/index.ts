/**
 * Geometry generation module exports
 * Complete system for converting height maps to 3D printable bookmark geometry
 */

import type { 
  QuantizedImageData, 
  BookmarkParameters
} from '../../types';
import type { 
  PrintabilityIssue 
} from '../../types/geometry';

// Main geometry generator
export {
  BookmarkGeometryGenerator,
  createBookmarkGeometryGenerator,
  generateBookmarkGeometry
} from './generator';

// Internal imports for utility functions
import {
  BookmarkGeometryGenerator,
  createBookmarkGeometryGenerator
} from './generator';
import {
  createBookmarkValidator,
  createPermissiveValidator
} from './validator';

export type {
  GeometryGenerationOptions
} from './generator';

// Region extraction and connected component analysis
export {
  RegionExtractor,
  createBookmarkRegionExtractor,
  extractMainComponents
} from './regionExtractor';

export type {
  ExtractionOptions,
  FloodFillResult
} from './regionExtractor';

// Mesh optimization and simplification
export {
  MeshOptimizer,
  createBookmarkMeshOptimizer,
  quickOptimize
} from './meshOptimizer';

export type {
  OptimizationOptions
} from './meshOptimizer';

// Geometry validation for 3D printing
export {
  GeometryValidator,
  createBookmarkValidator,
  createPermissiveValidator
} from './validator';

export type {
  ValidationConfig
} from './validator';

// Performance monitoring and memory management
export {
  PerformanceMonitor,
  ObjectPool,
  TypedArrayPool,
  ResourceManager,
  globalResourceManager,
  debounce,
  throttle,
  batchProcess,
  processInChunks,
  estimateMemoryUsage
} from './performance';

export type {
  PerformanceProfile,
  OperationMetric,
  PerformanceReport,
  MemoryPool
} from './performance';

// Re-export geometry types for convenience
export type {
  // Core geometry types
  BookmarkGeometry,
  GeometryLayer,
  ConnectedComponent,
  Point2D,
  BoundingBox,
  
  // Algorithm and processing types
  ComponentAnalysis,
  LayerProgress,
  MeshQuality,
  GeometryMetrics,
  OptimizationResult,
  
  // Configuration types
  MeshGenerationOptions,
  ExtrusionParameters,
  BaseGeometryParameters,
  SimplificationOptions,
  
  // Validation types
  PrintabilityCheck,
  PrintabilityIssue,
  GeometryValidation,
  
  // Geometric primitives
  MarchingSquaresOptions,
  ContourTrace,
  TriangulationOptions,
  Transform3D,
  GeometricPrimitive,
  CSGOperation
} from '../../types/geometry';

// Re-export core types
export type {
  BookmarkParameters,
  QuantizedImageData,
  Color
} from '../../types';

// ========================
// Utility Functions
// ========================

/**
 * Create a complete geometry generation pipeline with optimal settings
 */
export function createBookmarkPipeline() {
  const generator = createBookmarkGeometryGenerator({
    minFeatureSize: 0.4,
    maxVertices: 50000,
    enableOptimization: true,
    enableSmoothing: false,
    simplificationRatio: 0.1,
  });

  const validator = createBookmarkValidator();
  
  return {
    generator,
    validator,
    
    /**
     * Generate and validate geometry in one step
     */
    async generateAndValidate(
      quantizedImage: QuantizedImageData,
      parameters: BookmarkParameters
    ) {
      const geometry = await generator.generateGeometry(quantizedImage, parameters);
      const validation = await validator.validateGeometry(geometry, parameters);
      
      return {
        geometry,
        validation,
        metrics: generator.getMetrics(),
      };
    }
  };
}

/**
 * Quick geometry generation for previews (lower quality, faster)
 */
export function createPreviewPipeline() {
  const generator = createBookmarkGeometryGenerator({
    minFeatureSize: 1.0, // Larger features for speed
    maxVertices: 10000, // Lower vertex count
    enableOptimization: true,
    enableSmoothing: false,
    simplificationRatio: 0.3, // More aggressive simplification
  });

  const validator = createPermissiveValidator();
  
  return {
    generator,
    validator,
    
    async generatePreview(
      quantizedImage: QuantizedImageData,
      parameters: BookmarkParameters
    ) {
      const geometry = await generator.generateGeometry(quantizedImage, parameters);
      const isValid = await validator.quickValidate(geometry);
      
      return {
        geometry,
        isValid,
        metrics: generator.getMetrics(),
      };
    }
  };
}

/**
 * High-quality geometry generation for final output
 */
export function createProductionPipeline() {
  const generator = createBookmarkGeometryGenerator({
    minFeatureSize: 0.3, // Fine detail preservation
    maxVertices: 200000, // High vertex count for quality
    enableOptimization: true,
    enableSmoothing: false,
    simplificationRatio: 0.05, // Minimal simplification
  });

  const validator = createBookmarkValidator();
  
  return {
    generator,
    validator,
    
    async generateProduction(
      quantizedImage: QuantizedImageData,
      parameters: BookmarkParameters
    ) {
      const geometry = await generator.generateGeometry(quantizedImage, parameters);
      const validation = await validator.validateGeometry(geometry, parameters);
      
      if (!validation.isPrintable) {
        throw new Error(`Geometry not suitable for production: ${validation.issues.map(i => i.description).join(', ')}`);
      }
      
      return {
        geometry,
        validation,
        metrics: generator.getMetrics(),
      };
    }
  };
}

// ========================
// Constants
// ========================

/**
 * Default parameters for bookmark generation
 */
export const DEFAULT_BOOKMARK_PARAMETERS: BookmarkParameters = {
  colorCount: 4,
  layerThickness: 0.3, // mm
  baseThickness: 2.0, // mm
  width: 50, // mm
  height: 150, // mm
  cornerRadius: 3, // mm
  aspectRatioLocked: true,
};

/**
 * Recommended print settings for different printers
 */
export const PRINT_PROFILES = {
  FDM_STANDARD: {
    minFeatureSize: 0.4,
    minWallThickness: 0.4,
    maxOverhangAngle: 45,
    layerHeight: 0.2,
  },
  FDM_FINE: {
    minFeatureSize: 0.2,
    minWallThickness: 0.3,
    maxOverhangAngle: 50,
    layerHeight: 0.1,
  },
  RESIN: {
    minFeatureSize: 0.1,
    minWallThickness: 0.2,
    maxOverhangAngle: 60,
    layerHeight: 0.05,
  },
} as const;

/**
 * Performance guidelines for different use cases
 */
export const PERFORMANCE_TARGETS = {
  PREVIEW: {
    maxVertices: 5000,
    maxTriangles: 2500,
    targetTime: 1000, // 1 second
  },
  INTERACTIVE: {
    maxVertices: 20000,
    maxTriangles: 10000,
    targetTime: 3000, // 3 seconds
  },
  PRODUCTION: {
    maxVertices: 100000,
    maxTriangles: 50000,
    targetTime: 10000, // 10 seconds
  },
} as const;

// ========================
// Error Classes
// ========================

/**
 * Geometry generation specific error
 */
export class GeometryGenerationError extends Error {
  public readonly stage: string;
  public readonly cause?: Error;
  
  constructor(
    message: string,
    stage: string,
    cause?: Error
  ) {
    super(message);
    this.name = 'GeometryGenerationError';
    this.stage = stage;
    this.cause = cause;
  }
}

/**
 * Validation specific error
 */
export class GeometryValidationError extends Error {
  public readonly issues: PrintabilityIssue[];
  public readonly cause?: Error;
  
  constructor(
    message: string,
    issues: PrintabilityIssue[],
    cause?: Error
  ) {
    super(message);
    this.name = 'GeometryValidationError';
    this.issues = issues;
    this.cause = cause;
  }
}

/**
 * Optimization specific error
 */
export class GeometryOptimizationError extends Error {
  public readonly method: string;
  public readonly cause?: Error;
  
  constructor(
    message: string,
    method: string,
    cause?: Error
  ) {
    super(message);
    this.name = 'GeometryOptimizationError';
    this.method = method;
    this.cause = cause;
  }
}