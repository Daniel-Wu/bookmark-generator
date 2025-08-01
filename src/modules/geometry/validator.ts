/**
 * GeometryValidator - 3D printing validation and quality assurance
 * Validates geometry for manifold properties, printability, and structural integrity
 */

import * as THREE from 'three';
import type { 
  BookmarkGeometry,
  GeometryLayer,
  BookmarkParameters
} from '../../types';
import type {
  PrintabilityCheck,
  PrintabilityIssue,
  GeometryValidation,
  MeshQuality
} from '../../types/geometry';

// ========================
// Validation Configuration
// ========================

export interface ValidationConfig {
  // Manifold validation
  checkManifold: boolean;
  checkWatertight: boolean;
  allowSelfIntersections: boolean;
  
  // 3D printing constraints
  minWallThickness: number; // mm
  minFeatureSize: number; // mm
  maxOverhangAngle: number; // degrees
  bridgeSupport: boolean;
  
  // Structural validation
  checkStability: boolean;
  maxAspectRatio: number;
  checkConnectivity: boolean;
  
  // Quality thresholds
  maxVertices: number;
  maxTriangles: number;
  minTriangleQuality: number; // 0-1
  
  // Performance limits
  validationTimeout: number; // milliseconds
  memoryLimit: number; // bytes
}

const DEFAULT_CONFIG: ValidationConfig = {
  checkManifold: true,
  checkWatertight: true,
  allowSelfIntersections: false,
  
  minWallThickness: 0.4, // Typical FDM minimum
  minFeatureSize: 0.8, // Conservative for detail preservation
  maxOverhangAngle: 45, // Standard overhang limit
  bridgeSupport: false, // Assume no support structures
  
  checkStability: true,
  maxAspectRatio: 10, // Height to base ratio
  checkConnectivity: true,
  
  maxVertices: 200000,
  maxTriangles: 100000,
  minTriangleQuality: 0.1,
  
  validationTimeout: 30000, // 30 seconds
  memoryLimit: 100 * 1024 * 1024, // 100MB
};

// ========================
// GeometryValidator Class
// ========================

export class GeometryValidator {
  private config: ValidationConfig;
  private startTime: number = 0;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate complete bookmark geometry for 3D printing
   */
  async validateGeometry(
    geometry: BookmarkGeometry,
    parameters?: BookmarkParameters
  ): Promise<PrintabilityCheck> {
    this.startTime = performance.now();
    
    const issues: PrintabilityIssue[] = [];
    const recommendations: string[] = [];
    
    try {
      // Stage 1: Basic geometry validation
      this.validateBasicGeometry(geometry, issues);
      
      // Stage 2: Layer-by-layer validation
      for (let i = 0; i < geometry.layers.length; i++) {
        await this.validateLayer(geometry.layers[i], i, issues, recommendations);
      }
      
      // Stage 3: Inter-layer validation
      this.validateLayerConnections(geometry, issues, recommendations);
      
      // Stage 4: 3D printing specific checks
      if (parameters) {
        this.validate3DPrintingConstraints(geometry, parameters, issues, recommendations);
      }
      
      // Stage 5: Structural analysis
      if (this.config.checkStability) {
        this.validateStructuralStability(geometry, issues, recommendations);
      }
      
      // Stage 6: Performance and quality checks
      this.validatePerformanceConstraints(geometry, issues, recommendations);
      
      const isPrintable = !issues.some(issue => issue.severity === 'error');
      
      return {
        isPrintable,
        issues,
        recommendations,
        estimatedPrintTime: this.estimatePrintTime(geometry, parameters),
        materialUsage: this.estimateMaterialUsage(geometry, parameters),
      };
      
    } catch (error) {
      issues.push({
        type: 'non-manifold',
        severity: 'error',
        description: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        affectedFaces: [],
      });
      
      return {
        isPrintable: false,
        issues,
        recommendations: ['Try regenerating the geometry with simpler parameters'],
        estimatedPrintTime: 0,
        materialUsage: 0,
      };
    }
  }

  /**
   * Validate single geometry layer
   */
  async validateLayer(
    layer: GeometryLayer,
    layerIndex: number,
    issues: PrintabilityIssue[],
    recommendations: string[]
  ): Promise<void> {
    const geometry = layer.geometry;
    
    // Check for empty geometry
    if (!geometry.getAttribute('position')) {
      issues.push({
        type: 'non-manifold',
        severity: 'error',
        description: `Layer ${layerIndex} has no geometry`,
        affectedFaces: [],
      });
      return;
    }
    
    // Manifold validation
    if (this.config.checkManifold) {
      await this.validateManifold(geometry, layerIndex, issues);
    }
    
    // Watertight validation
    if (this.config.checkWatertight) {
      await this.validateWatertight(geometry, layerIndex, issues);
    }
    
    // Self-intersection check
    if (!this.config.allowSelfIntersections) {
      await this.checkSelfIntersections(geometry, layerIndex, issues);
    }
    
    // Feature size validation
    this.validateFeatureSizes(geometry, layerIndex, issues, recommendations);
    
    // Triangle quality
    this.validateTriangleQuality(geometry, layerIndex, issues, recommendations);
  }

  /**
   * Validate manifold properties
   */
  private async validateManifold(
    geometry: THREE.BufferGeometry,
    layerIndex: number,
    issues: PrintabilityIssue[]
  ): Promise<void> {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions || !indices) {
      issues.push({
        type: 'non-manifold',
        severity: 'error',
        description: `Layer ${layerIndex}: Missing position data or indices`,
        affectedFaces: [],
      });
      return;
    }
    
    // Build edge adjacency map
    const edges = new Map<string, number[]>();
    const nonManifoldEdges: string[] = [];
    
    for (let i = 0; i < indices.count; i += 3) {
      const triangle = i / 3;
      const i1 = indices.getX(i);
      const i2 = indices.getX(i + 1);
      const i3 = indices.getX(i + 2);
      
      const edgeKeys = [
        this.getEdgeKey(i1, i2),
        this.getEdgeKey(i2, i3),
        this.getEdgeKey(i3, i1),
      ];
      
      for (const key of edgeKeys) {
        if (!edges.has(key)) {
          edges.set(key, []);
        }
        edges.get(key)!.push(triangle);
      }
    }
    
    // Check for non-manifold edges (shared by more than 2 faces)
    for (const [edgeKey, triangles] of Array.from(edges)) {
      if (triangles.length > 2) {
        nonManifoldEdges.push(edgeKey);
        issues.push({
          type: 'non-manifold',
          severity: 'error',
          description: `Layer ${layerIndex}: Edge shared by ${triangles.length} faces (non-manifold)`,
          affectedFaces: triangles,
        });
      }
    }
    
    if (nonManifoldEdges.length > 0) {
      console.warn(`Layer ${layerIndex}: Found ${nonManifoldEdges.length} non-manifold edges`);
    }
  }

  /**
   * Validate watertight properties
   */
  private async validateWatertight(
    geometry: THREE.BufferGeometry,
    layerIndex: number,
    issues: PrintabilityIssue[]
  ): Promise<void> {
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!indices) return;
    
    // Count edge occurrences
    const edges = new Map<string, number>();
    
    for (let i = 0; i < indices.count; i += 3) {
      const i1 = indices.getX(i);
      const i2 = indices.getX(i + 1);
      const i3 = indices.getX(i + 2);
      
      const edgeKeys = [
        this.getEdgeKey(i1, i2),
        this.getEdgeKey(i2, i3),
        this.getEdgeKey(i3, i1),
      ];
      
      for (const key of edgeKeys) {
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
    
    // Find boundary edges (appearing only once)
    const boundaryEdges: string[] = [];
    for (const [key, count] of Array.from(edges)) {
      if (count === 1) {
        boundaryEdges.push(key);
      }
    }
    
    if (boundaryEdges.length > 0) {
      issues.push({
        type: 'non-manifold',
        severity: 'warning',
        description: `Layer ${layerIndex}: Found ${boundaryEdges.length} boundary edges (not watertight)`,
        affectedFaces: [],
      });
    }
  }

  /**
   * Check for self-intersections
   */
  private async checkSelfIntersections(
    geometry: THREE.BufferGeometry,
    layerIndex: number,
    issues: PrintabilityIssue[]
  ): Promise<void> {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions || !indices) return;
    
    // Simplified intersection check using bounding boxes
    const triangles: THREE.Triangle[] = [];
    const boundingBoxes: THREE.Box3[] = [];
    
    for (let i = 0; i < indices.count; i += 3) {
      const i1 = indices.getX(i);
      const i2 = indices.getX(i + 1);
      const i3 = indices.getX(i + 2);
      
      const v1 = new THREE.Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1));
      const v2 = new THREE.Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2));
      const v3 = new THREE.Vector3(positions.getX(i3), positions.getY(i3), positions.getZ(i3));
      
      const triangle = new THREE.Triangle(v1, v2, v3);
      triangles.push(triangle);
      
      const bbox = new THREE.Box3().setFromPoints([v1, v2, v3]);
      boundingBoxes.push(bbox);
    }
    
    // Check for intersections (simplified - only checks overlapping bounding boxes)
    let intersectionCount = 0;
    for (let i = 0; i < triangles.length; i++) {
      for (let j = i + 1; j < triangles.length; j++) {
        if (boundingBoxes[i].intersectsBox(boundingBoxes[j])) {
          // In a full implementation, would do actual triangle-triangle intersection
          intersectionCount++;
          if (intersectionCount > 5) break; // Limit checks for performance
        }
      }
      if (intersectionCount > 5) break;
    }
    
    if (intersectionCount > 0) {
      issues.push({
        type: 'intersections',
        severity: 'warning',
        description: `Layer ${layerIndex}: Potential self-intersections detected`,
        affectedFaces: [],
      });
    }
  }

  /**
   * Validate feature sizes for 3D printing
   */
  private validateFeatureSizes(
    geometry: THREE.BufferGeometry,
    layerIndex: number,
    issues: PrintabilityIssue[],
    recommendations: string[]
  ): void {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions || !indices) return;
    
    let smallFeatures = 0;
    const minSize = this.config.minFeatureSize;
    
    for (let i = 0; i < indices.count; i += 3) {
      const i1 = indices.getX(i);
      const i2 = indices.getX(i + 1);
      const i3 = indices.getX(i + 2);
      
      const v1 = new THREE.Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1));
      const v2 = new THREE.Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2));
      const v3 = new THREE.Vector3(positions.getX(i3), positions.getY(i3), positions.getZ(i3));
      
      const edges = [
        v1.distanceTo(v2),
        v2.distanceTo(v3),
        v3.distanceTo(v1),
      ];
      
      if (edges.some(edge => edge < minSize)) {
        smallFeatures++;
      }
    }
    
    if (smallFeatures > 0) {
      const severity = smallFeatures > indices.count / 20 ? 'error' : 'warning';
      issues.push({
        type: 'thin-wall',
        severity,
        description: `Layer ${layerIndex}: ${smallFeatures} features smaller than ${minSize}mm`,
        affectedFaces: [],
      });
      
      if (severity === 'warning') {
        recommendations.push(`Consider increasing minimum feature size or simplifying the design`);
      }
    }
  }

  /**
   * Validate triangle quality
   */
  private validateTriangleQuality(
    geometry: THREE.BufferGeometry,
    layerIndex: number,
    issues: PrintabilityIssue[],
    recommendations: string[]
  ): void {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions || !indices) return;
    
    let poorQualityTriangles = 0;
    const qualityThreshold = this.config.minTriangleQuality;
    
    for (let i = 0; i < indices.count; i += 3) {
      const i1 = indices.getX(i);
      const i2 = indices.getX(i + 1);
      const i3 = indices.getX(i + 2);
      
      const v1 = new THREE.Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1));
      const v2 = new THREE.Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2));
      const v3 = new THREE.Vector3(positions.getX(i3), positions.getY(i3), positions.getZ(i3));
      
      const quality = this.calculateTriangleQuality(v1, v2, v3);
      
      if (quality < qualityThreshold) {
        poorQualityTriangles++;
      }
    }
    
    if (poorQualityTriangles > 0) {
      const ratio = poorQualityTriangles / (indices.count / 3);
      if (ratio > 0.1) {
        issues.push({
          type: 'non-manifold',
          severity: 'warning',
          description: `Layer ${layerIndex}: ${Math.round(ratio * 100)}% poor quality triangles`,
          affectedFaces: [],
        });
        recommendations.push('Consider enabling mesh optimization to improve triangle quality');
      }
    }
  }

  /**
   * Calculate triangle quality (aspect ratio based)
   */
  private calculateTriangleQuality(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): number {
    const a = v1.distanceTo(v2);
    const b = v2.distanceTo(v3);
    const c = v3.distanceTo(v1);
    
    if (a === 0 || b === 0 || c === 0) return 0;
    
    const s = (a + b + c) / 2;
    const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    
    if (area === 0) return 0;
    
    // Quality metric: 4 * sqrt(3) * area / (a² + b² + c²)
    // Returns 1 for equilateral triangle, approaches 0 for degenerate triangles
    return (4 * Math.sqrt(3) * area) / (a * a + b * b + c * c);
  }

  /**
   * Validate basic geometry properties
   */
  private validateBasicGeometry(geometry: BookmarkGeometry, issues: PrintabilityIssue[]): void {
    // Check for empty geometry
    if (geometry.layers.length === 0) {
      issues.push({
        type: 'non-manifold',
        severity: 'error',
        description: 'No geometry layers found',
        affectedFaces: [],
      });
      return;
    }
    
    // Check vertex and face counts
    if (geometry.vertexCount > this.config.maxVertices) {
      issues.push({
        type: 'non-manifold',
        severity: 'warning',
        description: `High vertex count: ${geometry.vertexCount} (max recommended: ${this.config.maxVertices})`,
        affectedFaces: [],
      });
    }
    
    if (geometry.faceCount > this.config.maxTriangles) {
      issues.push({
        type: 'non-manifold',
        severity: 'warning',
        description: `High triangle count: ${geometry.faceCount} (max recommended: ${this.config.maxTriangles})`,
        affectedFaces: [],
      });
    }
    
    // Check bounding box
    const size = geometry.boundingBox.max.clone().sub(geometry.boundingBox.min);
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
      issues.push({
        type: 'non-manifold',
        severity: 'error',
        description: 'Invalid bounding box dimensions',
        affectedFaces: [],
      });
    }
  }

  /**
   * Validate layer connections and stacking
   */
  private validateLayerConnections(
    geometry: BookmarkGeometry,
    issues: PrintabilityIssue[],
    recommendations: string[]
  ): void {
    // Check for floating layers
    for (let i = 1; i < geometry.layers.length; i++) {
      const currentLayer = geometry.layers[i];
      const previousLayer = geometry.layers[i - 1];
      
      // Simple check: ensure layers overlap in X-Y plane
      const currentBounds = currentLayer.geometry.boundingBox;
      const previousBounds = previousLayer.geometry.boundingBox;
      
      if (currentBounds && previousBounds) {
        const hasOverlap = 
          currentBounds.min.x < previousBounds.max.x &&
          currentBounds.max.x > previousBounds.min.x &&
          currentBounds.min.y < previousBounds.max.y &&
          currentBounds.max.y > previousBounds.min.y;
        
        if (!hasOverlap) {
          issues.push({
            type: 'floating-geometry',
            severity: 'error',
            description: `Layer ${i} does not connect to layer ${i - 1} (floating geometry)`,
            affectedFaces: [],
          });
        }
      }
    }
  }

  /**
   * Validate 3D printing specific constraints
   */
  private validate3DPrintingConstraints(
    geometry: BookmarkGeometry,
    parameters: BookmarkParameters,
    issues: PrintabilityIssue[],
    recommendations: string[]
  ): void {
    // Check wall thickness
    if (parameters.layerThickness < this.config.minWallThickness) {
      issues.push({
        type: 'thin-wall',
        severity: 'warning',
        description: `Layer thickness ${parameters.layerThickness}mm is below recommended ${this.config.minWallThickness}mm`,
        affectedFaces: [],
      });
    }
    
    // Check overall dimensions
    const size = geometry.boundingBox.max.clone().sub(geometry.boundingBox.min);
    if (size.x < 10 || size.y < 10) {
      issues.push({
        type: 'thin-wall',
        severity: 'warning',
        description: 'Bookmark dimensions may be too small for practical use',
        affectedFaces: [],
      });
      recommendations.push('Consider increasing bookmark dimensions for better handling');
    }
    
    if (size.z > 20) {
      issues.push({
        type: 'overhang',
        severity: 'warning',
        description: 'Bookmark may be too thick, could cause printing issues',
        affectedFaces: [],
      });
      recommendations.push('Consider reducing layer count or thickness');
    }
    
    // Check aspect ratio
    const aspectRatio = Math.max(size.x, size.y) / Math.min(size.x, size.y);
    if (aspectRatio > this.config.maxAspectRatio) {
      issues.push({
        type: 'overhang',
        severity: 'warning',
        description: `High aspect ratio ${aspectRatio.toFixed(1)} may cause warping`,
        affectedFaces: [],
      });
      recommendations.push('Consider more balanced dimensions to prevent warping');
    }
  }

  /**
   * Validate structural stability
   */
  private validateStructuralStability(
    geometry: BookmarkGeometry,
    issues: PrintabilityIssue[],
    recommendations: string[]
  ): void {
    // Check for very thin features that might break
    const size = geometry.boundingBox.max.clone().sub(geometry.boundingBox.min);
    const totalHeight = size.z;
    const baseArea = size.x * size.y;
    
    // Simple stability heuristic
    if (totalHeight > 10 && baseArea < 100) {
      issues.push({
        type: 'thin-wall',
        severity: 'warning',
        description: 'Bookmark may be unstable due to high height-to-base ratio',
        affectedFaces: [],
      });
      recommendations.push('Consider increasing base dimensions or reducing height');
    }
    
    // Check for isolated small regions that might break off
    for (let i = 0; i < geometry.layers.length; i++) {
      const layer = geometry.layers[i];
      if (layer.regions.length > 20) {
        issues.push({
          type: 'floating-geometry',
          severity: 'warning',
          description: `Layer ${i} has many small regions (${layer.regions.length}) that might break`,
          affectedFaces: [],
        });
        recommendations.push('Consider simplifying the design to reduce small features');
      }
    }
  }

  /**
   * Validate performance constraints
   */
  private validatePerformanceConstraints(
    geometry: BookmarkGeometry,
    issues: PrintabilityIssue[],
    recommendations: string[]
  ): void {
    const elapsed = performance.now() - this.startTime;
    
    if (elapsed > this.config.validationTimeout) {
      issues.push({
        type: 'non-manifold',
        severity: 'warning',
        description: 'Validation took longer than expected, some checks may be incomplete',
        affectedFaces: [],
      });
    }
    
    // Estimate memory usage
    const estimatedMemory = geometry.vertexCount * 12 + geometry.faceCount * 12; // Rough estimate
    if (estimatedMemory > this.config.memoryLimit) {
      issues.push({
        type: 'non-manifold',
        severity: 'warning',
        description: `High memory usage estimated: ${Math.round(estimatedMemory / 1024 / 1024)}MB`,
        affectedFaces: [],
      });
      recommendations.push('Consider reducing geometry complexity or enabling optimization');
    }
  }

  /**
   * Estimate print time in minutes
   */
  private estimatePrintTime(
    geometry: BookmarkGeometry,
    parameters?: BookmarkParameters
  ): number {
    if (!parameters) return 0;
    
    // Simple estimation based on volume and typical print speeds
    const size = geometry.boundingBox.max.clone().sub(geometry.boundingBox.min);
    const volume = size.x * size.y * size.z; // mm³
    
    // Rough estimates for FDM printing
    const layerHeight = 0.2; // mm
    const printSpeed = 50; // mm/s
    const infillDensity = 0.15; // 15%
    
    const layers = size.z / layerHeight;
    const perimeter = 2 * (size.x + size.y);
    const perimeterTime = (layers * perimeter) / printSpeed;
    const infillTime = (volume * infillDensity) / (printSpeed * layerHeight);
    
    return Math.round((perimeterTime + infillTime) / 60); // Convert to minutes
  }

  /**
   * Estimate material usage in grams
   */
  private estimateMaterialUsage(
    geometry: BookmarkGeometry,
    parameters?: BookmarkParameters
  ): number {
    if (!parameters) return 0;
    
    // Simple estimation based on volume
    const size = geometry.boundingBox.max.clone().sub(geometry.boundingBox.min);
    const volume = size.x * size.y * size.z; // mm³
    
    // Typical PLA density: 1.24 g/cm³ = 0.00124 g/mm³
    const pla_density = 0.00124;
    const infillDensity = 0.15; // 15%
    
    return Math.round(volume * pla_density * infillDensity * 100) / 100;
  }

  /**
   * Get edge key for consistent edge identification
   */
  private getEdgeKey(v1: number, v2: number): string {
    return v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
  }

  /**
   * Update validation configuration
   */
  updateConfig(config: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current validation configuration
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }

  /**
   * Quick validation for basic checks only
   */
  async quickValidate(geometry: BookmarkGeometry): Promise<boolean> {
    const originalConfig = { ...this.config };
    
    // Disable expensive checks for quick validation
    this.config.checkManifold = false;
    this.config.checkWatertight = false;
    this.config.allowSelfIntersections = true;
    this.config.checkStability = false;
    
    try {
      const result = await this.validateGeometry(geometry);
      return result.isPrintable;
    } finally {
      this.config = originalConfig;
    }
  }
}

// ========================
// Factory Functions
// ========================

/**
 * Create validator optimized for bookmark validation
 */
export function createBookmarkValidator(): GeometryValidator {
  return new GeometryValidator({
    checkManifold: true,
    checkWatertight: true,
    allowSelfIntersections: false,
    
    minWallThickness: 0.4,
    minFeatureSize: 0.8,
    maxOverhangAngle: 45,
    bridgeSupport: false,
    
    checkStability: true,
    maxAspectRatio: 8, // Bookmarks can be longer
    checkConnectivity: true,
    
    maxVertices: 100000, // Conservative for bookmarks
    maxTriangles: 50000,
    minTriangleQuality: 0.15,
    
    validationTimeout: 15000, // 15 seconds for bookmarks
    memoryLimit: 50 * 1024 * 1024, // 50MB
  });
}

/**
 * Create permissive validator for prototyping
 */
export function createPermissiveValidator(): GeometryValidator {
  return new GeometryValidator({
    checkManifold: false,
    checkWatertight: false,
    allowSelfIntersections: true,
    
    minWallThickness: 0.2,
    minFeatureSize: 0.4,
    maxOverhangAngle: 60,
    bridgeSupport: true,
    
    checkStability: false,
    maxAspectRatio: 20,
    checkConnectivity: false,
    
    maxVertices: 500000,
    maxTriangles: 250000,
    minTriangleQuality: 0.05,
    
    validationTimeout: 60000,
    memoryLimit: 200 * 1024 * 1024,
  });
}