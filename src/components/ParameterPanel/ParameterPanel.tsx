import React from 'react';
import type { ParameterPanelProps, BookmarkParameters, QuantizedImageData } from '../../types';

// Import new components
import ColorCountSelection from './ColorCountSelection';
import ColorPalette from './ColorPalette';
import DimensionControls from './DimensionControls';
import PresetManager from './PresetManager';

// Import enhanced slider components
import { 
  LayerThicknessSlider, 
  BaseThicknessSlider, 
  CornerRadiusSlider 
} from '../common';

// Import performance hooks
import { 
  useParametersMemo, 
  useOptimizedCallback, 
  useRenderPerformance 
} from '../../hooks/usePerformanceOptimization';
import { useSmartParameters } from '../../hooks/useDebouncedParameters';

// ========================
// Enhanced Parameter Panel Props
// ========================

export interface EnhancedParameterPanelProps extends ParameterPanelProps {
  quantizedData?: QuantizedImageData | null;
  onColorClick?: (colorIndex: number, color: any) => void;
}

// ========================
// Enhanced Parameter Panel Component
// ========================

export const ParameterPanel: React.FC<EnhancedParameterPanelProps> = ({
  parameters,
  onChange,
  disabled = false,
  className = '',
  quantizedData = null,
  onColorClick,
}) => {
  // Performance optimizations
  const memoizedParameters = useParametersMemo(parameters);
  
  // Debounced parameter updates for performance
  const { 
    parameters: currentParameters, 
    setParameters,
    updateParameter 
  } = useSmartParameters(memoizedParameters, {
    onUIChange: onChange,
    onProcessingChange: onChange,
    onGeometryChange: onChange,
  });

  // Render performance monitoring
  useRenderPerformance('ParameterPanel');

  // Optimized change handlers
  const handleParameterChange = useOptimizedCallback(
    (key: keyof BookmarkParameters, value: number) => {
      updateParameter(key, value);
    },
    [updateParameter],
    'ParameterPanel.handleParameterChange'
  );

  const handleDimensionChange = useOptimizedCallback(
    (dimensions: { width: number; height: number }) => {
      setParameters({
        ...currentParameters,
        ...dimensions,
      });
    },
    [currentParameters, setParameters],
    'ParameterPanel.handleDimensionChange'
  );

  const handleColorCountChange = useOptimizedCallback(
    (colorCount: number) => {
      updateParameter('colorCount', colorCount);
    },
    [updateParameter],
    'ParameterPanel.handleColorCountChange'
  );

  const handlePresetLoad = useOptimizedCallback(
    (presetParameters: BookmarkParameters) => {
      setParameters(presetParameters);
    },
    [setParameters],
    'ParameterPanel.handlePresetLoad'
  );

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-semibold text-gray-900">Parameters</h2>
        <p className="text-sm text-gray-600 mt-1">
          Adjust settings to customize your 3D bookmark
        </p>
      </div>

      {/* Color Palette Preview (if quantized data available) */}
      {quantizedData && (
        <section>
          <ColorPalette
            quantizedData={quantizedData}
            parameters={currentParameters}
            onColorClick={onColorClick}
          />
        </section>
      )}

      {/* Color Count Selection */}
      <section>
        <ColorCountSelection
          value={currentParameters.colorCount}
          onChange={handleColorCountChange}
          disabled={disabled}
        />
      </section>

      {/* Dimension Controls */}
      <section>
        <DimensionControls
          width={currentParameters.width}
          height={currentParameters.height}
          onChange={handleDimensionChange}
          disabled={disabled}
        />
      </section>

      {/* Layer Settings */}
      <section className="space-y-6">
        <h3 className="text-lg font-medium text-gray-800">Layer Settings</h3>
        
        {/* Layer Thickness */}
        <LayerThicknessSlider
          value={currentParameters.layerThickness}
          onChange={(value) => handleParameterChange('layerThickness', value)}
          disabled={disabled}
          debounceMs={300}
          ariaLabel="Layer thickness control"
          ariaDescription="Adjust the thickness of each printed layer"
        />

        {/* Base Thickness */}
        <BaseThicknessSlider
          value={currentParameters.baseThickness}
          onChange={(value) => handleParameterChange('baseThickness', value)}
          disabled={disabled}
          debounceMs={300}
          ariaLabel="Base thickness control"
          ariaDescription="Adjust the thickness of the bookmark base"
        />
      </section>

      {/* Corner Radius */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-gray-800">Corner Style</h3>
        
        <CornerRadiusSlider
          value={currentParameters.cornerRadius}
          onChange={(value) => handleParameterChange('cornerRadius', value)}
          disabled={disabled}
          debounceMs={100}
          ariaLabel="Corner radius control"
          ariaDescription="Adjust the roundness of bookmark corners"
        />
        
        {/* Corner Preview */}
        <div className="flex justify-center mt-3">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs font-medium text-gray-700 mb-2 text-center">Preview</div>
            <div 
              className="w-16 h-24 border-2 border-gray-400 bg-white shadow-sm"
              style={{
                borderRadius: `${Math.min(currentParameters.cornerRadius * 2, 20)}px`
              }}
            />
          </div>
        </div>
      </section>

      {/* Parameter Presets */}
      <section>
        <PresetManager
          currentParameters={currentParameters}
          onLoadPreset={handlePresetLoad}
        />
      </section>

      {/* Parameter Summary */}
      <section className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-800 mb-3">Current Configuration</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <div className="text-gray-600">Colors: <span className="font-medium text-gray-900">{currentParameters.colorCount}</span></div>
            <div className="text-gray-600">Size: <span className="font-medium text-gray-900">{currentParameters.width}×{currentParameters.height}mm</span></div>
            <div className="text-gray-600">Layer: <span className="font-medium text-gray-900">{currentParameters.layerThickness}mm</span></div>
          </div>
          <div className="space-y-1">
            <div className="text-gray-600">Base: <span className="font-medium text-gray-900">{currentParameters.baseThickness}mm</span></div>
            <div className="text-gray-600">Corner: <span className="font-medium text-gray-900">{currentParameters.cornerRadius}mm</span></div>
            <div className="text-gray-600">Max Height: <span className="font-medium text-gray-900">
              {(currentParameters.baseThickness + (currentParameters.colorCount - 1) * currentParameters.layerThickness).toFixed(1)}mm
            </span></div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ParameterPanel;