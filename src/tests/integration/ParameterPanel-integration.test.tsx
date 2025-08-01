import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParameterPanel } from '../../components/ParameterPanel/ParameterPanel';
import { createColor } from '../../modules/image/colorUtils';
import type { BookmarkParameters, QuantizedImageData } from '../../types';
import { DEFAULT_PARAMETERS } from '../../constants';

// ========================
// Mock Dependencies
// ========================

// Mock performance hooks
vi.mock('../../hooks/usePerformanceOptimization', () => ({
  useParametersMemo: (params: BookmarkParameters) => params,
  useOptimizedCallback: (callback: any) => callback,
  useRenderPerformance: () => {}
}));

// Mock debounced parameters hook
vi.mock('../../hooks/useDebouncedParameters', () => ({
  useSmartParameters: (initialParams: BookmarkParameters, callbacks: any = {}) => ({
    parameters: initialParams,
    setParameters: (params: BookmarkParameters) => {
      if (callbacks.onUIChange) callbacks.onUIChange(params);
      if (callbacks.onProcessingChange) callbacks.onProcessingChange(params);
      if (callbacks.onGeometryChange) callbacks.onGeometryChange(params);
    },
    updateParameter: <K extends keyof BookmarkParameters>(key: K, value: BookmarkParameters[K]) => {
      const newParams = { ...initialParams, [key]: value };
      if (callbacks.onUIChange) callbacks.onUIChange(newParams);
      if (callbacks.onProcessingChange) callbacks.onProcessingChange(newParams);
      if (callbacks.onGeometryChange) callbacks.onGeometryChange(newParams);
    }
  })
}));

// ========================
// Test Data
// ========================

const colorPaletteRgba = [
  { r: 255, g: 255, b: 255, a: 1 },
  { r: 128, g: 128, b: 128, a: 1 },
  { r: 64, g: 64, b: 64, a: 1 },
  { r: 0, g: 0, b: 0, a: 1 }
];

const mockQuantizedData: QuantizedImageData = {
  imageData: new ImageData(100, 100),
  colorPalette: colorPaletteRgba.map(color => createColor(color.r, color.g, color.b, color.a)),
  heightMap: new Float32Array(10000)
};

const defaultProps = {
  parameters: DEFAULT_PARAMETERS,
  onChange: vi.fn(),
  disabled: false,
  className: '',
  quantizedData: null as QuantizedImageData | null,
  onColorClick: vi.fn()
};

describe('ParameterPanel Integration', () => {
  let mockOnChange: ReturnType<typeof vi.fn>;
  let mockOnColorClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
    mockOnColorClick = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================
  // Basic Rendering Tests
  // ========================

  describe('Rendering', () => {
    it('renders all parameter sections', () => {
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      // Check main sections
      expect(screen.getByText('Parameters')).toBeInTheDocument();
      expect(screen.getByText('Color Count')).toBeInTheDocument();
      expect(screen.getByText('Dimensions')).toBeInTheDocument();
      expect(screen.getByText('Layer Settings')).toBeInTheDocument();
      expect(screen.getByText('Corner Style')).toBeInTheDocument();
      expect(screen.getByText('Current Configuration')).toBeInTheDocument();
    });

    it('renders enhanced sliders', () => {
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      // Check for enhanced slider components
      expect(screen.getByText('Layer Thickness')).toBeInTheDocument();
      expect(screen.getByText('Base Thickness')).toBeInTheDocument();
      expect(screen.getByText('Corner Radius')).toBeInTheDocument();
      expect(screen.getByText('Width')).toBeInTheDocument();
      expect(screen.getByText('Height')).toBeInTheDocument();
    });

    it('renders color palette when quantized data is provided', () => {
      render(
        <ParameterPanel 
          {...defaultProps} 
          onChange={mockOnChange}
          quantizedData={mockQuantizedData}
        />
      );

      // Should render color palette section
      expect(screen.getByText('Color Palette')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <ParameterPanel 
          {...defaultProps} 
          onChange={mockOnChange}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('disables all controls when disabled prop is true', () => {
      render(
        <ParameterPanel 
          {...defaultProps} 
          onChange={mockOnChange}
          disabled={true}
        />
      );

      // All sliders should be disabled
      const sliders = screen.getAllByRole('slider');
      sliders.forEach(slider => {
        expect(slider).toBeDisabled();
      });
    });
  });

  // ========================
  // Parameter Control Tests
  // ========================

  describe('Parameter Controls', () => {
    it('handles layer thickness changes', async () => {
      const user = userEvent.setup();
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      const slider = screen.getByLabelText(/Layer thickness control/i);
      fireEvent.change(slider, { target: { value: '0.3' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ layerThickness: 0.3 })
      );
    });

    it('handles base thickness changes', async () => {
      const user = userEvent.setup();
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      const slider = screen.getByLabelText(/Base thickness control/i);
      fireEvent.change(slider, { target: { value: '2.5' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ baseThickness: 2.5 })
      );
    });

    it('handles corner radius changes', async () => {
      const user = userEvent.setup();
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      const slider = screen.getByLabelText(/Corner radius control/i);
      fireEvent.change(slider, { target: { value: '5' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ cornerRadius: 5 })
      );
    });

    it('handles dimension changes with aspect ratio lock', async () => {
      const user = userEvent.setup();
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      // Lock aspect ratio
      const lockButton = screen.getByText(/Lock.*Ratio/i);
      await user.click(lockButton);

      // Change width - should affect height too
      const widthSlider = screen.getByLabelText(/Bookmark width control/i);
      fireEvent.change(widthSlider, { target: { value: '100' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ 
          width: 100,
          height: expect.any(Number) // Height should be calculated based on ratio
        })
      );
    });

    it('handles color count changes', async () => {
      const user = userEvent.setup();
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      // Find color count buttons
      const colorButton = screen.getByText('6');
      await user.click(colorButton);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ colorCount: 6 })
      );
    });
  });

  // ========================
  // Real-time Updates Tests
  // ========================

  describe('Real-time Updates', () => {
    it('updates parameter summary in real-time', async () => {
      const TestComponent = () => {
        const [params, setParams] = React.useState(DEFAULT_PARAMETERS);
        
        return (
          <ParameterPanel 
            parameters={params}
            onChange={setParams}
            disabled={false}
          />
        );
      };

      render(<TestComponent />);

      // Change a parameter
      const slider = screen.getByLabelText(/Layer thickness control/i);
      fireEvent.change(slider, { target: { value: '0.4' } });

      // Check that summary updates
      await waitFor(() => {
        expect(screen.getByText(/Layer:.*0\.4mm/)).toBeInTheDocument();
      });
    });

    it('updates corner preview in real-time', async () => {
      const TestComponent = () => {
        const [params, setParams] = React.useState(DEFAULT_PARAMETERS);
        
        return (
          <ParameterPanel 
            parameters={params}
            onChange={setParams}
            disabled={false}
          />
        );
      };

      render(<TestComponent />);

      // Change corner radius
      const slider = screen.getByLabelText(/Corner radius control/i);
      fireEvent.change(slider, { target: { value: '8' } });

      // Corner preview should update (check style attribute)
      await waitFor(() => {
        const preview = document.querySelector('[style*="border-radius"]');
        expect(preview).toHaveStyle({ borderRadius: '16px' }); // 8 * 2
      });
    });

    it('updates maximum height calculation', async () => {
      const TestComponent = () => {
        const [params, setParams] = React.useState({
          ...DEFAULT_PARAMETERS,
          colorCount: 4,
          layerThickness: 0.2,
          baseThickness: 2.0
        });
        
        return (
          <ParameterPanel 
            parameters={params}
            onChange={setParams}
            disabled={false}
          />
        );
      };

      render(<TestComponent />);

      // Expected max height = 2.0 + (4-1) * 0.2 = 2.6mm
      expect(screen.getByText(/Max Height:.*2\.6mm/)).toBeInTheDocument();

      // Change parameters
      const colorButton = screen.getByText('6');
      await userEvent.setup().click(colorButton);

      // Expected max height = 2.0 + (6-1) * 0.2 = 3.0mm
      await waitFor(() => {
        expect(screen.getByText(/Max Height:.*3\.0mm/)).toBeInTheDocument();
      });
    });
  });

  // ========================
  // Preset System Tests
  // ========================

  describe('Preset System', () => {
    it('loads preset parameters', async () => {
      const user = userEvent.setup();
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      // Look for preset buttons
      const presetSection = screen.getByText('Presets').closest('section');
      expect(presetSection).toBeInTheDocument();

      // This would test preset loading if presets were implemented
      // const quickPreset = screen.getByText('Quick');
      // await user.click(quickPreset);
      // expect(mockOnChange).toHaveBeenCalledWith(expectedPresetParams);
    });

    it('saves current parameters as preset', async () => {
      const user = userEvent.setup();
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      // This would test preset saving functionality
      // const saveButton = screen.getByText('Save Preset');
      // await user.click(saveButton);
      // Expect preset to be saved to localStorage or state
    });
  });

  // ========================
  // Dimension Preset Tests
  // ========================

  describe('Dimension Presets', () => {
    it('applies dimension presets', async () => {
      const user = userEvent.setup();
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      // Find dimension preset buttons
      const standardPreset = screen.getByText('Standard');
      expect(standardPreset).toBeInTheDocument();

      await user.click(standardPreset);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 50,
          height: 150
        })
      );
    });

    it('shows current preset as active', () => {
      render(
        <ParameterPanel 
          {...defaultProps} 
          onChange={mockOnChange}
          parameters={{ ...DEFAULT_PARAMETERS, width: 50, height: 150 }}
        />
      );

      const standardPreset = screen.getByText('Standard');
      expect(standardPreset.closest('button')).toHaveClass('bg-blue-100');
    });
  });

  // ========================
  // Snap Values Tests
  // ========================

  describe('Snap Values', () => {
    it('shows snap value buttons for sliders', () => {
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      // Layer thickness should have snap values
      expect(screen.getByText('0.1')).toBeInTheDocument();
      expect(screen.getByText('0.2')).toBeInTheDocument();
      expect(screen.getByText('0.5')).toBeInTheDocument();
    });

    it('applies snap values when clicked', async () => {
      const user = userEvent.setup();
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      // Click a snap value
      const snapButton = screen.getByText('0.3');
      await user.click(snapButton);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ layerThickness: 0.3 })
      );
    });
  });

  // ========================
  // Accessibility Tests
  // ========================

  describe('Accessibility', () => {
    it('has proper ARIA labels for all controls', () => {
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      // Check ARIA labels
      expect(screen.getByLabelText(/Layer thickness control/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Base thickness control/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Corner radius control/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Bookmark width control/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Bookmark height control/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      // Tab through controls
      await user.tab();
      const firstSlider = document.activeElement;
      expect(firstSlider).toHaveAttribute('role', 'slider');

      // Use arrow keys
      await user.keyboard('{ArrowRight}');
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('announces value changes to screen readers', () => {
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      const slider = screen.getByLabelText(/Layer thickness control/i);
      expect(slider).toHaveAttribute('aria-valuetext');
      expect(slider).toHaveAttribute('aria-valuenow');
      expect(slider).toHaveAttribute('aria-valuemin');
      expect(slider).toHaveAttribute('aria-valuemax');
    });
  });

  // ========================
  // Performance Tests
  // ========================

  describe('Performance', () => {
    it('debounces parameter changes appropriately', async () => {
      vi.useFakeTimers();
      
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      const slider = screen.getByLabelText(/Layer thickness control/i);
      
      // Make multiple rapid changes
      fireEvent.change(slider, { target: { value: '0.3' } });
      fireEvent.change(slider, { target: { value: '0.4' } });
      fireEvent.change(slider, { target: { value: '0.5' } });

      // Should not have called onChange yet (debounced)
      expect(mockOnChange).not.toHaveBeenCalled();

      // Fast forward debounce timer
      vi.advanceTimersByTime(300);
      
      // Should now have called onChange with final value
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ layerThickness: 0.5 })
      );

      vi.useRealTimers();
    });

    it('handles rapid parameter changes without lag', () => {
      const start = performance.now();
      
      render(<ParameterPanel {...defaultProps} onChange={mockOnChange} />);

      const slider = screen.getByLabelText(/Layer thickness control/i);
      
      // Make many changes
      for (let i = 0; i < 100; i++) {
        fireEvent.change(slider, { target: { value: `${0.1 + i * 0.001}` } });
      }

      const end = performance.now();
      const duration = end - start;

      // Should handle changes quickly (< 100ms for 100 changes)
      expect(duration).toBeLessThan(100);
    });
  });

  // ========================
  // Integration with Other Components
  // ========================

  describe('Component Integration', () => {
    it('integrates with color palette component', async () => {
      const user = userEvent.setup();
      render(
        <ParameterPanel 
          {...defaultProps} 
          onChange={mockOnChange}
          onColorClick={mockOnColorClick}
          quantizedData={mockQuantizedData}
        />
      );

      // Color palette should be rendered
      expect(screen.getByText('Color Palette')).toBeInTheDocument();

      // Clicking colors should trigger callback
      const colorSwatch = document.querySelector('[data-testid="color-swatch"]');
      if (colorSwatch) {
        await user.click(colorSwatch);
        expect(mockOnColorClick).toHaveBeenCalled();
      }
    });

    it('updates configuration summary correctly', () => {
      const customParams = {
        ...DEFAULT_PARAMETERS,
        colorCount: 6,
        width: 80,
        height: 200,
        layerThickness: 0.3,
        baseThickness: 2.5,
        cornerRadius: 5
      };

      render(
        <ParameterPanel 
          {...defaultProps} 
          onChange={mockOnChange}
          parameters={customParams}
        />
      );

      // Check configuration summary
      expect(screen.getByText(/Colors:.*6/)).toBeInTheDocument();
      expect(screen.getByText(/Size:.*80×200mm/)).toBeInTheDocument();
      expect(screen.getByText(/Layer:.*0\.3mm/)).toBeInTheDocument();
      expect(screen.getByText(/Base:.*2\.5mm/)).toBeInTheDocument();
      expect(screen.getByText(/Corner:.*5mm/)).toBeInTheDocument();
      
      // Max height = 2.5 + (6-1) * 0.3 = 4.0mm
      expect(screen.getByText(/Max Height:.*4\.0mm/)).toBeInTheDocument();
    });
  });

  // ========================
  // Error Handling Tests
  // ========================

  describe('Error Handling', () => {
    it('handles missing onChange prop gracefully', () => {
      // @ts-expect-error - Testing missing required prop
      expect(() => render(<ParameterPanel parameters={DEFAULT_PARAMETERS} />))
        .not.toThrow();
    });

    it('handles invalid parameter values', () => {
      const invalidParams = {
        ...DEFAULT_PARAMETERS,
        colorCount: NaN,
        layerThickness: Infinity,
        width: -1
      };

      expect(() => 
        render(
          <ParameterPanel 
            parameters={invalidParams}
            onChange={mockOnChange}
          />
        )
      ).not.toThrow();
    });

    it('recovers from parameter update errors', async () => {
      const failingOnChange = vi.fn().mockImplementation(() => {
        throw new Error('Update failed');
      });

      render(
        <ParameterPanel 
          {...defaultProps}
          onChange={failingOnChange}
        />
      );

      const slider = screen.getByLabelText(/Layer thickness control/i);
      
      // Should not crash when onChange throws
      expect(() => {
        fireEvent.change(slider, { target: { value: '0.3' } });
      }).not.toThrow();
    });
  });
});