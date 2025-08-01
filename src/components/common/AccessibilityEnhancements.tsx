import React, { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { useMediaQuery } from '../../hooks/useResponsiveBreakpoints';

interface AccessibilityContextType {
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  focusManagement: {
    trapFocus: (element: HTMLElement) => () => void;
    restoreFocus: (element: HTMLElement | null) => void;
    getNextFocusableElement: (current: Element, reverse?: boolean) => Element | null;
  };
  preferences: {
    prefersReducedMotion: boolean;
    prefersHighContrast: boolean;
    prefersDarkMode: boolean;
  };
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

/**
 * Accessibility provider with screen reader support and focus management
 */
export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [liveRegion, setLiveRegion] = useState<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const prefersHighContrast = useMediaQuery('(prefers-contrast: high)');
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    // Create live region for screen reader announcements
    const liveDiv = document.createElement('div');
    liveDiv.setAttribute('aria-live', 'polite');
    liveDiv.setAttribute('aria-atomic', 'true');
    liveDiv.className = 'sr-only';
    liveDiv.id = 'accessibility-live-region';
    document.body.appendChild(liveDiv);
    setLiveRegion(liveDiv);

    return () => {
      if (document.body.contains(liveDiv)) {
        document.body.removeChild(liveDiv);
      }
    };
  }, []);

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (liveRegion) {
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }
  }, [liveRegion]);

  const getFocusableElements = useCallback((container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors))
      .filter(el => {
        const element = el as HTMLElement;
        return element.offsetWidth > 0 && 
               element.offsetHeight > 0 && 
               !element.hidden &&
               getComputedStyle(element).visibility !== 'hidden';
      }) as HTMLElement[];
  }, []);

  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Store current focus to restore later
    previousFocusRef.current = document.activeElement as HTMLElement;
    
    // Focus first element
    firstElement?.focus();

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [getFocusableElements]);

  const restoreFocus = useCallback((fallbackElement: HTMLElement | null = null) => {
    const elementToFocus = previousFocusRef.current || fallbackElement;
    if (elementToFocus && document.body.contains(elementToFocus)) {
      elementToFocus.focus();
    }
    previousFocusRef.current = null;
  }, []);

  const getNextFocusableElement = useCallback((current: Element, reverse: boolean = false): Element | null => {
    const focusableElements = getFocusableElements(document.body);
    const currentIndex = focusableElements.indexOf(current as HTMLElement);
    
    if (currentIndex === -1) return null;
    
    const nextIndex = reverse ? currentIndex - 1 : currentIndex + 1;
    
    if (nextIndex < 0) {
      return focusableElements[focusableElements.length - 1];
    } else if (nextIndex >= focusableElements.length) {
      return focusableElements[0];
    }
    
    return focusableElements[nextIndex];
  }, [getFocusableElements]);

  const contextValue: AccessibilityContextType = {
    announceToScreenReader,
    focusManagement: {
      trapFocus,
      restoreFocus,
      getNextFocusableElement
    },
    preferences: {
      prefersReducedMotion,
      prefersHighContrast,
      prefersDarkMode
    }
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
}

/**
 * Skip navigation link for keyboard users
 */
export const SkipNavigation: React.FC<{
  targetId: string;
  children: React.ReactNode;
}> = ({ targetId, children }) => {
  const handleSkip = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleSkip}
      onKeyDown={(e) => e.key === 'Enter' && handleSkip(e)}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      {children}
    </a>
  );
};

/**
 * Accessible modal dialog with focus trap and ARIA attributes
 */
export const AccessibleModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
}> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  closeOnEscape = true,
  closeOnOverlayClick = true
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const { focusManagement, announceToScreenReader } = useAccessibility();
  const cleanupFocusTrapRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      announceToScreenReader(`Dialog opened: ${title || 'Dialog'}`);
      
      if (modalRef.current) {
        cleanupFocusTrapRef.current = focusManagement.trapFocus(modalRef.current);
      }
    } else {
      focusManagement.restoreFocus(null);
      if (cleanupFocusTrapRef.current) {
        cleanupFocusTrapRef.current();
      }
    }

    return () => {
      if (cleanupFocusTrapRef.current) {
        cleanupFocusTrapRef.current();
      }
    };
  }, [isOpen, title, focusManagement, announceToScreenReader]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          className={`
            relative bg-white rounded-lg shadow-xl max-w-md w-full p-6
            transform transition-all duration-300
            ${className}
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close dialog"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
};

/**
 * Accessible form field with proper labeling and error handling
 */
export const AccessibleFormField: React.FC<{
  label: string;
  children: React.ReactElement;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}> = ({ label, children, error, hint, required = false, className = '' }) => {
  const fieldId = useRef(`field-${Math.random().toString(36).substr(2, 9)}`);
  const errorId = useRef(`error-${fieldId.current}`);
  const hintId = useRef(`hint-${fieldId.current}`);

  const childWithProps = React.cloneElement(children as React.ReactElement<any>, {
    id: fieldId.current,
    'aria-describedby': [
      hint ? hintId.current : '',
      error ? errorId.current : ''
    ].filter(Boolean).join(' ') || undefined,
    'aria-invalid': error ? 'true' : 'false',
    'aria-required': required,
    ...(children.props || {})
  });

  return (
    <div className={className}>
      <label
        htmlFor={fieldId.current}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      {hint && (
        <div
          id={hintId.current}
          className="text-sm text-gray-600 mb-1"
        >
          {hint}
        </div>
      )}

      {childWithProps}

      {error && (
        <div
          id={errorId.current}
          className="text-sm text-red-600 mt-1"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
};

/**
 * Progress indicator with screen reader announcements
 */
export const AccessibleProgress: React.FC<{
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  announceChanges?: boolean;
  className?: string;
}> = ({
  value,
  max = 100,
  label,
  showPercentage = true,
  announceChanges = false,
  className = ''
}) => {
  const { announceToScreenReader } = useAccessibility();
  const previousValueRef = useRef(value);
  const percentage = Math.round((value / max) * 100);

  useEffect(() => {
    if (announceChanges && value !== previousValueRef.current) {
      const change = value - previousValueRef.current;
      if (Math.abs(change) >= max * 0.1) { // Announce significant changes (10%+)
        announceToScreenReader(`Progress updated: ${percentage}% complete`);
      }
      previousValueRef.current = value;
    }
  }, [value, max, percentage, announceChanges, announceToScreenReader]);

  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm text-gray-500">{percentage}%</span>
          )}
        </div>
      )}
      
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'Progress'}
        className="w-full bg-gray-200 rounded-full h-2"
      >
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Accessible button with loading state and proper ARIA attributes
 */
export const AccessibleButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}> = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'medium',
  className = '',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby
}) => {
  const { announceToScreenReader } = useAccessibility();

  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  useEffect(() => {
    if (loading) {
      announceToScreenReader('Button is loading');
    }
  }, [loading, announceToScreenReader]);

  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
  };

  const sizeClasses = {
    small: 'px-3 py-2 text-sm',
    medium: 'px-4 py-2 text-sm',
    large: 'px-6 py-3 text-base'
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      aria-busy={loading}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {loading && (
        <svg 
          className="animate-spin -ml-1 mr-3 h-4 w-4" 
          fill="none" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      <span className={loading ? 'sr-only' : ''}>
        {loading ? 'Loading...' : children}
      </span>
    </button>
  );
};

/**
 * Screen reader only content
 */
export const ScreenReaderOnly: React.FC<{
  children: React.ReactNode;
  focusable?: boolean;
}> = ({ children, focusable = false }) => {
  return (
    <span className={focusable ? 'sr-only focus:not-sr-only' : 'sr-only'}>
      {children}
    </span>
  );
};

/**
 * Hook for keyboard navigation
 */
export function useKeyboardNavigation() {
  const { focusManagement } = useAccessibility();

  const handleArrowNavigation = useCallback((
    event: KeyboardEvent, 
    elements: HTMLElement[], 
    currentIndex: number
  ) => {
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % elements.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + elements.length) % elements.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = elements.length - 1;
        break;
      default:
        return false;
    }

    elements[nextIndex]?.focus();
    return true;
  }, []);

  return { handleArrowNavigation, focusManagement };
}

/**
 * Hook for managing focus announcements
 */
export function useFocusAnnouncement() {
  const { announceToScreenReader } = useAccessibility();

  const announceFocus = useCallback((element: HTMLElement) => {
    const text = element.textContent || element.getAttribute('aria-label') || '';
    if (text) {
      announceToScreenReader(`Focused: ${text}`);
    }
  }, [announceToScreenReader]);

  return { announceFocus };
}