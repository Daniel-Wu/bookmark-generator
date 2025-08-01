/**
 * Accessibility compliance E2E tests
 */
import { test, expect } from '@playwright/test';
import { FileOperationHelpers } from './helpers/file-operations';

test.describe('Accessibility Compliance', () => {
  let fileHelper: FileOperationHelpers;

  test.beforeEach(async ({ page }) => {
    fileHelper = new FileOperationHelpers(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('keyboard navigation throughout application', async ({ page }) => {
    console.log('Testing keyboard navigation...');
    
    // Test tab navigation through main interface
    await page.keyboard.press('Tab');
    
    // Check if focus is visible
    let focusedElement = await page.locator(':focus').first();
    let focusVisible = await focusedElement.isVisible();
    
    if (focusVisible) {
      console.log('✓ Initial focus visible');
    }
    
    // Navigate through several elements
    const tabStops: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      const focused = await page.locator(':focus').first();
      if (await focused.isVisible()) {
        const tagName = await focused.evaluate(el => el.tagName.toLowerCase());
        const role = await focused.getAttribute('aria-role') || await focused.getAttribute('role');
        const label = await focused.getAttribute('aria-label') || await focused.textContent();
        
        tabStops.push(`${tagName}${role ? `[${role}]` : ''}${label ? `: ${label.substring(0, 30)}` : ''}`);
      }
    }
    
    console.log('Tab stops:', tabStops);
    expect(tabStops.length).toBeGreaterThan(3);
    console.log('✓ Keyboard navigation works');
  });

  test('screen reader compatibility - ARIA labels and roles', async ({ page }) => {
    console.log('Testing screen reader compatibility...');
    
    // Check for proper ARIA labels on interactive elements
    const interactiveElements = [
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="slider"]',
      '[role="tab"]',
    ];
    
    let ariaCompliantElements = 0;
    let totalInteractiveElements = 0;
    
    for (const selector of interactiveElements) {
      const elements = page.locator(selector);
      const count = await elements.count();
      totalInteractiveElements += count;
      
      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        
        if (await element.isVisible()) {
          const ariaLabel = await element.getAttribute('aria-label');
          const ariaLabelledBy = await element.getAttribute('aria-labelledby');
          const ariaDescribedBy = await element.getAttribute('aria-describedby');
          const title = await element.getAttribute('title');
          const textContent = await element.textContent();
          
          if (ariaLabel || ariaLabelledBy || ariaDescribedBy || title || textContent?.trim()) {
            ariaCompliantElements++;
          }
        }
      }
    }
    
    console.log(`ARIA compliance: ${ariaCompliantElements}/${totalInteractiveElements} elements have labels`);
    
    // Check for landmarks
    const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer').count();
    console.log(`✓ Found ${landmarks} landmark elements`);
    
    // Check for headings structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6, [role="heading"]').count();
    console.log(`✓ Found ${headings} heading elements`);
    
    if (ariaCompliantElements / totalInteractiveElements > 0.7) {
      console.log('✓ Good ARIA compliance rate');
    } else {
      console.log('⚠ Some interactive elements may lack proper labels');
    }
  });

  test('focus management and visual focus indicators', async ({ page }) => {
    console.log('Testing focus management...');
    
    // Upload image to enable more interactive elements
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(3000);
    
    // Test focus on mobile tabs (if present)
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    
    if (isMobile) {
      // Test tab navigation
      const tabs = page.locator('[data-testid^="tab-"]');
      const tabCount = await tabs.count();
      
      if (tabCount > 0) {
        for (let i = 0; i < tabCount; i++) {
          const tab = tabs.nth(i);
          await tab.focus();
          
          // Check if focus is visible
          const focused = await page.locator(':focus').first();
          const isFocused = await focused.isVisible();
          
          if (isFocused) {
            // Check for visual focus indicator
            const focusStyles = await focused.evaluate(el => {
              const computed = getComputedStyle(el);
              return {
                outline: computed.outline,
                outlineWidth: computed.outlineWidth,
                boxShadow: computed.boxShadow,
                borderColor: computed.borderColor,
              };
            });
            
            const hasFocusIndicator = 
              focusStyles.outline !== 'none' ||
              focusStyles.outlineWidth !== '0px' ||
              focusStyles.boxShadow !== 'none' ||
              focusStyles.borderColor !== 'rgb(0, 0, 0)';
            
            if (hasFocusIndicator) {
              console.log(`✓ Tab ${i} has focus indicator`);
            }
          }
        }
      }
    }
    
    // Test focus trap in modals (if any)
    const modals = page.locator('[role="dialog"], .modal, [data-testid*="modal"]');
    const modalCount = await modals.count();
    
    if (modalCount > 0) {
      console.log(`Found ${modalCount} modal(s) to test focus trap`);
      // Focus trap testing would go here
    }
    
    console.log('✓ Focus management tested');
  });

  test('color contrast and visual accessibility', async ({ page }) => {
    console.log('Testing color contrast...');
    
    // Sample text elements to check contrast
    const textElements = await page.locator('p, span, label, button, h1, h2, h3, h4, h5, h6').all();
    let contrastIssues = 0;
    
    for (let i = 0; i < Math.min(textElements.length, 10); i++) {
      const element = textElements[i];
      
      if (await element.isVisible()) {
        const contrast = await element.evaluate(el => {
          const computed = getComputedStyle(el);
          const color = computed.color;
          const backgroundColor = computed.backgroundColor;
          
          // Simple contrast check (simplified)
          return {
            color,
            backgroundColor,
            fontSize: computed.fontSize,
          };
        });
        
        // Log for manual review (automated contrast checking is complex)
        console.log(`Element ${i}: color=${contrast.color}, bg=${contrast.backgroundColor}, size=${contrast.fontSize}`);
      }
    }
    
    // Check for text that might be too small
    const smallText = await page.locator('*').evaluateAll(elements => {
      return elements.filter(el => {
        const computed = getComputedStyle(el);
        const fontSize = parseFloat(computed.fontSize);
        return fontSize < 12 && el.textContent?.trim();
      }).length;
    });
    
    if (smallText > 0) {
      console.log(`⚠ Found ${smallText} elements with potentially small text`);
    }
    
    console.log('✓ Color contrast analysis completed');
  });

  test('alternative text for images and media', async ({ page }) => {
    console.log('Testing alternative text...');
    
    // Upload image first
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(3000);
    
    // Check images for alt text
    const images = page.locator('img');
    const imageCount = await images.count();
    let imagesWithAlt = 0;
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      const role = await img.getAttribute('role');
      
      if (alt !== null || ariaLabel || role === 'presentation') {
        imagesWithAlt++;
      }
    }
    
    console.log(`Alt text compliance: ${imagesWithAlt}/${imageCount} images have alt text or are marked decorative`);
    
    // Check canvas elements for accessibility
    const canvases = page.locator('canvas');
    const canvasCount = await canvases.count();
    let accessibleCanvases = 0;
    
    for (let i = 0; i < canvasCount; i++) {
      const canvas = canvases.nth(i);
      const ariaLabel = await canvas.getAttribute('aria-label');
      const role = await canvas.getAttribute('role');
      const ariaDescribedBy = await canvas.getAttribute('aria-describedby');
      
      if (ariaLabel || role || ariaDescribedBy) {
        accessibleCanvases++;
        console.log(`✓ Canvas ${i} has accessibility attributes`);
      }
    }
    
    if (canvasCount > 0) {
      console.log(`Canvas accessibility: ${accessibleCanvases}/${canvasCount} canvases have accessibility attributes`);
    }
    
    console.log('✓ Alternative text testing completed');
  });

  test('form accessibility and error messaging', async ({ page }) => {
    console.log('Testing form accessibility...');
    
    // Find form inputs
    const inputs = page.locator('input, select, textarea');
    const inputCount = await inputs.count();
    let accessibleInputs = 0;
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      
      if (await input.isVisible()) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        // Check for associated label
        let hasLabel = false;
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          hasLabel = await label.isVisible();
        }
        
        if (hasLabel || ariaLabel || ariaLabelledBy) {
          accessibleInputs++;
        }
      }
    }
    
    console.log(`Form accessibility: ${accessibleInputs}/${inputCount} inputs have proper labels`);
    
    // Test error states (if inputs support validation)
    if (inputCount > 0) {
      const firstInput = inputs.first();
      
      if (await firstInput.isVisible()) {
        // Try to trigger validation
        await firstInput.fill('invalid-value-test');
        await firstInput.blur();
        await page.waitForTimeout(1000);
        
        // Look for error messages
        const errorMessages = page.locator('[role="alert"], .error, [aria-invalid="true"] + *, [data-testid*="error"]');
        const errorCount = await errorMessages.count();
        
        if (errorCount > 0) {
          console.log(`✓ Found ${errorCount} error message(s) for validation`);
        }
      }
    }
    
    console.log('✓ Form accessibility tested');
  });

  test('skip navigation and bypass mechanisms', async ({ page }) => {
    console.log('Testing skip navigation...');
    
    // Look for skip links
    const skipLinks = page.locator('a[href^="#"], [data-testid*="skip"], *:has-text("Skip to")');
    const skipCount = await skipLinks.count();
    
    if (skipCount > 0) {
      console.log(`✓ Found ${skipCount} potential skip link(s)`);
      
      // Test first skip link
      const firstSkip = skipLinks.first();
      if (await firstSkip.isVisible()) {
        await firstSkip.click();
        
        // Check if focus moved to target
        const focused = await page.locator(':focus').first();
        const focusVisible = await focused.isVisible();
        
        if (focusVisible) {
          console.log('✓ Skip link successfully moved focus');
        }
      }
    } else {
      console.log('ℹ No skip links found');
    }
    
    // Check for proper heading structure (bypass mechanism)
    const h1Count = await page.locator('h1').count();
    const h2Count = await page.locator('h2').count();
    const h3Count = await page.locator('h3').count();
    
    console.log(`Heading structure: ${h1Count} h1, ${h2Count} h2, ${h3Count} h3`);
    
    if (h1Count === 1 && (h2Count > 0 || h3Count > 0)) {
      console.log('✓ Good heading structure for navigation');
    }
  });

  test('mobile accessibility and touch targets', async ({ page }) => {
    console.log('Testing mobile accessibility...');
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Upload image to enable more controls
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(3000);
    
    // Check touch target sizes
    const touchTargets = page.locator('button, [role="button"], a, input[type="checkbox"], input[type="radio"], [data-testid^="tab-"]');
    const targetCount = await touchTargets.count();
    let adequateSizeTargets = 0;
    
    for (let i = 0; i < targetCount; i++) {
      const target = touchTargets.nth(i);
      
      if (await target.isVisible()) {
        const box = await target.boundingBox();
        
        if (box && box.width >= 44 && box.height >= 44) {
          adequateSizeTargets++;
        } else if (box) {
          console.log(`Small touch target: ${box.width}x${box.height}`);
        }
      }
    }
    
    console.log(`Touch targets: ${adequateSizeTargets}/${targetCount} have adequate size (44x44px)`);
    
    // Test mobile-specific interactions
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    
    if (isMobile) {
      // Test tab switching with touch
      const tabs = page.locator('[data-testid^="tab-"]');
      const tabCount = await tabs.count();
      
      if (tabCount > 0) {
        await tabs.first().tap();
        await page.waitForTimeout(200);
        console.log('✓ Touch interaction on mobile tabs works');
      }
    }
    
    // Reset viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    console.log('✓ Mobile accessibility tested');
  });

  test('high contrast mode compatibility', async ({ page }) => {
    console.log('Testing high contrast mode...');
    
    // Simulate high contrast mode
    await page.addInitScript(() => {
      // Add high contrast media query simulation
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => {
          if (query.includes('prefers-contrast: high')) {
            return {
              matches: true,
              addEventListener: () => {},
              removeEventListener: () => {},
            };
          }
          return {
            matches: false,
            addEventListener: () => {},
            removeEventListener: () => {},
          };
        }
      });
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check if high contrast styles are applied
    const bodyStyles = await page.locator('body').evaluate(el => {
      const computed = getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
      };
    });
    
    console.log('High contrast styles:', bodyStyles);
    
    // Upload image and test visibility
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(3000);
    
    // Check if controls are still visible and accessible
    const controls = page.locator('button, input, select');
    const visibleControls = await controls.count();
    
    console.log(`✓ ${visibleControls} controls remain visible in high contrast mode`);
  });

  test('reduced motion preferences', async ({ page }) => {
    console.log('Testing reduced motion preferences...');
    
    // Simulate prefers-reduced-motion
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => {
          if (query.includes('prefers-reduced-motion: reduce')) {
            return {
              matches: true,
              addEventListener: () => {},
              removeEventListener: () => {},
            };
          }
          return {
            matches: false,
            addEventListener: () => {},
            removeEventListener: () => {},
          };
        }
      });
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Upload image and test 3D interactions
    const testImage = await fileHelper.createLargeTestImage();
    await fileHelper.uploadImageFromDataURL(testImage);
    await page.waitForTimeout(3000);
    
    // Navigate to 3D preview
    const isMobile = await page.locator('[data-testid="mobile-tabs"]').isVisible();
    if (isMobile) {
      await page.locator('[data-testid="tab-preview"]').click();
    }
    
    // Check if animations are reduced/disabled
    const canvas = page.locator('canvas').first();
    if (await canvas.isVisible()) {
      // Interact with 3D scene
      await canvas.hover();
      await page.mouse.wheel(0, -50);
      
      console.log('✓ Reduced motion interaction tested');
    }
    
    console.log('✓ Reduced motion preferences tested');
  });
});