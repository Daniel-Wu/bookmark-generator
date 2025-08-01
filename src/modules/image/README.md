# Image Validation Module

Comprehensive image validation and error handling system for the 3D Bookmark Generator.

## Overview

This module provides robust validation for uploaded image files, ensuring they meet the requirements for 3D bookmark generation. It includes format validation, size constraints, dimension checks, content analysis, and comprehensive error handling with recovery suggestions.

## Features

- **File Format Validation**: Support for PNG, JPEG, GIF, and WebP formats
- **Size Validation**: File size constraints (100KB - 10MB)
- **Dimension Validation**: Image dimension limits (50x50px - 4096x4096px)
- **Header Integrity**: Binary header validation to detect corrupted files
- **Content Analysis**: Color complexity and transparency analysis
- **Memory Management**: Memory usage estimation and limits
- **Error Recovery**: Actionable suggestions for fixing validation issues
- **Performance Optimized**: Fast validation with async processing

## Quick Start

```typescript
import { validateImageFile } from './modules/image/validation';

// Basic validation
const file = // ... File object from input
const result = await validateImageFile(file);

if (result.isValid) {
  console.log('✅ File is valid!');
  if (result.warnings.length > 0) {
    console.log('Warnings:', result.warnings);
  }
} else {
  console.log('❌ Validation failed:', result.errors);
}
```

## API Reference

### Main Validation Functions

#### `validateImageFile(file: File): Promise<ValidationResult>`

Comprehensive validation of an uploaded image file. This is the main entry point that runs all validation checks.

**Parameters:**
- `file: File` - The uploaded file to validate

**Returns:**
- `Promise<ValidationResult>` - Validation result with errors and warnings

**Example:**
```typescript
const result = await validateImageFile(file);
console.log('Valid:', result.isValid);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);
```

#### `validateFileFormat(file: File): ValidationResult`

Validates file format and MIME type against supported formats.

**Supported Formats:**
- PNG (`image/png`)
- JPEG (`image/jpeg`)
- GIF (`image/gif`)
- WebP (`image/webp`)

#### `validateFileSize(file: File): ValidationResult`

Validates file size against constraints.

**Size Limits:**
- Minimum: 100KB
- Maximum: 10MB
- Performance warning: >8MB

#### `validateImageDimensions(image: HTMLImageElement): ValidationResult`

Validates image dimensions and aspect ratio.

**Dimension Limits:**
- Minimum: 50x50px
- Maximum: 4096x4096px
- Aspect ratio warning for bookmark suitability

#### `validateImageContent(image: HTMLImageElement): Promise<ValidationResult>`

Analyzes image content for 3D processing suitability.

**Content Checks:**
- Transparency analysis
- Color complexity
- Solid color detection
- Empty image detection

### Error Creation Functions

#### `createFormatError(file: File): FileFormatError`

Creates a detailed format error with recovery suggestions.

#### `createSizeError(file: File): FileSizeError`

Creates a detailed size error with auto-resize suggestions.

#### `createDimensionError(width: number, height: number): DimensionError`

Creates a detailed dimension error with auto-resize suggestions.

### Utility Functions

#### `combineValidationResults(...results: ValidationResult[]): ValidationResult`

Combines multiple validation results into a single result.

#### `validationResultFromError(error: Error): ValidationResult`

Creates a validation result from a generic error.

## Error Types and Recovery

### Error Codes

```typescript
enum ValidationErrorCode {
  // File format errors
  INVALID_FORMAT = 'INVALID_FORMAT',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
  INVALID_MIME_TYPE = 'INVALID_MIME_TYPE',
  
  // File size errors
  FILE_TOO_SMALL = 'FILE_TOO_SMALL',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  
  // Dimension errors
  DIMENSIONS_TOO_SMALL = 'DIMENSIONS_TOO_SMALL',
  DIMENSIONS_TOO_LARGE = 'DIMENSIONS_TOO_LARGE',
  INVALID_ASPECT_RATIO = 'INVALID_ASPECT_RATIO',
  
  // Content errors
  INSUFFICIENT_COLOR_DEPTH = 'INSUFFICIENT_COLOR_DEPTH',
  TOO_MANY_COLORS = 'TOO_MANY_COLORS',
  EMPTY_IMAGE = 'EMPTY_IMAGE',
  CORRUPTED_IMAGE_DATA = 'CORRUPTED_IMAGE_DATA',
  
  // System errors
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',
  CANVAS_NOT_SUPPORTED = 'CANVAS_NOT_SUPPORTED',
  FILE_READER_ERROR = 'FILE_READER_ERROR'
}
```

### Recovery Suggestions

Each error includes actionable recovery suggestions:

```typescript
interface ErrorRecoverySuggestion {
  action: string;           // Brief action description
  description: string;      // Detailed explanation
  autoApplicable: boolean;  // Can be automatically applied
  severity: 'low' | 'medium' | 'high'; // Impact level
}
```

### Error Handling Example

```typescript
import { 
  ValidationError, 
  createUserFriendlyError, 
  canAutoResolveError,
  getAutoResolutionSuggestion 
} from './types/errors';

try {
  const result = await validateImageFile(file);
  if (!result.isValid) {
    // Handle validation failure
    handleValidationErrors(result.errors);
  }
} catch (error) {
  if (error instanceof ValidationError) {
    const userError = createUserFriendlyError(error);
    
    console.log(userError.title);
    console.log(userError.message);
    
    if (canAutoResolveError(error)) {
      const suggestion = getAutoResolutionSuggestion(error);
      console.log('Auto-fix available:', suggestion.action);
    } else {
      console.log('Manual fixes required:');
      userError.suggestions.forEach(s => {
        console.log(`- ${s.action}: ${s.description}`);
      });
    }
  }
}
```

## File Processing Utilities

### File Reading

```typescript
import { 
  readFileAsArrayBuffer,
  readFileAsDataURL,
  createImageFromFile,
  extractImageMetadata
} from './utils/fileProcessing';

// Read file as binary data
const buffer = await readFileAsArrayBuffer(file);

// Create image element
const image = await createImageFromFile(file);

// Extract comprehensive metadata
const metadata = await extractImageMetadata(file);
console.log(metadata);
// {
//   width: 1920,
//   height: 1080,
//   format: 'image/png',
//   size: 2048576,
//   colorDepth: 8,
//   hasAlpha: true
// }
```

### Header Validation

```typescript
import { validateImageHeaders } from './utils/fileProcessing';

const headerResult = await validateImageHeaders(file);
if (!headerResult.isValid) {
  console.log('File may be corrupted:', headerResult.errors);
}
```

### Memory Management

```typescript
import { 
  estimateMemoryUsage,
  checkMemoryConstraints 
} from './utils/fileProcessing';

// Estimate memory needed for processing
const memoryNeeded = estimateMemoryUsage(width, height);
console.log(`Will use ~${(memoryNeeded / 1024 / 1024).toFixed(1)}MB`);

// Check if processing would exceed limits
const memoryCheck = checkMemoryConstraints(width, height);
if (!memoryCheck.isValid) {
  console.log('Image too large for available memory');
}
```

## Validation Constraints

### File Size Limits

```typescript
export const FILE_CONSTRAINTS = {
  MIN_SIZE: 100 * 1024,        // 100KB
  MAX_SIZE: 10 * 1024 * 1024,  // 10MB
  MIN_DIMENSION: 50,           // 50px
  MAX_DIMENSION: 4096,         // 4096px
  MAX_MEMORY_USAGE: 500 * 1024 * 1024 // 500MB
};
```

### Supported Formats

```typescript
export const SUPPORTED_FORMATS: SupportedImageFormat[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
];
```

### Bookmark Aspect Ratios

Suitable aspect ratios for bookmarks: **1:3 to 3:1**

```typescript
function isValidBookmarkAspectRatio(aspectRatio: number): boolean {
  return aspectRatio >= 1/3 && aspectRatio <= 3;
}
```

## Examples and Testing

### Basic Validation

```typescript
import { validationExamples } from './utils/validationExamples';

// Run basic validation with detailed logging
await validationExamples.basic(file);

// Get detailed step-by-step validation
const result = await validationExamples.detailed(file);

// Handle errors with recovery suggestions
await validationExamples.errorHandling(file);
```

### Batch Processing

```typescript
// Validate multiple files
const files = [file1, file2, file3];
await validationExamples.batch(files);

// Performance testing
await validationExamples.performance(files);
```

### Validation Report

```typescript
const report = await validationExamples.createReport(file);
console.log(report);
// {
//   metadata: { width: 1920, height: 1080, ... },
//   formatValid: true,
//   sizeValid: true,
//   dimensionsValid: true,
//   contentValid: true,
//   overallValid: true,
//   errors: [],
//   warnings: ['Large image may impact performance'],
//   suggestions: []
// }
```

## Testing

The validation system includes comprehensive tests:

- **Unit Tests**: `src/tests/unit/validation.test.ts`
- **Integration Tests**: `src/tests/integration/image-validation.test.ts`

Run tests:
```bash
npm run test:unit validation
npm run test:integration image-validation
```

## Performance Considerations

### Optimization Strategies

1. **Async Processing**: All validation functions use async/await for non-blocking operations
2. **Memory Management**: Automatic memory estimation and cleanup
3. **Early Exit**: Format/size validation before expensive operations
4. **Sampling**: Color analysis uses pixel sampling for large images
5. **Caching**: Image objects are properly disposed after use

### Performance Targets

- **File validation**: <100ms for typical files
- **Image loading**: <500ms for 2MP images
- **Content analysis**: <200ms for sampled analysis
- **Memory usage**: <50MB per validation
- **Concurrent processing**: Support for multiple files

### Memory Limits

- **Maximum image memory**: 500MB total
- **Per-pixel memory**: 4 bytes (RGBA)
- **Processing overhead**: 50% additional for working buffers
- **Auto-cleanup**: Automatic disposal of large objects

## Browser Compatibility

### Required APIs

- **FileReader API**: For file reading (supported in all modern browsers)
- **Canvas 2D Context**: For image analysis (supported in all modern browsers)
- **HTMLImageElement**: For image loading (universal support)
- **Typed Arrays**: For binary data processing (ES2015+)

### Fallback Behavior

- **Canvas not supported**: Graceful degradation with error message
- **FileReader errors**: Detailed error messages with recovery suggestions
- **Memory limits**: Automatic size reduction suggestions

## Integration Guide

### React Component Integration

```typescript
import { validateImageFile } from './modules/image/validation';

function ImageUploadComponent() {
  const handleFileUpload = async (file: File) => {
    try {
      const result = await validateImageFile(file);
      
      if (result.isValid) {
        // Proceed with file processing
        processImage(file);
        
        // Show warnings if any
        if (result.warnings.length > 0) {
          showWarnings(result.warnings);
        }
      } else {
        // Show errors to user
        showErrors(result.errors);
      }
    } catch (error) {
      console.error('Validation failed:', error);
      showError('File validation failed. Please try again.');
    }
  };
  
  return (
    <input
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFileUpload(file);
      }}
    />
  );
}
```

### Error Display Component

```typescript
function ValidationErrorDisplay({ error }: { error: ValidationError }) {
  const userError = createUserFriendlyError(error);
  
  return (
    <div className="error-container">
      <h3>{userError.title}</h3>
      <p>{userError.message}</p>
      
      {userError.suggestions.length > 0 && (
        <div className="suggestions">
          <h4>Suggested fixes:</h4>
          <ul>
            {userError.suggestions.map((suggestion, index) => (
              <li key={index}>
                <strong>{suggestion.action}</strong>: {suggestion.description}
                {suggestion.autoApplicable && (
                  <button onClick={() => applyAutoFix(suggestion)}>
                    Apply automatically
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Contributing

When adding new validation rules or error types:

1. **Add error code** to `ValidationErrorCode` enum
2. **Create error class** extending `ValidationError`
3. **Add recovery suggestions** with appropriate severity levels
4. **Update tests** in both unit and integration test suites
5. **Document changes** in this README and type definitions

## License

This module is part of the 3D Bookmark Generator project and follows the same licensing terms.