import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ANIMATION_DURATION } from '../../constants';

// ========================
// Types
// ========================

export interface ParameterSliderProps {
  // Core properties
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  
  // Display configuration
  label: string;
  unit?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
  
  // Value formatting
  valueType?: 'number' | 'percentage' | 'custom';
  formatValue?: (value: number) => string;
  precision?: number;
  
  // Advanced features
  snapValues?: number[];
  logarithmic?: boolean;
  markers?: SliderMarker[];
  showInput?: boolean;
  showMinMax?: boolean;
  
  // Accessibility
  ariaLabel?: string;
  ariaDescription?: string;
  
  // Performance
  debounceMs?: number;
  
  // Events
  onFocus?: () => void;
  onBlur?: () => void;
  onChangeStart?: () => void;
  onChangeEnd?: () => void;
}

export interface SliderMarker {
  value: number;
  label?: string;
  type?: 'default' | 'recommended' | 'warning' | 'info';
  description?: string;
}

// ========================
// Parameter Slider Component
// ========================

export const ParameterSlider: React.FC<ParameterSliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  unit = '',
  description,
  className = '',
  disabled = false,
  valueType = 'number',
  formatValue,
  precision = 1,
  snapValues = [],
  logarithmic = false,
  markers = [],
  showInput = true,
  showMinMax = true,
  ariaLabel,
  ariaDescription,
  debounceMs = 0,
  onFocus,
  onBlur,
  onChangeStart,
  onChangeEnd,
}) => {
  // Local state for immediate UI updates
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Refs
  const sliderRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartValueRef = useRef<number>(value);
  
  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  // Debounced onChange handler
  const debouncedOnChange = useCallback((newValue: number) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    if (debounceMs > 0) {
      debounceTimeoutRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    } else {
      onChange(newValue);
    }
  }, [onChange, debounceMs]);
  
  // Value transformation for logarithmic scale
  const transformValue = useCallback((rawValue: number, toLogarithmic: boolean): number => {
    if (!logarithmic) return rawValue;
    
    if (toLogarithmic) {
      // Convert from linear to logarithmic scale
      const logMin = Math.log(min || 0.001);
      const logMax = Math.log(max);
      // const _scale = (logMax - logMin) / 100;
      return Math.exp(logMin + (rawValue / 100) * (logMax - logMin));
    } else {
      // Convert from logarithmic to linear scale
      const logMin = Math.log(min || 0.001);
      const logMax = Math.log(max);
      return ((Math.log(rawValue) - logMin) / (logMax - logMin)) * 100;
    }
  }, [logarithmic, min, max]);
  
  // Snap to nearest value if snapValues are provided
  const snapToValue = useCallback((inputValue: number): number => {
    if (snapValues.length === 0) return inputValue;
    
    const closestSnap = snapValues.reduce((closest, snap) =>
      Math.abs(snap - inputValue) < Math.abs(closest - inputValue) ? snap : closest
    );
    
    // Only snap if within reasonable distance
    const snapThreshold = (max - min) / 100; // 1% of range
    return Math.abs(closestSnap - inputValue) <= snapThreshold ? closestSnap : inputValue;
  }, [snapValues, max, min]);
  
  // Format display value
  const formatDisplayValue = useCallback((val: number): string => {
    if (formatValue) return formatValue(val);
    
    switch (valueType) {
      case 'percentage':
        return `${(val * 100).toFixed(precision)}%`;
      case 'custom':
        return val.toString();
      default:
        return val.toFixed(precision);
    }
  }, [formatValue, valueType, precision]);
  
  // Handle slider value change
  const handleSliderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseFloat(event.target.value);
    const transformedValue = logarithmic ? transformValue(rawValue, true) : rawValue;
    const snappedValue = snapToValue(transformedValue);
    const clampedValue = Math.max(min, Math.min(max, snappedValue));
    
    setLocalValue(clampedValue);
    debouncedOnChange(clampedValue);
  }, [logarithmic, transformValue, snapToValue, min, max, debouncedOnChange]);
  
  // Handle input value change
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = parseFloat(event.target.value);
    if (isNaN(inputValue)) return;
    
    const clampedValue = Math.max(min, Math.min(max, inputValue));
    setLocalValue(clampedValue);
    debouncedOnChange(clampedValue);
  }, [min, max, debouncedOnChange]);
  
  // Handle focus events
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setShowTooltip(true);
    onFocus?.();
  }, [onFocus]);
  
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setShowTooltip(false);
    onBlur?.();
  }, [onBlur]);
  
  // Handle drag events (mouse and touch)
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
    setShowTooltip(true);
    dragStartValueRef.current = localValue;
    onChangeStart?.();
  }, [localValue, onChangeStart]);
  
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    // Prevent default to avoid scrolling
    event.preventDefault();
    setIsDragging(true);
    setShowTooltip(true);
    dragStartValueRef.current = localValue;
    onChangeStart?.();
  }, [localValue, onChangeStart]);
  
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setShowTooltip(false);
      onChangeEnd?.();
    }
  }, [isDragging, onChangeEnd]);
  
  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setShowTooltip(false);
      onChangeEnd?.();
    }
  }, [isDragging, onChangeEnd]);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;
    
    const { key } = event;
    let newValue = localValue;
    const stepSize = logarithmic ? (max - min) / 100 : step;
    
    switch (key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        newValue = Math.max(min, localValue - stepSize);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        newValue = Math.min(max, localValue + stepSize);
        break;
      case 'Home':
        event.preventDefault();
        newValue = min;
        break;
      case 'End':
        event.preventDefault();
        newValue = max;
        break;
      case 'PageDown':
        event.preventDefault();
        newValue = Math.max(min, localValue - stepSize * 10);
        break;
      case 'PageUp':
        event.preventDefault();
        newValue = Math.min(max, localValue + stepSize * 10);
        break;
      default:
        return;
    }
    
    const snappedValue = snapToValue(newValue);
    setLocalValue(snappedValue);
    debouncedOnChange(snappedValue);
  }, [disabled, localValue, logarithmic, max, min, step, snapToValue, debouncedOnChange]);
  
  // Calculate slider track progress
  const sliderProgress = useMemo(() => {
    const progress = logarithmic 
      ? transformValue(localValue, false)
      : ((localValue - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, progress));
  }, [localValue, logarithmic, transformValue, min, max]);
  
  // Calculate marker positions
  const markerElements = useMemo(() => {
    return markers.map((marker, index) => {
      const position = logarithmic
        ? transformValue(marker.value, false)
        : ((marker.value - min) / (max - min)) * 100;
      
      const markerClass = {
        'default': 'bg-gray-400',
        'recommended': 'bg-green-500',
        'warning': 'bg-yellow-500',
        'info': 'bg-blue-500',
      }[marker.type || 'default'];
      
      return (
        <div
          key={index}
          className={`absolute w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 ${markerClass}`}
          style={{ left: `${position}%`, top: '50%' }}
          title={marker.description || marker.label}
        />
      );
    });
  }, [markers, logarithmic, transformValue, min, max]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);
  
  // Add global mouse/touch up listeners for drag handling
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => handleMouseUp();
      const handleGlobalTouchEnd = () => handleTouchEnd();
      
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchend', handleGlobalTouchEnd);
      document.addEventListener('touchcancel', handleGlobalTouchEnd);
      
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('touchend', handleGlobalTouchEnd);
        document.removeEventListener('touchcancel', handleGlobalTouchEnd);
      };
    }
  }, [isDragging, handleMouseUp, handleTouchEnd]);
  
  const sliderValue = logarithmic ? transformValue(localValue, false) : localValue;
  const displayValue = formatDisplayValue(localValue);
  
  return (
    <div className={`parameter-slider space-y-3 ${className}`}>
      {/* Label and Value Display */}
      <div className="flex items-center justify-between">
        <label 
          htmlFor={`slider-${label.replace(/\s+/g, '-').toLowerCase()}`}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
        
        {showInput ? (
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={localValue}
              onChange={handleInputChange}
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              className={`
                w-16 sm:w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded-md
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
                transition-colors duration-${ANIMATION_DURATION.FAST}
                touch-manipulation
              `}
              aria-label={ariaLabel || `${label} input field`}
            />
            {unit && (
              <span className="text-sm text-gray-500 min-w-max">{unit}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-1">
            <span className="text-sm font-medium text-gray-900">{displayValue}</span>
            {unit && (
              <span className="text-sm text-gray-500">{unit}</span>
            )}
          </div>
        )}
      </div>
      
      {/* Slider Track Container */}
      <div className="relative">
        {/* Slider Track */}
        <div className={`
          relative h-8 sm:h-6 bg-gray-200 rounded-lg overflow-hidden
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          touch-pan-x touch-manipulation
        `}>
          {/* Progress Track */}
          <div
            className={`
              absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600
              transition-all duration-${ANIMATION_DURATION.FAST} ease-out
              ${isFocused || isDragging ? 'shadow-lg' : ''}
            `}
            style={{ width: `${sliderProgress}%` }}
          />
          
          {/* Markers */}
          {markerElements}
          
          {/* Slider Handle */}
          <div
            className={`
              absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2
              w-8 h-8 sm:w-6 sm:h-6 bg-white border-2 rounded-full shadow-md
              transition-all duration-${ANIMATION_DURATION.FAST} ease-out
              ${isFocused || isDragging 
                ? 'border-blue-500 shadow-lg scale-110' 
                : 'border-gray-300 hover:border-blue-400 hover:shadow-md'
              }
              ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'}
              touch-manipulation
            `}
            style={{ left: `${sliderProgress}%` }}
          />
          
          {/* Hidden Range Input */}
          <input
            ref={sliderRef}
            id={`slider-${label.replace(/\s+/g, '-').toLowerCase()}`}
            type="range"
            min={logarithmic ? 0 : min}
            max={logarithmic ? 100 : max}
            step={logarithmic ? 0.1 : step}
            value={sliderValue}
            onChange={handleSliderChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={ariaLabel || label}
            aria-description={ariaDescription || description}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={localValue}
            aria-valuetext={`${displayValue}${unit}`}
          />
        </div>
        
        {/* Tooltip */}
        {(showTooltip && (isFocused || isDragging)) && (
          <div
            className={`
              absolute z-10 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md
              transform -translate-x-1/2 -translate-y-full pointer-events-none
              transition-opacity duration-${ANIMATION_DURATION.FAST}
              ${showTooltip ? 'opacity-100' : 'opacity-0'}
            `}
            style={{ 
              left: `${sliderProgress}%`,
              top: '-8px'
            }}
          >
            {displayValue}{unit}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>
      
      {/* Min/Max Labels */}
      {showMinMax && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>{formatDisplayValue(min)}{unit}</span>
          <span>{formatDisplayValue(max)}{unit}</span>
        </div>
      )}
      
      {/* Description */}
      {description && (
        <p className="text-xs text-gray-600 leading-relaxed">
          {description}
        </p>
      )}
      
      {/* Snap Values Display */}
      {snapValues.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs">
          <span className="text-gray-500 hidden sm:inline">Quick values:</span>
          <span className="text-gray-500 sm:hidden">Quick:</span>
          {snapValues.map((snapValue, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                setLocalValue(snapValue);
                debouncedOnChange(snapValue);
              }}
              disabled={disabled}
              className={`
                px-2 py-1 sm:px-3 sm:py-1 rounded text-xs font-medium transition-colors
                min-h-8 sm:min-h-6 touch-manipulation
                ${localValue === snapValue
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 active:bg-gray-300'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {formatDisplayValue(snapValue)}{unit}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ========================
// Specialized Slider Components
// ========================

export const LayerThicknessSlider: React.FC<Omit<ParameterSliderProps, 'label' | 'unit' | 'description' | 'min' | 'max' | 'step' | 'precision'>> = (props) => (
  <ParameterSlider
    {...props}
    label="Layer Thickness"
    unit="mm"
    description="Thinner layers = finer detail, thicker layers = faster printing"
    min={0.1}
    max={0.5}
    step={0.1}
    precision={1}
    snapValues={[0.1, 0.2, 0.3, 0.4, 0.5]}
    markers={[
      { value: 0.2, type: 'recommended', label: 'Recommended', description: 'Best balance of detail and speed' }
    ]}
  />
);

export const BaseThicknessSlider: React.FC<Omit<ParameterSliderProps, 'label' | 'unit' | 'description' | 'min' | 'max' | 'step' | 'precision'>> = (props) => (
  <ParameterSlider
    {...props}
    label="Base Thickness"
    unit="mm"
    description="Structural foundation - thicker base = stronger bookmark"
    min={1.0}
    max={3.0}
    step={0.1}
    precision={1}
    snapValues={[1.0, 1.5, 2.0, 2.5, 3.0]}
    markers={[
      { value: 2.0, type: 'recommended', label: 'Recommended', description: 'Optimal strength and material usage' }
    ]}
  />
);

export const CornerRadiusSlider: React.FC<Omit<ParameterSliderProps, 'label' | 'unit' | 'description' | 'min' | 'max' | 'step' | 'precision'>> = (props) => (
  <ParameterSlider
    {...props}
    label="Corner Radius"
    unit="mm"
    description="Rounded corners for comfort and style"
    min={0}
    max={10}
    step={0.5}
    precision={1}
    snapValues={[0, 1, 2, 3, 5, 10]}
    markers={[
      { value: 0, type: 'info', label: 'Sharp', description: 'Sharp corners' },
      { value: 2, type: 'recommended', label: 'Recommended', description: 'Comfortable rounded corners' },
      { value: 10, type: 'info', label: 'Very Round', description: 'Maximum rounding' }
    ]}
  />
);

export default ParameterSlider;