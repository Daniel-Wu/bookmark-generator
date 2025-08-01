/**
 * Helper functions for 3D preview interactions in E2E tests
 */
import { Page, expect, Locator } from '@playwright/test';

export class ThreeDInteractionHelpers {
  constructor(private page: Page) {}

  /**
   * Get the 3D canvas element
   */
  async getCanvas(): Promise<Locator> {
    const canvas = this.page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    return canvas;
  }

  /**
   * Wait for 3D scene to load and render
   */
  async waitForSceneLoad(timeout: number = 10000) {
    // Wait for canvas to be present
    const canvas = await this.getCanvas();
    
    // Wait for WebGL context to be created
    await this.page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      
      try {
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        return gl !== null;
      } catch {
        return false;
      }
    }, { timeout });

    // Give additional time for Three.js to set up
    await this.page.waitForTimeout(2000);
  }

  /**
   * Test camera orbit controls
   */
  async testOrbitControls() {
    const canvas = await this.getCanvas();
    const box = await canvas.boundingBox();
    
    if (!box) throw new Error('Canvas has no bounding box');
    
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    // Test mouse drag (orbit)
    await this.page.mouse.move(centerX, centerY);
    await this.page.mouse.down();
    await this.page.mouse.move(centerX + 50, centerY + 50);
    await this.page.mouse.up();
    
    // Give time for animation
    await this.page.waitForTimeout(500);
  }

  /**
   * Test zoom controls
   */
  async testZoomControls() {
    const canvas = await this.getCanvas();
    
    // Test mouse wheel zoom
    await canvas.hover();
    
    // Zoom in
    await this.page.mouse.wheel(0, -100);
    await this.page.waitForTimeout(200);
    
    // Zoom out
    await this.page.mouse.wheel(0, 100);
    await this.page.waitForTimeout(200);
  }

  /**
   * Test pan controls (right mouse button or shift+drag)
   */
  async testPanControls() {
    const canvas = await this.getCanvas();
    const box = await canvas.boundingBox();
    
    if (!box) throw new Error('Canvas has no bounding box');
    
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    // Test pan with shift+drag
    await this.page.keyboard.down('Shift');
    await this.page.mouse.move(centerX, centerY);
    await this.page.mouse.down();
    await this.page.mouse.move(centerX + 30, centerY + 30);
    await this.page.mouse.up();
    await this.page.keyboard.up('Shift');
    
    await this.page.waitForTimeout(200);
  }

  /**
   * Check if geometry is visible in the scene
   */
  async verifyGeometryVisible(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (!gl) return false;
      
      // Check if there are any draw calls by examining WebGL state
      const program = gl.getParameter(gl.CURRENT_PROGRAM);
      return program !== null;
    });
  }

  /**
   * Get render statistics from Three.js
   */
  async getRenderStats() {
    return await this.page.evaluate(() => {
      // Access Three.js renderer if available
      const threeRenderer = (window as any).__THREE_RENDERER__;
      if (threeRenderer && threeRenderer.info) {
        return {
          geometries: threeRenderer.info.memory.geometries,
          textures: threeRenderer.info.memory.textures,
          calls: threeRenderer.info.render.calls,
          triangles: threeRenderer.info.render.triangles,
          points: threeRenderer.info.render.points,
          lines: threeRenderer.info.render.lines,
        };
      }
      return null;
    });
  }

  /**
   * Test layer visibility toggles if available
   */
  async testLayerToggles() {
    // Look for layer toggle controls
    const layerToggles = this.page.locator('[data-testid*="layer-toggle"], button:has-text("Layer")');
    const count = await layerToggles.count();
    
    if (count > 0) {
      // Test toggling first layer
      await layerToggles.first().click();
      await this.page.waitForTimeout(500);
      
      // Toggle back
      await layerToggles.first().click();
      await this.page.waitForTimeout(500);
      
      return true;
    }
    
    return false;
  }

  /**
   * Test render mode switching if available
   */
  async testRenderModes() {
    // Look for render mode controls
    const renderModeButtons = this.page.locator(
      'button:has-text("Solid"), button:has-text("Wireframe"), button:has-text("X-ray"), [data-testid*="render-mode"]'
    );
    
    const count = await renderModeButtons.count();
    
    if (count > 0) {
      // Test switching between modes
      for (let i = 0; i < Math.min(count, 3); i++) {
        await renderModeButtons.nth(i).click();
        await this.page.waitForTimeout(500);
      }
      return true;
    }
    
    return false;
  }

  /**
   * Verify that the 3D preview updates when parameters change
   */
  async verifyPreviewUpdatesOnParameterChange() {
    // Take initial screenshot of canvas
    const canvas = await this.getCanvas();
    const initialScreenshot = await canvas.screenshot();
    
    // Change a parameter (look for sliders or number inputs)
    const parameterInput = this.page.locator('input[type="range"], input[type="number"]').first();
    
    if (await parameterInput.isVisible()) {
      // Get current value and change it
      const currentValue = await parameterInput.inputValue();
      let newValue = '5';
      
      if (parameterInput.getAttribute('type') === 'range') {
        // For range inputs, try to get min/max and set a different value
        const min = await parameterInput.getAttribute('min') || '1';
        const max = await parameterInput.getAttribute('max') || '10';
        newValue = currentValue === min ? max : min;
      } else {
        // For number inputs, just increment/decrement
        const numValue = parseFloat(currentValue) || 1;
        newValue = (numValue + 1).toString();
      }
      
      await parameterInput.fill(newValue);
      await parameterInput.blur(); // Trigger change
      
      // Wait for update
      await this.page.waitForTimeout(2000);
      
      // Take new screenshot and compare
      const updatedScreenshot = await canvas.screenshot();
      
      // They should be different (but this is a simple check)
      return Buffer.compare(initialScreenshot, updatedScreenshot) !== 0;
    }
    
    return false;
  }

  /**
   * Check WebGL support and capabilities
   */
  async checkWebGLSupport() {
    return await this.page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      
      if (!gl) return { supported: false };
      
      return {
        supported: true,
        version: gl.getParameter(gl.VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      };
    });
  }
}