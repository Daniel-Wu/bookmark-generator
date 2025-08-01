import React from 'react';
import type { ExportState } from '../../types';

interface ProgressIndicatorProps {
  exportState: ExportState;
  onCancel?: () => void;
  className?: string;
}

/**
 * Stage configuration for the export process
 */
const EXPORT_STAGES = {
  validating: {
    label: 'Validating geometry',
    description: 'Checking geometry integrity and printability',
    duration: 10, // Percentage of total time
  },
  processing: {
    label: 'Processing layers',
    description: 'Optimizing geometry and preparing data',
    duration: 40,
  },
  generating: {
    label: 'Generating file',
    description: 'Creating export format and compressing data',
    duration: 30,
  },
  downloading: {
    label: 'Downloading',
    description: 'Preparing file for download',
    duration: 20,
  },
} as const;

/**
 * Multi-stage progress indicator with cancellation support
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  exportState,
  onCancel,
  className = '',
}) => {
  const { stage, progress, stageProgress, estimatedTimeRemaining, canCancel, error } = exportState;

  // Calculate overall progress based on stage and stage progress
  const getOverallProgress = (): number => {
    if (stage === 'idle' || stage === 'error') return 0;
    if (stage === 'complete') return 100;

    const stageOrder = ['validating', 'processing', 'generating', 'downloading'] as const;
    const currentStageIndex = stageOrder.indexOf(stage as any);
    
    if (currentStageIndex === -1) return progress * 100;

    // Calculate cumulative progress up to current stage
    let cumulativeProgress = 0;
    for (let i = 0; i < currentStageIndex; i++) {
      const stageName = stageOrder[i];
      cumulativeProgress += EXPORT_STAGES[stageName].duration;
    }

    // Add progress within current stage
    const currentStageDuration = EXPORT_STAGES[stage as keyof typeof EXPORT_STAGES]?.duration || 0;
    const stageContribution = currentStageDuration * stageProgress;

    return Math.min(100, cumulativeProgress + stageContribution);
  };

  const overallProgress = getOverallProgress();

  const formatTimeRemaining = (milliseconds: number): string => {
    const seconds = Math.ceil(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getCurrentStageInfo = () => {
    if (stage === 'idle') return null;
    if (stage === 'complete') return { label: 'Export complete', description: 'File is ready for download' };
    if (stage === 'error') return { label: 'Export failed', description: error || 'An unknown error occurred' };
    
    return EXPORT_STAGES[stage as keyof typeof EXPORT_STAGES] || {
      label: 'Processing',
      description: 'Export in progress',
    };
  };

  const stageInfo = getCurrentStageInfo();

  if (stage === 'idle') {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Stage Information */}
      {stageInfo && (
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">{stageInfo.label}</h3>
            <p className="text-xs text-gray-600 mt-1">{stageInfo.description}</p>
          </div>
          
          {/* Cancel Button */}
          {canCancel && onCancel && stage !== 'complete' && stage !== 'error' && (
            <button
              onClick={onCancel}
              className="ml-4 px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              title="Cancel export"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {stage !== 'error' && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Progress</span>
            <div className="flex items-center space-x-2">
              <span>{Math.round(overallProgress)}%</span>
              {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
                <span className="text-gray-500">
                  • {formatTimeRemaining(estimatedTimeRemaining)} remaining
                </span>
              )}
            </div>
          </div>
          
          {/* Overall Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          {/* Stage Progress Bar (for current stage detail) */}
          {stage !== 'complete' && stageProgress > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Current stage</span>
                <span>{Math.round(stageProgress * 100)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-400 h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${stageProgress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stage Timeline */}
      {exportState.isExporting && stage !== 'error' && (
        <div className="flex items-center justify-between text-xs">
          {Object.entries(EXPORT_STAGES).map(([stageName, stageConfig], index) => {
            const isPast = Object.keys(EXPORT_STAGES).indexOf(stage) > index;
            const isCurrent = stage === stageName;
            // const _isFuture = Object.keys(EXPORT_STAGES).indexOf(stage) < index;

            return (
              <div
                key={stageName}
                className={`flex-1 text-center px-1 ${
                  isPast ? 'text-green-600' : 
                  isCurrent ? 'text-blue-600 font-medium' : 
                  'text-gray-400'
                }`}
              >
                <div className={`w-2 h-2 mx-auto mb-1 rounded-full ${
                  isPast ? 'bg-green-600' :
                  isCurrent ? 'bg-blue-600' :
                  'bg-gray-300'
                }`} />
                <div className="truncate">{stageConfig.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Error State */}
      {stage === 'error' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Export failed</h3>
              <p className="text-sm text-red-700 mt-1">{error || 'An unknown error occurred during export'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {stage === 'complete' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Export completed successfully</h3>
              <p className="text-sm text-green-700">Your file is ready for download</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Simple circular progress indicator for inline use
 */
export const CircularProgress: React.FC<{
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}> = ({
  progress,
  size = 24,
  strokeWidth = 2,
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={`inline-flex ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-blue-600 transition-all duration-300"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};