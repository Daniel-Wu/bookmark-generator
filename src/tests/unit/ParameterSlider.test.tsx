import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParameterSlider, LayerThicknessSlider, BaseThicknessSlider, CornerRadiusSlider } from '../../components/common/ParameterSlider';

// ========================
// Test Setup
// ========================

const defaultProps = {
  value: 5,
  onChange: vi.fn(),
  min: 0,
  max: 10,
  step: 1,
  label: 'Test Parameter',
};

describe('ParameterSlider', () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================
  // Basic Functionality Tests
  // ========================

  describe('Basic Functionality', () => {
    it('renders with correct initial value', () => {
      render(<ParameterSlider {...defaultProps} onChange={mockOnChange} />);
      
      const slider = screen.getByRole('slider');
      expect(slider).toHaveValue('5');
      
      const input = screen.getByDisplayValue('5');
      expect(input).toBeInTheDocument();
    });

    it('displays correct label and unit', () => {
      render(
        <ParameterSlider 
          {...defaultProps} 
          onChange={mockOnChange} 
          unit="mm" 
          label="Width" 
        />
      );
      
      expect(screen.getByText('Width')).toBeInTheDocument();
      expect(screen.getByText('mm')).toBeInTheDocument();
    });

    it('handles slider value changes', async () => {
      const user = userEvent.setup();
      render(<ParameterSlider {...defaultProps} onChange={mockOnChange} />);
      
      const slider = screen.getByRole('slider');
      await user.click(slider);
      fireEvent.change(slider, { target: { value: '7' } });
      
      expect(mockOnChange).toHaveBeenCalledWith(7);
    });

    it('handles input field changes', async () => {
      const user = userEvent.setup();
      render(<ParameterSlider {...defaultProps} onChange={mockOnChange} />);
      
      const input = screen.getByDisplayValue('5');
      await user.clear(input);
      await user.type(input, '8');
      
      expect(mockOnChange).toHaveBeenCalledWith(8);
    });

    it('respects min and max constraints', () => {
      render(<ParameterSlider {...defaultProps} onChange={mockOnChange} />);
      
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '0');
      expect(slider).toHaveAttribute('max', '10');
      
      const input = screen.getByDisplayValue('5');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '10');
    });
  });

  // ========================
  // Accessibility Tests
  // ========================

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <ParameterSlider 
          {...defaultProps} 
          onChange={mockOnChange}
          ariaLabel="Custom label"
          ariaDescription="Custom description"
        />
      );
      
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('aria-label', 'Custom label');
      expect(slider).toHaveAttribute('aria-description', 'Custom description');
      expect(slider).toHaveAttribute('aria-valuemin', '0');
      expect(slider).toHaveAttribute('aria-valuemax', '10');
      expect(slider).toHaveAttribute('aria-valuenow', '5');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ParameterSlider {...defaultProps} onChange={mockOnChange} />);
      
      const slider = screen.getByRole('slider');
      await user.click(slider);
      
      // Arrow right should increase value
      await user.keyboard('{ArrowRight}');
      expect(mockOnChange).toHaveBeenCalledWith(6);
      
      // Arrow left should decrease value
      await user.keyboard('{ArrowLeft}');
      expect(mockOnChange).toHaveBeenCalledWith(4);
      
      // Home should go to minimum
      await user.keyboard('{Home}');
      expect(mockOnChange).toHaveBeenCalledWith(0);
      
      // End should go to maximum
      await user.keyboard('{End}');
      expect(mockOnChange).toHaveBeenCalledWith(10);
    });

    it('handles focus and blur events', async () => {
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      const user = userEvent.setup();
      
      render(
        <ParameterSlider 
          {...defaultProps} 
          onChange={mockOnChange}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      );
      
      const slider = screen.getByRole('slider');
      
      await user.click(slider);
      expect(onFocus).toHaveBeenCalled();
      
      await user.tab();
      expect(onBlur).toHaveBeenCalled();
    });

    it('is properly disabled', () => {
      render(<ParameterSlider {...defaultProps} onChange={mockOnChange} disabled />);
      
      const slider = screen.getByRole('slider');
      const input = screen.getByDisplayValue('5');
      
      expect(slider).toBeDisabled();
      expect(input).toBeDisabled();
    });
  });

  // ========================
  // Advanced Features Tests
  // ========================

  describe('Advanced Features', () => {
    it('supports snap values', async () => {
      const user = userEvent.setup();
      render(
        <ParameterSlider 
          {...defaultProps} 
          onChange={mockOnChange}
          snapValues={[2, 5, 8]}
        />
      );
      
      // Should show snap value buttons
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      
      // Clicking snap value should set value
      await user.click(screen.getByText('8'));
      expect(mockOnChange).toHaveBeenCalledWith(8);
    });

    it('displays markers correctly', () => {
      render(
        <ParameterSlider 
          {...defaultProps} 
          onChange={mockOnChange}
          markers={[
            { value: 3, type: 'recommended', label: 'Good', description: 'Recommended value' },
            { value: 7, type: 'warning', label: 'High', description: 'High value warning' }
          ]}
        />
      );
      
      // Markers should be rendered (as elements with title attributes)
      const markers = document.querySelectorAll('[title]');
      expect(markers.length).toBeGreaterThanOrEqual(2);
    });

    it('supports custom value formatting', () => {
      render(
        <ParameterSlider 
          {...defaultProps} 
          onChange={mockOnChange}
          formatValue={(value) => `${value * 100}%`}
        />
      );
      
      expect(screen.getByText('500%')).toBeInTheDocument();
    });

    it('handles debounced changes', async () => {
      vi.useFakeTimers();
      
      render(
        <ParameterSlider 
          {...defaultProps} 
          onChange={mockOnChange}
          debounceMs={100}
        />
      );
      
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '7' } });
      
      // Should not call onChange immediately
      expect(mockOnChange).not.toHaveBeenCalled();
      
      // Should call onChange after debounce delay
      vi.advanceTimersByTime(100);
      expect(mockOnChange).toHaveBeenCalledWith(7);
      
      vi.useRealTimers();
    });

    it('shows tooltip on focus and drag', async () => {
      const user = userEvent.setup();
      render(<ParameterSlider {...defaultProps} onChange={mockOnChange} unit="mm" />);
      
      const slider = screen.getByRole('slider');
      await user.click(slider);
      
      // Tooltip should appear (contains value and unit)
      await waitFor(() => {
        expect(screen.getByText('5mm')).toBeInTheDocument();
      });
    });
  });

  // ========================
  // Value Types Tests
  // ========================

  describe('Value Types', () => {
    it('handles percentage values', () => {
      render(
        <ParameterSlider 
          {...defaultProps} 
          onChange={mockOnChange}
          valueType="percentage"
          value={0.5}
        />
      );
      
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('handles custom precision', () => {
      render(
        <ParameterSlider 
          {...defaultProps} 
          onChange={mockOnChange}
          value={5.123456}
          precision={3}
        />
      );
      
      expect(screen.getByDisplayValue('5.123')).toBeInTheDocument();
    });
  });

  // ========================
  // Performance Tests
  // ========================

  describe('Performance', () => {
    it('cleans up debounce timers on unmount', () => {
      vi.useFakeTimers();
      
      const { unmount } = render(
        <ParameterSlider 
          {...defaultProps} 
          onChange={mockOnChange}
          debounceMs={100}
        />
      );
      
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '7' } });
      
      unmount();
      
      // Timer should be cleared, so callback shouldn't fire
      vi.advanceTimersByTime(100);
      expect(mockOnChange).not.toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });
});

// ========================
// Specialized Slider Tests
// ========================

describe('LayerThicknessSlider', () => {
  it('has correct default props', () => {
    const onChange = vi.fn();
    render(<LayerThicknessSlider value={0.2} onChange={onChange} />);
    
    expect(screen.getByText('Layer Thickness')).toBeInTheDocument();
    expect(screen.getByText('mm')).toBeInTheDocument();
    expect(screen.getByText(/Thinner layers = finer detail/)).toBeInTheDocument();
    
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '0.1');
    expect(slider).toHaveAttribute('max', '0.5');
  });

  it('has recommended markers and snap values', () => {
    const onChange = vi.fn();
    render(<LayerThicknessSlider value={0.2} onChange={onChange} />);
    
    // Should have snap value buttons
    expect(screen.getByText('0.1')).toBeInTheDocument();
    expect(screen.getByText('0.2')).toBeInTheDocument();
    expect(screen.getByText('0.5')).toBeInTheDocument();
  });
});

describe('BaseThicknessSlider', () => {
  it('has correct default props', () => {
    const onChange = vi.fn();
    render(<BaseThicknessSlider value={2.0} onChange={onChange} />);
    
    expect(screen.getByText('Base Thickness')).toBeInTheDocument();
    expect(screen.getByText('mm')).toBeInTheDocument();
    expect(screen.getByText(/Structural foundation/)).toBeInTheDocument();
    
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '3');
  });
});

describe('CornerRadiusSlider', () => {
  it('has correct default props', () => {
    const onChange = vi.fn();
    render(<CornerRadiusSlider value={2} onChange={onChange} />);
    
    expect(screen.getByText('Corner Radius')).toBeInTheDocument();
    expect(screen.getByText('mm')).toBeInTheDocument();
    expect(screen.getByText(/Rounded corners/)).toBeInTheDocument();
    
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '10');
  });
});

// ========================
// Integration Tests
// ========================

describe('ParameterSlider Integration', () => {
  it('works with aspect ratio constraints', async () => {
    const user = userEvent.setup();
    let isLocked = false;
    
    const TestComponent = () => {
      const [width, setWidth] = React.useState(50);
      const [height, setHeight] = React.useState(150);
      
      const handleWidthChange = (newWidth: number) => {
        if (isLocked) {
          const ratio = 50 / 150; // Original ratio
          setHeight(Math.round(newWidth / ratio));
        }
        setWidth(newWidth);
      };
      
      return (
        <div>
          <button onClick={() => { isLocked = !isLocked; }}>
            {isLocked ? 'Unlock' : 'Lock'} Ratio
          </button>
          <ParameterSlider
            value={width}
            onChange={handleWidthChange}
            min={20}
            max={200}
            label="Width"
            unit="mm"
          />
          <div data-testid="height">{height}</div>
        </div>
      );
    };
    
    render(<TestComponent />);
    
    // Lock aspect ratio
    await user.click(screen.getByText('Lock Ratio'));
    isLocked = true;
    
    // Change width - height should adjust
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '100' } });
    
    await waitFor(() => {
      expect(screen.getByTestId('height')).toHaveTextContent('300');
    });
  });
});

// ========================
// Error Handling Tests
// ========================

describe('Error Handling', () => {
  it('handles invalid input gracefully', async () => {
    const mockOnChange = vi.fn();
    const user = userEvent.setup();
    render(<ParameterSlider {...defaultProps} onChange={mockOnChange} />);
    
    const input = screen.getByDisplayValue('5');
    await user.clear(input);
    await user.type(input, 'invalid');
    
    // Should not crash and should not call onChange with NaN
    expect(mockOnChange).not.toHaveBeenCalledWith(NaN);
  });

  it('clamps values to valid range', async () => {
    const mockOnChange = vi.fn();
    const user = userEvent.setup();
    render(<ParameterSlider {...defaultProps} onChange={mockOnChange} />);
    
    const input = screen.getByDisplayValue('5');
    await user.clear(input);
    await user.type(input, '999');
    
    // Should clamp to max value
    expect(mockOnChange).toHaveBeenCalledWith(10);
  });
});