/**
 * React performance optimization hooks and utilities
 * 
 * Provides optimized versions of common React patterns with built-in
 * performance monitoring and memory management for the bookmark generator.
 */

import { 
  useMemo, 
  useCallback, 
  useRef, 
  useEffect, 
  useState
} from 'react';
import type { DependencyList } from 'react';
import type { BookmarkParameters, QuantizedImageData } from '../types';
// import { PERFORMANCE_TARGETS } from '../constants';

// ========================
// Performance Monitoring
// ========================

export interface PerformanceMetrics {
  renderTime: number;
  lastRenderTime: number;
  averageRenderTime: number;
  renderCount: number;
  slowRenders: number;
}

/**
 * Hook to monitor component render performance
 */
export function useRenderPerformance(componentName: string = 'Component') {
  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    renderCount: 0,
    slowRenders: 0,
  });

  const renderStartRef = useRef<number>(0);

  // Mark render start
  renderStartRef.current = performance.now();

  useEffect(() => {
    // Calculate render time
    const renderTime = performance.now() - renderStartRef.current;
    const metrics = metricsRef.current;

    // Update metrics
    metrics.lastRenderTime = renderTime;
    metrics.renderCount += 1;
    metrics.averageRenderTime = 
      (metrics.averageRenderTime * (metrics.renderCount - 1) + renderTime) / metrics.renderCount;

    // Track slow renders (over 16ms for 60fps)
    if (renderTime > 16) {
      metrics.slowRenders += 1;
    }

    // Log performance warnings
    if (renderTime > 50) {
      console.warn(`Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
    }

    // Log periodic performance summary
    if (metrics.renderCount % 100 === 0) {
      console.log(`Performance summary for ${componentName}:`, {
        averageRenderTime: metrics.averageRenderTime.toFixed(2) + 'ms',
        slowRenderPercentage: ((metrics.slowRenders / metrics.renderCount) * 100).toFixed(1) + '%',
        totalRenders: metrics.renderCount,
      });
    }
  });

  return metricsRef.current;
}

// ========================
// Optimized Hooks
// ========================

/**
 * Enhanced useMemo with performance monitoring
 */
export function useOptimizedMemo<T>(
  factory: () => T,
  deps: DependencyList,
  debugName?: string
): T {
  const calculationTimeRef = useRef<number>(0);
  const _hitCountRef = useRef<number>(0);
  const missCountRef = useRef<number>(0);

  return useMemo(() => {
    const start = performance.now();
    const result = factory();
    calculationTimeRef.current = performance.now() - start;
    
    missCountRef.current += 1;

    // Log expensive calculations
    if (calculationTimeRef.current > 10 && debugName) {
      console.log(`Expensive calculation in ${debugName}: ${calculationTimeRef.current.toFixed(2)}ms`);
    }

    return result;
  }, deps);
}

/**
 * Enhanced useCallback with performance monitoring
 */
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList,
  debugName?: string
): T {
  const callCountRef = useRef<number>(0);
  const totalTimeRef = useRef<number>(0);

  return useCallback((...args: Parameters<T>) => {
    const start = performance.now();
    const result = callback(...args);
    const duration = performance.now() - start;
    
    callCountRef.current += 1;
    totalTimeRef.current += duration;

    // Log slow callbacks
    if (duration > 5 && debugName) {
      console.log(`Slow callback ${debugName}: ${duration.toFixed(2)}ms`);
    }

    return result;
  }, deps) as T;
}

/**
 * Memoized parameter comparison for BookmarkParameters
 */
export function useParametersMemo(parameters: BookmarkParameters): BookmarkParameters {
  return useOptimizedMemo(
    () => ({ ...parameters }),
    [
      parameters.colorCount,
      parameters.layerThickness,
      parameters.baseThickness,
      parameters.width,
      parameters.height,
      parameters.cornerRadius,
    ],
    'BookmarkParameters'
  );
}

/**
 * Memoized quantized image data processing
 */
export function useQuantizedImageMemo(
  quantizedData: QuantizedImageData | null
): QuantizedImageData | null {
  return useOptimizedMemo(
    () => {
      if (!quantizedData) return null;
      
      // Deep clone to prevent mutations
      return {
        imageData: new ImageData(
          quantizedData.imageData.data.slice(),
          quantizedData.imageData.width,
          quantizedData.imageData.height
        ),
        colorPalette: quantizedData.colorPalette.map(color => ({ ...color })),
        heightMap: quantizedData.heightMap.slice(),
      };
    },
    [
      quantizedData?.imageData.width,
      quantizedData?.imageData.height,
      quantizedData?.colorPalette.length,
      quantizedData?.heightMap.length,
      // Add checksum for data changes
      quantizedData ? getImageDataChecksum(quantizedData.imageData) : null,
    ],
    'QuantizedImageData'
  );
}

// ========================
// Debounced State Management
// ========================

/**
 * State with built-in debouncing and performance optimization
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300,
  equalityFn?: (a: T, b: T) => boolean
): [T, T, (value: T) => void, boolean] {
  const [immediateValue, setImmediateValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  const [isPending, setIsPending] = useState<boolean>(false);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const equalsFn = equalityFn || ((a, b) => a === b);

  const setValue = useOptimizedCallback(
    (newValue: T) => {
      // Update immediate value
      setImmediateValue(newValue);
      
      // Skip if value hasn't changed
      if (equalsFn(newValue, debouncedValue)) {
        setIsPending(false);
        return;
      }
      
      setIsPending(true);
      
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(newValue);
        setIsPending(false);
      }, delay);
    },
    [delay, debouncedValue, equalsFn],
    'DebouncedState.setValue'
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [immediateValue, debouncedValue, setValue, isPending];
}

// ========================
// Virtual Rendering
// ========================

/**
 * Hook for virtual scrolling/rendering of large lists
 */
export function useVirtualList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useOptimizedMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length], 'VirtualList.visibleRange');

  const visibleItems = useOptimizedMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
      .map((item, index) => ({
        item,
        index: visibleRange.startIndex + index,
        style: {
          position: 'absolute' as const,
          top: (visibleRange.startIndex + index) * itemHeight,
          height: itemHeight,
        },
      }));
  }, [items, visibleRange, itemHeight], 'VirtualList.visibleItems');

  const totalHeight = items.length * itemHeight;

  return {
    visibleItems,
    totalHeight,
    setScrollTop,
  };
}

// ========================
// Intersection Observer
// ========================

/**
 * Optimized intersection observer hook
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [(node: Element | null) => void, IntersectionObserverEntry | null] {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setRef = useOptimizedCallback((node: Element | null) => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (node) {
      // Create new observer
      observerRef.current = new IntersectionObserver(
        ([entry]) => setEntry(entry),
        options
      );
      observerRef.current.observe(node);
    }
  }, [options.threshold, options.rootMargin], 'IntersectionObserver.setRef');

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return [setRef, entry];
}

// ========================
// Image Loading Optimization
// ========================

/**
 * Hook for optimized image loading with lazy loading and error handling
 */
export function useOptimizedImage(src: string | null, options: {
  lazy?: boolean;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
} = {}) {
  const [isLoading, setIsLoading] = useState(!!src);
  const [isError, setIsError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(options.placeholder || null);
  
  const [setIntersectionRef, intersectionEntry] = useIntersectionObserver({
    threshold: 0.1,
  });

  const shouldLoad = !options.lazy || (intersectionEntry?.isIntersecting ?? false);

  useEffect(() => {
    if (!src || !shouldLoad) return;

    setIsLoading(true);
    setIsError(false);

    const img = new Image();
    
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoading(false);
      options.onLoad?.();
    };
    
    img.onerror = () => {
      setIsError(true);
      setIsLoading(false);
      options.onError?.();
    };
    
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, shouldLoad, options.onLoad, options.onError]);

  return {
    src: currentSrc,
    isLoading,
    isError,
    setRef: options.lazy ? setIntersectionRef : undefined,
  };
}

// ========================
// Helper Functions
// ========================

/**
 * Generate a simple checksum for ImageData
 */
function getImageDataChecksum(imageData: ImageData): string {
  const data = imageData.data;
  let checksum = 0;
  
  // Sample every 1000th pixel for performance
  for (let i = 0; i < data.length; i += 4000) {
    checksum = ((checksum << 5) - checksum + data[i]) & 0xffffffff;
  }
  
  return checksum.toString(36);
}

/**
 * Deep equality check for objects
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
        return false;
      }
    }
    
    return true;
  }
  
  return false;
}

export default {
  useRenderPerformance,
  useOptimizedMemo,
  useOptimizedCallback,
  useParametersMemo,
  useQuantizedImageMemo,
  useDebouncedState,
  useVirtualList,
  useIntersectionObserver,
  useOptimizedImage,
  deepEqual,
};