import React, { useState, useRef, useCallback } from 'react';
import { ImagePreview } from './ImagePreview';
import type { ImageUploadProps, ProcessedImage } from '../../types';

interface ImageUploadState {
  mode: 'upload' | 'preview';
  selectedFile: File | null;
  error: string | null;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageUploaded,
  accept = 'image/png,image/jpeg,image/gif,image/webp',
  maxSize = 10 * 1024 * 1024, // 10MB
  disabled = false,
  className = '',
}) => {
  const [state, setState] = useState<ImageUploadState>({
    mode: 'upload',
    selectedFile: null,
    error: null,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Validate file
  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size (${Math.round(file.size / (1024 * 1024))}MB) exceeds maximum allowed size (${Math.round(maxSize / (1024 * 1024))}MB)`;
    }

    // Check file type
    if (!accept.split(',').some(type => file.type === type.trim())) {
      return `File type "${file.type}" is not supported. Please use: ${accept}`;
    }

    return null;
  }, [maxSize, accept]);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      setState(prev => ({ ...prev, error }));
      return;
    }

    setState({
      mode: 'preview',
      selectedFile: file,
      error: null,
    });
  }, [validateFile]);

  // Handle file input change
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Handle drag and drop
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    
    const files = Array.from(event.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileSelect(imageFile);
    } else {
      setState(prev => ({
        ...prev,
        error: 'Please drop an image file (PNG, JPG, GIF, or WebP)',
      }));
    }
  }, [handleFileSelect]);

  // Handle paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'pasted-image.png', { type: imageType });
          handleFileSelect(file);
          return;
        }
      }
      
      setState(prev => ({
        ...prev,
        error: 'No image found in clipboard. Copy an image and try again.',
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: 'Failed to access clipboard. Please use the file browser instead.',
      }));
    }
  }, [handleFileSelect]);

  // Handle crop applied
  const handleCropApplied = useCallback((_processedImage: ProcessedImage) => {
    // Pass the cropped/processed image data to the parent
    onImageUploaded(state.selectedFile!);
    // Reset to upload mode
    setState({
      mode: 'upload',
      selectedFile: null,
      error: null,
    });
  }, [onImageUploaded, state.selectedFile]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setState({
      mode: 'upload',
      selectedFile: null,
      error: null,
    });
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle browse click
  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Show image preview and cropping interface
  if (state.mode === 'preview' && state.selectedFile) {
    return (
      <ImagePreview
        file={state.selectedFile}
        onCropApplied={handleCropApplied}
        onCancel={handleCancel}
        className={className}
      />
    );
  }

  // Show upload interface
  return (
    <div className={`space-y-4 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900">Upload Image</h2>

      {/* Error message */}
      {state.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <div className="text-red-400 mr-2 mt-0.5">⚠️</div>
              <div>
                <h4 className="text-sm font-medium text-red-800">Upload Error</h4>
                <p className="text-sm text-red-700 mt-1">{state.error}</p>
              </div>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600 ml-2"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="Upload image by clicking, dragging and dropping, or pressing Enter"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleBrowseClick();
          }
        }}
      >
        <div className="space-y-4">
          <div className="text-6xl text-gray-400" aria-hidden="true">📁</div>

          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900">
              Drag & Drop or Click to Browse
            </p>
            <p className="text-sm text-gray-600">
              Supports: PNG, JPG, GIF, WebP
            </p>
            <p className="text-sm text-gray-600">
              Max size: {Math.round(maxSize / (1024 * 1024))}MB
            </p>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
        aria-hidden="true"
      />

      {/* Paste from clipboard button */}
      <button
        onClick={handlePaste}
        disabled={disabled}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        title="Paste image from clipboard"
      >
        📋 Paste from Clipboard
      </button>

      {/* Usage tips */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border">
        <strong>Tips:</strong>
        <ul className="mt-1 space-y-1">
          <li>• Use high-quality images for best results</li>
          <li>• Square or rectangular images work best for bookmarks</li>
          <li>• Images with clear contrast will create better 3D effects</li>
          <li>• You'll be able to crop and adjust the image after upload</li>
        </ul>
      </div>
    </div>
  );
};
