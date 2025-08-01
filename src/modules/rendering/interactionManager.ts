/**
 * InteractionManager - Handles layer interactions, tooltips, and keyboard shortcuts
 */

import * as THREE from 'three';
import type { 
  LayerInteractionEvent, 
  TooltipInfo, 
  GeometryLayer 
} from '../../types/geometry';

interface InteractionCallbacks {
  onLayerClick?: (event: LayerInteractionEvent) => void;
  onLayerHover?: (event: LayerInteractionEvent | null) => void;
  onLayerFocus?: (event: LayerInteractionEvent) => void;
  onTooltipUpdate?: (tooltip: TooltipInfo | null) => void;
}

interface KeyboardShortcuts {
  [key: string]: () => void;
}

export class InteractionManager {
  private canvas: HTMLCanvasElement;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private layers: THREE.Object3D[] = [];
  private layerData: GeometryLayer[] = [];
  private callbacks: InteractionCallbacks = {};
  private shortcuts: KeyboardShortcuts = {};
  private hoveredLayer: number | null = null;
  private selectedLayer: number | null = null;
  private tooltipElement: HTMLElement | null = null;
  private isEnabled: boolean = true;

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    scene: THREE.Scene,
    callbacks: InteractionCallbacks = {}
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.scene = scene;
    this.callbacks = callbacks;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.createTooltipElement();
  }

  /**
   * Set layer objects and data for interaction
   */
  setLayers(layers: THREE.Object3D[], layerData: GeometryLayer[]): void {
    this.layers = layers;
    this.layerData = layerData;
    
    // Add userData to layer objects for identification
    layers.forEach((layer, index) => {
      layer.userData.layerId = index;
      layer.userData.layerData = layerData[index];
    });
  }

  /**
   * Update interaction callbacks
   */
  setCallbacks(callbacks: Partial<InteractionCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Setup mouse and touch event listeners
   */
  private setupEventListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

    // Touch events for mobile support
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

    // Prevent context menu on right click
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Default shortcuts
    this.shortcuts = {
      'Escape': () => this.clearSelection(),
      'Delete': () => this.hideSelectedLayer(),
      'h': () => this.toggleSelectedLayerVisibility(),
      's': () => this.soloSelectedLayer(),
      '1': () => this.selectLayer(0),
      '2': () => this.selectLayer(1),
      '3': () => this.selectLayer(2),
      '4': () => this.selectLayer(3),
      '5': () => this.selectLayer(4),
      '6': () => this.selectLayer(5),
      '7': () => this.selectLayer(6),
      '8': () => this.selectLayer(7),
    };
  }

  /**
   * Create tooltip DOM element
   */
  private createTooltipElement(): void {
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'layer-tooltip';
    this.tooltipElement.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
      max-width: 200px;
      transform: translate(-50%, -100%);
      margin-top: -10px;
      opacity: 0;
      transition: opacity 0.2s ease;
      white-space: nowrap;
    `;
    document.body.appendChild(this.tooltipElement);
  }

  /**
   * Handle mouse move events
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isEnabled) return;

    this.updateMousePosition(event.clientX, event.clientY);
    const intersection = this.getIntersection();

    if (intersection) {
      const layerId = intersection.object.userData.layerId;
      
      if (this.hoveredLayer !== layerId) {
        this.setHoveredLayer(layerId, intersection);
      }
      
      this.updateTooltip(event.clientX, event.clientY, layerId);
    } else {
      this.clearHover();
    }
  }

  /**
   * Handle click events
   */
  private handleClick(event: MouseEvent): void {
    if (!this.isEnabled) return;

    this.updateMousePosition(event.clientX, event.clientY);
    const intersection = this.getIntersection();

    if (intersection) {
      const layerId = intersection.object.userData.layerId;
      this.selectLayer(layerId);
      
      const interactionEvent: LayerInteractionEvent = {
        layerId,
        event: 'click',
        position: intersection.point,
        normal: intersection.face?.normal || new THREE.Vector3(),
        uv: intersection.uv
      };
      
      this.callbacks.onLayerClick?.(interactionEvent);
    } else {
      this.clearSelection();
    }
  }

  /**
   * Handle mouse leave events
   */
  private handleMouseLeave(): void {
    this.clearHover();
  }

  /**
   * Handle touch events
   */
  private handleTouchStart(event: TouchEvent): void {
    if (!this.isEnabled || event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    this.updateMousePosition(touch.clientX, touch.clientY);
  }

  private handleTouchMove(event: TouchEvent): void {
    if (!this.isEnabled || event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    this.updateMousePosition(touch.clientX, touch.clientY);
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (!this.isEnabled) return;
    
    // Treat touch end as click
    const intersection = this.getIntersection();
    if (intersection) {
      const layerId = intersection.object.userData.layerId;
      this.selectLayer(layerId);
      
      const interactionEvent: LayerInteractionEvent = {
        layerId,
        event: 'click',
        position: intersection.point,
        normal: intersection.face?.normal || new THREE.Vector3()
      };
      
      this.callbacks.onLayerClick?.(interactionEvent);
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) return;
    
    // Ignore if user is typing in an input
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const key = event.ctrlKey ? `Ctrl+${event.key}` : event.key;
    const shortcut = this.shortcuts[key];
    
    if (shortcut) {
      event.preventDefault();
      shortcut();
    }
  }

  /**
   * Update mouse position for raycasting
   */
  private updateMousePosition(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Get intersection with layer objects
   */
  private getIntersection(): THREE.Intersection | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersections = this.raycaster.intersectObjects(this.layers, false);
    
    // Return the closest visible intersection
    for (const intersection of intersections) {
      if (intersection.object.visible) {
        return intersection;
      }
    }
    
    return null;
  }

  /**
   * Set hovered layer
   */
  private setHoveredLayer(layerId: number, intersection: THREE.Intersection): void {
    // Clear previous hover
    if (this.hoveredLayer !== null) {
      this.highlightLayer(this.hoveredLayer, false);
    }
    
    this.hoveredLayer = layerId;
    this.highlightLayer(layerId, true);
    
    const interactionEvent: LayerInteractionEvent = {
      layerId,
      event: 'hover',
      position: intersection.point,
      normal: intersection.face?.normal || new THREE.Vector3(),
      uv: intersection.uv
    };
    
    this.callbacks.onLayerHover?.(interactionEvent);
  }

  /**
   * Clear hover state
   */
  private clearHover(): void {
    if (this.hoveredLayer !== null) {
      this.highlightLayer(this.hoveredLayer, false);
      this.hoveredLayer = null;
    }
    
    this.hideTooltip();
    this.callbacks.onLayerHover?.(null);
  }

  /**
   * Select a layer
   */
  private selectLayer(layerId: number): void {
    if (layerId < 0 || layerId >= this.layers.length) return;
    
    // Clear previous selection
    if (this.selectedLayer !== null) {
      this.highlightLayer(this.selectedLayer, false, 'selection');
    }
    
    this.selectedLayer = layerId;
    this.highlightLayer(layerId, true, 'selection');
  }

  /**
   * Clear selection
   */
  private clearSelection(): void {
    if (this.selectedLayer !== null) {
      this.highlightLayer(this.selectedLayer, false, 'selection');
      this.selectedLayer = null;
    }
  }

  /**
   * Highlight layer with different styles
   */
  private highlightLayer(
    layerId: number, 
    highlight: boolean, 
    type: 'hover' | 'selection' = 'hover'
  ): void {
    const layer = this.layers[layerId];
    if (!layer || !(layer instanceof THREE.Mesh)) return;
    
    const material = layer.material as THREE.MeshStandardMaterial;
    
    if (highlight) {
      // Store original emissive for restoration
      if (!layer.userData.originalEmissive) {
        layer.userData.originalEmissive = material.emissive.clone();
        layer.userData.originalEmissiveIntensity = material.emissiveIntensity;
      }
      
      // Apply highlight
      if (type === 'hover') {
        material.emissive.setHex(0x404040);
        material.emissiveIntensity = 0.2;
      } else if (type === 'selection') {
        material.emissive.setHex(0x0066ff);
        material.emissiveIntensity = 0.3;
      }
    } else {
      // Restore original emissive
      if (layer.userData.originalEmissive) {
        material.emissive.copy(layer.userData.originalEmissive);
        material.emissiveIntensity = layer.userData.originalEmissiveIntensity || 0;
      }
    }
  }

  /**
   * Update tooltip content and position
   */
  private updateTooltip(clientX: number, clientY: number, layerId: number): void {
    if (!this.tooltipElement || layerId >= this.layerData.length) return;
    
    const layerData = this.layerData[layerId];
    const layer = this.layers[layerId];
    
    // Calculate dimensions if available
    let dimensions = 'Unknown';
    if (layerData.dimensions) {
      dimensions = `${layerData.dimensions.width.toFixed(1)}×${layerData.dimensions.height.toFixed(1)}×${layerData.dimensions.depth.toFixed(1)}mm`;
    }
    
    const tooltipInfo: TooltipInfo = {
      layerId,
      position: [clientX, clientY],
      content: {
        name: `Layer ${layerId + 1}`,
        color: layerData.color.hex,
        triangles: layerData.triangleCount,
        dimensions,
        height: `${layerData.height.toFixed(2)}mm`
      }
    };
    
    // Update tooltip content
    this.tooltipElement.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">${tooltipInfo.content.name}</div>
      <div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="width: 12px; height: 12px; background: ${tooltipInfo.content.color}; border-radius: 2px; margin-right: 6px;"></div>
        <span>${tooltipInfo.content.color}</span>
      </div>
      <div style="margin-bottom: 2px;">Triangles: ${tooltipInfo.content.triangles.toLocaleString()}</div>
      <div style="margin-bottom: 2px;">Height: ${tooltipInfo.content.height}</div>
      <div>Size: ${tooltipInfo.content.dimensions}</div>
    `;
    
    // Position tooltip
    this.tooltipElement.style.left = `${clientX}px`;
    this.tooltipElement.style.top = `${clientY}px`;
    this.tooltipElement.style.opacity = '1';
    
    this.callbacks.onTooltipUpdate?.(tooltipInfo);
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.style.opacity = '0';
    }
    this.callbacks.onTooltipUpdate?.(null);
  }

  /**
   * Keyboard shortcut actions
   */
  private hideSelectedLayer(): void {
    if (this.selectedLayer !== null) {
      this.layers[this.selectedLayer].visible = false;
    }
  }

  private toggleSelectedLayerVisibility(): void {
    if (this.selectedLayer !== null) {
      const layer = this.layers[this.selectedLayer];
      layer.visible = !layer.visible;
    }
  }

  private soloSelectedLayer(): void {
    if (this.selectedLayer !== null) {
      this.layers.forEach((layer, index) => {
        layer.visible = index === this.selectedLayer;
      });
    }
  }

  /**
   * Add custom keyboard shortcut
   */
  addShortcut(key: string, action: () => void): void {
    this.shortcuts[key] = action;
  }

  /**
   * Remove keyboard shortcut
   */
  removeShortcut(key: string): void {
    delete this.shortcuts[key];
  }

  /**
   * Enable/disable interactions
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearHover();
      this.clearSelection();
    }
  }

  /**
   * Get currently selected layer
   */
  getSelectedLayer(): number | null {
    return this.selectedLayer;
  }

  /**
   * Get currently hovered layer
   */
  getHoveredLayer(): number | null {
    return this.hoveredLayer;
  }

  /**
   * Focus on specific layer (programmatic selection)
   */
  focusLayer(layerId: number): void {
    if (layerId >= 0 && layerId < this.layers.length) {
      this.selectLayer(layerId);
      
      const layer = this.layers[layerId];
      const boundingBox = new THREE.Box3().setFromObject(layer);
      const center = boundingBox.getCenter(new THREE.Vector3());
      
      const interactionEvent: LayerInteractionEvent = {
        layerId,
        event: 'focus',
        position: center,
        normal: new THREE.Vector3(0, 1, 0)
      };
      
      this.callbacks.onLayerFocus?.(interactionEvent);
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Remove event listeners
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Remove tooltip element
    if (this.tooltipElement && this.tooltipElement.parentNode) {
      this.tooltipElement.parentNode.removeChild(this.tooltipElement);
      this.tooltipElement = null;
    }
    
    // Clear references
    this.layers = [];
    this.layerData = [];
    this.callbacks = {};
    this.shortcuts = {};
  }
}