/**
 * Export progress tracking system with stage-based reporting
 * Provides real-time progress updates and time estimation
 */

import type { ExportState } from '../../types';

export type ExportStage = 'idle' | 'validating' | 'processing' | 'generating' | 'downloading' | 'complete' | 'error';

export interface ProgressUpdate {
  stage: ExportStage;
  stageProgress: number; // 0-1
  overallProgress: number; // 0-1
  estimatedTimeRemaining?: number; // milliseconds
  message?: string;
  canCancel?: boolean;
}

export interface StageDefinition {
  name: string;
  description: string;
  duration: number; // Percentage of total time
  canCancel: boolean;
}

/**
 * Export progress tracker with time estimation
 */
export class ExportProgressTracker {
  private stages: Record<ExportStage, StageDefinition> = {
    idle: { name: 'Idle', description: 'Ready to export', duration: 0, canCancel: false },
    validating: { name: 'Validating', description: 'Checking geometry integrity', duration: 10, canCancel: true },
    processing: { name: 'Processing', description: 'Optimizing geometry', duration: 40, canCancel: true },
    generating: { name: 'Generating', description: 'Creating export file', duration: 30, canCancel: false },
    downloading: { name: 'Downloading', description: 'Saving file', duration: 20, canCancel: false },
    complete: { name: 'Complete', description: 'Export finished', duration: 100, canCancel: false },
    error: { name: 'Error', description: 'Export failed', duration: 0, canCancel: false },
  };

  private startTime: number = 0;
  private currentStage: ExportStage = 'idle';
  private stageStartTime: number = 0;
  private stageProgress: number = 0;
  private listeners: Set<(update: ProgressUpdate) => void> = new Set();
  private cancelled: boolean = false;
  private error: string | null = null;
  private warnings: string[] = [];

  /**
   * Start the export process
   */
  start(): void {
    this.startTime = Date.now();
    this.currentStage = 'idle';
    this.stageStartTime = this.startTime;
    this.stageProgress = 0;
    this.cancelled = false;
    this.error = null;
    this.warnings = [];
    this.emitUpdate();
  }

  /**
   * Move to the next stage
   */
  moveToStage(stage: ExportStage, message?: string): void {
    if (this.cancelled && stage !== 'error') {
      return;
    }

    this.currentStage = stage;
    this.stageStartTime = Date.now();
    this.stageProgress = 0;

    this.emitUpdate({
      message,
    });
  }

  /**
   * Update progress within the current stage
   */
  updateStageProgress(progress: number, message?: string): void {
    if (this.cancelled && this.currentStage !== 'error') {
      return;
    }

    this.stageProgress = Math.max(0, Math.min(1, progress));
    this.emitUpdate({ message });
  }

  /**
   * Add a warning message
   */
  addWarning(warning: string): void {
    this.warnings.push(warning);
    this.emitUpdate();
  }

  /**
   * Set error state
   */
  setError(error: string): void {
    this.error = error;
    this.currentStage = 'error';
    this.emitUpdate();
  }

  /**
   * Cancel the export process
   */
  cancel(): void {
    this.cancelled = true;
    this.setError('Export cancelled by user');
  }

  /**
   * Complete the export process
   */
  complete(): void {
    this.currentStage = 'complete';
    this.stageProgress = 1;
    this.emitUpdate();
  }

  /**
   * Get current state
   */
  getState(): ExportState {
    return {
      format: 'stl', // Will be set externally
      isExporting: this.isExporting(),
      progress: this.getOverallProgress(),
      stage: this.currentStage,
      stageProgress: this.stageProgress,
      estimatedTimeRemaining: this.getEstimatedTimeRemaining(),
      canCancel: this.canCancel(),
      lastExportedFile: null, // Will be set externally
      error: this.error || undefined,
      warnings: [...this.warnings],
    };
  }

  /**
   * Check if export is in progress
   */
  isExporting(): boolean {
    return this.currentStage !== 'idle' && 
           this.currentStage !== 'complete' && 
           this.currentStage !== 'error';
  }

  /**
   * Check if current stage can be cancelled
   */
  canCancel(): boolean {
    return this.stages[this.currentStage]?.canCancel && !this.cancelled;
  }

  /**
   * Calculate overall progress (0-1)
   */
  private getOverallProgress(): number {
    if (this.currentStage === 'idle') return 0;
    if (this.currentStage === 'complete') return 1;
    if (this.currentStage === 'error') return 0;

    const stageOrder: ExportStage[] = ['validating', 'processing', 'generating', 'downloading'];
    const currentStageIndex = stageOrder.indexOf(this.currentStage);
    
    if (currentStageIndex === -1) return 0;

    // Calculate cumulative progress up to current stage
    let cumulativeProgress = 0;
    for (let i = 0; i < currentStageIndex; i++) {
      const stageName = stageOrder[i];
      cumulativeProgress += this.stages[stageName].duration;
    }

    // Add progress within current stage
    const currentStageDuration = this.stages[this.currentStage].duration;
    const stageContribution = currentStageDuration * this.stageProgress;

    return Math.min(1, (cumulativeProgress + stageContribution) / 100);
  }

  /**
   * Estimate remaining time in milliseconds
   */
  private getEstimatedTimeRemaining(): number | undefined {
    if (this.currentStage === 'idle' || this.currentStage === 'complete' || this.currentStage === 'error') {
      return undefined;
    }

    const elapsedTime = Date.now() - this.startTime;
    const overallProgress = this.getOverallProgress();

    if (overallProgress <= 0) return undefined;

    const totalEstimatedTime = elapsedTime / overallProgress;
    const remainingTime = totalEstimatedTime - elapsedTime;

    return Math.max(0, remainingTime);
  }

  /**
   * Add progress listener
   */
  addListener(listener: (update: ProgressUpdate) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove progress listener
   */
  removeListener(listener: (update: ProgressUpdate) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Emit progress update to all listeners
   */
  private emitUpdate(extra: Partial<ProgressUpdate> = {}): void {
    const update: ProgressUpdate = {
      stage: this.currentStage,
      stageProgress: this.stageProgress,
      overallProgress: this.getOverallProgress(),
      estimatedTimeRemaining: this.getEstimatedTimeRemaining(),
      canCancel: this.canCancel(),
      ...extra,
    };

    this.listeners.forEach(listener => {
      try {
        listener(update);
      } catch (error) {
        console.error('Error in progress listener:', error);
      }
    });
  }

  /**
   * Create a progress tracker with stage timing optimization
   */
  static createOptimized(geometryComplexity: 'low' | 'medium' | 'high'): ExportProgressTracker {
    const tracker = new ExportProgressTracker();

    // Adjust stage durations based on geometry complexity
    switch (geometryComplexity) {
      case 'low':
        tracker.stages.validating.duration = 5;
        tracker.stages.processing.duration = 30;
        tracker.stages.generating.duration = 40;
        tracker.stages.downloading.duration = 25;
        break;
      
      case 'medium':
        // Default durations
        break;
      
      case 'high':
        tracker.stages.validating.duration = 15;
        tracker.stages.processing.duration = 50;
        tracker.stages.generating.duration = 25;
        tracker.stages.downloading.duration = 10;
        break;
    }

    return tracker;
  }

  /**
   * Create progress tracker for specific export format
   */
  static createForFormat(format: 'stl' | '3mf'): ExportProgressTracker {
    const tracker = new ExportProgressTracker();

    if (format === '3mf') {
      // 3MF requires more processing time due to compression and metadata
      tracker.stages.processing.duration = 35;
      tracker.stages.generating.duration = 40;
      tracker.stages.downloading.duration = 15;
    } else {
      // STL is simpler and faster
      tracker.stages.processing.duration = 45;
      tracker.stages.generating.duration = 25;
      tracker.stages.downloading.duration = 20;
    }

    return tracker;
  }
}

/**
 * Progress estimation utilities
 */
export class ProgressEstimator {
  /**
   * Estimate total export time based on geometry complexity
   */
  static estimateExportTime(
    vertexCount: number,
    faceCount: number,
    format: 'stl' | '3mf'
  ): number {
    // Base time in milliseconds
    let baseTime = 2000; // 2 seconds minimum

    // Add time based on geometry complexity
    const vertexTime = Math.min(vertexCount * 0.01, 5000); // Max 5 seconds for vertices
    const faceTime = Math.min(faceCount * 0.02, 10000); // Max 10 seconds for faces

    // Format-specific multipliers
    const formatMultiplier = format === '3mf' ? 1.5 : 1.0;

    const totalTime = (baseTime + vertexTime + faceTime) * formatMultiplier;

    return Math.max(1000, totalTime); // Minimum 1 second
  }

  /**
   * Get geometry complexity level
   */
  static getComplexityLevel(vertexCount: number, faceCount: number): 'low' | 'medium' | 'high' {
    const totalElements = vertexCount + faceCount;

    if (totalElements < 10000) return 'low';
    if (totalElements < 100000) return 'medium';
    return 'high';
  }

  /**
   * Calculate memory usage estimate for export
   */
  static estimateMemoryUsage(vertexCount: number, faceCount: number, format: 'stl' | '3mf'): number {
    // Rough estimates in bytes
    const vertexMemory = vertexCount * 12; // 3 floats per vertex
    const faceMemory = faceCount * 50; // More memory per face for processing
    
    // Format-specific overhead
    const formatOverhead = format === '3mf' ? 1.8 : 1.2; // 3MF uses more memory

    return (vertexMemory + faceMemory) * formatOverhead;
  }
}

/**
 * Export performance monitor
 */
export class ExportPerformanceMonitor {
  private metrics: {
    startTime: number;
    stageStartTimes: Map<ExportStage, number>;
    memoryUsage: Map<ExportStage, number>;
  } = {
    startTime: 0,
    stageStartTimes: new Map(),
    memoryUsage: new Map(),
  };

  /**
   * Start monitoring
   */
  start(): void {
    this.metrics.startTime = Date.now();
    this.recordMemoryUsage('idle');
  }

  /**
   * Record stage start
   */
  recordStageStart(stage: ExportStage): void {
    this.metrics.stageStartTimes.set(stage, Date.now());
    this.recordMemoryUsage(stage);
  }

  /**
   * Get stage duration
   */
  getStageDuration(stage: ExportStage): number | undefined {
    const startTime = this.metrics.stageStartTimes.get(stage);
    return startTime ? Date.now() - startTime : undefined;
  }

  /**
   * Get total duration
   */
  getTotalDuration(): number {
    return Date.now() - this.metrics.startTime;
  }

  /**
   * Record memory usage
   */
  private recordMemoryUsage(stage: ExportStage): void {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.metrics.memoryUsage.set(stage, memInfo.usedJSHeapSize);
    }
  }

  /**
   * Get memory usage for stage
   */
  getMemoryUsage(stage: ExportStage): number | undefined {
    return this.metrics.memoryUsage.get(stage);
  }

  /**
   * Get performance report
   */
  getReport(): {
    totalDuration: number;
    stageDurations: Map<ExportStage, number>;
    memoryUsage: Map<ExportStage, number>;
    averageMemoryIncrease: number;
  } {
    const stageDurations = new Map<ExportStage, number>();
    
    for (const [stage, startTime] of this.metrics.stageStartTimes) {
      stageDurations.set(stage, Date.now() - startTime);
    }

    // Calculate average memory increase per stage
    const memoryValues = Array.from(this.metrics.memoryUsage.values());
    const averageMemoryIncrease = memoryValues.length > 1 
      ? (memoryValues[memoryValues.length - 1] - memoryValues[0]) / (memoryValues.length - 1)
      : 0;

    return {
      totalDuration: this.getTotalDuration(),
      stageDurations,
      memoryUsage: this.metrics.memoryUsage,
      averageMemoryIncrease,
    };
  }
}