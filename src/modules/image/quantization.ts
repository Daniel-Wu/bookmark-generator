/**
 * K-means color quantization algorithm implementation
 * 
 * Implements K-means++ initialization for better centroid selection with
 * Euclidean distance calculation in RGB color space. Optimized for performance
 * with smart pixel sampling for large images.
 */

import type {
  Color,
  KMeansOptions,
  QuantizedImageData
} from '../../types';
import type {
  KMeansResult
} from '../../types/image';
import { KMEANS_CONFIG, PROCESSING_LIMITS } from '../../constants';
import { calculateLuminance, euclideanDistance, createColor } from './colorUtils';
import { samplePixels } from './sampling';
import type { PixelSample } from './sampling';
import { HeightMapper, type HeightMappingOptions } from './heightMapping';

// ========================
// K-Means Quantizer Class
// ========================

export interface QuantizerProgress {
  stage: 'sampling' | 'initialization' | 'clustering' | 'assignment' | 'complete';
  progress: number; // 0-1
  iteration?: number;
  message: string;
}

export interface QuantizerOptions extends Partial<KMeansOptions> {
  onProgress?: (progress: QuantizerProgress) => void;
  preserveTransparency?: boolean;
  signal?: AbortSignal;
  heightMappingOptions?: Partial<HeightMappingOptions>;
}

export class KMeansQuantizer {
  private options: Required<KMeansOptions>;
  private onProgress?: (progress: QuantizerProgress) => void;
  private preserveTransparency: boolean;
  private signal?: AbortSignal;
  private heightMappingOptions: Partial<HeightMappingOptions>;

  constructor(options: QuantizerOptions = {}) {
    this.options = {
      maxIterations: options.maxIterations ?? KMEANS_CONFIG.MAX_ITERATIONS,
      convergenceThreshold: options.convergenceThreshold ?? KMEANS_CONFIG.CONVERGENCE_THRESHOLD,
      maxSamples: options.maxSamples ?? KMEANS_CONFIG.MAX_SAMPLES
    };
    this.onProgress = options.onProgress;
    this.preserveTransparency = options.preserveTransparency ?? true;
    this.signal = options.signal;
    this.heightMappingOptions = options.heightMappingOptions ?? {};
  }

  /**
   * Quantize image colors using K-means clustering
   */
  async quantize(imageData: ImageData, k: number): Promise<QuantizedImageData> {
    this.validateInputs(imageData, k);
    
    // Stage 1: Sample pixels for performance
    this.reportProgress('sampling', 0, 'Sampling pixels for analysis...');
    const samples = await this.samplePixels(imageData);
    
    if (this.signal?.aborted) {
      throw new Error('Quantization cancelled');
    }

    // Stage 2: Initialize centroids using K-means++
    this.reportProgress('initialization', 0.2, 'Initializing color centroids...');
    const initialCentroids = await this.initializeCentroids(samples, k);
    
    // Stage 3: Perform K-means clustering
    this.reportProgress('clustering', 0.3, 'Performing K-means clustering...');
    const clusterResult = await this.performKMeans(samples, initialCentroids);
    
    // Stage 4: Assign all pixels to clusters
    this.reportProgress('assignment', 0.8, 'Assigning colors to all pixels...');
    const quantizedData = await this.assignAllPixels(imageData, clusterResult.centroids);
    
    // Stage 5: Generate height map
    this.reportProgress('complete', 0.85, 'Generating height map...');
    const heightMap = await this.generateHeightMap(quantizedData, clusterResult.centroids);
    
    return {
      imageData: quantizedData,
      colorPalette: clusterResult.centroids,
      heightMap
    };
  }

  /**
   * Validate quantization inputs
   */
  private validateInputs(imageData: ImageData, k: number): void {
    if (!imageData || !imageData.data) {
      throw new Error('Invalid image data provided');
    }
    
    if (k < 2 || k > 8) {
      throw new Error('Color count must be between 2 and 8');
    }
    
    if (imageData.width <= 0 || imageData.height <= 0) {
      throw new Error('Image dimensions must be positive');
    }
    
    const totalPixels = imageData.width * imageData.height;
    if (totalPixels > PROCESSING_LIMITS.MAX_SAMPLE_PIXELS * 100) {
      throw new Error('Image too large for processing');
    }
  }

  /**
   * Sample pixels from image for performance optimization
   */
  private async samplePixels(imageData: ImageData): Promise<PixelSample[]> {
    const samples = samplePixels(imageData, this.options.maxSamples);
    
    // Filter out transparent pixels if not preserving transparency
    if (!this.preserveTransparency) {
      return samples.filter(sample => (sample.color.a ?? 1) > 0.5);
    }
    
    return samples;
  }

  /**
   * Initialize centroids using K-means++ algorithm for better convergence
   */
  private async initializeCentroids(samples: PixelSample[], k: number): Promise<Color[]> {
    if (samples.length === 0) {
      throw new Error('No valid pixels found for quantization');
    }

    const centroids: Color[] = [];
    
    // Choose first centroid randomly
    const firstIndex = Math.floor(Math.random() * samples.length);
    centroids.push({ ...samples[firstIndex].color });
    
    // Choose remaining centroids using K-means++ algorithm
    for (let i = 1; i < k; i++) {
      if (this.signal?.aborted) {
        throw new Error('Quantization cancelled');
      }
      
      // Calculate distances to nearest centroid for each sample
      const distances = samples.map(sample => {
        const minDistance = Math.min(
          ...centroids.map(centroid => euclideanDistance(sample.color, centroid))
        );
        return minDistance * minDistance; // Square the distance for k-means++
      });
      
      // Choose next centroid with probability proportional to squared distance
      const totalDistance = distances.reduce((sum, d) => sum + d, 0);
      if (totalDistance === 0) {
        // If all distances are 0, choose randomly
        const randomIndex = Math.floor(Math.random() * samples.length);
        centroids.push({ ...samples[randomIndex].color });
      } else {
        const threshold = Math.random() * totalDistance;
        let cumulativeDistance = 0;
        
        for (let j = 0; j < samples.length; j++) {
          cumulativeDistance += distances[j];
          if (cumulativeDistance >= threshold) {
            centroids.push({ ...samples[j].color });
            break;
          }
        }
      }
    }
    
    return centroids;
  }

  /**
   * Perform K-means clustering until convergence
   */
  private async performKMeans(samples: PixelSample[], initialCentroids: Color[]): Promise<KMeansResult> {
    let centroids = [...initialCentroids];
    let assignments = new Array<number>(samples.length);
    let converged = false;
    let iteration = 0;
    let totalDistortion = 0;
    
    while (iteration < this.options.maxIterations && !converged) {
      if (this.signal?.aborted) {
        throw new Error('Quantization cancelled');
      }
      
      const progress = 0.3 + (iteration / this.options.maxIterations) * 0.5;
      this.reportProgress('clustering', progress, `K-means iteration ${iteration + 1}/${this.options.maxIterations}`, iteration);
      
      // Assignment step: assign each sample to nearest centroid
      const newAssignments = new Array<number>(samples.length);
      totalDistortion = 0;
      
      for (let i = 0; i < samples.length; i++) {
        let minDistance = Infinity;
        let bestCluster = 0;
        
        for (let j = 0; j < centroids.length; j++) {
          const distance = euclideanDistance(samples[i].color, centroids[j]);
          if (distance < minDistance) {
            minDistance = distance;
            bestCluster = j;
          }
        }
        
        newAssignments[i] = bestCluster;
        totalDistortion += minDistance * minDistance;
      }
      
      // Update step: calculate new centroids
      const newCentroids = new Array<Color>(centroids.length);
      
      for (let j = 0; j < centroids.length; j++) {
        const clusterSamples = samples.filter((_, i) => newAssignments[i] === j);
        
        if (clusterSamples.length === 0) {
          // Empty cluster - keep the old centroid or reinitialize
          newCentroids[j] = { ...centroids[j] };
        } else {
          // Calculate mean of assigned samples
          const sumR = clusterSamples.reduce((sum, sample) => sum + sample.color.r, 0);
          const sumG = clusterSamples.reduce((sum, sample) => sum + sample.color.g, 0);
          const sumB = clusterSamples.reduce((sum, sample) => sum + sample.color.b, 0);
          const sumA = clusterSamples.reduce((sum, sample) => sum + (sample.color.a ?? 1), 0);
          
          newCentroids[j] = createColor(
            Math.round(sumR / clusterSamples.length),
            Math.round(sumG / clusterSamples.length),
            Math.round(sumB / clusterSamples.length),
            sumA / clusterSamples.length
          );
        }
      }
      
      // Check for convergence
      const maxMovement = Math.max(
        ...centroids.map((old, i) => euclideanDistance(old, newCentroids[i]))
      );
      
      converged = maxMovement < this.options.convergenceThreshold;
      centroids = newCentroids;
      assignments = newAssignments;
      iteration++;
      
      // Yield control to prevent blocking the main thread
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return {
      centroids,
      assignments,
      iterations: iteration,
      converged,
      totalDistortion
    };
  }

  /**
   * Assign all pixels in the image to their nearest centroids
   */
  private async assignAllPixels(imageData: ImageData, centroids: Color[]): Promise<ImageData> {
    const newImageData = new ImageData(imageData.width, imageData.height);
    const data = imageData.data;
    const newData = newImageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      if (this.signal?.aborted) {
        throw new Error('Quantization cancelled');
      }
      
      const pixel = createColor(data[i], data[i + 1], data[i + 2], data[i + 3] / 255);
      
      // Preserve transparent pixels if requested
      if (this.preserveTransparency && (pixel.a ?? 1) < 0.5) {
        newData[i] = pixel.r;
        newData[i + 1] = pixel.g;
        newData[i + 2] = pixel.b;
        newData[i + 3] = data[i + 3]; // Keep original alpha
        continue;
      }
      
      // Skip transparent pixels if not preserving transparency
      if (!this.preserveTransparency && (pixel.a ?? 1) < 0.5) {
        newData[i] = 0;
        newData[i + 1] = 0;
        newData[i + 2] = 0;
        newData[i + 3] = 0;
        continue;
      }
      
      // Find nearest centroid
      let minDistance = Infinity;
      let bestCentroid = centroids[0];
      
      for (const centroid of centroids) {
        const distance = euclideanDistance(pixel, centroid);
        if (distance < minDistance) {
          minDistance = distance;
          bestCentroid = centroid;
        }
      }
      
      // Assign pixel to best centroid
      newData[i] = bestCentroid.r;
      newData[i + 1] = bestCentroid.g;
      newData[i + 2] = bestCentroid.b;
      newData[i + 3] = Math.round((bestCentroid.a ?? 1) * 255);
      
      // Report progress periodically
      if (i % 40000 === 0) {
        const progress = 0.8 + (i / data.length) * 0.2;
        this.reportProgress('assignment', progress, 'Assigning colors to pixels...');
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return newImageData;
  }

  /**
   * Generate height map based on luminance values
   * Perceived luminance: 0.299*R + 0.587*G + 0.114*B
   */
  private async generateHeightMap(imageData: ImageData, palette: Color[]): Promise<Float32Array> {
    // Create quantized image data for height mapper
    const quantizedData: QuantizedImageData = {
      imageData,
      colorPalette: palette,
      heightMap: new Float32Array(0) // Will be generated by HeightMapper
    };

    // Create height mapper with progress reporting
    const heightMapper = new HeightMapper(
      this.heightMappingOptions,
      (progress) => {
        // Forward height mapping progress to main progress callback
        if (this.onProgress) {
          this.onProgress({
            stage: 'complete',
            progress: 0.85 + (progress.progress * 0.15), // Map to final 15% of overall progress
            message: progress.message
          });
        }
      },
      this.signal
    );

    return await heightMapper.generateHeightMap(quantizedData);
  }

  /**
   * Report progress to callback
   */
  private reportProgress(
    stage: QuantizerProgress['stage'],
    progress: number,
    message: string,
    iteration?: number
  ): void {
    if (this.onProgress) {
      this.onProgress({
        stage,
        progress: Math.max(0, Math.min(1, progress)),
        message,
        iteration
      });
    }
  }
}

// ========================
// Convenience Functions
// ========================

/**
 * Quantize image colors using K-means clustering (convenience function)
 */
export async function quantizeImageColors(
  imageData: ImageData,
  colorCount: number,
  options: QuantizerOptions = {}
): Promise<QuantizedImageData> {
  const quantizer = new KMeansQuantizer(options);
  return quantizer.quantize(imageData, colorCount);
}

/**
 * Analyze image and suggest optimal color count
 */
export function suggestColorCount(imageData: ImageData): number {
  const samples = samplePixels(imageData, 5000);
  const uniqueColors = new Set(
    samples.map(sample => `${sample.color.r},${sample.color.g},${sample.color.b}`)
  ).size;
  
  // Suggest color count based on image complexity
  if (uniqueColors < 50) return 2;
  if (uniqueColors < 200) return 3;
  if (uniqueColors < 500) return 4;
  if (uniqueColors < 1000) return 5;
  if (uniqueColors < 2000) return 6;
  return Math.min(8, Math.max(2, Math.floor(Math.log2(uniqueColors))));
}

/**
 * Validate quantization parameters
 */
export function validateQuantizationParams(
  imageData: ImageData,
  colorCount: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!imageData || !imageData.data) {
    errors.push('Invalid image data');
  }
  
  if (colorCount < 2 || colorCount > 8 || !Number.isInteger(colorCount)) {
    errors.push('Color count must be an integer between 2 and 8');
  }
  
  if (imageData && (imageData.width <= 0 || imageData.height <= 0)) {
    errors.push('Image dimensions must be positive');
  }
  
  const totalPixels = imageData ? imageData.width * imageData.height : 0;
  if (totalPixels > PROCESSING_LIMITS.MAX_SAMPLE_PIXELS * 100) {
    errors.push('Image too large for processing');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}