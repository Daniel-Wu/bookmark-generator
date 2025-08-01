/**
 * Binary writer utility for efficient binary data generation
 * Used for creating STL and other binary format files
 */

import type { BinaryWriter as IBinaryWriter } from '../../types/export';

/**
 * Efficient binary data writer
 */
export class BinaryWriter implements IBinaryWriter {
  public position = 0;
  public readonly buffer: ArrayBuffer;
  public readonly view: DataView;

  constructor(size: number) {
    this.buffer = new ArrayBuffer(size);
    this.view = new DataView(this.buffer);
  }

  /**
   * Write unsigned 8-bit integer
   */
  writeUint8(value: number): void {
    this.view.setUint8(this.position, value);
    this.position += 1;
  }

  /**
   * Write unsigned 16-bit integer
   */
  writeUint16(value: number, littleEndian = true): void {
    this.view.setUint16(this.position, value, littleEndian);
    this.position += 2;
  }

  /**
   * Write unsigned 32-bit integer
   */
  writeUint32(value: number, littleEndian = true): void {
    this.view.setUint32(this.position, value, littleEndian);
    this.position += 4;
  }

  /**
   * Write 32-bit float
   */
  writeFloat32(value: number, littleEndian = true): void {
    this.view.setFloat32(this.position, value, littleEndian);
    this.position += 4;
  }

  /**
   * Write string with optional padding
   */
  writeString(value: string, length?: number): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    
    if (length !== undefined) {
      // Write fixed-length string with null padding
      const bytesToWrite = Math.min(bytes.length, length);
      for (let i = 0; i < bytesToWrite; i++) {
        this.writeUint8(bytes[i]);
      }
      // Pad with null bytes
      for (let i = bytesToWrite; i < length; i++) {
        this.writeUint8(0);
      }
    } else {
      // Write variable-length string
      for (let i = 0; i < bytes.length; i++) {
        this.writeUint8(bytes[i]);
      }
    }
  }

  /**
   * Write array of 32-bit floats
   */
  writeFloat32Array(values: number[], littleEndian = true): void {
    for (const value of values) {
      this.writeFloat32(value, littleEndian);
    }
  }

  /**
   * Write 3D vector (3 x 32-bit floats)
   */
  writeVector3(x: number, y: number, z: number, littleEndian = true): void {
    this.writeFloat32(x, littleEndian);
    this.writeFloat32(y, littleEndian);
    this.writeFloat32(z, littleEndian);
  }

  /**
   * Write binary data from another array
   */
  writeBytes(data: Uint8Array): void {
    const targetArray = new Uint8Array(this.buffer, this.position, data.length);
    targetArray.set(data);
    this.position += data.length;
  }

  /**
   * Seek to specific position
   */
  seek(position: number): void {
    if (position < 0 || position > this.buffer.byteLength) {
      throw new Error(`Invalid seek position: ${position}`);
    }
    this.position = position;
  }

  /**
   * Get current buffer size
   */
  get size(): number {
    return this.buffer.byteLength;
  }

  /**
   * Get remaining bytes
   */
  get remaining(): number {
    return this.buffer.byteLength - this.position;
  }

  /**
   * Check if we can write more bytes
   */
  canWrite(bytes: number): boolean {
    return this.position + bytes <= this.buffer.byteLength;
  }

  /**
   * Get Uint8Array view of the entire buffer
   */
  getUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /**
   * Get Uint8Array view of written data only
   */
  getWrittenData(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.position);
  }

  /**
   * Create a copy of the written data
   */
  toUint8Array(): Uint8Array {
    const result = new Uint8Array(this.position);
    result.set(new Uint8Array(this.buffer, 0, this.position));
    return result;
  }

  /**
   * Reset writer to beginning
   */
  reset(): void {
    this.position = 0;
  }

  /**
   * Create a growable binary writer that can expand as needed
   */
  static createGrowable(initialSize = 1024): GrowableBinaryWriter {
    return new GrowableBinaryWriter(initialSize);
  }
}

/**
 * Growable binary writer that can expand buffer as needed
 */
export class GrowableBinaryWriter extends BinaryWriter {
  private growthFactor = 2;
  private minGrowthSize = 1024;

  constructor(initialSize: number) {
    super(initialSize);
  }

  /**
   * Ensure buffer has capacity for additional bytes
   */
  private ensureCapacity(additionalBytes: number): void {
    const requiredSize = this.position + additionalBytes;
    if (requiredSize <= this.buffer.byteLength) {
      return;
    }

    // Calculate new size
    const newSize = Math.max(
      requiredSize,
      this.buffer.byteLength * this.growthFactor,
      this.buffer.byteLength + this.minGrowthSize
    );

    // Create new buffer and copy data
    const newBuffer = new ArrayBuffer(newSize);
    const newView = new DataView(newBuffer);
    const currentData = new Uint8Array(this.buffer, 0, this.position);
    new Uint8Array(newBuffer).set(currentData);

    // Update references
    (this as any).buffer = newBuffer;
    (this as any).view = newView;
  }

  // Override write methods to ensure capacity
  writeUint8(value: number): void {
    this.ensureCapacity(1);
    super.writeUint8(value);
  }

  writeUint16(value: number, littleEndian = true): void {
    this.ensureCapacity(2);
    super.writeUint16(value, littleEndian);
  }

  writeUint32(value: number, littleEndian = true): void {
    this.ensureCapacity(4);
    super.writeUint32(value, littleEndian);
  }

  writeFloat32(value: number, littleEndian = true): void {
    this.ensureCapacity(4);
    super.writeFloat32(value, littleEndian);
  }

  writeString(value: string, length?: number): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    const bytesToWrite = length !== undefined ? length : bytes.length;
    this.ensureCapacity(bytesToWrite);
    super.writeString(value, length);
  }

  writeBytes(data: Uint8Array): void {
    this.ensureCapacity(data.length);
    super.writeBytes(data);
  }

  /**
   * Set growth parameters
   */
  setGrowthParameters(factor: number, minSize: number): void {
    this.growthFactor = Math.max(1.1, factor);
    this.minGrowthSize = Math.max(64, minSize);
  }
}