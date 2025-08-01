/**
 * Comprehensive Performance Monitoring System
 * 
 * Tracks Core Web Vitals, custom metrics, FPS, memory usage,
 * and provides performance regression detection.
 */

import { throttle, debounce } from 'lodash-es';

// Core Web Vitals types
interface CoreWebVitals {
  CLS: number | null; // Cumulative Layout Shift
  FID: number | null; // First Input Delay
  FCP: number | null; // First Contentful Paint
  LCP: number | null; // Largest Contentful Paint
  TTFB: number | null; // Time to First Byte
}

// Custom performance metrics for bookmark generator
interface CustomMetrics {
  imageProcessingTime: number | null;
  geometryGenerationTime: number | null;
  exportOperationTime: number | null;
  colorQuantizationTime: number | null;
  meshOptimizationTime: number | null;
  renderingTime: number | null;
}

// Memory usage tracking
interface MemoryUsage {
  used: number;
  total: number;
  timestamp: number;
  heapUsed?: number;
  heapTotal?: number;
}

// FPS monitoring data
interface FPSMetrics {
  current: number;
  average: number;
  min: number;
  max: number;
  samples: number[];
  lastUpdate: number;
}

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  CLS: 0.1,
  FID: 100,
  FCP: 1800,
  LCP: 2500,
  TTFB: 800,
  imageProcessing: 5000, // 5 seconds max
  geometryGeneration: 5000,
  exportOperation: 10000,
  targetFPS: 30,
  memoryWarning: 400 * 1024 * 1024, // 400MB
  memoryCritical: 500 * 1024 * 1024, // 500MB
} as const;

// Performance alert levels
export const AlertLevel = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;

export type AlertLevel = typeof AlertLevel[keyof typeof AlertLevel];

interface PerformanceAlert {
  level: AlertLevel;
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
}

type PerformanceListener = (alert: PerformanceAlert) => void;

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  
  private coreWebVitals: CoreWebVitals = {
    CLS: null,
    FID: null,
    FCP: null,
    LCP: null,
    TTFB: null,
  };
  
  private customMetrics: CustomMetrics = {
    imageProcessingTime: null,
    geometryGenerationTime: null,
    exportOperationTime: null,
    colorQuantizationTime: null,
    meshOptimizationTime: null,
    renderingTime: null,
  };
  
  private memoryUsage: MemoryUsage[] = [];
  private fpsMetrics: FPSMetrics = {
    current: 0,
    average: 0,
    min: Infinity,
    max: 0,
    samples: [],
    lastUpdate: 0,
  };
  
  private listeners: PerformanceListener[] = [];
  private isMonitoring = false;
  private frameId: number | null = null;
  private memoryCheckInterval: number | null = null;
  
  // Performance baselines for regression detection
  private baselines: Map<string, number> = new Map();
  
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  constructor() {
    this.initializeCoreWebVitals();
    this.throttledMemoryCheck = throttle(this.checkMemoryUsage.bind(this), 1000);
    this.debouncedAlert = debounce(this.emitAlert.bind(this), 100);
  }
  
  private throttledMemoryCheck: () => void;
  private debouncedAlert: (alert: PerformanceAlert) => void;
  
  /**
   * Initialize Core Web Vitals monitoring
   */
  private initializeCoreWebVitals(): void {
    // First Contentful Paint (FCP)
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
              this.coreWebVitals.FCP = entry.startTime;
              this.checkThreshold('FCP', entry.startTime, PERFORMANCE_THRESHOLDS.FCP);
            }
          });
        });
        observer.observe({ entryTypes: ['paint'] });
      } catch (error) {
        console.warn('FCP monitoring not supported:', error);
      }
      
      // Largest Contentful Paint (LCP)
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.coreWebVitals.LCP = lastEntry.startTime;
          this.checkThreshold('LCP', lastEntry.startTime, PERFORMANCE_THRESHOLDS.LCP);
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        console.warn('LCP monitoring not supported:', error);
      }
      
      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          this.coreWebVitals.CLS = clsValue;
          this.checkThreshold('CLS', clsValue, PERFORMANCE_THRESHOLDS.CLS);
        });
        observer.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        console.warn('CLS monitoring not supported:', error);
      }
      
      // First Input Delay (FID)
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.coreWebVitals.FID = (entry as any).processingStart - entry.startTime;
            this.checkThreshold('FID', this.coreWebVitals.FID, PERFORMANCE_THRESHOLDS.FID);
          }
        });
        observer.observe({ entryTypes: ['first-input'] });
      } catch (error) {
        console.warn('FID monitoring not supported:', error);
      }
    }
    
    // Time to First Byte (TTFB)
    if ('performance' in window && 'timing' in performance) {
      const timing = performance.timing as any;
      const ttfb = timing.responseStart - timing.navigationStart;
      this.coreWebVitals.TTFB = ttfb;
      this.checkThreshold('TTFB', ttfb, PERFORMANCE_THRESHOLDS.TTFB);
    }
  }
  
  /**
   * Start comprehensive performance monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startFPSMonitoring();
    this.startMemoryMonitoring();
  }
  
  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
    
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    
    if (this.memoryCheckInterval !== null) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }
  
  /**
   * Start FPS monitoring using requestAnimationFrame
   */
  private startFPSMonitoring(): void {
    let lastTime = performance.now();
    let frameCount = 0;
    const sampleWindow = 60; // Track last 60 frames
    
    const measureFPS = (currentTime: number) => {
      if (!this.isMonitoring) return;
      
      const delta = currentTime - lastTime;
      if (delta >= 1000) { // Update every second
        const fps = Math.round((frameCount * 1000) / delta);
        
        this.fpsMetrics.current = fps;
        this.fpsMetrics.samples.push(fps);
        
        if (this.fpsMetrics.samples.length > sampleWindow) {
          this.fpsMetrics.samples.shift();
        }
        
        this.fpsMetrics.average = this.fpsMetrics.samples.reduce((a, b) => a + b, 0) / this.fpsMetrics.samples.length;
        this.fpsMetrics.min = Math.min(this.fpsMetrics.min, fps);
        this.fpsMetrics.max = Math.max(this.fpsMetrics.max, fps);
        this.fpsMetrics.lastUpdate = currentTime;
        
        // Check FPS threshold
        if (fps < PERFORMANCE_THRESHOLDS.targetFPS) {
          this.debouncedAlert({
            level: fps < 15 ? AlertLevel.CRITICAL : AlertLevel.WARNING,
            metric: 'FPS',
            value: fps,
            threshold: PERFORMANCE_THRESHOLDS.targetFPS,
            message: `Low frame rate detected: ${fps} FPS (target: ${PERFORMANCE_THRESHOLDS.targetFPS})`,
            timestamp: currentTime,
          });
        }
        
        lastTime = currentTime;
        frameCount = 0;
      }
      
      frameCount++;
      this.frameId = requestAnimationFrame(measureFPS);
    };
    
    this.frameId = requestAnimationFrame(measureFPS);
  }
  
  /**
   * Start memory usage monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = window.setInterval(() => {
      this.throttledMemoryCheck();
    }, 2000); // Check every 2 seconds
  }
  
  /**
   * Check current memory usage
   */
  private checkMemoryUsage(): void {
    if (!this.isMonitoring) return;
    
    const memory: MemoryUsage = {
      used: 0,
      total: 0,
      timestamp: performance.now(),
    };
    
    // Use Performance API if available
    if ('memory' in performance) {
      const perfMemory = (performance as any).memory;
      memory.heapUsed = perfMemory.usedJSHeapSize;
      memory.heapTotal = perfMemory.totalJSHeapSize;
      memory.used = perfMemory.usedJSHeapSize;
      memory.total = perfMemory.totalJSHeapSize;
    } else {
      // Fallback estimation based on DOM nodes and other factors
      memory.used = this.estimateMemoryUsage();
      memory.total = memory.used * 2; // Conservative estimate
    }
    
    this.memoryUsage.push(memory);
    
    // Keep only last 100 measurements
    if (this.memoryUsage.length > 100) {
      this.memoryUsage.shift();
    }
    
    // Check memory thresholds
    if (memory.used > PERFORMANCE_THRESHOLDS.memoryCritical) {
      this.debouncedAlert({
        level: AlertLevel.CRITICAL,
        metric: 'Memory',
        value: memory.used,
        threshold: PERFORMANCE_THRESHOLDS.memoryCritical,
        message: `Critical memory usage: ${Math.round(memory.used / (1024 * 1024))}MB`,
        timestamp: memory.timestamp,
      });
    } else if (memory.used > PERFORMANCE_THRESHOLDS.memoryWarning) {
      this.debouncedAlert({
        level: AlertLevel.WARNING,
        metric: 'Memory',
        value: memory.used,
        threshold: PERFORMANCE_THRESHOLDS.memoryWarning,
        message: `High memory usage: ${Math.round(memory.used / (1024 * 1024))}MB`,
        timestamp: memory.timestamp,
      });
    }
  }
  
  /**
   * Estimate memory usage when Performance.memory is not available
   */
  private estimateMemoryUsage(): number {
    let estimate = 0;
    
    // DOM nodes estimate
    const elements = document.getElementsByTagName('*').length;
    estimate += elements * 1000; // ~1KB per element
    
    // Canvas elements (Three.js textures and geometries)
    const canvases = document.getElementsByTagName('canvas');
    for (const canvas of canvases) {
      estimate += canvas.width * canvas.height * 4; // 4 bytes per pixel
    }
    
    return estimate;
  }
  
  /**
   * Record custom performance metric
   */
  public recordMetric(metric: keyof CustomMetrics, value: number): void {
    this.customMetrics[metric] = value;
    
    // Check thresholds
    const threshold = PERFORMANCE_THRESHOLDS[metric as keyof typeof PERFORMANCE_THRESHOLDS] as number;
    if (threshold && value > threshold) {
      this.checkThreshold(metric, value, threshold);
    }
    
    // Check for performance regression
    this.checkRegression(metric, value);
  }
  
  /**
   * Measure and record execution time of a function
   */
  public async measureOperation<T>(
    operation: () => Promise<T> | T,
    metric: keyof CustomMetrics
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.recordMetric(metric, duration);
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.recordMetric(metric, duration);
      throw error;
    }
  }
  
  /**
   * Check if a metric exceeds its threshold
   */
  private checkThreshold(metric: string, value: number, threshold: number): void {
    if (value > threshold) {
      let level: AlertLevel = AlertLevel.WARNING;
      if (value > threshold * 2) {
        level = AlertLevel.CRITICAL;
      }
      
      this.debouncedAlert({
        level,
        metric,
        value,
        threshold,
        message: `${metric} exceeded threshold: ${Math.round(value)} > ${threshold}`,
        timestamp: performance.now(),
      });
    }
  }
  
  /**
   * Check for performance regression against baseline
   */
  private checkRegression(metric: string, value: number): void {
    const baseline = this.baselines.get(metric);
    if (baseline && value > baseline * 1.5) { // 50% regression threshold
      this.debouncedAlert({
        level: AlertLevel.WARNING,
        metric: `${metric} Regression`,
        value,
        threshold: baseline,
        message: `Performance regression detected in ${metric}: ${Math.round(value)}ms vs baseline ${Math.round(baseline)}ms`,
        timestamp: performance.now(),
      });
    }
  }
  
  /**
   * Set performance baseline for regression detection
   */
  public setBaseline(metric: string, value: number): void {
    this.baselines.set(metric, value);
  }
  
  /**
   * Add performance alert listener
   */
  public addListener(listener: PerformanceListener): void {
    this.listeners.push(listener);
  }
  
  /**
   * Remove performance alert listener
   */
  public removeListener(listener: PerformanceListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * Emit performance alert to all listeners
   */
  private emitAlert(alert: PerformanceAlert): void {
    this.listeners.forEach(listener => {
      try {
        listener(alert);
      } catch (error) {
        console.error('Performance alert listener error:', error);
      }
    });
  }
  
  /**
   * Get current performance snapshot
   */
  public getPerformanceSnapshot() {
    return {
      coreWebVitals: { ...this.coreWebVitals },
      customMetrics: { ...this.customMetrics },
      fpsMetrics: { ...this.fpsMetrics },
      memoryUsage: this.memoryUsage.slice(-10), // Last 10 measurements
      timestamp: performance.now(),
    };
  }
  
  /**
   * Generate performance report
   */
  public generateReport(): string {
    const snapshot = this.getPerformanceSnapshot();
    const lines: string[] = [
      '=== Performance Report ===',
      `Generated: ${new Date().toISOString()}`,
      '',
      '-- Core Web Vitals --',
      `CLS: ${snapshot.coreWebVitals.CLS?.toFixed(3) ?? 'N/A'}`,
      `FID: ${snapshot.coreWebVitals.FID?.toFixed(0) ?? 'N/A'}ms`,
      `FCP: ${snapshot.coreWebVitals.FCP?.toFixed(0) ?? 'N/A'}ms`,
      `LCP: ${snapshot.coreWebVitals.LCP?.toFixed(0) ?? 'N/A'}ms`,
      `TTFB: ${snapshot.coreWebVitals.TTFB?.toFixed(0) ?? 'N/A'}ms`,
      '',
      '-- Custom Metrics --',
      `Image Processing: ${snapshot.customMetrics.imageProcessingTime?.toFixed(0) ?? 'N/A'}ms`,
      `Geometry Generation: ${snapshot.customMetrics.geometryGenerationTime?.toFixed(0) ?? 'N/A'}ms`,
      `Export Operation: ${snapshot.customMetrics.exportOperationTime?.toFixed(0) ?? 'N/A'}ms`,
      '',
      '-- Rendering Performance --',
      `Current FPS: ${snapshot.fpsMetrics.current}`,
      `Average FPS: ${snapshot.fpsMetrics.average.toFixed(1)}`,
      `Min/Max FPS: ${snapshot.fpsMetrics.min}/${snapshot.fpsMetrics.max}`,
      '',
      '-- Memory Usage --',
    ];
    
    if (snapshot.memoryUsage.length > 0) {
      const latest = snapshot.memoryUsage[snapshot.memoryUsage.length - 1];
      lines.push(`Current: ${Math.round(latest.used / (1024 * 1024))}MB`);
      if (latest.heapUsed) {
        lines.push(`Heap Used: ${Math.round(latest.heapUsed / (1024 * 1024))}MB`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Reset all metrics
   */
  public reset(): void {
    this.customMetrics = {
      imageProcessingTime: null,
      geometryGenerationTime: null,
      exportOperationTime: null,
      colorQuantizationTime: null,
      meshOptimizationTime: null,
      renderingTime: null,
    };
    
    this.memoryUsage = [];
    this.fpsMetrics = {
      current: 0,
      average: 0,
      min: Infinity,
      max: 0,
      samples: [],
      lastUpdate: 0,
    };
    
    this.baselines.clear();
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Performance utilities
export class PerformanceUtils {
  /**
   * Mark performance measurement start
   */
  static markStart(name: string): void {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(`${name}-start`);
    }
  }
  
  /**
   * Mark performance measurement end and get duration
   */
  static markEnd(name: string): number {
    if ('performance' in window && 'mark' in performance && 'measure' in performance) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const entries = performance.getEntriesByName(name);
      if (entries.length > 0) {
        const entry = entries[entries.length - 1];
        return entry.duration;
      }
    }
    
    return 0;
  }
  
  /**
   * Clear performance marks and measures
   */
  static clearMarks(name?: string): void {
    if ('performance' in window) {
      if (name) {
        performance.clearMarks(`${name}-start`);
        performance.clearMarks(`${name}-end`);
        performance.clearMeasures(name);
      } else {
        performance.clearMarks();
        performance.clearMeasures();
      }
    }
  }
}

export type { 
  CoreWebVitals, 
  CustomMetrics, 
  MemoryUsage, 
  FPSMetrics, 
  PerformanceAlert,
  PerformanceListener 
};