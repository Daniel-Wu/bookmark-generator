import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CropControls } from './CropControls';
import { useCropRegion } from '../../hooks/useCropRegion';
import type { ProcessedImage } from '../../types';

export interface ImagePreviewProps {
  file: File;
  onCropApplied: (croppedImage: ProcessedImage) => void;
  onCancel: () => void;
  className?: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  file,
  onCropApplied,
  onCancel,
  className = '',
}) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize crop region hook
  const {
    cropRegion,
    scale,
    aspectRatioLocked,
    validation,
    canUndo,
    canRedo,
    setCropRegion,
    setScale,
    toggleAspectRatioLock,
    resetCrop,
    undo,
    redo,
    constrainCrop,
  } = useCropRegion({
    minCropSize: 50,
    maxScale: 3.0,
    minScale: 0.3,
  });

  // Load image from file
  useEffect(() => {
    const loadImage = async () => {
      try {
        setError(null);
        const img = new Image();
        
        img.onload = () => {
          setImage(img);
          // Initialize crop to center 80% of image
          const width = img.naturalWidth * 0.8;
          const height = img.naturalHeight * 0.8;
          const x = (img.naturalWidth - width) / 2;
          const y = (img.naturalHeight - height) / 2;
          
          setCropRegion(constrainCrop({
            x,
            y,
            width,
            height,
            rotation: 0,
          }, img.naturalWidth, img.naturalHeight));
        };

        img.onerror = () => {
          setError('Failed to load image. Please check the file format.');
        };

        // Create object URL for the file
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;

        // Cleanup object URL when component unmounts
        return () => {
          URL.revokeObjectURL(objectUrl);
        };
      } catch (err) {
        setError('Failed to process image file.');
      }
    };

    loadImage();
  }, [file, setCropRegion, constrainCrop]);

  // Apply crop and generate processed image
  const applyCrop = useCallback(async () => {
    if (!image || !canvasRef.current) return;

    setIsProcessing(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Set canvas size to crop dimensions
      canvas.width = cropRegion.width;
      canvas.height = cropRegion.height;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply rotation if needed
      if (cropRegion.rotation !== 0) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((cropRegion.rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }

      // Draw cropped portion of image
      ctx.drawImage(
        image,
        cropRegion.x,
        cropRegion.y,
        cropRegion.width,
        cropRegion.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      if (cropRegion.rotation !== 0) {
        ctx.restore();
      }

      // Get cropped image data
      const croppedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Create original image data for reference
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = image.naturalWidth;
      originalCanvas.height = image.naturalHeight;
      const originalCtx = originalCanvas.getContext('2d');
      if (!originalCtx) throw new Error('Failed to create original canvas context');

      originalCtx.drawImage(image, 0, 0);
      const originalImageData = originalCtx.getImageData(0, 0, image.naturalWidth, image.naturalHeight);

      // Create processed image object
      const processedImage: ProcessedImage = {
        original: originalImageData,
        cropped: croppedImageData,
        quantized: {
          imageData: croppedImageData, // Will be updated during quantization
          colorPalette: [], // Will be populated during quantization
          heightMap: new Float32Array(croppedImageData.width * croppedImageData.height),
        },
        cropRegion,
      };

      onCropApplied(processedImage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply crop');
    } finally {
      setIsProcessing(false);
    }
  }, [image, cropRegion, onCropApplied]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'z':
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
          break;
        case 'r':
          event.preventDefault();
          if (image) {
            resetCrop(image.naturalWidth, image.naturalHeight);
          }
          break;
        case 'enter':
          event.preventDefault();
          if (!isProcessing && validation.isValid) {
            applyCrop();
          }
          break;
        case 'escape':
          event.preventDefault();
          onCancel();
          break;
      }
    }
  }, [undo, redo, resetCrop, image, applyCrop, isProcessing, validation.isValid, onCancel]);

  // Show loading state while image loads
  if (!image && !error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading image...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Error Loading Image</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={onCancel}
              className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
            >
              Try Another Image
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`} onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Validation messages */}
      {validation.errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <div className="text-red-400 mr-2 mt-0.5">⚠️</div>
            <div>
              <h4 className="text-sm font-medium text-red-800">Crop Issues</h4>
              <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <div className="text-yellow-400 mr-2 mt-0.5">⚠️</div>
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Recommendations</h4>
              <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Crop controls */}
      {image && (
        <CropControls
          image={image}
          cropRegion={cropRegion}
          onCropChange={setCropRegion}
          scale={scale}
          onScaleChange={setScale}
          aspectRatioLocked={aspectRatioLocked}
          onAspectRatioToggle={toggleAspectRatioLock}
        />
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
        <div className="flex gap-2 sm:flex-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-gray-100 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          
          <button
            onClick={redo}
            disabled={!canRedo}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-gray-100 transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷ Redo
          </button>

          <button
            onClick={() => image && resetCrop(image.naturalWidth, image.naturalHeight)}
            disabled={!image}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-gray-100 transition-colors"
            title="Reset crop (Ctrl+R)"
          >
            🔄 Reset
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={applyCrop}
            disabled={isProcessing || !validation.isValid}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            {isProcessing ? (
              <>
                <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></span>
                Processing...
              </>
            ) : (
              '✅ Apply Crop'
            )}
          </button>
        </div>
      </div>

      {/* Hidden canvas for crop processing */}
      <canvas
        ref={canvasRef}
        className="hidden"
        aria-hidden="true"
      />

      {/* Keyboard shortcuts help */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border">
        <strong>Keyboard shortcuts:</strong>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
          <div>Ctrl+Z: Undo</div>
          <div>Ctrl+Shift+Z: Redo</div>
          <div>Ctrl+R: Reset crop</div>
          <div>Ctrl+Enter: Apply crop</div>
          <div>Arrow keys: Move crop</div>
          <div>Escape: Cancel</div>
        </div>
      </div>
    </div>
  );
};