/**
 * MaterialManager - Handles creation and management of Three.js materials for bookmark layers
 */

import * as THREE from 'three';
import type { Color, MaterialProperties, RenderMode } from '../../types/geometry';

export class MaterialManager {
  private materials: Map<number, THREE.MeshStandardMaterial> = new Map();
  private wireframeMaterials: Map<number, THREE.MeshBasicMaterial> = new Map();
  private currentRenderMode: RenderMode['type'] = 'solid';

  /**
   * Create a PBR material for a bookmark layer
   */
  createLayerMaterial(
    layerId: number,
    color: Color,
    height: number,
    properties?: Partial<MaterialProperties>
  ): THREE.Material {
    const defaultProperties: MaterialProperties = {
      metalness: 0.1,
      roughness: 0.8,
      opacity: 1.0,
      transparent: false,
      wireframe: false,
      ...properties,
    };

    // Create solid material
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color.r / 255, color.g / 255, color.b / 255),
      metalness: defaultProperties.metalness,
      roughness: defaultProperties.roughness,
      opacity: defaultProperties.opacity,
      transparent: defaultProperties.transparent,
      wireframe: defaultProperties.wireframe,
    });

    // Create wireframe material
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color.r / 255, color.g / 255, color.b / 255),
      wireframe: true,
      opacity: 0.7,
      transparent: true,
    });

    this.materials.set(layerId, material);
    this.wireframeMaterials.set(layerId, wireframeMaterial);

    return this.getCurrentMaterial(layerId);
  }

  /**
   * Update materials with new color palette
   */
  updateMaterials(colorPalette: Color[]): void {
    colorPalette.forEach((color, index) => {
      const layerId = index;
      if (this.materials.has(layerId)) {
        const material = this.materials.get(layerId)!;
        material.color.setRGB(color.r / 255, color.g / 255, color.b / 255);
        material.needsUpdate = true;

        const wireframeMaterial = this.wireframeMaterials.get(layerId)!;
        wireframeMaterial.color.setRGB(color.r / 255, color.g / 255, color.b / 255);
        wireframeMaterial.needsUpdate = true;
      }
    });
  }

  /**
   * Get material for current render mode
   */
  getCurrentMaterial(layerId: number): THREE.Material {
    switch (this.currentRenderMode) {
      case 'wireframe':
        return this.wireframeMaterials.get(layerId) || this.createDefaultWireframeMaterial();
      case 'x-ray':
        return this.getXRayMaterial(layerId);
      case 'solid':
      default:
        return this.materials.get(layerId) || this.createDefaultSolidMaterial();
    }
  }

  /**
   * Set render mode for all materials
   */
  setRenderMode(mode: RenderMode['type']): void {
    this.currentRenderMode = mode;
    
    // Update all existing materials based on render mode
    this.materials.forEach((material, layerId) => {
      this.updateMaterialForRenderMode(material, mode);
    });

    this.wireframeMaterials.forEach((material, layerId) => {
      this.updateMaterialForRenderMode(material, mode);
    });
  }

  /**
   * Update material properties for specific layer
   */
  updateLayerMaterial(
    layerId: number,
    properties: Partial<MaterialProperties>
  ): void {
    const material = this.materials.get(layerId);
    if (material) {
      Object.assign(material, properties);
      material.needsUpdate = true;
    }
  }

  /**
   * Create X-ray material with transparency
   */
  private getXRayMaterial(layerId: number): THREE.Material {
    const baseMaterial = this.materials.get(layerId);
    if (!baseMaterial) return this.createDefaultSolidMaterial();

    const xrayMaterial = baseMaterial.clone();
    xrayMaterial.opacity = 0.3;
    xrayMaterial.transparent = true;
    xrayMaterial.depthWrite = false;
    xrayMaterial.side = THREE.DoubleSide;
    
    return xrayMaterial;
  }

  /**
   * Update material based on render mode
   */
  private updateMaterialForRenderMode(
    material: THREE.Material,
    mode: RenderMode['type']
  ): void {
    switch (mode) {
      case 'solid':
        material.transparent = false;
        material.opacity = 1.0;
        (material as any).wireframe = false;
        break;
      case 'wireframe':
        (material as any).wireframe = true;
        material.transparent = true;
        material.opacity = 0.7;
        break;
      case 'x-ray':
        (material as any).wireframe = false;
        material.transparent = true;
        material.opacity = 0.3;
        break;
    }
    material.needsUpdate = true;
  }

  /**
   * Create default solid material
   */
  private createDefaultSolidMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.1,
      roughness: 0.8,
    });
  }

  /**
   * Create default wireframe material
   */
  private createDefaultWireframeMaterial(): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color: 0x888888,
      wireframe: true,
      opacity: 0.7,
      transparent: true,
    });
  }

  /**
   * Get all available render modes
   */
  static getRenderModes(): RenderMode[] {
    return [
      {
        type: 'solid',
        name: 'Solid',
        description: 'Solid shaded view with materials',
      },
      {
        type: 'wireframe',
        name: 'Wireframe',
        description: 'Wireframe view showing mesh structure',
      },
      {
        type: 'x-ray',
        name: 'X-Ray',
        description: 'Transparent view showing internal structure',
      },
    ];
  }

  /**
   * Dispose of all materials and free memory
   */
  dispose(): void {
    this.materials.forEach((material) => {
      material.dispose();
    });
    this.wireframeMaterials.forEach((material) => {
      material.dispose();
    });
    this.materials.clear();
    this.wireframeMaterials.clear();
  }

  /**
   * Get memory usage estimate in MB
   */
  getMemoryUsage(): number {
    const materialCount = this.materials.size + this.wireframeMaterials.size;
    // Rough estimate: ~1KB per material
    return (materialCount * 1024) / (1024 * 1024);
  }
}