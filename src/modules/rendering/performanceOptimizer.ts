/**
 * PerformanceOptimizer - Optimizes 3D rendering performance for layer visualization
 */

import * as THREE from 'three';
import type { PerformanceMetrics } from '../../types/geometry';

interface OptimizationConfig {
  enableFrustumCulling: boolean;
  enableLevelOfDetail: boolean;
  enableInstancing: boolean;
  enableBatching: boolean;
  targetFPS: number;
  maxTriangles: number;
  memoryThreshold: number; // MB
}

interface LODLevel {
  distance: number;
  geometryScale: number;
  materialQuality: 'high' | 'medium' | 'low';
}

export class PerformanceOptimizer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private config: OptimizationConfig;
  private metrics: PerformanceMetrics;
  private frameTimeHistory: number[] = [];
  private lastFrameTime: number = 0;
  private layerObjects: THREE.Object3D[] = [];
  private lodGroups: Map<number, THREE.LOD> = new Map();
  private instancedMeshes: Map<string, THREE.InstancedMesh> = new Map();
  private frustum: THREE.Frustum = new THREE.Frustum();
  private cameraMatrix: THREE.Matrix4 = new THREE.Matrix4();
  
  // Performance monitoring
  private performanceObserver: PerformanceObserver | null = null;
  private memoryUsageInterval: number | null = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    config: Partial<OptimizationConfig> = {}
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    
    this.config = {
      enableFrustumCulling: true,
      enableLevelOfDetail: true,
      enableInstancing: false, // Disabled for distinct layers
      enableBatching: true,
      targetFPS: 60,
      maxTriangles: 500000,
      memoryThreshold: 512,
      ...config
    };

    this.metrics = {
      renderTime: 0,
      memoryUsage: 0,
      gpuMemory: 0,
      triangleCount: 0,
      drawCalls: 0,
      fps: 0,
      frameTime: 0
    };

    this.initializePerformanceMonitoring();
    this.setupRenderer();
  }

  /**
   * Initialize performance monitoring systems
   */
  private initializePerformanceMonitoring(): void {
    // Frame rate monitoring
    this.frameTimeHistory = new Array(60).fill(16.67); // 60fps baseline
    
    // Memory monitoring (if supported)
    if ('memory' in performance) {
      this.memoryUsageInterval = window.setInterval(() => {
        const memory = (performance as any).memory;
        this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
      }, 1000);
    }

    // Performance observer for render timing
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.name === 'render') {
            this.metrics.renderTime = entry.duration;
          }
        }
      });
      this.performanceObserver.observe({ entryTypes: ['measure'] });
    }
  }

  /**
   * Setup renderer for optimal performance
   */
  private setupRenderer(): void {
    const gl = this.renderer.getContext();
    
    // Enable hardware-accelerated features
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.sortObjects = true;
    this.renderer.shadowMap.autoUpdate = false; // Manual shadow updates
    
    // Optimize render state changes
    this.renderer.info.autoReset = false;
    
    // Shadow map size should be set on individual lights
  }

  /**
   * Set layer objects for optimization
   */
  setLayers(layers: THREE.Object3D[]): void {
    this.layerObjects = layers;
    
    if (this.config.enableLevelOfDetail) {
      this.createLODHierarchy();
    }
    
    if (this.config.enableBatching) {
      this.optimizeGeometryBatching();
    }
  }

  /**
   * Create Level of Detail hierarchy for layers
   */
  private createLODHierarchy(): void {
    const lodLevels: LODLevel[] = [
      { distance: 10, geometryScale: 1.0, materialQuality: 'high' },
      { distance: 50, geometryScale: 0.7, materialQuality: 'medium' },
      { distance: 100, geometryScale: 0.4, materialQuality: 'low' }
    ];

    this.layerObjects.forEach((layer, index) => {
      if (!(layer instanceof THREE.Mesh)) return;

      const lod = new THREE.LOD();
      const originalGeometry = layer.geometry;
      const originalMaterial = layer.material;

      lodLevels.forEach(({ distance, geometryScale, materialQuality }) => {
        // Create simplified geometry
        const lodGeometry = this.simplifyGeometry(originalGeometry, geometryScale);
        
        // Create optimized material
        const lodMaterial = this.createOptimizedMaterial(
          originalMaterial as THREE.Material,
          materialQuality
        );
        
        const lodMesh = new THREE.Mesh(lodGeometry, lodMaterial);
        lodMesh.userData = { ...layer.userData };
        lod.addLevel(lodMesh, distance);
      });

      // Replace original mesh with LOD
      if (layer.parent) {
        layer.parent.add(lod);
        layer.parent.remove(layer);
      }
      
      this.lodGroups.set(index, lod);
    });
  }

  /**
   * Simplify geometry for LOD levels
   */
  private simplifyGeometry(
    geometry: THREE.BufferGeometry, 
    scale: number
  ): THREE.BufferGeometry {
    if (scale >= 1.0) return geometry.clone();

    const simplified = geometry.clone();
    
    // Simple vertex decimation (in production, use a proper simplification algorithm)
    const positionAttribute = simplified.getAttribute('position');
    const originalCount = positionAttribute.count;
    const targetCount = Math.floor(originalCount * scale);
    
    if (targetCount < originalCount) {
      // Create simplified position array
      const positions = positionAttribute.array as Float32Array;
      const step = Math.floor(originalCount / targetCount);
      const newPositions = new Float32Array(targetCount * 3);
      
      for (let i = 0, j = 0; i < targetCount; i++, j += step * 3) {
        newPositions[i * 3] = positions[j];
        newPositions[i * 3 + 1] = positions[j + 1];
        newPositions[i * 3 + 2] = positions[j + 2];
      }
      
      simplified.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
      simplified.computeVertexNormals();
    }
    
    return simplified;
  }

  /**
   * Create optimized material for different quality levels
   */
  private createOptimizedMaterial(
    originalMaterial: THREE.Material,
    quality: 'high' | 'medium' | 'low'
  ): THREE.Material {
    if (!(originalMaterial instanceof THREE.MeshStandardMaterial)) {
      return originalMaterial.clone();
    }

    const material = originalMaterial.clone();
    
    switch (quality) {
      case 'high':
        // Keep all features
        break;
      case 'medium':
        // Reduce some features
        material.roughness = Math.min(material.roughness + 0.2, 1.0);
        material.metalness = Math.max(material.metalness - 0.1, 0.0);
        break;
      case 'low':
        // Minimal features for performance
        material.roughness = 0.8;
        material.metalness = 0.0;
        material.normalMap = null;
        material.roughnessMap = null;
        material.metalnessMap = null;
        break;
    }
    
    return material;
  }

  /**
   * Optimize geometry batching for similar layers
   */
  private optimizeGeometryBatching(): void {
    // Group layers by material type for potential batching
    const materialGroups = new Map<string, THREE.Object3D[]>();
    
    this.layerObjects.forEach(layer => {
      if (layer instanceof THREE.Mesh) {
        const material = layer.material as THREE.Material;
        const key = this.getMaterialKey(material);
        
        if (!materialGroups.has(key)) {
          materialGroups.set(key, []);
        }
        materialGroups.get(key)!.push(layer);
      }
    });

    // Create batched geometry for groups with multiple objects
    materialGroups.forEach((layers, materialKey) => {
      if (layers.length > 1) {
        this.createBatchedGeometry(layers, materialKey);
      }
    });
  }

  /**
   * Get unique key for material batching
   */
  private getMaterialKey(material: THREE.Material): string {
    if (material instanceof THREE.MeshStandardMaterial) {
      return `standard_${material.color.getHex()}_${material.roughness}_${material.metalness}`;
    }
    return material.type;
  }

  /**
   * Create batched geometry for similar objects
   */
  private createBatchedGeometry(layers: THREE.Object3D[], materialKey: string): void {
    // This is a simplified batching approach
    // In production, you'd want more sophisticated geometry merging
    const geometries: THREE.BufferGeometry[] = [];
    
    layers.forEach(layer => {
      if (layer instanceof THREE.Mesh) {
        const geometry = layer.geometry.clone();
        geometry.applyMatrix4(layer.matrixWorld);
        geometries.push(geometry);
      }
    });

    if (geometries.length > 1) {
      // Merge geometries (simplified - use BufferGeometryUtils.mergeBufferGeometries in production)
      console.log(`Would batch ${geometries.length} geometries for material ${materialKey}`);
    }
  }

  /**
   * Update performance metrics and apply optimizations
   */
  updateFrame(): void {
    const startTime = performance.now();
    
    // Update frustum for culling
    if (this.config.enableFrustumCulling) {
      this.updateFrustumCulling();
    }
    
    // Update LOD distances
    if (this.config.enableLevelOfDetail) {
      this.updateLOD();
    }
    
    // Monitor performance
    this.updateMetrics(startTime);
    
    // Apply dynamic optimizations based on performance
    this.applyDynamicOptimizations();
  }

  /**
   * Update frustum culling for off-screen objects
   */
  private updateFrustumCulling(): void {
    this.cameraMatrix.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.cameraMatrix);

    this.layerObjects.forEach(layer => {
      if (layer.userData.enableCulling !== false) {
        layer.visible = this.frustum.intersectsObject(layer);
      }
    });
  }

  /**
   * Update Level of Detail based on camera distance
   */
  private updateLOD(): void {
    this.lodGroups.forEach(lod => {
      lod.update(this.camera);
    });
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(startTime: number): void {
    const frameTime = performance.now() - startTime;
    this.frameTimeHistory.push(frameTime);
    this.frameTimeHistory.shift();
    
    // Calculate average FPS
    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b) / this.frameTimeHistory.length;
    this.metrics.fps = 1000 / avgFrameTime;
    this.metrics.frameTime = frameTime;
    
    // Update render info
    const info = this.renderer.info;
    this.metrics.triangleCount = info.render.triangles;
    this.metrics.drawCalls = info.render.calls;
    
    // Estimate GPU memory usage
    this.metrics.gpuMemory = this.estimateGPUMemory();
  }

  /**
   * Estimate GPU memory usage
   */
  private estimateGPUMemory(): number {
    let memoryUsage = 0;
    
    this.layerObjects.forEach(layer => {
      if (layer instanceof THREE.Mesh) {
        const geometry = layer.geometry;
        const material = layer.material as THREE.Material;
        
        // Estimate geometry memory
        Object.keys(geometry.attributes).forEach(key => {
          const attribute = geometry.attributes[key];
          memoryUsage += attribute.array.byteLength;
        });
        
        // Estimate material memory (textures)
        if (material instanceof THREE.MeshStandardMaterial) {
          [material.map, material.normalMap, material.roughnessMap, material.metalnessMap]
            .filter(Boolean)
            .forEach(texture => {
              if (texture instanceof THREE.Texture && texture.image) {
                const image = texture.image as HTMLImageElement;
                memoryUsage += (image.width || 512) * (image.height || 512) * 4; // RGBA
              }
            });
        }
      }
    });
    
    return memoryUsage / 1024 / 1024; // Convert to MB
  }

  /**
   * Apply dynamic optimizations based on current performance
   */
  private applyDynamicOptimizations(): void {
    const { fps, triangleCount, memoryUsage } = this.metrics;
    
    // If FPS is below target, apply optimizations
    if (fps < this.config.targetFPS * 0.8) {
      this.applyPerformanceOptimizations();
    }
    
    // If triangle count is too high, reduce quality
    if (triangleCount > this.config.maxTriangles) {
      this.reduceGeometryComplexity();
    }
    
    // If memory usage is too high, free resources
    if (memoryUsage > this.config.memoryThreshold) {
      this.optimizeMemoryUsage();
    }
  }

  /**
   * Apply performance optimizations when FPS drops
   */
  private applyPerformanceOptimizations(): void {
    // Reduce renderer size for performance
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x > 512) {
      this.renderer.setSize(size.x / 2, size.y / 2);
    }
    
    // Increase LOD distances
    this.lodGroups.forEach(lod => {
      lod.levels.forEach(level => {
        level.distance *= 0.8; // Bring lower quality levels closer
      });
    });
    
    // Disable expensive features temporarily
    this.layerObjects.forEach(layer => {
      if (layer instanceof THREE.Mesh && layer.material instanceof THREE.MeshStandardMaterial) {
        layer.material.normalMap = null;
        layer.material.needsUpdate = true;
      }
    });
  }

  /**
   * Reduce geometry complexity
   */
  private reduceGeometryComplexity(): void {
    this.layerObjects.forEach(layer => {
      if (layer instanceof THREE.Mesh) {
        const geometry = layer.geometry;
        const positionAttribute = geometry.getAttribute('position');
        
        if (positionAttribute && positionAttribute.count > 1000) {
          // Apply aggressive simplification
          const simplified = this.simplifyGeometry(geometry, 0.7);
          layer.geometry = simplified;
        }
      }
    });
  }

  /**
   * Optimize memory usage
   */
  private optimizeMemoryUsage(): void {
    // Dispose unused geometries and materials
    this.layerObjects.forEach(layer => {
      if (layer instanceof THREE.Mesh) {
        // Dispose geometry if not visible
        if (!layer.visible && layer.geometry) {
          layer.geometry.dispose();
        }
        
        // Optimize material textures
        if (layer.material instanceof THREE.MeshStandardMaterial) {
          [layer.material.map, layer.material.normalMap, layer.material.roughnessMap]
            .filter(Boolean)
            .forEach(texture => {
              if (texture instanceof THREE.Texture && texture.image) {
                // Reduce texture resolution
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  const originalImage = texture.image as HTMLImageElement;
                  canvas.width = Math.max(256, originalImage.width / 2);
                  canvas.height = Math.max(256, originalImage.height / 2);
                  ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
                  texture.image = canvas;
                  texture.needsUpdate = true;
                }
              }
            });
        }
      }
    });
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance score (0-100)
   */
  getPerformanceScore(): number {
    const fpsScore = Math.min(this.metrics.fps / this.config.targetFPS, 1) * 40;
    const triangleScore = Math.max(0, 1 - (this.metrics.triangleCount / this.config.maxTriangles)) * 30;
    const memoryScore = Math.max(0, 1 - (this.metrics.memoryUsage / this.config.memoryThreshold)) * 30;
    
    return Math.round(fpsScore + triangleScore + memoryScore);
  }

  /**
   * Enable/disable specific optimizations
   */
  setOptimization(type: keyof OptimizationConfig, enabled: boolean): void {
    if (typeof this.config[type] === 'boolean') {
      (this.config[type] as boolean) = enabled;
    }
    
    // Apply changes immediately
    if (type === 'enableLevelOfDetail' && enabled) {
      this.createLODHierarchy();
    } else if (type === 'enableBatching' && enabled) {
      this.optimizeGeometryBatching();
    }
  }

  /**
   * Reset all optimizations
   */
  reset(): void {
    // Clear LOD groups
    this.lodGroups.forEach(lod => {
      if (lod.parent) {
        lod.parent.remove(lod);
      }
    });
    this.lodGroups.clear();
    
    // Clear instanced meshes
    this.instancedMeshes.forEach(mesh => {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      mesh.dispose();
    });
    this.instancedMeshes.clear();
    
    // Reset renderer settings
    this.renderer.setPixelRatio(window.devicePixelRatio);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
    
    if (this.memoryUsageInterval) {
      clearInterval(this.memoryUsageInterval);
      this.memoryUsageInterval = null;
    }
    
    this.reset();
    
    this.layerObjects = [];
    this.frameTimeHistory = [];
  }
}