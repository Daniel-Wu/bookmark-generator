import React from 'react';
import { PARAMETER_LIMITS } from '../../constants';

// ========================
// Types
// ========================

export interface ColorCountSelectionProps {
  value: number;
  onChange: (colorCount: number) => void;
  disabled?: boolean;
  className?: string;
}

// ========================
// Color Count Selection Component
// ========================

export const ColorCountSelection: React.FC<ColorCountSelectionProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const { min, max } = PARAMETER_LIMITS.colorCount;
  
  // Generate array of color count options
  const colorOptions = Array.from(
    { length: max - min + 1 }, 
    (_, i) => min + i
  );

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Color Count
        </label>
        <span className="text-sm text-gray-500 font-medium">
          {value} colors
        </span>
      </div>

      {/* Color Count Buttons Grid */}
      <div className="grid grid-cols-4 gap-2">
        {colorOptions.map((count) => {
          const isActive = count === value;
          const isDisabled = disabled;
          
          return (
            <button
              key={count}
              type="button"
              onClick={() => !isDisabled && onChange(count)}
              disabled={isDisabled}
              className={`
                relative px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${
                  isActive
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                    : isDisabled
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                }
              `}
            >
              {/* Color Count Number */}
              <div className="flex flex-col items-center space-y-1">
                <span className="text-lg font-bold">{count}</span>
                <span className="text-xs opacity-75">
                  {count === 2 ? 'Simple' : 
                   count <= 4 ? 'Basic' : 
                   count <= 6 ? 'Rich' : 'Complex'}
                </span>
              </div>

              {/* Active Indicator */}
              {isActive && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              )}

              {/* Visual Color Dots */}
              <div className="flex justify-center mt-1 space-x-0.5">
                {Array.from({ length: Math.min(count, 6) }, (_, i) => (
                  <div
                    key={i}
                    className={`
                      w-1.5 h-1.5 rounded-full
                      ${isActive ? 'bg-white/70' : 'bg-gray-400'}
                    `}
                  />
                ))}
                {count > 6 && (
                  <div className={`
                    text-xs
                    ${isActive ? 'text-white/70' : 'text-gray-400'}
                  `}>
                    +
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Description */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-xs text-gray-600">
          {getColorCountDescription(value)}
        </div>
      </div>

      {/* Performance Note */}
      {value >= 6 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <div className="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-yellow-600 rounded-full" />
            </div>
            <div className="text-xs text-yellow-800">
              <div className="font-medium">Performance Note</div>
              <div className="mt-1">
                Higher color counts may increase processing time and complexity. 
                Consider using fewer colors for simpler designs.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ========================
// Helper Functions
// ========================

function getColorCountDescription(count: number): string {
  switch (count) {
    case 2:
      return 'Simple two-tone design. Great for high contrast, minimalist bookmarks with clear text or shapes.';
    case 3:
      return 'Three-color design with base + two layers. Good balance of detail and simplicity.';
    case 4:
      return 'Standard four-color design. Ideal for most photos and illustrations with good detail preservation.';
    case 5:
      return 'Five-color design with rich detail. Suitable for complex images with subtle color variations.';
    case 6:
      return 'Six-color design with high detail. Best for photographs with many color gradients.';
    case 7:
      return 'Seven-color design with very high detail. Excellent for complex artwork and detailed photographs.';
    case 8:
      return 'Maximum eight-color design. Ultimate detail preservation for complex images with many color nuances.';
    default:
      return 'Select the number of colors for your bookmark design.';
  }
}

export default ColorCountSelection;