/**
 * Custom hook for managing 3D preview state and operations
 */

import { useRef, useEffect, useState, useCallback } from 'react';
// import * as THREE from 'three';
import type { BookmarkGeometry, RenderMode, SceneStats } from '../types/geometry';
import { SceneManager } from '../modules/rendering/sceneManager';
import { BookmarkRenderer } from '../modules/rendering/renderer';
import { PERFORMANCE_TARGETS, UI_CONSTANTS } from '../constants/rendering';

interface UsePreview3DOptions {
  enableStats?: boolean;
  onPerformanceWarning?: (stats: SceneStats) => void;
  onError?: (error: Error) => void;
}

interface UsePreview3DReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  renderer: BookmarkRenderer | null;
  sceneManager: SceneManager | null;
  stats: SceneStats;
  renderMode: RenderMode['type'];
  isLoading: boolean;
  error: string | null;
  updateGeometry: (geometry: BookmarkGeometry) => void;
  setRenderMode: (mode: RenderMode['type']) => void;
  toggleLayerVisibility: (layerId: number, visible: boolean) => void;
  fitCameraToObject: () => void;
  takeScreenshot: () => Promise<string>;
  resetCamera: () => void;
  dispose: () => void;
}

export function usePreview3D(options: UsePreview3DOptions = {}): UsePreview3DReturn {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const rendererRef = useRef<BookmarkRenderer | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [stats, setStats] = useState<SceneStats>({
    triangles: 0,
    drawCalls: 0,
    geometries: 0,
    textures: 0,
    fps: 60,
    memoryUsage: 0,
  });
  
  const [renderMode, setRenderModeState] = useState<RenderMode['type']>('solid');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize Three.js scene and renderer
   */
  const initializeScene = useCallback(() => {
    if (!canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      
      // Create scene manager
      const sceneManager = new SceneManager(
        canvas,
        Math.max(rect.width, UI_CONSTANTS.CANVAS_MIN_WIDTH),
        Math.max(rect.height, UI_CONSTANTS.CANVAS_MIN_HEIGHT)
      );
      sceneManagerRef.current = sceneManager;

      // Create renderer
      const renderer = new BookmarkRenderer(sceneManager);
      rendererRef.current = renderer;

      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize 3D scene');
      setError(error.message);
      options.onError?.(error);
    }
  }, [options]);

  /**
   * Animation loop
   */
  const animate = useCallback(() => {
    if (!sceneManagerRef.current) return;

    try {
      sceneManagerRef.current.render();
      
      // Update stats if enabled
      if (options.enableStats) {
        const currentStats = sceneManagerRef.current.getStats();
        setStats(currentStats);
        
        // Check performance warnings
        if (currentStats.fps < PERFORMANCE_TARGETS.TARGET_FPS) {
          options.onPerformanceWarning?.(currentStats);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Render error');
      setError(error.message);
      options.onError?.(error);
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [options]);

  /**
   * Handle canvas resize
   */
  const handleResize = useCallback(() => {
    if (!canvasRef.current || !sceneManagerRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, UI_CONSTANTS.CANVAS_MIN_WIDTH);
    const height = Math.max(rect.height, UI_CONSTANTS.CANVAS_MIN_HEIGHT);

    sceneManagerRef.current.resize(width, height);
  }, []);

  /**
   * Setup resize observer
   */
  const setupResizeObserver = useCallback(() => {
    if (!canvasRef.current) return;

    resizeObserverRef.current = new ResizeObserver(handleResize);
    resizeObserverRef.current.observe(canvasRef.current);
  }, [handleResize]);

  /**
   * Update bookmark geometry
   */
  const updateGeometry = useCallback((geometry: BookmarkGeometry) => {
    if (!rendererRef.current) return;

    setIsLoading(true);
    try {
      rendererRef.current.updateGeometry(geometry);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update geometry');
      setError(error.message);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  /**
   * Set render mode
   */
  const setRenderMode = useCallback((mode: RenderMode['type']) => {
    if (!rendererRef.current) return;

    try {
      rendererRef.current.setRenderMode(mode);
      setRenderModeState(mode);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to set render mode');
      setError(error.message);
      options.onError?.(error);
    }
  }, [options]);

  /**
   * Toggle layer visibility
   */
  const toggleLayerVisibility = useCallback((layerId: number, visible: boolean) => {
    if (!rendererRef.current) return;

    try {
      rendererRef.current.toggleLayerVisibility(layerId, visible);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to toggle layer visibility');
      setError(error.message);
      options.onError?.(error);
    }
  }, [options]);

  /**
   * Fit camera to show entire bookmark
   */
  const fitCameraToObject = useCallback(() => {
    if (!rendererRef.current || !sceneManagerRef.current) return;

    try {
      const geometry = rendererRef.current.getCurrentGeometry();
      if (geometry && geometry.boundingBox) {
        sceneManagerRef.current.fitCameraToObject(geometry.boundingBox);
      }
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fit camera');
      setError(error.message);
      options.onError?.(error);
    }
  }, [options]);

  /**
   * Take screenshot of current view
   */
  const takeScreenshot = useCallback(async (): Promise<string> => {
    if (!rendererRef.current) {
      throw new Error('Renderer not initialized');
    }

    try {
      return await rendererRef.current.createThumbnail();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to take screenshot');
      setError(error.message);
      options.onError?.(error);
      throw error;
    }
  }, [options]);

  /**
   * Reset camera to default position
   */
  const resetCamera = useCallback(() => {
    if (!sceneManagerRef.current) return;

    try {
      sceneManagerRef.current.setupCamera();
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reset camera');
      setError(error.message);
      options.onError?.(error);
    }
  }, [options]);

  /**
   * Dispose of all resources
   */
  const dispose = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Dispose renderer
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    // Dispose scene manager
    if (sceneManagerRef.current) {
      sceneManagerRef.current.dispose();
      sceneManagerRef.current = null;
    }

    // Disconnect resize observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
  }, []);

  /**
   * Initialize scene on mount
   */
  useEffect(() => {
    initializeScene();
    setupResizeObserver();
    
    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(animate);

    return dispose;
  }, [initializeScene, setupResizeObserver, animate, dispose]);

  /**
   * Handle window resize
   */
  useEffect(() => {
    const handleWindowResize = () => {
      handleResize();
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [handleResize]);

  return {
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
    renderer: rendererRef.current,
    sceneManager: sceneManagerRef.current,
    stats,
    renderMode,
    isLoading,
    error,
    updateGeometry,
    setRenderMode,
    toggleLayerVisibility,
    fitCameraToObject,
    takeScreenshot,
    resetCamera,
    dispose,
  };
}