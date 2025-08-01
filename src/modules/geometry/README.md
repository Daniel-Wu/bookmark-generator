# Bookmark Geometry Generation System

This module provides a comprehensive 3D geometry generation system that converts quantized image data with height maps into 3D printable bookmark models. The system is designed for high-quality output while maintaining performance and memory efficiency.

## Architecture Overview

The geometry generation system consists of four main components:

### 1. BookmarkGeometryGenerator (`generator.ts`)
The core class that orchestrates the entire geometry generation pipeline:
- Converts height maps to layered 3D geometry
- Generates base layer with rounded corners
- Creates extruded layers for each height level
- Implements connected component analysis
- Optimizes mesh for 3D printing

### 2. RegionExtractor (`regionExtractor.ts`)
Handles connected component analysis using flood-fill algorithms:
- Extracts connected regions from binary masks
- Supports both 4-connected and 8-connected analysis
- Filters components by minimum area
- Calculates bounding boxes, centroids, and convex hulls
- Handles hole detection and component merging

### 3. MeshOptimizer (`meshOptimizer.ts`)
Provides mesh simplification and optimization:
- Quadric error metric simplification
- Vertex clustering algorithms
- Edge collapse simplification
- Removes degenerate triangles
- Merges duplicate vertices
- Analyzes topology and mesh quality

### 4. GeometryValidator (`validator.ts`)
Validates geometry for 3D printing compatibility:
- Manifold and watertight checks
- Feature size validation
- Structural stability analysis
- 3D printing constraint validation
- Estimates print time and material usage

## Usage Examples

### Basic Geometry Generation

```typescript
import { createBookmarkGeometryGenerator } from './modules/geometry';
import type { QuantizedImageData, BookmarkParameters } from './types';

// Create generator with default settings
const generator = createBookmarkGeometryGenerator();

// Generate geometry
const geometry = await generator.generateGeometry(quantizedImage, parameters);

console.log(`Generated ${geometry.layers.length} layers`);
console.log(`Total vertices: ${geometry.vertexCount}`);
console.log(`Total faces: ${geometry.faceCount}`);
```

### Complete Pipeline with Validation

```typescript
import { createBookmarkPipeline } from './modules/geometry';

// Create complete pipeline
const pipeline = createBookmarkPipeline();

// Generate and validate in one step
const result = await pipeline.generateAndValidate(quantizedImage, parameters);

if (result.validation.isPrintable) {
  console.log('Geometry is ready for 3D printing!');
  console.log(`Estimated print time: ${result.validation.estimatedPrintTime} minutes`);
  console.log(`Material usage: ${result.validation.materialUsage} grams`);
} else {
  console.log('Issues found:', result.validation.issues);
  console.log('Recommendations:', result.validation.recommendations);
}
```

### Preview Generation (Fast, Lower Quality)

```typescript
import { createPreviewPipeline } from './modules/geometry';

const previewPipeline = createPreviewPipeline();

// Generate preview geometry quickly
const preview = await previewPipeline.generatePreview(quantizedImage, parameters);

// Use preview.geometry for real-time 3D preview
```

### Production Quality Generation

```typescript
import { createProductionPipeline } from './modules/geometry';

const productionPipeline = createProductionPipeline();

try {
  const production = await productionPipeline.generateProduction(quantizedImage, parameters);
  // production.geometry is ready for export
} catch (error) {
  console.error('Production quality requirements not met:', error.message);
}
```

## Configuration Options

### Geometry Generation Options

```typescript
interface GeometryGenerationOptions {
  minFeatureSize: number;        // Minimum feature size in mm (default: 0.5)
  maxVertices: number;           // Maximum vertices per layer (default: 100000)
  enableOptimization: boolean;   // Enable mesh optimization (default: true)
  enableSmoothing: boolean;      // Enable normal smoothing (default: false)
  simplificationRatio: number;   // Mesh simplification ratio 0-1 (default: 0.1)
  onProgress?: (progress: LayerProgress) => void;
  onMetrics?: (metrics: GeometryMetrics) => void;
}
```

### Region Extraction Options

```typescript
interface ExtractionOptions {
  connectivity: 4 | 8;          // Connectivity type (default: 8)
  minArea: number;              // Minimum area in pixels (default: 4)
  maxComponents: number;        // Maximum components to extract (default: 1000)
  sortByArea: boolean;          // Sort by area, largest first (default: true)
  includeHoles: boolean;        // Include hole analysis (default: false)
}
```

### Validation Configuration

```typescript
interface ValidationConfig {
  // Manifold validation
  checkManifold: boolean;        // Check manifold properties (default: true)
  checkWatertight: boolean;      // Check watertight geometry (default: true)
  allowSelfIntersections: boolean; // Allow self-intersections (default: false)
  
  // 3D printing constraints
  minWallThickness: number;      // Minimum wall thickness in mm (default: 0.4)
  minFeatureSize: number;        // Minimum feature size in mm (default: 0.8)
  maxOverhangAngle: number;      // Maximum overhang angle in degrees (default: 45)
  
  // Quality thresholds
  maxVertices: number;           // Maximum vertices (default: 200000)
  maxTriangles: number;          // Maximum triangles (default: 100000)
  minTriangleQuality: number;    // Minimum triangle quality 0-1 (default: 0.1)
}
```

## Algorithm Details

### Height Map Processing

1. **Height Level Extraction**: Unique height values are extracted from the normalized height map (0-1 range)
2. **Binary Mask Creation**: For each height level, a binary mask is created identifying pixels at that height
3. **Connected Component Analysis**: Flood-fill algorithm identifies connected regions in each mask
4. **Area Filtering**: Small components below minimum area threshold are removed

### Base Layer Generation

1. **Rounded Rectangle Creation**: Base layer uses rounded corners with parametric radius
2. **Extrusion**: 2D shape is extruded to base thickness using Three.js ExtrudeGeometry
3. **Positioning**: Base layer is positioned at Z=0 with proper centering

### Layer Extrusion Process

1. **Contour Extraction**: Connected components are converted to smooth contours
2. **Triangulation**: Contours are triangulated for 3D extrusion
3. **Height Stacking**: Each layer is positioned at appropriate Z-height
4. **Geometry Merging**: All layers are combined into final geometry

### Mesh Optimization

1. **Vertex Merging**: Duplicate vertices within tolerance are merged
2. **Degenerate Removal**: Zero-area triangles and duplicate vertices are removed
3. **Simplification**: Optional mesh simplification using quadric error metrics
4. **Quality Analysis**: Triangle aspect ratios and edge lengths are analyzed

### Validation Pipeline

1. **Manifold Checking**: Edges are analyzed to ensure each is shared by exactly 2 faces
2. **Watertight Testing**: Boundary edges are identified (should be zero for watertight)
3. **Feature Size Analysis**: Edge lengths are checked against minimum feature size
4. **Structural Validation**: Overall dimensions and stability are assessed

## Performance Characteristics

### Target Performance (on typical hardware)

| Operation | Time | Memory | Vertices |
|-----------|------|--------|----------|
| Preview Generation | < 1s | < 50MB | < 5K |
| Interactive Generation | < 3s | < 100MB | < 20K |
| Production Generation | < 10s | < 200MB | < 100K |

### Memory Management

The system includes sophisticated memory management:
- **Object Pooling**: Reuses TypedArrays and temporary objects
- **Batch Processing**: Large operations are chunked to prevent blocking
- **Automatic Cleanup**: Resources are automatically released after operations
- **Memory Monitoring**: Real-time memory usage tracking

### Performance Monitoring

```typescript
import { globalResourceManager } from './modules/geometry/performance';

// Execute with performance monitoring
const result = await globalResourceManager.withProfiling('geometry-generation', async () => {
  return generator.generateGeometry(quantizedImage, parameters);
});

// Get performance report
const report = globalResourceManager.getPerformanceReport();
console.log('Performance summary:', report.summary);
console.log('Bottlenecks:', report.bottlenecks);
console.log('Recommendations:', report.recommendations);
```

## Error Handling

The system provides specific error types for different failure modes:

```typescript
import { 
  GeometryGenerationError, 
  GeometryValidationError, 
  GeometryOptimizationError 
} from './modules/geometry';

try {
  const geometry = await generator.generateGeometry(quantizedImage, parameters);
} catch (error) {
  if (error instanceof GeometryGenerationError) {
    console.error(`Generation failed at stage: ${error.stage}`);
  } else if (error instanceof GeometryValidationError) {
    console.error('Validation issues:', error.issues);
  }
}
```

## 3D Printing Compatibility

The system is optimized for common 3D printing technologies:

### FDM (Fused Deposition Modeling)
- Minimum feature size: 0.4mm
- Minimum wall thickness: 0.4mm
- Maximum overhang: 45°
- Layer adhesion considerations

### Resin (SLA/DLP)
- Minimum feature size: 0.1mm
- Minimum wall thickness: 0.2mm
- Maximum overhang: 60°
- Support structure optimization

## Integration with Export System

The generated geometry is compatible with the export system:

```typescript
import { generateBookmarkGeometry } from './modules/geometry';
import { exportSTL, export3MF } from './modules/export';

// Generate geometry
const geometry = await generateBookmarkGeometry(quantizedImage, parameters);

// Export to STL
const stlBlob = await exportSTL(geometry);

// Export to 3MF with color information
const threeMFBlob = await export3MF(geometry, { includeColors: true });
```

## Testing

Comprehensive tests cover all major functionality:

```bash
# Run all geometry tests
npm test geometryGeneration.test.ts

# Run specific test suites
npm test -- --grep "BookmarkGeometryGenerator"
npm test -- --grep "RegionExtractor"
npm test -- --grep "MeshOptimizer"
npm test -- --grep "GeometryValidator"
```

## Best Practices

### For Best Quality
1. Use production pipeline for final output
2. Enable mesh optimization
3. Set appropriate minimum feature size
4. Validate geometry before export

### For Best Performance
1. Use preview pipeline for real-time updates
2. Limit maximum vertices for interactive use
3. Enable batch processing for large datasets
4. Monitor memory usage with performance tools

### For Reliable 3D Printing
1. Always validate geometry before printing
2. Follow printer-specific constraints
3. Consider support requirements
4. Test with small prints first

## Future Enhancements

Planned improvements include:
- Support for multi-material bookmarks
- Advanced hollowing algorithms
- Automatic support generation
- Print time optimization
- Custom infill patterns
- Web Workers for background processing