import type { BookmarkParameters, ValidationResult } from '../types';
import { PARAMETER_LIMITS } from '../constants';

// ========================
// Parameter Validation Types
// ========================

export interface ParameterValidationRule {
  field: keyof BookmarkParameters;
  validate: (value: number, parameters: BookmarkParameters) => ValidationResult;
}

export interface ParameterConstraint {
  min?: number;
  max?: number;
  step?: number;
  customValidator?: (value: number, parameters: BookmarkParameters) => string | null;
}

export interface ValidationOptions {
  strict?: boolean; // Whether to include warnings as errors
  skipDependencyChecks?: boolean; // Skip validations that depend on other parameters
}

// ========================
// Core Validation Functions
// ========================

/**
 * Validates a single parameter value against its constraints
 */
export function validateParameter(
  field: keyof BookmarkParameters,
  value: number,
  parameters: BookmarkParameters,
  options: ValidationOptions = {}
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  const limits = PARAMETER_LIMITS[field];
  if (!limits) {
    result.errors.push(`Unknown parameter: ${field}`);
    result.isValid = false;
    return result;
  }

  // Basic range validation
  if (value < limits.min) {
    result.errors.push(`${field} must be at least ${limits.min}`);
    result.isValid = false;
  }

  if (value > limits.max) {
    result.errors.push(`${field} must be at most ${limits.max}`);
    result.isValid = false;
  }

  // Step validation
  const remainder = (value - limits.min) % limits.step;
  if (Math.abs(remainder) > 0.001 && Math.abs(remainder - limits.step) > 0.001) {
    result.warnings.push(`${field} should be a multiple of ${limits.step}`);
  }

  // Field-specific validations
  switch (field) {
    case 'colorCount':
      validateColorCount(value, parameters, result, options);
      break;
    case 'layerThickness':
      validateLayerThickness(value, parameters, result, options);
      break;
    case 'baseThickness':
      validateBaseThickness(value, parameters, result, options);
      break;
    case 'width':
      validateWidth(value, parameters, result, options);
      break;
    case 'height':
      validateHeight(value, parameters, result, options);
      break;
    case 'cornerRadius':
      validateCornerRadius(value, parameters, result, options);
      break;
  }

  // Mark as invalid if warnings are considered errors in strict mode
  if (options.strict && result.warnings.length > 0) {
    result.isValid = false;
  }

  return result;
}

/**
 * Validates all parameters in a BookmarkParameters object
 */
export function validateAllParameters(
  parameters: BookmarkParameters,
  options: ValidationOptions = {}
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Validate individual parameters
  Object.entries(parameters).forEach(([field, value]) => {
    // Skip validation for non-numeric values
    if (typeof value !== 'number') {
      return;
    }
    
    const fieldResult = validateParameter(
      field as keyof BookmarkParameters,
      value,
      parameters,
      options
    );

    result.errors.push(...fieldResult.errors.map(error => `${field}: ${error}`));
    result.warnings.push(...fieldResult.warnings.map(warning => `${field}: ${warning}`));
  });

  // Cross-parameter validations (if not skipped)
  if (!options.skipDependencyChecks) {
    validateParameterDependencies(parameters, result, options);
  }

  result.isValid = result.errors.length === 0 && (options.strict ? result.warnings.length === 0 : true);

  return result;
}

/**
 * Auto-corrects parameter values to be within valid ranges
 */
export function normalizeParameters(parameters: BookmarkParameters): BookmarkParameters {
  const normalized = { ...parameters };

  Object.entries(PARAMETER_LIMITS).forEach(([field, limits]) => {
    const value = normalized[field as keyof BookmarkParameters];
    
    // Skip non-numeric values
    if (typeof value !== 'number') {
      return;
    }
    
    // Clamp to valid range
    let correctedValue = Math.max(limits.min, Math.min(limits.max, value));
    
    // Round to nearest valid step
    const stepCount = Math.round((correctedValue - limits.min) / limits.step);
    correctedValue = limits.min + stepCount * limits.step;
    
    // Handle floating point precision
    correctedValue = parseFloat(correctedValue.toFixed(3));
    
    (normalized as any)[field] = correctedValue;
  });

  return normalized;
}

// ========================
// Field-Specific Validations
// ========================

function validateColorCount(
  value: number,
  _parameters: BookmarkParameters,
  result: ValidationResult,
  _options: ValidationOptions
): void {
  if (value < 2) {
    result.warnings.push('At least 2 colors recommended for meaningful layering');
  }

  if (value > 6) {
    result.warnings.push('More than 6 colors may result in complex printing');
  }

  // Performance warning for high color counts
  if (value > 8) {
    result.warnings.push('High color counts may impact processing performance');
  }
}

function validateLayerThickness(
  value: number,
  parameters: BookmarkParameters,
  result: ValidationResult,
  _options: ValidationOptions
): void {
  // Warn about very thin layers
  if (value < 0.15) {
    result.warnings.push('Very thin layers may be difficult to print reliably');
  }

  // Warn about thick layers with fine details
  if (value > 0.3 && parameters.colorCount > 4) {
    result.warnings.push('Thick layers with many colors may lose fine detail');
  }

  // Check total height reasonableness
  const totalHeight = parameters.baseThickness + (parameters.colorCount - 1) * value;
  if (totalHeight > 10) {
    result.warnings.push('Total height may be too large for practical use');
  }
}

function validateBaseThickness(
  value: number,
  parameters: BookmarkParameters,
  result: ValidationResult,
  _options: ValidationOptions
): void {
  // Warn about very thin base
  if (value < 1.5) {
    result.warnings.push('Thin base may result in fragile bookmark');
  }

  // Check proportion with dimensions
  const minDimension = Math.min(parameters.width, parameters.height);
  if (value > minDimension / 10) {
    result.warnings.push('Base thickness is large relative to bookmark dimensions');
  }
}

function validateWidth(
  value: number,
  parameters: BookmarkParameters,
  result: ValidationResult,
  _options: ValidationOptions
): void {
  // Warn about very small bookmarks
  if (value < 30) {
    result.warnings.push('Very narrow bookmarks may be hard to handle');
  }

  // Warn about very large bookmarks
  if (value > 100) {
    result.warnings.push('Wide bookmarks may not fit in standard books');
  }

  // Check aspect ratio reasonableness
  const aspectRatio = value / parameters.height;
  if (aspectRatio > 2) {
    result.warnings.push('Very wide aspect ratio may not be practical');
  }
}

function validateHeight(
  value: number,
  parameters: BookmarkParameters,
  result: ValidationResult,
  _options: ValidationOptions
): void {
  // Warn about very short bookmarks
  if (value < 50) {
    result.warnings.push('Very short bookmarks may not extend from books');
  }

  // Warn about very tall bookmarks
  if (value > 250) {
    result.warnings.push('Very tall bookmarks may be unwieldy');
  }

  // Check aspect ratio reasonableness
  const aspectRatio = parameters.width / value;
  if (aspectRatio < 0.1) {
    result.warnings.push('Very tall aspect ratio may be fragile');
  }
}

function validateCornerRadius(
  value: number,
  parameters: BookmarkParameters,
  result: ValidationResult,
  _options: ValidationOptions
): void {
  const minDimension = Math.min(parameters.width, parameters.height);
  
  // Check if corner radius is too large for dimensions
  if (value > minDimension / 4) {
    result.warnings.push('Corner radius may be too large for bookmark dimensions');
  }

  // Maximum practical corner radius
  if (value > minDimension / 2) {
    result.errors.push('Corner radius cannot be larger than half the smallest dimension');
  }
}

// ========================
// Cross-Parameter Validations
// ========================

function validateParameterDependencies(
  parameters: BookmarkParameters,
  result: ValidationResult,
  _options: ValidationOptions
): void {
  // Check total height vs. dimensions
  const totalHeight = parameters.baseThickness + (parameters.colorCount - 1) * parameters.layerThickness;
  const maxDimension = Math.max(parameters.width, parameters.height);
  
  if (totalHeight > maxDimension / 5) {
    result.warnings.push('Total thickness is large relative to bookmark size');
  }

  // Check corner radius vs. dimensions
  const minDimension = Math.min(parameters.width, parameters.height);
  if (parameters.cornerRadius * 2 > minDimension) {
    result.errors.push('Corner radius is too large for bookmark dimensions');
  }

  // Check printing feasibility
  if (parameters.layerThickness < 0.1 && parameters.colorCount > 6) {
    result.warnings.push('Very thin layers with many colors may be challenging to print');
  }

  // Check structural integrity
  if (parameters.baseThickness < 1.0 && maxDimension > 150) {
    result.warnings.push('Thin base with large dimensions may result in warping');
  }

  // Check material usage efficiency
  const volume = parameters.width * parameters.height * totalHeight;
  if (volume > 50000) { // mm³
    result.warnings.push('Large bookmark may use significant printing material');
  }
}

// ========================
// Validation Utilities
// ========================

/**
 * Gets validation messages for a specific parameter
 */
export function getParameterMessages(
  field: keyof BookmarkParameters,
  value: number,
  parameters: BookmarkParameters,
  options: ValidationOptions = {}
): { errors: string[], warnings: string[] } {
  const result = validateParameter(field, value, parameters, options);
  return {
    errors: result.errors,
    warnings: result.warnings
  };
}

/**
 * Checks if a parameter value would be valid
 */
export function isParameterValid(
  field: keyof BookmarkParameters,
  value: number,
  parameters: BookmarkParameters,
  options: ValidationOptions = {}
): boolean {
  const result = validateParameter(field, value, parameters, options);
  return result.isValid;
}

/**
 * Gets suggested corrections for invalid parameters
 */
export function getSuggestedCorrections(
  parameters: BookmarkParameters
): Partial<BookmarkParameters> {
  const corrections: Partial<BookmarkParameters> = {};
  const normalized = normalizeParameters(parameters);

  Object.entries(parameters).forEach(([field, value]) => {
    const normalizedValue = normalized[field as keyof BookmarkParameters];
    if (typeof value === 'number' && typeof normalizedValue === 'number' && Math.abs(value - normalizedValue) > 0.001) {
      (corrections as any)[field] = normalizedValue;
    }
  });

  return corrections;
}

/**
 * Creates a human-readable validation summary
 */
export function getValidationSummary(
  parameters: BookmarkParameters,
  options: ValidationOptions = {}
): string {
  const result = validateAllParameters(parameters, options);
  
  if (result.isValid) {
    return 'All parameters are valid';
  }

  const parts = [];
  
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`);
  }
  
  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}`);
  }

  return `Parameters have ${parts.join(' and ')}`;
}

export default {
  validateParameter,
  validateAllParameters,
  normalizeParameters,
  getParameterMessages,
  isParameterValid,
  getSuggestedCorrections,
  getValidationSummary
};