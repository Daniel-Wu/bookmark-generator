export { useCropRegion } from './useCropRegion';
export type { UseCropRegionReturn, UseCropRegionOptions, CropRegionState } from './useCropRegion';

// Image processing worker hook
export { useImageProcessingWorker } from './useImageProcessingWorker';
export type { UseImageProcessingWorkerReturn } from './useImageProcessingWorker';

// Debounced parameters hooks
export { 
  useDebouncedParameters,
  useGeometryParameters,
  useUIParameters,
  useProcessingParameters,
  useSmartParameters
} from './useDebouncedParameters';
export type { 
  DebouncedParametersOptions,
  UseDebouncedParametersReturn
} from './useDebouncedParameters';

// Performance optimization hooks
export {
  useRenderPerformance,
  useOptimizedMemo,
  useOptimizedCallback,
  useParametersMemo,
  useQuantizedImageMemo,
  useDebouncedState,
  useVirtualList,
  useIntersectionObserver,
  useOptimizedImage,
  deepEqual
} from './usePerformanceOptimization';
export type { PerformanceMetrics } from './usePerformanceOptimization';

// Responsive breakpoint hooks
export { 
  useResponsiveBreakpoints,
  useMediaQuery,
  useTouchDevice,
  BREAKPOINTS,
  MEDIA_QUERIES
} from './useResponsiveBreakpoints';
export type { 
  ResponsiveState,
  DeviceType,
  BreakpointKey
} from './useResponsiveBreakpoints';