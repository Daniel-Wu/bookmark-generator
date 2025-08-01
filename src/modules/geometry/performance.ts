/**
 * Performance monitoring and memory management for geometry generation
 * Provides utilities for tracking performance, managing memory usage, and optimizing operations
 */

import type { GeometryMetrics } from '../../types/geometry';

// ========================
// Performance Monitoring
// ========================

export interface PerformanceProfile {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryStart: number;
  memoryPeak: number;
  memoryEnd?: number;
  operations: OperationMetric[];
}

export interface OperationMetric {
  name: string;
  duration: number;
  memoryDelta: number;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private profiles: Map<string, PerformanceProfile> = new Map();
  private currentProfile: PerformanceProfile | null = null;
  private memoryCheckInterval: number | null = null;

  /**
   * Start performance profiling for a named operation
   */
  startProfiling(name: string): void {
    if (this.currentProfile) {
      console.warn(`Starting new profile '${name}' while '${this.currentProfile.name}' is active`);
    }

    const profile: PerformanceProfile = {
      name,
      startTime: performance.now(),
      memoryStart: this.getCurrentMemoryUsage(),
      memoryPeak: this.getCurrentMemoryUsage(),
      operations: [],
    };

    this.profiles.set(name, profile);
    this.currentProfile = profile;

    // Start memory monitoring
    this.startMemoryMonitoring(profile);
  }

  /**
   * End performance profiling and return metrics
   */
  endProfiling(name: string): PerformanceProfile | null {
    const profile = this.profiles.get(name);
    if (!profile) {
      console.warn(`Profile '${name}' not found`);
      return null;
    }

    profile.endTime = performance.now();
    profile.duration = profile.endTime - profile.startTime;
    profile.memoryEnd = this.getCurrentMemoryUsage();

    this.stopMemoryMonitoring();
    this.currentProfile = null;

    return profile;
  }

  /**
   * Record an operation within the current profile
   */
  recordOperation(name: string, startTime: number, metadata?: Record<string, any>): void {
    if (!this.currentProfile) {
      console.warn(`No active profile for operation '${name}'`);
      return;
    }

    const endTime = performance.now();
    const currentMemory = this.getCurrentMemoryUsage();

    const operation: OperationMetric = {
      name,
      duration: endTime - startTime,
      memoryDelta: currentMemory - this.currentProfile.memoryStart,
      metadata,
    };

    this.currentProfile.operations.push(operation);
  }

  /**
   * Get current memory usage estimate (in bytes)
   */
  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      // @ts-ignore - TypeScript doesn't know about performance.memory
      return performance.memory.usedJSHeapSize || 0;
    }
    
    // Fallback estimation
    return 0;
  }

  /**
   * Start monitoring memory usage during operation
   */
  private startMemoryMonitoring(profile: PerformanceProfile): void {
    this.memoryCheckInterval = window.setInterval(() => {
      const currentMemory = this.getCurrentMemoryUsage();
      profile.memoryPeak = Math.max(profile.memoryPeak, currentMemory);
    }, 100); // Check every 100ms
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * Get all recorded profiles
   */
  getProfiles(): PerformanceProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get specific profile by name
   */
  getProfile(name: string): PerformanceProfile | null {
    return this.profiles.get(name) || null;
  }

  /**
   * Clear all profiles
   */
  clearProfiles(): void {
    this.profiles.clear();
    this.currentProfile = null;
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const profiles = this.getProfiles();
    
    const totalDuration = profiles.reduce((sum, p) => sum + (p.duration || 0), 0);
    const peakMemory = Math.max(...profiles.map(p => p.memoryPeak));
    const avgDuration = profiles.length > 0 ? totalDuration / profiles.length : 0;

    const bottlenecks = profiles
      .filter(p => p.duration && p.duration > avgDuration * 1.5)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));

    const memoryHogs = profiles
      .filter(p => p.memoryPeak > peakMemory * 0.8)
      .sort((a, b) => b.memoryPeak - a.memoryPeak);

    return {
      summary: {
        totalProfiles: profiles.length,
        totalDuration,
        averageDuration: avgDuration,
        peakMemoryUsage: peakMemory,
      },
      profiles,
      bottlenecks,
      memoryHogs,
      recommendations: this.generateRecommendations(profiles),
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(profiles: PerformanceProfile[]): string[] {
    const recommendations: string[] = [];
    
    const slowProfiles = profiles.filter(p => p.duration && p.duration > 5000);
    if (slowProfiles.length > 0) {
      recommendations.push('Consider optimizing slow operations: ' + 
        slowProfiles.map(p => p.name).join(', '));
    }

    const memoryIntensive = profiles.filter(p => p.memoryPeak > 100 * 1024 * 1024);
    if (memoryIntensive.length > 0) {
      recommendations.push('High memory usage detected. Consider processing in smaller chunks.');
    }

    const manyOperations = profiles.filter(p => p.operations.length > 100);
    if (manyOperations.length > 0) {
      recommendations.push('Many small operations detected. Consider batching for better performance.');
    }

    return recommendations;
  }
}

export interface PerformanceReport {
  summary: {
    totalProfiles: number;
    totalDuration: number;
    averageDuration: number;
    peakMemoryUsage: number;
  };
  profiles: PerformanceProfile[];
  bottlenecks: PerformanceProfile[];
  memoryHogs: PerformanceProfile[];
  recommendations: string[];
}

// ========================
// Memory Management
// ========================

export interface MemoryPool<T> {
  acquire(): T;
  release(item: T): void;
  clear(): void;
  size(): number;
}

/**
 * Generic object pool for memory management
 */
export class ObjectPool<T> implements MemoryPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (item: T) => void;
  private maxSize: number;

  constructor(
    createFn: () => T,
    resetFn: (item: T) => void = () => {},
    maxSize: number = 100
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(item: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(item);
      this.pool.push(item);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }

  size(): number {
    return this.pool.length;
  }
}

/**
 * Specialized pool for TypedArrays
 */
export class TypedArrayPool {
  private pools: Map<string, ObjectPool<ArrayBuffer>> = new Map();

  getFloat32Array(length: number): Float32Array {
    const key = `float32-${length}`;
    if (!this.pools.has(key)) {
      this.pools.set(key, new ObjectPool(
        () => new ArrayBuffer(length * 4),
        () => {}, // No reset needed for ArrayBuffer
        10 // Keep max 10 buffers of each size
      ));
    }
    
    const buffer = this.pools.get(key)!.acquire();
    return new Float32Array(buffer);
  }

  getUint32Array(length: number): Uint32Array {
    const key = `uint32-${length}`;
    if (!this.pools.has(key)) {
      this.pools.set(key, new ObjectPool(
        () => new ArrayBuffer(length * 4),
        () => {},
        10
      ));
    }
    
    const buffer = this.pools.get(key)!.acquire();
    return new Uint32Array(buffer);
  }

  getUint8Array(length: number): Uint8Array {
    const key = `uint8-${length}`;
    if (!this.pools.has(key)) {
      this.pools.set(key, new ObjectPool(
        () => new ArrayBuffer(length),
        () => {},
        10
      ));
    }
    
    const buffer = this.pools.get(key)!.acquire();
    return new Uint8Array(buffer);
  }

  releaseArray(array: Float32Array | Uint32Array | Uint8Array): void {
    let key: string;
    if (array instanceof Float32Array) {
      key = `float32-${array.length}`;
    } else if (array instanceof Uint32Array) {
      key = `uint32-${array.length}`;
    } else if (array instanceof Uint8Array) {
      key = `uint8-${array.length}`;
    } else {
      return; // Unknown array type
    }

    const pool = this.pools.get(key);
    if (pool) {
      pool.release(array.buffer);
    }
  }

  clearAll(): void {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
    this.pools.clear();
  }
}

// ========================
// Resource Management
// ========================

export class ResourceManager {
  private monitor: PerformanceMonitor;
  private arrayPool: TypedArrayPool;
  private cleanupTasks: (() => void)[] = [];

  constructor() {
    this.monitor = new PerformanceMonitor();
    this.arrayPool = new TypedArrayPool();
  }

  /**
   * Execute function with performance monitoring
   */
  async withProfiling<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    this.monitor.startProfiling(name);
    
    try {
      const result = await fn();
      return result;
    } finally {
      this.monitor.endProfiling(name);
    }
  }

  /**
   * Execute function with memory cleanup
   */
  async withCleanup<T>(fn: () => Promise<T> | T): Promise<T> {
    try {
      const result = await fn();
      return result;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Get optimized typed array
   */
  getFloat32Array(length: number): Float32Array {
    return this.arrayPool.getFloat32Array(length);
  }

  getUint32Array(length: number): Uint32Array {
    return this.arrayPool.getUint32Array(length);
  }

  getUint8Array(length: number): Uint8Array {
    return this.arrayPool.getUint8Array(length);
  }

  /**
   * Release typed array back to pool
   */
  releaseArray(array: Float32Array | Uint32Array | Uint8Array): void {
    this.arrayPool.releaseArray(array);
  }

  /**
   * Register cleanup task
   */
  onCleanup(task: () => void): void {
    this.cleanupTasks.push(task);
  }

  /**
   * Execute all cleanup tasks
   */
  cleanup(): void {
    for (const task of this.cleanupTasks) {
      try {
        task();
      } catch (error) {
        console.warn('Cleanup task failed:', error);
      }
    }
    this.cleanupTasks.length = 0;
    
    // Clear array pools periodically
    this.arrayPool.clearAll();
  }

  /**
   * Get performance monitor
   */
  getMonitor(): PerformanceMonitor {
    return this.monitor;
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): PerformanceReport {
    return this.monitor.generateReport();
  }

  /**
   * Force garbage collection if available
   */
  forceGC(): void {
    // @ts-ignore - gc is not standard but may be available in some environments
    if (typeof window !== 'undefined' && 'gc' in window) {
      // @ts-ignore
      window.gc();
    }
  }
}

// ========================
// Utility Functions
// ========================

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = window.setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Batch process large arrays to avoid blocking the main thread
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T, index: number) => R,
  batchSize: number = 1000,
  delay: number = 0
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    for (let j = 0; j < batch.length; j++) {
      results.push(processor(batch[j], i + j));
    }
    
    // Yield control to prevent blocking
    if (delay > 0 && i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
}

/**
 * Memory-efficient array processing with chunking
 */
export async function processInChunks<T, R>(
  array: T[],
  chunkSize: number,
  processor: (chunk: T[], startIndex: number) => Promise<R[]> | R[]
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    const chunkResults = await processor(chunk, i);
    results.push(...chunkResults);
    
    // Allow garbage collection between chunks
    if (i + chunkSize < array.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return results;
}

/**
 * Estimate memory usage of common data structures
 */
export function estimateMemoryUsage(data: any): number {
  if (data === null || data === undefined) return 0;
  
  if (typeof data === 'string') {
    return data.length * 2; // UTF-16 encoding
  }
  
  if (typeof data === 'number') {
    return 8; // 64-bit number
  }
  
  if (typeof data === 'boolean') {
    return 4; // Boolean
  }
  
  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }
  
  if (data instanceof Float32Array) {
    return data.byteLength;
  }
  
  if (data instanceof Uint32Array) {
    return data.byteLength;
  }
  
  if (data instanceof Uint8Array) {
    return data.byteLength;
  }
  
  if (Array.isArray(data)) {
    return data.reduce((sum, item) => sum + estimateMemoryUsage(item), 0) + (data.length * 8);
  }
  
  if (typeof data === 'object') {
    let size = 0;
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        size += estimateMemoryUsage(key) + estimateMemoryUsage(data[key]);
      }
    }
    return size;
  }
  
  return 0; // Unknown type
}

// ========================
// Global Resource Manager
// ========================

// Global instance for shared use
export const globalResourceManager = new ResourceManager();