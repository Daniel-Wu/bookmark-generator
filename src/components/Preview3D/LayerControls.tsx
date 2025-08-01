import React, { useState, useCallback, useMemo } from 'react';
import type { BookmarkGeometry } from '../../types';
import type { 
  LayerVisualizationState, 
  AnimationState 
} from '../../types/geometry';

interface LayerControlsProps {
  layers: BookmarkGeometry['layers'];
  visualizationState: LayerVisualizationState;
  animationState: AnimationState;
  onVisibilityToggle: (layerId: number, visible: boolean) => void;
  onOpacityChange: (layerId: number, opacity: number) => void;
  onSoloLayer: (layerId: number | null) => void;
  onExplodedToggle: (exploded: boolean) => void;
  onExplodeDistanceChange: (distance: number) => void;
  onAnimationToggle: (playing: boolean) => void;
  onAnimationSpeedChange: (speed: number) => void;
  onAnimationModeChange: (mode: 'off' | 'build' | 'explode' | 'rotate') => void;
  className?: string;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  layers,
  visualizationState,
  animationState,
  onVisibilityToggle,
  onOpacityChange,
  onSoloLayer,
  onExplodedToggle,
  onExplodeDistanceChange,
  onAnimationToggle,
  onAnimationSpeedChange,
  onAnimationModeChange,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'animation' | 'effects'>('layers');
  const [expandedLayer, setExpandedLayer] = useState<number | null>(null);

  // Batch operations
  const handleToggleAll = useCallback((visible: boolean) => {
    layers.forEach((_, index) => {
      onVisibilityToggle(index, visible);
    });
  }, [layers, onVisibilityToggle]);

  const handleSetAllOpacity = useCallback((opacity: number) => {
    layers.forEach((_, index) => {
      onOpacityChange(index, opacity);
    });
  }, [layers, onOpacityChange]);

  const handleIsolateLayer = useCallback((layerId: number) => {
    // Hide all other layers, show only the selected one
    layers.forEach((_, index) => {
      onVisibilityToggle(index, index === layerId);
    });
  }, [layers, onVisibilityToggle]);

  // Calculate statistics
  const layerStats = useMemo(() => {
    const visible = layers.filter((_, index) => 
      visualizationState.visibility.get(index) !== false
    ).length;
    const totalTriangles = layers
      .filter((_, index) => visualizationState.visibility.get(index) !== false)
      .reduce((sum, layer) => sum + layer.triangleCount, 0);
    
    return { visible, total: layers.length, totalTriangles };
  }, [layers, visualizationState.visibility]);

  const renderLayerItem = (layer: any, index: number) => {
    const isVisible = visualizationState.visibility.get(index) !== false;
    const opacity = visualizationState.opacity.get(index) || 1;
    const isSolo = visualizationState.soloLayer === index;
    const isExpanded = expandedLayer === index;
    
    const colorHex = `#${Math.round(layer.color.r).toString(16).padStart(2, '0')}${Math.round(layer.color.g).toString(16).padStart(2, '0')}${Math.round(layer.color.b).toString(16).padStart(2, '0')}`;
    
    return (
      <div key={index} className="border rounded-lg overflow-hidden">
        {/* Layer Header */}
        <div className={`p-3 transition-colors ${
          isVisible ? 'bg-white' : 'bg-gray-50'
        } ${isSolo ? 'ring-2 ring-blue-500' : ''}`}>
          <div className="flex items-center space-x-3">
            {/* Visibility Toggle */}
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => onVisibilityToggle(index, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            
            {/* Color Indicator */}
            <div
              className="w-5 h-5 rounded border-2 border-white shadow-sm flex-shrink-0"
              style={{ backgroundColor: colorHex }}
              title={`Layer ${index + 1}: ${colorHex}`}
            />
            
            {/* Layer Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 truncate">
                  Layer {index + 1}
                  {isSolo && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">SOLO</span>}
                </p>
                <button
                  onClick={() => setExpandedLayer(isExpanded ? null : index)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} layer details`}
                >
                  <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                <span>{layer.triangleCount?.toLocaleString() || 0} triangles</span>
                <span>Height: {layer.height.toFixed(2)}mm</span>
                {layer.dimensions && (
                  <span>{layer.dimensions.width.toFixed(1)}×{layer.dimensions.height.toFixed(1)}mm</span>
                )}
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onSoloLayer(isSolo ? null : index)}
                className={`p-1.5 rounded text-xs font-medium transition-colors ${
                  isSolo 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title={isSolo ? 'Exit solo mode' : 'Solo this layer'}
              >
                Solo
              </button>
              <button
                onClick={() => handleIsolateLayer(index)}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded text-xs font-medium transition-colors"
                title="Isolate this layer"
              >
                Isolate
              </button>
            </div>
          </div>
          
          {/* Opacity Slider */}
          <div className="mt-3">
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-600 min-w-0 flex-shrink-0">Opacity:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={opacity}
                onChange={(e) => onOpacityChange(index, parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                disabled={!isVisible}
              />
              <span className="text-xs text-gray-600 min-w-0 flex-shrink-0">
                {Math.round(opacity * 100)}%
              </span>
            </div>
          </div>
        </div>
        
        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-3 pb-3 bg-gray-50 space-y-3">
            {/* Detailed Statistics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Triangles:</span>
                <span className="ml-1 font-medium">{layer.triangleCount?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-600">Height:</span>
                <span className="ml-1 font-medium">{layer.height.toFixed(2)}mm</span>
              </div>
              {layer.dimensions && (
                <>
                  <div>
                    <span className="text-gray-600">Width:</span>
                    <span className="ml-1 font-medium">{layer.dimensions.width.toFixed(1)}mm</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Depth:</span>
                    <span className="ml-1 font-medium">{layer.dimensions.depth.toFixed(1)}mm</span>
                  </div>
                </>
              )}
            </div>
            
            {/* Color Information */}
            <div className="space-y-1 text-xs">
              <div className="text-gray-600">Color Values:</div>
              <div className="font-mono text-gray-800">
                RGB({Math.round(layer.color.r)}, {Math.round(layer.color.g)}, {Math.round(layer.color.b)})
              </div>
              <div className="font-mono text-gray-800">{colorHex.toUpperCase()}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAnimationControls = () => (
    <div className="space-y-4">
      {/* Animation Mode Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Animation Mode
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { mode: 'off', label: 'Off', description: 'No animation' },
            { mode: 'build', label: 'Build', description: 'Layer by layer assembly' },
            { mode: 'explode', label: 'Explode', description: 'Separate layers' },
            { mode: 'rotate', label: 'Rotate', description: 'Continuous rotation' }
          ].map(({ mode, label, description }) => (
            <button
              key={mode}
              onClick={() => onAnimationModeChange(mode as any)}
              className={`p-3 text-left rounded-lg border transition-colors ${
                visualizationState.animationMode === mode
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <div className="font-medium text-sm">{label}</div>
              <div className="text-xs text-gray-500 mt-1">{description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Animation Controls */}
      {visualizationState.animationMode !== 'off' && (
        <div className="space-y-3">
          {/* Play/Pause Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onAnimationToggle(!animationState.isPlaying)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                animationState.isPlaying
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {animationState.isPlaying ? 'Pause' : 'Play'}
            </button>
            
            {/* Progress Bar */}
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                style={{ 
                  width: `${(animationState.currentFrame / animationState.totalFrames) * 100}%`
                }}
              />
            </div>
            
            <span className="text-sm text-gray-600 min-w-0 flex-shrink-0">
              {animationState.currentFrame}/{animationState.totalFrames}
            </span>
          </div>

          {/* Speed Control */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-600">Speed</label>
              <span className="text-sm text-gray-900">{animationState.speed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={animationState.speed}
              onChange={(e) => onAnimationSpeedChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderEffectsControls = () => (
    <div className="space-y-4">
      {/* Exploded View */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Exploded View
          </label>
          <input
            type="checkbox"
            checked={visualizationState.exploded}
            onChange={(e) => onExplodedToggle(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
        
        {visualizationState.exploded && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">Separation</span>
              <span className="text-sm text-gray-900">{visualizationState.explodeDistance.toFixed(1)}mm</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={visualizationState.explodeDistance}
              onChange={(e) => onExplodeDistanceChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Batch Operations */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Batch Operations</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleToggleAll(true)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Show All
          </button>
          <button
            onClick={() => handleToggleAll(false)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Hide All
          </button>
          <button
            onClick={() => handleSetAllOpacity(1)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Full Opacity
          </button>
          <button
            onClick={() => handleSetAllOpacity(0.5)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            50% Opacity
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header with Stats */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Layer Controls</h3>
          <div className="text-sm text-gray-600">
            {layerStats.visible}/{layerStats.total} visible
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {layerStats.totalTriangles.toLocaleString()} triangles rendered
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'layers', label: 'Layers', count: layers.length },
          { id: 'animation', label: 'Animation' },
          { id: 'effects', label: 'Effects' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-200'
            }`}
          >
            {tab.label}
            {tab.count && (
              <span className="ml-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'layers' && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {layers.map(renderLayerItem)}
          </div>
        )}
        
        {activeTab === 'animation' && renderAnimationControls()}
        
        {activeTab === 'effects' && renderEffectsControls()}
      </div>
    </div>
  );
};
    