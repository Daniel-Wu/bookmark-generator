/**
 * File processing utilities for image handling
 */

import type { 
  SupportedImageFormat, 
  ImageMetadata, 
  ValidationResult,
  ImageProcessingOptions
} from '../types';
import type { ImageProcessingError } from '../types/errors';

// ========================
// Constants
// ========================

export const SUPPORTED_FORMATS: SupportedImageFormat[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
];

export const FILE_CONSTRAINTS = {
  MIN_SIZE: 100 * 1024, // 100KB
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  MIN_DIMENSION: 50, // 50px
  MAX_DIMENSION: 4096, // 4096px
  MAX_MEMORY_USAGE: 500 * 1024 * 1024 // 500MB
} as const;

// ========================
// File Reading Utilities
// ========================

/**
 * Safely reads a file as ArrayBuffer with memory management
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error(`File reading failed: ${reader.error?.message || 'Unknown error'}`));
    };
    
    reader.onabort = () => {
      reject(new Error('File reading was aborted'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Reads a file as data URL
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error(`File reading failed: ${reader.error?.message || 'Unknown error'}`));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Creates an HTMLImageElement from a file with proper error handling
 */
export function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectURL: string | null = null;
    
    const cleanup = () => {
      if (objectURL) {
        URL.revokeObjectURL(objectURL);
      }
    };
    
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    
    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image. File may be corrupted or in an unsupported format.'));
    };
    
    try {
      objectURL = URL.createObjectURL(file);
      img.src = objectURL;
    } catch (error) {
      cleanup();
      reject(new Error(`Failed to create object URL: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

/**
 * Creates an HTMLImageElement from a data URL
 */
export function createImageFromDataURL(dataURL: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image from data URL'));
    
    img.src = dataURL;
  });
}

// ========================
// Image Information Extraction
// ========================

/**
 * Extracts metadata from an image file
 */
export async function extractImageMetadata(file: File): Promise<ImageMetadata> {
  try {
    // Get basic file information
    const metadata: Partial<ImageMetadata> = {
      fileSize: file.size,
      format: file.type || detectFormatFromExtension(file.name)
    };
    
    // Load image to get dimensions and color information
    const img = await createImageFromFile(file);
    
    metadata.width = img.naturalWidth;
    metadata.height = img.naturalHeight;
    
    // Estimate color depth and alpha channel from format
    const formatInfo = getFormatInfo(metadata.format!);
    metadata.colorDepth = formatInfo.colorDepth;
    metadata.hasAlpha = formatInfo.hasAlpha;
    
    return metadata as ImageMetadata;
  } catch (error) {
    throw new Error(`Failed to extract image metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Detects image format from file extension as fallback
 */
function detectFormatFromExtension(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

/**
 * Gets format-specific information
 */
function getFormatInfo(format: string): { colorDepth: number; hasAlpha: boolean } {
  switch (format) {
    case 'image/png':
      return { colorDepth: 8, hasAlpha: true };
    case 'image/jpeg':
      return { colorDepth: 8, hasAlpha: false };
    case 'image/gif':
      return { colorDepth: 8, hasAlpha: true };
    case 'image/webp':
      return { colorDepth: 8, hasAlpha: true };
    default:
      return { colorDepth: 8, hasAlpha: false };
  }
}

// ========================
// Image Header Validation
// ========================

/**
 * Validates image file integrity by checking headers
 */
export async function validateImageHeaders(file: File): Promise<ValidationResult> {
  try {
    const buffer = await readFileAsArrayBuffer(file);
    const view = new DataView(buffer);
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check file size
    if (buffer.byteLength < 10) {
      errors.push('File is too small to contain valid image data');
      return { isValid: false, errors, warnings };
    }
    
    // Validate headers based on format
    const formatValid = validateFormatHeaders(view, file.type);
    if (!formatValid.isValid) {
      errors.push(...formatValid.errors);
      warnings.push(...formatValid.warnings);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Header validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: []
    };
  }
}

/**
 * Validates format-specific headers
 */
function validateFormatHeaders(view: DataView, mimeType: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    switch (mimeType) {
      case 'image/png':
        if (!validatePNGHeader(view)) {
          errors.push('Invalid PNG header signature');
        }
        break;
        
      case 'image/jpeg':
        if (!validateJPEGHeader(view)) {
          errors.push('Invalid JPEG header signature');
        }
        break;
        
      case 'image/gif':
        if (!validateGIFHeader(view)) {
          errors.push('Invalid GIF header signature');
        }
        break;
        
      case 'image/webp':
        if (!validateWebPHeader(view)) {
          errors.push('Invalid WebP header signature');
        }
        break;
        
      default:
        warnings.push(`Unknown format ${mimeType}, skipping header validation`);
    }
  } catch (error) {
    errors.push(`Header validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates PNG header signature
 */
function validatePNGHeader(view: DataView): boolean {
  // PNG signature: 137 80 78 71 13 10 26 10
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  
  if (view.byteLength < 8) return false;
  
  for (let i = 0; i < 8; i++) {
    if (view.getUint8(i) !== pngSignature[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validates JPEG header signature
 */
function validateJPEGHeader(view: DataView): boolean {
  // JPEG signature: FF D8 FF
  if (view.byteLength < 3) return false;
  
  return view.getUint8(0) === 0xFF && 
         view.getUint8(1) === 0xD8 && 
         view.getUint8(2) === 0xFF;
}

/**
 * Validates GIF header signature
 */
function validateGIFHeader(view: DataView): boolean {
  // GIF signature: "GIF87a" or "GIF89a"
  if (view.byteLength < 6) return false;
  
  const decoder = new TextDecoder('ascii');
  const header = decoder.decode(new Uint8Array(view.buffer, 0, 6));
  
  return header === 'GIF87a' || header === 'GIF89a';
}

/**
 * Validates WebP header signature
 */
function validateWebPHeader(view: DataView): boolean {
  // WebP signature: "RIFF" + 4 bytes + "WEBP"
  if (view.byteLength < 12) return false;
  
  const decoder = new TextDecoder('ascii');
  const riff = decoder.decode(new Uint8Array(view.buffer, 0, 4));
  const webp = decoder.decode(new Uint8Array(view.buffer, 8, 4));
  
  return riff === 'RIFF' && webp === 'WEBP';
}

// ========================
// Memory Management
// ========================

/**
 * Estimates memory usage for image processing
 */
export function estimateMemoryUsage(width: number, height: number, colorChannels: number = 4): number {
  // Each pixel uses colorChannels bytes (RGBA = 4 bytes)
  // We need memory for original, working copy, and temporary buffers
  const baseMemory = width * height * colorChannels;
  const workingMemory = baseMemory * 3; // Original + working + temp
  const overhead = baseMemory * 0.5; // Additional overhead for processing
  
  return workingMemory + overhead;
}

/**
 * Checks if image processing would exceed memory limits
 */
export function checkMemoryConstraints(width: number, height: number): ValidationResult {
  const requiredMemory = estimateMemoryUsage(width, height);
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (requiredMemory > FILE_CONSTRAINTS.MAX_MEMORY_USAGE) {
    errors.push(
      `Image would require ${(requiredMemory / (1024 * 1024)).toFixed(1)}MB of memory, ` +
      `which exceeds the limit of ${(FILE_CONSTRAINTS.MAX_MEMORY_USAGE / (1024 * 1024)).toFixed(1)}MB`
    );
  } else if (requiredMemory > FILE_CONSTRAINTS.MAX_MEMORY_USAGE * 0.8) {
    warnings.push(
      `Image will use ${(requiredMemory / (1024 * 1024)).toFixed(1)}MB of memory, ` +
      'which may impact performance'
    );
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ========================
// Format Conversion Utilities
// ========================

/**
 * Converts image to Canvas with specified options
 */
export async function convertImageToCanvas(
  image: HTMLImageElement,
  options: Partial<ImageProcessingOptions> = {}
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas 2D context not supported');
  }
  
  // Calculate target dimensions
  const maxDimension = options.maxDimension || Math.max(image.width, image.height);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  
  // Configure canvas for high quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Draw image to canvas
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  
  return canvas;
}

/**
 * Converts canvas to ImageData
 */
export function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }
  
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Converts ImageData to canvas
 */
export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas 2D context not supported');
  }
  
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
}

// ========================
// Utility Functions
// ========================

/**
 * Generates a unique file name with timestamp
 */
export function generateFileName(originalName: string, suffix: string = ''): string {
  const timestamp = Date.now();
  const baseName = originalName.replace(/\.[^/.]+$/, ''); // Remove extension
  const extension = originalName.split('.').pop() || 'png';
  
  return `${baseName}${suffix}_${timestamp}.${extension}`;
}

/**
 * Formats file size for human reading
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Formats image dimensions for display
 */
export function formatDimensions(width: number, height: number): string {
  return `${width}×${height}px`;
}

/**
 * Calculates aspect ratio
 */
export function calculateAspectRatio(width: number, height: number): number {
  return width / height;
}

/**
 * Checks if aspect ratio is suitable for bookmarks
 */
export function isValidBookmarkAspectRatio(aspectRatio: number): boolean {
  // Typical bookmark ratios: 1:3 to 3:1
  return aspectRatio >= 1/3 && aspectRatio <= 3;
}