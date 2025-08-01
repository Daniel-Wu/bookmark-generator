/**
 * Pixel sampling utilities for performance optimization
 * 
 * Provides intelligent pixel sampling strategies to reduce computational
 * complexity while maintaining representative color analysis for K-means.
 */

import type { Color, Point2D } from '../../types';
import { colorFromImageData } from './colorUtils';

// ========================
// Sampling Types
// ========================

export interface PixelSample {
  color: Color;
  position: Point2D;
  weight: number; // Importance weight for clustering
}

export interface SamplingOptions {
  maxSamples: number;
  strategy: 'uniform' | 'adaptive' | 'edge-aware' | 'random';
  edgeThreshold?: number; // For edge-aware sampling
  preserveCorners?: boolean; // Ensure corner pixels are included
  excludeTransparent?: boolean; // Skip transparent pixels
}

export interface SamplingResult {
  samples: PixelSample[];
  totalPixels: number;
  samplingRatio: number;
  strategy: string;
  coverageMap?: boolean[][]; // Optional coverage visualization
}

// ========================
// Main Sampling Functions
// ========================

/**
 * Sample pixels from image data using various strategies
 */
export function samplePixels(
  imageData: ImageData,
  maxSamples: number = 10000,
  options: Partial<SamplingOptions> = {}
): PixelSample[] {
  const opts: SamplingOptions = {
    maxSamples,
    strategy: 'adaptive',
    edgeThreshold: 30,
    preserveCorners: true,
    excludeTransparent: true,
    ...options
  };

  const totalPixels = imageData.width * imageData.height;
  
  // If image is small enough, sample all pixels
  if (totalPixels <= maxSamples) {
    return sampleAllPixels(imageData, opts);
  }

  // Choose sampling strategy based on options
  switch (opts.strategy) {
    case 'uniform':
      return uniformSampling(imageData, opts);
    case 'random':
      return randomSampling(imageData, opts);
    case 'edge-aware':
      return edgeAwareSampling(imageData, opts);
    case 'adaptive':
    default:
      return adaptiveSampling(imageData, opts);
  }
}

/**
 * Sample all pixels (for small images)
 */
function sampleAllPixels(imageData: ImageData, options: SamplingOptions): PixelSample[] {
  const samples: PixelSample[] = [];
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const color = colorFromImageData(data, index);
      
      // Skip transparent pixels if requested
      if (options.excludeTransparent && (color.a ?? 1) < 0.1) {
        continue;
      }

      samples.push({
        color,
        position: { x, y },
        weight: 1.0
      });
    }
  }

  return samples;
}

/**
 * Uniform grid sampling - evenly distributed samples
 */
function uniformSampling(imageData: ImageData, options: SamplingOptions): PixelSample[] {
  const samples: PixelSample[] = [];
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const totalPixels = width * height;

  // Calculate step size for uniform distribution
  const step = Math.sqrt(totalPixels / options.maxSamples);
  const stepX = Math.max(1, Math.floor(step));
  const stepY = Math.max(1, Math.floor(step));

  // Add corner pixels if requested
  if (options.preserveCorners) {
    addCornerSamples(samples, imageData, options);
  }

  // Sample in grid pattern
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      if (samples.length >= options.maxSamples) break;
      
      const index = (y * width + x) * 4;
      const color = colorFromImageData(data, index);
      
      // Skip transparent pixels if requested
      if (options.excludeTransparent && (color.a ?? 1) < 0.1) {
        continue;
      }

      samples.push({
        color,
        position: { x, y },
        weight: 1.0
      });
    }
    if (samples.length >= options.maxSamples) break;
  }

  return samples.slice(0, options.maxSamples);
}

/**
 * Random sampling - randomly distributed samples
 */
function randomSampling(imageData: ImageData, options: SamplingOptions): PixelSample[] {
  const samples: PixelSample[] = [];
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Add corner pixels if requested
  if (options.preserveCorners) {
    addCornerSamples(samples, imageData, options);
  }

  // Generate random samples
  const maxAttempts = options.maxSamples * 2; // Prevent infinite loops
  let attempts = 0;
  
  while (samples.length < options.maxSamples && attempts < maxAttempts) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const index = (y * width + x) * 4;
    const color = colorFromImageData(data, index);
    
    // Skip transparent pixels if requested
    if (options.excludeTransparent && (color.a ?? 1) < 0.1) {
      attempts++;
      continue;
    }

    samples.push({
      color,
      position: { x, y },
      weight: 1.0
    });
    
    attempts++;
  }

  return samples;
}

/**
 * Edge-aware sampling - prioritize areas with high color variation
 */
function edgeAwareSampling(imageData: ImageData, options: SamplingOptions): PixelSample[] {
  const samples: PixelSample[] = [];
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const threshold = options.edgeThreshold || 30;

  // Calculate edge map using simple gradient
  const edgeMap = calculateEdgeMap(imageData, threshold);
  
  // Add corner pixels if requested
  if (options.preserveCorners) {
    addCornerSamples(samples, imageData, options);
  }

  // Create weighted sampling based on edge strength
  const candidates: Array<{ x: number; y: number; weight: number }> = [];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const edgeStrength = edgeMap[y * width + x];
      const weight = 1.0 + edgeStrength * 3.0; // Boost edge pixels
      candidates.push({ x, y, weight });
    }
  }

  // Sort by weight (highest first) and sample
  candidates.sort((a, b) => b.weight - a.weight);
  
  for (let i = 0; i < Math.min(candidates.length, options.maxSamples - samples.length); i++) {
    const candidate = candidates[i];
    const index = (candidate.y * width + candidate.x) * 4;
    const color = colorFromImageData(data, index);
    
    // Skip transparent pixels if requested
    if (options.excludeTransparent && (color.a ?? 1) < 0.1) {
      continue;
    }

    samples.push({
      color,
      position: { x: candidate.x, y: candidate.y },
      weight: candidate.weight
    });
  }

  return samples.slice(0, options.maxSamples);
}

/**
 * Adaptive sampling - combines multiple strategies intelligently
 */
function adaptiveSampling(imageData: ImageData, options: SamplingOptions): PixelSample[] {
  const samples: PixelSample[] = [];
  const width = imageData.width;
  const height = imageData.height;
  const totalPixels = width * height;

  // Add corner pixels if requested
  if (options.preserveCorners) {
    addCornerSamples(samples, imageData, options);
  }

  const remainingSamples = options.maxSamples - samples.length;
  
  // For very large images, use more sophisticated sampling
  if (totalPixels > 1000000) { // > 1MP
    // Combine edge-aware (60%) + uniform (40%) sampling
    const edgeSamples = Math.floor(remainingSamples * 0.6);
    const uniformSamples = remainingSamples - edgeSamples;
    
    const edgeOptions = { ...options, maxSamples: edgeSamples };
    const uniformOptions = { ...options, maxSamples: uniformSamples };
    
    samples.push(...edgeAwareSampling(imageData, edgeOptions));
    samples.push(...uniformSampling(imageData, uniformOptions));
  } else {
    // For smaller images, use uniform sampling with some randomization
    const baseStep = Math.sqrt(totalPixels / remainingSamples);
    const jitter = baseStep * 0.3; // Add 30% jitter
    
    samples.push(...uniformSamplingWithJitter(imageData, options, baseStep, jitter));
  }

  return samples.slice(0, options.maxSamples);
}

/**
 * Uniform sampling with random jitter for better distribution
 */
function uniformSamplingWithJitter(
  imageData: ImageData,
  options: SamplingOptions,
  baseStep: number,
  jitter: number
): PixelSample[] {
  const samples: PixelSample[] = [];
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  const stepX = Math.max(1, Math.floor(baseStep));
  const stepY = Math.max(1, Math.floor(baseStep));

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      if (samples.length >= options.maxSamples) break;
      
      // Add jitter
      const jitteredX = Math.max(0, Math.min(width - 1, 
        Math.floor(x + (Math.random() - 0.5) * jitter * 2)));
      const jitteredY = Math.max(0, Math.min(height - 1, 
        Math.floor(y + (Math.random() - 0.5) * jitter * 2)));
      
      const index = (jitteredY * width + jitteredX) * 4;
      const color = colorFromImageData(data, index);
      
      // Skip transparent pixels if requested
      if (options.excludeTransparent && (color.a ?? 1) < 0.1) {
        continue;
      }

      samples.push({
        color,
        position: { x: jitteredX, y: jitteredY },
        weight: 1.0
      });
    }
    if (samples.length >= options.maxSamples) break;
  }

  return samples;
}

// ========================
// Helper Functions
// ========================

/**
 * Add corner pixels to sample set
 */
function addCornerSamples(
  samples: PixelSample[],
  imageData: ImageData,
  options: SamplingOptions
): void {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  const corners = [
    { x: 0, y: 0 }, // Top-left
    { x: width - 1, y: 0 }, // Top-right
    { x: 0, y: height - 1 }, // Bottom-left
    { x: width - 1, y: height - 1 } // Bottom-right
  ];

  for (const corner of corners) {
    const index = (corner.y * width + corner.x) * 4;
    const color = colorFromImageData(data, index);
    
    // Skip transparent corners if requested
    if (options.excludeTransparent && (color.a ?? 1) < 0.1) {
      continue;
    }

    samples.push({
      color,
      position: corner,
      weight: 1.5 // Slightly higher weight for corners
    });
  }
}

/**
 * Calculate edge map using Sobel operator
 */
function calculateEdgeMap(imageData: ImageData, threshold: number): Float32Array {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const edgeMap = new Float32Array(width * height);

  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      // Apply Sobel kernels
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
          const gray = 0.299 * data[pixelIndex] + 0.587 * data[pixelIndex + 1] + 0.114 * data[pixelIndex + 2];
          const kernelIndex = (ky + 1) * 3 + (kx + 1);
          
          gx += gray * sobelX[kernelIndex];
          gy += gray * sobelY[kernelIndex];
        }
      }
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edgeMap[y * width + x] = magnitude > threshold ? magnitude / 255 : 0;
    }
  }

  return edgeMap;
}

/**
 * Generate sampling statistics for analysis
 */
export function analyzeSampling(samples: PixelSample[], imageData: ImageData): SamplingResult {
  const totalPixels = imageData.width * imageData.height;
  const samplingRatio = samples.length / totalPixels;
  
  // Calculate color distribution
  const colorMap = new Map<string, number>();
  for (const sample of samples) {
    const colorKey = `${sample.color.r},${sample.color.g},${sample.color.b}`;
    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
  }

  return {
    samples,
    totalPixels,
    samplingRatio,
    strategy: 'analyzed',
  };
}

/**
 * Validate sampling quality by checking distribution
 */
export function validateSampling(samples: PixelSample[], imageData: ImageData): {
  isValid: boolean;
  issues: string[];
  coverage: number;
} {
  const issues: string[] = [];
  const width = imageData.width;
  const height = imageData.height;
  
  // Check sample count
  if (samples.length === 0) {
    issues.push('No samples generated');
    return { isValid: false, issues, coverage: 0 };
  }
  
  // Check position validity
  const invalidPositions = samples.filter(sample => 
    sample.position.x < 0 || sample.position.x >= width ||
    sample.position.y < 0 || sample.position.y >= height
  );
  
  if (invalidPositions.length > 0) {
    issues.push(`${invalidPositions.length} samples have invalid positions`);
  }
  
  // Calculate coverage (rough estimation)
  const gridSize = Math.ceil(Math.sqrt(samples.length));
  const cellWidth = width / gridSize;
  const cellHeight = height / gridSize;
  const coveredCells = new Set<string>();
  
  for (const sample of samples) {
    const cellX = Math.floor(sample.position.x / cellWidth);
    const cellY = Math.floor(sample.position.y / cellHeight);
    coveredCells.add(`${cellX},${cellY}`);
  }
  
  const coverage = coveredCells.size / (gridSize * gridSize);
  
  if (coverage < 0.5) {
    issues.push('Poor spatial coverage detected');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    coverage
  };
}