/**
 * Helper functions for file operations in E2E tests
 */
import { Page, expect } from '@playwright/test';
import path from 'path';

export class FileOperationHelpers {
  constructor(private page: Page) {}

  /**
   * Upload a test image file
   */
  async uploadTestImage(filename: string = 'test-image-small.png') {
    const filePath = path.join(__dirname, '..', 'fixtures', filename);
    
    // Look for file input (could be hidden)
    const fileInput = await this.page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();
    
    // Upload the file
    await fileInput.setInputFiles(filePath);
    
    // Wait for upload processing to complete
    await this.page.waitForTimeout(2000); // Give time for processing
  }

  /**
   * Wait for and capture a download
   */
  async captureDownload(triggerAction: () => Promise<void>) {
    // Start waiting for download before clicking
    const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });
    
    // Trigger the download
    await triggerAction();
    
    // Wait for download to complete
    const download = await downloadPromise;
    
    // Get download info
    const filename = download.suggestedFilename();
    const size = await this.getDownloadSize(download);
    
    return { download, filename, size };
  }

  /**
   * Get download file size (approximate)
   */
  private async getDownloadSize(download: any): Promise<number> {
    try {
      // Save to temporary path to check size
      const tempPath = await download.path();
      if (tempPath) {
        const fs = await import('fs');
        const stats = fs.statSync(tempPath);
        return stats.size;
      }
    } catch (error) {
      console.warn('Could not determine download size:', error);
    }
    return 0;
  }

  /**
   * Verify that a download occurred and has reasonable properties
   */
  async verifyDownload(filename: string, expectedExtension: string, minSize: number = 100) {
    const { download, filename: actualFilename, size } = await this.captureDownload(async () => {
      // This will be called by the test to trigger download
    });

    expect(actualFilename).toContain(expectedExtension);
    expect(size).toBeGreaterThan(minSize);
    
    return { download, filename: actualFilename, size };
  }

  /**
   * Create a larger test image programmatically
   */
  async createLargeTestImage(): Promise<string> {
    // Create a canvas and generate a test pattern
    const canvas = await this.page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Could not get canvas context');
      
      // Create a simple pattern
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, 0, 133, 300);
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(133, 0, 134, 300);
      ctx.fillStyle = '#0000FF';
      ctx.fillRect(267, 0, 133, 300);
      
      return canvas.toDataURL('image/png');
    });
    
    return canvas;
  }

  /**
   * Upload image from data URL
   */
  async uploadImageFromDataURL(dataURL: string, filename: string = 'generated-test.png') {
    // Convert data URL to blob and upload
    await this.page.evaluate(async (dataURL) => {
      // Convert data URL to blob
      const response = await fetch(dataURL);
      const blob = await response.blob();
      
      // Create file object
      const file = new File([blob], 'test-image.png', { type: 'image/png' });
      
      // Find file input and set files
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        
        // Trigger change event
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, dataURL);
    
    // Wait for processing
    await this.page.waitForTimeout(3000);
  }
}

/**
 * Test data constants
 */
export const TEST_FILES = {
  SMALL_PNG: 'test-image-small.png',
  INVALID_FILE: 'invalid-file.txt',
} as const;

/**
 * Expected file formats for exports
 */
export const EXPORT_FORMATS = {
  STL: { extension: '.stl', mimeType: 'model/stl', minSize: 84 }, // STL header is 80 bytes + 4 bytes count
  '3MF': { extension: '.3mf', mimeType: 'model/3mf', minSize: 100 }, // ZIP-based format
} as const;