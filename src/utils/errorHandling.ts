import { MemoryError, ImageProcessingError } from '../types/errors';
import type { ErrorRecoverySuggestion } from '../types/errors';

/**
 * Global error handler for uncaught exceptions and promise rejections
 */
export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private errorQueue: Array<{ error: Error; context: string; timestamp: number }> = [];
  private maxQueueSize = 50;
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;

  private constructor() {
    this.setupGlobalHandlers();
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  private setupGlobalHandlers() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), 'global-error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        'unhandled-promise-rejection'
      );
    });

    // Handle WebGL context loss
    this.setupWebGLErrorHandling();

    // Handle network errors
    this.setupNetworkErrorHandling();

    // Handle memory pressure warnings
    this.setupMemoryPressureHandling();
  }

  private setupWebGLErrorHandling() {
    // Listen for WebGL context loss events
    document.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.warn('WebGL context lost, attempting recovery...');
      
      this.handleError(
        new Error('WebGL context lost'),
        'webgl-context-lost',
        { recoverable: true }
      );
    });

    document.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored');
      // Trigger re-initialization of 3D components
      window.dispatchEvent(new CustomEvent('webgl-context-restored'));
    });
  }

  private setupNetworkErrorHandling() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      console.log('Network connection restored');
      this.retryFailedNetworkRequests();
    });

    window.addEventListener('offline', () => {
      console.warn('Network connection lost');
      this.handleError(
        new Error('Network connection lost'),
        'network-offline',
        { recoverable: true }
      );
    });
  }

  private setupMemoryPressureHandling() {
    // Monitor memory usage if Performance API is available
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        const memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        if (memoryUsage > 0.8) {
          console.warn('High memory usage detected:', memoryUsage);
          this.handleError(
            new MemoryError(
              memory.usedJSHeapSize,
              memory.jsHeapSizeLimit - memory.usedJSHeapSize,
              [{
                action: 'Clear cache',
                description: 'Clear processed images and geometry cache',
                autoApplicable: true,
                severity: 'medium'
              }]
            ),
            'memory-pressure',
            { recoverable: true }
          );
        }
      }, 10000); // Check every 10 seconds
    }
  }

  handleError(error: Error, context: string, metadata?: any) {
    const errorRecord = {
      error,
      context,
      timestamp: Date.now(),
      metadata
    };

    // Add to error queue
    this.errorQueue.unshift(errorRecord);
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue = this.errorQueue.slice(0, this.maxQueueSize);
    }

    // Log error
    console.error(`[${context}]`, error, metadata);

    // Attempt automatic recovery
    this.attemptAutoRecovery(error, context);

    // Report error (in production)
    if (process.env.NODE_ENV === 'production') {
      this.reportError(errorRecord);
    }

    // Trigger error event for UI components to handle
    window.dispatchEvent(new CustomEvent('global-error', {
      detail: { error, context, metadata }
    }));
  }

  private async attemptAutoRecovery(error: Error, context: string) {
    const errorKey = `${context}-${error.name}-${error.message}`;
    const attempts = this.retryAttempts.get(errorKey) || 0;

    if (attempts >= this.maxRetries) {
      console.warn('Max retry attempts reached for error:', errorKey);
      return;
    }

    this.retryAttempts.set(errorKey, attempts + 1);

    // Determine recovery strategy based on error type and context
    const recoveryStrategy = this.getRecoveryStrategy(error, context);
    
    if (recoveryStrategy) {
      console.log(`Attempting auto-recovery strategy: ${recoveryStrategy.name}`);
      
      try {
        await recoveryStrategy.execute();
        console.log('Auto-recovery successful');
        this.retryAttempts.delete(errorKey); // Reset attempts on success
      } catch (recoveryError) {
        console.error('Auto-recovery failed:', recoveryError);
      }
    }
  }

  private getRecoveryStrategy(error: Error, context: string): RecoveryStrategy | null {
    // WebGL context recovery
    if (context === 'webgl-context-lost') {
      return {
        name: 'webgl-context-recovery',
        execute: async () => {
          // Wait a bit for context to stabilize
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Force re-initialization of Three.js renderer
          window.dispatchEvent(new CustomEvent('force-webgl-reinit'));
        }
      };
    }

    // Memory pressure recovery
    if (error instanceof MemoryError || context === 'memory-pressure') {
      return {
        name: 'memory-cleanup',
        execute: async () => {
          // Clear caches
          window.dispatchEvent(new CustomEvent('clear-memory-cache'));
          
          // Force garbage collection if available
          if ('gc' in window) {
            (window as any).gc();
          }
          
          // Reduce image quality or dimensions
          window.dispatchEvent(new CustomEvent('reduce-memory-usage'));
        }
      };
    }

    // Network error recovery
    if (context.includes('network') || error.message.includes('fetch')) {
      return {
        name: 'network-retry',
        execute: async () => {
          // Wait for exponential backoff
          const backoffDelay = Math.min(1000 * Math.pow(2, this.retryAttempts.get(`${context}-${error.name}-${error.message}`) || 0), 30000);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          
          // Retry failed network requests
          window.dispatchEvent(new CustomEvent('retry-network-requests'));
        }
      };
    }

    // Image processing error recovery
    if (error instanceof ImageProcessingError) {
      return {
        name: 'image-processing-recovery',
        execute: async () => {
          // Try with reduced quality or different processing parameters
          window.dispatchEvent(new CustomEvent('retry-image-processing', {
            detail: { useReducedQuality: true }
          }));
        }
      };
    }

    return null;
  }

  private async retryFailedNetworkRequests() {
    // Implementation would retry any failed network requests
    // This is a placeholder for the actual retry logic
    console.log('Retrying failed network requests...');
  }

  private async reportError(errorRecord: any) {
    try {
      // In production, send to error reporting service
      // Example: Sentry, LogRocket, etc.
      console.log('Error reported:', errorRecord);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  getErrorHistory(): Array<{ error: Error; context: string; timestamp: number }> {
    return [...this.errorQueue];
  }

  clearErrorHistory() {
    this.errorQueue = [];
    this.retryAttempts.clear();
  }
}

interface RecoveryStrategy {
  name: string;
  execute: () => Promise<void>;
}

/**
 * Error recovery utilities for specific components
 */
export class ErrorRecoveryManager {
  private recoveryStrategies = new Map<string, RecoveryStrategy>();
  private recoveryHistory = new Map<string, number>();

  registerRecoveryStrategy(errorType: string, strategy: RecoveryStrategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }

  async attemptRecovery(error: Error, context?: string): Promise<boolean> {
    const errorType = error.constructor.name;
    const strategy = this.recoveryStrategies.get(errorType);

    if (!strategy) {
      console.warn(`No recovery strategy found for error type: ${errorType}`);
      return false;
    }

    const recoveryKey = `${errorType}-${context || 'default'}`;
    const attempts = this.recoveryHistory.get(recoveryKey) || 0;

    if (attempts >= 3) {
      console.warn(`Max recovery attempts reached for: ${recoveryKey}`);
      return false;
    }

    try {
      console.log(`Attempting recovery for ${errorType}...`);
      await strategy.execute();
      
      // Reset attempts on successful recovery
      this.recoveryHistory.delete(recoveryKey);
      return true;
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      this.recoveryHistory.set(recoveryKey, attempts + 1);
      return false;
    }
  }
}

/**
 * User input validation with real-time feedback
 */
export class ValidationManager {
  private validators = new Map<string, ValidationRule[]>();
  private validationResults = new Map<string, ValidationResult>();

  registerValidator(fieldName: string, rules: ValidationRule[]) {
    this.validators.set(fieldName, rules);
  }

  async validateField(fieldName: string, value: any): Promise<ValidationResult> {
    const rules = this.validators.get(fieldName) || [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of rules) {
      try {
        const result = await rule.validate(value);
        if (!result.isValid) {
          if (result.severity === 'error') {
            errors.push(result.message);
          } else {
            warnings.push(result.message);
          }
        }
      } catch (validationError) {
        console.error('Validation rule failed:', validationError);
        errors.push('Validation failed');
      }
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    this.validationResults.set(fieldName, result);
    return result;
  }

  getValidationResult(fieldName: string): ValidationResult | null {
    return this.validationResults.get(fieldName) || null;
  }

  clearValidation(fieldName?: string) {
    if (fieldName) {
      this.validationResults.delete(fieldName);
    } else {
      this.validationResults.clear();
    }
  }
}

interface ValidationRule {
  name: string;
  validate: (value: any) => Promise<{ isValid: boolean; message: string; severity: 'error' | 'warning' }>;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Retry mechanism with exponential backoff
 */
export class RetryManager {
  static async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000,
    maxDelay: number = 30000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  static async retryWithCondition<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: Error) => boolean,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts || !shouldRetry(lastError)) {
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`Retryable error on attempt ${attempt}, retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private failureCount = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailureTime = 0;

  private maxFailures: number;
  private resetTimeout: number;

  constructor(
    maxFailures: number = 5,
    resetTimeout: number = 60000 // 1 minute
  ) {
    this.maxFailures = maxFailures;
    this.resetTimeout = resetTimeout;
    // Initialize circuit breaker
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.state = 'closed';
      }
      
      this.failureCount = 0;
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.maxFailures) {
        this.state = 'open';
      }

      throw error;
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset() {
    this.failureCount = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

/**
 * Initialize global error handling
 */
export function initializeErrorHandling() {
  const globalHandler = GlobalErrorHandler.getInstance();
  
  // Register recovery strategies
  const recoveryManager = new ErrorRecoveryManager();
  
  // WebGL recovery
  recoveryManager.registerRecoveryStrategy('WebGLError', {
    name: 'webgl-recovery',
    execute: async () => {
      // Force WebGL context restoration
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (context && (context as WebGLRenderingContext).isContextLost()) {
          // Trigger context restoration
          canvas.dispatchEvent(new Event('webglcontextrestored'));
        }
      }
    }
  });

  // Memory recovery
  recoveryManager.registerRecoveryStrategy('MemoryError', {
    name: 'memory-recovery',
    execute: async () => {
      // Clear caches and reduce memory usage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Trigger garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }
    }
  });

  return { globalHandler, recoveryManager };
}

// Export instances
export const globalErrorHandler = GlobalErrorHandler.getInstance();
export const errorRecoveryManager = new ErrorRecoveryManager();
export const validationManager = new ValidationManager();