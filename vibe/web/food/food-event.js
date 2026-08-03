import { decodePlusCodeArea } from './plus-code.js';

export const FOOD_CIRCLE_SLUG = 'foodsharing';
export const FOOD_TYPE_NAMESPACE = 'org.trustroots:food-circle:type';
export const FOOD_COST_NAMESPACE = 'org.trustroots:food-circle:cost';
export const FOOD_PRECISION_NAMESPACE = 'org.trustroots:food-circle:plus-code-precision';
const GEOHASH_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';

function labelTags(namespace, values) {
  return [['L', namespace], ...values.map((value) => ['l', String(value), namespace])];
}

export function getPlusCodePrefixTags(plusCode) {
  const code = String(plusCode || '').toUpperCase();
  const prefixes = [];
  for (let length = 2; length <= 8; length += 2) {
    const prefix = code.slice(0, length).padEnd(8, '0') + '+';
    if (!prefixes.includes(prefix)) prefixes.push(prefix);
  }
  return labelTags('open-location-code-prefix', prefixes);
}

export function encodeGeohash(latitudeValue, longitudeValue, precision = 12) {
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return '';
  let latRange = [-90, 90];
  let lonRange = [-180, 180];
  let evenBit = true;
  let bit = 0;
  let value = 0;
  let result = '';

  while (result.length < precision) {
    const range = evenBit ? lonRange : latRange;
    const coordinate = evenBit ? longitude : latitude;
    const midpoint = (range[0] + range[1]) / 2;
    if (coordinate >= midpoint) {
      value = (value << 1) | 1;
      range[0] = midpoint;
    } else {
      value <<= 1;
      range[1] = midpoint;
    }
    evenBit = !evenBit;
    bit += 1;
    if (bit === 5) {
      result += GEOHASH_ALPHABET[value];
      bit = 0;
      value = 0;
    }
  }
  return result;
}

export function decodeGeohash(value) {
  const geohash = String(value || '').trim().toLowerCase();
  if (!geohash || [...geohash].some((character) => !GEOHASH_ALPHABET.includes(character))) return null;
  let latRange = [-90, 90];
  let lonRange = [-180, 180];
  let evenBit = true;
  for (const character of geohash) {
    const characterValue = GEOHASH_ALPHABET.indexOf(character);
    for (let mask = 16; mask > 0; mask >>= 1) {
      const range = evenBit ? lonRange : latRange;
      const midpoint = (range[0] + range[1]) / 2;
      if (characterValue & mask) range[0] = midpoint;
      else range[1] = midpoint;
      evenBit = !evenBit;
    }
  }
  return {
    latitude: (latRange[0] + latRange[1]) / 2,
    longitude: (lonRange[0] + lonRange[1]) / 2,
  };
}

function randomIdentifier() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createFoodEventTemplate(entry) {
  const title = String(entry.title || '').trim();
  const details = String(entry.details || '').trim();
  const content = details ? `${title}\n\n${details}` : title;
  const type = String(entry.type || 'popup');
  const cost = String(entry.cost || 'free');
  const precision = Number(entry.precision || decodePlusCodeArea(entry.plusCode)?.length || 8);
  const tags = [
    ['d', entry.eventIdentifier || randomIdentifier()],
    ['title', title],
    ['client', 'nostroots-food-circle'],
    ...labelTags('open-location-code', [entry.plusCode]),
    ...getPlusCodePrefixTags(entry.plusCode),
    ...labelTags('trustroots-circle', [FOOD_CIRCLE_SLUG, ...(type === 'dumpster' ? ['dumpsterdivers'] : [])]),
    ...labelTags(FOOD_TYPE_NAMESPACE, [type]),
    ...labelTags(FOOD_COST_NAMESPACE, [cost]),
    ...labelTags(FOOD_PRECISION_NAMESPACE, [precision]),
    ['t', 'foodsharing'],
    ['t', entry.intent === 'request' ? 'food-request' : 'food-offer'],
    ['t', `food-${type}`],
  ];
  if (entry.diet) tags.push(['t', `food-${entry.diet}`]);
  if (entry.expiresAt) tags.push(['expiration', String(Math.floor(entry.expiresAt / 1000))]);
  if (entry.pin) tags.push(['g', encodeGeohash(entry.pin.latitude, entry.pin.longitude)]);
  return {
    kind: 30397,
    content,
    tags,
    created_at: Math.floor(Number(entry.createdAt || Date.now()) / 1000),
  };
}

function tagValue(event, tagName, namespace) {
  const tag = (event.tags || []).find((candidate) => candidate[0] === tagName && (!namespace || candidate[2] === namespace));
  return tag?.[1] || '';
}

export function foodEntryFromEvent(event) {
  if (!event || ![30397, 30398].includes(event.kind)) return null;
  const circleTags = (event.tags || []).filter((tag) => tag[0] === 'l' && tag[2] === 'trustroots-circle').map((tag) => tag[1]);
  const topicTags = (event.tags || []).filter((tag) => tag[0] === 't').map((tag) => tag[1]);
  if (!circleTags.includes(FOOD_CIRCLE_SLUG) && !topicTags.includes('foodsharing')) return null;
  const plusCode = tagValue(event, 'l', 'open-location-code');
  const area = decodePlusCodeArea(plusCode);
  if (!area) return null;
  const content = String(event.content || '').trim();
  const titleTag = tagValue(event, 'title');
  const title = titleTag || content.split(/\n/)[0] || 'Food Circle post';
  const details = titleTag && content.startsWith(titleTag) ? content.slice(titleTag.length).trim() : content;
  const typeTag = tagValue(event, 'l', FOOD_TYPE_NAMESPACE);
  const type = ['popup', 'fridge', 'dumpster', 'restaurant', 'request'].includes(typeTag)
    ? typeTag
    : topicTags.includes('food-request') ? 'request' : circleTags.includes('dumpsterdivers') ? 'dumpster' : 'popup';
  const precisionTag = Number(tagValue(event, 'l', FOOD_PRECISION_NAMESPACE));
  const geohash = tagValue(event, 'g');
  const sourceEventId = event.kind === 30398 ? tagValue(event, 'e') : event.id || '';
  const originalCreatedAt = event.kind === 30398 ? Number(tagValue(event, 'original_created_at')) : 0;
  const decodedPin = geohash ? decodeGeohash(geohash) : null;
  // A 12-character geohash represents a tiny cell rather than an infinitely
  // precise point. Allow a sub-meter edge tolerance when its center lands just
  // across a Plus Code boundary because of floating-point rounding.
  const edgeTolerance = 0.000001;
  const pin = decodedPin &&
    decodedPin.latitude >= area.south - edgeTolerance && decodedPin.latitude <= area.north + edgeTolerance &&
    decodedPin.longitude >= area.west - edgeTolerance && decodedPin.longitude <= area.east + edgeTolerance
    ? decodedPin
    : null;
  return {
    id: `nostr-${sourceEventId || event.id || `${event.created_at}-${plusCode}-${title}`}`,
    eventId: sourceEventId || event.id || '',
    repostEventId: event.kind === 30398 ? event.id || '' : '',
    eventIdentifier: tagValue(event, 'd'),
    kind: event.kind,
    intent: type === 'request' || topicTags.includes('food-request') ? 'request' : 'offer',
    type,
    title,
    details,
    cost: tagValue(event, 'l', FOOD_COST_NAMESPACE) || 'free',
    diet: topicTags.find((tag) => ['food-vegan', 'food-vegetarian', 'food-mixed'].includes(tag))?.replace('food-', '') || '',
    plusCode,
    precision: [2, 4, 6, 8, 10].includes(precisionTag) ? precisionTag : area.length,
    pin,
    createdAt: Number(originalCreatedAt || event.created_at || 0) * 1000,
    expiresAt: Number(tagValue(event, 'expiration') || 0) * 1000 || null,
    confirmations: 0,
    remote: true,
  };
}

export function containsNsec(value) {
  return /(^|\s)nsec1[023456789acdefghjklmnpqrstuvwxyz]{20,}(?=$|\s|[.,;!?])/i.test(String(value || ''));
}
