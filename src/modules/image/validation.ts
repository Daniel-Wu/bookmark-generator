/**
 * Comprehensive image validation module for the 3D bookmark generator
 */

import type { 
  ValidationResult, 
  SupportedImageFormat, 
  ImageMetadata 
} from '../../types';
import {
  ValidationError,
  FileFormatError,
  FileSizeError,
  DimensionError,
  CorruptedFileError,
  MemoryError,
  ValidationErrorCode,
  type ErrorRecoverySuggestion
} from '../../types/errors';
import {
  SUPPORTED_FORMATS,
  FILE_CONSTRAINTS,
  extractImageMetadata,
  validateImageHeaders,
  checkMemoryConstraints,
  createImageFromFile,
  isValidBookmarkAspectRatio,
  calculateAspectRatio
} from '../../utils/fileProcessing';

// ========================
// Main Validation Functions
// ========================

/**
 * Comprehensive validation of an uploaded image file
 */
export async function validateImageFile(file: File): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // 1. Basic file validation
    const fileValidation = validateFileFormat(file);
    if (!fileValidation.isValid) {
      errors.push(...fileValidation.errors);
      warnings.push(...fileValidation.warnings);
      
      // Don't continue if format is invalid
      return { isValid: false, errors, warnings };
    }
    
    // 2. File size validation
    const sizeValidation = validateFileSize(file);
    if (!sizeValidation.isValid) {
      errors.push(...sizeValidation.errors);
    }
    warnings.push(...sizeValidation.warnings);
    
    // 3. Header integrity check (skip in test environments)
    if (typeof window !== 'undefined' && typeof window.FileReader !== 'undefined') {
      try {
        const headerValidation = await validateImageHeaders(file);
        if (!headerValidation.isValid) {
          errors.push(...headerValidation.errors);
        }
        warnings.push(...headerValidation.warnings);
      } catch (headerError) {
        warnings.push('Could not validate file headers');
      }
    }
    
    // 4. Image loading and dimension validation
    let image: HTMLImageElement;
    try {
      image = await createImageFromFile(file);
      
      const dimensionValidation = validateImageDimensions(image);
      if (!dimensionValidation.isValid) {
        errors.push(...dimensionValidation.errors);
      }
      warnings.push(...dimensionValidation.warnings);
      
      // 5. Memory constraints check
      const memoryValidation = checkMemoryConstraints(image.naturalWidth, image.naturalHeight);
      if (!memoryValidation.isValid) {
        errors.push(...memoryValidation.errors);
      }
      warnings.push(...memoryValidation.warnings);
      
      // 6. Image content validation (skip in test environments without proper DOM)
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        try {
          const contentValidation = await validateImageContent(image);
          if (!contentValidation.isValid) {
            errors.push(...contentValidation.errors);
          }
          warnings.push(...contentValidation.warnings);
        } catch (contentError) {
          warnings.push('Could not validate image content');
        }
      }
    } catch (error) {
      errors.push(`Failed to load image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors, warnings };
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
    
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings
    };
  }
}

/**
 * Validates image file format and MIME type
 */
export function validateFileFormat(file: File): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Get file extension
  const extension = file.name.toLowerCase().split('.').pop();
  const validExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
  
  // Check MIME type first (most reliable)
  if (file.type && SUPPORTED_FORMATS.includes(file.type as SupportedImageFormat)) {
    // MIME type is valid, check extension consistency
    const expectedExtension = getExtensionFromMimeType(file.type);
    if (extension && extension !== expectedExtension && !isAlternativeExtension(extension, file.type)) {
      warnings.push('File extension does not match MIME type, but MIME type is valid');
    }
    return { isValid: true, errors, warnings };
  }
  
  // No valid MIME type, check extension as fallback
  if (!file.type) {
    warnings.push('File type could not be determined from MIME type');
    if (extension && validExtensions.includes(extension)) {
      // Extension is valid, allow it
      return { isValid: true, errors, warnings };
    }
  } else {
    // Invalid MIME type
    errors.push(`Unsupported file format: ${file.type}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
  }
  
  // Check extension
  if (!extension || !validExtensions.includes(extension)) {
    errors.push(`Invalid file extension: .${extension || 'none'}. Valid extensions: ${validExtensions.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates file size constraints
 */
export function validateFileSize(file: File): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (file.size < FILE_CONSTRAINTS.MIN_SIZE) {
    errors.push(
      `File size ${formatFileSize(file.size)} is too small. ` +
      `Minimum size: ${formatFileSize(FILE_CONSTRAINTS.MIN_SIZE)}`
    );
  } else if (file.size > FILE_CONSTRAINTS.MAX_SIZE) {
    errors.push(
      `File size ${formatFileSize(file.size)} is too large. ` +
      `Maximum size: ${formatFileSize(FILE_CONSTRAINTS.MAX_SIZE)}`
    );
  } else if (file.size > FILE_CONSTRAINTS.MAX_SIZE * 0.8) {
    warnings.push(
      `File size ${formatFileSize(file.size)} is quite large and may impact performance`
    );
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates image dimensions
 */
export function validateImageDimensions(image: HTMLImageElement): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const { naturalWidth: width, naturalHeight: height } = image;
  
  // Check minimum dimensions
  if (width < FILE_CONSTRAINTS.MIN_DIMENSION || height < FILE_CONSTRAINTS.MIN_DIMENSION) {
    errors.push(
      `Image dimensions ${width}×${height}px are too small. ` +
      `Minimum: ${FILE_CONSTRAINTS.MIN_DIMENSION}×${FILE_CONSTRAINTS.MIN_DIMENSION}px`
    );
  }
  
  // Check maximum dimensions
  if (width > FILE_CONSTRAINTS.MAX_DIMENSION || height > FILE_CONSTRAINTS.MAX_DIMENSION) {
    errors.push(
      `Image dimensions ${width}×${height}px are too large. ` +
      `Maximum: ${FILE_CONSTRAINTS.MAX_DIMENSION}×${FILE_CONSTRAINTS.MAX_DIMENSION}px`
    );
  }
  
  // Check aspect ratio for bookmark suitability
  const aspectRatio = calculateAspectRatio(width, height);
  if (!isValidBookmarkAspectRatio(aspectRatio)) {
    warnings.push(
      `Aspect ratio ${aspectRatio.toFixed(2)}:1 may not be suitable for bookmarks. ` +
      'Consider using an image with a more rectangular aspect ratio.'
    );
  }
  
  // Performance warnings for large images
  const totalPixels = width * height;
  const maxRecommendedPixels = 2048 * 2048; // 4MP
  
  if (totalPixels > maxRecommendedPixels) {
    warnings.push(
      `Image has ${(totalPixels / 1000000).toFixed(1)}MP. ` +
      'Large images may take longer to process.'
    );
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates image content and quality
 */
export async function validateImageContent(image: HTMLImageElement): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Create canvas for analysis
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      errors.push('Canvas 2D context not supported');
      return { isValid: false, errors, warnings };
    }
    
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    
    ctx.drawImage(image, 0, 0);
    
    // Get image data for analysis
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Check for empty or solid color image
    const contentValidation = analyzeImageContent(data);
    if (!contentValidation.isValid) {
      errors.push(...contentValidation.errors);
    }
    warnings.push(...contentValidation.warnings);
    
    // Analyze color complexity
    const colorValidation = analyzeColorComplexity(data);
    warnings.push(...colorValidation.warnings);
    
  } catch (error) {
    errors.push(`Content validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ========================
// Content Analysis Functions
// ========================

/**
 * Analyzes basic image content
 */
function analyzeImageContent(data: Uint8ClampedArray): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const pixelCount = data.length / 4;
  
  if (pixelCount === 0) {
    errors.push('Image contains no pixel data');
    return { isValid: false, errors, warnings };
  }
  
  // Check for completely transparent image
  let opaquePixels = 0;
  let uniqueColors = new Set<string>();
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    if (a > 0) {
      opaquePixels++;
      uniqueColors.add(`${r},${g},${b}`);
    }
  }
  
  // Check for empty image (all transparent)
  if (opaquePixels === 0) {
    errors.push('Image is completely transparent');
  } else if (opaquePixels < pixelCount * 0.1) {
    warnings.push('Image is mostly transparent, which may not work well for 3D printing');
  }
  
  // Check for solid color image
  if (uniqueColors.size === 1) {
    warnings.push('Image appears to be a solid color. Consider using an image with more detail.');
  } else if (uniqueColors.size < 10) {
    warnings.push('Image has very few colors. This may result in a simple 3D model.');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Analyzes color complexity for 3D processing
 */
function analyzeColorComplexity(data: Uint8ClampedArray): ValidationResult {
  const warnings: string[] = [];
  
  // Sample pixels for performance (max 10k pixels)
  const maxSamples = 10000;
  const step = Math.max(1, Math.floor(data.length / 4 / maxSamples));
  
  const colors = new Map<string, number>();
  let totalPixels = 0;
  
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    if (a > 0) {
      const colorKey = `${r},${g},${b}`;
      colors.set(colorKey, (colors.get(colorKey) || 0) + 1);
      totalPixels++;
    }
  }
  
  const uniqueColors = colors.size;
  
  // Analyze color distribution
  if (uniqueColors > 1000) {
    warnings.push(
      'Image has many colors. Color quantization may significantly change the appearance.'
    );
  }
  
  // Check for dominant colors
  const colorCounts = Array.from(colors.values()).sort((a, b) => b - a);
  const dominantColorRatio = colorCounts[0] / totalPixels;
  
  if (dominantColorRatio > 0.8) {
    warnings.push(
      'Image is dominated by a single color. Consider using an image with more color variation.'
    );
  }
  
  return {
    isValid: true,
    errors: [],
    warnings
  };
}

// ========================
// Error Creation Helpers
// ========================

/**
 * Creates a validation error with recovery suggestions
 */
export function createValidationError(
  code: ValidationErrorCode,
  message: string,
  field?: string,
  actualValue?: unknown,
  expectedValue?: unknown,
  suggestions: ErrorRecoverySuggestion[] = []
): ValidationError {
  return new ValidationError({
    code,
    message,
    field,
    actualValue,
    expectedValue,
    suggestions,
    recoverable: suggestions.length > 0
  });
}

/**
 * Creates format validation error with suggestions
 */
export function createFormatError(file: File): FileFormatError {
  const suggestions: ErrorRecoverySuggestion[] = [
    {
      action: 'Convert to PNG',
      description: 'Convert your image to PNG format using an image editor',
      autoApplicable: false,
      severity: 'medium'
    },
    {
      action: 'Convert to JPEG',
      description: 'Convert your image to JPEG format for smaller file size',
      autoApplicable: false,
      severity: 'medium'
    }
  ];
  
  return new FileFormatError(file.type, SUPPORTED_FORMATS, suggestions);
}

/**
 * Creates size validation error with auto-resize suggestions
 */
export function createSizeError(file: File): FileSizeError {
  const autoResizeSuggestion: ErrorRecoverySuggestion = {
    action: 'Auto-resize image',
    description: 'Automatically resize the image to fit size constraints',
    autoApplicable: true,
    severity: 'low'
  };
  
  return new FileSizeError(
    file.size,
    FILE_CONSTRAINTS.MIN_SIZE,
    FILE_CONSTRAINTS.MAX_SIZE,
    [autoResizeSuggestion]
  );
}

/**
 * Creates dimension validation error with auto-resize suggestions
 */
export function createDimensionError(
  width: number,
  height: number
): DimensionError {
  const autoResizeSuggestion: ErrorRecoverySuggestion = {
    action: 'Auto-resize to fit constraints',
    description: 'Automatically resize the image to fit dimension constraints',
    autoApplicable: true,
    severity: 'low'
  };
  
  return new DimensionError(
    width,
    height,
    FILE_CONSTRAINTS.MIN_DIMENSION,
    FILE_CONSTRAINTS.MAX_DIMENSION,
    [autoResizeSuggestion]
  );
}

// ========================
// Validation Result Helpers
// ========================

/**
 * Combines multiple validation results
 */
export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  
  for (const result of results) {
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

/**
 * Creates a validation result from an error
 */
export function validationResultFromError(error: Error): ValidationResult {
  return {
    isValid: false,
    errors: [error.message],
    warnings: []
  };
}

// ========================
// Utility Functions
// ========================

/**
 * Gets expected file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/gif': return 'gif';
    case 'image/webp': return 'webp';
    default: return '';
  }
}

/**
 * Checks if extension is an alternative for the MIME type
 */
function isAlternativeExtension(extension: string, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') {
    return extension === 'jpeg' || extension === 'jpg';
  }
  return false;
}

/**
 * Formats file size for human reading
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}