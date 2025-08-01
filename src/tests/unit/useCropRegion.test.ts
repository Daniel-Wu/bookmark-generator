import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCropRegion } from '../../hooks/useCropRegion';
import type { CropRegion } from '../../types';

describe('useCropRegion', () => {
  describe('Initialization', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() => useCropRegion());

      expect(result.current.cropRegion).toEqual({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
      });
      expect(result.current.scale).toBe(1.0);
      expect(result.current.aspectRatioLocked).toBe(false);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('initializes with custom initial crop', () => {
      const initialCrop = { x: 50, y: 50, width: 200, height: 150 };
      const { result } = renderHook(() => useCropRegion({ initialCrop }));

      expect(result.current.cropRegion).toMatchObject(initialCrop);
    });

    it('initializes with custom options', () => {
      const options = {
        maxHistorySize: 10,
        minCropSize: 30,
        maxScale: 3.0,
        minScale: 0.2,
      };
      const { result } = renderHook(() => useCropRegion(options));

      // Test scale constraints
      act(() => {
        result.current.setScale(5.0); // Should be clamped to maxScale
      });
      expect(result.current.scale).toBe(3.0);

      act(() => {
        result.current.setScale(0.1); // Should be clamped to minScale
      });
      expect(result.current.scale).toBe(0.2);
    });
  });

  describe('Crop Region Management', () => {
    it('updates crop region and maintains history', () => {
      const { result } = renderHook(() => useCropRegion());

      const newCrop: CropRegion = {
        x: 10,
        y: 20,
        width: 150,
        height: 120,
        rotation: 0,
      };

      act(() => {
        result.current.setCropRegion(newCrop);
      });

      expect(result.current.cropRegion).toEqual(newCrop);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it('validates crop region bounds', () => {
      const { result } = renderHook(() => useCropRegion());

      const validation = result.current.validateCrop(
        { x: -10, y: -10, width: 50, height: 50, rotation: 0 },
        100,
        100
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        expect.stringContaining('extends outside image bounds')
      );
    });

    it('constrains crop region to valid bounds', () => {
      const { result } = renderHook(() => useCropRegion());

      const invalidCrop: CropRegion = {
        x: -10,
        y: -10,
        width: 200,
        height: 200,
        rotation: 0,
      };

      const constrained = result.current.constrainCrop(invalidCrop, 100, 100);

      expect(constrained.x).toBeGreaterThanOrEqual(0);
      expect(constrained.y).toBeGreaterThanOrEqual(0);
      expect(constrained.x + constrained.width).toBeLessThanOrEqual(100);
      expect(constrained.y + constrained.height).toBeLessThanOrEqual(100);
    });

    it('enforces minimum crop size', () => {
      const minCropSize = 60;
      const { result } = renderHook(() => useCropRegion({ minCropSize }));

      const smallCrop: CropRegion = {
        x: 0,
        y: 0,
        width: 30,
        height: 30,
        rotation: 0,
      };

      const constrained = result.current.constrainCrop(smallCrop, 200, 200);

      expect(constrained.width).toBe(minCropSize);
      expect(constrained.height).toBe(minCropSize);
    });
  });

  describe('Scale Management', () => {
    it('updates scale within bounds', () => {
      const { result } = renderHook(() => useCropRegion());

      act(() => {
        result.current.setScale(1.5);
      });

      expect(result.current.scale).toBe(1.5);
    });

    it('clamps scale to bounds', () => {
      const { result } = renderHook(() => useCropRegion());

      // Test upper bound
      act(() => {
        result.current.setScale(5.0);
      });
      expect(result.current.scale).toBe(2.0); // Default max

      // Test lower bound
      act(() => {
        result.current.setScale(0.1);
      });
      expect(result.current.scale).toBe(0.5); // Default min
    });
  });

  describe('Aspect Ratio Lock', () => {
    it('toggles aspect ratio lock', () => {
      const { result } = renderHook(() => useCropRegion());

      expect(result.current.aspectRatioLocked).toBe(false);

      act(() => {
        result.current.toggleAspectRatioLock();
      });

      expect(result.current.aspectRatioLocked).toBe(true);

      act(() => {
        result.current.toggleAspectRatioLock();
      });

      expect(result.current.aspectRatioLocked).toBe(false);
    });
  });

  describe('Reset Functionality', () => {
    it('resets crop to center and fit', () => {
      const { result } = renderHook(() => useCropRegion());

      // Start with a custom crop
      act(() => {
        result.current.setCropRegion({
          x: 10,
          y: 10,
          width: 50,
          height: 50,
          rotation: 45,
        });
      });

      // Reset to center
      act(() => {
        result.current.resetCrop(400, 300);
      });

      const crop = result.current.cropRegion;
      expect(crop.rotation).toBe(0);
      expect(crop.x).toBeGreaterThan(0);
      expect(crop.y).toBeGreaterThan(0);
      expect(crop.x + crop.width).toBeLessThanOrEqual(400);
      expect(crop.y + crop.height).toBeLessThanOrEqual(300);
    });

    it('maintains aspect ratio when locked during reset', () => {
      const { result } = renderHook(() => useCropRegion());

      // Set an initial crop with specific aspect ratio
      const initialCrop = {
        x: 0,
        y: 0,
        width: 200,
        height: 100, // 2:1 aspect ratio
        rotation: 0,
      };

      act(() => {
        result.current.setCropRegion(initialCrop);
        result.current.toggleAspectRatioLock();
      });

      // Reset while locked
      act(() => {
        result.current.resetCrop(400, 400);
      });

      const crop = result.current.cropRegion;
      const aspectRatio = crop.width / crop.height;
      expect(aspectRatio).toBeCloseTo(2.0, 1); // Should maintain 2:1 ratio
    });
  });

  describe('Rotation', () => {
    it('rotates crop region', () => {
      const { result } = renderHook(() => useCropRegion());

      act(() => {
        result.current.rotateCrop(90);
      });

      expect(result.current.cropRegion.rotation).toBe(90);

      act(() => {
        result.current.rotateCrop(-45);
      });

      expect(result.current.cropRegion.rotation).toBe(45);
    });

    it('normalizes rotation values in validation', () => {
      const { result } = renderHook(() => useCropRegion());

      const crop: CropRegion = {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 450, // > 360
      };

      const constrained = result.current.constrainCrop(crop, 200, 200);
      expect(constrained.rotation).toBe(90); // 450 % 360
    });
  });

  describe('History Management', () => {
    it('maintains undo/redo history', () => {
      const { result } = renderHook(() => useCropRegion());

      const crop1 = { x: 10, y: 10, width: 100, height: 100, rotation: 0 };
      const crop2 = { x: 20, y: 20, width: 120, height: 120, rotation: 0 };
      const crop3 = { x: 30, y: 30, width: 140, height: 140, rotation: 0 };

      // Add items to history
      act(() => {
        result.current.setCropRegion(crop1);
      });
      act(() => {
        result.current.setCropRegion(crop2);
      });
      act(() => {
        result.current.setCropRegion(crop3);
      });

      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);

      // Undo to crop2
      act(() => {
        result.current.undo();
      });
      expect(result.current.cropRegion).toEqual(crop2);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(true);

      // Undo to crop1
      act(() => {
        result.current.undo();
      });
      expect(result.current.cropRegion).toEqual(crop1);

      // Redo to crop2
      act(() => {
        result.current.redo();
      });
      expect(result.current.cropRegion).toEqual(crop2);
    });

    it('limits history size', () => {
      const maxHistorySize = 3;
      const { result } = renderHook(() => useCropRegion({ maxHistorySize }));

      // Add more items than history size
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.setCropRegion({
            x: i * 10,
            y: i * 10,
            width: 100,
            height: 100,
            rotation: 0,
          });
        });
      }

      // Should only be able to undo maxHistorySize - 1 times
      let undoCount = 0;
      while (result.current.canUndo) {
        act(() => {
          result.current.undo();
        });
        undoCount++;
      }

      expect(undoCount).toBeLessThanOrEqual(maxHistorySize - 1);
    });

    it('does not add duplicate history entries', () => {
      const { result } = renderHook(() => useCropRegion());

      const sameCrop = { x: 10, y: 10, width: 100, height: 100, rotation: 0 };

      act(() => {
        result.current.setCropRegion(sameCrop);
      });

      const firstUndoState = result.current.canUndo;

      act(() => {
        result.current.setCropRegion(sameCrop); // Same crop again
      });

      // Should not add to history if it's the same
      expect(result.current.canUndo).toBe(firstUndoState);
    });
  });

  describe('Validation', () => {
    it('detects aspect ratio warnings', () => {
      const { result } = renderHook(() => useCropRegion());

      // Very wide aspect ratio
      const wideCrop: CropRegion = {
        x: 0,
        y: 0,
        width: 1000,
        height: 50,
        rotation: 0,
      };

      const validation = result.current.validateCrop(wideCrop, 1200, 800);
      expect(validation.warnings).toContain(
        expect.stringContaining('aspect ratio')
      );
    });

    it('detects rotation warnings', () => {
      const { result } = renderHook(() => useCropRegion());

      const rotatedCrop: CropRegion = {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 45, // Non-90 degree rotation
      };

      const validation = result.current.validateCrop(rotatedCrop, 200, 200);
      expect(validation.warnings).toContain(
        expect.stringContaining('rotation')
      );
    });

    it('validates minimum size requirements', () => {
      const minCropSize = 100;
      const { result } = renderHook(() => useCropRegion({ minCropSize }));

      const smallCrop: CropRegion = {
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        rotation: 0,
      };

      const validation = result.current.validateCrop(smallCrop, 200, 200);
      expect(validation.errors).toContain(
        expect.stringContaining('too small')
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles zero-sized images gracefully', () => {
      const { result } = renderHook(() => useCropRegion());

      const validation = result.current.validateCrop(
        { x: 0, y: 0, width: 50, height: 50, rotation: 0 },
        0,
        0
      );

      expect(validation.isValid).toBe(false);
    });

    it('handles negative image dimensions', () => {
      const { result } = renderHook(() => useCropRegion());

      const constrained = result.current.constrainCrop(
        { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
        -100,
        -100
      );

      // Should not crash and should provide valid bounds
      expect(constrained.width).toBeGreaterThan(0);
      expect(constrained.height).toBeGreaterThan(0);
    });

    it('handles extreme aspect ratios', () => {
      const { result } = renderHook(() => useCropRegion());

      const extremeCrop: CropRegion = {
        x: 0,
        y: 0,
        width: 10000,
        height: 1,
        rotation: 0,
      };

      const validation = result.current.validateCrop(extremeCrop, 10000, 10000);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });
});