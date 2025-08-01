import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { Layout, Sidebar } from './components/Layout';
import { ResponsiveLayout, DEFAULT_TABS } from './components/Layout/ResponsiveLayout';
import { ImageUpload } from './components/ImageUpload';
import { ParameterPanel } from './components/ParameterPanel';
import { Preview3D } from './components/Preview3D';
import { ExportPanel } from './components/ExportPanel';
import { NotificationProvider } from './components/common/NotificationSystem';
import { AccessibilityProvider, SkipNavigation } from './components/common/AccessibilityEnhancements';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PerformanceMonitor, MemoryWarning } from './components/common/PerformanceIndicators';
import { useResponsiveBreakpoints } from './hooks/useResponsiveBreakpoints';
import { initializeErrorHandling } from './utils/errorHandling';
import type {
  BookmarkParameters,
  ProcessedImage,
  BookmarkGeometry,
  ExportState,
  ExportFormat,
  UIState,
} from './types';
import { DEFAULT_PARAMETERS } from './constants';

function App() {
  const { isMobile } = useResponsiveBreakpoints();
  
  // State management
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [parameters, setParameters] = useState<BookmarkParameters>(DEFAULT_PARAMETERS);
  const [geometry, setGeometry] = useState<BookmarkGeometry | null>(null);
  const [exportState, setExportState] = useState<ExportState>({
    format: 'stl',
    isExporting: false,
    progress: 0,
    stage: 'idle',
    stageProgress: 0,
    canCancel: false,
    lastExportedFile: null,
    warnings: []
  });
  const [uiState, setUIState] = useState<UIState>({
    activeTab: 'upload',
    showLayerToggle: false,
    cameraPosition: new THREE.Vector3(0, 0, 5),
    notifications: []
  });
  const [memoryUsage, setMemoryUsage] = useState({ current: 0, limit: 0 });
  const [, setPerformanceWarnings] = useState<string[]>([]);

  // Initialize error handling
  useEffect(() => {
    initializeErrorHandling();
    
    // Listen for global error events
    const handleGlobalError = (event: CustomEvent) => {
      const { error, context } = event.detail;
      console.error(`Global error in ${context}:`, error);
      setPerformanceWarnings(prev => [
        ...prev,
        `Error in ${context}: ${error.message}`
      ]);
    };

    window.addEventListener('global-error', handleGlobalError as EventListener);
    
    return () => {
      window.removeEventListener('global-error', handleGlobalError as EventListener);
    };
  }, []);

  // Monitor memory usage
  useEffect(() => {
    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryUsage({
          current: memory.usedJSHeapSize,
          limit: memory.jsHeapSizeLimit
        });
      }
    };

    updateMemoryUsage();
    const interval = setInterval(updateMemoryUsage, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-generate geometry when processed image is available
  useEffect(() => {
    const generateGeometry = async () => {
      if (processedImage) {
        try {
          const { BookmarkGeometryGenerator } = await import('./modules/geometry/generator');
          
          const generator = new BookmarkGeometryGenerator({
            onProgress: (progress) => {
              console.log(`Auto-generating geometry: ${progress.stage} - ${Math.round(progress.progress * 100)}%`);
            }
          });
          
          const newGeometry = await generator.generateGeometry(processedImage.quantized, parameters) as BookmarkGeometry;
          setGeometry(newGeometry);
          console.log('Auto-geometry generation completed');
          
        } catch (error) {
          console.error('Auto-geometry generation failed:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          setPerformanceWarnings(prev => [...prev, `Auto-geometry generation failed: ${errorMessage}`]);
        }
      }
    };
    
    generateGeometry();
  }, [processedImage, parameters]);

  // Event handlers
  const handleImageUploaded = async (file: File) => {
    console.log('Image uploaded:', file.name);
    setProcessedImage(null); // Reset processed image
    
    try {
      // Import image processing modules
      const { validateImageFile } = await import('./modules/image/validation');
      const { KMeansQuantizer } = await import('./modules/image/quantization');
      
      // Validate the uploaded file
      const validation = await validateImageFile(file);
      if (!validation.isValid) {
        console.error('File validation failed:', validation.errors);
        setPerformanceWarnings(prev => [...prev, `File validation failed: ${validation.errors.join(', ')}`]);
        return;
      }
      
      // Create image from file
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Cannot create canvas context');
        return;
      }
      
      const img = new Image();
      img.onload = async () => {
        // Set canvas size to image size (with max dimension limit)
        const maxDim = 1024; // Reasonable size for processing
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        
        // Draw image to canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Create quantizer and process image
        const quantizer = new KMeansQuantizer({
          onProgress: (progress) => {
            console.log(`Processing: ${progress.stage} - ${Math.round(progress.progress * 100)}%`);
          }
        });
        
        try {
          const quantizedData = await quantizer.quantize(imageData, parameters.colorCount);
          
          // Create processed image object
          const processed: ProcessedImage = {
            original: imageData,
            cropped: imageData, // For now, use original as cropped
            quantized: quantizedData,
            cropRegion: {
              x: 0,
              y: 0,
              width: canvas.width,
              height: canvas.height,
              rotation: 0
            }
          };
          
          setProcessedImage(processed);
          console.log('Image processing completed');
          
          // After processing, automatically switch to parameters tab on mobile
          if (isMobile) {
            setUIState(prev => ({ ...prev, activeTab: 'parameters' }));
          }
        } catch (error) {
          console.error('Image quantization failed:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          setPerformanceWarnings(prev => [...prev, `Image processing failed: ${errorMessage}`]);
        }
      };
      
      img.onerror = () => {
        console.error('Failed to load image');
        setPerformanceWarnings(prev => [...prev, 'Failed to load image file']);
      };
      
      // Load image from file
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Image upload handling failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setPerformanceWarnings(prev => [...prev, `Upload failed: ${errorMessage}`]);
    }
  };

  const handleParametersChange = async (newParameters: BookmarkParameters) => {
    setParameters(newParameters);
    
    // Regenerate geometry when parameters change if we have a processed image
    if (processedImage) {
      try {
        const { BookmarkGeometryGenerator } = await import('./modules/geometry/generator');
        
        const generator = new BookmarkGeometryGenerator({
          onProgress: (progress) => {
            console.log(`Generating geometry: ${progress.stage} - ${Math.round(progress.progress * 100)}%`);
          }
        });
        
        const newGeometry = await generator.generateGeometry(processedImage.quantized, newParameters) as BookmarkGeometry;
        setGeometry(newGeometry);
        console.log('Geometry generation completed');
        
      } catch (error) {
        console.error('Geometry generation failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setPerformanceWarnings(prev => [...prev, `Geometry generation failed: ${errorMessage}`]);
      }
    }
  };

  const handleExport = async (format: ExportFormat, qualitySettings?: any) => {
    if (!geometry) {
      console.error('No geometry available for export');
      setPerformanceWarnings(prev => [...prev, 'Export failed: No geometry available']);
      return;
    }

    console.log('Exporting as:', format, 'with settings:', qualitySettings);
    
    setExportState(prev => ({
      ...prev,
      format,
      isExporting: true,
      progress: 0,
      stage: 'validating',
      stageProgress: 0,
      canCancel: true,
      warnings: []
    }));

    try {
      // Import the actual export functionality
      const { QuickExport } = await import('./modules/export');
      
      // Set up progress tracking
      const onProgress = (progress: any) => {
        console.log(`Export progress: ${progress.stage} - ${Math.round(progress.progress * 100)}%`);
        setExportState(prev => ({
          ...prev,
          progress: progress.progress,
          stage: progress.stage,
          stageProgress: progress.progress,
        }));
      };

      // Prepare export options
      const exportOptions = {
        filename: `bookmark-${Date.now()}.${format}`,
        quality: qualitySettings?.level || 'medium',
        units: 'mm' as const,
        onProgress,
        includeColors: format === '3mf' && qualitySettings?.includeColors,
        includeThumbnail: format === '3mf' && qualitySettings?.includeThumbnail,
      };

      // Perform the actual export
      let result;
      if (format === 'stl') {
        result = await QuickExport.exportSTL(geometry, exportOptions);
      } else if (format === '3mf') {
        result = await QuickExport.export3MF(geometry, exportOptions);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }

      console.log('Export completed successfully:', result);
      
      setExportState(prev => ({
        ...prev,
        isExporting: false,
        progress: 1,
        stage: 'complete',
        stageProgress: 1,
        canCancel: false,
        lastExportedFile: new Blob([`Export completed: ${result.filename}`], { type: 'text/plain' }),
        warnings: result.warnings || []
      }));

    } catch (error) {
      console.error('Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
      
      setExportState(prev => ({
        ...prev,
        isExporting: false,
        progress: 0,
        stage: 'idle',
        stageProgress: 0,
        canCancel: false,
        warnings: [`Export failed: ${errorMessage}`]
      }));
      
      setPerformanceWarnings(prev => [...prev, `Export failed: ${errorMessage}`]);
    }
  };

  const handleTabChange = (tab: UIState['activeTab']) => {
    setUIState(prev => ({ ...prev, activeTab: tab }));
  };

  const handlePerformanceWarning = (metric: string, value: number) => {
    console.warn(`Performance warning: ${metric} = ${value}`);
    setPerformanceWarnings(prev => [
      ...prev.slice(-4), // Keep only last 5 warnings
      `${metric}: ${typeof value === 'number' ? value.toFixed(2) : value}`
    ]);
  };

  const handleMemoryOptimize = () => {
    // Clear caches and optimize memory
    setProcessedImage(null);
    setGeometry(null);
    
    // Trigger garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
    
    console.log('Memory optimization performed');
  };

  // Tab configurations for responsive layout
  const tabs = DEFAULT_TABS.map(tab => ({
    ...tab,
    component: (() => {
      switch (tab.id) {
        case 'upload':
          return (
            <div className="p-4">
              <ImageUpload onImageUploaded={handleImageUploaded} />
            </div>
          );
        case 'parameters':
          return (
            <div className="p-4">
              <ParameterPanel 
                parameters={parameters} 
                onChange={handleParametersChange}
                disabled={!processedImage}
              />
            </div>
          );
        case 'preview':
          return (
            <div className="h-full">
              <Preview3D 
                geometry={geometry} 
                parameters={parameters} 
                className="h-full"
                onCameraChange={(position) => 
                  setUIState(prev => ({ ...prev, cameraPosition: position }))
                }
              />
            </div>
          );
        case 'export':
          return (
            <div className="p-4">
              <ExportPanel 
                geometry={geometry} 
                onExport={handleExport} 
                exportState={exportState}
              />
            </div>
          );
        default:
          return null;
      }
    })()
  }));

  // Sidebar content for desktop/tablet
  const sidebarContent = (
    <Sidebar>
      <ImageUpload onImageUploaded={handleImageUploaded} />
      <ParameterPanel 
        parameters={parameters} 
        onChange={handleParametersChange}
        disabled={!processedImage}
      />
      <ExportPanel 
        geometry={geometry} 
        onExport={handleExport} 
        exportState={exportState}
      />
    </Sidebar>
  );

  const showMemoryWarning = memoryUsage.limit > 0 && 
    (memoryUsage.current / memoryUsage.limit > 0.7);

  return (
    <ErrorBoundary level="page" maxRetries={3}>
      <AccessibilityProvider>
        <NotificationProvider>
          <div className="App">
            <SkipNavigation targetId="main-content">
              Skip to main content
            </SkipNavigation>
            
            {isMobile ? (
              <ResponsiveLayout
                tabs={tabs}
                activeTab={uiState.activeTab}
                onTabChange={handleTabChange}
                showTabBadges={true}
              />
            ) : (
              <Layout sidebar={sidebarContent}>
                <main id="main-content" className="h-full p-6">
                  <Preview3D 
                    geometry={geometry} 
                    parameters={parameters} 
                    className="h-full"
                    onCameraChange={(position) => 
                      setUIState(prev => ({ ...prev, cameraPosition: position }))
                    }
                  />
                </main>
              </Layout>
            )}

            {/* Performance Monitor */}
            <PerformanceMonitor
              showFPS={true}
              showMemory={true}
              showRenderTime={false}
              onPerformanceWarning={handlePerformanceWarning}
            />

            {/* Memory Warning */}
            {showMemoryWarning && (
              <MemoryWarning
                currentUsage={memoryUsage.current}
                limit={memoryUsage.limit}
                onOptimize={handleMemoryOptimize}
                onDismiss={() => setMemoryUsage({ current: 0, limit: 0 })}
              />
            )}
          </div>
        </NotificationProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}

export default App;
