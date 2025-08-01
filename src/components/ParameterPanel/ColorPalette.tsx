import React, { useMemo } from 'react';
import type { Color, QuantizedImageData, BookmarkParameters } from '../../types';
import { calculateLuminance } from '../../modules/image/colorUtils';

// ========================
// Types
// ========================

export interface ColorPaletteProps {
  quantizedData: QuantizedImageData | null;
  parameters: BookmarkParameters;
  className?: string;
  onColorClick?: (colorIndex: number, color: Color) => void;
}

interface ColorLayerInfo {
  color: Color;
  luminance: number;
  height: number;
  layerNumber: number;
  hexColor: string;
  isBase: boolean;
}

// ========================
// Color Palette Component
// ========================

export const ColorPalette: React.FC<ColorPaletteProps> = ({
  quantizedData,
  parameters,
  className = '',
  onColorClick,
}) => {
  // Calculate layer information based on quantized colors and parameters
  const layerInfo = useMemo<ColorLayerInfo[]>(() => {
    if (!quantizedData || !quantizedData.colorPalette) {
      return [];
    }

    const { colorPalette } = quantizedData;
    
    // Calculate luminance for each color
    const colorsWithLuminance = colorPalette.map(color => ({
      color,
      luminance: calculateLuminance(color)
    }));

    // Sort by luminance (darkest to lightest)
    colorsWithLuminance.sort((a, b) => a.luminance - b.luminance);

    // Map to layer information
    return colorsWithLuminance.map((item, index) => {
      const layerNumber = index + 1;
      const isBase = index === 0; // Lightest color is the base
      const height = isBase 
        ? parameters.baseThickness 
        : parameters.baseThickness + (index * parameters.layerThickness);

      const hexColor = `#${[item.color.r, item.color.g, item.color.b]
        .map(c => c.toString(16).padStart(2, '0'))
        .join('')}`;

      return {
        color: item.color,
        luminance: item.luminance,
        height,
        layerNumber,
        hexColor,
        isBase
      };
    });
  }, [quantizedData, parameters]);

  // Handle empty state
  if (!quantizedData || layerInfo.length === 0) {
    return (
      <div className={`space-y-3 ${className}`}>
        <h3 className="text-sm font-medium text-gray-700">Color Palette</h3>
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-500">
            Upload and process an image to see the color palette
          </p>
        </div>
      </div>
    );
  }

  // Calculate the maximum height for visual scaling
  const maxHeight = Math.max(...layerInfo.map(info => info.height));

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Color Palette</h3>
        <span className="text-xs text-gray-500">
          {layerInfo.length} colors
        </span>
      </div>

      {/* Color Swatches Grid */}
      <div className="grid grid-cols-2 gap-3">
        {layerInfo.map((info, index) => (
          <div
            key={index}
            className={`
              relative bg-white border rounded-lg p-3 transition-all duration-200
              ${onColorClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''}
              ${info.isBase ? 'border-gray-300' : 'border-gray-200'}
            `}
            onClick={() => onColorClick?.(index, info.color)}
          >
            {/* Layer Number Badge */}
            <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {info.layerNumber}
            </div>

            {/* Color Swatch */}
            <div className="flex items-center space-x-3">
              <div
                className="w-12 h-12 rounded-lg border-2 border-white shadow-sm flex-shrink-0"
                style={{
                  backgroundColor: info.hexColor,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)'
                }}
              />

              <div className="flex-1 min-w-0">
                {/* Color Info */}
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-900">
                    {info.isBase ? 'Base' : `Layer ${info.layerNumber}`}
                  </div>
                  <div className="text-xs text-gray-600 font-mono">
                    {info.hexColor.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {info.height.toFixed(1)}mm
                  </div>
                </div>
              </div>
            </div>

            {/* Height Visualization Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Height</span>
                <span>{info.height.toFixed(1)}mm</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    info.isBase ? 'bg-gray-400' : 'bg-blue-500'
                  }`}
                  style={{
                    width: `${(info.height / maxHeight) * 100}%`
                  }}
                />
              </div>
            </div>

            {/* RGB Values */}
            <div className="mt-2 text-xs text-gray-400 font-mono">
              RGB({info.color.r}, {info.color.g}, {info.color.b})
            </div>
          </div>
        ))}
      </div>

      {/* Layer Mapping Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 bg-blue-600 rounded-full" />
          </div>
          <div className="text-xs text-blue-800">
            <div className="font-medium mb-1">Layer Mapping</div>
            <div className="space-y-0.5">
              <div>• Colors sorted by brightness (darkest to lightest)</div>
              <div>• Darkest color forms the base layer</div>
              <div>• Each color gets extruded to its height value</div>
              <div>• Layer thickness: {parameters.layerThickness}mm</div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-gray-50 rounded p-2 text-center">
          <div className="font-medium text-gray-900">{layerInfo.length}</div>
          <div className="text-gray-500">Colors</div>
        </div>
        <div className="bg-gray-50 rounded p-2 text-center">
          <div className="font-medium text-gray-900">{maxHeight.toFixed(1)}mm</div>
          <div className="text-gray-500">Max Height</div>
        </div>
        <div className="bg-gray-50 rounded p-2 text-center">
          <div className="font-medium text-gray-900">{layerInfo.length - 1}</div>
          <div className="text-gray-500">Layers</div>
        </div>
      </div>
    </div>
  );
};

export default ColorPalette;