import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNrWebAnalyticsAreaData,
  getNrWebAnalyticsHostname,
  normalizeNrWebAnalyticsCircleSlug,
  normalizeNrWebAnalyticsTrustrootsUsername,
  sanitizeNrWebAnalyticsData,
  trackNrWebEvent,
} from '../../index.js';

describe('nr-web Umami events', () => {
  beforeEach(() => {
    delete window.umami;
  });

  afterEach(() => {
    delete window.umami;
  });

  it('no-ops when Umami is unavailable', () => {
    expect(trackNrWebEvent('nr_key_created', { status: 'success' })).toBe(false);
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

  it('sanitizes analytics data to the allowed aggregate fields', () => {
    expect(sanitizeNrWebAnalyticsData({
      area_prefix: '9G',
      circle_slug: '#Test-Circle',
      failed_count: 1.3,
      has_circle: true,
      hostname: 'LOCALHOST',
      message: 'hello',
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
      trustroots_username: 'alice.example',
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
