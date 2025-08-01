/**
 * SceneManager - Manages Three.js scene setup, lighting, and camera controls
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraState, SceneStats } from '../../types/geometry';
import { CONTROLS_SETTINGS } from '../../constants/rendering';

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private hemisphereLight!: THREE.HemisphereLight;
  private directionalLight!: THREE.DirectionalLight;
  private shadowCamera!: THREE.OrthographicCamera;
  private controls!: OrbitControls;
  private stats: SceneStats;
  private frameCount: number = 0;
  private lastFrameTime: number = performance.now();

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    
    this.stats = {
      triangles: 0,
      drawCalls: 0,
      geometries: 0,
      textures: 0,
      fps: 60,
      memoryUsage: 0,
    };

    this.setupRenderer();
    this.setupLighting();
    this.setupCamera();
    this.enableOrbitControls();
  }

  /**
   * Setup WebGL renderer with optimal settings
   */
  private setupRenderer(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // WebGL2 capabilities are detected automatically
  }

  /**
   * Configure hemisphere and directional lighting
   */
  setupLighting(): void {
    // Clear existing lights
    this.scene.children
      .filter(child => child instanceof THREE.Light)
      .forEach(light => this.scene.remove(light));

    // Hemisphere light for ambient lighting
    this.hemisphereLight = new THREE.HemisphereLight(
      0xffffff, // sky color
      0x444444, // ground color
      0.6       // intensity
    );
    this.hemisphereLight.position.set(0, 50, 0);
    this.scene.add(this.hemisphereLight);

    // Directional light for shadows and definition
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(10, 10, 5);
    this.directionalLight.castShadow = true;
    
    // Configure shadow properties
    const shadowMapSize = 2048;
    this.directionalLight.shadow.mapSize.width = shadowMapSize;
    this.directionalLight.shadow.mapSize.height = shadowMapSize;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 500;
    this.directionalLight.shadow.camera.left = -10;
    this.directionalLight.shadow.camera.right = 10;
    this.directionalLight.shadow.camera.top = 10;
    this.directionalLight.shadow.camera.bottom = -10;
    this.directionalLight.shadow.bias = -0.0001;

    this.scene.add(this.directionalLight);

    // Optional: Add light helpers for debugging
    if (process.env.NODE_ENV === 'development') {
      const directionalLightHelper = new THREE.DirectionalLightHelper(
        this.directionalLight,
        1
      );
      // this.scene.add(directionalLightHelper);
    }
  }

  /**
   * Setup perspective camera with proper positioning
   */
  setupCamera(): void {
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Enable orbit controls for camera interaction
   */
  enableOrbitControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    
    // Configure controls based on constants
    this.controls.enableDamping = CONTROLS_SETTINGS.ENABLE_DAMPING;
    this.controls.dampingFactor = CONTROLS_SETTINGS.DAMPING_FACTOR;
    this.controls.minDistance = CONTROLS_SETTINGS.MIN_DISTANCE;
    this.controls.maxDistance = CONTROLS_SETTINGS.MAX_DISTANCE;
    this.controls.maxPolarAngle = CONTROLS_SETTINGS.MAX_POLAR_ANGLE;
    this.controls.minPolarAngle = CONTROLS_SETTINGS.MIN_POLAR_ANGLE;
    this.controls.enablePan = CONTROLS_SETTINGS.ENABLE_PAN;
    this.controls.enableZoom = CONTROLS_SETTINGS.ENABLE_ZOOM;
    this.controls.enableRotate = CONTROLS_SETTINGS.ENABLE_ROTATE;
    
    // Set target to scene center
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /**
   * Update camera aspect ratio
   */
  updateCameraAspect(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Fit camera to show entire bookmark
   */
  fitCameraToObject(boundingBox: THREE.Box3, padding: number = 1.5): void {
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Calculate the distance needed to fit the object
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = (maxDim / (2 * Math.tan(fov / 2))) * padding;
    
    // Position camera to look at the center
    const direction = new THREE.Vector3(1, 1, 1).normalize();
    this.camera.position.copy(direction.multiplyScalar(distance).add(center));
    this.camera.lookAt(center);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Add mesh to scene with shadow configuration
   */
  addMesh(mesh: THREE.Mesh): void {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  /**
   * Remove mesh from scene
   */
  removeMesh(mesh: THREE.Mesh): void {
    this.scene.remove(mesh);
  }

  /**
   * Clear all meshes from scene
   */
  clearMeshes(): void {
    const meshesToRemove = this.scene.children.filter(
      child => child instanceof THREE.Mesh
    );
    meshesToRemove.forEach(mesh => this.scene.remove(mesh));
  }

  /**
   * Render the scene
   */
  render(): void {
    // Update controls if damping is enabled
    if (this.controls && this.controls.enableDamping) {
      this.controls.update();
    }
    
    this.updateStats();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Update performance statistics
   */
  private updateStats(): void {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    this.frameCount++;
    
    // Update FPS every second
    if (deltaTime >= 1000) {
      this.stats.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.lastFrameTime = currentTime;
    }

    // Update render stats
    const info = this.renderer.info;
    this.stats.triangles = info.render.triangles;
    this.stats.drawCalls = info.render.calls;
    this.stats.geometries = info.memory.geometries;
    this.stats.textures = info.memory.textures;
  }

  /**
   * Get current scene statistics
   */
  getStats(): SceneStats {
    return { ...this.stats };
  }

  /**
   * Get current camera state
   */
  getCameraState(): CameraState {
    return {
      position: this.camera.position.clone(),
      target: this.controls ? this.controls.target.clone() : new THREE.Vector3(0, 0, 0),
      zoom: this.camera.zoom,
    };
  }

  /**
   * Set camera state
   */
  setCameraState(state: CameraState): void {
    this.camera.position.copy(state.position);
    this.camera.zoom = state.zoom;
    this.camera.updateProjectionMatrix();
    
    if (this.controls) {
      this.controls.target.copy(state.target);
      this.controls.update();
    } else {
      this.camera.lookAt(state.target);
    }
  }

  /**
   * Enable/disable shadows
   */
  setShadowsEnabled(enabled: boolean): void {
    this.renderer.shadowMap.enabled = enabled;
    this.directionalLight.castShadow = enabled;
    
    // Update all meshes in scene
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = enabled;
        object.receiveShadow = enabled;
      }
    });
  }

  /**
   * Adjust lighting intensity
   */
  setLightingIntensity(hemisphereIntensity: number, directionalIntensity: number): void {
    this.hemisphereLight.intensity = hemisphereIntensity;
    this.directionalLight.intensity = directionalIntensity;
  }

  /**
   * Toggle wireframe mode for debugging
   */
  setWireframeMode(enabled: boolean): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => {
            (material as any).wireframe = enabled;
          });
        } else {
          (object.material as any).wireframe = enabled;
        }
      }
    });
  }

  /**
   * Resize renderer
   */
  resize(width: number, height: number): void {
    this.updateCameraAspect(width, height);
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Dispose controls
    if (this.controls) {
      this.controls.dispose();
    }
    
    this.renderer.dispose();
    
    // Dispose of geometries and materials
    this.scene.traverse((object) => {
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
   * Get WebGL renderer instance
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Get scene instance
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get camera instance
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get orbit controls instance
   */
  getControls(): OrbitControls {
    return this.controls;
  }
}