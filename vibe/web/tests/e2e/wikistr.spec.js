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
          const subID = 'wikistr-0';
          setTimeout(() => {
            this.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify(['EOSE', subID]),
            }));
          }, 0);
        }, 0);
      }

      send() {}

      close() {}
    }

    window.WebSocket = MockWebSocket;
  });
}

test.describe('Wikistr', () => {
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
