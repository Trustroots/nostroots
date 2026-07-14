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

async function mockNip7ProviderWithoutKey(page) {
  await page.addInitScript(() => {
    window.nostr = {
      async getPublicKey() {
        return '';
      },
    };
  });
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

    await expect(page.getByRole('heading', { name: 'Nostroots' })).toBeVisible();
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
    await expect(page.getByRole('link', { name: /Open Nostroots Web/ })).toHaveAttribute('href', 'web/');
    await expect(page.getByRole('link', { name: /Open Squatbridge/ })).toHaveAttribute('href', 'examples/squatbridge/');
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
    await expect(footer.getByRole('link', { name: 'Trustroots', exact: true })).toHaveAttribute('href', 'https://www.trustroots.org/');
    await expect(footer.getByRole('link', { name: 'Nostroots', exact: true })).toHaveAttribute('href', /\/$/);
    await expect(footer.getByRole('link', { name: 'Support' })).toHaveAttribute('href', 'https://www.trustroots.org/support');
    await expect(footer.getByRole('link', { name: 'Edit this page' })).toHaveCount(0);
    await expect(footer.locator('.site-footer-build')).toBeVisible();

    const experimentalToggle = page.getByRole('checkbox', { name: 'Show more experimental apps' });
    await expect(experimentalToggle).not.toBeChecked();
    await expect(page.getByRole('link', { name: /Open Nostrail/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Nostroots Map/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Open wikistr/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Open Trustroots Wiki/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Nomadwiki/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Trashwiki/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Hitchwiki$/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Hitchwiki Maps/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Radiostr/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Let's Miti/ })).toBeHidden();

    await experimentalToggle.check();

    await expect(page.getByRole('link', { name: /Open Nostrail/ })).toHaveAttribute('href', 'nostrail/');
    await expect(page.locator('.location .card-label')).toHaveText('More experimental');
    await expect(page.getByRole('link', { name: /Open Nostroots Map/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Open wikistr/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Open Radiostr/ })).toHaveAttribute('href', 'examples/radiostr/');
    await expect(page.getByRole('link', { name: /Open Trustroots Wiki/ })).toHaveAttribute('href', 'https://wiki.trustroots.org/');
    await expect(page.getByRole('link', { name: /Open Nomadwiki/ })).toHaveAttribute('href', 'https://nomadwiki.org/');
    await expect(page.getByRole('link', { name: /Open Trashwiki/ })).toHaveAttribute('href', 'https://trashwiki.org/');
    await expect(page.getByRole('link', { name: /Open Hitchwiki$/ })).toHaveAttribute('href', 'https://hitchwiki.org/');
    await expect(page.getByRole('link', { name: /Open Hitchwiki Maps/ })).toHaveAttribute('href', 'https://maps.hitchwiki.org/');
    await expect(page.locator('.wiki-site[target]')).toHaveCount(0);
    await expect(page.locator('.wiki-site .app-icon img')).toHaveCount(5);
    await expect(page.locator('.trustroots-wiki .app-icon img')).toHaveAttribute('src', 'wiki-logos/trustroots-wiki.png');
    await expect(page.locator('.nomadwiki .app-icon img')).toHaveAttribute('src', 'wiki-logos/nomadwiki.png');
    await expect(page.locator('.trashwiki .app-icon img')).toHaveAttribute('src', 'wiki-logos/trashwiki.png');
    await expect(page.locator('.hitchwiki .app-icon img')).toHaveAttribute('src', 'wiki-logos/hitchwiki.png');
    await expect(page.locator('.hitchwiki-maps .app-icon img')).toHaveAttribute('src', 'wiki-logos/hitchwiki-maps.png');
    await expect(page.locator('.trustroots-wiki .card-action')).toHaveCSS('background-color', 'rgb(0, 131, 111)');
    await expect(page.locator('.nomadwiki .card-action')).toHaveCSS('background-color', 'rgb(246, 214, 24)');
    await expect(page.locator('.trashwiki .card-action')).toHaveCSS('background-color', 'rgb(220, 221, 203)');
    await expect(page.locator('.hitchwiki .card-action')).toHaveCSS('background-color', 'rgb(238, 206, 86)');
    await expect(page.locator('.hitchwiki-maps .card-action')).toHaveCSS('background-color', 'rgb(241, 207, 80)');
    await expect(page.locator('.wiki-site .card-label')).toHaveText([
      'More experimental',
      'More experimental',
      'More experimental',
      'More experimental',
      'More experimental',
    ]);
    await expect(page.locator('.radiostr .card-label')).toHaveText('More experimental');
    await expect(page.locator('.radiostr .app-icon')).toHaveText('◎');
    await expect(page.locator('.radiostr .card-action')).toHaveCSS('background-color', 'rgb(18, 138, 120)');
    await expect(page.getByRole('link', { name: /Open Let's Miti/ })).toHaveAttribute('href', 'https://www.letsmiti.app/');
    await expect(page.getByRole('link', { name: /Open Let's Miti/ })).toHaveAttribute('target', '_blank');
    await expect(page.locator('.miti .card-label')).toHaveText('More experimental / 3rd party');
    await expect(page.locator('.experimental-card h2')).toHaveText([
      'Nostrail',
      'Radiostr',
      'Trustroots Wiki',
      'Nomadwiki',
      'Trashwiki',
      'Hitchwiki',
      'Hitchwiki Maps',
      "Let's Miti",
    ]);
  });

  test('keeps Nostroots Web as the only Nostroots browser map card', async ({ page }) => {
    await page.goto('/');

    const retiredMapCard = page.getByRole('link', { name: /Open Nostroots Map/ });
    await expect(page.getByRole('link', { name: /Open Nostroots Web/ })).toHaveAttribute('href', 'web/');
    await expect(page.getByRole('link', { name: /Open Squatbridge/ })).toHaveAttribute('href', 'examples/squatbridge/');
    await expect(retiredMapCard).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Show more experimental apps' }).check();

    await expect(retiredMapCard).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Open Nostrail/ })).toHaveAttribute('href', 'nostrail/');
    await expect(page.getByRole('link', { name: /Open wikistr/ })).toHaveCount(0);
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

  test('explains how to install a signer when no NIP-07 key is available', async ({ page }) => {
    await page.goto('/');

    const keyStatusButton = page.getByRole('button', { name: 'No Nostr key detected. About Nostr keys' });
    await expect(keyStatusButton).toBeVisible();
    await expect(keyStatusButton).toHaveAttribute('aria-haspopup', 'dialog');

    await keyStatusButton.click();

    const modal = page.getByRole('dialog', { name: 'Nostr connection' });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Connect a Nostr key' })).toBeVisible();
    await expect(modal).toContainText('Firefox support is still under review.');
    await expect(modal.getByRole('link', { name: 'Nostroots Extension' })).toHaveAttribute('href', 'https://chromewebstore.google.com/detail/nostroots-extension/kmgfnmgidnajdpjnpfekmcbbdpgdimhf');
    await expect(modal.getByRole('link', { name: 'Android' })).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=org.trustroots.nostroots');
    await expect(modal.getByRole('link', { name: 'iOS' })).toHaveAttribute('href', 'https://apps.apple.com/app/nostroots/id6755037304');

    await modal.getByRole('button', { name: 'Close Nostr connection information' }).click();

    await expect(modal).toBeHidden();
  });

  test('explains how to generate a key when the signer has none', async ({ page }) => {
    await mockNip7ProviderWithoutKey(page);
    await page.goto('/');

    const keyStatusButton = page.getByRole('button', { name: 'NIP-07 extension detected. Waiting for key access.' });
    await expect(keyStatusButton).toBeVisible();
    await keyStatusButton.click();

    const modal = page.getByRole('dialog', { name: 'Nostr connection' });
    await expect(modal.getByRole('heading', { name: 'Set up your Nostr key' })).toBeVisible();
    await expect(modal).toContainText('Generate or import a key');
  });

  test('hides app download prompts in Nostroots Browser', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 NostrootsBrowser/1.0 iOS-native',
    });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('#download-section')).toBeHidden();
    await expect(page.locator('html')).toHaveClass(/is-in-nostroots-browser/);
    await expect(page.locator('.hub-nav').getByRole('link', { name: 'Android' })).toBeHidden();
    await expect(page.locator('.hub-nav').getByRole('link', { name: 'iOS' })).toBeHidden();
    await expect(page.locator('.hub-header .lead')).toBeHidden();
    await expect(page.locator('#web-experiences-heading')).toBeHidden();
    await expect(page.locator('#web-experiences-section .section-lead')).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Squatbridge/ })).toBeVisible();

    await context.close();
  });

  test('hides app links when the Nostroots Browser bridge arrives after page startup', async ({ page }) => {
    await page.addInitScript(() => {
      setTimeout(() => {
        window.nostr = { __nostrootsBrowser: true };
      }, 100);
    });
    await page.goto('/');

    await expect(page.locator('.hub-nav').getByRole('link', { name: 'Android' })).toBeHidden();
    await expect(page.locator('.hub-nav').getByRole('link', { name: 'iOS' })).toBeHidden();
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
    expect(await page.locator('#trustroots-identity-status').getAttribute('href')).toBeNull();
    await expect(page.locator('#trustroots-identity-status')).toHaveAttribute('role', 'button');
    await expect(page.locator('#trustroots-identity-status')).toHaveAttribute('title', 'About your linked Trustroots identity');
    await expect(page.locator('#trustroots-identity-status')).toHaveAttribute('aria-label', 'About your linked Trustroots identity');
    await expect(page.locator('#trustroots-identity-status .identity-link-label')).toBeVisible();
    await expect(page.locator('#trustroots-identity-status .identity-link-icon')).toBeHidden();
    await expect(page.locator('#browser-extensions-section')).toBeHidden();
    await expect(page.locator('.hub-header .lead')).toBeVisible();
    await expect(page.locator('#web-experiences-heading')).toBeVisible();
    await expect(page.locator('#web-experiences-section .section-lead')).toBeVisible();
    await page.locator('#trustroots-identity-status').click();
    const modal = page.getByRole('dialog', { name: 'Nostr connection' });
    await expect(modal.getByRole('heading', { name: 'Trustroots identity linked' })).toBeVisible();
    await expect(modal).toContainText('alice@trustroots.org is linked to the public key held by your signer.');
    await expect(modal.locator('[data-nip7-linked-npub]')).toHaveText(/^npub1.{5}\.\.\..{8}$/);
    await expect(modal.locator('[data-nip7-linked-npub]')).toHaveAttribute('title', /^npub1/);
    await expect(modal.getByRole('link', { name: 'Change your Trustroots profile link' })).toHaveAttribute('href', 'https://www.trustroots.org/profile/edit/networks');
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
    await page.locator('#nostr-key-status').click();
    const modal = page.getByRole('dialog', { name: 'Nostr connection' });
    await expect(modal.getByRole('heading', { name: 'Link your Trustroots identity' })).toBeVisible();
    await expect(modal.getByRole('link', { name: 'Open Trustroots profile settings' })).toHaveAttribute('href', 'https://www.trustroots.org/profile/edit/networks');
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
    await expect(page.getByRole('heading', { name: 'Background' })).toBeVisible();
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
    await expect(footer.getByRole('link', { name: 'Trustroots', exact: true })).toHaveAttribute('href', 'https://www.trustroots.org/');
    await expect(footer.getByRole('link', { name: 'Nostroots', exact: true })).toHaveAttribute('href', '../');
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

  test('redirects legacy root hash routes to the web app', async ({ page }) => {
    await page.goto('/#stats');

    await expect(page).toHaveURL(/\/web\/#stats$/);
  });

  test('redirects legacy root query shortcuts to the web app', async ({ page }) => {
    await page.goto('/?welcome=1');

    await expect(page).toHaveURL(/\/web\/\?welcome=1/);
  });

  test('redirects old v0 app links to the web app', async ({ page }) => {
    await page.goto('/v0/#stats');

    await expect(page).toHaveURL(/\/web\/#stats$/);
  });

  test('does not serve the old Trustroots map path', async ({ page }) => {
    const response = await page.goto('/trustroots-map/');

    expect(response?.status()).toBe(404);
  });
});
