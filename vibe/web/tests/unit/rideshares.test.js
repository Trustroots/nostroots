import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decodeGeohashCenter,
  dedupeRideEvents,
  encodeGeohash,
  geohashPrefixes,
  isRideVisible,
  matchRides,
  parseRideEvent,
  trustrootsProfileUrl,
} from '../../examples/rideshares/core.js';

function rideEvent(overrides = {}) {
  return {
    id: overrides.id || 'event-1',
    pubkey: overrides.pubkey || 'a'.repeat(64),
    kind: 30402,
    created_at: overrides.created_at || 2_000_000_000,
    content: overrides.content || 'Heading east and happy to meet near the motorway.',
    tags: overrides.tags || [
      ['d', 'journey-1'],
      ['t', 'rideshare'],
      ['t', 'hitchhike-request'],
      ['location', 'Berlin, Germany'],
      ['location_dest', 'Prague, Czechia'],
      ['departure_utc', '2000003600'],
      ['departure_end_utc', '2000090000'],
      ['status', 'active'],
      ['g', 'u33d'],
      ['dg', 'u2fk'],
    ],
  };
}

describe('Rideshares event compatibility and privacy', () => {
  it('never asks for or publishes precise key and coordinate fields', () => {
    const appSource = readFileSync(join(process.cwd(), 'examples/rideshares/app.js'), 'utf8');
    const htmlSource = readFileSync(join(process.cwd(), 'examples/rideshares/index.html'), 'utf8');
    expect(appSource).not.toContain('["origin_lat"');
    expect(appSource).not.toContain('["origin_lon"');
    expect(appSource).not.toContain('["dest_lat"');
    expect(appSource).not.toContain('["dest_lon"');
    expect(htmlSource).not.toContain('name="nsec"');
    expect(htmlSource).not.toContain('Paste your nsec');
    expect(htmlSource).toContain('../../site-chrome.css');
    expect(htmlSource).toContain('../../site-chrome-identity.js');
    expect(htmlSource).toContain('id="nostr-key-status"');
    expect(htmlSource).toContain('id="trustroots-identity-status"');
  });

  it('parses hitchhiking events using approximate area centers', () => {
    const ride = parseRideEvent(rideEvent());
    expect(ride.type).toBe('request');
    expect(ride.origin).toBe('Berlin, Germany');
    expect(ride.destination).toBe('Prague, Czechia');
    expect(ride.originCoordinates.approximate).toBe(true);
    expect(ride.originCoordinates.legacyPrecise).toBeUndefined();
    expect(ride.seekingDriver).toBe(true);
    expect(ride.seekingCoHitchhiker).toBe(false);
  });

  it('supports finding a driver, a co-hitchhiker, or both', () => {
    const both = parseRideEvent(rideEvent({ tags: [
      ...rideEvent().tags,
      ['seeking', 'driver'],
      ['seeking', 'co-hitchhiker'],
      ['t', 'co-hitchhiker'],
    ] }));
    expect(both.seekingDriver).toBe(true);
    expect(both.seekingCoHitchhiker).toBe(true);
    expect(matchRides([both], { type: 'cohitchhiker' })).toHaveLength(1);

    const legacyPartner = parseRideEvent(rideEvent({ tags: [
      ['d', 'partner-1'],
      ['t', 'travel-partner'],
      ['location', 'Berlin'],
      ['location_dest', 'Prague'],
      ['departure_utc', '2000003600'],
      ['status', 'active'],
    ] }));
    expect(legacyPartner.seekingDriver).toBe(false);
    expect(legacyPartner.seekingCoHitchhiker).toBe(true);
  });

  it('uses the newest replaceable event', () => {
    const oldEvent = rideEvent({ id: 'old', created_at: 2_000_000_000 });
    const newEvent = rideEvent({ id: 'new', created_at: 2_000_000_100, content: 'Updated' });
    const rides = dedupeRideEvents([oldEvent, newEvent]);
    expect(rides).toHaveLength(1);
    expect(rides[0].id).toBe('new');
    expect(rides[0].description).toBe('Updated');
  });

  it('excludes cancelled and expired rides', () => {
    const cancelled = parseRideEvent(rideEvent({
      tags: [...rideEvent().tags.filter((tag) => tag[0] !== 'status'), ['status', 'cancelled']],
    }));
    expect(isRideVisible(cancelled, new Date(2_000_000_000 * 1000))).toBe(false);
    const expired = parseRideEvent(rideEvent({ tags: [...rideEvent().tags, ['expiration', '1999999999']] }));
    expect(isRideVisible(expired, new Date(2_000_000_000 * 1000))).toBe(false);
  });

  it('matches compatible route text and dates', () => {
    const ride = parseRideEvent(rideEvent());
    const date = new Date(2_000_003_600 * 1000).toISOString().slice(0, 10);
    expect(matchRides([ride], { origin: 'Berlin', destination: 'Prague', date })).toHaveLength(1);
    expect(matchRides([ride], { origin: 'Lisbon' })).toHaveLength(0);
  });

  it('encodes area-level geohashes without precise coordinates', () => {
    const hash = encodeGeohash(52.52, 13.405, 4);
    expect(hash).toBe('u33d');
    expect(geohashPrefixes(hash)).toEqual(['u3', 'u33', 'u33d']);
    const center = decodeGeohashCenter(hash);
    expect(Math.abs(center.lat - 52.52)).toBeLessThan(1);
    expect(Math.abs(center.lon - 13.405)).toBeLessThan(1);
  });

  it('links only verified Trustroots NIP-05 identities to public profiles', () => {
    expect(trustrootsProfileUrl('alice@trustroots.org', true)).toBe('https://www.trustroots.org/profile/alice');
    expect(trustrootsProfileUrl('Alice@Trustroots.org', true)).toBe('https://www.trustroots.org/profile/alice');
    expect(trustrootsProfileUrl('alice@example.org', true)).toBe('');
    expect(trustrootsProfileUrl('alice@trustroots.org', false)).toBe('');
  });
});
