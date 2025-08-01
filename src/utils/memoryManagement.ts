/**
 * Memory management utilities for handling large images and preventing memory leaks
 * 
 * Provides tools for monitoring memory usage, optimizing large images,
 * and cleaning up resources to maintain performance under memory constraints.
 */

import { PROCESSING_LIMITS, FILE_CONSTRAINTS } from '../constants';

// ========================
// Types
// ========================

export interface MemoryUsageInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercentage: number;
  isNearLimit: boolean;
  isCritical: boolean;
}

export interface ImageOptimizationOptions {
  maxDimension?: number;
  maxMemoryUsage?: number;
  quality?: number;
  preserveAspectRatio?: boolean;
}

export interface MemoryCleanupOptions {
  aggressive?: boolean;
  forceGC?: boolean;
}

// ========================
// Memory Monitoring
// ========================

/**
 * Get current memory usage information
 */
export function getMemoryUsage(): MemoryUsageInfo | null {
  if (!('memory' in performance)) {
    return null;
  }

  // @ts-ignore - performance.memory is not in TypeScript types but exists in Chrome
  const memory = (performance as any).memory;
  
  const usedJSHeapSize = (memory as any).usedJSHeapSize;
  const totalJSHeapSize = (memory as any).totalJSHeapSize;
  const jsHeapSizeLimit = (memory as any).jsHeapSizeLimit;
  
  const usagePercentage = (usedJSHeapSize / jsHeapSizeLimit) * 100;
  const isNearLimit = usagePercentage > 70; // Warning threshold
  const isCritical = usagePercentage > 85; // Critical threshold

  return {
    usedJSHeapSize,
    totalJSHeapSize,
    jsHeapSizeLimit,
    usagePercentage,
    isNearLimit,
    isCritical,
  };
}

/**
 * Check if system has enough memory for processing
 */
export function hasEnoughMemory(requiredBytes: number): boolean {
  const memoryInfo = getMemoryUsage();
  if (!memoryInfo) {
    // If we can't check memory, assume we have enough
    return true;
  }

  const availableMemory = memoryInfo.jsHeapSizeLimit - memoryInfo.usedJSHeapSize;
  const bufferMemory = memoryInfo.jsHeapSizeLimit * 0.1; // Keep 10% buffer

  return availableMemory - bufferMemory > requiredBytes;
}

/**
 * Estimate memory required for image processing
 */
export function estimateImageMemoryUsage(
  width: number,
  height: number,
  colorChannels: number = 4
): number {
  // Base image data (RGBA)
  const baseImageSize = width * height * colorChannels;
  
  // Processing overhead (quantization, samples, etc.)
  const processingOverhead = baseImageSize * 2; // 2x for intermediate data
  
  // Height map (Float32Array)
  const heightMapSize = width * height * 4; // 4 bytes per float
  
  // Total estimated memory
  return baseImageSize + processingOverhead + heightMapSize;
}

/**
 * Monitor memory usage during processing
 */
export class MemoryMonitor {
  private initialMemory: MemoryUsageInfo | null;
  private peakMemory: MemoryUsageInfo | null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private onMemoryWarning?: (info: MemoryUsageInfo) => void;
  private onMemoryCritical?: (info: MemoryUsageInfo) => void;

  constructor(options: {
    onMemoryWarning?: (info: MemoryUsageInfo) => void;
    onMemoryCritical?: (info: MemoryUsageInfo) => void;
  } = {}) {
    this.initialMemory = getMemoryUsage();
    this.peakMemory = this.initialMemory;
    this.onMemoryWarning = options.onMemoryWarning;
    this.onMemoryCritical = options.onMemoryCritical;
  }

  startMonitoring(intervalMs: number = 1000): void {
    this.monitoringInterval = setInterval(() => {
      const currentMemory = getMemoryUsage();
      if (!currentMemory) return;

      // Update peak memory
      if (!this.peakMemory || currentMemory.usedJSHeapSize > this.peakMemory.usedJSHeapSize) {
        this.peakMemory = currentMemory;
      }

      // Check for warnings
      if (currentMemory.isCritical && this.onMemoryCritical) {
        this.onMemoryCritical(currentMemory);
      } else if (currentMemory.isNearLimit && this.onMemoryWarning) {
        this.onMemoryWarning(currentMemory);
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  getMemoryDelta(): number {
    if (!this.initialMemory || !this.peakMemory) return 0;
    return this.peakMemory.usedJSHeapSize - this.initialMemory.usedJSHeapSize;
  }

  getPeakUsage(): MemoryUsageInfo | null {
    return this.peakMemory;
  }
}

// ========================
// Image Optimization
// ========================

/**
 * Optimize image for memory-constrained processing
 */
export async function optimizeImageForMemory(
  imageData: ImageData,
  options: ImageOptimizationOptions = {}
): Promise<ImageData> {
  const {
    maxDimension = FILE_CONSTRAINTS.maxDimension,
    maxMemoryUsage = PROCESSING_LIMITS.MAX_MEMORY_USAGE,
    quality: _quality = 0.8,
    preserveAspectRatio = true,
  } = options;

  const { width, height } = imageData;
  
  // Calculate required memory
  const requiredMemory = estimateImageMemoryUsage(width, height);
  
  // If image fits in memory, return as-is
  if (requiredMemory <= maxMemoryUsage && width <= maxDimension && height <= maxDimension) {
    return imageData;
  }

  // Calculate optimal dimensions
  const scaleFactor = Math.min(
    maxDimension / Math.max(width, height),
    Math.sqrt(maxMemoryUsage / requiredMemory)
  );

  if (scaleFactor >= 1) {
    return imageData; // No optimization needed
  }

  const newWidth = Math.floor(width * scaleFactor);
  const newHeight = Math.floor(height * scaleFactor);

  return resizeImageData(imageData, newWidth, newHeight, preserveAspectRatio);
}

/**
 * Resize ImageData using canvas
 */
export function resizeImageData(
  imageData: ImageData,
  newWidth: number,
  newHeight: number,
  preserveAspectRatio: boolean = true
): ImageData {
  // Create temporary canvas for resizing
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Unable to create canvas context for image resizing');
  }

  // Set original dimensions
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  
  // Draw original image
  ctx.putImageData(imageData, 0, 0);
  
  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  const outputCtx = outputCanvas.getContext('2d');
  
  if (!outputCtx) {
    throw new Error('Unable to create output canvas context');
  }

  // Calculate final dimensions considering aspect ratio
  let finalWidth = newWidth;
  let finalHeight = newHeight;
  
  if (preserveAspectRatio) {
    const aspectRatio = imageData.width / imageData.height;
    const targetAspectRatio = newWidth / newHeight;
    
    if (aspectRatio > targetAspectRatio) {
      finalHeight = Math.floor(newWidth / aspectRatio);
    } else {
      finalWidth = Math.floor(newHeight * aspectRatio);
    }
  }

  outputCanvas.width = finalWidth;
  outputCanvas.height = finalHeight;
  
  // Use high-quality scaling
  outputCtx.imageSmoothingEnabled = true;
  outputCtx.imageSmoothingQuality = 'high';
  
  // Draw resized image
  outputCtx.drawImage(canvas, 0, 0, finalWidth, finalHeight);
  
  // Get resized image data
  const resizedImageData = outputCtx.getImageData(0, 0, finalWidth, finalHeight);
  
  // Cleanup
  canvas.remove();
  outputCanvas.remove();
  
  return resizedImageData;
}

/**
 * Create a downsampled version of image data for memory-efficient preview
 */
export function createImagePreview(
  imageData: ImageData,
  maxSize: number = 200
): ImageData {
  const { width, height } = imageData;
  const scaleFactor = Math.min(maxSize / width, maxSize / height);
  
  if (scaleFactor >= 1) {
    return imageData; // Already small enough
  }
  
  const previewWidth = Math.floor(width * scaleFactor);
  const previewHeight = Math.floor(height * scaleFactor);
  
  return resizeImageData(imageData, previewWidth, previewHeight, true);
}

// ========================
// Memory Cleanup
// ========================

/**
 * Clean up resources and attempt garbage collection
 */
export function cleanupMemory(options: MemoryCleanupOptions = {}): void {
  const { aggressive = false, forceGC = false } = options;

  // Clear any cached data
  if (aggressive) {
    // Clear image caches, temporary canvases, etc.
    const canvases = document.querySelectorAll('canvas[data-temporary="true"]');
    canvases.forEach(canvas => canvas.remove());
  }

  // Attempt to trigger garbage collection (only works in development/debugging)
  if (forceGC && 'gc' in window) {
    // @ts-ignore - gc is not in TypeScript types but may exist in debug environments
    window.gc();
  }
}

/**
 * Create a memory-efficient cleanup function for React components
 */
export function createMemoryCleanup() {
  const resources: (() => void)[] = [];

  const addResource = (cleanup: () => void) => {
    resources.push(cleanup);
  };

  const cleanup = () => {
    resources.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.warn('Error during resource cleanup:', error);
      }
    });
    resources.length = 0;
  };

  return { addResource, cleanup };
}

/**
 * Memory-efficient canvas utilities
 */
export class ManagedCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.setAttribute('data-temporary', 'true');
    
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to create canvas context');
    }
    this.ctx = ctx;
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose(): void {
    this.canvas.remove();
  }
}

// ========================
// Memory-Aware Processing
// ========================

/**
 * Process image with automatic memory management
 */
export async function processImageWithMemoryManagement<T>(
  imageData: ImageData,
  processor: (optimizedImage: ImageData) => Promise<T>,
  options: ImageOptimizationOptions = {}
): Promise<T> {
  const monitor = new MemoryMonitor({
    onMemoryWarning: (info) => {
      console.warn('Memory usage is high:', info.usagePercentage.toFixed(1) + '%');
    },
    onMemoryCritical: (info) => {
      console.error('Critical memory usage:', info.usagePercentage.toFixed(1) + '%');
      cleanupMemory({ aggressive: true });
    },
  });

  try {
    monitor.startMonitoring(500);
    
    // Optimize image for available memory
    const optimizedImage = await optimizeImageForMemory(imageData, options);
    
    // Process with optimized image
    const result = await processor(optimizedImage);
    
    return result;
  } finally {
    monitor.stopMonitoring();
    cleanupMemory();
  }
}

export default {
  getMemoryUsage,
  hasEnoughMemory,
  estimateImageMemoryUsage,
  MemoryMonitor,
  optimizeImageForMemory,
  resizeImageData,
  createImagePreview,
  cleanupMemory,
  createMemoryCleanup,
  ManagedCanvas,
  processImageWithMemoryManagement,
};