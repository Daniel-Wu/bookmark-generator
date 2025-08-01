import React, { useCallback, useRef, useEffect } from 'react';
import { PERFORMANCE_TARGETS } from '../constants';

// ========================
// Types
// ========================

export interface PerformanceMetrics {
  renderTime: number;
  updateTime: number;
  memoryUsage: number;
  updateCount: number;
  averageUpdateTime: number;
}

export interface PerformanceOptions {
  enableProfiling?: boolean;
  maxHistorySize?: number;
  warningThreshold?: number;
  errorThreshold?: number;
  onPerformanceIssue?: (metrics: PerformanceMetrics, issue: string) => void;
}

// ========================
// Performance Monitoring Hook
// ========================

export function useParameterPerformance(
  _componentName: string,
  options: PerformanceOptions = {}
) {
  const {
    enableProfiling = process.env.NODE_ENV === 'development',
    maxHistorySize = 100,
    warningThreshold = PERFORMANCE_TARGETS.PARAMETER_UPDATE_TIME * 2,
    errorThreshold = PERFORMANCE_TARGETS.PARAMETER_UPDATE_TIME * 5,
    onPerformanceIssue
  } = options;

  // Performance data storage
  const metricsRef = useRef<{
    updateTimes: number[];
    renderTimes: number[];
    updateCount: number;
    lastRenderStart: number;
    lastUpdateStart: number;
  }>({
    updateTimes: [],
    renderTimes: [],
    updateCount: 0,
    lastRenderStart: 0,
    lastUpdateStart: 0
  });

  // Memory usage tracking
  const memoryRef = useRef<{
    baseline: number;
    peak: number;
    current: number;
  }>({
    baseline: 0,
    peak: 0,
    current: 0
  });

  // Initialize memory baseline
  useEffect(() => {
    if (enableProfiling && 'memory' in performance) {
      // @ts-ignore - memory is not in the standard Performance interface
      memoryRef.current.baseline = performance.memory.usedJSHeapSize;
    }
  }, [enableProfiling]);

  // Track render performance
  const trackRenderStart = useCallback(() => {
    if (!enableProfiling) return;
    metricsRef.current.lastRenderStart = performance.now();
  }, [enableProfiling]);

  const trackRenderEnd = useCallback(() => {
    if (!enableProfiling || !metricsRef.current.lastRenderStart) return;
    
    const renderTime = performance.now() - metricsRef.current.lastRenderStart;
    const { renderTimes } = metricsRef.current;
    
    renderTimes.push(renderTime);
    if (renderTimes.length > maxHistorySize) {
      renderTimes.shift();
    }
    
    // Check for performance issues
    if (renderTime > warningThreshold) {
      const issue = renderTime > errorThreshold ? 'CRITICAL_RENDER_TIME' : 'SLOW_RENDER';
      onPerformanceIssue?.(getCurrentMetrics(), issue);
    }
  }, [enableProfiling, maxHistorySize, warningThreshold, errorThreshold, onPerformanceIssue]);

  // Track parameter update performance
  const trackUpdateStart = useCallback(() => {
    if (!enableProfiling) return;
    metricsRef.current.lastUpdateStart = performance.now();
  }, [enableProfiling]);

  const trackUpdateEnd = useCallback(() => {
    if (!enableProfiling || !metricsRef.current.lastUpdateStart) return;
    
    const updateTime = performance.now() - metricsRef.current.lastUpdateStart;
    const { updateTimes } = metricsRef.current;
    
    updateTimes.push(updateTime);
    metricsRef.current.updateCount++;
    
    if (updateTimes.length > maxHistorySize) {
      updateTimes.shift();
    }
    
    // Update memory usage
    if ('memory' in performance) {
      // @ts-ignore
      const currentMemory = performance.memory.usedJSHeapSize;
      memoryRef.current.current = currentMemory;
      memoryRef.current.peak = Math.max(memoryRef.current.peak, currentMemory);
    }
    
    // Check for performance issues
    if (updateTime > warningThreshold) {
      const issue = updateTime > errorThreshold ? 'CRITICAL_UPDATE_TIME' : 'SLOW_UPDATE';
      onPerformanceIssue?.(getCurrentMetrics(), issue);
    }
  }, [enableProfiling, maxHistorySize, warningThreshold, errorThreshold, onPerformanceIssue]);

  // Get current performance metrics
  const getCurrentMetrics = useCallback((): PerformanceMetrics => {
    const { updateTimes, renderTimes, updateCount } = metricsRef.current;
    const { baseline, current } = memoryRef.current;
    
    return {
      renderTime: renderTimes.length > 0 ? renderTimes[renderTimes.length - 1] : 0,
      updateTime: updateTimes.length > 0 ? updateTimes[updateTimes.length - 1] : 0,
      memoryUsage: current - baseline,
      updateCount,
      averageUpdateTime: updateTimes.length > 0 
        ? updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length 
        : 0
    };
  }, []);

  // Optimized callback wrapper that includes performance tracking
  const withPerformanceTracking = useCallback(
    <T extends (...args: any[]) => any>(callback: T, _name?: string): T => {
      if (!enableProfiling) return callback;
      
      return ((...args: any[]) => {
        trackUpdateStart();
        
        try {
          const result = callback(...args);
          
          // Handle async callbacks
          if (result && typeof result.then === 'function') {
            return result.finally(() => {
              trackUpdateEnd();
            });
          }
          
          trackUpdateEnd();
          return result;
        } catch (error) {
          trackUpdateEnd();
          throw error;
        }
      }) as T;
    },
    [enableProfiling, trackUpdateStart, trackUpdateEnd]
  );

  // Performance-aware throttling
  const createThrottledCallback = useCallback(
    <T extends (...args: any[]) => any>(
      callback: T,
      delay: number = PERFORMANCE_TARGETS.PARAMETER_UPDATE_TIME
    ) => {
      let timeoutId: NodeJS.Timeout | null = null;
      let lastExecuted = 0;
      
      return (...args: Parameters<T>) => {
        const now = performance.now();
        const timeSinceLastExecution = now - lastExecuted;
        
        // Adaptive throttling based on recent performance
        const metrics = getCurrentMetrics();
        const adaptiveDelay = metrics.averageUpdateTime > warningThreshold 
          ? delay * 2 // Increase delay if performance is poor
          : delay;
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        if (timeSinceLastExecution >= adaptiveDelay) {
          // Execute immediately
          lastExecuted = now;
          return withPerformanceTracking(callback)(...args);
        } else {
          // Throttle execution
          return new Promise<ReturnType<T>>((resolve) => {
            timeoutId = setTimeout(() => {
              lastExecuted = performance.now();
              resolve(withPerformanceTracking(callback)(...args));
            }, adaptiveDelay - timeSinceLastExecution);
          });
        }
      };
    },
    [getCurrentMetrics, warningThreshold, withPerformanceTracking]
  );

  // Memory cleanup utilities
  const cleanup = useCallback(() => {
    metricsRef.current = {
      updateTimes: [],
      renderTimes: [],
      updateCount: 0,
      lastRenderStart: 0,
      lastUpdateStart: 0
    };
    
    memoryRef.current = {
      baseline: memoryRef.current.current,
      peak: memoryRef.current.current,
      current: memoryRef.current.current
    };
  }, []);

  // Performance report generation
  const getPerformanceReport = useCallback(() => {
    const metrics = getCurrentMetrics();
    const { updateTimes, renderTimes } = metricsRef.current;
    
    return {
      summary: metrics,
      detailed: {
        updateTimesHistory: [...updateTimes],
        renderTimesHistory: [...renderTimes],
        worstUpdateTime: Math.max(...updateTimes, 0),
        bestUpdateTime: Math.min(...updateTimes, Infinity),
        worstRenderTime: Math.max(...renderTimes, 0),
        bestRenderTime: Math.min(...renderTimes, Infinity),
        memoryGrowth: memoryRef.current.current - memoryRef.current.baseline,
        peakMemoryUsage: memoryRef.current.peak - memoryRef.current.baseline
      },
      recommendations: generateRecommendations(metrics)
    };
  }, [getCurrentMetrics]);

  return {
    // Performance tracking
    trackRenderStart,
    trackRenderEnd,
    trackUpdateStart,
    trackUpdateEnd,
    getCurrentMetrics,
    
    // Optimization utilities
    withPerformanceTracking,
    createThrottledCallback,
    
    // Management
    cleanup,
    getPerformanceReport,
    
    // State
    isProfilingEnabled: enableProfiling
  };
}

// ========================
// Performance Analysis
// ========================

function generateRecommendations(metrics: PerformanceMetrics): string[] {
  const recommendations: string[] = [];
  
  if (metrics.averageUpdateTime > PERFORMANCE_TARGETS.PARAMETER_UPDATE_TIME * 2) {
    recommendations.push('Consider increasing debounce delay for parameter updates');
  }
  
  if (metrics.updateCount > 100 && metrics.averageUpdateTime > PERFORMANCE_TARGETS.PARAMETER_UPDATE_TIME) {
    recommendations.push('High update frequency detected - consider implementing more aggressive throttling');
  }
  
  if (metrics.memoryUsage > 50 * 1024 * 1024) { // 50MB
    recommendations.push('High memory usage detected - consider cleaning up unused parameter history');
  }
  
  if (metrics.renderTime > 16.67) { // 60fps threshold
    recommendations.push('Render time exceeds 60fps threshold - consider optimizing component rendering');
  }
  
  return recommendations;
}

// ========================
// Performance-Optimized Parameter Hook
// ========================

export function useOptimizedParameterCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  componentName: string,
  options: PerformanceOptions = {}
): T {
  const { withPerformanceTracking } = useParameterPerformance(componentName, options);
  
  return useCallback(
    withPerformanceTracking(callback, `${componentName}.callback`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );
}

// ========================
// Component Performance Wrapper
// ========================

export function withParameterPerformance<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  options: PerformanceOptions = {}
) {
  const WrappedComponent = React.memo((props: P) => {
    const { trackRenderStart, trackRenderEnd } = useParameterPerformance(componentName, options);
    
    useEffect(() => {
      trackRenderStart();
      trackRenderEnd();
    });
    
    return <Component {...props} />;
  });
  
  WrappedComponent.displayName = `withParameterPerformance(${componentName})`;
  
  return WrappedComponent;
}

export default useParameterPerformance;