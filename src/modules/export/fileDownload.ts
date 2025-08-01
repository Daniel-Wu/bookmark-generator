/**
 * File download utilities for exported 3D models
 * Handles browser compatibility and file saving
 */

import type { DownloadConfig, DownloadCapabilities } from '../../types/export';

/**
 * Enhanced download configuration with retry and error handling
 */
export interface EnhancedDownloadConfig extends DownloadConfig {
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  onRetry?: (attempt: number, error: Error) => void;
  onError?: (error: Error, canRetry: boolean) => void;
  timeout?: number; // milliseconds
  chunkSize?: number; // bytes for large file streaming
}

/**
 * Download result with detailed information
 */
export interface DownloadResult {
  success: boolean;
  error?: Error;
  retriesUsed: number;
  duration: number; // milliseconds
  bytesTransferred: number;
  cancelled: boolean;
}

/**
 * Download state for tracking active downloads
 */
interface DownloadState {
  id: string;
  config: EnhancedDownloadConfig;
  startTime: number;
  bytesTransferred: number;
  abortController: AbortController;
  retriesUsed: number;
}

/**
 * File download manager with cross-browser compatibility
 */
export class FileDownloadManager {
  private capabilities: DownloadCapabilities;
  private activeDownloads: Map<string, DownloadState> = new Map();
  private downloadHistory: DownloadResult[] = [];

  constructor() {
    this.capabilities = this.detectCapabilities();
  }

  /**
   * Detect browser download capabilities
   */
  private detectCapabilities(): DownloadCapabilities {
    // Check for File System Access API (modern browsers)
    const supportsFilesystemAPI = 'showSaveFilePicker' in window;

    // Check basic download support
    const supportsDownload = 'download' in HTMLAnchorElement.prototype;

    // Estimate maximum file size based on browser
    let maxFileSize = 500 * 1024 * 1024; // Default 500MB
    
    // Chrome/Edge can handle larger files
    if (navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Edg')) {
      maxFileSize = 2 * 1024 * 1024 * 1024; // 2GB
    }
    
    // Firefox has more conservative limits
    if (navigator.userAgent.includes('Firefox')) {
      maxFileSize = 800 * 1024 * 1024; // 800MB
    }

    // Safari is more limited
    if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
      maxFileSize = 300 * 1024 * 1024; // 300MB
    }

    return {
      supportsDownload,
      supportsFilesystemAPI,
      maxFileSize,
      supportedMimeTypes: [
        'application/sla', // STL
        'model/stl',
        'application/3mf', // 3MF
        'model/3mf',
        'application/octet-stream' // Fallback
      ]
    };
  }

  /**
   * Get current capabilities
   */
  getCapabilities(): DownloadCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Download file using the best available method with enhanced error handling
   */
  async downloadFile(data: Uint8Array, config: DownloadConfig): Promise<boolean> {
    const enhancedConfig: EnhancedDownloadConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      chunkSize: 64 * 1024,
      ...config,
    };

    const result = await this.downloadFileEnhanced(data, enhancedConfig);
    return result.success;
  }

  /**
   * Enhanced download with full result information
   */
  async downloadFileEnhanced(data: Uint8Array, config: EnhancedDownloadConfig): Promise<DownloadResult> {
    const downloadId = this.generateDownloadId();
    const startTime = Date.now();
    
    const downloadState: DownloadState = {
      id: downloadId,
      config,
      startTime,
      bytesTransferred: 0,
      abortController: new AbortController(),
      retriesUsed: 0,
    };

    this.activeDownloads.set(downloadId, downloadState);

    try {
      // Validate file size
      if (data.byteLength > this.capabilities.maxFileSize) {
        throw new Error(`File size (${Math.round(data.byteLength / 1024 / 1024)}MB) exceeds browser limit (${Math.round(this.capabilities.maxFileSize / 1024 / 1024)}MB)`);
      }

      let lastError: Error | null = null;
      const maxRetries = config.maxRetries || 3;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        downloadState.retriesUsed = attempt;

        try {
          if (downloadState.abortController.signal.aborted) {
            throw new Error('Download cancelled');
          }

          const success = await this.attemptDownload(data, config, downloadState);
          
          if (success) {
            const result: DownloadResult = {
              success: true,
              retriesUsed: attempt,
              duration: Date.now() - startTime,
              bytesTransferred: data.byteLength,
              cancelled: false,
            };

            this.downloadHistory.push(result);
            this.activeDownloads.delete(downloadId);
            
            if (config.onComplete) {
              config.onComplete(true);
            }

            return result;
          }
        } catch (error) {
          lastError = error as Error;
          
          // Don't retry certain errors
          if (this.isNonRetryableError(error as Error)) {
            break;
          }

          // Call retry callback
          if (config.onRetry && attempt < maxRetries) {
            config.onRetry(attempt + 1, error as Error);
          }

          // Wait before retry
          if (attempt < maxRetries && config.retryDelay) {
            await this.delay(config.retryDelay * (attempt + 1)); // Exponential backoff
          }
        }
      }

      // All retries failed
      const result: DownloadResult = {
        success: false,
        error: lastError || new Error('Download failed after all retries'),
        retriesUsed: maxRetries,
        duration: Date.now() - startTime,
        bytesTransferred: downloadState.bytesTransferred,
        cancelled: downloadState.abortController.signal.aborted,
      };

      this.downloadHistory.push(result);
      this.activeDownloads.delete(downloadId);

      if (config.onError) {
        config.onError(result.error!, false);
      }

      if (config.onComplete) {
        config.onComplete(false);
      }

      return result;

    } catch (error) {
      const result: DownloadResult = {
        success: false,
        error: error as Error,
        retriesUsed: downloadState.retriesUsed,
        duration: Date.now() - startTime,
        bytesTransferred: downloadState.bytesTransferred,
        cancelled: downloadState.abortController.signal.aborted,
      };

      this.downloadHistory.push(result);
      this.activeDownloads.delete(downloadId);

      if (config.onError) {
        config.onError(error as Error, !this.isNonRetryableError(error as Error));
      }

      if (config.onComplete) {
        config.onComplete(false);
      }

      return result;
    }
  }

  /**
   * Attempt a single download operation
   */
  private async attemptDownload(
    data: Uint8Array,
    config: EnhancedDownloadConfig,
    downloadState: DownloadState
  ): Promise<boolean> {
    // Set up timeout
    const timeoutId = config.timeout ? setTimeout(() => {
      downloadState.abortController.abort();
    }, config.timeout) : null;

    try {
      // Try File System Access API first (if available and requested)
      if (this.capabilities.supportsFilesystemAPI && config.saveDialog) {
        return await this.downloadWithFilesystemAPIEnhanced(data, config, downloadState);
      }

      // Fall back to traditional download
      if (this.capabilities.supportsDownload) {
        return await this.downloadWithAnchorEnhanced(data, config, downloadState);
      }

      throw new Error('Browser does not support file downloads');

    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Download using File System Access API (modern browsers)
   */
  private async downloadWithFilesystemAPI(data: Uint8Array, config: DownloadConfig): Promise<boolean> {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: config.filename,
        types: [{
          description: 'STL Files',
          accept: { [config.mimeType]: [this.getFileExtension(config.filename)] }
        }]
      });

      const writable = await fileHandle.createWritable();
      
      // Write in chunks if file is large
      const chunkSize = 64 * 1024; // 64KB chunks
      let written = 0;

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await writable.write(chunk);
        written += chunk.length;

        if (config.onProgress) {
          config.onProgress(written, data.length);
        }
      }

      await writable.close();

      if (config.onComplete) {
        config.onComplete(true);
      }

      return true;

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled, not an error
        return false;
      }
      throw error;
    }
  }

  /**
   * Download using traditional anchor element method
   */
  private async downloadWithAnchor(data: Uint8Array, config: DownloadConfig): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Create blob
        const blob = new Blob([data], { type: config.mimeType });
        const url = URL.createObjectURL(blob);

        // Create temporary anchor element
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = config.filename;
        anchor.style.display = 'none';

        // Add to DOM and trigger download
        document.body.appendChild(anchor);
        anchor.click();

        // Clean up
        document.body.removeChild(anchor);
        
        // Clean up object URL after a delay to ensure download starts
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);

        // Simulate progress for consistency
        if (config.onProgress) {
          let progress = 0;
          const interval = setInterval(() => {
            progress += 0.1;
            config.onProgress!(progress * data.length, data.length);
            
            if (progress >= 1) {
              clearInterval(interval);
              if (config.onComplete) {
                config.onComplete(true);
              }
              resolve(true);
            }
          }, 50);
        } else {
          if (config.onComplete) {
            config.onComplete(true);
          }
          resolve(true);
        }

      } catch (error) {
        console.error('Anchor download failed:', error);
        if (config.onComplete) {
          config.onComplete(false);
        }
        resolve(false);
      }
    });
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }

  /**
   * Check if file can be downloaded
   */
  canDownloadFile(size: number, mimeType: string): { canDownload: boolean; reason?: string } {
    if (size > this.capabilities.maxFileSize) {
      return {
        canDownload: false,
        reason: `File size (${Math.round(size / 1024 / 1024)}MB) exceeds browser limit (${Math.round(this.capabilities.maxFileSize / 1024 / 1024)}MB)`
      };
    }

    if (!this.capabilities.supportsDownload && !this.capabilities.supportsFilesystemAPI) {
      return {
        canDownload: false,
        reason: 'Browser does not support file downloads'
      };
    }

    return { canDownload: true };
  }

  /**
   * Enhanced File System Access API download with progress tracking
   */
  private async downloadWithFilesystemAPIEnhanced(
    data: Uint8Array,
    config: EnhancedDownloadConfig,
    downloadState: DownloadState
  ): Promise<boolean> {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: config.filename,
        types: [{
          description: this.getFileTypeDescription(config.filename),
          accept: { [config.mimeType]: [this.getFileExtension(config.filename)] }
        }]
      });

      const writable = await fileHandle.createWritable();
      
      // Write in chunks with progress reporting
      const chunkSize = config.chunkSize || 64 * 1024;
      let written = 0;

      for (let i = 0; i < data.length; i += chunkSize) {
        if (downloadState.abortController.signal.aborted) {
          await writable.abort();
          throw new Error('Download cancelled');
        }

        const chunk = data.slice(i, i + chunkSize);
        await writable.write(chunk);
        written += chunk.length;
        downloadState.bytesTransferred = written;

        if (config.onProgress) {
          config.onProgress(written, data.length);
        }

        // Small delay to prevent blocking UI
        if (i % (chunkSize * 10) === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      await writable.close();
      return true;

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled, not an error
        return false;
      }
      throw error;
    }
  }

  /**
   * Enhanced anchor download with better progress simulation
   */
  private async downloadWithAnchorEnhanced(
    data: Uint8Array,
    config: EnhancedDownloadConfig,
    downloadState: DownloadState
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        if (downloadState.abortController.signal.aborted) {
          reject(new Error('Download cancelled'));
          return;
        }

        // Create blob
        const blob = new Blob([data], { type: config.mimeType });
        const url = URL.createObjectURL(blob);

        // Create temporary anchor element
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = config.filename;
        anchor.style.display = 'none';

        // Add to DOM and trigger download
        document.body.appendChild(anchor);
        anchor.click();

        // Clean up immediately
        document.body.removeChild(anchor);
        
        // Better progress simulation
        if (config.onProgress) {
          let progress = 0;
          const totalSteps = 20;
          const stepSize = data.length / totalSteps;
          
          const interval = setInterval(() => {
            if (downloadState.abortController.signal.aborted) {
              clearInterval(interval);
              URL.revokeObjectURL(url);
              reject(new Error('Download cancelled'));
              return;
            }

            progress += stepSize;
            downloadState.bytesTransferred = Math.min(progress, data.length);
            config.onProgress!(downloadState.bytesTransferred, data.length);
            
            if (progress >= data.length) {
              clearInterval(interval);
              URL.revokeObjectURL(url);
              resolve(true);
            }
          }, 100);
        } else {
          // Clean up object URL after delay
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 1000);
          resolve(true);
        }

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Cancel active download
   */
  cancelDownload(downloadId?: string): boolean {
    if (downloadId) {
      const downloadState = this.activeDownloads.get(downloadId);
      if (downloadState) {
        downloadState.abortController.abort();
        return true;
      }
      return false;
    }

    // Cancel all active downloads
    let cancelled = 0;
    for (const downloadState of this.activeDownloads.values()) {
      downloadState.abortController.abort();
      cancelled++;
    }

    return cancelled > 0;
  }

  /**
   * Get active downloads
   */
  getActiveDownloads(): string[] {
    return Array.from(this.activeDownloads.keys());
  }

  /**
   * Get download history
   */
  getDownloadHistory(): DownloadResult[] {
    return [...this.downloadHistory];
  }

  /**
   * Clear download history
   */
  clearHistory(): void {
    this.downloadHistory = [];
  }

  /**
   * Utility methods
   */
  private generateDownloadId(): string {
    return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isNonRetryableError(error: Error): boolean {
    const nonRetryableMessages = [
      'Download cancelled',
      'User cancelled',
      'File size exceeds',
      'Browser does not support',
      'Invalid filename',
      'Permission denied'
    ];

    return nonRetryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getFileTypeDescription(filename: string): string {
    const ext = this.getFileExtension(filename).toLowerCase();
    const descriptions: Record<string, string> = {
      '.stl': 'STL 3D Model Files',
      '.3mf': '3MF 3D Manufacturing Files',
      '.obj': 'OBJ 3D Model Files',
      '.ply': 'PLY 3D Model Files'
    };

    return descriptions[ext] || '3D Model Files';
  }

  /**
   * Create download manager instance
   */
  static create(): FileDownloadManager {
    return new FileDownloadManager();
  }

  /**
   * Quick download method for simple use cases
   */
  static async quickDownload(
    data: Uint8Array,
    filename: string,
    mimeType: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<boolean> {
    const manager = new FileDownloadManager();
    return await manager.downloadFile(data, {
      filename,
      mimeType,
      saveDialog: true,
      onProgress,
      onComplete: (success) => {
        if (!success) {
          console.error('Download failed');
        }
      }
    });
  }
}

/**
 * Utility functions for file operations
 */
export class FileUtils {
  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
  }

  /**
   * Generate safe filename
   */
  static sanitizeFilename(filename: string): string {
    // Remove or replace invalid characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/[\x00-\x1f\x80-\x9f]/g, '')
      .replace(/^\.+/, '')
      .trim();
  }

  /**
   * Get MIME type from file extension
   */
  static getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.stl': 'application/sla',
      '.3mf': 'application/3mf',
      '.obj': 'application/x-tgif',
      '.ply': 'application/octet-stream'
    };

    const ext = extension.toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Validate filename
   */
  static validateFilename(filename: string): { valid: boolean; reason?: string } {
    if (!filename) {
      return { valid: false, reason: 'Filename cannot be empty' };
    }

    if (filename.length > 255) {
      return { valid: false, reason: 'Filename too long (max 255 characters)' };
    }

    const invalidChars = /[<>:"/\\|?*\x00-\x1f\x80-\x9f]/;
    if (invalidChars.test(filename)) {
      return { valid: false, reason: 'Filename contains invalid characters' };
    }

    const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    const nameWithoutExt = filename.split('.')[0];
    if (reservedNames.test(nameWithoutExt)) {
      return { valid: false, reason: 'Filename uses reserved name' };
    }

    return { valid: true };
  }

  /**
   * Generate unique filename if file already exists
   */
  static generateUniqueFilename(baseFilename: string, existingNames: string[]): string {
    let filename = baseFilename;
    let counter = 1;

    const extension = this.getFileExtension(baseFilename);
    const baseName = baseFilename.replace(extension, '');

    while (existingNames.includes(filename)) {
      filename = `${baseName} (${counter})${extension}`;
      counter++;
    }

    return filename;
  }

  /**
   * Extract file extension including dot
   */
  private static getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex >= 0 ? filename.substring(lastDotIndex) : '';
  }
}