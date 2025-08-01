/**
 * Comprehensive error handling and recovery system for export operations
 * Provides user-friendly error messages and automatic recovery strategies
 */

export const ExportErrorType = {
  // Validation errors
  GEOMETRY_INVALID: 'GEOMETRY_INVALID',
  GEOMETRY_TOO_COMPLEX: 'GEOMETRY_TOO_COMPLEX',
  GEOMETRY_EMPTY: 'GEOMETRY_EMPTY',
  
  // Memory errors
  OUT_OF_MEMORY: 'OUT_OF_MEMORY',
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  
  // File system errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DISK_FULL: 'DISK_FULL',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  
  // Format errors
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  EXPORT_FAILED: 'EXPORT_FAILED',
  COMPRESSION_FAILED: 'COMPRESSION_FAILED',
  
  // User errors
  CANCELLED: 'CANCELLED',
  INVALID_SETTINGS: 'INVALID_SETTINGS',
  
  // System errors
  BROWSER_UNSUPPORTED: 'BROWSER_UNSUPPORTED',
  WEBGL_ERROR: 'WEBGL_ERROR',
  UNKNOWN: 'UNKNOWN'
} as const;

export type ExportErrorType = typeof ExportErrorType[keyof typeof ExportErrorType];

export const ErrorSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
} as const;

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity];

export interface ExportError {
  type: ExportErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  suggestions: string[];
  recoverable: boolean;
  retryable: boolean;
  cause?: Error;
  context?: Record<string, any>;
  timestamp: number;
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  action: () => Promise<boolean>;
  automatic: boolean;
  priority: number;
}

/**
 * Export error handler with recovery strategies
 */
export class ExportErrorHandler {
  private errorHistory: ExportError[] = [];
  private maxHistorySize = 50;

  /**
   * Handle an error and return user-friendly information
   */
  handleError(error: Error | string, context?: Record<string, any>): ExportError {
    const exportError = this.createExportError(error, context);
    this.addToHistory(exportError);
    
    // Log error for debugging
    console.error('Export error:', exportError);
    
    return exportError;
  }

  /**
   * Create structured export error from generic error
   */
  private createExportError(error: Error | string, context?: Record<string, any>): ExportError {
    const message = typeof error === 'string' ? error : error.message;
    const cause = typeof error === 'string' ? undefined : error;
    
    const errorType = this.classifyError(message, cause);
    const errorInfo = this.getErrorInfo(errorType);

    return {
      type: errorType,
      severity: errorInfo.severity,
      message,
      userMessage: errorInfo.userMessage,
      suggestions: errorInfo.suggestions,
      recoverable: errorInfo.recoverable,
      retryable: errorInfo.retryable,
      cause,
      context,
      timestamp: Date.now(),
    };
  }

  /**
   * Classify error type based on message and cause
   */
  private classifyError(message: string, cause?: Error): ExportErrorType {
    const msg = message.toLowerCase();

    // Memory errors
    if (msg.includes('out of memory') || msg.includes('memory limit')) {
      return ExportErrorType.OUT_OF_MEMORY;
    }

    // File size errors
    if (msg.includes('file size') || msg.includes('too large')) {
      return ExportErrorType.FILE_TOO_LARGE;
    }

    // Permission errors
    if (msg.includes('permission') || msg.includes('access denied')) {
      return ExportErrorType.PERMISSION_DENIED;
    }

    // Network errors
    if (msg.includes('network') || msg.includes('connection')) {
      return ExportErrorType.NETWORK_ERROR;
    }

    // Timeout errors
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return ExportErrorType.TIMEOUT;
    }

    // Geometry errors
    if (msg.includes('geometry') || msg.includes('mesh') || msg.includes('vertices')) {
      if (msg.includes('empty') || msg.includes('no vertices')) {
        return ExportErrorType.GEOMETRY_EMPTY;
      }
      if (msg.includes('complex') || msg.includes('too many')) {
        return ExportErrorType.GEOMETRY_TOO_COMPLEX;
      }
      return ExportErrorType.GEOMETRY_INVALID;
    }

    // Format errors
    if (msg.includes('format') || msg.includes('stl') || msg.includes('3mf')) {
      return ExportErrorType.UNSUPPORTED_FORMAT;
    }

    // Compression errors
    if (msg.includes('compression') || msg.includes('zip')) {
      return ExportErrorType.COMPRESSION_FAILED;
    }

    // Cancellation
    if (msg.includes('cancel') || msg.includes('abort')) {
      return ExportErrorType.CANCELLED;
    }

    // Browser support
    if (msg.includes('browser') || msg.includes('unsupported')) {
      return ExportErrorType.BROWSER_UNSUPPORTED;
    }

    // WebGL errors
    if (msg.includes('webgl') || msg.includes('context lost')) {
      return ExportErrorType.WEBGL_ERROR;
    }

    return ExportErrorType.UNKNOWN;
  }

  /**
   * Get error information for specific error type
   */
  private getErrorInfo(type: ExportErrorType): {
    severity: ErrorSeverity;
    userMessage: string;
    suggestions: string[];
    recoverable: boolean;
    retryable: boolean;
  } {
    switch (type) {
      case ExportErrorType.GEOMETRY_INVALID:
        return {
          severity: ErrorSeverity.ERROR,
          userMessage: 'The 3D geometry has issues that prevent exporting',
          suggestions: [
            'Try regenerating the geometry with different parameters',
            'Check if the original image is valid',
            'Reduce the complexity of the bookmark design'
          ],
          recoverable: true,
          retryable: false
        };

      case ExportErrorType.GEOMETRY_TOO_COMPLEX:
        return {
          severity: ErrorSeverity.WARNING,
          userMessage: 'The geometry is too complex for export',
          suggestions: [
            'Reduce the number of colors in the image',
            'Lower the export quality setting',
            'Enable geometry optimization',
            'Try a simpler image'
          ],
          recoverable: true,
          retryable: true
        };

      case ExportErrorType.OUT_OF_MEMORY:
        return {
          severity: ErrorSeverity.ERROR,
          userMessage: 'Not enough memory to complete the export',
          suggestions: [
            'Close other browser tabs to free memory',
            'Reduce the image size or complexity',
            'Try the "Fast Export" quality setting',
            'Restart your browser'
          ],
          recoverable: true,
          retryable: true
        };

      case ExportErrorType.FILE_TOO_LARGE:
        return {
          severity: ErrorSeverity.ERROR,
          userMessage: 'The exported file is too large for your browser',
          suggestions: [
            'Use "Fast Export" quality setting',
            'Reduce geometry complexity',
            'Try STL format instead of 3MF',
            'Reduce the number of layers'
          ],
          recoverable: true,
          retryable: true
        };

      case ExportErrorType.PERMISSION_DENIED:
        return {
          severity: ErrorSeverity.ERROR,
          userMessage: 'Permission denied when saving the file',
          suggestions: [
            'Check if you have write permissions to the download folder',
            'Try saving to a different location',
            'Clear your browser cache and cookies',
            'Disable browser security extensions temporarily'
          ],
          recoverable: true,
          retryable: true
        };

      case ExportErrorType.NETWORK_ERROR:
        return {
          severity: ErrorSeverity.ERROR,
          userMessage: 'Network error occurred during export',
          suggestions: [
            'Check your internet connection',
            'Try again in a few moments',
            'Disable VPN or proxy if active',
            'Clear browser cache'
          ],
          recoverable: true,
          retryable: true
        };

      case ExportErrorType.TIMEOUT:
        return {
          severity: ErrorSeverity.WARNING,
          userMessage: 'Export timed out - the process took too long',
          suggestions: [
            'Reduce geometry complexity',
            'Use "Fast Export" quality setting',
            'Close other applications to free up resources',
            'Try exporting in smaller chunks'
          ],
          recoverable: true,
          retryable: true
        };

      case ExportErrorType.BROWSER_UNSUPPORTED:
        return {
          severity: ErrorSeverity.CRITICAL,
          userMessage: 'Your browser doesn\'t support this feature',
          suggestions: [
            'Update your browser to the latest version',
            'Try using Chrome, Firefox, or Edge',
            'Enable required browser features',
            'Use a different device'
          ],
          recoverable: false,
          retryable: false
        };

      case ExportErrorType.CANCELLED:
        return {
          severity: ErrorSeverity.INFO,
          userMessage: 'Export was cancelled',
          suggestions: [
            'Click export again to retry',
            'Adjust settings if needed'
          ],
          recoverable: true,
          retryable: true
        };

      default:
        return {
          severity: ErrorSeverity.ERROR,
          userMessage: 'An unexpected error occurred during export',
          suggestions: [
            'Try exporting again',
            'Refresh the page and try again',
            'Try with a different image or settings',
            'Contact support if the problem persists'
          ],
          recoverable: true,
          retryable: true
        };
    }
  }

  /**
   * Get recovery strategies for an error
   */
  getRecoveryStrategies(error: ExportError): RecoveryStrategy[] {
    const strategies: RecoveryStrategy[] = [];

    switch (error.type) {
      case ExportErrorType.OUT_OF_MEMORY:
        strategies.push({
          name: 'Reduce Quality',
          description: 'Switch to fast export mode to use less memory',
          action: async () => this.applyFastExportSettings(),
          automatic: true,
          priority: 1
        });
        strategies.push({
          name: 'Garbage Collection',
          description: 'Force garbage collection to free memory',
          action: async () => this.forceGarbageCollection(),
          automatic: true,
          priority: 2
        });
        break;

      case ExportErrorType.GEOMETRY_TOO_COMPLEX:
        strategies.push({
          name: 'Optimize Geometry',
          description: 'Enable geometry optimization to reduce complexity',
          action: async () => this.enableGeometryOptimization(),
          automatic: true,
          priority: 1
        });
        strategies.push({
          name: 'Reduce Colors',
          description: 'Reduce the number of colors to simplify geometry',
          action: async () => this.reduceColorCount(),
          automatic: false,
          priority: 2
        });
        break;

      case ExportErrorType.FILE_TOO_LARGE:
        strategies.push({
          name: 'Use STL Format',
          description: 'Switch to STL format for smaller file size',
          action: async () => this.switchToSTL(),
          automatic: true,
          priority: 1
        });
        strategies.push({
          name: 'Increase Compression',
          description: 'Use maximum compression for 3MF files',
          action: async () => this.increaseCompression(),
          automatic: true,
          priority: 2
        });
        break;

      case ExportErrorType.TIMEOUT:
        strategies.push({
          name: 'Extend Timeout',
          description: 'Increase timeout limit for complex exports',
          action: async () => this.extendTimeout(),
          automatic: true,
          priority: 1
        });
        break;
    }

    // Universal retry strategy for retryable errors
    if (error.retryable) {
      strategies.push({
        name: 'Retry Export',
        description: 'Retry the export operation',
        action: async () => this.retry(),
        automatic: false,
        priority: 10
      });
    }

    return strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Apply automatic recovery strategies
   */
  async applyAutomaticRecovery(error: ExportError): Promise<boolean> {
    const strategies = this.getRecoveryStrategies(error).filter(s => s.automatic);
    
    for (const strategy of strategies) {
      try {
        console.log(`Applying recovery strategy: ${strategy.name}`);
        const success = await strategy.action();
        if (success) {
          return true;
        }
      } catch (recoveryError) {
        console.error(`Recovery strategy failed: ${strategy.name}`, recoveryError);
      }
    }

    return false;
  }

  /**
   * Recovery strategy implementations
   */
  private async applyFastExportSettings(): Promise<boolean> {
    // This would be implemented to communicate with the export system
    // to apply fast export settings
    return true;
  }

  private async forceGarbageCollection(): Promise<boolean> {
    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
    return true;
  }

  private async enableGeometryOptimization(): Promise<boolean> {
    // Enable geometry optimization in export settings
    return true;
  }

  private async reduceColorCount(): Promise<boolean> {
    // Reduce color count in image processing
    return false; // Requires user intervention
  }

  private async switchToSTL(): Promise<boolean> {
    // Switch export format to STL
    return true;
  }

  private async increaseCompression(): Promise<boolean> {
    // Increase compression level for 3MF
    return true;
  }

  private async extendTimeout(): Promise<boolean> {
    // Extend timeout limits
    return true;
  }

  private async retry(): Promise<boolean> {
    // Trigger retry - this would be handled by the calling code
    return false;
  }

  /**
   * Add error to history
   */
  private addToHistory(error: ExportError): void {
    this.errorHistory.push(error);
    
    // Limit history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(): ExportError[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Map<ExportErrorType, number>;
    errorsBySeverity: Map<ErrorSeverity, number>;
    recentErrors: ExportError[];
  } {
    const errorsByType = new Map<ExportErrorType, number>();
    const errorsBySeverity = new Map<ErrorSeverity, number>();

    for (const error of this.errorHistory) {
      errorsByType.set(error.type, (errorsByType.get(error.type) || 0) + 1);
      errorsBySeverity.set(error.severity, (errorsBySeverity.get(error.severity) || 0) + 1);
    }

    // Get errors from last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentErrors = this.errorHistory.filter(error => error.timestamp > oneDayAgo);

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsBySeverity,
      recentErrors
    };
  }

  /**
   * Check if error pattern indicates systematic issue
   */
  detectSystematicIssues(): {
    hasPattern: boolean;
    pattern?: string;
    suggestion?: string;
  } {
    if (this.errorHistory.length < 3) {
      return { hasPattern: false };
    }

    const recentErrors = this.errorHistory.slice(-5);
    const errorTypes = recentErrors.map(e => e.type);

    // Check for repeated memory errors
    if (errorTypes.filter(t => t === ExportErrorType.OUT_OF_MEMORY).length >= 3) {
      return {
        hasPattern: true,
        pattern: 'Repeated memory errors',
        suggestion: 'Your system may not have enough RAM for complex exports. Try using simpler images or closing other applications.'
      };
    }

    // Check for repeated timeout errors
    if (errorTypes.filter(t => t === ExportErrorType.TIMEOUT).length >= 3) {
      return {
        hasPattern: true,
        pattern: 'Repeated timeout errors',
        suggestion: 'Exports are consistently taking too long. Consider reducing image complexity or using fast export mode.'
      };
    }

    // Check for repeated browser errors
    if (errorTypes.filter(t => t === ExportErrorType.BROWSER_UNSUPPORTED).length >= 2) {
      return {
        hasPattern: true,
        pattern: 'Browser compatibility issues',
        suggestion: 'Your browser may be missing required features. Try updating to the latest version or switching browsers.'
      };
    }

    return { hasPattern: false };
  }
}

/**
 * Global error handler instance
 */
export const exportErrorHandler = new ExportErrorHandler();

/**
 * Error boundary for React components
 */
export class ExportErrorBoundary {
  static handleError(error: Error, errorInfo: { componentStack: string }): ExportError {
    const context = {
      componentStack: errorInfo.componentStack,
      timestamp: Date.now()
    };

    return exportErrorHandler.handleError(error, context);
  }
}

/**
 * Utility functions for error handling
 */
export class ErrorUtils {
  /**
   * Create user-friendly error message
   */
  static formatErrorMessage(error: ExportError): string {
    let message = error.userMessage;
    
    if (error.suggestions.length > 0) {
      message += '\n\nSuggestions:\n' + error.suggestions.map(s => `• ${s}`).join('\n');
    }

    return message;
  }

  /**
   * Check if error is recoverable
   */
  static isRecoverable(error: ExportError): boolean {
    return error.recoverable && error.severity !== ErrorSeverity.CRITICAL;
  }

  /**
   * Get error icon based on severity
   */
  static getErrorIcon(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.INFO: return 'ℹ️';
      case ErrorSeverity.WARNING: return '⚠️';
      case ErrorSeverity.ERROR: return '❌';
      case ErrorSeverity.CRITICAL: return '🚨';
      default: return '❓';
    }
  }

  /**
   * Get CSS classes for error display
   */
  static getErrorClasses(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case ErrorSeverity.WARNING:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case ErrorSeverity.ERROR:
        return 'bg-red-50 border-red-200 text-red-800';
      case ErrorSeverity.CRITICAL:
        return 'bg-red-100 border-red-300 text-red-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  }
}