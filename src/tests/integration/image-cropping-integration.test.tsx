import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUpload } from '../../components/ImageUpload/ImageUpload';
import { cleanup } from '../../utils/canvasOptimization';

// Mock file for testing
const createMockFile = (name: string, type: string, size: number): File => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Mock image for testing
const createMockImage = (width: number, height: number): HTMLImageElement => {
  const img = new Image();
  Object.defineProperty(img, 'naturalWidth', { value: width });
  Object.defineProperty(img, 'naturalHeight', { value: height });
  Object.defineProperty(img, 'src', { value: 'mock-image-url' });
  return img;
};

// Mock canvas context
const mockCanvasContext = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  setLineDash: vi.fn(),
  scale: vi.fn(),
  getImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(400 * 300 * 4),
    width: 400,
    height: 300,
  })),
};

describe('Image Cropping Integration', () => {
  beforeEach(() => {
    // Mock HTMLCanvasElement
    const mockCanvas = {
      getContext: vi.fn(() => mockCanvasContext),
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
      })),
      width: 400,
      height: 300,
      style: {},
    };

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas as any;
      }
      return document.createElement(tagName);
    });

    // Mock Image constructor
    global.Image = vi.fn(() => createMockImage(800, 600)) as any;

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'mock-object-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        read: vi.fn(() => Promise.resolve([])),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe('Full Upload and Crop Workflow', () => {
    it('handles complete image upload and cropping workflow', async () => {
      const onImageUploaded = vi.fn();
      const mockFile = createMockFile('test.png', 'image/png', 1024 * 1024); // 1MB

      render(<ImageUpload onImageUploaded={onImageUploaded} />);

      // Initially shows upload interface
      expect(screen.getByText('Upload Image')).toBeInTheDocument();
      expect(screen.getByText('Drag & Drop or Click to Browse')).toBeInTheDocument();

      // Upload a file
      const fileInput = screen.getByRole('button', { name: /upload image/i });
      
      // Simulate file selection
      const dropZone = screen.getByRole('button', { name: /upload image/i });
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Wait for image to load and switch to preview mode
      await waitFor(() => {
        expect(screen.getByText('Adjust Image Crop')).toBeInTheDocument();
      });

      // Should show crop controls
      expect(screen.getByText('🔄 Reset')).toBeInTheDocument();
      expect(screen.getByText('↶ 90°')).toBeInTheDocument();
      expect(screen.getByText('↷ 90°')).toBeInTheDocument();
      expect(screen.getByLabelText(/scale/i)).toBeInTheDocument();
      expect(screen.getByText(/📎/)).toBeInTheDocument();

      // Should show action buttons
      expect(screen.getByText('↶ Undo')).toBeInTheDocument();
      expect(screen.getByText('↷ Redo')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('✅ Apply Crop')).toBeInTheDocument();
    });

    it('validates file size and type', async () => {
      const onImageUploaded = vi.fn();
      
      render(<ImageUpload onImageUploaded={onImageUploaded} maxSize={1024} />); // 1KB limit

      // Try to upload a file that's too large
      const largeFile = createMockFile('large.png', 'image/png', 2048); // 2KB
      
      const dropZone = screen.getByRole('button', { name: /upload image/i });
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [largeFile],
        },
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Upload Error')).toBeInTheDocument();
        expect(screen.getByText(/exceeds maximum allowed size/)).toBeInTheDocument();
      });

      // Should not proceed to crop mode
      expect(screen.queryByText('Adjust Image Crop')).not.toBeInTheDocument();
    });

    it('handles invalid file types', async () => {
      const onImageUploaded = vi.fn();
      
      render(<ImageUpload onImageUploaded={onImageUploaded} />);

      // Try to upload a non-image file
      const textFile = createMockFile('document.txt', 'text/plain', 1024);
      
      const dropZone = screen.getByRole('button', { name: /upload image/i });
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [textFile],
        },
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Upload Error')).toBeInTheDocument();
        expect(screen.getByText(/is not supported/)).toBeInTheDocument();
      });
    });
  });

  describe('Crop Controls Integration', () => {
    const setupCropTest = async () => {
      const onImageUploaded = vi.fn();
      const mockFile = createMockFile('test.png', 'image/png', 1024 * 1024);

      const { container } = render(<ImageUpload onImageUploaded={onImageUploaded} />);

      // Upload file
      const dropZone = screen.getByRole('button', { name: /upload image/i });
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Wait for crop interface
      await waitFor(() => {
        expect(screen.getByText('Adjust Image Crop')).toBeInTheDocument();
      });

      return { container, onImageUploaded };
    };

    it('allows interactive cropping with mouse', async () => {
      await setupCropTest();

      const canvas = screen.getByLabelText(/crop selection area/i);

      // Simulate mouse drag on crop area
      fireEvent.mouseDown(canvas, { clientX: 200, clientY: 150 });
      fireEvent.mouseMove(canvas, { clientX: 220, clientY: 170 });
      fireEvent.mouseUp(canvas);

      // Canvas drawing methods should be called
      expect(mockCanvasContext.clearRect).toHaveBeenCalled();
      expect(mockCanvasContext.drawImage).toHaveBeenCalled();
    });

    it('supports keyboard navigation', async () => {
      await setupCropTest();

      const canvas = screen.getByLabelText(/crop selection area/i);
      canvas.focus();

      // Test arrow key navigation
      await userEvent.keyboard('{ArrowRight}');
      await userEvent.keyboard('{ArrowDown}');

      // Should update crop position
      expect(mockCanvasContext.clearRect).toHaveBeenCalled();
    });

    it('handles scale adjustments', async () => {
      await setupCropTest();

      const scaleSlider = screen.getByLabelText(/scale/i);
      
      // Change scale
      fireEvent.change(scaleSlider, { target: { value: '1.5' } });

      // Should show updated percentage
      await waitFor(() => {
        expect(screen.getByText('150%')).toBeInTheDocument();
      });
    });

    it('toggles aspect ratio lock', async () => {
      await setupCropTest();

      const aspectButton = screen.getByText(/📎/);
      
      // Initially unlocked
      expect(screen.getByText('📎 Free')).toBeInTheDocument();

      // Click to lock
      await userEvent.click(aspectButton);

      // Should show locked state
      expect(screen.getByText('📎 Locked')).toBeInTheDocument();
    });

    it('handles rotation controls', async () => {
      await setupCropTest();

      const rotateClockwise = screen.getByText('↷ 90°');
      const rotateCounterclockwise = screen.getByText('↶ 90°');

      // Test rotation
      await userEvent.click(rotateClockwise);
      await userEvent.click(rotateCounterclockwise);

      // Canvas should be redrawn
      expect(mockCanvasContext.clearRect).toHaveBeenCalled();
    });

    it('supports undo/redo functionality', async () => {
      await setupCropTest();

      const resetButton = screen.getByText('🔄 Reset');
      const undoButton = screen.getByText('↶ Undo');
      const redoButton = screen.getByText('↷ Redo');

      // Initially undo/redo should be disabled
      expect(undoButton).toBeDisabled();
      expect(redoButton).toBeDisabled();

      // Make a change
      await userEvent.click(resetButton);

      // Undo should now be available
      await waitFor(() => {
        expect(undoButton).not.toBeDisabled();
      });

      // Test undo
      await userEvent.click(undoButton);

      // Redo should now be available
      await waitFor(() => {
        expect(redoButton).not.toBeDisabled();
      });
    });
  });

  describe('Apply Crop Integration', () => {
    it('applies crop and calls onImageUploaded', async () => {
      const onImageUploaded = vi.fn();
      const mockFile = createMockFile('test.png', 'image/png', 1024 * 1024);

      render(<ImageUpload onImageUploaded={onImageUploaded} />);

      // Upload file
      const dropZone = screen.getByRole('button', { name: /upload image/i });
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Wait for crop interface
      await waitFor(() => {
        expect(screen.getByText('Adjust Image Crop')).toBeInTheDocument();
      });

      // Apply crop
      const applyCropButton = screen.getByText('✅ Apply Crop');
      await userEvent.click(applyCropButton);

      // Should call onImageUploaded
      await waitFor(() => {
        expect(onImageUploaded).toHaveBeenCalledWith(mockFile);
      });

      // Should return to upload interface
      await waitFor(() => {
        expect(screen.getByText('Upload Image')).toBeInTheDocument();
        expect(screen.queryByText('Adjust Image Crop')).not.toBeInTheDocument();
      });
    });

    it('handles cancel action', async () => {
      const onImageUploaded = vi.fn();
      const mockFile = createMockFile('test.png', 'image/png', 1024 * 1024);

      render(<ImageUpload onImageUploaded={onImageUploaded} />);

      // Upload file
      const dropZone = screen.getByRole('button', { name: /upload image/i });
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Wait for crop interface
      await waitFor(() => {
        expect(screen.getByText('Adjust Image Crop')).toBeInTheDocument();
      });

      // Cancel
      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);

      // Should return to upload interface without calling onImageUploaded
      await waitFor(() => {
        expect(screen.getByText('Upload Image')).toBeInTheDocument();
        expect(screen.queryByText('Adjust Image Crop')).not.toBeInTheDocument();
      });

      expect(onImageUploaded).not.toHaveBeenCalled();
    });
  });

  describe('Touch Support Integration', () => {
    it('handles touch interactions on mobile', async () => {
      const onImageUploaded = vi.fn();
      const mockFile = createMockFile('test.png', 'image/png', 1024 * 1024);

      render(<ImageUpload onImageUploaded={onImageUploaded} />);

      // Upload file
      const dropZone = screen.getByRole('button', { name: /upload image/i });
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Wait for crop interface
      await waitFor(() => {
        expect(screen.getByText('Adjust Image Crop')).toBeInTheDocument();
      });

      const canvas = screen.getByLabelText(/crop selection area/i);

      // Simulate touch events
      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 200, clientY: 150 }],
      });

      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 220, clientY: 170 }],
      });

      fireEvent.touchEnd(canvas, { touches: [] });

      // Canvas should be updated
      expect(mockCanvasContext.clearRect).toHaveBeenCalled();
    });

    it('handles pinch-to-zoom gestures', async () => {
      const onImageUploaded = vi.fn();
      const mockFile = createMockFile('test.png', 'image/png', 1024 * 1024);

      render(<ImageUpload onImageUploaded={onImageUploaded} />);

      // Setup crop interface
      const dropZone = screen.getByRole('button', { name: /upload image/i });
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Adjust Image Crop')).toBeInTheDocument();
      });

      const canvas = screen.getByLabelText(/crop selection area/i);

      // Simulate pinch gesture
      fireEvent.touchStart(canvas, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 },
        ],
      });

      fireEvent.touchMove(canvas, {
        touches: [
          { clientX: 80, clientY: 80 },
          { clientX: 220, clientY: 220 },
        ],
      });

      fireEvent.touchEnd(canvas, { touches: [] });

      // Should update scale
      expect(mockCanvasContext.clearRect).toHaveBeenCalled();
    });
  });

  describe('Performance and Memory Management', () => {
    it('cleans up resources properly', async () => {
      const onImageUploaded = vi.fn();
      const mockFile = createMockFile('test.png', 'image/png', 1024 * 1024);

      const { unmount } = render(<ImageUpload onImageUploaded={onImageUploaded} />);

      // Upload file and get to crop interface
      const dropZone = screen.getByRole('button', { name: /upload image/i });
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Adjust Image Crop')).toBeInTheDocument();
      });

      // Unmount component
      unmount();

      // URL should be revoked
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('handles large images efficiently', async () => {
      const onImageUploaded = vi.fn();
      
      // Create a large image mock
      global.Image = vi.fn(() => createMockImage(4000, 3000)) as any;
      
      const mockFile = createMockFile('large.png', 'image/png', 5 * 1024 * 1024); // 5MB

      render(<ImageUpload onImageUploaded={onImageUploaded} />);

      const dropZone = screen.getByRole('button', { name: /upload image/i });
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Should still load successfully
      await waitFor(() => {
        expect(screen.getByText('Adjust Image Crop')).toBeInTheDocument();
      });

      // Canvas operations should still work
      const canvas = screen.getByLabelText(/crop selection area/i);
      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });

      expect(mockCanvasContext.drawImage).toHaveBeenCalled();
    });
  });
});