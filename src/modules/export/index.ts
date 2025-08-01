/**
 * Export module - Main entry point for 3D model export functionality
 * 
 * This module provides comprehensive export capabilities with:
 * - Binary STL format generation (single-color)
 * - 3MF format generation with multi-color support
 * - Geometry validation and optimization
 * - Cross-browser file download support
 * - Progress reporting and cancellation
 * - Quality validation for 3D printing
 * - Thumbnail generation for 3MF files
 * - ZIP archive creation for 3MF packaging
 */

// Core export classes
export { GeometryExporter } from './geometryExporter';
export { STLExporter } from './stlExporter';
export { ThreeMFExporter } from './threemfExporter';

// Utilities
export { BinaryWriter, GrowableBinaryWriter } from './binaryWriter';
export { ExportValidator, ValidationSeverity, ValidationCategory } from './exportValidator';
export { FileDownloadManager, FileUtils } from './fileDownload';
export type { EnhancedDownloadConfig, DownloadResult } from './fileDownload';
export { XMLBuilder, ThreeMFXMLBuilder } from './xmlBuilder';
export { ZipArchive } from './zipArchive';
export { ThumbnailGenerator } from './thumbnailGenerator';

// Enhanced export utilities
export { ExportProgressTracker, ProgressEstimator, ExportPerformanceMonitor } from './exportProgressTracker';
export { ExportErrorHandler, ExportErrorType, ErrorSeverity, ErrorUtils, exportErrorHandler } from './errorHandler';
export { ExportPerformanceOptimizer, MemoryManager, ChunkedProcessor } from './performanceOptimizer';

// Re-export types for convenience
export type {
  ExportConfig,
  STLExportOptions,
  ThreeMFExportOptions,
  ExportProgress,
  ExportResult,
  ExportValidation,
  ExportError,
  ExportMetadata,
  ExportMetrics,
  STLHeader,
  STLTriangle,
  ThreeMFPackage,
  ModelXML,
  ModelObject,
  ModelMaterial,
  ContentTypesXML,
  RelationshipsXML,
  DownloadConfig,
  DownloadCapabilities,
  BinaryWriter as IBinaryWriter,
  XMLBuilder as IXMLBuilder
} from '../../types/export';

/**
 * Quick export functions for common use cases
 */
export class QuickExport {
  /**
   * Export geometry to STL with default settings
   */
  static async exportSTL(
    geometry: any, // BookmarkGeometry type
    options: {
      filename?: string;
      quality?: 'high' | 'medium' | 'low';
      units?: 'mm' | 'inches';
      onProgress?: (progress: any) => void;
    } = {}
  ) {
    const { STLExporter } = await import('./stlExporter');
    const { FileDownloadManager } = await import('./fileDownload');
    const { ExportValidator } = await import('./exportValidator');

    // Create exporter with quality settings
    const exportOptions = {
      format: 'stl' as const,
      binary: true,
      precision: options.quality === 'high' ? 6 : options.quality === 'medium' ? 4 : 3,
      units: options.units || 'mm',
      includeColors: false,
      includeMetadata: true,
      mergeGeometry: true,
      applicationName: 'Parametric 3D Bookmark Generator',
      generateNormals: true
    };

    const exporter = new STLExporter(exportOptions, options.onProgress);

    // Validate before export
    const validator = ExportValidator.createForQuality(options.quality || 'medium');
    const validation = await validator.validateForExport(geometry, exportOptions);

    if (!validation.isValid) {
      throw new Error(`Export validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Export geometry
    const result = await exporter.export(geometry);
    
    if (!result.success || !result.data) {
      throw new Error('Export failed');
    }

    // Download file
    const downloadManager = new FileDownloadManager();
    const filename = options.filename || result.filename;
    
    const downloadSuccess = await downloadManager.downloadFile(result.data, {
      filename,
      mimeType: result.mimeType,
      saveDialog: true,
      onProgress: options.onProgress ? 
        (loaded, total) => options.onProgress!({ 
          stage: 'complete' as const, 
          progress: loaded / total, 
          message: 'Downloading...', 
          currentLayer: 0, 
          totalLayers: 0, 
          bytesWritten: loaded, 
          estimatedSize: total 
        }) : undefined
    });

    return {
      success: downloadSuccess,
      filename,
      size: result.size,
      duration: result.duration,
      warnings: result.warnings
    };
  }

  /**
   * Export geometry to 3MF with default settings
   */
  static async export3MF(
    geometry: any, // BookmarkGeometry type
    options: {
      filename?: string;
      quality?: 'high' | 'medium' | 'low';
      units?: 'mm' | 'inches';
      includeThumbnail?: boolean;
      includeColors?: boolean;
      onProgress?: (progress: any) => void;
    } = {}
  ) {
    const { ThreeMFExporter } = await import('./threemfExporter');
    const { FileDownloadManager } = await import('./fileDownload');
    const { ExportValidator } = await import('./exportValidator');

    // Create exporter with quality settings
    const exportOptions = {
      format: '3mf' as const,
      binary: true,
      precision: options.quality === 'high' ? 6 : options.quality === 'medium' ? 4 : 3,
      units: options.units || 'mm',
      includeColors: options.includeColors ?? true,
      includeMetadata: true,
      includeTextures: false,
      includeThumbnail: options.includeThumbnail ?? true,
      compressionLevel: options.quality === 'high' ? 9 : options.quality === 'medium' ? 6 : 3,
      metadata: {
        'Application': 'Parametric 3D Bookmark Generator',
        'CreationDate': new Date().toISOString()
      }
    };

    const exporter = new ThreeMFExporter(exportOptions, options.onProgress);

    // Validate before export
    const validator = ExportValidator.createForQuality(options.quality || 'medium');
    const validation = await validator.validateForExport(geometry, exportOptions);

    if (!validation.isValid) {
      throw new Error(`Export validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Export geometry
    const result = await exporter.export(geometry);
    
    if (!result.success || !result.data) {
      throw new Error('Export failed');
    }

    // Download file
    const downloadManager = new FileDownloadManager();
    const filename = options.filename || result.filename;
    
    const downloadSuccess = await downloadManager.downloadFile(result.data, {
      filename,
      mimeType: result.mimeType,
      saveDialog: true,
      onProgress: options.onProgress ? 
        (loaded, total) => options.onProgress!({ 
          stage: 'complete' as const, 
          progress: loaded / total, 
          message: 'Downloading...', 
          currentLayer: 0, 
          totalLayers: 0, 
          bytesWritten: loaded, 
          estimatedSize: total 
        }) : undefined
    });

    return {
      success: downloadSuccess,
      filename,
      size: result.size,
      duration: result.duration,
      warnings: result.warnings
    };
  }

  /**
   * Validate geometry for export without actually exporting
   */
  static async validateGeometry(
    geometry: any,
    format: 'stl' | '3mf' = 'stl',
    quality: 'high' | 'medium' | 'low' = 'medium'
  ) {
    const { ExportValidator } = await import('./exportValidator');
    
    const validator = ExportValidator.createForQuality(quality);
    const config = {
      format,
      binary: true,
      precision: 4,
      units: 'mm' as const,
      includeColors: format === '3mf',
      includeMetadata: true
    };

    return await validator.validateForExport(geometry, config);
  }

  /**
   * Get export capabilities for current browser
   */
  static getCapabilities() {
    const { FileDownloadManager } = require('./fileDownload');
    const manager = new FileDownloadManager();
    return manager.getCapabilities();
  }

  /**
   * Estimate file size before export
   */
  static estimateFileSize(
    geometry: any,
    format: 'stl' | '3mf' = 'stl'
  ): number {
    switch (format) {
      case 'stl':
        // STL: 80 byte header + 4 byte count + 50 bytes per triangle
        return 84 + (geometry.totalTriangles * 50);
      case '3mf':
        // 3MF: More complex, rough estimate
        return 10240 + (geometry.totalTriangles * 40); // 10KB overhead + compressed data
      default:
        return 0;
    }
  }
}

/**
 * Export presets for different use cases
 */
export const ExportPresets = {
  /**
   * High quality preset for professional printing
   */
  professional: {
    format: 'stl' as const,
    binary: true,
    precision: 6,
    units: 'mm' as const,
    includeColors: false,
    includeMetadata: true,
    mergeGeometry: true,
    generateNormals: true,
    quality: 'high' as const
  },

  /**
   * Standard quality preset for general use
   */
  standard: {
    format: 'stl' as const,
    binary: true,
    precision: 4,
    units: 'mm' as const,
    includeColors: false,
    includeMetadata: true,
    mergeGeometry: true,
    generateNormals: true,
    quality: 'medium' as const
  },

  /**
   * Draft quality preset for quick prototyping
   */
  draft: {
    format: 'stl' as const,
    binary: true,
    precision: 3,
    units: 'mm' as const,
    includeColors: false,
    includeMetadata: false,
    mergeGeometry: true,
    generateNormals: false,
    quality: 'low' as const
  },

  /**
   * Web sharing preset (smaller file sizes)
   */
  webSharing: {
    format: 'stl' as const,
    binary: true,
    precision: 3,
    units: 'mm' as const,
    includeColors: false,
    includeMetadata: false,
    mergeGeometry: true,
    generateNormals: false,
    quality: 'low' as const
  },

  /**
   * Multi-color 3MF preset for modern printers
   */
  multiColor3MF: {
    format: '3mf' as const,
    binary: true,
    precision: 5,
    units: 'mm' as const,
    includeColors: true,
    includeMetadata: true,
    includeTextures: false,
    includeThumbnail: true,
    compressionLevel: 6,
    quality: 'high' as const
  }
};

/**
 * Export error codes and their meanings
 */
export const ExportErrorCodes = {
  NO_GEOMETRY: 'No geometry provided for export',
  NO_LAYERS: 'Geometry must contain at least one layer',
  NOT_TRIANGULATED: 'Geometry is not properly triangulated',
  DEGENERATE_TRIANGLES: 'Geometry contains degenerate triangles',
  TOO_MANY_TRIANGLES: 'Triangle count exceeds maximum limit',
  FILE_TOO_LARGE: 'Estimated file size exceeds browser limit',
  NOT_MANIFOLD: 'Geometry is not a manifold mesh',
  NOT_WATERTIGHT: 'Geometry is not watertight',
  TOO_THIN: 'Geometry is too thin for reliable 3D printing',
  UNSUPPORTED_FORMAT: 'Export format is not supported',
  VALIDATION_ERROR: 'General validation error occurred'
};

/**
 * Default export instance for quick access
 */
export const DefaultExporter = {
  async exportSTL(geometry: any, options?: any) {
    return QuickExport.exportSTL(geometry, options);
  },

  async export3MF(geometry: any, options?: any) {
    return QuickExport.export3MF(geometry, options);
  },

  async validate(geometry: any, format?: any, quality?: any) {
    return QuickExport.validateGeometry(geometry, format, quality);
  },

  getCapabilities() {
    return QuickExport.getCapabilities();
  },

  estimateSize(geometry: any, format?: any) {
    return QuickExport.estimateFileSize(geometry, format);
  }
};