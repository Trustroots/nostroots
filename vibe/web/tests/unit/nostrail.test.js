import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPROXIMATE_ACCURACY_M,
  NOSTRAIL_LOCATION_EVENT_KIND,
  createNostrailMapAdapter,
  decodeNostrailPayload,
  dedupeRecipientInputs,
  formatPublicKey,
  getExpirationUnix,
  hexToNpub,
  inspectNostrailNip7,
  isNostrailEventExpired,
  makeLocationPayload,
  normalizeRecipientInput,
  npubToHex,
  recipientErrorMessage,
  resolveNip05,
  snapApproximateArea,
  summarizeRecipientResults,
  trustrootsProfileUrlToUsername,
} from '../../nostrail/index.js';

const HEX = 'a'.repeat(64);
const NPUB = 'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d';

describe('Nostrail web helpers', () => {
  it('uses the provisional native-compatible event kind', () => {
    expect(NOSTRAIL_LOCATION_EVENT_KIND).toBe(24111);
  });

  it('classifies NIP-07 signer capabilities', () => {
    expect(inspectNostrailNip7(null).status).toBe('none');
    expect(inspectNostrailNip7({ getPublicKey: async () => HEX }).status).toBe('partial');
    expect(inspectNostrailNip7({
      getPublicKey: async () => HEX,
      signEvent: async (event) => event,
      nip44: {
        encrypt: async () => 'cipher',
        decrypt: async () => 'plain',
      },
    }).status).toBe('full');
  });

  it('normalizes Trustroots profile links and recipient aliases', () => {
    expect(trustrootsProfileUrlToUsername('https://www.trustroots.org/profile/Alice')).toBe('alice');
    expect(normalizeRecipientInput('@Alice')).toMatchObject({
      ok: true,
      type: 'nip05',
      value: 'alice@trustroots.org',
    });
    expect(normalizeRecipientInput('alice')).toMatchObject({
      ok: true,
      duplicateKey: 'nip05:alice@trustroots.org',
    });
    expect(normalizeRecipientInput('bob@example.org')).toMatchObject({
      ok: true,
      type: 'nip05',
      value: 'bob@example.org',
    });
    expect(normalizeRecipientInput(HEX.toUpperCase())).toMatchObject({
      ok: true,
      type: 'hex',
      value: HEX,
    });
  });

  it('accepts npub recipients as public keys', () => {
    const normalized = normalizeRecipientInput(NPUB);
    expect(normalized.ok).toBe(true);
    expect(normalized.type).toBe('hex');
    expect(normalized.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('formats hexadecimal keys only as shortened npubs', () => {
    expect(npubToHex(hexToNpub(HEX))).toBe(HEX);
    expect(formatPublicKey(HEX)).toMatch(/^npub1.*\.\.\./);
    expect(formatPublicKey(HEX)).not.toContain('aaaaaaaa');
    expect(normalizeRecipientInput(HEX).display).toBe(formatPublicKey(HEX));
  });

  it('dedupes canonical recipient inputs', () => {
    const result = dedupeRecipientInputs(['alice', '@alice', 'alice@trustroots.org', HEX, HEX.toUpperCase(), 'bad value']);
    expect(result.accepted.map((item) => item.duplicateKey)).toEqual([
      'nip05:alice@trustroots.org',
      `pubkey:${HEX}`,
    ]);
    expect(result.rejected).toHaveLength(1);
  });

  it('classifies lookup failures and enforces a timeout', async () => {
    await expect(resolveNip05('alice@trustroots.org', {
      fetchImpl: async () => ({ ok: false }),
    })).rejects.toMatchObject({ kind: 'http' });

    await expect(resolveNip05('alice@trustroots.org', {
      fetchImpl: async () => ({ ok: true, json: async () => ({ nope: true }) }),
    })).rejects.toMatchObject({ kind: 'malformed' });

    await expect(resolveNip05('alice@trustroots.org', {
      fetchImpl: async () => ({ ok: true, json: async () => ({ names: {} }) }),
    })).rejects.toMatchObject({ kind: 'missing-key' });

    await expect(resolveNip05('alice@trustroots.org', {
      fetchImpl: () => new Promise(() => {}),
      timeoutMs: 5,
    })).rejects.toMatchObject({ kind: 'timeout' });
    expect(recipientErrorMessage('timeout')).toContain('too long');
  });

  it('summarizes mixed recipient state transitions', () => {
    expect(summarizeRecipientResults([
      { state: 'resolved' },
      { state: 'duplicate' },
      { state: 'failed' },
      { state: 'resolved' },
    ])).toEqual({ added: 2, duplicate: 1, failed: 1 });
  });

  it('keeps map viewport movement separate from area rendering', () => {
    const handlers = new Map();
    const layers = [];
    let center = { lat: 20, lng: 0 };
    let zoom = 2;
    const map = {
      on: (name, handler) => handlers.set(name, handler),
      setView: ([lat, lng], nextZoom) => { center = { lat, lng }; zoom = nextZoom; },
      getCenter: () => center,
      getZoom: () => zoom,
      removeLayer: (layer) => { layer.removed = true; },
    };
    const leaflet = {
      map: () => map,
      tileLayer: () => ({ addTo: () => {} }),
      control: { zoom: () => ({ addTo: () => {} }) },
      circle: (latLng, options) => {
        const layer = {
          latLng,
          radius: options.radius,
          addTo: () => layer,
          setLatLng: (value) => { layer.latLng = value; },
          setRadius: (value) => { layer.radius = value; },
          getLatLng: () => ({ lat: layer.latLng[0], lng: layer.latLng[1] }),
          getRadius: () => layer.radius,
        };
        layers.push(layer);
        return layer;
      },
    };
    const adapter = createNostrailMapAdapter({ leaflet, container: {} });
    expect(adapter.initialize()).toBe(true);
    adapter.setOwnArea({ centerLat: 52.5, centerLon: 13.4, accuracyM: 500 });
    adapter.syncPeerAreas([{ pubkey: HEX, centerLat: 51, centerLon: 7, accuracyM: 800 }]);
    expect(adapter.getAreaSnapshot()).toMatchObject({
      own: { lat: 52.5, lon: 13.4, radius: 500 },
      peers: [{ pubkey: HEX, lat: 51, lon: 7, radius: 800 }],
    });
    handlers.get('movestart')();
    center = { lat: 40, lng: -8 };
    adapter.setOwnArea({ centerLat: 53, centerLon: 14, accuracyM: 600 });
    expect(adapter.getViewport()).toMatchObject({ lat: 40, lon: -8, userMoved: true });
    adapter.syncPeerAreas([]);
    expect(layers[1].removed).toBe(true);
  });

  it('snaps coordinates into an approximate Plus Code area', () => {
    const area = snapApproximateArea(52.52, 13.405);
    expect(area.area).toMatch(/^[23456789CFGHJMPQRVWX]{8}\+$/);
    expect(area.accuracyM).toBe(DEFAULT_APPROXIMATE_ACCURACY_M);
    expect(Number.isFinite(area.centerLat)).toBe(true);
    expect(Number.isFinite(area.centerLon)).toBe(true);
  });

  it('parses expiration tags and rejects expired events', () => {
    const event = { tags: [['expiration', '100']] };
    expect(getExpirationUnix(event)).toBe(100);
    expect(isNostrailEventExpired(event, 101)).toBe(true);
    expect(isNostrailEventExpired(event, 99)).toBe(false);
  });

  it('decodes only known Nostrail payloads', () => {
    const payload = makeLocationPayload({
      sessionId: 'session-1',
      area: '9F000000+',
      centerLat: 10,
      centerLon: 20,
      accuracyM: 500,
      createdAt: 100,
      expiresAt: 200,
    });
    expect(decodeNostrailPayload(JSON.stringify(payload))).toEqual(payload);
    expect(decodeNostrailPayload(JSON.stringify({ type: 'trustroots.location.future.v1' }))).toBe(null);
    expect(decodeNostrailPayload('not json')).toBe(null);
  });
});
