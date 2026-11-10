import { test, expect } from './fixtures.js';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/web/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('keys modal appears when no key exists', async ({ page }) => {
    await page.goto('/web/');
    await page.waitForLoadState('networkidle');
    
    const keysModal = page.locator('#keys-modal');
    await expect(keysModal).toBeVisible();
  });

  for (const width of [390, 1280]) {
    test(`shows the sketch notice before key setup at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });

      await page.goto('/');
      const sketch = page.getByRole('link', { name: /Open Nostroots Web sketch/ });
      await expect(sketch.getByText('Deprecated · Unmaintained')).toBeVisible();

      for (const route of ['/web/#keys', '/web/#welcome']) {
        await test.step(route, async () => {
          await page.goto(route);

          const keysModal = page.locator('#keys-modal');
          const notice = keysModal.getByText(/Nostroots Web is deprecated/);
          await expect(notice).toBeInViewport();
          await expect(notice.getByRole('link', { name: 'Trustroots.org' }))
            .toHaveAttribute('href', 'https://www.trustroots.org/');
          await expect(keysModal.getByRole('button', { name: 'Generate New Key' })).toBeEnabled();
        });
      }
    });
  }

  test('visiting a profile route without a key keeps the route and shows welcome Keys', async ({ page }) => {
    await page.goto('/web/#profile/alice');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/#profile\//);
    await expect(page.locator('#keys-modal')).toBeVisible();
    await expect(page.locator('#keys-welcome-section')).toBeVisible();
  });

  test('can generate new key from onboarding', async ({ page }) => {
    await page.goto('/web/');
    await page.waitForLoadState('networkidle');
    
    // Click generate button (use onboarding-specific button)
    const generateBtn = page.locator('button[onclick="onboardingGenerate()"]');
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();
    
    // Wait for welcome section to disappear (key was generated)
    const welcomeSection = page.locator('#keys-welcome-section');
    await expect(welcomeSection).not.toBeVisible({ timeout: 5000 });
    
    // Verify key was created (check localStorage)
    const hasKey = await page.evaluate(() => {
      return !!localStorage.getItem('nostr_private_key');
    });
    expect(hasKey).toBe(true);

    await page.goto('/web/');
    await expect(page.locator('body > .web-sketch-notice')).toBeInViewport();
  });

  test('onboarding import button exists', async ({ page }) => {
    await page.goto('/web/');
    await page.waitForLoadState('networkidle');
    
    const importBtn = page.locator('button[onclick="onboardingImport()"]');
    await expect(importBtn).toBeVisible();
  });

  test('onboarding has import input field', async ({ page }) => {
    await page.goto('/web/');
    await page.waitForLoadState('networkidle');
    
    const importInput = page.locator('#onboarding-import');
    await expect(importInput).toBeVisible();
  });

  test('keys modal cannot be closed with ESC when no key exists', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'ESC behavior is not reliable on iOS WebKit automation');

    await page.goto('/web/');
    await page.waitForLoadState('networkidle');
    
    const keysModal = page.locator('#keys-modal');
    await expect(keysModal).toBeVisible();
    
    // Try to close with ESC
    await page.keyboard.press('Escape');
    
    // Modal should still be visible (user must set up keys first)
    await expect(keysModal).toBeVisible();
  });

  test('shows Leaflet fallback when WebGL is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, ...args) {
        if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
          return null;
        }
        return originalGetContext.call(this, type, ...args);
      };
    });

    await page.goto('/web/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#map[data-map-fallback="leaflet"]')).toBeVisible();
    await expect(page.locator('#map.leaflet-container')).toBeVisible();
  });
});
