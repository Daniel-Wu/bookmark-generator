/**
 * Performance Optimization System
 * 
 * Provides comprehensive performance monitoring, optimization triggers,
 * and automatic quality degradation for different device capabilities.
 */

import * as THREE from 'three';
import type { BookmarkParameters, ProcessedImage, GeometryLayer } from '../types';

// ========================
// Performance Metrics
// ========================

export interface PerformanceMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  frameRate: {
    current: number;
    average: number;
    min: number;
    target: number;
  };
  processingTime: {
    imageProcessing: number;
    geometryGeneration: number;
    rendering: number;
    export: number;
  };
  deviceCapabilities: {
    gpu: GPUCapabilities;
    memory: MemoryCapabilities;
    performance: PerformanceLevel;
  };
}

export interface GPUCapabilities {
  webglVersion: '1.0' | '2.0' | 'none';
  maxTextureSize: number;
  maxVertexAttribs: number;
  maxFragmentTextures: number;
  extensions: string[];
  renderer: string;
}

export interface MemoryCapabilities {
  deviceMemory?: number; // GB
  maxCanvasSize: number;
  estimatedAvailable: number; // MB
}

export type PerformanceLevel = 'high' | 'medium' | 'low' | 'potato';

// ========================
// Optimization Configuration
// ========================

export interface OptimizationConfig {
  memoryThresholds: {
    warning: number; // MB
    critical: number; // MB
    emergency: number; // MB
  };
  frameRateThresholds: {
    target: number; // FPS
    minimum: number; // FPS
    critical: number; // FPS
  };
  qualityLevels: {
    [K in PerformanceLevel]: QualitySettings;
  };
  automaticOptimization: boolean;
  adaptiveQuality: boolean;
}

export interface QualitySettings {
  maxImageDimension: number;
  maxVertices: number;
  textureQuality: number; // 0-1
  shadowQuality: 'off' | 'low' | 'medium' | 'high';
  antiAliasing: boolean;
  geometryOptimization: boolean;
  useWebWorkers: boolean;
  meshSimplification: number; // 0-1, 0 = no simplification
}

// ========================
// Default Configuration
// ========================

const DEFAULT_CONFIG: OptimizationConfig = {
  memoryThresholds: {
    warning: 300, // 300MB
    critical: 400, // 400MB
    emergency: 450, // 450MB
  },
  frameRateThresholds: {
    target: 30,
    minimum: 15,
    critical: 10,
  },
  qualityLevels: {
    high: {
      maxImageDimension: 2048,
      maxVertices: 100000,
      textureQuality: 1.0,
      shadowQuality: 'high',
      antiAliasing: true,
      geometryOptimization: false,
      useWebWorkers: true,
      meshSimplification: 0,
    },
    medium: {
      maxImageDimension: 1024,
      maxVertices: 50000,
      textureQuality: 0.8,
      shadowQuality: 'medium',
      antiAliasing: true,
      geometryOptimization: true,
      useWebWorkers: true,
      meshSimplification: 0.1,
    },
    low: {
      maxImageDimension: 512,
      maxVertices: 25000,
      textureQuality: 0.6,
      shadowQuality: 'low',
      antiAliasing: false,
      geometryOptimization: true,
      useWebWorkers: false,
      meshSimplification: 0.3,
    },
    potato: {
      maxImageDimension: 256,
      maxVertices: 10000,
      textureQuality: 0.4,
      shadowQuality: 'off',
      antiAliasing: false,
      geometryOptimization: true,
      useWebWorkers: false,
      meshSimplification: 0.5,
    },
  },
  automaticOptimization: true,
  adaptiveQuality: true,
};

// ========================
// Performance Optimization Class
// ========================

export class PerformanceOptimizer {
  private config: OptimizationConfig;
  private metrics: PerformanceMetrics;
  private callbacks: Map<string, Function[]> = new Map();
  private monitoringInterval?: number;
  private resourcePool: Map<string, any[]> = new Map();

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = this.initializeMetrics();
    this.startMonitoring();
  }

  // ========================
  // Initialization
  // ========================

  private initializeMetrics(): PerformanceMetrics {
    // Initialize GPU and memory capabilities first
    const gpu = this.detectGPUCapabilities();
    const memory = this.detectMemoryCapabilities();
    
    const metrics = {
      memoryUsage: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      frameRate: {
        current: 60,
        average: 60,
        min: 60,
        target: this.config.frameRateThresholds.target,
      },
      processingTime: {
        imageProcessing: 0,
        geometryGeneration: 0,
        rendering: 0,
        export: 0,
      },
      deviceCapabilities: {
        gpu,
        memory,
        performance: 'medium' as PerformanceLevel, // Default value
      },
    };
    
    // Temporarily assign metrics so detectPerformanceLevel can access them
    this.metrics = metrics;
    
    // Now update performance level with initialized capabilities
    metrics.deviceCapabilities.performance = this.detectPerformanceLevel();
    
    return metrics;
  }

  // ========================
  // Device Capability Detection
  // ========================

  private detectGPUCapabilities(): GPUCapabilities {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!gl) {
      return {
        webglVersion: 'none',
        maxTextureSize: 0,
        maxVertexAttribs: 0,
        maxFragmentTextures: 0,
        extensions: [],
        renderer: 'none',
      };
    }

    const isWebGL2 = gl instanceof WebGL2RenderingContext;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

    return {
      webglVersion: isWebGL2 ? '2.0' : '1.0',
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxFragmentTextures: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      extensions: gl.getSupportedExtensions() || [],
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
    };
  }

  private detectMemoryCapabilities(): MemoryCapabilities {
    const nav = navigator as any;
    const deviceMemory = nav.deviceMemory;
    
    // Estimate available memory based on device memory
    const estimatedAvailable = deviceMemory 
      ? Math.min(deviceMemory * 1024 * 0.3, 500) // 30% of device memory, max 500MB
      : 200; // Conservative default

    return {
      deviceMemory,
      maxCanvasSize: this.detectMaxCanvasSize(),
      estimatedAvailable,
    };
  }

  private detectMaxCanvasSize(): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 2048;

    // Binary search for max canvas size
    let min = 1024;
    let max = 8192;
    let result = min;

    while (min <= max) {
      const mid = Math.floor((min + max) / 2);
      canvas.width = canvas.height = mid;
      
      if (canvas.width === mid && canvas.height === mid) {
        result = mid;
        min = mid + 1;
      } else {
        max = mid - 1;
      }
    }

    return result;
  }

  private detectPerformanceLevel(): PerformanceLevel {
    const gpu = this.metrics.deviceCapabilities.gpu;
    const memory = this.metrics.deviceCapabilities.memory;

    // High performance criteria
    if (
      gpu.webglVersion === '2.0' &&
      gpu.maxTextureSize >= 4096 &&
      memory.estimatedAvailable >= 400
    ) {
      return 'high';
    }

    // Medium performance criteria
    if (
      gpu.webglVersion !== 'none' &&
      gpu.maxTextureSize >= 2048 &&
      memory.estimatedAvailable >= 200
    ) {
      return 'medium';
    }

    // Low performance criteria
    if (
      gpu.webglVersion !== 'none' &&
      gpu.maxTextureSize >= 1024 &&
      memory.estimatedAvailable >= 100
    ) {
      return 'low';
    }

    return 'potato';
  }

  // ========================
  // Memory Management
  // ========================

  getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
    }
    
    // Fallback estimation based on tracked resources
    return this.estimateMemoryUsage();
  }

  private estimateMemoryUsage(): number {
    let estimated = 0;
    
    // Estimate based on canvas elements
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(canvas => {
      estimated += (canvas.width * canvas.height * 4) / 1024 / 1024; // RGBA bytes to MB
    });

    return estimated;
  }

  checkMemoryThreshold(): 'safe' | 'warning' | 'critical' | 'emergency' {
    const usage = this.getCurrentMemoryUsage();
    const thresholds = this.config.memoryThresholds;

    if (usage >= thresholds.emergency) return 'emergency';
    if (usage >= thresholds.critical) return 'critical';
    if (usage >= thresholds.warning) return 'warning';
    return 'safe';
  }

  // ========================
  // Image Processing Optimization
  // ========================

  optimizeImageForProcessing(image: HTMLImageElement | ImageData): {
    optimizedImage: HTMLImageElement | ImageData;
    scaleFactor: number;
  } {
    const performanceLevel = this.metrics.deviceCapabilities.performance;
    const quality = this.config.qualityLevels[performanceLevel];
    const maxDim = quality.maxImageDimension;

    if (image instanceof HTMLImageElement) {
      const { width, height } = image;
      const currentMax = Math.max(width, height);
      
      if (currentMax <= maxDim) {
        return { optimizedImage: image, scaleFactor: 1 };
      }

      const scaleFactor = maxDim / currentMax;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      canvas.width = Math.floor(width * scaleFactor);
      canvas.height = Math.floor(height * scaleFactor);
      
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      const optimizedImage = new Image();
      optimizedImage.src = canvas.toDataURL('image/png');
      
      return { optimizedImage, scaleFactor };
    }

    // Handle ImageData
    const { width, height } = image;
    const currentMax = Math.max(width, height);
    
    if (currentMax <= maxDim) {
      return { optimizedImage: image, scaleFactor: 1 };
    }

    const scaleFactor = maxDim / currentMax;
    const newWidth = Math.floor(width * scaleFactor);
    const newHeight = Math.floor(height * scaleFactor);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    // Create temporary canvas with original image
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.putImageData(image, 0, 0);
    
    // Scale down
    ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
    
    return {
      optimizedImage: ctx.getImageData(0, 0, newWidth, newHeight),
      scaleFactor,
    };
  }

  // ========================
  // Geometry Optimization
  // ========================

  optimizeGeometry(layers: GeometryLayer[]): GeometryLayer[] {
    const performanceLevel = this.metrics.deviceCapabilities.performance;
    const quality = this.config.qualityLevels[performanceLevel];

    if (!quality.geometryOptimization) {
      return layers;
    }

    return layers.map(layer => ({
      ...layer,
      geometry: this.simplifyGeometry(layer.geometry, quality.meshSimplification),
    }));
  }

  private simplifyGeometry(geometry: THREE.BufferGeometry, simplificationLevel: number): THREE.BufferGeometry {
    if (simplificationLevel === 0) {
      return geometry;
    }

    // Simple vertex reduction - remove every nth vertex based on simplification level
    const positions = geometry.getAttribute('position');
    const indices = geometry.getIndex();

    if (!positions || !indices) {
      return geometry;
    }

    const vertexCount = positions.count;
    const targetCount = Math.floor(vertexCount * (1 - simplificationLevel));
    
    if (targetCount >= vertexCount) {
      return geometry;
    }

    // Create simplified geometry
    const simplifiedGeometry = new THREE.BufferGeometry();
    const step = Math.floor(vertexCount / targetCount);
    
    const newPositions: number[] = [];
    const newIndices: number[] = [];
    
    for (let i = 0; i < vertexCount; i += step) {
      newPositions.push(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
    }
    
    // Rebuild indices
    for (let i = 0; i < newPositions.length / 3 - 2; i += 3) {
      newIndices.push(i, i + 1, i + 2);
    }
    
    simplifiedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    simplifiedGeometry.setIndex(newIndices);
    simplifiedGeometry.computeVertexNormals();
    
    return simplifiedGeometry;
  }

  // ========================
  // Rendering Optimization
  // ========================

  optimizeRenderingSettings(): {
    antialias: boolean;
    powerPreference: 'default' | 'high-performance' | 'low-power';
    pixelRatio: number;
    shadowMapEnabled: boolean;
    shadowMapType: THREE.ShadowMapType;
  } {
    const performanceLevel = this.metrics.deviceCapabilities.performance;
    const quality = this.config.qualityLevels[performanceLevel];
    const memoryStatus = this.checkMemoryThreshold();

    return {
      antialias: quality.antiAliasing && memoryStatus === 'safe',
      powerPreference: performanceLevel === 'high' ? 'high-performance' : 'low-power',
      pixelRatio: Math.min(window.devicePixelRatio, performanceLevel === 'high' ? 2 : 1),
      shadowMapEnabled: quality.shadowQuality !== 'off',
      shadowMapType: this.getShadowMapType(quality.shadowQuality),
    };
  }

  private getShadowMapType(quality: QualitySettings['shadowQuality']): THREE.ShadowMapType {
    switch (quality) {
      case 'high':
        return THREE.PCFSoftShadowMap;
      case 'medium':
        return THREE.PCFShadowMap;
      case 'low':
        return THREE.BasicShadowMap;
      default:
        return THREE.BasicShadowMap;
    }
  }

  // ========================
  // Resource Pool Management
  // ========================

  getFromPool<T>(type: string, factory: () => T): T {
    const pool = this.resourcePool.get(type) || [];
    if (pool.length > 0) {
      return pool.pop() as T;
    }
    return factory();
  }

  returnToPool<T>(type: string, resource: T): void {
    const pool = this.resourcePool.get(type) || [];
    pool.push(resource);
    this.resourcePool.set(type, pool);
    
    // Limit pool size to prevent memory leaks
    if (pool.length > 10) {
      pool.splice(0, pool.length - 10);
    }
  }

  clearPool(type?: string): void {
    if (type) {
      this.resourcePool.delete(type);
    } else {
      this.resourcePool.clear();
    }
  }

  // ========================
  // Performance Monitoring
  // ========================

  private startMonitoring(): void {
    this.monitoringInterval = window.setInterval(() => {
      this.updateMetrics();
      this.checkOptimizationTriggers();
    }, 1000);
  }

  private updateMetrics(): void {
    const memoryUsage = this.getCurrentMemoryUsage();
    this.metrics.memoryUsage = {
      used: memoryUsage,
      total: this.metrics.deviceCapabilities.memory.estimatedAvailable,
      percentage: (memoryUsage / this.metrics.deviceCapabilities.memory.estimatedAvailable) * 100,
    };

    // Update frame rate if available
    if ('performance' in window && 'now' in performance) {
      // Frame rate monitoring would be implemented with requestAnimationFrame
      // This is a simplified version
    }
  }

  private checkOptimizationTriggers(): void {
    if (!this.config.automaticOptimization) return;

    const memoryStatus = this.checkMemoryThreshold();
    const frameRate = this.metrics.frameRate.current;

    // Trigger optimization if memory or frame rate issues
    if (
      memoryStatus !== 'safe' ||
      frameRate < this.config.frameRateThresholds.minimum
    ) {
      this.triggerOptimization(memoryStatus, frameRate);
    }
  }

  private triggerOptimization(memoryStatus: string, frameRate: number): void {
    this.emit('optimization-triggered', {
      reason: memoryStatus !== 'safe' ? 'memory' : 'performance',
      memoryStatus,
      frameRate,
      recommendations: this.generateOptimizationRecommendations(),
    });
  }

  private generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const memoryStatus = this.checkMemoryThreshold();
    const performanceLevel = this.metrics.deviceCapabilities.performance;

    if (memoryStatus !== 'safe') {
      recommendations.push('Reduce image dimensions');
      recommendations.push('Lower geometry complexity');
      recommendations.push('Disable antialiasing');
    }

    if (this.metrics.frameRate.current < this.config.frameRateThresholds.target) {
      recommendations.push('Reduce shadow quality');
      recommendations.push('Enable mesh optimization');
      recommendations.push('Lower texture quality');
    }

    if (performanceLevel === 'low' || performanceLevel === 'potato') {
      recommendations.push('Use simplified rendering mode');
      recommendations.push('Disable real-time preview updates');
    }

    return recommendations;
  }

  // ========================
  // Event System
  // ========================

  on(event: string, callback: Function): void {
    const callbacks = this.callbacks.get(event) || [];
    callbacks.push(callback);
    this.callbacks.set(event, callbacks);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.callbacks.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.callbacks.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  public emitPerformanceMeasured(name: string, duration: number): void {
    this.emit('performance-measured', { name, duration });
  }

  // ========================
  // Public API
  // ========================

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getRecommendedQuality(): PerformanceLevel {
    const memoryStatus = this.checkMemoryThreshold();
    const currentLevel = this.metrics.deviceCapabilities.performance;

    // Downgrade if memory issues
    if (memoryStatus === 'emergency') return 'potato';
    if (memoryStatus === 'critical') return 'low';
    if (memoryStatus === 'warning' && currentLevel === 'high') return 'medium';

    return currentLevel;
  }

  adjustQualityForDevice(parameters: BookmarkParameters): BookmarkParameters {
    const quality = this.getRecommendedQuality();
    const settings = this.config.qualityLevels[quality];

    // Don't modify the original parameters
    const adjusted = { ...parameters };

    // Adjust based on quality level
    if (quality === 'low' || quality === 'potato') {
      adjusted.width = Math.min(adjusted.width, 100);
      adjusted.height = Math.min(adjusted.height, 150);
    }

    return adjusted;
  }

  dispose(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.clearPool();
    this.callbacks.clear();
  }
}

// ========================
// Singleton Instance
// ========================

export const performanceOptimizer = new PerformanceOptimizer();

// ========================
// Utility Functions
// ========================

export function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const start = performance.now();
  
  const result = fn();
  
  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = performance.now() - start;
      performanceOptimizer.emitPerformanceMeasured(name, duration);
    });
  } else {
    const duration = performance.now() - start;
    performanceOptimizer.emitPerformanceMeasured(name, duration);
    return result;
  }
}

export function throttleByPerformance<T extends (...args: any[]) => any>(
  fn: T,
  baseDelay: number = 100
): T {
  let lastCall = 0;
  
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const performanceLevel = performanceOptimizer.getMetrics().deviceCapabilities.performance;
    
    // Adjust delay based on performance level
    const delay = baseDelay * (performanceLevel === 'high' ? 0.5 : performanceLevel === 'medium' ? 1 : 2);
    
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn(...args);
    }
  }) as T;
}

export function isFeatureSupported(feature: string): boolean {
  const gpu = performanceOptimizer.getMetrics().deviceCapabilities.gpu;
  
  switch (feature) {
    case 'webgl2':
      return gpu.webglVersion === '2.0';
    case 'webgl':
      return gpu.webglVersion !== 'none';
    case 'instancing':
      return gpu.extensions.includes('ANGLE_instanced_arrays');
    case 'float_textures':
      return gpu.extensions.includes('OES_texture_float');
    default:
      return false;
  }
}