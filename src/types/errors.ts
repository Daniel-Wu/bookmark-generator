/**
 * Error types and classes for image validation and processing
 */

import type { ProcessingStage } from './image';

// ========================
// Error Codes
// ========================

export const ValidationErrorCode = {
  // File format errors
  INVALID_FORMAT: 'INVALID_FORMAT',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  CORRUPTED_FILE: 'CORRUPTED_FILE',
  INVALID_MIME_TYPE: 'INVALID_MIME_TYPE',
  
  // File size errors
  FILE_TOO_SMALL: 'FILE_TOO_SMALL',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  
  // Dimension errors
  DIMENSIONS_TOO_SMALL: 'DIMENSIONS_TOO_SMALL',
  DIMENSIONS_TOO_LARGE: 'DIMENSIONS_TOO_LARGE',
  INVALID_ASPECT_RATIO: 'INVALID_ASPECT_RATIO',
  
  // Image content errors
  INSUFFICIENT_COLOR_DEPTH: 'INSUFFICIENT_COLOR_DEPTH',
  TOO_MANY_COLORS: 'TOO_MANY_COLORS',
  EMPTY_IMAGE: 'EMPTY_IMAGE',
  CORRUPTED_IMAGE_DATA: 'CORRUPTED_IMAGE_DATA',
  
  // Memory and performance errors
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',
  
  // System errors
  CANVAS_NOT_SUPPORTED: 'CANVAS_NOT_SUPPORTED',
  FILE_READER_ERROR: 'FILE_READER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ValidationErrorCode = typeof ValidationErrorCode[keyof typeof ValidationErrorCode];

// ========================
// Error Recovery Suggestions
// ========================

export interface ErrorRecoverySuggestion {
  action: string;
  description: string;
  autoApplicable: boolean;
  severity: 'low' | 'medium' | 'high';
}

export interface ValidationErrorDetails {
  code: ValidationErrorCode;
  message: string;
  field?: string;
  actualValue?: unknown;
  expectedValue?: unknown;
  suggestions: ErrorRecoverySuggestion[];
  recoverable: boolean;
}

// ========================
// Custom Error Classes
// ========================

/**
 * Base class for all validation errors
 */
export class ValidationError extends Error {
  public readonly code: ValidationErrorCode;
  public readonly field?: string;
  public readonly actualValue?: unknown;
  public readonly expectedValue?: unknown;
  public readonly suggestions: ErrorRecoverySuggestion[];
  public readonly recoverable: boolean;

  constructor(details: ValidationErrorDetails) {
    super(details.message);
    this.name = 'ValidationError';
    this.code = details.code;
    this.field = details.field;
    this.actualValue = details.actualValue;
    this.expectedValue = details.expectedValue;
    this.suggestions = details.suggestions;
    this.recoverable = details.recoverable;
  }
}

/**
 * File format validation errors
 */
export class FileFormatError extends ValidationError {
  constructor(
    actualFormat: string,
    supportedFormats: string[],
    suggestions: ErrorRecoverySuggestion[] = []
  ) {
    super({
      code: ValidationErrorCode.INVALID_FORMAT,
      message: `Invalid file format: ${actualFormat}. Supported formats: ${supportedFormats.join(', ')}`,
      field: 'format',
      actualValue: actualFormat,
      expectedValue: supportedFormats,
      suggestions: [
        {
          action: 'Convert to supported format',
          description: `Convert your image to one of: ${supportedFormats.join(', ')}`,
          autoApplicable: false,
          severity: 'medium'
        },
        ...suggestions
      ],
      recoverable: true
    });
  }
}

/**
 * File size validation errors
 */
export class FileSizeError extends ValidationError {
  constructor(
    actualSize: number,
    minSize: number,
    maxSize: number,
    suggestions: ErrorRecoverySuggestion[] = []
  ) {
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const isTooBig = actualSize > maxSize;
    const code = isTooBig ? ValidationErrorCode.FILE_TOO_LARGE : ValidationErrorCode.FILE_TOO_SMALL;
    
    super({
      code,
      message: `File size ${formatSize(actualSize)} is ${isTooBig ? 'too large' : 'too small'}. Must be between ${formatSize(minSize)} and ${formatSize(maxSize)}`,
      field: 'size',
      actualValue: actualSize,
      expectedValue: { min: minSize, max: maxSize },
      suggestions: isTooBig ? [
        {
          action: 'Compress image',
          description: 'Reduce image quality or use a compression tool',
          autoApplicable: true,
          severity: 'low'
        },
        {
          action: 'Resize image',
          description: 'Reduce image dimensions to decrease file size',
          autoApplicable: true,
          severity: 'medium'
        },
        ...suggestions
      ] : [
        {
          action: 'Use higher quality image',
          description: 'Try using a higher resolution or less compressed version',
          autoApplicable: false,
          severity: 'medium'
        },
        ...suggestions
      ],
      recoverable: true
    });
  }
}

/**
 * Image dimension validation errors
 */
export class DimensionError extends ValidationError {
  constructor(
    actualWidth: number,
    actualHeight: number,
    minDimension: number,
    maxDimension: number,
    suggestions: ErrorRecoverySuggestion[] = []
  ) {
    const isTooSmall = actualWidth < minDimension || actualHeight < minDimension;
    const isTooBig = actualWidth > maxDimension || actualHeight > maxDimension;
    
    let code: ValidationErrorCode = ValidationErrorCode.INVALID_ASPECT_RATIO;
    if (isTooSmall) code = ValidationErrorCode.DIMENSIONS_TOO_SMALL;
    if (isTooBig) code = ValidationErrorCode.DIMENSIONS_TOO_LARGE;

    super({
      code,
      message: `Image dimensions ${actualWidth}x${actualHeight}px are ${
        isTooSmall ? 'too small' : isTooBig ? 'too large' : 'invalid'
      }. Must be between ${minDimension}x${minDimension}px and ${maxDimension}x${maxDimension}px`,
      field: 'dimensions',
      actualValue: { width: actualWidth, height: actualHeight },
      expectedValue: { 
        min: { width: minDimension, height: minDimension },
        max: { width: maxDimension, height: maxDimension }
      },
      suggestions: isTooSmall ? [
        {
          action: 'Use higher resolution image',
          description: 'Try using a larger version of the image',
          autoApplicable: false,
          severity: 'medium'
        },
        {
          action: 'Upscale image',
          description: 'Increase image size using image editing software',
          autoApplicable: false,
          severity: 'high'
        },
        ...suggestions
      ] : isTooBig ? [
        {
          action: 'Resize image',
          description: `Resize to maximum ${maxDimension}x${maxDimension}px`,
          autoApplicable: true,
          severity: 'low'
        },
        {
          action: 'Crop image',
          description: 'Crop to focus on the important area',
          autoApplicable: false,
          severity: 'medium'
        },
        ...suggestions
      ] : suggestions,
      recoverable: true
    });
  }
}

/**
 * Image processing errors during various stages
 */
export class ImageProcessingError extends Error {
  public readonly stage: ProcessingStage;
  public readonly recoverable: boolean;
  public readonly suggestions: ErrorRecoverySuggestion[];

  constructor(
    stage: ProcessingStage,
    message: string,
    recoverable: boolean = false,
    suggestions: ErrorRecoverySuggestion[] = []
  ) {
    super(message);
    this.name = 'ImageProcessingError';
    this.stage = stage;
    this.recoverable = recoverable;
    this.suggestions = suggestions;
  }
}

/**
 * Memory limit exceeded errors
 */
export class MemoryError extends ValidationError {
  constructor(
    requiredMemory: number,
    availableMemory: number,
    suggestions: ErrorRecoverySuggestion[] = []
  ) {
    const formatMemory = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    
    super({
      code: ValidationErrorCode.MEMORY_LIMIT_EXCEEDED,
      message: `Insufficient memory: requires ${formatMemory(requiredMemory)}, available ${formatMemory(availableMemory)}`,
      field: 'memory',
      actualValue: availableMemory,
      expectedValue: requiredMemory,
      suggestions: [
        {
          action: 'Reduce image size',
          description: 'Resize the image to use less memory',
          autoApplicable: true,
          severity: 'medium'
        },
        {
          action: 'Close other applications',
          description: 'Free up system memory by closing unused applications',
          autoApplicable: false,
          severity: 'low'
        },
        ...suggestions
      ],
      recoverable: true
    });
  }
}

/**
 * Corrupted file errors
 */
export class CorruptedFileError extends ValidationError {
  constructor(reason: string, suggestions: ErrorRecoverySuggestion[] = []) {
    super({
      code: ValidationErrorCode.CORRUPTED_FILE,
      message: `File appears to be corrupted: ${reason}`,
      field: 'integrity',
      suggestions: [
        {
          action: 'Try different file',
          description: 'Use a different version of the image file',
          autoApplicable: false,
          severity: 'high'
        },
        {
          action: 'Re-download or re-export',
          description: 'Download the file again or export from the original source',
          autoApplicable: false,
          severity: 'medium'
        },
        ...suggestions
      ],
      recoverable: false
    });
  }
}

// ========================
// Error Helper Functions
// ========================

/**
 * Creates user-friendly error messages with suggestions
 */
export function createUserFriendlyError(error: ValidationError): {
  title: string;
  message: string;
  suggestions: ErrorRecoverySuggestion[];
  recoverable: boolean;
} {
  const errorTitles: Record<ValidationErrorCode, string> = {
    [ValidationErrorCode.INVALID_FORMAT]: 'Unsupported File Format',
    [ValidationErrorCode.UNSUPPORTED_FORMAT]: 'Format Not Supported',
    [ValidationErrorCode.CORRUPTED_FILE]: 'Corrupted File',
    [ValidationErrorCode.INVALID_MIME_TYPE]: 'Invalid File Type',
    [ValidationErrorCode.FILE_TOO_SMALL]: 'File Too Small',
    [ValidationErrorCode.FILE_TOO_LARGE]: 'File Too Large',
    [ValidationErrorCode.DIMENSIONS_TOO_SMALL]: 'Image Too Small',
    [ValidationErrorCode.DIMENSIONS_TOO_LARGE]: 'Image Too Large',
    [ValidationErrorCode.INVALID_ASPECT_RATIO]: 'Invalid Dimensions',
    [ValidationErrorCode.INSUFFICIENT_COLOR_DEPTH]: 'Insufficient Color Depth',
    [ValidationErrorCode.TOO_MANY_COLORS]: 'Too Many Colors',
    [ValidationErrorCode.EMPTY_IMAGE]: 'Empty Image',
    [ValidationErrorCode.CORRUPTED_IMAGE_DATA]: 'Corrupted Image Data',
    [ValidationErrorCode.MEMORY_LIMIT_EXCEEDED]: 'Not Enough Memory',
    [ValidationErrorCode.PROCESSING_TIMEOUT]: 'Processing Timeout',
    [ValidationErrorCode.CANVAS_NOT_SUPPORTED]: 'Canvas Not Supported',
    [ValidationErrorCode.FILE_READER_ERROR]: 'File Reading Error',
    [ValidationErrorCode.UNKNOWN_ERROR]: 'Unknown Error'
  };

  return {
    title: errorTitles[error.code] || 'Validation Error',
    message: error.message,
    suggestions: error.suggestions,
    recoverable: error.recoverable
  };
}

/**
 * Checks if an error can be automatically resolved
 */
export function canAutoResolveError(error: ValidationError): boolean {
  return error.recoverable && error.suggestions.some(s => s.autoApplicable);
}

/**
 * Gets the most appropriate auto-resolution suggestion
 */
export function getAutoResolutionSuggestion(error: ValidationError): ErrorRecoverySuggestion | null {
  const autoSuggestions = error.suggestions.filter(s => s.autoApplicable);
  if (autoSuggestions.length === 0) return null;
  
  // Prefer low severity suggestions first
  return autoSuggestions.sort((a, b) => {
    const severityOrder = { low: 0, medium: 1, high: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  })[0];
}