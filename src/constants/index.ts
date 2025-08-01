/**
 * Application constants
 */

import type { BookmarkParameters, FileConstraints } from '../types';

// ========================
// Application Metadata
// ========================

export const APP_NAME = 'Parametric 3D Bookmark Generator';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Convert images into multi-layer 3D bookmarks for 3D printing';

// ========================
// File Upload Constraints
// ========================

export const FILE_CONSTRAINTS: FileConstraints = {
  maxSize: 10 * 1024 * 1024, // 10MB
  maxDimension: 4096, // 4096px
  supportedFormats: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
};

export const MIME_TYPES = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  WEBP: 'image/webp',
  STL: 'application/sla',
  THREE_MF: 'model/3mf',
} as const;

// ========================
// Parameter Defaults & Limits
// ========================

export const DEFAULT_PARAMETERS: BookmarkParameters = {
  colorCount: 4,
  layerThickness: 0.2, // mm
  baseThickness: 2.0, // mm
  width: 50, // mm
  height: 150, // mm
  cornerRadius: 2, // mm
  aspectRatioLocked: true,
};

export const PARAMETER_LIMITS = {
  colorCount: { min: 2, max: 8, step: 1 },
  layerThickness: { min: 0.1, max: 0.5, step: 0.1 },
  baseThickness: { min: 1.0, max: 3.0, step: 0.1 },
  width: { min: 20, max: 200, step: 1 },
  height: { min: 30, max: 300, step: 1 },
  cornerRadius: { min: 0, max: 10, step: 0.5 },
  aspectRatioLocked: { min: 0, max: 1, step: 1 }, // boolean as number
} as const;

// ========================
// UI Constants
// ========================

export const LAYOUT_DIMENSIONS = {
  HEADER_HEIGHT: 60, // px
  HEADER_HEIGHT_MOBILE: 50, // px
  SIDEBAR_WIDTH: 300, // px
  MIN_PREVIEW_WIDTH: 400, // px
  MIN_PREVIEW_HEIGHT: 300, // px
} as const;

export const BREAKPOINTS = {
  MOBILE: 768, // px
  TABLET: 1024, // px
  DESKTOP: 1200, // px
} as const;

export const Z_INDEX = {
  DROPDOWN: 1000,
  MODAL: 2000,
  TOOLTIP: 3000,
  NOTIFICATION: 4000,
} as const;

// ========================
// Processing Constants
// ========================

export const PROCESSING_LIMITS = {
  MAX_PROCESSING_TIME: 30000, // 30 seconds
  MAX_MEMORY_USAGE: 500 * 1024 * 1024, // 500MB
  MAX_VERTICES_PER_LAYER: 100000,
  MAX_SAMPLE_PIXELS: 10000, // for k-means
  MIN_FEATURE_SIZE: 0.5, // mm
} as const;

export const KMEANS_CONFIG = {
  MAX_ITERATIONS: 50,
  CONVERGENCE_THRESHOLD: 0.1,
  MAX_SAMPLES: 10000,
} as const;

export const GEOMETRY_CONFIG = {
  MIN_COMPONENT_AREA: 10, // pixels
  MESH_SIMPLIFICATION_RATIO: 0.8,
  DEFAULT_EXTRUSION_STEPS: 1,
  DEFAULT_BEVEL_SIZE: 0.1, // mm
} as const;

// ========================
// Export Constants
// ========================

export const EXPORT_CONFIG = {
  STL_HEADER_SIZE: 80, // bytes
  STL_TRIANGLE_SIZE: 50, // bytes
  DEFAULT_PRECISION: 3, // decimal places
  COMPRESSION_LEVEL: 6, // for 3MF (0-9)
} as const;

export const FILE_EXTENSIONS = {
  STL: '.stl',
  THREE_MF: '.3mf',
  PNG: '.png',
  JPEG: '.jpg',
} as const;

// ========================
// Performance Targets
// ========================

export const PERFORMANCE_TARGETS = {
  IMAGE_PROCESSING_TIME: 5000, // ms
  GEOMETRY_GENERATION_TIME: 5000, // ms
  RENDER_FPS: 30, // frames per second
  PARAMETER_UPDATE_TIME: 100, // ms
} as const;

// ========================
// 3D Rendering Constants
// ========================

export const CAMERA_CONFIG = {
  FOV: 75, // degrees
  NEAR: 0.1,
  FAR: 1000,
  INITIAL_POSITION: [50, 50, 100] as [number, number, number],
  TARGET: [0, 0, 0] as [number, number, number],
} as const;

export const LIGHTING_CONFIG = {
  AMBIENT_INTENSITY: 0.4,
  DIRECTIONAL_INTENSITY: 0.6,
  DIRECTIONAL_POSITION: [10, 10, 5] as [number, number, number],
  SHADOWS: true,
} as const;

export const MATERIAL_CONFIG = {
  METALNESS: 0.1,
  ROUGHNESS: 0.3,
  OPACITY: 1.0,
} as const;

// ========================
// Color Palette
// ========================

export const UI_COLORS = {
  PRIMARY: '#2563eb',
  SECONDARY: '#64748b',
  SUCCESS: '#059669',
  WARNING: '#d97706',
  ERROR: '#dc2626',
  BACKGROUND: '#f8fafc',
  SURFACE: '#ffffff',
  BORDER: '#e2e8f0',
  TEXT_PRIMARY: '#0f172a',
  TEXT_SECONDARY: '#64748b',
  TEXT_MUTED: '#94a3b8',
} as const;

// ========================
// Animation Durations
// ========================

export const ANIMATION_DURATION = {
  FAST: 150, // ms
  NORMAL: 300, // ms
  SLOW: 500, // ms
} as const;

// ========================
// Validation Messages
// ========================

export const VALIDATION_MESSAGES = {
  FILE_TOO_LARGE: 'File size exceeds maximum limit of 10MB',
  FILE_INVALID_FORMAT: 'Unsupported file format. Please use PNG, JPG, GIF, or WebP',
  IMAGE_TOO_LARGE: 'Image dimensions exceed maximum of 4096x4096 pixels',
  CORRUPTED_FILE: 'File appears to be corrupted or invalid',
  NO_FILE_SELECTED: 'Please select an image file',
  CROP_INVALID: 'Crop region is invalid or outside image bounds',
  PARAMETERS_INVALID: 'One or more parameters are outside valid ranges',
} as const;

// ========================
// Error Codes
// ========================

export const ERROR_CODES = {
  // File errors
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  FILE_READ_FAILED: 'FILE_READ_FAILED',
  FILE_VALIDATION_FAILED: 'FILE_VALIDATION_FAILED',

  // Processing errors
  IMAGE_PROCESSING_FAILED: 'IMAGE_PROCESSING_FAILED',
  QUANTIZATION_FAILED: 'QUANTIZATION_FAILED',
  GEOMETRY_GENERATION_FAILED: 'GEOMETRY_GENERATION_FAILED',

  // Export errors
  EXPORT_FAILED: 'EXPORT_FAILED',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',

  // System errors
  OUT_OF_MEMORY: 'OUT_OF_MEMORY',
  WEBGL_NOT_SUPPORTED: 'WEBGL_NOT_SUPPORTED',
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
} as const;

// ========================
// Local Storage Keys
// ========================

export const STORAGE_KEYS = {
  USER_PARAMETERS: 'bookmark_parameters',
  RECENT_EXPORTS: 'recent_exports',
  UI_PREFERENCES: 'ui_preferences',
  PARAMETER_PRESETS: 'parameter_presets',
} as const;
