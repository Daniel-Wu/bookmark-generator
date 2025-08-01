import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  GlobalErrorHandler, 
  ErrorRecoveryManager, 
  ValidationManager, 
  RetryManager, 
  CircuitBreaker,
  initializeErrorHandling
} from '../../utils/errorHandling';
import { MemoryError } from '../../types/errors';

// Mock DOM methods
const mockDispatchEvent = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
const mockCreateElement = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockContains = vi.fn();

// Mock global objects
Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent,
  writable: true
});

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener,
  writable: true
});

Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener,
  writable: true
});

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement,
  writable: true
});

Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild,
  writable: true
});

Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild,
  writable: true
});

Object.defineProperty(document.body, 'contains', {
  value: mockContains,
  writable: true
});

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock performance.memory
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB
    totalJSHeapSize: 60 * 1024 * 1024   // 60MB
  },
  writable: true
});

describe('GlobalErrorHandler', () => {
  let globalErrorHandler: GlobalErrorHandler;
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleLog: typeof console.log;
  
  beforeEach(() => {
    // Mock console methods
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    originalConsoleLog = console.log;
    
    console.error = vi.fn();
    console.warn = vi.fn();
    console.log = vi.fn();
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Get fresh instance
    globalErrorHandler = GlobalErrorHandler.getInstance();
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
    
    vi.clearAllTimers();
  });

  describe('Error Handling', () => {
    it('handles basic errors correctly', () => {
      const testError = new Error('Test error');
      
      globalErrorHandler.handleError(testError, 'test-context');
      
      expect(console.error).toHaveBeenCalledWith('[test-context]', testError, undefined);
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'global-error',
          detail: {
            error: testError,
            context: 'test-context',
            metadata: undefined
          }
        })
      );
    });

    it('handles errors with metadata', () => {
      const testError = new Error('Test error with metadata');
      const metadata = { userId: '123', feature: 'upload' };
      
      globalErrorHandler.handleError(testError, 'test-context', metadata);
      
      expect(console.error).toHaveBeenCalledWith('[test-context]', testError, metadata);
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            error: testError,
            context: 'test-context',
            metadata
          }
        })
      );
    });

    it('maintains error history', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      
      globalErrorHandler.handleError(error1, 'context1');
      globalErrorHandler.handleError(error2, 'context2');
      
      const history = globalErrorHandler.getErrorHistory();
      expect(history).toHaveLength(2);
      expect(history[0].error).toBe(error2); // Most recent first
      expect(history[1].error).toBe(error1);
    });

    it('limits error history size', () => {
      // Create more errors than the max queue size (50)
      for (let i = 0; i < 55; i++) {
        globalErrorHandler.handleError(new Error(`Error ${i}`), 'test');
      }
      
      const history = globalErrorHandler.getErrorHistory();
      expect(history).toHaveLength(50);
      expect(history[0].error.message).toBe('Error 54'); // Most recent
    });

    it('clears error history', () => {
      globalErrorHandler.handleError(new Error('Test'), 'test');
      expect(globalErrorHandler.getErrorHistory()).toHaveLength(1);
      
      globalErrorHandler.clearErrorHistory();
      expect(globalErrorHandler.getErrorHistory()).toHaveLength(0);
    });
  });

  describe('Auto Recovery', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('attempts auto recovery for recoverable errors', async () => {
      const webglError = new Error('WebGL context lost');
      
      globalErrorHandler.handleError(webglError, 'webgl-context-lost');
      
      // Should attempt recovery after delay
      expect(setTimeout).toHaveBeenCalled();
      
      // Fast-forward timers
      await vi.runAllTimersAsync();
      
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'force-webgl-reinit'
        })
      );
    });

    it('respects max retry attempts', async () => {
      const recoverableError = new Error('Network request failed');
      
      // Trigger error multiple times
      for (let i = 0; i < 5; i++) {
        globalErrorHandler.handleError(recoverableError, 'network-fetch');
        await vi.runAllTimersAsync();
      }
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Max retry attempts reached')
      );
    });

    it('handles memory pressure errors', async () => {
      const memoryError = new MemoryError(
        90 * 1024 * 1024, // 90MB used
        10 * 1024 * 1024, // 10MB available
        []
      );
      
      globalErrorHandler.handleError(memoryError, 'memory-pressure');
      
      await vi.runAllTimersAsync();
      
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'clear-memory-cache'
        })
      );
    });
  });

  describe('WebGL Context Handling', () => {
    it('sets up WebGL context loss listeners', () => {
      // Verify that context loss listeners are set up
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'webglcontextlost',
        expect.any(Function)
      );
      
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'webglcontextrestored',
        expect.any(Function)
      );
    });

    it('handles WebGL context lost events', () => {
      // Simulate WebGL context lost event
      const contextLostEvent = new Event('webglcontextlost');
      const preventDefault = vi.fn();
      contextLostEvent.preventDefault = preventDefault;
      
      // Find the webglcontextlost handler
      const calls = mockAddEventListener.mock.calls;
      const contextLostCall = calls.find(call => call[0] === 'webglcontextlost');
      expect(contextLostCall).toBeDefined();
      
      if (contextLostCall) {
        const handler = contextLostCall[1];
        handler(contextLostEvent);
        
        expect(preventDefault).toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('WebGL context lost')
        );
      }
    });
  });

  describe('Network Error Handling', () => {
    it('sets up network status listeners', () => {
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      );
      
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      );
    });

    it('handles network offline events', () => {
      const calls = mockAddEventListener.mock.calls;
      const offlineCall = calls.find(call => call[0] === 'offline');
      expect(offlineCall).toBeDefined();
      
      if (offlineCall) {
        const handler = offlineCall[1];
        handler(new Event('offline'));
        
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Network connection lost')
        );
      }
    });
  });
});

describe('ErrorRecoveryManager', () => {
  let recoveryManager: ErrorRecoveryManager;
  
  beforeEach(() => {
    recoveryManager = new ErrorRecoveryManager();
  });

  it('registers and executes recovery strategies', async () => {
    const mockStrategy = {
      name: 'test-recovery',
      execute: vi.fn().mockResolvedValue(undefined)
    };
    
    recoveryManager.registerRecoveryStrategy('TestError', mockStrategy);
    
    const testError = new Error('Test error');
    testError.constructor = { name: 'TestError' } as any;
    
    const result = await recoveryManager.attemptRecovery(testError);
    
    expect(result).toBe(true);
    expect(mockStrategy.execute).toHaveBeenCalled();
  });

  it('handles recovery strategy failures', async () => {
    const mockStrategy = {
      name: 'failing-recovery',
      execute: vi.fn().mockRejectedValue(new Error('Recovery failed'))
    };
    
    recoveryManager.registerRecoveryStrategy('TestError', mockStrategy);
    
    const testError = new Error('Test error');
    testError.constructor = { name: 'TestError' } as any;
    
    const result = await recoveryManager.attemptRecovery(testError);
    
    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Recovery failed'),
      expect.any(Error)
    );
  });

  it('respects max recovery attempts', async () => {
    const mockStrategy = {
      name: 'unreliable-recovery',
      execute: vi.fn().mockRejectedValue(new Error('Always fails'))
    };
    
    recoveryManager.registerRecoveryStrategy('TestError', mockStrategy);
    
    const testError = new Error('Test error');
    testError.constructor = { name: 'TestError' } as any;
    
    // Attempt recovery multiple times
    await recoveryManager.attemptRecovery(testError, 'context1');
    await recoveryManager.attemptRecovery(testError, 'context1');
    await recoveryManager.attemptRecovery(testError, 'context1');
    const result = await recoveryManager.attemptRecovery(testError, 'context1');
    
    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Max recovery attempts reached')
    );
  });
});

describe('ValidationManager', () => {
  let validationManager: ValidationManager;
  
  beforeEach(() => {
    validationManager = new ValidationManager();
  });

  it('validates fields with registered rules', async () => {
    const mockRule = {
      name: 'required',
      validate: vi.fn().mockResolvedValue({
        isValid: false,
        message: 'Field is required',
        severity: 'error' as const
      })
    };
    
    validationManager.registerValidator('email', [mockRule]);
    
    const result = await validationManager.validateField('email', '');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Field is required');
    expect(mockRule.validate).toHaveBeenCalledWith('');
  });

  it('handles validation warnings', async () => {
    const mockRule = {
      name: 'format-warning',
      validate: vi.fn().mockResolvedValue({
        isValid: false,
        message: 'Format could be improved',
        severity: 'warning' as const
      })
    };
    
    validationManager.registerValidator('username', [mockRule]);
    
    const result = await validationManager.validateField('username', 'test');
    
    expect(result.isValid).toBe(true); // Warnings don't make field invalid
    expect(result.warnings).toContain('Format could be improved');
  });

  it('handles multiple validation rules', async () => {
    const rules = [
      {
        name: 'required',
        validate: vi.fn().mockResolvedValue({
          isValid: true,
          message: '',
          severity: 'error' as const
        })
      },
      {
        name: 'min-length',
        validate: vi.fn().mockResolvedValue({
          isValid: false,
          message: 'Too short',
          severity: 'error' as const
        })
      }
    ];
    
    validationManager.registerValidator('password', rules);
    
    const result = await validationManager.validateField('password', 'abc');
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Too short');
    expect(rules[0].validate).toHaveBeenCalledWith('abc');
    expect(rules[1].validate).toHaveBeenCalledWith('abc');
  });

  it('caches validation results', async () => {
    const mockRule = {
      name: 'test-rule',
      validate: vi.fn().mockResolvedValue({
        isValid: true,
        message: '',
        severity: 'error' as const
      })
    };
    
    validationManager.registerValidator('test-field', [mockRule]);
    
    await validationManager.validateField('test-field', 'value');
    const cachedResult = validationManager.getValidationResult('test-field');
    
    expect(cachedResult).toBeDefined();
    expect(cachedResult?.isValid).toBe(true);
  });
});

describe('RetryManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries failed operations', async () => {
    let attempts = 0;
    const operation = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Operation failed');
      }
      return 'success';
    });

    const resultPromise = RetryManager.retry(operation, 3, 100);
    
    // Fast-forward through retry delays
    await vi.runAllTimersAsync();
    
    const result = await resultPromise;
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('respects max attempts', async () => {
    const operation = vi.fn(() => {
      throw new Error('Always fails');
    });

    const resultPromise = RetryManager.retry(operation, 2, 100);
    
    await vi.runAllTimersAsync();
    
    await expect(resultPromise).rejects.toThrow('Always fails');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('uses exponential backoff', async () => {
    let attempts = 0;
    const operation = vi.fn(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Retry needed');
      }
      return 'success';
    });

    const resultPromise = RetryManager.retry(operation, 3, 100, 1000);
    
    // Check that delays increase exponentially
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
    
    await vi.runAllTimersAsync();
    await resultPromise;
    
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('supports conditional retry logic', async () => {
    let attempts = 0;
    const operation = vi.fn(() => {
      attempts++;
      const error = new Error(attempts === 1 ? 'Retryable error' : 'Fatal error');
      throw error;
    });

    const shouldRetry = (error: Error) => error.message.includes('Retryable');

    const resultPromise = RetryManager.retryWithCondition(operation, shouldRetry, 3, 100);
    
    await vi.runAllTimersAsync();
    
    await expect(resultPromise).rejects.toThrow('Fatal error');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  
  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(3, 1000); // 3 failures, 1 second timeout
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in closed state', () => {
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('opens after max failures', async () => {
    const failingOperation = vi.fn(() => Promise.reject(new Error('Operation failed')));

    // Cause multiple failures
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected failures
      }
    }

    expect(circuitBreaker.getState()).toBe('open');
  });

  it('rejects calls when open', async () => {
    const operation = vi.fn(() => Promise.resolve('success'));

    // Force circuit to open
    circuitBreaker.reset();
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Failure')));
      } catch (error) {
        // Expected
      }
    }

    expect(circuitBreaker.getState()).toBe('open');

    await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is open');
    expect(operation).not.toHaveBeenCalled();
  });

  it('transitions to half-open after timeout', async () => {
    const failingOperation = vi.fn(() => Promise.reject(new Error('Failure')));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected
      }
    }

    expect(circuitBreaker.getState()).toBe('open');

    // Fast-forward past reset timeout
    vi.advanceTimersByTime(1500);

    const successOperation = vi.fn(() => Promise.resolve('success'));
    const result = await circuitBreaker.execute(successOperation);

    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('resets failure count on successful operation', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Failure 1'))
      .mockRejectedValueOnce(new Error('Failure 2'))
      .mockResolvedValueOnce('success')
      .mockRejectedValueOnce(new Error('Failure 3'));

    // Two failures
    try { await circuitBreaker.execute(operation); } catch {}
    try { await circuitBreaker.execute(operation); } catch {}

    // Success (should reset count)
    await circuitBreaker.execute(operation);
    expect(circuitBreaker.getState()).toBe('closed');

    // Another failure (should not open circuit since count was reset)
    try { await circuitBreaker.execute(operation); } catch {}
    expect(circuitBreaker.getState()).toBe('closed');
  });
});

describe('Integration', () => {
  it('initializes error handling system', () => {
    const { globalHandler, recoveryManager } = initializeErrorHandling();

    expect(globalHandler).toBeInstanceOf(GlobalErrorHandler);
    expect(recoveryManager).toBeInstanceOf(ErrorRecoveryManager);
  });

  it('integrates all error handling components', async () => {
    vi.useFakeTimers();

    const { globalHandler, recoveryManager } = initializeErrorHandling();

    // Mock a WebGL error
    const webglError = new Error('WebGL context lost');
    globalHandler.handleError(webglError, 'webgl-context-lost');

    // Should attempt recovery
    await vi.runAllTimersAsync();

    expect(mockDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'force-webgl-reinit'
      })
    );

    vi.useRealTimers();
  });

  it('handles complex error scenarios', async () => {
    const validationManager = new ValidationManager();
    const circuitBreaker = new CircuitBreaker(2, 1000);

    // Set up validation
    validationManager.registerValidator('file-upload', [
      {
        name: 'size-check',
        validate: async (file: File) => ({
          isValid: file.size <= 10 * 1024 * 1024,
          message: 'File too large',
          severity: 'error' as const
        })
      }
    ]);

    // Test large file
    const largeFile = new File(['x'.repeat(20 * 1024 * 1024)], 'large.jpg');
    const validationResult = await validationManager.validateField('file-upload', largeFile);

    expect(validationResult.isValid).toBe(false);
    expect(validationResult.errors).toContain('File too large');

    // Test circuit breaker with repeated failures
    const unreliableUpload = vi.fn(() => Promise.reject(new Error('Upload failed')));

    try { await circuitBreaker.execute(unreliableUpload); } catch {}
    try { await circuitBreaker.execute(unreliableUpload); } catch {}

    expect(circuitBreaker.getState()).toBe('open');

    // Should reject without calling function
    await expect(circuitBreaker.execute(unreliableUpload)).rejects.toThrow('Circuit breaker is open');
    expect(unreliableUpload).toHaveBeenCalledTimes(2);
  });
});