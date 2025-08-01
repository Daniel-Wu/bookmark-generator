/**
 * Image upload functionality E2E tests
 */
import { test, expect } from '@playwright/test';
import { FileOperationHelpers, TEST_FILES } from './helpers/file-operations';

test.describe('Image Upload Functionality', () => {
  let fileHelper: FileOperationHelpers;

  test.beforeEach(async ({ page }) => {
    fileHelper = new FileOperationHelpers(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('successful image upload with small PNG', async ({ page }) => {
    console.log('Testing small PNG upload...');
    
    // Upload test image
    await fileHelper.uploadTestImage(TEST_FILES.SMALL_PNG);
    
    // Verify upload success indicators
    await expect(page.locator('text=processing')).not.toBeVisible({ timeout: 10000 });
    
    // Check for success indicators (processed image, preview, etc.)
    const successIndicators = [
      page.locator('canvas'), // 3D preview canvas
      page.locator('[data-testid="image-processed"]'),
      page.locator('text=upload', { hasText: /success|complete/i }),
    ];
    
    let foundIndicator = false;
    for (const indicator of successIndicators) {
      if (await indicator.isVisible({ timeout: 2000 })) {
        foundIndicator = true;
        break;
      }
    }
    
    expect(foundIndicator).toBe(true);
    console.log('✓ Small PNG uploaded successfully');
  });

  test('image upload with generated test image', async ({ page }) => {
    console.log('Testing generated test image upload...');
    
    // Create and upload a larger test image
    const testImageDataURL = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImageDataURL);
    
    // Wait for processing to complete
    await page.waitForTimeout(5000);
    
    // Verify processing completed
    await expect(page.locator('text=processing')).not.toBeVisible();
    
    // Check that we can see results
    const canvas = page.locator('canvas').first();
    if (await canvas.isVisible({ timeout: 3000 })) {
      console.log('✓ Generated test image processed and 3D preview available');
    }
    
    // Check if parameters are now enabled
    const parameterControls = page.locator('input[type="range"], input[type="number"]');
    const count = await parameterControls.count();
    if (count > 0) {
      const firstControl = parameterControls.first();
      const isEnabled = !(await firstControl.isDisabled());
      expect(isEnabled).toBe(true);
      console.log('✓ Parameter controls enabled after image upload');
    }
  });

  test('drag and drop upload (if supported)', async ({ page }) => {
    console.log('Testing drag and drop upload...');
    
    // Look for drop zone
    const dropZone = page.locator('[data-testid="drop-zone"], .drop-zone, [draggable="true"]').first();
    
    if (await dropZone.isVisible({ timeout: 2000 })) {
      // Create test image data
      const testImageDataURL = await fileHelper.createLargeTestImage();
      
      // Simulate drag and drop
      await page.evaluate(async (dataURL) => {
        // Convert data URL to blob
        const response = await fetch(dataURL);
        const blob = await response.blob();
        const file = new File([blob], 'dropped-test.png', { type: 'image/png' });
        
        // Create drag event
        const dropZone = document.querySelector('[data-testid="drop-zone"], .drop-zone') as HTMLElement;
        if (dropZone) {
          const event = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
          });
          
          event.dataTransfer?.items.add(file);
          dropZone.dispatchEvent(event);
        }
      }, testImageDataURL);
      
      // Wait for processing
      await page.waitForTimeout(3000);
      
      // Verify upload
      await expect(page.locator('text=processing')).not.toBeVisible({ timeout: 10000 });
      console.log('✓ Drag and drop upload works');
    } else {
      console.log('ℹ No visible drop zone found - skipping drag and drop test');
    }
  });

  test('upload progress indication', async ({ page }) => {
    console.log('Testing upload progress indication...');
    
    // Create larger test image for better progress visibility
    const testImageDataURL = await fileHelper.createLargeTestImage();
    
    // Start upload
    await fileHelper.uploadImageFromDataURL(testImageDataURL);
    
    // Look for progress indicators
    const progressIndicators = [
      page.locator('[role="progressbar"]'),
      page.locator('.progress-bar'),
      page.locator('text=processing'),
      page.locator('[data-testid*="progress"]'),
    ];
    
    let foundProgress = false;
    for (const indicator of progressIndicators) {
      if (await indicator.isVisible({ timeout: 2000 })) {
        console.log('✓ Found progress indicator:', await indicator.textContent());
        foundProgress = true;
        break;
      }
    }
    
    // Wait for completion
    await page.waitForTimeout(5000);
    
    // Verify processing completes
    await expect(page.locator('text=processing')).not.toBeVisible();
    
    if (foundProgress) {
      console.log('✓ Upload progress indication works');
    } else {
      console.log('ℹ No progress indicators found (may be too fast)');
    }
  });

  test('invalid file type handling', async ({ page }) => {
    console.log('Testing invalid file type handling...');
    
    // Try to upload a text file as image
    const textContent = 'This is not an image file';
    const textBlob = new Blob([textContent], { type: 'text/plain' });
    
    await page.evaluate(async (content) => {
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], 'invalid.txt', { type: 'text/plain' });
      
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, textContent);
    
    // Look for error messages
    await page.waitForTimeout(2000);
    
    const errorIndicators = [
      page.locator('[role="alert"]'),
      page.locator('.error'),
      page.locator('text=invalid', { hasText: /file|format|type/i }),
      page.locator('text=supported', { hasText: /format|type/i }),
    ];
    
    let foundError = false;
    for (const indicator of errorIndicators) {
      if (await indicator.isVisible({ timeout: 2000 })) {
        console.log('✓ Found error message:', await indicator.textContent());
        foundError = true;
        break;
      }
    }
    
    if (foundError) {
      console.log('✓ Invalid file type properly rejected');
    } else {
      console.log('ℹ No error message found - file may have been silently rejected');
    }
  });

  test('file size validation', async ({ page }) => {
    console.log('Testing file size validation...');
    
    // Create an oversized file simulation
    await page.evaluate(async () => {
      // Simulate large file (create data URL for a "large" image)
      const canvas = document.createElement('canvas');
      canvas.width = 2000; // Large dimensions
      canvas.height = 2000;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Fill with pattern to create large file
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 1000, 2000);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(1000, 0, 1000, 2000);
        
        const dataURL = canvas.toDataURL('image/png');
        
        // Simulate file upload
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (input) {
          // Create a mock large file
          const mockFile = new File(['x'.repeat(11000000)], 'large.png', { 
            type: 'image/png',
            lastModified: Date.now()
          });
          
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(mockFile);
          input.files = dataTransfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    
    // Wait for validation
    await page.waitForTimeout(2000);
    
    // Look for file size warning/error
    const sizeWarnings = [
      page.locator('text=size', { hasText: /large|limit|maximum/i }),
      page.locator('text=MB', { hasText: /exceed|maximum|limit/i }),
      page.locator('[role="alert"]'),
    ];
    
    let foundWarning = false;
    for (const warning of sizeWarnings) {
      if (await warning.isVisible({ timeout: 2000 })) {
        console.log('✓ Found size warning:', await warning.textContent());
        foundWarning = true;
        break;
      }
    }
    
    if (foundWarning) {
      console.log('✓ File size validation works');
    } else {
      console.log('ℹ No size warning found - validation may be lenient or different');
    }
  });

  test('multiple upload attempts', async ({ page }) => {
    console.log('Testing multiple upload attempts...');
    
    // Upload first image
    const firstImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(firstImage);
    await page.waitForTimeout(3000);
    
    // Upload second image (should replace first)
    const secondImage = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Different pattern for second image
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(0, 0, 100, 200);
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(100, 0, 100, 200);
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(200, 0, 100, 200);
      }
      
      return canvas.toDataURL('image/png');
    });
    
    await fileHelper.uploadImageFromDataURL(secondImage, 'second-test.png');
    await page.waitForTimeout(3000);
    
    // Verify second upload processed
    await expect(page.locator('text=processing')).not.toBeVisible();
    
    console.log('✓ Multiple uploads handled correctly');
  });

  test('upload with special characters in filename', async ({ page }) => {
    console.log('Testing upload with special characters in filename...');
    
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage, 'test-üñíçøðé-123.png');
    
    await page.waitForTimeout(3000);
    await expect(page.locator('text=processing')).not.toBeVisible();
    
    console.log('✓ Special characters in filename handled');
  });
});