/**
 * Height mapping system for converting quantized colors into 3D extrusion heights
 * 
 * Converts color palette into normalized height levels for 3D bookmark generation.
 * Uses perceptual luminance to create smooth height gradients from lightest to darkest colors.
 */

import type { Color, QuantizedImageData, BookmarkParameters } from '../../types';
import { 
  calculateLuminance, 
  sortColorsByLuminance, 
  isTransparent,
  createColor
} from './colorUtils';

// ========================
// Types and Interfaces
// ========================

/**
 * Height mapping strategy options
 */
export type HeightMappingStrategy = 'linear' | 'logarithmic' | 'exponential' | 'custom';

/**
 * Smoothing algorithm options for height maps
 */
export type SmoothingAlgorithm = 'none' | 'gaussian' | 'median' | 'bilateral';

/**
 * Height mapping configuration options
 */
export interface HeightMappingOptions {
  strategy: HeightMappingStrategy;
  smoothing: SmoothingAlgorithm;
  smoothingRadius: number; // pixels
  edgeEnhancement: boolean;
  edgeThreshold: number; // 0-1
  minFeatureSize: number; // pixels
  handleTransparency: boolean;
  transparentHeight: number; // 0-1, height for transparent areas
  customHeightLevels?: number[]; // for custom strategy
}

/**
 * Progress reporting for height map generation
 */
export interface HeightMappingProgress {
  stage: 'analysis' | 'mapping' | 'smoothing' | 'enhancement' | 'complete';
  progress: number; // 0-1
  message: string;
}

/**
 * Height map quality metrics
 */
export interface HeightMapMetrics {
  heightRange: { min: number; max: number };
  uniqueHeights: number;
  smoothnessIndex: number; // 0-1, higher is smoother
  edgeSharpness: number; // 0-1, higher is sharper
  memoryUsage: number; // bytes
}

/**
 * Connected component analysis result
 */
export interface ConnectedComponent {
  pixels: Point2D[];
  area: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  averageHeight: number;
}

interface Point2D {
  x: number;
  y: number;
}

// ========================
// Default Configuration
// ========================

const DEFAULT_OPTIONS: HeightMappingOptions = {
  strategy: 'linear',
  smoothing: 'none',
  smoothingRadius: 1,
  edgeEnhancement: false,
  edgeThreshold: 0.1,
  minFeatureSize: 3,
  handleTransparency: true,
  transparentHeight: 0
};

// ========================
// HeightMapper Class
// ========================

export class HeightMapper {
  private options: HeightMappingOptions;
  private onProgress?: (progress: HeightMappingProgress) => void;
  private signal?: AbortSignal;

  constructor(
    options: Partial<HeightMappingOptions> = {},
    onProgress?: (progress: HeightMappingProgress) => void,
    signal?: AbortSignal
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.onProgress = onProgress;
    this.signal = signal;
  }

  /**
   * Generate height map from quantized image data
   */
  async generateHeightMap(quantizedData: QuantizedImageData): Promise<Float32Array> {
    this.validateInput(quantizedData);
    
    // Stage 1: Analyze colors and create height levels
    this.reportProgress('analysis', 0, 'Analyzing color palette...');
    const heightLevels = this.calculateHeightLevels(quantizedData.colorPalette);
    
    if (this.signal?.aborted) {
      throw new Error('Height mapping cancelled');
    }

    // Stage 2: Map pixels to heights
    this.reportProgress('mapping', 0.2, 'Mapping pixels to heights...');
    let heightMap = this.mapPixelsToHeights(quantizedData, heightLevels);
    
    if (this.signal?.aborted) {
      throw new Error('Height mapping cancelled');
    }

    // Stage 3: Apply smoothing if requested
    if (this.options.smoothing !== 'none') {
      this.reportProgress('smoothing', 0.6, 'Applying smoothing algorithms...');
      heightMap = await this.applySmoothingAsync(
        heightMap, 
        quantizedData.imageData.width, 
        quantizedData.imageData.height
      );
    }

    if (this.signal?.aborted) {
      throw new Error('Height mapping cancelled');
    }

    // Stage 4: Apply edge enhancement if requested
    if (this.options.edgeEnhancement) {
      this.reportProgress('enhancement', 0.8, 'Enhancing edges...');
      heightMap = this.enhanceEdges(
        heightMap, 
        quantizedData.imageData.width, 
        quantizedData.imageData.height
      );
    }

    // Stage 5: Final validation and cleanup
    this.reportProgress('complete', 1.0, 'Finalizing height map...');
    this.validateHeightMap(heightMap);
    
    return heightMap;
  }

  /**
   * Calculate height levels for color palette using specified strategy
   */
  calculateHeightLevels(colorPalette: Color[]): Map<string, number> {
    if (colorPalette.length === 0) {
      throw new Error('Cannot calculate height levels for empty color palette');
    }

    // Validate custom strategy early
    if (this.options.strategy === 'custom' && !this.options.customHeightLevels) {
      throw new Error('Custom height levels must be provided for custom strategy');
    }

    // Sort colors by luminance (lightest to darkest)
    const sortedColors = sortColorsByLuminance(colorPalette);
    const heightLevels = new Map<string, number>();

    // Handle single color case
    if (sortedColors.length === 1) {
      const colorKey = this.getColorKey(sortedColors[0]);
      heightLevels.set(colorKey, 0.5); // Mid-height for single color
      return heightLevels;
    }

    // Calculate heights based on strategy
    const heights = this.calculateHeightsByStrategy(sortedColors.length);

    // Map colors to heights
    sortedColors.forEach((color, index) => {
      const colorKey = this.getColorKey(color);
      heightLevels.set(colorKey, heights[index]);
    });

    return heightLevels;
  }

  /**
   * Map all pixels to their corresponding heights
   */
  private mapPixelsToHeights(
    quantizedData: QuantizedImageData, 
    heightLevels: Map<string, number>
  ): Float32Array {
    const { imageData } = quantizedData;
    const heightMap = new Float32Array(imageData.width * imageData.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const color = createColor(data[i], data[i + 1], data[i + 2], data[i + 3] / 255);

      let height: number;

      // Handle transparency
      if (this.options.handleTransparency && isTransparent(color)) {
        height = this.options.transparentHeight;
      } else {
        const colorKey = this.getColorKey(color);
        height = heightLevels.get(colorKey) ?? 0;
      }

      heightMap[pixelIndex] = height;
    }

    return heightMap;
  }

  /**
   * Calculate heights based on the selected strategy
   */
  private calculateHeightsByStrategy(colorCount: number): number[] {
    const heights = new Array(colorCount);

    switch (this.options.strategy) {
      case 'linear':
        return this.calculateLinearHeights(colorCount);
      
      case 'logarithmic':
        return this.calculateLogarithmicHeights(colorCount);
      
      case 'exponential':
        return this.calculateExponentialHeights(colorCount);
      
      case 'custom':
        if (!this.options.customHeightLevels) {
          throw new Error('Custom height levels must be provided for custom strategy');
        }
        if (this.options.customHeightLevels.length !== colorCount) {
          throw new Error('Custom height levels count must match color count');
        }
        return [...this.options.customHeightLevels];
      
      default:
        throw new Error(`Unsupported height mapping strategy: ${this.options.strategy}`);
    }
  }

  /**
   * Calculate linear height distribution
   */
  private calculateLinearHeights(colorCount: number): number[] {
    const heights = new Array(colorCount);
    
    for (let i = 0; i < colorCount; i++) {
      // Reverse the height assignment: darkest (index 0) gets highest height (1)
      // lightest (index colorCount-1) gets lowest height (0)
      heights[i] = colorCount === 1 ? 0.5 : (colorCount - 1 - i) / (colorCount - 1);
    }
    
    return heights;
  }

  /**
   * Calculate logarithmic height distribution (more emphasis on darker values at high heights)
   */
  private calculateLogarithmicHeights(colorCount: number): number[] {
    const heights = new Array(colorCount);
    
    for (let i = 0; i < colorCount; i++) {
      if (colorCount === 1) {
        heights[i] = 0.5;
      } else {
        // Reverse the index so darkest (0) gets highest values
        const reversedIndex = (colorCount - 1 - i) / (colorCount - 1);
        heights[i] = Math.log(1 + reversedIndex * 9) / Math.log(10); // Log base 10
      }
    }
    
    return heights;
  }

  /**
   * Calculate exponential height distribution (more emphasis on lighter values at low heights)
   */
  private calculateExponentialHeights(colorCount: number): number[] {
    const heights = new Array(colorCount);
    
    for (let i = 0; i < colorCount; i++) {
      if (colorCount === 1) {
        heights[i] = 0.5;
      } else {
        // Reverse the index so darkest (0) gets highest values
        const reversedIndex = (colorCount - 1 - i) / (colorCount - 1);
        heights[i] = Math.pow(reversedIndex, 2); // Quadratic curve
      }
    }
    
    return heights;
  }

  /**
   * Apply smoothing algorithms asynchronously to prevent blocking
   */
  private async applySmoothingAsync(
    heightMap: Float32Array, 
    width: number, 
    height: number
  ): Promise<Float32Array> {
    return new Promise((resolve) => {
      // Use setTimeout to make it async and allow for cancellation
      setTimeout(() => {
        if (this.signal?.aborted) {
          throw new Error('Height mapping cancelled');
        }
        
        const smoothedMap = this.applySmoothing(heightMap, width, height);
        resolve(smoothedMap);
      }, 0);
    });
  }

  /**
   * Apply smoothing to height map
   */
  private applySmoothing(
    heightMap: Float32Array, 
    width: number, 
    height: number
  ): Float32Array {
    switch (this.options.smoothing) {
      case 'gaussian':
        return this.applyGaussianSmoothing(heightMap, width, height);
      
      case 'median':
        return this.applyMedianSmoothing(heightMap, width, height);
      
      case 'bilateral':
        return this.applyBilateralSmoothing(heightMap, width, height);
      
      default:
        return heightMap;
    }
  }

  /**
   * Apply Gaussian smoothing filter
   */
  private applyGaussianSmoothing(
    heightMap: Float32Array, 
    width: number, 
    height: number
  ): Float32Array {
    const smoothed = new Float32Array(heightMap.length);
    const radius = this.options.smoothingRadius;
    const sigma = radius / 3;
    
    // Create Gaussian kernel
    const kernelSize = radius * 2 + 1;
    const kernel = new Array(kernelSize);
    let kernelSum = 0;
    
    for (let i = 0; i < kernelSize; i++) {
      const x = i - radius;
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      kernelSum += kernel[i];
    }
    
    // Normalize kernel
    for (let i = 0; i < kernelSize; i++) {
      kernel[i] /= kernelSum;
    }
    
    // Apply horizontal pass
    const temp = new Float32Array(heightMap.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let i = 0; i < kernelSize; i++) {
          const xx = x + i - radius;
          if (xx >= 0 && xx < width) {
            const index = y * width + xx;
            sum += heightMap[index] * kernel[i];
            weightSum += kernel[i];
          }
        }
        
        temp[y * width + x] = weightSum > 0 ? sum / weightSum : heightMap[y * width + x];
      }
    }
    
    // Apply vertical pass
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let i = 0; i < kernelSize; i++) {
          const yy = y + i - radius;
          if (yy >= 0 && yy < height) {
            const index = yy * width + x;
            sum += temp[index] * kernel[i];
            weightSum += kernel[i];
          }
        }
        
        smoothed[y * width + x] = weightSum > 0 ? sum / weightSum : temp[y * width + x];
      }
    }
    
    return smoothed;
  }

  /**
   * Apply median smoothing filter
   */
  private applyMedianSmoothing(
    heightMap: Float32Array, 
    width: number, 
    height: number
  ): Float32Array {
    const smoothed = new Float32Array(heightMap.length);
    const radius = this.options.smoothingRadius;
    const windowSize = (radius * 2 + 1) * (radius * 2 + 1);
    const window = new Array(windowSize);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let count = 0;
        
        // Collect values in window
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            
            if (xx >= 0 && xx < width && yy >= 0 && yy < height) {
              window[count++] = heightMap[yy * width + xx];
            }
          }
        }
        
        // Find median
        if (count > 0) {
          window.sort((a, b) => a - b);
          smoothed[y * width + x] = window[Math.floor(count / 2)];
        } else {
          smoothed[y * width + x] = heightMap[y * width + x];
        }
      }
    }
    
    return smoothed;
  }

  /**
   * Apply bilateral smoothing filter (edge-preserving)
   */
  private applyBilateralSmoothing(
    heightMap: Float32Array, 
    width: number, 
    height: number
  ): Float32Array {
    const smoothed = new Float32Array(heightMap.length);
    const radius = this.options.smoothingRadius;
    const sigmaSpatial = radius / 3;
    const sigmaRange = 0.1; // Height range sensitivity
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const centerValue = heightMap[y * width + x];
        let sum = 0;
        let weightSum = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            
            if (xx >= 0 && xx < width && yy >= 0 && yy < height) {
              const neighborValue = heightMap[yy * width + xx];
              
              // Spatial weight
              const spatialDist = Math.sqrt(dx * dx + dy * dy);
              const spatialWeight = Math.exp(-(spatialDist * spatialDist) / (2 * sigmaSpatial * sigmaSpatial));
              
              // Range weight
              const rangeDist = Math.abs(centerValue - neighborValue);
              const rangeWeight = Math.exp(-(rangeDist * rangeDist) / (2 * sigmaRange * sigmaRange));
              
              const weight = spatialWeight * rangeWeight;
              sum += neighborValue * weight;
              weightSum += weight;
            }
          }
        }
        
        smoothed[y * width + x] = weightSum > 0 ? sum / weightSum : centerValue;
      }
    }
    
    return smoothed;
  }

  /**
   * Enhance edges in height map
   */
  private enhanceEdges(
    heightMap: Float32Array, 
    width: number, 
    height: number
  ): Float32Array {
    const enhanced = new Float32Array(heightMap.length);
    const threshold = this.options.edgeThreshold;
    
    // Sobel edge detection kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        // Apply Sobel kernels
        for (let i = 0; i < 9; i++) {
          const xx = x + (i % 3) - 1;
          const yy = y + Math.floor(i / 3) - 1;
          const value = heightMap[yy * width + xx];
          
          gx += value * sobelX[i];
          gy += value * sobelY[i];
        }
        
        const gradient = Math.sqrt(gx * gx + gy * gy);
        const original = heightMap[y * width + x];
        
        // Enhance edges above threshold
        if (gradient > threshold) {
          enhanced[y * width + x] = Math.min(1, original + gradient * 0.1);
        } else {
          enhanced[y * width + x] = original;
        }
      }
    }
    
    // Copy border pixels unchanged
    for (let x = 0; x < width; x++) {
      enhanced[x] = heightMap[x]; // top row
      enhanced[(height - 1) * width + x] = heightMap[(height - 1) * width + x]; // bottom row
    }
    for (let y = 0; y < height; y++) {
      enhanced[y * width] = heightMap[y * width]; // left column
      enhanced[y * width + width - 1] = heightMap[y * width + width - 1]; // right column
    }
    
    return enhanced;
  }

  /**
   * Generate height map quality metrics
   */
  generateMetrics(heightMap: Float32Array, width: number, height: number): HeightMapMetrics {
    // Calculate height range
    let min = heightMap[0];
    let max = heightMap[0];
    const uniqueHeights = new Set<number>();
    
    for (let i = 0; i < heightMap.length; i++) {
      const value = heightMap[i];
      min = Math.min(min, value);
      max = Math.max(max, value);
      uniqueHeights.add(Math.round(value * 1000) / 1000); // Round to avoid floating point issues
    }

    // Calculate smoothness index (average gradient magnitude)
    let totalGradient = 0;
    let gradientCount = 0;
    
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const current = heightMap[y * width + x];
        const right = heightMap[y * width + x + 1];
        const down = heightMap[(y + 1) * width + x];
        
        const gradientX = Math.abs(right - current);
        const gradientY = Math.abs(down - current);
        
        totalGradient += Math.sqrt(gradientX * gradientX + gradientY * gradientY);
        gradientCount++;
      }
    }
    
    const averageGradient = gradientCount > 0 ? totalGradient / gradientCount : 0;
    const smoothnessIndex = Math.max(0, 1 - averageGradient * 10); // Normalize and invert
    
    return {
      heightRange: { min, max },
      uniqueHeights: uniqueHeights.size,
      smoothnessIndex,
      edgeSharpness: averageGradient,
      memoryUsage: heightMap.byteLength
    };
  }

  /**
   * Analyze connected components in height map
   */
  analyzeConnectedComponents(
    heightMap: Float32Array, 
    width: number, 
    height: number,
    heightThreshold: number = 0.1
  ): ConnectedComponent[] {
    const visited = new Array(heightMap.length).fill(false);
    const components: ConnectedComponent[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        if (!visited[index] && heightMap[index] > heightThreshold) {
          const component = this.floodFill(heightMap, visited, width, height, x, y, heightThreshold);
          
          if (component.pixels.length >= this.options.minFeatureSize) {
            components.push(component);
          }
        }
      }
    }
    
    return components.sort((a, b) => b.area - a.area); // Sort by area descending
  }

  /**
   * Flood fill algorithm for connected component analysis
   */
  private floodFill(
    heightMap: Float32Array,
    visited: boolean[],
    width: number,
    height: number,
    startX: number,
    startY: number,
    threshold: number
  ): ConnectedComponent {
    const pixels: Point2D[] = [];
    const stack: Point2D[] = [{ x: startX, y: startY }];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let totalHeight = 0;
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const index = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[index] || heightMap[index] <= threshold) {
        continue;
      }
      
      visited[index] = true;
      pixels.push({ x, y });
      totalHeight += heightMap[index];
      
      // Update bounding box
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Check 4-connected neighbors
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }
    
    return {
      pixels,
      area: pixels.length,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      },
      averageHeight: pixels.length > 0 ? totalHeight / pixels.length : 0
    };
  }

  /**
   * Create color key for map lookup
   */
  private getColorKey(color: Color): string {
    return `${color.r},${color.g},${color.b}`;
  }

  /**
   * Validate input data
   */
  private validateInput(quantizedData: QuantizedImageData): void {
    if (!quantizedData) {
      throw new Error('Quantized image data is required');
    }
    
    if (!quantizedData.imageData || !quantizedData.imageData.data) {
      throw new Error('Invalid image data in quantized data');
    }
    
    if (!quantizedData.colorPalette || quantizedData.colorPalette.length === 0) {
      throw new Error('Color palette is required for height mapping');
    }
    
    if (quantizedData.colorPalette.length > 8) {
      throw new Error('Maximum 8 colors supported for height mapping');
    }
  }

  /**
   * Validate generated height map
   */
  private validateHeightMap(heightMap: Float32Array): void {
    if (!heightMap || heightMap.length === 0) {
      throw new Error('Generated height map is empty');
    }
    
    // Check for invalid values
    for (let i = 0; i < heightMap.length; i++) {
      const value = heightMap[i];
      if (isNaN(value) || value < 0 || value > 1) {
        throw new Error(`Invalid height value ${value} at index ${i}. Values must be between 0 and 1.`);
      }
    }
  }

  /**
   * Report progress to callback
   */
  private reportProgress(stage: HeightMappingProgress['stage'], progress: number, message: string): void {
    if (this.onProgress) {
      this.onProgress({ stage, progress, message });
    }
  }
}

// ========================
// Utility Functions
// ========================

/**
 * Create height mapper with default configuration for bookmark generation
 */
export function createBookmarkHeightMapper(
  parameters?: Partial<BookmarkParameters>,
  options?: Partial<HeightMappingOptions>
): HeightMapper {
  const bookmarkOptions: Partial<HeightMappingOptions> = {
    strategy: 'linear',
    smoothing: 'gaussian',
    smoothingRadius: 1,
    edgeEnhancement: false,
    handleTransparency: true,
    transparentHeight: 0,
    ...options
  };
  
  return new HeightMapper(bookmarkOptions);
}

/**
 * Quick height map generation from quantized data
 */
export async function generateHeightMap(
  quantizedData: QuantizedImageData,
  options?: Partial<HeightMappingOptions>
): Promise<Float32Array> {
  const mapper = new HeightMapper(options);
  return mapper.generateHeightMap(quantizedData);
}

/**
 * Configure height levels for a given color count
 */
export function configurableHeightLevels(
  colorCount: number,
  strategy: HeightMappingStrategy = 'linear'
): number[] {
  const mapper = new HeightMapper({ strategy });
  const heights = mapper['calculateHeightsByStrategy'](colorCount);
  // Heights are calculated for darkest-first order, but API expects lightest-first
  return heights.reverse();
}

/**
 * Validate height mapping parameters
 */
export function validateHeightMappingParams(
  options: Partial<HeightMappingOptions>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (options.smoothingRadius !== undefined) {
    if (options.smoothingRadius < 0 || options.smoothingRadius > 10) {
      errors.push('Smoothing radius must be between 0 and 10');
    }
  }
  
  if (options.edgeThreshold !== undefined) {
    if (options.edgeThreshold < 0 || options.edgeThreshold > 1) {
      errors.push('Edge threshold must be between 0 and 1');
    }
  }
  
  if (options.transparentHeight !== undefined) {
    if (options.transparentHeight < 0 || options.transparentHeight > 1) {
      errors.push('Transparent height must be between 0 and 1');
    }
  }
  
  if (options.customHeightLevels !== undefined) {
    const levels = options.customHeightLevels;
    if (!Array.isArray(levels) || levels.length === 0) {
      errors.push('Custom height levels must be a non-empty array');
    } else {
      for (let i = 0; i < levels.length; i++) {
        if (typeof levels[i] !== 'number' || levels[i] < 0 || levels[i] > 1) {
          errors.push(`Custom height level at index ${i} must be a number between 0 and 1`);
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}