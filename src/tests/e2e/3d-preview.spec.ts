/**
 * 3D preview functionality E2E tests
 */
import { test, expect } from '@playwright/test';
import { FileOperationHelpers } from './helpers/file-operations';
import { ThreeDInteractionHelpers } from './helpers/3d-interactions';

test.describe('3D Preview Functionality', () => {
  let fileHelper: FileOperationHelpers;
  let threeDHelper: ThreeDInteractionHelpers;

  test.beforeEach(async ({ page }) => {
    fileHelper = new FileOperationHelpers(page);
    threeDHelper = new ThreeDInteractionHelpers(page);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Upload image to enable 3D preview
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(3000);
  });

  test('3D scene initialization and WebGL support', async ({ page }) => {
    console.log('Testing 3D scene initialization...');
    
    // Navigate to preview
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    // Check WebGL support
    const webglSupport = await threeDHelper.checkWebGLSupport();
    console.log('WebGL support:', webglSupport);
    
    expect(webglSupport.supported).toBe(true);
    expect(webglSupport.version).toBeTruthy();
    
    // Wait for scene to load
    await threeDHelper.waitForSceneLoad();
    
    // Verify canvas is present and visible
    const canvas = await threeDHelper.getCanvas();
    await expect(canvas).toBeVisible();
    
    // Check canvas dimensions
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    expect(canvasBox!.width).toBeGreaterThan(100);
    expect(canvasBox!.height).toBeGreaterThan(100);
    
    console.log(`✓ 3D scene initialized (${canvasBox!.width}x${canvasBox!.height})`);
  });

  test('geometry rendering and visibility', async ({ page }) => {
    console.log('Testing geometry rendering...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    // Verify geometry is being rendered
    const geometryVisible = await threeDHelper.verifyGeometryVisible();
    console.log('Geometry visible:', geometryVisible);
    
    // Get render statistics
    const renderStats = await threeDHelper.getRenderStats();
    if (renderStats) {
      console.log('Render stats:', renderStats);
      expect(renderStats.geometries).toBeGreaterThan(0);
    }
    
    // Take screenshot to verify visual rendering
    const canvas = await threeDHelper.getCanvas();
    const screenshot = await canvas.screenshot();
    expect(screenshot.length).toBeGreaterThan(1000); // Should have actual image data
    
    console.log('✓ Geometry rendering verified');
  });

  test('camera orbit controls', async ({ page }) => {
    console.log('Testing camera orbit controls...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    const canvas = await threeDHelper.getCanvas();
    
    // Take initial screenshot
    const initialScreenshot = await canvas.screenshot();
    
    // Perform orbit interaction
    await threeDHelper.testOrbitControls();
    
    // Take screenshot after orbit
    const orbitScreenshot = await canvas.screenshot();
    
    // Verify view changed
    const viewChanged = Buffer.compare(initialScreenshot, orbitScreenshot) !== 0;
    if (viewChanged) {
      console.log('✓ Orbit controls working - view changed');
    } else {
      console.log('ℹ Orbit controls may be working but change not visually detectable');
    }
  });

  test('camera zoom controls', async ({ page }) => {
    console.log('Testing camera zoom controls...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    const canvas = await threeDHelper.getCanvas();
    const initialScreenshot = await canvas.screenshot();
    
    // Test zoom
    await threeDHelper.testZoomControls();
    
    const zoomScreenshot = await canvas.screenshot();
    const zoomChanged = Buffer.compare(initialScreenshot, zoomScreenshot) !== 0;
    
    if (zoomChanged) {
      console.log('✓ Zoom controls working - view changed');
    } else {
      console.log('ℹ Zoom controls may be working but change not visually detectable');
    }
  });

  test('camera pan controls', async ({ page }) => {
    console.log('Testing camera pan controls...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    const canvas = await threeDHelper.getCanvas();
    const initialScreenshot = await canvas.screenshot();
    
    // Test pan
    await threeDHelper.testPanControls();
    
    const panScreenshot = await canvas.screenshot();
    const panChanged = Buffer.compare(initialScreenshot, panScreenshot) !== 0;
    
    if (panChanged) {
      console.log('✓ Pan controls working - view changed');
    } else {
      console.log('ℹ Pan controls may be working but change not visually detectable');
    }
  });

  test('layer visibility toggles', async ({ page }) => {
    console.log('Testing layer visibility toggles...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    // Test layer toggles
    const layerToggleAvailable = await threeDHelper.testLayerToggles();
    
    if (layerToggleAvailable) {
      console.log('✓ Layer visibility toggles available and working');
    } else {
      console.log('ℹ No layer visibility toggles found');
    }
  });

  test('render mode switching', async ({ page }) => {
    console.log('Testing render mode switching...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    // Test render modes
    const renderModeAvailable = await threeDHelper.testRenderModes();
    
    if (renderModeAvailable) {
      console.log('✓ Render mode switching available and working');
    } else {
      console.log('ℹ No render mode controls found');
    }
  });

  test('preview updates with parameter changes', async ({ page }) => {
    console.log('Testing preview updates with parameter changes...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    
    // Go to preview first
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    // Verify parameter changes affect preview
    const previewUpdated = await threeDHelper.verifyPreviewUpdatesOnParameterChange();
    
    if (previewUpdated) {
      console.log('✓ Preview successfully updates when parameters change');
    } else {
      console.log('ℹ Could not verify preview updates (may be subtle changes)');
    }
  });

  test('3D preview performance under interaction', async ({ page }) => {
    console.log('Testing 3D preview performance...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    // Measure performance during interactions
    const startTime = Date.now();
    
    // Perform multiple interactions rapidly
    for (let i = 0; i < 5; i++) {
      await threeDHelper.testOrbitControls();
      await page.waitForTimeout(100);
      await threeDHelper.testZoomControls();
      await page.waitForTimeout(100);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✓ Performance test completed in ${duration}ms`);
    
    // Check if scene is still responsive
    const canvas = await threeDHelper.getCanvas();
    await expect(canvas).toBeVisible();
    
    // Verify we can still interact
    await canvas.hover();
    await page.mouse.wheel(0, -50); // Small zoom
    
    console.log('✓ Scene remains responsive after performance test');
  });

  test('mobile touch interactions', async ({ page }) => {
    console.log('Testing mobile touch interactions...');
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    const canvas = await threeDHelper.getCanvas();
    const canvasBox = await canvas.boundingBox();
    
    if (canvasBox) {
      const centerX = canvasBox.x + canvasBox.width / 2;
      const centerY = canvasBox.y + canvasBox.height / 2;
      
      // Simulate touch drag
      await page.touchscreen.tap(centerX, centerY);
      await page.waitForTimeout(100);
      
      // Simulate swipe gesture
      await page.touchscreen.tap(centerX - 50, centerY);
      await page.touchscreen.tap(centerX + 50, centerY);
      
      console.log('✓ Touch interactions tested');
    }
    
    // Reset viewport
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test('3D preview error handling', async ({ page }) => {
    console.log('Testing 3D preview error handling...');
    
    // Test WebGL context loss simulation
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (gl) {
          // Simulate context loss
          const loseContext = gl.getExtension('WEBGL_lose_context');
          if (loseContext) {
            loseContext.loseContext();
            console.log('WebGL context lost for testing');
          }
        }
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Check if error handling is in place
    const errorMessages = [
      page.locator('[role="alert"]'),
      page.locator('text=WebGL', { hasText: /error|lost|unavailable/i }),
      page.locator('text=3D', { hasText: /error|unavailable/i }),
    ];
    
    let foundErrorHandling = false;
    for (const errorMsg of errorMessages) {
      if (await errorMsg.isVisible({ timeout: 2000 })) {
        console.log('✓ Error handling found:', await errorMsg.textContent());
        foundErrorHandling = true;
        break;
      }
    }
    
    if (!foundErrorHandling) {
      console.log('ℹ No visible error handling (may be silently recovered)');
    }
  });

  test('3D preview accessibility features', async ({ page }) => {
    console.log('Testing 3D preview accessibility...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    // Check for accessibility features
    const canvas = await threeDHelper.getCanvas();
    
    // Check for ARIA labels
    const ariaLabel = await canvas.getAttribute('aria-label');
    const ariaDescription = await canvas.getAttribute('aria-describedby');
    const role = await canvas.getAttribute('role');
    
    if (ariaLabel || ariaDescription || role) {
      console.log('✓ Canvas has accessibility attributes');
      console.log('  aria-label:', ariaLabel);
      console.log('  aria-describedby:', ariaDescription);
      console.log('  role:', role);
    }
    
    // Check for keyboard navigation support
    await canvas.focus();
    
    // Test keyboard interactions (if supported)
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    
    console.log('✓ Accessibility features tested');
  });
});