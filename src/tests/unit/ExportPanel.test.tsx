import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExportPanel } from '../../components/ExportPanel/ExportPanel';
import { colorToHex } from '../../modules/image/colorUtils';
import type { ExportPanelProps, BookmarkGeometry, ExportState, ExportQualitySettings } from '../../types';
import * as THREE from 'three';

// Mock FileUtils
vi.mock('../../modules/export/fileDownload', () => ({
  FileUtils: {
    formatFileSize: vi.fn((bytes: number) => `${Math.round(bytes / 1024)}KB`),
  },
}));

describe('ExportPanel', () => {
  const redColor = { r: 255, g: 0, b: 0, a: 1 };
  const greenColor = { r: 0, g: 255, b: 0, a: 1 };
  
  const mockGeometry: BookmarkGeometry = {
    layers: [
      {
        id: 1,
        color: { ...redColor, hex: `#${redColor.r.toString(16).padStart(2, '0')}${redColor.g.toString(16).padStart(2, '0')}${redColor.b.toString(16).padStart(2, '0')}` },
        height: 1.0,
        geometry: new THREE.BufferGeometry(),
        regions: [],
        visible: true,
        opacity: 1.0,
        triangleCount: 0
      },
      {
        id: 2,
        color: { ...greenColor, hex: `#${greenColor.r.toString(16).padStart(2, '0')}${greenColor.g.toString(16).padStart(2, '0')}${greenColor.b.toString(16).padStart(2, '0')}` },
        height: 2.0,
        geometry: new THREE.BufferGeometry(),
        regions: [],
        visible: true,
        opacity: 1.0,
        triangleCount: 0
      },
    ],
    boundingBox: new THREE.Box3(
      new THREE.Vector3(-10, -10, 0),
      new THREE.Vector3(10, 10, 3)
    ),
    vertexCount: 1000,
    faceCount: 500,
    totalTriangles: 500,
    estimatedFileSize: 1024 * 50, // 50KB
  };

  const defaultExportState: ExportState = {
    format: 'stl',
    isExporting: false,
    progress: 0,
    stage: 'idle',
    stageProgress: 0,
    canCancel: false,
    lastExportedFile: null,
    warnings: [],
  };

  const defaultProps: ExportPanelProps = {
    geometry: mockGeometry,
    onExport: vi.fn(),
    exportState: defaultExportState,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders export panel with default state', () => {
    render(<ExportPanel {...defaultProps} />);
    
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Export Format')).toBeInTheDocument();
    expect(screen.getByText('STL')).toBeInTheDocument();
    expect(screen.getByText('3MF')).toBeInTheDocument();
  });

  it('displays format information correctly', () => {
    render(<ExportPanel {...defaultProps} />);
    
    // STL format info
    expect(screen.getByText('Standard format for single-color 3D printing')).toBeInTheDocument();
    expect(screen.getByText('99% of 3D printers')).toBeInTheDocument();
    
    // Check for feature tags
    expect(screen.getByText('Single color')).toBeInTheDocument();
    expect(screen.getByText('Widely supported')).toBeInTheDocument();
    expect(screen.getByText('Small file size')).toBeInTheDocument();
  });

  it('allows format selection', async () => {
    const user = userEvent.setup();
    render(<ExportPanel {...defaultProps} />);
    
    // Initially STL should be selected
    const stlRadio = screen.getByRole('radio', { name: /stl/i });
    const threeMfRadio = screen.getByRole('radio', { name: /3mf/i });
    
    expect(stlRadio).toBeChecked();
    expect(threeMfRadio).not.toBeChecked();
    
    // Select 3MF
    await user.click(threeMfRadio);
    
    expect(threeMfRadio).toBeChecked();
    expect(stlRadio).not.toBeChecked();
  });

  it('displays quality settings', () => {
    render(<ExportPanel {...defaultProps} />);
    
    expect(screen.getByText('Export Quality')).toBeInTheDocument();
    expect(screen.getByText('High Quality')).toBeInTheDocument();
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('Fast Export')).toBeInTheDocument();
  });

  it('shows advanced settings when toggled', async () => {
    const user = userEvent.setup();
    render(<ExportPanel {...defaultProps} />);
    
    // Advanced settings should not be visible initially
    expect(screen.queryByText('Advanced Options')).not.toBeInTheDocument();
    
    // Click show advanced
    await user.click(screen.getByText('Show Advanced'));
    
    // Advanced settings should now be visible
    expect(screen.getByText('Advanced Options')).toBeInTheDocument();
    expect(screen.getByText('Optimize geometry for printing')).toBeInTheDocument();
  });

  it('shows 3MF-specific advanced options', async () => {
    const user = userEvent.setup();
    render(<ExportPanel {...defaultProps} />);
    
    // Select 3MF format
    await user.click(screen.getByRole('radio', { name: /3mf/i }));
    
    // Show advanced settings
    await user.click(screen.getByText('Show Advanced'));
    
    // 3MF-specific options should be visible
    expect(screen.getByText('Include color information')).toBeInTheDocument();
    expect(screen.getByText('Include metadata')).toBeInTheDocument();
    expect(screen.getByText(/Compression Level:/)).toBeInTheDocument();
  });

  it('calls onExport with correct parameters', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    
    render(<ExportPanel {...defaultProps} onExport={onExport} />);
    
    // Click export button
    await user.click(screen.getByRole('button', { name: /export stl/i }));
    
    expect(onExport).toHaveBeenCalledWith('stl', expect.objectContaining({
      level: 'medium',
      optimizeGeometry: true,
      includeColors: false, // STL doesn't support colors
      includeMetadata: true,
      compressionLevel: 6,
    }));
  });

  it('disables export button when geometry is null', () => {
    render(<ExportPanel {...defaultProps} geometry={null} />);
    
    const exportButton = screen.getByRole('button', { name: /export stl/i });
    expect(exportButton).toBeDisabled();
  });

  it('disables export button when exporting', () => {
    const exportingState: ExportState = {
      ...defaultExportState,
      isExporting: true,
      stage: 'processing',
    };
    
    render(<ExportPanel {...defaultProps} exportState={exportingState} />);
    
    const exportButton = screen.getByRole('button');
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveTextContent('Exporting...');
  });

  it('displays validation errors', () => {
    const validation = {
      isValid: false,
      errors: ['Geometry is too complex', 'Missing vertices'],
      warnings: ['Consider reducing quality'],
      fileSize: 1024 * 1024,
    };
    
    render(<ExportPanel {...defaultProps} validation={validation} />);
    
    expect(screen.getByText('Export Issues Found')).toBeInTheDocument();
    expect(screen.getByText('• Geometry is too complex')).toBeInTheDocument();
    expect(screen.getByText('• Missing vertices')).toBeInTheDocument();
    
    // Should also show warnings
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('• Consider reducing quality')).toBeInTheDocument();
  });

  it('displays validation success state', () => {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      fileSize: 1024 * 1024,
    };
    
    render(<ExportPanel {...defaultProps} validation={validation} />);
    
    expect(screen.getByText('Ready for export')).toBeInTheDocument();
  });

  it('displays print preview when provided', () => {
    const printPreview = {
      estimatedPrintTime: 120, // minutes
      materialUsage: 15.5, // grams
      supportRequired: true,
      layerHeight: 0.2, // mm
      infillPercentage: 20,
      printSpeed: 50, // mm/s
    };
    
    render(<ExportPanel {...defaultProps} printPreview={printPreview} />);
    
    expect(screen.getByText('Print Preview')).toBeInTheDocument();
    expect(screen.getByText('120min')).toBeInTheDocument();
    expect(screen.getByText('15.5g')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('0.2mm')).toBeInTheDocument();
  });

  it('shows progress indicator when exporting', () => {
    const exportingState: ExportState = {
      ...defaultExportState,
      isExporting: true,
      stage: 'processing',
      progress: 0.5,
      stageProgress: 0.75,
    };
    
    render(<ExportPanel {...defaultProps} exportState={exportingState} />);
    
    // Progress indicator component should be rendered
    // This assumes ProgressIndicator is properly mocked or renders correctly
    expect(screen.getByText('Processing layers')).toBeInTheDocument();
  });

  it('displays export success state', () => {
    const completedState: ExportState = {
      ...defaultExportState,
      stage: 'complete',
      lastExportedFile: new Blob(['test'], { type: 'application/sla' }),
    };
    
    render(<ExportPanel {...defaultProps} exportState={completedState} />);
    
    expect(screen.getByText('Export completed successfully')).toBeInTheDocument();
    expect(screen.getByText('File is ready for download')).toBeInTheDocument();
  });

  it('displays export warnings', () => {
    const warningState: ExportState = {
      ...defaultExportState,
      warnings: ['File size is large', 'High complexity detected'],
    };
    
    render(<ExportPanel {...defaultProps} exportState={warningState} />);
    
    expect(screen.getByText('Export Warnings')).toBeInTheDocument();
    expect(screen.getByText('• File size is large')).toBeInTheDocument();
    expect(screen.getByText('• High complexity detected')).toBeInTheDocument();
  });

  it('displays file information', () => {
    render(<ExportPanel {...defaultProps} />);
    
    expect(screen.getByText('Layers: 2')).toBeInTheDocument();
    expect(screen.getByText('Vertices: 1,000')).toBeInTheDocument();
    expect(screen.getByText('Faces: 500')).toBeInTheDocument();
  });

  it('handles quality setting changes', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    
    render(<ExportPanel {...defaultProps} onExport={onExport} />);
    
    // Select high quality
    await user.click(screen.getByRole('radio', { name: /high quality/i }));
    
    // Export with high quality
    await user.click(screen.getByRole('button', { name: /export stl/i }));
    
    expect(onExport).toHaveBeenCalledWith('stl', expect.objectContaining({
      level: 'high',
    }));
  });

  it('handles advanced setting toggles', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    
    render(<ExportPanel {...defaultProps} onExport={onExport} />);
    
    // Show advanced settings
    await user.click(screen.getByText('Show Advanced'));
    
    // Toggle geometry optimization off
    const optimizeCheckbox = screen.getByRole('checkbox', { name: /optimize geometry/i });
    await user.click(optimizeCheckbox);
    
    // Export with modified settings
    await user.click(screen.getByRole('button', { name: /export stl/i }));
    
    expect(onExport).toHaveBeenCalledWith('stl', expect.objectContaining({
      optimizeGeometry: false,
    }));
  });

  it('handles compression level changes for 3MF', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    
    render(<ExportPanel {...defaultProps} onExport={onExport} />);
    
    // Select 3MF format
    await user.click(screen.getByRole('radio', { name: /3mf/i }));
    
    // Show advanced settings
    await user.click(screen.getByText('Show Advanced'));
    
    // Change compression level
    const compressionSlider = screen.getByRole('slider');
    fireEvent.change(compressionSlider, { target: { value: '9' } });
    
    // Export with modified settings
    await user.click(screen.getByRole('button', { name: /export 3mf/i }));
    
    expect(onExport).toHaveBeenCalledWith('3mf', expect.objectContaining({
      compressionLevel: 9,
    }));
  });

  it('calls onCancel when provided', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    
    const exportingState: ExportState = {
      ...defaultExportState,
      isExporting: true,
      stage: 'processing',
      canCancel: true,
    };
    
    render(
      <ExportPanel 
        {...defaultProps} 
        exportState={exportingState} 
        onCancel={onCancel} 
      />
    );
    
    // Find and click cancel button in progress indicator
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    
    expect(onCancel).toHaveBeenCalled();
  });

  it('estimates file size correctly', () => {
    render(<ExportPanel {...defaultProps} />);
    
    // Should display estimated file size
    expect(screen.getByText(/KB estimated/)).toBeInTheDocument();
  });

  it('updates format info when format changes', async () => {
    const user = userEvent.setup();
    render(<ExportPanel {...defaultProps} />);
    
    // Initially shows STL info
    expect(screen.getByText('Standard format for single-color 3D printing')).toBeInTheDocument();
    
    // Switch to 3MF
    await user.click(screen.getByRole('radio', { name: /3mf/i }));
    
    // Should now show 3MF info
    expect(screen.getByText('Modern multi-material format with color support')).toBeInTheDocument();
    expect(screen.getByText('Multi-color support')).toBeInTheDocument();
  });

  it('disables controls when exporting', () => {
    const exportingState: ExportState = {
      ...defaultExportState,
      isExporting: true,
      stage: 'processing',
    };
    
    render(<ExportPanel {...defaultProps} exportState={exportingState} />);
    
    // Format selection should be disabled
    const stlRadio = screen.getByRole('radio', { name: /stl/i });
    const threeMfRadio = screen.getByRole('radio', { name: /3mf/i });
    
    expect(stlRadio).toBeDisabled();
    expect(threeMfRadio).toBeDisabled();
    
    // Quality selection should be disabled
    const highQualityRadio = screen.getByRole('radio', { name: /high quality/i });
    expect(highQualityRadio).toBeDisabled();
  });
});