/**
 * ZIP archive creator without external dependencies
 * Implements minimal ZIP format for 3MF file packaging
 */

/**
 * ZIP file constants
 */
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

/**
 * Compression methods
 */
const CompressionMethod = {
  STORED: 0,    // No compression
  DEFLATED: 8   // DEFLATE compression (not implemented)
} as const;

type CompressionMethod = typeof CompressionMethod[keyof typeof CompressionMethod];

/**
 * File entry in ZIP archive
 */
interface ZipEntry {
  filename: string;
  data: Uint8Array;
  compressionMethod: CompressionMethod;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  lastModified: Date;
  localHeaderOffset: number;
}

/**
 * ZIP archive builder with streaming capability
 */
export class ZipArchive {
  private entries: ZipEntry[] = [];
  private currentOffset = 0;
  private compressionLevel = 0; // 0 = no compression for simplicity

  /**
   * Add file to archive
   */
  addFile(filename: string, data: Uint8Array | string): void {
    const fileData = typeof data === 'string' 
      ? new TextEncoder().encode(data) 
      : data;

    const entry: ZipEntry = {
      filename: this.normalizeFilename(filename),
      data: fileData,
      compressionMethod: CompressionMethod.STORED, // No compression for simplicity
      compressedSize: fileData.length,
      uncompressedSize: fileData.length,
      crc32: this.calculateCRC32(fileData),
      lastModified: new Date(),
      localHeaderOffset: 0 // Will be set when writing
    };

    this.entries.push(entry);
  }

  /**
   * Generate complete ZIP archive
   */
  generate(): Uint8Array {
    // Calculate total size needed
    let totalSize = 0;
    
    // Calculate local file headers + data size
    for (const entry of this.entries) {
      totalSize += 30; // Fixed header size
      totalSize += entry.filename.length;
      totalSize += entry.compressedSize;
    }
    
    // Calculate central directory size
    for (const entry of this.entries) {
      totalSize += 46; // Fixed central directory header size
      totalSize += entry.filename.length;
    }
    
    // End of central directory record
    totalSize += 22;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const uint8Array = new Uint8Array(buffer);
    let offset = 0;

    // Write local file headers and data
    for (const entry of this.entries) {
      entry.localHeaderOffset = offset;
      offset += this.writeLocalFileHeader(view, uint8Array, offset, entry);
    }

    const centralDirectoryOffset = offset;
    const centralDirectorySize = this.writeCentralDirectory(view, uint8Array, offset);
    offset += centralDirectorySize;

    // Write end of central directory record
    this.writeEndOfCentralDirectory(view, offset, centralDirectoryOffset, centralDirectorySize);

    return uint8Array;
  }

  /**
   * Write local file header
   */
  private writeLocalFileHeader(view: DataView, buffer: Uint8Array, offset: number, entry: ZipEntry): number {
    const startOffset = offset;
    
    // Local file header signature
    view.setUint32(offset, ZIP_LOCAL_FILE_HEADER_SIGNATURE, true);
    offset += 4;

    // Version needed to extract
    view.setUint16(offset, 10, true); // Version 1.0
    offset += 2;

    // General purpose bit flag
    view.setUint16(offset, 0, true);
    offset += 2;

    // Compression method
    view.setUint16(offset, entry.compressionMethod, true);
    offset += 2;

    // Last modification time and date
    const dosDateTime = this.toDosDateTime(entry.lastModified);
    view.setUint16(offset, dosDateTime.time, true);
    offset += 2;
    view.setUint16(offset, dosDateTime.date, true);
    offset += 2;

    // CRC32
    view.setUint32(offset, entry.crc32, true);
    offset += 4;

    // Compressed size
    view.setUint32(offset, entry.compressedSize, true);
    offset += 4;

    // Uncompressed size
    view.setUint32(offset, entry.uncompressedSize, true);
    offset += 4;

    // Filename length
    view.setUint16(offset, entry.filename.length, true);
    offset += 2;

    // Extra field length
    view.setUint16(offset, 0, true);
    offset += 2;

    // Filename
    const filenameBytes = new TextEncoder().encode(entry.filename);
    buffer.set(filenameBytes, offset);
    offset += filenameBytes.length;

    // File data
    buffer.set(entry.data, offset);
    offset += entry.data.length;

    return offset - startOffset;
  }

  /**
   * Write central directory
   */
  private writeCentralDirectory(view: DataView, buffer: Uint8Array, offset: number): number {
    const startOffset = offset;

    for (const entry of this.entries) {
      // Central directory file header signature
      view.setUint32(offset, ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE, true);
      offset += 4;

      // Version made by
      view.setUint16(offset, 20, true); // Version 2.0
      offset += 2;

      // Version needed to extract
      view.setUint16(offset, 10, true); // Version 1.0
      offset += 2;

      // General purpose bit flag
      view.setUint16(offset, 0, true);
      offset += 2;

      // Compression method
      view.setUint16(offset, entry.compressionMethod, true);
      offset += 2;

      // Last modification time and date
      const dosDateTime = this.toDosDateTime(entry.lastModified);
      view.setUint16(offset, dosDateTime.time, true);
      offset += 2;
      view.setUint16(offset, dosDateTime.date, true);
      offset += 2;

      // CRC32
      view.setUint32(offset, entry.crc32, true);
      offset += 4;

      // Compressed size
      view.setUint32(offset, entry.compressedSize, true);
      offset += 4;

      // Uncompressed size
      view.setUint32(offset, entry.uncompressedSize, true);
      offset += 4;

      // Filename length
      view.setUint16(offset, entry.filename.length, true);
      offset += 2;

      // Extra field length
      view.setUint16(offset, 0, true);
      offset += 2;

      // File comment length
      view.setUint16(offset, 0, true);
      offset += 2;

      // Disk number start
      view.setUint16(offset, 0, true);
      offset += 2;

      // Internal file attributes
      view.setUint16(offset, 0, true);
      offset += 2;

      // External file attributes
      view.setUint32(offset, 0, true);
      offset += 4;

      // Relative offset of local header
      view.setUint32(offset, entry.localHeaderOffset, true);
      offset += 4;

      // Filename
      const filenameBytes = new TextEncoder().encode(entry.filename);
      buffer.set(filenameBytes, offset);
      offset += filenameBytes.length;
    }

    return offset - startOffset;
  }

  /**
   * Write end of central directory record
   */
  private writeEndOfCentralDirectory(view: DataView, offset: number, centralDirectoryOffset: number, centralDirectorySize: number): void {
    // End of central directory signature
    view.setUint32(offset, ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
    offset += 4;

    // Number of this disk
    view.setUint16(offset, 0, true);
    offset += 2;

    // Number of disk with start of central directory
    view.setUint16(offset, 0, true);
    offset += 2;

    // Total number of entries in central directory on this disk
    view.setUint16(offset, this.entries.length, true);
    offset += 2;

    // Total number of entries in central directory
    view.setUint16(offset, this.entries.length, true);
    offset += 2;

    // Size of central directory
    view.setUint32(offset, centralDirectorySize, true);
    offset += 4;

    // Offset of start of central directory
    view.setUint32(offset, centralDirectoryOffset, true);
    offset += 4;

    // ZIP file comment length
    view.setUint16(offset, 0, true);
  }

  /**
   * Calculate CRC32 checksum
   */
  private calculateCRC32(data: Uint8Array): number {
    const crcTable = this.makeCRCTable();
    let crc = 0 ^ (-1);

    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xFF];
    }

    return (crc ^ (-1)) >>> 0; // Convert to unsigned 32-bit
  }

  /**
   * Generate CRC32 lookup table
   */
  private makeCRCTable(): Uint32Array {
    const table = new Uint32Array(256);
    
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[i] = c;
    }
    
    return table;
  }

  /**
   * Convert JavaScript Date to DOS date/time format
   */
  private toDosDateTime(date: Date): { date: number; time: number } {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2); // DOS time has 2-second precision

    const dosDate = ((year - 1980) << 9) | (month << 5) | day;
    const dosTime = (hours << 11) | (minutes << 5) | seconds;

    return { date: dosDate, time: dosTime };
  }

  /**
   * Normalize filename for ZIP archive
   */
  private normalizeFilename(filename: string): string {
    // Convert backslashes to forward slashes
    // Remove leading slashes
    return filename.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  /**
   * Get total number of files
   */
  get fileCount(): number {
    return this.entries.length;
  }

  /**
   * Get total uncompressed size
   */
  get totalSize(): number {
    return this.entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
  }

  /**
   * Get list of filenames
   */
  get filenames(): string[] {
    return this.entries.map(entry => entry.filename);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
    this.currentOffset = 0;
  }

  /**
   * Check if file exists in archive
   */
  hasFile(filename: string): boolean {
    const normalizedName = this.normalizeFilename(filename);
    return this.entries.some(entry => entry.filename === normalizedName);
  }

  /**
   * Remove file from archive
   */
  removeFile(filename: string): boolean {
    const normalizedName = this.normalizeFilename(filename);
    const index = this.entries.findIndex(entry => entry.filename === normalizedName);
    
    if (index >= 0) {
      this.entries.splice(index, 1);
      return true;
    }
    
    return false;
  }

  /**
   * Create archive from file map
   */
  static fromFiles(files: Record<string, Uint8Array | string>): ZipArchive {
    const archive = new ZipArchive();
    
    for (const [filename, data] of Object.entries(files)) {
      archive.addFile(filename, data);
    }
    
    return archive;
  }

  /**
   * Create minimal 3MF package structure
   */
  static create3MFPackage(): ZipArchive {
    const archive = new ZipArchive();
    
    // Add required empty structure - files will be added by the exporter
    // This creates the proper directory structure expected by 3MF readers
    
    return archive;
  }
}