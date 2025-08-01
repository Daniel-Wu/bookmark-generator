import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotifications } from './NotificationSystem';

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  memoryLimit: number;
  processingTime: number;
  renderTime: number;
  loadTime: number;
}

interface LoadingStateProps {
  isLoading: boolean;
  progress?: number;
  stage?: string;
  substage?: string;
  estimatedTime?: number;
  canCancel?: boolean;
  onCancel?: () => void;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  variant?: 'spinner' | 'progress' | 'skeleton' | 'pulse';
  message?: string;
  className?: string;
}

interface MemoryWarningProps {
  currentUsage: number;
  limit: number;
  onOptimize?: () => void;
  onDismiss?: () => void;
}

interface PerformanceMonitorProps {
  showFPS?: boolean;
  showMemory?: boolean;
  showRenderTime?: boolean;
  warningThresholds?: {
    fps: number;
    memoryUsage: number;
    renderTime: number;
  };
  onPerformanceWarning?: (metric: string, value: number) => void;
}

/**
 * Advanced loading state component with multiple variants
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  isLoading,
  progress,
  stage = 'Processing',
  substage,
  estimatedTime,
  canCancel = false,
  onCancel,
  size = 'medium',
  variant = 'spinner',
  message,
  className = ''
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isLoading) {
      startTimeRef.current = Date.now();
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current);
      }, 100);

      return () => clearInterval(interval);
    } else {
      setElapsedTime(0);
    }
  }, [isLoading]);

  if (!isLoading) return null;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const getProgressPercentage = () => {
    if (typeof progress === 'number') {
      return Math.round(progress * 100);
    }
    return 0;
  };

  const sizeClasses = {
    small: 'p-2 text-sm',
    medium: 'p-4 text-base',
    large: 'p-6 text-lg',
    fullscreen: 'fixed inset-0 z-50 bg-white bg-opacity-90 backdrop-blur-sm flex items-center justify-center'
  };

  const containerClass = size === 'fullscreen' 
    ? sizeClasses.fullscreen 
    : `flex items-center justify-center ${sizeClasses[size]} ${className}`;

  const renderSpinner = () => (
    <div className="flex flex-col items-center space-y-4">
      <div className={`animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 ${
        size === 'small' ? 'h-6 w-6' : 
        size === 'medium' ? 'h-8 w-8' : 
        size === 'large' ? 'h-12 w-12' : 'h-16 w-16'
      }`} />
      
      <div className="text-center">
        <div className="font-medium text-gray-900">{stage}</div>
        {substage && <div className="text-sm text-gray-600 mt-1">{substage}</div>}
        {message && <div className="text-sm text-gray-500 mt-2">{message}</div>}
        
        <div className="flex items-center justify-center space-x-4 mt-3 text-xs text-gray-500">
          <span>Elapsed: {formatTime(elapsedTime)}</span>
          {estimatedTime && (
            <span>Est: {formatTime(estimatedTime)}</span>
          )}
        </div>
      </div>

      {canCancel && onCancel && (
        <button
          onClick={onCancel}
          className="mt-4 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );

  const renderProgressBar = () => (
    <div className="w-full max-w-md">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{stage}</span>
        <span className="text-sm text-gray-500">{getProgressPercentage()}%</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${getProgressPercentage()}%` }}
        />
      </div>
      
      {substage && (
        <div className="text-xs text-gray-600 mb-2">{substage}</div>
      )}
      
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>Elapsed: {formatTime(elapsedTime)}</span>
        {estimatedTime && (
          <span>Remaining: {formatTime(Math.max(0, estimatedTime - elapsedTime))}</span>
        )}
      </div>

      {canCancel && onCancel && (
        <button
          onClick={onCancel}
          className="mt-3 w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Cancel Operation
        </button>
      )}
    </div>
  );

  const renderSkeleton = () => (
    <div className="animate-pulse space-y-3 w-full">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
      </div>
      <div className="h-8 bg-gray-200 rounded w-1/2"></div>
    </div>
  );

  const renderPulse = () => (
    <div className="flex items-center space-x-3">
      <div className="animate-pulse h-4 w-4 bg-blue-500 rounded-full"></div>
      <span className="text-gray-700">{stage}...</span>
    </div>
  );

  return (
    <div className={containerClass} role="status" aria-live="polite">
      {variant === 'spinner' && renderSpinner()}
      {variant === 'progress' && renderProgressBar()}
      {variant === 'skeleton' && renderSkeleton()}
      {variant === 'pulse' && renderPulse()}
    </div>
  );
};

/**
 * Memory usage warning component
 */
export const MemoryWarning: React.FC<MemoryWarningProps> = ({
  currentUsage,
  limit,
  onOptimize,
  onDismiss
}) => {
  const usagePercentage = (currentUsage / limit) * 100;
  const isHigh = usagePercentage > 80;
  const isCritical = usagePercentage > 95;

  const formatMemory = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (usagePercentage < 70) return null;

  return (
    <div className={`
      fixed top-4 left-4 max-w-sm p-4 rounded-lg shadow-lg border z-50
      ${isCritical ? 'bg-red-50 border-red-200' : 
        isHigh ? 'bg-yellow-50 border-yellow-200' : 
        'bg-blue-50 border-blue-200'}
    `}>
      <div className="flex items-start">
        <div className={`flex-shrink-0 ${
          isCritical ? 'text-red-400' : isHigh ? 'text-yellow-400' : 'text-blue-400'
        }`}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.08 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${
            isCritical ? 'text-red-800' : isHigh ? 'text-yellow-800' : 'text-blue-800'
          }`}>
            {isCritical ? 'Critical Memory Usage' : 'High Memory Usage'}
          </h3>
          
          <div className="mt-1 text-sm text-gray-600">
            <p>{formatMemory(currentUsage)} of {formatMemory(limit)} used ({usagePercentage.toFixed(1)}%)</p>
          </div>

          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                isCritical ? 'bg-red-500' : isHigh ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>

          <div className="mt-3 flex space-x-2">
            {onOptimize && (
              <button
                onClick={onOptimize}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  isCritical ? 'bg-red-600 text-white hover:bg-red-700' :
                  isHigh ? 'bg-yellow-600 text-white hover:bg-yellow-700' :
                  'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Optimize Memory
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Real-time performance monitor
 */
export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  showFPS = true,
  showMemory = true,
  showRenderTime = false,
  warningThresholds = {
    fps: 30,
    memoryUsage: 0.8,
    renderTime: 16.67 // 60fps = 16.67ms per frame
  },
  onPerformanceWarning
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memoryUsage: 0,
    memoryLimit: 0,
    processingTime: 0,
    renderTime: 0,
    loadTime: 0
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const { showWarning } = useNotifications();

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    let animationId: number;
    let lastWarningTime = 0;

    const updateMetrics = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      
      frameCountRef.current++;
      
      // Calculate FPS every second
      if (delta >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / delta);
        
        // Keep FPS history for smoothing
        fpsHistoryRef.current.push(fps);
        if (fpsHistoryRef.current.length > 10) {
          fpsHistoryRef.current.shift();
        }
        
        const avgFps = fpsHistoryRef.current.reduce((sum, f) => sum + f, 0) / fpsHistoryRef.current.length;
        
        // Get memory info if available
        let memoryUsage = 0;
        let memoryLimit = 0;
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          memoryUsage = memory.usedJSHeapSize;
          memoryLimit = memory.jsHeapSizeLimit;
        }

        setMetrics(prev => ({
          ...prev,
          fps: avgFps,
          memoryUsage,
          memoryLimit,
          renderTime: delta / frameCountRef.current
        }));

        // Check for performance warnings
        const currentTime = Date.now();
        if (currentTime - lastWarningTime > 30000) { // Throttle warnings to every 30 seconds
          if (avgFps < warningThresholds.fps) {
            onPerformanceWarning?.('fps', avgFps);
            showWarning(
              'Low Frame Rate',
              `Performance may be degraded (${avgFps.toFixed(1)} FPS). Consider reducing quality settings.`
            );
            lastWarningTime = currentTime;
          }

          if (memoryLimit > 0 && (memoryUsage / memoryLimit) > warningThresholds.memoryUsage) {
            onPerformanceWarning?.('memory', memoryUsage / memoryLimit);
            showWarning(
              'High Memory Usage',
              `Memory usage is high (${((memoryUsage / memoryLimit) * 100).toFixed(1)}%). Some features may be slower.`
            );
            lastWarningTime = currentTime;
          }
        }

        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      animationId = requestAnimationFrame(updateMetrics);
    };

    animationId = requestAnimationFrame(updateMetrics);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [warningThresholds, onPerformanceWarning, showWarning]);

  const formatMemory = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getPerformanceColor = (value: number, threshold: number, isInverted = false) => {
    const isGood = isInverted ? value < threshold : value > threshold;
    return isGood ? 'text-green-600' : value > threshold * 0.8 ? 'text-yellow-600' : 'text-red-600';
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className={`
        bg-white rounded-lg shadow-lg border transition-all duration-300
        ${isExpanded ? 'p-4' : 'p-2'}
      `}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm">
            {showFPS && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">FPS:</span>
                <span className={getPerformanceColor(metrics.fps, warningThresholds.fps)}>
                  {metrics.fps.toFixed(1)}
                </span>
              </div>
            )}
            
            {showMemory && metrics.memoryLimit > 0 && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">RAM:</span>
                <span className={getPerformanceColor(
                  metrics.memoryUsage / metrics.memoryLimit, 
                  warningThresholds.memoryUsage, 
                  true
                )}>
                  {formatMemory(metrics.memoryUsage)}
                </span>
              </div>
            )}
            
            {showRenderTime && isExpanded && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">Render:</span>
                <span className={getPerformanceColor(metrics.renderTime, warningThresholds.renderTime, true)}>
                  {metrics.renderTime.toFixed(1)}ms
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={isExpanded ? "Collapse performance monitor" : "Expand performance monitor"}
          >
            <svg 
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t space-y-2 text-xs text-gray-600">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-medium">Performance Status</div>
                <div className={`mt-1 ${
                  metrics.fps >= warningThresholds.fps ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metrics.fps >= warningThresholds.fps ? 'Good' : 'Degraded'}
                </div>
              </div>
              
              {metrics.memoryLimit > 0 && (
                <div>
                  <div className="font-medium">Memory Usage</div>
                  <div className="mt-1">
                    {((metrics.memoryUsage / metrics.memoryLimit) * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t">
              <div className="text-gray-500 text-xs">
                Monitor updates every second
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Loading skeleton component for content that's being loaded
 */
export const LoadingSkeleton: React.FC<{
  lines?: number;
  avatar?: boolean;
  className?: string;
}> = ({
  lines = 3,
  avatar = false,
  className = ''
}) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {avatar && (
        <div className="flex items-center space-x-3 mb-4">
          <div className="rounded-full bg-gray-200 h-10 w-10"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div 
            key={index} 
            className={`h-4 bg-gray-200 rounded ${
              index === lines - 1 ? 'w-2/3' : 'w-full'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Hook for managing loading states with automatic timeout
 */
export function useLoadingState(timeoutMs?: number) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const timeoutRef = useRef<number | undefined>(undefined);

  const startLoading = useCallback((initialStage?: string) => {
    setIsLoading(true);
    setProgress(0);
    setStage(initialStage || 'Loading');

    if (timeoutMs) {
      timeoutRef.current = window.setTimeout(() => {
        setIsLoading(false);
        console.warn('Loading operation timed out');
      }, timeoutMs);
    }
  }, [timeoutMs]);

  const updateProgress = useCallback((newProgress: number, newStage?: string) => {
    setProgress(Math.max(0, Math.min(1, newProgress)));
    if (newStage) {
      setStage(newStage);
    }
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setProgress(0);
    setStage('');
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isLoading,
    progress,
    stage,
    startLoading,
    updateProgress,
    stopLoading
  };
}