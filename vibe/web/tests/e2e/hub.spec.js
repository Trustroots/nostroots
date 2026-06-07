import { test, expect } from './fixtures.js';

const publicKeyHex = 'a'.repeat(64);

async function mockNip7Provider(page) {
  await page.addInitScript((pubkey) => {
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
  }, publicKeyHex);
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
  test('shows stable options by default and reveals experimental apps on request', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Choose where to continue.' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Edit Trustroots Networks/ })).toHaveAttribute('href', 'https://www.trustroots.org/profile/edit/networks');
    await expect(page.getByRole('link', { name: /Open Trustroots on Nostr/ })).toHaveAttribute('href', 'trustroots-map/');

    const experimentalToggle = page.getByRole('checkbox', { name: 'Show experimental apps' });
    await expect(experimentalToggle).not.toBeChecked();
    await expect(page.getByRole('link', { name: /Open Nostrail/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Nostroots Map/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Squatbridge/ })).toBeHidden();

    await experimentalToggle.check();

    await expect(page.getByRole('link', { name: /Open Nostrail/ })).toHaveAttribute('href', 'nostrail/');
    await expect(page.getByRole('link', { name: /Open Nostroots Map/ })).toHaveAttribute('href', 'nostroots-map/');
    await expect(page.getByRole('link', { name: /Open Squatbridge/ })).toHaveAttribute('href', 'examples/squatbridge.html');
  });

  test('links to a Trustroots profile when the NIP-07 key has a Trustroots NIP-05', async ({ page }) => {
    await mockNip7Provider(page);
    await mockTrustrootsRelayEvents(page, [trustrootsKind0Event('Alice@www.trustroots.org')]);

    await page.goto('/');

    const card = page.locator('#trustroots-card');
    await expect(card).toHaveAttribute('href', 'https://www.trustroots.org/profile/alice');
    await expect(page.locator('#trustroots-card-description')).toContainText('Open your linked Trustroots profile for alice@trustroots.org.');
    await expect(page.locator('#trustroots-card-action')).toHaveText('Open Trustroots Profile');
  });

  test('prompts users to link Trustroots when the NIP-07 key has no Trustroots NIP-05', async ({ page }) => {
    await mockNip7Provider(page);
    await mockTrustrootsRelayEvents(page, []);

    await page.goto('/');

    const card = page.locator('#trustroots-card');
    await expect(card).toHaveAttribute('href', 'https://www.trustroots.org/profile/edit/networks');
    await expect(page.locator('#trustroots-card-description')).toContainText('Link your Trustroots profile to your Nostr key so Trustroots on Nostr can recognize you.');
    await expect(page.locator('#trustroots-card-action')).toHaveText('Link Trustroots Profile');
  });

  test('redirects legacy hash routes to Trustroots Map', async ({ page }) => {
    await page.goto('/#stats');

    await expect(page).toHaveURL(/\/trustroots-map\/#stats$/);
  });

  test('redirects legacy query shortcuts to Trustroots Map', async ({ page }) => {
    await page.goto('/?welcome=1');

    await expect(page).toHaveURL(/\/trustroots-map\/\?welcome=1/);
  });
});
