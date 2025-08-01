import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';

describe('App', () => {
  it('renders the main layout', () => {
    render(<App />);

    // Check if the header is rendered
    expect(screen.getByText('Parametric 3D Bookmark Generator')).toBeInTheDocument();

    // Check if main sections are present
    expect(screen.getByText('Upload Image')).toBeInTheDocument();
    expect(screen.getByText('Parameters')).toBeInTheDocument();
    expect(screen.getByText('3D Preview')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('shows placeholder when no image is uploaded', () => {
    render(<App />);

    expect(screen.getByText('Upload an image to see preview')).toBeInTheDocument();
  });
});
