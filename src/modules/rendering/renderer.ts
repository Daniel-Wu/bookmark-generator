/**
 * BookmarkRenderer - Core renderer for bookmark 3D geometry
 */

import * as THREE from 'three';
import type { BookmarkGeometry, GeometryLayer, RenderMode } from '../../types/geometry';
import { MaterialManager } from './materialManager';
import { SceneManager } from './sceneManager';

export class BookmarkRenderer {
  private sceneManager: SceneManager;
  private materialManager: MaterialManager;
  private layerMeshes: Map<number, THREE.Mesh> = new Map();
  private currentGeometry: BookmarkGeometry | null = null;
  private renderMode: RenderMode['type'] = 'solid';

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.materialManager = new MaterialManager();
  }

  /**
   * Update the bookmark geometry and regenerate meshes
   */
  updateGeometry(geometry: BookmarkGeometry): void {
    this.currentGeometry = geometry;
    
    // Clear existing meshes
    this.clearMeshes();
    
    // Create new meshes for each layer
    geometry.layers.forEach((layer) => {
      this.createLayerMesh(layer);
    });

    // Fit camera to show the entire bookmark
    if (geometry.boundingBox) {
      this.sceneManager.fitCameraToObject(geometry.boundingBox);
    }
  }

  /**
   * Create a mesh for a geometry layer
   */
  private createLayerMesh(layer: GeometryLayer): void {
    if (!layer.geometry) {
      console.warn(`Layer ${layer.id} has no geometry`);
      return;
    }

    // Create material for this layer
    const material = this.materialManager.createLayerMaterial(
      layer.id,
      layer.color,
      layer.height
    );

    // Create mesh
    const mesh = new THREE.Mesh(layer.geometry.clone(), material);
    mesh.name = `bookmark-layer-${layer.id}`;
    mesh.visible = layer.visible;
    
    // Position layer based on height
    mesh.position.y = layer.height;
    
    // Store mesh reference
    this.layerMeshes.set(layer.id, mesh);
    
    // Add to scene
    this.sceneManager.addMesh(mesh);
  }

  /**
   * Set material for a specific layer
   */
  setMaterial(layerId: number, material: THREE.Material): void {
    const mesh = this.layerMeshes.get(layerId);
    if (mesh) {
      // Dispose old material
      if (mesh.material && mesh.material !== material) {
        (mesh.material as THREE.Material).dispose();
      }
      mesh.material = material;
    }
  }

  /**
   * Toggle visibility of a specific layer
   */
  toggleLayerVisibility(layerId: number, visible: boolean): void {
    const mesh = this.layerMeshes.get(layerId);
    if (mesh) {
      mesh.visible = visible;
    }

    // Update geometry layer data if available
    if (this.currentGeometry) {
      const layer = this.currentGeometry.layers.find(l => l.id === layerId);
      if (layer) {
        layer.visible = visible;
      }
    }
  }

  /**
   * Set render mode for all layers
   */
  setRenderMode(mode: RenderMode['type']): void {
    this.renderMode = mode;
    this.materialManager.setRenderMode(mode);
    
    // Update all meshes with new materials
    this.layerMeshes.forEach((mesh, layerId) => {
      const newMaterial = this.materialManager.getCurrentMaterial(layerId);
      this.setMaterial(layerId, newMaterial);
    });
  }

  /**
   * Update layer colors with new palette
   */
  updateLayerColors(colors: Array<{ id: number; color: any }>): void {
    colors.forEach(({ id, color }) => {
      const mesh = this.layerMeshes.get(id);
      if (mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.color.setRGB(
          color.r / 255,
          color.g / 255,
          color.b / 255
        );
        mesh.material.needsUpdate = true;
      }
    });
  }

  /**
   * Get all layer meshes
   */
  getLayerMeshes(): Map<number, THREE.Mesh> {
    return new Map(this.layerMeshes);
  }

  /**
   * Get mesh for specific layer
   */
  getLayerMesh(layerId: number): THREE.Mesh | undefined {
    return this.layerMeshes.get(layerId);
  }

  /**
   * Get current render mode
   */
  getRenderMode(): RenderMode['type'] {
    return this.renderMode;
  }

  /**
   * Get current geometry
   */
  getCurrentGeometry(): BookmarkGeometry | null {
    return this.currentGeometry;
  }

  /**
   * Clear all meshes from scene and dispose resources
   */
  clearMeshes(): void {
    this.layerMeshes.forEach((mesh) => {
      // Remove from scene
      this.sceneManager.removeMesh(mesh);
      
      // Dispose geometry and material
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(material => material.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    
    this.layerMeshes.clear();
  }

  /**
   * Update layer material properties
   */
  updateLayerMaterial(
    layerId: number,
    properties: { metalness?: number; roughness?: number; opacity?: number }
  ): void {
    this.materialManager.updateLayerMaterial(layerId, properties);
  }

  /**
   * Get layer visibility states
   */
  getLayerVisibility(): Map<number, boolean> {
    const visibility = new Map<number, boolean>();
    this.layerMeshes.forEach((mesh, layerId) => {
      visibility.set(layerId, mesh.visible);
    });
    return visibility;
  }

  /**
   * Set all layers visibility
   */
  setAllLayersVisibility(visible: boolean): void {
    this.layerMeshes.forEach((mesh, layerId) => {
      this.toggleLayerVisibility(layerId, visible);
    });
  }

  /**
   * Get rendering statistics
   */
  getRenderingStats(): {
    totalTriangles: number;
    visibleTriangles: number;
    layerCount: number;
    visibleLayerCount: number;
  } {
    let totalTriangles = 0;
    let visibleTriangles = 0;
    let visibleLayerCount = 0;

    this.layerMeshes.forEach((mesh) => {
      if (mesh.geometry && mesh.geometry.attributes.position) {
        const triangleCount = mesh.geometry.attributes.position.count / 3;
        totalTriangles += triangleCount;
        
        if (mesh.visible) {
          visibleTriangles += triangleCount;
          visibleLayerCount++;
        }
      }
    });

    return {
      totalTriangles,
      visibleTriangles,
      layerCount: this.layerMeshes.size,
      visibleLayerCount,
    };
  }

  /**
   * Export current meshes as a group for STL export
   */
  exportMeshesAsGroup(): THREE.Group {
    const group = new THREE.Group();
    
    this.layerMeshes.forEach((mesh) => {
      if (mesh.visible) {
        const clonedMesh = mesh.clone();
        clonedMesh.material = mesh.material;
        group.add(clonedMesh);
      }
    });
    
    return group;
  }

  /**
   * Create preview thumbnail
   */
  async createThumbnail(width: number = 256, height: number = 256): Promise<string> {
    const originalSize = this.sceneManager.getRenderer().getSize(new THREE.Vector2());
    
    // Temporarily resize for thumbnail
    this.sceneManager.resize(width, height);
    this.sceneManager.render();
    
    // Get image data
    const canvas = this.sceneManager.getRenderer().domElement;
    const dataURL = canvas.toDataURL('image/png');
    
    // Restore original size
    this.sceneManager.resize(originalSize.x, originalSize.y);
    
    return dataURL;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clearMeshes();
    this.materialManager.dispose();
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): number {
    let geometryMemory = 0;
    this.layerMeshes.forEach((mesh) => {
      if (mesh.geometry && mesh.geometry.attributes.position) {
        // Rough estimate: position + normal + uv attributes
        const vertexCount = mesh.geometry.attributes.position.count;
        geometryMemory += vertexCount * 4 * 8; // 4 bytes per float, ~8 attributes per vertex
      }
    });

    const materialMemory = this.materialManager.getMemoryUsage();
    
    return (geometryMemory + materialMemory * 1024 * 1024) / (1024 * 1024); // Convert to MB
  }
}