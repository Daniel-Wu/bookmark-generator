/**
 * Abstract base class for all geometry export formats
 * Provides common functionality for export validation, preprocessing, and error handling
 */

import * as THREE from 'three';
import type { BookmarkGeometry, GeometryLayer } from '../../types/geometry';
import type {
  ExportConfig,
  ExportProgress,
  ExportResult,
  ExportValidation,
  ExportError,
  ExportMetadata,
  ExportMetrics
} from '../../types/export';

/**
 * Abstract base class for geometry exporters
 */
export abstract class GeometryExporter {
  protected progressCallback?: (progress: ExportProgress) => void;
  protected cancelRequested = false;
  protected startTime = 0;
  protected currentStage: ExportProgress['stage'] = 'preparing';

  protected config: ExportConfig;

  constructor(
    config: ExportConfig,
    progressCallback?: (progress: ExportProgress) => void
  ) {
    this.config = config;
    this.progressCallback = progressCallback;
  }

  /**
   * Export geometry to binary format
   */
  async export(geometry: BookmarkGeometry): Promise<ExportResult> {
    this.startTime = performance.now();
    this.cancelRequested = false;

    try {
      // Validate geometry before export
      const validation = await this.validateGeometry(geometry);
      if (!validation.isValid) {
        throw new Error(`Geometry validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Report progress
      this.reportProgress('preparing', 0, 'Preparing geometry for export...');

      // Preprocess geometry
      const preprocessed = await this.preprocessGeometry(geometry);
      this.checkCancellation();

      this.reportProgress('generating', 0.3, 'Generating export data...');

      // Generate format-specific data
      const exportData = await this.generateExportData(preprocessed);
      this.checkCancellation();

      this.reportProgress('writing', 0.8, 'Writing binary data...');

      // Write binary data
      const binaryData = await this.writeBinaryData(exportData);
      this.checkCancellation();

      // Calculate metrics
      const duration = performance.now() - this.startTime;
      const metadata = this.generateMetadata(geometry, duration);
      const metrics = this.calculateMetrics(binaryData, duration);

      this.reportProgress('complete', 1.0, 'Export complete');

      return {
        success: true,
        data: binaryData,
        filename: this.generateFilename(),
        mimeType: this.getMimeType(),
        size: binaryData.byteLength,
        duration,
        warnings: validation.warnings,
        metadata
      };

    } catch (error) {
      return {
        success: false,
        filename: this.generateFilename(),
        mimeType: this.getMimeType(),
        size: 0,
        duration: performance.now() - this.startTime,
        warnings: [],
        metadata: this.generateMetadata(geometry, performance.now() - this.startTime)
      };
    }
  }

  /**
   * Cancel the current export operation
   */
  cancel(): void {
    this.cancelRequested = true;
  }

  /**
   * Validate geometry for export
   */
  protected async validateGeometry(geometry: BookmarkGeometry): Promise<ExportValidation> {
    const errors: ExportError[] = [];
    const warnings: string[] = [];

    // Check if geometry has layers
    if (!geometry.layers || geometry.layers.length === 0) {
      errors.push({
        type: 'geometry',
        code: 'NO_LAYERS',
        message: 'Geometry must have at least one layer',
        severity: 'error'
      });
    }

    // Check triangle count limits
    if (geometry.totalTriangles > 500000) {
      warnings.push(`High triangle count (${geometry.totalTriangles}). Export may be slow.`);
    }

    // Validate each layer
    for (const layer of geometry.layers) {
      const layerValidation = this.validateLayer(layer);
      errors.push(...layerValidation.errors);
      warnings.push(...layerValidation.warnings);
    }

    // Check file size estimate
    const estimatedSize = this.estimateFileSize(geometry);
    if (estimatedSize > 100 * 1024 * 1024) { // 100MB
      warnings.push(`Large file size estimated (${Math.round(estimatedSize / 1024 / 1024)}MB)`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileSize: estimatedSize
    };
  }

  /**
   * Validate individual layer
   */
  protected validateLayer(layer: GeometryLayer): { errors: ExportError[], warnings: string[] } {
    const errors: ExportError[] = [];
    const warnings: string[] = [];

    if (!layer.geometry) {
      errors.push({
        type: 'geometry',
        code: 'MISSING_GEOMETRY',
        message: `Layer ${layer.id} has no geometry`,
        severity: 'error'
      });
      return { errors, warnings };
    }

    // Check for valid positions
    const positions = layer.geometry.attributes.position;
    if (!positions || positions.count === 0) {
      errors.push({
        type: 'geometry',
        code: 'NO_VERTICES',
        message: `Layer ${layer.id} has no vertices`,
        severity: 'error'
      });
    }

    // Check for triangulated geometry
    if (positions && positions.count % 3 !== 0) {
      errors.push({
        type: 'geometry',
        code: 'NOT_TRIANGULATED',
        message: `Layer ${layer.id} geometry is not properly triangulated`,
        severity: 'error'
      });
    }

    // Check for degenerate triangles
    if (positions) {
      const degenerateCount = this.countDegenerateTriangles(layer.geometry);
      if (degenerateCount > 0) {
        warnings.push(`Layer ${layer.id} has ${degenerateCount} degenerate triangles that will be skipped`);
      }
    }

    // Check normals
    if (!layer.geometry.attributes.normal) {
      warnings.push(`Layer ${layer.id} has no normals. They will be computed automatically.`);
    }

    return { errors, warnings };
  }

  /**
   * Count degenerate triangles in geometry
   */
  protected countDegenerateTriangles(geometry: THREE.BufferGeometry): number {
    const positions = geometry.attributes.position;
    if (!positions) return 0;

    let count = 0;
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const v3 = new THREE.Vector3();

    for (let i = 0; i < positions.count; i += 3) {
      v1.fromBufferAttribute(positions, i);
      v2.fromBufferAttribute(positions, i + 1);
      v3.fromBufferAttribute(positions, i + 2);

      // Check if triangle has zero area
      const area = v2.clone().sub(v1).cross(v3.clone().sub(v1)).length();
      if (area < 1e-10) {
        count++;
      }
    }

    return count;
  }

  /**
   * Preprocess geometry before export
   */
  protected async preprocessGeometry(geometry: BookmarkGeometry): Promise<BookmarkGeometry> {
    const preprocessed: BookmarkGeometry = {
      layers: [],
      boundingBox: geometry.boundingBox.clone(),
      totalTriangles: 0,
      estimatedFileSize: 0
    };

    let totalTriangles = 0;

    for (const layer of geometry.layers) {
      if (!layer.visible) continue;

      const processedGeometry = layer.geometry.clone();
      
      // Ensure geometry has normals
      if (!processedGeometry.attributes.normal) {
        processedGeometry.computeVertexNormals();
      }

      // Remove degenerate triangles
      const cleanGeometry = this.removeDegenerateTriangles(processedGeometry);
      
      // Merge vertices if needed
      const optimizedGeometry = this.optimizeGeometry(cleanGeometry);

      const processedLayer: GeometryLayer = {
        ...layer,
        geometry: optimizedGeometry,
        triangleCount: optimizedGeometry.attributes.position.count / 3
      };

      preprocessed.layers.push(processedLayer);
      totalTriangles += processedLayer.triangleCount;
    }

    preprocessed.totalTriangles = totalTriangles;
    preprocessed.estimatedFileSize = this.estimateFileSize(preprocessed);

    return preprocessed;
  }

  /**
   * Remove degenerate triangles from geometry
   */
  protected removeDegenerateTriangles(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    
    if (!positions) return geometry;

    const validTriangles: number[] = [];
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const v3 = new THREE.Vector3();

    for (let i = 0; i < positions.count; i += 3) {
      v1.fromBufferAttribute(positions, i);
      v2.fromBufferAttribute(positions, i + 1);
      v3.fromBufferAttribute(positions, i + 2);

      // Check if triangle has sufficient area
      const area = v2.clone().sub(v1).cross(v3.clone().sub(v1)).length();
      if (area > 1e-10) {
        validTriangles.push(i, i + 1, i + 2);
      }
    }

    if (validTriangles.length === positions.count) {
      return geometry; // No degenerate triangles found
    }

    // Create new geometry with only valid triangles
    const newGeometry = new THREE.BufferGeometry();
    const newPositions = new Float32Array(validTriangles.length * 3);
    const newNormals = normals ? new Float32Array(validTriangles.length * 3) : null;

    for (let i = 0; i < validTriangles.length; i++) {
      const srcIndex = validTriangles[i];
      newPositions[i * 3] = positions.getX(srcIndex);
      newPositions[i * 3 + 1] = positions.getY(srcIndex);
      newPositions[i * 3 + 2] = positions.getZ(srcIndex);

      if (newNormals && normals) {
        newNormals[i * 3] = normals.getX(srcIndex);
        newNormals[i * 3 + 1] = normals.getY(srcIndex);
        newNormals[i * 3 + 2] = normals.getZ(srcIndex);
      }
    }

    newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    if (newNormals) {
      newGeometry.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
    }

    return newGeometry;
  }

  /**
   * Optimize geometry (merge vertices, etc.)
   */
  protected optimizeGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    // For now, just return the geometry as-is
    // In a real implementation, you might want to merge vertices,
    // simplify meshes, or perform other optimizations
    return geometry;
  }

  /**
   * Check if export has been cancelled
   */
  protected checkCancellation(): void {
    if (this.cancelRequested) {
      throw new Error('Export cancelled by user');
    }
  }

  /**
   * Report progress to callback
   */
  protected reportProgress(
    stage: ExportProgress['stage'],
    progress: number,
    message: string,
    currentLayer = 0,
    totalLayers = 0
  ): void {
    this.currentStage = stage;
    
    if (this.progressCallback) {
      this.progressCallback({
        stage,
        progress: Math.min(1, Math.max(0, progress)),
        currentLayer,
        totalLayers,
        message,
        bytesWritten: 0,
        estimatedSize: 0
      });
    }
  }

  /**
   * Generate export metadata
   */
  protected generateMetadata(geometry: BookmarkGeometry, duration: number): ExportMetadata {
    return {
      format: this.config.format,
      version: '1.0',
      generator: 'Parametric 3D Bookmark Generator',
      timestamp: new Date().toISOString(),
      units: this.config.units,
      geometry: {
        vertices: geometry.layers.reduce((sum, layer) => sum + (layer.geometry.attributes.position?.count || 0), 0),
        faces: geometry.totalTriangles,
        layers: geometry.layers.length,
        materials: geometry.layers.length
      },
      parameters: {
        dimensions: { width: 0, height: 0, thickness: 0 }, // TODO: Extract from geometry
        layerThickness: 0, // TODO: Extract from parameters
        colorCount: geometry.layers.length
      }
    };
  }

  /**
   * Calculate export metrics
   */
  protected calculateMetrics(data: Uint8Array, duration: number): ExportMetrics {
    return {
      preparationTime: duration * 0.3, // Rough estimate
      generationTime: duration * 0.5,
      writeTime: duration * 0.2,
      totalTime: duration,
      throughput: data.byteLength / (duration / 1000), // bytes per second
      memoryUsage: {
        peak: data.byteLength * 2, // Rough estimate
        final: data.byteLength
      }
    };
  }

  // Abstract methods to be implemented by subclasses
  protected abstract generateExportData(geometry: BookmarkGeometry): Promise<any>;
  protected abstract writeBinaryData(data: any): Promise<Uint8Array>;
  protected abstract estimateFileSize(geometry: BookmarkGeometry): number;
  protected abstract generateFilename(): string;
  protected abstract getMimeType(): string;
}