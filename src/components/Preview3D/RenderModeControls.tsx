import React from 'react';
import { RENDER_MODES } from '../../constants/rendering';

interface RenderModeControlsProps {
  currentMode: 'solid' | 'wireframe' | 'x-ray';
  onModeChange: (mode: 'solid' | 'wireframe' | 'x-ray') => void;
}

export const RenderModeControls: React.FC<RenderModeControlsProps> = ({
  currentMode,
  onModeChange,
}) => {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-900">Render Mode</h3>
      <div className="flex space-x-2">
        {RENDER_MODES.map((mode) => (
          <button
            key={mode.type}
            onClick={() => onModeChange(mode.type as 'solid' | 'wireframe' | 'x-ray')}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              currentMode === mode.type
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
            title={mode.description}
          >
            {mode.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {RENDER_MODES.find(mode => mode.type === currentMode)?.description}
      </p>
    </div>
  );
};