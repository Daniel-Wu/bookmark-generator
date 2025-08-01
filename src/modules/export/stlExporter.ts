/**
 * STL Binary Format Exporter
 * Converts Three.js geometry into binary STL format for 3D printing
 */

import * as THREE from 'three';
import { GeometryExporter } from './geometryExporter';
import { BinaryWriter } from './binaryWriter';
import type { BookmarkGeometry, GeometryLayer } from '../../types/geometry';
import type { STLExportOptions, STLHeader, STLTriangle } from '../../types/export';

/**
 * STL file format constants
 */
const STL_HEADER_SIZE = 80;
const STL_TRIANGLE_COUNT_SIZE = 4;
const STL_TRIANGLE_SIZE = 50; // 12 (normal) + 36 (vertices) + 2 (attributes)

/**
 * STL binary format exporter
 */
export class STLExporter extends GeometryExporter {
  private options: STLExportOptions;

  constructor(
    options: STLExportOptions,
    progressCallback?: (progress: any) => void
  ) {
    super(options, progressCallback);
    this.options = options;
  }

  /**
   * Generate STL export data structure
   */
  protected async generateExportData(geometry: BookmarkGeometry): Promise<STLTriangle[]> {
    const triangles: STLTriangle[] = [];

    if (this.options.mergeGeometry) {
      // Merge all layers into a single mesh
      const mergedGeometry = this.mergeGeometryLayers(geometry.layers);
      const layerTriangles = this.extractTriangles(mergedGeometry, new THREE.Color(0.8, 0.8, 0.8));
      triangles.push(...layerTriangles);
    } else {
      // Process each layer separately
      for (let i = 0; i < geometry.layers.length; i++) {
        const layer = geometry.layers[i];
        if (!layer.visible) continue;

        this.reportProgress(
          'generating',
          0.3 + (0.5 * i) / geometry.layers.length,
          `Processing layer ${i + 1}...`,
          i + 1,
          geometry.layers.length
        );

        const layerTriangles = this.extractTriangles(layer.geometry, new THREE.Color().setHex(parseInt(layer.color.hex.slice(1), 16)));
        triangles.push(...layerTriangles);

        this.checkCancellation();
      }
    }

    return triangles;
  }

  /**
   * Merge all geometry layers into a single mesh
   */
  private mergeGeometryLayers(layers: GeometryLayer[]): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    for (const layer of layers) {
      if (!layer.visible || !layer.geometry) continue;

      // Clone and position geometry at correct height
      const layerGeometry = layer.geometry.clone();
      layerGeometry.translate(0, 0, layer.height);
      geometries.push(layerGeometry);
    }

    if (geometries.length === 0) {
      return new THREE.BufferGeometry();
    }

    if (geometries.length === 1) {
      return geometries[0];
    }

    // Merge all geometries
    return this.mergeBufferGeometries(geometries);
  }

  /**
   * Merge multiple BufferGeometry objects efficiently
   */
  private mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const merged = new THREE.BufferGeometry();

    // Calculate total vertex count
    let totalVertices = 0;
    for (const geometry of geometries) {
      if (geometry.attributes.position) {
        totalVertices += geometry.attributes.position.count;
      }
    }

    if (totalVertices === 0) {
      return merged;
    }

    // Create merged arrays
    const mergedPositions = new Float32Array(totalVertices * 3);
    const mergedNormals = new Float32Array(totalVertices * 3);

    let offset = 0;
    for (const geometry of geometries) {
      const positions = geometry.attributes.position;
      const normals = geometry.attributes.normal;

      if (!positions) continue;

      // Copy positions
      for (let i = 0; i < positions.count; i++) {
        mergedPositions[offset * 3] = positions.getX(i);
        mergedPositions[offset * 3 + 1] = positions.getY(i);
        mergedPositions[offset * 3 + 2] = positions.getZ(i);
        offset++;
      }

      // Copy or compute normals
      if (normals) {
        let normalOffset = offset - positions.count;
        for (let i = 0; i < normals.count; i++) {
          mergedNormals[normalOffset * 3] = normals.getX(i);
          mergedNormals[normalOffset * 3 + 1] = normals.getY(i);
          mergedNormals[normalOffset * 3 + 2] = normals.getZ(i);
          normalOffset++;
        }
      }
    }

    merged.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));

    // Compute normals if any geometry was missing them
    if (!merged.attributes.normal || merged.attributes.normal.count === 0) {
      merged.computeVertexNormals();
    }

    return merged;
  }

  /**
   * Extract triangles from BufferGeometry
   */
  private extractTriangles(geometry: THREE.BufferGeometry, color: THREE.Color): STLTriangle[] {
    const triangles: STLTriangle[] = [];
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;

    if (!positions) {
      return triangles;
    }

    // Ensure we have normals
    if (!normals || normals.count === 0) {
      geometry.computeVertexNormals();
    }

    const triangleCount = positions.count / 3;
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const v3 = new THREE.Vector3();
    const normal = new THREE.Vector3();

    for (let i = 0; i < triangleCount; i++) {
      const i3 = i * 3;

      // Get vertices
      v1.fromBufferAttribute(positions, i3);
      v2.fromBufferAttribute(positions, i3 + 1);
      v3.fromBufferAttribute(positions, i3 + 2);

      // Convert units if needed
      if (this.options.units === 'inches') {
        v1.multiplyScalar(1 / 25.4); // Convert mm to inches
        v2.multiplyScalar(1 / 25.4);
        v3.multiplyScalar(1 / 25.4);
      }

      // Apply precision rounding
      this.roundVector(v1, this.options.precision);
      this.roundVector(v2, this.options.precision);
      this.roundVector(v3, this.options.precision);

      // Calculate or get normal
      if (this.options.generateNormals || !normals) {
        this.calculateTriangleNormal(v1, v2, v3, normal);
      } else {
        // Average the vertex normals
        const n1 = new THREE.Vector3().fromBufferAttribute(normals, i3);
        const n2 = new THREE.Vector3().fromBufferAttribute(normals, i3 + 1);
        const n3 = new THREE.Vector3().fromBufferAttribute(normals, i3 + 2);
        normal.copy(n1).add(n2).add(n3).normalize();
      }

      // Round normal precision
      this.roundVector(normal, this.options.precision);

      // Skip degenerate triangles
      if (this.isTriangleDegenerate(v1, v2, v3)) {
        continue;
      }

      const triangle: STLTriangle = {
        normal: [normal.x, normal.y, normal.z],
        vertices: [
          [v1.x, v1.y, v1.z],
          [v2.x, v2.y, v2.z],
          [v3.x, v3.y, v3.z]
        ],
        attributeBytes: 0 // Standard for basic STL files
      };

      triangles.push(triangle);
    }

    return triangles;
  }

  /**
   * Calculate triangle normal using cross product
   */
  private calculateTriangleNormal(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3, result: THREE.Vector3): void {
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    result.crossVectors(edge1, edge2).normalize();

    // Ensure normal faces outward (positive Z for bookmarks)
    if (result.z < 0) {
      result.negate();
    }
  }

  /**
   * Check if triangle is degenerate (zero area)
   */
  private isTriangleDegenerate(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): boolean {
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    const cross = new THREE.Vector3().crossVectors(edge1, edge2);
    return cross.length() < 1e-10;
  }

  /**
   * Round vector components to specified precision
   */
  private roundVector(vector: THREE.Vector3, precision: number): void {
    const factor = Math.pow(10, precision);
    vector.x = Math.round(vector.x * factor) / factor;
    vector.y = Math.round(vector.y * factor) / factor;
    vector.z = Math.round(vector.z * factor) / factor;
  }

  /**
   * Write binary STL data
   */
  protected async writeBinaryData(triangles: STLTriangle[]): Promise<Uint8Array> {
    const fileSize = STL_HEADER_SIZE + STL_TRIANGLE_COUNT_SIZE + (triangles.length * STL_TRIANGLE_SIZE);
    const writer = new BinaryWriter(fileSize);

    // Write header (80 bytes)
    const header = this.generateSTLHeader(triangles.length);
    writer.writeString(header, STL_HEADER_SIZE);

    // Write triangle count (4 bytes, little endian)
    writer.writeUint32(triangles.length, true);

    // Write triangles
    for (let i = 0; i < triangles.length; i++) {
      const triangle = triangles[i];

      // Write normal vector (12 bytes)
      writer.writeFloat32(triangle.normal[0], true);
      writer.writeFloat32(triangle.normal[1], true);
      writer.writeFloat32(triangle.normal[2], true);

      // Write vertices (36 bytes)
      for (const vertex of triangle.vertices) {
        writer.writeFloat32(vertex[0], true);
        writer.writeFloat32(vertex[1], true);
        writer.writeFloat32(vertex[2], true);
      }

      // Write attribute bytes (2 bytes)
      writer.writeUint16(triangle.attributeBytes, true);

      // Report progress for large files
      if (i % 1000 === 0) {
        this.reportProgress(
          'writing',
          0.8 + (0.2 * i) / triangles.length,
          `Writing triangle ${i + 1} of ${triangles.length}...`
        );
        this.checkCancellation();
      }
    }

    return writer.getUint8Array();
  }

  /**
   * Generate STL file header
   */
  private generateSTLHeader(triangleCount: number): string {
    const appName = this.options.applicationName || 'Parametric 3D Bookmark Generator';
    const timestamp = new Date().toISOString();
    const units = this.options.units;
    
    let header = `${appName} - ${timestamp} - ${triangleCount} triangles - ${units}`;
    
    // Ensure header is exactly 80 characters
    if (header.length > 80) {
      header = header.substring(0, 80);
    } else {
      header = header.padEnd(80, '\0');
    }

    return header;
  }

  /**
   * Estimate file size for validation
   */
  protected estimateFileSize(geometry: BookmarkGeometry): number {
    return STL_HEADER_SIZE + STL_TRIANGLE_COUNT_SIZE + (geometry.totalTriangles * STL_TRIANGLE_SIZE);
  }

  /**
   * Generate filename with timestamp
   */
  protected generateFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    return `bookmark-${timestamp}.stl`;
  }

  /**
   * Get MIME type for STL files
   */
  protected getMimeType(): string {
    return 'application/sla';
  }

  /**
   * Create STL exporter with default options
   */
  static create(options: Partial<STLExportOptions> = {}): STLExporter {
    const defaultOptions: STLExportOptions = {
      format: 'stl',
      binary: true,
      precision: 6,
      units: 'mm',
      includeColors: false,
      includeMetadata: true,
      mergeGeometry: true,
      applicationName: 'Parametric 3D Bookmark Generator',
      generateNormals: true
    };

    return new STLExporter({ ...defaultOptions, ...options });
  }

  /**
   * Quick export method for simple use cases
   */
  static async exportSTL(
    geometry: BookmarkGeometry,
    options: Partial<STLExportOptions> = {},
    progressCallback?: (progress: any) => void
  ) {
    const exporter = STLExporter.create(options);
    if (progressCallback) {
      exporter.progressCallback = progressCallback;
    }
    return await exporter.export(geometry);
  }
}