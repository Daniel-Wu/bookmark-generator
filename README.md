# Parametric 3D Bookmark Generator

A React-based web application that converts uploaded images into multi-layer 3D bookmarks for 3D printing. Transform any image into a tactile relief bookmark where each color becomes a different extrusion height.

## Features

- **Image Processing**: Upload PNG, JPG, GIF, or WebP images up to 10MB
- **Interactive Cropping**: Position and scale images within bookmark bounds
- **Color Quantization**: Reduce images to 2-8 discrete colors using k-means clustering
- **Parametric Controls**: Adjust layer thickness, dimensions, and corner radius
- **Real-time 3D Preview**: Interactive preview with lighting and materials
- **Multiple Export Formats**: STL (universal) and 3MF (multi-color) support

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **3D Rendering**: Three.js with React Three Fiber
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/bookmark-generator.git
cd bookmark-generator

# Install dependencies
npm install

# Start development server
npm run dev
```

## Project Structure

```
src/
├── components/          # React components
│   ├── common/         # Reusable UI components
│   ├── upload/         # Image upload components
│   ├── parameters/     # Parameter control components
│   ├── preview/        # 3D preview components
│   └── export/         # Export panel components
├── modules/            # Core business logic
│   ├── image/          # Image processing
│   ├── geometry/       # 3D geometry generation
│   ├── rendering/      # Three.js rendering
│   └── export/         # File export
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
└── constants/          # Application constants
```

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

### Development Guidelines

- TypeScript strict mode enabled
- ESLint + Prettier for code quality
- Conventional commits for clear history
- 80%+ test coverage target
- WCAG 2.1 AA accessibility compliance

## Usage

1. **Upload an Image**: Drag and drop or click to browse for an image file
2. **Crop the Image**: Adjust position, scale, and rotation to fit bookmark bounds
3. **Set Parameters**: Choose color count, layer thickness, dimensions, and corner radius
4. **Preview in 3D**: Interact with the real-time 3D preview
5. **Export**: Download as STL (universal) or 3MF (multi-color) format

## Parameters

- **Colors**: 2-8 color layers (default: 4)
- **Layer Thickness**: 0.1-0.5mm per layer (default: 0.2mm)
- **Base Thickness**: 1-3mm foundation (default: 2mm)
- **Dimensions**: Scalable width/height with aspect ratio lock
- **Corner Radius**: 0-10mm rounded corners (default: 3mm)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Mobile: iOS Safari 14+, Chrome Android 90+

## Performance

- Image processing: <5 seconds
- 3D preview: 30+ FPS
- Memory usage: <500MB
- Parameter updates: <100ms

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Documentation

- [Project Overview](./01-project-overview.md) - Core features and success criteria
- [UI Design Specification](./02-ui-design-specification.md) - Layout and visual design
- [User Flows](./03-user-flows.md) - Interaction patterns and workflows
- [System Architecture](./04-system-architecture.md) - Technical specifications
- [Development & Testing](./05-development-testing.md) - Guidelines and milestones
- [Deployment & Monitoring](./06-deployment-monitoring.md) - Production setup

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions, please [open an issue](https://github.com/Daniel-Wu/bookmark-generator/issues) on GitHub.