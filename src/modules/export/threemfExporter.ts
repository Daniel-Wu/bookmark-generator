/**
 * 3MF (3D Manufacturing Format) Exporter
 * Converts Three.js geometry into 3MF format with multi-color support
 */

import * as THREE from 'three';
import { GeometryExporter } from './geometryExporter';
import type { BookmarkGeometry, GeometryLayer } from '../../types/geometry';
import type { 
  ThreeMFExportOptions, 
  ThreeMFPackage, 
  ModelXML, 
  ModelObject, 
  ModelMaterial,
  ContentTypesXML,
  RelationshipsXML
} from '../../types/export';
import { ZipArchive } from './zipArchive';
import { XMLBuilder, ThreeMFXMLBuilder } from './xmlBuilder';
import { ThumbnailGenerator } from './thumbnailGenerator';
import type { ThumbnailOptions } from './thumbnailGenerator';

/**
 * 3MF format constants
 */
const THREEMF_MIME_TYPE = 'model/3mf';
const THREEMF_NAMESPACE = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const MATERIAL_NAMESPACE = 'http://schemas.microsoft.com/3dmanufacturing/material/2015/02';

/**
 * 3MF mesh data structure
 */
interface ThreeMFMesh {
  vertices: Array<{ x: number; y: number; z: number }>;
  triangles: Array<{ v1: number; v2: number; v3: number; materialId?: string }>;
}

/**
 * 3MF export data structure
 */
interface ThreeMFExportData {
  package: ThreeMFPackage;
  meshes: ThreeMFMesh[];
  materials: ModelMaterial[];
  thumbnail?: Uint8Array;
}

/**
 * 3MF Binary Format Exporter
 */
export class ThreeMFExporter extends GeometryExporter {
  private options: ThreeMFExportOptions;
  private thumbnailGenerator?: ThumbnailGenerator;

  constructor(
    options: ThreeMFExportOptions,
    progressCallback?: (progress: any) => void
  ) {
    super(options, progressCallback);
    this.options = options;

    // Initialize thumbnail generator if needed
    if (options.includeThumbnail) {
      this.thumbnailGenerator = new ThumbnailGenerator({
        width: 256,
        height: 256,
        format: 'png',
        showLayers: true
      });
    }
  }

  /**
   * Generate 3MF export data structure
   */
  protected async generateExportData(geometry: BookmarkGeometry): Promise<ThreeMFExportData> {
    this.reportProgress('generating', 0.1, 'Processing geometry layers...');

    // Extract meshes and materials from layers
    const meshes: ThreeMFMesh[] = [];
    const materials: ModelMaterial[] = [];

    // Process each layer
    for (let i = 0; i < geometry.layers.length; i++) {
      const layer = geometry.layers[i];
      if (!layer.visible) continue;

      this.reportProgress(
        'generating',
        0.1 + (0.4 * i) / geometry.layers.length,
        `Processing layer ${i + 1} of ${geometry.layers.length}...`,
        i + 1,
        geometry.layers.length
      );

      // Create material for this layer
      const material = this.createMaterialFromLayer(layer, i);
      materials.push(material);

      // Extract mesh data
      const mesh = this.extractMeshFromLayer(layer, material.id);
      if (mesh.vertices.length > 0) {
        meshes.push(mesh);
      }

      this.checkCancellation();
    }

    this.reportProgress('generating', 0.5, 'Creating 3MF package structure...');

    // Create 3MF package structure
    const threemfPackage = this.create3MFPackage(meshes, materials);

    this.reportProgress('generating', 0.7, 'Generating thumbnail...');

    // Generate thumbnail if requested
    let thumbnail: Uint8Array | undefined;
    if (this.options.includeThumbnail && this.thumbnailGenerator) {
      try {
        thumbnail = await this.thumbnailGenerator.generateThumbnail(geometry, {
          width: 256,
          height: 256,
          format: 'png'
        });
      } catch (error) {
        console.warn('Failed to generate thumbnail:', error);
        // Continue without thumbnail
      }
    }

    this.reportProgress('generating', 0.8, '3MF package ready for export');

    return {
      package: threemfPackage,
      meshes,
      materials,
      thumbnail
    };
  }

  /**
   * Create material definition from geometry layer
   */
  private createMaterialFromLayer(layer: GeometryLayer, index: number): ModelMaterial {
    // Convert RGB to ARGB hex format (3MF uses ARGB)
    const alpha = Math.floor(layer.opacity * 255);
    const r = Math.floor(layer.color.r * 255);
    const g = Math.floor(layer.color.g * 255);
    const b = Math.floor(layer.color.b * 255);
    
    const argbHex = `#${alpha.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    return {
      id: `material_${index}`,
      name: `Layer ${layer.id} Material`,
      color: argbHex.toUpperCase()
    };
  }

  /**
   * Extract mesh data from geometry layer
   */
  private extractMeshFromLayer(layer: GeometryLayer, materialId: string): ThreeMFMesh {
    const mesh: ThreeMFMesh = {
      vertices: [],
      triangles: []
    };

    if (!layer.geometry || !layer.geometry.attributes.position) {
      return mesh;
    }

    const positions = layer.geometry.attributes.position;
    const triangleCount = positions.count / 3;

    // Extract vertices
    const vertexMap = new Map<string, number>();
    let vertexIndex = 0;

    for (let i = 0; i < triangleCount; i++) {
      const i3 = i * 3;
      
      // Process each vertex of the triangle
      const triangleVertices: number[] = [];
      
      for (let j = 0; j < 3; j++) {
        const v = new THREE.Vector3(
          positions.getX(i3 + j),
          positions.getY(i3 + j),
          positions.getZ(i3 + j) + layer.height // Add layer height offset
        );

        // Apply unit conversion if needed
        if (this.options.units === 'inches') {
          v.multiplyScalar(1 / 25.4); // Convert mm to inches
        }

        // Round to specified precision
        v.x = this.roundToPrecision(v.x, this.options.precision);
        v.y = this.roundToPrecision(v.y, this.options.precision);
        v.z = this.roundToPrecision(v.z, this.options.precision);

        // Create vertex key for deduplication
        const vertexKey = `${v.x},${v.y},${v.z}`;
        
        let vIndex = vertexMap.get(vertexKey);
        if (vIndex === undefined) {
          vIndex = vertexIndex++;
          vertexMap.set(vertexKey, vIndex);
          mesh.vertices.push({ x: v.x, y: v.y, z: v.z });
        }
        
        triangleVertices.push(vIndex);
      }

      // Add triangle with material reference
      mesh.triangles.push({
        v1: triangleVertices[0],
        v2: triangleVertices[1],
        v3: triangleVertices[2],
        materialId: materialId
      });
    }

    return mesh;
  }

  /**
   * Round number to specified precision
   */
  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  /**
   * Create 3MF package structure
   */
  private create3MFPackage(meshes: ThreeMFMesh[], materials: ModelMaterial[]): ThreeMFPackage {
    // Create content types
    const contentTypes: ContentTypesXML = {
      defaults: [
        { extension: 'rels', contentType: 'application/vnd.openxmlformats-package.relationships+xml' },
        { extension: 'model', contentType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' }
      ],
      overrides: []
    };

    if (this.options.includeThumbnail) {
      contentTypes.defaults.push({
        extension: 'png',
        contentType: 'image/png'
      });
    }

    // Create relationships
    const relationships: RelationshipsXML = {
      relationships: [
        {
          id: 'rel-1',
          type: 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel',
          target: '/3D/3dmodel.model'
        }
      ]
    };

    if (this.options.includeThumbnail) {
      relationships.relationships.push({
        id: 'rel-2',
        type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail',
        target: '/Metadata/thumbnail.png'
      });
    }

    // Create model objects from meshes
    const objects: ModelObject[] = [];
    
    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i];
      
      const object: ModelObject = {
        id: `object_${i}`,
        type: 'model',
        mesh: {
          vertices: mesh.vertices,
          triangles: mesh.triangles.map(triangle => ({
            v1: triangle.v1,
            v2: triangle.v2,
            v3: triangle.v3,
            materialId: triangle.materialId
          }))
        }
      };
      
      objects.push(object);
    }

    // Create model XML structure
    const model: ModelXML = {
      unit: this.options.units === 'inches' ? 'inch' : 'millimeter',
      metadata: [
        { name: 'Title', value: 'Parametric 3D Bookmark' },
        { name: 'Designer', value: 'Parametric 3D Bookmark Generator' },
        { name: 'CreationDate', value: new Date().toISOString() },
        { name: 'ModificationDate', value: new Date().toISOString() },
        ...Object.entries(this.options.metadata || {}).map(([name, value]) => ({ name, value }))
      ],
      resources: {
        objects,
        materials: materials.length > 0 ? materials : undefined
      },
      build: {
        items: objects.map(obj => ({
          objectId: obj.id,
          transform: undefined // No transformation needed
        }))
      }
    };

    return {
      contentTypes,
      relationships,
      model
    };
  }

  /**
   * Write 3MF binary data (ZIP archive)
   */
  protected async writeBinaryData(data: ThreeMFExportData): Promise<Uint8Array> {
    this.reportProgress('writing', 0.1, 'Creating ZIP archive...');

    const archive = new ZipArchive();

    // Add [Content_Types].xml
    const contentTypesXML = this.generateContentTypesXML(data.package.contentTypes);
    archive.addFile('[Content_Types].xml', contentTypesXML);

    this.reportProgress('writing', 0.2, 'Writing relationships...');

    // Add _rels/.rels
    const relationshipsXML = this.generateRelationshipsXML(data.package.relationships);
    archive.addFile('_rels/.rels', relationshipsXML);

    this.reportProgress('writing', 0.4, 'Writing 3D model...');

    // Add 3D/3dmodel.model
    const modelXML = this.generateModelXML(data.package.model);
    archive.addFile('3D/3dmodel.model', modelXML);

    this.reportProgress('writing', 0.7, 'Adding thumbnail...');

    // Add thumbnail if available
    if (data.thumbnail && this.options.includeThumbnail) {
      archive.addFile('Metadata/thumbnail.png', data.thumbnail);
    }

    this.reportProgress('writing', 0.9, 'Finalizing archive...');

    // Generate final ZIP data
    const zipData = archive.generate();

    this.reportProgress('writing', 1.0, 'Export complete');

    return zipData;
  }

  /**
   * Generate Content Types XML
   */
  private generateContentTypesXML(contentTypes: ContentTypesXML): string {
    const builder = ThreeMFXMLBuilder.createContentTypes();
    
    // Add additional defaults if needed
    for (const defaultType of contentTypes.defaults) {
      if (!['rels', 'model', 'png'].includes(defaultType.extension)) {
        builder.selfClosingElement('Default', {
          'Extension': defaultType.extension,
          'ContentType': defaultType.contentType
        });
      }
    }
    
    // Add overrides
    for (const override of contentTypes.overrides) {
      builder.selfClosingElement('Override', {
        'PartName': override.partName,
        'ContentType': override.contentType
      });
    }
    
    return builder.toString();
  }

  /**
   * Generate Relationships XML
   */
  private generateRelationshipsXML(relationships: RelationshipsXML): string {
    const builder = ThreeMFXMLBuilder.createRelationships();
    
    // Add additional relationships if needed
    for (const rel of relationships.relationships) {
      if (!['rel-1', 'rel-2'].includes(rel.id)) {
        builder.selfClosingElement('Relationship', {
          'Id': rel.id,
          'Type': rel.type,
          'Target': rel.target
        });
      }
    }
    
    return builder.toString();
  }

  /**
   * Generate Model XML
   */
  private generateModelXML(model: ModelXML): string {
    const builder = ThreeMFXMLBuilder.createModel();

    // Add metadata
    if (model.metadata.length > 0) {
      builder.element('metadata');
      for (const meta of model.metadata) {
        builder.selfClosingElement('m:meta', {
          'name': meta.name,
          'value': meta.value
        });
      }
      builder.closeElement(); // metadata
    }

    // Add resources
    builder.element('resources');

    // Add materials if present
    if (model.resources.materials && model.resources.materials.length > 0) {
      builder.element('m:colorgroup', { 'id': 'colorgroup_1' });
      for (const material of model.resources.materials) {
        builder.selfClosingElement('m:color', {
          'id': material.id,
          'color': material.color
        });
      }
      builder.closeElement(); // colorgroup
    }

    // Add objects
    for (const object of model.resources.objects) {
      builder.element('object', { 
        'id': object.id, 
        'type': object.type 
      });
      
      builder.element('mesh');
      
      // Add vertices
      builder.element('vertices');
      for (const vertex of object.mesh.vertices) {
        builder.selfClosingElement('vertex', {
          'x': vertex.x.toString(),
          'y': vertex.y.toString(),
          'z': vertex.z.toString()
        });
      }
      builder.closeElement(); // vertices
      
      // Add triangles
      builder.element('triangles');
      for (const triangle of object.mesh.triangles) {
        const attrs: Record<string, string> = {
          'v1': triangle.v1.toString(),
          'v2': triangle.v2.toString(),
          'v3': triangle.v3.toString()
        };
        
        if (triangle.materialId) {
          attrs['m:colorid'] = triangle.materialId;
        }
        
        builder.selfClosingElement('triangle', attrs);
      }
      builder.closeElement(); // triangles
      
      builder.closeElement(); // mesh
      builder.closeElement(); // object
    }

    builder.closeElement(); // resources

    // Add build
    builder.element('build');
    for (const item of model.build.items) {
      const attrs: Record<string, string> = {
        'objectid': item.objectId
      };
      
      if (item.transform) {
        attrs['transform'] = item.transform;
      }
      
      builder.selfClosingElement('item', attrs);
    }
    builder.closeElement(); // build

    builder.closeElement(); // model

    return builder.toString();
  }

  /**
   * Estimate file size for validation
   */
  protected estimateFileSize(geometry: BookmarkGeometry): number {
    // Rough estimate based on vertices and triangles
    const vertexCount = geometry.layers.reduce((sum, layer) => 
      sum + (layer.geometry.attributes.position?.count || 0), 0);
    
    // Estimated sizes:
    // - XML overhead: ~2KB
    // - Each vertex: ~50 bytes (XML)
    // - Each triangle: ~30 bytes (XML)
    // - ZIP compression: ~70% reduction
    
    const xmlSize = 2000 + (vertexCount * 50) + (geometry.totalTriangles * 30);
    const compressedSize = xmlSize * 0.3; // Approximate ZIP compression
    
    // Add thumbnail if included
    const thumbnailSize = this.options.includeThumbnail ? 8192 : 0; // ~8KB PNG
    
    return compressedSize + thumbnailSize;
  }

  /**
   * Generate filename with timestamp
   */
  protected generateFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    return `bookmark-${timestamp}.3mf`;
  }

  /**
   * Get MIME type for 3MF files
   */
  protected getMimeType(): string {
    return THREEMF_MIME_TYPE;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.thumbnailGenerator) {
      this.thumbnailGenerator.dispose();
      this.thumbnailGenerator = undefined;
    }
  }

  /**
   * Create 3MF exporter with default options
   */
  static create(options: Partial<ThreeMFExportOptions> = {}): ThreeMFExporter {
    const defaultOptions: ThreeMFExportOptions = {
      format: '3mf',
      binary: true,
      precision: 6,
      units: 'mm',
      includeColors: true,
      includeMetadata: true,
      includeTextures: false,
      includeThumbnail: true,
      compressionLevel: 6,
      metadata: {}
    };

    return new ThreeMFExporter({ ...defaultOptions, ...options });
  }

  /**
   * Quick export method for simple use cases
   */
  static async export3MF(
    geometry: BookmarkGeometry,
    options: Partial<ThreeMFExportOptions> = {},
    progressCallback?: (progress: any) => void
  ) {
    const exporter = ThreeMFExporter.create(options);
    if (progressCallback) {
      exporter.progressCallback = progressCallback;
    }
    
    try {
      const result = await exporter.export(geometry);
      exporter.dispose();
      return result;
    } catch (error) {
      exporter.dispose();
      throw error;
    }
  }
}