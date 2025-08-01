import { useRef, useCallback, useEffect } from 'react';
import type { QuantizedImageData } from '../types';
import type { 
  WorkerRequest, 
  WorkerResponse,
  QuantizeRequest,
  SampleRequest,
  HeightMapRequest 
} from '../workers/imageProcessingWorker';
import type { QuantizerOptions, QuantizerProgress } from '../modules/image/quantization';

// ========================
// Types
// ========================

export interface UseImageProcessingWorkerReturn {
  quantizeImage: (
    imageData: ImageData,
    colorCount: number,
    options?: Partial<QuantizerOptions>
  ) => Promise<QuantizedImageData>;
  samplePixels: (imageData: ImageData, maxSamples: number) => Promise<any>;
  generateHeightMap: (imageData: ImageData, colorPalette: any[]) => Promise<Float32Array>;
  cancelProcessing: () => void;
  isProcessing: boolean;
}

interface PendingRequest {
  id: string;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: QuantizerProgress) => void;
}

// ========================
// Hook Implementation
// ========================

export function useImageProcessingWorker(): UseImageProcessingWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const pendingRequestsRef = useRef<Map<string, PendingRequest>>(new Map());
  const isProcessingRef = useRef(false);

  // Initialize worker
  useEffect(() => {
    // Create worker from the TypeScript file
    workerRef.current = new Worker(
      new URL('../workers/imageProcessingWorker.ts', import.meta.url),
      { type: 'module' }
    );

    // Setup message handler
    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, type, data } = event.data;
      const pendingRequest = pendingRequestsRef.current.get(id);

      if (!pendingRequest) {
        console.warn('Received response for unknown request:', id);
        return;
      }

      switch (type) {
        case 'progress':
          pendingRequest.onProgress?.(data);
          break;

        case 'result':
          pendingRequestsRef.current.delete(id);
          updateProcessingState();
          pendingRequest.resolve(data);
          break;

        case 'error':
          pendingRequestsRef.current.delete(id);
          updateProcessingState();
          pendingRequest.reject(new Error(data.message || 'Worker error'));
          break;
      }
    };

    // Setup error handler
    workerRef.current.onerror = (error) => {
      console.error('Worker error:', error);
      // Reject all pending requests
      for (const [, request] of pendingRequestsRef.current) {
        request.reject(new Error('Worker encountered an error'));
      }
      pendingRequestsRef.current.clear();
      updateProcessingState();
    };

    // Cleanup on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      pendingRequestsRef.current.clear();
    };
  }, []);

  // Update processing state
  const updateProcessingState = useCallback(() => {
    isProcessingRef.current = pendingRequestsRef.current.size > 0;
  }, []);

  // Send request to worker
  const sendRequest = useCallback(<T>(
    type: 'quantize' | 'sample' | 'heightMap' | 'cancel',
    data: any,
    onProgress?: (progress: QuantizerProgress) => void
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store pending request
      pendingRequestsRef.current.set(id, {
        id,
        resolve,
        reject,
        onProgress,
      });

      updateProcessingState();

      // Send request to worker
      const request: WorkerRequest = { id, type, data };
      workerRef.current.postMessage(request);
    });
  }, [updateProcessingState]);

  // Quantize image using worker
  const quantizeImage = useCallback(async (
    imageData: ImageData,
    colorCount: number,
    options: Partial<QuantizerOptions> = {}
  ): Promise<QuantizedImageData> => {
    const requestData: QuantizeRequest = {
      imageData: {
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
      },
      colorCount,
      options: {
        ...options,
        // Remove onProgress from options since we handle it separately
        onProgress: undefined,
      },
    };

    const result = await sendRequest<any>('quantize', requestData, options.onProgress);
    
    if (result.cancelled) {
      throw new Error('Processing was cancelled');
    }

    // Convert worker result back to standard format
    return {
      imageData: new ImageData(
        result.imageData.data,
        result.imageData.width,
        result.imageData.height
      ),
      colorPalette: result.colorPalette,
      heightMap: result.heightMap,
    };
  }, [sendRequest]);

  // Sample pixels using worker
  const samplePixels = useCallback(async (
    imageData: ImageData,
    maxSamples: number
  ): Promise<any> => {
    const requestData: SampleRequest = {
      imageData: {
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
      },
      maxSamples,
    };

    const result = await sendRequest('sample', requestData);
    return (result as any).samples;
  }, [sendRequest]);

  // Generate height map using worker
  const generateHeightMap = useCallback(async (
    imageData: ImageData,
    colorPalette: any[]
  ): Promise<Float32Array> => {
    const requestData: HeightMapRequest = {
      imageData: {
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
      },
      colorPalette,
    };

    const result = await sendRequest('heightMap', requestData);
    return (result as any).heightMap;
  }, [sendRequest]);

  // Cancel all processing
  const cancelProcessing = useCallback(() => {
    if (workerRef.current) {
      // Send cancel request
      const request: WorkerRequest = {
        id: 'cancel',
        type: 'cancel',
      };
      workerRef.current.postMessage(request);

      // Reject all pending requests
      for (const [, request] of pendingRequestsRef.current) {
        request.reject(new Error('Processing cancelled by user'));
      }
      
      pendingRequestsRef.current.clear();
      updateProcessingState();
    }
  }, [updateProcessingState]);

  return {
    quantizeImage,
    samplePixels,
    generateHeightMap,
    cancelProcessing,
    isProcessing: isProcessingRef.current,
  };
}

export default useImageProcessingWorker;