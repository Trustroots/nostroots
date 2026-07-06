import { test, expect } from './fixtures.js';

const publicKeyHex = 'a'.repeat(64);

async function mockNip7Provider(page, { delayMs = 0 } = {}) {
  await page.addInitScript(({ pubkey, delay }) => {
    function installProvider() {
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
    }

    if (delay > 0) {
      setTimeout(installProvider, delay);
    } else {
      installProvider();
    }
  }, { pubkey: publicKeyHex, delay: delayMs });
}

async function mockTrustrootsRelayEvents(page, events) {
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

function trustrootsKind0Event(nip05) {
  return {
    id: '3'.repeat(64),
    pubkey: publicKeyHex,
    created_at: 100,
    kind: 0,
    tags: [],
    content: JSON.stringify({ nip05 }),
    sig: '4'.repeat(128),
  };
}

test.describe('Nostroots Web hub', () => {
  test('shows default options and reveals more experimental apps on request', async ({ page, isMobile }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Choose where to start with Nostroots.' })).toBeVisible();
    await expect(page.locator('.lead')).toContainText('Open your Trustroots profile, read traveler notes');
    await expect(page.getByRole('link', { name: 'learn why Nostroots is built on Nostr' })).toHaveAttribute('href', 'background/');
    await expect(page.getByRole('link', { name: 'Background' }).first()).toHaveAttribute('href', 'background/');
    await expect(page.locator('#android').getByRole('link', { name: 'Get on Google Play' })).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=org.trustroots.nostroots');
    await expect(page.locator('#android').getByRole('link', { name: 'latest APK' })).toHaveAttribute('href', 'https://github.com/Trustroots/nostroots/releases');
    await expect(page.locator('#ios').getByRole('link', { name: 'Get on the App Store' })).toHaveAttribute('href', 'https://apps.apple.com/app/nostroots/id6755037304');
    expect(await page.evaluate(() => Boolean(
      document.getElementById('download-section').compareDocumentPosition(document.getElementById('web-experiences-section')) & Node.DOCUMENT_POSITION_FOLLOWING
    ))).toBe(true);
    expect(await page.evaluate(() => Boolean(
      document.getElementById('browser-extensions-section').compareDocumentPosition(document.getElementById('web-experiences-section')) & Node.DOCUMENT_POSITION_FOLLOWING
    ))).toBe(true);
    await expect(page.locator('#nostr-key-status')).toContainText('no nostr key detected');
    await expect(page.locator('#trustroots-identity-status')).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Trustroots\.org/ })).toHaveAttribute('href', 'https://www.trustroots.org/profile/edit/networks');
    await expect(page.locator('.trustroots .app-icon img')).toHaveAttribute('src', 'https://www.trustroots.org/img/logo/horizontal-white.svg');
    await expect(page.getByRole('link', { name: /Open Nostroots Web/ })).toHaveAttribute('href', 'v0/');
    await expect(page.getByRole('link', { name: /Open Squatbridge/ })).toHaveAttribute('href', 'examples/squatbridge.html');
    await expect(page.locator('.squatbridge .app-icon')).toHaveText('｟(･)｠');
    await expect(page.locator('.squatbridge .card-action')).toHaveCSS('background-color', 'rgb(119, 119, 119)');
    await expect(page.getByRole('link', { name: /Open Treasures/ })).toHaveAttribute('href', 'https://treasures.to/');
    await expect(page.locator('.treasures .card-label')).toHaveText('3rd party');
    await expect(page.locator('.treasures .app-icon img')).toHaveAttribute('src', 'https://treasures.to/icon.svg');
    if (!isMobile) {
      await expect(page.locator('#browser-extensions-section')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Browser extensions' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Nostroots Extension for Chrome' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Nostroots Extension for Firefox' })).toBeVisible();
      await expect(page.locator('.browser-extension .app-icon img')).toHaveAttribute('src', 'browser-icon-chrome.svg');
      await expect(page.locator('.firefox-extension .app-icon img')).toHaveAttribute('src', 'browser-icon-firefox.svg');
    } else {
      await expect(page.locator('#browser-extensions-section')).toBeHidden();
    }

    const footer = page.locator('footer.site-footer');
    await expect(footer.getByRole('link', { name: 'Trustroots.org' })).toHaveAttribute('href', 'https://www.trustroots.org/');
    await expect(footer.getByRole('link', { name: 'Nostroots' })).toHaveAttribute('href', /\/$/);
    await expect(footer.getByRole('link', { name: 'Support' })).toHaveAttribute('href', 'https://www.trustroots.org/support');
    await expect(footer.getByRole('link', { name: 'Edit this page' })).toHaveAttribute('href', 'https://github.com/Trustroots/nostroots/edit/main/vibe/web/index.html');
    await expect(footer.locator('.site-footer-build')).toBeVisible();

    const experimentalToggle = page.getByRole('checkbox', { name: 'Show more experimental apps' });
    await expect(experimentalToggle).not.toBeChecked();
    await expect(page.getByRole('link', { name: /Open Nostrail/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Nostroots Map/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open wikistr/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Let's Miti/ })).toBeHidden();

    await experimentalToggle.check();

    await expect(page.getByRole('link', { name: /Open Nostrail/ })).toHaveAttribute('href', 'nostrail/');
    await expect(page.locator('.location .card-label')).toHaveText('More experimental');
    await expect(page.getByRole('link', { name: /Open Nostroots Map/ })).toHaveAttribute('href', 'nostroots-map/');
    await expect(page.locator('.secondary .card-label')).toHaveText('More experimental');
    await expect(page.getByRole('link', { name: /Open wikistr/ })).toHaveAttribute('href', 'https://wikistr.trustroots.org/');
    await expect(page.getByRole('link', { name: /Open wikistr/ })).toHaveAttribute('target', '_blank');
    await expect(page.locator('.wikistr .card-label')).toHaveText('More experimental');
    await expect(page.locator('.wikistr .app-icon')).toHaveText('⭐');
    await expect(page.locator('.wikistr .app-icon')).toHaveCSS('background-color', 'rgb(79, 143, 102)');
    await expect(page.locator('.wikistr .card-action')).toHaveCSS('background-color', 'rgb(79, 143, 102)');
    await expect(page.locator('.wikistr')).toContainText('Nomadwiki, Trashwiki, Hitchwiki, and Trustroots wiki');
    await expect(page.getByRole('link', { name: /Open Let's Miti/ })).toHaveAttribute('href', 'https://www.letsmiti.app/');
    await expect(page.getByRole('link', { name: /Open Let's Miti/ })).toHaveAttribute('target', '_blank');
    await expect(page.locator('.miti .card-label')).toHaveText('More experimental / 3rd party');
    await expect(page.locator('.experimental-card h2')).toHaveText([
      'Nostrail',
      'Nostroots Map',
      'wikistr ⭐',
      "Let's Miti",
    ]);
  });

  test('shows app QR codes only on wider screens', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/');

    await expect(page.locator('#android .app-qr')).toBeVisible();
    await expect(page.locator('#android .app-qr')).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=org.trustroots.nostroots');
    await expect(page.locator('#android .app-qr img')).toHaveAttribute('src', 'app-qr-android.svg');
    await expect(page.locator('#ios .app-qr')).toBeVisible();
    await expect(page.locator('#ios .app-qr')).toHaveAttribute('href', 'https://apps.apple.com/app/nostroots/id6755037304');
    await expect(page.locator('#ios .app-qr img')).toHaveAttribute('src', 'app-qr-ios.svg');

    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.locator('#android .app-qr')).toBeHidden();
    await expect(page.locator('#ios .app-qr')).toBeHidden();
  });

  test('tracks experimental app visibility changes', async ({ page }) => {
    await page.addInitScript(() => {
      window.__umamiEvents = [];
      window.umami = {
        track(name, data) {
          window.__umamiEvents.push({ name, data });
        },
      };
    });

    await page.goto('/');

    const experimentalToggle = page.getByRole('checkbox', { name: 'Show more experimental apps' });
    await experimentalToggle.check();
    await experimentalToggle.uncheck();

    expect(await page.evaluate(() => window.__umamiEvents)).toEqual([
      {
        name: 'nr_vibe_experimental_toggle',
        data: {
          enabled: true,
          hostname: 'localhost',
          source: 'show_experimental_toggle',
          surface: 'hub',
        },
      },
      {
        name: 'nr_vibe_experimental_toggle',
        data: {
          enabled: false,
          hostname: 'localhost',
          source: 'show_experimental_toggle',
          surface: 'hub',
        },
      },
    ]);
  });

  test('opens NIP-07 information from the missing key status', async ({ page }) => {
    await page.goto('/');

    const keyStatusButton = page.getByRole('button', { name: 'No Nostr key detected. About Nostr keys' });
    await expect(keyStatusButton).toBeVisible();
    await expect(keyStatusButton).toHaveAttribute('aria-haspopup', 'dialog');

    await keyStatusButton.click();

    const modal = page.getByRole('dialog', { name: 'Nostr keys' });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('A Nostr key is your account for Nostr apps');
    await expect(modal).toContainText('Keep the private key secret');
    await expect(modal.getByRole('link', { name: 'Nostroots Extension' })).toHaveAttribute('href', 'https://chromewebstore.google.com/detail/nostroots-extension/kmgfnmgidnajdpjnpfekmcbbdpgdimhf');
    await expect(modal.getByRole('link', { name: 'Android' })).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=org.trustroots.nostroots');
    await expect(modal.getByRole('link', { name: 'iOS' })).toHaveAttribute('href', 'https://apps.apple.com/app/nostroots/id6755037304');

    await modal.getByRole('button', { name: 'Close Nostr keys information' }).click();

    await expect(modal).toBeHidden();
  });

  test('hides app download prompts in Nostroots Browser', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone) NostrootsBrowser/1.0',
    });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('#download-section')).toBeHidden();
    await expect(page.locator('.hub-nav').getByRole('link', { name: 'Android' })).toBeHidden();
    await expect(page.locator('.hub-nav').getByRole('link', { name: 'iOS' })).toBeHidden();
    await expect(page.locator('.lead')).not.toContainText('get the mobile app');
    await expect(page.getByRole('link', { name: /Open Squatbridge/ })).toBeVisible();

    await context.close();
  });

  test('keeps experimental apps visible after reload', async ({ page }) => {
    await page.goto('/');

    const experimentalToggle = page.getByRole('checkbox', { name: 'Show more experimental apps' });
    await experimentalToggle.check();
    await expect(page.getByRole('link', { name: /Open Nostrail/ })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('nrweb_show_experimental_apps'))).toBe('true');

    await page.reload();

    await expect(experimentalToggle).toBeChecked();
    await expect(page.getByRole('link', { name: /Open Nostrail/ })).toBeVisible();
  });

  test('links to a Trustroots profile when the NIP-07 key has a Trustroots NIP-05', async ({ page }) => {
    await mockNip7Provider(page);
    await mockTrustrootsRelayEvents(page, [trustrootsKind0Event('Alice@www.trustroots.org')]);

    await page.goto('/');

    const card = page.locator('#trustroots-card');
    await expect(card).toHaveAttribute('href', 'https://www.trustroots.org/profile/edit/networks');
    await expect(page.locator('#trustroots-card-description')).toContainText('Manage your classic Trustroots profile, networks, and account settings.');
    await expect(page.locator('#trustroots-card-action')).toHaveText('Open Trustroots.org');
    await expect(page.locator('#nostr-key-status')).toBeHidden();
    await expect(page.locator('#trustroots-identity-status')).toHaveText('alice@trustroots.org');
    await expect(page.locator('#trustroots-identity-status')).toHaveAttribute('href', 'https://www.trustroots.org/profile/alice');
    await expect(page.locator('#trustroots-identity-status')).toHaveAttribute('title', /^npub1/);
    await expect(page.locator('#browser-extensions-section')).toBeHidden();
    expect(await page.evaluate(() => Boolean(
      document.getElementById('web-experiences-section').compareDocumentPosition(document.getElementById('download-section')) & Node.DOCUMENT_POSITION_FOLLOWING
    ))).toBe(true);
    expect(await page.evaluate(() => Boolean(
      document.querySelector('.hub-controls').compareDocumentPosition(document.getElementById('download-section')) & Node.DOCUMENT_POSITION_FOLLOWING
    ))).toBe(true);
  });

  test('prompts users to link Trustroots when the NIP-07 key has no Trustroots NIP-05', async ({ page }) => {
    await mockNip7Provider(page);
    await mockTrustrootsRelayEvents(page, []);

    await page.goto('/');

    const card = page.locator('#trustroots-card');
    await expect(card).toHaveAttribute('href', 'https://www.trustroots.org/profile/edit/networks');
    await expect(page.locator('#trustroots-card-description')).toContainText('Manage your classic Trustroots profile, networks, and account settings.');
    await expect(page.locator('#trustroots-card-action')).toHaveText('Open Trustroots.org');
    await expect(page.locator('#nostr-key-status')).toContainText(/^npub1/);
    await expect(page.locator('#trustroots-identity-status')).toBeHidden();
    await expect(page.locator('#browser-extensions-section')).toBeHidden();
  });

  test('detects a NIP-07 key injected after the hub starts', async ({ page }) => {
    await mockNip7Provider(page, { delayMs: 500 });
    await mockTrustrootsRelayEvents(page, []);

    await page.goto('/');

    await expect(page.locator('#nostr-key-status')).toContainText(/^npub1/);
    await expect(page.locator('#trustroots-identity-status')).toBeHidden();
    await expect(page.locator('#browser-extensions-section')).toBeHidden();
  });


  test('serves the background page with canonical metadata, anchors, and footer links', async ({ page }) => {
    await page.goto('/background/');

    await expect(page).toHaveTitle('Nostroots — Background');
    await expect(page.getByRole('heading', { name: 'Background on Nostroots' })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://nos.trustroots.org/background/');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://nos.trustroots.org/background/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://nos.trustroots.org/og-image.png');
    await expect(page.getByRole('link', { name: 'Technology' })).toHaveAttribute('href', '#technology--protocol');
    await expect(page.locator('#nostr-key-status')).toContainText('no nostr key detected');
    await expect(page.locator('#trustroots-identity-status')).toBeHidden();

    await page.getByRole('link', { name: 'Technology' }).click();
    await expect(page).toHaveURL(/#technology--protocol$/);
    await expect(page.getByRole('heading', { name: 'Technology & Protocol' })).toBeVisible();

    const footer = page.locator('footer.site-footer');
    await expect(footer.getByRole('link', { name: 'Trustroots.org' })).toHaveAttribute('href', 'https://www.trustroots.org/');
    await expect(footer.getByRole('link', { name: 'Nostroots' })).toHaveAttribute('href', '../');
    await expect(footer.getByRole('link', { name: 'Support' })).toHaveAttribute('href', 'https://www.trustroots.org/support');
    await expect(footer.getByRole('link', { name: 'Edit this page' })).toHaveAttribute('href', 'https://github.com/Trustroots/nostroots/edit/main/vibe/web/background/index.html');
    await expect(footer.locator('.site-footer-build')).toBeVisible();
  });

  test('keeps old more URLs compatible with the background page', async ({ page }) => {
    for (const url of ['/more.html', '/more/']) {
      const response = await page.request.get(url);
      expect(response.status()).toBe(200);
      expect(await response.text()).toContain('https://nos.trustroots.org/background/');
    }
  });

  test('redirects legacy hash routes to the v0 app', async ({ page }) => {
    await page.goto('/#stats');

    await expect(page).toHaveURL(/\/v0\/#stats$/);
  });

  test('redirects legacy query shortcuts to the v0 app', async ({ page }) => {
    await page.goto('/?welcome=1');

    await expect(page).toHaveURL(/\/v0\/\?welcome=1/);
  });

  test('does not serve the old Trustroots map path', async ({ page }) => {
    const response = await page.goto('/trustroots-map/');

    expect(response?.status()).toBe(404);
  });
});
