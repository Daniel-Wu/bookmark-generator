/**
 * Canvas performance optimization utilities
 */

export interface CanvasPool {
  getCanvas(width: number, height: number): HTMLCanvasElement;
  releaseCanvas(canvas: HTMLCanvasElement): void;
  clear(): void;
}

/**
 * Canvas pool to reuse canvas elements and reduce memory allocation
 */
class CanvasPoolImpl implements CanvasPool {
  private pool: HTMLCanvasElement[] = [];
  private maxPoolSize = 10;

  getCanvas(width: number, height: number): HTMLCanvasElement {
    // Try to reuse existing canvas
    const reusableCanvas = this.pool.find(canvas => 
      canvas.width >= width && 
      canvas.height >= height &&
      canvas.width <= width * 1.5 && // Don't reuse if significantly larger
      canvas.height <= height * 1.5
    );

    if (reusableCanvas) {
      this.pool = this.pool.filter(c => c !== reusableCanvas);
      reusableCanvas.width = width;
      reusableCanvas.height = height;
      const ctx = reusableCanvas.getContext('2d');
      ctx?.clearRect(0, 0, width, height);
      return reusableCanvas;
    }

    // Create new canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  releaseCanvas(canvas: HTMLCanvasElement): void {
    if (this.pool.length < this.maxPoolSize) {
      // Clear the canvas before returning to pool
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      this.pool.push(canvas);
    }
  }

  clear(): void {
    this.pool = [];
  }
}

// Global canvas pool instance
export const canvasPool = new CanvasPoolImpl();

/**
 * Debounced animation frame utility
 */
export class AnimationFrameDebouncer {
  private frameId: number | null = null;
  private callback: (() => void) | null = null;

  schedule(callback: () => void): void {
    this.callback = callback;
    
    if (this.frameId === null) {
      this.frameId = requestAnimationFrame(() => {
        this.frameId = null;
        if (this.callback) {
          this.callback();
          this.callback = null;
        }
      });
    }
  }

  cancel(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
      this.callback = null;
    }
  }
}

/**
 * Throttled function executor
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Optimized image drawing with caching
 */
export class ImageRenderer {
  private imageCache = new Map<string, HTMLCanvasElement>();
  private maxCacheSize = 5;

  /**
   * Draw image with optional transformations, using cache when possible
   */
  drawImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    options: {
      sx?: number;
      sy?: number;
      sw?: number;
      sh?: number;
      dx: number;
      dy: number;
      dw: number;
      dh: number;
      rotation?: number;
      scale?: number;
      cacheKey?: string;
    }
  ): void {
    const {
      sx = 0,
      sy = 0,
      sw = image.naturalWidth,
      sh = image.naturalHeight,
      dx,
      dy,
      dw,
      dh,
      rotation = 0,
      scale = 1,
      cacheKey
    } = options;

    // Use cache if available and no transformations
    if (cacheKey && rotation === 0 && scale === 1) {
      let cachedCanvas = this.imageCache.get(cacheKey);
      
      if (!cachedCanvas) {
        // Create cached version
        cachedCanvas = canvasPool.getCanvas(sw, sh);
        const cacheCtx = cachedCanvas.getContext('2d');
        if (cacheCtx) {
          cacheCtx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
          
          // Manage cache size
          if (this.imageCache.size >= this.maxCacheSize) {
            const firstKey = this.imageCache.keys().next().value;
            const oldCanvas = this.imageCache.get(firstKey!);
            if (oldCanvas) {
              canvasPool.releaseCanvas(oldCanvas);
              this.imageCache.delete(firstKey!);
            }
          }
          
          this.imageCache.set(cacheKey, cachedCanvas);
        }
      }

      if (cachedCanvas) {
        ctx.drawImage(cachedCanvas, dx, dy, dw, dh);
        return;
      }
    }

    // Draw with transformations
    ctx.save();
    
    if (rotation !== 0 || scale !== 1) {
      const centerX = dx + dw / 2;
      const centerY = dy + dh / 2;
      
      ctx.translate(centerX, centerY);
      
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      
      if (scale !== 1) {
        ctx.scale(scale, scale);
      }
      
      ctx.translate(-dw / 2, -dh / 2);
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
    } else {
      ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    
    ctx.restore();
  }

  /**
   * Clear the image cache
   */
  clearCache(): void {
    for (const canvas of this.imageCache.values()) {
      canvasPool.releaseCanvas(canvas);
    }
    this.imageCache.clear();
  }
}

/**
 * Memory monitoring utilities
 */
export class CanvasMemoryMonitor {
  private lastCheck = 0;
  private checkInterval = 5000; // 5 seconds

  /**
   * Check current memory usage (if available)
   */
  checkMemoryUsage(): number | null {
    const now = Date.now();
    if (now - this.lastCheck < this.checkInterval) {
      return null; // Don't check too frequently
    }
    
    this.lastCheck = now;

    // Use performance.memory if available (Chromium browsers)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize;
    }

    return null;
  }

  /**
   * Trigger garbage collection if available
   */
  triggerGC(): void {
    // Force garbage collection in development (Chrome DevTools)
    if (process.env.NODE_ENV === 'development' && (window as any).gc) {
      (window as any).gc();
    }
  }

  /**
   * Check if memory usage is high
   */
  isMemoryHigh(): boolean {
    const usage = this.checkMemoryUsage();
    if (usage === null) return false;
    
    return usage > 500 * 1024 * 1024; // 500MB threshold
  }
}

/**
 * Performance metrics collector
 */
export class PerformanceCollector {
  private metrics = new Map<string, number[]>();

  /**
   * Start timing an operation
   */
  startTiming(key: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.addMetric(key, duration);
    };
  }

  /**
   * Add a metric value
   */
  addMetric(key: string, value: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const values = this.metrics.get(key)!;
    values.push(value);
    
    // Keep only recent values
    if (values.length > 100) {
      values.shift();
    }
  }

  /**
   * Get average for a metric
   */
  getAverage(key: string): number {
    const values = this.metrics.get(key);
    if (!values || values.length === 0) return 0;
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Get all metrics summary
   */
  getSummary(): Record<string, { average: number; count: number; latest: number }> {
    const summary: Record<string, { average: number; count: number; latest: number }> = {};
    
    for (const [key, values] of this.metrics) {
      if (values.length > 0) {
        summary[key] = {
          average: this.getAverage(key),
          count: values.length,
          latest: values[values.length - 1],
        };
      }
    }
    
    return summary;
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics.clear();
  }
}

// Global instances
export const imageRenderer = new ImageRenderer();
export const memoryMonitor = new CanvasMemoryMonitor();
export const performanceCollector = new PerformanceCollector();

/**
 * Utility to optimize canvas operations
 */
export function optimizeCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Enable image smoothing for better quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Set crisp rendering for pixel art
  canvas.style.imageRendering = 'crisp-edges';
}

/**
 * Resize image to fit within bounds while maintaining aspect ratio
 */
export function calculateOptimalSize(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number; scale: number } {
  const aspectRatio = originalWidth / originalHeight;
  
  let width = originalWidth;
  let height = originalHeight;
  
  // Scale down if larger than max dimensions
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }
  
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  const scale = width / originalWidth;
  
  return { width, height, scale };
}

/**
 * Cleanup function to free resources
 */
export function cleanup(): void {
  canvasPool.clear();
  imageRenderer.clearCache();
  performanceCollector.clear();
  memoryMonitor.triggerGC();
}