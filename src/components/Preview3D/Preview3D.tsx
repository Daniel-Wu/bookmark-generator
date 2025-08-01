import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { Preview3DProps } from '../../types';
// import { usePreview3D } from '../../hooks/usePreview3D';
// import { RENDER_MODES } from '../../constants/rendering';
import { BookmarkMesh } from './BookmarkMesh';
import { RenderModeControls } from './RenderModeControls';
// import { LayerControls } from './LayerControls';
import { PerformanceStats } from './PerformanceStats';

interface Preview3DState {
  renderMode: 'solid' | 'wireframe' | 'x-ray';
  showStats: boolean;
  showGrid: boolean;
  layerVisibility: Map<number, boolean>;
}

export const Preview3D: React.FC<Preview3DProps> = ({
  geometry,
  parameters,
  onCameraChange,
  className = '',
}) => {
  const [state, setState] = useState<Preview3DState>({
    renderMode: 'solid',
    showStats: false,
    showGrid: true,
    layerVisibility: new Map(),
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, _setIsLoading] = useState(false);

  // Initialize layer visibility when geometry changes
  useEffect(() => {
    if (geometry?.layers) {
      const newVisibility = new Map<number, boolean>();
      geometry.layers.forEach((layer, index) => {
        newVisibility.set(index, layer.visible ?? true);
      });
      setState(prev => ({ ...prev, layerVisibility: newVisibility }));
    }
  }, [geometry]);

  const handleRenderModeChange = useCallback((mode: 'solid' | 'wireframe' | 'x-ray') => {
    setState(prev => ({ ...prev, renderMode: mode }));
  }, []);

  const handleLayerVisibilityToggle = useCallback((layerId: number, visible: boolean) => {
    setState(prev => ({
      ...prev,
      layerVisibility: new Map(prev.layerVisibility.set(layerId, visible)),
    }));
  }, []);

  const handleToggleStats = useCallback(() => {
    setState(prev => ({ ...prev, showStats: !prev.showStats }));
  }, []);

  const handleToggleGrid = useCallback(() => {
    setState(prev => ({ ...prev, showGrid: !prev.showGrid }));
  }, []);

  const handleResetCamera = useCallback(() => {
    // Camera reset will be handled by the OrbitControls reset function
    setError(null);
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err.message);
    console.error('Preview3D Error:', err);
  }, []);

  const handleCanvasError = useCallback((event: any) => {
    const error = event.error || event;
    setError(error.message || 'Canvas error occurred');
    console.error('Canvas Error:', error);
  }, []);

  const handleCameraChange = useCallback((position: THREE.Vector3) => {
    onCameraChange?.(position);
  }, [onCameraChange]);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">3D Preview</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleStats}
              className={`p-2 rounded text-sm font-medium transition-colors ${
                state.showStats
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Toggle performance stats"
            >
              Stats
            </button>
            <button
              onClick={handleToggleGrid}
              className={`p-2 rounded text-sm font-medium transition-colors ${
                state.showGrid
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Toggle grid"
            >
              Grid
            </button>
            <button
              onClick={handleResetCamera}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded text-sm font-medium transition-colors"
              title="Reset camera"
            >
              Reset View
            </button>
          </div>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="relative aspect-[4/3] bg-gray-100">
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded z-10">
            <p className="text-sm font-medium">Rendering Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {geometry ? (
          <Canvas
            camera={{
              position: [5, 5, 5],
              fov: 75,
              near: 0.1,
              far: 1000,
            }}
            shadows
            className="w-full h-full"
            onError={handleCanvasError}
          >
            <Suspense fallback={null}>
              {/* Lighting */}
              <ambientLight intensity={0.6} />
              <directionalLight
                position={[10, 10, 5]}
                intensity={0.8}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-far={50}
                shadow-camera-left={-10}
                shadow-camera-right={10}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
              />

              {/* Environment */}
              <Environment preset="studio" />

              {/* Grid */}
              {state.showGrid && (
                <Grid
                  position={[0, -0.5, 0]}
                  args={[20, 20]}
                  cellSize={1}
                  cellThickness={0.5}
                  cellColor="#cccccc"
                  sectionSize={5}
                  sectionThickness={1}
                  sectionColor="#999999"
                  fadeDistance={30}
                  fadeStrength={1}
                />
              )}

              {/* Bookmark Mesh */}
              <BookmarkMesh
                geometry={geometry}
                renderMode={state.renderMode}
                layerVisibility={state.layerVisibility}
                onError={handleError}
              />

              {/* Controls */}
              <OrbitControls
                enableDamping
                dampingFactor={0.05}
                minDistance={1}
                maxDistance={100}
                enablePan
                enableZoom
                enableRotate
                onChange={(event) => {
                  if (event?.target?.object?.position) {
                    handleCameraChange(event.target.object.position);
                  }
                }}
              />

              {/* Performance Stats */}
              {state.showStats && <Stats />}
            </Suspense>
          </Canvas>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-6xl text-gray-400">📦</div>
              <p className="text-gray-500">Upload an image to see 3D preview</p>
              <p className="text-sm text-gray-400">
                Supports PNG, JPG, GIF, and WebP formats
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-600">Generating 3D preview...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls Panel */}
      <div className="p-4 border-t border-gray-200 space-y-4">
        {/* Render Mode Controls */}
        <RenderModeControls
          currentMode={state.renderMode}
          onModeChange={handleRenderModeChange}
        />

        {/* Layer Controls */}
        {geometry && geometry.layers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Layer Visibility</h4>
            {geometry.layers.map((layer, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={state.layerVisibility.get(index) ?? true}
                  onChange={(e) => handleLayerVisibilityToggle(index, e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  Layer {index + 1} (Height: {layer.height.toFixed(2)}mm)
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Performance Stats */}
        {geometry && (
          <PerformanceStats
            geometry={geometry}
            parameters={parameters}
            layerVisibility={state.layerVisibility}
          />
        )}
      </div>
    </div>
  );
};
