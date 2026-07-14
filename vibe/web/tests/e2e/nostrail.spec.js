import { test, expect } from './fixtures.js';

const USER_PUBKEY = '1'.repeat(64);
const ALICE_PUBKEY = '2'.repeat(64);
const BOB_PUBKEY = '3'.repeat(64);
const PEER_PUBKEY = '4'.repeat(64);

async function installNostrailMocks(page, { geoMode = 'success', lookupScenarios = {} } = {}) {
  await page.addInitScript(({ userPubkey, geoMode: locationMode }) => {
    window.__nostrailSent = [];
    window.__nostrailSockets = [];
    window.__nostrailEventCounter = 0;
    window.__nostrailGeoCalls = 0;
    window.__nostrailRecipientLookupTimeoutMs = 50;

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
        getCurrentPosition(success, failure) {
          window.__nostrailGeoCalls += 1;
          if (locationMode === 'denied') {
            setTimeout(() => failure({ code: 1 }), 0);
            return;
          }
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
  }, { userPubkey: USER_PUBKEY, geoMode });

  await page.route('https://trustroots.org/.well-known/nostr.json?name=*', async (route) => {
    const name = new URL(route.request().url()).searchParams.get('name');
    const scenario = lookupScenarios[name];
    if (scenario === 'http') {
      await route.fulfill({ status: 503, body: 'unavailable' });
      return;
    }
    if (scenario === 'malformed') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{' });
      return;
    }
    if (scenario === 'slow') {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        names: {
          alice: ALICE_PUBKEY,
          alias: ALICE_PUBKEY,
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
    await expect(page.locator('.header .header-brand')).toBeVisible();
    await expect(page.locator('.header .header-app-link')).toHaveCount(2);
    await expect(page.locator('#nostrail-map')).not.toContainText('Choose people, then share your approximate area.');
    await expect(page.locator('#signer-short')).toHaveCount(0);
  });

  test('asks softly before requesting location and supports declining', async ({ page }) => {
    await installNostrailMocks(page);
    await page.goto('/nostrail/');

    await expect(page.locator('#location-prompt')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use My Location' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__nostrailGeoCalls)).toBe(0);

    await page.getByRole('button', { name: 'Not Now' }).click();
    await expect(page.locator('#location-prompt')).toBeHidden();
    await expect(page.locator('#app-status')).toContainText('still move the map and add people');
    await expect.poll(() => page.evaluate(() => window.__nostrailGeoCalls)).toBe(0);
  });

  test('centers after accepted location and preserves a moved viewport', async ({ page }) => {
    await installNostrailMocks(page);
    await page.goto('/nostrail/');
    await expect(page.locator('#map-status')).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.NostrailWeb.mapAdapter.isAvailable())).toBe(true);

    await page.getByRole('button', { name: 'Use My Location' }).click();
    await expect.poll(() => page.evaluate(() => window.__nostrailGeoCalls)).toBe(1);
    await expect(page.locator('#current-area')).toContainText('approximate area');
    await expect.poll(() => page.evaluate(() => window.NostrailWeb.mapAdapter.getAreaSnapshot().own)).toMatchObject({
      lat: 52.52125,
      lon: 13.40625,
      radius: 500,
    });

    const mapBox = await page.locator('#nostrail-map').boundingBox();
    await page.mouse.move(mapBox.x + mapBox.width * 0.72, mapBox.y + mapBox.height * 0.36);
    await page.mouse.down();
    await page.mouse.move(mapBox.x + mapBox.width * 0.55, mapBox.y + mapBox.height * 0.46, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.NostrailWeb.mapAdapter.getViewport().userMoved)).toBe(true);
    const moved = await page.evaluate(() => window.NostrailWeb.mapAdapter.getViewport());

    await page.evaluate(() => window.NostrailWeb.refreshSigner());
    await expect.poll(() => page.evaluate(() => window.NostrailWeb.mapAdapter.getViewport())).toMatchObject({
      lat: moved.lat,
      lon: moved.lon,
      zoom: moved.zoom,
      userMoved: true,
    });
  });

  test('keeps people controls usable when map assets fail', async ({ page }) => {
    await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    });
    await page.goto('/nostrail/');

    await expect(page.locator('#map-status')).toContainText('Map unavailable');
    await expect(page.getByRole('button', { name: 'People' })).toBeEnabled();
    await page.getByRole('button', { name: 'People' }).click();
    await expect(page.locator('#recipient-input')).toBeEditable();
  });

  test('shows retryable location feedback after permission denial', async ({ page }) => {
    await installNostrailMocks(page, { geoMode: 'denied' });
    await page.goto('/nostrail/');

    await page.getByRole('button', { name: 'Use My Location' }).click();
    await expect(page.locator('#app-status')).toContainText('permission was denied');
    await expect(page.getByRole('button', { name: 'Try My Location Again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'People' })).toBeEnabled();
  });

  test('detects the Nostroots Browser NIP-07 signer', async ({ page }) => {
    await installNostrailMocks(page);

    await page.goto('/nostrail/');

    await expect(page.locator('#signer-status')).toHaveText('Signer connected');
    await expect(page.locator('#signer-status')).toHaveAttribute('data-state', 'connected');
    await expect(page.locator('body')).not.toContainText(USER_PUBKEY);
    expect(await page.locator('[title], [aria-label]').evaluateAll((elements, pubkey) =>
      elements.some((element) => `${element.title} ${element.getAttribute('aria-label')}`.includes(pubkey)), USER_PUBKEY)).toBe(false);
  });

  test('accepts and dedupes recipient inputs', async ({ page }) => {
    await installNostrailMocks(page);
    await page.goto('/nostrail/');

    await page.getByRole('button', { name: 'People' }).click();
    await page.locator('#recipient-input').fill(`alice @alice https://www.trustroots.org/profile/bob ${'5'.repeat(64)}`);
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.locator('#recipient-feedback')).toHaveText('Added 3 people. 1 already selected.');
    await expect(page.locator('#recipient-list .person-row[data-state="resolved"]')).toHaveCount(3);
    await expect(page.locator('#recipient-list .person-row[data-state="duplicate"]')).toHaveCount(1);
    await expect(page.locator('#recipient-summary')).toContainText('3 selected');
    await expect(page.locator('#recipient-list')).not.toContainText('5'.repeat(16));
    await expect(page.locator('#recipient-list a[href="https://trustroots.org/profile/alice"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Send Invite' })).toBeDisabled();
    await expect(page.locator('#sheet-share')).toBeDisabled();

    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Use My Location' }).click();
    await expect(page.locator('#current-area')).toContainText('approximate area');
    await page.getByRole('button', { name: 'People' }).click();
    await expect(page.getByRole('button', { name: 'Send Invite' })).toBeEnabled();
    await expect(page.locator('#sheet-share')).toBeEnabled();
  });

  test('keeps mixed recipient failures editable and retryable', async ({ page }) => {
    await installNostrailMocks(page, {
      lookupScenarios: {
        broken: 'http',
        malformed: 'malformed',
        slow: 'slow',
      },
    });
    await page.goto('/nostrail/');
    await page.getByRole('button', { name: 'People' }).click();
    await page.locator('#recipient-input').fill('alice alias broken malformed slow unknown invalid!');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.locator('#recipient-list .person-row[data-state="resolved"]')).toHaveCount(1);
    await expect(page.locator('#recipient-list .person-row[data-state="duplicate"]')).toHaveCount(1);
    await expect(page.locator('#recipient-list .person-row[data-state="failed"]')).toHaveCount(5);
    await expect(page.locator('#recipient-feedback')).toContainText('Added 1 person.');
    await expect(page.locator('#recipient-feedback')).toContainText('5 need attention.');
    await expect(page.locator('#recipient-list')).toContainText('too long');
    await expect(page.locator('#recipient-list')).toContainText('could not complete');
    await expect(page.locator('#recipient-list')).toContainText('unreadable response');
    await expect(page.locator('#recipient-list')).toContainText('does not expose a valid Nostr key');

    const failedRow = page.locator('#recipient-list .person-row[data-state="failed"]').first();
    await failedRow.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#recipient-input')).not.toHaveValue('');
    await expect(page.locator('#recipient-list .person-row[data-state="failed"]')).toHaveCount(4);
  });

  test('publishes invite, location, and stop events through mocked relays', async ({ page }) => {
    await installNostrailMocks(page);
    await page.goto('/nostrail/');

    await page.getByRole('button', { name: 'People' }).click();
    await page.locator('#recipient-input').fill('alice');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('#recipient-feedback')).toHaveText('Added 1 person.');
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByRole('button', { name: 'Start Sharing' })).toBeDisabled();
    await page.getByRole('button', { name: 'Use My Location' }).click();
    await expect(page.getByRole('button', { name: 'Start Sharing' })).toBeEnabled();

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
    await expect.poll(() => page.evaluate(() => window.NostrailWeb.mapAdapter.getAreaSnapshot().peers.length)).toBe(1);
    await expect.poll(() => page.evaluate(() => window.NostrailWeb.mapAdapter.getAreaSnapshot().peers[0])).toMatchObject({
      lat: 52.5,
      lon: 13.4,
      radius: 500,
    });

    await page.evaluate(({ peerPubkey, userPubkey }) => {
      const payload = {
        type: 'trustroots.location.stop.v1',
        sessionId: 'peer-session',
        createdAt: Math.floor(Date.now() / 1000),
      };
      window.__nostrailDispatchRelayEvent({
        id: 'peer-stop-event',
        pubkey: peerPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 24111,
        tags: [['p', userPubkey], ['expiration', String(Math.floor(Date.now() / 1000) + 300)]],
        content: `cipher:${peerPubkey}:${btoa(JSON.stringify(payload))}`,
        sig: '8'.repeat(128),
      });
    }, { peerPubkey: PEER_PUBKEY, userPubkey: USER_PUBKEY });
    await expect.poll(() => page.evaluate(() => window.NostrailWeb.mapAdapter.getAreaSnapshot().peers.length)).toBe(0);

    await page.evaluate(({ peerPubkey, userPubkey }) => {
      const expiresAt = Math.floor(Date.now() / 1000) + 2;
      const payload = {
        type: 'trustroots.location.v1',
        sessionId: 'expiring-session',
        area: '9F000000+',
        centerLat: 48.85,
        centerLon: 2.35,
        accuracyM: 700,
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt,
      };
      window.__nostrailDispatchRelayEvent({
        id: 'peer-expiring-event',
        pubkey: peerPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 24111,
        tags: [['p', userPubkey], ['expiration', String(expiresAt)]],
        content: `cipher:${peerPubkey}:${btoa(JSON.stringify(payload))}`,
        sig: '7'.repeat(128),
      });
    }, { peerPubkey: PEER_PUBKEY, userPubkey: USER_PUBKEY });
    await expect.poll(() => page.evaluate(() => window.NostrailWeb.mapAdapter.getAreaSnapshot().peers.length)).toBe(1);
    await expect.poll(() => page.evaluate(() => window.NostrailWeb.mapAdapter.getAreaSnapshot().peers.length), { timeout: 5000 }).toBe(0);
  });
});
