/**
 * CameraManager - Advanced camera management with smart positioning and preset angles
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { 
  CameraState, 
  CameraPreset, 
  CameraPresetConfig, 
  CameraTweenConfig,
  BookmarkGeometry 
} from '../../types/geometry';

interface EasingFunction {
  (t: number): number;
}

const EASING_FUNCTIONS: Record<string, EasingFunction> = {
  linear: (t: number) => t,
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOut: (t: number) => t * (2 - t),
  easeIn: (t: number) => t * t,
};

export class CameraManager {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private presets!: Map<CameraPreset, CameraPresetConfig>;
  private currentPreset: CameraPreset = 'isometric';
  private tweenAnimationId: number | null = null;
  private savedStates: Map<string, CameraState> = new Map();

  constructor(
    camera: THREE.PerspectiveCamera, 
    controls: OrbitControls
  ) {
    this.camera = camera;
    this.controls = controls;
    this.initializePresets();
  }

  /**
   * Initialize camera presets with optimal positioning
   */
  private initializePresets(): void {
    this.presets = new Map([
      ['front', {
        name: 'Front View',
        position: [0, 0, 8],
        target: [0, 0, 0],
        description: 'View from the front'
      }],
      ['back', {
        name: 'Back View', 
        position: [0, 0, -8],
        target: [0, 0, 0],
        description: 'View from behind'
      }],
      ['top', {
        name: 'Top View',
        position: [0, 8, 0],
        target: [0, 0, 0],
        up: [0, 0, -1],
        description: 'Bird\'s eye view'
      }],
      ['bottom', {
        name: 'Bottom View',
        position: [0, -8, 0],
        target: [0, 0, 0],
        up: [0, 0, 1],
        description: 'View from below'
      }],
      ['left', {
        name: 'Left View',
        position: [-8, 0, 0],
        target: [0, 0, 0],
        description: 'View from the left side'
      }],
      ['right', {
        name: 'Right View',
        position: [8, 0, 0],
        target: [0, 0, 0],
        description: 'View from the right side'
      }],
      ['isometric', {
        name: 'Isometric View',
        position: [5, 5, 5],
        target: [0, 0, 0],
        description: '3D isometric perspective'
      }],
      ['custom', {
        name: 'Custom View',
        position: [0, 0, 8],
        target: [0, 0, 0],
        description: 'User-defined position'
      }]
    ]);
  }

  /**
   * Get all available camera presets
   */
  getPresets(): Map<CameraPreset, CameraPresetConfig> {
    return new Map(this.presets);
  }

  /**
   * Get current camera preset
   */
  getCurrentPreset(): CameraPreset {
    return this.currentPreset;
  }

  /**
   * Set camera to a preset position with smooth transition
   */
  async setPreset(
    preset: CameraPreset, 
    options: Partial<CameraTweenConfig> = {}
  ): Promise<void> {
    const config = this.presets.get(preset);
    if (!config) {
      throw new Error(`Unknown camera preset: ${preset}`);
    }

    const tweenConfig: CameraTweenConfig = {
      duration: 1000,
      easing: 'easeInOut',
      ...options
    };

    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startUp = this.camera.up.clone();

    const endPosition = new THREE.Vector3(...config.position);
    const endTarget = new THREE.Vector3(...config.target);
    const endUp = config.up ? new THREE.Vector3(...config.up) : new THREE.Vector3(0, 1, 0);

    await this.tweenCamera(
      startPosition, endPosition,
      startTarget, endTarget,
      startUp, endUp,
      tweenConfig
    );

    this.currentPreset = preset;
  }

  /**
   * Auto-fit camera to geometry with padding
   */
  autoFitToGeometry(
    geometry: BookmarkGeometry, 
    padding: number = 1.2,
    options: Partial<CameraTweenConfig> = {}
  ): Promise<void> {
    const boundingBox = geometry.boundingBox;
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Calculate optimal camera distance
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = (maxDim / 2) / Math.tan(fov / 2) * padding;
    
    // Position camera at optimal distance maintaining current angle
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();
    
    const newPosition = center.clone().add(direction.multiplyScalar(distance));
    
    const tweenConfig: CameraTweenConfig = {
      duration: 800,
      easing: 'easeOut',
      ...options
    };

    return this.tweenCamera(
      this.camera.position.clone(), newPosition,
      this.controls.target.clone(), center,
      this.camera.up.clone(), this.camera.up.clone(),
      tweenConfig
    );
  }

  /**
   * Smart camera positioning based on layer bounds
   */
  fitToLayers(
    layers: THREE.Object3D[], 
    padding: number = 1.1,
    options: Partial<CameraTweenConfig> = {}
  ): Promise<void> {
    if (layers.length === 0) {
      return Promise.resolve();
    }

    // Calculate combined bounding box
    const box = new THREE.Box3();
    layers.forEach(layer => {
      const layerBox = new THREE.Box3().setFromObject(layer);
      box.union(layerBox);
    });

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Calculate optimal distance
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = (maxDim / 2) / Math.tan(fov / 2) * padding;
    
    // Use current camera direction or fallback to isometric
    let direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();
    
    if (direction.length() === 0) {
      direction = new THREE.Vector3(1, 1, 1).normalize();
    }
    
    const newPosition = center.clone().add(direction.multiplyScalar(distance));
    
    const tweenConfig: CameraTweenConfig = {
      duration: 600,
      easing: 'easeOut', 
      ...options
    };

    return this.tweenCamera(
      this.camera.position.clone(), newPosition,
      this.controls.target.clone(), center,
      this.camera.up.clone(), this.camera.up.clone(),
      tweenConfig
    );
  }

  /**
   * Smoothly transition camera between positions
   */
  private tweenCamera(
    startPos: THREE.Vector3, endPos: THREE.Vector3,
    startTarget: THREE.Vector3, endTarget: THREE.Vector3,
    startUp: THREE.Vector3, endUp: THREE.Vector3,
    config: CameraTweenConfig
  ): Promise<void> {
    return new Promise((resolve) => {
      // Cancel any existing tween
      if (this.tweenAnimationId) {
        cancelAnimationFrame(this.tweenAnimationId);
      }

      const startTime = performance.now();
      const easingFn = EASING_FUNCTIONS[config.easing] || EASING_FUNCTIONS.easeInOut;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / config.duration, 1);
        const easedProgress = easingFn(progress);

        // Interpolate position
        this.camera.position.lerpVectors(startPos, endPos, easedProgress);
        
        // Interpolate target
        this.controls.target.lerpVectors(startTarget, endTarget, easedProgress);
        
        // Interpolate up vector
        this.camera.up.lerpVectors(startUp, endUp, easedProgress);
        this.camera.up.normalize();

        // Update camera and controls
        this.camera.lookAt(this.controls.target);
        this.controls.update();

        // Call progress callback
        config.onUpdate?.(easedProgress);

        if (progress < 1) {
          this.tweenAnimationId = requestAnimationFrame(animate);
        } else {
          this.tweenAnimationId = null;
          config.onComplete?.();
          resolve();
        }
      };

      this.tweenAnimationId = requestAnimationFrame(animate);
    });
  }

  /**
   * Save current camera state with a name
   */
  saveState(name: string): void {
    const state: CameraState = {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      zoom: this.camera.zoom,
      up: this.camera.up.clone()
    };
    this.savedStates.set(name, state);
  }

  /**
   * Restore a saved camera state
   */
  async restoreState(
    name: string, 
    options: Partial<CameraTweenConfig> = {}
  ): Promise<void> {
    const state = this.savedStates.get(name);
    if (!state) {
      throw new Error(`No saved camera state found: ${name}`);
    }

    const tweenConfig: CameraTweenConfig = {
      duration: 800,
      easing: 'easeInOut',
      ...options
    };

    await this.tweenCamera(
      this.camera.position.clone(), state.position,
      this.controls.target.clone(), state.target,
      this.camera.up.clone(), state.up || new THREE.Vector3(0, 1, 0),
      tweenConfig
    );

    this.camera.zoom = state.zoom;
    this.camera.updateProjectionMatrix();
    this.currentPreset = 'custom';
  }

  /**
   * Get list of saved state names
   */
  getSavedStateNames(): string[] {
    return Array.from(this.savedStates.keys());
  }

  /**
   * Delete a saved state
   */
  deleteSavedState(name: string): boolean {
    return this.savedStates.delete(name);
  }

  /**
   * Reset camera to default position
   */
  reset(options: Partial<CameraTweenConfig> = {}): Promise<void> {
    return this.setPreset('isometric', options);
  }

  /**
   * Get current camera state
   */
  getCurrentState(): CameraState {
    return {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(), 
      zoom: this.camera.zoom,
      up: this.camera.up.clone()
    };
  }

  /**
   * Set zoom level with smooth transition
   */
  setZoom(zoomLevel: number, duration: number = 300): Promise<void> {
    return new Promise((resolve) => {
      const startZoom = this.camera.zoom;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = EASING_FUNCTIONS.easeOut(progress);

        this.camera.zoom = THREE.MathUtils.lerp(startZoom, zoomLevel, easedProgress);
        this.camera.updateProjectionMatrix();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Enable/disable camera controls
   */
  setControlsEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
  }

  /**
   * Set orbit constraints
   */
  setOrbitConstraints(
    minDistance?: number,
    maxDistance?: number,
    minPolarAngle?: number,
    maxPolarAngle?: number
  ): void {
    if (minDistance !== undefined) this.controls.minDistance = minDistance;
    if (maxDistance !== undefined) this.controls.maxDistance = maxDistance;
    if (minPolarAngle !== undefined) this.controls.minPolarAngle = minPolarAngle;
    if (maxPolarAngle !== undefined) this.controls.maxPolarAngle = maxPolarAngle;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.tweenAnimationId) {
      cancelAnimationFrame(this.tweenAnimationId);
      this.tweenAnimationId = null;
    }
    this.controls.dispose();
    this.savedStates.clear();
    this.presets.clear();
  }
}