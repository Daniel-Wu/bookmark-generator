/**
 * Unit tests for 3MF export functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { ThreeMFExporter } from '../../modules/export/threemfExporter';
import { XMLBuilder, ThreeMFXMLBuilder } from '../../modules/export/xmlBuilder';
import { ZipArchive } from '../../modules/export/zipArchive';
import type { BookmarkGeometry, GeometryLayer } from '../../types/geometry';
import type { ThreeMFExportOptions } from '../../types/export';

// Mock HTML canvas for thumbnail generation
Object.defineProperty(window, 'HTMLCanvasElement', {
  value: class MockCanvas {
    width = 256;
    height = 256;
    getContext() {
      return {
        fillRect: vi.fn(),
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        fillText: vi.fn()
      };
    }
    toBlob(callback: (blob: Blob | null) => void) {
      // Create a minimal blob for testing
      const blob = new Blob(['mock-image-data'], { type: 'image/png' });
      setTimeout(() => callback(blob), 0);
    }
  }
});

describe('XMLBuilder', () => {
  let builder: XMLBuilder;

  beforeEach(() => {
    builder = new XMLBuilder();
  });

  it('should create valid XML declaration', () => {
    const xml = builder.declaration('1.0', 'UTF-8').element('root').closeElement().toString();
    expect(xml).toMatch(/^<?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it('should create elements with attributes', () => {
    const xml = builder
      .element('test', { id: '1', name: 'test' })
      .closeElement()
      .toStringWithoutDeclaration();
    
    expect(xml).toContain('<test id="1" name="test"></test>');
  });

  it('should create self-closing elements', () => {
    const xml = builder
      .selfClosingElement('empty', { value: 'test' })
      .toStringWithoutDeclaration();
    
    expect(xml).toContain('<empty value="test"/>');
  });

  it('should escape XML content', () => {
    const xml = builder
      .element('test')
      .content('Text with <special> & "characters"')
      .closeElement()
      .toStringWithoutDeclaration();
    
    expect(xml).toContain('&lt;special&gt; &amp; &quot;characters&quot;');
  });
});

describe('ThreeMFXMLBuilder', () => {
  it('should create valid content types XML', () => {
    const xml = ThreeMFXMLBuilder.createContentTypes().toString();
    
    expect(xml).toContain('xmlns="http://schemas.openxmlformats.org/package/2006/content-types"');
    expect(xml).toContain('Extension="rels"');
    expect(xml).toContain('Extension="model"');
  });

  it('should create valid relationships XML', () => {
    const xml = ThreeMFXMLBuilder.createRelationships().toString();
    
    expect(xml).toContain('xmlns="http://schemas.openxmlformats.org/package/2006/relationships"');
    expect(xml).toContain('Target="/3D/3dmodel.model"');
  });

  it('should create valid model XML structure', () => {
    const xml = ThreeMFXMLBuilder.createModel().toString();
    
    expect(xml).toContain('unit="millimeter"');
    expect(xml).toContain('xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"');
    expect(xml).toContain('xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"');
  });
});

describe('ZipArchive', () => {
  let archive: ZipArchive;

  beforeEach(() => {
    archive = new ZipArchive();
  });

  it('should add files to archive', () => {
    archive.addFile('test.txt', 'Hello World');
    
    expect(archive.fileCount).toBe(1);
    expect(archive.hasFile('test.txt')).toBe(true);
    expect(archive.filenames).toContain('test.txt');
  });

  it('should generate valid ZIP data', () => {
    archive.addFile('test.txt', 'Hello World');
    const zipData = archive.generate();
    
    expect(zipData).toBeInstanceOf(Uint8Array);
    expect(zipData.length).toBeGreaterThan(0);
    
    // Check ZIP signature
    expect(zipData[0]).toBe(0x50); // 'P'
    expect(zipData[1]).toBe(0x4B); // 'K'
  });

  it('should handle multiple files', () => {
    archive.addFile('file1.txt', 'Content 1');
    archive.addFile('folder/file2.txt', 'Content 2');
    
    expect(archive.fileCount).toBe(2);
    expect(archive.totalSize).toBe(19); // 9 + 9 + 1 characters
  });

  it('should normalize filenames', () => {
    archive.addFile('/folder\\file.txt', 'test');
    
    expect(archive.filenames[0]).toBe('folder/file.txt');
  });
});

describe('ThreeMFExporter', () => {
  let exporter: ThreeMFExporter;
  let mockGeometry: BookmarkGeometry;
  let options: ThreeMFExportOptions;

  beforeEach(() => {
    options = {
      format: '3mf',
      binary: true,
      precision: 4,
      units: 'mm',
      includeColors: true,
      includeMetadata: true,
      includeTextures: false,
      includeThumbnail: false, // Disable for tests
      compressionLevel: 6,
      metadata: {}
    };

    exporter = new ThreeMFExporter(options);

    // Create mock geometry with simple triangle
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0,  // vertex 0
      1, 0, 0,  // vertex 1
      0, 1, 0   // vertex 2
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    const layer: GeometryLayer = {
      id: 0,
      geometry,
      color: { r: 1, g: 0, b: 0, hex: '#ff0000' },
      height: 0.5,
      visible: true,
      opacity: 1.0,
      triangleCount: 1,
      dimensions: { width: 1, height: 1, depth: 0.5 },
      boundingBox: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 0.5))
    };

    mockGeometry = {
      layers: [layer],
      boundingBox: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 0.5)),
      totalTriangles: 1,
      estimatedFileSize: 0.1
    };
  });

  afterEach(() => {
    exporter.dispose();
  });

  it('should create exporter with default options', () => {
    const defaultExporter = ThreeMFExporter.create();
    expect(defaultExporter).toBeInstanceOf(ThreeMFExporter);
    defaultExporter.dispose();
  });

  it('should validate geometry before export', async () => {
    const validation = await (exporter as any).validateGeometry(mockGeometry);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should generate 3MF export data', async () => {
    const exportData = await (exporter as any).generateExportData(mockGeometry);
    
    expect(exportData.package).toBeDefined();
    expect(exportData.meshes).toHaveLength(1);
    expect(exportData.materials).toHaveLength(1);
    
    // Check mesh data
    const mesh = exportData.meshes[0];
    expect(mesh.vertices).toHaveLength(3);
    expect(mesh.triangles).toHaveLength(1);
    
    // Check material data
    const material = exportData.materials[0];
    expect(material.id).toBe('material_0');
    expect(material.color).toBe('#FFFF0000'); // ARGB format
  });

  it('should handle multiple layers with different colors', async () => {
    // Add second layer
    const geometry2 = mockGeometry.layers[0].geometry.clone();
    const layer2: GeometryLayer = {
      id: 1,
      geometry: geometry2,
      color: { r: 0, g: 1, b: 0, hex: '#00ff00' },
      height: 1.0,
      visible: true,
      opacity: 0.8,
      triangleCount: 1,
      dimensions: { width: 1, height: 1, depth: 0.5 },
      boundingBox: new THREE.Box3(new THREE.Vector3(0, 0, 0.5), new THREE.Vector3(1, 1, 1))
    };

    mockGeometry.layers.push(layer2);
    mockGeometry.totalTriangles = 2;

    const exportData = await (exporter as any).generateExportData(mockGeometry);
    
    expect(exportData.meshes).toHaveLength(2);
    expect(exportData.materials).toHaveLength(2);
    
    // Check material colors
    expect(exportData.materials[0].color).toBe('#FFFF0000'); // Red
    expect(exportData.materials[1].color).toBe('#CC00FF00'); // Green with opacity 0.8
  });

  it('should export to binary 3MF format', async () => {
    const result = await exporter.export(mockGeometry);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Uint8Array);
    expect(result.mimeType).toBe('model/3mf');
    expect(result.filename).toMatch(/\.3mf$/);
    
    // Check ZIP signature
    const data = result.data!;
    expect(data[0]).toBe(0x50); // 'P'
    expect(data[1]).toBe(0x4B); // 'K'
  });

  it('should estimate file size accurately', () => {
    const estimatedSize = (exporter as any).estimateFileSize(mockGeometry);
    expect(estimatedSize).toBeGreaterThan(0);
    expect(estimatedSize).toBeLessThan(10000); // Should be reasonable for simple geometry
  });

  it('should handle export cancellation', async () => {
    const exportPromise = exporter.export(mockGeometry);
    exporter.cancel();
    
    const result = await exportPromise;
    expect(result.success).toBe(false);
  });

  it('should generate proper filename with timestamp', () => {
    const filename = (exporter as any).generateFilename();
    expect(filename).toMatch(/^bookmark-\d{4}-\d{2}-\d{2}\.3mf$/);
  });

  it('should convert units correctly', async () => {
    // Test inch conversion
    const inchOptions = { ...options, units: 'inches' as const };
    const inchExporter = new ThreeMFExporter(inchOptions);
    
    const exportData = await (inchExporter as any).generateExportData(mockGeometry);
    const mesh = exportData.meshes[0];
    
    // Vertices should be converted from mm to inches (divided by 25.4)
    expect(mesh.vertices[0].x).toBeCloseTo(0, 5);
    expect(mesh.vertices[1].x).toBeCloseTo(1 / 25.4, 5);
    
    inchExporter.dispose();
  });

  it('should handle invisible layers', async () => {
    mockGeometry.layers[0].visible = false;
    
    const exportData = await (exporter as any).generateExportData(mockGeometry);
    expect(exportData.meshes).toHaveLength(0);
    expect(exportData.materials).toHaveLength(0);
  });

  it('should round coordinates to specified precision', async () => {
    // Create geometry with high precision coordinates
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0.123456789, 0.987654321, 0.555555555,
      1.111111111, 0.222222222, 0.333333333,
      0.444444444, 1.666666666, 0.777777777
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    
    mockGeometry.layers[0].geometry = geometry;
    
    const exportData = await (exporter as any).generateExportData(mockGeometry);
    const mesh = exportData.meshes[0];
    
    // Check that coordinates are rounded to 4 decimal places
    expect(mesh.vertices[0].x).toBe(0.1235);
    expect(mesh.vertices[0].y).toBe(0.9877);
    expect(mesh.vertices[0].z).toBe(1.0556); // 0.5555... + 0.5 height offset
  });
});

describe('3MF Static Methods', () => {
  it('should export 3MF with static method', async () => {
    // Create minimal geometry for testing
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    const layer: GeometryLayer = {
      id: 0,
      geometry,
      color: { r: 1, g: 0, b: 0, hex: '#ff0000' },
      height: 0,
      visible: true,
      opacity: 1.0,
      triangleCount: 1
    };

    const bookmarkGeometry: BookmarkGeometry = {
      layers: [layer],
      boundingBox: new THREE.Box3(),
      totalTriangles: 1,
      estimatedFileSize: 0.1
    };

    const result = await ThreeMFExporter.export3MF(bookmarkGeometry);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Uint8Array);
    expect(result.mimeType).toBe('model/3mf');
  });
});