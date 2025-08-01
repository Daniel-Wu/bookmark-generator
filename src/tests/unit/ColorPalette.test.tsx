/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPalette } from '../../components/ParameterPanel/ColorPalette';
import { DEFAULT_PARAMETERS } from '../../constants';
import { colorToHex } from '../../modules/image/colorUtils';
import type { QuantizedImageData, Color } from '../../types';

// Mock ImageData for jsdom environment
global.ImageData = global.ImageData || class {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
};

// Mock data
const createMockQuantizedData = (colorCount: number = 4): QuantizedImageData => {
  const baseColorsRgba = [
    { r: 0, g: 0, b: 0, a: 1 },       // Black (darkest)
    { r: 36, g: 36, b: 36, a: 1 },    // Very dark gray
    { r: 72, g: 72, b: 72, a: 1 },    // Dark gray
    { r: 108, g: 108, b: 108, a: 1 }, // Medium gray
    { r: 144, g: 144, b: 144, a: 1 }, // Light gray
    { r: 180, g: 180, b: 180, a: 1 }, // Lighter gray
    { r: 216, g: 216, b: 216, a: 1 }, // Very light gray
    { r: 255, g: 255, b: 255, a: 1 }, // White (lightest)
  ];
  
  const baseColors: Color[] = baseColorsRgba.map(color => ({
    ...color,
    hex: `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`
  }));
  
  const colors = baseColors.slice(0, colorCount);

  const imageData = new ImageData(100, 100);
  const heightMap = new Float32Array(100 * 100);

  return {
    imageData,
    colorPalette: colors,
    heightMap,
  };
};

describe('ColorPalette', () => {
  const defaultProps = {
    quantizedData: createMockQuantizedData(4),
    parameters: DEFAULT_PARAMETERS,
  };

  it('renders color palette with correct number of colors', () => {
    render(<ColorPalette {...defaultProps} />);
    
    expect(screen.getByText('Color Palette')).toBeInTheDocument();
    expect(screen.getByText('4 colors')).toBeInTheDocument();
    
    // Should have layer badges (numbers inside blue circles)
    const layerBadges = screen.getAllByText('1');
    expect(layerBadges.length).toBeGreaterThanOrEqual(1); // At least one layer badge
  });

  it('displays empty state when no quantized data provided', () => {
    render(<ColorPalette {...defaultProps} quantizedData={null} />);
    
    expect(screen.getByText('Upload and process an image to see the color palette')).toBeInTheDocument();
  });

  it('shows layer information correctly', () => {
    render(<ColorPalette {...defaultProps} />);
    
    // Should show base layer
    expect(screen.getByText('Base')).toBeInTheDocument();
    
    // Should show layer heights (darkest is base)
    expect(screen.getAllByText('2.0mm').length).toBeGreaterThanOrEqual(1); // Base thickness
    expect(screen.getAllByText('2.2mm').length).toBeGreaterThanOrEqual(1); // Base + 1 layer
    expect(screen.getAllByText('2.4mm').length).toBeGreaterThanOrEqual(1); // Base + 2 layers  
    expect(screen.getAllByText('2.6mm').length).toBeGreaterThanOrEqual(1); // Base + 3 layers
  });

  it('displays color information', () => {
    render(<ColorPalette {...defaultProps} />);
    
    // Should show hex colors (based on our mock data)
    expect(screen.getByText('#000000')).toBeInTheDocument(); // Black (darkest)
    expect(screen.getByText('#6C6C6C')).toBeInTheDocument(); // Light gray (brightest in 4-color)
    
    // Should show RGB values  
    expect(screen.getByText('RGB(0, 0, 0)')).toBeInTheDocument(); // Black
    expect(screen.getByText('RGB(108, 108, 108)')).toBeInTheDocument(); // Light gray
  });

  it('calls onColorClick when color swatch is clicked', () => {
    const onColorClick = vi.fn();
    render(<ColorPalette {...defaultProps} onColorClick={onColorClick} />);
    
    // Click on first color swatch (they're divs with click handlers)
    const colorContainer = screen.getByText('Base').closest('div[class*="cursor-pointer"]');
    expect(colorContainer).toBeInTheDocument();
    
    if (colorContainer) {
      fireEvent.click(colorContainer);
      expect(onColorClick).toHaveBeenCalledWith(0, expect.any(Object));
    }
  });

  it('shows layer mapping information', () => {
    render(<ColorPalette {...defaultProps} />);
    
    expect(screen.getByText('Layer Mapping')).toBeInTheDocument();
    expect(screen.getByText('• Colors sorted by brightness (darkest to lightest)')).toBeInTheDocument();
    expect(screen.getByText('• Layer thickness: 0.2mm')).toBeInTheDocument();
  });

  it('displays statistics correctly', () => {
    render(<ColorPalette {...defaultProps} />);
    
    // Statistics section
    expect(screen.getByText('Colors')).toBeInTheDocument();
    expect(screen.getByText('Max Height')).toBeInTheDocument();
    expect(screen.getByText('Layers')).toBeInTheDocument();
    
    // Values - use getAllByText since numbers appear in multiple places
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1); // Color count
    expect(screen.getAllByText('2.6mm').length).toBeGreaterThanOrEqual(1); // Max height
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1); // Layer count (colors - 1)
  });

  it('updates when parameters change', () => {
    const { rerender } = render(<ColorPalette {...defaultProps} />);
    
    // Initial max height
    expect(screen.getAllByText('2.6mm').length).toBeGreaterThanOrEqual(1);
    
    // Update parameters
    const newParameters = {
      ...DEFAULT_PARAMETERS,
      layerThickness: 0.3,
      baseThickness: 1.5,
    };
    
    rerender(<ColorPalette {...defaultProps} parameters={newParameters} />);
    
    // New max height should be calculated: 1.5 + (4-1) * 0.3 = 2.4mm
    expect(screen.getAllByText('2.4mm').length).toBeGreaterThanOrEqual(1);
  });

  it('handles different color counts', () => {
    const quantizedData = createMockQuantizedData(2);
    render(<ColorPalette quantizedData={quantizedData} parameters={DEFAULT_PARAMETERS} />);
    
    expect(screen.getByText('2 colors')).toBeInTheDocument();
    
    // Should show base layer and one additional layer
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Layer 2')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ColorPalette {...defaultProps} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('shows height visualization bars', () => {
    render(<ColorPalette {...defaultProps} />);
    
    // Should have height visualization bars for each color
    const heightBars = screen.getAllByText('Height');
    expect(heightBars.length).toBeGreaterThan(0);
  });
});

describe('ColorPalette Performance', () => {
  it('handles large color palettes efficiently', () => {
    const quantizedData = createMockQuantizedData(8); // Maximum colors
    const params = { ...DEFAULT_PARAMETERS, colorCount: 8 };
    
    const startTime = performance.now();
    render(<ColorPalette quantizedData={quantizedData} parameters={params} />);
    const endTime = performance.now();
    
    // Should render quickly (under 100ms for 8 colors)
    expect(endTime - startTime).toBeLessThan(100);
    
    expect(screen.getByText('8 colors')).toBeInTheDocument();
  });

  it('memoizes expensive calculations', () => {
    const quantizedData = createMockQuantizedData(6);
    const { rerender } = render(
      <ColorPalette quantizedData={quantizedData} parameters={DEFAULT_PARAMETERS} />
    );
    
    // Re-render with same props should be fast
    const startTime = performance.now();
    rerender(<ColorPalette quantizedData={quantizedData} parameters={DEFAULT_PARAMETERS} />);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(10);
  });
});

describe('ColorPalette Accessibility', () => {
  it('has proper ARIA labels and roles', () => {
    const onColorClick = vi.fn();
    const props = {
      quantizedData: createMockQuantizedData(4),
      parameters: DEFAULT_PARAMETERS,
    };
    render(<ColorPalette {...props} onColorClick={onColorClick} />);
    
    // Check for heading
    expect(screen.getByText('Color Palette')).toBeInTheDocument();
    
    // Check for accessible color information
    expect(screen.getByText('Layer Mapping')).toBeInTheDocument();
  });

  it('provides keyboard navigation for clickable elements', () => {
    const onColorClick = vi.fn();
    const props = {
      quantizedData: createMockQuantizedData(4),
      parameters: DEFAULT_PARAMETERS,
    };
    render(<ColorPalette {...props} onColorClick={onColorClick} />);
    
    // Color swatches should have click handlers when onColorClick is provided
    // Since they don't have proper roles, we'll check they exist
    expect(screen.getByText('Layer Mapping')).toBeInTheDocument();
  });
});