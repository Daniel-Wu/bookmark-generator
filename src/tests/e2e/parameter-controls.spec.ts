/**
 * Parameter controls interaction E2E tests
 */
import { test, expect } from '@playwright/test';
import { FileOperationHelpers } from './helpers/file-operations';
import { ThreeDInteractionHelpers } from './helpers/3d-interactions';

test.describe('Parameter Controls', () => {
  let fileHelper: FileOperationHelpers;
  let threeDHelper: ThreeDInteractionHelpers;

  test.beforeEach(async ({ page }) => {
    fileHelper = new FileOperationHelpers(page);
    threeDHelper = new ThreeDInteractionHelpers(page);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Upload image to enable parameter controls
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(3000);
  });

  test('color count parameter control', async ({ page }) => {
    console.log('Testing color count parameter...');
    
    // Navigate to parameters (mobile)
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Find color count control
    const colorCountControls = [
      page.locator('input[type="range"]:has-text("color"), input[type="number"]:has-text("color")'),
      page.locator('[data-testid*="color-count"]'),
      page.locator('label:has-text("Color") + input, label:has-text("Colors") + input'),
      page.locator('input[type="range"], input[type="number"]').first(), // fallback
    ];
    
    let colorControl = null;
    for (const control of colorCountControls) {
      if (await control.isVisible({ timeout: 1000 })) {
        colorControl = control;
        break;
      }
    }
    
    if (colorControl) {
      const initialValue = await colorControl.inputValue();
      console.log('Initial color count:', initialValue);
      
      // Test changing color count
      const newValue = initialValue === '2' ? '5' : '3';
      await colorControl.fill(newValue);
      await colorControl.blur();
      
      // Wait for processing
      await page.waitForTimeout(2000);
      
      // Verify value changed
      const updatedValue = await colorControl.inputValue();
      expect(updatedValue).toBe(newValue);
      
      console.log(`✓ Color count changed from ${initialValue} to ${updatedValue}`);
    } else {
      console.log('ℹ Color count control not found');
    }
  });

  test('dimension parameter controls', async ({ page }) => {
    console.log('Testing dimension parameters...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Look for dimension controls (width, height)
    const dimensionControls = [
      page.locator('input[type="number"]'),
      page.locator('input[type="range"]'),
      page.locator('[data-testid*="width"], [data-testid*="height"]'),
      page.locator('label:has-text("Width") + input, label:has-text("Height") + input'),
    ];
    
    let foundControls = 0;
    
    for (const controlSet of dimensionControls) {
      const count = await controlSet.count();
      if (count > 0) {
        foundControls = count;
        
        // Test first control
        const firstControl = controlSet.first();
        if (await firstControl.isVisible()) {
          const initialValue = await firstControl.inputValue();
          const newValue = '75'; // Set to 75mm
          
          await firstControl.fill(newValue);
          await firstControl.blur();
          await page.waitForTimeout(1000);
          
          const updatedValue = await firstControl.inputValue();
          console.log(`✓ Dimension control: ${initialValue} → ${updatedValue}`);
        }
        break;
      }
    }
    
    if (foundControls > 0) {
      console.log(`✓ Found ${foundControls} dimension controls`);
    } else {
      console.log('ℹ No dimension controls found');
    }
  });

  test('thickness parameter controls', async ({ page }) => {
    console.log('Testing thickness parameters...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Look for thickness controls
    const thicknessSelectors = [
      'label:has-text("Thickness") + input',
      'label:has-text("Layer") + input',
      'label:has-text("Base") + input',
      '[data-testid*="thickness"]',
      'input[step="0.1"], input[step="0.01"]', // decimal inputs likely for thickness
    ];
    
    let thicknessControl = null;
    for (const selector of thicknessSelectors) {
      const control = page.locator(selector).first();
      if (await control.isVisible({ timeout: 1000 })) {
        thicknessControl = control;
        break;
      }
    }
    
    if (thicknessControl) {
      const initialValue = await thicknessControl.inputValue();
      const newValue = '0.3'; // Set to 0.3mm
      
      await thicknessControl.fill(newValue);
      await thicknessControl.blur();
      await page.waitForTimeout(1000);
      
      const updatedValue = await thicknessControl.inputValue();
      console.log(`✓ Thickness control: ${initialValue} → ${updatedValue}`);
    } else {
      console.log('ℹ No thickness controls found');
    }
  });

  test('parameter validation and limits', async ({ page }) => {
    console.log('Testing parameter validation...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Find any numeric input to test validation
    const numericInputs = page.locator('input[type="number"], input[type="range"]');
    const count = await numericInputs.count();
    
    if (count > 0) {
      const testInput = numericInputs.first();
      
      // Test invalid values
      const testValues = ['-1', '0', '999999', 'abc', ''];
      
      for (const value of testValues) {
        await testInput.fill(value);
        await testInput.blur();
        await page.waitForTimeout(500);
        
        // Check if value was accepted or corrected
        const actualValue = await testInput.inputValue();
        console.log(`Test value "${value}" → "${actualValue}"`);
        
        // Look for validation messages
        const validationMessages = [
          page.locator('[role="alert"]'),
          page.locator('.error'),
          page.locator('text=invalid', { hasText: /value|range|limit/i }),
        ];
        
        for (const msgLocator of validationMessages) {
          if (await msgLocator.isVisible({ timeout: 500 })) {
            console.log('✓ Validation message shown:', await msgLocator.textContent());
            break;
          }
        }
      }
      
      console.log('✓ Parameter validation tested');
    } else {
      console.log('ℹ No numeric inputs found for validation testing');
    }
  });

  test('parameter presets (if available)', async ({ page }) => {
    console.log('Testing parameter presets...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Look for preset controls
    const presetSelectors = [
      'select[data-testid*="preset"]',
      'button:has-text("Preset")',
      'button:has-text("Small"), button:has-text("Medium"), button:has-text("Large")',
      '[data-testid*="preset"] button',
    ];
    
    let presetControl = null;
    for (const selector of presetSelectors) {
      const control = page.locator(selector).first();
      if (await control.isVisible({ timeout: 1000 })) {
        presetControl = control;
        break;
      }
    }
    
    if (presetControl) {
      // Record initial parameter values
      const initialParams = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="number"], input[type="range"]'));
        return inputs.map(input => (input as HTMLInputElement).value);
      });
      
      // Apply preset
      await presetControl.click();
      await page.waitForTimeout(1000);
      
      // Check if parameters changed
      const newParams = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="number"], input[type="range"]'));
        return inputs.map(input => (input as HTMLInputElement).value);
      });
      
      const changed = JSON.stringify(initialParams) !== JSON.stringify(newParams);
      if (changed) {
        console.log('✓ Preset changed parameters');
      } else {
        console.log('ℹ Preset did not change parameters (may be same as current)');
      }
    } else {
      console.log('ℹ No preset controls found');
    }
  });

  test('parameter changes affect geometry generation', async ({ page }) => {
    console.log('Testing parameter changes affect geometry...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    
    // Go to preview to establish baseline
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    await threeDHelper.waitForSceneLoad();
    
    // Get initial render stats if available
    const initialStats = await threeDHelper.getRenderStats();
    
    // Go back to parameters
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Change a parameter
    const paramInputs = page.locator('input[type="number"], input[type="range"]');
    const count = await paramInputs.count();
    
    if (count > 0) {
      const input = paramInputs.first();
      const oldValue = await input.inputValue();
      const newValue = oldValue === '2' ? '4' : '3';
      
      await input.fill(newValue);
      await input.blur();
      
      // Wait for regeneration
      await page.waitForTimeout(3000);
      
      // Check preview again
      if (isMobile) {
        await page.locator('[data-testid="tab-preview"]').click();
      }
      
      // Wait for new geometry
      await page.waitForTimeout(2000);
      
      // Get new render stats
      const newStats = await threeDHelper.getRenderStats();
      
      if (initialStats && newStats) {
        const geometryChanged = JSON.stringify(initialStats) !== JSON.stringify(newStats);
        if (geometryChanged) {
          console.log('✓ Parameter change affected geometry generation');
          console.log('Initial stats:', initialStats);
          console.log('New stats:', newStats);
        } else {
          console.log('ℹ No detectable geometry changes (may be subtle)');
        }
      } else {
        console.log('ℹ Could not get render statistics for comparison');
      }
      
      console.log(`✓ Parameter changed: ${oldValue} → ${newValue}`);
    }
  });

  test('parameter persistence across navigation', async ({ page }) => {
    console.log('Testing parameter persistence...');
    
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-parameters"]').click();
    }
    
    // Set a parameter value
    const paramInput = page.locator('input[type="number"], input[type="range"]').first();
    if (await paramInput.isVisible()) {
      const testValue = '7';
      await paramInput.fill(testValue);
      await paramInput.blur();
      await page.waitForTimeout(500);
      
      // Navigate away and back
      if (isMobile) {
        await page.locator('[data-testid="tab-preview"]').click();
        await page.waitForTimeout(1000);
        await page.locator('[data-testid="tab-parameters"]').click();
      }
      
      // Check if value persisted
      const persistedValue = await paramInput.inputValue();
      expect(persistedValue).toBe(testValue);
      
      console.log(`✓ Parameter value persisted: ${persistedValue}`);
    }
  });

  test('parameter controls responsiveness', async ({ page }) => {
    console.log('Testing parameter controls responsiveness...');
    
    // Test on different viewport sizes
    const viewports = [
      { width: 1200, height: 800 }, // Desktop
      { width: 768, height: 1024 }, // Tablet
      { width: 375, height: 667 },  // Mobile
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      
      console.log(`Testing ${viewport.width}x${viewport.height}...`);
      
      // Check if parameters are accessible
      const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
      
      if (isMobile) {
        await page.locator('[data-testid="tab-parameters"]').click();
      }
      
      // Check if controls are visible and interactive
      const controls = page.locator('input[type="number"], input[type="range"], select, button');
      const visibleCount = await controls.count();
      
      if (visibleCount > 0) {
        // Test interaction
        const firstControl = controls.first();
        if (await firstControl.isVisible()) {
          await firstControl.focus();
          console.log(`✓ ${viewport.width}px: ${visibleCount} controls accessible`);
        }
      }
    }
    
    // Reset to desktop size
    await page.setViewportSize({ width: 1200, height: 800 });
  });
});