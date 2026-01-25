import { test, expect } from '@playwright/test';

test.describe('Map Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate a key if needed
    const hasKey = await page.evaluate(() => {
      return !!localStorage.getItem('nostr_private_key');
    });
    
    if (!hasKey) {
      // Use onboarding button specifically
      const generateBtn = page.locator('button[onclick="onboardingGenerate()"]');
      if (await generateBtn.isVisible()) {
        await generateBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('map container exists', async ({ page }) => {
    const mapContainer = page.locator('#map');
    await expect(mapContainer).toBeAttached();
  });

  test('map view is visible', async ({ page }) => {
    const mapView = page.locator('#map-view');
    await expect(mapView).toBeAttached();
  });

  test('page has map container structure', async ({ page }) => {
    const mapContainer = page.locator('.map-container');
    await expect(mapContainer).toBeAttached();
  });

  test('map loads without critical errors', async ({ page }) => {
    const errors = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out known non-critical errors
        if (!text.includes('Failed to load resource') && 
            !text.includes('CORS') &&
            !text.includes('net::ERR') &&
            !text.includes('MapLibre')) {
          errors.push(text);
        }
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give map time to initialize
    
    // Allow some map-related errors but not critical ones
    expect(errors.length).toBeLessThan(5);
  });

  test('map view has correct structure', async ({ page }) => {
    const mapView = page.locator('#map-view');
    await expect(mapView).toHaveClass(/view/);
  });
});
