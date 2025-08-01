# System Architecture & Technical Specifications

## Data Structures

### Core Interfaces

```typescript
// Central application state
interface AppState {
  image: ProcessedImage | null;
  parameters: BookmarkParameters;
  geometry: BookmarkGeometry | null;
  exportState: ExportState;
  ui: UIState;
}

interface ProcessedImage {
  original: ImageData;
  cropped: ImageData;
  quantized: QuantizedImageData;
  cropRegion: CropRegion;
}

interface BookmarkParameters {
  colorCount: number; // 2-8
  layerThickness: number; // 0.1-0.5mm
  baseThickness: number; // 1-3mm
  width: number; // mm
  height: number; // mm
  cornerRadius: number; // 0-10mm
}

interface QuantizedImageData {
  imageData: ImageData;
  colorPalette: Color[];
  heightMap: Float32Array; // normalized 0-1 heights
}

interface BookmarkGeometry {
  layers: GeometryLayer[];
  boundingBox: BoundingBox;
  vertexCount: number;
  faceCount: number;
}

interface GeometryLayer {
  color: Color;
  height: number;
  geometry: THREE.BufferGeometry;
  regions: ConnectedComponent[];
}

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface Color {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

interface ConnectedComponent {
  pixels: Point2D[];
  boundingBox: BoundingBox;
  area: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ExportState {
  format: 'stl' | '3mf';
  isExporting: boolean;
  progress: number;
  lastExportedFile: Blob | null;
}

interface UIState {
  activeTab: 'upload' | 'parameters' | 'preview' | 'export';
  showLayerToggle: boolean;
  cameraPosition: THREE.Vector3;
  notifications: Notification[];
}
```

## Module Architecture

### 1. Image Processing Module (`/src/modules/image/`)

**Core Responsibilities**: Upload validation, image loading, cropping, color quantization, height mapping

```typescript
class ImageProcessor {
  validate(file: File): ValidationResult;
  loadImage(file: File): Promise<HTMLImageElement>;
  cropImage(image: HTMLImageElement, region: CropRegion): ImageData;
  quantizeColors(imageData: ImageData, colorCount: number): QuantizedImageData;
}

class KMeansQuantizer {
  quantize(imageData: ImageData, k: number, maxIterations: number): ColorPalette;
}

class HeightMapper {
  generateHeightMap(quantizedData: QuantizedImageData): Float32Array;
}
```

#### Input Validation Requirements:

- **File size**: Max 10MB
- **Dimensions**: Max 4096x4096px
- **Formats**: PNG, JPG, GIF, WebP only
- **Color depth**: Handle 8-bit and 16-bit channels

#### Error Cases:

- Corrupted image files
- Unsupported formats
- Memory allocation failures
- Invalid crop regions (outside bounds, zero area)

#### Algorithm Specifications:

**K-Means Color Quantization:**

1. Sample pixels (max 10K samples for performance)
2. Initialize centroids using k-means++ algorithm
3. Iterate until convergence (max 50 iterations, convergence threshold 0.1)
4. Assign all pixels to nearest centroid using Euclidean distance in RGB space

**Height Mapping:**

1. Calculate perceived luminance: 0.299*R + 0.587*G + 0.114\*B
2. Sort colors by luminance (lightest to darkest)
3. Map to height levels: lightest = 0, darkest = 1
4. Generate height map by replacing each pixel with its color's height value

### 2. Geometry Generation Module (`/src/modules/geometry/`)

**Core Responsibilities**: Convert height maps to 3D geometry, handle layer generation, manage mesh optimization

```typescript
class BookmarkGeometryGenerator {
  generateBookmark(
    heightMap: Float32Array,
    parameters: BookmarkParameters,
    imageSize: { width: number; height: number }
  ): BookmarkGeometry;
}

class RegionExtractor {
  findConnectedComponents(mask: Uint8Array, width: number, height: number): ConnectedComponent[];
}

class MeshOptimizer {
  simplifyMesh(geometry: THREE.BufferGeometry, targetReduction: number): THREE.BufferGeometry;
}
```

#### Performance Requirements:

- Max 100K vertices per layer
- Generation time <5 seconds for typical bookmark
- Memory usage <500MB during generation

#### Geometry Generation Algorithm:

1. Generate base layer (full outline with rounded corners)
2. Extract unique height levels from height map
3. For each height level:
   - Create binary mask for pixels at this height
   - Find connected components using flood-fill algorithm
   - Filter components by minimum area (avoid tiny features)
   - Generate extruded geometry for each component
   - Combine geometries into single layer
4. Merge all layers with proper height offsets

### 3. 3D Rendering Module (`/src/modules/rendering/`)

**Core Responsibilities**: Three.js scene management, real-time preview, camera controls, material assignment

```typescript
class BookmarkRenderer {
  updateGeometry(geometry: BookmarkGeometry): void;
  setMaterial(layer: number, material: THREE.Material): void;
  toggleLayerVisibility(layer: number, visible: boolean): void;
}

class SceneManager {
  setupLighting(): void;
  setupCamera(): void;
  enableOrbitControls(): void;
}

class MaterialManager {
  createLayerMaterial(color: Color, height: number): THREE.Material;
  updateMaterials(colorPalette: Color[]): void;
}
```

#### Rendering Specifications:

- **Lighting**: Hemisphere light + directional light with shadows
- **Materials**: PBR materials with color-based properties
- **Camera**: Perspective camera with orbit controls
- **Performance**: Target 30+ FPS on modern hardware

### 4. Export Module (`/src/modules/export/`)

**Core Responsibilities**: Generate STL and 3MF files, handle file downloads, format validation

```typescript
abstract class GeometryExporter {
  abstract export(geometry: BookmarkGeometry): Uint8Array;
}

class STLExporter extends GeometryExporter {
  export(geometry: BookmarkGeometry): Uint8Array;
}

class ThreeMFExporter extends GeometryExporter {
  export(geometry: BookmarkGeometry): Uint8Array;
}

class FileDownloadManager {
  downloadFile(data: Uint8Array, filename: string, mimeType: string): void;
}
```

#### File Format Specifications:

**STL Format (Binary):**

- Header: 80 bytes (application identifier)
- Triangle count: 4 bytes (little endian)
- Triangles: 50 bytes each (normal vector + 3 vertices + attribute bytes)
- Combine all layers into single mesh

**3MF Format:**

- ZIP archive containing:
  - [Content_Types].xml - MIME type definitions
  - \_rels/.rels - Relationship definitions
  - 3D/3dmodel.model - XML with mesh data and materials
  - Metadata/thumbnail.png - Preview image
- Multi-material support with color assignments per layer

## Component Architecture

### React Component Hierarchy

```
App
├── AppProvider (Context for global state management)
├── ErrorBoundary (Catch and display React errors)
├── Layout
│   ├── Header (App title, navigation)
│   ├── MainContent
│   │   ├── ImageUploadPanel
│   │   │   ├── FileDropZone (Drag-drop file upload)
│   │   │   ├── ImagePreview (Show uploaded image)
│   │   │   └── CropControls (Interactive cropping interface)
│   │   ├── ParameterPanel
│   │   │   ├── ParameterSlider (Reusable slider component)
│   │   │   ├── ColorCountControl
│   │   │   ├── DimensionControls
│   │   │   └── ParameterPresets (Save/load parameter sets)
│   │   ├── Preview3D
│   │   │   ├── ThreeCanvas (@react-three/fiber canvas)
│   │   │   ├── CameraControls (Orbit controls)
│   │   │   └── LayerToggle (Show/hide individual layers)
│   │   └── ExportPanel
│   │       ├── FormatSelector (STL/3MF radio buttons)
│   │       ├── ExportButton (Generate and download)
│   │       └── ProgressIndicator (Export progress bar)
│   └── Footer (Links, version info)
└── NotificationSystem (Toast notifications)
```

### State Management

#### Global State (React Context):

- Image processing state
- Bookmark parameters
- Generated geometry
- UI state (active panels, notifications)

#### Component-Level State:

- Form inputs (controlled components)
- Animation states
- Temporary UI states

#### State Update Flow:

1. User action triggers event handler
2. Handler validates input and updates global state
3. State change triggers relevant component re-renders
4. Side effects (geometry generation) handled via useEffect

## Error Handling & Recovery

### Error Categories

1. **User Input Errors**: Invalid files, out-of-range parameters
2. **Processing Errors**: Memory allocation failures, algorithm convergence issues
3. **Export Errors**: File system access denied, format compatibility issues
4. **System Errors**: Browser compatibility, WebGL context loss

### Recovery Strategies

```typescript
class ErrorHandler {
  handleImageProcessingError(error: ProcessingError): void;
  handleGeometryGenerationError(error: GeometryError): void;
  handleExportError(error: ExportError): void;
  showUserFriendlyMessage(error: Error): void;
}
```

#### Error Recovery Actions:

- **Memory Limit**: Suggest image resize, reduce color count
- **Invalid Format**: Show supported format instructions
- **Quantization Failed**: Fallback to simple color reduction
- **Geometry Too Complex**: Automatic mesh simplification
- **Export Failed**: Retry with simplified geometry

## Validation Rules

### File Upload Validation:

- **File size**: 100KB - 10MB
- **Dimensions**: 50x50px - 4096x4096px
- **Format**: Must have valid image header
- **Color depth**: 8-bit or 16-bit per channel

### Parameter Validation:

- **Color count**: Integer 2-8
- **Layer thickness**: Float 0.1-0.5mm
- **Base thickness**: Float 1-3mm
- **Dimensions**: Positive numbers, maintain aspect ratio
- **Corner radius**: Float 0-10mm, max 50% of smallest dimension

## Performance Requirements

### Processing Performance

- **Image quantization**: <3 seconds for 2MP images
- **Geometry generation**: <5 seconds total
- **Real-time parameter updates**: <100ms response time
- **3D rendering**: 30+ FPS on modern hardware

### Memory Constraints

- **Peak memory usage**: <500MB during processing
- **Image data cleanup** after processing
- **Geometry data cleanup** after export
- **Browser memory leak prevention**

### Browser Compatibility

- **Chrome 90+** (primary target)
- **Firefox 88+** (secondary target)
- **Safari 14+** (secondary target)
- **Mobile browsers**: iOS Safari 14+, Chrome Android 90+

## Code Organization

```
src/
├── components/           # React components
│   ├── common/          # Reusable UI components
│   ├── upload/          # Image upload components
│   ├── parameters/      # Parameter control components
│   ├── preview/         # 3D preview components
│   └── export/          # Export panel components
├── modules/             # Core business logic
│   ├── image/           # Image processing
│   ├── geometry/        # 3D geometry generation
│   ├── rendering/       # Three.js rendering
│   └── export/          # File export
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
├── types/               # TypeScript type definitions
├── constants/           # Application constants
└── tests/               # Test files
```
