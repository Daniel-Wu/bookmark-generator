/**
 * Web Worker for image processing operations
 * 
 * Offloads CPU-intensive tasks like K-means quantization and height mapping
 * to prevent blocking the main UI thread, ensuring smooth user experience.
 */

import type {
  Color,
} from '../types';
import { KMeansQuantizer, type QuantizerOptions, type QuantizerProgress } from '../modules/image/quantization';
import { calculateLuminance, euclideanDistance, createColor } from '../modules/image/colorUtils';
import { samplePixels } from '../modules/image/sampling';

// ========================
// Worker Message Types
// ========================

export interface WorkerRequest {
  id: string;
  type: 'quantize' | 'sample' | 'heightMap' | 'cancel';
  data?: any;
}

export interface WorkerResponse {
  id: string;
  type: 'progress' | 'result' | 'error';
  data?: any;
}

export interface QuantizeRequest {
  imageData: {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  };
  colorCount: number;
  options?: Partial<QuantizerOptions>;
}

export interface SampleRequest {
  imageData: {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  };
  maxSamples: number;
}

export interface HeightMapRequest {
  imageData: {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  };
  colorPalette: Color[];
}

// ========================
// Worker State
// ========================

let currentQuantizer: KMeansQuantizer | null = null;
let currentAbortController: AbortController | null = null;

// ========================
// Message Handler
// ========================

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, data } = event.data;

  try {
    switch (type) {
      case 'quantize':
        await handleQuantize(id, data as QuantizeRequest);
        break;
      
      case 'sample':
        await handleSample(id, data as SampleRequest);
        break;
      
      case 'heightMap':
        await handleHeightMap(id, data as HeightMapRequest);
        break;
      
      case 'cancel':
        handleCancel();
        break;
      
      default:
        sendError(id, `Unknown request type: ${type}`);
    }
  } catch (error) {
    sendError(id, error instanceof Error ? error.message : 'Unknown error occurred');
  }
};

// ========================
// Request Handlers
// ========================

async function handleQuantize(id: string, request: QuantizeRequest): Promise<void> {
  // Cancel any existing operation
  handleCancel();
  
  // Create new abort controller
  currentAbortController = new AbortController();
  
  // Convert worker ImageData format to standard ImageData
  const imageData = new ImageData(
    request.imageData.data.slice(), // Clone the array
    request.imageData.width,
    request.imageData.height
  );

  // Setup progress reporting
  const onProgress = (progress: QuantizerProgress) => {
    sendProgress(id, {
      stage: progress.stage,
      progress: progress.progress,
      message: progress.message,
      iteration: progress.iteration,
    });
  };

  // Create quantizer with options
  const options: QuantizerOptions = {
    ...request.options,
    onProgress,
    signal: currentAbortController.signal,
  };

  currentQuantizer = new KMeansQuantizer(options);

  try {
    // Perform quantization
    const result = await currentQuantizer.quantize(imageData, request.colorCount);
    
    // Send result back to main thread
    sendResult(id, {
      imageData: {
        data: result.imageData.data,
        width: result.imageData.width,
        height: result.imageData.height,
      },
      colorPalette: result.colorPalette,
      heightMap: result.heightMap,
    });
  } catch (error) {
    if (currentAbortController?.signal.aborted) {
      sendResult(id, { cancelled: true });
    } else {
      throw error;
    }
  } finally {
    currentQuantizer = null;
    currentAbortController = null;
  }
}

async function handleSample(id: string, request: SampleRequest): Promise<void> {
  const imageData = new ImageData(
    request.imageData.data.slice(),
    request.imageData.width,
    request.imageData.height
  );

  // Progress reporting for sampling
  sendProgress(id, {
    stage: 'sampling',
    progress: 0,
    message: 'Sampling pixels from image...',
  });

  const samples = samplePixels(imageData, request.maxSamples);

  sendProgress(id, {
    stage: 'sampling',
    progress: 1,
    message: `Sampled ${samples.length} pixels`,
  });

  sendResult(id, { samples });
}

async function handleHeightMap(id: string, request: HeightMapRequest): Promise<void> {
  const imageData = new ImageData(
    request.imageData.data.slice(),
    request.imageData.width,
    request.imageData.height
  );

  sendProgress(id, {
    stage: 'heightMap',
    progress: 0,
    message: 'Generating height map...',
  });

  // Generate height map based on quantized colors
  const heightMap = await generateHeightMapWorker(imageData, request.colorPalette, id);

  sendResult(id, { heightMap });
}

function handleCancel(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  currentQuantizer = null;
}

// ========================
// Height Map Generation
// ========================

async function generateHeightMapWorker(
  imageData: ImageData,
  colorPalette: Color[],
  requestId: string
): Promise<Float32Array> {
  const { data, width, height } = imageData;
  const heightMap = new Float32Array(width * height);

  // Sort palette by luminance (lightest to darkest)
  const sortedPalette = colorPalette
    .map((color, index) => ({
      color,
      luminance: calculateLuminance(color),
      originalIndex: index,
    }))
    .sort((a, b) => a.luminance - b.luminance);

  // Create height mapping
  const heightValues = sortedPalette.map((_, index) => index / (sortedPalette.length - 1));

  // Process pixels in chunks to avoid blocking
  const chunkSize = 10000;
  const totalPixels = width * height;

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += chunkSize) {
    const endIndex = Math.min(pixelIndex + chunkSize, totalPixels);
    
    // Process chunk
    for (let i = pixelIndex; i < endIndex; i++) {
      const dataIndex = i * 4;
      const pixel = createColor(
        data[dataIndex],
        data[dataIndex + 1],
        data[dataIndex + 2],
        data[dataIndex + 3] / 255
      );

      // Handle transparent pixels
      if ((pixel.a ?? 1) < 0.5) {
        heightMap[i] = 0;
        continue;
      }

      // Find closest color in palette
      let minDistance = Infinity;
      let closestPaletteIndex = 0;

      for (let j = 0; j < sortedPalette.length; j++) {
        const distance = euclideanDistance(pixel, sortedPalette[j].color);
        if (distance < minDistance) {
          minDistance = distance;
          closestPaletteIndex = j;
        }
      }

      // Set height based on luminance order
      heightMap[i] = heightValues[closestPaletteIndex];
    }

    // Report progress
    const progress = endIndex / totalPixels;
    sendProgress(requestId, {
      stage: 'heightMap',
      progress,
      message: `Processing height map... ${Math.round(progress * 100)}%`,
    });

    // Yield control to prevent blocking
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return heightMap;
}

// ========================
// Message Sending Utilities
// ========================

function sendProgress(id: string, data: any): void {
  const response: WorkerResponse = {
    id,
    type: 'progress',
    data,
  };
  self.postMessage(response);
}

function sendResult(id: string, data: any): void {
  const response: WorkerResponse = {
    id,
    type: 'result',
    data,
  };
  self.postMessage(response);
}

function sendError(id: string, message: string): void {
  const response: WorkerResponse = {
    id,
    type: 'error',
    data: { message },
  };
  self.postMessage(response);
}

// ========================
// Performance Monitoring
// ========================

// Performance monitoring functions removed as they were unused

// Export for TypeScript (not actually used in worker context)
// Note: These are already exported as interfaces above