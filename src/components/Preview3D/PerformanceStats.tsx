import React from 'react';
import type { BookmarkGeometry, BookmarkParameters } from '../../types';

interface PerformanceStatsProps {
  geometry: BookmarkGeometry;
  parameters: BookmarkParameters;
  layerVisibility: Map<number, boolean>;
}

export const PerformanceStats: React.FC<PerformanceStatsProps> = ({
  geometry,
  parameters,
  layerVisibility,
}) => {
  // Calculate visible statistics
  const visibleTriangles = geometry.layers.reduce((total, layer, index) => {
    const isVisible = layerVisibility.get(index) !== false;
    return total + (isVisible ? (layer.triangleCount || 0) : 0);
  }, 0);

  const visibleLayers = geometry.layers.filter((_, index) => 
    layerVisibility.get(index) !== false
  ).length;

  // Estimate file size for visible geometry (rough approximation)
  const estimatedFileSize = (visibleTriangles * 50) / (1024 * 1024); // ~50 bytes per triangle in STL

  // Performance indicators
  const isPerformanceGood = visibleTriangles < 50000;
  const isPerformanceWarning = visibleTriangles >= 50000 && visibleTriangles < 100000;
  const isPerformanceCritical = visibleTriangles >= 100000;

  const performanceColor = isPerformanceGood 
    ? 'text-green-600' 
    : isPerformanceWarning 
    ? 'text-yellow-600' 
    : 'text-red-600';

  const performanceText = isPerformanceGood
    ? 'Good'
    : isPerformanceWarning
    ? 'Fair'
    : 'Poor';

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-900">Statistics</h3>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Geometry Stats */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Triangles:</span>
            <span className="font-medium">{geometry.totalTriangles?.toLocaleString() || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Visible Triangles:</span>
            <span className="font-medium">{visibleTriangles.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Visible Layers:</span>
            <span className="font-medium">{visibleLayers} / {geometry.layers.length}</span>
          </div>
        </div>

        {/* Dimensions & File Stats */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Dimensions:</span>
            <span className="font-medium text-xs">
              {parameters.width}×{parameters.height}×{parameters.baseThickness}mm
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Est. File Size:</span>
            <span className="font-medium">
              {estimatedFileSize < 1 
                ? `${Math.round(estimatedFileSize * 1024)}KB`
                : `${estimatedFileSize.toFixed(1)}MB`
              }
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Performance:</span>
            <span className={`font-medium ${performanceColor}`}>
              {performanceText}
            </span>
          </div>
        </div>
      </div>

      {/* Performance Warning */}
      {isPerformanceCritical && (
        <div className="bg-red-50 border border-red-200 rounded-md p-2">
          <p className="text-xs text-red-700">
            <strong>Performance Warning:</strong> High triangle count may cause slow rendering. 
            Consider reducing layer complexity or hiding some layers.
          </p>
        </div>
      )}

      {/* Performance Tip */}
      {isPerformanceWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
          <p className="text-xs text-yellow-700">
            <strong>Tip:</strong> Performance may be affected. Hide unused layers for better performance.
          </p>
        </div>
      )}
    </div>
  );
};