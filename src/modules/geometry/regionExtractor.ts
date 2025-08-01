/**
 * RegionExtractor - Connected Component Analysis for 2D Binary Images
 * Uses flood-fill algorithm to identify connected regions in binary masks
 */

import type { Point2D } from '../../types';
import type { ConnectedComponent, BoundingBox, ComponentAnalysis } from '../../types/geometry';
import * as THREE from 'three';

// ========================
// Types and Interfaces
// ========================

export interface ExtractionOptions {
  connectivity: 4 | 8; // 4-connected or 8-connected
  minArea: number; // minimum area in pixels
  maxComponents: number; // maximum components to extract
  sortByArea: boolean; // sort components by area (largest first)
  includeHoles: boolean; // include hole analysis
}

export interface FloodFillResult {
  pixels: Point2D[];
  area: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

const DEFAULT_OPTIONS: ExtractionOptions = {
  connectivity: 8,
  minArea: 4,
  maxComponents: 1000,
  sortByArea: true,
  includeHoles: false,
};

// ========================
// RegionExtractor Class
// ========================

export class RegionExtractor {
  private options: ExtractionOptions;
  private visited: Uint8Array | null = null;
  private width: number = 0;
  private height: number = 0;

  constructor(options: Partial<ExtractionOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Extract connected components from a binary mask
   */
  async extractComponents(
    mask: Uint8Array,
    width: number,
    height: number
  ): Promise<ComponentAnalysis> {
    this.width = width;
    this.height = height;
    this.visited = new Uint8Array(width * height);

    const components: ConnectedComponent[] = [];
    let componentId = 0;

    // Scan through all pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        // Skip if already visited or not foreground
        if (this.visited[index] || !mask[index]) {
          continue;
        }

        // Perform flood fill from this seed point
        const floodResult = this.floodFill(mask, x, y, width, height);
        
        // Skip components that are too small
        if (floodResult.area < this.options.minArea) {
          continue;
        }

        // Create connected component
        const component = this.createConnectedComponent(
          componentId++,
          floodResult,
          width,
          height
        );

        components.push(component);

        // Limit number of components to prevent memory issues
        if (components.length >= this.options.maxComponents) {
          break;
        }
      }
    }

    // Sort components by area if requested
    if (this.options.sortByArea) {
      components.sort((a, b) => b.area - a.area);
    }

    // Analyze holes if requested
    let filteredComponents = components;
    if (this.options.includeHoles) {
      filteredComponents = this.analyzeHoles(components);
    }

    // Find largest component
    const largestComponent = components.length > 0 ? components[0] : null;
    
    // Calculate additional metrics
    const totalArea = components.reduce((sum, comp) => sum + comp.area, 0);
    const averageAreaPerComponent = components.length > 0 ? totalArea / components.length : 0;
    const largestComponentSize = largestComponent ? largestComponent.area : 0;

    return {
      components,
      componentCount: components.length,
      largestComponentSize,
      totalArea,
      averageAreaPerComponent,
      totalComponents: components.length,
      largestComponent,
      filteredComponents,
    };
  }

  /**
   * Flood fill algorithm to find connected pixels
   */
  private floodFill(
    mask: Uint8Array,
    startX: number,
    startY: number,
    width: number,
    height: number
  ): FloodFillResult {
    const pixels: Point2D[] = [];
    const stack: Point2D[] = [{ x: startX, y: startY }];
    
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const index = y * width + x;

      // Skip if out of bounds, already visited, or not foreground
      if (x < 0 || x >= width || y < 0 || y >= height || 
          this.visited![index] || !mask[index]) {
        continue;
      }

      // Mark as visited
      this.visited![index] = 1;
      pixels.push({ x, y });

      // Update bounding box
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // Add neighbors to stack based on connectivity
      if (this.options.connectivity === 4) {
        // 4-connected neighbors
        stack.push({ x: x + 1, y });
        stack.push({ x: x - 1, y });
        stack.push({ x, y: y + 1 });
        stack.push({ x, y: y - 1 });
      } else {
        // 8-connected neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            stack.push({ x: x + dx, y: y + dy });
          }
        }
      }
    }

    return {
      pixels,
      area: pixels.length,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
    };
  }

  /**
   * Create a ConnectedComponent from flood fill result
   */
  private createConnectedComponent(
    id: number,
    floodResult: FloodFillResult,
    imageWidth: number,
    imageHeight: number
  ): ConnectedComponent {
    const { pixels, area, boundingBox } = floodResult;

    // Calculate centroid
    const centroid = this.calculateCentroid(pixels);

    // Convert bounding box to the correct format
    const bbox: BoundingBox = {
      minX: boundingBox.x,
      minY: boundingBox.y,
      maxX: boundingBox.x + boundingBox.width - 1,
      maxY: boundingBox.y + boundingBox.height - 1,
      width: boundingBox.width,
      height: boundingBox.height,
    };

    return {
      id,
      pixels,
      area,
      centroid,
      boundingBox: bbox,
    };
  }

  /**
   * Calculate centroid of a set of pixels
   */
  private calculateCentroid(pixels: Point2D[]): Point2D {
    if (pixels.length === 0) return { x: 0, y: 0 };

    const sum = pixels.reduce(
      (acc, pixel) => ({
        x: acc.x + pixel.x,
        y: acc.y + pixel.y,
      }),
      { x: 0, y: 0 }
    );

    return {
      x: sum.x / pixels.length,
      y: sum.y / pixels.length,
    };
  }

  /**
   * Calculate perimeter using boundary pixel counting
   */
  private calculatePerimeter(
    pixels: Point2D[],
    imageWidth: number,
    imageHeight: number
  ): number {
    // Create a set for fast lookup
    const pixelSet = new Set(pixels.map(p => `${p.x},${p.y}`));
    let perimeter = 0;

    for (const pixel of pixels) {
      const { x, y } = pixel;
      
      // Check 4-connected neighbors
      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ];

      for (const neighbor of neighbors) {
        // If neighbor is outside image bounds or not in component, it's a boundary
        if (neighbor.x < 0 || neighbor.x >= imageWidth ||
            neighbor.y < 0 || neighbor.y >= imageHeight ||
            !pixelSet.has(`${neighbor.x},${neighbor.y}`)) {
          perimeter++;
        }
      }
    }

    return perimeter;
  }

  /**
   * Calculate convex hull using Graham scan algorithm
   */
  private calculateConvexHull(pixels: Point2D[]): Point2D[] {
    if (pixels.length <= 3) return [...pixels];

    // Find the bottom-most point (or leftmost in case of tie)
    let bottom = 0;
    for (let i = 1; i < pixels.length; i++) {
      if (pixels[i].y < pixels[bottom].y ||
          (pixels[i].y === pixels[bottom].y && pixels[i].x < pixels[bottom].x)) {
        bottom = i;
      }
    }

    // Swap bottom point to first position
    [pixels[0], pixels[bottom]] = [pixels[bottom], pixels[0]];
    const p0 = pixels[0];

    // Sort points by polar angle with respect to bottom point
    const sortedPixels = [p0, ...pixels.slice(1).sort((a, b) => {
      const angleA = Math.atan2(a.y - p0.y, a.x - p0.x);
      const angleB = Math.atan2(b.y - p0.y, b.x - p0.x);
      if (Math.abs(angleA - angleB) < 1e-10) {
        // If angles are equal, sort by distance
        const distA = (a.x - p0.x) ** 2 + (a.y - p0.y) ** 2;
        const distB = (b.x - p0.x) ** 2 + (b.y - p0.y) ** 2;
        return distA - distB;
      }
      return angleA - angleB;
    })];

    // Graham scan
    const hull: Point2D[] = [sortedPixels[0], sortedPixels[1]];

    for (let i = 2; i < sortedPixels.length; i++) {
      while (hull.length > 1 && this.crossProduct(
        hull[hull.length - 2],
        hull[hull.length - 1],
        sortedPixels[i]
      ) <= 0) {
        hull.pop();
      }
      hull.push(sortedPixels[i]);
    }

    return hull;
  }

  /**
   * Calculate cross product for three points
   */
  private crossProduct(o: Point2D, a: Point2D, b: Point2D): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  /**
   * Analyze holes in components (simple implementation)
   */
  private analyzeHoles(components: ConnectedComponent[]): ConnectedComponent[] {
    // This is a simplified hole analysis
    // In a full implementation, you would:
    // 1. Create a binary image from components
    // 2. Perform hole filling
    // 3. Compare with original to identify holes
    // 4. Associate holes with their parent components

    return components.map(component => ({
      ...component,
      isHole: false, // Simplified - no hole detection for now
    }));
  }

  /**
   * Extract single component starting from a seed point
   */
  extractSingleComponent(
    mask: Uint8Array,
    seedX: number,
    seedY: number,
    width: number,
    height: number
  ): ConnectedComponent | null {
    this.width = width;
    this.height = height;
    this.visited = new Uint8Array(width * height);

    const seedIndex = seedY * width + seedX;
    if (!mask[seedIndex]) {
      return null; // Seed point is not foreground
    }

    const floodResult = this.floodFill(mask, seedX, seedY, width, height);
    
    if (floodResult.area < this.options.minArea) {
      return null; // Component too small
    }

    return this.createConnectedComponent(0, floodResult, width, height);
  }

  /**
   * Get component at specific pixel location
   */
  getComponentAt(
    components: ConnectedComponent[],
    x: number,
    y: number
  ): ConnectedComponent | null {
    for (const component of components) {
      const pixelExists = component.pixels.some(pixel => pixel.x === x && pixel.y === y);
      if (pixelExists) {
        return component;
      }
    }
    return null;
  }

  /**
   * Filter components by area range
   */
  filterByArea(
    components: ConnectedComponent[],
    minArea: number,
    maxArea: number = Infinity
  ): ConnectedComponent[] {
    return components.filter(comp => comp.area >= minArea && comp.area <= maxArea);
  }

  /**
   * Filter components by bounding box size
   */
  filterByBoundingBox(
    components: ConnectedComponent[],
    minWidth: number,
    minHeight: number,
    maxWidth: number = Infinity,
    maxHeight: number = Infinity
  ): ConnectedComponent[] {
    return components.filter(comp => {
      const width = comp.boundingBox.width;
      const height = comp.boundingBox.height;
      return width >= minWidth && width <= maxWidth &&
             height >= minHeight && height <= maxHeight;
    });
  }

  /**
   * Merge nearby components
   */
  mergeNearbyComponents(
    components: ConnectedComponent[],
    maxDistance: number
  ): ConnectedComponent[] {
    const merged: ConnectedComponent[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < components.length; i++) {
      if (processed.has(i)) continue;

      const baseComponent = components[i];
      const toMerge: ConnectedComponent[] = [baseComponent];
      processed.add(i);

      // Find nearby components to merge
      for (let j = i + 1; j < components.length; j++) {
        if (processed.has(j)) continue;

        const otherComponent = components[j];
        const distance = this.calculateComponentDistance(baseComponent, otherComponent);

        if (distance <= maxDistance) {
          toMerge.push(otherComponent);
          processed.add(j);
        }
      }

      // Merge components
      if (toMerge.length === 1) {
        merged.push(baseComponent);
      } else {
        merged.push(this.combineComponents(toMerge));
      }
    }

    return merged;
  }

  /**
   * Calculate distance between two components (centroid distance)
   */
  private calculateComponentDistance(
    comp1: ConnectedComponent,
    comp2: ConnectedComponent
  ): number {
    const dx = comp1.centroid.x - comp2.centroid.x;
    const dy = comp1.centroid.y - comp2.centroid.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Combine multiple components into one
   */
  private combineComponents(components: ConnectedComponent[]): ConnectedComponent {
    const allPixels: Point2D[] = [];
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // Combine all pixels and calculate bounding box
    for (const comp of components) {
      allPixels.push(...comp.pixels);
      minX = Math.min(minX, comp.boundingBox.minX);
      maxX = Math.max(maxX, comp.boundingBox.maxX);
      minY = Math.min(minY, comp.boundingBox.minY);
      maxY = Math.max(maxY, comp.boundingBox.maxY);
    }

    // Remove duplicates (shouldn't happen but be safe)
    const uniquePixels = allPixels.filter((pixel, index, arr) =>
      arr.findIndex(p => p.x === pixel.x && p.y === pixel.y) === index
    );

    const boundingBox: BoundingBox = {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };

    const centroid = this.calculateCentroid(uniquePixels);

    return {
      id: components[0].id, // Use first component's ID
      pixels: uniquePixels,
      area: uniquePixels.length,
      centroid,
      boundingBox,
    };
  }

  /**
   * Update extraction options
   */
  updateOptions(options: Partial<ExtractionOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current extraction options
   */
  getOptions(): ExtractionOptions {
    return { ...this.options };
  }
}

// ========================
// Factory Functions
// ========================

/**
 * Create a region extractor optimized for bookmark generation
 */
export function createBookmarkRegionExtractor(): RegionExtractor {
  return new RegionExtractor({
    connectivity: 8, // Better for complex shapes
    minArea: 4, // Remove tiny artifacts
    maxComponents: 500, // Reasonable limit for bookmarks
    sortByArea: true, // Process largest components first
    includeHoles: false, // Holes can cause printing issues
  });
}

/**
 * Quick extraction for simple cases
 */
export async function extractMainComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  minArea: number = 16
): Promise<ConnectedComponent[]> {
  const extractor = new RegionExtractor({
    connectivity: 8,
    minArea,
    maxComponents: 100,
    sortByArea: true,
    includeHoles: false,
  });

  const analysis = await extractor.extractComponents(mask, width, height);
  return analysis.filteredComponents;
}