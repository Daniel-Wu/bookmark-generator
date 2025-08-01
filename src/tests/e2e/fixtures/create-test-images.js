/**
 * Script to create test images for E2E testing
 */
const fs = require('fs');
const path = require('path');

function createTestImage(width, height, filename, colors = ['#FF0000', '#00FF00', '#0000FF']) {
  // Create a simple canvas-like structure for generating test images
  const canvas = {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4)
  };

  // Fill with pattern using provided colors
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const colorIndex = Math.floor((x / width) * colors.length);
      const color = colors[colorIndex];
      
      // Parse hex color
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      
      canvas.data[i] = r;     // Red
      canvas.data[i + 1] = g; // Green
      canvas.data[i + 2] = b; // Blue
      canvas.data[i + 3] = 255; // Alpha
    }
  }

  // Convert to PNG data URL (simplified - in real implementation would use proper PNG encoding)
  const dataUrl = `data:image/png;base64,${Buffer.from(canvas.data).toString('base64')}`;
  
  console.log(`Created test image: ${filename} (${width}x${height})`);
  return dataUrl;
}

// We'll generate actual test images using a simpler approach
console.log('Test image generation script - run this to create test fixtures if needed');

module.exports = { createTestImage };