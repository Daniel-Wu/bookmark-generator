/**
 * Color processing utilities for image quantization
 * 
 * Provides functions for color manipulation, distance calculation,
 * and luminance computation used in the K-means algorithm.
 */

import type { Color } from '../../types';

// ========================
// Color Creation & Validation
// ========================

/**
 * Create a Color object with validation
 */
export function createColor(r: number, g: number, b: number, a: number = 1): Color {
  const red = Math.max(0, Math.min(255, Math.round(r)));
  const green = Math.max(0, Math.min(255, Math.round(g)));
  const blue = Math.max(0, Math.min(255, Math.round(b)));
  const alpha = Math.max(0, Math.min(1, a));
  
  return {
    r: red,
    g: green,
    b: blue,
    a: alpha,
    hex: `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`
  };
}

/**
 * Create color from ImageData pixel at index
 */
export function colorFromImageData(data: Uint8ClampedArray, index: number): Color {
  return createColor(
    data[index],
    data[index + 1],
    data[index + 2],
    data[index + 3] / 255
  );
}

/**
 * Convert Color to hex string
 */
export function colorToHex(color: Color): string {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Convert hex string to Color
 */
export function hexToColor(hex: string, alpha: number = 1): Color {
  const cleanHex = hex.replace('#', '');
  
  if (cleanHex.length !== 6) {
    throw new Error('Invalid hex color format');
  }
  
  return createColor(
    parseInt(cleanHex.substr(0, 2), 16),
    parseInt(cleanHex.substr(2, 2), 16),
    parseInt(cleanHex.substr(4, 2), 16),
    alpha
  );
}

/**
 * Check if two colors are equal
 */
export function colorsEqual(a: Color, b: Color, tolerance: number = 0): boolean {
  return (
    Math.abs(a.r - b.r) <= tolerance &&
    Math.abs(a.g - b.g) <= tolerance &&
    Math.abs(a.b - b.b) <= tolerance &&
    Math.abs((a.a ?? 1) - (b.a ?? 1)) <= tolerance / 255
  );
}

// ========================
// Distance Calculations
// ========================

/**
 * Calculate Euclidean distance between two colors in RGB space
 * Used for K-means clustering assignments
 */
export function euclideanDistance(color1: Color, color2: Color): number {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Calculate weighted Euclidean distance with alpha consideration
 */
export function euclideanDistanceWithAlpha(color1: Color, color2: Color): number {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  const da = ((color1.a ?? 1) - (color2.a ?? 1)) * 255; // Scale alpha to 0-255 range
  
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
}

/**
 * Calculate Delta E (perceptual color difference)
 * More accurate for human perception but more computationally expensive
 */
export function deltaE(color1: Color, color2: Color): number {
  // Convert RGB to LAB color space for perceptual distance
  const lab1 = rgbToLab(color1);
  const lab2 = rgbToLab(color2);
  
  const deltaL = lab1.l - lab2.l;
  const deltaA = lab1.a - lab2.a;
  const deltaB = lab1.b - lab2.b;
  
  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

// ========================
// Luminance Calculations
// ========================

/**
 * Calculate perceived luminance using ITU-R BT.709 standard
 * Formula: 0.299*R + 0.587*G + 0.114*B
 */
export function calculateLuminance(color: Color): number {
  return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

/**
 * Calculate relative luminance (0-1 range)
 */
export function calculateRelativeLuminance(color: Color): number {
  // Convert to linear RGB
  const linearR = gammaCorrect(color.r / 255);
  const linearG = gammaCorrect(color.g / 255);
  const linearB = gammaCorrect(color.b / 255);
  
  // ITU-R BT.709 coefficients
  return 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB;
}

/**
 * Apply gamma correction for luminance calculation
 */
function gammaCorrect(value: number): number {
  if (value <= 0.03928) {
    return value / 12.92;
  } else {
    return Math.pow((value + 0.055) / 1.055, 2.4);
  }
}

/**
 * Calculate HSL lightness
 */
export function calculateLightness(color: Color): number {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  return (max + min) / 2;
}

// ========================
// Color Space Conversions
// ========================

/**
 * Convert RGB to HSL color space
 */
export function rgbToHsl(color: Color): { h: number; s: number; l: number } {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
    
    switch (max) {
      case r:
        h = (g - b) / diff + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / diff + 2;
        break;
      case b:
        h = (r - g) / diff + 4;
        break;
    }
    h /= 6;
  }
  
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB color space
 */
export function hslToRgb(h: number, s: number, l: number, a: number = 1): Color {
  h /= 360;
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h < 1/6) {
    r = c; g = x; b = 0;
  } else if (h < 2/6) {
    r = x; g = c; b = 0;
  } else if (h < 3/6) {
    r = 0; g = c; b = x;
  } else if (h < 4/6) {
    r = 0; g = x; b = c;
  } else if (h < 5/6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  return createColor(
    (r + m) * 255,
    (g + m) * 255,
    (b + m) * 255,
    a
  );
}

/**
 * Convert RGB to LAB color space (simplified)
 * Used for perceptual color distance calculations
 */
export function rgbToLab(color: Color): { l: number; a: number; b: number } {
  // First convert to XYZ
  let r = color.r / 255;
  let g = color.g / 255;
  let b = color.b / 255;
  
  // Apply gamma correction
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  
  // Convert to XYZ using sRGB matrix
  let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  let z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  
  // Normalize by D65 illuminant
  x /= 0.95047;
  y /= 1.00000;
  z /= 1.08883;
  
  // Convert to LAB
  const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
  const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
  const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);
  
  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bLab = 200 * (fy - fz);
  
  return { l, a, b: bLab };
}

// ========================
// Color Palette Utilities
// ========================

/**
 * Sort colors by luminance (lightest to darkest)
 */
export function sortColorsByLuminance(colors: Color[]): Color[] {
  return [...colors].sort((a, b) => calculateLuminance(a) - calculateLuminance(b));
}

/**
 * Sort colors by hue
 */
export function sortColorsByHue(colors: Color[]): Color[] {
  return [...colors].sort((a, b) => {
    const hslA = rgbToHsl(a);
    const hslB = rgbToHsl(b);
    return hslA.h - hslB.h;
  });
}

/**
 * Find dominant color in a set of colors with frequencies
 */
export function findDominantColor(colors: Color[], frequencies: number[]): Color {
  if (colors.length === 0) {
    throw new Error('Cannot find dominant color in empty array');
  }
  
  if (colors.length !== frequencies.length) {
    throw new Error('Colors and frequencies arrays must have the same length');
  }
  
  let maxFrequency = frequencies[0];
  let dominantIndex = 0;
  
  for (let i = 1; i < frequencies.length; i++) {
    if (frequencies[i] > maxFrequency) {
      maxFrequency = frequencies[i];
      dominantIndex = i;
    }
  }
  
  return colors[dominantIndex];
}

/**
 * Calculate average color from a set of colors with optional weights
 */
export function calculateAverageColor(colors: Color[], weights?: number[]): Color {
  if (colors.length === 0) {
    throw new Error('Cannot calculate average of empty color array');
  }
  
  const w = weights || new Array(colors.length).fill(1);
  const totalWeight = w.reduce((sum, weight) => sum + weight, 0);
  
  let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
  
  for (let i = 0; i < colors.length; i++) {
    const weight = w[i] / totalWeight;
    sumR += colors[i].r * weight;
    sumG += colors[i].g * weight;
    sumB += colors[i].b * weight;
    sumA += (colors[i].a ?? 1) * weight;
  }
  
  return createColor(sumR, sumG, sumB, sumA);
}

/**
 * Check if a color is effectively transparent
 */
export function isTransparent(color: Color, threshold: number = 0.1): boolean {
  return (color.a ?? 1) < threshold;
}

/**
 * Check if a color is effectively grayscale
 */
export function isGrayscale(color: Color, tolerance: number = 5): boolean {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return (max - min) <= tolerance;
}

/**
 * Get contrast ratio between two colors
 */
export function getContrastRatio(color1: Color, color2: Color): number {
  const l1 = calculateRelativeLuminance(color1);
  const l2 = calculateRelativeLuminance(color2);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}