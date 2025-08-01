import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { CropRegion } from '../../types';
import { 
  AnimationFrameDebouncer, 
  throttle, 
  imageRenderer, 
  performanceCollector,
  optimizeCanvas,
  calculateOptimalSize
} from '../../utils/canvasOptimization';

export interface CropControlsProps {
  image: HTMLImageElement;
  cropRegion: CropRegion;
  onCropChange: (cropRegion: CropRegion) => void;
  scale: number;
  onScaleChange: (scale: number) => void;
  aspectRatioLocked: boolean;
  onAspectRatioToggle: () => void;
  className?: string;
}

interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  dragType: 'move' | 'resize' | null;
  resizeHandle: ResizeHandle | null;
  startPos: { x: number; y: number };
  startCrop: CropRegion;
}

type ResizeHandle = 
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | 'top' | 'bottom' | 'left' | 'right';

const HANDLE_SIZE = 8;
const MIN_CROP_SIZE = 50;

export const CropControls: React.FC<CropControlsProps> = ({
  image,
  cropRegion,
  onCropChange,
  scale,
  onScaleChange,
  aspectRatioLocked,
  onAspectRatioToggle,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameDebouncer = useRef(new AnimationFrameDebouncer());
  
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isResizing: false,
    dragType: null,
    resizeHandle: null,
    startPos: { x: 0, y: 0 },
    startCrop: cropRegion,
  });

  // Calculate optimal display dimensions with performance optimization
  const { displayWidth, displayHeight, devicePixelRatio } = useMemo(() => {
    const maxCanvasSize = 1000; // Limit canvas size for performance
    const dpr = window.devicePixelRatio || 1;
    
    const optimal = calculateOptimalSize(
      image.naturalWidth * scale,
      image.naturalHeight * scale,
      maxCanvasSize,
      maxCanvasSize
    );
    
    return {
      displayWidth: optimal.width,
      displayHeight: optimal.height,
      devicePixelRatio: dpr,
    };
  }, [image.naturalWidth, image.naturalHeight, scale]);

  // Convert crop region to display coordinates
  const displayCrop = {
    x: cropRegion.x * scale,
    y: cropRegion.y * scale,
    width: cropRegion.width * scale,
    height: cropRegion.height * scale,
  };

  // Render the cropping interface with performance optimization
  const drawCanvas = useCallback(() => {
    const endTiming = performanceCollector.startTiming('canvas-render');
    
    const canvas = canvasRef.current;
    if (!canvas) {
      endTiming();
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      endTiming();
      return;
    }

    // Set canvas size with device pixel ratio for crisp rendering
    const physicalWidth = displayWidth * devicePixelRatio;
    const physicalHeight = displayHeight * devicePixelRatio;
    
    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      
      // Optimize canvas settings
      optimizeCanvas(canvas);
      
      // Scale context for device pixel ratio
      ctx.scale(devicePixelRatio, devicePixelRatio);
    }

    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Draw image using optimized renderer
    imageRenderer.drawImage(ctx, image, {
      dx: 0,
      dy: 0,
      dw: displayWidth,
      dh: displayHeight,
      cacheKey: `image-${image.src}-${displayWidth}x${displayHeight}`,
    });

    // Draw overlay (darken outside crop area)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';

    // Fill entire canvas
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear crop area (composite operation)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(displayCrop.x, displayCrop.y, displayCrop.width, displayCrop.height);

    ctx.restore();

    // Draw crop rectangle border
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(displayCrop.x, displayCrop.y, displayCrop.width, displayCrop.height);

    // Draw grid lines for rule of thirds
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    
    // Vertical lines
    const thirdWidth = displayCrop.width / 3;
    for (let i = 1; i < 3; i++) {
      const x = displayCrop.x + i * thirdWidth;
      ctx.beginPath();
      ctx.moveTo(x, displayCrop.y);
      ctx.lineTo(x, displayCrop.y + displayCrop.height);
      ctx.stroke();
    }

    // Horizontal lines
    const thirdHeight = displayCrop.height / 3;
    for (let i = 1; i < 3; i++) {
      const y = displayCrop.y + i * thirdHeight;
      ctx.beginPath();
      ctx.moveTo(displayCrop.x, y);
      ctx.lineTo(displayCrop.x + displayCrop.width, y);
      ctx.stroke();
    }

    // Draw resize handles
    ctx.fillStyle = '#2563eb';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    const handles: { x: number; y: number; cursor: string }[] = [
      // Corner handles
      { x: displayCrop.x - HANDLE_SIZE / 2, y: displayCrop.y - HANDLE_SIZE / 2, cursor: 'nw-resize' },
      { x: displayCrop.x + displayCrop.width - HANDLE_SIZE / 2, y: displayCrop.y - HANDLE_SIZE / 2, cursor: 'ne-resize' },
      { x: displayCrop.x - HANDLE_SIZE / 2, y: displayCrop.y + displayCrop.height - HANDLE_SIZE / 2, cursor: 'sw-resize' },
      { x: displayCrop.x + displayCrop.width - HANDLE_SIZE / 2, y: displayCrop.y + displayCrop.height - HANDLE_SIZE / 2, cursor: 'se-resize' },
      // Edge handles
      { x: displayCrop.x + displayCrop.width / 2 - HANDLE_SIZE / 2, y: displayCrop.y - HANDLE_SIZE / 2, cursor: 'n-resize' },
      { x: displayCrop.x + displayCrop.width / 2 - HANDLE_SIZE / 2, y: displayCrop.y + displayCrop.height - HANDLE_SIZE / 2, cursor: 's-resize' },
      { x: displayCrop.x - HANDLE_SIZE / 2, y: displayCrop.y + displayCrop.height / 2 - HANDLE_SIZE / 2, cursor: 'w-resize' },
      { x: displayCrop.x + displayCrop.width - HANDLE_SIZE / 2, y: displayCrop.y + displayCrop.height / 2 - HANDLE_SIZE / 2, cursor: 'e-resize' },
    ];

    handles.forEach(handle => {
      ctx.fillRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE);
    });

    endTiming();
  }, [image, displayWidth, displayHeight, displayCrop, scale, devicePixelRatio]);

  // Throttled draw function to prevent excessive redraws
  const throttledDraw = useMemo(() => 
    throttle(() => {
      animationFrameDebouncer.current.schedule(drawCanvas);
    }, 16), // ~60 FPS
    [drawCanvas]
  );

  // Get resize handle at position
  const getResizeHandle = useCallback((x: number, y: number): ResizeHandle | null => {
    const tolerance = HANDLE_SIZE / 2 + 2;

    // Corner handles
    if (Math.abs(x - displayCrop.x) <= tolerance && Math.abs(y - displayCrop.y) <= tolerance) {
      return 'top-left';
    }
    if (Math.abs(x - (displayCrop.x + displayCrop.width)) <= tolerance && Math.abs(y - displayCrop.y) <= tolerance) {
      return 'top-right';
    }
    if (Math.abs(x - displayCrop.x) <= tolerance && Math.abs(y - (displayCrop.y + displayCrop.height)) <= tolerance) {
      return 'bottom-left';
    }
    if (Math.abs(x - (displayCrop.x + displayCrop.width)) <= tolerance && Math.abs(y - (displayCrop.y + displayCrop.height)) <= tolerance) {
      return 'bottom-right';
    }

    // Edge handles
    if (Math.abs(x - (displayCrop.x + displayCrop.width / 2)) <= tolerance && Math.abs(y - displayCrop.y) <= tolerance) {
      return 'top';
    }
    if (Math.abs(x - (displayCrop.x + displayCrop.width / 2)) <= tolerance && Math.abs(y - (displayCrop.y + displayCrop.height)) <= tolerance) {
      return 'bottom';
    }
    if (Math.abs(x - displayCrop.x) <= tolerance && Math.abs(y - (displayCrop.y + displayCrop.height / 2)) <= tolerance) {
      return 'left';
    }
    if (Math.abs(x - (displayCrop.x + displayCrop.width)) <= tolerance && Math.abs(y - (displayCrop.y + displayCrop.height / 2)) <= tolerance) {
      return 'right';
    }

    return null;
  }, [displayCrop]);

  // Check if point is inside crop area
  const isInsideCrop = useCallback((x: number, y: number): boolean => {
    return x >= displayCrop.x && x <= displayCrop.x + displayCrop.width &&
           y >= displayCrop.y && y <= displayCrop.y + displayCrop.height;
  }, [displayCrop]);

  // Get cursor style for position
  const getCursor = useCallback((x: number, y: number): string => {
    const handle = getResizeHandle(x, y);
    if (handle) {
      const cursorMap: Record<ResizeHandle, string> = {
        'top-left': 'nw-resize',
        'top-right': 'ne-resize',
        'bottom-left': 'sw-resize',
        'bottom-right': 'se-resize',
        'top': 'n-resize',
        'bottom': 's-resize',
        'left': 'w-resize',
        'right': 'e-resize',
      };
      return cursorMap[handle];
    }
    
    if (isInsideCrop(x, y)) {
      return 'move';
    }
    
    return 'default';
  }, [getResizeHandle, isInsideCrop]);

  // Constrain crop region to image bounds
  const constrainCrop = useCallback((crop: CropRegion): CropRegion => {
    const result = { ...crop };

    // Ensure minimum size
    result.width = Math.max(MIN_CROP_SIZE / scale, result.width);
    result.height = Math.max(MIN_CROP_SIZE / scale, result.height);

    // Constrain to image bounds
    result.x = Math.max(0, Math.min(image.naturalWidth - result.width, result.x));
    result.y = Math.max(0, Math.min(image.naturalHeight - result.height, result.y));

    // Adjust size if needed to fit in bounds
    if (result.x + result.width > image.naturalWidth) {
      result.width = image.naturalWidth - result.x;
    }
    if (result.y + result.height > image.naturalHeight) {
      result.height = image.naturalHeight - result.y;
    }

    return result;
  }, [image.naturalWidth, image.naturalHeight, scale]);

  // Handle mouse down
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const handle = getResizeHandle(x, y);
    const insideCrop = isInsideCrop(x, y);

    if (handle) {
      setDragState({
        isDragging: false,
        isResizing: true,
        dragType: 'resize',
        resizeHandle: handle,
        startPos: { x, y },
        startCrop: cropRegion,
      });
    } else if (insideCrop) {
      setDragState({
        isDragging: true,
        isResizing: false,
        dragType: 'move',
        resizeHandle: null,
        startPos: { x, y },
        startCrop: cropRegion,
      });
    }

    event.preventDefault();
  }, [getResizeHandle, isInsideCrop, cropRegion]);

  // Handle mouse move
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Update cursor
    const canvas = canvasRef.current;
    if (canvas && !dragState.isDragging && !dragState.isResizing) {
      canvas.style.cursor = getCursor(x, y);
    }

    // Handle dragging
    if (dragState.isDragging || dragState.isResizing) {
      const deltaX = (x - dragState.startPos.x) / scale;
      const deltaY = (y - dragState.startPos.y) / scale;

      if (dragState.dragType === 'move') {
        const newCrop = constrainCrop({
          ...dragState.startCrop,
          x: dragState.startCrop.x + deltaX,
          y: dragState.startCrop.y + deltaY,
        });
        onCropChange(newCrop);
      } else if (dragState.dragType === 'resize' && dragState.resizeHandle) {
        let newCrop = { ...dragState.startCrop };

        switch (dragState.resizeHandle) {
          case 'top-left':
            newCrop.x += deltaX;
            newCrop.y += deltaY;
            newCrop.width -= deltaX;
            newCrop.height -= deltaY;
            break;
          case 'top-right':
            newCrop.y += deltaY;
            newCrop.width += deltaX;
            newCrop.height -= deltaY;
            break;
          case 'bottom-left':
            newCrop.x += deltaX;
            newCrop.width -= deltaX;
            newCrop.height += deltaY;
            break;
          case 'bottom-right':
            newCrop.width += deltaX;
            newCrop.height += deltaY;
            break;
          case 'top':
            newCrop.y += deltaY;
            newCrop.height -= deltaY;
            break;
          case 'bottom':
            newCrop.height += deltaY;
            break;
          case 'left':
            newCrop.x += deltaX;
            newCrop.width -= deltaX;
            break;
          case 'right':
            newCrop.width += deltaX;
            break;
        }

        // Maintain aspect ratio if locked
        if (aspectRatioLocked) {
          const originalAspectRatio = dragState.startCrop.width / dragState.startCrop.height;
          
          // Calculate new dimensions based on which dimension changed more
          const widthChange = Math.abs(newCrop.width - dragState.startCrop.width);
          const heightChange = Math.abs(newCrop.height - dragState.startCrop.height);
          
          if (widthChange > heightChange) {
            newCrop.height = newCrop.width / originalAspectRatio;
          } else {
            newCrop.width = newCrop.height * originalAspectRatio;
          }
        }

        newCrop = constrainCrop(newCrop);
        onCropChange(newCrop);
      }
    }
  }, [dragState, scale, constrainCrop, onCropChange, getCursor, aspectRatioLocked]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      isResizing: false,
      dragType: null,
      resizeHandle: null,
      startPos: { x: 0, y: 0 },
      startCrop: cropRegion,
    });

    // Reset cursor
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  }, [cropRegion]);

  // Touch event handlers for mobile support
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // Same logic as mouse down
      const handle = getResizeHandle(x, y);
      const insideCrop = isInsideCrop(x, y);

      if (handle) {
        setDragState({
          isDragging: false,
          isResizing: true,
          dragType: 'resize',
          resizeHandle: handle,
          startPos: { x, y },
          startCrop: cropRegion,
        });
      } else if (insideCrop) {
        setDragState({
          isDragging: true,
          isResizing: false,
          dragType: 'move',
          resizeHandle: null,
          startPos: { x, y },
          startCrop: cropRegion,
        });
      }
    } else if (event.touches.length === 2) {
      // Pinch to zoom
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      setDragState(prev => ({
        ...prev,
        startPos: { x: distance, y: 0 }, // Store initial pinch distance
      }));
    }
  }, [getResizeHandle, isInsideCrop, cropRegion]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    
    if (event.touches.length === 1 && (dragState.isDragging || dragState.isResizing)) {
      const touch = event.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // const _x = touch.clientX - rect.left;
      // const _y = touch.clientY - rect.top;

      // Reuse mouse move logic
      handleMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as React.MouseEvent);
    } else if (event.touches.length === 2) {
      // Handle pinch zoom
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      const initialDistance = dragState.startPos.x;
      if (initialDistance > 0) {
        const scaleFactor = distance / initialDistance;
        const newScale = Math.max(0.5, Math.min(2.0, scale * scaleFactor));
        onScaleChange(newScale);
        
        // Update start distance for continuous pinching
        setDragState(prev => ({
          ...prev,
          startPos: { x: distance, y: 0 },
        }));
      }
    }
  }, [dragState, handleMouseMove, scale, onScaleChange]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    
    if (event.touches.length === 0) {
      handleMouseUp();
    }
  }, [handleMouseUp]);

  // Reset crop to center and fit
  const handleReset = useCallback(() => {
    const aspectRatio = image.naturalWidth / image.naturalHeight;
    let width = image.naturalWidth;
    let height = image.naturalHeight;

    // Ensure minimum size
    const minSize = MIN_CROP_SIZE / scale;
    if (width < minSize || height < minSize) {
      if (aspectRatio > 1) {
        width = minSize;
        height = minSize / aspectRatio;
      } else {
        height = minSize;
        width = minSize * aspectRatio;
      }
    }

    const newCrop: CropRegion = {
      x: (image.naturalWidth - width) / 2,
      y: (image.naturalHeight - height) / 2,
      width,
      height,
      rotation: 0,
    };

    onCropChange(constrainCrop(newCrop));
  }, [image, scale, constrainCrop, onCropChange]);

  // Rotate image 90 degrees
  const handleRotate = useCallback((clockwise: boolean = true) => {
    const newRotation = clockwise ? 
      cropRegion.rotation + 90 : 
      cropRegion.rotation - 90;

    onCropChange({
      ...cropRegion,
      rotation: newRotation % 360,
    });
  }, [cropRegion, onCropChange]);

  // Handle wheel zoom
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(0.5, Math.min(2.0, scale + delta));
    onScaleChange(newScale);
  }, [scale, onScaleChange]);

  // Effect to redraw canvas with throttling
  useEffect(() => {
    throttledDraw();
  }, [throttledDraw]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      animationFrameDebouncer.current.cancel();
      imageRenderer.clearCache();
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 1; // Larger steps with Shift
    const scaleStep = event.shiftKey ? 0.1 : 0.05; // Larger scale steps with Shift
    
    let newCrop = { ...cropRegion };
    let handled = true;

    switch (event.key) {
      case 'ArrowLeft':
        newCrop.x = Math.max(0, cropRegion.x - step);
        break;
      case 'ArrowRight':
        newCrop.x = Math.min(image.naturalWidth - cropRegion.width, cropRegion.x + step);
        break;
      case 'ArrowUp':
        newCrop.y = Math.max(0, cropRegion.y - step);
        break;
      case 'ArrowDown':
        newCrop.y = Math.min(image.naturalHeight - cropRegion.height, cropRegion.y + step);
        break;
      case '+':
      case '=':
        onScaleChange(Math.min(2.0, scale + scaleStep));
        handled = true;
        break;
      case '-':
        onScaleChange(Math.max(0.5, scale - scaleStep));
        handled = true;
        break;
      case 'r':
      case 'R':
        handleReset();
        break;
      case 'l':
      case 'L':
        onAspectRatioToggle();
        break;
      case 'Escape':
        // Clear focus from canvas
        (event.target as HTMLElement)?.blur();
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      if (newCrop !== cropRegion) {
        onCropChange(constrainCrop(newCrop));
      }
    }
  }, [cropRegion, image, scale, onScaleChange, handleReset, onAspectRatioToggle, onCropChange, constrainCrop]);

  // Add global mouse event listeners
  useEffect(() => {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (dragState.isDragging || dragState.isResizing) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        handleMouseMove({
          clientX: event.clientX,
          clientY: event.clientY,
        } as React.MouseEvent);
      }
    };

    const handleGlobalMouseUp = () => {
      if (dragState.isDragging || dragState.isResizing) {
        handleMouseUp();
      }
    };

    if (dragState.isDragging || dragState.isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, handleMouseMove, handleMouseUp]);

  return (
    <div className={`space-y-4 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900">Adjust Image Crop</h2>
      
      {/* Canvas container */}
      <div 
        ref={containerRef}
        className="relative border rounded-lg overflow-hidden bg-gray-100 focus-within:ring-2 focus-within:ring-blue-500"
        style={{ maxWidth: '100%', maxHeight: '400px' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className="block max-w-full max-h-full object-contain focus:outline-none touch-none"
          style={{ cursor: 'default' }}
          role="img"
          aria-label={`Crop selection area at position ${Math.round(cropRegion.x)}, ${Math.round(cropRegion.y)} with size ${Math.round(cropRegion.width)} by ${Math.round(cropRegion.height)} pixels`}
          aria-describedby="crop-instructions"
        />
        
        {/* Screen reader instructions */}
        <div id="crop-instructions" className="sr-only">
          Use arrow keys to move crop area, plus and minus to zoom, R to reset, L to toggle aspect ratio lock, Escape to remove focus. Hold Shift for larger steps.
        </div>
      </div>

      {/* Control buttons */}
      <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-2 sm:items-center">
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 sm:flex-initial px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-md border border-gray-200 transition-colors touch-manipulation"
            title="Reset crop to center and fit"
            aria-label="Reset crop to center and fit"
          >
            🔄 Reset
          </button>
          
          <button
            onClick={() => handleRotate(false)}
            className="flex-1 sm:flex-initial px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-md border border-gray-200 transition-colors touch-manipulation"
            title="Rotate 90° counterclockwise"
            aria-label="Rotate 90 degrees counterclockwise"
          >
            ↶ 90°
          </button>
          
          <button
            onClick={() => handleRotate(true)}
            className="flex-1 sm:flex-initial px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-md border border-gray-200 transition-colors touch-manipulation"
            title="Rotate 90° clockwise"
            aria-label="Rotate 90 degrees clockwise"
          >
            ↷ 90°
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <label htmlFor="scale-slider" className="text-sm text-gray-600 min-w-[3rem]">
            Scale:
          </label>
          <div className="flex items-center gap-2 flex-1">
            <input
              id="scale-slider"
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={scale}
              onChange={(e) => onScaleChange(parseFloat(e.target.value))}
              className="flex-1 h-6" // Larger touch target on mobile
              aria-label={`Scale: ${Math.round(scale * 100)}%`}
            />
            <span className="text-sm text-gray-600 min-w-[3rem] text-right">
              {Math.round(scale * 100)}%
            </span>
          </div>
        </div>

        <button
          onClick={onAspectRatioToggle}
          className={`w-full sm:w-auto px-3 py-2 text-sm rounded-md border transition-colors touch-manipulation ${
            aspectRatioLocked
              ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 active:bg-blue-300'
              : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 active:bg-gray-300'
          }`}
          title="Lock aspect ratio"
          aria-label={`Aspect ratio ${aspectRatioLocked ? 'locked' : 'unlocked'}`}
          aria-pressed={aspectRatioLocked}
        >
          📎 {aspectRatioLocked ? 'Locked' : 'Free'}
        </button>
      </div>

      {/* Crop info */}
      <div className="text-xs text-gray-500 grid grid-cols-2 gap-4">
        <div>
          Position: {Math.round(cropRegion.x)}, {Math.round(cropRegion.y)}
        </div>
        <div>
          Size: {Math.round(cropRegion.width)} × {Math.round(cropRegion.height)}
        </div>
      </div>
    </div>
  );
};