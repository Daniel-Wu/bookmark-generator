import { describe, it, expect } from 'vitest';
import {
  validateParameter,
  validateAllParameters,
  normalizeParameters,
  getParameterMessages,
  isParameterValid,
  getSuggestedCorrections,
  getValidationSummary
} from '../../utils/parameterValidation';
import type { BookmarkParameters } from '../../types';
import { DEFAULT_PARAMETERS } from '../../constants';

// ========================
// Test Data
// ========================

const validParameters: BookmarkParameters = {
  colorCount: 4,
  layerThickness: 0.2,
  baseThickness: 2.0,
  width: 50,
  height: 150,
  cornerRadius: 2,
  aspectRatioLocked: false
};

const invalidParameters: BookmarkParameters = {
  colorCount: 15, // Too high
  layerThickness: 0.05, // Too low
  baseThickness: 5.0, // Too high
  width: 10, // Too low
  height: 500, // Too high
  cornerRadius: 50, // Too high for dimensions
  aspectRatioLocked: false
};

describe('Parameter Validation', () => {
  // ========================
  // Individual Parameter Validation
  // ========================

  describe('validateParameter', () => {
    it('validates colorCount correctly', () => {
      // Valid values
      expect(validateParameter('colorCount', 4, validParameters).isValid).toBe(true);
      expect(validateParameter('colorCount', 2, validParameters).isValid).toBe(true);
      expect(validateParameter('colorCount', 8, validParameters).isValid).toBe(true);

      // Invalid values
      expect(validateParameter('colorCount', 1, validParameters).isValid).toBe(false);
      expect(validateParameter('colorCount', 9, validParameters).isValid).toBe(false);
      expect(validateParameter('colorCount', -1, validParameters).isValid).toBe(false);
    });

    it('validates layerThickness correctly', () => {
      // Valid values
      expect(validateParameter('layerThickness', 0.2, validParameters).isValid).toBe(true);
      expect(validateParameter('layerThickness', 0.1, validParameters).isValid).toBe(true);
      expect(validateParameter('layerThickness', 0.5, validParameters).isValid).toBe(true);

      // Invalid values
      expect(validateParameter('layerThickness', 0.05, validParameters).isValid).toBe(false);
      expect(validateParameter('layerThickness', 0.6, validParameters).isValid).toBe(false);
    });

    it('validates baseThickness correctly', () => {
      // Valid values
      expect(validateParameter('baseThickness', 2.0, validParameters).isValid).toBe(true);
      expect(validateParameter('baseThickness', 1.0, validParameters).isValid).toBe(true);
      expect(validateParameter('baseThickness', 3.0, validParameters).isValid).toBe(true);

      // Invalid values
      expect(validateParameter('baseThickness', 0.5, validParameters).isValid).toBe(false);
      expect(validateParameter('baseThickness', 4.0, validParameters).isValid).toBe(false);
    });

    it('validates width correctly', () => {
      // Valid values
      expect(validateParameter('width', 50, validParameters).isValid).toBe(true);
      expect(validateParameter('width', 20, validParameters).isValid).toBe(true);
      expect(validateParameter('width', 200, validParameters).isValid).toBe(true);

      // Invalid values
      expect(validateParameter('width', 10, validParameters).isValid).toBe(false);
      expect(validateParameter('width', 250, validParameters).isValid).toBe(false);
    });

    it('validates height correctly', () => {
      // Valid values
      expect(validateParameter('height', 150, validParameters).isValid).toBe(true);
      expect(validateParameter('height', 30, validParameters).isValid).toBe(true);
      expect(validateParameter('height', 300, validParameters).isValid).toBe(true);

      // Invalid values
      expect(validateParameter('height', 20, validParameters).isValid).toBe(false);
      expect(validateParameter('height', 350, validParameters).isValid).toBe(false);
    });

    it('validates cornerRadius correctly', () => {
      // Valid values
      expect(validateParameter('cornerRadius', 2, validParameters).isValid).toBe(true);
      expect(validateParameter('cornerRadius', 0, validParameters).isValid).toBe(true);
      expect(validateParameter('cornerRadius', 10, validParameters).isValid).toBe(true);

      // Invalid values
      expect(validateParameter('cornerRadius', -1, validParameters).isValid).toBe(false);
      expect(validateParameter('cornerRadius', 15, validParameters).isValid).toBe(false);
    });

    it('includes warnings for edge cases', () => {
      // Very thin layers
      const result1 = validateParameter('layerThickness', 0.1, validParameters);
      expect(result1.warnings.length).toBeGreaterThan(0);

      // High color count
      const result2 = validateParameter('colorCount', 7, validParameters);
      expect(result2.warnings.length).toBeGreaterThan(0);

      // Very narrow width
      const result3 = validateParameter('width', 25, validParameters);
      expect(result3.warnings.length).toBeGreaterThan(0);
    });

    it('handles step validation', () => {
      // Valid step
      expect(validateParameter('layerThickness', 0.2, validParameters).warnings).toHaveLength(0);

      // Invalid step (should warn)
      const result = validateParameter('layerThickness', 0.15, validParameters);
      expect(result.warnings.some(w => w.includes('multiple'))).toBe(true);
    });
  });

  // ========================
  // Full Parameter Set Validation
  // ========================

  describe('validateAllParameters', () => {
    it('validates all valid parameters', () => {
      const result = validateAllParameters(validParameters);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('catches all invalid parameters', () => {
      const result = validateAllParameters(invalidParameters);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('performs cross-parameter validation', () => {
      const problematicParams: BookmarkParameters = {
        ...validParameters,
        cornerRadius: 30, // Too large for dimensions
        width: 50,
        height: 50
      };

      const result = validateAllParameters(problematicParams);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Corner radius'))).toBe(true);
    });

    it('handles strict mode correctly', () => {
      const parametersWithWarnings: BookmarkParameters = {
        ...validParameters,
        colorCount: 7, // Should generate warning
        layerThickness: 0.1 // Should generate warning
      };

      const normalResult = validateAllParameters(parametersWithWarnings);
      expect(normalResult.isValid).toBe(true);
      expect(normalResult.warnings.length).toBeGreaterThan(0);

      const strictResult = validateAllParameters(parametersWithWarnings, { strict: true });
      expect(strictResult.isValid).toBe(false);
    });

    it('can skip dependency checks', () => {
      const problematicParams: BookmarkParameters = {
        ...validParameters,
        cornerRadius: 30, // Too large for dimensions
        width: 50,
        height: 50
      };

      const result = validateAllParameters(problematicParams, { skipDependencyChecks: true });
      // Should still be invalid due to individual parameter validation
      // but cross-parameter errors should be skipped
      const crossParamErrors = result.errors.filter(e => e.includes('dimensions'));
      expect(crossParamErrors).toHaveLength(0);
    });
  });

  // ========================
  // Parameter Normalization
  // ========================

  describe('normalizeParameters', () => {
    it('clamps values to valid ranges', () => {
      const normalized = normalizeParameters(invalidParameters);

      expect(normalized.colorCount).toBeGreaterThanOrEqual(2);
      expect(normalized.colorCount).toBeLessThanOrEqual(8);
      expect(normalized.layerThickness).toBeGreaterThanOrEqual(0.1);
      expect(normalized.layerThickness).toBeLessThanOrEqual(0.5);
      expect(normalized.baseThickness).toBeGreaterThanOrEqual(1.0);
      expect(normalized.baseThickness).toBeLessThanOrEqual(3.0);
      expect(normalized.width).toBeGreaterThanOrEqual(20);
      expect(normalized.width).toBeLessThanOrEqual(200);
      expect(normalized.height).toBeGreaterThanOrEqual(30);
      expect(normalized.height).toBeLessThanOrEqual(300);
      expect(normalized.cornerRadius).toBeGreaterThanOrEqual(0);
      expect(normalized.cornerRadius).toBeLessThanOrEqual(10);
    });

    it('rounds to valid steps', () => {
      const unalignedParams: BookmarkParameters = {
        ...validParameters,
        layerThickness: 0.23, // Should round to 0.2
        cornerRadius: 2.3 // Should round to 2.5
      };

      const normalized = normalizeParameters(unalignedParams);
      expect(normalized.layerThickness).toBe(0.2);
      expect(normalized.cornerRadius).toBe(2.5);
    });

    it('preserves valid values', () => {
      const normalized = normalizeParameters(validParameters);
      expect(normalized).toEqual(validParameters);
    });
  });

  // ========================
  // Utility Functions
  // ========================

  describe('getParameterMessages', () => {
    it('returns errors and warnings for invalid parameter', () => {
      const messages = getParameterMessages('colorCount', 15, validParameters);
      expect(messages.errors.length).toBeGreaterThan(0);
    });

    it('returns empty arrays for valid parameter', () => {
      const messages = getParameterMessages('colorCount', 4, validParameters);
      expect(messages.errors).toHaveLength(0);
    });

    it('includes warnings for edge cases', () => {
      const messages = getParameterMessages('layerThickness', 0.1, validParameters);
      expect(messages.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('isParameterValid', () => {
    it('returns true for valid parameters', () => {
      expect(isParameterValid('colorCount', 4, validParameters)).toBe(true);
      expect(isParameterValid('layerThickness', 0.2, validParameters)).toBe(true);
    });

    it('returns false for invalid parameters', () => {
      expect(isParameterValid('colorCount', 15, validParameters)).toBe(false);
      expect(isParameterValid('layerThickness', 0.05, validParameters)).toBe(false);
    });

    it('handles strict mode', () => {
      // Parameter with warnings only
      expect(isParameterValid('colorCount', 7, validParameters)).toBe(true);
      expect(isParameterValid('colorCount', 7, validParameters, { strict: true })).toBe(false);
    });
  });

  describe('getSuggestedCorrections', () => {
    it('suggests corrections for invalid parameters', () => {
      const corrections = getSuggestedCorrections(invalidParameters);
      
      expect(corrections.colorCount).toBeDefined();
      expect(corrections.layerThickness).toBeDefined();
      expect(corrections.baseThickness).toBeDefined();
      expect(corrections.width).toBeDefined();
      expect(corrections.height).toBeDefined();
      expect(corrections.cornerRadius).toBeDefined();
      
      // All suggestions should be valid
      expect(corrections.colorCount).toBeGreaterThanOrEqual(2);
      expect(corrections.colorCount).toBeLessThanOrEqual(8);
    });

    it('returns empty object for valid parameters', () => {
      const corrections = getSuggestedCorrections(validParameters);
      expect(Object.keys(corrections)).toHaveLength(0);
    });

    it('only suggests corrections for invalid values', () => {
      const partiallyInvalid: BookmarkParameters = {
        ...validParameters,
        colorCount: 15, // Invalid
        layerThickness: 0.2 // Valid
      };

      const corrections = getSuggestedCorrections(partiallyInvalid);
      expect(corrections.colorCount).toBeDefined();
      expect(corrections.layerThickness).toBeUndefined();
    });
  });

  describe('getValidationSummary', () => {
    it('returns success message for valid parameters', () => {
      const summary = getValidationSummary(validParameters);
      expect(summary).toBe('All parameters are valid');
    });

    it('returns error count for invalid parameters', () => {
      const summary = getValidationSummary(invalidParameters);
      expect(summary).toMatch(/\d+ error/);
    });

    it('includes warning count when present', () => {
      const parametersWithWarnings: BookmarkParameters = {
        ...validParameters,
        colorCount: 7 // Should generate warning
      };

      const summary = getValidationSummary(parametersWithWarnings);
      expect(summary).toMatch(/\d+ warning/);
    });

    it('handles both errors and warnings', () => {
      const mixedParams: BookmarkParameters = {
        ...validParameters,
        colorCount: 15, // Error
        layerThickness: 0.1 // Warning
      };

      const summary = getValidationSummary(mixedParams);
      expect(summary).toMatch(/error.*warning|warning.*error/);
    });
  });

  // ========================
  // Edge Cases and Error Handling
  // ========================

  describe('Edge Cases', () => {
    it('handles boundary values correctly', () => {
      // Test exact boundary values
      expect(validateParameter('colorCount', 2, validParameters).isValid).toBe(true);
      expect(validateParameter('colorCount', 8, validParameters).isValid).toBe(true);
      expect(validateParameter('layerThickness', 0.1, validParameters).isValid).toBe(true);
      expect(validateParameter('layerThickness', 0.5, validParameters).isValid).toBe(true);
    });

    it('handles floating point precision', () => {
      const result = validateParameter('layerThickness', 0.30000000001, validParameters);
      expect(result.isValid).toBe(true);
    });

    it('handles negative values appropriately', () => {
      expect(validateParameter('cornerRadius', -1, validParameters).isValid).toBe(false);
      expect(validateParameter('width', -10, validParameters).isValid).toBe(false);
    });

    it('handles very large values', () => {
      expect(validateParameter('width', 1000, validParameters).isValid).toBe(false);
      expect(validateParameter('height', 10000, validParameters).isValid).toBe(false);
    });

    it('validates unknown parameters gracefully', () => {
      // @ts-expect-error - Testing invalid parameter name
      const result = validateParameter('unknownParam', 5, validParameters);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Unknown parameter/);
    });
  });

  // ========================
  // Cross-Parameter Dependencies
  // ========================

  describe('Cross-Parameter Dependencies', () => {
    it('validates corner radius vs dimensions', () => {
      const smallBookmark: BookmarkParameters = {
        ...validParameters,
        width: 20,
        height: 30,
        cornerRadius: 15 // Too large for small dimensions
      };

      const result = validateAllParameters(smallBookmark);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Corner radius'))).toBe(true);
    });

    it('validates total height reasonableness', () => {
      const tallBookmark: BookmarkParameters = {
        ...validParameters,
        colorCount: 8,
        layerThickness: 0.5,
        baseThickness: 3.0 // Total height = 3.0 + 7 * 0.5 = 6.5mm
      };

      const result = validateAllParameters(tallBookmark);
      // Should have warnings about height but still be valid
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('validates aspect ratio reasonableness', () => {
      const wideBookmark: BookmarkParameters = {
        ...validParameters,
        width: 200,
        height: 30 // Very wide aspect ratio
      };

      const result = validateAllParameters(wideBookmark);
      expect(result.warnings.some(w => w.includes('aspect ratio'))).toBe(true);
    });

    it('validates printing feasibility', () => {
      const difficultToPrint: BookmarkParameters = {
        ...validParameters,
        colorCount: 8,
        layerThickness: 0.1 // Many thin layers
      };

      const result = validateAllParameters(difficultToPrint);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ========================
  // Performance Considerations
  // ========================

  describe('Performance', () => {
    it('validates parameters efficiently', () => {
      const start = performance.now();
      
      // Validate many parameter sets
      for (let i = 0; i < 1000; i++) {
        validateAllParameters(validParameters);
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // Should complete 1000 validations in reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('normalizes parameters efficiently', () => {
      const start = performance.now();
      
      // Normalize many parameter sets
      for (let i = 0; i < 1000; i++) {
        normalizeParameters(invalidParameters);
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // Should complete 1000 normalizations in reasonable time (< 50ms)
      expect(duration).toBeLessThan(50);
    });
  });
});