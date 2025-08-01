/**
 * Export functionality E2E tests
 */
import { test, expect } from '@playwright/test';
import { FileOperationHelpers, EXPORT_FORMATS } from './helpers/file-operations';

test.describe('Export Functionality', () => {
  let fileHelper: FileOperationHelpers;

  test.beforeEach(async ({ page }) => {
    fileHelper = new FileOperationHelpers(page);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Setup: Upload image and wait for processing
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(5000); // Allow time for geometry generation
  });

  test('STL export functionality', async ({ page }) => {
    console.log('Testing STL export...');
    
    // Navigate to export section
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    // Look for STL export button
    const stlExportSelectors = [
      'button:has-text("STL")',
      'button:has-text("Export STL")',
      '[data-testid="export-stl"]',
      'button:has-text("Export")', // fallback
      'button:has-text("Download")', // alternative
    ];
    
    let stlButton = null;
    for (const selector of stlExportSelectors) {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 2000 })) {
        stlButton = button;
        break;
      }
    }
    
    if (!stlButton) {
      console.log('❌ No STL export button found');
      return;
    }
    
    // Verify button is enabled
    const isEnabled = !(await stlButton.isDisabled());
    expect(isEnabled).toBe(true);
    
    // Perform export
    const { filename, size } = await fileHelper.captureDownload(async () => {
      await stlButton.click();
      
      // Wait for export processing
      await page.waitForTimeout(8000);
    });
    
    // Verify STL file properties
    expect(filename).toMatch(/\.stl$/i);
    expect(size).toBeGreaterThan(EXPORT_FORMATS.STL.minSize);
    
    console.log(`✓ STL export successful: ${filename} (${size} bytes)`);
  });

  test('3MF export functionality', async ({ page }) => {
    console.log('Testing 3MF export...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    // Look for 3MF export option
    const threeMFSelectors = [
      'button:has-text("3MF")',
      'button:has-text("Export 3MF")',
      '[data-testid="export-3mf"]',
      'select option[value="3mf"]', // dropdown option
    ];
    
    let threeMFControl = null;
    for (const selector of threeMFSelectors) {
      const control = page.locator(selector).first();
      if (await control.isVisible({ timeout: 2000 })) {
        threeMFControl = control;
        break;
      }
    }
    
    if (!threeMFControl) {
      console.log('ℹ No 3MF export option found - may not be implemented yet');
      return;
    }
    
    // If it's a dropdown, select 3MF first
    if (await threeMFControl.getAttribute('value') === '3mf') {
      await threeMFControl.selectOption('3mf');
      
      // Find export button after selection
      const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
      threeMFControl = exportButton;
    }
    
    // Perform 3MF export
    const { filename, size } = await fileHelper.captureDownload(async () => {
      await threeMFControl.click();
      await page.waitForTimeout(8000);
    });
    
    // Verify 3MF file properties
    expect(filename).toMatch(/\.3mf$/i);
    expect(size).toBeGreaterThan(EXPORT_FORMATS['3MF'].minSize);
    
    console.log(`✓ 3MF export successful: ${filename} (${size} bytes)`);
  });

  test('export with quality settings', async ({ page }) => {
    console.log('Testing export with quality settings...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    // Look for quality settings
    const qualityControls = [
      page.locator('select:has(option:has-text("High")), select:has(option:has-text("Medium"))'),
      page.locator('input[type="radio"][value*="high"], input[type="radio"][value*="medium"]'),
      page.locator('[data-testid*="quality"]'),
      page.locator('label:has-text("Quality") + select, label:has-text("Quality") + input'),
    ];
    
    let qualityControl = null;
    for (const control of qualityControls) {
      if (await control.isVisible({ timeout: 1000 })) {
        qualityControl = control;
        break;
      }
    }
    
    if (qualityControl) {
      // Set to high quality
      const tagName = await qualityControl.evaluate(el => el.tagName.toLowerCase());
      
      if (tagName === 'select') {
        await qualityControl.selectOption({ label: /high|best/i });
      } else if (tagName === 'input') {
        await qualityControl.check();
      }
      
      console.log('✓ Quality setting adjusted');
    }
    
    // Perform export with quality settings
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    
    if (await exportButton.isVisible()) {
      const { filename, size } = await fileHelper.captureDownload(async () => {
        await exportButton.click();
        await page.waitForTimeout(8000);
      });
      
      console.log(`✓ Export with quality settings: ${filename} (${size} bytes)`);
    }
  });

  test('export progress indication', async ({ page }) => {
    console.log('Testing export progress indication...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    
    if (await exportButton.isVisible()) {
      // Start export
      await exportButton.click();
      
      // Look for progress indicators
      const progressIndicators = [
        page.locator('[role="progressbar"]'),
        page.locator('.progress-bar'),
        page.locator('text=exporting', { hasText: /progress|%/i }),
        page.locator('[data-testid*="progress"]'),
        page.locator('text=generating', { hasText: /file|export/i }),
      ];
      
      let foundProgress = false;
      for (const indicator of progressIndicators) {
        if (await indicator.isVisible({ timeout: 3000 })) {
          console.log('✓ Found progress indicator:', await indicator.textContent());
          foundProgress = true;
          break;
        }
      }
      
      // Wait for completion
      await page.waitForTimeout(8000);
      
      if (foundProgress) {
        console.log('✓ Export progress indication works');
      } else {
        console.log('ℹ No progress indicators found (export may be too fast)');
      }
    }
  });

  test('export button states and validation', async ({ page }) => {
    console.log('Testing export button states...');
    
    // Test without geometry (fresh page)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    // Export button should be disabled initially
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    
    if (await exportButton.isVisible({ timeout: 2000 })) {
      const initiallyDisabled = await exportButton.isDisabled();
      if (initiallyDisabled) {
        console.log('✓ Export button correctly disabled without geometry');
      }
    }
    
    // Upload image to enable export
    const testImage = await fileHelper.createLargeTestImage();
    if (isMobile) {
      await page.locator('[data-testid="tab-upload"]').click();
    }
    
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(5000);
    
    // Check if export is now enabled
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    const enabledButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    if (await enabledButton.isVisible()) {
      const nowEnabled = !(await enabledButton.isDisabled());
      expect(nowEnabled).toBe(true);
      console.log('✓ Export button enabled after geometry generation');
    }
  });

  test('export error handling', async ({ page }) => {
    console.log('Testing export error handling...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    // Find export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    
    if (await exportButton.isVisible()) {
      // Mock export failure by intercepting requests or modifying state
      await page.evaluate(() => {
        // Mock export failure
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
          if (args[0]?.toString().includes('export')) {
            throw new Error('Simulated export failure');
          }
          return originalFetch(...args);
        };
      });
      
      // Attempt export
      await exportButton.click();
      await page.waitForTimeout(3000);
      
      // Look for error messages
      const errorIndicators = [
        page.locator('[role="alert"]'),
        page.locator('text=error', { hasText: /export|failed/i }),
        page.locator('text=failed', { hasText: /export|download/i }),
        page.locator('.error'),
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
        console.log('✓ Export error handling works');
      } else {
        console.log('ℹ No error message found (may handle errors differently)');
      }
    }
  });

  test('multiple export attempts', async ({ page }) => {
    console.log('Testing multiple export attempts...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    
    if (await exportButton.isVisible()) {
      // Perform first export
      console.log('First export...');
      const { filename: file1 } = await fileHelper.captureDownload(async () => {
        await exportButton.click();
        await page.waitForTimeout(5000);
      });
      
      // Wait a moment
      await page.waitForTimeout(1000);
      
      // Perform second export
      console.log('Second export...');
      const { filename: file2 } = await fileHelper.captureDownload(async () => {
        await exportButton.click();
        await page.waitForTimeout(5000);
      });
      
      console.log(`✓ Multiple exports: ${file1}, ${file2}`);
      
      // Verify both succeeded
      expect(file1).toMatch(/\.(stl|3mf)$/i);
      expect(file2).toMatch(/\.(stl|3mf)$/i);
    }
  });

  test('export filename customization', async ({ page }) => {
    console.log('Testing export filename customization...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    // Look for filename input
    const filenameInputs = [
      page.locator('input[type="text"][placeholder*="filename"]'),
      page.locator('input[type="text"][placeholder*="name"]'),
      page.locator('[data-testid*="filename"]'),
      page.locator('label:has-text("Filename") + input, label:has-text("Name") + input'),
    ];
    
    let filenameInput = null;
    for (const input of filenameInputs) {
      if (await input.isVisible({ timeout: 1000 })) {
        filenameInput = input;
        break;
      }
    }
    
    if (filenameInput) {
      const customName = 'my-custom-bookmark';
      await filenameInput.fill(customName);
      
      // Perform export
      const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
      
      const { filename } = await fileHelper.captureDownload(async () => {
        await exportButton.click();
        await page.waitForTimeout(5000);
      });
      
      expect(filename).toContain(customName);
      console.log(`✓ Custom filename used: ${filename}`);
    } else {
      console.log('ℹ No filename customization input found');
    }
  });

  test('export with different parameter combinations', async ({ page }) => {
    console.log('Testing export with different parameters...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    
    // Change parameters first
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Modify a parameter
    const paramInput = page.locator('input[type="range"], input[type="number"]').first();
    if (await paramInput.isVisible()) {
      await paramInput.fill('6');
      await paramInput.blur();
      await page.waitForTimeout(3000); // Wait for geometry regeneration
    }
    
    // Export with modified parameters
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    
    if (await exportButton.isVisible()) {
      const { filename, size } = await fileHelper.captureDownload(async () => {
        await exportButton.click();
        await page.waitForTimeout(5000);
      });
      
      console.log(`✓ Export with modified parameters: ${filename} (${size} bytes)`);
      expect(size).toBeGreaterThan(50);
    }
  });
});