/**
 * LayerAnimationManager - Handles advanced layer visualization modes and animations
 */

import * as THREE from 'three';
import type { 
  AnimationState, 
  LayerVisualizationState,
  GeometryLayer,
  VisualizationMode 
} from '../../types/geometry';

interface LayerAnimationConfig {
  duration: number;
  easing: 'linear' | 'easeInOut' | 'easeOut' | 'easeIn';
  delay?: number;
}

interface ExplodedViewConfig {
  direction: THREE.Vector3;
  spacing: number;
  maxDistance: number;
}

export class LayerAnimationManager {
  private layers: THREE.Object3D[] = [];
  private originalPositions: Map<number, THREE.Vector3> = new Map();
  private animationId: number | null = null;
  private currentAnimationState: AnimationState;
  private visualizationState: LayerVisualizationState;
  private onStateChange?: (state: AnimationState) => void;

  constructor(
    initialAnimationState: AnimationState,
    initialVisualizationState: LayerVisualizationState,
    onStateChange?: (state: AnimationState) => void
  ) {
    this.currentAnimationState = { ...initialAnimationState };
    this.visualizationState = { ...initialVisualizationState };
    this.onStateChange = onStateChange;
  }

  /**
   * Set layer objects for animation
   */
  setLayers(layers: THREE.Object3D[]): void {
    this.layers = layers;
    
    // Store original positions
    this.originalPositions.clear();
    layers.forEach((layer, index) => {
      this.originalPositions.set(index, layer.position.clone());
    });
  }

  /**
   * Update visualization state
   */
  updateVisualizationState(state: Partial<LayerVisualizationState>): void {
    this.visualizationState = { ...this.visualizationState, ...state };
    
    // Apply immediate visual changes
    this.applyVisualizationState();
  }

  /**
   * Update animation state
   */
  updateAnimationState(state: Partial<AnimationState>): void {
    const wasPlaying = this.currentAnimationState.isPlaying;
    this.currentAnimationState = { ...this.currentAnimationState, ...state };
    
    // Handle play/pause changes
    if (state.isPlaying !== undefined) {
      if (state.isPlaying && !wasPlaying) {
        this.startAnimation();
      } else if (!state.isPlaying && wasPlaying) {
        this.pauseAnimation();
      }
    }
    
    this.onStateChange?.(this.currentAnimationState);
  }

  /**
   * Start animation based on current mode
   */
  private startAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const animate = () => {
      if (!this.currentAnimationState.isPlaying) return;

      this.updateAnimationFrame();
      this.animationId = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Pause current animation
   */
  private pauseAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Update animation frame based on mode
   */
  private updateAnimationFrame(): void {
    const { animationMode, animationSpeed } = this.visualizationState;
    const { currentFrame, totalFrames, direction } = this.currentAnimationState;

    switch (animationMode) {
      case 'build':
        this.updateBuildAnimation();
        break;
      case 'explode':
        this.updateExplodeAnimation();
        break;
      case 'rotate':
        this.updateRotateAnimation();
        break;
    }

    // Update frame counter
    const frameIncrement = animationSpeed * (direction === 'forward' ? 1 : -1);
    let nextFrame = currentFrame + frameIncrement;

    if (this.currentAnimationState.loop) {
      nextFrame = ((nextFrame % totalFrames) + totalFrames) % totalFrames;
    } else {
      nextFrame = Math.max(0, Math.min(totalFrames - 1, nextFrame));
      
      // Stop at boundaries if not looping
      if (nextFrame === 0 || nextFrame === totalFrames - 1) {
        this.updateAnimationState({ isPlaying: false });
      }
    }

    this.updateAnimationState({ currentFrame: nextFrame });
  }

  /**
   * Build animation - layers appear sequentially
   */
  private updateBuildAnimation(): void {
    const { currentFrame, totalFrames } = this.currentAnimationState;
    const progress = currentFrame / totalFrames;
    const layersToShow = Math.floor(progress * this.layers.length);

    this.layers.forEach((layer, index) => {
      const shouldShow = index <= layersToShow;
      const layerProgress = Math.max(0, Math.min(1, 
        (progress * this.layers.length) - index
      ));

      // Animate layer appearance
      if (shouldShow) {
        layer.visible = true;
        layer.scale.setScalar(layerProgress);
        layer.position.y = this.originalPositions.get(index)!.y + 
          (1 - layerProgress) * 2; // Drop in from above
      } else {
        layer.visible = false;
      }
    });
  }

  /**
   * Explode animation - layers separate and return
   */
  private updateExplodeAnimation(): void {
    const { currentFrame, totalFrames } = this.currentAnimationState;
    const progress = currentFrame / totalFrames;
    
    // Sine wave for smooth back-and-forth motion
    const explodeProgress = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
    
    this.animateExplodedView(explodeProgress);
  }

  /**
   * Rotate animation - continuous rotation around Y axis
   */
  private updateRotateAnimation(): void {
    const { currentFrame } = this.currentAnimationState;
    const { animationSpeed } = this.visualizationState;
    
    const rotationY = (currentFrame * animationSpeed * 0.02) % (Math.PI * 2);
    
    this.layers.forEach(layer => {
      layer.rotation.y = rotationY;
    });
  }

  /**
   * Apply exploded view with custom configuration
   */
  animateExplodedView(
    progress: number, 
    config?: Partial<ExplodedViewConfig>
  ): void {
    const defaultConfig: ExplodedViewConfig = {
      direction: new THREE.Vector3(0, 1, 0),
      spacing: this.visualizationState.explodeDistance,
      maxDistance: 10
    };
    
    const finalConfig = { ...defaultConfig, ...config };

    this.layers.forEach((layer, index) => {
      const originalPos = this.originalPositions.get(index);
      if (!originalPos) return;

      // Calculate exploded position
      const layerOffset = (index - (this.layers.length - 1) / 2) * finalConfig.spacing;
      const explodeOffset = finalConfig.direction.clone()
        .multiplyScalar(layerOffset * progress);

      layer.position.copy(originalPos).add(explodeOffset);
    });
  }

  /**
   * Apply cross-section visualization
   */
  applyCrossSection(plane: THREE.Plane, showCap: boolean = true): void {
    this.layers.forEach((layer, index) => {
      if (layer instanceof THREE.Mesh && layer.material instanceof THREE.Material) {
        // Create clipping planes for cross-section
        const material = layer.material as any;
        material.clippingPlanes = [plane];
        material.clipShadows = true;
        
        if (showCap) {
          // Add cap geometry at intersection
          this.addCrossSectionCap(layer, plane);
        }
      }
    });
  }

  /**
   * Add cross-section cap geometry
   */
  private addCrossSectionCap(mesh: THREE.Mesh, plane: THREE.Plane): void {
    // Implementation for cross-section cap would go here
    // This is a complex operation that requires geometry intersection calculations
    console.log('Cross-section cap not yet implemented');
  }

  /**
   * Apply current visualization state to layers
   */
  private applyVisualizationState(): void {
    const { visibility, opacity, exploded, soloLayer } = this.visualizationState;

    this.layers.forEach((layer, index) => {
      // Visibility
      const isVisible = soloLayer !== null 
        ? index === soloLayer 
        : visibility.get(index) !== false;
      layer.visible = isVisible;

      // Opacity
      if (layer instanceof THREE.Mesh && layer.material instanceof THREE.Material) {
        const layerOpacity = opacity.get(index) || 1;
        const material = layer.material as any;
        material.opacity = layerOpacity;
        material.transparent = layerOpacity < 1;
      }
    });

    // Apply exploded view if enabled
    if (exploded) {
      this.animateExplodedView(1.0);
    } else {
      // Return to original positions
      this.layers.forEach((layer, index) => {
        const originalPos = this.originalPositions.get(index);
        if (originalPos) {
          layer.position.copy(originalPos);
        }
      });
    }
  }

  /**
   * Set visualization mode
   */
  setVisualizationMode(mode: VisualizationMode): void {
    this.layers.forEach((layer, index) => {
      if (layer instanceof THREE.Mesh && layer.material instanceof THREE.Material) {
        const material = layer.material as any;
        
        switch (mode) {
          case 'solid':
            material.wireframe = false;
            material.opacity = this.visualizationState.opacity.get(index) || 1;
            break;
          case 'wireframe':
            material.wireframe = true;
            material.opacity = 1;
            break;
          case 'x-ray':
            material.wireframe = false;
            material.opacity = 0.3;
            material.transparent = true;
            break;
          case 'exploded':
            material.wireframe = false;
            this.animateExplodedView(1.0);
            break;
        }
      }
    });
  }

  /**
   * Create animation timeline for sequenced layer appearance
   */
  createBuildSequence(
    duration: number = 3000,
    staggerDelay: number = 200
  ): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const totalDuration = duration + (this.layers.length * staggerDelay);

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / totalDuration, 1);

        this.layers.forEach((layer, index) => {
          const layerStart = index * staggerDelay;
          const layerProgress = Math.max(0, Math.min(1, 
            (elapsed - layerStart) / duration
          ));

          if (elapsed >= layerStart) {
            layer.visible = true;
            
            // Smooth scale and position animation
            const easeProgress = this.easeInOutCubic(layerProgress);
            layer.scale.setScalar(easeProgress);
            
            const originalY = this.originalPositions.get(index)?.y || 0;
            layer.position.y = originalY + (1 - easeProgress) * 3;
          } else {
            layer.visible = false;
          }
        });

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
   * Easing function for smooth animations
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Reset all layers to original state
   */
  reset(): void {
    this.pauseAnimation();
    
    this.layers.forEach((layer, index) => {
      const originalPos = this.originalPositions.get(index);
      if (originalPos) {
        layer.position.copy(originalPos);
      }
      layer.rotation.set(0, 0, 0);
      layer.scale.set(1, 1, 1);
      layer.visible = true;
      
      if (layer instanceof THREE.Mesh && layer.material instanceof THREE.Material) {
        const material = layer.material as any;
        material.opacity = 1;
        material.transparent = false;
        material.wireframe = false;
        material.clippingPlanes = [];
      }
    });

    this.updateAnimationState({
      isPlaying: false,
      currentFrame: 0,
      direction: 'forward'
    });
  }

  /**
   * Get current animation progress as percentage
   */
  getProgress(): number {
    const { currentFrame, totalFrames } = this.currentAnimationState;
    return totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;
  }

  /**
   * Set animation to specific frame
   */
  setFrame(frame: number): void {
    const clampedFrame = Math.max(0, Math.min(this.currentAnimationState.totalFrames - 1, frame));
    this.updateAnimationState({ currentFrame: clampedFrame });
    
    // Apply frame state immediately
    this.updateAnimationFrame();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.pauseAnimation();
    this.layers = [];
    this.originalPositions.clear();
  }
}