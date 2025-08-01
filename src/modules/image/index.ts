/**
 * Image processing module exports
 */

// Validation functions
export {
  validateImageFile,
  validateFileFormat,
  validateFileSize,
  validateImageDimensions,
  validateImageContent,
  createValidationError,
  createFormatError,
  createSizeError,
  createDimensionError,
  combineValidationResults,
  validationResultFromError
} from './validation';

// K-means color quantization
export {
  KMeansQuantizer,
  quantizeImageColors,
  suggestColorCount,
  validateQuantizationParams
} from './quantization';

export type {
  QuantizerProgress,
  QuantizerOptions
} from './quantization';

// Color utilities
export {
  createColor,
  colorFromImageData,
  colorToHex,
  hexToColor,
  colorsEqual,
  euclideanDistance,
  euclideanDistanceWithAlpha,
  deltaE,
  calculateLuminance,
  calculateRelativeLuminance,
  calculateLightness,
  rgbToHsl,
  hslToRgb,
  rgbToLab,
  sortColorsByLuminance,
  sortColorsByHue,
  findDominantColor,
  calculateAverageColor,
  isTransparent,
  isGrayscale,
  getContrastRatio
} from './colorUtils';

// Pixel sampling utilities
export {
  samplePixels,
  analyzeSampling,
  validateSampling
} from './sampling';

export type {
  PixelSample,
  SamplingOptions,
  SamplingResult
} from './sampling';

// Re-export types for convenience
export type {
  ValidationResult,
  SupportedImageFormat,
  Color,
  QuantizedImageData,
  KMeansOptions
} from '../../types';

// Height mapping system
export {
  HeightMapper,
  createBookmarkHeightMapper,
  generateHeightMap,
  configurableHeightLevels,
  validateHeightMappingParams
} from './heightMapping';

export type {
  HeightMappingStrategy,
  SmoothingAlgorithm,
  HeightMappingOptions,
  HeightMappingProgress,
  HeightMapMetrics,
  ConnectedComponent
} from './heightMapping';

// Re-export image-specific types
export type {
  ImageMetadata,
  ProcessingStage,
  ProcessingProgress,
  ImageAnalysis,
  KMeansResult,
  ColorPalette
} from '../../types/image';

export type {
  ValidationError,
  ValidationErrorCode,
  ErrorRecoverySuggestion,
  FileFormatError,
  FileSizeError,
  DimensionError,
  ImageProcessingError,
  MemoryError,
  CorruptedFileError
} from '../../types/errors';