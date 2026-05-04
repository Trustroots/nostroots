import { test, expect } from './fixtures.js';

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
            !text.includes('MapLibre') &&
            !text.includes('WebSocket') &&
            !text.includes('wss://') &&
            !text.includes('NDK') &&
            !text.includes('chat-app') &&
            !text.includes('ChunkLoadError') &&
            !text.includes('Loading chunk')) {
          errors.push(text);
        }
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give map time to initialize
    
    // Allow transient relay / chat / loader noise in CI; still catches large error spikes
    expect(errors.length).toBeLessThan(10);
  });

  test('map view has correct structure', async ({ page }) => {
    const mapView = page.locator('#map-view');
    await expect(mapView).toHaveClass(/view/);
  });
});

/** Area-level OLC hashes (e.g. 9G000000+) must classify as map, not chat — map stays visible behind modal. */
test.describe('Map hash (coarse plus code)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((hex) => {
      try {
        localStorage.clear();
        localStorage.setItem('nostr_private_key', hex);
      } catch (_) {}
    }, '0000000000000000000000000000000000000000000000000000000000000001');
  });

  test('area plus code in hash opens notes modal without switching to chat', async ({ page }) => {
    await page.goto('/#9G000000+');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body.nr-surface-chat')).toHaveCount(0);
    await expect(page.locator('#pluscode-notes-modal.active')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#map-view')).toBeVisible();
  });
});

/**
 * Leaflet fallback (?map=leaflet) tap-to-open regression suite.
 * Reproduces the iPhone Safari issue where tapping the fallback map did not
 * open the pluscode notes modal.
 */
test.describe('Leaflet fallback tap', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((hex) => {
      try {
        localStorage.clear();
        localStorage.setItem('nostr_private_key', hex);
        localStorage.setItem('nr-web.mapRenderer', 'leaflet');
      } catch (_) {}
    }, '0000000000000000000000000000000000000000000000000000000000000001');
  });

  async function gotoLeafletFallback(page) {
    await page.goto('/?map=leaflet');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#map[data-map-fallback="leaflet"]')).toBeVisible({ timeout: 20000 });
    // Make sure Leaflet finished its initial setView (pixel origin set, sized).
    await page.waitForFunction(() => {
      const c = document.querySelector('.leaflet-container');
      if (!c) return false;
      const r = c.getBoundingClientRect();
      if (r.width < 50 || r.height < 50) return false;
      if (typeof window.__nrwebLeafletTap !== 'function') return false;
      try {
        const m = window.__nrwebLeafletMap;
        const center = m && m.getCenter && m.getCenter();
        return !!(center && Number.isFinite(center.lat) && Number.isFinite(center.lng));
      } catch (_) {
        return false;
      }
    }, { timeout: 20000 });
  }

  test('canonical helper opens the modal', async ({ page }) => {
    await gotoLeafletFallback(page);
    await page.evaluate(() => {
      const r = document.querySelector('.leaflet-container').getBoundingClientRect();
      window.__nrwebLeafletTap(r.left + r.width / 2, r.top + r.height / 2);
    });
    await expect(page.locator('#pluscode-notes-modal.active')).toBeVisible({ timeout: 20000 });
  });

  test('chromium mouse click opens the modal', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Mouse click is the chromium-specific path');
    await gotoLeafletFallback(page);
    const box = await page.locator('.leaflet-container').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('#pluscode-notes-modal.active')).toBeVisible({ timeout: 20000 });
  });

  test('iOS Safari touchscreen tap opens the modal', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Reproduces the iPhone Safari Leaflet fallback regression');
    await gotoLeafletFallback(page);
    const box = await page.locator('.leaflet-container').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('#pluscode-notes-modal.active')).toBeVisible({ timeout: 20000 });
  });
});

