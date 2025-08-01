import { useState, useEffect, useCallback, useRef } from 'react';
import type { BookmarkParameters } from '../types';
import { PERFORMANCE_TARGETS } from '../constants';

// ========================
// Types
// ========================

export interface DebouncedParametersOptions {
  debounceMs?: number;
  onDebouncedChange?: (parameters: BookmarkParameters) => void;
  immediateFields?: (keyof BookmarkParameters)[];
}

export interface UseDebouncedParametersReturn {
  parameters: BookmarkParameters;
  debouncedParameters: BookmarkParameters;
  setParameters: (parameters: BookmarkParameters) => void;
  updateParameter: <K extends keyof BookmarkParameters>(
    key: K,
    value: BookmarkParameters[K]
  ) => void;
  isPending: boolean;
  flush: () => void;
}

// ========================
// Hook Implementation
// ========================

export function useDebouncedParameters(
  initialParameters: BookmarkParameters,
  options: DebouncedParametersOptions = {}
): UseDebouncedParametersReturn {
  const {
    debounceMs = PERFORMANCE_TARGETS.PARAMETER_UPDATE_TIME,
    onDebouncedChange,
    immediateFields = [],
  } = options;

  // Current parameters (updated immediately)
  const [parameters, setParametersState] = useState<BookmarkParameters>(initialParameters);
  
  // Debounced parameters (updated after delay)
  const [debouncedParameters, setDebouncedParameters] = useState<BookmarkParameters>(initialParameters);
  
  // Track if there are pending changes
  const [isPending, setIsPending] = useState(false);
  
  // Debounce timer reference
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Last parameters sent to debounced callback
  const lastDebouncedRef = useRef<BookmarkParameters>(initialParameters);

  // Clear existing timeout
  const clearDebounceTimeout = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  // Flush pending changes immediately
  const flush = useCallback(() => {
    clearDebounceTimeout();
    setDebouncedParameters(parameters);
    setIsPending(false);
    
    // Call debounce callback if parameters changed
    if (onDebouncedChange && !parametersEqual(parameters, lastDebouncedRef.current)) {
      lastDebouncedRef.current = parameters;
      onDebouncedChange(parameters);
    }
  }, [parameters, onDebouncedChange, clearDebounceTimeout]);

  // Set parameters with debouncing
  const setParameters = useCallback((newParameters: BookmarkParameters) => {
    setParametersState(newParameters);

    // Check if any immediate fields changed
    const hasImmediateChanges = immediateFields.some(
      field => newParameters[field] !== debouncedParameters[field]
    );

    if (hasImmediateChanges) {
      // Update immediately for specified fields
      setDebouncedParameters(newParameters);
      setIsPending(false);
      clearDebounceTimeout();
      
      if (onDebouncedChange && !parametersEqual(newParameters, lastDebouncedRef.current)) {
        lastDebouncedRef.current = newParameters;
        onDebouncedChange(newParameters);
      }
    } else {
      // Debounce other changes
      setIsPending(true);
      clearDebounceTimeout();
      
      debounceTimeoutRef.current = setTimeout(() => {
        setDebouncedParameters(newParameters);
        setIsPending(false);
        
        if (onDebouncedChange && !parametersEqual(newParameters, lastDebouncedRef.current)) {
          lastDebouncedRef.current = newParameters;
          onDebouncedChange(newParameters);
        }
      }, debounceMs);
    }
  }, [debounceMs, debouncedParameters, immediateFields, onDebouncedChange, clearDebounceTimeout]);

  // Update a single parameter
  const updateParameter = useCallback(<K extends keyof BookmarkParameters>(
    key: K,
    value: BookmarkParameters[K]
  ) => {
    setParameters({
      ...parameters,
      [key]: value,
    });
  }, [parameters, setParameters]);

  // Update debounced parameters when initial parameters change
  useEffect(() => {
    if (!parametersEqual(initialParameters, parameters)) {
      setParameters(initialParameters);
    }
  }, [initialParameters, parameters, setParameters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearDebounceTimeout();
    };
  }, [clearDebounceTimeout]);

  return {
    parameters,
    debouncedParameters,
    setParameters,
    updateParameter,
    isPending,
    flush,
  };
}

// ========================
// Optimized Parameter Hooks
// ========================

/**
 * Hook for parameters that affect geometry generation
 * These are debounced longer since geometry updates are expensive
 */
export function useGeometryParameters(
  initialParameters: BookmarkParameters,
  onGeometryChange?: (parameters: BookmarkParameters) => void
) {
  return useDebouncedParameters(initialParameters, {
    debounceMs: 500, // Longer debounce for expensive operations
    onDebouncedChange: onGeometryChange,
    immediateFields: [], // All geometry parameters are debounced
  });
}

/**
 * Hook for UI-only parameters that should update immediately
 * These affect visual display but not processing
 */
export function useUIParameters(
  initialParameters: BookmarkParameters,
  onUIChange?: (parameters: BookmarkParameters) => void
) {
  return useDebouncedParameters(initialParameters, {
    debounceMs: 50, // Very short debounce for UI responsiveness
    onDebouncedChange: onUIChange,
    immediateFields: ['width', 'height'], // Dimension changes update preview immediately
  });
}

/**
 * Hook for processing parameters that trigger image quantization
 * These have medium debounce since processing is moderately expensive
 */
export function useProcessingParameters(
  initialParameters: BookmarkParameters,
  onProcessingChange?: (parameters: BookmarkParameters) => void
) {
  return useDebouncedParameters(initialParameters, {
    debounceMs: 300, // Medium debounce for processing operations
    onDebouncedChange: onProcessingChange,
    immediateFields: [], // All processing parameters are debounced
  });
}

// ========================
// Smart Parameter Manager
// ========================

/**
 * Advanced hook that intelligently manages different parameter types
 * with appropriate debouncing strategies
 */
export function useSmartParameters(
  initialParameters: BookmarkParameters,
  callbacks: {
    onUIChange?: (parameters: BookmarkParameters) => void;
    onProcessingChange?: (parameters: BookmarkParameters) => void;
    onGeometryChange?: (parameters: BookmarkParameters) => void;
  } = {}
) {
  const [parameters, setParametersState] = useState(initialParameters);
  
  // Separate debouncing for different parameter categories
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const geometryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const lastCallbackParams = useRef({
    ui: initialParameters,
    processing: initialParameters,
    geometry: initialParameters,
  });

  // Categorize parameters by their impact
  const categorizeParameterChange = useCallback((
    oldParams: BookmarkParameters,
    newParams: BookmarkParameters
  ) => {
    const changes = {
      ui: false,        // Visual changes only
      processing: false, // Require image reprocessing
      geometry: false,   // Require geometry regeneration
    };

    // UI changes (immediate visual feedback)
    if (oldParams.width !== newParams.width || 
        oldParams.height !== newParams.height ||
        oldParams.cornerRadius !== newParams.cornerRadius) {
      changes.ui = true;
    }

    // Processing changes (require image quantization)
    if (oldParams.colorCount !== newParams.colorCount) {
      changes.processing = true;
    }

    // Geometry changes (require 3D model regeneration)
    if (oldParams.layerThickness !== newParams.layerThickness ||
        oldParams.baseThickness !== newParams.baseThickness) {
      changes.geometry = true;
    }

    return changes;
  }, []);

  // Smart parameter update with category-specific debouncing
  const setParameters = useCallback((newParameters: BookmarkParameters) => {
    setParametersState(newParameters);
    
    const changes = categorizeParameterChange(parameters, newParameters);
    
    // Handle UI changes (minimal debounce)
    if (changes.ui) {
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
      uiTimeoutRef.current = setTimeout(() => {
        if (callbacks.onUIChange && !parametersEqual(newParameters, lastCallbackParams.current.ui)) {
          lastCallbackParams.current.ui = newParameters;
          callbacks.onUIChange(newParameters);
        }
      }, 50);
    }
    
    // Handle processing changes (medium debounce)
    if (changes.processing) {
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = setTimeout(() => {
        if (callbacks.onProcessingChange && !parametersEqual(newParameters, lastCallbackParams.current.processing)) {
          lastCallbackParams.current.processing = newParameters;
          callbacks.onProcessingChange(newParameters);
        }
      }, 300);
    }
    
    // Handle geometry changes (longer debounce)
    if (changes.geometry) {
      if (geometryTimeoutRef.current) clearTimeout(geometryTimeoutRef.current);
      geometryTimeoutRef.current = setTimeout(() => {
        if (callbacks.onGeometryChange && !parametersEqual(newParameters, lastCallbackParams.current.geometry)) {
          lastCallbackParams.current.geometry = newParameters;
          callbacks.onGeometryChange(newParameters);
        }
      }, 500);
    }
  }, [parameters, callbacks, categorizeParameterChange]);

  // Update single parameter
  const updateParameter = useCallback(<K extends keyof BookmarkParameters>(
    key: K,
    value: BookmarkParameters[K]
  ) => {
    setParameters({
      ...parameters,
      [key]: value,
    });
  }, [parameters, setParameters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
      if (geometryTimeoutRef.current) clearTimeout(geometryTimeoutRef.current);
    };
  }, []);

  return {
    parameters,
    setParameters,
    updateParameter,
  };
}

// ========================
// Helper Functions
// ========================

function parametersEqual(a: BookmarkParameters, b: BookmarkParameters): boolean {
  return (
    a.colorCount === b.colorCount &&
    a.layerThickness === b.layerThickness &&
    a.baseThickness === b.baseThickness &&
    a.width === b.width &&
    a.height === b.height &&
    a.cornerRadius === b.cornerRadius
  );
}

export default useDebouncedParameters;