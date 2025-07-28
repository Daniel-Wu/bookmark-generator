# Claude Development Context

This document provides essential context for AI agents working on the Parametric 3D Bookmark Generator project.

## Project Overview

This is a React-based web application that converts uploaded images into multi-layer 3D bookmarks for 3D printing. Images are color-quantized and extruded into height layers, creating tactile relief bookmarks where each color becomes a different extrusion height.

## Technology Stack

- **Framework**: React 18 + TypeScript + Vite
- **3D Rendering**: Three.js with @react-three/fiber + @react-three/drei
- **UI**: Tailwind CSS
- **Testing**: Vitest + React Testing Library
- **Build**: Vite with ES2020 target
- **Deployment**: Static site (Vercel/Netlify recommended)

## Key Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build

# Testing
npm run test         # Run all tests
npm run test:unit    # Unit tests only
npm run test:integration  # Integration tests
npm run test:e2e     # End-to-end tests
npm run test:a11y    # Accessibility tests

# Code Quality
npm run lint         # ESLint
npm run type-check   # TypeScript validation
npm run format       # Prettier formatting
```

## Project Structure

```
src/
├── components/          # React components (organized by feature)
├── modules/            # Core business logic (image, geometry, rendering, export)
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── constants/          # Application constants
└── tests/              # Test files
```

## Core Features & Implementation Status

### Image Processing Pipeline
- [ ] File upload with drag-drop (PNG, JPG, GIF, WebP, max 10MB)
- [ ] Interactive image cropping interface
- [ ] K-means color quantization (2-8 colors)
- [ ] Height map generation (luminance-based)
- [ ] Transparency handling

### 3D Model Generation
- [ ] Layer-based geometry generation
- [ ] Extrusion from 2D regions
- [ ] Base structure with rounded corners
- [ ] Connected component analysis
- [ ] Mesh optimization

### Parametric Controls
- [ ] Color count selection (2-8)
- [ ] Layer thickness (0.1-0.5mm)
- [ ] Base thickness (1-3mm)
- [ ] Dimensions with aspect ratio lock
- [ ] Corner radius (0-10mm)
- [ ] Parameter presets system

### 3D Preview
- [ ] Three.js scene with orbit controls
- [ ] Real-time parameter updates
- [ ] Layer visibility toggles
- [ ] Multiple render modes (solid, wireframe, x-ray)
- [ ] Performance optimization for 30+ FPS

### Export System
- [ ] STL binary format export
- [ ] 3MF multi-color format export
- [ ] File download handling
- [ ] Quality validation checks

## Development Guidelines

### Code Quality Standards
- TypeScript strict mode enabled
- ESLint + Prettier configuration
- Conventional commits
- 80%+ test coverage target
- WCAG 2.1 AA accessibility compliance

### Performance Requirements
- Image processing: <5 seconds for 2MP images
- Geometry generation: <5 seconds total
- Memory usage: <500MB peak
- 3D rendering: 30+ FPS target
- Parameter updates: <100ms response

### Browser Compatibility
- Primary: Chrome 90+, Firefox 88+, Safari 14+
- Mobile: iOS Safari 14+, Chrome Android 90+
- WebGL support required
- FileReader API support required

## Key Algorithms

### K-Means Color Quantization
1. Sample max 10K pixels for performance
2. K-means++ centroid initialization
3. Max 50 iterations, convergence threshold 0.1
4. Euclidean distance in RGB space

### Height Mapping
1. Perceived luminance: 0.299*R + 0.587*G + 0.114*B
2. Sort colors lightest to darkest
3. Linear height mapping (lightest=0, darkest=1)

### Geometry Generation
1. Base layer with rounded corners
2. Extract height levels from height map
3. Connected components via flood-fill
4. Filter by minimum area
5. Extrude and merge layers

## Testing Strategy

### Unit Tests
Focus on: Image processing, geometry generation, export functions
Tools: Vitest + custom test utilities
Target: 80% coverage

### Integration Tests
Focus on: Component integration, user workflows, state management
Tools: React Testing Library + user-event

### Performance Tests
Focus on: Processing time, memory usage, rendering FPS
Tools: Performance API + custom benchmarks

### Accessibility Tests
Focus on: Keyboard navigation, screen readers, WCAG compliance
Tools: @testing-library/jest-dom + axe-core

## Common Development Tasks

### Adding New Parameters
1. Update `BookmarkParameters` interface in types
2. Add UI control in ParameterPanel component
3. Update validation in validation utilities
4. Modify geometry generation to use new parameter
5. Add tests for parameter handling

### Implementing New Export Format
1. Create new exporter class extending `GeometryExporter`
2. Implement format-specific binary generation
3. Add format option to export UI
4. Update file download handling
5. Add format validation tests

### Optimizing Performance
1. Profile with React DevTools Profiler
2. Use React.memo for expensive components
3. Implement useMemo for calculations
4. Consider Web Workers for heavy processing
5. Monitor memory usage during operations

## Known Constraints & Limitations

### Technical Constraints
- Browser memory limit (~500MB)
- WebGL context limitations
- File size limits (10MB images)
- Single-threaded JavaScript (use Web Workers for heavy tasks)

### Design Constraints
- Bookmark aspect ratios for printability
- Minimum feature size for 3D printing
- Layer height limits for structural integrity
- Color count limits for performance

## Error Handling Patterns

### File Upload Errors
- Size validation with helpful messages
- Format validation with suggested fixes
- Corrupted file detection and recovery

### Processing Errors
- Memory limit handling with auto-resize options
- Algorithm convergence failure fallbacks
- Performance degradation warnings

### Export Errors
- Geometry validation before export
- Format compatibility checks
- File system error recovery

## Security Considerations

- Client-side only processing (no server uploads)
- Input sanitization for all file operations
- CSP headers for XSS prevention
- No storage of user data


### Phase 2 Features
- Additional bookmark shapes (circular, custom)
- Web Worker integration

## Debugging Tips

### Common Issues
- WebGL context loss: Implement context restoration
- Memory leaks: Clean up Three.js objects properly
- Performance: Use React DevTools Profiler
- iOS Safari: Test touch interactions carefully

### Useful Development Tools
- React DevTools (Components + Profiler)
- Three.js Inspector browser extension
- Chrome Performance tab for memory analysis
- Lighthouse for performance auditing

## Documentation References

For detailed implementation guidance, refer to:
- `01-project-overview.md` - Core features and requirements
- `02-ui-design-specification.md` - UI patterns and components
- `03-user-flows.md` - User interaction patterns
- `04-system-architecture.md` - Technical architecture details
- `05-development-testing.md` - Development process and testing
- `06-deployment-monitoring.md` - Production deployment guide