import { test, expect } from './fixtures.js';

test.describe('Retired Nostroots Map route', () => {
  test('redirects to the canonical Nostroots Web map', async ({ page }) => {
    await page.goto('/nostroots-map/');

    await expect(page).toHaveURL(/\/web\/#map$/);
    await expect(page.locator('#map-view')).toBeAttached();
    await expect(page.locator('#nostroots-map')).toHaveCount(0);
  });

  test('preserves query parameters before the canonical map hash', async ({ page }) => {
    await page.goto('/nostroots-map/?source=legacy&embed=1#old-route');

    await expect(page).toHaveURL(/\/web\/\?source=legacy&embed=1#map$/);
    const redirectedUrl = new URL(page.url());
    expect(redirectedUrl.searchParams.get('source')).toBe('legacy');
    expect(redirectedUrl.searchParams.get('embed')).toBe('1');
    expect(redirectedUrl.hash).toBe('#map');
  });

  test('provides canonical, meta-refresh, and link fallbacks', async ({ request }) => {
    const response = await request.get('/nostroots-map/');
    const html = await response.text();

    expect(response.status()).toBe(200);
    expect(html).toContain('rel="canonical" href="https://nos.trustroots.org/web/#map"');
    expect(html).toContain('http-equiv="refresh" content="0; url=../web/#map"');
    expect(html).toContain('href="../web/#map"');
    expect(html).not.toContain('src="./index.js"');
  });
});
