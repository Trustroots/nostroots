import { test, expect } from './fixtures.js';

const USER_PUBKEY = '1'.repeat(64);
const ALICE_PUBKEY = '2'.repeat(64);
const BOB_PUBKEY = '3'.repeat(64);
const PEER_PUBKEY = '4'.repeat(64);

async function installNostrailMocks(page) {
  await page.addInitScript(({ userPubkey }) => {
    window.__nostrailSent = [];
    window.__nostrailSockets = [];
    window.__nostrailEventCounter = 0;

    window.nostr = {
      __nostrootsBrowser: true,
      getPublicKey: async () => userPubkey,
      signEvent: async (event) => ({
        ...event,
        pubkey: userPubkey,
        id: `signed-${++window.__nostrailEventCounter}`,
        sig: `${window.__nostrailEventCounter}`.padStart(128, '0'),
      }),
      nip44: {
        encrypt: async (peerPubkey, plaintext) => `cipher:${peerPubkey}:${btoa(plaintext)}`,
        decrypt: async (peerPubkey, ciphertext) => {
          const prefix = `cipher:${peerPubkey}:`;
          if (!String(ciphertext).startsWith(prefix)) throw new Error('bad cipher');
          return atob(String(ciphertext).slice(prefix.length));
        },
      },
    };

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success) {
          setTimeout(() => {
            success({
              coords: {
                latitude: 52.52,
                longitude: 13.405,
                accuracy: 120,
              },
            });
          }, 0);
        },
      },
    });

    class MockWebSocket extends EventTarget {
      constructor(url) {
        super();
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        window.__nostrailSockets.push(this);
        setTimeout(() => {
          this.readyState = 1;
          this.dispatchEvent(new Event('open'));
        }, 0);
      }

      send(raw) {
        const message = JSON.parse(raw);
        this.sent.push(message);
        window.__nostrailSent.push({ url: this.url, message });
        if (message[0] === 'EVENT') {
          setTimeout(() => {
            this.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify(['OK', message[1].id, true, '']),
            }));
          }, 0);
        }
      }

      close() {
        this.readyState = 3;
      }
    }

    window.WebSocket = MockWebSocket;
    window.__nostrailDispatchRelayEvent = (event) => {
      for (const socket of window.__nostrailSockets) {
        const req = socket.sent.find((message) => message[0] === 'REQ');
        if (req) {
          socket.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify(['EVENT', req[1], event]),
          }));
        }
      }
    };
  }, { userPubkey: USER_PUBKEY });

  await page.route('https://trustroots.org/.well-known/nostr.json?name=*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        names: {
          alice: ALICE_PUBKEY,
          bob: BOB_PUBKEY,
        },
      }),
    });
  });
}

function decodeMockCipher(content) {
  const parts = String(content).split(':');
  return JSON.parse(Buffer.from(parts[2], 'base64').toString('utf8'));
}

test.describe('Nostrail experience', () => {
  test('loads the standalone location sharing shell', async ({ page }) => {
    await page.goto('/nostrail/');

    await expect(page.getByText('Nostrail', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Share your current area' })).toBeVisible();
    await expect(page.locator('#nostrail-map')).toBeVisible();
    await expect(page.locator('#app-status')).toContainText('shares while the page is open');
    await expect(page.getByRole('button', { name: 'Start Sharing' })).toBeDisabled();
  });

  test('detects the Nostroots Browser NIP-07 signer', async ({ page }) => {
    await installNostrailMocks(page);

    await page.goto('/nostrail/');

    await expect(page.locator('#signer-status')).toHaveText('Nostroots Browser signer connected.');
    await expect(page.locator('#signer-status')).toHaveClass(/connected/);
  });

  test('accepts and dedupes recipient inputs', async ({ page }) => {
    await installNostrailMocks(page);
    await page.goto('/nostrail/');

    await page.getByRole('button', { name: 'People' }).click();
    await page.locator('#recipient-input').fill(`alice @alice https://www.trustroots.org/profile/bob ${'5'.repeat(64)}`);
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.locator('#recipient-feedback')).toHaveText('Added 3 people.');
    await expect(page.locator('#recipient-list .person-row')).toHaveCount(3);
    await expect(page.locator('#recipient-summary')).toContainText('3 selected');
  });

  test('publishes invite, location, and stop events through mocked relays', async ({ page }) => {
    await installNostrailMocks(page);
    await page.goto('/nostrail/');

    await page.getByRole('button', { name: 'People' }).click();
    await page.locator('#recipient-input').fill('alice');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('#recipient-feedback')).toHaveText('Added 1 person.');
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Start Sharing' }).click();
    await expect(page.locator('#app-status')).toContainText('Sharing started');
    await expect(page.locator('#current-area')).toContainText('approximate area');

    let events = await page.evaluate(() => window.__nostrailSent
      .map((entry) => entry.message)
      .filter((message) => message[0] === 'EVENT')
      .map((message) => message[1]));
    events = events.filter((event) => event.kind === 24111);

    expect(events.length).toBeGreaterThanOrEqual(6);
    expect(events.every((event) => event.tags.some((tag) => tag[0] === 'p' && tag[1] === ALICE_PUBKEY))).toBe(true);
    expect(events.every((event) => event.tags.some((tag) => tag[0] === 'expiration'))).toBe(true);
    expect(new Set(events.map((event) => decodeMockCipher(event.content).type))).toEqual(new Set([
      'trustroots.location.invite.v1',
      'trustroots.location.v1',
    ]));

    await page.getByRole('button', { name: 'Stop Sharing' }).click();
    await expect(page.locator('#app-status')).toContainText('Sharing stopped');

    const stopEvents = await page.evaluate(() => window.__nostrailSent
      .map((entry) => entry.message)
      .filter((message) => message[0] === 'EVENT')
      .map((message) => message[1])
      .filter((event) => event.kind === 24111 && atob(event.content.split(':')[2]).includes('trustroots.location.stop.v1')));
    expect(stopEvents.length).toBeGreaterThanOrEqual(3);
  });

  test('renders an incoming encrypted peer location', async ({ page }) => {
    await installNostrailMocks(page);
    await page.goto('/nostrail/');

    await page.waitForFunction(() => window.__nostrailSockets.some((socket) => socket.sent.some((message) => message[0] === 'REQ')));
    await page.evaluate(({ peerPubkey, userPubkey }) => {
      const payload = {
        type: 'trustroots.location.v1',
        sessionId: 'peer-session',
        area: '9F000000+',
        centerLat: 52.5,
        centerLon: 13.4,
        accuracyM: 500,
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };
      window.__nostrailDispatchRelayEvent({
        id: 'peer-event',
        pubkey: peerPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 24111,
        tags: [['p', userPubkey], ['expiration', String(payload.expiresAt)]],
        content: `cipher:${peerPubkey}:${btoa(JSON.stringify(payload))}`,
        sig: '9'.repeat(128),
      });
    }, { peerPubkey: PEER_PUBKEY, userPubkey: USER_PUBKEY });

    await expect(page.locator('#peer-list')).toContainText('9F000000+');
    await expect(page.locator('#peer-markers .marker.peer')).toHaveCount(1);
  });
});
