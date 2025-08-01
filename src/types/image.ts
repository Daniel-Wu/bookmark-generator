/**
 * Image processing module types
 */

import type { Color } from './index';

// ========================
// Image Processing Types
// ========================

/**
 * Raw image file metadata
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number; // bytes
  colorDepth: number;
  hasAlpha: boolean;
}

/**
 * Image processing pipeline stage
 */
export type ProcessingStage =
  | 'loading'
  | 'validation'
  | 'cropping'
  | 'quantization'
  | 'height-mapping'
  | 'complete';

/**
 * Image processing progress
 */
export interface ProcessingProgress {
  stage: ProcessingStage;
  progress: number; // 0-1
  message: string;
}

/**
 * Color palette with statistics
 */
export interface ColorPalette {
  colors: Color[];
  frequencies: number[]; // relative frequency of each color
  dominantColor: Color;
  averageColor: Color;
}

/**
 * K-means clustering result
 */
export interface KMeansResult {
  centroids: Color[];
  assignments: number[]; // cluster assignment for each pixel
  iterations: number;
  converged: boolean;
  totalDistortion: number;
}

/**
 * Height map generation options
 */
export interface HeightMapOptions {
  method: 'luminance' | 'custom';
  invert: boolean;
  smoothing: boolean;
  contrastAdjustment: number; // -1 to 1
}

/**
 * Crop operation parameters
 */
export interface CropParameters {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  aspectRatio?: number; // lock aspect ratio
}

/**
 * Image analysis results
 */
export interface ImageAnalysis {
  histogram: {
    red: number[];
    green: number[];
    blue: number[];
    alpha?: number[];
  };
  colorStats: {
    uniqueColors: number;
    averageBrightness: number;
    contrast: number;
  };
  complexity: {
    edgeCount: number;
    textureScore: number;
    detailLevel: 'low' | 'medium' | 'high';
  };
}

// ========================
// Image Processing Errors
// ========================

export interface ImageProcessingError extends Error {
  stage: ProcessingStage;
  recoverable: boolean;
}

export interface FileValidationError extends Error {
  field: string;
  actualValue: unknown;
  expectedValue: unknown;
}

// ========================
// Canvas Utilities
// ========================

/**
 * Canvas drawing context with common utilities
 */
export interface CanvasContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/**
 * Image transformation matrix
 */
export interface TransformMatrix {
  a: number; // scale x
  b: number; // skew x
  c: number; // skew y
  d: number; // scale y
  e: number; // translate x
  f: number; // translate y
}

// ========================
// Performance Monitoring
// ========================

/**
 * Processing performance metrics
 */
export interface ProcessingMetrics {
  totalTime: number; // milliseconds
  stageTimings: Record<ProcessingStage, number>;
  memoryUsed: number; // bytes
  pixelsProcessed: number;
}
