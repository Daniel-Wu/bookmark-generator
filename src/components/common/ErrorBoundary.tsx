import React, { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createUserFriendlyError } from '../../types/errors';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  isRecovering: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void, errorId: string) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  level?: 'page' | 'component' | 'feature';
  maxRetries?: number;
  isolateError?: boolean;
  showErrorDetails?: boolean;
}

interface ErrorDetailsProps {
  error: Error;
  errorInfo: ErrorInfo;
  errorId: string;
  showDetails: boolean;
  onToggleDetails: () => void;
  onRetry: () => void;
  onReport: () => void;
  onReload: () => void;
  canRetry: boolean;
}

interface ErrorReportData {
  errorId: string;
  timestamp: number;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  errorInfo: {
    componentStack: string;
  };
  userAgent: string;
  url: string;
  userId?: string;
  buildVersion?: string;
}

/**
 * Comprehensive error boundary with recovery features
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: number | null = null;
  private errorReportingService: ErrorReportingService;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isRecovering: false,
    };

    this.errorReportingService = new ErrorReportingService();
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props;
    const { errorId } = this.state;

    console.error(`[ErrorBoundary:${level}] Error caught:`, error, errorInfo);

    this.setState({ errorInfo });

    // Report error
    if (errorId) {
      this.errorReportingService.reportError({
        errorId,
        timestamp: Date.now(),
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        errorInfo: {
          componentStack: errorInfo.componentStack || '',
        },
        userAgent: navigator.userAgent,
        url: window.location.href,
        buildVersion: process.env.REACT_APP_VERSION || 'unknown',
      });

      // Call custom error handler
      onError?.(error, errorInfo, errorId);
    }

    // Attempt automatic recovery for certain error types
    this.attemptAutoRecovery(error);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState) {
    const { hasError, isRecovering } = this.state;
    const { children } = this.props;

    // Reset error boundary if children change and we're not currently recovering
    if (prevState.hasError && !hasError && !isRecovering && prevProps.children !== children) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private attemptAutoRecovery = (error: Error) => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    // Only attempt auto-recovery for certain types of errors
    const isRecoverableError = this.isRecoverableError(error);
    
    if (isRecoverableError && retryCount < maxRetries) {
      console.log(`[ErrorBoundary] Attempting auto-recovery (attempt ${retryCount + 1}/${maxRetries})`);
      
      this.setState({ isRecovering: true });

      // Exponential backoff for retry attempts
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      
      this.retryTimeoutId = window.setTimeout(() => {
        this.handleRetry();
      }, delay);
    }
  };

  private isRecoverableError = (error: Error): boolean => {
    // Define which errors can be automatically recovered from
    const recoverablePatterns = [
      /ChunkLoadError/,
      /Loading chunk \d+ failed/,
      /Network request failed/,
      /Failed to fetch/,
      /WebGL context/,
    ];

    return recoverablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.name)
    );
  };

  private resetErrorBoundary = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isRecovering: false,
    });
  };

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      console.warn('[ErrorBoundary] Max retry attempts reached');
      this.setState({ isRecovering: false });
      return;
    }

    console.log(`[ErrorBoundary] Retrying... (attempt ${retryCount + 1})`);

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      isRecovering: false,
    }));
  };

  private handleManualRetry = () => {
    this.setState({ isRecovering: true });
    
    // Small delay to show recovery state
    setTimeout(() => {
      this.handleRetry();
    }, 500);
  };

  private handleReportError = () => {
    const { error, errorInfo, errorId } = this.state;
    
    if (error && errorInfo && errorId) {
      // Create detailed error report for user to submit
      const reportData = {
        errorId,
        timestamp: Date.now(),
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        errorInfo: {
          componentStack: errorInfo.componentStack || '',
        },
        userAgent: navigator.userAgent,
        url: window.location.href,
        reproduction: '', // User can fill this in
      };

      // Open error reporting interface
      this.openErrorReportDialog(reportData);
    }
  };

  private openErrorReportDialog = (reportData: any) => {
    // In a real app, this would open a modal or redirect to error reporting
    const reportText = JSON.stringify(reportData, null, 2);
    
    if (confirm('Would you like to copy the error details to help us fix this issue?')) {
      navigator.clipboard.writeText(reportText).then(() => {
        alert('Error details copied to clipboard. Please share this with our support team.');
      }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = reportText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Error details copied to clipboard. Please share this with our support team.');
      });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo, errorId, isRecovering } = this.state;
    const { children, fallback, level = 'component', maxRetries = 3, showErrorDetails = false } = this.props;

    if (isRecovering) {
      return <ErrorRecoveryIndicator level={level} />;
    }

    if (hasError && error && errorId) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.handleManualRetry, errorId);
      }

      // Default error UI
      return (
        <ErrorFallback
          error={error}
          errorInfo={errorInfo!}
          errorId={errorId}
          showDetails={showErrorDetails}
          onToggleDetails={() => {}}
          onRetry={this.handleManualRetry}
          onReport={this.handleReportError}
          onReload={this.handleReload}
          canRetry={this.state.retryCount < maxRetries}
        />
      );
    }

    return children;
  }
}

/**
 * Simple error recovery indicator
 */
function ErrorRecoveryIndicator({ level: _level }: { level: string }) {
  return (
    <div 
      className="flex items-center justify-center p-8 bg-blue-50 border border-blue-200 rounded-lg"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <div className="text-blue-800">
          <p className="font-medium">Recovering from error...</p>
          <p className="text-sm opacity-75">This may take a moment</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Comprehensive error fallback UI
 */
function ErrorFallback({
  error,
  errorInfo,
  errorId,
  showDetails,
  onToggleDetails: _onToggleDetails,
  onRetry,
  onReport,
  onReload,
  canRetry
}: ErrorDetailsProps) {
  const [showDetailedInfo, setShowDetailedInfo] = React.useState(showDetails);

  // Try to extract user-friendly error information
  const isValidationError = error instanceof Error && error.name === 'ValidationError';
  const userFriendlyError = isValidationError ? createUserFriendlyError(error as any) : null;

  return (
    <div 
      className="min-h-[400px] flex items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg"
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
          <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Error Title and Message */}
        <h2 className="text-lg font-semibold text-red-800 mb-2">
          {userFriendlyError?.title || 'Something went wrong'}
        </h2>
        
        <p className="text-red-700 mb-6">
          {userFriendlyError?.message || error.message || 'An unexpected error occurred. Please try again.'}
        </p>

        {/* Recovery Suggestions for ValidationErrors */}
        {userFriendlyError?.suggestions && userFriendlyError.suggestions.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">Suggestions:</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              {userFriendlyError.suggestions.slice(0, 3).map((suggestion, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{suggestion.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
          {canRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Try Again
            </button>
          )}
          
          <button
            onClick={onReload}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Reload Page
          </button>
          
          <button
            onClick={onReport}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Report Issue
          </button>
        </div>

        {/* Error Details Toggle */}
        <button
          onClick={() => setShowDetailedInfo(!showDetailedInfo)}
          className="text-sm text-red-600 hover:text-red-700 underline focus:outline-none"
        >
          {showDetailedInfo ? 'Hide' : 'Show'} Error Details
        </button>

        {/* Detailed Error Information */}
        {showDetailedInfo && (
          <details className="mt-4 text-left">
            <summary className="text-sm font-medium text-red-800 cursor-pointer mb-2">
              Technical Details
            </summary>
            <div className="text-xs text-red-700 bg-red-100 p-3 rounded border overflow-auto max-h-40">
              <div className="mb-2">
                <strong>Error ID:</strong> {errorId}
              </div>
              <div className="mb-2">
                <strong>Error:</strong> {error.name}: {error.message}
              </div>
              {error.stack && (
                <div className="mb-2">
                  <strong>Stack:</strong>
                  <pre className="whitespace-pre-wrap mt-1">{error.stack}</pre>
                </div>
              )}
              {errorInfo && (
                <div>
                  <strong>Component Stack:</strong>
                  <pre className="whitespace-pre-wrap mt-1">{errorInfo.componentStack}</pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Error reporting service
 */
class ErrorReportingService {
  private errors: ErrorReportData[] = [];
  private maxStoredErrors = 10;

  reportError(errorData: ErrorReportData) {
    // Store error locally
    this.errors.unshift(errorData);
    if (this.errors.length > this.maxStoredErrors) {
      this.errors = this.errors.slice(0, this.maxStoredErrors);
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('bookmarkGenerator_errors', JSON.stringify(this.errors));
    } catch (e) {
      console.warn('Could not store error data in localStorage:', e);
    }

    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorService(errorData);
    }
  }

  private async sendToErrorService(errorData: ErrorReportData) {
    try {
      // This would be replaced with actual error reporting service endpoint
      console.log('Error reported to service:', errorData);
      
      // Example: Send to error tracking service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorData)
      // });
    } catch (e) {
      console.warn('Failed to send error to reporting service:', e);
    }
  }

  getStoredErrors(): ErrorReportData[] {
    try {
      const stored = localStorage.getItem('bookmarkGenerator_errors');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  clearStoredErrors() {
    try {
      localStorage.removeItem('bookmarkGenerator_errors');
      this.errors = [];
    } catch (e) {
      console.warn('Could not clear error data from localStorage:', e);
    }
  }
}

/**
 * Higher-order component for wrapping components with error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook for handling errors in functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    console.error('Error handled by useErrorHandler:', error);
    setError(error);
  }, []);

  // Throw error to be caught by error boundary
  if (error) {
    throw error;
  }

  return { handleError, resetError };
}