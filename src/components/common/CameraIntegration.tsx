import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTouchDevice } from '../../hooks/useResponsiveBreakpoints';
import { useNotifications } from './NotificationSystem';
import { AccessibleModal } from './AccessibilityEnhancements';

interface CameraIntegrationProps {
  onImageCapture: (file: File) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface CameraStreamProps {
  onCapture: (blob: Blob) => void;
  onError: (error: string) => void;
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
}

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

/**
 * Camera stream component with device selection and capture functionality
 */
const CameraStream: React.FC<CameraStreamProps> = ({
  onCapture,
  onError,
  facingMode = 'environment',
  width = 1920,
  height = 1080
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isFlashSupported, setIsFlashSupported] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);

  // Initialize camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: width },
          height: { ideal: height },
          facingMode: deviceId ? undefined : facingMode,
          deviceId: deviceId ? { exact: deviceId } : undefined
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);

        // Check for flash support
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = videoTrack.getCapabilities();
          setIsFlashSupported('torch' in capabilities);
        }
      }
    } catch (error) {
      console.error('Camera access error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown camera error';
      
      if (errorMessage.includes('Permission denied')) {
        onError('Camera permission denied. Please allow camera access and try again.');
      } else if (errorMessage.includes('NotFoundError')) {
        onError('No camera found. Please check your device has a camera.');
      } else if (errorMessage.includes('NotReadableError')) {
        onError('Camera is in use by another application.');
      } else {
        onError(`Camera error: ${errorMessage}`);
      }
    }
  }, [facingMode, width, height, onError]);

  // Get available camera devices
  const getAvailableDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
          kind: device.kind
        }));
      
      setAvailableDevices(videoDevices);
      
      // Select default device (prefer back camera on mobile)
      if (videoDevices.length > 0) {
        const backCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        
        const defaultDevice = backCamera || videoDevices[0];
        setSelectedDeviceId(defaultDevice.deviceId);
        startCamera(defaultDevice.deviceId);
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
      // Fallback to basic camera start
      startCamera();
    }
  }, [startCamera]);

  // Toggle flash/torch
  const toggleFlash = useCallback(async () => {
    if (!streamRef.current || !isFlashSupported) return;

    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        await videoTrack.applyConstraints({
          advanced: [{ torch: !isFlashOn } as any]
        });
        setIsFlashOn(!isFlashOn);
      }
    } catch (error) {
      console.error('Flash toggle error:', error);
    }
  }, [isFlashSupported, isFlashOn]);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        onCapture(blob);
      }
    }, 'image/jpeg', 0.9);
  }, [isStreaming, onCapture]);

  // Device change handler
  const handleDeviceChange = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    startCamera(deviceId);
  }, [startCamera]);

  // Initialize camera on mount
  useEffect(() => {
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      getAvailableDevices();
    } else {
      onError('Camera not supported in this browser');
    }

    return () => {
      // Cleanup stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [getAvailableDevices, onError]);

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Video stream */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        muted
        playsInline
      />

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera controls overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top controls */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-auto">
          {/* Device selector */}
          {availableDevices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="bg-black bg-opacity-50 text-white px-3 py-2 rounded-md text-sm backdrop-blur-sm"
            >
              {availableDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          )}

          {/* Flash toggle */}
          {isFlashSupported && (
            <button
              onClick={toggleFlash}
              className={`p-3 rounded-full transition-colors ${
                isFlashOn ? 'bg-yellow-500 text-black' : 'bg-black bg-opacity-50 text-white'
              } backdrop-blur-sm`}
              aria-label={isFlashOn ? 'Turn off flash' : 'Turn on flash'}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 2v11h3v9l7-12h-4l3-8z" />
              </svg>
            </button>
          )}
        </div>

        {/* Center viewfinder grid */}
        <div className="absolute inset-4 border-2 border-white border-opacity-50 rounded-lg">
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="border border-white border-opacity-20"
              />
            ))}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-center pointer-events-auto">
          <button
            onClick={capturePhoto}
            disabled={!isStreaming}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Capture photo"
          >
            <div className="w-12 h-12 bg-gray-300 rounded-full" />
          </button>
        </div>

        {/* Connection status */}
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 pointer-events-auto">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
              <p>Starting camera...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Main camera integration component with modal interface
 */
export const CameraIntegration: React.FC<CameraIntegrationProps> = ({
  onImageCapture,
  isOpen,
  onClose
}) => {
  const isTouchDevice = useTouchDevice();
  const { showSuccess, showError } = useNotifications();
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Handle image capture from camera
  const handleCapture = useCallback((blob: Blob) => {
    setCapturedImage(blob);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    showSuccess('Photo captured!', 'Review your photo and use it or take another.');
  }, [showSuccess]);

  // Handle camera errors
  const handleCameraError = useCallback((error: string) => {
    showError('Camera Error', error);
  }, [showError]);

  // Use captured image
  const useImage = useCallback(() => {
    if (capturedImage) {
      const file = new File([capturedImage], 'camera-capture.jpg', {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      onImageCapture(file);
      onClose();
      
      // Cleanup
      setCapturedImage(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
    }
  }, [capturedImage, previewUrl, onImageCapture, onClose]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  }, [previewUrl]);

  // Cleanup on close
  const handleClose = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedImage(null);
    setPreviewUrl('');
    onClose();
  }, [previewUrl, onClose]);

  // Check if camera is supported
  const isCameraSupported = Boolean(
    navigator.mediaDevices && 
    navigator.mediaDevices.getUserMedia
  );

  if (!isCameraSupported) {
    return (
      <AccessibleModal
        isOpen={isOpen}
        onClose={onClose}
        title="Camera Not Supported"
        className="max-w-md"
      >
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Camera Not Available
          </h3>
          <p className="text-gray-600 mb-6">
            Your browser or device doesn't support camera access. Please use the file upload option instead.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            OK
          </button>
        </div>
      </AccessibleModal>
    );
  }

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={handleClose}
      title={capturedImage ? "Review Photo" : "Take Photo"}
      className="max-w-2xl w-full"
      closeOnOverlayClick={false}
    >
      <div className="space-y-4">
        {capturedImage ? (
          // Preview captured image
          <div className="space-y-4">
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={previewUrl}
                alt="Captured photo"
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={retakePhoto}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Retake
              </button>
              <button
                onClick={useImage}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Use Photo
              </button>
            </div>
          </div>
        ) : (
          // Camera interface
          <div className="space-y-4">
            <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <CameraStream
                onCapture={handleCapture}
                onError={handleCameraError}
                facingMode="environment"
                width={1920}
                height={1080}
              />
            </div>
            
            {isTouchDevice && (
              <div className="text-sm text-gray-600 text-center">
                <p>Position your image within the frame and tap the capture button</p>
              </div>
            )}
          </div>
        )}

        {/* Tips for better photos */}
        {!capturedImage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Tips for Better Results:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Ensure good lighting for clear details</li>
              <li>• Hold the device steady while capturing</li>
              <li>• Use high contrast subjects for better 3D conversion</li>
              <li>• Fill the frame with your subject</li>
            </ul>
          </div>
        )}
      </div>
    </AccessibleModal>
  );
};

/**
 * Camera button component for triggering camera interface
 */
export const CameraButton: React.FC<{
  onImageCapture: (file: File) => void;
  className?: string;
  disabled?: boolean;
}> = ({
  onImageCapture,
  className = '',
  disabled = false
}) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const isTouchDevice = useTouchDevice();

  // Only show on touch devices or when explicitly enabled
  if (!isTouchDevice) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsCameraOpen(true)}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md
          text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        aria-label="Take photo with camera"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Take Photo
      </button>

      <CameraIntegration
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onImageCapture={onImageCapture}
      />
    </>
  );
};

export default CameraIntegration;