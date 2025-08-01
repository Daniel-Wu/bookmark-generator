import { useState, useCallback, useMemo } from 'react';
import type { CropRegion, ValidationResult } from '../types';

export interface CropRegionState {
  cropRegion: CropRegion;
  scale: number;
  aspectRatioLocked: boolean;
  history: CropRegion[];
  historyIndex: number;
  validation: ValidationResult;
}

export interface UseCropRegionOptions {
  initialCrop?: Partial<CropRegion>;
  maxHistorySize?: number;
  minCropSize?: number;
  maxScale?: number;
  minScale?: number;
}

export interface UseCropRegionReturn {
  cropRegion: CropRegion;
  scale: number;
  aspectRatioLocked: boolean;
  validation: ValidationResult;
  canUndo: boolean;
  canRedo: boolean;
  
  // Actions
  setCropRegion: (crop: CropRegion) => void;
  setScale: (scale: number) => void;
  toggleAspectRatioLock: () => void;
  resetCrop: (imageWidth: number, imageHeight: number) => void;
  rotateCrop: (degrees: number) => void;
  undo: () => void;
  redo: () => void;
  
  // Validation helpers
  validateCrop: (crop: CropRegion, imageWidth: number, imageHeight: number) => ValidationResult;
  constrainCrop: (crop: CropRegion, imageWidth: number, imageHeight: number) => CropRegion;
}

const DEFAULT_CROP: CropRegion = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
};

export const useCropRegion = (options: UseCropRegionOptions = {}): UseCropRegionReturn => {
  const {
    initialCrop = {},
    maxHistorySize = 50,
    minCropSize = 50,
    maxScale = 2.0,
    minScale = 0.5,
  } = options;

  // Initialize state
  const [state, setState] = useState<CropRegionState>(() => {
    const cropRegion = { ...DEFAULT_CROP, ...initialCrop };
    return {
      cropRegion,
      scale: 1.0,
      aspectRatioLocked: false,
      history: [cropRegion],
      historyIndex: 0,
      validation: { isValid: true, errors: [], warnings: [] },
    };
  });

  // Validation function
  const validateCrop = useCallback((
    crop: CropRegion,
    imageWidth: number,
    imageHeight: number
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check bounds
    if (crop.x < 0 || crop.y < 0) {
      errors.push('Crop region extends outside image bounds (negative position)');
    }

    if (crop.x + crop.width > imageWidth || crop.y + crop.height > imageHeight) {
      errors.push('Crop region extends outside image bounds');
    }

    // Check minimum size
    if (crop.width < minCropSize || crop.height < minCropSize) {
      errors.push(`Crop size too small (minimum ${minCropSize}px)`);
    }

    // Check aspect ratio for bookmark compatibility
    const aspectRatio = crop.width / crop.height;
    if (aspectRatio < 0.1 || aspectRatio > 10) {
      warnings.push('Unusual aspect ratio may not be suitable for bookmarks');
    }

    // Check rotation
    if (crop.rotation % 90 !== 0) {
      warnings.push('Non-90° rotations may affect print quality');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [minCropSize]);

  // Constrain crop to valid bounds
  const constrainCrop = useCallback((
    crop: CropRegion,
    imageWidth: number,
    imageHeight: number
  ): CropRegion => {
    const result = { ...crop };

    // Handle edge cases for invalid image dimensions
    if (imageWidth <= 0 || imageHeight <= 0) {
      return {
        x: 0,
        y: 0,
        width: Math.max(minCropSize, result.width),
        height: Math.max(minCropSize, result.height),
        rotation: ((result.rotation % 360) + 360) % 360,
      };
    }

    // Ensure minimum size
    result.width = Math.max(minCropSize, result.width);
    result.height = Math.max(minCropSize, result.height);

    // Constrain to image bounds
    result.x = Math.max(0, Math.min(imageWidth - result.width, result.x));
    result.y = Math.max(0, Math.min(imageHeight - result.height, result.y));

    // Adjust size if needed to fit in bounds
    if (result.x + result.width > imageWidth) {
      result.width = imageWidth - result.x;
    }
    if (result.y + result.height > imageHeight) {
      result.height = imageHeight - result.y;
    }

    // Final size check to ensure we still meet minimum requirements
    if (result.width < minCropSize) {
      result.width = Math.min(minCropSize, imageWidth);
      result.x = Math.max(0, imageWidth - result.width);
    }
    if (result.height < minCropSize) {
      result.height = Math.min(minCropSize, imageHeight);
      result.y = Math.max(0, imageHeight - result.height);
    }

    // Normalize rotation
    result.rotation = ((result.rotation % 360) + 360) % 360;

    return result;
  }, [minCropSize]);


  // Set crop region
  const setCropRegion = useCallback((crop: CropRegion) => {
    setState(prev => {
      const validation = validateCrop(crop, 1000, 1000); // Default validation bounds
      
      // Add to history if different from current
      const current = prev.history[prev.historyIndex];
      const isDifferent = !current || 
        current.x !== crop.x || 
        current.y !== crop.y || 
        current.width !== crop.width || 
        current.height !== crop.height || 
        current.rotation !== crop.rotation;
      
      if (isDifferent) {
        // Create new history
        const newHistory = prev.history.slice(0, prev.historyIndex + 1);
        newHistory.push(crop);
        
        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
        }
        
        return {
          ...prev,
          cropRegion: crop,
          validation,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }
      
      return {
        ...prev,
        cropRegion: crop,
        validation,
      };
    });
  }, [validateCrop, maxHistorySize]);

  // Set scale
  const setScale = useCallback((scale: number) => {
    const constrainedScale = Math.max(minScale, Math.min(maxScale, scale));
    setState(prev => ({
      ...prev,
      scale: constrainedScale,
    }));
  }, [minScale, maxScale]);

  // Toggle aspect ratio lock
  const toggleAspectRatioLock = useCallback(() => {
    setState(prev => ({
      ...prev,
      aspectRatioLocked: !prev.aspectRatioLocked,
    }));
  }, []);

  // Reset crop to center and fit
  const resetCrop = useCallback((imageWidth: number, imageHeight: number) => {
    const aspectRatio = imageWidth / imageHeight;
    let width = imageWidth * 0.8; // 80% of image by default
    let height = imageHeight * 0.8;

    // Maintain current aspect ratio if locked
    if (state.aspectRatioLocked) {
      const currentAspectRatio = state.cropRegion.width / state.cropRegion.height;
      if (aspectRatio > currentAspectRatio) {
        width = height * currentAspectRatio;
      } else {
        height = width / currentAspectRatio;
      }
    }

    const newCrop: CropRegion = {
      x: (imageWidth - width) / 2,
      y: (imageHeight - height) / 2,
      width,
      height,
      rotation: 0,
    };

    setCropRegion(constrainCrop(newCrop, imageWidth, imageHeight));
  }, [state.aspectRatioLocked, state.cropRegion, setCropRegion, constrainCrop]);

  // Rotate crop
  const rotateCrop = useCallback((degrees: number) => {
    const newCrop = {
      ...state.cropRegion,
      rotation: state.cropRegion.rotation + degrees,
    };
    setCropRegion(newCrop);
  }, [state.cropRegion, setCropRegion]);

  // Undo
  const undo = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex > 0) {
        const newIndex = prev.historyIndex - 1;
        const crop = prev.history[newIndex];
        const validation = validateCrop(crop, 1000, 1000);
        
        return {
          ...prev,
          cropRegion: crop,
          historyIndex: newIndex,
          validation,
        };
      }
      return prev;
    });
  }, [validateCrop]);

  // Redo
  const redo = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex < prev.history.length - 1) {
        const newIndex = prev.historyIndex + 1;
        const crop = prev.history[newIndex];
        const validation = validateCrop(crop, 1000, 1000);
        
        return {
          ...prev,
          cropRegion: crop,
          historyIndex: newIndex,
          validation,
        };
      }
      return prev;
    });
  }, [validateCrop]);

  // Computed values
  const canUndo = useMemo(() => state.historyIndex > 0, [state.historyIndex]);
  const canRedo = useMemo(() => state.historyIndex < state.history.length - 1, [state.historyIndex, state.history.length]);

  return {
    cropRegion: state.cropRegion,
    scale: state.scale,
    aspectRatioLocked: state.aspectRatioLocked,
    validation: state.validation,
    canUndo,
    canRedo,
    
    // Actions
    setCropRegion,
    setScale,
    toggleAspectRatioLock,
    resetCrop,
    rotateCrop,
    undo,
    redo,
    
    // Validation helpers
    validateCrop,
    constrainCrop,
  };
};