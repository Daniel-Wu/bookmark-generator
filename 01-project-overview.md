# Parametric 3D Bookmark Generator - Project Overview

## Project Description

A React-based web application that converts uploaded images into multi-layer 3D bookmarks for 3D printing. Images are color-quantized and extruded into height layers, creating tactile relief bookmarks where each color becomes a different extrusion height.

## Core Features

### Image Processing Pipeline

1. **Upload & Display**: Accept common image formats (PNG, JPG, GIF, WebP)
2. **Interactive Cropping**: Click-drag interface to position and scale image within bookmark bounds
3. **Color Quantization**: Reduce image to N discrete colors using k-means clustering
4. **Height Mapping**: Map quantized colors to extrusion heights (lightest = base, darkest = highest)
5. **Transparency Handling**: Transparent/white areas remain at base level (no extrusion)

### 3D Model Generation

1. **Layer Creation**: Generate separate geometry for each color layer
2. **Extrusion**: Create 3D geometry by extruding 2D color regions
3. **Base Structure**: Solid foundation layer for structural integrity
4. **Corner Rounding**: Parametric rounded corners for bookmark outline

### Parametric Controls

- **Number of Colors**: 2-8 colors (default: 4)
- **Layer Thickness**: 0.1-0.5mm per color layer (default: 0.2mm)
- **Base Thickness**: 1-3mm structural foundation (default: 2mm)
- **Dimensions**: Width/height scaling while maintaining aspect ratio
- **Corner Radius**: 0-10mm rounded corners (default: 3mm)

### Export Capabilities

- **3MF Export**: Multi-color format with embedded textures and layer colors
- **STL Export**: Single-color geometry fallback for wider printer compatibility
- **Preview Modes**: Real-time 3D preview with lighting and materials

## Technology Stack

- **Framework**: React 18 with Vite + TypeScript
- **3D Rendering**: Three.js with @react-three/fiber + @react-three/drei
- **UI Framework**: Tailwind CSS for styling
- **File Handling**: HTML5 FileReader API
- **Testing**: Vitest + React Testing Library

## Success Criteria

### Functional Requirements

- Successfully process images up to 10MB
- Generate 3D bookmarks with 2-8 color layers
- Export valid STL files for 3D printing
- Export 3MF files with color information
- Handle transparent backgrounds correctly
- Support all specified parameter ranges
- Provide real-time 3D preview

### Performance Requirements

- Image processing completes in <5 seconds
- 3D preview renders at 30+ FPS
- Memory usage stays under 500MB
- Initial page load in <3 seconds
- Parameter updates respond in <100ms

### Quality Requirements

- 80%+ unit test coverage
- Zero critical accessibility violations (WCAG 2.1 AA)
- Cross-browser compatibility (Chrome, Firefox, Safari)
- Mobile responsive design (tablets minimum)
- Graceful error handling for all edge cases

### User Experience Requirements

- Intuitive workflow from upload to export
- Clear visual feedback for all operations
- Helpful error messages and recovery suggestions
- Accessible interface (keyboard navigation, screen readers)
- Professional visual design
