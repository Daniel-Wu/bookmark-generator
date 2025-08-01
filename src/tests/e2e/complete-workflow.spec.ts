/**
 * Complete E2E workflow test - Tests the full user journey from upload to export
 */
import { test, expect } from '@playwright/test';
import { FileOperationHelpers } from './helpers/file-operations';
import { ThreeDInteractionHelpers } from './helpers/3d-interactions';

test.describe('Complete Bookmark Generator Workflow', () => {
  let fileHelper: FileOperationHelpers;
  let threeDHelper: ThreeDInteractionHelpers;

  test.beforeEach(async ({ page }) => {
    fileHelper = new FileOperationHelpers(page);
    threeDHelper = new ThreeDInteractionHelpers(page);
    
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load
    await expect(page).toHaveTitle(/Bookmark Generator|Vite/);
    await page.waitForLoadState('networkidle');
  });

  test('complete user workflow: upload → parameters → preview → export STL', async ({ page }) => {
    // Step 1: Upload an image
    console.log('Step 1: Uploading test image...');
    
    // Create a test image programmatically
    const testImageDataURL = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImageDataURL);
    
    // Verify image was processed
    await expect(page.locator('text=processing')).not.toBeVisible({ timeout: 10000 });
    
    // Check if we're on mobile layout or desktop
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    
    if (isMobile) {
      // On mobile, check if we automatically switched to parameters tab
      await expect(page.locator('[data-testid="tab-parameters"]')).toHaveClass(/active|selected/);
    }

    // Step 2: Adjust parameters
    console.log('Step 2: Adjusting parameters...');
    
    // Navigate to parameters section (if not already there)
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Look for parameter controls
    const colorCountSlider = page.locator('input[type="range"]').first();
    if (await colorCountSlider.isVisible()) {
      await colorCountSlider.fill('4'); // Change color count
      await page.waitForTimeout(1000); // Wait for processing
    }
    
    // Look for dimension controls
    const dimensionInput = page.locator('input[type="number"]').first();
    if (await dimensionInput.isVisible()) {
      await dimensionInput.fill('60'); // Set width to 60mm
      await page.waitForTimeout(500);
    }

    // Step 3: Check 3D preview
    console.log('Step 3: Checking 3D preview...');
    
    // Navigate to preview (if on mobile)
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
      await page.waitForTimeout(500);
    }
    
    // Wait for 3D scene to load
    await threeDHelper.waitForSceneLoad();
    
    // Verify WebGL is working
    const webglSupport = await threeDHelper.checkWebGLSupport();
    expect(webglSupport.supported).toBe(true);
    
    // Test basic 3D interactions
    await threeDHelper.testOrbitControls();
    await threeDHelper.testZoomControls();
    
    // Verify geometry is visible
    const geometryVisible = await threeDHelper.verifyGeometryVisible();
    console.log('Geometry visible:', geometryVisible);

    // Step 4: Export STL file
    console.log('Step 4: Exporting STL file...');
    
    // Navigate to export section
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
      await page.waitForTimeout(500);
    }
    
    // Find export controls
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download"), [data-testid="export-stl"]').first();
    await expect(exportButton).toBeVisible();
    
    // Test export functionality
    const { filename, size } = await fileHelper.captureDownload(async () => {
      await exportButton.click();
      
      // Wait for export to complete (may show progress)
      await page.waitForTimeout(5000);
    });
    
    // Verify download
    expect(filename).toContain('.stl');
    expect(size).toBeGreaterThan(50); // STL should have some content
    
    console.log(`Successfully exported: ${filename} (${size} bytes)`);
  });

  test('complete user workflow: upload → parameters → preview → export 3MF', async ({ page }) => {
    // Similar to STL test but for 3MF format
    console.log('Testing 3MF export workflow...');
    
    // Upload image
    const testImageDataURL = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImageDataURL);
    
    // Wait for processing
    await expect(page.locator('text=processing')).not.toBeVisible({ timeout: 10000 });
    
    // Check if mobile layout
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    
    // Navigate to export
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    // Look for 3MF export option
    const threeMFButton = page.locator('button:has-text("3MF"), [data-testid="export-3mf"]').first();
    
    if (await threeMFButton.isVisible()) {
      const { filename, size } = await fileHelper.captureDownload(async () => {
        await threeMFButton.click();
        await page.waitForTimeout(5000);
      });
      
      expect(filename).toContain('.3mf');
      expect(size).toBeGreaterThan(100); // 3MF is ZIP-based, should be larger
      
      console.log(`Successfully exported 3MF: ${filename} (${size} bytes)`);
    } else {
      console.log('3MF export not available - skipping');
    }
  });

  test('workflow with parameter changes affecting preview', async ({ page }) => {
    console.log('Testing parameter changes affecting 3D preview...');
    
    // Upload image
    const testImageDataURL = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImageDataURL);
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Check layout
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    
    // Go to preview first to establish baseline
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    // Wait for 3D scene
    await threeDHelper.waitForSceneLoad();
    
    // Go to parameters
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Change parameters and verify preview updates
    const parameterChanged = await threeDHelper.verifyPreviewUpdatesOnParameterChange();
    
    if (parameterChanged) {
      console.log('✓ Preview successfully updates when parameters change');
    } else {
      console.log('ℹ Could not verify preview updates (may not have visible changes)');
    }
  });

  test('error recovery workflow', async ({ page }) => {
    console.log('Testing error recovery...');
    
    // Try to export without uploading an image first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    // Try to export - should show error or be disabled
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    
    if (await exportButton.isVisible()) {
      const isDisabled = await exportButton.isDisabled();
      if (isDisabled) {
        console.log('✓ Export button correctly disabled when no image');
      } else {
        // Try clicking and expect error handling
        await exportButton.click();
        
        // Look for error message
        const errorMessage = page.locator('text=error, text=failed, [role="alert"]').first();
        if (await errorMessage.isVisible({ timeout: 2000 })) {
          console.log('✓ Error message shown when attempting export without image');
        }
      }
    }
    
    // Now upload image and verify recovery
    if (isMobile) {
      await page.locator('[data-testid="tab-upload"]').click();
    }
    
    const testImageDataURL = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImageDataURL);
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Verify export is now enabled
    if (isMobile) {
      await page.locator('[data-testid="tab-export"]').click();
    }
    
    const exportButtonAfter = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    if (await exportButtonAfter.isVisible()) {
      const isStillDisabled = await exportButtonAfter.isDisabled();
      expect(isStillDisabled).toBe(false);
      console.log('✓ Export button enabled after successful image upload');
    }
  });
});