import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CropControls } from '../../components/ImageUpload/CropControls';
import type { CropRegion } from '../../types';

// Mock image
const mockImage = {
  naturalWidth: 800,
  naturalHeight: 600,
  src: 'mock-image-src',
} as HTMLImageElement;

const defaultCropRegion: CropRegion = {
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  rotation: 0,
};

const defaultProps = {
  image: mockImage,
  cropRegion: defaultCropRegion,
  onCropChange: vi.fn(),
  scale: 1.0,
  onScaleChange: vi.fn(),
  aspectRatioLocked: false,
  onAspectRatioToggle: vi.fn(),
};

describe('CropControls', () => {
  beforeEach(() => {
    // Mock getBoundingClientRect for canvas
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 300,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    });

    // Mock device pixel ratio
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders crop controls with all elements', () => {
      render(<CropControls {...defaultProps} />);

      expect(screen.getByText('Adjust Image Crop')).toBeInTheDocument();
      expect(screen.getByLabelText(/crop selection area/i)).toBeInTheDocument();
      expect(screen.getByText('🔄 Reset')).toBeInTheDocument();
      expect(screen.getByText('↶ 90°')).toBeInTheDocument();
      expect(screen.getByText('↷ 90°')).toBeInTheDocument();
      expect(screen.getByLabelText(/scale/i)).toBeInTheDocument();
      expect(screen.getByText(/📎/)).toBeInTheDocument();
    });

    it('displays crop region information', () => {
      render(<CropControls {...defaultProps} />);

      expect(screen.getByText(/Position: 100, 100/)).toBeInTheDocument();
      expect(screen.getByText(/Size: 200 × 150/)).toBeInTheDocument();
    });

    it('shows correct scale percentage', () => {
      render(<CropControls {...defaultProps} scale={1.5} />);

      expect(screen.getByText('150%')).toBeInTheDocument();
    });

    it('shows aspect ratio lock state', () => {
      const { rerender } = render(<CropControls {...defaultProps} />);
      expect(screen.getByText('📎 Free')).toBeInTheDocument();

      rerender(<CropControls {...defaultProps} aspectRatioLocked={true} />);
      expect(screen.getByText('📎 Locked')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onCropChange when reset button is clicked', async () => {
      const onCropChange = vi.fn();
      render(<CropControls {...defaultProps} onCropChange={onCropChange} />);

      const resetButton = screen.getByText('🔄 Reset');
      await userEvent.click(resetButton);

      expect(onCropChange).toHaveBeenCalled();
      const calledCrop = onCropChange.mock.calls[0][0];
      expect(calledCrop.x).toBeGreaterThanOrEqual(0);
      expect(calledCrop.y).toBeGreaterThanOrEqual(0);
    });

    it('calls onCropChange when rotate buttons are clicked', async () => {
      const onCropChange = vi.fn();
      render(<CropControls {...defaultProps} onCropChange={onCropChange} />);

      const rotateClockwise = screen.getByText('↷ 90°');
      await userEvent.click(rotateClockwise);

      expect(onCropChange).toHaveBeenCalledWith({
        ...defaultCropRegion,
        rotation: 90,
      });

      const rotateCounterclockwise = screen.getByText('↶ 90°');
      await userEvent.click(rotateCounterclockwise);

      expect(onCropChange).toHaveBeenCalledWith({
        ...defaultCropRegion,
        rotation: -90,
      });
    });

    it('calls onScaleChange when scale slider is moved', async () => {
      const onScaleChange = vi.fn();
      render(<CropControls {...defaultProps} onScaleChange={onScaleChange} />);

      const scaleSlider = screen.getByLabelText(/scale/i);
      await userEvent.clear(scaleSlider);
      await userEvent.type(scaleSlider, '1.5');

      expect(onScaleChange).toHaveBeenCalledWith(1.5);
    });

    it('calls onAspectRatioToggle when aspect ratio button is clicked', async () => {
      const onAspectRatioToggle = vi.fn();
      render(<CropControls {...defaultProps} onAspectRatioToggle={onAspectRatioToggle} />);

      const aspectButton = screen.getByText(/📎/);
      await userEvent.click(aspectButton);

      expect(onAspectRatioToggle).toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('handles arrow key navigation', async () => {
      const onCropChange = vi.fn();
      render(<CropControls {...defaultProps} onCropChange={onCropChange} />);

      const canvas = screen.getByLabelText(/crop selection area/i);
      canvas.focus();

      // Test arrow keys
      await userEvent.keyboard('{ArrowRight}');
      expect(onCropChange).toHaveBeenCalledWith({
        ...defaultCropRegion,
        x: 101,
      });

      await userEvent.keyboard('{ArrowLeft}');
      expect(onCropChange).toHaveBeenCalledWith({
        ...defaultCropRegion,
        x: 99,
      });

      await userEvent.keyboard('{ArrowDown}');
      expect(onCropChange).toHaveBeenCalledWith({
        ...defaultCropRegion,
        y: 101,
      });

      await userEvent.keyboard('{ArrowUp}');
      expect(onCropChange).toHaveBeenCalledWith({
        ...defaultCropRegion,
        y: 99,
      });
    });

    it('handles shift+arrow keys for larger steps', async () => {
      const onCropChange = vi.fn();
      render(<CropControls {...defaultProps} onCropChange={onCropChange} />);

      const canvas = screen.getByLabelText(/crop selection area/i);
      canvas.focus();

      await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
      expect(onCropChange).toHaveBeenCalledWith({
        ...defaultCropRegion,
        x: 110, // 10 pixel step with shift
      });
    });

    it('handles zoom keyboard shortcuts', async () => {
      const onScaleChange = vi.fn();
      render(<CropControls {...defaultProps} onScaleChange={onScaleChange} />);

      const canvas = screen.getByLabelText(/crop selection area/i);
      canvas.focus();

      await userEvent.keyboard('{+}');
      expect(onScaleChange).toHaveBeenCalledWith(1.05);

      await userEvent.keyboard('{-}');
      expect(onScaleChange).toHaveBeenCalledWith(0.95);
    });

    it('handles reset and lock shortcuts', async () => {
      const onCropChange = vi.fn();
      const onAspectRatioToggle = vi.fn();
      render(
        <CropControls 
          {...defaultProps} 
          onCropChange={onCropChange}
          onAspectRatioToggle={onAspectRatioToggle}
        />
      );

      const canvas = screen.getByLabelText(/crop selection area/i);
      canvas.focus();

      await userEvent.keyboard('r');
      expect(onCropChange).toHaveBeenCalled();

      await userEvent.keyboard('l');
      expect(onAspectRatioToggle).toHaveBeenCalled();
    });
  });

  describe('Mouse Interactions', () => {
    it('handles mouse down and up events', () => {
      const onCropChange = vi.fn();
      render(<CropControls {...defaultProps} onCropChange={onCropChange} />);

      const canvas = screen.getByLabelText(/crop selection area/i);

      // Simulate mouse down inside crop area
      fireEvent.mouseDown(canvas, {
        clientX: 200, // Inside crop area (100 + 200/2)
        clientY: 175, // Inside crop area (100 + 150/2)
      });

      // Simulate mouse move
      fireEvent.mouseMove(canvas, {
        clientX: 220,
        clientY: 185,
      });

      // Should trigger crop change due to drag
      expect(onCropChange).toHaveBeenCalled();

      // Mouse up should reset drag state
      fireEvent.mouseUp(canvas);
    });

    it('handles wheel zoom', () => {
      const onScaleChange = vi.fn();
      render(<CropControls {...defaultProps} onScaleChange={onScaleChange} />);

      const canvas = screen.getByLabelText(/crop selection area/i);

      // Zoom in
      fireEvent.wheel(canvas, { deltaY: -100 });
      expect(onScaleChange).toHaveBeenCalledWith(1.1);

      // Zoom out
      fireEvent.wheel(canvas, { deltaY: 100 });
      expect(onScaleChange).toHaveBeenCalledWith(0.9);
    });
  });

  describe('Touch Interactions', () => {
    it('handles single touch for dragging', () => {
      const onCropChange = vi.fn();
      render(<CropControls {...defaultProps} onCropChange={onCropChange} />);

      const canvas = screen.getByLabelText(/crop selection area/i);

      // Single touch start
      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 200, clientY: 175 }],
      });

      // Touch move
      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 220, clientY: 185 }],
      });

      expect(onCropChange).toHaveBeenCalled();

      // Touch end
      fireEvent.touchEnd(canvas, { touches: [] });
    });

    it('handles pinch zoom with two touches', () => {
      const onScaleChange = vi.fn();
      render(<CropControls {...defaultProps} onScaleChange={onScaleChange} />);

      const canvas = screen.getByLabelText(/crop selection area/i);

      // Two finger touch start
      fireEvent.touchStart(canvas, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 },
        ],
      });

      // Pinch out (zoom in)
      fireEvent.touchMove(canvas, {
        touches: [
          { clientX: 80, clientY: 80 },
          { clientX: 220, clientY: 220 },
        ],
      });

      expect(onScaleChange).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and attributes', () => {
      render(<CropControls {...defaultProps} />);

      const canvas = screen.getByLabelText(/crop selection area/i);
      expect(canvas).toHaveAttribute('role', 'img');
      expect(canvas).toHaveAttribute('tabIndex', '0');
      expect(canvas).toHaveAttribute('aria-describedby', 'crop-instructions');

      const aspectButton = screen.getByText(/📎/);
      expect(aspectButton).toHaveAttribute('aria-pressed', 'false');

      const instructions = screen.getByText(/use arrow keys/i);
      expect(instructions).toHaveClass('sr-only');
    });

    it('updates ARIA labels when crop changes', () => {
      const newCrop = { ...defaultCropRegion, x: 150, y: 120 };
      const { rerender } = render(<CropControls {...defaultProps} />);

      rerender(<CropControls {...defaultProps} cropRegion={newCrop} />);

      const canvas = screen.getByLabelText(/crop selection area at position 150, 120/i);
      expect(canvas).toBeInTheDocument();
    });

    it('shows correct aria-pressed state for aspect ratio button', () => {
      const { rerender } = render(<CropControls {...defaultProps} />);

      let aspectButton = screen.getByText(/📎/);
      expect(aspectButton).toHaveAttribute('aria-pressed', 'false');

      rerender(<CropControls {...defaultProps} aspectRatioLocked={true} />);
      
      aspectButton = screen.getByText(/📎/);
      expect(aspectButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Error Handling', () => {
    it('handles invalid crop regions gracefully', async () => {
      const onCropChange = vi.fn();
      const invalidCrop = { ...defaultCropRegion, x: -100, y: -100 };

      render(<CropControls {...defaultProps} cropRegion={invalidCrop} onCropChange={onCropChange} />);

      // Component should still render without errors
      expect(screen.getByText('Adjust Image Crop')).toBeInTheDocument();
    });

    it('constrains crop to image bounds', async () => {
      const onCropChange = vi.fn();
      render(<CropControls {...defaultProps} onCropChange={onCropChange} />);

      const canvas = screen.getByLabelText(/crop selection area/i);
      canvas.focus();

      // Try to move crop beyond image bounds
      for (let i = 0; i < 1000; i++) {
        await userEvent.keyboard('{ArrowRight}');
      }

      // Should be constrained to image bounds
      const lastCall = onCropChange.mock.calls[onCropChange.mock.calls.length - 1][0];
      expect(lastCall.x + lastCall.width).toBeLessThanOrEqual(mockImage.naturalWidth);
    });
  });

  describe('Performance', () => {
    it('debounces rapid updates during dragging', async () => {
      const onCropChange = vi.fn();
      render(<CropControls {...defaultProps} onCropChange={onCropChange} />);

      const canvas = screen.getByLabelText(/crop selection area/i);

      // Simulate rapid mouse movements
      fireEvent.mouseDown(canvas, { clientX: 200, clientY: 175 });

      for (let i = 0; i < 10; i++) {
        fireEvent.mouseMove(canvas, { clientX: 200 + i, clientY: 175 + i });
      }

      fireEvent.mouseUp(canvas);

      // Should not call onCropChange for every single movement
      expect(onCropChange.mock.calls.length).toBeLessThan(10);
    });

    it('does not update when crop values are the same', () => {
      const onCropChange = vi.fn();
      render(<CropControls {...defaultProps} onCropChange={onCropChange} />);

      const canvas = screen.getByLabelText(/crop selection area/i);
      canvas.focus();

      // Move right then left to return to original position
      userEvent.keyboard('{ArrowRight}{ArrowLeft}');

      // Should minimize redundant calls
      expect(onCropChange.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });
});