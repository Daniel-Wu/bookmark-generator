/**
 * Geometry types for the bookmark 3D preview system
 */

import * as THREE from 'three';

export interface Color {
  r: number;
  g: number;
  b: number;
  hex: string;
}

export interface BookmarkParameters {
  width: number;
  height: number;
  baseThickness: number;
  layerThickness: number;
  cornerRadius: number;
  colorCount: number;
  aspectRatioLocked: boolean;
}

export interface GeometryLayer {
  id: number;
  geometry: THREE.BufferGeometry;
  color: Color;
  height: number;
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

export interface BookmarkGeometry {
  layers: GeometryLayer[];
  boundingBox: THREE.Box3;
  totalTriangles: number;
  estimatedFileSize: number; // in MB
}

export interface RenderMode {
  type: 'solid' | 'wireframe' | 'x-ray';
  name: string;
  description: string;
}

export interface CameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  zoom: number;
  up?: THREE.Vector3;
}

export type CameraPreset = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right' | 'isometric' | 'custom';

export interface CameraPresetConfig {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  up?: [number, number, number];
  description: string;
}

export interface CameraTweenConfig {
  duration: number;
  easing: 'linear' | 'easeInOut' | 'easeOut' | 'easeIn';
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
}

export interface LayerVisualizationState {
  visibility: Map<number, boolean>;
  opacity: Map<number, number>;
  exploded: boolean;
  explodeDistance: number;
  animationMode: 'off' | 'build' | 'explode' | 'rotate';
  animationSpeed: number;
  soloLayer: number | null;
}

export interface AnimationState {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  speed: number;
  loop: boolean;
  direction: 'forward' | 'reverse';
}

export type VisualizationMode = 'solid' | 'wireframe' | 'x-ray' | 'exploded' | 'cross-section';

export interface CrossSectionConfig {
  enabled: boolean;
  plane: THREE.Plane;
  showCap: boolean;
  capColor: string;
}

export interface SceneStats {
  triangles: number;
  drawCalls: number;
  geometries: number;
  textures: number;
  fps: number;
  memoryUsage: number; // in MB
}

export interface MaterialProperties {
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
  wireframe: boolean;
  emissive?: number;
  emissiveIntensity?: number;
}

export interface LayerInteractionEvent {
  layerId: number;
  event: 'click' | 'hover' | 'focus';
  position: THREE.Vector3;
  normal: THREE.Vector3;
  uv?: THREE.Vector2;
}

export interface TooltipInfo {
  layerId: number;
  position: [number, number];
  content: {
    name: string;
    color: string;
    triangles: number;
    dimensions: string;
    height: string;
  };
}

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  gpuMemory: number;
  triangleCount: number;
  drawCalls: number;
  fps: number;
  frameTime: number;
}

// Additional types needed by geometry module
export interface LayerProgress {
  stage: string;
  progress: number;
  details?: string;
}

export interface MeshQuality {
  triangleCount: number;
  vertexCount: number;
  manifold: boolean;
  watertight: boolean;
  averageTriangleQuality: number;
}

export interface GeometryMetrics {
  totalTime: number;
  stageTimings: {
    analysis: number;
    extraction: number;
    meshing: number;
    optimization: number;
    validation: number;
  };
  memoryUsage: {
    peak: number;
    final: number;
  };
  complexity: {
    inputPixels: number;
    outputVertices: number;
    outputFaces: number;
  };
}

export interface ComponentAnalysis {
  components: ConnectedComponent[];
  componentCount: number;
  largestComponentSize: number;
  totalArea: number;
  averageAreaPerComponent: number;
  totalComponents: number;
  largestComponent: ConnectedComponent | null;
  filteredComponents: ConnectedComponent[];
}

export interface MeshGenerationOptions {
  maxVertices: number;
  simplificationRatio: number;
  enableSmoothing: boolean;
}

export interface ExtrusionParameters {
  height: number;
  steps: number;
  smoothing: boolean;
}

export interface BaseGeometryParameters {
  width: number;
  height: number;
  thickness: number;
  cornerRadius: number;
}

export interface ConnectedComponent {
  id: number;
  pixels: Point2D[];
  area: number;
  centroid: Point2D;
  boundingBox: BoundingBox;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface OptimizationResult {
  originalVertexCount: number;
  optimizedVertexCount: number;
  originalFaceCount: number;
  optimizedFaceCount: number;
  compressionRatio: number;
}

export interface SimplificationOptions {
  targetRatio: number;
  preserveBoundaries: boolean;
  preserveUVs: boolean;
  preserveColors: boolean;
}

export interface PrintabilityCheck {
  isPrintable: boolean;
  issues: PrintabilityIssue[];
  recommendations: string[];
  estimatedPrintTime: number;
  materialUsage: number;
}

export interface PrintabilityIssue {
  type: string;
  severity: 'error' | 'warning';
  description: string;
  affectedFaces: number[];
}

export interface GeometryValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metrics: MeshQuality;
}

export interface MarchingSquaresOptions {
  threshold: number;
  smoothing: boolean;
  resolution: number;
}

export interface ContourTrace {
  points: Point2D[];
  closed: boolean;
  area: number;
}

export interface TriangulationOptions {
  algorithm: 'delaunay' | 'earcut';
  preserveEdges: boolean;
  maxTriangleArea: number;
}

export interface Transform3D {
  translation: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface GeometricPrimitive {
  type: 'box' | 'sphere' | 'cylinder' | 'cone';
  parameters: Record<string, number>;
}

export interface CSGOperation {
  type: 'union' | 'subtract' | 'intersect';
  operands: (BookmarkGeometry | GeometricPrimitive)[];
}