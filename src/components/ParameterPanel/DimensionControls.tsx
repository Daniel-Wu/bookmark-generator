import React, { useState, useCallback, useEffect } from 'react';
import { PARAMETER_LIMITS } from '../../constants';
import { ParameterSlider } from '../common';

// ========================
// Types
// ========================

export interface DimensionControlsProps {
  width: number;
  height: number;
  onChange: (dimensions: { width: number; height: number }) => void;
  disabled?: boolean;
  className?: string;
}

// ========================
// Dimension Controls Component
// ========================

export const DimensionControls: React.FC<DimensionControlsProps> = ({
  width,
  height,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [aspectRatioLocked, setAspectRatioLocked] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(width / height);

  // Update aspect ratio when dimensions change externally
  useEffect(() => {
    if (!aspectRatioLocked) {
      setAspectRatio(width / height);
    }
  }, [width, height, aspectRatioLocked]);

  // Handle width change with aspect ratio locking
  const handleWidthChange = useCallback((newWidth: number) => {
    if (aspectRatioLocked) {
      const newHeight = Math.round(newWidth / aspectRatio);
      const clampedHeight = Math.max(
        PARAMETER_LIMITS.height.min,
        Math.min(PARAMETER_LIMITS.height.max, newHeight)
      );
      onChange({ width: newWidth, height: clampedHeight });
    } else {
      onChange({ width: newWidth, height });
    }
  }, [aspectRatioLocked, aspectRatio, height, onChange]);

  // Handle height change with aspect ratio locking
  const handleHeightChange = useCallback((newHeight: number) => {
    if (aspectRatioLocked) {
      const newWidth = Math.round(newHeight * aspectRatio);
      const clampedWidth = Math.max(
        PARAMETER_LIMITS.width.min,
        Math.min(PARAMETER_LIMITS.width.max, newWidth)
      );
      onChange({ width: clampedWidth, height: newHeight });
    } else {
      onChange({ width, height: newHeight });
    }
  }, [aspectRatioLocked, aspectRatio, width, onChange]);

  // Toggle aspect ratio lock
  const toggleAspectRatioLock = useCallback(() => {
    if (!aspectRatioLocked) {
      // Locking: save current aspect ratio
      setAspectRatio(width / height);
    }
    setAspectRatioLocked(!aspectRatioLocked);
  }, [aspectRatioLocked, width, height]);

  // Calculate aspect ratio display
  const currentAspectRatio = width / height;
  const ratioText = formatAspectRatio(currentAspectRatio);

  // Preset dimension options
  const presetDimensions = [
    { name: 'Small', width: 40, height: 120, description: 'Compact bookmark' },
    { name: 'Standard', width: 50, height: 150, description: 'Classic size' },
    { name: 'Large', width: 60, height: 180, description: 'Generous bookmark' },
    { name: 'Wide', width: 80, height: 120, description: 'Landscape style' },
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Dimensions</h3>
        <div className="text-xs text-gray-500">
          {width} × {height} mm ({ratioText})
        </div>
      </div>

      {/* Dimension Input Controls */}
      <div className="space-y-4">
        {/* Width Control */}
        <ParameterSlider
          value={width}
          onChange={handleWidthChange}
          min={PARAMETER_LIMITS.width.min}
          max={PARAMETER_LIMITS.width.max}
          step={PARAMETER_LIMITS.width.step}
          label="Width"
          unit="mm"
          description="Bookmark width dimension"
          disabled={disabled}
          debounceMs={100}
          snapValues={[20, 30, 40, 50, 60, 80, 100, 150, 200]}
          markers={[
            { value: 50, type: 'recommended', label: 'Standard', description: 'Most common bookmark width' }
          ]}
          ariaLabel="Bookmark width control"
          ariaDescription={aspectRatioLocked ? "Width control with aspect ratio locked" : "Width control with free aspect ratio"}
        />

        {/* Aspect Ratio Lock Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={toggleAspectRatioLock}
            disabled={disabled}
            className={`
              flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${
                aspectRatioLocked
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <svg
              className={`w-4 h-4 ${aspectRatioLocked ? 'text-white' : 'text-gray-500'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {aspectRatioLocked ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3h2a3 3 0 013 3v2"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                />
              )}
            </svg>
            <span>
              {aspectRatioLocked ? 'Locked' : 'Lock'} Ratio
            </span>
          </button>
        </div>

        {/* Height Control */}
        <ParameterSlider
          value={height}
          onChange={handleHeightChange}
          min={PARAMETER_LIMITS.height.min}
          max={PARAMETER_LIMITS.height.max}
          step={PARAMETER_LIMITS.height.step}
          label="Height"
          unit="mm"
          description="Bookmark height dimension"
          disabled={disabled}
          debounceMs={100}
          snapValues={[30, 60, 90, 120, 150, 180, 210, 240, 300]}
          markers={[
            { value: 150, type: 'recommended', label: 'Standard', description: 'Most common bookmark height' }
          ]}
          ariaLabel="Bookmark height control"
          ariaDescription={aspectRatioLocked ? "Height control with aspect ratio locked" : "Height control with free aspect ratio"}
        />
      </div>

      {/* Preset Dimensions */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Quick Presets</label>
        <div className="grid grid-cols-2 gap-2">
          {presetDimensions.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => onChange({ width: preset.width, height: preset.height })}
              disabled={disabled}
              className={`
                px-3 py-2 text-sm rounded-lg border transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${
                  width === preset.width && height === preset.height
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : disabled
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }
              `}
            >
              <div className="text-left">
                <div className="font-medium">{preset.name}</div>
                <div className="text-xs opacity-75">
                  {preset.width}×{preset.height}mm
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Visual Size Preview */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs font-medium text-gray-700 mb-2">Size Preview</div>
        <div className="flex items-center justify-center min-h-[60px]">
          <div
            className="bg-white border-2 border-gray-300 rounded shadow-sm flex items-center justify-center"
            style={{
              width: `${Math.min(width * 0.8, 80)}px`,
              height: `${Math.min(height * 0.8, 120)}px`,
            }}
          >
            <div className="text-xs text-gray-500 font-mono transform -rotate-90 whitespace-nowrap">
              {width}×{height}
            </div>
          </div>
        </div>
        <div className="text-center text-xs text-gray-500 mt-2">
          {getPhysicalSizeDescription(width, height)}
        </div>
      </div>

      {/* Size Information */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-gray-50 rounded p-2 text-center">
          <div className="font-medium text-gray-900">{ratioText}</div>
          <div className="text-gray-500">Ratio</div>
        </div>
        <div className="bg-gray-50 rounded p-2 text-center">
          <div className="font-medium text-gray-900">{(width * height / 100).toFixed(1)}</div>
          <div className="text-gray-500">cm²</div>
        </div>
        <div className="bg-gray-50 rounded p-2 text-center">
          <div className="font-medium text-gray-900">
            {aspectRatioLocked ? 'Locked' : 'Free'}
          </div>
          <div className="text-gray-500">Aspect</div>
        </div>
      </div>
    </div>
  );
};

// ========================
// Helper Functions
// ========================

function formatAspectRatio(ratio: number): string {
  // Common aspect ratios
  const commonRatios = [
    { ratio: 1, text: '1:1' },
    { ratio: 4/3, text: '4:3' },
    { ratio: 3/2, text: '3:2' },
    { ratio: 16/9, text: '16:9' },
    { ratio: 2/1, text: '2:1' },
    { ratio: 3/1, text: '3:1' },
  ];

  // Find closest common ratio
  const closest = commonRatios.reduce((prev, curr) => 
    Math.abs(curr.ratio - ratio) < Math.abs(prev.ratio - ratio) ? curr : prev
  );

  // If very close to a common ratio, use that
  if (Math.abs(closest.ratio - ratio) < 0.05) {
    return closest.text;
  }

  // Otherwise, use decimal format
  return `${ratio.toFixed(2)}:1`;
}

function getPhysicalSizeDescription(width: number, height: number): string {
  const area = width * height;
  
  if (area < 3000) {
    return 'Compact bookmark, fits in small books';
  } else if (area < 7500) {
    return 'Standard bookmark size for most books';
  } else if (area < 12000) {
    return 'Large bookmark, great for textbooks';
  } else {
    return 'Extra large bookmark for oversized books';
  }
}

export default DimensionControls;