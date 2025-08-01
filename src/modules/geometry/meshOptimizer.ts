/**
 * MeshOptimizer - Geometry simplification and optimization for 3D printing
 * Provides mesh simplification, topology validation, and printability optimization
 */

import * as THREE from 'three';
import type { 
  SimplificationOptions,
  OptimizationResult,
  MeshQuality
} from '../../types/geometry';

// ========================
// Types and Interfaces
// ========================

export interface OptimizationOptions {
  simplification?: SimplificationOptions;
  removeDegenerate?: boolean;
  mergeVertices?: boolean;
  smoothNormals?: boolean;
  validateManifold?: boolean;
  targetTriangleCount?: number;
  qualityThreshold?: number; // 0-1, minimum acceptable quality
}

export interface EdgeCollapseCandidate {
  edgeIndex: number;
  vertex1: number;
  vertex2: number;
  cost: number;
  newPosition: THREE.Vector3;
}

export interface MeshTopology {
  isManifold: boolean;
  hasHoles: boolean;
  boundaryEdges: number;
  genus: number; // topological holes
  connectedComponents: number;
}

const DEFAULT_OPTIONS: OptimizationOptions = {
  simplification: {
    targetRatio: 0.5,
    preserveBoundaries: true,
    preserveUVs: false,
    preserveColors: false,
  },
  removeDegenerate: true,
  mergeVertices: true,
  smoothNormals: false, // Keep sharp edges for bookmarks
  validateManifold: true,
  targetTriangleCount: 10000,
  qualityThreshold: 0.1,
};

// ========================
// MeshOptimizer Class
// ========================

export class MeshOptimizer {
  private options: OptimizationOptions;

  constructor(options: Partial<OptimizationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Optimize geometry with multiple passes
   */
  async optimizeGeometry(
    geometry: THREE.BufferGeometry,
    options: Partial<SimplificationOptions> = {}
  ): Promise<THREE.BufferGeometry> {
    const simplificationOptions: SimplificationOptions = { 
      targetRatio: options.targetRatio ?? this.options.simplification?.targetRatio ?? 0.5,
      preserveBoundaries: options.preserveBoundaries ?? this.options.simplification?.preserveBoundaries ?? true,
      preserveUVs: options.preserveUVs ?? this.options.simplification?.preserveUVs ?? false,
      preserveColors: options.preserveColors ?? this.options.simplification?.preserveColors ?? false,
    };
    const optimized = geometry.clone();

    try {
      // Step 1: Merge duplicate vertices
      if (this.options.mergeVertices) {
        this.mergeVertices(optimized);
      }

      // Step 2: Remove degenerate triangles
      if (this.options.removeDegenerate) {
        this.removeDegenerateTriangles(optimized);
      }

      // Step 3: Simplify mesh if needed
      const currentTriangleCount = this.getTriangleCount(optimized);
      if (this.options.targetTriangleCount && 
          currentTriangleCount > this.options.targetTriangleCount) {
        const targetRatio = this.options.targetTriangleCount / currentTriangleCount;
        await this.simplifyMesh(optimized, {
          ...simplificationOptions,
          targetRatio: Math.min(targetRatio, simplificationOptions.targetRatio || 0.5),
        });
      }

      // Step 4: Validate manifold properties
      if (this.options.validateManifold) {
        const topology = this.analyzeTopology(optimized);
        if (!topology.isManifold) {
          console.warn('Generated mesh is not manifold');
        }
      }

      // Step 5: Compute normals
      optimized.computeVertexNormals();

      // Update bounds
      optimized.computeBoundingBox();
      optimized.computeBoundingSphere();

      return optimized;

    } catch (error) {
      console.error('Mesh optimization failed:', error);
      return geometry; // Return original on failure
    }
  }

  /**
   * Simplify mesh using specified algorithm
   */
  async simplifyMesh(
    geometry: THREE.BufferGeometry,
    options: SimplificationOptions
  ): Promise<void> {
    // Use quadric error simplification as default
    await this.quadricErrorSimplification(geometry, options);
  }

  /**
   * Quadric error metric simplification
   */
  private async quadricErrorSimplification(
    geometry: THREE.BufferGeometry,
    options: SimplificationOptions
  ): Promise<void> {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions || !indices) {
      throw new Error('Geometry must have position attribute and indices');
    }

    const vertexCount = positions.count;
    const triangleCount = indices.count / 3;
    const targetTriangles = Math.floor(triangleCount * options.targetRatio);

    // Build adjacency information
    const adjacency = this.buildVertexAdjacency(positions, indices);
    
    // Calculate quadric error matrices for each vertex
    const quadrics = this.calculateQuadricMatrices(positions, indices);
    
    // Build edge collapse candidates
    const candidates = this.buildCollapseQueue(positions, indices, adjacency, quadrics);
    
    // Sort by cost (lowest first)
    candidates.sort((a, b) => a.cost - b.cost);
    
    let removedTriangles = 0;
    const removedVertices = new Set<number>();
    
    // Perform edge collapses until target reached
    while (removedTriangles < (triangleCount - targetTriangles) && candidates.length > 0) {
      const candidate = candidates.shift()!;
      
      // Skip if vertices already removed
      if (removedVertices.has(candidate.vertex1) || removedVertices.has(candidate.vertex2)) {
        continue;
      }
      
      // Perform edge collapse
      if (this.canCollapseEdge(candidate, positions, indices, options)) {
        this.collapseEdge(candidate, positions, quadrics);
        removedVertices.add(candidate.vertex2);
        removedTriangles += this.countAffectedTriangles(candidate.vertex2, indices);
      }
    }
    
    // Rebuild geometry without removed vertices
    this.rebuildGeometry(geometry, removedVertices);
  }

  /**      
   * Vertex clustering simplification
   */
  private async vertexClustering(
    geometry: THREE.BufferGeometry,
    options: SimplificationOptions
  ): Promise<void> {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions || !indices) return;
    
    // Calculate grid size based on target ratio
    const bbox = geometry.boundingBox || new THREE.Box3().setFromBufferAttribute(positions);
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Grid resolution based on target triangle reduction
    const gridRes = Math.floor(Math.pow(positions.count * options.targetRatio, 1/3));
    const cellSize = maxDim / gridRes;
    
    // Map vertices to grid cells
    const cellMap = new Map<string, number[]>();
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      const cellX = Math.floor((x - bbox.min.x) / cellSize);
      const cellY = Math.floor((y - bbox.min.y) / cellSize);
      const cellZ = Math.floor((z - bbox.min.z) / cellSize);
      
      const cellKey = `${cellX},${cellY},${cellZ}`;
      
      if (!cellMap.has(cellKey)) {
        cellMap.set(cellKey, []);
      }
      cellMap.get(cellKey)!.push(i);
    }
    
    // Create vertex remapping
    const vertexRemap = new Array<number>(positions.count);
    const newPositions: number[] = [];
    let newVertexIndex = 0;
    
    for (const vertexIndices of Array.from(cellMap.values())) {
      // Calculate average position for this cluster
      let avgX = 0, avgY = 0, avgZ = 0;
      for (const idx of vertexIndices) {
        avgX += positions.getX(idx);
        avgY += positions.getY(idx);
        avgZ += positions.getZ(idx);
      }
      avgX /= vertexIndices.length;
      avgY /= vertexIndices.length;
      avgZ /= vertexIndices.length;
      
      // Add averaged vertex
      newPositions.push(avgX, avgY, avgZ);
      
      // Map all clustered vertices to this new vertex
      for (const idx of vertexIndices) {
        vertexRemap[idx] = newVertexIndex;
      }
      
      newVertexIndex++;
    }
    
    // Rebuild indices with remapping
    const newIndices: number[] = [];
    for (let i = 0; i < indices.count; i += 3) {
      const i1 = vertexRemap[indices.getX(i)];
      const i2 = vertexRemap[indices.getX(i + 1)];
      const i3 = vertexRemap[indices.getX(i + 2)];
      
      // Skip degenerate triangles
      if (i1 !== i2 && i2 !== i3 && i3 !== i1) {
        newIndices.push(i1, i2, i3);
      }
    }
    
    // Update geometry
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    geometry.setIndex(newIndices);
  }

  /**
   * Edge collapse simplification
   */
  private async edgeCollapseSimplification(
    geometry: THREE.BufferGeometry,
    options: SimplificationOptions
  ): Promise<void> {
    // Simplified edge collapse - focuses on shortest edges
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions || !indices) return;
    
    const targetTriangles = Math.floor((indices.count / 3) * options.targetRatio);
    const edges = this.extractEdges(indices);
    
    // Sort edges by length
    edges.sort((a, b) => {
      const lenA = this.calculateEdgeLength(a, positions);
      const lenB = this.calculateEdgeLength(b, positions);
      return lenA - lenB;
    });
    
    const removedVertices = new Set<number>();
    let currentTriangles = indices.count / 3;
    
    for (const edge of edges) {
      if (currentTriangles <= targetTriangles) break;
      if (removedVertices.has(edge.v1) || removedVertices.has(edge.v2)) continue;
      
      // Simple collapse: remove second vertex, keep first
      removedVertices.add(edge.v2);
      currentTriangles -= this.countAffectedTriangles(edge.v2, indices);
    }
    
    this.rebuildGeometry(geometry, removedVertices);
  }

  /**
   * Remove degenerate triangles (zero area, duplicate vertices)
   */
  private removeDegenerateTriangles(geometry: THREE.BufferGeometry): void {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions || !indices) return;
    
    const newIndices: number[] = [];
    const epsilon = 1e-10;
    
    for (let i = 0; i < indices.count; i += 3) {
      const i1 = indices.getX(i);
      const i2 = indices.getX(i + 1);
      const i3 = indices.getX(i + 2);
      
      // Skip triangles with duplicate vertices
      if (i1 === i2 || i2 === i3 || i3 === i1) continue;
      
      // Check for zero area
      const v1 = new THREE.Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1));
      const v2 = new THREE.Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2));
      const v3 = new THREE.Vector3(positions.getX(i3), positions.getY(i3), positions.getZ(i3));
      
      const edge1 = v2.clone().sub(v1);
      const edge2 = v3.clone().sub(v1);
      const area = edge1.cross(edge2).length() / 2;
      
      if (area > epsilon) {
        newIndices.push(i1, i2, i3);
      }
    }
    
    geometry.setIndex(newIndices);
  }

  /**
   * Merge duplicate vertices within tolerance
   */
  private mergeVertices(geometry: THREE.BufferGeometry, tolerance: number = 1e-6): void {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions) return;
    
    const vertices: THREE.Vector3[] = [];
    const vertexMap = new Map<string, number>();
    const newIndices: number[] = [];
    
    // Build unique vertex list
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      
      // Create key for spatial hashing
      const key = `${Math.round(vertex.x / tolerance)},${Math.round(vertex.y / tolerance)},${Math.round(vertex.z / tolerance)}`;
      
      if (!vertexMap.has(key)) {
        vertexMap.set(key, vertices.length);
        vertices.push(vertex);
      }
    }
    
    // Create vertex remapping
    const remap = new Array<number>(positions.count);
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      const key = `${Math.round(vertex.x / tolerance)},${Math.round(vertex.y / tolerance)},${Math.round(vertex.z / tolerance)}`;
      remap[i] = vertexMap.get(key)!;
    }
    
    // Rebuild indices
    if (indices) {
      for (let i = 0; i < indices.count; i++) {
        newIndices.push(remap[indices.getX(i)]);
      }
    }
    
    // Update geometry
    const newPositions: number[] = [];
    for (const vertex of vertices) {
      newPositions.push(vertex.x, vertex.y, vertex.z);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    if (indices) {
      geometry.setIndex(newIndices);
    }
  }

  /**
   * Analyze mesh topology
   */
  analyzeTopology(geometry: THREE.BufferGeometry): MeshTopology {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions || !indices) {
      return {
        isManifold: false,
        hasHoles: false,
        boundaryEdges: 0,
        genus: 0,
        connectedComponents: 0,
      };
    }
    
    // Build edge adjacency
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
    
    // Count boundary edges (edges with only one adjacent face)
    let boundaryEdges = 0;
    let nonManifoldEdges = 0;
    
    for (const count of Array.from(edges.values())) {
      if (count === 1) {
        boundaryEdges++;
      } else if (count > 2) {
        nonManifoldEdges++;
      }
    }
    
    const isManifold = nonManifoldEdges === 0;
    const hasHoles = boundaryEdges > 0;
    
    // Euler characteristic: V - E + F = 2 - 2g (for closed surfaces)
    const V = positions.count;
    const E = edges.size;
    const F = indices.count / 3;
    const euler = V - E + F;
    const genus = hasHoles ? 0 : Math.max(0, (2 - euler) / 2);
    
    return {
      isManifold,
      hasHoles,
      boundaryEdges,
      genus,
      connectedComponents: 1, // Simplified - would need component analysis
    };
  }

  /**
   * Calculate mesh quality metrics
   */
  calculateQuality(geometry: THREE.BufferGeometry): MeshQuality {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions || !indices) {
      throw new Error('Geometry must have positions and indices');
    }
    
    const triangleCount = indices.count / 3;
    const vertexCount = positions.count;
    
    const aspectRatios: number[] = [];
    const edgeLengths: number[] = [];
    const manifoldErrors: string[] = [];
    const warnings: string[] = [];
    
    let totalVolume = 0;
    let totalSurfaceArea = 0;
    
    // Analyze each triangle
    for (let i = 0; i < indices.count; i += 3) {
      const i1 = indices.getX(i);
      const i2 = indices.getX(i + 1);
      const i3 = indices.getX(i + 2);
      
      const v1 = new THREE.Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1));
      const v2 = new THREE.Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2));
      const v3 = new THREE.Vector3(positions.getX(i3), positions.getY(i3), positions.getZ(i3));
      
      // Edge lengths
      const e1 = v1.distanceTo(v2);
      const e2 = v2.distanceTo(v3);
      const e3 = v3.distanceTo(v1);
      
      edgeLengths.push(e1, e2, e3);
      
      // Aspect ratio (ratio of longest to shortest edge)
      const minEdge = Math.min(e1, e2, e3);
      const maxEdge = Math.max(e1, e2, e3);
      if (minEdge > 0) {
        aspectRatios.push(maxEdge / minEdge);
      }
      
      // Triangle area
      const edge1 = v2.clone().sub(v1);
      const edge2 = v3.clone().sub(v1);
      const normal = edge1.cross(edge2);
      const area = normal.length() / 2;
      totalSurfaceArea += area;
      
      // Contribution to volume (for closed meshes)
      totalVolume += v1.dot(normal) / 6;
    }
    
    // Check for common issues
    if (triangleCount === 0) {
      manifoldErrors.push('No triangles found');
    }
    
    if (aspectRatios.some(ratio => ratio > 100)) {
      warnings.push('Very thin triangles detected');
    }
    
    if (edgeLengths.some(length => length < 0.001)) {
      warnings.push('Very short edges detected');
    }
    
    return {
      triangleCount,
      vertexCount,
      manifold: manifoldErrors.length === 0,
      watertight: !warnings.some(w => w.includes('holes')),
      averageTriangleQuality: aspectRatios.length > 0 ? 
        aspectRatios.reduce((sum, ratio) => sum + 1/ratio, 0) / aspectRatios.length : 1.0,
    };
  }

  // ========================
  // Helper Methods
  // ========================

  private buildVertexAdjacency(
    positions: THREE.BufferAttribute,
    indices: THREE.BufferAttribute
  ): Map<number, Set<number>> {
    const adjacency = new Map<number, Set<number>>();
    
    // Initialize adjacency lists
    for (let i = 0; i < positions.count; i++) {
      adjacency.set(i, new Set<number>());
    }
    
    // Build adjacency from triangles
    for (let i = 0; i < indices.count; i += 3) {
      const i1 = indices.getX(i);
      const i2 = indices.getX(i + 1);
      const i3 = indices.getX(i + 2);
      
      adjacency.get(i1)!.add(i2);
      adjacency.get(i1)!.add(i3);
      adjacency.get(i2)!.add(i1);
      adjacency.get(i2)!.add(i3);
      adjacency.get(i3)!.add(i1);
      adjacency.get(i3)!.add(i2);
    }
    
    return adjacency;
  }

  private calculateQuadricMatrices(
    positions: THREE.BufferAttribute,
    indices: THREE.BufferAttribute
  ): Float64Array[] {
    const quadrics: Float64Array[] = [];
    
    // Initialize quadric matrices for each vertex
    for (let i = 0; i < positions.count; i++) {
      quadrics.push(new Float64Array(16)); // 4x4 matrix
    }
    
    // Add quadric contributions from each triangle
    for (let i = 0; i < indices.count; i += 3) {
      const i1 = indices.getX(i);
      const i2 = indices.getX(i + 1);
      const i3 = indices.getX(i + 2);
      
      const v1 = new THREE.Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1));
      const v2 = new THREE.Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2));
      const v3 = new THREE.Vector3(positions.getX(i3), positions.getY(i3), positions.getZ(i3));
      
      // Calculate plane equation ax + by + cz + d = 0
      const edge1 = v2.clone().sub(v1);
      const edge2 = v3.clone().sub(v1);
      const normal = edge1.cross(edge2).normalize();
      
      const a = normal.x;
      const b = normal.y;
      const c = normal.z;
      const d = -normal.dot(v1);
      
      // Build quadric matrix for this plane
      const planeQuadric = [
        a*a, a*b, a*c, a*d,
        a*b, b*b, b*c, b*d,
        a*c, b*c, c*c, c*d,
        a*d, b*d, c*d, d*d
      ];
      
      // Add to vertex quadrics
      for (let j = 0; j < 16; j++) {
        quadrics[i1][j] += planeQuadric[j];
        quadrics[i2][j] += planeQuadric[j];
        quadrics[i3][j] += planeQuadric[j];
      }
    }
    
    return quadrics;
  }

  private buildCollapseQueue(
    positions: THREE.BufferAttribute,
    indices: THREE.BufferAttribute,
    adjacency: Map<number, Set<number>>,
    quadrics: Float64Array[]
  ): EdgeCollapseCandidate[] {
    const candidates: EdgeCollapseCandidate[] = [];
    const processedEdges = new Set<string>();
    
    // Build candidates from adjacency
    for (const [vertex, neighbors] of Array.from(adjacency)) {
      for (const neighbor of Array.from(neighbors)) {
        const edgeKey = this.getEdgeKey(vertex, neighbor);
        if (processedEdges.has(edgeKey)) continue;
        processedEdges.add(edgeKey);
        
        // Calculate collapse cost
        const cost = this.calculateCollapseCost(vertex, neighbor, positions, quadrics);
        const newPosition = this.calculateOptimalPosition(vertex, neighbor, positions, quadrics);
        
        candidates.push({
          edgeIndex: candidates.length,
          vertex1: vertex,
          vertex2: neighbor,
          cost,
          newPosition,
        });
      }
    }
    
    return candidates;
  }

  private calculateCollapseCost(
    v1: number,
    v2: number,
    positions: THREE.BufferAttribute,
    quadrics: Float64Array[]
  ): number {
    // Simplified quadric error calculation
    const pos1 = new THREE.Vector3(positions.getX(v1), positions.getY(v1), positions.getZ(v1));
    const pos2 = new THREE.Vector3(positions.getX(v2), positions.getY(v2), positions.getZ(v2));
    
    // Use midpoint for simplicity
    const midpoint = pos1.clone().add(pos2).multiplyScalar(0.5);
    
    // Calculate quadric error at midpoint
    const q1 = quadrics[v1];
    const q2 = quadrics[v2];
    
    let error = 0;
    const x = midpoint.x, y = midpoint.y, z = midpoint.z;
    
    // Simplified error calculation
    for (let i = 0; i < 2; i++) {
      const q = i === 0 ? q1 : q2;
      error += q[0]*x*x + q[5]*y*y + q[10]*z*z + 
               2*q[1]*x*y + 2*q[2]*x*z + 2*q[6]*y*z +
               2*q[3]*x + 2*q[7]*y + 2*q[11]*z + q[15];
    }
    
    return Math.abs(error);
  }

  private calculateOptimalPosition(
    v1: number,
    v2: number,
    positions: THREE.BufferAttribute,
    quadrics: Float64Array[]
  ): THREE.Vector3 {
    // Simplified - use midpoint
    const pos1 = new THREE.Vector3(positions.getX(v1), positions.getY(v1), positions.getZ(v1));
    const pos2 = new THREE.Vector3(positions.getX(v2), positions.getY(v2), positions.getZ(v2));
    return pos1.add(pos2).multiplyScalar(0.5);
  }

  private canCollapseEdge(
    candidate: EdgeCollapseCandidate,
    positions: THREE.BufferAttribute,
    indices: THREE.BufferAttribute,
    options: SimplificationOptions
  ): boolean {
    // Simplified validity check
    // In a full implementation, would check for:
    // - Topology preservation
    // - Normal flipping
    // - Boundary preservation
    return candidate.cost < 1.0;
  }

  private collapseEdge(
    candidate: EdgeCollapseCandidate,
    positions: THREE.BufferAttribute,
    quadrics: Float64Array[]
  ): void {
    // Move vertex1 to optimal position
    positions.setXYZ(
      candidate.vertex1,
      candidate.newPosition.x,
      candidate.newPosition.y,
      candidate.newPosition.z
    );
    
    // Combine quadrics
    for (let i = 0; i < 16; i++) {
      quadrics[candidate.vertex1][i] += quadrics[candidate.vertex2][i];
    }
  }

  private countAffectedTriangles(vertex: number, indices: THREE.BufferAttribute): number {
    let count = 0;
    for (let i = 0; i < indices.count; i += 3) {
      if (indices.getX(i) === vertex || 
          indices.getX(i + 1) === vertex || 
          indices.getX(i + 2) === vertex) {
        count++;
      }
    }
    return count;
  }

  private rebuildGeometry(
    geometry: THREE.BufferGeometry,
    removedVertices: Set<number>
  ): void {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indices = geometry.getIndex() as THREE.BufferAttribute;
    
    if (!positions || !indices) return;
    
    // Create vertex remapping
    const remap = new Map<number, number>();
    const newPositions: number[] = [];
    let newIndex = 0;
    
    for (let i = 0; i < positions.count; i++) {
      if (!removedVertices.has(i)) {
        remap.set(i, newIndex++);
        newPositions.push(positions.getX(i), positions.getY(i), positions.getZ(i));
      }
    }
    
    // Rebuild indices
    const newIndices: number[] = [];
    for (let i = 0; i < indices.count; i += 3) {
      const i1 = indices.getX(i);
      const i2 = indices.getX(i + 1);
      const i3 = indices.getX(i + 2);
      
      if (!removedVertices.has(i1) && !removedVertices.has(i2) && !removedVertices.has(i3)) {
        newIndices.push(remap.get(i1)!, remap.get(i2)!, remap.get(i3)!);
      }
    }
    
    // Update geometry
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    geometry.setIndex(newIndices);
  }

  private extractEdges(indices: THREE.BufferAttribute): Array<{v1: number, v2: number}> {
    const edges: Array<{v1: number, v2: number}> = [];
    const edgeSet = new Set<string>();
    
    for (let i = 0; i < indices.count; i += 3) {
      const i1 = indices.getX(i);
      const i2 = indices.getX(i + 1);
      const i3 = indices.getX(i + 2);
      
      const edgeKeys = [
        this.getEdgeKey(i1, i2),
        this.getEdgeKey(i2, i3),
        this.getEdgeKey(i3, i1),
      ];
      
      const edgePairs = [
        {v1: i1, v2: i2},
        {v1: i2, v2: i3},
        {v1: i3, v2: i1},
      ];
      
      for (let j = 0; j < 3; j++) {
        if (!edgeSet.has(edgeKeys[j])) {
          edgeSet.add(edgeKeys[j]);
          edges.push(edgePairs[j]);
        }
      }
    }
    
    return edges;
  }

  private calculateEdgeLength(
    edge: {v1: number, v2: number},
    positions: THREE.BufferAttribute
  ): number {
    const v1 = new THREE.Vector3(
      positions.getX(edge.v1),
      positions.getY(edge.v1),
      positions.getZ(edge.v1)
    );
    const v2 = new THREE.Vector3(
      positions.getX(edge.v2),
      positions.getY(edge.v2),
      positions.getZ(edge.v2)
    );
    return v1.distanceTo(v2);
  }

  private getEdgeKey(v1: number, v2: number): string {
    return v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
  }

  private getTriangleCount(geometry: THREE.BufferGeometry): number {
    const indices = geometry.getIndex();
    return indices ? indices.count / 3 : 0;
  }

  /**
   * Update optimization options
   */
  updateOptions(options: Partial<OptimizationOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current optimization options
   */
  getOptions(): OptimizationOptions {
    return { ...this.options };
  }
}

// ========================
// Factory Functions
// ========================

/**
 * Create mesh optimizer for bookmark generation
 */
export function createBookmarkMeshOptimizer(): MeshOptimizer {
  return new MeshOptimizer({
    simplification: {
      targetRatio: 0.8, // Conservative for bookmarks
      preserveBoundaries: true,
      preserveUVs: false,
      preserveColors: false,
    },
    removeDegenerate: true,
    mergeVertices: true,
    smoothNormals: false, // Keep sharp edges
    validateManifold: true,
    targetTriangleCount: 20000,
    qualityThreshold: 0.2,
  });
}

/**
 * Quick optimization for basic cleanup
 */
export async function quickOptimize(geometry: THREE.BufferGeometry): Promise<THREE.BufferGeometry> {
  const optimizer = new MeshOptimizer({
    simplification: {
      targetRatio: 1.0, // No simplification for quick optimize
      preserveBoundaries: true,
      preserveUVs: false,
      preserveColors: false,
    },
    removeDegenerate: true,
    mergeVertices: true,
    smoothNormals: false,
    validateManifold: false,
  });
  
  return optimizer.optimizeGeometry(geometry);
}