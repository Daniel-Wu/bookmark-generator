import React, { useState, useEffect, useCallback } from 'react';
import type { BookmarkParameters } from '../../types';
import { STORAGE_KEYS, DEFAULT_PARAMETERS } from '../../constants';

// ========================
// Types
// ========================

export interface PresetData {
  id: string;
  name: string;
  parameters: BookmarkParameters;
  createdAt: number;
  description?: string;
}

export interface PresetManagerProps {
  currentParameters: BookmarkParameters;
  onLoadPreset: (parameters: BookmarkParameters) => void;
  className?: string;
}

// ========================
// Preset Manager Component
// ========================

export const PresetManager: React.FC<PresetManagerProps> = ({
  currentParameters,
  onLoadPreset,
  className = '',
}) => {
  const [presets, setPresets] = useState<PresetData[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // Load presets from localStorage on mount
  useEffect(() => {
    loadPresets();
  }, []);

  // Load presets from localStorage
  const loadPresets = useCallback(() => {
    try {
      const storedPresets = localStorage.getItem(STORAGE_KEYS.PARAMETER_PRESETS);
      if (storedPresets) {
        const parsedPresets = JSON.parse(storedPresets) as PresetData[];
        setPresets(parsedPresets);
      } else {
        // Initialize with default presets
        const defaultPresets = getDefaultPresets();
        setPresets(defaultPresets);
        localStorage.setItem(STORAGE_KEYS.PARAMETER_PRESETS, JSON.stringify(defaultPresets));
      }
    } catch (error) {
      console.error('Error loading presets:', error);
      setPresets(getDefaultPresets());
    }
  }, []);

  // Save presets to localStorage
  const savePresets = useCallback((presetsToSave: PresetData[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.PARAMETER_PRESETS, JSON.stringify(presetsToSave));
      setPresets(presetsToSave);
    } catch (error) {
      console.error('Error saving presets:', error);
    }
  }, []);

  // Save current parameters as new preset
  const saveNewPreset = useCallback(() => {
    if (!newPresetName.trim()) return;

    const newPreset: PresetData = {
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newPresetName.trim(),
      parameters: { ...currentParameters },
      createdAt: Date.now(),
      description: newPresetDescription.trim() || undefined,
    };

    const updatedPresets = [...presets, newPreset];
    savePresets(updatedPresets);

    // Reset dialog
    setShowSaveDialog(false);
    setNewPresetName('');
    setNewPresetDescription('');
    setSelectedPresetId(newPreset.id);
  }, [newPresetName, newPresetDescription, currentParameters, presets, savePresets]);

  // Load a preset
  const loadPreset = useCallback((preset: PresetData) => {
    onLoadPreset(preset.parameters);
    setSelectedPresetId(preset.id);
  }, [onLoadPreset]);

  // Delete a preset
  const deletePreset = useCallback((presetId: string) => {
    const updatedPresets = presets.filter(p => p.id !== presetId);
    savePresets(updatedPresets);
    
    if (selectedPresetId === presetId) {
      setSelectedPresetId(null);
    }
  }, [presets, selectedPresetId, savePresets]);

  // Check if current parameters match any preset
  const findMatchingPreset = useCallback(() => {
    return presets.find(preset => 
      parametersEqual(preset.parameters, currentParameters)
    );
  }, [presets, currentParameters]);

  const matchingPreset = findMatchingPreset();

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Parameter Presets</h3>
        <button
          type="button"
          onClick={() => setShowSaveDialog(true)}
          className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Save Current
        </button>
      </div>

      {/* Current Status */}
      {matchingPreset && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-green-800 font-medium">
              Using "{matchingPreset.name}"
            </span>
          </div>
        </div>
      )}

      {/* Preset List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {presets.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">No saved presets</p>
            <button
              type="button"
              onClick={() => setShowSaveDialog(true)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Save your first preset
            </button>
          </div>
        ) : (
          presets.map((preset) => (
            <div
              key={preset.id}
              className={`
                bg-white border rounded-lg p-3 transition-all duration-200
                ${selectedPresetId === preset.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {preset.name}
                    </h4>
                    {selectedPresetId === preset.id && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Active
                      </span>
                    )}
                  </div>
                  
                  {preset.description && (
                    <p className="text-xs text-gray-500 mt-1">
                      {preset.description}
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>{preset.parameters.colorCount} colors</span>
                    <span>{preset.parameters.width}×{preset.parameters.height}mm</span>
                    <span>Layer: {preset.parameters.layerThickness}mm</span>
                  </div>
                  
                  <div className="text-xs text-gray-400 mt-1">
                    Saved {new Date(preset.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center space-x-1 ml-2">
                  <button
                    type="button"
                    onClick={() => loadPreset(preset)}
                    className="p-1 text-gray-400 hover:text-blue-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Load preset"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </button>
                  
                  {!preset.id.startsWith('default_') && (
                    <button
                      type="button"
                      onClick={() => deletePreset(preset.id)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                      title="Delete preset"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Save Parameter Preset
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preset Name *
                </label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="e.g., High Detail Photo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newPresetDescription}
                  onChange={(e) => setNewPresetDescription(e.target.value)}
                  placeholder="Describe when to use this preset..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-700 mb-2">Current Parameters:</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>Colors: {currentParameters.colorCount}</div>
                  <div>Size: {currentParameters.width}×{currentParameters.height}mm</div>
                  <div>Layer: {currentParameters.layerThickness}mm</div>
                  <div>Base: {currentParameters.baseThickness}mm</div>
                  <div>Corner: {currentParameters.cornerRadius}mm</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewPresetName('');
                  setNewPresetDescription('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNewPreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Preset
              </button>
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

function getDefaultPresets(): PresetData[] {
  return [
    {
      id: 'default_simple',
      name: 'Simple Design',
      parameters: {
        ...DEFAULT_PARAMETERS,
        colorCount: 2,
        width: 45,
        height: 140,
      },
      createdAt: Date.now(),
      description: 'Clean two-color design perfect for text and simple graphics',
    },
    {
      id: 'default_standard',
      name: 'Standard Photo',
      parameters: {
        ...DEFAULT_PARAMETERS,
        colorCount: 4,
        width: 50,
        height: 150,
      },
      createdAt: Date.now(),
      description: 'Balanced four-color setup ideal for most photographs',
    },
    {
      id: 'default_detailed',
      name: 'High Detail',
      parameters: {
        ...DEFAULT_PARAMETERS,
        colorCount: 6,
        layerThickness: 0.15,
        width: 55,
        height: 165,
      },
      createdAt: Date.now(),
      description: 'Six-color design with fine layers for complex artwork',
    },
    {
      id: 'default_wide',
      name: 'Wide Format',
      parameters: {
        ...DEFAULT_PARAMETERS,
        colorCount: 3,
        width: 80,
        height: 120,
        cornerRadius: 5,
      },
      createdAt: Date.now(),
      description: 'Landscape orientation with rounded corners',
    },
  ];
}

function parametersEqual(a: BookmarkParameters, b: BookmarkParameters): boolean {
  return (
    a.colorCount === b.colorCount &&
    a.layerThickness === b.layerThickness &&
    a.baseThickness === b.baseThickness &&
    a.width === b.width &&
    a.height === b.height &&
    a.cornerRadius === b.cornerRadius
  );
}

export default PresetManager;