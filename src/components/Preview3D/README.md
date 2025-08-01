# Enhanced 3D Preview System

This document provides comprehensive documentation for the enhanced 3D preview system with advanced layer visualization controls and camera management.

## Overview

The enhanced 3D preview system provides a rich, interactive experience for viewing and manipulating bookmark geometry layers. It includes advanced camera controls, layer animations, performance optimization, and interactive features.

## Core Components

### 1. Enhanced LayerControls Component

The `LayerControls` component provides comprehensive layer management with a tabbed interface.

#### Features

- **Layer Visibility**: Individual layer show/hide controls with color indicators
- **Opacity Controls**: Per-layer opacity sliders with real-time preview
- **Batch Operations**: Show all, hide all, isolate layer, and bulk opacity controls
- **Solo Mode**: Isolate individual layers for focused viewing
- **Animation Controls**: Layer build sequence, exploded view, and rotation animations
- **Detailed Layer Information**: Triangle count, dimensions, height, and color values

#### Usage

```tsx
import { LayerControls } from './components/Preview3D/LayerControls';

const MyComponent = () => {
  const [visualizationState, setVisualizationState] = useState<LayerVisualizationState>({
    visibility: new Map(),
    opacity: new Map(),
    exploded: false,
    explodeDistance: 2.0,
    animationMode: 'off',
    animationSpeed: 1.0,
    soloLayer: null,
  });

  const [animationState, setAnimationState] = useState<AnimationState>({
    isPlaying: false,
    currentFrame: 0,
    totalFrames: 100,
    speed: 1.0,
    loop: true,
    direction: 'forward',
  });

  return (
    <LayerControls
      layers={geometry.layers}
      visualizationState={visualizationState}
      animationState={animationState}
      onVisibilityToggle={(layerId, visible) => {
        const newVisibility = new Map(visualizationState.visibility);
        newVisibility.set(layerId, visible);
        setVisualizationState(prev => ({ ...prev, visibility: newVisibility }));
      }}
      onOpacityChange={(layerId, opacity) => {
        const newOpacity = new Map(visualizationState.opacity);
        newOpacity.set(layerId, opacity);
        setVisualizationState(prev => ({ ...prev, opacity: newOpacity }));
      }}
      onSoloLayer={(layerId) => {
        setVisualizationState(prev => ({ ...prev, soloLayer: layerId }));
      }}
      onExplodedToggle={(exploded) => {
        setVisualizationState(prev => ({ ...prev, exploded }));
      }}
      onExplodeDistanceChange={(distance) => {
        setVisualizationState(prev => ({ ...prev, explodeDistance: distance }));
      }}
      onAnimationToggle={(playing) => {
        setAnimationState(prev => ({ ...prev, isPlaying: playing }));
      }}
      onAnimationSpeedChange={(speed) => {
        setAnimationState(prev => ({ ...prev, speed }));
      }}
      onAnimationModeChange={(mode) => {
        setVisualizationState(prev => ({ ...prev, animationMode: mode }));
      }}
    />
  );
};
```

### 2. CameraControls Component

The `CameraControls` component provides intuitive camera management with preset positions and smooth transitions.

#### Features

- **Camera Presets**: Front, back, top, bottom, left, right, and isometric views
- **Auto-fit**: Automatically frame geometry with optimal camera positioning
- **Saved Views**: Save and restore custom camera positions
- **Smooth Transitions**: Animated camera movements with configurable easing
- **Current View Info**: Display current camera preset and geometry information

#### Usage

```tsx
import { CameraControls } from './components/Preview3D/CameraControls';
import { CameraManager } from './modules/rendering/cameraManager';

const MyComponent = () => {
  const [cameraManager, setCameraManager] = useState<CameraManager | null>(null);

  // Initialize camera manager with Three.js camera and controls
  useEffect(() => {
    if (camera && controls) {
      const manager = new CameraManager(camera, controls);
      setCameraManager(manager);
      
      return () => manager.dispose();
    }
  }, [camera, controls]);

  return (
    <CameraControls
      cameraManager={cameraManager}
      geometry={bookmarkGeometry}
      onPresetChange={(preset) => {
        console.log(`Camera preset changed to: ${preset}`);
      }}
      onAutoFit={() => {
        console.log('Camera auto-fitted to geometry');
      }}
    />
  );
};
```

### 3. CameraManager Module

The `CameraManager` class provides programmatic camera control with advanced positioning algorithms.

#### Key Methods

```typescript
// Set camera to preset position
await cameraManager.setPreset('isometric', {
  duration: 1000,
  easing: 'easeInOut'
});

// Auto-fit camera to geometry bounds
await cameraManager.autoFitToGeometry(geometry, 1.2);

// Save current camera state
cameraManager.saveState('myView');

// Restore saved state
await cameraManager.restoreState('myView');

// Set zoom level with animation
await cameraManager.setZoom(2.0, 500);
```

### 4. LayerAnimationManager Module

The `LayerAnimationManager` handles complex layer animations and visualization modes.

#### Animation Modes

- **Build**: Sequential layer appearance with drop-in effect
- **Explode**: Animated layer separation and return
- **Rotate**: Continuous rotation around Y-axis

#### Usage

```typescript
import { LayerAnimationManager } from './modules/rendering/layerAnimationManager';

const animationManager = new LayerAnimationManager(
  initialAnimationState,
  initialVisualizationState,
  (state) => console.log('Animation state changed:', state)
);

// Set layer objects for animation
animationManager.setLayers(layerObjects);

// Update visualization state
animationManager.updateVisualizationState({
  animationMode: 'build',
  exploded: true,
  explodeDistance: 3.0
});

// Control animation playback
animationManager.updateAnimationState({
  isPlaying: true,
  speed: 1.5
});
```

### 5. InteractionManager Module

The `InteractionManager` enables layer clicking, hover effects, and keyboard shortcuts.

#### Features

- **Layer Selection**: Click to select layers with visual highlighting
- **Hover Effects**: Real-time layer highlighting on mouse hover
- **Tooltips**: Detailed layer information on hover
- **Keyboard Shortcuts**: Customizable shortcuts for common operations
- **Touch Support**: Mobile-friendly touch interactions

#### Default Keyboard Shortcuts

- `Escape`: Clear selection
- `Delete`: Hide selected layer
- `H`: Toggle selected layer visibility
- `S`: Solo selected layer
- `1-8`: Select layer by number

#### Usage

```typescript
import { InteractionManager } from './modules/rendering/interactionManager';

const interactionManager = new InteractionManager(
  canvas,
  camera,
  scene,
  {
    onLayerClick: (event) => {
      console.log(`Layer ${event.layerId} clicked at:`, event.position);
    },
    onLayerHover: (event) => {
      if (event) {
        console.log(`Hovering over layer ${event.layerId}`);
      } else {
        console.log('No layer hovered');
      }
    },
    onTooltipUpdate: (tooltip) => {
      if (tooltip) {
        console.log('Tooltip:', tooltip.content);
      }
    }
  }
);

// Set layer objects and data
interactionManager.setLayers(layerObjects, layerData);

// Add custom keyboard shortcut
interactionManager.addShortcut('Ctrl+A', () => {
  console.log('Select all layers');
});
```

### 6. PerformanceOptimizer Module

The `PerformanceOptimizer` ensures smooth 60fps rendering even with complex geometry.

#### Optimization Features

- **Level of Detail (LOD)**: Automatic geometry simplification based on distance
- **Frustum Culling**: Hide off-screen objects to reduce draw calls
- **Dynamic Quality Adjustment**: Automatically reduce quality when FPS drops
- **Memory Management**: Monitor and optimize GPU memory usage
- **Performance Metrics**: Real-time FPS, triangle count, and memory monitoring

#### Usage

```typescript
import { PerformanceOptimizer } from './modules/rendering/performanceOptimizer';

const optimizer = new PerformanceOptimizer(
  renderer,
  scene,
  camera,
  {
    targetFPS: 60,
    maxTriangles: 500000,
    memoryThreshold: 512, // MB
  }
);

// Set layers for optimization
optimizer.setLayers(layerObjects);

// Update each frame
function animate() {
  optimizer.updateFrame();
  
  // Get performance metrics
  const metrics = optimizer.getMetrics();
  console.log(`FPS: ${metrics.fps.toFixed(1)}, Triangles: ${metrics.triangleCount}`);
  
  // Get performance score (0-100)
  const score = optimizer.getPerformanceScore();
  
  requestAnimationFrame(animate);
}
```

## Advanced Visualization Modes

### Exploded View

Display layers separated vertically for better understanding of the bookmark structure.

```typescript
// Enable exploded view
visualizationState.exploded = true;
visualizationState.explodeDistance = 2.5; // mm separation

// Animate exploded view
animationManager.animateExplodedView(
  1.0, // progress (0-1)
  {
    direction: new THREE.Vector3(0, 1, 0), // Y-axis separation
    spacing: 2.5,
    maxDistance: 10
  }
);
```

### Cross-Section View

Show internal structure by cutting through layers at specific planes.

```typescript
// Create cutting plane
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// Apply cross-section
animationManager.applyCrossSection(plane, true); // showCap = true
```

### Animation Timeline

Create sequenced layer animations for presentations.

```typescript
// Create build sequence animation
await animationManager.createBuildSequence(
  3000, // duration in ms
  200   // stagger delay between layers
);
```

## Performance Considerations

### Recommended Limits

- **Maximum Triangles**: 500,000 per scene
- **Target FPS**: 60fps on desktop, 30fps on mobile
- **Memory Usage**: <512MB GPU memory
- **Layer Count**: <20 layers for optimal performance

### Optimization Tips

1. **Use LOD**: Enable level of detail for complex geometry
2. **Limit Animations**: Avoid multiple simultaneous animations
3. **Monitor Performance**: Use the performance optimizer metrics
4. **Optimize Materials**: Use simplified materials for distant objects
5. **Batch Operations**: Group similar operations together

### Performance Monitoring

```typescript
// Get real-time metrics
const metrics = optimizer.getMetrics();

console.log({
  fps: metrics.fps,
  triangles: metrics.triangleCount,
  drawCalls: metrics.drawCalls,
  memoryUsage: metrics.memoryUsage,
  gpuMemory: metrics.gpuMemory
});

// Get performance score
const score = optimizer.getPerformanceScore(); // 0-100
if (score < 70) {
  console.warn('Performance is degraded, consider optimizations');
}
```

## Accessibility Features

### Keyboard Navigation

The system is fully keyboard accessible:

- `Tab`: Navigate between controls
- `Space/Enter`: Activate buttons
- `Arrow Keys`: Adjust sliders
- Custom shortcuts: See InteractionManager documentation

### Screen Reader Support

- All controls have proper ARIA labels
- Layer information is announced on selection
- Animation states are communicated to assistive technology

### High Contrast Mode

The system respects system color preferences and provides high contrast options for better visibility.

## Browser Compatibility

### Minimum Requirements

- **WebGL 1.0**: Required for 3D rendering
- **ES2020**: Modern JavaScript features
- **FileReader API**: For geometry loading
- **Performance API**: For metrics collection

### Tested Browsers

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- iOS Safari 14+
- Chrome Android 90+

## Troubleshooting

### Common Issues

1. **Low FPS**: Enable performance optimization, reduce layer count, or simplify geometry
2. **Memory Issues**: Use LOD, reduce texture resolution, or limit visible layers
3. **WebGL Context Loss**: Implement context restoration in your application
4. **Mobile Performance**: Reduce target FPS to 30, enable aggressive optimizations

### Debug Mode

Enable debug mode for additional information:

```typescript
// Enable debug logging
localStorage.setItem('3d-preview-debug', 'true');

// This will log performance metrics, animation states, and interaction events
```

## API Reference

### Type Definitions

```typescript
interface LayerVisualizationState {
  visibility: Map<number, boolean>;
  opacity: Map<number, number>;
  exploded: boolean;
  explodeDistance: number;
  animationMode: 'off' | 'build' | 'explode' | 'rotate';
  animationSpeed: number;
  soloLayer: number | null;
}

interface AnimationState {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  speed: number;
  loop: boolean;
  direction: 'forward' | 'reverse';
}

interface CameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  zoom: number;
  up?: THREE.Vector3;
}

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  gpuMemory: number;
  triangleCount: number;
  drawCalls: number;
  fps: number;
  frameTime: number;
}
```

### Event Callbacks

```typescript
interface LayerControlsCallbacks {
  onVisibilityToggle: (layerId: number, visible: boolean) => void;
  onOpacityChange: (layerId: number, opacity: number) => void;
  onSoloLayer: (layerId: number | null) => void;
  onExplodedToggle: (exploded: boolean) => void;
  onExplodeDistanceChange: (distance: number) => void;
  onAnimationToggle: (playing: boolean) => void;
  onAnimationSpeedChange: (speed: number) => void;
  onAnimationModeChange: (mode: 'off' | 'build' | 'explode' | 'rotate') => void;
}

interface InteractionCallbacks {
  onLayerClick?: (event: LayerInteractionEvent) => void;
  onLayerHover?: (event: LayerInteractionEvent | null) => void;
  onLayerFocus?: (event: LayerInteractionEvent) => void;
  onTooltipUpdate?: (tooltip: TooltipInfo | null) => void;
}
```

## Examples

### Complete Integration Example

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { LayerControls } from './components/Preview3D/LayerControls';
import { CameraControls } from './components/Preview3D/CameraControls';
import { CameraManager } from './modules/rendering/cameraManager';
import { LayerAnimationManager } from './modules/rendering/layerAnimationManager';
import { InteractionManager } from './modules/rendering/interactionManager';
import { PerformanceOptimizer } from './modules/rendering/performanceOptimizer';

const EnhancedPreview3D = ({ geometry }) => {
  const [visualizationState, setVisualizationState] = useState<LayerVisualizationState>({
    visibility: new Map(),
    opacity: new Map(),
    exploded: false,
    explodeDistance: 2.0,
    animationMode: 'off',
    animationSpeed: 1.0,
    soloLayer: null,
  });

  const [animationState, setAnimationState] = useState<AnimationState>({
    isPlaying: false,
    currentFrame: 0,
    totalFrames: 100,
    speed: 1.0,
    loop: true,
    direction: 'forward',
  });

  const [cameraManager, setCameraManager] = useState<CameraManager | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationManagerRef = useRef<LayerAnimationManager | null>(null);
  const interactionManagerRef = useRef<InteractionManager | null>(null);
  const optimizerRef = useRef<PerformanceOptimizer | null>(null);

  // Initialize managers
  useEffect(() => {
    if (canvasRef.current && geometry) {
      // Initialize animation manager
      animationManagerRef.current = new LayerAnimationManager(
        animationState,
        visualizationState,
        setAnimationState
      );

      // Initialize interaction manager
      interactionManagerRef.current = new InteractionManager(
        canvasRef.current,
        camera,
        scene,
        {
          onLayerClick: (event) => {
            console.log(`Layer ${event.layerId} clicked`);
          },
          onLayerHover: (event) => {
            // Handle hover events
          }
        }
      );

      return () => {
        animationManagerRef.current?.dispose();
        interactionManagerRef.current?.dispose();
        optimizerRef.current?.dispose();
      };
    }
  }, [geometry]);

  return (
    <div className="flex space-x-4">
      {/* 3D Canvas */}
      <div className="flex-1">
        <Canvas
          ref={canvasRef}
          camera={{ position: [5, 5, 5], fov: 75 }}
          shadows
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
          
          {/* Render bookmark layers */}
          {geometry?.layers.map((layer, index) => (
            <LayerMesh
              key={index}
              layer={layer}
              visible={visualizationState.visibility.get(index) !== false}
              opacity={visualizationState.opacity.get(index) || 1}
            />
          ))}
          
          <OrbitControls
            ref={(controls) => {
              if (controls && !cameraManager) {
                const manager = new CameraManager(controls.object, controls);
                setCameraManager(manager);
              }
            }}
          />
        </Canvas>
      </div>

      {/* Control Panels */}
      <div className="w-80 space-y-4">
        <CameraControls
          cameraManager={cameraManager}
          geometry={geometry}
        />
        
        <LayerControls
          layers={geometry?.layers || []}
          visualizationState={visualizationState}
          animationState={animationState}
          onVisibilityToggle={(layerId, visible) => {
            const newVisibility = new Map(visualizationState.visibility);
            newVisibility.set(layerId, visible);
            setVisualizationState(prev => ({ ...prev, visibility: newVisibility }));
          }}
          onOpacityChange={(layerId, opacity) => {
            const newOpacity = new Map(visualizationState.opacity);
            newOpacity.set(layerId, opacity);
            setVisualizationState(prev => ({ ...prev, opacity: newOpacity }));
          }}
          // ... other handlers
        />

        {/* Performance Metrics Display */}
        {performanceMetrics && (
          <div className="bg-gray-100 p-3 rounded-lg text-sm">
            <h4 className="font-semibold mb-2">Performance</h4>
            <div>FPS: {performanceMetrics.fps.toFixed(1)}</div>
            <div>Triangles: {performanceMetrics.triangleCount.toLocaleString()}</div>
            <div>Memory: {performanceMetrics.memoryUsage.toFixed(1)}MB</div>
          </div>
        )}
      </div>
    </div>
  );
};
```

This enhanced 3D preview system provides a comprehensive solution for interactive bookmark visualization with professional-grade features and performance optimization.