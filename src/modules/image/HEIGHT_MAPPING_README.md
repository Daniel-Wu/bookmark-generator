# Height Mapping System for 3D Bookmark Generation

The height mapping system converts quantized color palettes into normalized height levels for 3D bookmark generation. It uses perceptual luminance calculations to create smooth height gradients from lightest to darkest colors, enabling the creation of tactile relief bookmarks where each color becomes a different extrusion height.

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Configuration Options](#configuration-options)
- [Performance Guidelines](#performance-guidelines)
- [Integration Guide](#integration-guide)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

The height mapping system is the bridge between 2D image quantization and 3D geometry generation. It takes quantized image data (colors reduced to 2-8 levels) and generates a normalized height map where:

- **Lightest colors** → **Lowest heights** (base level)
- **Darkest colors** → **Highest heights** (maximum extrusion)
- **Height values** are normalized to 0-1 range for consistent geometry generation

### Key Features

- **Multiple mapping strategies**: Linear, logarithmic, exponential, and custom height distributions
- **Advanced smoothing**: Gaussian, median, and bilateral filtering to reduce noise
- **Edge enhancement**: Detect and sharpen transitions between height levels
- **Connected component analysis**: Identify and analyze separate 3D regions
- **Performance optimized**: Sub-2-second processing for 2MP images
- **Memory efficient**: Float32Array representation with <500MB peak usage
- **Real-time preview**: <100ms parameter updates for interactive editing

## Core Concepts

### Height Map Generation Pipeline

1. **Color Analysis**: Sort quantized colors by perceptual luminance
2. **Height Assignment**: Map colors to normalized heights (0-1) using selected strategy
3. **Pixel Mapping**: Assign height values to all pixels based on their quantized colors
4. **Smoothing** (optional): Apply noise reduction algorithms
5. **Edge Enhancement** (optional): Sharpen transitions between regions
6. **Validation**: Ensure all values are within valid range (0-1)

### Luminance Calculation

Uses ITU-R BT.709 standard for perceptual luminance:
```
luminance = 0.299 × R + 0.587 × G + 0.114 × B
```

This formula weights green heavily (human eye is most sensitive to green), followed by red, then blue.

### Height Mapping Strategies

- **Linear**: Evenly distributed heights across luminance range
- **Logarithmic**: More levels at lower heights (subtle gradations)
- **Exponential**: More levels at higher heights (dramatic contrast)
- **Custom**: User-defined height levels for specific artistic effects

## API Reference

### HeightMapper Class

The main class for height map generation.

```typescript
class HeightMapper {
  constructor(
    options?: Partial<HeightMappingOptions>,
    onProgress?: (progress: HeightMappingProgress) => void,
    signal?: AbortSignal
  )
  
  async generateHeightMap(quantizedData: QuantizedImageData): Promise<Float32Array>
  calculateHeightLevels(colorPalette: Color[]): Map<string, number>
  generateMetrics(heightMap: Float32Array, width: number, height: number): HeightMapMetrics
  analyzeConnectedComponents(heightMap: Float32Array, width: number, height: number): ConnectedComponent[]
}
```

### Configuration Options

```typescript
interface HeightMappingOptions {
  strategy: 'linear' | 'logarithmic' | 'exponential' | 'custom';
  smoothing: 'none' | 'gaussian' | 'median' | 'bilateral';
  smoothingRadius: number; // 0-10 pixels
  edgeEnhancement: boolean;
  edgeThreshold: number; // 0-1
  minFeatureSize: number; // minimum pixels for connected components
  handleTransparency: boolean;
  transparentHeight: number; // 0-1, height for transparent areas
  customHeightLevels?: number[]; // for custom strategy
}
```

### Utility Functions

```typescript
// Quick height map generation
function generateHeightMap(
  quantizedData: QuantizedImageData,
  options?: Partial<HeightMappingOptions>
): Promise<Float32Array>

// Bookmark-optimized mapper
function createBookmarkHeightMapper(
  parameters?: Partial<BookmarkParameters>,
  options?: Partial<HeightMappingOptions>
): HeightMapper

// Height level calculation
function configurableHeightLevels(
  colorCount: number,
  strategy?: HeightMappingStrategy
): number[]

// Parameter validation
function validateHeightMappingParams(
  options: Partial<HeightMappingOptions>
): { isValid: boolean; errors: string[] }
```

## Usage Examples

### Basic Usage

```typescript
import { HeightMapper } from './modules/image/heightMapping';

// Create height mapper with default settings
const heightMapper = new HeightMapper();

// Generate height map from quantized data
const heightMap = await heightMapper.generateHeightMap(quantizedData);

// Get quality metrics
const metrics = heightMapper.generateMetrics(heightMap, width, height);
console.log(`Height range: ${metrics.heightRange.min} - ${metrics.heightRange.max}`);
```

### Custom Configuration

```typescript
import { HeightMapper } from './modules/image/heightMapping';

// Configure for bookmark generation
const heightMapper = new HeightMapper({
  strategy: 'linear',
  smoothing: 'gaussian',
  smoothingRadius: 2,
  edgeEnhancement: false,
  handleTransparency: true,
  transparentHeight: 0
});

const heightMap = await heightMapper.generateHeightMap(quantizedData);
```

### With Progress Tracking

```typescript
const onProgress = (progress) => {
  console.log(`${progress.stage}: ${progress.message} (${Math.round(progress.progress * 100)}%)`);
};

const heightMapper = new HeightMapper({}, onProgress);
const heightMap = await heightMapper.generateHeightMap(quantizedData);
```

### Integration with Quantization

```typescript
import { KMeansQuantizer } from './modules/image/quantization';

const quantizer = new KMeansQuantizer({
  heightMappingOptions: {
    strategy: 'logarithmic',
    smoothing: 'bilateral',
    smoothingRadius: 1
  }
});

const result = await quantizer.quantize(imageData, 5);
// result.heightMap is automatically generated
```

## Configuration Options

### Height Mapping Strategies

#### Linear (Default)
```typescript
{ strategy: 'linear' }
```
- Even distribution of heights across luminance range
- Best for general purpose bookmark generation
- Preserves original image contrast relationships

#### Logarithmic
```typescript
{ strategy: 'logarithmic' }
```
- More height levels at lower values
- Creates subtle gradations in shadow areas
- Good for images with lots of dark detail

#### Exponential
```typescript
{ strategy: 'exponential' }
```
- More height levels at higher values
- Emphasizes highlights and bright areas
- Creates dramatic contrast effects

#### Custom
```typescript
{
  strategy: 'custom',
  customHeightLevels: [0, 0.1, 0.4, 0.7, 1.0]
}
```
- User-defined height distribution
- Allows precise control over height mapping
- Useful for artistic effects or specific requirements

### Smoothing Algorithms

#### Gaussian Smoothing
```typescript
{ smoothing: 'gaussian', smoothingRadius: 2 }
```
- Reduces noise while preserving general shape
- Good general-purpose smoothing
- Adjustable radius (1-10 pixels recommended)

#### Median Smoothing
```typescript
{ smoothing: 'median', smoothingRadius: 1 }
```
- Removes noise while preserving edges
- Good for images with salt-and-pepper noise
- Works well with small radius values

#### Bilateral Smoothing
```typescript
{ smoothing: 'bilateral', smoothingRadius: 1 }
```
- Edge-preserving smoothing
- Reduces noise while maintaining sharp transitions
- Best for photo-like images with clear regions

### Edge Enhancement

```typescript
{
  edgeEnhancement: true,
  edgeThreshold: 0.1
}
```
- Sharpens transitions between height levels
- Useful for creating more defined bookmark edges
- Threshold controls sensitivity (0.05-0.2 recommended)

### Transparency Handling

```typescript
{
  handleTransparency: true,
  transparentHeight: 0
}
```
- Controls how transparent pixels are mapped
- `transparentHeight: 0` keeps them at base level
- `transparentHeight: 1` places them at maximum height

## Performance Guidelines

### Processing Time Requirements

- **Typical bookmark (800×600)**: <500ms
- **1MP image (1024×1024)**: <1.5s
- **2MP image (1920×1080)**: <2s
- **Parameter changes**: <100ms for real-time preview

### Memory Efficiency

- **Peak memory usage**: <500MB for large images
- **Height map storage**: 4 bytes per pixel (Float32Array)
- **Memory cleanup**: Automatic garbage collection

### Optimization Tips

1. **Use appropriate smoothing radius**: Larger radius = slower processing
2. **Enable edge enhancement judiciously**: Adds processing overhead
3. **Consider image size**: Downscale very large images before processing
4. **Use cancellation**: Implement AbortSignal for user cancellation

## Integration Guide

### With Quantization Pipeline

The height mapping system integrates seamlessly with the K-means quantization:

```typescript
import { KMeansQuantizer } from './modules/image/quantization';

// Configure quantizer with height mapping options
const quantizer = new KMeansQuantizer({
  heightMappingOptions: {
    strategy: 'linear',
    smoothing: 'gaussian'
  }
});

// Single call generates both quantized colors and height map
const result = await quantizer.quantize(imageData, colorCount);
// result.heightMap ready for 3D geometry generation
```

### With 3D Geometry Generation

Height maps are designed for direct use with Three.js geometry generation:

```typescript
// Height map provides normalized heights (0-1)
const heights = result.heightMap;

// Scale heights based on bookmark parameters
for (let i = 0; i < heights.length; i++) {
  const scaledHeight = baseThickness + (heights[i] * layerThickness);
  // Use scaledHeight for vertex Z-coordinate
}
```

### Error Handling

```typescript
try {
  const heightMap = await heightMapper.generateHeightMap(quantizedData);
} catch (error) {
  if (error.message.includes('cancelled')) {
    console.log('Operation was cancelled by user');
  } else if (error.message.includes('Invalid height value')) {
    console.error('Generated invalid height values');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Testing

The height mapping system includes comprehensive tests:

### Unit Tests
```bash
npm run test -- heightMapping.test.ts
```
- Tests all height mapping strategies
- Validates smoothing algorithms
- Checks edge enhancement functionality
- Tests error handling and edge cases

### Performance Tests
```bash
npm run test -- heightMapping-performance.test.ts
```
- Validates processing time requirements
- Tests memory efficiency
- Benchmarks different image sizes
- Tests cancellation performance

### Integration Tests
```bash
npm run test -- heightMapping-integration.test.ts
```
- Tests integration with quantization pipeline
- Validates end-to-end workflows
- Tests complex image processing scenarios

## Troubleshooting

### Common Issues

#### Slow Processing
**Problem**: Height map generation takes too long
**Solutions**:
- Reduce smoothing radius
- Disable edge enhancement
- Use 'none' smoothing for fastest processing
- Consider downscaling input image

#### Poor Quality Results
**Problem**: Height map looks noisy or lacks detail
**Solutions**:
- Try different smoothing algorithms (bilateral for photos)
- Adjust smoothing radius (1-3 typically optimal)
- Use edge enhancement for sharper transitions
- Check input image quality and color count

#### Memory Issues
**Problem**: Out of memory errors with large images
**Solutions**:
- Reduce input image size
- Process images in smaller tiles
- Use system with more RAM
- Check for memory leaks in surrounding code

#### Invalid Height Values
**Problem**: Generated height map contains NaN or out-of-range values
**Solutions**:
- Validate input quantized data
- Check color palette for invalid colors
- Ensure image data is properly formatted
- Report as bug if issue persists

### Debugging Tools

#### Height Map Visualization
```typescript
import { visualizeHeightMap } from './modules/image/heightMapping-examples';

const { asciiVisualization, statistics } = visualizeHeightMap(heightMap, width, height);
console.log(asciiVisualization);
console.log(statistics);
```

#### Quality Metrics
```typescript
const metrics = heightMapper.generateMetrics(heightMap, width, height);
console.log('Quality metrics:', metrics);

// Check for issues
if (metrics.smoothnessIndex < 0.3) {
  console.warn('Height map may be too noisy');
}
if (metrics.uniqueHeights < 3) {
  console.warn('Height map may lack detail');
}
```

#### Parameter Validation
```typescript
import { validateHeightMappingParams } from './modules/image/heightMapping';

const validation = validateHeightMappingParams(options);
if (!validation.isValid) {
  console.error('Invalid parameters:', validation.errors);
}
```

### Getting Help

1. **Check examples**: See `heightMapping-examples.ts` for working code
2. **Run tests**: Ensure all tests pass in your environment
3. **Enable logging**: Use progress callbacks to debug processing stages
4. **Validate inputs**: Always validate quantized data before processing
5. **Performance profiling**: Use browser dev tools to identify bottlenecks

## Advanced Features

### Connected Component Analysis

Analyze separate regions in the height map:

```typescript
const components = heightMapper.analyzeConnectedComponents(
  heightMap, 
  width, 
  height, 
  0.5 // height threshold
);

components.forEach((component, index) => {
  console.log(`Component ${index}:`);
  console.log(`  Area: ${component.area} pixels`);
  console.log(`  Average height: ${component.averageHeight}`);
  console.log(`  Bounding box: ${JSON.stringify(component.boundingBox)}`);
});
```

### Custom Height Distribution

Create artistic effects with custom height levels:

```typescript
// Plateau effect: mostly flat with sharp peaks
const plateauLevels = [0, 0.1, 0.15, 0.2, 1.0];

// Terraced effect: distinct height steps
const terracedLevels = [0, 0.25, 0.5, 0.75, 1.0];

// Smooth curve: gentle transitions
const curveLevels = [0, 0.05, 0.2, 0.6, 1.0];

const mapper = new HeightMapper({
  strategy: 'custom',
  customHeightLevels: plateauLevels
});
```

### Real-time Parameter Updates

For interactive applications:

```typescript
class InteractiveHeightMapper {
  private cachedQuantizedData: QuantizedImageData;
  private lastOptions: HeightMappingOptions;
  
  async updateParameters(newOptions: Partial<HeightMappingOptions>): Promise<Float32Array> {
    // Only regenerate if parameters actually changed
    if (this.optionsChanged(newOptions)) {
      const mapper = new HeightMapper(newOptions);
      this.lastOptions = { ...mapper.options };
      return await mapper.generateHeightMap(this.cachedQuantizedData);
    }
    return this.lastHeightMap;
  }
}
```

This completes the comprehensive height mapping system implementation for your 3D bookmark generator!