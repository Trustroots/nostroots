import { describe, expect, it } from 'vitest';
import {
  containsNsec,
  createFoodEventTemplate,
  decodeGeohash,
  encodeGeohash,
  foodEntryFromEvent,
} from '../../food/food-event.js';
import { decodePlusCodeArea, encodePlusCode, isPinInsidePlusCode } from '../../food/plus-code.js';
import {
  buildFoodChatEventTemplate,
  buildFoodEntryCommentTemplate,
  formatChatTime,
  isFoodChatEvent,
  isFoodEntryComment,
} from '../../food/food-chat.js';

describe('Food Circle location and event helpers', () => {
  it('encodes different public Plus Code granularities and validates the source pin', () => {
    const broad = encodePlusCode(52.52, 13.405, 6);
    const neighborhood = encodePlusCode(52.52, 13.405, 8);
    const precise = encodePlusCode(52.52, 13.405, 10);
    expect(broad).toMatch(/^[23456789CFGHJMPQRVWX]{6}00\+$/);
    expect(neighborhood).toMatch(/^[23456789CFGHJMPQRVWX]{8}\+$/);
    expect(precise).toMatch(/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/);
    expect(isPinInsidePlusCode(broad, 52.52, 13.405)).toBe(true);
    expect(isPinInsidePlusCode(neighborhood, 40.71, -74)).toBe(false);
    expect(decodePlusCodeArea(precise)?.length).toBe(10);
  });

  it('writes a Nostroots-compatible kind 30397 map-note template', () => {
    const template = createFoodEventTemplate({
      title: 'Surplus soup',
      details: 'Six portions until 20:00.',
      type: 'popup',
      intent: 'offer',
      cost: 'free',
      plusCode: '9F4MGCG4+',
      precision: 8,
      pin: { latitude: 52.52, longitude: 13.405 },
      expiresAt: 2_000_000_000_000,
      createdAt: 1_900_000_000_000,
    });
    expect(template.kind).toBe(30397);
    expect(template.tags).toContainEqual(['l', '9F4MGCG4+', 'open-location-code']);
    expect(template.tags).toContainEqual(['l', 'foodsharing', 'trustroots-circle']);
    expect(template.tags).toContainEqual(['l', 'popup', 'org.trustroots:food-circle:type']);
    expect(template.tags).toContainEqual(['t', 'food-offer']);
    expect(template.tags.find((tag) => tag[0] === 'g')?.[1]).toHaveLength(12);
    expect(template.tags).toContainEqual(['expiration', '2000000000']);
  });

  it('round-trips a food event and its optional geohash pin', () => {
    const pin = { latitude: 52.52, longitude: 13.405 };
    const geohash = encodeGeohash(pin.latitude, pin.longitude);
    const decoded = decodeGeohash(geohash);
    expect(decoded.latitude).toBeCloseTo(pin.latitude, 4);
    expect(decoded.longitude).toBeCloseTo(pin.longitude, 4);

    const template = createFoodEventTemplate({
      title: 'Community fridge', details: 'Open all day.', type: 'fridge', intent: 'offer', cost: 'free',
      plusCode: encodePlusCode(pin.latitude, pin.longitude, 8), precision: 8, pin, createdAt: Date.now(),
    });
    const entry = foodEntryFromEvent({ ...template, id: 'a'.repeat(64) });
    expect(entry).toMatchObject({ type: 'fridge', title: 'Community fridge', remote: true });
    expect(entry.pin.latitude).toBeCloseTo(pin.latitude, 4);
  });

  it('uses the original event identity when parsing a validated 30398 mirror', () => {
    const originalId = 'b'.repeat(64);
    const template = createFoodEventTemplate({
      title: 'Bread pickup', type: 'popup', intent: 'offer', cost: 'free',
      plusCode: '9F4MGCG4+', precision: 8, createdAt: 1_900_000_000_000,
    });
    const entry = foodEntryFromEvent({
      ...template,
      kind: 30398,
      id: 'c'.repeat(64),
      created_at: 1_900_000_300,
      tags: [['e', originalId], ['original_created_at', '1900000000'], ...template.tags],
    });
    expect(entry.eventId).toBe(originalId);
    expect(entry.repostEventId).toBe('c'.repeat(64));
    expect(entry.createdAt).toBe(1_900_000_000_000);
  });

  it('guards drafts containing private Nostr keys', () => {
    expect(containsNsec(`keep nsec1${'q'.repeat(58)} secret`)).toBe(true);
    expect(containsNsec('npub1this-is-public')).toBe(false);
  });

  it('uses the established foodsharing circle shape for chat messages', () => {
    const event = buildFoodChatEventTemplate('Anyone near the community fridge?', 1_900_000_000_000);
    expect(event.kind).toBe(30397);
    expect(event.tags).toContainEqual(['l', 'foodsharing', 'trustroots-circle']);
    expect(event.tags.some((tag) => tag[2] === 'open-location-code')).toBe(false);
    expect(isFoodChatEvent(event)).toBe(true);
    expect(isFoodChatEvent(createFoodEventTemplate({
      title: 'Soup', type: 'popup', intent: 'offer', cost: 'free', plusCode: '9F4MGCG4+', precision: 8,
    }))).toBe(false);
    expect(formatChatTime(1_899_999_880, 1_900_000_000_000)).toBe('2m');
  });

  it('creates NIP-22 comments scoped to a published food listing', () => {
    const eventId = 'd'.repeat(64);
    const pubkey = 'e'.repeat(64);
    const comment = buildFoodEntryCommentTemplate(
      'Is there any left?',
      { eventId, pubkey },
      'wss://relay.trustroots.org',
      1_900_000_000_000,
    );
    expect(comment.kind).toBe(1111);
    expect(comment.tags).toContainEqual(['E', eventId, 'wss://relay.trustroots.org', pubkey]);
    expect(comment.tags).toContainEqual(['K', '30397']);
    expect(comment.tags).toContainEqual(['e', eventId, 'wss://relay.trustroots.org', pubkey]);
    expect(isFoodEntryComment(comment, eventId)).toBe(true);
    expect(isFoodEntryComment(comment, 'f'.repeat(64))).toBe(false);
  });
});
