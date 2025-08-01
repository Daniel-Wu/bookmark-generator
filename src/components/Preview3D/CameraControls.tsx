import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { BookmarkGeometry } from '../../types';
import type { 
  CameraPreset, 
  CameraTweenConfig
} from '../../types/geometry';
import { CameraManager } from '../../modules/rendering/cameraManager';

interface CameraControlsProps {
  cameraManager: CameraManager | null;
  geometry?: BookmarkGeometry;
  onPresetChange?: (preset: CameraPreset) => void;
  onAutoFit?: () => void;
  className?: string;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  cameraManager,
  geometry,
  onPresetChange,
  onAutoFit,
  className = '',
}) => {
  const [currentPreset, setCurrentPreset] = useState<CameraPreset>('isometric');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [savedStates, setSavedStates] = useState<string[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveStateName, setSaveStateName] = useState('');
  const saveInputRef = useRef<HTMLInputElement>(null);

  // Update saved states when camera manager changes
  useEffect(() => {
    if (cameraManager) {
      setSavedStates(cameraManager.getSavedStateNames());
    }
  }, [cameraManager]);

  // Focus save input when dialog opens
  useEffect(() => {
    if (showSaveDialog && saveInputRef.current) {
      saveInputRef.current.focus();
    }
  }, [showSaveDialog]);

  const handlePresetChange = useCallback(async (preset: CameraPreset) => {
    if (!cameraManager || isTransitioning) return;

    setIsTransitioning(true);
    try {
      const tweenConfig: Partial<CameraTweenConfig> = {
        duration: preset === 'isometric' ? 1000 : 800,
        easing: 'easeInOut',
        onComplete: () => setIsTransitioning(false)
      };

      await cameraManager.setPreset(preset, tweenConfig);
      setCurrentPreset(preset);
      onPresetChange?.(preset);
    } catch (error) {
      console.error('Failed to set camera preset:', error);
      setIsTransitioning(false);
    }
  }, [cameraManager, isTransitioning, onPresetChange]);

  const handleAutoFit = useCallback(async () => {
    if (!cameraManager || !geometry || isTransitioning) return;

    setIsTransitioning(true);
    try {
      const tweenConfig: Partial<CameraTweenConfig> = {
        duration: 800,
        easing: 'easeOut',
        onComplete: () => setIsTransitioning(false)
      };

      await cameraManager.autoFitToGeometry(geometry, 1.2, tweenConfig);
      setCurrentPreset('custom');
      onAutoFit?.();
    } catch (error) {
      console.error('Failed to auto-fit camera:', error);
      setIsTransitioning(false);
    }
  }, [cameraManager, geometry, isTransitioning, onAutoFit]);

  const handleReset = useCallback(async () => {
    if (!cameraManager || isTransitioning) return;

    setIsTransitioning(true);
    try {
      const tweenConfig: Partial<CameraTweenConfig> = {
        duration: 1000,
        easing: 'easeInOut',
        onComplete: () => setIsTransitioning(false)
      };

      await cameraManager.reset(tweenConfig);
      setCurrentPreset('isometric');
    } catch (error) {
      console.error('Failed to reset camera:', error);
      setIsTransitioning(false);
    }
  }, [cameraManager, isTransitioning]);

  const handleSaveState = useCallback(() => {
    if (!cameraManager || !saveStateName.trim()) return;

    try {
      cameraManager.saveState(saveStateName.trim());
      setSavedStates(cameraManager.getSavedStateNames());
      setSaveStateName('');
      setShowSaveDialog(false);
    } catch (error) {
      console.error('Failed to save camera state:', error);
    }
  }, [cameraManager, saveStateName]);

  const handleRestoreState = useCallback(async (stateName: string) => {
    if (!cameraManager || isTransitioning) return;

    setIsTransitioning(true);
    try {
      const tweenConfig: Partial<CameraTweenConfig> = {
        duration: 800,
        easing: 'easeInOut',
        onComplete: () => setIsTransitioning(false)
      };

      await cameraManager.restoreState(stateName, tweenConfig);
      setCurrentPreset('custom');
    } catch (error) {
      console.error('Failed to restore camera state:', error);
      setIsTransitioning(false);
    }
  }, [cameraManager, isTransitioning]);

  const handleDeleteState = useCallback((stateName: string) => {
    if (!cameraManager) return;

    try {
      cameraManager.deleteSavedState(stateName);
      setSavedStates(cameraManager.getSavedStateNames());
    } catch (error) {
      console.error('Failed to delete camera state:', error);
    }
  }, [cameraManager]);

  // Camera preset configurations for UI
  const presetConfigs: Array<{ preset: CameraPreset; icon: string; tooltip: string }> = [
    { preset: 'front', icon: '⬜', tooltip: 'Front View' },
    { preset: 'back', icon: '⬛', tooltip: 'Back View' },
    { preset: 'top', icon: '⬆️', tooltip: 'Top View' },
    { preset: 'bottom', icon: '⬇️', tooltip: 'Bottom View' },
    { preset: 'left', icon: '⬅️', tooltip: 'Left View' },
    { preset: 'right', icon: '➡️', tooltip: 'Right View' },
    { preset: 'isometric', icon: '📦', tooltip: 'Isometric View' },
  ];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Camera Controls</h3>
          {isTransitioning && (
            <div className="flex items-center space-x-2 text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span>Transitioning...</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Camera Presets */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Camera Presets</h4>
          <div className="grid grid-cols-4 gap-2">
            {presetConfigs.map(({ preset, icon, tooltip }) => (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                disabled={isTransitioning}
                className={`p-3 rounded-lg border transition-all duration-200 ${
                  currentPreset === preset
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                } ${isTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={tooltip}
              >
                <div className="text-lg mb-1">{icon}</div>
                <div className="text-xs font-medium">{preset.charAt(0).toUpperCase() + preset.slice(1)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleAutoFit}
              disabled={!geometry || isTransitioning}
              className={`px-4 py-2 text-sm border border-gray-300 rounded-lg transition-colors ${
                geometry && !isTransitioning
                  ? 'hover:bg-gray-50 text-gray-700'
                  : 'opacity-50 cursor-not-allowed text-gray-400'
              }`}
              title="Auto-fit camera to geometry"
            >
              🎯 Auto Fit
            </button>
            
            <button
              onClick={handleReset}
              disabled={isTransitioning}
              className={`px-4 py-2 text-sm border border-gray-300 rounded-lg transition-colors ${
                !isTransitioning
                  ? 'hover:bg-gray-50 text-gray-700'
                  : 'opacity-50 cursor-not-allowed text-gray-400'
              }`}
              title="Reset to default view"
            >
              🔄 Reset
            </button>
          </div>
        </div>

        {/* Saved States */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">Saved Views</h4>
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={!cameraManager || isTransitioning}
              className={`text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors ${
                !cameraManager || isTransitioning ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Save current camera position"
            >
              💾 Save
            </button>
          </div>

          {savedStates.length > 0 ? (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {savedStates.map((stateName) => (
                <div key={stateName} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                  <span className="text-sm text-gray-700 truncate flex-1">{stateName}</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleRestoreState(stateName)}
                      disabled={isTransitioning}
                      className={`px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors ${
                        isTransitioning ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title="Restore this view"
                    >
                      📷
                    </button>
                    <button
                      onClick={() => handleDeleteState(stateName)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      title="Delete this saved view"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">
              No saved views yet
            </div>
          )}
        </div>

        {/* Current Camera Info */}
        {cameraManager && (
          <div className="pt-3 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Current View</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>
                <span className="font-medium">Preset:</span> {currentPreset}
              </div>
              {geometry && (
                <div>
                  <span className="font-medium">Geometry:</span> {geometry.layers.length} layers, {geometry.totalTriangles.toLocaleString()} triangles
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save State Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Camera View</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  View Name
                </label>
                <input
                  ref={saveInputRef}
                  type="text"
                  value={saveStateName}
                  onChange={(e) => setSaveStateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && saveStateName.trim()) {
                      handleSaveState();
                    } else if (e.key === 'Escape') {
                      setShowSaveDialog(false);
                      setSaveStateName('');
                    }
                  }}
                  placeholder="Enter a name for this view..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setSaveStateName('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveState}
                  disabled={!saveStateName.trim()}
                  className={`px-4 py-2 text-sm bg-blue-600 text-white rounded-lg transition-colors ${
                    saveStateName.trim()
                      ? 'hover:bg-blue-700'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  Save View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};