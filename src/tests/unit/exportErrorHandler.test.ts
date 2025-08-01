import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ExportErrorHandler, 
  ExportErrorType, 
  ErrorSeverity,
  ErrorUtils,
  exportErrorHandler 
} from '../../modules/export/errorHandler';

describe('ExportErrorHandler', () => {
  let errorHandler: ExportErrorHandler;

  beforeEach(() => {
    errorHandler = new ExportErrorHandler();
    errorHandler.clearHistory();
  });

  describe('error classification', () => {
    it('classifies memory errors correctly', () => {
      const error = errorHandler.handleError('Out of memory during export');
      
      expect(error.type).toBe(ExportErrorType.OUT_OF_MEMORY);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.retryable).toBe(true);
    });

    it('classifies geometry errors correctly', () => {
      const error = errorHandler.handleError('Geometry has no vertices');
      
      expect(error.type).toBe(ExportErrorType.GEOMETRY_EMPTY);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
    });

    it('classifies file size errors correctly', () => {
      const error = errorHandler.handleError('File size exceeds browser limit');
      
      expect(error.type).toBe(ExportErrorType.FILE_TOO_LARGE);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.recoverable).toBe(true);
    });

    it('classifies cancellation correctly', () => {
      const error = errorHandler.handleError('Export cancelled by user');
      
      expect(error.type).toBe(ExportErrorType.CANCELLED);
      expect(error.severity).toBe(ErrorSeverity.INFO);
      expect(error.retryable).toBe(true);
    });

    it('classifies browser errors correctly', () => {
      const error = errorHandler.handleError('Browser does not support WebGL');
      
      expect(error.type).toBe(ExportErrorType.BROWSER_UNSUPPORTED);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.recoverable).toBe(false);
    });

    it('handles unknown errors', () => {
      const error = errorHandler.handleError('Completely unknown error');
      
      expect(error.type).toBe(ExportErrorType.UNKNOWN);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.retryable).toBe(true);
    });
  });

  describe('error handling', () => {
    it('creates structured error from string', () => {
      const error = errorHandler.handleError('Test error message');
      
      expect(error.message).toBe('Test error message');
      expect(error.timestamp).toBeGreaterThan(0);
      expect(error.userMessage).toBeDefined();
      expect(Array.isArray(error.suggestions)).toBe(true);
    });

    it('creates structured error from Error object', () => {
      const originalError = new Error('Original error');
      const error = errorHandler.handleError(originalError);
      
      expect(error.message).toBe('Original error');
      expect(error.cause).toBe(originalError);
    });

    it('includes context when provided', () => {
      const context = { stage: 'processing', layerIndex: 5 };
      const error = errorHandler.handleError('Test error', context);
      
      expect(error.context).toEqual(context);
    });
  });

  describe('recovery strategies', () => {
    it('provides memory error recovery strategies', () => {
      const error = errorHandler.handleError('Out of memory');
      const strategies = errorHandler.getRecoveryStrategies(error);
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some(s => s.name === 'Reduce Quality')).toBe(true);
      expect(strategies.some(s => s.name === 'Garbage Collection')).toBe(true);
    });

    it('provides geometry complexity recovery strategies', () => {
      const error = errorHandler.handleError('Geometry is too many triangles');
      const strategies = errorHandler.getRecoveryStrategies(error);
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some(s => s.name === 'Optimize Geometry')).toBe(true);
    });

    it('provides file size recovery strategies', () => {
      const error = errorHandler.handleError('File size too large');
      const strategies = errorHandler.getRecoveryStrategies(error);
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some(s => s.name === 'Use STL Format')).toBe(true);
    });

    it('sorts strategies by priority', () => {
      const error = errorHandler.handleError('Out of memory');
      const strategies = errorHandler.getRecoveryStrategies(error);
      
      for (let i = 1; i < strategies.length; i++) {
        expect(strategies[i].priority).toBeGreaterThanOrEqual(strategies[i - 1].priority);
      }
    });

    it('includes retry strategy for retryable errors', () => {
      const error = errorHandler.handleError('Network timeout');
      const strategies = errorHandler.getRecoveryStrategies(error);
      
      expect(strategies.some(s => s.name === 'Retry Export')).toBe(true);
    });
  });

  describe('automatic recovery', () => {
    it('applies automatic recovery strategies', async () => {
      const error = errorHandler.handleError('Out of memory');
      const result = await errorHandler.applyAutomaticRecovery(error);
      
      // Should attempt automatic recovery
      expect(typeof result).toBe('boolean');
    });

    it('skips non-automatic strategies', async () => {
      const error = errorHandler.handleError('Geometry too complex');
      const strategies = errorHandler.getRecoveryStrategies(error);
      const automaticStrategies = strategies.filter(s => s.automatic);
      const manualStrategies = strategies.filter(s => !s.automatic);
      
      expect(automaticStrategies.length).toBeGreaterThan(0);
      expect(manualStrategies.length).toBeGreaterThan(0);
    });
  });

  describe('error history', () => {
    it('maintains error history', () => {
      errorHandler.handleError('First error');
      errorHandler.handleError('Second error');
      
      const history = errorHandler.getErrorHistory();
      expect(history.length).toBe(2);
      expect(history[0].message).toBe('First error');
      expect(history[1].message).toBe('Second error');
    });

    it('limits history size', () => {
      // Add more errors than the limit
      for (let i = 0; i < 60; i++) {
        errorHandler.handleError(`Error ${i}`);
      }
      
      const history = errorHandler.getErrorHistory();
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it('clears history when requested', () => {
      errorHandler.handleError('Test error');
      expect(errorHandler.getErrorHistory().length).toBe(1);
      
      errorHandler.clearHistory();
      expect(errorHandler.getErrorHistory().length).toBe(0);
    });
  });

  describe('error statistics', () => {
    beforeEach(() => {
      // Add some test errors
      errorHandler.handleError('Out of memory');
      errorHandler.handleError('File too large');
      errorHandler.handleError('Out of memory');
      errorHandler.handleError('Network error');
    });

    it('provides error statistics', () => {
      const stats = errorHandler.getErrorStats();
      
      expect(stats.totalErrors).toBe(4);
      expect(stats.errorsByType.get(ExportErrorType.OUT_OF_MEMORY)).toBe(2);
      expect(stats.errorsByType.get(ExportErrorType.FILE_TOO_LARGE)).toBe(1);
      expect(stats.errorsByType.get(ExportErrorType.NETWORK_ERROR)).toBe(1);
    });

    it('groups errors by severity', () => {
      const stats = errorHandler.getErrorStats();
      
      expect(stats.errorsBySeverity.get(ErrorSeverity.ERROR)).toBeGreaterThan(0);
    });

    it('identifies recent errors', () => {
      const stats = errorHandler.getErrorStats();
      
      expect(stats.recentErrors.length).toBe(4); // All errors are recent
    });
  });

  describe('systematic issue detection', () => {
    it('detects repeated memory errors', () => {
      for (let i = 0; i < 3; i++) {
        errorHandler.handleError('Out of memory');
      }
      
      const analysis = errorHandler.detectSystematicIssues();
      
      expect(analysis.hasPattern).toBe(true);
      expect(analysis.pattern).toContain('memory');
    });

    it('detects repeated timeout errors', () => {
      for (let i = 0; i < 3; i++) {
        errorHandler.handleError('Export timed out');
      }
      
      const analysis = errorHandler.detectSystematicIssues();
      
      expect(analysis.hasPattern).toBe(true);
      expect(analysis.pattern).toContain('timeout');
    });

    it('detects browser compatibility issues', () => {
      for (let i = 0; i < 2; i++) {
        errorHandler.handleError('Browser not supported');
      }
      
      const analysis = errorHandler.detectSystematicIssues();
      
      expect(analysis.hasPattern).toBe(true);
      expect(analysis.pattern).toContain('Browser compatibility');
    });

    it('returns no pattern for diverse errors', () => {
      errorHandler.handleError('Memory error');
      errorHandler.handleError('Network error');
      
      const analysis = errorHandler.detectSystematicIssues();
      
      expect(analysis.hasPattern).toBe(false);
    });

    it('requires minimum error count for pattern detection', () => {
      errorHandler.handleError('Memory error');
      
      const analysis = errorHandler.detectSystematicIssues();
      
      expect(analysis.hasPattern).toBe(false);
    });
  });
});

describe('ErrorUtils', () => {
  describe('formatErrorMessage', () => {
    it('formats error message with suggestions', () => {
      const error = {
        type: ExportErrorType.OUT_OF_MEMORY,
        severity: ErrorSeverity.ERROR,
        message: 'Original message',
        userMessage: 'Not enough memory',
        suggestions: ['Close tabs', 'Reduce complexity'],
        recoverable: true,
        retryable: true,
        timestamp: Date.now(),
      };
      
      const formatted = ErrorUtils.formatErrorMessage(error);
      
      expect(formatted).toContain('Not enough memory');
      expect(formatted).toContain('• Close tabs');
      expect(formatted).toContain('• Reduce complexity');
    });

    it('handles error without suggestions', () => {
      const error = {
        type: ExportErrorType.CANCELLED,
        severity: ErrorSeverity.INFO,
        message: 'Cancelled',
        userMessage: 'Export was cancelled',
        suggestions: [],
        recoverable: true,
        retryable: true,
        timestamp: Date.now(),
      };
      
      const formatted = ErrorUtils.formatErrorMessage(error);
      
      expect(formatted).toBe('Export was cancelled');
    });
  });

  describe('isRecoverable', () => {
    it('identifies recoverable errors', () => {
      const error = {
        type: ExportErrorType.OUT_OF_MEMORY,
        severity: ErrorSeverity.ERROR,
        message: 'Memory error',
        userMessage: 'Not enough memory',
        suggestions: [],
        recoverable: true,
        retryable: true,
        timestamp: Date.now(),
      };
      
      expect(ErrorUtils.isRecoverable(error)).toBe(true);
    });

    it('identifies non-recoverable errors', () => {
      const error = {
        type: ExportErrorType.BROWSER_UNSUPPORTED,
        severity: ErrorSeverity.CRITICAL,
        message: 'Browser error',
        userMessage: 'Browser not supported',
        suggestions: [],
        recoverable: false,
        retryable: false,
        timestamp: Date.now(),
      };
      
      expect(ErrorUtils.isRecoverable(error)).toBe(false);
    });

    it('considers critical errors non-recoverable', () => {
      const error = {
        type: ExportErrorType.UNKNOWN,
        severity: ErrorSeverity.CRITICAL,
        message: 'Critical error',
        userMessage: 'Critical system error',
        suggestions: [],
        recoverable: true, // Would be recoverable if not critical
        retryable: true,
        timestamp: Date.now(),
      };
      
      expect(ErrorUtils.isRecoverable(error)).toBe(false);
    });
  });

  describe('getErrorIcon', () => {
    it('returns appropriate icons for each severity', () => {
      expect(ErrorUtils.getErrorIcon(ErrorSeverity.INFO)).toBe('ℹ️');
      expect(ErrorUtils.getErrorIcon(ErrorSeverity.WARNING)).toBe('⚠️');
      expect(ErrorUtils.getErrorIcon(ErrorSeverity.ERROR)).toBe('❌');
      expect(ErrorUtils.getErrorIcon(ErrorSeverity.CRITICAL)).toBe('🚨');
    });
  });

  describe('getErrorClasses', () => {
    it('returns appropriate CSS classes for each severity', () => {
      expect(ErrorUtils.getErrorClasses(ErrorSeverity.INFO)).toContain('blue');
      expect(ErrorUtils.getErrorClasses(ErrorSeverity.WARNING)).toContain('yellow');
      expect(ErrorUtils.getErrorClasses(ErrorSeverity.ERROR)).toContain('red');
      expect(ErrorUtils.getErrorClasses(ErrorSeverity.CRITICAL)).toContain('red');
    });
  });
});

describe('Global error handler', () => {
  it('provides global instance', () => {
    expect(exportErrorHandler).toBeInstanceOf(ExportErrorHandler);
  });

  it('maintains separate history from other instances', () => {
    const localHandler = new ExportErrorHandler();
    
    exportErrorHandler.handleError('Global error');
    localHandler.handleError('Local error');
    
    expect(exportErrorHandler.getErrorHistory().length).toBe(1);
    expect(localHandler.getErrorHistory().length).toBe(1);
    expect(exportErrorHandler.getErrorHistory()[0].message).toBe('Global error');
    expect(localHandler.getErrorHistory()[0].message).toBe('Local error');
  });
});