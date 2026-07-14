import { test, expect } from './fixtures.js';

async function mockWikistrRelayDiscovery(page) {
  await page.addInitScript(() => {
    class MockWebSocket extends EventTarget {
      static OPEN = 1;

      constructor(url) {
        super();
        this.url = url;
        this.readyState = MockWebSocket.OPEN;
        setTimeout(() => {
          this.dispatchEvent(new Event('open'));
        }, 0);
      }

      send(message) {
        const payload = JSON.parse(message);
        if (payload[0] !== 'REQ') return;
        setTimeout(() => {
          this.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify(['EOSE', payload[1]]),
          }));
        }, 0);
      }

      close() {}
    }

    window.WebSocket = MockWebSocket;
  });
}

async function mockWikistrSignerAndWikiPages(page) {
  await page.addInitScript(() => {
    window.nostr = {
      async signEvent(event) {
        return {
          ...event,
          id: '1'.repeat(64),
          pubkey: '2'.repeat(64),
          sig: '3'.repeat(128),
        };
      },
    };
  });

  await page.route('https://relay.guaka.org/proxy/nomadwiki.org/api.php*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('action') === 'parse') {
      const pageTitle = url.searchParams.get('page');
      const text = pageTitle === 'Lisbon'
        ? '<p id="lisbon-loaded">Lisbon target loaded.</p>'
        : '<p><a href="/en/Lisbon" title="Lisbon">Lisbon</a></p>';
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ parse: { title: pageTitle === 'Lisbon' ? 'Lisbon' : 'Main Page', text } }),
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ query: { recentchanges: [] } }),
    });
  });
}

test.describe('Wikistr', () => {
  test('keeps MediaWiki article links inside Wikistr', async ({ page }) => {
    await mockWikistrRelayDiscovery(page);
    await mockWikistrSignerAndWikiPages(page);
    await page.goto('/examples/wikistr/#nomadwiki');

    const lisbon = page.locator('#main-page-content').getByRole('link', { name: 'Lisbon' });
    await expect(lisbon).toHaveAttribute('href', '#nomadwiki/Lisbon');
    await expect(lisbon).not.toHaveAttribute('target', '_blank');

    await lisbon.click();

    await expect(page).toHaveURL(/#nomadwiki\/Lisbon$/);
    await expect(page.locator('#main-page-content')).toContainText('Lisbon target loaded.');
  });

  test('shows signer help when no NIP-07 provider is available', async ({ page }) => {
    await mockWikistrRelayDiscovery(page);
    await page.goto('/examples/wikistr/#hitchwiki');

    const main = page.locator('#main-page-content');
    await expect(main).toContainText('Connect a Nostr key to read this wiki.');
    await expect(main.getByRole('link', { name: 'Nostroots app' })).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=org.trustroots.nostroots',
    );
    await expect(main.getByRole('link', { name: 'Nostroots Extension' })).toHaveAttribute(
      'href',
      'https://chromewebstore.google.com/detail/nostroots-extension/kmgfnmgidnajdpjnpfekmcbbdpgdimhf',
    );
    await expect(main).not.toContainText('Wrapster proxy');
    await expect(main).not.toContainText('No HTTP status');

    await expect(page.locator('#changes-status')).toContainText('Nostroots app');
    await expect(page.locator('#changes-status')).toContainText('Nostroots Extension');
  });
});
