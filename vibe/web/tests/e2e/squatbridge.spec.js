import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BERLIN_FIXTURE = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/squatbridge-berlin.json'), 'utf8'),
);
const PUBLIC_KEY_HEX = 'a'.repeat(64);
const BERLIN_STATIC_PATH = '**/examples/squatbridge-data/city/berlin.json';
const RADAR_API_PATTERN = '**/radar.squat.net/**';

async function clearSquatbridgeStorage(page) {
  await page.addInitScript(() => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && key.indexOf('squatbridge:') === 0) localStorage.removeItem(key);
      }
    } catch (_) {}
  });
}

async function mockBerlinStaticPrefetch(page, payload = BERLIN_FIXTURE) {
  await page.route(BERLIN_STATIC_PATH, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

async function blockRadarApi(page) {
  await page.route(RADAR_API_PATTERN, (route) => route.abort('failed'));
}

async function mockNip7Provider(page) {
  await page.addInitScript(({ pubkey }) => {
    window.nostr = {
      async getPublicKey() {
        return pubkey;
      },
      async signEvent(template) {
        return {
          ...template,
          id: '1'.repeat(64),
          pubkey,
          sig: '2'.repeat(128),
        };
      },
    };
  }, { pubkey: PUBLIC_KEY_HEX });
}

async function mockTrustrootsRelayEvents(page, events = []) {
  await page.addInitScript(({ relayEvents }) => {
    function matchesFilter(event, filter) {
      if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
      if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
      if (filter['#p']) {
        const pTags = (event.tags || []).filter((tag) => tag[0] === 'p').map((tag) => tag[1]);
        if (!pTags.some((pubkey) => filter['#p'].includes(pubkey))) return false;
      }
      return true;
    }

    class MockWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url) {
        super();
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.dispatchEvent(new Event('open'));
        }, 0);
      }

      send(raw) {
        const data = JSON.parse(raw);
        if (data[0] === 'AUTH') return;
        if (data[0] !== 'REQ') return;
        const subscriptionId = data[1];
        const filters = data.slice(2);
        const matches = relayEvents.filter((event) => filters.some((filter) => matchesFilter(event, filter)));
        setTimeout(() => {
          for (const event of matches) {
            this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(['EVENT', subscriptionId, event]) }));
          }
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(['EOSE', subscriptionId]) }));
        }, 0);
      }

      close() {
        if (this.readyState === MockWebSocket.CLOSED) return;
        this.readyState = MockWebSocket.CLOSED;
        this.dispatchEvent(new CloseEvent('close'));
      }
    }

    window.WebSocket = MockWebSocket;
  }, { relayEvents: events });
}

async function gotoSquatbridgeBerlin(page) {
  await page.goto('/examples/squatbridge.html#city/Berlin');
  await expect(page.locator('#sb-filter-value')).toHaveValue('Berlin');
}

async function waitForBerlinEvents(page) {
  await expect(page.locator('#sb-status')).toContainText(/events in Berlin/i);
  await expect(page.getByText('E2E Test Workshop')).toBeVisible();
}

async function expectMapLayoutRegression(page) {
  const metrics = await page.evaluate(() => {
    const app = document.querySelector('.sb-app');
    const main = document.querySelector('.sb-main');
    const mapColumn = document.querySelector('.sb-map-column');
    const mapEl = document.getElementById('sb-map');
    const appStyle = app ? getComputedStyle(app) : null;
    const mapStyle = mapEl ? getComputedStyle(mapEl) : null;
    return {
      appDisplay: appStyle?.display || '',
      appFlexGrow: Number(appStyle?.flexGrow || 0),
      appMinHeight: appStyle?.minHeight || '',
      appHeight: app?.clientHeight || 0,
      mainHeight: main?.clientHeight || 0,
      mapColumnHeight: mapColumn?.clientHeight || 0,
      mapHeight: mapEl?.clientHeight || 0,
      mapHasLeafletClass: mapEl?.classList.contains('leaflet-container') || false,
      mapMinHeight: mapStyle?.minHeight || '',
      viewport: window.innerHeight,
    };
  });

  expect(metrics.appDisplay).toBe('flex');
  expect(metrics.appFlexGrow).toBeGreaterThan(0);
  expect(metrics.appMinHeight).toBe('0px');
  expect(metrics.mapMinHeight).toBe('0px');
  expect(metrics.mapHasLeafletClass).toBe(true);
  expect(metrics.appHeight).toBeGreaterThan(400);
  expect(metrics.mainHeight / metrics.appHeight).toBeGreaterThanOrEqual(0.8);
  expect(metrics.mapHeight / metrics.mapColumnHeight).toBeGreaterThanOrEqual(0.85);
  expect(metrics.mapHeight / metrics.viewport).toBeGreaterThanOrEqual(0.45);
}

test.describe('Squatbridge', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await clearSquatbridgeStorage(page);
    await mockBerlinStaticPrefetch(page);
    await blockRadarApi(page);
  });

  test('shows shared Nostroots chrome and keeps the Squatbridge title', async ({ page }) => {
    await gotoSquatbridgeBerlin(page);

    const chrome = page.locator('header.header');
    await expect(chrome).toBeVisible();
    await expect(chrome.locator('.header-brand img')).toBeVisible();
    await expect(chrome.getByRole('link', { name: 'Android' })).toBeVisible();
    await expect(chrome.getByRole('link', { name: 'iOS' })).toBeVisible();
    await expect(chrome.getByRole('link', { name: 'Background' })).toHaveAttribute('href', /background/);
    await expect(page.locator('#nostr-key-status')).toBeAttached();

    const title = page.locator('h1.sb-title');
    await expect(title).toContainText('Squatbridge');
    await expect(title).toContainText('｟(･)｠');
    await expect(title).toHaveCSS('font-family', /Courier/i);
  });

  test('loads Berlin from static prefetch without calling radar.squat.net', async ({ page }) => {
    let radarRequests = 0;
    await page.route(RADAR_API_PATTERN, (route) => {
      radarRequests += 1;
      route.abort('failed');
    });

    await gotoSquatbridgeBerlin(page);
    await waitForBerlinEvents(page);

    await expect(page.locator('#sb-status')).toContainText(/prefetched/i);
    expect(radarRequests).toBe(0);
  });

  test('map fills the available height below both headers', async ({ page }) => {
    await gotoSquatbridgeBerlin(page);
    await waitForBerlinEvents(page);
    await expect(page.locator('#sb-map .leaflet-tile').first()).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await expectMapLayoutRegression(page);
  });

  test('detects a NIP-07 key in the chrome bar', async ({ page }) => {
    await mockNip7Provider(page);
    await mockTrustrootsRelayEvents(page, []);
    await gotoSquatbridgeBerlin(page);

    await expect(page.locator('#nostr-key-status')).toContainText(/^npub1/, { timeout: 15000 });
    await expect(page.locator('#trustroots-identity-status')).toBeHidden();
  });

  test('opens the About modal from the app toolbar', async ({ page }) => {
    await gotoSquatbridgeBerlin(page);
    await page.getByRole('button', { name: 'About' }).click();
    await expect(page.getByRole('heading', { name: 'About Squatbridge' })).toBeVisible();
    await expect(page.locator('#sb-about-modal').getByRole('link', { name: 'radar.squat.net' })).toBeVisible();
  });
});
