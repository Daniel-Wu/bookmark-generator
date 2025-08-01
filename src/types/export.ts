/**
 * Export module types
 */

// Import types when needed

// ========================
// Export Types
// ========================

/**
 * Export format configuration
 */
export interface ExportConfig {
  format: 'stl' | '3mf';
  binary: boolean;
  precision: number; // decimal places for coordinates
  units: 'mm' | 'inches';
  includeColors: boolean;
  includeMetadata: boolean;
}

/**
 * STL export options
 */
export interface STLExportOptions extends ExportConfig {
  format: 'stl';
  mergeGeometry: boolean; // combine all layers into single mesh
  applicationName: string; // for STL header
  generateNormals: boolean;
}

/**
 * 3MF export options
 */
export interface ThreeMFExportOptions extends ExportConfig {
  format: '3mf';
  includeTextures: boolean;
  includeThumbnail: boolean;
  compressionLevel: number; // 0-9
  metadata: Record<string, string>;
}

/**
 * Export progress information
 */
export interface ExportProgress {
  stage: 'preparing' | 'generating' | 'writing' | 'complete';
  progress: number; // 0-1
  currentLayer: number;
  totalLayers: number;
  message: string;
  bytesWritten: number;
  estimatedSize: number;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  data?: Uint8Array;
  filename: string;
  mimeType: string;
  size: number; // bytes
  duration: number; // milliseconds
  warnings: string[];
  metadata: ExportMetadata;
}

/**
 * Export metadata
 */
export interface ExportMetadata {
  format: string;
  version: string;
  generator: string;
  timestamp: string;
  units: string;
  geometry: {
    vertices: number;
    faces: number;
    layers: number;
    materials: number;
  };
  parameters: {
    dimensions: { width: number; height: number; thickness: number };
    layerThickness: number;
    colorCount: number;
  };
}

// ========================
// File Format Structures
// ========================

/**
 * STL file header structure
 */
export interface STLHeader {
  header: string; // 80 bytes
  triangleCount: number; // 4 bytes
}

/**
 * STL triangle structure
 */
export interface STLTriangle {
  normal: [number, number, number]; // 12 bytes
  vertices: [[number, number, number], [number, number, number], [number, number, number]]; // 36 bytes
  attributeBytes: number; // 2 bytes
}

/**
 * 3MF package structure
 */
export interface ThreeMFPackage {
  contentTypes: ContentTypesXML;
  relationships: RelationshipsXML;
  model: ModelXML;
  thumbnail?: Uint8Array;
  metadata?: Record<string, string>;
}

/**
 * 3MF Content Types XML
 */
export interface ContentTypesXML {
  defaults: Array<{
    extension: string;
    contentType: string;
  }>;
  overrides: Array<{
    partName: string;
    contentType: string;
  }>;
}

/**
 * 3MF Relationships XML
 */
export interface RelationshipsXML {
  relationships: Array<{
    id: string;
    type: string;
    target: string;
  }>;
}

/**
 * 3MF Model XML structure
 */
export interface ModelXML {
  unit: string;
  metadata: Array<{
    name: string;
    value: string;
  }>;
  resources: {
    objects: ModelObject[];
    materials?: ModelMaterial[];
    textures?: ModelTexture[];
  };
  build: {
    items: Array<{
      objectId: string;
      transform?: string;
    }>;
  };
}

/**
 * 3MF Object definition
 */
export interface ModelObject {
  id: string;
  type: 'model' | 'other' | 'support' | 'solidsupport';
  mesh: {
    vertices: Array<{
      x: number;
      y: number;
      z: number;
    }>;
    triangles: Array<{
      v1: number;
      v2: number;
      v3: number;
      materialId?: string;
      colorId?: string;
    }>;
  };
}

/**
 * 3MF Material definition
 */
export interface ModelMaterial {
  id: string;
  name: string;
  color: string; // ARGB hex format
}

/**
 * 3MF Texture definition
 */
export interface ModelTexture {
  id: string;
  path: string;
  contentType: string;
}

// ========================
// Validation
// ========================

/**
 * Export validation result
 */
export interface ExportValidation {
  isValid: boolean;
  errors: ExportError[];
  warnings: string[];
  fileSize: number;
  estimatedPrintTime?: number;
}

/**
 * Export error types
 */
export interface ExportError {
  type: 'geometry' | 'format' | 'size' | 'materials';
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

// ========================
// File Download
// ========================

/**
 * Download configuration
 */
export interface DownloadConfig {
  filename: string;
  mimeType: string;
  saveDialog: boolean;
  onProgress?: (loaded: number, total: number) => void;
  onComplete?: (success: boolean) => void;
}

/**
 * Browser download capabilities
 */
export interface DownloadCapabilities {
  supportsDownload: boolean;
  supportsFilesystemAPI: boolean;
  maxFileSize: number; // bytes
  supportedMimeTypes: string[];
}

// ========================
// Utilities
// ========================

/**
 * Binary writer utility
 */
export interface BinaryWriter {
  position: number;
  buffer: ArrayBuffer;
  view: DataView;

  writeUint8(value: number): void;
  writeUint16(value: number, littleEndian?: boolean): void;
  writeUint32(value: number, littleEndian?: boolean): void;
  writeFloat32(value: number, littleEndian?: boolean): void;
  writeString(value: string, length?: number): void;
  getUint8Array(): Uint8Array;
}

/**
 * XML builder utility
 */
export interface XMLBuilder {
  declaration(version: string, encoding: string): XMLBuilder;
  element(name: string, attributes?: Record<string, string>, content?: string): XMLBuilder;
  closeElement(): XMLBuilder;
  toString(): string;
}

// ========================
// Performance
// ========================

/**
 * Export performance metrics
 */
export interface ExportMetrics {
  preparationTime: number; // milliseconds
  generationTime: number; // milliseconds
  writeTime: number; // milliseconds
  totalTime: number; // milliseconds
  throughput: number; // bytes per second
  compressionRatio?: number; // for 3MF
  memoryUsage: {
    peak: number; // bytes
    final: number; // bytes
  };
}
