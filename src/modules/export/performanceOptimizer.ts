/**
 * Performance optimization utilities for large file exports
 * Handles memory management, chunking, and background processing
 */

import * as THREE from 'three';
import type { BookmarkGeometry } from '../../types';

export interface PerformanceMetrics {
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
  timing: {
    preparation: number;
    processing: number;
    export: number;
    total: number;
  };
  throughput: {
    verticesPerSecond: number;
    facesPerSecond: number;
    bytesPerSecond: number;
  };
}

export interface OptimizationSettings {
  chunkSize: number;
  memoryLimit: number; // in bytes
  useWebWorkers: boolean;
  enableStreaming: boolean;
  compressionLevel: number;
  batchSize: number;
}

/**
 * Performance optimizer for export operations
 */
export class ExportPerformanceOptimizer {
  private settings: OptimizationSettings;
  private metrics: PerformanceMetrics;
  private abortController: AbortController | null = null;

  constructor(settings: Partial<OptimizationSettings> = {}) {
    this.settings = {
      chunkSize: 64 * 1024, // 64KB chunks
      memoryLimit: 512 * 1024 * 1024, // 512MB
      useWebWorkers: this.detectWebWorkerSupport(),
      enableStreaming: this.detectStreamingSupport(),
      compressionLevel: 6,
      batchSize: 1000,
      ...settings,
    };

    this.metrics = this.initializeMetrics();
  }

  /**
   * Optimize export process based on geometry complexity
   */
  async optimizeExport<T>(
    geometry: BookmarkGeometry,
    exportFunction: (optimizedGeometry: BookmarkGeometry, settings: OptimizationSettings) => Promise<T>,
    progressCallback?: (progress: number) => void
  ): Promise<T> {
    this.abortController = new AbortController();
    const startTime = Date.now();

    try {
      // Record initial memory
      this.recordMemoryUsage('initial');

      // Analyze geometry complexity
      const complexity = this.analyzeComplexity(geometry);
      
      // Adjust settings based on complexity
      this.adjustSettings(complexity);

      // Pre-process geometry for optimization
      progressCallback?.(0.1);
      const optimizedGeometry = await this.preprocessGeometry(geometry);

      // Check memory usage after preprocessing
      this.recordMemoryUsage('peak');

      // Execute export with optimizations
      progressCallback?.(0.2);
      const result = await this.executeOptimizedExport(
        optimizedGeometry,
        exportFunction,
        (progress) => progressCallback?.(0.2 + progress * 0.7)
      );

      // Finalize and cleanup
      progressCallback?.(0.9);
      await this.cleanup();

      // Record final metrics
      this.recordMemoryUsage('final');
      this.metrics.timing.total = Date.now() - startTime;
      this.calculateThroughput(geometry);

      progressCallback?.(1.0);
      return result;

    } catch (error) {
      await this.cleanup();
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Analyze geometry complexity
   */
  private analyzeComplexity(geometry: BookmarkGeometry): {
    level: 'low' | 'medium' | 'high' | 'extreme';
    vertexCount: number;
    faceCount: number;
    layerCount: number;
    memoryEstimate: number;
  } {
    const vertexCount = geometry.vertexCount;
    const faceCount = geometry.faceCount;
    const layerCount = geometry.layers.length;

    // Estimate memory usage
    const memoryEstimate = this.estimateMemoryUsage(vertexCount, faceCount, layerCount);

    // Determine complexity level
    let level: 'low' | 'medium' | 'high' | 'extreme' = 'low';
    
    if (vertexCount > 100000 || faceCount > 200000 || memoryEstimate > 200 * 1024 * 1024) {
      level = 'extreme';
    } else if (vertexCount > 50000 || faceCount > 100000 || memoryEstimate > 100 * 1024 * 1024) {
      level = 'high';
    } else if (vertexCount > 10000 || faceCount > 20000 || memoryEstimate > 50 * 1024 * 1024) {
      level = 'medium';
    }

    return {
      level,
      vertexCount,
      faceCount,
      layerCount,
      memoryEstimate,
    };
  }

  /**
   * Adjust optimization settings based on complexity
   */
  private adjustSettings(complexity: ReturnType<typeof this.analyzeComplexity>): void {
    switch (complexity.level) {
      case 'extreme':
        this.settings.chunkSize = 32 * 1024; // Smaller chunks
        this.settings.batchSize = 500;
        this.settings.compressionLevel = 9; // Maximum compression
        this.settings.useWebWorkers = true;
        this.settings.enableStreaming = true;
        break;

      case 'high':
        this.settings.chunkSize = 48 * 1024;
        this.settings.batchSize = 750;
        this.settings.compressionLevel = 7;
        this.settings.useWebWorkers = true;
        break;

      case 'medium':
        this.settings.chunkSize = 64 * 1024;
        this.settings.batchSize = 1000;
        this.settings.compressionLevel = 6;
        break;

      case 'low':
        // Use default settings
        break;
    }

    // Adjust memory limit based on available memory
    const availableMemory = this.getAvailableMemory();
    if (availableMemory < this.settings.memoryLimit) {
      this.settings.memoryLimit = Math.max(availableMemory * 0.7, 128 * 1024 * 1024);
    }
  }

  /**
   * Preprocess geometry for optimization
   */
  private async preprocessGeometry(geometry: BookmarkGeometry): Promise<BookmarkGeometry> {
    const startTime = Date.now();

    // Create optimized copy
    const optimized: BookmarkGeometry = {
      ...geometry,
      layers: [],
    };

    // Process layers in batches to avoid memory issues
    for (let i = 0; i < geometry.layers.length; i += this.settings.batchSize) {
      if (this.abortController?.signal.aborted) {
        throw new Error('Export cancelled');
      }

      const batch = geometry.layers.slice(i, i + this.settings.batchSize);
      const optimizedBatch = await this.optimizeLayerBatch(batch);
      optimized.layers.push(...optimizedBatch);

      // Yield control to prevent blocking
      await this.yieldControl();
    }

    this.metrics.timing.preparation = Date.now() - startTime;
    return optimized;
  }

  /**
   * Optimize a batch of layers
   */
  private async optimizeLayerBatch(layers: BookmarkGeometry['layers']): Promise<BookmarkGeometry['layers']> {
    return layers.map(layer => {
      // Clone the layer with optimizations
      const optimizedGeometry = layer.geometry.clone();
      
      // TODO: Re-implement vertex merging with proper Three.js utilities
      // const mergedGeometry = mergeVertices(optimizedGeometry);
      // optimizedGeometry.copy(mergedGeometry);
      
      // Compute vertex normals if missing
      if (!optimizedGeometry.attributes.normal) {
        optimizedGeometry.computeVertexNormals();
      }

      // Optimize for rendering
      optimizedGeometry.computeBoundingBox();
      optimizedGeometry.computeBoundingSphere();

      return {
        ...layer,
        geometry: optimizedGeometry,
      };
    });
  }

  /**
   * Execute optimized export
   */
  private async executeOptimizedExport<T>(
    geometry: BookmarkGeometry,
    exportFunction: (geometry: BookmarkGeometry, settings: OptimizationSettings) => Promise<T>,
    progressCallback?: (progress: number) => void
  ): Promise<T> {
    const startTime = Date.now();

    try {
      let result: T;

      if (this.settings.useWebWorkers && this.detectWebWorkerSupport()) {
        // Use web worker for heavy processing
        result = await this.executeInWebWorker(geometry, exportFunction, progressCallback);
      } else {
        // Execute in main thread with yielding
        result = await this.executeWithYielding(geometry, exportFunction, progressCallback);
      }

      this.metrics.timing.export = Date.now() - startTime;
      return result;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute export in web worker
   */
  private async executeInWebWorker<T>(
    geometry: BookmarkGeometry,
    exportFunction: (geometry: BookmarkGeometry, settings: OptimizationSettings) => Promise<T>,
    progressCallback?: (progress: number) => void
  ): Promise<T> {
    // For now, fall back to main thread execution
    // In a full implementation, you would:
    // 1. Create a web worker
    // 2. Transfer geometry data
    // 3. Execute export function in worker
    // 4. Transfer result back
    return this.executeWithYielding(geometry, exportFunction, progressCallback);
  }

  /**
   * Execute export with periodic yielding to prevent blocking
   */
  private async executeWithYielding<T>(
    geometry: BookmarkGeometry,
    exportFunction: (geometry: BookmarkGeometry, settings: OptimizationSettings) => Promise<T>,
    progressCallback?: (progress: number) => void
  ): Promise<T> {
    // Execute export function with settings
    const result = await exportFunction(geometry, this.settings);
    
    // Simulate progress updates for now
    if (progressCallback) {
      for (let i = 0; i <= 100; i += 10) {
        if (this.abortController?.signal.aborted) {
          throw new Error('Export cancelled');
        }
        progressCallback(i / 100);
        await this.yieldControl();
      }
    }

    return result;
  }

  /**
   * Yield control to prevent blocking the UI
   */
  private async yieldControl(): Promise<void> {
    return new Promise(resolve => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }

    // Clear any large arrays or objects
    // This would be implementation-specific
  }

  /**
   * Cancel ongoing optimization
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Utility methods
   */
  private detectWebWorkerSupport(): boolean {
    return typeof Worker !== 'undefined';
  }

  private detectStreamingSupport(): boolean {
    return typeof ReadableStream !== 'undefined' && typeof WritableStream !== 'undefined';
  }

  private getAvailableMemory(): number {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      return memInfo.jsHeapSizeLimit - memInfo.usedJSHeapSize;
    }
    // Fallback estimate
    return 1024 * 1024 * 1024; // 1GB
  }

  private estimateMemoryUsage(vertexCount: number, faceCount: number, layerCount: number): number {
    // Rough estimates in bytes
    const vertexMemory = vertexCount * 12 * 4; // 3 floats * 4 bytes per vertex
    const faceMemory = faceCount * 3 * 4; // 3 indices * 4 bytes per face
    const layerOverhead = layerCount * 1024; // 1KB overhead per layer
    const processingOverhead = (vertexMemory + faceMemory) * 2; // Processing overhead

    return vertexMemory + faceMemory + layerOverhead + processingOverhead;
  }

  private recordMemoryUsage(stage: 'initial' | 'peak' | 'final'): void {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.metrics.memoryUsage[stage] = memInfo.usedJSHeapSize;
    }
  }

  private calculateThroughput(geometry: BookmarkGeometry): void {
    const totalTime = this.metrics.timing.total / 1000; // Convert to seconds
    
    if (totalTime > 0) {
      this.metrics.throughput = {
        verticesPerSecond: geometry.vertexCount / totalTime,
        facesPerSecond: geometry.faceCount / totalTime,
        bytesPerSecond: this.estimateMemoryUsage(geometry.vertexCount, geometry.faceCount, geometry.layers.length) / totalTime,
      };
    }
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      memoryUsage: {
        initial: 0,
        peak: 0,
        final: 0,
      },
      timing: {
        preparation: 0,
        processing: 0,
        export: 0,
        total: 0,
      },
      throughput: {
        verticesPerSecond: 0,
        facesPerSecond: 0,
        bytesPerSecond: 0,
      },
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get optimization settings
   */
  getSettings(): OptimizationSettings {
    return { ...this.settings };
  }

  /**
   * Update optimization settings
   */
  updateSettings(settings: Partial<OptimizationSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
}

/**
 * Memory management utilities
 */
export class MemoryManager {
  private static readonly MEMORY_CHECK_INTERVAL = 1000; // 1 second
  private static monitoringInterval: number | null = null;
  private static memoryWarningThreshold = 0.8; // 80% of limit
  private static memoryErrorThreshold = 0.95; // 95% of limit

  /**
   * Start monitoring memory usage
   */
  static startMonitoring(
    onWarning?: (usage: number, limit: number) => void,
    onError?: (usage: number, limit: number) => void
  ): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = window.setInterval(() => {
      const usage = this.getCurrentMemoryUsage();
      const limit = this.getMemoryLimit();

      if (usage > limit * this.memoryErrorThreshold) {
        onError?.(usage, limit);
      } else if (usage > limit * this.memoryWarningThreshold) {
        onWarning?.(usage, limit);
      }
    }, this.MEMORY_CHECK_INTERVAL);
  }

  /**
   * Stop monitoring memory usage
   */
  static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get current memory usage
   */
  static getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      return memInfo.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Get memory limit
   */
  static getMemoryLimit(): number {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      return memInfo.jsHeapSizeLimit;
    }
    // Fallback estimate for browsers without memory API
    return 2 * 1024 * 1024 * 1024; // 2GB
  }

  /**
   * Get memory usage percentage
   */
  static getMemoryUsagePercentage(): number {
    const usage = this.getCurrentMemoryUsage();
    const limit = this.getMemoryLimit();
    return limit > 0 ? (usage / limit) * 100 : 0;
  }

  /**
   * Force garbage collection
   */
  static forceGarbageCollection(): void {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  /**
   * Check if memory is available for operation
   */
  static isMemoryAvailable(requiredBytes: number): boolean {
    const usage = this.getCurrentMemoryUsage();
    const limit = this.getMemoryLimit();
    const available = limit - usage;
    return available > requiredBytes * 1.2; // 20% safety margin
  }

  /**
   * Get memory statistics
   */
  static getMemoryStats(): {
    used: number;
    limit: number;
    available: number;
    percentage: number;
    canGC: boolean;
  } {
    const used = this.getCurrentMemoryUsage();
    const limit = this.getMemoryLimit();
    const available = limit - used;
    const percentage = this.getMemoryUsagePercentage();
    const canGC = 'gc' in window && typeof (window as any).gc === 'function';

    return {
      used,
      limit,
      available,
      percentage,
      canGC,
    };
  }
}

/**
 * Chunked processing utilities
 */
export class ChunkedProcessor {
  /**
   * Process large array in chunks to prevent blocking
   */
  static async processInChunks<T, R>(
    items: T[],
    processor: (item: T, index: number) => R | Promise<R>,
    options: {
      chunkSize?: number;
      onProgress?: (progress: number) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<R[]> {
    const { chunkSize = 1000, onProgress, signal } = options;
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
      // Check for cancellation
      if (signal?.aborted) {
        throw new Error('Processing cancelled');
      }

      // Process chunk
      const chunk = items.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map((item, chunkIndex) => processor(item, i + chunkIndex))
      );
      
      results.push(...chunkResults);

      // Report progress
      if (onProgress) {
        const progress = Math.min((i + chunkSize) / items.length, 1);
        onProgress(progress);
      }

      // Yield control to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return results;
  }

  /**
   * Process data stream in chunks
   */
  static async processStream<T>(
    stream: ReadableStream<T>,
    processor: (chunk: T) => void | Promise<void>,
    options: {
      onProgress?: (bytesProcessed: number) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<void> {
    const { onProgress, signal } = options;
    const reader = stream.getReader();
    let bytesProcessed = 0;

    try {
      while (true) {
        // Check for cancellation
        if (signal?.aborted) {
          throw new Error('Stream processing cancelled');
        }

        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        await processor(value);
        
        // Estimate bytes processed (rough)
        bytesProcessed += JSON.stringify(value).length;
        onProgress?.(bytesProcessed);

        // Yield control
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally {
      reader.releaseLock();
    }
  }
}