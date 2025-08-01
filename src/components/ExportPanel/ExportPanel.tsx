import React from 'react';
import type { ExportPanelProps, ExportFormat, ExportQualitySettings, BookmarkGeometry } from '../../types';
import { ProgressIndicator } from './ProgressIndicator';
import { FileUtils } from '../../modules/export/fileDownload';

/**
 * Format compatibility information
 */
const FORMAT_INFO = {
  stl: {
    name: 'STL',
    description: 'Standard format for single-color 3D printing',
    features: ['Single color', 'Widely supported', 'Small file size'],
    limitations: ['No color information', 'No metadata'],
    compatibility: '99% of 3D printers',
    recommendedFor: 'Most 3D printing applications',
  },
  '3mf': {
    name: '3MF',
    description: 'Modern multi-material format with color support',
    features: ['Multi-color support', 'Metadata included', 'Compression'],
    limitations: ['Larger file size', 'Limited printer support'],
    compatibility: 'Modern printers only',
    recommendedFor: 'Color printing and professional applications',
  },
} as const;

/**
 * Quality level descriptions
 */
const QUALITY_LEVELS = {
  high: {
    name: 'High Quality',
    description: 'Best quality with strict validation',
    features: ['Maximum precision', 'Strict validation', 'Optimized geometry'],
    fileSize: 'Large',
    printTime: 'Longer',
  },
  medium: {
    name: 'Balanced',
    description: 'Good balance of quality and file size',
    features: ['Good precision', 'Standard validation', 'Some optimization'],
    fileSize: 'Medium',
    printTime: 'Standard',
  },
  low: {
    name: 'Fast Export',
    description: 'Quick export with minimal processing',
    features: ['Basic precision', 'Minimal validation', 'No optimization'],
    fileSize: 'Small',
    printTime: 'Shorter',
  },
} as const;

export const ExportPanel: React.FC<ExportPanelProps> = ({
  geometry,
  onExport,
  onCancel,
  exportState,
  validation,
  printPreview,
  className = '',
}) => {
  const [selectedFormat, setSelectedFormat] = React.useState<ExportFormat>('stl');
  const [qualitySettings, setQualitySettings] = React.useState<ExportQualitySettings>({
    level: 'medium',
    optimizeGeometry: true,
    includeColors: true,
    includeMetadata: true,
    compressionLevel: 6,
  });
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const handleExport = () => {
    if (geometry && (!validation || validation.isValid)) {
      // Update quality settings based on format
      const updatedSettings = {
        ...qualitySettings,
        includeColors: selectedFormat === '3mf' ? qualitySettings.includeColors : false,
      };
      onExport(selectedFormat, updatedSettings);
    }
  };

  const formatInfo = FORMAT_INFO[selectedFormat];
  // const _qualityInfo = QUALITY_LEVELS[qualitySettings.level];

  const estimateFileSize = (geom: BookmarkGeometry): number => {
    if (selectedFormat === 'stl') {
      // STL: 80 byte header + 4 byte count + 50 bytes per triangle
      return 84 + (geom.faceCount * 50);
    } else {
      // 3MF: More complex, rough estimate
      const xmlOverhead = 10 * 1024; // 10KB XML overhead
      const geometryData = geom.faceCount * 40; // Compressed estimate
      return xmlOverhead + geometryData;
    }
  };

  const canExport = geometry && (!validation || validation.isValid) && !exportState.isExporting;

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Export</h2>
        {geometry && (
          <div className="text-sm text-gray-500">
            {FileUtils.formatFileSize(estimateFileSize(geometry))} estimated
          </div>
        )}
      </div>

      {/* Format Selection */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">Export Format</label>

        <div className="grid gap-3">
          {Object.entries(FORMAT_INFO).map(([format, info]) => (
            <label key={format} className="relative">
              <input
                type="radio"
                name="format"
                value={format}
                checked={selectedFormat === format}
                onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                className="sr-only"
                disabled={exportState.isExporting}
              />
              <div className={`block w-full p-4 border-2 rounded-lg cursor-pointer transition-all ${
                selectedFormat === format
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${exportState.isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="font-medium text-gray-900">{info.name}</div>
                      <div className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {info.compatibility}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{info.description}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {info.features.map((feature) => (
                        <span key={feature} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          {feature}
                        </span>
                      ))}
                    </div>
                    {info.limitations.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {info.limitations.map((limitation) => (
                          <span key={limitation} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                            {limitation}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedFormat === format && (
                    <div className="flex-shrink-0 ml-4">
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Export Quality Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Export Quality</label>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-700"
            disabled={exportState.isExporting}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </button>
        </div>

        <div className="grid gap-3">
          {Object.entries(QUALITY_LEVELS).map(([level, info]) => (
            <label key={level} className="relative">
              <input
                type="radio"
                name="quality"
                value={level}
                checked={qualitySettings.level === level}
                onChange={(e) => setQualitySettings(prev => ({ 
                  ...prev, 
                  level: e.target.value as 'high' | 'medium' | 'low'
                }))}
                className="sr-only"
                disabled={exportState.isExporting}
              />
              <div className={`block w-full p-3 border rounded-lg cursor-pointer transition-all ${
                qualitySettings.level === level
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${exportState.isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{info.name}</div>
                    <div className="text-sm text-gray-600">{info.description}</div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>Size: {info.fileSize}</div>
                    <div>Print: {info.printTime}</div>
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900">Advanced Options</h4>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={qualitySettings.optimizeGeometry}
                  onChange={(e) => setQualitySettings(prev => ({ 
                    ...prev, 
                    optimizeGeometry: e.target.checked 
                  }))}
                  className="rounded border-gray-300"
                  disabled={exportState.isExporting}
                />
                <span className="text-sm text-gray-700">Optimize geometry for printing</span>
              </label>

              {selectedFormat === '3mf' && (
                <>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={qualitySettings.includeColors}
                      onChange={(e) => setQualitySettings(prev => ({ 
                        ...prev, 
                        includeColors: e.target.checked 
                      }))}
                      className="rounded border-gray-300"
                      disabled={exportState.isExporting}
                    />
                    <span className="text-sm text-gray-700">Include color information</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={qualitySettings.includeMetadata}
                      onChange={(e) => setQualitySettings(prev => ({ 
                        ...prev, 
                        includeMetadata: e.target.checked 
                      }))}
                      className="rounded border-gray-300"
                      disabled={exportState.isExporting}
                    />
                    <span className="text-sm text-gray-700">Include metadata</span>
                  </label>

                  <div className="space-y-2">
                    <label className="block text-sm text-gray-700">
                      Compression Level: {qualitySettings.compressionLevel}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="9"
                      value={qualitySettings.compressionLevel}
                      onChange={(e) => setQualitySettings(prev => ({ 
                        ...prev, 
                        compressionLevel: parseInt(e.target.value) 
                      }))}
                      className="w-full"
                      disabled={exportState.isExporting}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Faster</span>
                      <span>Smaller</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Validation Results */}
      {validation && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Quality Check</h4>
          
          {validation.errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-red-800">Export Issues Found</h4>
                  <ul className="mt-1 text-sm text-red-700 space-y-1">
                    {validation.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">Recommendations</h4>
                  <ul className="mt-1 text-sm text-yellow-700 space-y-1">
                    {validation.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {validation.isValid && validation.errors.length === 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="ml-3 text-sm font-medium text-green-800">Ready for export</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Print Settings Preview */}
      {printPreview && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Print Preview</h4>
          <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm">
              <span className="text-gray-600">Print Time:</span>
              <div className="font-medium">{Math.round(printPreview.estimatedPrintTime)}min</div>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Material:</span>
              <div className="font-medium">{printPreview.materialUsage.toFixed(1)}g</div>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Layer Height:</span>
              <div className="font-medium">{printPreview.layerHeight}mm</div>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Support:</span>
              <div className="font-medium">{printPreview.supportRequired ? 'Required' : 'None'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      {exportState.isExporting && (
        <ProgressIndicator
          exportState={exportState}
          onCancel={onCancel}
        />
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={!canExport}
        className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
          canExport
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {exportState.isExporting 
          ? `${exportState.stage === 'downloading' ? 'Downloading' : 'Exporting'}...`
          : `Export ${formatInfo.name}`
        }
      </button>

      {/* Export Success/Error */}
      {exportState.stage === 'complete' && exportState.lastExportedFile && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="text-sm font-medium text-green-800">Export completed successfully</div>
                <div className="text-sm text-green-700">File is ready for download</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Info */}
      {geometry && (
        <div className="text-sm text-gray-600 space-y-1 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div>Layers: {geometry.layers.length}</div>
            <div>Vertices: {geometry.vertexCount.toLocaleString()}</div>
            <div>Faces: {geometry.faceCount.toLocaleString()}</div>
            <div>File Size: {FileUtils.formatFileSize(estimateFileSize(geometry))}</div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {exportState.warnings.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">Export Warnings</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {exportState.warnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
