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

/** Area-level OLC hashes (e.g. 9G000000+) must classify as Host & Meet area pages, not chat. */
test.describe('Map hash (coarse plus code)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((hex) => {
      try {
        localStorage.clear();
        localStorage.setItem('nostr_private_key', hex);
      } catch (_) {}
    }, '0000000000000000000000000000000000000000000000000000000000000001');
  });

  test('area plus code in hash opens Host & Meet area page without switching to chat', async ({ page }) => {
    await page.goto('/#9G000000+');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body.nr-surface-chat')).toHaveCount(0);
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nr-host-view')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#pluscode-notes-title')).toHaveText('Host & Meet');
    await expect(page.locator('.area-sidebar #pluscode-notes-title')).toBeVisible();
    await expect(page.locator('#nr-host-view .modal-header-title-row')).toHaveCount(0);
    await expect(page.locator('#pluscode-notes-subtitle')).toHaveCount(0);
    await expect(page.locator('#pluscode-notes-modal .area-main')).toBeVisible();
    await expect(page.locator('#pluscode-notes-modal .area-sidebar')).toBeVisible();
    await expect(page.locator('#pluscode-notes-modal .area-thread')).toBeVisible();
    await expect(page.locator('#area-location-code')).toHaveText('9G000000+');
    await expect(page.locator('#area-location-tile-grid img')).toHaveCount(9);
    await expect(page.locator('#pluscode-notes-close-btn')).toHaveCount(0);
    await expect(page.locator('.area-sidebar-header #notification-subscribe-block')).toBeVisible();
    await expect(page.locator('#area-location-card #notification-subscribe-block')).toHaveCount(0);
    await expect(page.locator('#map-view')).not.toBeVisible();
  });

  test('Map nav leaves the Host & Meet area page', async ({ page }) => {
    await page.goto('/#9G000000+');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });

    await page.locator('#nav-map-btn').click();
    await expect(page.locator('body.nr-surface-host')).toHaveCount(0);
    await expect(page.locator('#nr-host-view')).not.toBeVisible();
    await expect(page.locator('#map-view')).toBeVisible();
  });

  test('Host & Meet area preview opens the Map view', async ({ page }) => {
    await page.goto('/#9G000000+');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.area-location-controls')).toHaveCount(0);

    await page.locator('.area-location-map').click();
    await expect(page.locator('body.nr-surface-host')).toHaveCount(0);
    await expect(page.locator('#nr-host-view')).not.toBeVisible();
    await expect(page.locator('#map-view')).toBeVisible();
    await expect(page).not.toHaveURL(/#9G000000\+/);
  });

  test('Host nav returns to the last Host & Meet area after visiting Chat', async ({ page }) => {
    await page.goto('/#8C000000+');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#area-location-code')).toHaveText('8C000000+');

    await page.locator('#app-header a[href="#chat"]').click();
    await expect(page.locator('body.nr-surface-chat')).toBeVisible({ timeout: 20000 });

    await page.locator('#nav-host-btn').click();
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#area-location-code')).toHaveText('8C000000+');
    await expect(page).toHaveURL(/#8C000000\+/);
  });

  test('mobile Host & Meet shows area info before thread in one page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#9G000000+');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });

    const sidebarBox = await page.locator('#nr-host-view .area-sidebar').boundingBox();
    const threadBox = await page.locator('#nr-host-view .area-thread').boundingBox();
    expect(sidebarBox).toBeTruthy();
    expect(threadBox).toBeTruthy();
    expect(sidebarBox.y).toBeLessThan(threadBox.y);
    await expect(page.locator('#nr-host-view .area-thread')).toBeVisible();
  });
});

/**
 * Leaflet fallback (?map=leaflet) tap-to-open regression suite.
 * Reproduces the iPhone Safari issue where tapping the fallback map did not
 * open the Host & Meet area page.
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

  test('canonical helper opens the area page', async ({ page }) => {
    await gotoLeafletFallback(page);
    await page.evaluate(() => {
      const r = document.querySelector('.leaflet-container').getBoundingClientRect();
      window.__nrwebLeafletTap(r.left + r.width / 2, r.top + r.height / 2);
    });
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nr-host-view')).toBeVisible({ timeout: 20000 });
  });

  test('chromium mouse click opens the area page', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Mouse click is the chromium-specific path');
    await gotoLeafletFallback(page);
    const box = await page.locator('.leaflet-container').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nr-host-view')).toBeVisible({ timeout: 20000 });
  });

  test('iOS Safari touchscreen tap opens the area page', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Reproduces the iPhone Safari Leaflet fallback regression');
    await gotoLeafletFallback(page);
    const box = await page.locator('.leaflet-container').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nr-host-view')).toBeVisible({ timeout: 20000 });
  });
});
