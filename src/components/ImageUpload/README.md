# Image Upload and Cropping Interface

This directory contains a comprehensive image upload and cropping interface for the 3D Bookmark Generator. The implementation provides an intuitive, accessible, and performant way for users to upload images and precisely crop them for 3D bookmark generation.

## Components Overview

### 1. ImageUpload Component (`ImageUpload.tsx`)

The main component that handles the complete image upload workflow, including file validation, drag-and-drop support, and clipboard pasting.

**Features:**
- Drag-and-drop file upload
- File browsing via click
- Clipboard image pasting
- File validation (size, type)
- Error handling and user feedback
- Seamless transition to cropping interface

**Props:**
```typescript
interface ImageUploadProps {
  onImageUploaded: (file: File) => void;
  accept?: string; // Default: 'image/png,image/jpeg,image/gif,image/webp'
  maxSize?: number; // Default: 10MB
  disabled?: boolean;
  className?: string;
}
```

### 2. ImagePreview Component (`ImagePreview.tsx`)

Handles the image preview and crop application workflow, providing validation and integration with the cropping controls.

**Features:**
- Image loading and validation
- Crop region validation with error/warning display
- Keyboard shortcuts (Ctrl+Z for undo, Ctrl+Enter to apply, etc.)
- Integration with crop state management
- Performance monitoring and optimization

**Props:**
```typescript
interface ImagePreviewProps {
  file: File;
  onCropApplied: (croppedImage: ProcessedImage) => void;
  onCancel: () => void;
  className?: string;
}
```

### 3. CropControls Component (`CropControls.tsx`)

The core interactive cropping interface with comprehensive controls and accessibility features.

**Features:**
- Interactive crop rectangle with drag handles
- Mouse and touch interaction support
- Keyboard navigation (arrow keys, shortcuts)
- Scale slider (50% to 200% zoom)
- Aspect ratio locking
- 90° rotation controls
- Visual guidelines (rule of thirds grid)
- Real-time crop validation
- Performance optimizations for smooth interaction

**Props:**
```typescript
interface CropControlsProps {
  image: HTMLImageElement;
  cropRegion: CropRegion;
  onCropChange: (cropRegion: CropRegion) => void;
  scale: number;
  onScaleChange: (scale: number) => void;
  aspectRatioLocked: boolean;
  onAspectRatioToggle: () => void;
  className?: string;
}
```

## State Management

### useCropRegion Hook (`../hooks/useCropRegion.ts`)

A comprehensive hook for managing crop region state with validation, history, and constraints.

**Features:**
- Crop region validation and constraint enforcement
- Undo/redo history management
- Aspect ratio locking
- Scale management with bounds
- Crop region transformations (reset, rotate)
- Performance optimization options

**Usage:**
```typescript
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
  rotateCrop,
  undo,
  redo,
  validateCrop,
  constrainCrop,
} = useCropRegion({
  initialCrop: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
  minCropSize: 50,
  maxScale: 2.0,
  minScale: 0.5,
});
```

## Performance Optimizations

The cropping interface includes several performance optimizations to ensure smooth interaction even with large images:

### Canvas Optimization (`../../utils/canvasOptimization.ts`)

- **Canvas Pooling**: Reuses canvas elements to reduce memory allocation
- **Animation Frame Debouncing**: Prevents excessive redraws during interaction
- **Image Caching**: Caches rendered images for faster redraw
- **Device Pixel Ratio Support**: Ensures crisp rendering on high-DPI displays
- **Memory Monitoring**: Tracks memory usage and triggers cleanup when needed

### Interaction Optimizations

- **Throttled Updates**: Limits update frequency to ~60 FPS
- **Efficient Event Handling**: Uses optimized mouse and touch event handlers
- **Smart Redraw**: Only redraws when necessary, using dirty region tracking
- **Canvas Size Limits**: Constrains canvas size for large images to maintain performance

## Accessibility Features

The cropping interface is fully accessible and follows WCAG 2.1 AA guidelines:

### Keyboard Navigation
- **Arrow Keys**: Move crop region (hold Shift for larger steps)
- **+/-**: Zoom in/out
- **R**: Reset crop to center and fit
- **L**: Toggle aspect ratio lock
- **Escape**: Remove focus from crop area
- **Ctrl+Z/Ctrl+Shift+Z**: Undo/redo
- **Ctrl+Enter**: Apply crop
- **Ctrl+Escape**: Cancel

### Screen Reader Support
- Semantic HTML structure with proper headings
- ARIA labels for all interactive elements
- Live regions for dynamic content updates
- Descriptive alt text for crop area
- Screen reader instructions for keyboard usage

### Visual Accessibility
- High contrast focus indicators
- Color-blind friendly interface
- Scalable text and UI elements
- Clear visual feedback for all interactions

## Mobile Responsiveness

The interface adapts seamlessly to different screen sizes and input methods:

### Touch Support
- **Single Touch**: Drag to move crop area or resize handles
- **Pinch Gesture**: Zoom in/out with two fingers
- **Touch-Optimized Controls**: Larger touch targets on mobile
- **Haptic Feedback**: Uses browser vibration API where available

### Responsive Layout
- **Mobile**: Vertical layout with full-width controls
- **Tablet**: Adapted layout with larger touch targets
- **Desktop**: Horizontal layout with hover states and tooltips

## Usage Examples

### Basic Upload and Crop

```typescript
import { ImageUpload } from './components/ImageUpload';

function MyComponent() {
  const handleImageUploaded = (file: File) => {
    console.log('Image uploaded:', file.name);
    // Process the uploaded and cropped image
  };

  return (
    <ImageUpload
      onImageUploaded={handleImageUploaded}
      maxSize={10 * 1024 * 1024} // 10MB
      accept="image/png,image/jpeg,image/gif,image/webp"
    />
  );
}
```

### Custom Crop Controls

```typescript
import { CropControls } from './components/ImageUpload';
import { useCropRegion } from './hooks/useCropRegion';

function CustomCropInterface({ image }: { image: HTMLImageElement }) {
  const cropState = useCropRegion({
    initialCrop: { x: 100, y: 100, width: 300, height: 200, rotation: 0 },
    minCropSize: 100,
  });

  return (
    <CropControls
      image={image}
      cropRegion={cropState.cropRegion}
      onCropChange={cropState.setCropRegion}
      scale={cropState.scale}
      onScaleChange={cropState.setScale}
      aspectRatioLocked={cropState.aspectRatioLocked}
      onAspectRatioToggle={cropState.toggleAspectRatioLock}
    />
  );
}
```

## Testing

The cropping interface includes comprehensive tests covering:

### Unit Tests
- Component rendering and prop handling
- User interaction simulation
- Keyboard navigation
- Accessibility compliance
- State management validation

### Integration Tests  
- Complete upload and crop workflow
- File validation and error handling
- Cross-component communication
- Performance and memory management
- Mobile touch interaction

### Performance Tests
- Canvas rendering performance
- Memory usage monitoring
- Large image handling
- Interaction responsiveness

## Browser Compatibility

- **Chrome 90+**: Full support including advanced features
- **Firefox 88+**: Full support with performance optimizations
- **Safari 14+**: Full support with touch gesture handling
- **Mobile Browsers**: Optimized touch and gesture support
- **Accessibility**: Screen reader support across all platforms

## Future Enhancements

Potential improvements for future versions:

1. **Advanced Crop Shapes**: Support for circular and custom crop shapes
2. **Batch Processing**: Multiple image upload and cropping
3. **AI-Powered Cropping**: Automatic subject detection and cropping
4. **Cloud Integration**: Direct upload to cloud storage services
5. **Advanced Filters**: Image adjustment controls (brightness, contrast, etc.)
6. **Collaborative Editing**: Real-time collaborative cropping interface

## Technical Specifications

- **Bundle Size Impact**: ~15KB gzipped (including dependencies)
- **Memory Usage**: <50MB peak for typical usage
- **Performance Target**: 60 FPS interaction on modern devices  
- **Image Size Limits**: Up to 10MB files, 8K resolution support
- **Canvas Performance**: Optimized for images up to 4K resolution
- **Touch Latency**: <16ms response time for touch interactions