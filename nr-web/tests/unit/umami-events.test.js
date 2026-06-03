import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNrWebAnalyticsAreaData,
  getNrWebAnalyticsHostname,
  getNrWebNip7AnalyticsData,
  normalizeNrWebAnalyticsCircleSlug,
  normalizeNrWebAnalyticsTrustrootsUsername,
  nrWebNip7Signer,
  sanitizeNrWebAnalyticsData,
  trackNrWebEvent,
  trackNrWebOnboardingStep,
} from '../../index.js';

describe('nr-web Umami events', () => {
  beforeEach(() => {
    delete window.umami;
    try { delete window.nostr; } catch (_) { window.nostr = undefined; }
    nrWebNip7Signer.pubkey = '';
    localStorage.clear();
  });

  afterEach(() => {
    delete window.umami;
    try { delete window.nostr; } catch (_) { window.nostr = undefined; }
    nrWebNip7Signer.pubkey = '';
    localStorage.clear();
  });

  it('no-ops when Umami is unavailable', () => {
    expect(trackNrWebEvent('nr_key_created', { status: 'success' })).toBe(false);
  });

  it('no-ops onboarding steps when Umami is unavailable', () => {
    expect(trackNrWebOnboardingStep('import_key', 'started', { signer: 'local' })).toBe(false);
  });

  it('tracks sanitized events when Umami is available', () => {
    const track = vi.fn();
    window.umami = { track };

    const ok = trackNrWebEvent('nr_key_imported_extra_long_event_name_that_exceeds_umami_limit', {
      nsec: 'secret',
      pubkey: 'abc',
      referrer_url: 'https://example.com/path?secret=1',
      relay_count: 2,
      source: 'a'.repeat(200),
      status: 'success',
      text: 'private text',
      trustroots_username: 'KTR-Test@trustroots.org',
    });

    expect(ok).toBe(true);
    expect(track).toHaveBeenCalledTimes(1);
    const [name, data] = track.mock.calls[0];
    expect(name.length).toBeLessThanOrEqual(50);
    expect(data).toEqual({
      hostname: 'localhost',
      nip7_available: false,
      nip7_status: 'none',
      nip7_used: false,
      relay_count: 2,
      source: 'a'.repeat(120),
      status: 'success',
      trustroots_username: 'ktr-test',
    });
  });

  it('does not throw when the Umami tracker throws', () => {
    window.umami = { track: vi.fn(() => { throw new Error('blocked'); }) };

    expect(() => trackNrWebEvent('nr_chat_opened', { chat_type: 'channel' })).not.toThrow();
    expect(trackNrWebEvent('nr_chat_opened', { chat_type: 'channel' })).toBe(false);
  });

  it('tracks onboarding steps with sanitized aggregate fields only', () => {
    const track = vi.fn();
    window.umami = { track };

    const ok = trackNrWebOnboardingStep('Import Key', 'Success', {
      key_method: 'nsec',
      npub: 'npub1secret',
      nsec: 'nsec1secret',
      pubkey: 'abc',
      signer: 'local',
      source: 'copy_npub',
      text: 'private note',
      trustroots_username: '@Alice@trustroots.org',
    });

    expect(ok).toBe(true);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('nr_onboarding_step', {
      hostname: 'localhost',
      intent: 'import_key',
      key_method: 'nsec',
      nip7_available: false,
      nip7_status: 'none',
      nip7_used: false,
      signer: 'local',
      source: 'copy_npub',
      status: 'success',
      surface: 'onboarding',
      trustroots_username: 'alice',
    });
  });

  it('sanitizes analytics data to the allowed aggregate fields', () => {
    expect(sanitizeNrWebAnalyticsData({
      area_prefix: '9G',
      circle_slug: '#Test-Circle',
      failed_count: 1.3,
      has_circle: true,
      hostname: 'LOCALHOST',
      message: 'hello',
      nip7_available: true,
      nip7_status: 'FULL',
      nip7_used: false,
      note_id: 'event-id',
      npub: 'npub1secret',
      nsec: 'nsec1secret',
      pubkey: 'abc',
      text: 'private text',
      trustroots_username: '@Alice.Example',
      unknown: 'ignored',
      username: 'alice',
    })).toEqual({
      area_prefix: '9g',
      circle_slug: 'testcircle',
      failed_count: 1,
      has_circle: true,
      hostname: 'localhost',
      nip7_available: true,
      nip7_status: 'full',
      nip7_used: false,
      trustroots_username: 'alice.example',
    });
  });

  it('adds NIP-07 availability and usage fields to Umami events', () => {
    const track = vi.fn();
    window.umami = { track };
    window.nostr = {
      getPublicKey: async () => '0'.repeat(64),
      signEvent: async (event) => event,
      nip44: {
        encrypt: async () => 'cipher',
        decrypt: async () => 'plain',
      },
      nip04: {
        encrypt: async () => 'cipher',
        decrypt: async () => 'plain',
      },
    };
    nrWebNip7Signer.pubkey = '0'.repeat(64);
    localStorage.setItem('nr_web_signer_mode', 'nip7');
    localStorage.setItem('nr_web_nip7_pubkey', '0'.repeat(64));

    expect(getNrWebNip7AnalyticsData()).toEqual({
      nip7_available: true,
      nip7_status: 'full',
      nip7_used: true,
    });

    expect(trackNrWebEvent('nr_keys_opened', { surface: 'keys' })).toBe(true);
    expect(track).toHaveBeenCalledWith('nr_keys_opened', {
      hostname: 'localhost',
      nip7_available: true,
      nip7_status: 'full',
      nip7_used: true,
      surface: 'keys',
    });
  });

  it('derives coarse area and normalized circle data without full plus codes', () => {
    const area = getNrWebAnalyticsAreaData('9G123456+ABCD');

    expect(area).toEqual({
      area_prefix: '9g',
      plus_code_length: 13,
    });
    expect(JSON.stringify(area)).not.toContain('9G123456+ABCD');
    expect(normalizeNrWebAnalyticsCircleSlug('Test-Circle')).toBe('testcircle');
    expect(normalizeNrWebAnalyticsTrustrootsUsername('@KTR-Test@trustroots.org')).toBe('ktr-test');
    expect(getNrWebAnalyticsHostname()).toBe('localhost');
  });
});
