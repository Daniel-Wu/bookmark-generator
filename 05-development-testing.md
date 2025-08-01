# Development Guidelines & Testing Strategy

## Development Best Practices

### Code Quality

- **TypeScript strict mode** enabled
- **ESLint** with React/TypeScript rules
- **Prettier** for code formatting
- **Husky** for pre-commit hooks
- **Conventional commits** for clear history

### Testing Approach

- **Unit tests** for all utility functions
- **Component testing** with React Testing Library
- **Integration tests** for critical user flows
- **Visual regression testing** for UI components
- **Performance testing** for heavy computations

### Performance Optimization

- **Code splitting** by route and feature
- **Lazy loading** of heavy components
- **Memoization** of expensive calculations
- **Debounced parameter updates**
- **Efficient re-rendering** with React.memo

## Testing Strategy

### Unit Tests (Target: 80% coverage)

#### Image Processing Tests:

- Color quantization accuracy
- Height map generation
- Edge cases (single color, transparent images)
- Performance benchmarks

#### Geometry Generation Tests:

- Vertex count validation
- Mesh integrity (watertight, manifold)
- Parameter boundary testing
- Memory usage validation

#### Export Tests:

- File format compliance
- Binary data integrity
- Cross-platform compatibility

### Integration Tests

#### End-to-End Workflows:

- Complete image upload → processing → export pipeline
- Parameter changes trigger correct updates
- Error handling and recovery flows

#### Component Integration:

- State synchronization between components
- Event handling and data flow
- UI responsiveness and accessibility

### Performance Tests

#### Load Testing:

- Large image processing (4K resolution)
- Complex geometries (8 colors, detailed images)
- Memory usage profiling
- Export file size validation

#### Browser Testing:

- Cross-browser compatibility
- Mobile device performance
- WebGL context handling

## Development Milestones

### Sprint 1 (Weeks 1-2): Foundation Setup

**Deliverables:**

- [ ] Project scaffolding with Vite + React + TypeScript
- [ ] Basic file upload component with drag-drop
- [ ] Image validation and error handling
- [ ] Unit tests for file validation
- [ ] CI/CD pipeline setup

**Success Criteria:**

- Can upload and validate image files
- Error messages display correctly
- Tests run automatically on commit

### Sprint 2 (Weeks 3-4): Image Processing

**Deliverables:**

- [ ] K-means color quantization implementation
- [ ] Height map generation algorithm
- [ ] Interactive image cropping interface
- [ ] Color palette preview component
- [ ] Performance optimization (Web Workers)

**Success Criteria:**

- Color quantization completes in <3 seconds
- Height maps generate correctly
- Cropping interface is responsive and intuitive

### Sprint 3 (Weeks 5-6): 3D Geometry Generation

**Deliverables:**

- [ ] Bookmark geometry generation algorithm
- [ ] Three.js scene setup and rendering
- [ ] Basic parameter controls (sliders)
- [ ] Real-time preview updates
- [ ] Layer visualization controls

**Success Criteria:**

- 3D bookmarks generate in <5 seconds
- Preview updates smoothly with parameter changes
- Geometry is manifold and printable

### Sprint 4 (Weeks 7-8): Export Functionality

**Deliverables:**

- [ ] STL export implementation (binary format)
- [ ] 3MF export with color information
- [ ] Export progress indication
- [ ] File download handling
- [ ] Format validation testing

**Success Criteria:**

- Exported files are valid and importable
- 3MF files retain color information
- Export completes reliably

### Sprint 5 (Weeks 9-10): Polish & Deployment

**Deliverables:**

- [ ] UI/UX improvements and responsive design
- [ ] Comprehensive error handling
- [ ] Performance optimization
- [ ] Browser compatibility testing
- [ ] User documentation and help system

**Success Criteria:**

- Application works on all target browsers
- Error cases handled gracefully
- Performance meets all requirements

## Risk Mitigation

### Technical Risks

- **Browser Performance**: Implement Web Workers, optimize algorithms
- **Memory Limitations**: Progressive processing, data cleanup
- **3D Rendering Issues**: Fallback to simpler materials, error boundaries
- **Export Compatibility**: Extensive testing with 3D printing software

### Project Risks

- **Scope Creep**: Strict adherence to defined parameters only
- **Timeline Delays**: Prioritize core functionality over polish features
- **Technical Complexity**: Break down complex algorithms into testable units

### User Experience Risks

- **Learning Curve**: Provide clear instructions and examples
- **Processing Time**: Show progress indicators, set expectations
- **File Compatibility**: Clear format requirements and validation

## Test Specifications

### Image Processing Unit Tests

```typescript
describe('KMeansQuantizer', () => {
  test('should quantize colors correctly', () => {
    const imageData = createTestImageData();
    const quantizer = new KMeansQuantizer();
    const result = quantizer.quantize(imageData, 4, 50);

    expect(result.colorPalette).toHaveLength(4);
    expect(result.quantizedData).toBeDefined();
  });

  test('should handle single color images', () => {
    const singleColorImage = createSingleColorImage();
    const quantizer = new KMeansQuantizer();
    const result = quantizer.quantize(singleColorImage, 4, 50);

    expect(result.colorPalette).toHaveLength(1);
  });

  test('should complete within performance bounds', () => {
    const largeImage = createLargeTestImage(2048, 2048);
    const quantizer = new KMeansQuantizer();

    const startTime = performance.now();
    quantizer.quantize(largeImage, 8, 50);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(3000);
  });
});
```

### Geometry Generation Tests

```typescript
describe('BookmarkGeometryGenerator', () => {
  test('should generate valid geometry', () => {
    const heightMap = new Float32Array(100 * 100).fill(0.5);
    const parameters = createDefaultParameters();
    const generator = new BookmarkGeometryGenerator();

    const geometry = generator.generateBookmark(heightMap, parameters, { width: 100, height: 100 });

    expect(geometry.layers).toHaveLength(parameters.colorCount);
    expect(geometry.vertexCount).toBeGreaterThan(0);
    expect(geometry.faceCount).toBeGreaterThan(0);
  });

  test('should respect vertex count limits', () => {
    const complexHeightMap = createComplexHeightMap();
    const parameters = createDefaultParameters();
    const generator = new BookmarkGeometryGenerator();

    const geometry = generator.generateBookmark(complexHeightMap, parameters, {
      width: 1000,
      height: 1000,
    });

    expect(geometry.vertexCount).toBeLessThan(100000 * parameters.colorCount);
  });

  test('should produce manifold geometry', () => {
    const heightMap = createTestHeightMap();
    const parameters = createDefaultParameters();
    const generator = new BookmarkGeometryGenerator();

    const geometry = generator.generateBookmark(heightMap, parameters, { width: 100, height: 100 });

    // Test for manifold properties
    expect(isManifold(geometry)).toBe(true);
    expect(hasNonManifoldEdges(geometry)).toBe(false);
  });
});
```

### Component Integration Tests

```typescript
describe('Image Upload Flow', () => {
  test('should complete full upload workflow', async () => {
    render(<App />);

    const file = createTestImageFile();
    const uploadArea = screen.getByRole('button', { name: /upload/i });

    // Simulate file drop
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file] }
    });

    // Wait for processing
    await waitFor(() => {
      expect(screen.getByText(/crop/i)).toBeInTheDocument();
    });

    // Apply crop
    const applyCrop = screen.getByRole('button', { name: /apply crop/i });
    fireEvent.click(applyCrop);

    // Verify 3D preview appears
    await waitFor(() => {
      expect(screen.getByText(/3d preview/i)).toBeInTheDocument();
    });
  });

  test('should handle file validation errors', async () => {
    render(<App />);

    const invalidFile = createOversizedFile();
    const uploadArea = screen.getByRole('button', { name: /upload/i });

    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [invalidFile] }
    });

    await waitFor(() => {
      expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    });
  });
});
```

### Performance Tests

```typescript
describe('Performance Benchmarks', () => {
  test('image quantization performance', async () => {
    const imageData = createLargeImageData(2048, 2048);
    const processor = new ImageProcessor();

    const startTime = performance.now();
    await processor.quantizeColors(imageData, 8);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(3000);
  });

  test('geometry generation performance', async () => {
    const heightMap = createComplexHeightMap(1024, 1024);
    const parameters = createDefaultParameters();
    const generator = new BookmarkGeometryGenerator();

    const startTime = performance.now();
    const geometry = generator.generateBookmark(heightMap, parameters, {
      width: 1024,
      height: 1024,
    });
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(5000);
    expect(geometry.vertexCount).toBeLessThan(500000);
  });

  test('memory usage during processing', async () => {
    const initialMemory = performance.memory?.usedJSHeapSize || 0;

    // Process large image
    const imageData = createLargeImageData(4096, 4096);
    const processor = new ImageProcessor();
    await processor.quantizeColors(imageData, 8);

    const peakMemory = performance.memory?.usedJSHeapSize || 0;
    const memoryIncrease = peakMemory - initialMemory;

    // Should not exceed 500MB increase
    expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
  });
});
```

### Accessibility Tests

```typescript
describe('Accessibility', () => {
  test('should have proper keyboard navigation', () => {
    render(<App />);

    // Test tab order
    const focusableElements = getFocusableElements();
    expect(focusableElements[0]).toHaveAttribute('aria-label');

    // Test keyboard shortcuts
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(focusableElements[1]);
  });

  test('should have screen reader support', () => {
    render(<App />);

    // Check for ARIA labels
    expect(screen.getByLabelText(/upload image/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /3d preview/i })).toBeInTheDocument();

    // Check for live regions
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('should meet WCAG contrast requirements', () => {
    render(<App />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      const styles = getComputedStyle(button);
      const contrastRatio = calculateContrastRatio(
        styles.color,
        styles.backgroundColor
      );
      expect(contrastRatio).toBeGreaterThan(4.5);
    });
  });
});
```

## Documentation Requirements

### Technical Documentation

- **API documentation** for all modules
- **Component storybook** for UI components
- **Architecture decision records** (ADRs)
- **Performance benchmarking reports**

### User Documentation

- **Getting started guide**
- **Feature tutorials** with screenshots
- **Troubleshooting guide**
- **FAQ section**
- **Video demonstrations**

### Developer Documentation

- **Setup and installation guide**
- **Contributing guidelines**
- **Testing procedures**
- **Deployment instructions**
