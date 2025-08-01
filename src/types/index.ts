import * as THREE from 'three';

// ========================
// Core Application Types
// ========================

/**
 * Central application state
 */
export interface AppState {
  image: ProcessedImage | null;
  parameters: BookmarkParameters;
  geometry: BookmarkGeometry | null;
  exportState: ExportState;
  ui: UIState;
}

/**
 * Processed image data at various stages
 */
export interface ProcessedImage {
  original: ImageData;
  cropped: ImageData;
  quantized: QuantizedImageData;
  cropRegion: CropRegion;
}

/**
 * Bookmark generation parameters
 */
export interface BookmarkParameters {
  colorCount: number; // 2-8
  layerThickness: number; // 0.1-0.5mm
  baseThickness: number; // 1-3mm
  width: number; // mm
  height: number; // mm
  cornerRadius: number; // 0-10mm
  aspectRatioLocked: boolean;
}

/**
 * Color quantized image data with height mapping
 */
export interface QuantizedImageData {
  imageData: ImageData;
  colorPalette: Color[];
  heightMap: Float32Array; // normalized 0-1 heights
}

/**
 * Generated 3D bookmark geometry
 */
export interface BookmarkGeometry {
  layers: GeometryLayer[];
  boundingBox: THREE.Box3;
  vertexCount: number;
  faceCount: number;
  totalTriangles: number;
  estimatedFileSize: number; // in MB
}

/**
 * Individual geometry layer with associated metadata
 */
export interface GeometryLayer {
  id: number;
  color: Color;
  height: number;
  geometry: THREE.BufferGeometry;
  regions: ConnectedComponent[];
  visible: boolean;
  opacity: number;
  triangleCount: number;
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
  boundingBox?: THREE.Box3;
}

/**
 * Image crop region definition
 */
export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * RGBA color definition
 */
export interface Color {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a?: number; // 0-1 (optional for compatibility)
  hex: string; // hex representation
}

/**
 * Connected component in binary image
 */
export interface ConnectedComponent {
  pixels: Point2D[];
  boundingBox: BoundingBox;
  area: number;
}

/**
 * 2D point coordinates
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * 2D/3D bounding box
 */
export interface BoundingBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/**
 * Validation result with errors and warnings
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Export operation state
 */
export interface ExportState {
  format: 'stl' | '3mf';
  isExporting: boolean;
  progress: number;
  stage: 'idle' | 'validating' | 'processing' | 'generating' | 'downloading' | 'complete' | 'error';
  stageProgress: number; // Progress within current stage (0-1)
  estimatedTimeRemaining?: number; // in milliseconds
  canCancel: boolean;
  lastExportedFile: Blob | null;
  error?: string;
  warnings: string[];
}

/**
 * Export quality settings
 */
export interface ExportQualitySettings {
  level: 'high' | 'medium' | 'low';
  optimizeGeometry: boolean;
  includeColors: boolean;
  includeMetadata: boolean;
  compressionLevel: number; // 0-9 for 3MF
}

/**
 * Print settings preview
 */
export interface PrintSettingsPreview {
  estimatedPrintTime: number; // in minutes
  materialUsage: number; // in grams
  supportRequired: boolean;
  layerHeight: number; // in mm
  infillPercentage: number;
  printSpeed: number; // in mm/s
}

/**
 * UI state management
 */
export interface UIState {
  activeTab: 'upload' | 'parameters' | 'preview' | 'export';
  showLayerToggle: boolean;
  cameraPosition: THREE.Vector3;
  notifications: Notification[];
}

/**
 * User notification
 */
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  autoClose?: boolean;
}

// ========================
// Processing Types
// ========================

/**
 * Image processing configuration
 */
export interface ImageProcessingOptions {
  maxDimension: number;
  quality: number;
  format: 'preserve' | 'png' | 'jpeg';
}

/**
 * K-means clustering configuration
 */
export interface KMeansOptions {
  maxIterations: number;
  convergenceThreshold: number;
  maxSamples: number;
}

/**
 * Geometry generation configuration
 */
export interface GeometryOptions {
  minFeatureSize: number;
  meshOptimization: boolean;
  smoothing: boolean;
}

// ========================
// File Types
// ========================

/**
 * Supported image file formats
 */
export type SupportedImageFormat = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

/**
 * Export file formats
 */
export type ExportFormat = 'stl' | '3mf';

/**
 * File validation constraints
 */
export interface FileConstraints {
  maxSize: number; // bytes
  maxDimension: number; // pixels
  supportedFormats: SupportedImageFormat[];
}

// ========================
// Event Types
// ========================

/**
 * Custom event types for application
 */
export interface AppEvents {
  'image-uploaded': { file: File };
  'image-processed': { image: ProcessedImage };
  'parameters-changed': { parameters: BookmarkParameters };
  'geometry-generated': { geometry: BookmarkGeometry };
  'export-started': { format: ExportFormat };
  'export-completed': { file: Blob; format: ExportFormat };
  'export-failed': { error: Error };
}

// ========================
// Hook Types
// ========================

/**
 * Custom hook return types
 */
export interface UseImageProcessorReturn {
  processImage: (file: File, options?: ImageProcessingOptions) => Promise<ProcessedImage>;
  isProcessing: boolean;
  error: Error | null;
}

export interface UseGeometryGeneratorReturn {
  generateGeometry: (
    image: ProcessedImage,
    parameters: BookmarkParameters
  ) => Promise<BookmarkGeometry>;
  isGenerating: boolean;
  error: Error | null;
}

export interface UseExportReturn {
  exportGeometry: (geometry: BookmarkGeometry, format: ExportFormat) => Promise<Blob>;
  isExporting: boolean;
  progress: number;
  error: Error | null;
}

// ========================
// Component Props
// ========================

/**
 * Common component prop types
 */
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ImageUploadProps extends BaseComponentProps {
  onImageUploaded: (file: File) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
}

export interface ParameterPanelProps extends BaseComponentProps {
  parameters: BookmarkParameters;
  onChange: (parameters: BookmarkParameters) => void;
  disabled?: boolean;
}

export interface Preview3DProps extends BaseComponentProps {
  geometry: BookmarkGeometry | null;
  parameters: BookmarkParameters;
  onCameraChange?: (position: THREE.Vector3) => void;
}

export interface ExportPanelProps extends BaseComponentProps {
  geometry: BookmarkGeometry | null;
  onExport: (format: ExportFormat, qualitySettings: ExportQualitySettings) => void;
  onCancel?: () => void;
  exportState: ExportState;
  validation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    fileSize: number;
  };
  printPreview?: PrintSettingsPreview;
}

// ========================
// Missing Types
// ========================

/**
 * Image metadata information
 */
export interface ImageMetadata {
  width: number;
  height: number;
  fileSize: number;
  format: string;
  colorDepth: number;
  hasAlpha: boolean;
  dpi?: number;
  orientation?: number;
}

/**
 * Processing progress information
 */
export interface ProcessingProgress {
  stage: string;
  progress: number; // 0-1
  message?: string;
  timeElapsed?: number;
  timeRemaining?: number;
}
