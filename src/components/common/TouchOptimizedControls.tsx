import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTouchDevice } from '../../hooks/useResponsiveBreakpoints';

interface TouchSliderProps {
  min: number;
  max: number;
  value: number;
  step?: number;
  onChange: (value: number) => void;
  onChangeComplete?: (value: number) => void;
  label?: string;
  unit?: string;
  disabled?: boolean;
  className?: string;
  thumbSize?: 'small' | 'medium' | 'large';
  trackHeight?: 'thin' | 'medium' | 'thick';
  showValue?: boolean;
  formatValue?: (value: number) => string;
}

interface GestureState {
  isActive: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  scale: number;
  rotation: number;
}

interface TouchAreaProps {
  children: React.ReactNode;
  onTap?: (event: TouchEvent) => void;
  onDoubleTap?: (event: TouchEvent) => void;
  onLongPress?: (event: TouchEvent) => void;
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down', event: TouchEvent) => void;
  onPinch?: (scale: number, event: TouchEvent) => void;
  onRotate?: (rotation: number, event: TouchEvent) => void;
  className?: string;
  disabled?: boolean;
  longPressDelay?: number;
  swipeThreshold?: number;
  doubleTapDelay?: number;
}

/**
 * Touch-optimized slider component with larger touch targets
 */
export const TouchSlider: React.FC<TouchSliderProps> = ({
  min,
  max,
  value,
  step = 1,
  onChange,
  onChangeComplete,
  label,
  unit = '',
  disabled = false,
  className = '',
  thumbSize = 'medium',
  trackHeight = 'medium',
  showValue = true,
  formatValue
}) => {
  const isTouchDevice = useTouchDevice();
  const [isDragging, setIsDragging] = useState(false);
  const [_dragOffset, setDragOffset] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const thumbSizes = {
    small: 'w-5 h-5',
    medium: isTouchDevice ? 'w-8 h-8' : 'w-6 h-6',
    large: 'w-10 h-10'
  };

  const trackHeights = {
    thin: 'h-1',
    medium: isTouchDevice ? 'h-3' : 'h-2',
    thick: 'h-4'
  };

  const percentage = ((value - min) / (max - min)) * 100;

  const handleStart = useCallback((clientX: number) => {
    if (disabled) return;
    
    setIsDragging(true);
    
    if (sliderRef.current) {
      const rect = sliderRef.current.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      setDragOffset(offsetX);
    }
  }, [disabled]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || !sliderRef.current || disabled) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    const newValue = min + (percentage / 100) * (max - min);
    const steppedValue = Math.round(newValue / step) * step;

    onChange(Math.max(min, Math.min(max, steppedValue)));
  }, [isDragging, min, max, step, onChange, disabled]);

  const handleEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragOffset(0);
      onChangeComplete?.(value);
    }
  }, [isDragging, value, onChangeComplete]);

  // Mouse events
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    handleStart(event.clientX);
  }, [handleStart]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    event.preventDefault();
    handleMove(event.clientX);
  }, [handleMove]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    event.preventDefault();
    handleEnd();
  }, [handleEnd]);

  // Touch events
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    const touch = event.touches[0];
    handleStart(touch.clientX);
  }, [handleStart]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    event.preventDefault();
    const touch = event.touches[0];
    handleMove(touch.clientX);
  }, [handleMove]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    event.preventDefault();
    handleEnd();
  }, [handleEnd]);

  // Event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    let newValue = value;
    
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        newValue = Math.max(min, value - step);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        newValue = Math.min(max, value + step);
        break;
      case 'Home':
        newValue = min;
        break;
      case 'End':
        newValue = max;
        break;
      case 'PageDown':
        newValue = Math.max(min, value - step * 10);
        break;
      case 'PageUp':
        newValue = Math.min(max, value + step * 10);
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(newValue);
  }, [value, min, max, step, onChange, disabled]);

  const displayValue = formatValue ? formatValue(value) : `${value}${unit}`;

  return (
    <div className={`touch-slider ${className}`}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">
            {label}
          </label>
          {showValue && (
            <span className="text-sm text-gray-500 font-mono">
              {displayValue}
            </span>
          )}
        </div>
      )}
      
      <div className="relative">
        {/* Track */}
        <div
          ref={sliderRef}
          className={`
            relative bg-gray-200 rounded-full cursor-pointer
            ${trackHeights[trackHeight]}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Progress */}
          <div
            className="absolute top-0 left-0 bg-blue-500 rounded-full h-full transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
          
          {/* Thumb */}
          <div
            ref={thumbRef}
            className={`
              absolute top-1/2 transform -translate-y-1/2 bg-white border-2 border-blue-500 rounded-full shadow-md cursor-grab
              transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${thumbSizes[thumbSize]}
              ${isDragging ? 'cursor-grabbing scale-110 shadow-lg' : ''}
              ${disabled ? 'cursor-not-allowed opacity-50' : ''}
            `}
            style={{ 
              left: `calc(${percentage}% - ${thumbSizes[thumbSize].includes('w-5') ? '0.625rem' : thumbSizes[thumbSize].includes('w-6') ? '0.75rem' : thumbSizes[thumbSize].includes('w-8') ? '1rem' : '1.25rem'})` 
            }}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-label={label}
            aria-disabled={disabled}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Enhanced touch area component with gesture recognition
 */
export const TouchArea: React.FC<TouchAreaProps> = ({
  children,
  onTap,
  onDoubleTap,
  onLongPress,
  onSwipe,
  onPinch,
  onRotate,
  className = '',
  disabled = false,
  longPressDelay = 500,
  swipeThreshold = 50,
  doubleTapDelay = 300
}) => {
  const [gestureState, setGestureState] = useState<GestureState>({
    isActive: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    scale: 1,
    rotation: 0
  });

  const longPressTimerRef = useRef<number | undefined>(undefined);
  const doubleTapTimerRef = useRef<number | undefined>(undefined);
  const lastTapTimeRef = useRef<number>(0);
  const touchStartRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
    if (doubleTapTimerRef.current) {
      clearTimeout(doubleTapTimerRef.current);
      doubleTapTimerRef.current = undefined;
    }
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (disabled) return;

    clearTimers();
    touchStartRef.current = Date.now();

    const touch = event.touches[0];
    const newState: GestureState = {
      isActive: true,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      deltaX: 0,
      deltaY: 0,
      scale: 1,
      rotation: 0
    };

    setGestureState(newState);

    // Start long press timer
    if (onLongPress) {
      longPressTimerRef.current = window.setTimeout(() => {
        if (gestureState.isActive) {
          onLongPress(event.nativeEvent);
        }
      }, longPressDelay);
    }
  }, [disabled, gestureState.isActive, onLongPress, longPressDelay, clearTimers]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (disabled || !gestureState.isActive) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - gestureState.startX;
    const deltaY = touch.clientY - gestureState.startY;

    setGestureState(prev => ({
      ...prev,
      currentX: touch.clientX,
      currentY: touch.clientY,
      deltaX,
      deltaY
    }));

    // Cancel long press if moved too much
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      clearTimers();
    }

    // Handle multi-touch gestures
    if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];

      // Calculate distance for pinch
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // Calculate angle for rotation
      const angle = Math.atan2(
        touch2.clientY - touch1.clientY,
        touch2.clientX - touch1.clientX
      ) * 180 / Math.PI;

      // You would store initial distance and angle to calculate relative changes
      // This is simplified - in production you'd want to track initial values
      if (onPinch) {
        onPinch(distance / 100, event.nativeEvent); // Normalized scale
      }

      if (onRotate) {
        onRotate(angle, event.nativeEvent);
      }
    }
  }, [disabled, gestureState, onPinch, onRotate, clearTimers]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (disabled || !gestureState.isActive) return;

    clearTimers();

    const touchDuration = Date.now() - touchStartRef.current;
    const { deltaX, deltaY } = gestureState;

    setGestureState(prev => ({
      ...prev,
      isActive: false
    }));

    // Handle swipe gestures
    if (onSwipe && (Math.abs(deltaX) > swipeThreshold || Math.abs(deltaY) > swipeThreshold)) {
      let direction: 'left' | 'right' | 'up' | 'down';
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      onSwipe(direction, event.nativeEvent);
      return;
    }

    // Handle tap gestures (only if not moved much and quick)
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && touchDuration < 300) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;

      if (onDoubleTap && timeSinceLastTap < doubleTapDelay) {
        // Double tap
        onDoubleTap(event.nativeEvent);
        lastTapTimeRef.current = 0; // Reset to prevent triple tap
      } else if (onTap) {
        // Single tap (with delay to check for double tap)
        if (onDoubleTap) {
          doubleTapTimerRef.current = window.setTimeout(() => {
            onTap(event.nativeEvent);
          }, doubleTapDelay);
        } else {
          onTap(event.nativeEvent);
        }
        lastTapTimeRef.current = now;
      }
    }
  }, [disabled, gestureState, onSwipe, swipeThreshold, onTap, onDoubleTap, doubleTapDelay, clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return (
    <div
      className={`touch-area ${className} ${disabled ? 'pointer-events-none' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'none' }} // Prevent default touch behaviors
    >
      {children}
    </div>
  );
};

/**
 * Touch-optimized button with larger touch targets
 */
export const TouchButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  'aria-label'?: string;
}> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  className = '',
  'aria-label': ariaLabel
}) => {
  const isTouchDevice = useTouchDevice();

  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500'
  };

  const sizeClasses = {
    small: isTouchDevice ? 'px-4 py-3 text-sm min-h-[44px]' : 'px-3 py-2 text-sm',
    medium: isTouchDevice ? 'px-6 py-4 text-base min-h-[48px]' : 'px-4 py-2 text-sm',
    large: isTouchDevice ? 'px-8 py-5 text-lg min-h-[52px]' : 'px-6 py-3 text-base'
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};

/**
 * Hook for detecting and handling various touch gestures
 */
export function useGestures(element: React.RefObject<HTMLElement>) {
  const [isGestureActive, setIsGestureActive] = useState(false);
  
  useEffect(() => {
    const el = element.current;
    if (!el) return;



    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        // Store gesture start data for potential future use
        setIsGestureActive(true);
      }
    };

    const handleTouchEnd = () => {
      setIsGestureActive(false);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [element]);

  return { isGestureActive };
}