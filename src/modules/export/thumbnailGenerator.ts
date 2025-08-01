/**
 * Thumbnail generator for 3MF files
 * Creates PNG thumbnails using canvas-based rendering from 3D geometry
 */

import * as THREE from 'three';
import type { BookmarkGeometry, GeometryLayer } from '../../types/geometry';

/**
 * Thumbnail generation options
 */
export interface ThumbnailOptions {
  width: number;
  height: number;
  backgroundColor: string;
  lightingIntensity: number;
  cameraDistance: number;
  showLayers: boolean;
  wireframe: boolean;
  quality: number; // 0-1, affects JPEG quality if format is JPEG
  format: 'png' | 'jpeg';
}

/**
 * Default thumbnail options
 */
const DEFAULT_THUMBNAIL_OPTIONS: ThumbnailOptions = {
  width: 256,
  height: 256,
  backgroundColor: '#f0f0f0',
  lightingIntensity: 1.0,
  cameraDistance: 2.5,
  showLayers: true,
  wireframe: false,
  quality: 0.9,
  format: 'png'
};

/**
 * Canvas-based thumbnail generator
 */
export class ThumbnailGenerator {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private lights: THREE.Light[] = [];

  constructor(options: Partial<ThumbnailOptions> = {}) {
    const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options };
    
    // Create off-screen canvas
    if (typeof window !== 'undefined') {
      this.canvas = document.createElement('canvas');
    } else {
      // Node.js environment - use OffscreenCanvas if available
      if (typeof OffscreenCanvas !== 'undefined') {
        this.canvas = new OffscreenCanvas(opts.width, opts.height) as any;
      } else {
        throw new Error('Canvas not available in this environment');
      }
    }
    
    this.canvas.width = opts.width;
    this.canvas.height = opts.height;

    // Initialize Three.js renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    
    this.renderer.setSize(opts.width, opts.height);
    this.renderer.setPixelRatio(1); // Force 1:1 pixel ratio for consistent thumbnails
    this.renderer.setClearColor(opts.backgroundColor, 1);
    
    // Initialize scene
    this.scene = new THREE.Scene();
    
    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      50, // FOV
      opts.width / opts.height, // Aspect
      0.1, // Near
      1000 // Far
    );
    
    this.setupLighting(opts.lightingIntensity);
  }

  /**
   * Generate thumbnail from bookmark geometry
   */
  async generateThumbnail(
    geometry: BookmarkGeometry, 
    options: Partial<ThumbnailOptions> = {}
  ): Promise<Uint8Array> {
    const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options };
    
    try {
      // Clear scene
      this.clearScene();
      
      // Add geometry to scene
      this.addGeometryToScene(geometry, opts);
      
      // Position camera
      this.positionCamera(geometry, opts.cameraDistance);
      
      // Render scene
      this.renderer.render(this.scene, this.camera);
      
      // Extract image data
      return await this.extractImageData(opts);
      
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      
      // Return fallback thumbnail
      return this.generateFallbackThumbnail(opts);
    }
  }

  /**
   * Setup scene lighting
   */
  private setupLighting(intensity: number): void {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x404040, intensity * 0.4);
    this.scene.add(ambientLight);
    this.lights.push(ambientLight);

    // Key light (main directional light)
    const keyLight = new THREE.DirectionalLight(0xffffff, intensity * 0.8);
    keyLight.position.set(10, 10, 5);
    keyLight.castShadow = false; // Disable shadows for performance
    this.scene.add(keyLight);
    this.lights.push(keyLight);

    // Fill light (softer secondary light)
    const fillLight = new THREE.DirectionalLight(0xffffff, intensity * 0.3);
    fillLight.position.set(-5, 5, 5);
    this.scene.add(fillLight);
    this.lights.push(fillLight);

    // Rim light (back light for edge definition)
    const rimLight = new THREE.DirectionalLight(0xffffff, intensity * 0.2);
    rimLight.position.set(0, -5, -10);
    this.scene.add(rimLight);
    this.lights.push(rimLight);
  }

  /**
   * Add geometry to scene
   */
  private addGeometryToScene(geometry: BookmarkGeometry, options: ThumbnailOptions): void {
    const group = new THREE.Group();

    for (const layer of geometry.layers) {
      if (!layer.visible && options.showLayers) continue;
      
      const mesh = this.createMeshFromLayer(layer, options);
      if (mesh) {
        group.add(mesh);
      }
    }

    this.scene.add(group);
  }

  /**
   * Create Three.js mesh from geometry layer
   */
  private createMeshFromLayer(layer: GeometryLayer, options: ThumbnailOptions): THREE.Mesh | null {
    if (!layer.geometry) return null;

    // Clone geometry to avoid modifying original
    const geometry = layer.geometry.clone();
    
    // Ensure geometry has normals
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }

    // Create material
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHex(parseInt(layer.color.hex.slice(1), 16)),
      opacity: layer.opacity,
      transparent: layer.opacity < 1,
      wireframe: options.wireframe,
      side: THREE.FrontSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    // Position layer at correct height
    mesh.position.z = layer.height;
    
    return mesh;
  }

  /**
   * Position camera to frame the geometry
   */
  private positionCamera(geometry: BookmarkGeometry, distance: number): void {
    const bbox = geometry.boundingBox;
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Position camera at an angle to show 3D structure
    const cameraDistance = maxDim * distance;
    this.camera.position.set(
      center.x + cameraDistance * 0.7,
      center.y + cameraDistance * 0.7,
      center.z + cameraDistance * 0.8
    );

    // Look at center of geometry
    this.camera.lookAt(center);
    
    // Update camera projection matrix
    this.camera.updateProjectionMatrix();
  }

  /**
   * Extract image data from canvas
   */
  private async extractImageData(options: ThumbnailOptions): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      try {
        if (typeof window === 'undefined') {
          // Node.js environment - handle OffscreenCanvas
          if (this.canvas instanceof OffscreenCanvas) {
            this.canvas.convertToBlob({
              type: `image/${options.format}`,
              quality: options.quality
            }).then(blob => {
              blob.arrayBuffer().then(buffer => {
                resolve(new Uint8Array(buffer));
              }).catch(reject);
            }).catch(reject);
            return;
          }
        }

        // Browser environment
        const canvas = this.canvas as HTMLCanvasElement;
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'));
            return;
          }

          blob.arrayBuffer().then(buffer => {
            resolve(new Uint8Array(buffer));
          }).catch(reject);
        }, `image/${options.format}`, options.quality);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate fallback thumbnail when rendering fails
   */
  private generateFallbackThumbnail(options: ThumbnailOptions): Uint8Array {
    // Create simple fallback image using canvas 2D context
    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Return minimal PNG data if even 2D context fails
      return this.createMinimalPNG(options.width, options.height);
    }

    // Fill with background color
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, options.width, options.height);

    // Draw simple bookmark shape
    ctx.fillStyle = '#888888';
    const margin = options.width * 0.2;
    const width = options.width - 2 * margin;
    const height = options.height - 2 * margin;
    
    ctx.fillRect(margin, margin, width, height);

    // Add text indicating fallback
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.floor(options.width / 20)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('3MF', options.width / 2, options.height / 2);

    // Convert to Uint8Array
    const dataURL = canvas.toDataURL(`image/${options.format}`, options.quality);
    const base64Data = dataURL.split(',')[1];
    const binaryData = atob(base64Data);
    const uint8Array = new Uint8Array(binaryData.length);
    
    for (let i = 0; i < binaryData.length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }
    
    return uint8Array;
  }

  /**
   * Create minimal PNG data for ultimate fallback
   */
  private createMinimalPNG(width: number, height: number): Uint8Array {
    // This creates a minimal 1x1 transparent PNG
    // In a real implementation, you might want to create a proper sized image
    const pngData = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, // Width: 1
      0x00, 0x00, 0x00, 0x01, // Height: 1
      0x08, 0x06, 0x00, 0x00, 0x00, // Bit depth: 8, Color type: 6 (RGBA), Compression: 0, Filter: 0, Interlace: 0
      0x1F, 0x15, 0xC4, 0x89, // CRC
      0x00, 0x00, 0x00, 0x0A, // IDAT chunk length
      0x49, 0x44, 0x41, 0x54, // IDAT
      0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // ZLIB compressed data (transparent pixel)
      0x0D, 0x0A, 0x2D, 0xB4, // CRC
      0x00, 0x00, 0x00, 0x00, // IEND chunk length
      0x49, 0x45, 0x4E, 0x44, // IEND
      0xAE, 0x42, 0x60, 0x82  // CRC
    ]);
    
    return pngData;
  }

  /**
   * Clear scene of all geometry
   */
  private clearScene(): void {
    // Remove all objects except lights
    const objectsToRemove: THREE.Object3D[] = [];
    
    this.scene.traverse((object) => {
      if (object !== this.scene && !this.lights.includes(object as THREE.Light)) {
        objectsToRemove.push(object);
      }
    });

    objectsToRemove.forEach(object => {
      this.scene.remove(object);
      
      // Dispose of geometry and materials
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clearScene();
    
    // Dispose of lights
    this.lights.forEach(light => {
      this.scene.remove(light);
    });
    this.lights = [];
    
    // Dispose of renderer
    this.renderer.dispose();
  }

  /**
   * Create thumbnail generator with default settings
   */
  static create(options: Partial<ThumbnailOptions> = {}): ThumbnailGenerator {
    return new ThumbnailGenerator(options);
  }

  /**
   * Quick thumbnail generation for simple use cases
   */
  static async generateQuickThumbnail(
    geometry: BookmarkGeometry,
    width = 256,
    height = 256
  ): Promise<Uint8Array> {
    const generator = new ThumbnailGenerator({ width, height });
    
    try {
      const thumbnail = await generator.generateThumbnail(geometry);
      generator.dispose();
      return thumbnail;
    } catch (error) {
      generator.dispose();
      throw error;
    }
  }
}