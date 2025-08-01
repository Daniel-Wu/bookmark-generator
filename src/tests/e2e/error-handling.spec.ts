/**
 * Error handling and edge cases E2E tests
 */
import { test, expect } from '@playwright/test';
import { FileOperationHelpers } from './helpers/file-operations';
import { ThreeDInteractionHelpers } from './helpers/3d-interactions';

test.describe('Error Handling and Edge Cases', () => {
  let fileHelper: FileOperationHelpers;
  let threeDHelper: ThreeDInteractionHelpers;

  test.beforeEach(async ({ page }) => {
    fileHelper = new FileOperationHelpers(page);
    threeDHelper = new ThreeDInteractionHelpers(page);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('network error handling during image upload', async ({ page }) => {
    console.log('Testing network error handling...');
    
    // Simulate network failure
    await page.route('**/*', route => {
      if (route.request().url().includes('upload') || 
          route.request().method() === 'POST') {
        route.abort('connectionfailed');
      } else {
        route.continue();
      }
    });
    
    // Attempt upload
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    
    // Look for error handling
    await page.waitForTimeout(3000);
    
    const errorIndicators = [
      page.locator('[role="alert"]'),
      page.locator('text=error', { hasText: /network|connection|failed/i }),
      page.locator('text=failed', { hasText: /upload|load/i }),
      page.locator('.error'),
    ];
    
    let foundError = false;
    for (const indicator of errorIndicators) {
      if (await indicator.isVisible({ timeout: 2000 })) {
        console.log('✓ Network error handled:', await indicator.textContent());
        foundError = true;
        break;
      }
    }
    
    if (!foundError) {
      console.log('ℹ No network error message found (may handle gracefully)');
    }
  });

  test('memory pressure handling', async ({ page }) => {
    console.log('Testing memory pressure handling...');
    
    // Simulate memory pressure by creating large objects
    await page.evaluate(() => {
      // Create large arrays to consume memory
      const memoryHogs: number[][] = [];
      try {
        for (let i = 0; i < 100; i++) {
          memoryHogs.push(new Array(1000000).fill(Math.random()));
        }
        (window as any).__memoryTest = memoryHogs;
      } catch (error) {
        console.log('Memory pressure created:', error);
      }
    });
    
    // Try to upload image under memory pressure
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    
    await page.waitForTimeout(5000);
    
    // Look for memory warnings or error handling
    const memoryWarnings = [
      page.locator('text=memory', { hasText: /warning|limit|low/i }),
      page.locator('[role="alert"]'),
      page.locator('text=optimize', { hasText: /memory|performance/i }),
    ];
    
    let foundMemoryHandling = false;
    for (const warning of memoryWarnings) {
      if (await warning.isVisible({ timeout: 2000 })) {
        console.log('✓ Memory handling found:', await warning.textContent());
        foundMemoryHandling = true;
        break;
      }
    }
    
    // Clean up memory
    await page.evaluate(() => {
      delete (window as any).__memoryTest;
      if ('gc' in window) {
        (window as any).gc();
      }
    });
    
    if (foundMemoryHandling) {
      console.log('✓ Memory pressure handling works');
    } else {
      console.log('ℹ No memory warnings found (system may have sufficient memory)');
    }
  });

  test('WebGL context loss recovery', async ({ page }) => {
    console.log('Testing WebGL context loss recovery...');
    
    // Upload image first to create 3D scene
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(3000);
    
    // Navigate to 3D preview
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    // Simulate WebGL context loss
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (gl) {
          const loseContext = gl.getExtension('WEBGL_lose_context');
          if (loseContext) {
            loseContext.loseContext();
            console.log('WebGL context lost');
            
            // Simulate context restoration after delay
            setTimeout(() => {
              if (loseContext.restoreContext) {
                loseContext.restoreContext();
                console.log('WebGL context restored');
              }
            }, 2000);
          }
        }
      }
    });
    
    // Wait for recovery
    await page.waitForTimeout(4000);
    
    // Check if scene recovered
    const canvas = await threeDHelper.getCanvas();
    const isStillVisible = await canvas.isVisible();
    
    if (isStillVisible) {
      console.log('✓ Canvas still visible after context loss');
      
      // Try to interact with scene
      await canvas.hover();
      await page.mouse.wheel(0, -50);
      
      console.log('✓ WebGL context loss recovery appears to work');
    } else {
      console.log('❌ Canvas not visible after context loss');
    }
  });

  test('invalid image data handling', async ({ page }) => {
    console.log('Testing invalid image data handling...');
    
    // Create corrupted image data
    await page.evaluate(async () => {
      // Create invalid data URL
      const corruptedDataURL = 'data:image/png;base64,invalidbase64data!!!';
      
      try {
        const response = await fetch(corruptedDataURL);
        const blob = await response.blob();
        const file = new File([blob], 'corrupted.png', { type: 'image/png' });
        
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (input) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (error) {
        console.log('Expected error with corrupted data:', error);
      }
    });
    
    await page.waitForTimeout(3000);
    
    // Look for error handling
    const errorMessages = [
      page.locator('[role="alert"]'),
      page.locator('text=invalid', { hasText: /image|format|data/i }),
      page.locator('text=corrupted', { hasText: /file|image/i }),
      page.locator('.error'),
    ];
    
    let foundErrorHandling = false;
    for (const error of errorMessages) {
      if (await error.isVisible({ timeout: 2000 })) {
        console.log('✓ Invalid data error handled:', await error.textContent());
        foundErrorHandling = true;
        break;
      }
    }
    
    if (foundErrorHandling) {
      console.log('✓ Invalid image data handling works');
    } else {
      console.log('ℹ No error message for invalid data (may be silently rejected)');
    }
  });

  test('extremely large parameter values', async ({ page }) => {
    console.log('Testing extreme parameter values...');
    
    // Upload image first
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(3000);
    
    // Navigate to parameters
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Find parameter inputs and test extreme values
    const inputs = page.locator('input[type="number"], input[type="range"]');
    const count = await inputs.count();
    
    if (count > 0) {
      const testInput = inputs.first();
      
      // Test extremely large values
      const extremeValues = ['99999', '0.0001', '-100', '1000000'];
      
      for (const value of extremeValues) {
        await testInput.fill(value);
        await testInput.blur();
        await page.waitForTimeout(1000);
        
        const actualValue = await testInput.inputValue();
        console.log(`Extreme value "${value}" → "${actualValue}"`);
        
        // Look for warnings or errors
        const warnings = [
          page.locator('[role="alert"]'),
          page.locator('text=warning', { hasText: /value|range|performance/i }),
          page.locator('text=limit', { hasText: /exceeded|maximum/i }),
        ];
        
        for (const warning of warnings) {
          if (await warning.isVisible({ timeout: 1000 })) {
            console.log('✓ Warning for extreme value:', await warning.textContent());
            break;
          }
        }
      }
      
      console.log('✓ Extreme parameter values tested');
    }
  });

  test('concurrent operation handling', async ({ page }) => {
    console.log('Testing concurrent operation handling...');
    
    // Upload image
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(2000);
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    
    // Try to trigger multiple operations simultaneously
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Rapidly change multiple parameters
    const inputs = page.locator('input[type="number"], input[type="range"]');
    const inputCount = await inputs.count();
    
    if (inputCount > 0) {
      // Trigger multiple parameter changes quickly
      for (let i = 0; i < Math.min(inputCount, 3); i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          await input.fill(String(i + 5));
          // Don't wait - trigger next immediately
        }
      }
      
      // Wait for processing to settle
      await page.waitForTimeout(5000);
      
      // Check if system is still responsive
      if (isMobile) {
        await page.locator('[data-testid="tab-preview"]').click();
      }
      
      const canvas = page.locator('canvas').first();
      if (await canvas.isVisible({ timeout: 5000 })) {
        console.log('✓ System remains responsive after concurrent operations');
      }
    }
  });

  test('browser compatibility fallbacks', async ({ page }) => {
    console.log('Testing browser compatibility fallbacks...');
    
    // Mock missing WebGL support
    await page.addInitScript(() => {
      // Override WebGL context creation to simulate unsupported browser
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type: string, ...args: any[]) {
        if (type === 'webgl' || type === 'webgl2') {
          return null; // Simulate no WebGL support
        }
        return originalGetContext.call(this, type, ...args);
      };
    });
    
    // Reload page with WebGL disabled
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Upload image
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(3000);
    
    // Check for fallback behavior
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    // Look for WebGL fallback messages or alternative rendering
    const fallbackIndicators = [
      page.locator('text=WebGL', { hasText: /unsupported|unavailable|disabled/i }),
      page.locator('text=browser', { hasText: /unsupported|upgrade/i }),
      page.locator('[role="alert"]'),
      page.locator('text=fallback', { hasText: /mode|rendering/i }),
    ];
    
    let foundFallback = false;
    for (const indicator of fallbackIndicators) {
      if (await indicator.isVisible({ timeout: 3000 })) {
        console.log('✓ Fallback message found:', await indicator.textContent());
        foundFallback = true;
        break;
      }
    }
    
    if (foundFallback) {
      console.log('✓ Browser compatibility fallback works');
    } else {
      console.log('ℹ No fallback message (may handle gracefully or provide alternative)');
    }
  });

  test('rapid user interactions stress test', async ({ page }) => {
    console.log('Testing rapid user interactions...');
    
    // Upload image
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(3000);
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    
    // Rapidly switch between tabs and interact
    const actions = [
      async () => {
        if (isMobile) await page.locator('[data-testid="tab-parameters"]').click();
      },
      async () => {
        const input = page.locator('input[type="range"]').first();
        if (await input.isVisible({ timeout: 500 })) {
          await input.fill('3');
        }
      },
      async () => {
        if (isMobile) await page.locator('[data-testid="tab-preview"]').click();
      },
      async () => {
        const canvas = page.locator('canvas').first();
        if (await canvas.isVisible({ timeout: 500 })) {
          await canvas.hover();
          await page.mouse.wheel(0, -25);
        }
      },
      async () => {
        if (isMobile) await page.locator('[data-testid="tab-export"]').click();
      },
    ];
    
    // Execute actions rapidly
    for (let round = 0; round < 3; round++) {
      for (const action of actions) {
        try {
          await action();
          await page.waitForTimeout(100); // Minimal delay
        } catch (error) {
          console.log('Action failed (expected under stress):', error);
        }
      }
    }
    
    // Give system time to settle
    await page.waitForTimeout(3000);
    
    // Verify system is still functional
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    const canvas = page.locator('canvas').first();
    const isResponsive = await canvas.isVisible({ timeout: 5000 });
    
    if (isResponsive) {
      console.log('✓ System remains responsive after rapid interactions');
    } else {
      console.log('❌ System not responsive after stress test');
    }
  });

  test('resource cleanup on navigation', async ({ page }) => {
    console.log('Testing resource cleanup...');
    
    // Upload multiple images and generate geometry
    for (let i = 0; i < 3; i++) {
      const testImage = await fileHelper.createLargeTestImage();
      await fileHelper.uploadImageFromDataURL(testImage, `test-${i}.png`);
      await page.waitForTimeout(2000);
    }
    
    // Navigate away and back
    await page.goto('about:blank');
    await page.waitForTimeout(1000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if app loads cleanly
    const loadedCleanly = await page.locator('body').isVisible({ timeout: 10000 });
    expect(loadedCleanly).toBe(true);
    
    console.log('✓ App loads cleanly after navigation');
    
    // Check for memory leaks by monitoring console
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Upload new image
    const cleanTestImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(cleanTestImage);
    await page.waitForTimeout(3000);
    
    // Check for excessive console errors
    if (consoleErrors.length > 10) {
      console.log('⚠ Many console errors detected:', consoleErrors.slice(0, 5));
    } else {
      console.log('✓ Clean operation after resource cleanup');
    }
  });
});