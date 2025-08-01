/**
 * Export validation system for quality assurance
 * Validates geometry integrity and export compatibility
 */

import * as THREE from 'three';
import type { BookmarkGeometry, GeometryLayer } from '../../types/geometry';
import type { ExportValidation, ExportError, ExportConfig } from '../../types/export';

/**
 * Validation severity levels
 */
export const ValidationSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
} as const;

export type ValidationSeverity = typeof ValidationSeverity[keyof typeof ValidationSeverity];

/**
 * Validation categories
 */
export const ValidationCategory = {
  GEOMETRY: 'geometry',
  TOPOLOGY: 'topology',
  PRINTABILITY: 'printability',
  PERFORMANCE: 'performance',
  FORMAT: 'format'
} as const;

export type ValidationCategory = typeof ValidationCategory[keyof typeof ValidationCategory];

/**
 * Validation rules configuration
 */
export interface ValidationRules {
  maxTriangles: number;
  maxFileSize: number; // bytes
  minFeatureSize: number; // mm
  maxAspectRatio: number;
  requireManifold: boolean;
  requireWatertight: boolean;
  allowDegenerateTriangles: boolean;
  minThickness: number; // mm
}

/**
 * Comprehensive export validator
 */
export class ExportValidator {
  private rules: ValidationRules;

  constructor(rules: Partial<ValidationRules> = {}) {
    this.rules = {
      maxTriangles: 500000,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      minFeatureSize: 0.4, // Minimum printable feature size
      maxAspectRatio: 20, // Max width/thickness ratio
      requireManifold: true,
      requireWatertight: true,
      allowDegenerateTriangles: false,
      minThickness: 0.8, // Minimum printable thickness
      ...rules
    };
  }

  /**
   * Comprehensive validation of geometry for export
   */
  async validateForExport(
    geometry: BookmarkGeometry,
    config: ExportConfig
  ): Promise<ExportValidation> {
    const errors: ExportError[] = [];
    const warnings: string[] = [];
    let fileSize = 0;

    try {
      // Basic geometry validation
      const basicValidation = this.validateBasicGeometry(geometry);
      errors.push(...basicValidation.errors);
      warnings.push(...basicValidation.warnings);

      // Topology validation
      const topologyValidation = await this.validateTopology(geometry);
      errors.push(...topologyValidation.errors);
      warnings.push(...topologyValidation.warnings);

      // Printability validation
      const printabilityValidation = this.validatePrintability(geometry);
      errors.push(...printabilityValidation.errors);
      warnings.push(...printabilityValidation.warnings);

      // Performance validation
      const performanceValidation = this.validatePerformance(geometry);
      errors.push(...performanceValidation.errors);
      warnings.push(...performanceValidation.warnings);

      // Format-specific validation
      const formatValidation = this.validateFormat(geometry, config);
      errors.push(...formatValidation.errors);
      warnings.push(...formatValidation.warnings);

      // Calculate file size estimate
      fileSize = this.estimateFileSize(geometry, config);

      // File size validation
      if (fileSize > this.rules.maxFileSize) {
        errors.push({
          type: 'size',
          code: 'FILE_TOO_LARGE',
          message: `Estimated file size (${Math.round(fileSize / 1024 / 1024)}MB) exceeds maximum (${Math.round(this.rules.maxFileSize / 1024 / 1024)}MB)`,
          severity: 'error'
        });
      }

    } catch (error) {
      errors.push({
        type: 'geometry',
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }

    return {
      isValid: !errors.some(e => e.severity === 'error'),
      errors,
      warnings,
      fileSize
    };
  }

  /**
   * Validate basic geometry structure
   */
  private validateBasicGeometry(geometry: BookmarkGeometry): { errors: ExportError[], warnings: string[] } {
    const errors: ExportError[] = [];
    const warnings: string[] = [];

    // Check if geometry exists
    if (!geometry) {
      errors.push({
        type: 'geometry',
        code: 'NO_GEOMETRY',
        message: 'No geometry provided for validation',
        severity: 'error'
      });
      return { errors, warnings };
    }

    // Check layers
    if (!geometry.layers || geometry.layers.length === 0) {
      errors.push({
        type: 'geometry',
        code: 'NO_LAYERS',
        message: 'Geometry must contain at least one layer',
        severity: 'error'
      });
      return { errors, warnings };
    }

    // Validate each layer
    for (let i = 0; i < geometry.layers.length; i++) {
      const layer = geometry.layers[i];
      const layerValidation = this.validateLayer(layer, i);
      errors.push(...layerValidation.errors);
      warnings.push(...layerValidation.warnings);
    }

    // Check triangle count
    if (geometry.totalTriangles > this.rules.maxTriangles) {
      warnings.push(`High triangle count (${geometry.totalTriangles}). Consider optimizing geometry.`);
    }

    return { errors, warnings };
  }

  /**
   * Validate individual layer
   */
  private validateLayer(layer: GeometryLayer, index: number): { errors: ExportError[], warnings: string[] } {
    const errors: ExportError[] = [];
    const warnings: string[] = [];

    if (!layer.geometry) {
      errors.push({
        type: 'geometry',
        code: 'LAYER_NO_GEOMETRY',
        message: `Layer ${index} has no geometry`,
        severity: 'error'
      });
      return { errors, warnings };
    }

    const positions = layer.geometry.attributes.position;
    if (!positions || positions.count === 0) {
      errors.push({
        type: 'geometry',
        code: 'LAYER_NO_VERTICES',
        message: `Layer ${index} has no vertices`,
        severity: 'error'
      });
      return { errors, warnings };
    }

    // Check for triangulated geometry
    if (positions.count % 3 !== 0) {
      errors.push({
        type: 'geometry',
        code: 'NOT_TRIANGULATED',
        message: `Layer ${index} is not properly triangulated`,
        severity: 'error'
      });
    }

    // Check for degenerate triangles
    const degenerateCount = this.countDegenerateTriangles(layer.geometry);
    if (degenerateCount > 0) {
      if (this.rules.allowDegenerateTriangles) {
        warnings.push(`Layer ${index} has ${degenerateCount} degenerate triangles`);
      } else {
        errors.push({
          type: 'geometry',
          code: 'DEGENERATE_TRIANGLES',
          message: `Layer ${index} has ${degenerateCount} degenerate triangles`,
          severity: 'error'
        });
      }
    }

    // Check normals
    if (!layer.geometry.attributes.normal) {
      warnings.push(`Layer ${index} has no vertex normals. They will be computed automatically.`);
    }

    return { errors, warnings };
  }

  /**
   * Count degenerate triangles in geometry
   */
  private countDegenerateTriangles(geometry: THREE.BufferGeometry): number {
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

      const area = this.calculateTriangleArea(v1, v2, v3);
      if (area < 1e-10) {
        count++;
      }
    }

    return count;
  }

  /**
   * Calculate triangle area
   */
  private calculateTriangleArea(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): number {
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    return edge1.cross(edge2).length() * 0.5;
  }

  /**
   * Validate topology (manifold, watertight)
   */
  private async validateTopology(geometry: BookmarkGeometry): Promise<{ errors: ExportError[], warnings: string[] }> {
    const errors: ExportError[] = [];
    const warnings: string[] = [];

    if (!this.rules.requireManifold && !this.rules.requireWatertight) {
      return { errors, warnings };
    }

    // For performance, we'll do a simplified topology check
    // In a production system, you'd want more comprehensive checks
    for (let i = 0; i < geometry.layers.length; i++) {
      const layer = geometry.layers[i];
      if (!layer.geometry || !layer.visible) continue;

      const topologyResult = this.checkBasicTopology(layer.geometry);
      
      if (this.rules.requireManifold && !topologyResult.isManifold) {
        errors.push({
          type: 'geometry',
          code: 'NOT_MANIFOLD',
          message: `Layer ${i} is not a manifold mesh`,
          severity: 'error'
        });
      }

      if (this.rules.requireWatertight && !topologyResult.isWatertight) {
        errors.push({
          type: 'geometry',
          code: 'NOT_WATERTIGHT',
          message: `Layer ${i} is not watertight`,
          severity: 'error'
        });
      }

      if (topologyResult.hasNonManifoldEdges) {
        warnings.push(`Layer ${i} has non-manifold edges`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Basic topology check (simplified)
   */
  private checkBasicTopology(geometry: THREE.BufferGeometry): {
    isManifold: boolean;
    isWatertight: boolean;
    hasNonManifoldEdges: boolean;
  } {
    // This is a simplified check. In production, you'd want to implement
    // a proper half-edge data structure or use a dedicated mesh library
    const positions = geometry.attributes.position;
    if (!positions) {
      return { isManifold: false, isWatertight: false, hasNonManifoldEdges: true };
    }

    // For now, just check for basic issues
    const hasValidVertices = positions.count > 0 && positions.count % 3 === 0;
    const hasDecentTriangleCount = positions.count / 3 > 4; // At least a tetrahedron

    return {
      isManifold: hasValidVertices && hasDecentTriangleCount,
      isWatertight: hasValidVertices && hasDecentTriangleCount,
      hasNonManifoldEdges: false
    };
  }

  /**
   * Validate printability constraints
   */
  private validatePrintability(geometry: BookmarkGeometry): { errors: ExportError[], warnings: string[] } {
    const errors: ExportError[] = [];
    const warnings: string[] = [];

    if (!geometry.boundingBox) {
      warnings.push('No bounding box available for printability analysis');
      return { errors, warnings };
    }

    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    
    // Check minimum thickness
    if (size.z < this.rules.minThickness) {
      errors.push({
        type: 'geometry',
        code: 'TOO_THIN',
        message: `Bookmark thickness (${size.z.toFixed(2)}mm) is below minimum printable thickness (${this.rules.minThickness}mm)`,
        severity: 'error'
      });
    }

    // Check aspect ratio
    const aspectRatio = Math.max(size.x, size.y) / size.z;
    if (aspectRatio > this.rules.maxAspectRatio) {
      warnings.push(`High aspect ratio (${aspectRatio.toFixed(1)}:1). May cause printing issues.`);
    }

    // Check for small features
    const smallFeatures = this.detectSmallFeatures(geometry);
    if (smallFeatures > 0) {
      warnings.push(`Detected ${smallFeatures} features smaller than ${this.rules.minFeatureSize}mm`);
    }

    // Check layer heights
    for (let i = 0; i < geometry.layers.length; i++) {
      const layer = geometry.layers[i];
      if (layer.height < this.rules.minFeatureSize) {
        warnings.push(`Layer ${i} height (${layer.height}mm) may be too small for reliable printing`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Detect small features (simplified)
   */
  private detectSmallFeatures(geometry: BookmarkGeometry): number {
    // This is a simplified implementation
    // In practice, you'd analyze edge lengths, hole sizes, etc.
    let smallFeatureCount = 0;

    for (const layer of geometry.layers) {
      if (!layer.geometry || !layer.visible) continue;

      const positions = layer.geometry.attributes.position;
      if (!positions) continue;

      // Check for very short edges
      for (let i = 0; i < positions.count; i += 3) {
        const v1 = new THREE.Vector3().fromBufferAttribute(positions, i);
        const v2 = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
        const v3 = new THREE.Vector3().fromBufferAttribute(positions, i + 2);

        const edge1Length = v1.distanceTo(v2);
        const edge2Length = v2.distanceTo(v3);
        const edge3Length = v3.distanceTo(v1);

        if (edge1Length < this.rules.minFeatureSize ||
            edge2Length < this.rules.minFeatureSize ||
            edge3Length < this.rules.minFeatureSize) {
          smallFeatureCount++;
        }
      }
    }

    return smallFeatureCount;
  }

  /**
   * Validate performance constraints
   */
  private validatePerformance(geometry: BookmarkGeometry): { errors: ExportError[], warnings: string[] } {
    const errors: ExportError[] = [];
    const warnings: string[] = [];

    // Check triangle count
    if (geometry.totalTriangles > this.rules.maxTriangles) {
      errors.push({
        type: 'geometry',
        code: 'TOO_MANY_TRIANGLES',
        message: `Triangle count (${geometry.totalTriangles}) exceeds maximum (${this.rules.maxTriangles})`,
        severity: 'error'
      });
    } else if (geometry.totalTriangles > this.rules.maxTriangles * 0.8) {
      warnings.push(`High triangle count (${geometry.totalTriangles}). Export may be slow.`);
    }

    // Check memory usage estimate
    const estimatedMemory = geometry.totalTriangles * 150; // bytes per triangle (rough estimate)
    if (estimatedMemory > 512 * 1024 * 1024) { // 512MB
      warnings.push(`High memory usage estimated (${Math.round(estimatedMemory / 1024 / 1024)}MB)`);
    }

    return { errors, warnings };
  }

  /**
   * Validate format-specific constraints
   */
  private validateFormat(geometry: BookmarkGeometry, config: ExportConfig): { errors: ExportError[], warnings: string[] } {
    const errors: ExportError[] = [];
    const warnings: string[] = [];

    switch (config.format) {
      case 'stl':
        // STL doesn't support colors
        if (config.includeColors && geometry.layers.length > 1) {
          warnings.push('STL format does not support colors. Layers will be merged.');
        }
        break;

      case '3mf':
        // 3MF has better support for colors and metadata
        if (geometry.layers.length > 100) {
          warnings.push('Large number of layers may increase 3MF file complexity');
        }
        break;

      default:
        errors.push({
          type: 'format',
          code: 'UNSUPPORTED_FORMAT',
          message: `Unsupported export format: ${config.format}`,
          severity: 'error'
        });
    }

    return { errors, warnings };
  }

  /**
   * Estimate file size for different formats
   */
  private estimateFileSize(geometry: BookmarkGeometry, config: ExportConfig): number {
    switch (config.format) {
      case 'stl':
        // STL: 80 byte header + 4 byte count + 50 bytes per triangle
        return 84 + (geometry.totalTriangles * 50);

      case '3mf':
        // 3MF: More complex, depends on compression
        // Rough estimate: XML overhead + compressed geometry data
        const xmlOverhead = 10 * 1024; // 10KB XML overhead
        const geometryData = geometry.totalTriangles * 40; // Compressed estimate
        return xmlOverhead + geometryData;

      default:
        return 0;
    }
  }

  /**
   * Create validator with preset rules
   */
  static createForQuality(quality: 'high' | 'medium' | 'low'): ExportValidator {
    const rules: Record<string, ValidationRules> = {
      high: {
        maxTriangles: 100000,
        maxFileSize: 50 * 1024 * 1024,
        minFeatureSize: 0.6,
        maxAspectRatio: 15,
        requireManifold: true,
        requireWatertight: true,
        allowDegenerateTriangles: false,
        minThickness: 1.0
      },
      medium: {
        maxTriangles: 300000,
        maxFileSize: 100 * 1024 * 1024,
        minFeatureSize: 0.4,
        maxAspectRatio: 20,
        requireManifold: true,
        requireWatertight: false,
        allowDegenerateTriangles: false,
        minThickness: 0.8
      },
      low: {
        maxTriangles: 500000,
        maxFileSize: 200 * 1024 * 1024,
        minFeatureSize: 0.2,
        maxAspectRatio: 30,
        requireManifold: false,
        requireWatertight: false,
        allowDegenerateTriangles: true,
        minThickness: 0.4
      }
    };

    return new ExportValidator(rules[quality]);
  }
}