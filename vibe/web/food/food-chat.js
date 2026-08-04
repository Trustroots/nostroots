import { containsNsec, FOOD_CIRCLE_SLUG } from './food-event.js';

export const FOOD_CHAT_RETENTION_DAYS = 30;

function hasTag(tags, name, value, namespace) {
  return Array.isArray(tags) && tags.some((tag) =>
    Array.isArray(tag) && tag[0] === name &&
    (value == null || tag[1] === value) &&
    (namespace == null || tag[2] === namespace)
  );
}

export function buildFoodChatEventTemplate(contentValue, nowMs = Date.now()) {
  const content = String(contentValue || '').trim();
  if (!content) throw new Error('Write a message first.');
  if (containsNsec(content)) throw new Error('Remove the nsec private key before sending.');
  return {
    kind: 30397,
    created_at: Math.floor(nowMs / 1000),
    content,
    tags: [
      ['L', 'trustroots-circle'],
      ['l', FOOD_CIRCLE_SLUG, 'trustroots-circle'],
      ['t', FOOD_CIRCLE_SLUG],
      ['client', 'nostroots-food-circle'],
      ['expiration', String(Math.floor(nowMs / 1000) + FOOD_CHAT_RETENTION_DAYS * 24 * 60 * 60)],
    ],
  };
}

export function buildFoodEntryCommentTemplate(contentValue, entry, relayUrl = '', nowMs = Date.now()) {
  const content = String(contentValue || '').trim();
  const eventId = String(entry?.eventId || '').trim();
  const rootPubkey = String(entry?.pubkey || '').trim();
  if (!content) throw new Error('Write a message first.');
  if (!eventId) throw new Error('This listing must be published before people can chat.');
  if (containsNsec(content)) throw new Error('Remove the nsec private key before sending.');
  const rootTag = ['E', eventId, relayUrl];
  const parentTag = ['e', eventId, relayUrl];
  if (rootPubkey) {
    rootTag.push(rootPubkey);
    parentTag.push(rootPubkey);
  }
  const tags = [
    rootTag,
    ['K', '30397'],
    parentTag,
    ['k', '30397'],
    ['client', 'nostroots-food-circle'],
    ['expiration', String(Math.floor(nowMs / 1000) + FOOD_CHAT_RETENTION_DAYS * 24 * 60 * 60)],
  ];
  if (rootPubkey) tags.push(['P', rootPubkey, relayUrl], ['p', rootPubkey, relayUrl]);
  return { kind: 1111, created_at: Math.floor(nowMs / 1000), content, tags };
}

export function isFoodChatEvent(event) {
  if (!event || event.kind !== 30397 || !String(event.content || '').trim()) return false;
  const isCircleMessage = hasTag(event.tags, 'l', FOOD_CIRCLE_SLUG, 'trustroots-circle');
  const hasMapLocation = hasTag(event.tags, 'L', 'open-location-code') ||
    (event.tags || []).some((tag) => tag[0] === 'l' && tag[2] === 'open-location-code');
  return isCircleMessage && !hasMapLocation;
}

export function isFoodEntryComment(event, rootEventId) {
  return Boolean(
    event && event.kind === 1111 && String(event.content || '').trim() &&
    hasTag(event.tags, 'E', String(rootEventId || '')) &&
    hasTag(event.tags, 'K', '30397')
  );
}

export function formatChatTime(timestampSeconds, nowMs = Date.now()) {
  const delta = Math.max(0, Math.floor(nowMs / 1000) - Number(timestampSeconds || 0));
  if (delta < 60) return 'now';
  if (delta < 3600) return `${Math.floor(delta / 60)}m`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h`;
  return `${Math.floor(delta / 86400)}d`;
}
