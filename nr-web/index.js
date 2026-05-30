// Import nostr-tools for crypto operations
// Single jsdelivr URL site-wide (chat + map + profile share this import).
import {
    finalizeEvent,
    getEventHash,
    getPublicKey,
    generateSecretKey,
    nip04,
    nip19,
    nip44,
    Relay,
    SimplePool,
} from 'https://cdn.jsdelivr.net/npm/nostr-tools@2.23.0/+esm?nrv=20260508a';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.2.2/+esm?nrv=20260508a';

// Import BIP39 for mnemonic support
import { mnemonicToSeedSync, validateMnemonic } from 'https://cdn.jsdelivr.net/npm/bip39@3.1.0/+esm?nrv=20260508a';

const NR_WEB_ANALYTICS_ALLOWED_KEYS = new Set([
    'area_prefix',
    'chat_type',
    'circle_slug',
    'expiration_bucket',
    'failed_count',
    'has_circle',
    'hostname',
    'intent',
    'key_method',
    'plus_code_length',
    'relay_count',
    'route_type',
    'signer',
    'source',
    'status',
    'surface',
    'trustroots_username',
]);
const NR_WEB_ANALYTICS_EVENT_NAME_MAX = 50;
const NR_WEB_ANALYTICS_STRING_MAX = 120;
const NR_WEB_ANALYTICS_AREA_PREFIX_LENGTH = 2;
const nrWebLastSurfaceAnalytics = { key: '' };

function isBlockedNrWebAnalyticsKey(key) {
    const normalized = String(key || '').toLowerCase();
    return (
        normalized.includes('pubkey') ||
        normalized.includes('npub') ||
        normalized.includes('nsec') ||
        (normalized.includes('username') && normalized !== 'trustroots_username') ||
        normalized.includes('nip05') ||
        normalized.includes('nip_05') ||
        normalized.includes('message') ||
        normalized.includes('content') ||
        normalized.includes('text') ||
        normalized.includes('event_id') ||
        normalized.includes('note_id')
    );
}

function sanitizeNrWebAnalyticsString(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:+.-]/g, '_')
        .slice(0, NR_WEB_ANALYTICS_STRING_MAX);
}

function normalizeNrWebAnalyticsNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.round(n));
}

export function normalizeNrWebAnalyticsCircleSlug(slug) {
    const raw = String(slug || '').trim().replace(/^#/, '');
    if (!raw) return '';
    try {
        if (typeof canonicalTrustrootsCircleSlugKey === 'function') {
            return sanitizeNrWebAnalyticsString(canonicalTrustrootsCircleSlugKey(raw));
        }
    } catch (_) {}
    return sanitizeNrWebAnalyticsString(raw.replace(/^#/, ''));
}

export function normalizeNrWebAnalyticsTrustrootsUsername(username) {
    const raw = String(username || '').trim().toLowerCase().replace(/^@/, '');
    const bare = raw.endsWith('@trustroots.org') ? raw.slice(0, -'@trustroots.org'.length) : raw;
    return sanitizeNrWebAnalyticsString(bare);
}

export function getNrWebAnalyticsAreaData(plusCode) {
    const normalized = String(plusCode || '').replace(/\s/g, '').toUpperCase();
    if (!normalized) return {};
    return {
        plus_code_length: normalized.length,
        area_prefix: normalized.slice(0, NR_WEB_ANALYTICS_AREA_PREFIX_LENGTH).toLowerCase(),
    };
}

export function getNrWebExpirationAnalyticsBucket(seconds) {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n <= 0) return 'permanent';
    if (n <= 24 * 60 * 60) return 'day';
    if (n <= 7 * 24 * 60 * 60) return 'week';
    if (n <= 31 * 24 * 60 * 60) return 'month';
    return 'long';
}

export function getNrWebAnalyticsHostname() {
    try {
        const hostname = typeof window !== 'undefined' ? window.location?.hostname : '';
        return sanitizeNrWebAnalyticsString(hostname || '');
    } catch (_) {
        return '';
    }
}

export function sanitizeNrWebAnalyticsData(data = {}) {
    const out = {};
    const input = data && typeof data === 'object' ? data : {};
    for (const [key, value] of Object.entries(input)) {
        if (!NR_WEB_ANALYTICS_ALLOWED_KEYS.has(key)) continue;
        if (isBlockedNrWebAnalyticsKey(key)) continue;
        if (value === undefined || value === null || value === '') continue;
        if (typeof value === 'boolean') {
            out[key] = value;
        } else if (typeof value === 'number') {
            const n = normalizeNrWebAnalyticsNumber(value);
            if (n !== null) out[key] = n;
        } else if (key === 'circle_slug') {
            const slug = normalizeNrWebAnalyticsCircleSlug(value);
            if (slug) out[key] = slug;
        } else if (key === 'trustroots_username') {
            const username = normalizeNrWebAnalyticsTrustrootsUsername(value);
            if (username) out[key] = username;
        } else {
            const s = sanitizeNrWebAnalyticsString(value);
            if (s) out[key] = s;
        }
    }
    return out;
}

export function trackNrWebEvent(name, data = {}) {
    try {
        const eventName = sanitizeNrWebAnalyticsString(name).slice(0, NR_WEB_ANALYTICS_EVENT_NAME_MAX);
        if (!eventName) return false;
        const tracker = typeof window !== 'undefined' ? window.umami : null;
        if (!tracker || typeof tracker.track !== 'function') return false;
        tracker.track(eventName, sanitizeNrWebAnalyticsData({
            hostname: getNrWebAnalyticsHostname(),
            ...(data && typeof data === 'object' ? data : {}),
        }));
        return true;
    } catch (_) {
        return false;
    }
}

function trackNrWebSurfaceEvent(name, key, data = {}) {
    const dedupeKey = `${name}:${String(key || '')}`;
    if (nrWebLastSurfaceAnalytics.key === dedupeKey) return false;
    nrWebLastSurfaceAnalytics.key = dedupeKey;
    return trackNrWebEvent(name, data);
}

// ---------------------------------------------------------------------------
// Folded: claim-utils.js
// ---------------------------------------------------------------------------
/** Trustroots NIP-32 username namespace (matches Go import tool + nr-web index). */
export const TRUSTROOTS_USERNAME_LABEL_NAMESPACE = 'org.trustroots:username';

/** Short hex pubkey for UI (npub encoding not required for read-only labels). */
export function formatPubkeyShort(hex, head = 8, tail = 6) {
  if (!hex || typeof hex !== 'string') return '';
  const h = hex.toLowerCase().replace(/^0x/, '');
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function isLikelyHexPubkey64(s) {
  const v = String(s || '').toLowerCase().trim();
  if (v.length !== 64) return false;
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c >= 48 && c <= 57) continue;
    if (c >= 97 && c <= 102) continue;
    return false;
  }
  return true;
}

/** Pubkey in `p` tags that is not the current user (e.g. experience or relationship counterparty). */
export function pickOtherPTag(tags, currentPubkey) {
  const cur = String(currentPubkey || '').toLowerCase();
  const ps = (tags || []).filter((t) => Array.isArray(t) && t[0] === 'p' && t[1] && isLikelyHexPubkey64(t[1]));
  for (const t of ps) {
    if (String(t[1]).toLowerCase() !== cur) return String(t[1]).toLowerCase();
  }
  return '';
}

/** All 64-hex `p` tag pubkeys in tag order. */
export function listHexPubkeyPTags(tags) {
  const out = [];
  for (const t of tags || []) {
    if (Array.isArray(t) && t[0] === 'p' && t[1] && isLikelyHexPubkey64(t[1])) {
      out.push(String(t[1]).toLowerCase());
    }
  }
  return out;
}

export function claimTagValue(tags, name) {
  const t = (tags || []).find((tag) => Array.isArray(tag) && tag[0] === name && tag[1]);
  return t ? String(t[1]) : '';
}

export function hasClaimTagValue(tags, name, value) {
  return claimTagValue(tags, name).trim().toLowerCase() === String(value || '').trim().toLowerCase();
}

function claimSourceIdentity(event) {
  return claimTagValue(event?.tags, 'source_id') || String(event?.id || '');
}

function uniqueClaimCount(events, predicate) {
  const seen = new Set();
  for (const event of events || []) {
    if (!predicate(event)) continue;
    const key = claimSourceIdentity(event);
    if (key) seen.add(key);
  }
  return seen.size;
}

export function getConfirmedTwoSidedContactCount(events, currentPubkey) {
  const cur = String(currentPubkey || '').toLowerCase();
  return uniqueClaimCount(events, (event) => (
    event?.kind === 30392 &&
    hasClaimTagValue(event.tags, 'claimable', 'true') &&
    hasClaimTagValue(event.tags, 'confirmed', 'true') &&
    (!cur || listHexPubkeyPTags(event.tags).includes(cur))
  ));
}

export function getConfirmedConnectedPubkeyContacts(events, currentPubkey, myUsername = '') {
  return getTrustCardConnectedPubkeyPeople(events, currentPubkey, myUsername)
    .filter((person) => person.sources?.includes('contact'))
    .map(({ hex, username }) => ({ hex, username }));
}

export function getTrustCardConnectedPubkeyPeople(events, currentPubkey, myUsername = '') {
  const cur = String(currentPubkey || '').toLowerCase();
  if (!cur) return [];
  const me = String(myUsername || '').trim().toLowerCase();
  const byHex = new Map();
  function addPerson(hex, username, source) {
    const cleanHex = String(hex || '').toLowerCase();
    if (!isLikelyHexPubkey64(cleanHex) || cleanHex === cur) return;
    const cleanUsername = String(username || '').trim().toLowerCase();
    const existing = byHex.get(cleanHex);
    if (existing) {
      if (!existing.username && cleanUsername) existing.username = cleanUsername;
      if (source && !existing.sources.includes(source)) existing.sources.push(source);
      return;
    }
    byHex.set(cleanHex, { hex: cleanHex, username: cleanUsername, sources: source ? [source] : [] });
  }
  const sorted = [...(events || [])].sort((a, b) => (b?.created_at || 0) - (a?.created_at || 0));
  for (const event of sorted) {
    if (
      event?.kind === 30392 &&
      hasClaimTagValue(event.tags, 'claimable', 'true') &&
      hasClaimTagValue(event.tags, 'confirmed', 'true')
    ) {
      const hexPs = listHexPubkeyPTags(event.tags);
      const myIndex = hexPs.findIndex((h) => h === cur);
      if (myIndex < 0) continue;
      const otherIndex = hexPs.findIndex((h) => h !== cur);
      if (otherIndex < 0) continue;
      const pair = parseRelationshipSuggestionUsernames(event.content);
      let username = '';
      if (pair) {
        if (me) username = pair[0] === me ? pair[1] : pair[1] === me ? pair[0] : '';
        if (!username && hexPs.length >= 2) username = pair[otherIndex] || '';
      }
      addPerson(hexPs[otherIndex], username, 'contact');
    } else if (event?.kind === 30393 && hasClaimTagValue(event.tags, 'claimable', 'true')) {
      const { author, target } = getExperienceAuthorAndTarget(event.tags);
      if (author?.hex === cur) addPerson(target?.hex, target?.username, 'experience');
      else if (target?.hex === cur) addPerson(author?.hex, author?.username, 'experience');
      else if (me && author?.username === me) addPerson(target?.hex, target?.username, 'experience');
      else if (me && target?.username === me) addPerson(author?.hex, author?.username, 'experience');
    }
  }
  return Array.from(byHex.values());
}

export function getClaimablePositiveReferenceCount(events, currentPubkey) {
  const cur = String(currentPubkey || '').toLowerCase();
  return uniqueClaimCount(events, (event) => (
    event?.kind === 30393 &&
    hasClaimTagValue(event.tags, 'claimable', 'true') &&
    (!cur || listHexPubkeyPTags(event.tags).includes(cur)) &&
    (!cur || getExperienceClaimSignPlan(event.tags, cur).canSign)
  ));
}

export function buildTrustCardSummaryFromEvents(events, currentPubkey, myUsername = '') {
  const people = getTrustCardConnectedPubkeyPeople(events, currentPubkey, myUsername).map((person) => ({
    hex: String(person.hex || '').toLowerCase(),
    username: String(person.username || '').trim().toLowerCase(),
    sources: Array.isArray(person.sources) ? person.sources.filter(Boolean) : [],
  })).filter((person) => isLikelyHexPubkey64(person.hex));
  return {
    contactCount: getConfirmedTwoSidedContactCount(events, currentPubkey),
    positiveExperienceCount: getClaimablePositiveReferenceCount(events, currentPubkey),
    threadUpvoteMetricValue: extractThreadUpvoteMetricValue(events, currentPubkey),
    people,
  };
}

export function shouldShowThreadUpvoteMetric(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function trustCardPersonNip05(person, knownNip05 = '') {
  const nip05 = String(knownNip05 || '').trim().toLowerCase();
  if (nip05 && isTrustrootsNip05Lower(nip05)) return nip05;
  const username = String(person?.username || '').trim().toLowerCase();
  return username ? `${username}@trustroots.org` : '';
}

export function extractRelationshipTargetsFromClaims(claims, currentPublicKey) {
  const targets = new Set();
  if (!Array.isArray(claims) || !currentPublicKey) return targets;
  const current = String(currentPublicKey).toLowerCase();
  for (const claim of claims) {
    const tags = Array.isArray(claim?.tags) ? claim.tags : [];
    const hexPs = listHexPubkeyPTags(tags);
    if (!hexPs.some((h) => h === current)) continue;
    for (const h of hexPs) {
      if (h !== current) targets.add(h);
    }
  }
  return targets;
}

export function mergePTags(existingTags, targets) {
  const merged = new Set(Array.isArray(targets) ? targets : Array.from(targets || []));
  const tags = Array.isArray(existingTags) ? existingTags : [];
  for (const tag of tags) {
    if (Array.isArray(tag) && tag[0] === 'p' && tag[1]) merged.add(String(tag[1]).toLowerCase());
  }
  return Array.from(merged);
}

export function buildKind3Tags(mergedPubkeys) {
  return (mergedPubkeys || []).map((pubkey) => ['p', String(pubkey).toLowerCase()]);
}

export function buildTrustroots30000Tags(mergedPubkeys) {
  return [['d', 'trustroots-contacts'], ...(mergedPubkeys || []).map((pubkey) => ['p', String(pubkey).toLowerCase()])];
}

export function trustrootsProfileUrl(username) {
  const u = String(username || '').trim().toLowerCase();
  if (!u) return '';
  return `https://www.trustroots.org/profile/${encodeURIComponent(u)}`;
}

export function trustrootsMessageUrl(username) {
  const u = String(username || '').trim().toLowerCase();
  if (!u) return '';
  return `https://www.trustroots.org/messages/${encodeURIComponent(u)}`;
}

export function trustrootsUsernameFromNip05Address(value) {
  const s = String(value || '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  if (at <= 0 || at === s.length - 1) return '';
  const local = s.slice(0, at);
  const domain = s.slice(at + 1).replace(/^www\./, '');
  if (domain !== 'trustroots.org') return '';
  if (!/^[a-z0-9][a-z0-9_.-]{0,63}$/.test(local)) return '';
  return local;
}

export function profileResolutionFailureDetails(profileId) {
  const raw = String(profileId || '').trim();
  const trustrootsUsername = trustrootsUsernameFromNip05Address(raw);
  const profileLabel = raw || 'this profile link';
  const details = {
    title: "We couldn't find this Nostr profile.",
    intro: `Nostroots tried to look up ${profileLabel}. Nostr profiles can be found by an npub (a public profile key) or by a NIP-05 address, which looks like username@trustroots.org and points to an npub.`,
    next: 'This address does not currently point to a usable Nostr public key. Check the spelling, or ask the person for their npub.',
    trustrootsUsername,
    actionHref: '',
    actionLabel: '',
    invite: '',
  };
  if (trustrootsUsername) {
    details.next = `That probably means ${trustrootsUsername} has not added their npub to Trustroots yet, or the Trustroots username is wrong.`;
    details.actionHref = trustrootsMessageUrl(trustrootsUsername);
    details.actionLabel = `Message ${trustrootsUsername} on Trustroots`;
    details.invite = 'You can invite them to Nostroots from Trustroots and ask them to add their public Nostr address there.';
  }
  return details;
}

export function trustrootsConversationStartFeedback(username) {
  const u = String(username || '').trim().toLowerCase();
  if (!u) return { message: 'Could not find a linked Nostr address for that Trustroots user.' };
  return {
    message: `I couldn't find a Nostroots address for ${u}@trustroots.org. They may still need to add their public Nostr address (npub) on Trustroots before you can message them here.`,
    actionHref: trustrootsMessageUrl(u),
    actionLabel: 'Message on Trustroots',
  };
}

/**
 * Parse `Trustroots relationship suggestion: @a -> @b` (from import tool).
 * @returns {[string, string]|null} lowercased usernames [from, to]
 */
export function parseRelationshipSuggestionUsernames(content) {
  const m = String(content || '').match(/@([a-zA-Z0-9_.-]+)\s*->\s*@([a-zA-Z0-9_.-]+)/);
  if (!m) return null;
  return [m[1].toLowerCase(), m[2].toLowerCase()];
}

/**
 * Counterparty Trustroots username when the viewer is `myUsername` (linked TR username, lowercase).
 */
export function relationshipCounterpartyUsername(content, myUsernameLower) {
  const pair = parseRelationshipSuggestionUsernames(content);
  if (!pair) return '';
  const me = String(myUsernameLower || '').toLowerCase();
  if (!me) return '';
  if (pair[0] === me) return pair[1];
  if (pair[1] === me) return pair[0];
  return '';
}

/**
 * After `d`, experience claims emit author block then target block (each `p` hex or username L/l pair).
 */
export function getExperienceAuthorAndTarget(tags) {
  const t = Array.isArray(tags) ? tags : [];
  let i = 0;
  if (t[i] && t[i][0] === 'd') i += 1;

  function readParticipant() {
    if (i >= t.length) return null;
    const row = t[i];
    if (!Array.isArray(row)) return null;
    if (row[0] === 'p' && row[1] && isLikelyHexPubkey64(row[1])) {
      i += 1;
      return { hex: String(row[1]).toLowerCase(), username: '' };
    }
    if (
      row[0] === 'L' &&
      row[1] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE &&
      t[i + 1] &&
      t[i + 1][0] === 'l' &&
      t[i + 1][2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE
    ) {
      const u = String(t[i + 1][1] || '').toLowerCase();
      i += 2;
      return { hex: '', username: u };
    }
    return null;
  }

  const author = readParticipant();
  const target = readParticipant();
  return { author, target };
}

/**
 * Whether the logged-in user may publish the kind-1985 positive label for this 30393 claim.
 * Only the experience author should sign; target must have a hex pubkey for the `p` tag on the label.
 */
export function getExperienceClaimSignPlan(tags, currentPubkey) {
  const cur = String(currentPubkey || '').toLowerCase();
  const { author, target } = getExperienceAuthorAndTarget(tags);
  if (!author || !target) {
    return { canSign: false, targetHex: '', reason: 'unparsed' };
  }
  const authorIsMe = author.hex && author.hex === cur;
  if (!authorIsMe) {
    return { canSign: false, targetHex: '', reason: 'not_author' };
  }
  if (!target.hex) {
    return { canSign: false, targetHex: '', reason: 'no_target_hex' };
  }
  return { canSign: true, targetHex: target.hex, reason: '' };
}

/**
 * @returns {{ type: 'hex', hex: string, usernames: string[] } | { type: 'user', hex: '', usernames: string[] } | { type: 'users', hex: '', usernames: string[] } | { type: 'none', hex: '', usernames: string[] }}
 */
export function relationshipCounterpartyDisplay(tags, content, currentPubkey, myUsernameTrimmed) {
  const otherHex = pickOtherPTag(tags, currentPubkey);
  if (otherHex) return { type: 'hex', hex: otherHex, usernames: [] };
  const me = String(myUsernameTrimmed || '').toLowerCase();
  const pair = parseRelationshipSuggestionUsernames(content);
  if (pair && me) {
    const u = pair[0] === me ? pair[1] : pair[1] === me ? pair[0] : '';
    if (u) return { type: 'user', hex: '', usernames: [u] };
  }
  if (pair && !me) return { type: 'users', hex: '', usernames: pair };
  return { type: 'none', hex: '', usernames: [] };
}

/**
 * Counterparty for experience claim rows when the other side has no hex `p` tag.
 * @returns {{ type: 'hex', hex: string, username: string } | { type: 'user', hex: '', username: string } | { type: 'none', hex: '', username: string }}
 */
export function experienceCounterpartyDisplay(tags, currentPubkey) {
  const cur = String(currentPubkey || '').toLowerCase();
  const otherHex = pickOtherPTag(tags, currentPubkey);
  if (otherHex) return { type: 'hex', hex: otherHex, username: '' };
  const { author, target } = getExperienceAuthorAndTarget(tags);
  if (!author || !target) return { type: 'none', hex: '', username: '' };
  if (author.hex === cur && target.username) return { type: 'user', hex: '', username: target.username };
  if (target.hex === cur && author.username) return { type: 'user', hex: '', username: author.username };
  return { type: 'none', hex: '', username: '' };
}

// ---------------------------------------------------------------------------
// Folded: note-intents.js
// ---------------------------------------------------------------------------
/**
 * Map note interaction intents — small controlled vocabulary surfaced in the
 * compose UI as single-select chips, written to kind 30397 events as both a
 * NIP-12 `t` tag and an in-content `#hashtag`.
 *
 * Keep this file dependency-free so it can be unit-tested directly.
 */

export const MAP_NOTE_INTENTS = [
    { id: 'wanttomeet',     label: 'Want to meet',     hint: 'Social meetup, no hosting' },
    { id: 'hosting',        label: 'Hosting',          hint: 'I can host travelers' },
    { id: 'lookingforhost', label: 'Looking for host', hint: 'I need a place to stay' },
    { id: 'localtips',      label: 'Local tips',       hint: 'Share or ask about the area' },
    { id: 'ride',           label: 'Ride',             hint: 'Offering or seeking a ride' },
    { id: 'event',          label: 'Event',            hint: 'Something happening at a time' },
];

export const MAP_NOTE_INTENT_IDS = new Set(MAP_NOTE_INTENTS.map((i) => i.id));

export function getIntentById(id) {
    if (!id) return null;
    const lower = String(id).trim().toLowerCase();
    return MAP_NOTE_INTENTS.find((i) => i.id === lower) || null;
}

export function isIntentId(id) {
    if (!id) return false;
    return MAP_NOTE_INTENT_IDS.has(String(id).trim().toLowerCase());
}

/**
 * Detect a note's intent. Prefer the first NIP-12 `t` tag matching a known
 * intent; fall back to the first `#intent` hashtag in the content.
 * @param {{tags?: any[], content?: string}} event
 * @returns {string|null}
 */
export function detectNoteIntent(event) {
    if (!event) return null;
    const tags = Array.isArray(event.tags) ? event.tags : [];
    for (const tag of tags) {
        if (!Array.isArray(tag) || tag.length < 2) continue;
        if (tag[0] !== 't') continue;
        const value = String(tag[1] || '').trim().toLowerCase();
        if (MAP_NOTE_INTENT_IDS.has(value)) return value;
    }
    const content = String(event.content || '');
    const matches = content.match(/#(\w+)/g) || [];
    for (const m of matches) {
        const value = m.slice(1).toLowerCase();
        if (MAP_NOTE_INTENT_IDS.has(value)) return value;
    }
    return null;
}

/**
 * Prepend `#intent` to the note content if it does not already contain that
 * exact hashtag. Trims the result. Returns the original content if intent is
 * unknown/empty.
 * @param {string} content
 * @param {string|null} intentId
 * @returns {string}
 */
export function applyIntentHashtagToContent(content, intentId) {
    const text = String(content == null ? '' : content);
    if (!isIntentId(intentId)) return text;
    const id = String(intentId).trim().toLowerCase();
    const hashtag = `#${id}`;
    const existing = text.match(/#\w+/g) || [];
    const has = existing.some((h) => h.toLowerCase() === hashtag);
    if (has) return text.trim();
    const trimmed = text.trim();
    return trimmed ? `${hashtag} ${trimmed}` : hashtag;
}

/**
 * Push a NIP-12 `t` tag for the intent into a tag array (mutates and returns).
 * No-op for unknown intent.
 * @param {any[]} tags
 * @param {string|null} intentId
 * @returns {any[]}
 */
export function pushIntentTag(tags, intentId) {
    if (!Array.isArray(tags)) return tags;
    if (!isIntentId(intentId)) return tags;
    tags.push(['t', String(intentId).trim().toLowerCase()]);
    return tags;
}

/**
 * If the content begins with `#intent` (with optional surrounding whitespace),
 * strip exactly that leading token so the visible note doesn't repeat the
 * badge label. Other occurrences are left intact.
 * @param {string} content
 * @param {string|null} intentId
 * @returns {string}
 */
export function stripLeadingIntentHashtag(content, intentId) {
    const text = String(content == null ? '' : content);
    if (!isIntentId(intentId)) return text;
    const id = String(intentId).trim().toLowerCase();
    const re = new RegExp(`^\\s*#${id}\\b\\s*`, 'i');
    return text.replace(re, '');
}

// ---------------------------------------------------------------------------
// Folded: nsec-guard.js
// ---------------------------------------------------------------------------
/**
 * Detect valid NIP-19 nsec tokens in user-visible text (notes, chat, etc.).
 * Candidate tokens use the bech32 data charset (BIP-173); each match is verified with nip19.decode.
 */

/** Bech32 data payload charset (BIP-173 / NIP-19). Flag `i` allows uppercase bech32. */
export const NSEC1_TOKEN_RE = /\bnsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{20,}\b/gi;

/**
 * @param {string} text
 * @param {{ decode: (s: string) => { type?: string } }} nip19
 */
export function containsPrivateKeyNsec(text, nip19) {
    if (!text || typeof text !== 'string' || !nip19?.decode) return false;
    const candidates = text.match(NSEC1_TOKEN_RE) || [];
    for (const candidate of candidates) {
        try {
            const decoded = nip19.decode(candidate);
            if (decoded?.type === 'nsec') return true;
        } catch (_) {}
    }
    return false;
}

/** Example string that must be blocked in chat (contains valid nsec with bech32 `l`). */
export const CHAT_NSEC_LEAK_FIXTURE =
    'test nsec1l53ku95egk2emglml9q4k5zt722axs4eplkq4sauqv2d2vz23h8smvgxx8';

// ---------------------------------------------------------------------------
// Folded: trustroots-circles-list.js
// ---------------------------------------------------------------------------
/**
 * Trustroots circle slugs (tribes) for Nostr tags and nr-web UI — lowercase,
 * no ASCII hyphens (matches trustrootsimporttool `d` / `l` values).
 *
 * Keep aligned with Trustroots + kind 30410 circle directory imports.
 */
export const TRUSTROOTS_CIRCLE_SLUG_LIST = Object.freeze([
    'hosts',
    'hitch',
    'dumpsterdivers',
    'families',
    'musicians',
    'buskers',
    'veg',
    'hackers',
    'lgbtq',
    'ecoliving',
    'lindyhoppers',
    'nomads',
    'punks',
    'cyclists',
    'foodsharing',
    'yoga',
    'climbers',
    'hikers',
    'sailors',
    'artists',
    'rainbowgathering',
    'slackline',
    'spirituals',
    'dancers',
    'acroyoga',
    'jugglers',
    'vanlife',
    'volunteers',
    'winemakers',
    'squatters',
    'surfers',
    'skateboarders',
    'pilgrims',
    'photographers',
    'naturists',
    'motorcyclists',
    'feminists',
    'circus',
    'cooking',
    'burners',
    'beerbrewers',
    'anarchists',
    'gardeners',
    'scubadivers',
    'ravers',
    'zerowasters',
    'activists',
    'runners',
    'filmmakers',
    'books',
    'cypherpunks',
    'lightfoot'
]);

/**
 * Canonical Nostr circle key aliases (legacy/user-entered -> canonical key).
 * Used before matching circle metadata and known circle sets.
 */
export const TRUSTROOTS_CIRCLE_KEY_ALIASES = Object.freeze({
    hitchhikers: 'hitch',
    trustrootsvolunteers: 'volunteers',
    gardenersfarmers: 'gardeners'
});

/**
 * Canonical Trustroots web slug overrides for circles whose Nostr key is dashless
 * but trustroots.org route/CDN paths are hyphenated.
 */
export const TRUSTROOTS_CIRCLE_WEB_SLUG_OVERRIDES = Object.freeze({
    rainbowgathering: 'rainbow-gathering',
    volunteers: 'trustroots-volunteers',
    hitch: 'hitchhikers',
    dumpsterdivers: 'dumpster-divers',
    gardeners: 'gardeners-farmers',
    scubadivers: 'scuba-divers',
    beerbrewers: 'beer-brewers',
    zerowasters: 'zero-wasters'
});

/** @returns {{ slug: string }[]} */
export function getTrustrootsCircleEntries() {
    return TRUSTROOTS_CIRCLE_SLUG_LIST.map((slug) => ({ slug }));
}

// ---------------------------------------------------------------------------
// Folded: nr-web-kv-idb.js
// ---------------------------------------------------------------------------
/**
 * Small IndexedDB key-value store for nr-web prefs and caches that exceed localStorage comfort.
 * Object store: { k: string, v: structuredClone-able value }.
 */

const NR_WEB_KV_DB_NAME = 'nostroots_web_kv';
const NR_WEB_KV_DB_VERSION = 1;
const NR_WEB_KV_STORE = 'kv';

/** IndexedDB keys (also legacy localStorage keys where applicable). */
export const NR_WEB_KV_KEYS = {
    NOTIFICATION_PLUS_CODES: 'notification_plus_codes',
    CLAIM_SIGN_DONE: 'nostroots_claim_sign_done',
};
const NIP05_RESOLVE_CACHE_KEY_PREFIX = 'nr_nip05_resolve_v1:';
const PROFILE_ID_RESOLVE_CACHE_KEY_PREFIX = 'nr_profile_id_resolve_v1:';
const TRUSTROOTS_AVATAR_CACHE_KEY_PREFIX = 'nr_tr_avatar_v1:';
const TRUSTROOTS_CIRCLE_DIR_CACHE_KEY_PREFIX = 'nr_tr_circle_dir_v1:';
const PROFILE_TRUST_SUMMARY_CACHE_KEY_PREFIX = 'nr_profile_trust_summary_v1:';
const NIP05_RESOLVE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const PROFILE_ID_RESOLVE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const TRUSTROOTS_AVATAR_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const TRUSTROOTS_CIRCLE_DIR_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h
const PROFILE_TRUST_SUMMARY_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h
const PROFILE_MEMO_MAX_ENTRIES = 500;

let dbPromise = null;
const nip05ResolveMemo = new Map();
const profileIdResolveMemo = new Map();
const trustrootsAvatarMemo = new Map();
const trustrootsCircleDirMemo = new Map();

function rememberMemoizedLookup(map, key, value) {
    if (!key || !map) return;
    if (map.size >= PROFILE_MEMO_MAX_ENTRIES && !map.has(key)) {
        const first = map.keys().next();
        if (!first.done) map.delete(first.value);
    }
    map.set(key, value);
}

function normalizeTimedLookup(row, maxAgeMs) {
    if (!row || typeof row !== 'object') return null;
    const ts = Number(row.ts || 0);
    if (!Number.isFinite(ts) || ts <= 0) return null;
    if (Date.now() - ts > maxAgeMs) return null;
    if (!Object.prototype.hasOwnProperty.call(row, 'value')) return null;
    return row;
}

function normalizeCachedPubkeyHex(value) {
    const hex = String(value || '').trim().toLowerCase();
    return /^[0-9a-f]{64}$/.test(hex) ? hex : '';
}

export function chatCacheKvKey(pubkeyHex) {
    return 'nostroots_chat_cache_' + pubkeyHex;
}

export function hasNrWebKvStorage() {
    return typeof indexedDB !== 'undefined';
}

export function openNrWebKvDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        if (!hasNrWebKvStorage()) {
            dbPromise = null;
            reject(new Error('indexedDB unavailable'));
            return;
        }
        const req = indexedDB.open(NR_WEB_KV_DB_NAME, NR_WEB_KV_DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(NR_WEB_KV_STORE)) {
                db.createObjectStore(NR_WEB_KV_STORE, { keyPath: 'k' });
            }
        };
        req.onerror = () => {
            dbPromise = null;
            reject(req.error);
        };
        req.onsuccess = () => resolve(req.result);
    });
    return dbPromise;
}

export async function nrWebKvGet(key) {
    try {
        const db = await openNrWebKvDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(NR_WEB_KV_STORE, 'readonly');
            tx.onerror = () => reject(tx.error);
            const r = tx.objectStore(NR_WEB_KV_STORE).get(key);
            r.onerror = () => reject(r.error);
            r.onsuccess = () => {
                const row = r.result;
                resolve(row ? row.v : undefined);
            };
        });
    } catch (_) {
        return undefined;
    }
}

export async function nrWebKvPut(key, value) {
    try {
        const db = await openNrWebKvDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(NR_WEB_KV_STORE, 'readwrite');
            tx.onerror = () => reject(tx.error);
            tx.oncomplete = () => resolve();
            tx.objectStore(NR_WEB_KV_STORE).put({ k: key, v: value });
        });
    } catch (_) {}
}

export async function nrWebKvDelete(key) {
    try {
        const db = await openNrWebKvDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(NR_WEB_KV_STORE, 'readwrite');
            tx.onerror = () => reject(tx.error);
            tx.oncomplete = () => resolve();
            tx.objectStore(NR_WEB_KV_STORE).delete(key);
        });
    } catch (_) {}
}

// ---------------------------------------------------------------------------
// Folded: nip05-resolve.js
// ---------------------------------------------------------------------------
/** @param {number} ms */
function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal })
    .finally(() => clearTimeout(t));
}

/**
 * Resolve NIP-05 to hex pubkey (shared by chat-app and profile page).
 * trustroots.org uses www.trustroots.org for .well-known. Falls back to CORS proxy when needed.
 * @param {string} nip05
 * @returns {Promise<string|null>} 64-char lowercase hex or null
 */
export async function resolveNip05(nip05) {
  const s = (nip05 || '').trim().toLowerCase();
  const at = s.indexOf('@');
  if (at <= 0 || at === s.length - 1) return null;
  const memoHit = normalizeTimedLookup(nip05ResolveMemo.get(s), NIP05_RESOLVE_CACHE_MAX_AGE_MS);
  if (memoHit) {
    const cachedHex = normalizeCachedPubkeyHex(memoHit.value);
    if (cachedHex) return cachedHex;
    if (!memoHit.value) return null;
  }
  const cacheKey = NIP05_RESOLVE_CACHE_KEY_PREFIX + s;
  const persisted = normalizeTimedLookup(await nrWebKvGet(cacheKey), NIP05_RESOLVE_CACHE_MAX_AGE_MS);
  if (persisted) {
    const cachedHex = normalizeCachedPubkeyHex(persisted.value);
    if (cachedHex || !persisted.value) {
      rememberMemoizedLookup(nip05ResolveMemo, s, persisted);
      return cachedHex || null;
    }
  }
  const local = s.slice(0, at);
  let domain = s.slice(at + 1).replace(/^www\./, '');
  const base =
    domain === 'trustroots.org' || domain === 'nos.trustroots.org'
      ? 'https://www.trustroots.org'
      : `https://${domain}`;
  const url = `${base}/.well-known/nostr.json?name=${encodeURIComponent(local)}`;
  let data = null;
  try {
    const res = await fetchWithTimeout(url, 8000);
    if (res.ok) data = await res.json();
  } catch (_) {}
  if (!data) {
    try {
      const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
      const res = await fetchWithTimeout(proxyUrl, 8000);
      const text = await res.text();
      data = JSON.parse(text);
    } catch (_) {
      return null;
    }
  }
  if (!data || !data.names || !data.names[local]) return null;
  const hex = (data.names[local] + '').toLowerCase();
  const resolved = hex.length === 64 && /^[0-9a-f]+$/.test(hex) ? hex : null;
  const row = { ts: Date.now(), value: resolved || '' };
  rememberMemoizedLookup(nip05ResolveMemo, s, row);
  void nrWebKvPut(cacheKey, row).catch(() => {});
  return resolved;
}

// ---------------------------------------------------------------------------
// Folded: circle-metadata.js
// ---------------------------------------------------------------------------
/**
 * Trustroots circle directory events (kind 30410) — shared by chat-app and unit tests.
 */

export const TRUSTROOTS_CIRCLE_META_KIND = 30410;

export function getCircleMetaDTagFromTags(tags) {
    const row = (tags || []).find((t) => Array.isArray(t) && t[0] === 'd' && t[1]);
    return row ? String(row[1]).trim().toLowerCase() : '';
}

/** Lowercase slug for map keys / matching; strips ASCII hyphens (matches import tool + nr-web list). */
export function normalizeTrustrootsCircleSlugKey(slug) {
    return String(slug || '')
        .trim()
        .toLowerCase()
        .replace(/-/g, '');
}

/**
 * Normalize legacy Trustroots circle aliases like `trustrootsvolunteers` or
 * `trustroots-rainbow-gathering` into known canonical circle keys.
 *
 * Returns the original normalized slug when no known circle match is found.
 *
 * @param {string} slug
 * @param {(candidate: string) => boolean} isKnownCircle
 * @returns {string}
 */
export function normalizeLegacyTrustrootsCircleAlias(slug, isKnownCircle) {
    const normalized = String(slug || '').trim().toLowerCase();
    if (!normalized) return '';
    const checkKnown = typeof isKnownCircle === 'function' ? isKnownCircle : () => false;
    if (!normalized.startsWith('trustroots')) return normalized;
    const suffix = normalized.slice('trustroots'.length);
    if (!suffix) return normalized;
    const trimmedSuffix = suffix.replace(/^[-_]+/, '');
    if (!trimmedSuffix) return normalized;
    const candidate = canonicalTrustrootsCircleSlugKey(trimmedSuffix);
    if (candidate && checkKnown(candidate)) return candidate;
    return normalized;
}

/** Lowercase slug for Trustroots web/CDN paths (hyphens preserved). */
export function normalizeTrustrootsCircleWebSlug(slug) {
    return String(slug || '')
        .trim()
        .toLowerCase();
}

/** Resolve known canonical Trustroots web slug overrides from any slug form. */
export function trustrootsCircleWebSlugOverride(slug) {
    const key = canonicalTrustrootsCircleSlugKey(slug);
    if (!key) return '';
    return String(TRUSTROOTS_CIRCLE_WEB_SLUG_OVERRIDES[key] || '').trim().toLowerCase();
}

/** Resolve canonical Nostr key alias (if any) for a slug. */
export function trustrootsCircleKeyAlias(slug) {
    const key = normalizeTrustrootsCircleSlugKey(slug);
    if (!key) return '';
    return String(TRUSTROOTS_CIRCLE_KEY_ALIASES[key] || '').trim().toLowerCase();
}

/** Canonical Nostr circle key after hyphen stripping and known alias resolution. */
export function canonicalTrustrootsCircleSlugKey(slug) {
    const key = normalizeTrustrootsCircleSlugKey(slug);
    if (!key) return '';
    return trustrootsCircleKeyAlias(key) || key;
}

/** Extract Trustroots web slug from `uploads-circle/<slug>/...` picture URLs. */
export function trustrootsCircleSlugFromPictureUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        const m = parsed.pathname.match(/\/uploads-circle\/([^/]+)\//i);
        if (!m || !m[1]) return '';
        return normalizeTrustrootsCircleWebSlug(decodeURIComponent(m[1]));
    } catch (_) {
        const m = raw.match(/\/uploads-circle\/([^/?#]+)\//i);
        if (!m || !m[1]) return '';
        try {
            return normalizeTrustrootsCircleWebSlug(decodeURIComponent(m[1]));
        } catch (_) {
            return normalizeTrustrootsCircleWebSlug(m[1]);
        }
    }
}

/**
 * Resolve Trustroots web slug (for trustroots.org links and uploads-circle paths).
 * Precedence: picture-derived slug -> explicit content slug -> fallback slug.
 */
export function resolveTrustrootsCircleWebSlug(meta, fallbackSlug) {
    const fromPicture = trustrootsCircleSlugFromPictureUrl(meta?.picture);
    if (fromPicture) return fromPicture;
    const fromMeta = normalizeTrustrootsCircleWebSlug(meta?.slug);
    if (fromMeta) return trustrootsCircleWebSlugOverride(fromMeta) || fromMeta;
    const fallback = normalizeTrustrootsCircleWebSlug(fallbackSlug);
    if (!fallback) return '';
    return trustrootsCircleWebSlugOverride(fallback) || fallback;
}

/** Build Trustroots circle page URL from metadata/fallback slug. */
export function trustrootsCirclePageUrlFromMeta(meta, fallbackSlug) {
    const slug = resolveTrustrootsCircleWebSlug(meta, fallbackSlug);
    if (!slug) return '';
    return `https://www.trustroots.org/circles/${encodeURIComponent(slug)}`;
}

/** Build Trustroots circle fallback image URL from metadata/fallback slug. */
export function trustrootsCirclePictureFallbackUrlFromMeta(meta, fallbackSlug) {
    const slug = resolveTrustrootsCircleWebSlug(meta, fallbackSlug);
    if (!slug) return '';
    return `https://www.trustroots.org/uploads-circle/${encodeURIComponent(slug)}/1400x900.webp`;
}

export function parseCircleMetaContent(jsonStr) {
    try {
        const o = JSON.parse(jsonStr || '{}');
        return {
            name: String(o.name || '').trim(),
            about: String(o.about || '').trim(),
            picture: String(o.picture || '').trim(),
            slug: normalizeTrustrootsCircleWebSlug(o.slug || '')
        };
    } catch (_) {
        return { name: '', about: '', picture: '', slug: '' };
    }
}

export function isSafeHttpUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const u = new URL(url.trim());
        return u.protocol === 'https:' || u.protocol === 'http:';
    } catch (_) {
        return false;
    }
}

/**
 * @param {Map<string, object>} map - slug -> { name, about, picture, trustrootsSlug, created_at, eventId }
 * @param {object} ev
 * @param {{ expectedPubkey?: string, kind?: number }} opts
 * @returns {boolean} true if map was updated
 */
export function mergeCircleMetadataMapEntry(map, ev, opts) {
    const kind = opts && opts.kind != null ? opts.kind : TRUSTROOTS_CIRCLE_META_KIND;
    if (!ev || ev.kind !== kind) return false;
    const exp = String(opts?.expectedPubkey || '')
        .trim()
        .toLowerCase();
    if (exp && String(ev.pubkey || '').trim().toLowerCase() !== exp) return false;
    const rawSlug = getCircleMetaDTagFromTags(ev.tags);
    if (!rawSlug) return false;
    const slug = normalizeTrustrootsCircleSlugKey(rawSlug);
    const parsed = parseCircleMetaContent(ev.content);
    const prev = map.get(slug);
    if (prev && prev.created_at >= ev.created_at) return false;
    const trustrootsSlug = resolveTrustrootsCircleWebSlug(parsed, rawSlug || slug) || slug;
    map.set(slug, {
        name: parsed.name || slug,
        about: parsed.about,
        picture: parsed.picture,
        trustrootsSlug,
        created_at: ev.created_at,
        eventId: ev.id
    });
    return true;
}

// ---------------------------------------------------------------------------
// DRY local key utils (shared by index map UI and embedded chat)
// Single definition of "what is a valid pasted key": nsec, 64-char hex, BIP-39
// mnemonic. Same localStorage key, same hex normalization, same error copy.
// ---------------------------------------------------------------------------

/** localStorage key for the user's signing key (raw 64-char lowercase hex). */
export const NR_WEB_PRIVATE_KEY_STORAGE_KEY = 'nostr_private_key';

/** True for a 64-char lowercase hex string. */
export function isValidPrivateKeyHex64(s) {
    return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
}

/** Convert a 64-char hex private key into a Uint8Array(32). Throws on bad input. */
export function secretKeyBytesFromHex64(hex) {
    if (!isValidPrivateKeyHex64(String(hex || '').toLowerCase())) {
        throw new Error('Invalid 64-char hex secret key');
    }
    const lower = String(hex).toLowerCase();
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(lower.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

/** Read the stored 64-char hex key, returning '' if missing or malformed. */
export function readValidStoredKeyHex() {
    try {
        const raw = (typeof localStorage !== 'undefined' ? localStorage.getItem(NR_WEB_PRIVATE_KEY_STORAGE_KEY) : '') || '';
        const lower = raw.trim().toLowerCase();
        return isValidPrivateKeyHex64(lower) ? lower : '';
    } catch (_) {
        return '';
    }
}

/** Persist a 64-char lowercase hex key. No-op if invalid. */
export function writeStoredKeyHex(hex) {
    const lower = String(hex || '').trim().toLowerCase();
    if (!isValidPrivateKeyHex64(lower)) return false;
    try {
        localStorage.setItem(NR_WEB_PRIVATE_KEY_STORAGE_KEY, lower);
        return true;
    } catch (_) {
        return false;
    }
}

/** Remove the stored key. */
export function clearStoredKey() {
    try { localStorage.removeItem(NR_WEB_PRIVATE_KEY_STORAGE_KEY); } catch (_) {}
}

/**
 * Parse a pasted key into 64-char lowercase hex.
 *
 * Accepts:
 *  - nsec1… (NIP-19 secret key) — decoded via nip19.decode.
 *  - 64-char hex — returned lowercased.
 *  - BIP-39 mnemonic (12/24 words) — first 32 bytes of mnemonicToSeedSync.
 *    Note: the mnemonic→privkey rule (first 32 bytes of the BIP-39 seed) is
 *    common practice but is NOT a standardized NIP. Keep the same rule as
 *    the map UI used historically so both flows derive the same key.
 *
 * Returns { ok: true, hex } or { ok: false, kind: 'empty'|'npub'|'invalid' }.
 *
 * @param {string} raw Pasted text from a key import field.
 */
export function parseKeyImportToHex(raw) {
    const input = (raw == null ? '' : String(raw)).trim();
    if (!input) return { ok: false, kind: 'empty' };
    if (input.toLowerCase().startsWith('npub1')) return { ok: false, kind: 'npub' };

    if (input.toLowerCase().startsWith('nsec1')) {
        try {
            const decoded = nip19.decode(input);
            if (decoded && decoded.type === 'nsec' && decoded.data) {
                return { ok: true, hex: bytesToHex(decoded.data) };
            }
        } catch (_) {}
        return { ok: false, kind: 'invalid' };
    }

    const lower = input.toLowerCase();
    if (isValidPrivateKeyHex64(lower)) return { ok: true, hex: lower };

    if (input.includes(' ')) {
        try {
            if (!validateMnemonic(input)) return { ok: false, kind: 'invalid' };
            const seed = mnemonicToSeedSync(input);
            return { ok: true, hex: bytesToHex(seed.slice(0, 32)) };
        } catch (_) {
            return { ok: false, kind: 'invalid' };
        }
    }

    return { ok: false, kind: 'invalid' };
}

/** User-facing error copy for failed key imports. */
export function getKeyImportErrorMessage(input) {
    const v = (input == null ? '' : String(input)).trim();
    if (!v) return 'Please enter an nsec or mnemonic phrase';
    if (v.toLowerCase().startsWith('npub1')) {
        return 'You pasted an npub — that is your public profile id (safe to share), not a signing key. Import your nsec1… private key or your 12/24-word recovery phrase instead. In the Nostroots app: export nsec from settings, or use “Reveal recovery phrase” if you only have a phrase.';
    }
    if (v.toLowerCase().startsWith('nsec1')) return 'Invalid nsec format';
    if (v.includes(' ')) return 'Invalid mnemonic phrase. Please check your words.';
    return 'Invalid key. Paste an nsec1…, 12/24-word recovery phrase, or 64-char hex.';
}

/** Encode a 64-char hex secret key as nsec1…; useful for export-to-clipboard flows. */
export function nsecEncodeFromHex64(hex) {
    return nip19.nsecEncode(secretKeyBytesFromHex64(hex));
}

/** Lowercase hex of a 32-byte Uint8Array. Empty string for null/undefined. */
export function bytesToHex(bytes) {
    if (!bytes) return '';
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
    return out;
}

/** Decode an `npub1…` string to lowercase 64-char hex, or '' on error. */
export function npubToHex(npub) {
    try {
        const d = nip19.decode(String(npub || '').trim());
        if (d.type !== 'npub') return '';
        const hex = bytesToHex(d.data);
        return /^[0-9a-f]{64}$/.test(hex) ? hex : '';
    } catch (_) {
        return '';
    }
}

/** Encode a 64-char hex public key as `npub1…`. Returns '' on error. */
export function hexToNpub(hex) {
    try {
        return nip19.npubEncode(String(hex || '').trim().toLowerCase());
    } catch (_) {
        return '';
    }
}

/**
 * Cached `npub1…` for the current signed-in pubkey. Invalidates whenever `currentPublicKey`
 * changes (login / import / logout). Returns '' when no key is loaded.
 */
let _nrCurrentNpubCache = { hex: '', npub: '' };
export function getCurrentNpub() {
    const hex = (typeof currentPublicKey === 'string' && currentPublicKey) || '';
    if (hex && hex === _nrCurrentNpubCache.hex) return _nrCurrentNpubCache.npub;
    const npub = hex ? hexToNpub(hex) : '';
    _nrCurrentNpubCache = { hex, npub };
    return npub;
}

// ---------------------------------------------------------------------------
// DRY localStorage helpers
//
// Single place for "read / write / remove with a swallowed try/catch", plus typed
// store objects for the highest-volume keys (relay URLs, map view, map renderer,
// notifications-enabled). Direct localStorage access is still used for niche
// one-off keys; consolidate further if any of those grow more call sites.
// ---------------------------------------------------------------------------

/** Read a string from localStorage; returns '' if missing or unavailable. */
export function lsGet(key) {
    try { return (typeof localStorage !== 'undefined' && localStorage.getItem(key)) || ''; }
    catch (_) { return ''; }
}

/** Write a string to localStorage; no-op on failure. */
export function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
}

/** Remove a key from localStorage; no-op on failure. */
export function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
}

/** Relay URL list — newline-separated string, normalized to wss/ws-only. */
export const relayUrlsStore = {
    KEY: 'relay_urls',
    read() {
        const raw = lsGet(this.KEY);
        if (!raw) return [];
        return raw.split('\n').map((s) => s.trim()).filter(Boolean);
    },
    write(urls) {
        const list = Array.isArray(urls) ? urls.map((s) => String(s || '').trim()).filter(Boolean) : [];
        if (list.length) lsSet(this.KEY, list.join('\n'));
        else lsRemove(this.KEY);
    },
    clear() { lsRemove(this.KEY); },
};

/** Map viewport persistence (center as [lng,lat], integer zoom). */
export const mapViewStore = {
    CENTER_KEY: 'map_center',
    ZOOM_KEY: 'map_zoom',
    readCenter() {
        try {
            const raw = lsGet(this.CENTER_KEY);
            if (!raw) return null;
            const v = JSON.parse(raw);
            if (!Array.isArray(v) || v.length !== 2) return null;
            const [lng, lat] = v;
            if (typeof lng !== 'number' || typeof lat !== 'number') return null;
            return [lng, lat];
        } catch (_) { return null; }
    },
    readZoom() {
        const raw = lsGet(this.ZOOM_KEY);
        if (!raw) return null;
        const z = parseFloat(raw);
        return Number.isFinite(z) ? z : null;
    },
    writeCenter(lng, lat) { lsSet(this.CENTER_KEY, JSON.stringify([lng, lat])); },
    writeZoom(zoom) { lsSet(this.ZOOM_KEY, String(zoom)); },
};

/** Active map renderer ('maplibre' | 'leaflet' | ''). */
export const mapRendererStore = {
    KEY: 'nr-web.mapRenderer',
    read() { return lsGet(this.KEY).toLowerCase(); },
    write(value) { lsSet(this.KEY, String(value || '').toLowerCase()); },
};

/** Notifications opt-in toggle (boolean stored as 'true'/'false'). */
export const notificationsEnabledStore = {
    KEY: 'notifications_enabled',
    read() { return lsGet(this.KEY) === 'true'; },
    write(enabled) { lsSet(this.KEY, enabled ? 'true' : 'false'); },
};

/**
 * Expiration setting (seconds) shared by map (EXPIRATION_SETTING_KEY) and chat
 * (NR_EXPIRATION_STORAGE_KEY) — same string, so consolidate to a single store.
 */
export const expirationSecondsStore = {
    KEY: 'nostroots_expiration_seconds',
    read() {
        const raw = lsGet(this.KEY);
        if (!raw) return null;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
    },
    write(seconds) { lsSet(this.KEY, String(seconds)); },
};

/** Diagnostic-only nsec for the nip42 test page; never used in production flows. */
export const NIP42_TEST_NSEC_KEY = 'nip42test.nsec';

/**
 * Run `fn` and swallow any thrown error, returning `fallback` instead.
 * Replaces the very common `try { fn(); } catch (_) {}` and `try { return fn(); } catch (_) { return X; }`
 * boilerplate.
 */
export function safe(fn, fallback) {
    try { return fn(); } catch (_) { return fallback; }
}

/**
 * Tiny modal helper: `modal('keys-modal').open()` / `.close()`.
 * Replaces `el.classList.add('active')` / `remove('active')` boilerplate at modal toggle sites.
 */
export function modal(id) {
    const el = (typeof document !== 'undefined') ? document.getElementById(id) : null;
    return {
        el,
        open() { if (el) el.classList.add('active'); },
        close() { if (el) el.classList.remove('active'); },
        isOpen() { return !!(el && el.classList.contains('active')); },
    };
}

/** Same string as legacy localStorage keys; values live in IndexedDB after migrate. */
const NOTIFICATION_PLUS_CODES_KEY = NR_WEB_KV_KEYS.NOTIFICATION_PLUS_CODES;
const CLAIM_SIGN_STORAGE_KEY = NR_WEB_KV_KEYS.CLAIM_SIGN_DONE;

let _nrKvNotificationCodes = null;
let _nrKvClaimSignAll = null;
let _nrKvHydratePromise = null;

function readNotificationPlusCodesSnapshot() {
    try {
        const raw = localStorage.getItem(NOTIFICATION_PLUS_CODES_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function writeNotificationPlusCodesSnapshot(codes) {
    try {
        const safeCodes = Array.isArray(codes) ? codes : [];
        localStorage.setItem(NOTIFICATION_PLUS_CODES_KEY, JSON.stringify(safeCodes));
    } catch (_) {}
}

function ensureNrWebKvPrefsHydrated() {
    if (!hasNrWebKvStorage()) return Promise.resolve(undefined);
    if (!_nrKvHydratePromise) {
        _nrKvHydratePromise = hydrateNrWebKvPrefsStorage().catch((err) => {
            console.warn('nr-web KV (IndexedDB) hydrate failed:', err);
            _nrKvHydratePromise = null;
            return undefined;
        });
    }
    return _nrKvHydratePromise;
}

async function hydrateNrWebKvPrefsStorage() {
    let codes = await nrWebKvGet(NR_WEB_KV_KEYS.NOTIFICATION_PLUS_CODES);
    if (codes !== undefined && Array.isArray(codes)) {
        _nrKvNotificationCodes = codes;
        writeNotificationPlusCodesSnapshot(codes);
    } else {
        let migrated = [];
        if (_nrKvNotificationCodes !== null && Array.isArray(_nrKvNotificationCodes)) {
            migrated = _nrKvNotificationCodes;
        } else {
            migrated = readNotificationPlusCodesSnapshot();
            if (!Array.isArray(migrated)) migrated = [];
            _nrKvNotificationCodes = migrated;
        }
        await nrWebKvPut(NR_WEB_KV_KEYS.NOTIFICATION_PLUS_CODES, migrated);
        writeNotificationPlusCodesSnapshot(migrated);
    }
    if (document.getElementById('settings-modal')?.classList.contains('active')) {
        renderSettingsNotificationsSection();
    }

    let all = await nrWebKvGet(NR_WEB_KV_KEYS.CLAIM_SIGN_DONE);
    if (all !== undefined && all && typeof all === 'object' && !Array.isArray(all)) {
        _nrKvClaimSignAll = all;
    } else {
        let migratedClaims = {};
        if (_nrKvClaimSignAll !== null && typeof _nrKvClaimSignAll === 'object' && !Array.isArray(_nrKvClaimSignAll)) {
            migratedClaims = _nrKvClaimSignAll;
        } else {
            try {
                const raw = localStorage.getItem(CLAIM_SIGN_STORAGE_KEY);
                migratedClaims = raw ? JSON.parse(raw) : {};
            } catch (_) {
                migratedClaims = {};
            }
            if (!migratedClaims || typeof migratedClaims !== 'object' || Array.isArray(migratedClaims)) {
                migratedClaims = {};
            }
            _nrKvClaimSignAll = migratedClaims;
        }
        await nrWebKvPut(NR_WEB_KV_KEYS.CLAIM_SIGN_DONE, migratedClaims);
    }
    try {
        localStorage.removeItem(CLAIM_SIGN_STORAGE_KEY);
    } catch (_) {}
}

void ensureNrWebKvPrefsHydrated();

// NDK is not loaded from CDN due to CORS/MIME type issues
// We use nostr-tools Relay directly instead, which works reliably
const NDK = null;

// Constants from nr-common
const MAP_NOTE_KIND = 30397;
const MAP_NOTE_REPOST_KIND = 30398;
const PROFILE_CLAIM_KIND = 30390;
const HOST_CLAIM_KIND = 30391;
const RELATIONSHIP_CLAIM_KIND = 30392;
const EXPERIENCE_CLAIM_KIND = 30393;
const THREAD_UPVOTE_METRIC_KIND = 30394;
const FOLLOW_LIST_KIND = 3;
const TRUSTROOTS_CONTACT_SET_KIND = 30000;
const TRUSTROOTS_CIRCLE_MEMBERSHIP_KIND = 30001;
const TRUSTROOTS_CIRCLE_MEMBERSHIP_D_TAG = 'trustroots-circles';
const NIP32_LABEL_KIND = 1985;
const MAP_NOTE_KINDS = [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND];
const DELETION_KIND = 5; // NIP-05: Deletion events
const TRUSTROOTS_PROFILE_KIND = 10390;
// TRUSTROOTS_USERNAME_LABEL_NAMESPACE comes from folded claim-utils.js block above.
const DEFAULT_RELAY_URL = 'wss://nip42.trustroots.org';
const DEFAULT_RELAYS = (window.NrWebRelaySettings?.getDefaultRelays?.() || ['wss://nip42.trustroots.org', 'wss://relay.trustroots.org', 'wss://relay.nomadwiki.org']);
const DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH = 2;

// ---------------------------------------------------------------------------
// Shared event-kind/filter helpers
// ---------------------------------------------------------------------------

export function getMapNoteKinds() {
    return MAP_NOTE_KINDS.slice();
}

export function getProfileMetadataKinds() {
    return [0, TRUSTROOTS_PROFILE_KIND];
}

export function getProfileLookupKinds() {
    return [0, PROFILE_CLAIM_KIND, TRUSTROOTS_PROFILE_KIND];
}

export function getMapRelayReadKinds() {
    return [0, DELETION_KIND, TRUSTROOTS_PROFILE_KIND, PROFILE_CLAIM_KIND, ...MAP_NOTE_KINDS];
}

export function buildMapNoteFilter(extra = {}) {
    return { kinds: getMapNoteKinds(), ...extra };
}

export function buildLimitedMapNoteFilter(extra = {}) {
    return buildMapNoteFilter({ limit: 10000, ...extra });
}

export function buildMapRelayReadFilter(extra = {}) {
    return { kinds: getMapRelayReadKinds(), ...extra };
}

export function buildMapRelayKeepAliveFilter() {
    return buildMapRelayReadFilter({ limit: 1 });
}

export function buildProfileLookupFilter(authors, extra = {}) {
    const filter = { kinds: getProfileLookupKinds(), ...extra };
    if (authors !== undefined) filter.authors = authors;
    return filter;
}

export function buildProfileMetadataFilter(authors, extra = {}) {
    const filter = { kinds: getProfileMetadataKinds(), ...extra };
    if (authors !== undefined) filter.authors = authors;
    return filter;
}

/**
 * Compute engagement KPIs from in-memory note events.
 * Counts map notes and host mirrors only (kinds 30397/30398).
 */
export function computeHeaderKpiCounts(eventsList, nowTimestamp = Math.round(Date.now() / 1000)) {
    const source = Array.isArray(eventsList) ? eventsList : [];
    const windowStart = Number(nowTimestamp) - 24 * 60 * 60;
    let notesLoaded = 0;
    let newNotes24h = 0;
    for (const event of source) {
        if (!event || !MAP_NOTE_KINDS.includes(event.kind)) continue;
        notesLoaded += 1;
        const createdAt = Number(event.created_at);
        if (Number.isFinite(createdAt) && createdAt >= windowStart) newNotes24h += 1;
    }
    return { notesLoaded, newNotes24h };
}

const STATS_FEATURED_INTENT_IDS = ['hosting', 'lookingforhost', 'wanttomeet'];
const STATS_RECENT_IDENTITY_WINDOW_SECONDS = 30 * 24 * 60 * 60;
const STATS_TREND_WEEK_COUNT = 8;

function dedupeStatsEvents(eventsList) {
    const byId = new Map();
    for (const event of Array.isArray(eventsList) ? eventsList : []) {
        if (!event || typeof event !== 'object') continue;
        const id = String(event.id || '');
        if (!id) continue;
        const prev = byId.get(id);
        if (!prev || Number(event.created_at || 0) >= Number(prev.created_at || 0)) {
            byId.set(id, event);
        }
    }
    return [...byId.values()];
}

function trustrootsUsernameFromStatsEvent(event) {
    if (!event || typeof event !== 'object') return '';
    if (event.kind === TRUSTROOTS_PROFILE_KIND) {
        return getTrustrootsUsernameFromProfileEvent(event) || '';
    }
    if (event.kind === 0 && event.content) {
        try {
            const profile = JSON.parse(String(event.content || '{}'));
            const nip05 = String(profile?.nip05 || '').trim().toLowerCase();
            if (isTrustrootsNip05Lower(nip05)) return nip05.split('@')[0] || '';
        } catch (_) {}
    }
    if (event.kind === PROFILE_CLAIM_KIND) {
        const tagged = (event.tags || []).find(
            (tag) =>
                Array.isArray(tag) &&
                tag[0] === 'l' &&
                tag[1] &&
                String(tag[2] || '').toLowerCase() === TRUSTROOTS_USERNAME_LABEL_NAMESPACE
        );
        if (tagged?.[1]) return String(tagged[1]).trim().toLowerCase();
        try {
            const payload = JSON.parse(String(event.content || '{}'));
            const direct = String(payload?.trustrootsUsername || payload?.username || payload?.name || '').trim().toLowerCase();
            if (direct) return direct;
            const nip05 = String(payload?.nip05 || '').trim().toLowerCase();
            if (isTrustrootsNip05Lower(nip05)) return nip05.split('@')[0] || '';
        } catch (_) {}
    }
    return '';
}

function trustrootsIdentityPubkeysFromStatsEvent(event) {
    const out = new Set();
    const author = normalizeCachedPubkeyHex(event?.pubkey);
    if (event?.kind === 0 || event?.kind === TRUSTROOTS_PROFILE_KIND) {
        if (author && trustrootsUsernameFromStatsEvent(event)) out.add(author);
    } else if (event?.kind === PROFILE_CLAIM_KIND) {
        const pTags = listHexPubkeyPTags(event.tags);
        pTags.forEach((hex) => out.add(hex));
        if (!pTags.length && author) out.add(author);
    }
    return out;
}

function timestampWithin(ts, nowTimestamp, seconds) {
    const n = Number(ts || 0);
    return Number.isFinite(n) && n > 0 && n >= Number(nowTimestamp || 0) - seconds;
}

function formatStatsTrendLabel(weekIndexFromOldest) {
    const weeksAgo = STATS_TREND_WEEK_COUNT - 1 - weekIndexFromOldest;
    if (weeksAgo <= 0) return 'now';
    return `${weeksAgo}w`;
}

export function buildStatsSnapshotFromEvents(eventsList, options = {}) {
    const nowTimestamp = Number(options.nowTimestamp || Math.round(Date.now() / 1000));
    const source = dedupeStatsEvents(eventsList);
    const identityPubkeys = new Set();
    const linkedUsernames = new Set();
    const identityFirstSeen = new Map();
    const activePosters = new Set();
    const activeAreas = new Set();
    const claimParticipants = new Set();
    const topCircleCounts = new Map();
    const intentCounts = Object.fromEntries(STATS_FEATURED_INTENT_IDS.map((id) => [id, 0]));
    const weeklyTrend = Array.from({ length: STATS_TREND_WEEK_COUNT }, (_, i) => ({
        label: formatStatsTrendLabel(i),
        count: 0,
    }));
    const weekWindowStart = nowTimestamp - STATS_TREND_WEEK_COUNT * 7 * 24 * 60 * 60;
    let importedProfileClaims = 0;
    let totalNotes = 0;
    let hostMirrors = 0;
    let notes24h = 0;
    let notes7d = 0;
    let notes30d = 0;
    let relationshipClaims = 0;
    let experienceReferences = 0;
    let threadUpvoteMetrics = 0;
    let circleDirectoryCount = 0;
    let latestEventAt = 0;

    function rememberIdentity(hex, username, createdAt) {
        const h = normalizeCachedPubkeyHex(hex);
        if (!h) return;
        identityPubkeys.add(h);
        if (username) linkedUsernames.add(String(username).trim().toLowerCase());
        const ts = Number(createdAt || 0);
        if (Number.isFinite(ts) && ts > 0) {
            const prev = identityFirstSeen.get(h);
            if (!prev || ts < prev) identityFirstSeen.set(h, ts);
        }
    }

    for (const event of source) {
        if (typeof NrBlocklist !== 'undefined' && NrBlocklist?.isBlocked && NrBlocklist.isBlocked(event.pubkey)) continue;
        const createdAt = Number(event.created_at || 0);
        if (Number.isFinite(createdAt) && createdAt > latestEventAt) latestEventAt = createdAt;

        const username = trustrootsUsernameFromStatsEvent(event);
        for (const hex of trustrootsIdentityPubkeysFromStatsEvent(event)) {
            rememberIdentity(hex, username, createdAt);
        }
        if (username) linkedUsernames.add(String(username).trim().toLowerCase());
        if (event.kind === PROFILE_CLAIM_KIND) importedProfileClaims += 1;

        if (MAP_NOTE_KINDS.includes(event.kind)) {
            totalNotes += 1;
            if (event.kind === MAP_NOTE_REPOST_KIND) hostMirrors += 1;
            const author = normalizeCachedPubkeyHex(event.pubkey);
            if (author) activePosters.add(author);
            const plusCode = getPlusCodeFromEvent(event);
            if (plusCode) activeAreas.add(plusCode);
            if (timestampWithin(createdAt, nowTimestamp, 24 * 60 * 60)) notes24h += 1;
            if (timestampWithin(createdAt, nowTimestamp, 7 * 24 * 60 * 60)) notes7d += 1;
            if (timestampWithin(createdAt, nowTimestamp, 30 * 24 * 60 * 60)) notes30d += 1;
            if (createdAt >= weekWindowStart && createdAt <= nowTimestamp) {
                const idx = Math.min(
                    STATS_TREND_WEEK_COUNT - 1,
                    Math.max(0, Math.floor((createdAt - weekWindowStart) / (7 * 24 * 60 * 60)))
                );
                weeklyTrend[idx].count += 1;
            }
            const intentId = detectNoteIntent(event);
            if (Object.prototype.hasOwnProperty.call(intentCounts, intentId)) {
                intentCounts[intentId] += 1;
            }
        }

        if (event.kind === RELATIONSHIP_CLAIM_KIND) relationshipClaims += 1;
        if (event.kind === EXPERIENCE_CLAIM_KIND) experienceReferences += 1;
        if (event.kind === THREAD_UPVOTE_METRIC_KIND) threadUpvoteMetrics += 1;
        if ([RELATIONSHIP_CLAIM_KIND, EXPERIENCE_CLAIM_KIND, THREAD_UPVOTE_METRIC_KIND].includes(event.kind)) {
            listHexPubkeyPTags(event.tags).forEach((hex) => claimParticipants.add(hex));
        }
        if (event.kind === TRUSTROOTS_CIRCLE_META_KIND) circleDirectoryCount += 1;
        if (event.kind === PROFILE_CLAIM_KIND || event.kind === MAP_NOTE_REPOST_KIND || event.kind === TRUSTROOTS_CIRCLE_META_KIND) {
            for (const slug of extractTrustrootsCircleSlugsFromEventTags(event)) {
                topCircleCounts.set(slug, (topCircleCounts.get(slug) || 0) + 1);
            }
        }
    }

    const recentNewIdentities = [...identityFirstSeen.values()].filter((ts) =>
        timestampWithin(ts, nowTimestamp, STATS_RECENT_IDENTITY_WINDOW_SECONDS)
    ).length;
    const topCircles = [...topCircleCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 6)
        .map(([slug, count]) => ({ slug, count }));
    return {
        generatedAt: Number(options.generatedAt || Date.now()),
        observedEvents: source.length,
        identity: {
            observedTrustrootsIdentities: identityPubkeys.size,
            linkedTrustrootsUsernames: linkedUsernames.size,
            importedProfileClaims,
            recentNewIdentities,
        },
        hostMeet: {
            totalNotes,
            hostMirrors,
            notes24h,
            notes7d,
            notes30d,
            activePosters: activePosters.size,
            activeAreas: activeAreas.size,
            weeklyTrend,
        },
        intents: STATS_FEATURED_INTENT_IDS.map((id) => ({
            id,
            label: getIntentById(id)?.label || id,
            count: intentCounts[id] || 0,
        })),
        community: {
            relationshipClaims,
            experienceReferences,
            threadUpvoteMetrics,
            uniqueClaimParticipants: claimParticipants.size,
        },
        circles: {
            circleDirectoryCount,
            topCircles,
        },
        relays: {
            online: Math.max(0, Number(options.relaysConnected || 0)),
            total: Math.max(0, Number(options.relaysTotal || 0)),
            contributing: Math.max(0, Number(options.contributingRelays || 0)),
            latestEventAt,
        },
    };
}

export function formatHeaderRelaysOnlineKpi(connectedCount, totalCount) {
    const connected = Math.max(0, Number(connectedCount) || 0);
    const total = Math.max(0, Number(totalCount) || 0);
    return `${connected}/${total}`;
}

export function getHeaderRelayStatusClass(connectedCount, totalCount, isHydrated = true) {
    const connected = Math.max(0, Number(connectedCount) || 0);
    const total = Math.max(0, Number(totalCount) || 0);
    if (!isHydrated || total === 0) return '';
    if (connected === 0) return 'is-error';
    if (connected < total) return 'is-warn';
    return '';
}

export function getHeaderKpiKeysForViewport(isCompact) {
    if (isCompact) return ['newNotes24h', 'relaysOnline'];
    return ['newNotes24h', 'notesLoaded', 'subscribedAreas', 'relaysOnline'];
}

let nrChatBooted = false;
let nrChatBootPromise = null;
function ensureChatEmbeddedReady() {
    if (nrChatBooted) return Promise.resolve();
    if (nrChatBootPromise) return nrChatBootPromise;
    nrChatBootPromise = Promise.resolve()
        .then(() => bootEmbeddedChat())
        .then(() => {
            nrChatBooted = true;
        })
        .catch((err) => {
            nrChatBootPromise = null;
            nrChatBooted = false;
            console.warn('[nr-web] embedded chat boot failed', err);
        });
    return nrChatBootPromise;
}

// Decode blocklist npubs to hex (shared blocklist in common.js)
if (typeof NrBlocklist !== 'undefined' && NrBlocklist.BLOCKLIST_NPUBS && nip19) {
    const blocklistHex = NrBlocklist.BLOCKLIST_NPUBS.map((n) => {
        return npubToHex(n) || null;
    }).filter(Boolean);
    NrBlocklist.setBlocklistHex(blocklistHex);
}

/** Normalize relay error message for display (e.g. "Error: error: internal error" -> "internal error"). */
function formatRelayError(errorStr) {
    if (!errorStr || typeof errorStr !== 'string') return '';
    const s = errorStr.replace(/^Error:\s*/i, '').trim();
    return s.replace(/^error:\s*/i, '').trim() || s;
}
function isTrustrootsProfileMissingRelayError(errorStr) {
    const normalized = (errorStr || '').toLowerCase();
    return normalized.includes('restricted') && normalized.includes('no trustroots username profile event found');
}
function markRelaysWithPublishFailures(failed) {
    failed.forEach((failure) => {
        if (!failure?.url) return;
        if (isTrustrootsProfileMissingRelayError(failure.error)) {
            const canWrite = relayWriteEnabled.get(failure.url) !== false;
            updateRelayStatus(failure.url, 'error', canWrite);
        }
    });
}
/** If any failure is a relay "internal error", return a short user hint. */
function getRelayPublishFailureHint(failed) {
    const hasProfileMissingRestriction = failed.some(f => isTrustrootsProfileMissingRelayError(f.error));
    const hasInternalError = failed.some(f => (f.error || '').toLowerCase().includes('internal error'));
    if (hasProfileMissingRestriction) {
        return '';
    }
    return hasInternalError
        ? ' Try again in a moment—relay errors are often temporary.'
        : '';
}

const RELAY_PUBLISH_RETRIES = 2;
const RELAY_PUBLISH_RETRY_DELAY_MS = 1500;
const NIP42_AUTH_KIND = 22242;

function extractNip42Challenge(payload) {
    if (typeof payload === 'string') {
        const value = payload.trim();
        return value || '';
    }
    if (Array.isArray(payload)) {
        if (typeof payload[1] === 'string') {
            const fromSecond = payload[1].trim();
            if (fromSecond) return fromSecond;
        }
        if (typeof payload[0] === 'string' && payload[0] !== 'AUTH') {
            const fromFirst = payload[0].trim();
            if (fromFirst) return fromFirst;
        }
    }
    if (payload && typeof payload === 'object') {
        const nested = payload.challenge;
        if (typeof nested === 'string') {
            const value = nested.trim();
            return value || '';
        }
        if (payload.data && typeof payload.data.challenge === 'string') {
            const nestedData = payload.data.challenge.trim();
            return nestedData || '';
        }
    }
    return '';
}

function isAuthRequiredError(errorMessage) {
    return (errorMessage || '').toLowerCase().includes('auth-required');
}

async function signEventTemplate(eventTemplate) {
    if (nrWebNip7Signer.isActiveForPubkey(currentPublicKey)) {
        const identityOk = await ensureNip7IdentityIsCurrent('sign event');
        if (!identityOk) throw new Error('NIP-07 identity changed; reconnect required.');
        return nrWebNip7Signer.signEvent(eventTemplate, currentPublicKey);
    }
    if (currentPrivateKeyBytes) {
        const eventToSign = eventTemplate?.pubkey ? eventTemplate : { ...eventTemplate, pubkey: currentPublicKey };
        return finalizeEvent(eventToSign, currentPrivateKeyBytes);
    }
    throw new Error('No signing method available for relay authentication');
}

function hasRelayAuthSigningCapability() {
    return !!currentPrivateKeyBytes || nrWebNip7Signer.isActiveForPubkey(currentPublicKey);
}

function getNip7StatusText() {
    const caps = nrWebNip7Signer.getCapabilities();
    if (nrWebNip7Signer.isActiveForPubkey(currentPublicKey)) {
        return 'Using NIP-07 browser extension.';
    }
    if (caps.isFull) return 'NIP-07 browser extension support detected.';
    if (caps.hasProvider) return 'NIP-07 extension detected, but encrypted messaging support is incomplete.';
    return 'No NIP-07 browser extension detected. Compatible extensions include Alby and nos2x.';
}

async function buildSignedAuthEvent(relayUrl, challenge) {
    const resolvedChallenge = extractNip42Challenge(challenge);
    if (!resolvedChallenge) {
        throw new Error('Missing NIP-42 challenge');
    }
    const authTemplate = {
        kind: NIP42_AUTH_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['relay', relayUrl],
            ['challenge', resolvedChallenge]
        ],
        content: ''
    };
    const signedAuth = await signEventTemplate(authTemplate);
    if (!signedAuth || !signedAuth.id) {
        throw new Error('Invalid signed AUTH event');
    }
    return signedAuth;
}

async function authenticateRelay(relay, relayUrl, challenge) {
    const signedAuth = await buildSignedAuthEvent(relayUrl, challenge);
    if (!relay || typeof relay.auth !== 'function') {
        throw new Error('Relay auth API unavailable');
    }
    // nostr-tools relay.auth API shape differs by version; support both common forms.
    try {
        await relay.auth(async () => signedAuth);
        return;
    } catch (_) {}
    await relay.auth(signedAuth);
}

/**
 * One-shot REQ to a single relay. Subscribes, collects events via `onEvent`, closes
 * on EOSE or after `waitMs`. Always closes the subscription and relay socket.
 * Errors and EOSE timeouts resolve quietly so callers can wrap in `Promise.allSettled`.
 */
async function oneshotQuery(url, filter, { onEvent, waitMs = 2000 } = {}) {
    if (isRestrictedRelayUrl(url)) return;
    let relay = null;
    let sub = null;
    try {
        relay = await Relay.connect(url);
        await new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                try { sub?.close(); } catch (_) {}
                try { relay?.close(); } catch (_) {}
                resolve();
            };
            const filters = Array.isArray(filter) ? filter : [filter];
            sub = relay.subscribe(filters, {
                onevent: (event) => { try { onEvent?.(event); } catch (_) {} },
                oneose: finish,
            });
            setTimeout(finish, waitMs);
        });
    } catch (_) {
        try { sub?.close?.(); } catch (_) {}
        try { relay?.close?.(); } catch (_) {}
    }
}

async function publishToRelayViaRawWebSocket(url, signedEvent) {
    return await new Promise((resolve) => {
        let settled = false;
        let ws = null;
        let authError = null;
        let authEventId = null;
        let authSucceeded = false;
        let pendingEventRejectedForAuth = false;
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                try { ws?.close(); } catch (_) {}
                resolve({ success: false, url, error: 'timeout waiting for relay response' });
            }
        }, 10000);

        const finish = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            try { ws?.close(); } catch (_) {}
            resolve(result);
        };

        const sendEvent = () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            ws.send(JSON.stringify(['EVENT', signedEvent]));
        };

        try {
            ws = new WebSocket(url);
        } catch (e) {
            finish({ success: false, url, error: e?.message || String(e) });
            return;
        }

        ws.addEventListener('open', () => {
            // Try immediate publish first. NIP-42 relay will challenge if auth is needed.
            sendEvent();
        });

        ws.addEventListener('message', async (msg) => {
            let data;
            try {
                data = JSON.parse(msg.data);
            } catch (_) {
                return;
            }
            const [type, a, b, c] = data;
            if (type === 'AUTH') {
                try {
                    const challenge = extractNip42Challenge(a);
                    if (!challenge) throw new Error('Missing NIP-42 challenge');
                    const authTemplate = {
                        kind: NIP42_AUTH_KIND,
                        created_at: Math.floor(Date.now() / 1000),
                        tags: [
                            ['relay', url],
                            ['challenge', challenge]
                        ],
                        content: ''
                    };
                    const signedAuth = await signEventTemplate(authTemplate);
                    if (!signedAuth || !signedAuth.id) throw new Error('Invalid signed AUTH event');
                    authEventId = signedAuth.id;
                    ws.send(JSON.stringify(['AUTH', signedAuth]));
                } catch (e) {
                    authError = e?.message || String(e);
                    finish({ success: false, url, error: authError });
                }
                return;
            }

            if (type === 'OK' && a === signedEvent.id) {
                if (b === true) {
                    finish({ success: true, url });
                } else {
                    const msgText = (c || '').toString();
                    const isAuthRequired = msgText.toLowerCase().includes('auth-required');
                    if (isAuthRequired && !authSucceeded) {
                        // Relay rejected event before auth completed; wait for AUTH handshake.
                        pendingEventRejectedForAuth = true;
                        return;
                    }
                    finish({ success: false, url, error: c || authError || 'relay rejected event' });
                }
                return;
            }

            if (type === 'OK' && authEventId && a === authEventId) {
                if (b === true) {
                    authSucceeded = true;
                    // If EVENT was already rejected due to auth-required, retry now.
                    if (pendingEventRejectedForAuth) {
                        pendingEventRejectedForAuth = false;
                        sendEvent();
                    } else {
                        // Also send once after successful auth in case no prior rejection arrived yet.
                        sendEvent();
                    }
                } else {
                    const reason = c || authError || 'relay rejected auth event';
                    finish({ success: false, url, error: reason });
                }
                return;
            }
        });

        ws.addEventListener('error', () => {
            finish({ success: false, url, error: authError || 'websocket error' });
        });
    });
}

function setupRelayAuthHandler(relay, relayUrl, options = {}) {
    let latestChallenge = null;
    let latestAuthPromise = null;
    const authHandler = async (challenge) => {
        latestChallenge = challenge;
        try {
            const resolvedChallenge = extractNip42Challenge(challenge);
            if (!resolvedChallenge) {
                throw new Error('Missing NIP-42 challenge');
            }
            latestAuthPromise = buildSignedAuthEvent(relayUrl, resolvedChallenge);
            const signedAuth = await latestAuthPromise;
            if (typeof options.onAuthenticated === 'function') {
                options.onAuthenticated();
            }
            return signedAuth;
        } catch (error) {
            const errorMessage = error?.message || String(error);
            console.error(`[Relay] NIP-42 auth failed for ${relayUrl}:`, errorMessage);
            throw error;
        }
    };
    
    // nostr-tools relay APIs differ across versions:
    // some expose relay.on('auth', ...), others expose relay.onauth callback.
    if ('onauth' in relay) {
        relay.onauth = authHandler;
    } else if (typeof relay?.on === 'function') {
        relay.on('auth', authHandler);
    }
    
    return {
        getLatestChallenge: () => latestChallenge,
        waitForAuth: async (timeoutMs = 500) => {
            if (!latestAuthPromise) return false;
            try {
                await Promise.race([
                    latestAuthPromise,
                    new Promise(resolve => setTimeout(resolve, timeoutMs))
                ]);
            } catch (_) {
                // auth failure is handled by caller and logs above
            }
            return true;
        }
    };
}

/** Publish event to one relay with retries. Returns { success, url, error }. */
async function publishToRelayWithRetries(url, signedEvent) {
    if (isRestrictedRelayUrl(url)) {
        return await publishToRelayViaRawWebSocket(url, signedEvent);
    }
    let lastError = null;
    for (let attempt = 0; attempt <= RELAY_PUBLISH_RETRIES; attempt++) {
        let relay = null;
        let authState = null;
        let usingSharedRelay = false;
        try {
            // Prefer existing long-lived relay connection. This avoids NIP-42
            // auth race conditions on freshly-opened sockets during publish.
            const sharedRelay = relays.find(r => r && r.url === url);
            if (sharedRelay) {
                relay = sharedRelay;
                usingSharedRelay = true;
            } else {
                relay = await Relay.connect(url);
                authState = setupRelayAuthHandler(relay, url);
                // Give relay a brief moment to emit AUTH challenge and complete auth.
                await authState.waitForAuth(500);
            }
            await relay.publish(signedEvent);
            await new Promise(resolve => setTimeout(resolve, 500));
            return { success: true, url };
        } catch (error) {
            lastError = error?.message || String(error);
            if (relay && isAuthRequiredError(lastError)) {
                try {
                    // Challenge may arrive just after initial publish attempt.
                    await authState?.waitForAuth?.(800);
                    const latestChallenge = authState?.getLatestChallenge?.();
                    if (latestChallenge) {
                        await authenticateRelay(relay, url, latestChallenge);
                    }
                    await relay.publish(signedEvent);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return { success: true, url };
                } catch (authError) {
                    lastError = authError?.message || String(authError);
                    const wsResult = await publishToRelayViaRawWebSocket(url, signedEvent);
                    if (wsResult.success) {
                        return wsResult;
                    }
                    lastError = wsResult.error || lastError;
                }
            }
            if (attempt < RELAY_PUBLISH_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RELAY_PUBLISH_RETRY_DELAY_MS));
            }
        } finally {
            if (relay && !usingSharedRelay) {
                try { relay.close(); } catch (_) {}
            }
        }
    }
    return { success: false, url, error: lastError };
}

const NOSTROOTS_VALIDATION_PUBKEY = 'f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b';
const DEV_PUBKEY = '80789235a71a388074abfa5c482e270456d2357425266270f82071cf2b1de74a';
const TRUSTROOTS_RESTRICTED_RELAY_URL = 'wss://nip42.trustroots.org';
const TRUSTROOTS_CIRCLE_LABEL = 'trustroots-circle';

// Map to store pubkey -> Trustroots username (kind 10390 label)
const pubkeyToUsername = new Map();
/** Pubkey hex -> lowercase Trustroots NIP-05 (kind 0 nip05 or kind 30390 import). */
const pubkeyToNip05 = new Map();
/** Pubkey hex -> profile picture URL (kind 0 and 30390). */
const pubkeyToPicture = new Map();
/** Lowercase hex pubkeys with an in-flight relay profile fetch (npub mentions in map notes). */
const mentionProfilePrefetchInFlight = new Set();
/** Lowercase hex pubkeys already requested for Trust card person metadata this page load. */
const trustCardProfilePrefetchAttempted = new Set();

/** Display name: Trustroots username/NIP-05 if known, else npub. Never hex. */
export function buildProfileDisplayLabel(hex, opts = {}) {
    const trUser = String(opts.trustrootsUsername || '').trim();
    const nip05 = String(opts.nip05 || '').trim();
    let full = '';
    if (trUser) {
        full = trUser.includes('@') ? trUser : `${trUser}@trustroots.org`;
    } else if (nip05) {
        full = nip05;
    } else {
        const h = normalizeCachedPubkeyHex(hex) || String(hex || '').trim().toLowerCase();
        full = hexToNpub(h) || '';
    }
    if (!opts.short) return full;
    if (!full) return '';
    if (full.includes('@') && full.length <= 32) return full;
    if (full.length <= 20) return full;
    return full.slice(0, 12) + '…' + full.slice(-8);
}

function getDisplayName(hex) {
    if (!hex) return '';
    return buildProfileDisplayLabel(hex, {
        trustrootsUsername: pubkeyToUsername.get(hex),
        nip05: pubkeyToNip05.get(hex),
    });
}

/** Short display name for compact UI/title contexts. */
function getDisplayNameShort(hex) {
    return buildProfileDisplayLabel(hex, {
        trustrootsUsername: pubkeyToUsername.get(hex),
        nip05: pubkeyToNip05.get(hex),
        short: true,
    });
}

export function sanitizeProfileImageUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
        const u = new URL(raw, 'https://nos.trustroots.org');
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
        return u.href;
    } catch (_) {
        return '';
    }
}

/** Shared nip42 relay classifier used by map/chat/profile flows. */
export function isTrustrootsAuthRelayUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return false;
    try {
        const parsed = new URL(raw);
        return String(parsed.hostname || '').toLowerCase() === 'nip42.trustroots.org';
    } catch (_) {
        return /(^|:\/\/|\.)nip42\.trustroots\.org(?=[:/]|$)/i.test(raw);
    }
}

/** Location hash segment encoding (keep literal '+' for readability). */
export function hashEncodeSegment(segment) {
    return encodeURIComponent(String(segment ?? '')).replace(/%2B/g, '+');
}

/** Build `#profile/<encoded-id>` from npub/hex/nip05 style identifiers. */
export function buildProfileHashRoute(profileId) {
    return '#profile/' + hashEncodeSegment(profileId);
}

export function extractTrustrootsCircleSlugsFromEventTags(event) {
    if (!event) return [];
    const seen = new Set();
    const out = [];
    for (const tag of event.tags || []) {
        if (!Array.isArray(tag) || tag.length < 3) continue;
        if (tag[0] !== 'l' || tag[2] !== TRUSTROOTS_CIRCLE_LABEL) continue;
        const slug = canonicalTrustrootsCircleSlugKey(tag[1]);
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        out.push(slug);
    }
    return out;
}

export function extractCircleSlugsFromProfileClaim30390Event(event) {
    if (!event || event.kind !== PROFILE_CLAIM_KIND) return [];
    return extractTrustrootsCircleSlugsFromEventTags(event);
}

function expectedPubkeyAuthorSet(opts = {}) {
    const expectedPubkeys = new Set();
    const expectedPubkey = normalizeCachedPubkeyHex(opts.expectedPubkey);
    if (expectedPubkey) expectedPubkeys.add(expectedPubkey);
    if (Array.isArray(opts.expectedPubkeys)) {
        for (const candidate of opts.expectedPubkeys) {
            const normalized = normalizeCachedPubkeyHex(candidate);
            if (normalized) expectedPubkeys.add(normalized);
        }
    }
    return expectedPubkeys;
}

function eventAuthorMatchesExpectedPubkeys(event, opts = {}) {
    const expectedPubkeys = expectedPubkeyAuthorSet(opts);
    if (!expectedPubkeys.size) return true;
    const author = String(event?.pubkey || '').trim().toLowerCase();
    return expectedPubkeys.has(author);
}

function trustrootsUsernameFromEventTags(tags) {
    for (const tag of tags || []) {
        if (!Array.isArray(tag) || tag.length < 2) continue;
        if (tag[0] === 'trustroots' && tag[1]) return String(tag[1]).trim().toLowerCase();
        if (tag[0] === 'l' && tag[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE && tag[1]) {
            return String(tag[1]).trim().toLowerCase();
        }
    }
    const linkPath = (tags || []).find((tag) => Array.isArray(tag) && tag[0] === 'linkPath' && tag[1])?.[1] || '';
    const pathMatch = String(linkPath).match(/\/profile\/([^/?#]+)/i);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).trim().toLowerCase();
    const linkLabel = (tags || []).find((tag) => Array.isArray(tag) && tag[0] === 'linkLabel' && tag[1])?.[1] || '';
    const labelMatch = String(linkLabel).match(/@([a-zA-Z0-9_.-]+)/);
    return labelMatch?.[1] ? labelMatch[1].trim().toLowerCase() : '';
}

function trustrootsImportToolPubkeyHexFromWindow() {
    try {
        return normalizeCachedPubkeyHex(window?.NrWebTrustrootsCircleMeta?.IMPORT_TOOL_PUBKEY_HEX);
    } catch (_) {
        return '';
    }
}

export function parseCircleMemberProfileClaim30390(event, circleSlug, opts = {}) {
    if (!event || event.kind !== PROFILE_CLAIM_KIND) return null;
    if (!eventAuthorMatchesExpectedPubkeys(event, opts)) return null;
    const slugKey = canonicalTrustrootsCircleSlugKey(circleSlug);
    if (!slugKey) return null;
    const slugs = extractCircleSlugsFromProfileClaim30390Event(event);
    if (!slugs.includes(slugKey)) return null;
    const pTags = eventPTagsHexSet(event);
    if (!pTags.size) return null;
    const pubkey = [...pTags][0];
    let meta = {};
    try {
        meta = JSON.parse(String(event.content || '{}'));
    } catch (_) {
        meta = {};
    }
    const trustrootsUsername = String(meta.trustrootsUsername || '').trim().toLowerCase();
    const nip05 = String(meta.nip05 || '').trim().toLowerCase();
    const displayName = String(meta.display_name || meta.displayName || meta.name || trustrootsUsername || '').trim();
    const picture = sanitizeProfileImageUrl(meta.picture);
    const npub = hexToNpub(pubkey) || '';
    const profileId = trustrootsUsername
        ? `${trustrootsUsername}@trustroots.org`
        : (isTrustrootsNip05Lower(nip05) ? nip05 : (npub || pubkey));
    return {
        pubkey,
        npub,
        trustrootsUsername,
        nip05,
        displayName,
        picture,
        profileId,
        slugs,
        created_at: Number(event.created_at || 0) || 0,
        eventId: String(event.id || ''),
    };
}

export function parseCircleMemberMapNoteClaimEvent(event, circleSlug, opts = {}) {
    if (!event) return null;
    if (!eventAuthorMatchesExpectedPubkeys(event, opts)) return null;
    const slugKey = canonicalTrustrootsCircleSlugKey(circleSlug);
    if (!slugKey) return null;
    const tagSlugs = extractTrustrootsCircleSlugsFromEventTags(event);
    const acceptedSlugs = Array.isArray(opts.acceptedSlugs)
        ? opts.acceptedSlugs.map((slug) => canonicalTrustrootsCircleSlugKey(slug)).filter(Boolean)
        : [];
    const eventKind = MAP_NOTE_KINDS.includes(event.kind)
        ? event.kind
        : (acceptedSlugs.length ? MAP_NOTE_KIND : 0);
    if (!MAP_NOTE_KINDS.includes(eventKind)) return null;
    if (eventKind === MAP_NOTE_REPOST_KIND && !hasClaimTagValue(event.tags, 'claimable', 'true')) return null;
    if (!tagSlugs.includes(slugKey) && !acceptedSlugs.includes(slugKey)) return null;
    const slugs = tagSlugs.includes(slugKey)
        ? tagSlugs
        : [slugKey, ...tagSlugs.filter((slug) => slug !== slugKey)];
    const pTags = eventPTagsHexSet(event);
    const author = normalizeCachedPubkeyHex(event.pubkey);
    const pubkey = pTags.size ? [...pTags][0] : (eventKind === MAP_NOTE_KIND ? author : '');
    if (!pubkey) return null;
    const trustrootsUsername = trustrootsUsernameFromEventTags(event.tags || []);
    const isKnownNostrootsAuthor =
        pubkey === normalizeCachedPubkeyHex(NOSTROOTS_VALIDATION_PUBKEY) ||
        pubkey === trustrootsImportToolPubkeyHexFromWindow();
    const resolvedTrustrootsUsername = trustrootsUsername || (isKnownNostrootsAuthor ? 'nostroots' : '');
    const npub = hexToNpub(pubkey) || '';
    const profileId = resolvedTrustrootsUsername ? `${resolvedTrustrootsUsername}@trustroots.org` : (npub || pubkey);
    return {
        pubkey,
        npub,
        trustrootsUsername: resolvedTrustrootsUsername,
        nip05: resolvedTrustrootsUsername ? `${resolvedTrustrootsUsername}@trustroots.org` : '',
        displayName: resolvedTrustrootsUsername,
        picture: '',
        profileId,
        slugs,
        created_at: Number(event.created_at || 0) || 0,
        eventId: String(event.id || ''),
    };
}

export function sortCircleMembersForDisplay(members) {
    const byPubkey = new Map();
    for (const member of members || []) {
        const pubkey = normalizeCachedPubkeyHex(member?.pubkey);
        if (!pubkey) continue;
        const prev = byPubkey.get(pubkey);
        if (!prev || Number(member.created_at || 0) >= Number(prev.created_at || 0)) {
            byPubkey.set(pubkey, { ...member, pubkey });
        }
    }
    return [...byPubkey.values()].sort((a, b) => {
        const aName = String(a.trustrootsUsername || a.nip05 || a.displayName || a.npub || a.pubkey).toLowerCase();
        const bName = String(b.trustrootsUsername || b.nip05 || b.displayName || b.npub || b.pubkey).toLowerCase();
        return aName.localeCompare(bName) || String(a.pubkey).localeCompare(String(b.pubkey));
    });
}

export function filterCircleMembersForDisplay(members, query) {
    const q = String(query || '').trim().toLowerCase();
    const sorted = sortCircleMembersForDisplay(members);
    if (!q) return sorted;
    return sorted.filter((member) => {
        const haystack = [
            member.displayName,
            member.trustrootsUsername,
            member.nip05,
            member.npub,
            member.pubkey,
        ].map((v) => String(v || '').toLowerCase());
        return haystack.some((v) => v.includes(q));
    });
}

/** Build `#<encoded-segment>` for generic hash routes (chat/map plus-code). */
function hashRouteFromSegment(segment) {
    return '#' + hashEncodeSegment(segment);
}

function formatNostrootsTitle(context) {
    const c = String(context || '').trim();
    return c ? `Nostroots ${c}` : 'Nostroots';
}

/* NR_TITLE_ROUTER_BEGIN */
function resolveNostrootsTitleFromRouteClassification(classification) {
    function fmt(context) {
        const c2 = String(context || '').trim();
        return c2 ? `Nostroots ${c2}` : 'Nostroots';
    }
    const c = classification || { kind: 'map_home' };
    if (c.kind === 'map_home') return fmt('Map');
    if (c.kind === 'map_pluscode') return fmt(c.plusCode || 'Map');
    if (c.kind === 'modal') {
        if (c.modal === 'keys') return fmt('Keys');
        if (c.modal === 'settings') return fmt('Settings');
    }
    if (c.kind === 'reserved') {
        if (c.token === 'map') return fmt('Map');
        if (c.token === 'chat') return fmt('Chat');
        if (c.token === 'welcome' || c.token === 'start') return fmt('Welcome');
    }
    if (c.kind === 'stats') return fmt('Stats');
    if (c.kind === 'profile') return fmt(c.profileId || 'Profile');
    if (c.kind === 'profile_edit') return fmt(c.profileId ? `${c.profileId} Edit` : 'Profile Edit');
    if (c.kind === 'profile_contacts') return fmt(c.profileId ? `${c.profileId} Contacts` : 'Profile Contacts');
    if (c.kind === 'profile_invalid' || c.kind === 'profile_self') return fmt('Profile');
    if (c.kind === 'chat') return fmt('Chat');
    return fmt('');
}
/* NR_TITLE_ROUTER_END */

function applyDocumentTitle(context) {
    if (typeof document === 'undefined') return;
    document.title = formatNostrootsTitle(context);
}

function resolveChatTitleContextFromConversation(conv, id) {
    if (!conv) return 'Chat';
    const convId = String(id || conv.id || '');
    if (conv.type === 'channel') {
        return convId ? `#${convId}` : 'Chat';
    }
    if (conv.type === 'group') {
        return `Group (${conv.members?.length || 0})`;
    }
    if (convId) {
        const display = getDisplayNameShort(convId) || getDisplayName(convId) || hexToNpub(convId) || convId;
        return display || 'Chat';
    }
    return 'Chat';
}

function applyDocumentTitleForUnifiedRoute(classification) {
    const c = classification || { kind: 'map_home' };
    if (c.kind !== 'chat') {
        document.title = resolveNostrootsTitleFromRouteClassification(c);
        return;
    }
    if (c.kind === 'chat') {
        const route = String(c.chatRoute || '').trim();
        if (!route) return applyDocumentTitle('Chat');
        const resolvedId = typeof findConversationIdByRoute === 'function' ? findConversationIdByRoute(route) : '';
        if (resolvedId && typeof conversations !== 'undefined' && conversations?.get) {
            const conv = conversations.get(resolvedId);
            return applyDocumentTitle(resolveChatTitleContextFromConversation(conv, resolvedId));
        }
        if (/^[a-zA-Z0-9_-]+$/.test(route)) return applyDocumentTitle(`#${route}`);
        return applyDocumentTitle(route || 'Chat');
    }
    return applyDocumentTitle('');
}

/** Parse pubkey input (hex/npub), reject nsec private keys. */
export function parsePubkeyInputNormalized(input) {
    const s = (input || '').trim();
    if (!s) return null;
    if (/^[0-9a-f]{64}$/i.test(s)) return s.toLowerCase();
    try {
        const decoded = nip19.decode(s);
        if (decoded.type === 'nsec') return null;
    } catch (_) {}
    return npubToHex(s) || null;
}

function isTrustrootsNip05Lower(s) {
    const n = String(s || '').trim().toLowerCase();
    return n.endsWith('@trustroots.org') || n.endsWith('@www.trustroots.org');
}

function ingestTrustrootsNip05FromKind0(event) {
    if (!event || event.kind !== 0 || !event.pubkey || !event.content) return;
    let meta = {};
    try {
        meta = JSON.parse(event.content);
    } catch (_) {
        return;
    }
    const pic = sanitizeProfileImageUrl(meta.picture);
    if (pic) {
        const pk = String(event.pubkey || '').toLowerCase();
        pubkeyToPicture.set(pk, pic);
        window.NrWeb?.rememberNrNavAccountAvatar?.(pk, pic);
    }
    if (
        pic &&
        currentPublicKey &&
        String(event.pubkey || '').toLowerCase() === String(currentPublicKey).toLowerCase()
    ) {
        try {
            applyNrNavAccountAvatarForActiveSurface();
        } catch (_) {}
    }
    const nip05 = String(meta.nip05 || '').trim().toLowerCase();
    if (nip05 && isTrustrootsNip05Lower(nip05)) {
        pubkeyToNip05.set(event.pubkey, nip05);
    }
    scheduleCacheWrite();
}

function ingestTrustrootsNip05From30390(event) {
    if (!event || event.kind !== PROFILE_CLAIM_KIND || !event.content) return;
    const pTags = (event.tags || []).filter((t) => Array.isArray(t) && t[0] === 'p' && t[1]);
    const byTag = pTags.length ? String(pTags[0][1]).trim().toLowerCase() : '';
    const byAuthor = String(event.pubkey || '').trim().toLowerCase();
    const subjectHex = /^[0-9a-f]{64}$/.test(byTag)
        ? byTag
        : /^[0-9a-f]{64}$/.test(byAuthor)
            ? byAuthor
            : '';
    if (!subjectHex) return;
    let meta = {};
    try {
        meta = JSON.parse(event.content);
    } catch (_) {
        return;
    }
    const nip05 = String(meta.nip05 || '').trim().toLowerCase();
    if (nip05 && isTrustrootsNip05Lower(nip05)) pubkeyToNip05.set(subjectHex, nip05);
    const tru = String(meta.trustrootsUsername || '').trim().toLowerCase();
    if (tru) pubkeyToUsername.set(subjectHex, tru);
    const pic = sanitizeProfileImageUrl(meta.picture);
    if (pic) {
        pubkeyToPicture.set(subjectHex, pic);
        window.NrWeb?.rememberNrNavAccountAvatar?.(subjectHex, pic);
    }
    if (pic && currentPublicKey && subjectHex === String(currentPublicKey).toLowerCase()) {
        try {
            applyNrNavAccountAvatarForActiveSurface();
        } catch (_) {}
    }
    scheduleCacheWrite();
}

const MAP_LAYERS = {
    trustroots: {
        title: 'Trustroots',
        filter: { kinds: MAP_NOTE_KINDS },
        kind: MAP_NOTE_KIND,
        // Reserved for future filtering/display context; getLayerForEvent currently keys on filter.kinds/authors.
        pubkey: NOSTROOTS_VALIDATION_PUBKEY,
        markerColor: 'green',
        rectangleColor: 'grey'
    }
};

// Global state
let ndk = null;
let relays = [];
/** Bumped on each relay pool reconnect so overlapping inits cannot inflate `relays` or status toasts. */
let relayConnectGeneration = 0;
let relayKeepAliveIntervalIds = [];
let wsMapSubscriptions = [];
const RELAY_FAILURE_TOAST_GRACE_MS = 15000;
let relayFailureToastTimeoutId = null;

function closeRelaysArray(list) {
    (list || []).forEach((r) => {
        try { r?.close?.(); } catch (_) {}
    });
}

function clearRelayFailureToastTimeout() {
    if (relayFailureToastTimeoutId === null) return;
    try { clearTimeout(relayFailureToastTimeoutId); } catch (_) {}
    relayFailureToastTimeoutId = null;
}

function getConnectedRelayCount(relayUrls) {
    return (relayUrls || []).reduce((count, url) => (
        relayStatus.get(url)?.status === 'connected' ? count + 1 : count
    ), 0);
}
let map = null;
let mapFallbackMode = null;
let leafletGridLayer = null;
let leafPolygonOpenAt = 0;
let markers = [];
let events = [];
let claimEventsByKind = new Map();
let claimSuggestionsDebounce = null;
let selectedPlusCode = null;
let lastHostPlusCode = null;
let lastChatRoute = null;
let selectedCircle = null; // Selected Trustroots circle slug
let selectedIntent = null; // Selected map-note intent (see note-intents.js)
const NR_WEB_LAST_INTENT_KEY = 'nr-web.lastIntent';

function getClaimKinds() {
    return [PROFILE_CLAIM_KIND, HOST_CLAIM_KIND, RELATIONSHIP_CLAIM_KIND, EXPERIENCE_CLAIM_KIND, THREAD_UPVOTE_METRIC_KIND];
}

function getClaimKindBucket(kind) {
    if (!claimEventsByKind.has(kind)) claimEventsByKind.set(kind, []);
    return claimEventsByKind.get(kind);
}

function hasPTarget(event, pubkey) {
    if (!event || !Array.isArray(event.tags) || !pubkey) return false;
    return event.tags.some(tag => Array.isArray(tag) && tag[0] === 'p' && tag[1] && tag[1].toLowerCase() === pubkey.toLowerCase());
}

function upsertClaimEvent(event) {
    if (!event || !currentPublicKey || !hasPTarget(event, currentPublicKey)) return;
    const accepted =
        getClaimKinds().includes(event.kind) ||
        event.kind === MAP_NOTE_REPOST_KIND;
    if (!accepted) return;
    const bucketKind = event.kind === MAP_NOTE_REPOST_KIND ? HOST_CLAIM_KIND : event.kind;
    const bucket = getClaimKindBucket(bucketKind);
    const idx = bucket.findIndex(e => e.id === event.id);
    if (idx >= 0) {
        bucket[idx] = event;
    } else {
        bucket.push(event);
    }
    renderClaimSummary();
}

function closeWsMapSubscriptions() {
    wsMapSubscriptions.forEach((sub) => {
        try { sub?.close?.(); } catch (_) {}
    });
    wsMapSubscriptions = [];
}

// Restricted relay reads use raw WebSocket + NIP-42 to avoid nostr-tools auth
// callback shape differences. Public relays still use nostr-tools Relay below.

function startWsMapSubscriptions(relayUrls) {
    const relayAuth = window.NrWebRelayAuth;
    if (!relayAuth?.startNip42WsSubscription) return;
    closeWsMapSubscriptions();
    relayUrls.filter((url) => isRestrictedRelayUrl(url)).forEach((url) => {
        try {
            const sub = relayAuth.startNip42WsSubscription({
                relayUrl: url,
                filter: buildMapRelayReadFilter({ limit: 10000 }),
                authPubkey: currentPublicKey,
                signEvent: async (eventTemplate) => signEventTemplate(eventTemplate),
                onEvent: (event) => {
                    if (event) {
                        processIncomingEvent(event);
                    }
                },
                onAuthChallenge: () => updateRelayStatus(url, 'connecting', relayWriteEnabled.get(url) !== false),
                onAuthSuccess: () => updateRelayStatus(url, 'connected', relayWriteEnabled.get(url) !== false),
                onAuthFail: () => updateRelayStatus(url, 'error', relayWriteEnabled.get(url) !== false),
                onOpen: () => updateRelayStatus(url, 'connecting', relayWriteEnabled.get(url) !== false),
                onError: () => updateRelayStatus(url, 'error', relayWriteEnabled.get(url) !== false)
            });
            wsMapSubscriptions.push(sub);
        } catch (error) {
            console.error(`[Map WS] Failed to subscribe ${url}:`, error?.message || error);
        }
    });
}

function getHashRoute() {
    const h = location.hash.slice(1);
    if (!h) return '';
    try { return decodeURIComponent(h); } catch (_) { return h; }
}
let nrPreviousHashRoute = null;
let nrCurrentHashRoute = getHashRoute();

function setHashRoute(route) {
    const encoded = route ? encodeURIComponent(route).replace(/%2B/g, '+') : '';
    const want = encoded ? '#' + encoded : '';
    if (location.hash !== want) location.hash = want;
}
function replaceHashRoute(route) {
    const encoded = route ? encodeURIComponent(route).replace(/%2B/g, '+') : '';
    const want = encoded ? '#' + encoded : '';
    if (location.hash === want) return;
    try {
        history.replaceState({}, '', location.pathname + location.search + want);
    } catch (_) {
        location.hash = want;
    }
}

export function classifyNostrootsSetupState(state = {}) {
    const hasKey = state.hasKey === true;
    const hasTrustrootsNip05 = state.hasTrustrootsNip05 === true;
    if (!hasKey) return 'no_key';
    return hasTrustrootsNip05 ? 'ready' : 'key_without_trustroots';
}

function rememberHashRouteTransition() {
    const next = getHashRoute();
    if (next === nrCurrentHashRoute) return;
    nrPreviousHashRoute = nrCurrentHashRoute;
    nrCurrentHashRoute = next;
}
function isHostSurfaceOpen() {
    return !!document.body?.classList?.contains('nr-surface-host');
}

function rememberLastHostPlusCode(plusCode) {
    const value = String(plusCode || '').trim().toUpperCase();
    if (!value) return;
    lastHostPlusCode = value;
    try {
        sessionStorage.setItem('nr-web.lastHostPlusCode', value);
    } catch (_) {}
}

function getLastHostPlusCode() {
    if (lastHostPlusCode) return lastHostPlusCode;
    try {
        const stored = sessionStorage.getItem('nr-web.lastHostPlusCode');
        if (stored) {
            lastHostPlusCode = String(stored).trim().toUpperCase();
            return lastHostPlusCode;
        }
    } catch (_) {}
    return '';
}

function normalizeRememberedChatRoute(route) {
    const value = String(route || '').trim();
    if (!value || value.toLowerCase() === 'chat') return '';
    try {
        const H = window.NrWebHashRouter;
        const c = H && typeof H.classify === 'function' ? H.classify(value) : null;
        if (c && c.kind !== 'chat') return '';
    } catch (_) {}
    return value;
}

function rememberLastChatRoute(route) {
    const value = normalizeRememberedChatRoute(route);
    if (!value) return;
    lastChatRoute = value;
    try {
        sessionStorage.setItem('nr-web.lastChatRoute', value);
    } catch (_) {}
}

function getLastChatRoute() {
    if (lastChatRoute) return lastChatRoute;
    try {
        const stored = normalizeRememberedChatRoute(sessionStorage.getItem('nr-web.lastChatRoute'));
        if (stored) {
            lastChatRoute = stored;
            return lastChatRoute;
        }
    } catch (_) {}
    return '';
}

window.NrWebGetLastChatRoute = getLastChatRoute;

function showAreaSurface() {
    const mapView = document.getElementById('map-view');
    const chatView = document.getElementById('nr-chat-view');
    const profileView = document.getElementById('nr-profile-view');
    const statsView = document.getElementById('nr-stats-view');
    const hostView = document.getElementById('nr-host-view');
    const keysPage = document.getElementById('keys-modal');
    const settingsPage = document.getElementById('settings-modal');

    document.body.classList.remove('nr-surface-chat');
    document.body.classList.remove('nr-surface-profile');
    document.body.classList.remove('nr-surface-stats');
    document.body.classList.remove('nr-surface-account');
    document.body.classList.add('nr-surface-host');
    document.body.classList.remove('chat-open');

    if (mapView) mapView.style.display = 'none';
    if (chatView) {
        chatView.hidden = true;
        chatView.style.display = 'none';
    }
    if (profileView) {
        profileView.hidden = true;
        profileView.style.display = 'none';
    }
    if (statsView) {
        statsView.hidden = true;
        statsView.style.display = 'none';
    }
    if (hostView) {
        hostView.hidden = false;
        hostView.style.display = 'flex';
    }
    if (keysPage) keysPage.classList.remove('active');
    if (settingsPage) settingsPage.classList.remove('active');
    try {
        if (window.NrWeb && typeof window.NrWeb.fillAppHeader === 'function') {
            window.NrWeb.fillAppHeader();
        }
    } catch (_) {}
}
function legacyApplyMapHashToState(route) {
    const keysEl = document.getElementById('keys-modal');
    const settingsEl = document.getElementById('settings-modal');
    if (route === 'keys') {
        if (settingsEl) settingsEl.classList.remove('active');
        closePlusCodeNotesModal(true);
        openKeysModal();
        return;
    }
    if (route === 'settings') {
        if (keysEl) keysEl.classList.remove('active');
        closePlusCodeNotesModal(true);
        openSettingsModal();
        return;
    }
    if (route === 'start') {
        replaceHashRoute('welcome');
        if (settingsEl) settingsEl.classList.remove('active');
        closePlusCodeNotesModal(true);
        openKeysModal({ route: 'welcome' });
        return;
    }
    if (route === 'welcome') {
        if (settingsEl) settingsEl.classList.remove('active');
        closePlusCodeNotesModal(true);
        openKeysModal({ route: 'welcome' });
        return;
    }
    if (route) {
        if (keysEl) keysEl.classList.remove('active');
        if (settingsEl) settingsEl.classList.remove('active');
        showNotesForPlusCode(route);
        return;
    }
    if (keysEl) keysEl.classList.remove('active');
    if (settingsEl) settingsEl.classList.remove('active');
    closePlusCodeNotesModal();
}

async function applyUnifiedHash() {
    const H = window.NrWebHashRouter;
    const route = H && typeof H.getHashRoute === 'function' ? H.getHashRoute() : getHashRoute();
    if (!H || typeof H.classify !== 'function') {
        legacyApplyMapHashToState(route);
        return;
    }
    const c = H.classify(route);
    applyDocumentTitleForUnifiedRoute(c);
    const mapView = document.getElementById('map-view');
    const chatView = document.getElementById('nr-chat-view');
    const profileView = document.getElementById('nr-profile-view');
    const statsView = document.getElementById('nr-stats-view');
    const hostView = document.getElementById('nr-host-view');
    const keysPage = document.getElementById('keys-modal');
    const settingsPage = document.getElementById('settings-modal');

    let claimsSectionRestoreAnchor = null;
    let claimsTrustPanelRestoreAnchor = null;

    function restoreClaimTrustPanelToKeysModal() {
        const panel = document.getElementById('keys-claim-trust-panel');
        const slot = document.getElementById('nr-profile-trust-claim-slot');
        const section = document.getElementById('keys-claim-section');
        if (!panel || !section) return;
        if (!slot?.contains(panel) && section.contains(panel)) return;
        if (claimsTrustPanelRestoreAnchor) {
            const { parent, next } = claimsTrustPanelRestoreAnchor;
            if (parent && parent.isConnected) {
                if (next && next.parentNode === parent) parent.insertBefore(panel, next);
                else parent.appendChild(panel);
            } else {
                const details = document.getElementById('claim-details');
                if (details && details.parentElement === section) section.insertBefore(panel, details);
                else section.appendChild(panel);
            }
            claimsTrustPanelRestoreAnchor = null;
        } else {
            const details = document.getElementById('claim-details');
            if (details && details.parentElement === section) section.insertBefore(panel, details);
            else section.appendChild(panel);
        }
        if (typeof renderClaimSummary === 'function') renderClaimSummary();
    }

    function mountClaimTrustPanelToProfileTrustTab() {
        const panel = document.getElementById('keys-claim-trust-panel');
        const slot = document.getElementById('nr-profile-trust-claim-slot');
        if (!panel || !slot) return;
        if (!claimsTrustPanelRestoreAnchor) {
            claimsTrustPanelRestoreAnchor = { parent: panel.parentElement, next: panel.nextSibling };
        }
        window.NrWebClaimsUiSurface = 'profile';
        slot.appendChild(panel);
        if (typeof renderClaimSummary === 'function') renderClaimSummary();
        if (typeof refreshClaimSuggestions === 'function') void refreshClaimSuggestions({ silent: true });
    }

    function restoreClaimsSectionFromKeysModal() {
        window.NrWebClaimsUiSurface = 'keys';
        const sec = document.getElementById('keys-claim-section');
        if (!sec || !claimsSectionRestoreAnchor) return;
        const parent = claimsSectionRestoreAnchor.parent;
        const next = claimsSectionRestoreAnchor.next;
        if (parent) {
            if (next && next.parentNode === parent) parent.insertBefore(sec, next);
            else parent.appendChild(sec);
        }
        claimsSectionRestoreAnchor = null;
        const keysModal = document.getElementById('keys-modal');
        if (!keysModal || !keysModal.classList.contains('active')) sec.style.display = 'none';
        if (typeof renderClaimSummary === 'function') renderClaimSummary();
    }

    function restoreAllClaimsProfileUi() {
        restoreClaimTrustPanelToKeysModal();
        restoreClaimsSectionFromKeysModal();
    }

    function mountClaimsSectionToProfileRoot() {
        restoreClaimTrustPanelToKeysModal();
        const sec = document.getElementById('keys-claim-section');
        const root = document.getElementById('nr-profile-root');
        if (!sec || !root) return;
        if (!claimsSectionRestoreAnchor) {
            claimsSectionRestoreAnchor = { parent: sec.parentElement, next: sec.nextSibling };
        }
        window.NrWebClaimsUiSurface = 'profile';
        root.appendChild(sec);
        sec.style.display = 'block';
        if (typeof renderClaimSummary === 'function') renderClaimSummary();
        if (typeof refreshClaimSuggestions === 'function') void refreshClaimSuggestions({ silent: true });
    }
    window.NrWebMountClaimTrustrootsSection = mountClaimsSectionToProfileRoot;
    window.NrWebMountClaimTrustrootsTrustTab = mountClaimTrustPanelToProfileTrustTab;
    window.NrWebUnmountClaimTrustrootsSection = restoreAllClaimsProfileUi;

    function hideAccountShell() {
        if (keysPage) keysPage.classList.remove('active');
        if (settingsPage) settingsPage.classList.remove('active');
    }
    function hideAreaShell() {
        document.body.classList.remove('nr-surface-host');
        if (hostView) {
            hostView.hidden = true;
            hostView.style.display = 'none';
        }
    }
    function showMapShell() {
        restoreAllClaimsProfileUi();
        document.body.classList.remove('nr-surface-chat');
        document.body.classList.remove('nr-surface-profile');
        document.body.classList.remove('nr-surface-stats');
        document.body.classList.remove('nr-surface-account');
        hideAreaShell();
        hideAccountShell();
        if (profileView) {
            profileView.hidden = true;
            profileView.style.display = 'none';
        }
        if (statsView) {
            statsView.hidden = true;
            statsView.style.display = 'none';
        }
        if (mapView) mapView.style.display = '';
        if (chatView) {
            chatView.hidden = true;
            chatView.style.display = 'none';
        }
        if (hostView) {
            hostView.hidden = true;
            hostView.style.display = 'none';
        }
        try {
            if (window.NrWeb && typeof window.NrWeb.fillAppHeader === 'function') {
                window.NrWeb.fillAppHeader();
            }
        } catch (_) {}
    }
    function showChatShell() {
        restoreAllClaimsProfileUi();
        document.body.classList.remove('nr-surface-profile');
        document.body.classList.remove('nr-surface-stats');
        document.body.classList.remove('nr-surface-account');
        hideAreaShell();
        hideAccountShell();
        if (profileView) {
            profileView.hidden = true;
            profileView.style.display = 'none';
        }
        if (statsView) {
            statsView.hidden = true;
            statsView.style.display = 'none';
        }
        document.body.classList.add('nr-surface-chat');
        if (mapView) mapView.style.display = 'none';
        if (chatView) {
            chatView.hidden = false;
            chatView.style.display = 'flex';
        }
        if (hostView) {
            hostView.hidden = true;
            hostView.style.display = 'none';
        }
        try {
            if (window.NrWeb && typeof window.NrWeb.fillAppHeader === 'function') {
                window.NrWeb.fillAppHeader();
            }
        } catch (_) {}
    }
    async function callProfileRenderer(kind, profileId) {
        // Router bootstrap can run before profile exports are initialized.
        // Yield once so module evaluation completes and exports are ready.
        await Promise.resolve();
        if (kind === 'invalid') return renderInvalidProfile(profileId);
        if (kind === 'contacts') return renderProfileContacts(profileId);
        if (kind === 'edit') return renderProfileEdit(profileId);
        return renderPublicProfile(profileId);
    }
    async function showProfileShell(profileId, invalid, mode) {
        const m = mode || 'public';
        if (m !== 'contacts') restoreAllClaimsProfileUi();
        document.body.classList.remove('nr-surface-chat');
        document.body.classList.remove('nr-surface-stats');
        document.body.classList.remove('nr-surface-account');
        hideAreaShell();
        document.body.classList.add('nr-surface-profile');
        hideAccountShell();
        if (mapView) mapView.style.display = 'none';
        if (chatView) {
            chatView.hidden = true;
            chatView.style.display = 'none';
        }
        if (profileView) {
            profileView.hidden = false;
            profileView.style.display = 'flex';
        }
        if (statsView) {
            statsView.hidden = true;
            statsView.style.display = 'none';
        }
        if (hostView) {
            hostView.hidden = true;
            hostView.style.display = 'none';
        }
        try {
            if (window.NrWeb && typeof window.NrWeb.fillAppHeader === 'function') {
                window.NrWeb.fillAppHeader();
            }
        } catch (_) {}
        if (invalid) {
            void callProfileRenderer('invalid', profileId);
            return;
        }
        if (m === 'contacts') {
            void callProfileRenderer('contacts', profileId);
            return;
        }
        if (m === 'edit') {
            void callProfileRenderer('edit', profileId);
            return;
        }
        void callProfileRenderer('public', profileId);
    }
    function showAccountShell(activePage) {
        restoreAllClaimsProfileUi();
        document.body.classList.remove('nr-surface-chat');
        document.body.classList.remove('nr-surface-profile');
        document.body.classList.remove('nr-surface-stats');
        hideAreaShell();
        document.body.classList.add('nr-surface-account');
        if (mapView) mapView.style.display = 'none';
        if (chatView) {
            chatView.hidden = true;
            chatView.style.display = 'none';
        }
        if (profileView) {
            profileView.hidden = true;
            profileView.style.display = 'none';
        }
        if (statsView) {
            statsView.hidden = true;
            statsView.style.display = 'none';
        }
        if (hostView) {
            hostView.hidden = true;
            hostView.style.display = 'none';
        }
        if (keysPage) keysPage.classList.toggle('active', activePage === 'keys');
        if (settingsPage) settingsPage.classList.toggle('active', activePage === 'settings');
        try {
            if (window.NrWeb && typeof window.NrWeb.fillAppHeader === 'function') {
                window.NrWeb.fillAppHeader();
            }
        } catch (_) {}
    }
    function showStatsShell() {
        restoreAllClaimsProfileUi();
        document.body.classList.remove('nr-surface-chat');
        document.body.classList.remove('nr-surface-profile');
        document.body.classList.remove('nr-surface-account');
        hideAreaShell();
        hideAccountShell();
        document.body.classList.add('nr-surface-stats');
        if (mapView) mapView.style.display = 'none';
        if (chatView) {
            chatView.hidden = true;
            chatView.style.display = 'none';
        }
        if (profileView) {
            profileView.hidden = true;
            profileView.style.display = 'none';
        }
        if (statsView) {
            statsView.hidden = false;
            statsView.style.display = 'flex';
        }
        if (hostView) {
            hostView.hidden = true;
            hostView.style.display = 'none';
        }
        try {
            if (window.NrWeb && typeof window.NrWeb.fillAppHeader === 'function') {
                window.NrWeb.fillAppHeader();
            }
        } catch (_) {}
        void renderStatsPage();
    }
    function shouldShowNoKeyWelcomeOverlay(classifiedRoute) {
        if (getCurrentNostrootsSetupState() !== 'no_key') return false;
        if (!classifiedRoute) return false;
        if (classifiedRoute.kind === 'stats') return false;
        if (classifiedRoute.kind === 'modal' && classifiedRoute.modal === 'keys') return false;
        if (classifiedRoute.kind === 'reserved' && (classifiedRoute.token === 'welcome' || classifiedRoute.token === 'start')) return false;
        if (classifiedRoute.kind === 'map_home' && !location.hash) return false;
        return true;
    }
    function maybeShowNoKeyWelcomeOverlay(classifiedRoute) {
        if (!shouldShowNoKeyWelcomeOverlay(classifiedRoute)) return;
        openKeysModal({ route: 'welcome', preserveRoute: true });
        updateKeyDisplay({ skipProfileLookup: true });
    }

    if (c.kind === 'map_home') {
        showMapShell();
        closePlusCodeNotesModal(true);
        maybeShowNoKeyWelcomeOverlay(c);
        return;
    }
    if (c.kind === 'modal') {
        closePlusCodeNotesModal(true);
        if (c.modal === 'keys') {
            showAccountShell('keys');
            openKeysModal({ route: 'keys' });
        } else if (c.modal === 'settings') {
            showAccountShell('settings');
            if (c.section === 'relays') {
                openRelaysSettingsModal();
            } else {
                openSettingsModal();
            }
        }
        maybeShowNoKeyWelcomeOverlay(c);
        return;
    }
    if (c.kind === 'reserved') {
        if (c.token === 'map') {
            showMapShell();
            closePlusCodeNotesModal(true);
            if (location.hash) {
                try {
                    history.replaceState({}, '', location.pathname + location.search);
                } catch (_) {}
            }
            maybeShowNoKeyWelcomeOverlay(c);
            return;
        }
        if (c.token === 'chat') {
            await ensureChatEmbeddedReady();
            showChatShell();
            closePlusCodeNotesModal(true);
            await applyEmbeddedChatRoute('', { emptyPicker: true });
            maybeShowNoKeyWelcomeOverlay(c);
            return;
        }
        if (c.token === 'help') {
            showMapShell();
            if (typeof openHelpModal === 'function') openHelpModal();
            maybeShowNoKeyWelcomeOverlay(c);
            return;
        }
        if (c.token === 'start') {
            replaceHashRoute('welcome');
            showAccountShell('keys');
            closePlusCodeNotesModal(true);
            openKeysModal({ route: 'welcome' });
            return;
        }
        if (c.token === 'welcome') {
            showAccountShell('keys');
            closePlusCodeNotesModal(true);
            openKeysModal({ route: 'welcome' });
            return;
        }
        showMapShell();
        maybeShowNoKeyWelcomeOverlay(c);
        return;
    }
    if (c.kind === 'map_pluscode') {
        const pNorm = normalizePlusCodeForHashSuppress(c.plusCode);
        if (nrMapPlusCodeSuppressedUntil && nrMapPlusCodeSuppressedUntil === pNorm) {
            nrMapPlusCodeSuppressedUntil = null;
            return;
        }
        showNotesForPlusCode(c.plusCode);
        maybeShowNoKeyWelcomeOverlay(c);
        return;
    }
    if (c.kind === 'profile' || c.kind === 'profile_edit' || c.kind === 'profile_contacts' || c.kind === 'profile_invalid' || c.kind === 'profile_self') {
        closePlusCodeNotesModal(true);
        if (c.kind === 'profile_self') {
            if (!currentPublicKey) {
                showMapShell();
                openKeysModal({ route: 'welcome', preserveRoute: true });
                showStatus('Load a key first to open your profile.', 'info');
                return;
            }
            const ownProfileRoute = ownProfileHashRoute();
            if (!ownProfileRoute) {
                showMapShell();
                showStatus('Could not determine your profile route yet. Try reloading your key.', 'error');
                return;
            }
            const targetHash = '#' + ownProfileRoute;
            if (location.hash !== targetHash) {
                try {
                    location.hash = targetHash;
                } catch (_) {}
            }
            await showProfileShell(decodeURIComponent(ownProfileRoute.slice('profile/'.length)), false, 'public');
            return;
        }
        const mode = c.kind === 'profile_edit' ? 'edit' : c.kind === 'profile_contacts' ? 'contacts' : 'public';
        if (c.kind !== 'profile_invalid' && c.profileId) {
            const suffix = mode === 'edit' ? '/edit' : mode === 'contacts' ? '/contacts' : '';
            const canonicalHash = '#profile/' + hashEncodeSegment(c.profileId) + suffix;
            if (location.hash !== canonicalHash) {
                try {
                    location.hash = canonicalHash;
                } catch (_) {}
                return;
            }
        }
        await showProfileShell(c.profileId, c.kind === 'profile_invalid', mode);
        maybeShowNoKeyWelcomeOverlay(c);
        return;
    }
    if (c.kind === 'stats') {
        closePlusCodeNotesModal(true);
        showStatsShell();
        maybeShowNoKeyWelcomeOverlay(c);
        return;
    }
    if (c.kind === 'chat') {
        rememberLastChatRoute(c.chatRoute);
        await ensureChatEmbeddedReady();
        showChatShell();
        closePlusCodeNotesModal(true);
        await applyEmbeddedChatRoute(c.chatRoute, {});
        maybeShowNoKeyWelcomeOverlay(c);
    }
}

window.NrWebUnifiedNavigateToMapPlusCode = function (plusCode) {
    if (!plusCode) return;
    const enc = encodeURIComponent(plusCode).replace(/%2B/g, '+');
    try {
        location.hash = '#' + enc;
    } catch (_) {}
};

window.applyNrUnifiedHash = applyUnifiedHash;

let isDragging = false; // Track dragging state to prevent grid updates during drag
let pendingGridUpdate = false; // Track if grid update is needed after drag ends
let currentPrivateKey = null;
let currentPrivateKeyBytes = null;
let currentPublicKey = null;
let authenticatingWithExtension = false; // Guard to prevent concurrent calls
let isProfileLinked = false; // Track if profile is NIP-5 linked
let usernameFromNostr = false; // Track if username came from a Nostr event
let profileLinkCheckInFlight = null;
let profileLinkCheckLastRunAt = 0;
let nip7IdentityCheckInFlight = null;
let nip7IdentityCheckLastOkAt = 0;
let nip7IdentityCheckLastPubkey = '';
let lastIdentityMismatchNoticeAt = 0;

const NR_WEB_SIGNER_MODE_KEY = 'nr_web_signer_mode';
const NR_WEB_NIP7_PUBKEY_KEY = 'nr_web_nip7_pubkey';
const PROFILE_LINK_CHECK_COOLDOWN_MS = 2500;
const NIP7_IDENTITY_CHECK_COOLDOWN_MS = 2500;
const IDENTITY_MISMATCH_NOTICE_COOLDOWN_MS = 4000;

function getNip7Provider() {
    if (typeof window === 'undefined') return null;
    return window.nostr && typeof window.nostr === 'object' ? window.nostr : null;
}

export function inspectNip7Capabilities() {
    const provider = getNip7Provider();
    const hasProvider = !!provider;
    const hasPublicKey = typeof provider?.getPublicKey === 'function';
    const hasSignEvent = typeof provider?.signEvent === 'function';
    const hasNip44Encrypt = typeof provider?.nip44?.encrypt === 'function';
    const hasNip44Decrypt = typeof provider?.nip44?.decrypt === 'function';
    const hasNip04Decrypt = typeof provider?.nip04?.decrypt === 'function';
    const canSign = hasProvider && hasPublicKey && hasSignEvent;
    const isFull = canSign && hasNip44Encrypt && hasNip44Decrypt && hasNip04Decrypt;
    return {
        provider,
        status: isFull ? 'full' : canSign ? 'partial' : hasProvider ? 'partial' : 'none',
        hasProvider,
        hasPublicKey,
        hasSignEvent,
        hasNip44Encrypt,
        hasNip44Decrypt,
        hasNip04Decrypt,
        canSign,
        isFull
    };
}

export const nrWebNip7Signer = {
    pubkey: '',
    getCapabilities: inspectNip7Capabilities,
    async restoreFromStorage() {
        let mode = '';
        try {
            mode = localStorage.getItem(NR_WEB_SIGNER_MODE_KEY) || '';
        } catch (_) {}
        if (mode !== 'nip7') return false;
        const caps = inspectNip7Capabilities();
        if (!caps.isFull || !caps.provider || typeof caps.provider.getPublicKey !== 'function') return false;
        if (!this.pubkey) {
            try {
                const pubkey = String(await caps.provider.getPublicKey()).trim().toLowerCase();
                if (!isLikelyHexPubkey64(pubkey)) return false;
                this.pubkey = pubkey;
            } catch (_) {
                return false;
            }
        }
        return this.isActive();
    },
    isActive() {
        try {
            if (!this.pubkey) this.pubkey = String(localStorage.getItem(NR_WEB_NIP7_PUBKEY_KEY) || '').trim().toLowerCase();
            return localStorage.getItem(NR_WEB_SIGNER_MODE_KEY) === 'nip7' && isLikelyHexPubkey64(this.pubkey) && inspectNip7Capabilities().isFull;
        } catch (_) {
            return !!this.pubkey && inspectNip7Capabilities().isFull;
        }
    },
    isActiveForPubkey(pubkey) {
        return this.isActive() && !!pubkey && String(pubkey).toLowerCase() === String(this.pubkey).toLowerCase();
    },
    async warmNip7Permissions(caps, pubkey) {
        const provider = caps?.provider;
        if (!provider || !isLikelyHexPubkey64(pubkey)) return;
        const probeTemplate = {
            kind: 27235,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['client', 'nr-web'], ['purpose', 'permission-check']],
            content: 'Nostroots browser extension permission check',
            pubkey
        };
        const signedProbe = await provider.signEvent(probeTemplate);
        const signedPubkey = String(signedProbe?.pubkey || '').toLowerCase();
        if (!signedProbe?.id || !signedProbe?.sig || signedPubkey !== pubkey || signedProbe.id !== getEventHash(signedProbe)) {
            throw new Error('NIP-07 extension returned an invalid permission-check signature.');
        }
        const nip44ProbeText = 'Nostroots encrypted permission check';
        const nip44Cipher = await provider.nip44.encrypt(pubkey, nip44ProbeText);
        const nip44Plain = await provider.nip44.decrypt(pubkey, nip44Cipher);
        if (nip44Plain !== nip44ProbeText) {
            throw new Error('NIP-07 extension failed the NIP-44 permission check.');
        }
        if (typeof provider.nip04?.encrypt === 'function') {
            try {
                const nip04Cipher = await provider.nip04.encrypt(pubkey, 'Nostroots legacy DM permission check');
                await provider.nip04.decrypt(pubkey, nip04Cipher);
            } catch (_) {}
        }
    },
    async connect() {
        if (authenticatingWithExtension) {
            throw new Error('NIP-07 connection already in progress. Please wait.');
        }
        authenticatingWithExtension = true;
        try {
        const caps = inspectNip7Capabilities();
        if (!caps.hasProvider) throw new Error('No NIP-07 browser extension was detected.');
        if (!caps.isFull) {
            throw new Error('NIP-07 extension detected, but it does not expose the encrypted features Nostroots needs.');
        }
        const pubkey = String(await caps.provider.getPublicKey()).trim().toLowerCase();
        if (!isLikelyHexPubkey64(pubkey)) throw new Error('The NIP-07 extension returned an invalid public key.');
        await this.warmNip7Permissions(caps, pubkey);
        this.pubkey = pubkey;
        try {
            localStorage.setItem(NR_WEB_SIGNER_MODE_KEY, 'nip7');
            localStorage.setItem(NR_WEB_NIP7_PUBKEY_KEY, pubkey);
        } catch (_) {}
        return pubkey;
        } finally {
            authenticatingWithExtension = false;
        }
    },
    async readCurrentPubkey() {
        const caps = inspectNip7Capabilities();
        if (!caps.provider || typeof caps.provider.getPublicKey !== 'function') return '';
        const pubkey = String(await caps.provider.getPublicKey()).trim().toLowerCase();
        return isLikelyHexPubkey64(pubkey) ? pubkey : '';
    },
    useLocal() {
        try {
            localStorage.setItem(NR_WEB_SIGNER_MODE_KEY, 'local');
            localStorage.removeItem(NR_WEB_NIP7_PUBKEY_KEY);
        } catch (_) {}
        this.pubkey = '';
    },
    async signEvent(template, expectedPubkey) {
        const caps = inspectNip7Capabilities();
        if (!this.isActive() || !caps.isFull) throw new Error('NIP-07 signer is not connected.');
        const pubkey = String(expectedPubkey || this.pubkey || '').toLowerCase();
        const eventToSign = { ...(template || {}), pubkey };
        const signed = await caps.provider.signEvent(eventToSign);
        const signedPubkey = String(signed?.pubkey || '').toLowerCase();
        if (!signed || !signed.id || !signed.sig) {
            throw new Error('NIP-07 extension returned an invalid signed event.');
        }
        if (signedPubkey !== pubkey) {
            handleNip7IdentityMismatch(signedPubkey, 'sign event');
            throw new Error('Browser extension identity changed. Reconnect to continue.');
        }
        if (signed.id !== getEventHash(signed)) {
            throw new Error('NIP-07 extension returned an event with an invalid id.');
        }
        return signed;
    },
    async nip44Encrypt(peerPubkey, plaintext) {
        const caps = inspectNip7Capabilities();
        if (!this.isActive() || !caps.isFull) throw new Error('NIP-07 NIP-44 encryption is unavailable.');
        return caps.provider.nip44.encrypt(peerPubkey, plaintext);
    },
    async nip44Decrypt(peerPubkey, ciphertext) {
        const caps = inspectNip7Capabilities();
        if (!this.isActive() || !caps.isFull) throw new Error('NIP-07 NIP-44 decryption is unavailable.');
        return caps.provider.nip44.decrypt(peerPubkey, ciphertext);
    },
    async nip04Decrypt(peerPubkey, ciphertext) {
        const caps = inspectNip7Capabilities();
        if (!this.isActive() || !caps.isFull) throw new Error('NIP-07 NIP-04 decryption is unavailable.');
        return caps.provider.nip04.decrypt(peerPubkey, ciphertext);
    }
};

window.NrWebNip7 = nrWebNip7Signer;

// Caching and performance optimization state
/** @deprecated Legacy localStorage keys — removed after IndexedDB opens */
const EVENTS_CACHE_KEY = 'nostroots_events_cache';
const EVENTS_CACHE_TIMESTAMP_KEY = 'nostroots_events_cache_timestamp';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const NR_MAP_CACHE_DB_NAME = 'nostroots_map';
const NR_MAP_CACHE_DB_VERSION = 1;
const NR_MAP_CACHE_STORE = 'map_cache';
const NR_MAP_CACHE_RECORD_KEY = 'events_v1';
const NR_MAP_CACHE_PROFILES_RECORD_KEY = 'profiles_v1';
/** Max pubkey→username pairs persisted (map insertion order, newest wins when trimming). */
const PROFILE_USERNAME_CACHE_MAX_ENTRIES = 2500;
/** Per-pubkey snapshot of the events powering the public profile page (kind 0/10390/30390/notes/host mirrors). */
const NR_MAP_CACHE_PROFILE_PAGE_KEY_PREFIX = 'profile_page_v1:';
const NR_MAP_CACHE_PROFILE_PAGE_INDEX_KEY = 'profile_pages_index_v1';
const PROFILE_PAGE_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const PROFILE_PAGE_CACHE_MAX_ENTRIES = 50;
// expirationSecondsStore (module-scope) owns this key — keep the constant for legacy refs.
const EXPIRATION_SETTING_KEY = expirationSecondsStore.KEY;
let cachedFilteredEvents = null;
let filteredEventsCacheKey = null;
let localStorageWriteTimeout = null;
let gridUpdateAnimationFrame = null;
let nrMapCacheDbPromise = null;
let eventsCacheWriteSuppressed = false;
let eventsCacheSuppressLogged = false;

// Expiration constants (matching nr-app)
const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;
const WEEK_IN_SECONDS = 7 * DAY_IN_SECONDS;
const MONTH_IN_SECONDS = 30 * DAY_IN_SECONDS;
const YEAR_IN_SECONDS = 365 * DAY_IN_SECONDS;

// Spatial indexing for fast event lookups
let eventsByPlusCode = new Map(); // Map<plusCode, Set<event>>
let eventsByPlusCodePrefix = new Map(); // Map<prefix, Set<event>> for "within" queries
let rectangleCache = new Map(); // Map<plusCode, rectangle>
const MAX_GRID_FEATURES = 2000; // Limit number of grid cells rendered

// Plus Code encoding/decoding using Open Location Code algorithm
const PLUS_CODE_ALPHABET = '23456789CFGHJMPQRVWX';
const CODE_ALPHABET_LENGTH = PLUS_CODE_ALPHABET.length;
const GRID_SIZE = 20;
const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];
const LATITUDE_MAX = 90;
const LONGITUDE_MAX = 180;

// Normalize longitude to -180 to 180 range
function normalizeLongitude(lng) {
    while (lng > LONGITUDE_MAX) lng -= 360;
    while (lng < -LONGITUDE_MAX) lng += 360;
    return lng;
}

function encodePlusCode(latitude, longitude, codeLength = 10) {
    // Normalize longitude to -180 to 180 range (handles map wrapping)
    longitude = normalizeLongitude(longitude);
    
    if (latitude < -LATITUDE_MAX || latitude > LATITUDE_MAX || 
        longitude < -LONGITUDE_MAX || longitude > LONGITUDE_MAX) {
        return null;
    }
    
    // Normalize coordinates for encoding
    let lat = latitude + LATITUDE_MAX;
    let lng = longitude + LONGITUDE_MAX;
    
    let code = '';
    let resolution = 400;
    
    // Encode pairs (codeLength 2 = 1 pair, 4 = 2 pairs, etc.)
    const numPairs = Math.ceil(codeLength / 2);
    for (let i = 0; i < numPairs; i++) {
        if (i < PAIR_RESOLUTIONS.length) {
            resolution = PAIR_RESOLUTIONS[i];
        } else {
            // For pairs beyond PAIR_RESOLUTIONS, calculate resolution
            const pairIndex = i;
            resolution = PAIR_RESOLUTIONS[PAIR_RESOLUTIONS.length - 1] / Math.pow(GRID_SIZE, pairIndex - PAIR_RESOLUTIONS.length + 1);
        }
        
        const latDigit = Math.min(PLUS_CODE_ALPHABET.length - 1, Math.floor(lat / resolution));
        const lngDigit = Math.min(PLUS_CODE_ALPHABET.length - 1, Math.floor(lng / resolution));
        
        code += PLUS_CODE_ALPHABET[latDigit];
        code += PLUS_CODE_ALPHABET[lngDigit];
        
        lat -= latDigit * resolution;
        lng -= lngDigit * resolution;
    }
    
    // Pad short codes with zeros and add separator
    if (code.length < 8) {
        code = code.padEnd(8, '0');
    }
    code = code.substring(0, 8) + '+' + code.substring(8);
    
    return code;
}

function decodePlusCode(code) {
    if (!code || code.length < 2) return null;
    
    // Remove separator
    let cleanCode = code.replace('+', '').toUpperCase();
    
    let lat = -LATITUDE_MAX;
    let lng = -LONGITUDE_MAX;
    let resolution = 400;
    let lastResolution = 400;
    
    // Decode pairs - stop at zeros (padding) or end of code
    for (let i = 0; i < Math.min(cleanCode.length, 10); i += 2) {
        if (i + 1 >= cleanCode.length) break;
        
        const latChar = cleanCode[i];
        const lngChar = cleanCode[i + 1];
        
        // Stop at zeros - they indicate padding
        if (latChar === '0' || lngChar === '0') break;
        
        const latIndex = PLUS_CODE_ALPHABET.indexOf(latChar);
        const lngIndex = PLUS_CODE_ALPHABET.indexOf(lngChar);
        
        if (latIndex === -1 || lngIndex === -1) return null;
        
        if (Math.floor(i / 2) < PAIR_RESOLUTIONS.length) {
            resolution = PAIR_RESOLUTIONS[Math.floor(i / 2)];
        } else {
            // For pairs beyond PAIR_RESOLUTIONS, calculate resolution
            const pairIndex = Math.floor(i / 2);
            resolution = PAIR_RESOLUTIONS[PAIR_RESOLUTIONS.length - 1] / Math.pow(GRID_SIZE, pairIndex - PAIR_RESOLUTIONS.length + 1);
        }
        lastResolution = resolution;
        
        lat += latIndex * resolution;
        lng += lngIndex * resolution;
    }
    
    // Return center of the code area (southwest corner + half resolution)
    return { 
        latitude: lat + lastResolution / 2, 
        longitude: lng + lastResolution / 2 
    };
}

function plusCodeToRectangle(plusCode) {
    // Check cache first
    if (rectangleCache.has(plusCode)) {
        return rectangleCache.get(plusCode);
    }
    
    const decoded = decodePlusCode(plusCode);
    if (!decoded) return null;
    
    // Get the resolution for this plus code length
    // Count only significant (non-zero, non-padding) characters
    const cleanCode = plusCode.replace('+', '').toUpperCase();
    let significantLength = cleanCode.length;
    for (let i = 0; i < cleanCode.length; i++) {
        if (cleanCode[i] === '0') {
            significantLength = i;
            break;
        }
    }
    const pairCount = Math.floor(significantLength / 2);
    let resolution = 20.0; // Default for 2-character codes (1 pair)
    if (pairCount > 0 && pairCount <= PAIR_RESOLUTIONS.length) {
        resolution = PAIR_RESOLUTIONS[pairCount - 1];
    } else if (pairCount > PAIR_RESOLUTIONS.length) {
        resolution = PAIR_RESOLUTIONS[PAIR_RESOLUTIONS.length - 1] / Math.pow(GRID_SIZE, pairCount - PAIR_RESOLUTIONS.length);
    }
    
    // decoded is now the center, so we need half resolution on each side
    const halfLatRes = resolution / 2;
    const halfLngRes = resolution / 2;
    
    // Return as [lng, lat] pairs for GeoJSON
    const rectangle = [
        [decoded.longitude - halfLngRes, decoded.latitude - halfLatRes],
        [decoded.longitude + halfLngRes, decoded.latitude - halfLatRes],
        [decoded.longitude + halfLngRes, decoded.latitude + halfLatRes],
        [decoded.longitude - halfLngRes, decoded.latitude + halfLatRes],
        [decoded.longitude - halfLngRes, decoded.latitude - halfLatRes] // Close the polygon
    ];
    
    // Cache the result, but limit cache size to prevent memory issues
    if (rectangleCache.size > 10000) {
        // Clear oldest entries (simple FIFO - clear all and let it rebuild)
        rectangleCache.clear();
    }
    rectangleCache.set(plusCode, rectangle);
    return rectangle;
}

// Build spatial index for fast event lookups
function rebuildSpatialIndex() {
    eventsByPlusCode.clear();
    eventsByPlusCodePrefix.clear();
    
    const enabledLayers = getEnabledLayers();
    let indexedCount = 0;
    let skippedExpired = 0;
    let skippedDeleted = 0;
    let skippedDeletionKind = 0;
    let skippedNoLayer = 0;
    let skippedNoPlusCode = 0;
    
    events.forEach(event => {
        // Skip expired events - they shouldn't be indexed
        if (isEventExpired(event)) {
            skippedExpired++;
            return;
        }
        
        // Skip deleted events - they shouldn't be indexed
        if (isEventDeleted(event)) {
            skippedDeleted++;
            return;
        }
        
        // Skip deletion events themselves - they shouldn't be indexed
        if (event.kind === DELETION_KIND) {
            skippedDeletionKind++;
            return;
        }
        
        const layer = getLayerForEvent(event);
        if (!layer || !enabledLayers.includes(layer)) {
            skippedNoLayer++;
            return;
        }
        
        const eventPlusCode = getPlusCodeFromEvent(event);
        if (!eventPlusCode) {
            skippedNoPlusCode++;
            return;
        }
        
        // Index by exact plus code
        if (!eventsByPlusCode.has(eventPlusCode)) {
            eventsByPlusCode.set(eventPlusCode, new Set());
        }
        eventsByPlusCode.get(eventPlusCode).add(event);
        
        // Index by prefixes for "within" queries
        const cleanCode = eventPlusCode.replace('+', '').toUpperCase();
        for (let len = 2; len <= Math.min(8, cleanCode.length); len += 2) {
            const prefix = cleanCode.substring(0, len).padEnd(8, '0') + '+';
            if (!eventsByPlusCodePrefix.has(prefix)) {
                eventsByPlusCodePrefix.set(prefix, new Set());
            }
            eventsByPlusCodePrefix.get(prefix).add(event);
        }
        
        indexedCount++;
    });
    
    // Debug: Uncomment to see spatial index rebuild stats
    // console.log('[rebuildSpatialIndex]', {
    //     totalEvents: events.length,
    //     indexed: indexedCount,
    //     skippedExpired: skippedExpired,
    //     skippedDeleted: skippedDeleted,
    //     skippedDeletionKind: skippedDeletionKind,
    //     skippedNoLayer: skippedNoLayer,
    //     skippedNoPlusCode: skippedNoPlusCode
    // });
}

// Fast lookup using spatial index
function filterEventsForPlusCodeFast(plusCode) {
    const eventsForPlusCodeExactly = Array.from(eventsByPlusCode.get(plusCode) || [])
        .filter(event => !isEventDeleted(event) && !isEventExpired(event) && event.kind !== DELETION_KIND);
    
    // For "within" queries, events that are inside this plus code have longer codes
    // We need to check all events indexed by prefixes that start with this plus code
    const eventsWithinPlusCode = [];
    const cleanCode = plusCode.replace('+', '').toUpperCase();
    const indexOfFirstZero = cleanCode.indexOf("0");
    const searchPrefix = indexOfFirstZero === -1 ? cleanCode : cleanCode.substring(0, indexOfFirstZero);
    
    // Check all prefixes that start with our search prefix (longer codes)
    eventsByPlusCodePrefix.forEach((eventSet, prefix) => {
        const prefixClean = prefix.replace('+', '').toUpperCase();
        // If the prefix is longer and starts with our search prefix, check events
        if (prefixClean.length > searchPrefix.length && prefixClean.startsWith(searchPrefix)) {
            eventSet.forEach(event => {
                // Filter out deleted, expired, and deletion events
                if (isEventDeleted(event) || isEventExpired(event) || event.kind === DELETION_KIND) {
                    return;
                }
                const eventPlusCode = getPlusCodeFromEvent(event);
                if (eventPlusCode && eventPlusCode !== plusCode && isPlusCodeInsidePlusCode(plusCode, eventPlusCode)) {
                    // Avoid duplicates
                    if (!eventsWithinPlusCode.includes(event)) {
                        eventsWithinPlusCode.push(event);
                    }
                }
            });
        }
    });
    
    return { eventsForPlusCodeExactly, eventsWithinPlusCode };
}

function whatLengthOfPlusCodeToShow(latitudeDelta, longitudeDelta = latitudeDelta * 2) {
    // Calculate the best code length based on expected cell count
    // We want total cells < MAX_GRID_FEATURES to avoid cutoff
    const maxCells = MAX_GRID_FEATURES * 0.8; // Use 80% of limit for safety margin
    
    // Cell sizes for each code length (ordered from finest to coarsest)
    const codeLengths = [
        { length: 8, cellSize: 0.0025 },
        { length: 6, cellSize: 0.05 },
        { length: 4, cellSize: 1.0 },
        { length: 2, cellSize: 20.0 }
    ];
    
    // Find the finest resolution that stays under the cell limit
    for (const { length, cellSize } of codeLengths) {
        const latSteps = Math.ceil(latitudeDelta / cellSize) + 1;
        const lngSteps = Math.ceil(longitudeDelta / cellSize) + 1;
        const totalCells = latSteps * lngSteps;
        
        if (totalCells <= maxCells) {
            return length;
        }
    }
    
    // Fallback to coarsest
    return 2;
}

function degreeSizeForPlusCodeLength(length) {
    // Match nr-app implementation
    if (length === 2) return 20.0;
    if (length === 4) return 1.0;
    if (length === 6) return 0.05;
    if (length === 8) return 0.0025;
    // For longer codes, calculate based on grid size
    return 0.0025 / Math.pow(GRID_SIZE, (length - 8) / 2);
}

function plusCodePrecisionLength(plusCode) {
    const clean = String(plusCode || '').replace('+', '').toUpperCase();
    return clean.length;
}

function pickMostSpecificPlusCodeFromFeatures(features) {
    if (!Array.isArray(features) || features.length === 0) return '';
    let best = '';
    let bestLen = -1;
    for (const f of features) {
        const pc = String(f?.properties?.plusCode || '').trim();
        if (!pc) continue;
        const len = plusCodePrecisionLength(pc);
        if (len > bestLen) {
            best = pc;
            bestLen = len;
        }
    }
    return best;
}

function getAllPlusCodesBetweenTwoPlusCodes(southWest, northEast, length) {
    if (southWest.length > 9 || northEast.length > 9) {
        console.error('Plus code too long');
        return [];
    }
    
    const swDecoded = decodePlusCode(southWest);
    const neDecoded = decodePlusCode(northEast);
    if (!swDecoded || !neDecoded) {
        return [];
    }
    
    let latitudeDelta = neDecoded.latitude - swDecoded.latitude;
    let longitudeDelta = neDecoded.longitude - swDecoded.longitude;
    
    // Handle negative longitude delta (when coordinates wrap)
    if (longitudeDelta < 0) {
        longitudeDelta += 360;
    }
    
    const degreesPerStep = degreeSizeForPlusCodeLength(length);
    
    // Use ceil + 1 to ensure we include the NE boundary
    const latitudeSteps = Math.max(1, Math.ceil(latitudeDelta / degreesPerStep) + 1);
    const longitudeSteps = Math.max(1, Math.ceil(longitudeDelta / degreesPerStep) + 1);
    
    const plusCodes = [];
    for (let latIndex = 0; latIndex < latitudeSteps; latIndex++) {
        for (let lngIndex = 0; lngIndex < longitudeSteps; lngIndex++) {
            const latitude = swDecoded.latitude + latIndex * degreesPerStep;
            let longitude = swDecoded.longitude + lngIndex * degreesPerStep;
            // Normalize longitude
            longitude = normalizeLongitude(longitude);
            const plusCode = encodePlusCode(latitude, longitude, length);
            if (plusCode) {
                plusCodes.push(plusCode);
            }
        }
    }
    
    return plusCodes;
}

function allPlusCodesForRegion(bounds, codeLength) {
    const sw = encodePlusCode(bounds.south, bounds.west, codeLength);
    const ne = encodePlusCode(bounds.north, bounds.east, codeLength);
    if (!sw || !ne) return [];
    return getAllPlusCodesBetweenTwoPlusCodes(sw, ne, codeLength);
}

// Check if one plus code is inside another (matches nr-common logic)
function isPlusCodeInsidePlusCode(containingPlusCode, targetPlusCode) {
    const indexOfFirstZero = containingPlusCode.indexOf("0");
    // If the plus code has a trailing zero, use the code up to that as a search
    // prefix, otherwise use the whole code
    const startsWithPrefix = indexOfFirstZero === -1
        ? containingPlusCode
        : containingPlusCode.slice(0, indexOfFirstZero);
    const isWithin = targetPlusCode.startsWith(startsWithPrefix);
    return isWithin;
}

function filterEventsForPlusCode(eventList, plusCode) {
    const eventsForPlusCodeExactly = [];
    const eventsWithinPlusCode = [];
    
    eventList.forEach(event => {
        const eventPlusCode = getPlusCodeFromEvent(event);
        if (!eventPlusCode) return;
        
        if (eventPlusCode === plusCode) {
            eventsForPlusCodeExactly.push(event);
        } else if (isPlusCodeInsidePlusCode(plusCode, eventPlusCode)) {
            // Event's plus code is within the containing plus code
            eventsWithinPlusCode.push(event);
        }
    });
    
    return { eventsForPlusCodeExactly, eventsWithinPlusCode };
}

function getTrustrootsCircles() {
    return getTrustrootsCircleEntries();
}

function getPlusCodePrefixes(plusCode, minimumLength = 2) {
    const prefixes = [];
    const cleanCode = plusCode.split('+')[0];
    const maxLength = Math.min(8, cleanCode.length);
    
    for (let len = minimumLength; len <= maxLength; len += 2) {
        const prefix = cleanCode.substring(0, len).padEnd(8, '0') + '+';
        prefixes.push(prefix);
    }
    
    return [...new Set(prefixes)];
}

// Key management
function generateKeyPair() {
    const privateKeyHex = bytesToHex(generateSecretKey());
    savePrivateKey(privateKeyHex);
    if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
        window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'generated');
        window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, false);
    }
    loadKeys();
    appendKeysLinkLog(`Generated new key ${getCurrentNpub() || currentPublicKey || ''}`.trim());
    trackNrWebEvent('nr_key_created', {
        key_method: 'generated',
        signer: 'local',
        status: 'success',
        ...getCurrentTrustrootsUsernameAnalyticsData(),
    });
    showStatus('New key pair generated!', 'success');
}

async function importNsec() {
    const nsecInput = document.getElementById('nsec-import').value.trim();
    appendKeysLinkLog('Import key from nsec field');
    const parsed = parseKeyImportToHex(nsecInput);
    if (!parsed.ok) {
        const message = getKeyImportErrorMessage(nsecInput);
        appendKeysLinkLog(`Import failed: ${message}`);
        showStatus(message, 'error');
        return;
    }
    try {
        savePrivateKey(parsed.hex);
        appendKeysLinkLog(`Import parsed successfully. Public key: ${getCurrentNpub() || currentPublicKey}`);
        if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
            window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'imported');
            window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, true);
        }
        loadKeys();
        appendKeysLinkLog('Checking linked Trustroots profile after import');
        showStatus('Key imported. Looking up your public profile details...', 'info');
        await checkProfileLinked();
        appendKeysLinkLog('Import complete');
        trackNrWebEvent('nr_key_imported', {
            key_method: nsecInput.includes(' ') ? 'mnemonic' : 'nsec',
            signer: 'local',
            status: 'success',
            ...getCurrentTrustrootsUsernameAnalyticsData(),
        });
        showStatus('Key imported successfully. Your key stays on this device and is never stored on our server.', 'success');
        document.getElementById('nsec-import').value = '';
    } catch (error) {
        appendKeysLinkLog(`Import failed: ${error.message || error}`);
        showStatus('Error importing nsec: ' + error.message, 'error');
    }
}

function savePrivateKey(privateKeyHex) {
    nrWebNip7Signer.useLocal();
    writeStoredKeyHex(privateKeyHex);
    currentPrivateKey = privateKeyHex;
    currentPrivateKeyBytes = secretKeyBytesFromHex64(privateKeyHex);
    currentPublicKey = getPublicKey(currentPrivateKeyBytes);
    void setupIndexNrWebThemeSync();
}

function loadKeys() {
    const privateKeyHex = readValidStoredKeyHex();
    if (privateKeyHex) {
        savePrivateKey(privateKeyHex); // This will also derive public key
    }
    updateKeyDisplay();
}

function copyPublicKey() {
    const npubDisplay = document.getElementById('npub-display');
    const copyBtn = document.getElementById('copy-npub-btn');
    const copyText = document.getElementById('copy-npub-text');
    
    if (!npubDisplay || !npubDisplay.value) {
        showStatus('No public key to copy', 'error');
        return;
    }
    
    navigator.clipboard.writeText(npubDisplay.value).then(() => {
        // Visual feedback
        const originalText = copyText.textContent;
        copyText.textContent = '✓';
        copyBtn.classList.add('copied');
        
        showStatus('Public address copied.', 'success');
        
        // Reset after 2 seconds
        setTimeout(() => {
            copyText.textContent = originalText;
            copyBtn.classList.remove('copied');
        }, 2000);
    }).catch(() => {
        showStatus('Failed to copy to clipboard', 'error');
    });
}

function exportNsec() {
    if (!currentPrivateKey) {
        showStatus('No private key to export', 'error');
        return;
    }
    
    try {
        const nsec = nsecEncodeFromHex64(currentPrivateKey);
        
        // Copy to clipboard
        navigator.clipboard.writeText(nsec).then(() => {
            window.NrWebKeysModal?.setKeyBackedUpForPubkey?.(currentPublicKey, true);
            updateKeyDisplay({ skipProfileLookup: true });
            showStatus('nsec copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback: show in alert if clipboard API fails
            prompt('Your nsec (copy this):', nsec);
            window.NrWebKeysModal?.setKeyBackedUpForPubkey?.(currentPublicKey, true);
            updateKeyDisplay({ skipProfileLookup: true });
            showStatus('nsec displayed', 'info');
        });
    } catch (error) {
        console.error('Error exporting nsec:', error);
        showStatus('Error exporting nsec: ' + error.message, 'error');
    }
}

function deleteNsec() {
    if (!confirm('Remove your key from this device? You will need to import or create a key again before you can post.')) {
        return;
    }
    const deletedPubkey = currentPublicKey;
    clearClaimSignDoneForPubkey(deletedPubkey);
    
    clearStoredKey();
    currentPrivateKey = null;
    currentPrivateKeyBytes = null;
    currentPublicKey = null;
    nrWebNip7Signer.useLocal();
    if (typeof window.NrWebTheme !== 'undefined') {
        window.NrWebTheme.registerThemePublish(null);
    }
    window.NrWebKeysModal?.clearKeySourceForPubkey?.(deletedPubkey);
    window.NrWebKeysModal?.clearKeyBackedUpForPubkey?.(deletedPubkey);
    appendKeysLinkLog(`Deleted private key${deletedPubkey ? ` for ${deletedPubkey}` : ''}`);
    isProfileLinked = false;
    usernameFromNostr = false;
    claimEventsByKind = new Map();
    if (claimSuggestionsDebounce) {
        clearTimeout(claimSuggestionsDebounce);
        claimSuggestionsDebounce = null;
    }
    
    // Reset username field
    const usernameInput = document.getElementById('trustroots-username');
    const usernameIndicator = document.getElementById('username-nostr-indicator');
    if (usernameInput) {
        usernameInput.value = '';
        usernameInput.disabled = false;
    }
    if (usernameIndicator) {
        usernameIndicator.style.display = 'none';
    }
    
    updateKeyDisplay();
    document.getElementById('npub-display').value = '';
    showStatus('Key removed from this device.', 'success');
    
    // Show onboarding modal again
    openKeysModal();
}

function disconnectNip7() {
    if (!nrWebNip7Signer.isActive() && (!currentPublicKey || currentPrivateKey)) return;
    nrWebNip7Signer.useLocal();
    currentPublicKey = null;
    currentPrivateKey = null;
    currentPrivateKeyBytes = null;
    isProfileLinked = false;
    usernameFromNostr = false;
    if (typeof window.NrWebTheme !== 'undefined') {
        window.NrWebTheme.registerThemePublish(null);
    }
    loadKeys();
    appendKeysLinkLog('Disconnected NIP-07 browser extension mode');
    updateKeyDisplay({ skipProfileLookup: true });
    showStatus('Browser extension disconnected.', 'info');
    openKeysModal();
}

function handleNip7IdentityMismatch(mismatchPubkey = '', context = 'request') {
    const expectedPubkey = String(currentPublicKey || '').trim().toLowerCase();
    const mismatchSuffix = mismatchPubkey ? ` (extension now uses ${mismatchPubkey.slice(0, 12)}...)` : '';
    appendKeysLinkLog(`NIP-07 identity changed during ${context}; disconnecting${mismatchSuffix}`);
    disconnectNip7();
    const now = Date.now();
    if (now - lastIdentityMismatchNoticeAt >= IDENTITY_MISMATCH_NOTICE_COOLDOWN_MS) {
        lastIdentityMismatchNoticeAt = now;
        showStatus('Browser extension identity changed. Reconnect to continue.', 'error');
    }
    return false;
}

async function ensureNip7IdentityIsCurrent(context = 'request', options = {}) {
    const expectedPubkey = String(currentPublicKey || '').trim().toLowerCase();
    if (!expectedPubkey || !nrWebNip7Signer.isActiveForPubkey(expectedPubkey)) return true;
    const force = options?.force === true;
    const now = Date.now();
    if (
        !force &&
        nip7IdentityCheckLastPubkey === expectedPubkey &&
        (now - nip7IdentityCheckLastOkAt) < NIP7_IDENTITY_CHECK_COOLDOWN_MS
    ) return true;
    if (nip7IdentityCheckInFlight) return await nip7IdentityCheckInFlight;
    nip7IdentityCheckInFlight = (async () => {
        const extensionPubkey = await nrWebNip7Signer.readCurrentPubkey();
        if (!extensionPubkey || extensionPubkey === expectedPubkey) {
            nip7IdentityCheckLastOkAt = Date.now();
            nip7IdentityCheckLastPubkey = expectedPubkey;
            return true;
        }
        return handleNip7IdentityMismatch(extensionPubkey, context);
    })()
        .catch((error) => {
            appendKeysLinkLog(`NIP-07 identity check failed during ${context}: ${error?.message || error}`);
            return true;
        })
        .finally(() => {
            nip7IdentityCheckInFlight = null;
        });
    return await nip7IdentityCheckInFlight;
}

function updateKeyDisplay(options = {}) {
    const keysModal = window.NrWebKeysModal;
    let npub = '';
    let npubError = '';
    const keySource = keysModal?.getKeySourceForPubkey?.(currentPublicKey) || '';
    const showChecklist = keySource === 'generated';
    const isNsecBackedUp = keysModal?.isKeyBackedUpForPubkey?.(currentPublicKey) === true;
    const nip7Caps = nrWebNip7Signer.getCapabilities();
    const signerMode = nrWebNip7Signer.isActiveForPubkey(currentPublicKey) ? 'nip7' : 'local';
    if (currentPublicKey) {
        npub = getCurrentNpub();
        if (!npub) npubError = 'Error encoding npub';
    } else {
        isProfileLinked = false;
        updateLinkProfileButton();
    }
    if (keysModal?.updateKeyDisplay) {
        keysModal.updateKeyDisplay({
            hasNsec: !!currentPrivateKey,
            hasPublicKey: !!currentPublicKey,
            npub,
            npubError,
            isProfileLinked,
            isUsernameLinked: usernameFromNostr,
            showChecklist,
            isNsecBackedUp,
            signerMode,
            nip7Status: nip7Caps.status,
            signerStatusText: getNip7StatusText()
        });
    }
    if (currentPublicKey && options.skipProfileLookup !== true) void checkProfileLinked();
    setHeaderIdentity();
    renderRelaysList();
    renderClaimSummary();
    try {
        if (currentPublicKey) document.body.classList.add('nr-web-has-key');
        else document.body.classList.remove('nr-web-has-key');
    } catch (_) {}
}

function syncNrNavAccountAvatars() {
    let pic = '';
    const activePubkey = currentPublicKey || window.NrWebGetCurrentPubkeyHex?.() || '';
    if (activePubkey && window.NrWeb && typeof window.NrWeb.updateNrNavAccountAvatars === 'function') {
        const key = String(activePubkey);
        pic =
            sanitizeProfileImageUrl(
                pubkeyToPicture.get(key) ||
                pubkeyToPicture.get(key.toLowerCase()) ||
                window.NrWeb.getRememberedNrNavAccountAvatar?.(key) ||
                ''
            ) || '';
        if (pic) window.NrWeb.rememberNrNavAccountAvatar?.(key, pic);
        window.NrWeb.updateNrNavAccountAvatars(pic);
    } else if (window.NrWeb && typeof window.NrWeb.updateNrNavAccountAvatars === 'function') {
        window.NrWeb.updateNrNavAccountAvatars('');
    }
}

function applyNrNavAccountAvatarForActiveSurface() {
    try {
        if (
            document.body &&
            document.body.classList.contains('nr-surface-chat') &&
            typeof window.NrWebChatSyncNavAccountAvatar === 'function'
        ) {
            window.NrWebChatSyncNavAccountAvatar();
            return;
        }
        syncNrNavAccountAvatars();
    } catch (_) {}
}

const SETTINGS_KPI_LOADING_VALUE = '--';
let headerKpisHydrated = false;

function openMapHomeFromHeaderKpi() {
    try {
        setHashRoute('map');
    } catch (_) {}
}

function openNotificationsSettingsModal() {
    _openSettingsModalShared({
        route: 'settings',
        extraSetup: () => {
            if (typeof renderSettingsNotificationsSection === 'function') renderSettingsNotificationsSection();
            const section = document.getElementById('settings-notifications-section');
            if (!section) return;
            try {
                section.scrollIntoView({ block: 'start', behavior: 'smooth' });
            } catch (_) {
                try { section.scrollIntoView(); } catch (_) {}
            }
        },
    });
}

function headerKpiLabelAndValue(key, snapshot) {
    if (key === 'newNotes24h') {
        return {
            label: 'New notes',
            value: headerKpisHydrated ? String(snapshot.newNotes24h) : SETTINGS_KPI_LOADING_VALUE,
            action: 'map',
            id: 'kpi-new-notes-24h',
        };
    }
    if (key === 'notesLoaded') {
        return {
            label: 'Notes loaded',
            value: headerKpisHydrated ? String(snapshot.notesLoaded) : SETTINGS_KPI_LOADING_VALUE,
            action: 'map',
            id: 'kpi-notes-loaded',
        };
    }
    if (key === 'subscribedAreas') {
        return {
            label: 'Subscribed areas',
            value: headerKpisHydrated ? String(snapshot.subscribedAreas) : SETTINGS_KPI_LOADING_VALUE,
            action: 'notifications',
            id: 'kpi-subscribed-areas',
        };
    }
    return {
        label: 'Relays online',
        value: headerKpisHydrated
            ? formatHeaderRelaysOnlineKpi(snapshot.relaysConnected, snapshot.relaysTotal)
            : SETTINGS_KPI_LOADING_VALUE,
        action: 'relays',
        id: 'kpi-relays-online',
    };
}

function getHeaderKpiSnapshot() {
    const now = getCurrentTimestamp();
    const base = computeHeaderKpiCounts(events, now);
    const relayUrls = getRelayUrls();
    const relaysConnected = getConnectedRelayCount(relayUrls);
    const relaysTotal = relayUrls.length;
    const subscribedAreas = Array.from(new Set(
        (getNotificationPlusCodes() || [])
            .map((code) => String(code || '').trim())
            .filter(Boolean),
    )).length;
    return {
        ...base,
        relaysConnected,
        relaysTotal,
        subscribedAreas,
    };
}

function bindHeaderKpiClickHandlers(scopeEl) {
    const root = scopeEl || document;
    const chips = root.querySelectorAll('#settings-kpis [data-kpi-action]');
    chips.forEach((chip) => {
        chip.addEventListener('click', (event) => {
            event.preventDefault();
            const action = chip.getAttribute('data-kpi-action');
            if (action === 'map') {
                openMapHomeFromHeaderKpi();
                return;
            }
            if (action === 'notifications') {
                openNotificationsSettingsModal();
                return;
            }
            if (action === 'relays') {
                openRelaysSettingsModal();
            }
        });
    });
}

function renderHeaderKpis() {
    const container = document.getElementById('settings-kpis');
    if (!container) return;
    const keys = getHeaderKpiKeysForViewport(false);
    const snapshot = getHeaderKpiSnapshot();
    const html = keys.map((key) => {
        const row = headerKpiLabelAndValue(key, snapshot);
        let extraClass = '';
        if (key === 'relaysOnline' && headerKpisHydrated && snapshot.relaysTotal > 0) {
            if (snapshot.relaysConnected === 0) extraClass = ' kpi-chip--error';
            else if (snapshot.relaysConnected < snapshot.relaysTotal) extraClass = ' kpi-chip--warn';
        }
        const ariaValue = row.value || SETTINGS_KPI_LOADING_VALUE;
        const ariaLabel = `${row.label}: ${ariaValue}`;
        return `
            <button
                type="button"
                id="${row.id}"
                class="kpi-chip${extraClass}"
                data-kpi-action="${row.action}"
                aria-label="${escapeHtml(ariaLabel)}"
                title="${escapeHtml(ariaLabel)}"
            >
                <span class="kpi-chip-label" aria-hidden="true">${escapeHtml(row.label)}</span>
                <strong class="kpi-chip-value">${escapeHtml(String(row.value || SETTINGS_KPI_LOADING_VALUE))}</strong>
            </button>
        `;
    }).join('');
    container.innerHTML = html;
    bindHeaderKpiClickHandlers(container);
}

function renderHeaderRelayStatus() {
    const btn = document.getElementById('header-relay-status');
    if (!btn) return;
    const valueEl = btn.querySelector('.header-relay-status-value');
    const snapshot = getHeaderKpiSnapshot();
    const value = headerKpisHydrated
        ? formatHeaderRelaysOnlineKpi(snapshot.relaysConnected, snapshot.relaysTotal)
        : SETTINGS_KPI_LOADING_VALUE;
    const ariaLabel = `Relays online: ${value}`;
    btn.classList.remove('is-loading', 'is-warn', 'is-error');
    if (!headerKpisHydrated || snapshot.relaysTotal === 0) {
        btn.classList.add('is-loading');
    } else {
        const statusClass = getHeaderRelayStatusClass(
            snapshot.relaysConnected,
            snapshot.relaysTotal,
            headerKpisHydrated,
        );
        if (statusClass) btn.classList.add(statusClass);
    }
    btn.setAttribute('aria-label', ariaLabel);
    btn.setAttribute('title', ariaLabel);
    if (valueEl) valueEl.textContent = value;
    btn.onclick = (event) => {
        event.preventDefault();
        openRelaysSettingsModal();
    };
}

function scheduleHeaderKpiRefresh() {
    renderHeaderKpis();
    renderHeaderRelayStatus();
}

const NR_STATS_CACHE_KEY = 'nr-web.stats.snapshot.v1';
const NR_STATS_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
let nrStatsRenderToken = 0;

export function getStatsRelayFilters() {
    return [
        { kinds: [0, TRUSTROOTS_PROFILE_KIND, PROFILE_CLAIM_KIND], limit: 2500 },
        { kinds: MAP_NOTE_KINDS, limit: 3000 },
        { kinds: [RELATIONSHIP_CLAIM_KIND, EXPERIENCE_CLAIM_KIND, THREAD_UPVOTE_METRIC_KIND], limit: 2500 },
        { kinds: [TRUSTROOTS_CIRCLE_META_KIND], limit: 1200 },
    ];
}

function relayUrlsFromStatsEvents(eventsList) {
    const urls = new Set();
    for (const event of eventsList || []) {
        const add = (raw) => {
            const s = String(raw || '').trim().toLowerCase();
            if (s) urls.add(s);
        };
        add(event?._nrCollectRelay);
        if (Array.isArray(event?._nrRelayUrls)) event._nrRelayUrls.forEach(add);
    }
    return urls;
}

async function collectStatsFromPublicRelay(url, filters) {
    let relay;
    const all = [];
    try {
        relay = await Promise.race([
            Relay.connect(url),
            new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), 4500)),
        ]);
        await new Promise((resolve) => {
            let settled = false;
            let sub = null;
            const settle = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                try { sub?.close?.(); } catch (_) {}
                try { relay?.close?.(); } catch (_) {}
                resolve();
            };
            const timeoutId = setTimeout(settle, 6500);
            try {
                sub = relay.subscribe(filters, {
                    onevent: (event) => {
                        if (event && typeof event === 'object') all.push({ ...event, _nrCollectRelay: url });
                    },
                    oneose: () => {
                        setTimeout(settle, 350);
                    },
                });
            } catch (_) {
                settle();
            }
        });
    } finally {
        try { relay?.close?.(); } catch (_) {}
    }
    return all;
}

async function collectStatsFromNip42Relay(filters) {
    const relayAuth = window.NrWebRelayAuth;
    if (!relayAuth?.nip42SubscribeOnce) return [];
    if (!currentPublicKey || typeof signEventTemplate !== 'function') return [];
    const relayUrl = TRUSTROOTS_RESTRICTED_RELAY_URL;
    const chunks = await Promise.all(filters.map(async (filter) => {
        const out = [];
        try {
            await relayAuth.nip42SubscribeOnce({
                relayUrl,
                filter,
                authPubkey: currentPublicKey,
                signEvent: async (eventTemplate) => signEventTemplate(eventTemplate),
                onEvent: (event) => {
                    if (event && typeof event === 'object') out.push({ ...event, _nrCollectRelay: relayUrl });
                },
                onAuthChallenge: () => {},
                onAuthSuccess: () => {},
                onAuthFail: () => {},
                onError: () => {},
                waitMs: 4200,
            });
        } catch (_) {}
        return out;
    }));
    return chunks.flat();
}

function loadStatsSnapshotFromCache() {
    try {
        const raw = localStorage.getItem(NR_STATS_CACHE_KEY);
        if (!raw) return null;
        const row = JSON.parse(raw);
        if (!row || typeof row !== 'object' || !row.snapshot) return null;
        const age = Date.now() - Number(row.cachedAt || 0);
        if (!Number.isFinite(age) || age < 0 || age > NR_STATS_CACHE_MAX_AGE_MS) return null;
        return row.snapshot;
    } catch (_) {
        return null;
    }
}

function saveStatsSnapshotToCache(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    try {
        localStorage.setItem(NR_STATS_CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), snapshot }));
    } catch (_) {}
}

function formatStatsNumber(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.max(0, n));
}

function formatStatsTimestamp(msOrSeconds) {
    const n = Number(msOrSeconds || 0);
    if (!Number.isFinite(n) || n <= 0) return 'unknown';
    const ms = n > 1_000_000_000_000 ? n : n * 1000;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return 'unknown';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function statsCard(label, value, note = '', explanation = '') {
    const title = explanation || `${label}: ${formatStatsNumber(value)}`;
    return `
        <article class="nr-stats-card" title="${escapeHtml(title)}">
            <span class="nr-stats-card-label">${escapeHtml(label)}</span>
            <strong class="nr-stats-card-value">${escapeHtml(formatStatsNumber(value))}</strong>
            ${note ? `<span class="nr-stats-card-note">${escapeHtml(note)}</span>` : ''}
        </article>
    `;
}

function statsRows(rows) {
    return rows.map((row) => {
        const label = Array.isArray(row) ? row[0] : row.label;
        const value = Array.isArray(row) ? row[1] : row.value;
        const explanation = Array.isArray(row) ? row[2] : row.explanation;
        return `
        <div class="nr-stats-row" title="${escapeHtml(explanation || `${label}: ${value}`)}">
            <span class="nr-stats-row-label">${escapeHtml(label)}</span>
            <strong class="nr-stats-row-value">${escapeHtml(String(value))}</strong>
        </div>
    `;
    }).join('');
}

function statsBars(buckets) {
    const max = Math.max(1, ...(buckets || []).map((b) => Number(b.count || 0)));
    return `
        <div class="nr-stats-bars" aria-label="Weekly Host & Meet activity">
            ${(buckets || []).map((bucket) => {
                const count = Math.max(0, Number(bucket.count || 0));
                const height = Math.max(3, Math.round((count / max) * 92));
                return `
                    <div class="nr-stats-bar" title="${escapeHtml(`${bucket.label}: ${count}`)}">
                        <span class="nr-stats-bar-fill" style="height:${height}px"></span>
                        <span class="nr-stats-bar-label">${escapeHtml(bucket.label)}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function statsMeters(rows) {
    const max = Math.max(1, ...(rows || []).map((r) => Number(r.count || 0)));
    return `
        <div class="nr-stats-list">
            ${(rows || []).map((row) => {
                const count = Math.max(0, Number(row.count || 0));
                const width = Math.round((count / max) * 100);
                return `
                    <div class="nr-stats-list-row" title="${escapeHtml(row.explanation || `${row.label || row.slug || row.id || ''}: ${count}`)}">
                        <span>
                            <span class="nr-stats-row-label">${escapeHtml(row.label || row.slug || row.id || '')}</span>
                            <span class="nr-stats-meter" aria-hidden="true"><span style="width:${width}%"></span></span>
                        </span>
                        <strong class="nr-stats-row-value">${escapeHtml(formatStatsNumber(count))}</strong>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderStatsState(root, message, detail = '') {
    root.innerHTML = `
        <div class="nr-stats">
            <section class="nr-stats-state">
                <strong>${escapeHtml(message)}</strong>
                ${detail ? `<p class="nr-stats-muted">${escapeHtml(detail)}</p>` : ''}
            </section>
        </div>
    `;
}

function renderStatsSnapshot(root, snapshot, options = {}) {
    const status = options.status || 'Live';
    const relays = snapshot.relays || {};
    const latestSeen = relays.latestEventAt ? `Latest event ${formatStatsTimestamp(relays.latestEventAt)}` : 'No event timestamp yet';
    const intentRows = (snapshot.intents || []).map((row) => ({
        ...row,
        explanation: `${row.label || row.id} Host & Meet notes observed. These come from the note's hashtag or Nostr tag.`,
    }));
    const topCircles = snapshot.circles?.topCircles?.length
        ? snapshot.circles.topCircles.map((row) => ({
            label: `#${row.slug}`,
            count: row.count,
            explanation: `Circle tag mentions for #${row.slug} observed in imported profile, host mirror, or circle directory events.`,
        }))
        : [{ label: 'No circle mentions observed', count: 0, explanation: 'No Trustroots circle tags were found in the events used for this snapshot.' }];
    root.innerHTML = `
        <div class="nr-stats">
            <header class="nr-stats-header">
                <div>
                    <h1>Progress stats</h1>
                    <p>Counts are based on events seen on your configured relays.</p>
                </div>
                <div class="nr-stats-actions">
                    <span class="nr-stats-badge">${escapeHtml(status)} - ${escapeHtml(formatStatsTimestamp(snapshot.generatedAt))}</span>
                    <button type="button" class="nr-stats-refresh" id="nr-stats-refresh">Refresh</button>
                </div>
            </header>
            ${snapshot.observedEvents === 0 ? '<div class="nr-stats-state nr-stats-muted">No progress events were observed yet. Try again after relays connect.</div>' : ''}
            <section class="nr-stats-grid" aria-label="Progress overview">
                ${statsCard('Trustroots identities', snapshot.identity.observedTrustrootsIdentities, 'seen on Nostr', 'People with a Trustroots identity signal found on Nostr, such as a Trustroots username, NIP-05 address, or imported profile claim.')}
                ${statsCard('Linked usernames', snapshot.identity.linkedTrustrootsUsernames, 'Trustroots names', 'Distinct Trustroots usernames observed in profile metadata or imported profile claims.')}
                ${statsCard('Host & Meet notes', snapshot.hostMeet.totalNotes, `${formatStatsNumber(snapshot.hostMeet.notes7d)} in 7 days`, 'Location-based Host & Meet notes and Trustroots-validated mirrors observed on configured relays.')}
                ${statsCard('Active posters', snapshot.hostMeet.activePosters, `${formatStatsNumber(snapshot.hostMeet.activeAreas)} areas`, 'Distinct public keys that posted Host & Meet notes in the observed data.')}
            </section>
            <div class="nr-stats-sections">
                <section class="nr-stats-section" title="Identity progress shows how much Trustroots identity data has appeared on Nostr so far.">
                    <h2>Identity Progress</h2>
                    ${statsRows([
                        ['Imported profile claims', formatStatsNumber(snapshot.identity.importedProfileClaims), 'Kind 30390 profile import events observed on configured relays.'],
                        ['Recent new identities', formatStatsNumber(snapshot.identity.recentNewIdentities), 'Trustroots identities first seen in this snapshot during the last 30 days.'],
                        ['Observed events', formatStatsNumber(snapshot.observedEvents), 'Total de-duplicated Nostr events used to build this dashboard snapshot.'],
                    ])}
                </section>
                <section class="nr-stats-section" title="Host & Meet activity counts recent location-based posts and validated mirrors.">
                    <h2>Host & Meet Activity</h2>
                    ${statsRows([
                        ['Last 24 hours', formatStatsNumber(snapshot.hostMeet.notes24h), 'Host & Meet notes observed in the last 24 hours.'],
                        ['Last 7 days', formatStatsNumber(snapshot.hostMeet.notes7d), 'Host & Meet notes observed in the last 7 days.'],
                        ['Last 30 days', formatStatsNumber(snapshot.hostMeet.notes30d), 'Host & Meet notes observed in the last 30 days.'],
                        ['Trustroots mirrors', formatStatsNumber(snapshot.hostMeet.hostMirrors), 'Kind 30398 validated mirror events, usually reposted by Trustroots infrastructure.'],
                    ])}
                </section>
                <section class="nr-stats-section" title="Each bar is one week of observed Host & Meet note activity.">
                    <h2>Weekly Trend</h2>
                    ${statsBars(snapshot.hostMeet.weeklyTrend)}
                </section>
                <section class="nr-stats-section" title="Intent mix shows what people are trying to do with Host & Meet notes.">
                    <h2>Intent Mix</h2>
                    ${statsMeters(intentRows)}
                </section>
                <section class="nr-stats-section" title="Community graph stats are imported trust/contact/reference signals. These are event counts, not necessarily unique real-world relationships.">
                    <h2>Community Graph</h2>
                    ${statsRows([
                        ['Contact claim events', formatStatsNumber(snapshot.community.relationshipClaims), 'Kind 30392 contact/relationship claim events observed. This is an event count, not a count of unique friendships.'],
                        ['Experience references', formatStatsNumber(snapshot.community.experienceReferences), 'Kind 30393 positive experience/reference claim events observed.'],
                        ['Thread-upvote metrics', formatStatsNumber(snapshot.community.threadUpvoteMetrics), 'Kind 30394 imported thread-upvote metric events observed.'],
                        ['Claim participants', formatStatsNumber(snapshot.community.uniqueClaimParticipants), 'Distinct public keys mentioned in contact, experience, or metric claim events.'],
                    ])}
                </section>
                <section class="nr-stats-section" title="Circle stats come from Trustroots circle tags and imported circle directory events.">
                    <h2>Circles</h2>
                    ${statsRows([
                        ['Imported circle directory', formatStatsNumber(snapshot.circles.circleDirectoryCount), 'Kind 30410 circle metadata events observed.'],
                    ])}
                    ${statsMeters(topCircles)}
                </section>
                <section class="nr-stats-section" title="Relay freshness explains where this dashboard snapshot came from and how current it looks.">
                    <h2>Relay Freshness</h2>
                    ${statsRows([
                        ['Relays online', `${formatStatsNumber(relays.online)}/${formatStatsNumber(relays.total)}`, 'Configured relays currently marked connected by the app.'],
                        ['Relays with stats', formatStatsNumber(relays.contributing), 'Relays that contributed at least one event to this snapshot, based on relay metadata attached while reading.'],
                        ['Freshness', latestSeen, 'Timestamp of the newest observed event in this dashboard snapshot.'],
                    ])}
                </section>
            </div>
        </div>
    `;
    bindStatsPageActions(root);
}

function bindStatsPageActions(root) {
    const btn = root.querySelector('#nr-stats-refresh');
    if (!btn) return;
    btn.addEventListener('click', () => {
        void renderStatsPage({ force: true });
    });
}

async function collectStatsSnapshotFromRelays() {
    const filters = getStatsRelayFilters();
    const relayUrls = getRelayUrls();
    const publicUrls = relayUrls.filter((url) => !isRestrictedRelayUrl(url));
    const publicTasks = publicUrls.map((url) => collectStatsFromPublicRelay(url, filters).catch(() => []));
    const [publicChunks, authEvents] = await Promise.all([
        Promise.all(publicTasks),
        collectStatsFromNip42Relay(filters).catch(() => []),
    ]);
    const allEvents = [...publicChunks.flat(), ...authEvents, ...(Array.isArray(events) ? events : [])];
    const contributingRelays = relayUrlsFromStatsEvents(allEvents).size;
    return buildStatsSnapshotFromEvents(allEvents, {
        generatedAt: Date.now(),
        nowTimestamp: getCurrentTimestamp(),
        relaysConnected: getConnectedRelayCount(relayUrls),
        relaysTotal: relayUrls.length,
        contributingRelays,
    });
}

async function renderStatsPage(options = {}) {
    const root = document.getElementById('nr-stats-root');
    if (!root) return;
    const token = ++nrStatsRenderToken;
    const cached = options.force ? null : loadStatsSnapshotFromCache();
    if (cached) {
        renderStatsSnapshot(root, cached, { status: 'Cached' });
        return;
    } else {
        renderStatsState(root, 'Loading progress stats...', 'Reading recent events from your configured relays.');
    }
    try {
        const snapshot = await collectStatsSnapshotFromRelays();
        if (token !== nrStatsRenderToken) return;
        saveStatsSnapshotToCache(snapshot);
        renderStatsSnapshot(root, snapshot, { status: 'Live' });
    } catch (error) {
        if (token !== nrStatsRenderToken) return;
        if (cached) {
            renderStatsSnapshot(root, cached, { status: 'Cached' });
            const state = document.createElement('div');
            state.className = 'nr-stats-state nr-stats-muted';
            state.textContent = 'Could not refresh stats from relays just now.';
            root.querySelector('.nr-stats')?.prepend(state);
        } else {
            renderStatsState(root, 'Could not load stats.', String(error?.message || error || 'Relay reads failed.'));
        }
    }
}

document.addEventListener('nrweb-app-header-filled', function () {
    try {
        applyNrNavAccountAvatarForActiveSurface();
    } catch (_) {}
    try {
        renderHeaderRelayStatus();
    } catch (_) {}
});

function setHeaderIdentity() {
    const el = document.getElementById('header-identity');
    const elM = document.getElementById('header-identity-mobile');
    const btn = document.getElementById('keys-icon-btn');
    const btnM = document.getElementById('keys-icon-btn-mobile');
    if (!el) return;
    const hasKey = !!currentPublicKey;
    function applyTo(node) {
        if (!node) return;
        if (!hasKey) {
            node.textContent = '';
            node.title = '';
            node.classList.add('empty');
            node.classList.remove('nip5');
            return;
        }
        const npubStr = getCurrentNpub();
        const trUsername = document.getElementById('trustroots-username')?.value?.trim() || pubkeyToUsername.get(currentPublicKey) || null;
        node.classList.remove('empty');
        if (trUsername) {
            node.textContent = trUsername + '@trustroots.org';
            node.title = node.textContent + (npubStr ? '\n' + npubStr : '');
            node.classList.remove('nip5');
        } else {
            node.textContent = npubStr ? (npubStr.slice(0, 12) + '…' + npubStr.slice(-8)) : '';
            node.title = npubStr || '';
            node.classList.remove('nip5');
        }
    }
    if (!hasKey) {
        applyTo(el);
        applyTo(elM);
        if (btn) btn.classList.remove('has-identity');
        if (btnM) btnM.classList.remove('has-identity');
        applyNrNavAccountAvatarForActiveSurface();
        return;
    }
    if (btn) btn.classList.add('has-identity');
    if (btnM) btnM.classList.add('has-identity');
    applyTo(el);
    applyTo(elM);
    applyNrNavAccountAvatarForActiveSurface();
}

// Relay status tracking
const relayStatus = new Map(); // url -> { status: 'connected'|'connecting'|'disconnected'|'error', canWrite: boolean }
const relayWriteEnabled = new Map(); // url -> boolean
const relaySettings = window.NrWebRelaySettings;
const RELAY_WRITE_ENABLED_STORAGE_KEY = relaySettings?.RELAY_WRITE_ENABLED_STORAGE_KEY || 'relay_write_enabled';
const getSavedRelayWritePreferences = () => relaySettings?.getRelayWritePreferences ? relaySettings.getRelayWritePreferences() : {};
const getDefaultRelayPostEnabled = (url) => relaySettings?.getDefaultRelayPostEnabled
    ? relaySettings.getDefaultRelayPostEnabled(url)
    : (url || '').trim().toLowerCase() === TRUSTROOTS_RESTRICTED_RELAY_URL;
const getRelayUrls = () => relaySettings?.getRelayUrls ? relaySettings.getRelayUrls(DEFAULT_RELAYS) : DEFAULT_RELAYS.slice();
const saveRelayWritePreferences = () => {
    const urls = getRelayUrls();
    if (relaySettings?.saveRelayWritePreferences) relaySettings.saveRelayWritePreferences(urls, relayWriteEnabled);
};

function isLocalRelayUrl(url) {
    return relaySettings?.isLocalRelayUrl ? relaySettings.isLocalRelayUrl(url) : false;
}

// Relay management

function getWritableRelayUrls() {
    return getRelayUrls().filter(url => relayWriteEnabled.get(url) !== false);
}

function isKnownPublicRelayUrl(url) {
    if (relaySettings?.isPublicRelayUrl) return relaySettings.isPublicRelayUrl(url);
    const normalized = String(url || '').trim().toLowerCase();
    return normalized === 'wss://relay.trustroots.org' || normalized === 'wss://relay.nomadwiki.org';
}

function getRelayScopeFromRelayUrls(urls) {
    const list = Array.isArray(urls) ? urls : [];
    if (!list.length) return '';
    if (list.some((url) => isKnownPublicRelayUrl(url))) return 'public';
    return 'auth';
}

function updateNoteComposePostingIcon() {
    const iconEl = document.getElementById('note-compose-scope-icon');
    if (!iconEl) return;
    const writableRelayUrls = getWritableRelayUrls();
    const scope = getRelayScopeFromRelayUrls(writableRelayUrls);
    if (scope === 'public') {
        iconEl.textContent = '🌍';
        iconEl.title = 'Posting notes to public relay(s)';
        return;
    }
    if (scope === 'auth') {
        iconEl.textContent = '🔐';
        iconEl.title = 'Posting notes to auth-required relay(s)';
        return;
    }
    iconEl.textContent = '⚠️';
    iconEl.title = 'No writable relay selected';
}

function isRestrictedRelayUrl(url) {
    return isTrustrootsAuthRelayUrl(url);
}

function canUseRestrictedRelay() {
    return hasRelayAuthSigningCapability() && isProfileLinked === true;
}

function getCurrentNostrootsSetupState() {
    const hasKey = !!(currentPublicKey || currentPrivateKey || nrWebNip7Signer.isActive());
    return classifyNostrootsSetupState({
        hasKey,
        hasTrustrootsNip05: hasKey && canUseRestrictedRelay(),
    });
}

window.NrWebGetSetupState = getCurrentNostrootsSetupState;

function getNrWebSignerAnalyticsType() {
    try {
        if (nrWebNip7Signer.isActiveForPubkey(currentPublicKey)) return 'nip7';
    } catch (_) {}
    if (currentPrivateKeyBytes || currentPrivateKey) return 'local';
    return 'none';
}

function getWritableRelayAnalyticsData(relayUrls) {
    const urls = Array.isArray(relayUrls) ? relayUrls : getWritableRelayUrls();
    return {
        relay_count: urls.length,
        signer: getNrWebSignerAnalyticsType(),
        ...getCurrentTrustrootsUsernameAnalyticsData(),
    };
}

function getValidatedTrustrootsUsernameFromStorage(pubkey) {
    if (!pubkey) return '';
    try {
        const raw = localStorage.getItem('trustroots_username_by_pubkey');
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return '';
        return normalizeNrWebAnalyticsTrustrootsUsername(parsed[String(pubkey).toLowerCase()] || '');
    } catch (_) {
        return '';
    }
}

function getCurrentTrustrootsUsernameForAnalytics() {
    const usernameInput = document.getElementById('trustroots-username');
    const inputUsername = usernameInput && usernameInput.disabled
        ? normalizeNrWebAnalyticsTrustrootsUsername(usernameInput.value)
        : '';
    return (
        inputUsername ||
        normalizeNrWebAnalyticsTrustrootsUsername(pubkeyToUsername.get(currentPublicKey)) ||
        getValidatedTrustrootsUsernameFromStorage(currentPublicKey)
    );
}

function getCurrentTrustrootsUsernameAnalyticsData(usernameOverride) {
    const trustrootsUsername =
        normalizeNrWebAnalyticsTrustrootsUsername(usernameOverride) ||
        getCurrentTrustrootsUsernameForAnalytics();
    return trustrootsUsername ? { trustroots_username: trustrootsUsername } : {};
}

function getConnectableRelayUrls(relayUrls) {
    return (relayUrls || []).filter((url) => {
        if (!isRestrictedRelayUrl(url)) return true;
        return canUseRestrictedRelay();
    });
}

function reconnectRestrictedRelayIfEligible() {
    const relayUrls = getRelayUrls();
    const hasRestrictedRelay = relayUrls.some((url) => isRestrictedRelayUrl(url));
    if (!hasRestrictedRelay || !canUseRestrictedRelay()) return;
    const restrictedStatus = relayStatus.get(TRUSTROOTS_RESTRICTED_RELAY_URL);
    if (restrictedStatus?.status === 'connected') return;
    initializeNDK();
}

function saveRelays() {
    const urls = Array.from(relayStatus.keys());
    if (relaySettings?.saveRelayUrls) {
        relaySettings.saveRelayUrls(urls);
    } else {
        relayUrlsStore.write(urls);
    }
    trackNrWebEvent('nr_relays_saved', {
        relay_count: urls.length,
        status: 'success',
        surface: 'settings',
        ...getCurrentTrustrootsUsernameAnalyticsData(),
    });
    showStatus('Relays saved! Reconnecting...', 'info');
    scheduleHeaderKpiRefresh();
    initializeNDK();
}

function updateRelayStatus(url, status, canWrite = null) {
    const current = relayStatus.get(url) || { status: 'disconnected', canWrite: false };
    relayStatus.set(url, {
        status: status,
        canWrite: canWrite !== null ? canWrite : current.canWrite
    });
    renderRelaysList();
    scheduleHeaderKpiRefresh();
}

function setRelayWriteEnabled(url, enabled) {
    relayWriteEnabled.set(url, enabled);
    const current = relayStatus.get(url) || { status: 'disconnected', canWrite: false };
    relayStatus.set(url, { ...current, canWrite: enabled });
    saveRelayWritePreferences();
    renderRelaysList();
    updateNoteComposePostingIcon();
    updateClaimRelayScopeRow();
}

function toggleRelayWriteForEncodedUrl(encodedUrl, enabled) {
    try {
        const url = decodeURIComponent(encodedUrl);
        setRelayWriteEnabled(url, enabled);
    } catch (_) {}
}

function renderRelayPostWarning(container, urls) {
    if (!container) return;
    if (relaySettings?.renderRelayPostWarnings) {
        relaySettings.renderRelayPostWarnings(container, urls, relayWriteEnabled, {
            disabledWarningId: 'relay-post-disabled-warning',
            publicWarningId: 'relay-post-public-warning',
            disabledClassName: 'status error',
            publicClassName: 'status info',
            disabledMessage: 'Posting is off. Enable "Post" for at least one relay so you can publish notes. You can still read notes.',
            publicMessage: 'Public posting is enabled for at least one network. Anything you post there is visible to anyone.'
        });
        return;
    }
}

function renderRelaysList() {
    const container = document.getElementById('relays-list');
    if (!container) return;
    const urls = getRelayUrls();
    renderRelayPostWarning(container, urls);
    if (relaySettings?.renderRelaysList) {
        relaySettings.renderRelaysList(container, {
            urls,
            statusMap: relayStatus,
            relayWriteEnabledMap: relayWriteEnabled,
            requireSigningForConnected: true,
            hasSigningCapability: hasRelayAuthSigningCapability(),
            allowPostToggle: true,
            allowRemove: true,
            removeHandlerName: 'removeRelay',
            toggleHandlerName: 'toggleRelayWriteForEncodedUrl',
            removeButtonLabel: 'DELETE',
            emptyMessage: 'No relays configured',
            showLocalPrivacyHint: true
        });
        updateNoteComposePostingIcon();
        return;
    }
    updateNoteComposePostingIcon();
}

function addRelay() {
    const input = document.getElementById('new-relay-url');
    let url = input.value.trim();
    
    if (!url) {
        showStatus('Please enter a relay URL', 'error');
        return;
    }
    if (relaySettings?.normalizeRelayUrlInput) {
        const normalized = relaySettings.normalizeRelayUrlInput(url, 'ws');
        if (!normalized.ok) {
            showStatus('Relay URL must start with ws:// or wss://', 'error');
            return;
        }
        url = normalized.value;
    } else {
        // Normalize: if user entered host:port (e.g. localhost:7777), use ws:// so local relays work
        if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
            if (url.includes('://')) {
                showStatus('Relay URL must start with ws:// or wss://', 'error');
                return;
            }
            url = 'ws://' + url;
        }
    }
    
    const urls = getRelayUrls();
    if (urls.includes(url)) {
        showStatus('Relay already exists', 'error');
        return;
    }
    
    // Add to status tracking
    const canWrite = getDefaultRelayPostEnabled(url);
    relayStatus.set(url, { status: 'disconnected', canWrite });
    relayWriteEnabled.set(url, canWrite);
    
    // Save to localStorage
    const allUrls = [...urls, url];
    if (relaySettings?.saveRelayUrls) {
        relaySettings.saveRelayUrls(allUrls);
    } else {
        relayUrlsStore.write(allUrls);
    }
    saveRelayWritePreferences();
    
    input.value = '';
    renderRelaysList();
    scheduleHeaderKpiRefresh();
    showStatus('Relay added! Reconnecting...', 'info');
    trackNrWebEvent('nr_relays_saved', {
        relay_count: allUrls.length,
        source: 'add',
        status: 'success',
        surface: 'settings',
        ...getCurrentTrustrootsUsernameAnalyticsData(),
    });
    initializeNDK();
}

function removeRelay(url) {
    if (!confirm(`Remove relay ${url}?`)) {
        return;
    }

    const removedCacheNotesCount = removeRelayOnlyMapNotesFromCache(url);
    
    // Remove from status tracking
    relayStatus.delete(url);
    relayWriteEnabled.delete(url);
    
    // Remove from localStorage
    const urls = getRelayUrls().filter(u => u !== url);
    if (relaySettings?.saveRelayUrls) {
        relaySettings.saveRelayUrls(urls);
    } else if (urls.length > 0) {
        relayUrlsStore.write(urls);
    } else {
        relayUrlsStore.clear();
    }
    saveRelayWritePreferences();
    
    renderRelaysList();
    scheduleHeaderKpiRefresh();
    if (removedCacheNotesCount > 0) {
        showStatus(`Relay removed! Cleared ${removedCacheNotesCount} cached note${removedCacheNotesCount === 1 ? '' : 's'} from that relay. Reconnecting...`, 'info');
    } else {
        showStatus('Relay removed! Reconnecting...', 'info');
    }
    trackNrWebEvent('nr_relays_saved', {
        relay_count: urls.length,
        source: 'remove',
        status: 'success',
        surface: 'settings',
        ...getCurrentTrustrootsUsernameAnalyticsData(),
    });
    initializeNDK();
}

// Browser notifications (only work while this tab is open).
// Nostr: we use the same map-note stream as the map (kind 30397). Subscribed plus codes
// are stored in IndexedDB (see nr-web-kv-idb.js). This ingest includes NIP-42 auth-relay 30397 reads
// and public-relay 30397/30398 reads. When a new 30397 event arrives and its plus code
// matches a subscribed area, we show a browser Notification. No kind 10395, no server.
// nr-app differs: it publishes kind 10395 (encrypted for the notification server) with
// push tokens + Nostr filters; the server subscribes to kind 30398 (reposts) per filter
// and sends push when matching events appear. So nr-web = same notes, local-only UI;
// nr-app = 10395 + push server + 30398 filters for delivery when app is closed.
// notificationsEnabledStore (module-scope) owns the storage key 'notifications_enabled'.
const NOTIFICATIONS_ENABLED_KEY = notificationsEnabledStore.KEY;
let pendingNotificationPlusCode = null;
let notificationTestStatus = null;

function getNotificationPlusCodes() {
    if (_nrKvNotificationCodes !== null) return _nrKvNotificationCodes;
    return readNotificationPlusCodesSnapshot();
}

function saveNotificationPlusCodes(codes) {
    _nrKvNotificationCodes = Array.isArray(codes) ? codes : [];
    writeNotificationPlusCodesSnapshot(_nrKvNotificationCodes);
    void ensureNrWebKvPrefsHydrated()
        .then(() => nrWebKvPut(NR_WEB_KV_KEYS.NOTIFICATION_PLUS_CODES, _nrKvNotificationCodes))
        .catch((e) => console.warn('Failed to persist notification plus codes:', e));
}

function addNotificationPlusCode(plusCode) {
    const codes = getNotificationPlusCodes();
    if (codes.includes(plusCode)) return;
    saveNotificationPlusCodes([...codes, plusCode]);
    scheduleHeaderKpiRefresh();
    if (document.getElementById('settings-modal')?.classList.contains('active')) {
        renderSettingsNotificationsSection();
    }
}

function removeNotificationPlusCode(plusCode) {
    saveNotificationPlusCodes(getNotificationPlusCodes().filter(c => c !== plusCode));
    scheduleHeaderKpiRefresh();
    if (document.getElementById('settings-modal')?.classList.contains('active')) {
        renderSettingsNotificationsSection();
    }
}

function isSubscribedToPlusCode(plusCode) {
    const codes = getNotificationPlusCodes();
    const exact = codes.includes(plusCode);
    const parentMatch = codes.some(sub => isPlusCodeInsidePlusCode(sub, plusCode));
    return { exact, parentMatch };
}

function isNotificationsEnabled() {
    return notificationsEnabledStore.read();
}

function setNotificationsEnabled(enabled) {
    notificationsEnabledStore.write(enabled);
}

function requestNotificationPermission() {
    if (!('Notification' in window)) {
        renderSettingsNotificationsSection();
        return;
    }
    if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
        renderSettingsNotificationsSection();
        return;
    }
    const promise = Notification.requestPermission();
    const onResult = (p) => {
        setNotificationsEnabled(p === 'granted');
        renderSettingsNotificationsSection();
    };
    if (promise && typeof promise.then === 'function') {
        promise.then(onResult).catch(() => renderSettingsNotificationsSection());
    } else {
        onResult(Notification.permission);
    }
}

function showNoteNotification(event, plusCode) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!isNotificationsEnabled()) return;
    const subscribed = getNotificationPlusCodes();
    if (subscribed.length === 0) return;
    const matches = subscribed.some(sub => sub === plusCode || isPlusCodeInsidePlusCode(sub, plusCode));
    if (!matches) return;
    if (document.visibilityState === 'visible') return;
    
    const nip5ForNote = pubkeyToNip05.get(event.pubkey);
    const username =
        (nip5ForNote && isTrustrootsNip05Lower(nip5ForNote)
            ? nip5ForNote
            : pubkeyToUsername.get(event.pubkey)) ||
        (event.pubkey || '').substring(0, 12) + '…';
    const body = (event.content || '').slice(0, 80) + ((event.content || '').length > 80 ? '…' : '');
    const n = new Notification('New note at ' + (plusCode || 'map'), {
        body: username + (body ? ': ' + body : ''),
        icon: 'favicon.ico',
        tag: 'nostroots-note-' + (plusCode || 'map')
    });
    n.onclick = () => {
        pendingNotificationPlusCode = plusCode;
        window.focus();
        n.close();
    };
}

function notificationPlusCodeJsArg(plusCode) {
    return String(plusCode || '')
        .replace(/&/g, '&amp;')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderNotificationSubscribedAreas(codes) {
    const uniqueCodes = Array.from(new Set(
        (Array.isArray(codes) ? codes : [])
            .map(code => String(code || '').trim())
            .filter(Boolean)
    ));
    if (uniqueCodes.length === 0) {
        return `
            <div class="notification-area-empty">
                No subscribed areas yet. Open an area on the map and use Subscribe to add it here.
            </div>
        `;
    }
    return `
        <div class="notification-area-list" aria-label="Subscribed notification areas">
            ${uniqueCodes.map((code) => {
                const escapedCode = escapeHtml(code);
                const codeArg = notificationPlusCodeJsArg(code);
                return `
                    <div class="notification-area-item">
                        <button type="button" class="notification-area-code" onclick="openNotificationSubscribedArea('${codeArg}')">${escapedCode}</button>
                        <button type="button" class="notification-area-remove" onclick="removeNotificationPlusCode('${codeArg}')">Remove</button>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function openNotificationSubscribedArea(plusCode) {
    const code = String(plusCode || '').trim();
    if (!code) return;
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.remove('active');
    showNotesForPlusCode(code);
}

function setNotificationTestStatus(message, type = 'info') {
    notificationTestStatus = message ? { message: String(message), type } : null;
    const statusEl = document.getElementById('notification-test-status');
    if (!statusEl || !notificationTestStatus) return;
    statusEl.textContent = notificationTestStatus.message;
    statusEl.className = `notification-test-status ${notificationTestStatus.type === 'error' ? 'error' : 'info'}`;
}

function renderNotificationTestStatus() {
    if (!notificationTestStatus) return '';
    const statusType = notificationTestStatus.type === 'error' ? 'error' : 'info';
    return `<p id="notification-test-status" class="notification-test-status ${statusType}" aria-live="polite">${escapeHtml(notificationTestStatus.message)}</p>`;
}

async function sendTestNotification() {
    if (!('Notification' in window)) {
        const message = 'This browser does not support notifications.';
        setNotificationTestStatus(message, 'error');
        showStatus(message, 'error');
        return;
    }
    let permission = Notification.permission;
    if (permission === 'default' && typeof Notification.requestPermission === 'function') {
        setNotificationTestStatus('Waiting for browser permission...', 'info');
        try {
            permission = await Notification.requestPermission();
            setNotificationsEnabled(permission === 'granted');
        } catch (_) {
            permission = Notification.permission;
        }
        renderSettingsNotificationsSection();
    }
    if (permission !== 'granted') {
        const message = permission === 'denied'
            ? 'Notifications are blocked. Allow them in your browser site settings, then try again.'
            : 'Notification permission was not granted.';
        setNotificationTestStatus(message, 'error');
        showStatus(message, 'error');
        renderSettingsNotificationsSection();
        return;
    }
    try {
        const notification = new Notification('Nostroots test notification', {
            body: 'Notifications are working while this tab is open.',
            icon: 'favicon.ico',
            tag: 'nostroots-test-notification'
        });
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        const message = 'Test notification sent. If no popup appears, check browser or system notification settings.';
        setNotificationTestStatus(message, 'info');
        showStatus('Test notification sent.', 'success');
    } catch (error) {
        const message = error?.message || 'Could not send test notification.';
        setNotificationTestStatus(message, 'error');
        showStatus(message, 'error');
    }
}

function renderSettingsNotificationsSection() {
    const el = document.getElementById('settings-notifications-section');
    if (!el) return;
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    const enabled = isNotificationsEnabled();
    const codes = getNotificationPlusCodes();
    const count = codes.length;
    const testDisabled = !('Notification' in window) || perm === 'denied';
    const testTitle = perm === 'default'
        ? 'Ask for permission, then send a test notification'
        : perm === 'denied'
            ? 'Allow notifications in browser site settings first'
            : 'Send a test notification';
    el.innerHTML = `
        <h2>Notifications</h2>
        <p class="notifications-tab-notice" style="color: var(--muted-foreground); font-size: 0.875rem; margin-bottom: 0.75rem;">
            Notifications only work while this tab is open. You won't get alerts when the tab is closed.
        </p>
        <p style="font-size: 0.875rem; margin-bottom: 0.5rem;">Permission: ${perm}. Subscribed areas: ${count}.</p>
        ${perm === 'default' ? '<p style="font-size: 0.875rem; margin-bottom: 0.5rem; color: var(--muted-foreground);">Click Enable to allow this site to show notifications.</p>' : ''}
        ${perm === 'denied' ? '<p style="font-size: 0.875rem; margin-bottom: 0.5rem; color: var(--muted-foreground);">Notifications are blocked. Use your browser’s site settings (e.g. lock or info icon in the address bar) to allow notifications, then refresh.</p>' : ''}
        <div class="notification-actions">
            ${perm !== 'granted' ? `
                <button class="btn" onclick="requestNotificationPermission()">Enable notifications</button>
            ` : `
                ${enabled ? '<button class="btn" onclick="setNotificationsEnabled(false); renderSettingsNotificationsSection();">Disable notifications</button>' : '<button class="btn" onclick="setNotificationsEnabled(true); renderSettingsNotificationsSection();">Turn notifications on</button>'}
            `}
            <button class="btn btn-secondary" onclick="sendTestNotification()" ${testDisabled ? 'disabled' : ''} title="${escapeHtml(testTitle)}">Test notification</button>
        </div>
        ${renderNotificationTestStatus()}
        <div class="notification-area-section">
            <h3>Subscribed areas</h3>
            ${renderNotificationSubscribedAreas(codes)}
        </div>
    `;
}

function renderNotificationSubscribeBlock(plusCode) {
    const block = document.getElementById('notification-subscribe-block');
    if (!block || !plusCode) return;
    const { exact, parentMatch } = isSubscribedToPlusCode(plusCode);
    const plusCodeAttr = (plusCode || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    if (exact) {
        block.innerHTML = `<button class="btn" onclick="removeNotificationPlusCode('${plusCodeAttr}'); renderNotificationSubscribeBlock('${plusCodeAttr}'); showNotesForPlusCode('${plusCodeAttr}');">Unsubscribe</button>`;
        block.style.display = '';
    } else if (parentMatch) {
        block.innerHTML = '<span style="font-size: 0.8rem; color: var(--muted-foreground);">Subscribed via parent area</span>';
        block.style.display = '';
    } else {
        block.innerHTML = `<button class="btn" onclick="addNotificationPlusCode('${plusCodeAttr}'); renderNotificationSubscribeBlock('${plusCodeAttr}'); showNotesForPlusCode('${plusCodeAttr}');">Subscribe</button>`;
        block.style.display = '';
    }
}

// Load cached events on initialization
async function loadCachedEvents() {
    const [cachedEvents] = await Promise.all([
        loadEventsFromCache(),
        loadProfilesFromCache(),
        ensureNrWebKvPrefsHydrated()
    ]);
    if (cachedEvents && cachedEvents.length > 0) {
        events = cachedEvents;
        cachedFilteredEvents = null; // Invalidate filtered events cache
        filteredEventsCacheKey = null;
        rebuildSpatialIndex(); // Build spatial index for cached events
        // If plus-code modal was opened from hash before events loaded, refresh it now

        if (isHostSurfaceOpen() && selectedPlusCode) {
            showNotesForPlusCode(selectedPlusCode);
        }
        // Update UI with cached events
        if (map && map.loaded()) {
            updateMapMarkers();
            updatePlusCodeGrid();
        } else if (map) {
            // Wait for map to load, then update
            map.once('load', () => {
                updateMapMarkers();
                updatePlusCodeGrid();
            });
        }
        headerKpisHydrated = true;
        scheduleHeaderKpiRefresh();
        return true;
    }
    headerKpisHydrated = true;
    scheduleHeaderKpiRefresh();
    return false;
}

async function initializeNDK() {
    // NDK is disabled (const NDK = null). If re-enabled, every subscription path must
    // support NIP-42 AUTH on wss://nip42.trustroots.org or reads/writes will fail there.
    const relayUrls = getRelayUrls();
    const connectableRelayUrls = getConnectableRelayUrls(relayUrls);
    startWsMapSubscriptions(connectableRelayUrls);
    // Initialize relays
    
    // Initialize status for all relays
    relayUrls.forEach(url => {
        if (!relayStatus.has(url)) {
            relayStatus.set(url, { status: 'connecting', canWrite: relayWriteEnabled.get(url) !== false });
            relayWriteEnabled.set(url, relayWriteEnabled.get(url) !== false);
        } else {
            updateRelayStatus(url, 'connecting');
        }
    });
    relayUrls.forEach((url) => {
        if (isRestrictedRelayUrl(url) && !canUseRestrictedRelay()) {
            updateRelayStatus(url, 'disconnected', false);
        }
    });
    renderRelaysList();
    
    try {
        if (NDK) {
            // Use NDK if available
            ndk = new NDK({
                explicitRelayUrls: connectableRelayUrls
            });
            
            await ndk.connect();
            
            // Update status for all relays (NDK manages connections internally)
            // Note: NDK doesn't provide per-relay status, so we assume all are connected
            let connectedCount = 0;
            connectableRelayUrls.forEach(url => {
                // Try to check if relay is actually connected via NDK pool
                try {
                    const relay = ndk.pool?.relays?.get(url);
                    if (relay && relay.status === 1) {
                        updateRelayStatus(url, 'connected', relayWriteEnabled.get(url) !== false);
                        connectedCount++;
                    } else {
                        updateRelayStatus(url, 'connecting', relayWriteEnabled.get(url) !== false);
                    }
                } catch (e) {
                    // If we can't check, assume connected (NDK manages this)
                    updateRelayStatus(url, 'connected', relayWriteEnabled.get(url) !== false);
                    connectedCount++;
                }
            });
            
            if (connectedCount > 0) {
                if (!window._nostrootsSuppressConnectionToasts) showStatus(`Connected to ${connectedCount} of ${relayUrls.length} relays`, 'success', { id: 'relay-connection-status' });
            } else {
                if (!window._nostrootsSuppressConnectionToasts) showStatus('Connecting to relays...', 'info', { id: 'relay-connection-status' });
            }
            
            // Start subscribing to events
            subscribeToEvents();
            subscribeToPlusCodePrefixes();
        } else {
            // Fallback to direct Relay connections
            await initializeRelays(relayUrls);
        }
    } catch (error) {
        console.error('[NDK] Error initializing NDK:', error.message || error);
        // Fallback to direct relays
        if (!window._nostrootsSuppressConnectionToasts) showStatus('Retrying relay connections...', 'info', { id: 'relay-connection-status' });
        await initializeRelays(relayUrls);
    }
    await setupIndexNrWebThemeSync();
}

async function initializeRelays(relayUrls) {
    const gen = ++relayConnectGeneration;
    clearRelayFailureToastTimeout();
    relayKeepAliveIntervalIds.forEach((id) => {
        try { clearInterval(id); } catch (_) {}
    });
    relayKeepAliveIntervalIds = [];
    closeRelaysArray(relays);
    relays = [];
    const connectableRelayUrls = getConnectableRelayUrls(relayUrls);
    startWsMapSubscriptions(connectableRelayUrls);
    
    // Initialize status for all relays
    relayUrls.forEach(url => {
        if (!relayStatus.has(url)) {
            relayStatus.set(url, { status: 'connecting', canWrite: relayWriteEnabled.get(url) !== false });
            relayWriteEnabled.set(url, relayWriteEnabled.get(url) !== false);
        } else {
            updateRelayStatus(url, 'connecting');
        }
    });
    relayUrls.forEach((url) => {
        if (isRestrictedRelayUrl(url) && !canUseRestrictedRelay()) {
            updateRelayStatus(url, 'disconnected', false);
        }
    });
    renderRelaysList();
    const relayAuth = window.NrWebRelayAuth;
    
    for (const url of connectableRelayUrls) {
        try {
            if (isRestrictedRelayUrl(url) && relayAuth?.startNip42WsSubscription) {
                continue;
            }
            updateRelayStatus(url, 'connecting');
            const relay = await Relay.connect(url);
            if (gen !== relayConnectGeneration) {
                try { relay.close(); } catch (_) {}
                continue;
            }
            relays.push(relay);
            // Ensure relayWriteEnabled is set before updating status
            if (!relayWriteEnabled.has(url)) {
                relayWriteEnabled.set(url, true);
            }
            // Set status to connected immediately after successful connection
            updateRelayStatus(url, 'connected', relayWriteEnabled.get(url) !== false);
            
            let didResubscribeAfterAuth = false;
            const subscribeToRelayReads = () => {
                if (gen !== relayConnectGeneration) return;
                // Subscribe to events - profiles/deletions plus map notes and reposts.
                const kinds = getMapRelayReadKinds();
                
                // First, do a direct query for map note events to see how many exist
                let directQueryCount = 0;
                const directQuery = relay.subscribe([buildMapNoteFilter()], {
                    onevent: (event) => {
                        directQueryCount++;
                        // Process these events too
                        processIncomingEvent(event, url);
                    },
                    oneose: () => {
                        directQuery.close();
                    }
                });
                
                // Also subscribe to all kinds to get other events
                const sub = relay.subscribe([{ kinds }], {
                    onevent: (event) => {
                        // Debug: Uncomment to see all received events
                        // console.log('[Relay] Received event:', event.kind, event.id?.substring(0, 16));
                        processIncomingEvent(event, url);
                    },
                    oneose: () => {
                        // EOSE received
                    }
                });
                
                // Query for existing kind 10390 profile events to populate username map
                const profileQuery = relay.subscribe([{ kinds: [TRUSTROOTS_PROFILE_KIND] }], {
                    onevent: (event) => {
                        processIncomingEvent(event, url);
                    },
                    oneose: () => {
                        profileQuery.close();
                    }
                });
            };

            setupRelayAuthHandler(relay, url, {
                onAuthenticated: () => {
                    if (gen !== relayConnectGeneration) return;
                    // NIP-42 relays may reject REQ before AUTH completes.
                    // Mirror nip42 test client behavior by issuing read REQs again after AUTH.
                    if (!didResubscribeAfterAuth) {
                        didResubscribeAfterAuth = true;
                        subscribeToRelayReads();
                    }
                }
            });
            
            subscribeToRelayReads();
            
            // Note: nostr-tools Relay doesn't expose a .status property we can check
            // Once connected, we trust the connection is good until we get a publish error
            
            // Keep subscription alive
            const keepAliveId = setInterval(() => {
                if (gen !== relayConnectGeneration) return;
                if (relay.status === 1) { // OPEN
                    relay.subscribe([buildMapRelayKeepAliveFilter()], {
                        onevent: () => {},
                        oneose: () => {}
                    });
                }
            }, 30000); // Every 30 seconds
            relayKeepAliveIntervalIds.push(keepAliveId);
        } catch (error) {
            console.error(`[Relay] Error connecting to ${url}:`, error.message || error);
            if (gen === relayConnectGeneration) {
                updateRelayStatus(url, 'error', false);
            }
        }
    }
    
    if (gen !== relayConnectGeneration) return;

    // Show summary message
    const connectedCount = getConnectedRelayCount(relayUrls);
    const totalCount = relayUrls.length;
    if (connectedCount > 0) {
        clearRelayFailureToastTimeout();
        if (!window._nostrootsSuppressConnectionToasts) {
            showStatus(`Connected to ${connectedCount} of ${totalCount} relays`, 'success', { id: 'relay-connection-status' });
        }
        // Subscribe to plus code prefixes
        subscribeToPlusCodePrefixes();
    } else {
        clearRelayFailureToastTimeout();
        relayFailureToastTimeoutId = setTimeout(() => {
            relayFailureToastTimeoutId = null;
            if (gen !== relayConnectGeneration) return;
            if (getConnectedRelayCount(relayUrls) > 0) return;
            if (window._nostrootsSuppressConnectionToasts) return;
            showStatus(`Failed to connect to any relays`, 'error', { id: 'relay-connection-status' });
        }, RELAY_FAILURE_TOAST_GRACE_MS);
    }
}

function subscribeToEvents() {
    if (ndk) {
        // Use NDK subscription - profiles/deletions plus map notes and reposts.
        const filter = buildMapRelayReadFilter();
        
        try {
            const subscription = ndk.subscribe(filter, { closeOnEose: false });
            
            subscription.on('event', (event) => {
                // NDK event might have rawEvent() method or be the event itself
                const rawEvent = event.rawEvent ? event.rawEvent() : event;
                console.log('[NDK] Received event:', rawEvent.kind, rawEvent.id?.substring(0, 16));
                processIncomingEvent(rawEvent);
            });
        } catch (error) {
            console.error('Error setting up NDK subscription:', error);
            // Fallback to direct relays (void: overlaps initializeNDK; generation guard dedupes pool)
            const relayUrls = getRelayUrls();
            void initializeRelays(relayUrls).catch((e) => console.error('[Relay] initializeRelays fallback failed:', e?.message || e));
        }
    }
    // Direct relay subscriptions are handled in initializeRelays
}

// Subscribe to plus code prefixes for better event discovery
function subscribeToPlusCodePrefixes() {
    if (!ndk && relays.length === 0) return;
    
    // Get current map bounds to determine which plus codes to subscribe to
    if (!map || !map.loaded()) {
        // Subscribe to a broad set initially (common areas)
        const prefixes = ['8C000000+', '8F000000+', '8G000000+', '9C000000+', '9F000000+', '9G000000+'];
        subscribeToPlusCodes(prefixes);
    } else {
        // Subscribe based on current view
        const bounds = map.getBounds();
        const regionBounds = {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
        };
        const codeLength = 4; // Use 4-character codes for subscription
        const visiblePlusCodes = allPlusCodesForRegion(regionBounds, codeLength);
        const prefixes = visiblePlusCodes.map(code => {
            const clean = code.replace('+', '').substring(0, 4);
            return clean.padEnd(8, '0') + '+';
        });
        // Limit to avoid too many subscriptions
        const limitedPrefixes = prefixes.slice(0, 50);
        subscribeToPlusCodes(limitedPrefixes);
    }
}

function subscribeToPlusCodes(prefixes) {
    if (prefixes.length === 0) return;
    
    // Subscribe to both map note kinds for plus code subscriptions
    const kinds = MAP_NOTE_KINDS;
    
    // Create filters for plus code prefixes
    // Note: NDK and nostr-tools use different filter formats
    // For nostr-tools, we need to filter by 'l' tag with 'open-location-code-prefix' as the third element
    // Since we can't directly filter by the third element in nostr-tools, we'll use a broader filter
    // and filter client-side, or use the prefix values directly
    // Note: This subscription is in addition to the main subscription, not a replacement
    // The main subscription should already be getting all events
    const filters = [{
        kinds: kinds,
        '#l': prefixes
    }];
    
    if (ndk) {
        try {
            const subscription = ndk.subscribe(filters, { closeOnEose: false });
            subscription.on('event', (event) => {
                const rawEvent = event.rawEvent ? event.rawEvent() : event;
                processIncomingEvent(rawEvent);
            });
        } catch (error) {
            console.error('Error subscribing to plus codes:', error);
        }
    } else {
        // Use direct relay subscriptions
        // Note: This is an additional subscription for plus code filtering
        // The main subscription in initializeRelays should already be getting all events
        relays.forEach(relay => {
            if (relay.status === 1) { // OPEN
                try {
                    relay.subscribe(filters, {
                        onevent: (event) => {
                            processIncomingEvent(event, relay.url || '');
                        },
                        oneose: () => {
                            // EOSE received
                        }
                    });
                } catch (error) {
                    console.error('Error subscribing to relay:', error);
                }
            }
        });
    }
}

// Get storage ID for an event (matches nr-app logic)
function getStorageId(event) {
    const { id, kind, pubkey } = event;
    
    // Replaceable events
    if (kind === 0 || (kind >= 10000 && kind < 20000)) {
        return `${pubkey}:${kind}`;
    }
    
    // Parameterized replaceable events (kind 30397, 30398, etc.)
    if (kind >= 30000 && kind < 40000) {
        const dTag = event.tags.find(([tagName]) => tagName === 'd');
        if (dTag && dTag.length > 1) {
            const tagValue = dTag[1];
            if (typeof tagValue === 'string' && tagValue.length > 0) {
                return `${pubkey}:${kind}:${tagValue}`;
            }
        }
        // For parameterized replaceable events without a valid "d" tag,
        // use the event ID to ensure each event is stored separately
        return id;
    }
    
    return id;
}

function normalizedRelayUrlForCache(url) {
    return String(url || '').trim().toLowerCase();
}

function collectRelayUrlsForEvent(existingEvent, incomingEvent, sourceRelayUrl) {
    const out = new Set();
    const addMany = (arr) => {
        if (!Array.isArray(arr)) return;
        for (const raw of arr) {
            const normalized = normalizedRelayUrlForCache(raw);
            if (normalized) out.add(normalized);
        }
    };
    const addOne = (raw) => {
        const normalized = normalizedRelayUrlForCache(raw);
        if (normalized) out.add(normalized);
    };
    addMany(existingEvent?._nrRelayUrls);
    addMany(incomingEvent?._nrRelayUrls);
    addOne(existingEvent?._nrCollectRelay);
    addOne(incomingEvent?._nrCollectRelay);
    addOne(sourceRelayUrl);
    return Array.from(out);
}

function removeRelayOnlyMapNotesFromCache(relayUrl) {
    const normalizedRelayUrl = normalizedRelayUrlForCache(relayUrl);
    if (!normalizedRelayUrl || !Array.isArray(events) || events.length === 0) return 0;
    let removedCount = 0;
    let changed = false;
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (!event || !MAP_NOTE_KINDS.includes(event.kind)) continue;
        const relayUrls = Array.isArray(event._nrRelayUrls)
            ? event._nrRelayUrls.map((u) => normalizedRelayUrlForCache(u)).filter(Boolean)
            : [];
        const hasRelayListMatch = relayUrls.includes(normalizedRelayUrl);
        const hasCollectRelayMatch = normalizedRelayUrlForCache(event._nrCollectRelay) === normalizedRelayUrl;
        if (!hasRelayListMatch && !hasCollectRelayMatch) continue;
        if (relayUrls.length > 1) {
            const nextRelayUrls = relayUrls.filter((u) => u !== normalizedRelayUrl);
            event._nrRelayUrls = nextRelayUrls;
            if (!nextRelayUrls.includes(normalizedRelayUrlForCache(event._nrCollectRelay))) {
                if (nextRelayUrls.length > 0) {
                    event._nrCollectRelay = nextRelayUrls[0];
                } else {
                    delete event._nrCollectRelay;
                }
            }
            changed = true;
            continue;
        }
        events.splice(i, 1);
        removedCount++;
        changed = true;
    }
    if (changed) {
        cachedFilteredEvents = null;
        filteredEventsCacheKey = null;
        rebuildSpatialIndex();
        updateMapMarkers();
        if (map && map.loaded()) {
            updatePlusCodeGrid();
        }

        if (isHostSurfaceOpen() && selectedPlusCode) {
            showNotesForPlusCode(selectedPlusCode);
        }
        void flushMapCacheToIndexedDB().catch((e) => console.warn('flushMapCacheToIndexedDB:', e));
    }
    return removedCount;
}

function removeLegacyEventsLocalStorageCache() {
    try {
        localStorage.removeItem(EVENTS_CACHE_KEY);
        localStorage.removeItem(EVENTS_CACHE_TIMESTAMP_KEY);
    } catch (_) {}
}

function slimEventForCache(event) {
    if (!event || typeof event !== 'object') return null;
    const out = {
        id: event.id,
        pubkey: event.pubkey,
        kind: event.kind,
        created_at: event.created_at,
        content: event.content != null ? String(event.content) : '',
        tags: Array.isArray(event.tags) ? event.tags : []
    };
    if (typeof event._nrCollectRelay === 'string' && event._nrCollectRelay) {
        out._nrCollectRelay = event._nrCollectRelay;
    }
    if (Array.isArray(event._nrRelayUrls) && event._nrRelayUrls.length > 0) {
        out._nrRelayUrls = event._nrRelayUrls.map((u) => String(u || '').trim()).filter(Boolean);
    }
    return out;
}

function isStorageQuotaError(err) {
    return !!(err && (err.name === 'QuotaExceededError' || err.code === 22));
}

function openNrMapCacheDB() {
    if (nrMapCacheDbPromise) return nrMapCacheDbPromise;
    nrMapCacheDbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            nrMapCacheDbPromise = null;
            reject(new Error('indexedDB unavailable'));
            return;
        }
        const req = indexedDB.open(NR_MAP_CACHE_DB_NAME, NR_MAP_CACHE_DB_VERSION);
        req.onupgradeneeded = (e) => {
            const idb = e.target.result;
            if (!idb.objectStoreNames.contains(NR_MAP_CACHE_STORE)) {
                idb.createObjectStore(NR_MAP_CACHE_STORE, { keyPath: 'key' });
            }
        };
        req.onerror = () => {
            nrMapCacheDbPromise = null;
            reject(req.error);
        };
        req.onsuccess = () => {
            try {
                removeLegacyEventsLocalStorageCache();
            } catch (_) {}
            resolve(req.result);
        };
    });
    return nrMapCacheDbPromise;
}

function idbPutEventsRecord(db, record) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(NR_MAP_CACHE_STORE, 'readwrite');
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();
        const store = tx.objectStore(NR_MAP_CACHE_STORE);
        const r = store.put(record);
        r.onerror = () => reject(r.error);
    });
}

async function saveEventsToCache() {
    if (eventsCacheWriteSuppressed) return;
    if (typeof indexedDB === 'undefined') return;
    let db;
    try {
        db = await openNrMapCacheDB();
    } catch (e) {
        console.warn('Map cache DB unavailable:', e);
        return;
    }
    const sorted = [...events].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    const len = sorted.length;
    if (len === 0) {
        try {
            await idbPutEventsRecord(db, {
                key: NR_MAP_CACHE_RECORD_KEY,
                events: [],
                timestamp: Date.now()
            });
            eventsCacheWriteSuppressed = false;
            eventsCacheSuppressLogged = false;
        } catch (err) {
            console.warn('Failed to save empty events cache:', err);
        }
        return;
    }
    const caps = [];
    const seen = new Set();
    for (const n of [len, 2000, 1000, 500, 250, 100, 50, 25]) {
        const c = Math.min(len, n);
        if (c >= 1 && !seen.has(c)) {
            seen.add(c);
            caps.push(c);
        }
    }
    for (const cap of caps) {
        const slimmed = sorted
            .slice(-cap)
            .map(slimEventForCache)
            .filter(Boolean);
        const record = {
            key: NR_MAP_CACHE_RECORD_KEY,
            events: slimmed,
            timestamp: Date.now()
        };
        try {
            await idbPutEventsRecord(db, record);
            eventsCacheWriteSuppressed = false;
            eventsCacheSuppressLogged = false;
            return;
        } catch (err) {
            if (!isStorageQuotaError(err)) {
                console.warn('Failed to save events cache:', err);
                return;
            }
        }
    }
    if (!eventsCacheSuppressLogged) {
        console.warn(
            'Map events cache: persistence disabled after repeated quota errors. Live data only until refresh.'
        );
        eventsCacheSuppressLogged = true;
    }
    eventsCacheWriteSuppressed = true;
}

async function loadEventsFromCache() {
    try {
        if (typeof indexedDB === 'undefined') return null;
        const db = await openNrMapCacheDB();
        const row = await new Promise((resolve, reject) => {
            const tx = db.transaction(NR_MAP_CACHE_STORE, 'readonly');
            tx.onerror = () => reject(tx.error);
            const store = tx.objectStore(NR_MAP_CACHE_STORE);
            const req = store.get(NR_MAP_CACHE_RECORD_KEY);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
        });
        if (!row || !Array.isArray(row.events)) return null;
        const age = Date.now() - (row.timestamp || 0);
        if (age > CACHE_MAX_AGE) return null;
        let out = row.events;
        if (NrBlocklist && NrBlocklist.isBlocked) {
            out = out.filter((e) => !NrBlocklist.isBlocked(e.pubkey));
        }
        return out;
    } catch (error) {
        console.warn('Failed to load events from cache:', error);
    }
    return null;
}

async function loadProfilesFromCache() {
    try {
        if (typeof indexedDB === 'undefined') return;
        const db = await openNrMapCacheDB();
        const row = await new Promise((resolve, reject) => {
            const tx = db.transaction(NR_MAP_CACHE_STORE, 'readonly');
            tx.onerror = () => reject(tx.error);
            const store = tx.objectStore(NR_MAP_CACHE_STORE);
            const req = store.get(NR_MAP_CACHE_PROFILES_RECORD_KEY);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
        });
        if (!row || !Array.isArray(row.entries)) return;
        const age = Date.now() - (row.timestamp || 0);
        if (age > CACHE_MAX_AGE) return;
        for (const pair of row.entries) {
            if (!Array.isArray(pair) || pair.length < 2) continue;
            const pk = pair[0];
            const name = pair[1];
            if (typeof pk !== 'string' || typeof name !== 'string' || !name) continue;
            if (NrBlocklist && NrBlocklist.isBlocked && NrBlocklist.isBlocked(pk)) continue;
            pubkeyToUsername.set(pk, name);
        }
        for (const pair of row.nip05Entries || []) {
            if (!Array.isArray(pair) || pair.length < 2) continue;
            const pk = pair[0];
            const n5 = pair[1];
            if (typeof pk !== 'string' || typeof n5 !== 'string' || !n5) continue;
            if (NrBlocklist && NrBlocklist.isBlocked && NrBlocklist.isBlocked(pk)) continue;
            const low = n5.trim().toLowerCase();
            if (isTrustrootsNip05Lower(low)) pubkeyToNip05.set(pk, low);
        }
        for (const pair of row.pictureEntries || []) {
            if (!Array.isArray(pair) || pair.length < 2) continue;
            const pk = pair[0];
            const picRaw = pair[1];
            if (typeof pk !== 'string' || typeof picRaw !== 'string' || !picRaw) continue;
            if (NrBlocklist && NrBlocklist.isBlocked && NrBlocklist.isBlocked(pk)) continue;
            const pic = sanitizeProfileImageUrl(picRaw);
            if (pic) pubkeyToPicture.set(pk, pic);
        }
    } catch (error) {
        console.warn('Failed to load profiles from cache:', error);
    }
}

async function saveProfilesToCache() {
    if (typeof indexedDB === 'undefined') return;
    let db;
    try {
        db = await openNrMapCacheDB();
    } catch (e) {
        console.warn('Map cache DB unavailable (profiles):', e);
        return;
    }
    let entries = Array.from(pubkeyToUsername.entries());
    if (NrBlocklist && NrBlocklist.isBlocked) {
        entries = entries.filter(([pk]) => !NrBlocklist.isBlocked(pk));
    }
    if (entries.length > PROFILE_USERNAME_CACHE_MAX_ENTRIES) {
        entries = entries.slice(-PROFILE_USERNAME_CACHE_MAX_ENTRIES);
    }
    let nip05Entries = Array.from(pubkeyToNip05.entries());
    if (NrBlocklist && NrBlocklist.isBlocked) {
        nip05Entries = nip05Entries.filter(([pk]) => !NrBlocklist.isBlocked(pk));
    }
    if (nip05Entries.length > PROFILE_USERNAME_CACHE_MAX_ENTRIES) {
        nip05Entries = nip05Entries.slice(-PROFILE_USERNAME_CACHE_MAX_ENTRIES);
    }
    let pictureEntries = Array.from(pubkeyToPicture.entries());
    if (NrBlocklist && NrBlocklist.isBlocked) {
        pictureEntries = pictureEntries.filter(([pk]) => !NrBlocklist.isBlocked(pk));
    }
    if (pictureEntries.length > PROFILE_USERNAME_CACHE_MAX_ENTRIES) {
        pictureEntries = pictureEntries.slice(-PROFILE_USERNAME_CACHE_MAX_ENTRIES);
    }
    try {
        await idbPutEventsRecord(db, {
            key: NR_MAP_CACHE_PROFILES_RECORD_KEY,
            entries,
            nip05Entries,
            pictureEntries,
            timestamp: Date.now()
        });
    } catch (err) {
        console.warn('Failed to save profiles cache:', err);
    }
}

/**
 * Slim a Nostr event for storage in the per-pubkey profile page cache.
 * Like {@link slimEventForCache} but preserves `_nrCollectRelay` so cached events
 * keep their relay-origin annotation (used by validation UI / dedupeById tie-break).
 */
function slimEventForProfileCache(event) {
    if (!event || typeof event !== 'object') return null;
    const out = {
        id: event.id,
        pubkey: event.pubkey,
        kind: event.kind,
        created_at: event.created_at,
        content: event.content != null ? String(event.content) : '',
        tags: Array.isArray(event.tags) ? event.tags : []
    };
    if (typeof event._nrCollectRelay === 'string' && event._nrCollectRelay) {
        out._nrCollectRelay = event._nrCollectRelay;
    }
    return out;
}

function profilePageCacheKey(hex) {
    return NR_MAP_CACHE_PROFILE_PAGE_KEY_PREFIX + String(hex || '').toLowerCase();
}

const NR_PROFILE_HOST_MEET_CACHE_KEY_PREFIX = 'nr_profile_host_meet_card_v2:';
const NR_PROFILE_HOST_MEET_CACHE_KEY_PREFIX_V1 = 'nr_profile_host_meet_card_v1:';
const NR_PROFILE_HOST_MEET_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function profileHostMeetCacheKey(hex, keyPrefix = NR_PROFILE_HOST_MEET_CACHE_KEY_PREFIX) {
    return keyPrefix + String(hex || '').toLowerCase();
}

function normalizeProfileHostMeetRow(value) {
    if (!value || typeof value !== 'object') return null;
    const badgeText = String(value.badgeText || '').trim();
    const summary = String(value.summary || '').trim();
    if (!badgeText || !summary) return null;
    const intentIdRaw = value.intentId;
    const intentId = isIntentId(intentIdRaw) ? String(intentIdRaw).trim().toLowerCase() : null;
    return {
        intentId,
        badgeText,
        badgeVariant: String(value.badgeVariant || 'muted'),
        summary,
        dateText: String(value.dateText || ''),
        plusCode: String(value.plusCode || ''),
        source: String(value.source || ''),
    };
}

export function normalizeProfileHostMeetCard(value) {
    if (!value || typeof value !== 'object') return null;
    const title = String(value.title || '').trim() || 'Host & Meet';
    const rowsRaw = Array.isArray(value.rows) ? value.rows : [];
    let rows = rowsRaw.map(normalizeProfileHostMeetRow).filter(Boolean);

    // Backward compatibility: v1 cache had a single summary card shape.
    if (rows.length === 0) {
        const legacyBadgeText = String(value.badgeText || '').trim();
        const legacySummary = String(value.summary || '').trim();
        if (legacyBadgeText && legacySummary) {
            rows = [{
                intentId: null,
                badgeText: legacyBadgeText,
                badgeVariant: String(value.badgeVariant || 'muted'),
                summary: legacySummary,
                dateText: String(value.dateText || ''),
                plusCode: String(value.plusCode || ''),
                source: String(value.source || ''),
            }];
        }
    }

    if (rows.length === 0) return null;
    const lead = rows[0];
    return {
        title,
        badgeText: String(value.badgeText || lead.badgeText || ''),
        badgeVariant: String(value.badgeVariant || lead.badgeVariant || 'muted'),
        summary: String(value.summary || lead.summary || ''),
        dateText: String(value.dateText || lead.dateText || ''),
        plusCode: String(value.plusCode || lead.plusCode || ''),
        source: String(value.source || lead.source || ''),
        rows,
    };
}

function parseProfileHostMeetCacheRecord(raw) {
    if (!raw) return null;
    try {
        const row = JSON.parse(raw);
        const age = Date.now() - Number(row?.timestamp || 0);
        if (!Number.isFinite(age) || age < 0 || age > NR_PROFILE_HOST_MEET_CACHE_MAX_AGE_MS) return null;
        return normalizeProfileHostMeetCard(row?.card);
    } catch (_) {
        return null;
    }
}

function loadProfileHostMeetCardFromCache(hex) {
    const h = String(hex || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) return null;

    const v2 = parseProfileHostMeetCacheRecord(localStorage.getItem(profileHostMeetCacheKey(h)));
    if (v2) return v2;
    return parseProfileHostMeetCacheRecord(
        localStorage.getItem(profileHostMeetCacheKey(h, NR_PROFILE_HOST_MEET_CACHE_KEY_PREFIX_V1))
    );
}

function saveProfileHostMeetCardToCache(hex, card) {
    const h = String(hex || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) return;
    const normalized = normalizeProfileHostMeetCard(card);
    if (!normalized) return;
    try {
        localStorage.setItem(
            profileHostMeetCacheKey(h),
            JSON.stringify({
                timestamp: Date.now(),
                card: {
                    title: normalized.title,
                    badgeText: normalized.badgeText,
                    badgeVariant: normalized.badgeVariant,
                    summary: normalized.summary,
                    dateText: normalized.dateText,
                    plusCode: normalized.plusCode,
                    source: normalized.source,
                    rows: normalized.rows.map((row) => ({
                        intentId: row.intentId,
                        badgeText: row.badgeText,
                        badgeVariant: row.badgeVariant,
                        summary: row.summary,
                        dateText: row.dateText,
                        plusCode: row.plusCode,
                        source: row.source,
                    })),
                },
            })
        );
    } catch (_) {}
}

function profileTrustSummaryCacheKey(hex) {
    return PROFILE_TRUST_SUMMARY_CACHE_KEY_PREFIX + String(hex || '').toLowerCase();
}

function normalizeProfileTrustSummary(value) {
    if (!value || typeof value !== 'object') return null;
    const contactCount = Number.parseInt(value.contactCount, 10);
    const positiveExperienceCount = Number.parseInt(value.positiveExperienceCount, 10);
    const metricRaw = value.threadUpvoteMetricValue ?? value.referenceMetricValue;
    const threadUpvoteMetricValue = metricRaw === null || metricRaw === undefined || metricRaw === ''
        ? null
        : Number.parseInt(metricRaw, 10);
    if (!Number.isFinite(contactCount) || contactCount < 0) return null;
    if (!Number.isFinite(positiveExperienceCount) || positiveExperienceCount < 0) return null;
    if (threadUpvoteMetricValue !== null && (!Number.isFinite(threadUpvoteMetricValue) || threadUpvoteMetricValue < 0)) return null;
    const people = [];
    for (const person of Array.isArray(value.people) ? value.people : []) {
        const hex = String(person?.hex || '').trim().toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(hex)) continue;
        people.push({
            hex,
            username: String(person?.username || '').trim().toLowerCase(),
            sources: Array.isArray(person?.sources) ? person.sources.map((s) => String(s || '')).filter(Boolean) : [],
        });
    }
    return { contactCount, positiveExperienceCount, threadUpvoteMetricValue, people };
}

async function loadProfileTrustSummaryFromCache(hex) {
    const h = String(hex || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) return null;
    const row = normalizeTimedLookup(await nrWebKvGet(profileTrustSummaryCacheKey(h)), PROFILE_TRUST_SUMMARY_CACHE_MAX_AGE_MS);
    if (!row) return null;
    return normalizeProfileTrustSummary(row.value);
}

async function saveProfileTrustSummaryToCache(hex, summary) {
    const h = String(hex || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) return;
    const normalized = normalizeProfileTrustSummary(summary);
    if (!normalized) return;
    const hasAny =
        normalized.contactCount > 0 ||
        normalized.positiveExperienceCount > 0 ||
        shouldShowThreadUpvoteMetric(normalized.threadUpvoteMetricValue) ||
        normalized.people.length > 0;
    if (!hasAny) return;
    await nrWebKvPut(profileTrustSummaryCacheKey(h), { ts: Date.now(), value: normalized });
}

function eventHasPTagForHex(event, hex) {
    const h = String(hex || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) return false;
    return (event?.tags || []).some(
        (tag) => Array.isArray(tag) && tag[0] === 'p' && String(tag[1] || '').toLowerCase() === h
    );
}

function eventPTagsHexSet(event) {
    const out = new Set();
    for (const tag of event?.tags || []) {
        if (!Array.isArray(tag) || tag[0] !== 'p' || !tag[1]) continue;
        const hex = String(tag[1]).toLowerCase();
        if (/^[0-9a-f]{64}$/.test(hex)) out.add(hex);
    }
    return out;
}

function isProfilePageCacheEventScoped(event, hex, bucket) {
    if (!event || typeof event !== 'object') return false;
    const h = String(hex || '').toLowerCase();
    const author = String(event.pubkey || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) return false;
    if (NrBlocklist && NrBlocklist.isBlocked && NrBlocklist.isBlocked(author)) return false;
    if (bucket === 'evAuthors') {
        return (event.kind === 0 || event.kind === TRUSTROOTS_PROFILE_KIND) && author === h;
    }
    if (bucket === 'evP30390') {
        if (event.kind !== PROFILE_CLAIM_KIND) return false;
        const pTags = eventPTagsHexSet(event);
        if (pTags.has(h)) return true;
        if (author !== h) return false;
        // Keep author-scoped events only when they are self/legacy rows
        // without explicit p-targets (or with only self-target p tags).
        if (!pTags.size) return true;
        return pTags.size === 1 && pTags.has(h);
    }
    if (bucket === 'evPClaims') {
        return (
            (
                event.kind === RELATIONSHIP_CLAIM_KIND ||
                event.kind === EXPERIENCE_CLAIM_KIND ||
                event.kind === THREAD_UPVOTE_METRIC_KIND
            ) &&
            eventHasPTagForHex(event, h)
        );
    }
    if (bucket === 'evNotes') {
        return MAP_NOTE_KINDS.includes(event.kind) && author === h;
    }
    if (bucket === 'evHost30398') {
        return event.kind === MAP_NOTE_REPOST_KIND && eventHasPTagForHex(event, h);
    }
    return false;
}

/**
 * Load cached events that power the public profile page for a given pubkey.
 * Returns `null` when the cache is missing, stale, blocklisted, or unreadable.
 */
async function loadProfilePageEventsFromCache(hex) {
    if (typeof indexedDB === 'undefined') return null;
    const h = String(hex || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) return null;
    if (NrBlocklist && NrBlocklist.isBlocked && NrBlocklist.isBlocked(h)) return null;
    try {
        const db = await openNrMapCacheDB();
        const row = await new Promise((resolve, reject) => {
            const tx = db.transaction(NR_MAP_CACHE_STORE, 'readonly');
            tx.onerror = () => reject(tx.error);
            const store = tx.objectStore(NR_MAP_CACHE_STORE);
            const req = store.get(profilePageCacheKey(h));
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
        });
        if (!row) return null;
        const age = Date.now() - (row.timestamp || 0);
        if (age > PROFILE_PAGE_CACHE_MAX_AGE) return null;
        const filterEvents = (arr, bucket) => {
            if (!Array.isArray(arr)) return [];
            return arr.filter((e) => isProfilePageCacheEventScoped(e, h, bucket));
        };
        return {
            evAuthors: filterEvents(row.evAuthors, 'evAuthors'),
            evP30390: filterEvents(row.evP30390, 'evP30390'),
            evPClaims: filterEvents(row.evPClaims, 'evPClaims'),
            evNotes: filterEvents(row.evNotes, 'evNotes'),
            evHost30398: filterEvents(row.evHost30398, 'evHost30398'),
            timestamp: row.timestamp || 0,
        };
    } catch (e) {
        console.warn('Failed to load profile page cache:', e);
        return null;
    }
}

/**
 * Persist a merged snapshot of profile-page events for a given pubkey.
 * Updates an LRU index and prunes the oldest entries past
 * {@link PROFILE_PAGE_CACHE_MAX_ENTRIES}.
 */
async function saveProfilePageEventsToCache(hex, payload) {
    if (typeof indexedDB === 'undefined') return;
    const h = String(hex || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) return;
    let db;
    try {
        db = await openNrMapCacheDB();
    } catch (e) {
        console.warn('Map cache DB unavailable (profile page):', e);
        return;
    }
    const slimList = (arr, cap, bucket) => {
        if (!Array.isArray(arr)) return [];
        const out = [];
        for (const ev of arr) {
            if (!isProfilePageCacheEventScoped(ev, h, bucket)) continue;
            const s = slimEventForProfileCache(ev);
            if (s) out.push(s);
        }
        return cap > 0 && out.length > cap ? out.slice(-cap) : out;
    };
    const baseRecord = {
        key: profilePageCacheKey(h),
        hex: h,
        evAuthors: slimList(payload?.evAuthors, 30, 'evAuthors'),
        evP30390: slimList(payload?.evP30390, 60, 'evP30390'),
        evPClaims: slimList(payload?.evPClaims, 1000, 'evPClaims'),
        evNotes: slimList(payload?.evNotes, 50, 'evNotes'),
        evHost30398: slimList(payload?.evHost30398, 100, 'evHost30398'),
        timestamp: Date.now(),
    };
    // If we have nothing useful to cache, skip the write so we don't churn the LRU index.
    const totalCount =
        baseRecord.evAuthors.length +
        baseRecord.evP30390.length +
        baseRecord.evPClaims.length +
        baseRecord.evNotes.length +
        baseRecord.evHost30398.length;
    if (totalCount === 0) return;
    try {
        await idbPutEventsRecord(db, baseRecord);
    } catch (err) {
        if (!isStorageQuotaError(err)) {
            console.warn('Failed to save profile page cache:', err);
            return;
        }
        // On quota errors, retry with only the high-value fields (kind 0 / 10390 / 30390).
        try {
            await idbPutEventsRecord(db, {
                ...baseRecord,
                evPClaims: [],
                evNotes: [],
                evHost30398: [],
            });
        } catch (err2) {
            if (!isStorageQuotaError(err2)) {
                console.warn('Failed to save trimmed profile page cache:', err2);
            }
            return;
        }
    }
    void touchProfilePageCacheIndex(db, h).catch((e) => {
        console.warn('Failed to update profile page cache index:', e);
    });
}

/**
 * Update the LRU index of cached profile-page pubkeys and evict any past
 * {@link PROFILE_PAGE_CACHE_MAX_ENTRIES}.
 */
async function touchProfilePageCacheIndex(db, hex) {
    const row = await new Promise((resolve, reject) => {
        const tx = db.transaction(NR_MAP_CACHE_STORE, 'readonly');
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(NR_MAP_CACHE_STORE);
        const req = store.get(NR_MAP_CACHE_PROFILE_PAGE_INDEX_KEY);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
    });
    const now = Date.now();
    let entries = Array.isArray(row?.entries) ? row.entries.slice() : [];
    entries = entries.filter((e) => e && typeof e.hex === 'string' && e.hex !== hex);
    entries.push({ hex, lastAccessed: now });
    entries.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
    let evicted = [];
    if (entries.length > PROFILE_PAGE_CACHE_MAX_ENTRIES) {
        evicted = entries.slice(0, entries.length - PROFILE_PAGE_CACHE_MAX_ENTRIES);
        entries = entries.slice(evicted.length);
    }
    await idbPutEventsRecord(db, {
        key: NR_MAP_CACHE_PROFILE_PAGE_INDEX_KEY,
        entries,
        timestamp: now,
    });
    if (evicted.length) {
        await new Promise((resolve) => {
            const tx = db.transaction(NR_MAP_CACHE_STORE, 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.onabort = () => resolve();
            const store = tx.objectStore(NR_MAP_CACHE_STORE);
            for (const e of evicted) {
                if (!e || typeof e.hex !== 'string') continue;
                try {
                    store.delete(profilePageCacheKey(e.hex));
                } catch (_) {}
            }
        });
    }
}

async function flushMapCacheToIndexedDB() {
    await Promise.all([saveEventsToCache(), saveProfilesToCache()]);
}

// Debounced IndexedDB write after last map event / profile change
function scheduleCacheWrite() {
    if (localStorageWriteTimeout) {
        clearTimeout(localStorageWriteTimeout);
    }
    localStorageWriteTimeout = setTimeout(() => {
        void flushMapCacheToIndexedDB().catch((e) => console.warn('flushMapCacheToIndexedDB:', e));
        localStorageWriteTimeout = null;
    }, 2000);
}

// Expiration setting functions (matching nr-app)
function getExpirationSetting() {
    const saved = expirationSecondsStore.read();
    const validValues = [HOUR_IN_SECONDS, DAY_IN_SECONDS, WEEK_IN_SECONDS, MONTH_IN_SECONDS, YEAR_IN_SECONDS];
    if (saved != null && validValues.includes(saved)) return saved;
    return WEEK_IN_SECONDS; // Default to 1 week (matching nr-app)
}

function saveExpirationSetting(value) {
    const parsed = parseInt(value);
    const validValues = [HOUR_IN_SECONDS, DAY_IN_SECONDS, WEEK_IN_SECONDS, MONTH_IN_SECONDS, YEAR_IN_SECONDS];
    if (!isNaN(parsed) && validValues.includes(parsed)) {
        expirationSecondsStore.write(parsed);
        document.getElementById('note-expiration-in-modal').value = parsed;
    }
}

// Get current timestamp (matching nr-app's getCurrentTimestamp)
function getCurrentTimestamp() {
    return Math.round(Date.now() / 1000);
}

// Track all kind 30397 events for debugging
let kind30397EventsReceived = 0;
let kind30397EventsProcessed = 0;
let kind30397EventsRejected = 0;

// Extract Trustroots username from kind 10390 profile event
function getTrustrootsUsernameFromProfileEvent(event) {
    if (event.kind !== TRUSTROOTS_PROFILE_KIND) {
        return undefined;
    }
    
    // Look for label tags with the Trustroots username namespace
    // Format: ["l", value, "org.trustroots:username"]
    const usernameTag = event.tags.find(tag => 
        tag.length >= 3 && 
        tag[0] === "l" && 
        tag[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE
    );
    
    if (usernameTag && usernameTag[1]) {
        return usernameTag[1];
    }
    
    return undefined;
}

function processIncomingEvent(event, sourceRelayUrl) {
    if (NrBlocklist && NrBlocklist.isBlocked(event.pubkey)) return;
    if (event.kind === 0) {
        ingestTrustrootsNip05FromKind0(event);
        return;
    }
    if (getClaimKinds().includes(event.kind)) {
        upsertClaimEvent(event);
        if (event.kind === PROFILE_CLAIM_KIND) {
            ingestTrustrootsNip05From30390(event);
        }
        return;
    }
    if (event.kind === MAP_NOTE_REPOST_KIND && hasPTarget(event, currentPublicKey)) {
        upsertClaimEvent(event);
    }
    // Process kind 10390 (Trustroots profile) events to extract usernames
    if (event.kind === TRUSTROOTS_PROFILE_KIND) {
        const username = getTrustrootsUsernameFromProfileEvent(event);
        if (username) {
            pubkeyToUsername.set(event.pubkey, username);
            scheduleCacheWrite();
        }
        return; // Don't process these as map notes
    }
    
    // Process kind 5 (deletion) events - store them but don't display as notes
    if (event.kind === DELETION_KIND) {
        const storageId = getStorageId(event);
        const existingIndex = events.findIndex(e => getStorageId(e) === storageId);
        
        if (existingIndex === -1) {
            // New deletion event, add it
            const eventData = {
                id: event.id,
                kind: event.kind,
                pubkey: event.pubkey,
                content: event.content,
                created_at: event.created_at,
                tags: event.tags,
                sig: event.sig
            };
            events.push(eventData);
            scheduleCacheWrite();
            cachedFilteredEvents = null;
            filteredEventsCacheKey = null;
            // Rebuild spatial index to update filtering
            rebuildSpatialIndex();
            // Update UI to reflect deletions
            updateMapMarkers();
            if (map && map.loaded()) {
                updatePlusCodeGrid();
            }
            
            // If notes modal is open, check if any deleted events match the selected plus code

            if (isHostSurfaceOpen() && selectedPlusCode) {
                // Find which events are being deleted by this deletion event
                const deletedEventIds = event.tags
                    .filter(tag => tag.length >= 2 && tag[0] === 'e')
                    .map(tag => tag[1]);
                
                // Check if any of the deleted events match the selected plus code
                let shouldRefresh = false;
                for (const deletedEventId of deletedEventIds) {
                    const deletedEvent = events.find(e => e.id === deletedEventId);
                    if (deletedEvent) {
                        const deletedEventPlusCode = getPlusCodeFromEvent(deletedEvent);
                        if (deletedEventPlusCode) {
                            const eventMatches = deletedEventPlusCode === selectedPlusCode || 
                                                isPlusCodeInsidePlusCode(selectedPlusCode, deletedEventPlusCode);
                            if (eventMatches) {
                                shouldRefresh = true;
                                break;
                            }
                        }
                    }
                }
                
                // If a deleted event matches, refresh the modal
                if (shouldRefresh) {
                    setTimeout(() => {
                        showNotesForPlusCode(selectedPlusCode);
                    }, 100);
                }
            }
            scheduleHeaderKpiRefresh();
        }
        return; // Don't process deletion events as map notes
    }
    
    // Track all kind 30397 events
    if (event.kind === MAP_NOTE_KIND) {
        kind30397EventsReceived++;
    }
    
    // Only process map note kinds (30397 and 30398).
    if (!MAP_NOTE_KINDS.includes(event.kind)) {
        return; // Skip all other kinds (kind 0 handled above)
    }
    
    // Only process events that have a plus code
    const plusCode = getPlusCodeFromEvent(event);
    if (!plusCode) {
        if (event.kind === MAP_NOTE_KIND) {
            kind30397EventsRejected++;
        }
        return;
    }
    
    const storageId = getStorageId(event);
    
    // Check if an event with this storage ID already exists
    const existingIndex = events.findIndex(e => getStorageId(e) === storageId);
    
    if (existingIndex !== -1) {
        const existingEvent = events[existingIndex];
        const mergedRelayUrls = collectRelayUrlsForEvent(existingEvent, event, sourceRelayUrl);
        
        // If it's the same event ID, skip (already have it)
        if (existingEvent.id === event.id) {
            if (mergedRelayUrls.length > 0) {
                const prevRelayUrls = Array.isArray(existingEvent._nrRelayUrls) ? existingEvent._nrRelayUrls : [];
                const prevKey = prevRelayUrls.slice().sort().join('|');
                const nextKey = mergedRelayUrls.slice().sort().join('|');
                if (prevKey !== nextKey) {
                    existingEvent._nrRelayUrls = mergedRelayUrls;
                    if (!existingEvent._nrCollectRelay && mergedRelayUrls[0]) {
                        existingEvent._nrCollectRelay = mergedRelayUrls[0];
                    }
                    scheduleCacheWrite();
                }
            }
            return;
        }
        
        // For replaceable events, keep the latest version
        const isUpdatedVersion = event.created_at > existingEvent.created_at;
        if (isUpdatedVersion) {
            if (event.kind === MAP_NOTE_KIND) {
                console.log('Replacing event with newer version:', event.id.substring(0, 16) + '...');
            }
            // Replace the existing event with the newer one
            const incomingRelayScope =
                event.relayScope === 'public' || event.relayScope === 'auth' ? event.relayScope : null;
            const preservedRelayScope =
                existingEvent.relayScope === 'public' || existingEvent.relayScope === 'auth'
                    ? existingEvent.relayScope
                    : null;
            const relayScopeForReplace = incomingRelayScope || preservedRelayScope;
            events[existingIndex] = {
                id: event.id,
                kind: event.kind,
                pubkey: event.pubkey,
                content: event.content,
                created_at: event.created_at,
                tags: event.tags,
                sig: event.sig,
                ...(typeof event._nrCollectRelay === 'string' && event._nrCollectRelay
                    ? { _nrCollectRelay: event._nrCollectRelay }
                    : existingEvent._nrCollectRelay
                        ? { _nrCollectRelay: existingEvent._nrCollectRelay }
                        : {}),
                ...(mergedRelayUrls.length > 0 ? { _nrRelayUrls: mergedRelayUrls } : {}),
                ...(relayScopeForReplace ? { relayScope: relayScopeForReplace } : {})
            };
            scheduleCacheWrite(); // Schedule cache write (debounced)
            cachedFilteredEvents = null; // Invalidate cache
            filteredEventsCacheKey = null;
            rebuildSpatialIndex(); // Rebuild spatial index (synchronous)
            updateMapMarkers();
            // Force grid update immediately - spatial index is already rebuilt synchronously
            if (map && map.loaded()) {
                // Call directly without setTimeout to ensure immediate update
                updatePlusCodeGrid();
            } else {
                // If map not ready, schedule update for when it is
                if (map) {
                    map.once('load', () => {
                        updatePlusCodeGrid();
                    });
                }
            }
            
            // If notes modal is open, refresh it to show updated event

            if (isHostSurfaceOpen() && selectedPlusCode && plusCode) {
                const eventMatches = plusCode === selectedPlusCode || 
                                    isPlusCodeInsidePlusCode(selectedPlusCode, plusCode);
                if (eventMatches) {
                    setTimeout(() => {
                        showNotesForPlusCode(selectedPlusCode);
                    }, 150);
                }
            }
            scheduleHeaderKpiRefresh();
        }
        // If not newer, ignore it
        return;
    }
    
    // New event, add it
    if (event.kind === MAP_NOTE_KIND) {
        kind30397EventsProcessed++;
        // Debug: Uncomment to see new map note events
        // console.log('[ProcessEvent] New MAP_NOTE_KIND event:', event.id?.substring(0, 16), 'plusCode:', plusCode);
    }
    
    const eventRelayUrls = collectRelayUrlsForEvent(null, event, sourceRelayUrl);
    const eventData = {
        id: event.id,
        kind: event.kind,
        pubkey: event.pubkey,
        content: event.content,
        created_at: event.created_at,
        tags: event.tags,
        sig: event.sig,
        ...(typeof event._nrCollectRelay === 'string' && event._nrCollectRelay
            ? { _nrCollectRelay: event._nrCollectRelay }
            : {}),
        ...(eventRelayUrls.length > 0
            ? { _nrRelayUrls: eventRelayUrls }
            : {}),
        ...(event.relayScope === 'public' || event.relayScope === 'auth'
            ? { relayScope: event.relayScope }
            : {})
    };
    
    events.push(eventData);
    // Debug: Uncomment to see event processing
    // console.log('[ProcessEvent] Event added to array, total events:', events.length);
    scheduleCacheWrite(); // Schedule cache write (debounced)
    cachedFilteredEvents = null; // Invalidate cache
    filteredEventsCacheKey = null;
    rebuildSpatialIndex(); // Rebuild spatial index (synchronous)
    // Debug: Uncomment to see spatial index rebuild
    // console.log('[ProcessEvent] Spatial index rebuilt, continuing to UI updates...');
    
    try {
        updateMapMarkers();
        // Debug: Uncomment to see marker updates
        // console.log('[ProcessEvent] updateMapMarkers completed');
    } catch (e) {
        console.error('[ProcessEvent] Error in updateMapMarkers:', e);
    }
    
    // Force grid update immediately - spatial index is already rebuilt synchronously
    try {
        if (map && map.loaded()) {
            // Call directly without setTimeout to ensure immediate update
            updatePlusCodeGrid();
            // Debug: Uncomment to see grid updates
            // console.log('[ProcessEvent] updatePlusCodeGrid completed');
        } else {
            // If map not ready, schedule update for when it is
            if (map) {
                map.once('load', () => {
                    updatePlusCodeGrid();
                });
            }
        }
    } catch (e) {
        console.error('[ProcessEvent] Error in updatePlusCodeGrid:', e);
    }
    
    // Debug: Uncomment to see modal refresh checks
    // console.log('[ProcessEvent] About to check modal refresh...');
    
    // If notes modal is open, refresh it to show new events
    // Since events are showing on the map, they're in the spatial index
    // We'll refresh the modal and let showNotesForPlusCode filter correctly using the spatial index
    const isModalActive = isHostSurfaceOpen();
    
    // Try to get the plus code from the Host page when selectedPlusCode is not set.
    let modalPlusCode = selectedPlusCode;
    if (isModalActive && !modalPlusCode) {
        const areaCodeElement = document.getElementById('area-location-code');
        const areaCode = areaCodeElement ? areaCodeElement.textContent.trim() : '';
        if (/^[23456789CFGHJMPQRVWX0-9]+\+$/i.test(areaCode)) modalPlusCode = areaCode.toUpperCase();
    }
    
    // If modal is open and we have a plus code (from selectedPlusCode or modal title), check if we should refresh
    if (isModalActive && modalPlusCode) {
        // Check if the new event might be relevant to the selected plus code
        let shouldRefresh = false;
        
        if (plusCode) {
            // Check if event matches the selected plus code area
            const exactMatch = plusCode === modalPlusCode;
            const insideMatch = isPlusCodeInsidePlusCode(modalPlusCode, plusCode);
            shouldRefresh = exactMatch || insideMatch;
        }
        
        if (shouldRefresh) {
            // Refresh the modal - showNotesForPlusCode will use the updated spatial index
            // to filter and display events correctly
            // Use requestAnimationFrame to ensure DOM is ready, then refresh
            requestAnimationFrame(() => {
                setTimeout(() => {
                    showNotesForPlusCode(modalPlusCode);
                }, 100);
            });
        }
    }
    
    try {
        showNoteNotification(event, plusCode);
    } catch (e) {
        console.error('[ProcessEvent] showNoteNotification error:', e);
    }
    scheduleHeaderKpiRefresh();
}

// Sync localStorage with relay contents - remove events that no longer exist on relays
function syncLocalStorageWithRelays() {
    if (events.length === 0) {
        return; // Nothing to sync
    }
    
    console.log('Starting sync: checking which events still exist on relays...');
    const eventsOnRelays = new Set();
    const relayUrls = getRelayUrls();
    const relayAuth = window.NrWebRelayAuth;

    if (relayUrls.length === 0) {
        console.log('No relays configured for sync');
        return;
    }

    // wss://nip42.trustroots.org requires NIP-42 AUTH before REQ returns map notes.
    // Plain nostr-tools REQ without a successful AUTH sees zero events, which would
    // incorrectly purge the whole NIP-42-backed cache.
    const configuredRestrictedRelay = relayUrls.some((url) => isRestrictedRelayUrl(url));
    if (configuredRestrictedRelay && !canUseRestrictedRelay()) {
        console.log(
            'Sync skipped: link your Trustroots profile (NIP-42 auth relay) to verify cached notes, or remove that relay from settings.'
        );
        return;
    }
    
    // Perform the actual sync - remove events not found on relays
    const performSync = (eventsOnRelaysSet) => {
        const initialCount = events.length;
        const eventsToRemove = [];
        
        // Find events that are not on any relay
        events.forEach((event, index) => {
            const storageId = getStorageId(event);
            if (!eventsOnRelaysSet.has(storageId)) {
                eventsToRemove.push(index);
            }
        });
        
        // Remove events in reverse order to maintain indices
        eventsToRemove.reverse().forEach(index => {
            events.splice(index, 1);
        });
        
        const removedCount = eventsToRemove.length;
        
        if (removedCount > 0) {
            console.log(`Sync complete: Removed ${removedCount} event(s) that no longer exist on relays (${initialCount} -> ${events.length})`);
            
            // Update cache
            void flushMapCacheToIndexedDB().catch((e) => console.warn('flushMapCacheToIndexedDB:', e));
            cachedFilteredEvents = null;
            filteredEventsCacheKey = null;
            
            // Rebuild spatial index
            rebuildSpatialIndex();
            
            // Update UI
            updateMapMarkers();
            if (map && map.loaded()) {
                updatePlusCodeGrid();
            }
        } else {
            console.log('Sync complete: All events still exist on relays');
        }
    };

    const NIP42_SYNC_WAIT_MS = 15000;
    const PUBLIC_RELAY_SYNC_TIMEOUT_MS = 30000;

    const mergeNip42RestrictedRelays = async () => {
        if (!canUseRestrictedRelay() || !relayAuth?.nip42SubscribeOnce || !currentPublicKey) {
            return true;
        }
        const restrictedUrls = relayUrls.filter((url) => isRestrictedRelayUrl(url));
        if (restrictedUrls.length === 0) {
            return true;
        }
        const results = await Promise.allSettled(
            restrictedUrls.map((url) =>
                relayAuth.nip42SubscribeOnce({
                    relayUrl: url,
                    filter: { kinds: MAP_NOTE_KINDS, limit: 10000 },
                    authPubkey: currentPublicKey,
                    signEvent: async (eventTemplate) => signEventTemplate(eventTemplate),
                    onEvent: (event) => {
                        if (event) {
                            eventsOnRelays.add(getStorageId(event));
                        }
                    },
                    onAuthChallenge: () => {},
                    onAuthSuccess: () => {},
                    onAuthFail: () => {},
                    waitMs: NIP42_SYNC_WAIT_MS
                })
            )
        );
        let ok = true;
        results.forEach((res, i) => {
            if (res.status === 'rejected') {
                ok = false;
                console.error(`[Sync] NIP-42 relay query failed for ${restrictedUrls[i]}:`, res.reason);
            }
        });
        return ok;
    };
    
    // Query all events from relays
    if (ndk) {
        // Use NDK to query all map note kinds, then merge NIP-42 relay (AUTH-required) reads.
        try {
            const filter = { kinds: MAP_NOTE_KINDS };
            const subscription = ndk.subscribe(filter, { closeOnEose: true });
            
            subscription.on('event', (event) => {
                const rawEvent = event.rawEvent ? event.rawEvent() : event;
                const storageId = getStorageId(rawEvent);
                eventsOnRelays.add(storageId);
            });
            
            subscription.on('eose', async () => {
                const nip42Ok = await mergeNip42RestrictedRelays();
                if (!nip42Ok) {
                    console.log('Sync aborted removal: NIP-42 relay could not be queried');
                    return;
                }
                performSync(eventsOnRelays);
            });
        } catch (error) {
            console.error('Error querying events via NDK:', error);
            mergeNip42RestrictedRelays().then((nip42Ok) => {
                if (!nip42Ok) {
                    console.log('Sync aborted removal: NIP-42 relay could not be queried');
                    return;
                }
                performSync(eventsOnRelays);
            });
        }
    } else {
        let syncIncomplete = false;
        const tasks = relayUrls.map((url) => {
            if (isRestrictedRelayUrl(url) && canUseRestrictedRelay() && relayAuth?.nip42SubscribeOnce) {
                return relayAuth
                    .nip42SubscribeOnce({
                        relayUrl: url,
                        filter: { kinds: MAP_NOTE_KINDS, limit: 10000 },
                        authPubkey: currentPublicKey,
                        signEvent: async (eventTemplate) => signEventTemplate(eventTemplate),
                        onEvent: (event) => {
                            if (event) {
                                eventsOnRelays.add(getStorageId(event));
                            }
                        },
                        onAuthChallenge: () => {},
                        onAuthSuccess: () => {},
                        onAuthFail: () => {},
                        waitMs: NIP42_SYNC_WAIT_MS
                    })
                    .catch((err) => {
                        console.error(`[Sync] NIP-42 relay query failed for ${url}:`, err);
                        syncIncomplete = true;
                    });
            }

            const relay = relays.find((r) => r && r.url === url);
            if (!relay) {
                syncIncomplete = true;
                console.warn(`[Sync] No active connection for ${url}; will not remove cached events without a full relay check.`);
                return Promise.resolve();
            }

            return new Promise((resolve) => {
                let settled = false;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    resolve();
                };
                try {
                    const query = relay.subscribe([{ kinds: MAP_NOTE_KINDS }], {
                        onevent: (event) => {
                            eventsOnRelays.add(getStorageId(event));
                        },
                        oneose: () => {
                            try {
                                query.close();
                            } catch (_) {}
                            finish();
                        }
                    });

                    setTimeout(() => {
                        try {
                            query.close();
                        } catch (_) {}
                        finish();
                    }, PUBLIC_RELAY_SYNC_TIMEOUT_MS);
                } catch (error) {
                    console.error(`Error querying relay ${relay.url}:`, error);
                    syncIncomplete = true;
                    finish();
                }
            });
        });

        Promise.all(tasks).then(() => {
            if (syncIncomplete) {
                console.log('Sync aborted removal: one or more relays could not be queried completely');
                return;
            }
            performSync(eventsOnRelays);
        });
    }
}

function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function linkifyHashtags(html) {
    return html.replace(/#(\w+)/g, '<a href="#$1" class="nr-content-link">#$1</a>');
}

function toSafeTrustrootsUrl(rawUrl) {
    const raw = String(rawUrl || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        const host = String(parsed.hostname || '').toLowerCase();
        if (parsed.protocol !== 'https:') return '';
        if (host !== 'trustroots.org' && host !== 'www.trustroots.org') return '';
        return parsed.toString();
    } catch (_) {
        return '';
    }
}

export function linkifyTrustrootsUrls(html, className = 'nr-content-link') {
    return html.replace(
        /https:\/\/(?:www\.)?trustroots\.org\/[^\s<)]+/gi,
        (url) => {
            const safeUrl = toSafeTrustrootsUrl(url);
            if (!safeUrl) return url;
            const escapedUrl = escapeHtml(safeUrl);
            const linkClass = escapeHtml(className || 'nr-content-link');
            return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="${linkClass}">${escapedUrl}</a>`;
        }
    );
}

function formatMessageTimestamp(createdAt) {
    const timestamp = Number(createdAt || 0);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
    try {
        const date = new Date(timestamp * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (_) {
        return formatDate(timestamp);
    }
}

function getIdentityMapValue(mapLike, key) {
    if (!mapLike || !key) return '';
    const raw = String(key || '').trim();
    const lower = raw.toLowerCase();
    try {
        return String(mapLike.get(raw) || mapLike.get(lower) || '').trim();
    } catch (_) {
        return '';
    }
}

function resolvePubkeyDisplayIdentity(hex, opts = {}) {
    const h = String(hex || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) return { label: '', href: '', title: '' };
    const usernameMap = opts.usernameMap || pubkeyToUsername;
    const nip05Map = opts.nip05Map || pubkeyToNip05;
    const npub = hexToNpub(h) || '';
    const username = getIdentityMapValue(usernameMap, h).toLowerCase();
    const mappedNip05 = getIdentityMapValue(nip05Map, h).toLowerCase();
    let label = '';
    if (username) label = `${username}@trustroots.org`;
    else if (mappedNip05 && (opts.allowAnyNip05 || isTrustrootsNip05Lower(mappedNip05))) label = mappedNip05;
    else label = npub || h;
    if (opts.shortUnknown && label === npub && npub.length > 20) {
        label = npub.slice(0, 12) + '...';
    }
    const profileTarget = username
        ? `${username}@trustroots.org`
        : mappedNip05 && (opts.allowAnyNip05 || isTrustrootsNip05Lower(mappedNip05))
            ? mappedNip05
            : npub || h;
    return {
        label,
        href: profileTarget ? buildProfileHashRoute(profileTarget) : '',
        title: npub && label !== npub ? npub : '',
        npub,
        hasTrustrootsIdentity: !!(username || (mappedNip05 && isTrustrootsNip05Lower(mappedNip05))),
    };
}

function renderPubkeyLabelHtml(hex, opts = {}) {
    const identity = resolvePubkeyDisplayIdentity(hex, opts);
    if (!identity.label) return '';
    const title = identity.title ? ` title="${escapeHtml(identity.title)}"` : '';
    if (!identity.href) return escapeHtml(identity.label);
    return `<a href="${identity.href}" class="nr-content-link"${title}>${escapeHtml(identity.label)}</a>`;
}

function linkifyNip05Identifiers(html) {
    return html.replace(
        /(^|[^a-z0-9_@.-])([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})(?=$|[^a-z0-9_@.-])/gi,
        (match, prefix, nip05) => {
            const normalized = String(nip05 || '').trim().toLowerCase();
            if (!normalized) return match;
            const href = buildProfileHashRoute(normalized);
            return `${prefix}<a href="${href}" class="message-inline-link nr-content-link">${nip05}</a>`;
        }
    );
}

function linkifyNpubsWithKnownTrustrootsProfiles(html, opts = {}) {
    if (!html) return html || '';
    return html.replace(/\bnpub1[023456789acdefghjkmnpqrstuvwxyz]{20,}\b/gi, (npubStr) => {
        const hex = npubToHex(npubStr);
        if (!hex) return npubStr;
        const identity = resolvePubkeyDisplayIdentity(hex, {
            usernameMap: opts.usernameMap,
            nip05Map: opts.nip05Map,
            allowAnyNip05: false,
        });
        const label = identity.hasTrustrootsIdentity ? identity.label : npubStr;
        const href = identity.hasTrustrootsIdentity ? identity.href : buildProfileHashRoute(npubStr);
        const title = identity.hasTrustrootsIdentity ? ` title="${escapeHtml(npubStr)}"` : '';
        return `<a href="${href}" class="${escapeHtml(opts.className || 'nr-content-link')}"${title}>${escapeHtml(label)}</a>`;
    });
}

function linkifyMessageTextHtml(escapedHtml, opts = {}) {
    const withOptionalHashtags = opts.linkHashtags === false ? escapedHtml : linkifyHashtags(escapedHtml);
    return linkifyTrustrootsUrls(
        linkifyNip05Identifiers(linkifyNpubsWithKnownTrustrootsProfiles(withOptionalHashtags, opts)),
        opts.urlClassName || opts.className || 'nr-content-link'
    );
}

async function copyTextToClipboard(text) {
    const value = String(text ?? '');
    if (!value) return false;
    if (navigator?.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch (_) {}
    }
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch (_) {
        copied = false;
    }
    ta.remove();
    return !!copied;
}

function createMessageActionButton({ label, title, svg, danger = false, className = '' } = {}) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = ['message-delete', danger ? 'message-delete-danger' : '', className].filter(Boolean).join(' ');
    btn.title = title || label || '';
    if (label) btn.setAttribute('aria-label', label);
    btn.innerHTML = svg || '';
    return btn;
}

function createMessageShell({ isSelf = false, eventId = '', rowClass = '', wrapClass = '', bubbleClass = '' } = {}) {
    const row = document.createElement('div');
    row.className = ['message-row', isSelf ? 'self' : '', rowClass].filter(Boolean).join(' ');
    if (eventId) row.dataset.eventId = String(eventId);

    const wrap = document.createElement('div');
    wrap.className = ['message-wrap', isSelf ? 'self' : 'other', wrapClass].filter(Boolean).join(' ');

    const bubble = document.createElement('div');
    bubble.className = ['message', isSelf ? 'self' : 'other', bubbleClass].filter(Boolean).join(' ');

    const actionRail = document.createElement('span');
    actionRail.className = 'message-side-actions';
    return { row, wrap, bubble, actionRail };
}

// containsPrivateKeyNsec(text, nip19) is provided by the folded nsec-guard.js block above.

function npubBech32ToHex(npubStr) {
    return npubToHex(npubStr);
}

function collectNpubHexesFromNoteText(text) {
    const out = new Set();
    if (!text) return out;
    const re = /\bnpub1[023456789acdefghjkmnpqrstuvwxyz]{20,}\b/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
        const hex = npubBech32ToHex(m[0]);
        if (hex.length === 64) out.add(hex);
    }
    return out;
}

function collectMapNoteMentionNpubHexes(events) {
    const out = new Set();
    if (!Array.isArray(events)) return out;
    for (const ev of events) {
        collectNpubHexesFromNoteText(String(ev?.content || '')).forEach((h) => out.add(h));
    }
    return out;
}

function collectMapNoteAuthorHexes(events) {
    const out = new Set();
    if (!Array.isArray(events)) return out;
    for (const ev of events) {
        const h = String(getMapNoteDisplayAuthorPubkey(ev) || '').trim().toLowerCase();
        if (/^[0-9a-f]{64}$/.test(h)) out.add(h);
    }
    return out;
}

function hexHasTrustrootsInlineIdentity(hex) {
    const h = String(hex || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) return false;
    let nip05 = (pubkeyToNip05.get(h) || '').trim().toLowerCase();
    if (!nip05 || !isTrustrootsNip05Lower(nip05)) {
        const u = (pubkeyToUsername.get(h) || '').trim();
        if (u) nip05 = `${u.toLowerCase()}@trustroots.org`;
    }
    return !!(nip05 && isTrustrootsNip05Lower(nip05));
}

/**
 * Load kind 0 / 30390 / 10390 for npubs mentioned in note bodies so linkify can show Trustroots NIP-05.
 * Refreshes the open notes modal once when new metadata arrives (preserves compose + map view).
 */
function prefetchTrustrootsProfilesForNoteMentions(hexList, plusCodeForRefresh) {
    const unique = [...new Set((hexList || []).map((x) => String(x || '').toLowerCase()))].filter((h) =>
        /^[0-9a-f]{64}$/.test(h)
    );
    const pending = unique.filter(
        (h) => !hexHasTrustrootsInlineIdentity(h) && !mentionProfilePrefetchInFlight.has(h)
    );
    if (!pending.length || !relays || relays.length === 0) return;

    pending.forEach((h) => mentionProfilePrefetchInFlight.add(h));
    const hadIdentity = new Map(pending.map((h) => [h, hexHasTrustrootsInlineIdentity(h)]));

    const batches = [];
    for (let i = 0; i < pending.length; i += 20) batches.push(pending.slice(i, i + 20));

    let subsRemaining = relays.length * batches.length;

    const finishOneSub = () => {
        subsRemaining--;
        if (subsRemaining > 0) return;
        pending.forEach((h) => mentionProfilePrefetchInFlight.delete(h));
        const upgraded = pending.some((h) => !hadIdentity.get(h) && hexHasTrustrootsInlineIdentity(h));
        if (
            upgraded &&
            isHostSurfaceOpen() &&
            plusCodeForRefresh &&
            selectedPlusCode === plusCodeForRefresh
        ) {
            showNotesForPlusCode(plusCodeForRefresh, {
                preserveCompose: true,
                preserveMapView: true,
            });
        }
    };

    relays.forEach((relay) => {
        batches.forEach((authors) => {
            try {
                const sub = relay.subscribe(
                    [
                        {
                            kinds: getProfileLookupKinds(),
                            authors,
                            limit: 120,
                        },
                    ],
                    {
                        onevent: (event) => {
                            processIncomingEvent(event);
                        },
                        oneose: () => {
                            try {
                                sub.close();
                            } catch (_) {}
                            finishOneSub();
                        },
                    }
                );
            } catch (e) {
                console.warn('[prefetch mention profiles]', e);
                finishOneSub();
            }
        });
    });
}

function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}


function updateMapMarkers() {
    if (!map) return;
    
    // Clear existing markers - nr-app style uses only the plus code grid,
    // not individual markers. Markers are disabled to match nr-app behavior.
    markers.forEach(marker => marker.remove());
    markers = [];
    
    // NOTE: Individual markers are disabled to match nr-app's grid-only visualization.
    // The plus code grid (updatePlusCodeGrid) handles the visual representation.
    // If you want to enable markers, uncomment the code below:
    /*
    // Get enabled layers
    const enabledLayers = getEnabledLayers();
    
    // Filter events by enabled layers and add markers
    // Only show non-expired events
    events.forEach(event => {
        // Skip expired events
        if (isEventExpired(event)) {
            return;
        }
        
        const layer = getLayerForEvent(event);
        if (layer && enabledLayers.includes(layer)) {
            const plusCode = getPlusCodeFromEvent(event);
            if (plusCode) {
                // Pass plus code directly, conversion happens in addMarkerToMap
                addMarkerToMap(event, plusCode, layer);
            }
        }
    });
    */
}

export function getPlusCodeFromEvent(event) {
    if (!Array.isArray(event?.tags)) return null;

    // Match nip42 test page behavior: first open-location-code* l-tag wins.
    for (const tag of event.tags) {
        if (!Array.isArray(tag) || tag.length < 2 || tag[0] !== 'l') continue;
        const namespace = typeof tag[2] === 'string' ? tag[2] : '';
        if (namespace.startsWith('open-location-code')) {
            const code = typeof tag[1] === 'string' ? tag[1].trim().toUpperCase() : '';
            if (code) return code;
        }
    }

    // Same fallback as nip42 test page.
    const dTag = event.tags.find((tag) => Array.isArray(tag) && tag[0] === 'd' && typeof tag[1] === 'string');
    if (dTag) {
        const code = dTag[1].trim().toUpperCase();
        if (code) return code;
    }
    return null;
}

function isEventExpired(event) {
    // Check if event has an expiration tag (matching nr-app logic)
    for (const tag of event.tags) {
        if (tag.length >= 2 && tag[0] === 'expiration') {
            const expirationTimestamp = parseInt(tag[1]);
            if (!isNaN(expirationTimestamp)) {
                const currentTimestamp = getCurrentTimestamp();
                return expirationTimestamp <= currentTimestamp;
            }
        }
    }
    // If no expiration tag, event is not expired
    return false;
}

// Get the expiration timestamp from an event (NIP-40)
function getExpirationTimestamp(event) {
    for (const tag of event.tags) {
        if (tag.length >= 2 && tag[0] === 'expiration') {
            const expirationTimestamp = parseInt(tag[1]);
            if (!isNaN(expirationTimestamp)) {
                return expirationTimestamp;
            }
        }
    }
    return null;
}

// Get remaining seconds until event expires
function getRemainingTime(event) {
    const expirationTimestamp = getExpirationTimestamp(event);
    if (expirationTimestamp === null) {
        return null;
    }
    return expirationTimestamp - getCurrentTimestamp();
}

// Format remaining time for display (e.g., "7d", "5h", "45m", "<1m")
function formatRemainingTime(seconds) {
    if (seconds === null) return null;
    if (seconds <= 0) return 'expired';
    
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) {
        return `${days}d`;
    } else if (hours > 0) {
        return `${hours}h`;
    } else if (minutes > 0) {
        return `${minutes}m`;
    } else {
        return '<1m';
    }
}

// Check if an event has been deleted (has a corresponding kind 5 deletion event)
function isEventDeleted(event) {
    // Deletion events themselves should not be considered as deleted
    if (event.kind === DELETION_KIND) {
        return false;
    }
    
    // Check if there's a kind 5 event that references this event ID
    return events.some(deletionEvent => {
        if (deletionEvent.kind !== DELETION_KIND) {
            return false;
        }
        
        // Check if any 'e' tag matches this event's ID
        return deletionEvent.tags.some(tag => {
            return tag.length >= 2 && tag[0] === 'e' && tag[1] === event.id;
        });
    });
}

// Flush expired events from the events array (matching nr-app's flushExpiredEvents)
function flushExpiredEvents() {
    const currentTimestamp = getCurrentTimestamp();
    const initialCount = events.length;
    const eventsToKeep = events.filter(event => {
        // Check if event has an expiration tag
        for (const tag of event.tags) {
            if (tag.length >= 2 && tag[0] === 'expiration') {
                const expirationTimestamp = parseInt(tag[1]);
                if (!isNaN(expirationTimestamp)) {
                    // If expired, don't keep it
                    if (expirationTimestamp <= currentTimestamp) {
                        return false;
                    }
                }
            }
        }
        // If no expiration tag or not expired, keep it
        return true;
    });
    
    const removedCount = initialCount - eventsToKeep.length;
    if (removedCount > 0) {
        events = eventsToKeep;
        console.log(`Flushed ${removedCount} expired event(s) (${initialCount} -> ${events.length})`);
        
        // Update cache
        void flushMapCacheToIndexedDB().catch((e) => console.warn('flushMapCacheToIndexedDB:', e));
        cachedFilteredEvents = null;
        filteredEventsCacheKey = null;
        
        // Rebuild spatial index
        rebuildSpatialIndex();
        
        // Update UI
        updateMapMarkers();
        if (map && map.loaded()) {
            updatePlusCodeGrid();
        }
    }
}

// Start periodic flushing of expired events (matching nr-app: every 10 minutes)
function startPeriodicFlushingOfExpiredEvents() {
    const FLUSH_EXPIRED_EVENTS_EVERY_MILLISECONDS = 10 * 60 * 1000; // 10 minutes
    setInterval(() => {
        flushExpiredEvents();
    }, FLUSH_EXPIRED_EVENTS_EVERY_MILLISECONDS);
}

function getLayerForEvent(event) {
    for (const [key, layer] of Object.entries(MAP_LAYERS)) {
        if (layer.filter.kinds && layer.filter.kinds.includes(event.kind)) {
            if (!layer.filter.authors || layer.filter.authors.includes(event.pubkey)) {
                return key;
            }
        }
    }
    return null;
}

function getEnabledLayers() {
    // Always return trustroots layer - no toggles
    return ['trustroots'];
}


function addMarkerToMap(event, plusCode, layerKey) {
    const layer = MAP_LAYERS[layerKey];
    if (!layer) return;
    
    // Convert plus code to coordinates for map display
    const coords = decodePlusCode(plusCode);
    if (!coords) return;
    
    const el = document.createElement('div');
    el.style.width = '14px';
    el.style.height = '14px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = layer.markerColor;
    el.style.border = '2px solid white';
    el.style.cursor = 'pointer';
    el.style.zIndex = '1000';
    el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
    el.style.transition = 'transform 0.2s ease';
    
    // Add hover effect
    el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.3)';
    });
    el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
    });
    
    // Store event data on the element for click handler
    el.dataset.eventId = event.id;
    
    const marker = new maplibregl.Marker(el)
        .setLngLat([coords.longitude, coords.latitude])
        .addTo(map);
    
    // Handle marker click - stop propagation to prevent map click
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        showNotesForPlusCode(plusCode);
    });
    
    // Also handle mousedown to prevent map click
    el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    markers.push(marker);
}

/** Light map tiles only (UI may be dark); keeps contrast under warm-color / red-light filters. */
function getMapStyle() {
    return {
        version: 8,
        sources: {
            'carto-voyager': {
                type: 'raster',
                tiles: [
                    'https://tiles.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
            }
        },
        layers: [{
            id: 'carto-voyager',
            type: 'raster',
            source: 'carto-voyager'
        }]
    };
}

function hasUsableWebGL() {
    try {
        const canvas = document.createElement('canvas');
        if (!canvas) return false;
        const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
                   canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
                   canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false });
        return !!gl;
    } catch (_error) {
        return false;
    }
}

function renderUnavailableMapPanel(message) {
    mapFallbackMode = 'map-unavailable';

    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    map = null;
    mapContainer.dataset.mapFallback = 'map-unavailable';
    mapContainer.innerHTML = `
        <div class="map-fallback" role="status" aria-live="polite">
            <h2>Map unavailable</h2>
            <p>${escapeHtml(message || 'This browser cannot start the interactive map right now.')}</p>
            <p class="map-fallback-hint">WebGL and Leaflet fallback could not initialize.</p>
            <button class="btn btn-secondary" type="button" onclick="window.location.reload()">Try again</button>
        </div>
    `;
}

function getLeafletTileUrl() {
    return 'https://tiles.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
}

function initializeLeafletFallback(reason) {
    try {
        if (typeof L === 'undefined') {
            renderUnavailableMapPanel('Leaflet map fallback failed to load.');
            return false;
        }

        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            renderUnavailableMapPanel('Map container not found.');
            return false;
        }

        mapContainer.innerHTML = '';
        mapContainer.dataset.mapFallback = 'leaflet';

        let savedCenter = mapViewStore.readCenter() || [0, 0];
        let savedZoom = mapViewStore.readZoom();
        if (savedZoom == null) savedZoom = 2;

        const isTouchDevice = (typeof window !== 'undefined') &&
            (('ontouchstart' in window) ||
                (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));
        const leafMap = L.map('map', {
            zoomControl: true,
            worldCopyJump: true,
            // iOS Safari has more reliable polygon tap handling with SVG renderer.
            preferCanvas: !isTouchDevice
        }).setView([savedCenter[1], savedCenter[0]], savedZoom);

        L.tileLayer(getLeafletTileUrl(), {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(leafMap);

        leafletGridLayer = L.layerGroup().addTo(leafMap);
        mapFallbackMode = 'leaflet';
        map = leafMap;
        map.loaded = () => true;
        map.getSource = (sourceId) => sourceId === 'pluscode-grid' ? {} : null;

        /**
         * Single canonical tap handler for the Leaflet fallback.
         * Triggered both by Leaflet's synthesized click and by a raw touchend
         * fallback (iOS Safari occasionally drops the synthetic click on
         * SVG paths inside Leaflet).
         */
        function handleLeafContainerTap(clientX, clientY) {
            const containerEl = leafMap.getContainer && leafMap.getContainer();
            if (!containerEl) return;
            const rect = containerEl.getBoundingClientRect();
            const cx = clientX - rect.left;
            const cy = clientY - rect.top;
            if (cx < 0 || cy < 0 || cx > rect.width || cy > rect.height) return;
            const latLng = leafMap.containerPointToLatLng(L.point(cx, cy));
            if (!latLng) return;
            const plusCode = encodePlusCode(latLng.lat, latLng.lng);
            if (!plusCode) return;
            const now = Date.now();
            if (now - leafPolygonOpenAt < 350) return;
            leafPolygonOpenAt = now;
            showNotesForPlusCode(plusCode);
        }
        // Expose for tests/diagnostics.
        window.__nrwebLeafletTap = handleLeafContainerTap;
        window.__nrwebLeafletMap = leafMap;

        leafMap.on('click', (e) => {
            const oe = e.originalEvent;
            if (oe && typeof oe.clientX === 'number' && typeof oe.clientY === 'number') {
                handleLeafContainerTap(oe.clientX, oe.clientY);
            } else {
                const plusCode = encodePlusCode(e.latlng.lat, e.latlng.lng);
                if (plusCode) {
                    const now = Date.now();
                    if (now - leafPolygonOpenAt < 350) return;
                    leafPolygonOpenAt = now;
                    showNotesForPlusCode(plusCode);
                }
            }
        });

        // iOS Safari fallback: when synthesized click is missed for SVG paths
        // inside Leaflet, derive the tap from raw touch events.
        const leafContainer = leafMap.getContainer && leafMap.getContainer();
        if (leafContainer) {
            let leafTouchStart = null;
            leafContainer.addEventListener('touchstart', (e) => {
                const t = e.touches && e.touches[0];
                if (!t || e.touches.length !== 1) {
                    leafTouchStart = null;
                    return;
                }
                leafTouchStart = { x: t.clientX, y: t.clientY, at: Date.now(), moved: false };
            }, { passive: true });
            leafContainer.addEventListener('touchmove', (e) => {
                if (!leafTouchStart) return;
                const t = e.touches && e.touches[0];
                if (!t) return;
                const dx = Math.abs(t.clientX - leafTouchStart.x);
                const dy = Math.abs(t.clientY - leafTouchStart.y);
                if (dx > 12 || dy > 12) leafTouchStart.moved = true;
            }, { passive: true });
            leafContainer.addEventListener('touchend', (e) => {
                if (!leafTouchStart) return;
                const started = leafTouchStart;
                leafTouchStart = null;
                if (started.moved) return;
                if (Date.now() - started.at > 700) return;
                const t = e.changedTouches && e.changedTouches[0];
                if (!t) return;
                handleLeafContainerTap(t.clientX, t.clientY);
            }, { passive: true });
        }

        let leafMoveTimeout = null;
        const onLeafMove = () => {
            const center = leafMap.getCenter();
            const zoom = leafMap.getZoom();
            mapViewStore.writeCenter(center.lng, center.lat);
            mapViewStore.writeZoom(zoom);

            clearTimeout(leafMoveTimeout);
            leafMoveTimeout = setTimeout(() => {
                updatePlusCodeGrid();
                subscribeToPlusCodePrefixes();
            }, 300);
        };
        leafMap.on('moveend', onLeafMove);
        leafMap.on('zoomend', onLeafMove);

        updatePlusCodeGrid();
        showStatus('Using Leaflet fallback map because WebGL is unavailable.', 'info');
        if (reason === 'maplibre-missing') {
            showStatus('MapLibre failed to load; switched to Leaflet fallback.', 'error');
        }
        return true;
    } catch (leafletError) {
        console.error('Leaflet fallback initialization failed:', leafletError);
        renderUnavailableMapPanel('Leaflet map fallback could not initialize.');
        return false;
    }
}

/** Read once-per-load preference for the map renderer. URL ?map=leaflet|maplibre wins; otherwise sticky localStorage flag. */
function getMapRendererPreference() {
    try {
        const u = new URL(window.location.href);
        const q = (u.searchParams.get('map') || '').toLowerCase();
        if (q === 'leaflet' || q === 'maplibre') {
            mapRendererStore.write(q);
            return q;
        }
        const stored = mapRendererStore.read();
        if (stored === 'leaflet' || stored === 'maplibre') return stored;
    } catch (_) {}
    return '';
}

function initializeMap() {
    try {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            throw new Error('Map container not found');
        }

        const rendererPref = getMapRendererPreference();
        if (rendererPref === 'leaflet') {
            return initializeLeafletFallback('forced');
        }

        if (typeof maplibregl === 'undefined') {
            return initializeLeafletFallback('maplibre-missing');
        }

        if (!hasUsableWebGL()) {
            return initializeLeafletFallback('webgl-unavailable');
        }
        
        let savedCenter = mapViewStore.readCenter() || [0, 0];
        let savedZoom = mapViewStore.readZoom();
        if (savedZoom == null) savedZoom = 2;
        
        map = new maplibregl.Map({
            container: 'map',
            style: getMapStyle(),
            // Avoid local CJK font probing in Firefox (can trigger blocked-font warnings).
            localIdeographFontFamily: false,
            center: savedCenter,
            zoom: savedZoom,
            renderWorldCopies: false, // Improve performance
            antialias: true, // Smoother rendering
            failIfMajorPerformanceCaveat: false,
            canvasContextAttributes: {
                antialias: true,
                powerPreference: 'high-performance',
                preserveDrawingBuffer: false,
                failIfMajorPerformanceCaveat: false
            },
            fadeDuration: 0, // Instant transitions for smoother panning
            dragPan: true, // Explicitly enable panning
            boxZoom: true,
            doubleClickZoom: true
        });
        
        // Track if we've already attempted fallback to prevent repeated attempts
        let fallbackAttempted = false;
        
        map.on('error', (e) => {
            console.error('Map error:', e);
            
            // Only attempt fallback once
            if (fallbackAttempted) {
                return;
            }
            fallbackAttempted = true;
            
            showStatus('Map loading error. Trying fallback style...', 'error');
            // Try fallback styles in order (always light raster for readability)
            const fallbackStyles = [
                'https://demotiles.maplibre.org/style.json',
                {
                    version: 8,
                    sources: {
                        'carto-positron': {
                            type: 'raster',
                            tiles: ['https://tiles.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
                            tileSize: 256,
                            attribution: '© OpenStreetMap contributors © CARTO'
                        }
                    },
                    layers: [{
                        id: 'carto-positron',
                        type: 'raster',
                        source: 'carto-positron'
                    }]
                }
            ];
            
            let fallbackIndex = 0;
            const tryFallback = () => {
                if (fallbackIndex < fallbackStyles.length) {
                    try {
                        map.setStyle(fallbackStyles[fallbackIndex]);
                    } catch (fallbackError) {
                        console.error('Fallback style failed:', fallbackError);
                        fallbackIndex++;
                        tryFallback();
                    }
                } else {
                    // If MapLibre cannot recover styles, switch to Leaflet instead of blank surface.
                    const switched = initializeLeafletFallback('maplibre-style-failed');
                    if (!switched) {
                        renderUnavailableMapPanel('Map rendering failed and fallback could not initialize.');
                    }
                }
            };
            tryFallback();
        });
    } catch (error) {
        console.error('Error initializing map:', error);
        const baseMessage = 'Error initializing map: ' + error.message;
        const webglHint = error.message && error.message.includes('WebGL')
            ? ' On iPhone, verify Safari Advanced > Feature Flags > WebGL is enabled and disable Low Power Mode.'
            : '';
        showStatus(baseMessage + webglHint, 'error');
        if (error.message && error.message.includes('WebGL')) {
            return initializeLeafletFallback('webgl-unavailable');
        }
        return false;
    }
    
    // Track if map was dragged to prevent opening modal after panning
    let mapWasDragged = false;
    let dragStartPos = null;
    
    map.on('dragstart', () => {
        mapWasDragged = false;
        isDragging = true;
        // Cancel any pending grid updates during drag
        if (gridUpdateAnimationFrame) {
            cancelAnimationFrame(gridUpdateAnimationFrame);
            gridUpdateAnimationFrame = null;
        }
        // Change cursor to grabbing during pan
        if (map.getCanvas()) {
            map.getCanvas().style.cursor = 'grabbing';
        }
    });
    
    map.on('drag', () => {
        mapWasDragged = true;
    });
    
    map.on('dragend', () => {
        isDragging = false;
        // Reset cursor to default after panning
        if (map.getCanvas()) {
            map.getCanvas().style.cursor = 'default';
        }
        // Reset after a short delay to allow click event to check the flag
        setTimeout(() => {
            mapWasDragged = false;
        }, 100);
        // Trigger grid update after dragging is complete
        if (pendingGridUpdate) {
            pendingGridUpdate = false;
            // Use a longer delay to ensure smooth drag completion
            setTimeout(() => {
                if (!isDragging) {
                    updatePlusCodeGrid();
                }
            }, 100);
        }
    });
    
    // Also track mouse events for more reliable detection
    map.on('mousedown', (e) => {
        // Only track if not clicking on a marker or control
        const target = e.originalEvent.target;
        if (target && (target.closest && (target.closest('.maplibregl-marker') || target.closest('.maplibregl-ctrl')))) {
            return;
        }
        dragStartPos = { x: e.point.x, y: e.point.y };
        mapWasDragged = false;
        // Change cursor to grabbing when mouse is pressed
        if (map.getCanvas()) {
            map.getCanvas().style.cursor = 'grabbing';
        }
    });
    
    map.on('mousemove', (e) => {
        if (dragStartPos) {
            const dx = Math.abs(e.point.x - dragStartPos.x);
            const dy = Math.abs(e.point.y - dragStartPos.y);
            // If mouse moved more than 5 pixels, consider it a drag
            if (dx > 5 || dy > 5) {
                mapWasDragged = true;
            }
        }
    });
    
    map.on('mouseup', () => {
        dragStartPos = null;
        // Reset cursor to default when mouse is released
        if (map.getCanvas() && !isDragging) {
            map.getCanvas().style.cursor = 'default';
        }
    });
    
    // Handle map clicks (but not on plus code polygons or markers - those are handled separately)
    map.on('click', (e) => {
        // Ignore clicks that occurred after dragging/panning
        if (mapWasDragged) {
            return;
        }
        
        // Check if clicking on a marker (markers are HTML elements, not map features)
        const clickedElement = e.originalEvent.target;
        if (clickedElement && clickedElement.closest && clickedElement.closest('.maplibregl-marker')) {
            // Marker click is handled by the marker's own event listener
            return;
        }
        
        // Only handle if not clicking on a plus code polygon
        const features = map.queryRenderedFeatures(e.point, { layers: ['pluscode-grid-fill'] });
        if (features.length === 0) {
            // Convert clicked coordinates to plus code immediately
            const plusCode = encodePlusCode(e.lngLat.lat, e.lngLat.lng);
            if (plusCode) {
                showNotesForPlusCode(plusCode);
            } else {
                showStatus('Error encoding location to plus code', 'error');
            }
        }
    });
    
    // Update plus code grid when map moves or zooms
    let moveTimeout;
    map.on('moveend', () => {
        // Save map position and zoom to localStorage
        const center = map.getCenter();
        const zoom = map.getZoom();
        mapViewStore.writeCenter(center.lng, center.lat);
        mapViewStore.writeZoom(zoom);
        
        // Don't update grid during active dragging - wait for dragend
        if (isDragging) {
            pendingGridUpdate = true;
            return;
        }
        
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
            if (!isDragging) {
                updatePlusCodeGrid();
                // Re-subscribe to new plus codes in view
                subscribeToPlusCodePrefixes();
            }
        }, 500); // Increased debounce for better performance
    });
    
    map.on('zoomend', () => {
        const zoom = map.getZoom();
        mapViewStore.writeZoom(zoom);
        
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
            updatePlusCodeGrid();
            subscribeToPlusCodePrefixes();
        }, 500); // Increased debounce for better performance
    });
    
    map.on('load', () => {
        // Resize so canvas matches container (fixes blank map when flex layout settles after init)
        map.resize();
        setTimeout(() => map.resize(), 150);

        // Ensure map is interactive and set initial cursor
        if (map.getCanvas()) {
            map.getCanvas().style.cursor = 'default';
            // Ensure pointer events are enabled for dragging
            map.getCanvas().style.pointerEvents = 'auto';
        }

        // Initialize plus code grid source
        if (!map.getSource('pluscode-grid')) {
            map.addSource('pluscode-grid', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
            
            map.addLayer({
                id: 'pluscode-grid-fill',
                type: 'fill',
                source: 'pluscode-grid',
                paint: {
                    'fill-color': ['get', 'fillColor'],
                    'fill-opacity': 1
                }
            });
            
            map.addLayer({
                id: 'pluscode-grid-stroke',
                type: 'line',
                source: 'pluscode-grid',
                paint: {
                    'line-color': 'rgba(80, 80, 90, 0.5)',
                    'line-width': 1
                }
            });
            
            // Make plus code polygons clickable
            map.on('click', 'pluscode-grid-fill', (e) => {
                // Ignore clicks that occurred after dragging/panning
                if (mapWasDragged) {
                    return;
                }
                
                if (e.features && e.features.length > 0) {
                    const plusCode = pickMostSpecificPlusCodeFromFeatures(e.features);
                    if (plusCode) {
                        selectedPlusCode = plusCode;
                        showNotesForPlusCode(plusCode);
                    }
                }
            });
            
            // Change cursor on hover over plus codes
            map.on('mouseenter', 'pluscode-grid-fill', () => {
                if (map.getCanvas()) {
                    map.getCanvas().style.cursor = 'pointer';
                }
            });
            
            map.on('mouseleave', 'pluscode-grid-fill', () => {
                // Reset to default cursor when not hovering over plus code
                if (map.getCanvas() && !dragStartPos) {
                    map.getCanvas().style.cursor = 'default';
                }
            });
        }
        
        updatePlusCodeGrid();
    });
    
    // Layer toggles removed - trustroots layer is always enabled
}

function updatePlusCodeGrid() {
    if (mapFallbackMode === 'leaflet') {
        if (!map || !leafletGridLayer) return;
        leafletGridLayer.clearLayers();

        const bounds = map.getBounds();
        const plusCodesToRender = new Set();
        if (selectedPlusCode) plusCodesToRender.add(selectedPlusCode);

        eventsByPlusCode.forEach((eventSet, plusCode) => {
            if (!eventSet || eventSet.size === 0) return;
            const rectangle = plusCodeToRectangle(plusCode);
            if (!rectangle || rectangle.length === 0) return;
            const lons = rectangle.map(([lon]) => lon);
            const lats = rectangle.map(([, lat]) => lat);
            const minLon = Math.min(...lons);
            const maxLon = Math.max(...lons);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const overlapsViewport = !(
                maxLat < bounds.getSouth() ||
                minLat > bounds.getNorth() ||
                maxLon < bounds.getWest() ||
                minLon > bounds.getEast()
            );
            if (overlapsViewport) plusCodesToRender.add(plusCode);
        });

        let rendered = 0;
        for (const plusCode of plusCodesToRender) {
            if (rendered >= 300) break;
            const rectangle = plusCodeToRectangle(plusCode);
            if (!rectangle || rectangle.length < 4) continue;

            const { eventsForPlusCodeExactly, eventsWithinPlusCode } = filterEventsForPlusCodeFast(plusCode);
            const totalEventCount = eventsForPlusCodeExactly.length + eventsWithinPlusCode.length;
            if ((!selectedPlusCode || plusCode !== selectedPlusCode) && totalEventCount === 0) continue;

            const fillColor = (selectedPlusCode && plusCode === selectedPlusCode)
                ? 'rgba(107, 138, 82, 0.55)'
                : 'rgba(166, 124, 91, 0.45)';
            const latLngs = rectangle.map(([lon, lat]) => [lat, lon]);
            const polygon = L.polygon(latLngs, {
                color: 'rgba(80, 80, 90, 0.65)',
                weight: 1,
                fillColor,
                fillOpacity: 0.6
            });
            const openPlusCodeFromLeafletPolygon = () => {
                const now = Date.now();
                if (now - leafPolygonOpenAt < 300) return;
                leafPolygonOpenAt = now;
                showNotesForPlusCode(plusCode);
            };
            // On iPhone Safari with Leaflet fallback, taps can emit touch/pointer
            // without a reliable synthetic click.
            polygon.on('click', openPlusCodeFromLeafletPolygon);
            polygon.on('touchend', openPlusCodeFromLeafletPolygon);
            polygon.on('pointerup', openPlusCodeFromLeafletPolygon);
            polygon.addTo(leafletGridLayer);
            rendered++;
        }
        return;
    }

    if (!map || !map.loaded()) {
        // If map not ready, try again after a short delay
        setTimeout(() => {
            if (map && map.loaded()) {
                updatePlusCodeGrid();
            }
        }, 100);
        return;
    }
    
    // Don't update grid during active dragging
    if (isDragging) {
        pendingGridUpdate = true;
        return;
    }
    
    // Cancel any pending animation frame
    if (gridUpdateAnimationFrame) {
        cancelAnimationFrame(gridUpdateAnimationFrame);
    }
    
    // Use requestAnimationFrame for smooth rendering, but execute immediately
    // This ensures the update happens in the next frame
    const updateGrid = () => {
        const bounds = map.getBounds();
        const latitudeDelta = bounds.getNorth() - bounds.getSouth();
        const longitudeDelta = bounds.getEast() - bounds.getWest();
        
        // Handle world-wrapping: if longitude delta > 360, use full longitude range
        const worldWrapping = longitudeDelta >= 360;
        const effectiveLongitudeDelta = worldWrapping ? 360 : longitudeDelta;
        
        const codeLength = whatLengthOfPlusCodeToShow(latitudeDelta, effectiveLongitudeDelta);
        
        // Get effective bounds for plus code generation
        const effectiveWest = worldWrapping ? -180 : bounds.getWest();
        const effectiveEast = worldWrapping ? 180 : bounds.getEast();
        
        // Get southwest and northeast plus codes
        const sw = encodePlusCode(bounds.getSouth(), effectiveWest, codeLength);
        const ne = encodePlusCode(bounds.getNorth(), effectiveEast, codeLength);
        
        if (!sw || !ne) {
            gridUpdateAnimationFrame = null;
            return;
        }
        
        // Get all plus codes between southwest and northeast
        const allVisiblePlusCodes = getAllPlusCodesBetweenTwoPlusCodes(sw, ne, codeLength);
        
        // OPTIMIZATION: Only render plus codes that have events or are adjacent to ones with events
        // First, collect all plus codes that have events in the viewport
        const plusCodesWithEvents = new Set();
        const features = [];
        const processedPlusCodes = new Set();
        
        // First pass: collect all plus codes with events that are in or near the viewport
        // This ensures we don't miss any plus codes with events
        eventsByPlusCode.forEach((eventSet, plusCode) => {
            if (eventSet.size > 0) {
                // Check rectangle overlap instead of center-point inclusion so
                // coarse prefix codes (e.g. XXXX0000+) are included when visible.
                const rectangle = plusCodeToRectangle(plusCode);
                if (rectangle && rectangle.length > 0) {
                    const lons = rectangle.map(([lon]) => lon);
                    const lats = rectangle.map(([, lat]) => lat);
                    const minLon = Math.min(...lons);
                    const maxLon = Math.max(...lons);
                    const minLat = Math.min(...lats);
                    const maxLat = Math.max(...lats);

                    const overlapsViewport = !(
                        maxLat < bounds.getSouth() ||
                        minLat > bounds.getNorth() ||
                        maxLon < bounds.getWest() ||
                        minLon > bounds.getEast()
                    );

                    if (overlapsViewport) {
                        plusCodesWithEvents.add(plusCode);
                    }
                }
            }
        });
        
        // Second pass: iterate through visible plus codes and ones with events
        const allPlusCodesToCheck = new Set([...allVisiblePlusCodes, ...plusCodesWithEvents]);
        
        for (const plusCode of allPlusCodesToCheck) {
            if (processedPlusCodes.has(plusCode)) continue;
            if (features.length >= MAX_GRID_FEATURES) break; // Limit features
            
            // Use fast spatial index lookup
            const { eventsForPlusCodeExactly, eventsWithinPlusCode } = filterEventsForPlusCodeFast(plusCode);
            const eventCountExactly = eventsForPlusCodeExactly.length;
            const eventCountWithin = eventsWithinPlusCode.length;
            const totalEventCount = eventCountExactly + eventCountWithin;
            
            // Render all visible cells (both with and without events) up to the limit
            // This ensures complete grid coverage without gaps
            {
                const rectangle = plusCodeToRectangle(plusCode);
                if (!rectangle) continue;
                
                // Calculate fill color based on event count
                // Colors designed for dark map readability
                let fillColor;
                if (selectedPlusCode && plusCode === selectedPlusCode) {
                    fillColor = `rgba(107, 138, 82, 0.7)`; // Moss green for selected (sticker palette)
                } else if (totalEventCount > 0) {
                    // Gradient from dark brown to terracotta based on event count (sticker palette)
                    const intensity = Math.min(1, totalEventCount / 5);
                    const r = Math.round(80 + intensity * 86);   // 80-166
                    const g = Math.round(60 + intensity * 64);   // 60-124
                    const b = Math.round(50 + intensity * 41);   // 50-91
                    fillColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
                } else {
                    fillColor = `rgba(60, 60, 70, 0.35)`; // Subtle dark gray for empty
                }
                
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [rectangle]
                    },
                    properties: {
                        plusCode: plusCode,
                        eventCount: totalEventCount,
                        eventCountExactly: eventCountExactly,
                        eventCountWithin: eventsWithinPlusCode.length,
                        fillColor: fillColor
                    }
                });
                
                processedPlusCodes.add(plusCode);
                if (totalEventCount > 0) {
                    plusCodesWithEvents.add(plusCode);
                }
            }
        }
        
        const source = map.getSource('pluscode-grid');
        if (source) {
            // Set the data
            source.setData({
                type: 'FeatureCollection',
                features: features
            });
            
            // Only force re-render if not dragging (the panBy hack can interfere with dragging)
            if (!isDragging) {
                // Force a re-render by doing a tiny pan that's imperceptible
                // This is the most reliable way to force MapLibre to re-render
                map.panBy([0.1, 0], { duration: 0 });
                setTimeout(() => {
                    if (!isDragging) {
                        map.panBy([-0.1, 0], { duration: 0 });
                    }
                }, 1);
            }
        } else {
            // Source not ready yet, try again after a short delay
            setTimeout(() => {
                if (map && map.loaded() && map.getSource('pluscode-grid')) {
                    updatePlusCodeGrid();
                }
            }, 100);
            gridUpdateAnimationFrame = null;
            return;
        }
        
        gridUpdateAnimationFrame = null;
    };
    
    // Schedule the update
    gridUpdateAnimationFrame = requestAnimationFrame(updateGrid);
}

function closePlusCodeNotesModal(skipHashUpdate) {
    if (!skipHashUpdate && isHostSurfaceOpen() && nrPreviousHashRoute !== null && nrPreviousHashRoute !== getHashRoute()) {
        const routeBeforeBack = getHashRoute();
        try {
            history.back();
            setTimeout(() => {
                if (isHostSurfaceOpen() && getHashRoute() === routeBeforeBack) {
                    closePlusCodeNotesModal(true);
                    setHashRoute('');
                }
            }, 350);
            return;
        } catch (_) {}
    }

    const hostView = document.getElementById('nr-host-view');
    if (hostView) {
        hostView.hidden = true;
        hostView.style.display = 'none';
    }
    const noteInput = document.getElementById('note-content-in-modal');
    if (noteInput) noteInput.value = '';
    const expirationInput = document.getElementById('note-expiration-in-modal');
    if (expirationInput) expirationInput.value = getExpirationSetting();
    // Clear selected circle when closing modal
    clearSelectedCircle('modal');
    // Clear selected plus code and update grid to remove highlight
    selectedPlusCode = null;
    if (!skipHashUpdate) {
        setHashRoute('');
        document.body.classList.remove('nr-surface-host');
        const mapView = document.getElementById('map-view');
        if (mapView) mapView.style.display = '';
    } else {
        document.body.classList.remove('nr-surface-host');
    }
    updatePlusCodeGrid();
}

// Circle selection functions
function showCirclesModal() {
    const modal = document.getElementById('circles-modal');
    const circlesList = document.getElementById('circles-list');
    
    // Clear existing circles
    circlesList.innerHTML = '';
    
    // Get Trustroots circles
    const circles = getTrustrootsCircles();
    
    // Create circle items
    circles.forEach(circle => {
        const circleItem = document.createElement('div');
        circleItem.className = 'circle-item';
        circleItem.textContent = `#${circle.slug}`;
        circleItem.title = `#${circle.slug}`;
        
        circleItem.addEventListener('click', () => {
            selectCircle(circle.slug);
            hideCirclesModal();
        });
        
        circlesList.appendChild(circleItem);
    });
    
    // Show modal
    modal.style.display = 'flex';
    
    // Add ESC key listener
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            hideCirclesModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function hideCirclesModal() {
    const modal = document.getElementById('circles-modal');
    modal.style.display = 'none';
}

function selectCircle(circleSlug) {
    selectedCircle = circleSlug;
    updateCircleIndicator('modal');
}

function clearSelectedCircle(context) {
    selectedCircle = null;
    if (context === 'modal') {
        updateCircleIndicator('modal');
    }
}

function updateCircleIndicator(context) {
    if (context === 'modal') {
        const indicator = document.getElementById('selected-circle-indicator-modal');
        const text = document.getElementById('selected-circle-text-modal');
        if (selectedCircle) {
            indicator.style.display = 'block';
            text.textContent = `Circle: #${selectedCircle}`;
        } else {
            indicator.style.display = 'none';
        }
    }
}

function getStickyIntent() {
    try {
        const v = localStorage.getItem(NR_WEB_LAST_INTENT_KEY);
        return isIntentId(v) ? v : null;
    } catch (_) {
        return null;
    }
}

function persistStickyIntent(id) {
    try {
        if (isIntentId(id)) {
            localStorage.setItem(NR_WEB_LAST_INTENT_KEY, id);
        } else {
            localStorage.removeItem(NR_WEB_LAST_INTENT_KEY);
        }
    } catch (_) {}
}

function selectIntent(id) {
    // Toggle off if the same chip is clicked again.
    if (id && selectedIntent === id) {
        selectedIntent = null;
    } else {
        selectedIntent = isIntentId(id) ? id : null;
    }
    persistStickyIntent(selectedIntent);
    renderIntentChips();
}

function renderIntentChips() {
    const host = document.getElementById('note-intent-chips');
    if (!host) return;
    host.replaceChildren();
    for (const intent of MAP_NOTE_INTENTS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `note-intent-chip nr-note-intent-${intent.id}`;
        btn.dataset.intent = intent.id;
        btn.setAttribute('role', 'radio');
        const checked = selectedIntent === intent.id;
        btn.setAttribute('aria-checked', checked ? 'true' : 'false');
        btn.tabIndex = checked || (!selectedIntent && intent.id === MAP_NOTE_INTENTS[0].id) ? 0 : -1;
        btn.title = intent.hint;
        btn.textContent = `#${intent.id}`;
        btn.addEventListener('click', () => selectIntent(intent.id));
        host.appendChild(btn);
    }
}

async function publishNoteFromModal() {
    if (!hasRelayAuthSigningCapability()) {
        showStatus('No signing method available. Please import, generate, or connect a supported browser extension.', 'error');
        return;
    }
    
    if (!currentPublicKey) {
        showStatus('No public key available', 'error');
        return;
    }
    
    if (!selectedPlusCode) {
        showStatus('Please select a location on the map', 'error');
        return;
    }
    
    const noteContentEl = document.getElementById('note-content-in-modal');
    const rawNote = String(noteContentEl?.value ?? '');
    let content = rawNote.trim();
    if (!content || content.length < 3) {
        showStatus('Note content must be at least 3 characters', 'error');
        return;
    }
    if (containsPrivateKeyNsec(rawNote, nip19)) {
        const msg =
            'Note not posted: your text contains an nsec (private key). Remove it before posting. Your draft was kept in the box.';
        showStatus(msg, 'error');
        try {
            alert(msg);
        } catch (_) {}
        try {
            noteContentEl?.focus({ preventScroll: false });
            noteContentEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (_) {}
        return;
    }
    
    // Add circle hashtag to content if circle is selected
    if (selectedCircle) {
        const hashtag = `#${selectedCircle}`;
        const hashtagRegex = /#\w+/g;
        const existingHashtags = content.match(hashtagRegex) || [];
        if (!existingHashtags.includes(hashtag)) {
            content = content + ' ' + hashtag;
        }
    }

    // Prepend #intent hashtag (also written as a NIP-12 t-tag below)
    if (isIntentId(selectedIntent)) {
        content = applyIntentHashtagToContent(content, selectedIntent);
    }

    const expirationSeconds = parseInt(document.getElementById('note-expiration-in-modal').value) || WEEK_IN_SECONDS;
    const expiration = getCurrentTimestamp() + expirationSeconds;
    
    // Use the selected plus code directly
    const plusCode = selectedPlusCode;
    const plusCodePrefixes = getPlusCodePrefixes(plusCode, DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH);
    
    try {
        // Build tags array
        const tags = [
            ['expiration', expiration.toString()],
            ['L', 'open-location-code'],
            ['l', plusCode, 'open-location-code'],
            ['L', 'open-location-code-prefix'],
            ...plusCodePrefixes.map(prefix => ['l', prefix, 'open-location-code-prefix'])
        ];
        
        // Add circle tags if circle is selected
        if (selectedCircle) {
            tags.push(['L', 'trustroots-circle']);
            tags.push(['l', selectedCircle, 'trustroots-circle']);
        }

        // Add intent tag (NIP-12) if an intent is selected
        pushIntentTag(tags, selectedIntent);

        // Create event template
        const eventTemplate = {
            kind: MAP_NOTE_KIND,
            content: content,
            created_at: Math.floor(Date.now() / 1000),
            pubkey: currentPublicKey,
            tags: tags
        };
        
        // Basic validation before signing
        if (!eventTemplate.kind || !eventTemplate.content || !eventTemplate.tags || !Array.isArray(eventTemplate.tags)) {
            showStatus('Invalid event structure. Please try again.', 'error');
            console.error('Invalid event template:', eventTemplate);
            return;
        }
        
        let signedEvent;
        signedEvent = await signEventTemplate(eventTemplate);
        
        // Validate signed event before publishing
        if (!signedEvent || !signedEvent.id || !signedEvent.sig || !signedEvent.pubkey) {
            showStatus('Event signing failed. Please try again.', 'error');
            console.error('Invalid signed event:', signedEvent);
            return;
        }
        
        // Publish to all configured relays (only those with Post enabled)
        // Create new connections for each publish to avoid closed connection errors
        const relayUrls = getWritableRelayUrls();
        
        if (relayUrls.length === 0) {
            trackNrWebEvent('nr_note_publish_result', {
                ...getNrWebAnalyticsAreaData(plusCode),
                circle_slug: selectedCircle || '',
                expiration_bucket: getNrWebExpirationAnalyticsBucket(expirationSeconds),
                failed_count: 0,
                has_circle: !!selectedCircle,
                intent: selectedIntent || '',
                relay_count: 0,
                signer: getNrWebSignerAnalyticsType(),
                status: 'no_relays',
                ...getCurrentTrustrootsUsernameAnalyticsData(),
            });
            showStatus('No relays enabled for posting. Enable "Post" toggle for at least one relay.', 'error');
            return;
        }
        
        const publishPromises = relayUrls.map(url => publishToRelayWithRetries(url, signedEvent));
        const results = await Promise.all(publishPromises);
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success).map(r => ({ url: r.url, error: r.error }));
        
        if (successful.length > 0) {
            trackNrWebEvent('nr_note_publish_result', {
                ...getNrWebAnalyticsAreaData(plusCode),
                circle_slug: selectedCircle || '',
                expiration_bucket: getNrWebExpirationAnalyticsBucket(expirationSeconds),
                failed_count: failed.length,
                has_circle: !!selectedCircle,
                intent: selectedIntent || '',
                relay_count: relayUrls.length,
                signer: getNrWebSignerAnalyticsType(),
                status: failed.length > 0 ? 'partial' : 'success',
                ...getCurrentTrustrootsUsernameAnalyticsData(),
            });
            const relayWord = successful.length === 1 ? 'relay' : 'relays';
            let statusMessage = `Note published to ${successful.length} ${relayWord}`;
            if (failed.length > 0) {
                const failedRelays = failed.map(f => f.url).join(', ');
                statusMessage += ` (${failed.length} failed: ${failedRelays})`;
            }
            showStatus(statusMessage, 'success');
            signedEvent.relayScope = getRelayScopeFromRelayUrls(successful.map((r) => r.url));
            // Add to local events
            processIncomingEvent(signedEvent);
            // Clear form and refresh notes
            document.getElementById('note-content-in-modal').value = '';
            document.getElementById('note-expiration-in-modal').value = getExpirationSetting();
            // Clear selected circle after posting
            clearSelectedCircle('modal');
            // Clear selected intent after posting (don't persist as sticky default)
            selectedIntent = null;
            persistStickyIntent(null);
            renderIntentChips();
            // Refresh the notes display after a short delay to ensure grid is updated
            setTimeout(() => {
                showNotesForPlusCode(selectedPlusCode);
            }, 100);
        } else {
            trackNrWebEvent('nr_note_publish_result', {
                ...getNrWebAnalyticsAreaData(plusCode),
                circle_slug: selectedCircle || '',
                expiration_bucket: getNrWebExpirationAnalyticsBucket(expirationSeconds),
                failed_count: failed.length,
                has_circle: !!selectedCircle,
                intent: selectedIntent || '',
                relay_count: relayUrls.length,
                signer: getNrWebSignerAnalyticsType(),
                status: 'failed',
                ...getCurrentTrustrootsUsernameAnalyticsData(),
            });
            markRelaysWithPublishFailures(failed);
            const relayWord = failed.length === 1 ? 'relay' : 'relays';
            const hasProfileMissingRestriction = failed.some(f => isTrustrootsProfileMissingRelayError(f.error));
            if (hasProfileMissingRestriction) {
                showStatus(
                    `Could not publish to ${relayWord}: relays did not find a Trustroots profile for this public key. Link your Trustroots username in Keys & profile, then try again.`,
                    'error',
                    { actions: [{ label: 'Open Keys & profile', onClick: () => openKeysModal() }] }
                );
            } else {
                const errorDetails = failed.map(f => {
                    const hostname = f.url;
                    const errorMsg = f.error ? ` (${formatRelayError(f.error)})` : '';
                    return `${hostname}${errorMsg}`;
                }).join(', ');
                const hint = getRelayPublishFailureHint(failed);
                showStatus(`Failed to publish to ${relayWord}: ${errorDetails}.${hint}`, 'error', { eventPayload: signedEvent, actions: [] });
            }
        }
    } catch (error) {
        console.error('Error publishing note:', error);
        showStatus('Error publishing note: ' + error.message, 'error');
    }
}

/** When setHashRoute(plusCode) is called from showNotesForPlusCode, skip the next hash-driven map_pluscode apply (avoids re-entry that clears compose options). */
let nrMapPlusCodeSuppressedUntil = null;
function normalizePlusCodeForHashSuppress(pc) {
    return String(pc || '').replace(/\s/g, '').toUpperCase();
}

function clampLatitudeForTile(lat) {
    return Math.max(-85.05112878, Math.min(85.05112878, Number(lat) || 0));
}

function lngLatToTileWorldPixel(lng, lat, zoom) {
    const scale = 256 * Math.pow(2, zoom);
    const safeLat = clampLatitudeForTile(lat);
    const sinLat = Math.sin((safeLat * Math.PI) / 180);
    return {
        x: ((Number(lng) + 180) / 360) * scale,
        y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
    };
}

function wrapLongitudeForTile(lng) {
    const n = Number(lng) || 0;
    return ((n + 180) % 360 + 360) % 360 - 180;
}

function tileWorldPixelToLngLat(x, y, zoom) {
    const scale = 256 * Math.pow(2, zoom);
    const lng = wrapLongitudeForTile((Number(x) / scale) * 360 - 180);
    const mercatorY = Math.PI - (2 * Math.PI * Number(y)) / scale;
    const lat = (180 / Math.PI) * Math.atan(Math.sinh(mercatorY));
    return { lng, lat: clampLatitudeForTile(lat) };
}

function getAreaLocatorZoom(rectangle, previewWidth, previewHeight) {
    if (!rectangle || rectangle.length < 4) return 3;
    const sw = rectangle[0];
    const ne = rectangle[2];
    const maxWidth = Math.max(96, previewWidth * 0.62);
    const maxHeight = Math.max(48, previewHeight * 0.62);
    for (let zoom = 13; zoom >= 1; zoom--) {
        const westSouth = lngLatToTileWorldPixel(sw[0], sw[1], zoom);
        const eastNorth = lngLatToTileWorldPixel(ne[0], ne[1], zoom);
        const width = Math.abs(eastNorth.x - westSouth.x);
        const height = Math.abs(westSouth.y - eastNorth.y);
        if (width <= maxWidth && height <= maxHeight) return zoom;
    }
    return 1;
}

function tileUrlForAreaLocator(zoom, x, y) {
    return `https://tiles.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png`;
}

function renderAreaLocationTiles(mapEl, centerLng, centerLat, zoom) {
    const tileGrid = document.getElementById('area-location-tile-grid');
    if (!mapEl || !tileGrid) return;
    tileGrid.replaceChildren();

    const world = lngLatToTileWorldPixel(centerLng, centerLat, zoom);
    const tileX = Math.floor(world.x / 256);
    const tileY = Math.floor(world.y / 256);
    const fracX = world.x - tileX * 256;
    const fracY = world.y - tileY * 256;
    const tileCount = Math.pow(2, zoom);

    tileGrid.style.left = `calc(50% - ${256 + fracX}px)`;
    tileGrid.style.top = `calc(50% - ${256 + fracY}px)`;

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const wrappedX = ((tileX + dx) % tileCount + tileCount) % tileCount;
            const y = tileY + dy;
            if (y < 0 || y >= tileCount) continue;
            const img = document.createElement('img');
            img.alt = '';
            img.decoding = 'async';
            img.loading = 'eager';
            img.src = tileUrlForAreaLocator(zoom, wrappedX, y);
            img.style.left = `${(dx + 1) * 256}px`;
            img.style.top = `${(dy + 1) * 256}px`;
            tileGrid.appendChild(img);
        }
    }
}

function renderAreaLocationCell(cellEl, rectangle, centerLng, centerLat, zoom, previewWidth, previewHeight) {
    if (!cellEl || !rectangle || rectangle.length < 4) return;
    const sw = rectangle[0];
    const ne = rectangle[2];
    const center = lngLatToTileWorldPixel(centerLng, centerLat, zoom);
    const swPx = lngLatToTileWorldPixel(sw[0], sw[1], zoom);
    const nePx = lngLatToTileWorldPixel(ne[0], ne[1], zoom);
    const rawWidth = Math.abs(nePx.x - swPx.x);
    const rawHeight = Math.abs(swPx.y - nePx.y);
    const width = Math.min(previewWidth * 0.74, Math.max(40, rawWidth));
    const height = Math.min(previewHeight * 0.74, Math.max(34, rawHeight));
    const midpointX = (swPx.x + nePx.x) / 2;
    const midpointY = (swPx.y + nePx.y) / 2;
    const left = previewWidth / 2 + (midpointX - center.x) - width / 2;
    const top = previewHeight / 2 + (midpointY - center.y) - height / 2;

    cellEl.style.inset = 'auto';
    cellEl.style.left = `${Math.max(10, Math.min(previewWidth - width - 10, left))}px`;
    cellEl.style.top = `${Math.max(10, Math.min(previewHeight - height - 10, top))}px`;
    cellEl.style.width = `${width}px`;
    cellEl.style.height = `${height}px`;
}

let areaLocationPreviewState = null;
let areaLocationPreviewWired = false;

function renderAreaLocationPreviewFromState() {
    const state = areaLocationPreviewState;
    const mapEl = document.querySelector('.area-location-map');
    const cellEl = document.getElementById('area-location-cell');
    if (!state || !mapEl || !cellEl) return;
    const previewRect = mapEl.getBoundingClientRect();
    const previewWidth = Math.max(220, previewRect.width || 288);
    const previewHeight = Math.max(104, previewRect.height || 128);
    renderAreaLocationTiles(mapEl, state.centerLng, state.centerLat, state.zoom);
    renderAreaLocationCell(cellEl, state.rectangle, state.centerLng, state.centerLat, state.zoom, previewWidth, previewHeight);
}

function wireAreaLocationPreviewControls() {
    if (areaLocationPreviewWired) return;
    const mapEl = document.querySelector('.area-location-map');
    if (!mapEl) return;
    areaLocationPreviewWired = true;

    mapEl.addEventListener('click', () => {
        setHashRoute('');
    });
    mapEl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setHashRoute('');
    });
}

function renderAreaLocationCard(plusCode) {
    const codeEl = document.getElementById('area-location-code');
    const mapEl = document.querySelector('.area-location-map');
    const tileGrid = document.getElementById('area-location-tile-grid');
    const value = String(plusCode || '').trim();
    if (codeEl) codeEl.textContent = value;
    if (tileGrid) tileGrid.replaceChildren();
    areaLocationPreviewState = null;
    wireAreaLocationPreviewControls();
    try {
        const rectangle = plusCodeToRectangle(value);
        if (rectangle && rectangle.length >= 4) {
            const sw = rectangle[0];
            const ne = rectangle[2];
            const latMidNumber = (Number(sw[1]) + Number(ne[1])) / 2;
            const lngMidNumber = (Number(sw[0]) + Number(ne[0])) / 2;
            if (mapEl) {
                const previewRect = mapEl.getBoundingClientRect();
                const previewWidth = Math.max(220, previewRect.width || 288);
                const previewHeight = Math.max(104, previewRect.height || 128);
                const zoom = getAreaLocatorZoom(rectangle, previewWidth, previewHeight);
                areaLocationPreviewState = {
                    plusCode: value,
                    rectangle,
                    centerLng: lngMidNumber,
                    centerLat: latMidNumber,
                    zoom,
                    homeLng: lngMidNumber,
                    homeLat: latMidNumber,
                    homeZoom: zoom,
                };
                renderAreaLocationPreviewFromState();
            }
        }
    } catch (_) {}
}

function showNotesForPlusCode(plusCode, options = {}) {
    selectedPlusCode = plusCode;
    rememberLastHostPlusCode(plusCode);
    const analyticsCircleSlug = options.circleSlug || selectedCircle || '';
    trackNrWebSurfaceEvent('nr_host_area_opened', `host:${String(plusCode || '').trim().toUpperCase()}`, {
        ...getNrWebAnalyticsAreaData(plusCode),
        circle_slug: analyticsCircleSlug,
        has_circle: !!analyticsCircleSlug,
        route_type: 'host_area',
        surface: 'host',
        ...getCurrentTrustrootsUsernameAnalyticsData(),
    });
    showAreaSurface();
    updateNoteComposePostingIcon();
    
    // Use fast spatial index lookup instead of filtering all events
    const { eventsForPlusCodeExactly, eventsWithinPlusCode } = filterEventsForPlusCodeFast(plusCode);
    
    // Merge exact matches into within plus code section, avoiding duplicates
    const allEventsMap = new Map();
    eventsForPlusCodeExactly.forEach(event => {
        allEventsMap.set(event.id, event);
    });
    eventsWithinPlusCode.forEach(event => {
        // Only add if not already in exact matches (avoid duplicates)
        if (!allEventsMap.has(event.id)) {
            allEventsMap.set(event.id, event);
        }
    });
    
    // Fallback: If spatial index returned very few results but we have many events,
    // do a direct filter from events array as a safety check
    const spatialIndexResults = allEventsMap.size;
    if (spatialIndexResults === 0 && events.length > 0) {
        console.warn('[showNotesForPlusCode] Spatial index returned 0 results, falling back to direct filter');
        // Direct filter as fallback
        events.forEach(event => {
            if (isEventDeleted(event) || isEventExpired(event) || event.kind === DELETION_KIND) {
                return;
            }
            const eventPlusCode = getPlusCodeFromEvent(event);
            if (eventPlusCode) {
                const eventMatches = eventPlusCode === plusCode || 
                                    isPlusCodeInsidePlusCode(plusCode, eventPlusCode);
                if (eventMatches) {
                    allEventsMap.set(event.id, event);
                }
            }
        });
    }
    
    // Filter out expired events (already filtered in filterEventsForPlusCodeFast, but double-check)
    const nonExpiredEvents = Array.from(allEventsMap.values()).filter(event => {
        const isExpired = isEventExpired(event);
        const isDeleted = isEventDeleted(event);
        return !isExpired && !isDeleted;
    });
    
    // De-duplicate near-identical notes for display. Relays can return auth-relay
    // map notes (30397) and validation reposts (30398) for the same user-visible
    // note, or only auth-relay 30397 when no sibling repost is present. Prefer
    // entries with a Trustroots username and reposts when both exist.
    const repostTargets = new Set();
    nonExpiredEvents.forEach(event => {
        if (event.kind !== MAP_NOTE_REPOST_KIND || !Array.isArray(event.tags)) return;
        const targetTag = event.tags.find(tag => Array.isArray(tag) && tag[0] === 'e' && tag[1]);
        if (targetTag && targetTag[1]) repostTargets.add(targetTag[1]);
    });

    const dedupedForDisplay = new Map();
    nonExpiredEvents.forEach(event => {
        const eventPlusCode = getPlusCodeFromEvent(event) || '';
        const content = (event.content || '').trim();
        const eventTags = Array.isArray(event.tags) ? event.tags : [];
        const originalAuthorTag = eventTags.find(tag => Array.isArray(tag) && tag[0] === 'p' && tag[1]);
        const originalCreatedAtTag = eventTags.find(tag => Array.isArray(tag) && tag[0] === 'original_created_at' && tag[1]);
        const canonicalAuthorPubkey = event.kind === MAP_NOTE_REPOST_KIND && originalAuthorTag
            ? originalAuthorTag[1]
            : event.pubkey;
        const canonicalCreatedAt = event.kind === MAP_NOTE_REPOST_KIND && originalCreatedAtTag
            ? Number.parseInt(originalCreatedAtTag[1], 10) || (event.created_at || 0)
            : (event.created_at || 0);

        // Primary dedupe key: when repost links to original, treat as same note.
        let dedupeKey = '';
        if (event.kind === MAP_NOTE_REPOST_KIND && eventTags.length > 0) {
            const targetTag = eventTags.find(tag => Array.isArray(tag) && tag[0] === 'e' && tag[1]);
            if (targetTag && targetTag[1]) dedupeKey = `origin:${targetTag[1]}`;
        } else if (event.kind === MAP_NOTE_KIND && repostTargets.has(event.id)) {
            dedupeKey = `origin:${event.id}`;
        }

        // Secondary key: canonical original author + original timestamp (from repost tag),
        // plus code, and content. This dedupes original/repost pairs even when IDs differ.
        if (!dedupeKey && canonicalAuthorPubkey) {
            dedupeKey = `canonical:${canonicalAuthorPubkey}|${canonicalCreatedAt}|${eventPlusCode}|${content}`;
        }

        // Last-resort fallback: tolerate reposts with shifted second-level timestamp.
        if (!dedupeKey) {
            const createdAtMinute = Math.floor((event.created_at || 0) / 60);
            dedupeKey = `fallback:${createdAtMinute}|${eventPlusCode}|${content}`;
        }

        const currentBest = dedupedForDisplay.get(dedupeKey);
        const trNip = pubkeyToNip05.get(canonicalAuthorPubkey);
        const hasTrNip05 = !!(trNip && isTrustrootsNip05Lower(trNip));
        const hasUsername = !!pubkeyToUsername.get(canonicalAuthorPubkey);
        const score = ((hasTrNip05 || hasUsername) ? 10 : 0) + (event.kind === MAP_NOTE_REPOST_KIND ? 1 : 0);

        if (!currentBest || score > currentBest.score) {
            dedupedForDisplay.set(dedupeKey, { event, score });
        }
    });

    const sortedAll = Array.from(dedupedForDisplay.values())
        .map(item => item.event)
        .sort((a, b) => a.created_at - b.created_at);

    void prefetchTrustrootsProfilesForNoteMentions([
        ...collectMapNoteMentionNpubHexes(sortedAll),
        ...collectMapNoteAuthorHexes(sortedAll),
    ], plusCode);
    
    // Update area page title
    document.getElementById('pluscode-notes-title').textContent = 'Host & Meet';
    document.getElementById('pluscode-notes-title').dataset.pluscode = plusCode;
    renderAreaLocationCard(plusCode);
    
    renderNotificationSubscribeBlock(plusCode);
    
    // Build notes content
    const notesContent = document.getElementById('pluscode-notes-content');
    notesContent.innerHTML = '';
    
    // Single section for all notes
    if (sortedAll.length > 0) {
        const notesSection = document.createElement('div');
        notesSection.className = 'notes-section';
        
        let renderedCount = 0;
        sortedAll.forEach(event => {
            try {
                const noteItem = createNoteItem(event);
                notesSection.appendChild(noteItem);
                renderedCount++;
            } catch (error) {
                console.error('[showNotesForPlusCode] Error creating note item:', error, event);
            }
        });
        
        notesContent.appendChild(notesSection);
    } else {
        // Show message if no notes
        const noNotes = document.createElement('div');
        noNotes.className = 'notes-section';
        noNotes.innerHTML = '<p style="color: var(--muted-foreground); text-align: center; padding: 2rem;">Nothing here yet. Be the first to post in this area.</p>';
        notesContent.appendChild(noNotes);
    }
    
    // Clear / seed form when opening modal (skip when refreshing list after async profile fetch)
    const noteTa = document.getElementById('note-content-in-modal');
    if (!options.preserveCompose) {
        if (noteTa) {
            noteTa.value = typeof options.initialContent === 'string' ? options.initialContent : '';
        }
        const expEl = document.getElementById('note-expiration-in-modal');
        if (expEl) expEl.value = getExpirationSetting();
        if (options.circleSlug) {
            selectCircle(options.circleSlug);
        }

        // Resolve initial intent: explicit option > sticky last choice > fallback default
        if (Object.prototype.hasOwnProperty.call(options, 'intent')) {
            selectedIntent = isIntentId(options.intent) ? options.intent : null;
            persistStickyIntent(selectedIntent);
        } else if (!selectedIntent) {
            selectedIntent = getStickyIntent();
            if (!selectedIntent) selectedIntent = 'wanttomeet';
        }
    }
    renderIntentChips();

    // Update the grid to highlight the selected plus code (moss green) BEFORE panning
    updatePlusCodeGrid();

    // Host & Meet is a standalone page; the static locator replaces background map panning.
    if (map && !options.preserveMapView && !isHostSurfaceOpen()) {
        try {
            const rectangle = plusCodeToRectangle(plusCode);
            if (rectangle && rectangle.length >= 4) {
                // Rectangle is [lng, lat] pairs; MapLibre wants [lng, lat], Leaflet wants [lat, lng].
                const swLngLat = rectangle[0];
                const neLngLat = rectangle[2];
                const isLeaflet = mapFallbackMode === 'leaflet';
                const sw = isLeaflet ? [swLngLat[1], swLngLat[0]] : swLngLat;
                const ne = isLeaflet ? [neLngLat[1], neLngLat[0]] : neLngLat;

                const isMobile = window.innerWidth <= 768;

                if (isMobile) {
                    // On mobile, modal covers bottom 60%, so add bottom padding
                    // to ensure area is visible in top 40% of screen.
                    const bottomPadding = window.innerHeight * 0.65;
                    const opts = isLeaflet
                        ? {
                            paddingTopLeft: [20, 60],
                            paddingBottomRight: [20, bottomPadding],
                            animate: true,
                            duration: 0.3,
                        }
                        : {
                            padding: {
                                top: 60,
                                bottom: bottomPadding,
                                left: 20,
                                right: 20,
                            },
                            duration: 300,
                        };
                    map.fitBounds([sw, ne], opts);
                } else {
                    map.fitBounds([sw, ne], isLeaflet
                        ? { padding: [50, 50], animate: true, duration: 0.3 }
                        : { padding: 50, duration: 300 });
                }
            }
        } catch (fitErr) {
            console.warn('[showNotesForPlusCode] fitBounds failed (modal still opens):', fitErr && fitErr.message ? fitErr.message : fitErr);
        }
    }
    if (!options.preserveCompose) {
        const pcNorm = normalizePlusCodeForHashSuppress(plusCode);
        nrMapPlusCodeSuppressedUntil = pcNorm;
        const hashBefore = location.hash;
        setHashRoute(plusCode);
        if (location.hash === hashBefore && nrMapPlusCodeSuppressedUntil === pcNorm) {
            nrMapPlusCodeSuppressedUntil = null;
        }
    }

    // Scroll to bottom and focus on textarea after modal is shown
    if (!options.preserveCompose) setTimeout(() => {
        // Scroll notes list to bottom
        const notesList = document.getElementById('pluscode-notes-content');
        if (notesList) {
            notesList.scrollTop = notesList.scrollHeight;
        }
        
        // Focus on the textarea and set up keyboard handler
        const textarea = document.getElementById('note-content-in-modal');
        if (textarea) {
            textarea.focus();
            // Handle Enter key: submit on Enter, new line on Shift+Enter
            // Only set up listener once
            if (!textarea.dataset.enterHandlerSetup) {
                textarea.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        publishNoteFromModal();
                    }
                    // Shift+Enter allows default behavior (new line)
                });
                textarea.dataset.enterHandlerSetup = 'true';
            }
        }
    }, 150);
}

/** Original map-note author (kind 30398 uses validator pubkey; `p` tags original). */
function getMapNoteDisplayAuthorPubkey(event) {
    const tags = Array.isArray(event?.tags) ? event.tags : [];
    const pTag = tags.find((t) => Array.isArray(t) && t[0] === 'p' && t[1]);
    if (event?.kind === MAP_NOTE_REPOST_KIND && pTag) return String(pTag[1]);
    return event?.pubkey;
}

function createNoteItem(event) {
    const { row: noteItem, wrap: messageStack, bubble, actionRail } = createMessageShell({
        eventId: event?.id || '',
        rowClass: 'host-note-row',
        wrapClass: 'host-note-stack',
        bubbleClass: 'host-note-bubble',
    });
    
    const metaRow = document.createElement('div');
    metaRow.className = 'message-author host-note-author-line';
    
    const timeEl = document.createElement('span');
    timeEl.className = 'time host-note-inline-time';
    timeEl.textContent = formatMessageTimestamp(event.created_at) || formatDate(event.created_at);
    
    // Get plus code from event
    const plusCode = getPlusCodeFromEvent(event);
    const authorPk = getMapNoteDisplayAuthorPubkey(event);
    const authorPic = sanitizeProfileImageUrl(pubkeyToPicture.get(String(authorPk || '').toLowerCase()));
    if (authorPic) {
        const avatar = document.createElement('img');
        avatar.className = 'note-author-avatar';
        avatar.alt = '';
        avatar.loading = 'lazy';
        avatar.decoding = 'async';
        avatar.referrerPolicy = 'no-referrer';
        if (window.NrWeb && typeof window.NrWeb.setProfileImageWithResolvedCache === 'function') {
            window.NrWeb.setProfileImageWithResolvedCache(avatar, authorPic, '');
        } else {
            avatar.src = authorPic;
        }
        metaRow.appendChild(avatar);
    }
    
    const author = document.createElement('span');
    author.className = 'note-author';
    author.innerHTML = renderPubkeyLabelHtml(authorPk, { shortUnknown: true });
    
    // Put the author above the bubble, similar to the chat thread treatment.
    metaRow.appendChild(author);

    const meta = document.createElement('div');
    meta.className = 'meta host-note-footer';
    const metaMain = document.createElement('span');
    metaMain.className = 'message-meta-main';
    metaMain.appendChild(timeEl);
    meta.appendChild(metaMain);
    
    // Add expiration indicator if event has expiration
    const remainingSeconds = getRemainingTime(event);
    if (remainingSeconds !== null) {
        const expirySpan = document.createElement('span');
        expirySpan.className = 'message-nip-pill note-expiry';
        const formattedTime = formatRemainingTime(remainingSeconds);
        expirySpan.textContent = `⏱️ ${formattedTime}`;
        
        // Style based on urgency
        if (remainingSeconds <= 0) {
            expirySpan.style.color = 'var(--destructive)';
        } else if (remainingSeconds < 24 * 60 * 60) {
            // Less than 24 hours - warning color (orange/amber)
            expirySpan.style.color = '#f59e0b';
        } else {
            expirySpan.style.color = 'var(--muted-foreground)';
        }
        
        // Get expiration timestamp for tooltip
        const expirationTimestamp = getExpirationTimestamp(event);
        if (expirationTimestamp) {
            const expirationDate = new Date(expirationTimestamp * 1000);
            expirySpan.title = `Expires: ${expirationDate.toLocaleString()}`;
        }
        
        metaMain.appendChild(expirySpan);
    }
    
    // Check if this is the user's own event (for delete button)
    const isCurrentUser = currentPublicKey && 
        event.pubkey.toLowerCase() === currentPublicKey.toLowerCase();

    const relayScope = event?.relayScope;
    if (relayScope === 'public' || relayScope === 'auth') {
        const relayScopePill = document.createElement('span');
        relayScopePill.className = 'message-relay-pill note-relay-scope-pill';
        relayScopePill.textContent = relayScope === 'public' ? '🌍' : '🔐';
        relayScopePill.title = relayScope === 'public'
            ? 'Published to public relay(s)'
            : 'Published to auth-required relay(s)';
        metaMain.appendChild(relayScopePill);
    }

    messageStack.appendChild(metaRow);

    const intentId = detectNoteIntent(event);
    const intent = intentId ? getIntentById(intentId) : null;
    const visibleContent = intentId
        ? stripLeadingIntentHashtag(event.content || '', intentId)
        : (event.content || '');

    const content = document.createElement('div');
    content.className = 'host-note-content';
    if (intent) {
        const badge = document.createElement('span');
        badge.className = `nr-note-intent-badge nr-note-intent-${intent.id}`;
        badge.textContent = intent.label;
        badge.title = intent.hint;
        content.appendChild(badge);
        content.appendChild(document.createTextNode(' '));
    }
    const textSpan = document.createElement('span');
    textSpan.innerHTML = linkifyMessageTextHtml(escapeHtml(visibleContent));
    content.appendChild(textSpan);
    bubble.appendChild(content);

    if (plusCode) {
        const locationLine = document.createElement('div');
        locationLine.className = 'host-note-location';
        const locationIcon = document.createElement('span');
        locationIcon.className = 'host-note-location-icon';
        locationIcon.setAttribute('aria-hidden', 'true');
        locationIcon.textContent = '⌖';
        const plusCodeLink = document.createElement('a');
        plusCodeLink.className = 'host-note-pluscode';
        plusCodeLink.href = `#${encodeURIComponent(plusCode).replace(/%2B/g, '+')}`;
        plusCodeLink.textContent = plusCode;
        locationLine.appendChild(locationIcon);
        locationLine.appendChild(plusCodeLink);
        bubble.appendChild(locationLine);
    }

    bubble.appendChild(meta);

    messageStack.appendChild(bubble);

    actionRail.classList.add('host-note-action-rail');

    const copyBtn = createMessageActionButton({
        label: 'Copy note text',
        title: 'Copy note text',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    });
    copyBtn.addEventListener('click', async () => {
        const ok = await copyTextToClipboard(visibleContent || event.content || '');
        showStatus(ok ? 'Note copied.' : 'Failed to copy note.', ok ? 'success' : 'error');
    });
    actionRail.appendChild(copyBtn);

    const copyJsonBtn = createMessageActionButton({
        label: 'Copy event JSON',
        title: 'Copy event JSON',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>',
    });
    copyJsonBtn.addEventListener('click', async () => {
        const ok = await copyTextToClipboard(JSON.stringify(event, null, 2));
        showStatus(ok ? 'Event JSON copied.' : 'Failed to copy event JSON.', ok ? 'success' : 'error');
    });
    actionRail.appendChild(copyJsonBtn);

    if (isCurrentUser) {
        const deleteBtn = createMessageActionButton({
            label: 'Delete this note',
            title: 'Delete this note',
            danger: true,
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
        });
        deleteBtn.classList.add('note-delete-btn');
        deleteBtn.setAttribute('data-note-id', event.id);
        deleteBtn.dataset.idleHtml = deleteBtn.innerHTML;
        deleteBtn.addEventListener('click', () => {
            deleteEvent(event.id, deleteBtn);
        });
        actionRail.appendChild(deleteBtn);
    }

    noteItem.appendChild(messageStack);
    noteItem.appendChild(actionRail);

    return noteItem;
}

async function deleteEvent(eventId, deleteButton) {
    if (!hasRelayAuthSigningCapability()) {
        showStatus('No signing method available. Please import, generate, or connect a supported browser extension.', 'error');
        return;
    }
    
    if (!currentPublicKey) {
        showStatus('No public key available', 'error');
        return;
    }
    
    // Find the event to verify it exists and belongs to user
    const eventToDelete = events.find(e => e.id === eventId);
    if (!eventToDelete) {
        showStatus('Event not found', 'error');
        return;
    }
    
    // Verify it's the user's event
    if (eventToDelete.pubkey.toLowerCase() !== currentPublicKey.toLowerCase()) {
        showStatus('You can only delete your own events', 'error');
        return;
    }
    
    // Show confirmation dialog
    if (!confirm('Are you sure you want to delete this note?\n\nNote: Due to the decentralized nature of Nostr, we cannot guarantee that the note will be removed from all relays. Some relays may have cached copies.')) {
        return;
    }
    
    // Update button state
    if (deleteButton) {
        deleteButton.disabled = true;
        deleteButton.classList.add('deleting');
        deleteButton.textContent = '⏳';
        deleteButton.title = 'Deleting note...';
    }
    
    try {
        // Create kind 5 deletion event
        const deletionEvent = {
            kind: DELETION_KIND,
            content: 'Deleted by user',
            tags: [['e', eventId]],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: currentPublicKey
        };
        
        let signedEvent;
        signedEvent = await signEventTemplate(deletionEvent);
        
        // Publish only to relays that have posting enabled.
        const relayUrls = getWritableRelayUrls();
        
        if (relayUrls.length === 0) {
            showStatus('No relays enabled for posting. Enable "Post" toggle for at least one relay.', 'error');
            return;
        }
        
        if (deleteButton && relayUrls.length > 0) {
            deleteButton.textContent = '⏳';
        }
        
        const publishPromises = relayUrls.map(async (url, index) => {
            try {
                if (deleteButton && relayUrls.length > 1) {
                    deleteButton.textContent = '⏳';
                }
                return await publishToRelayWithRetries(url, signedEvent);
            } catch (error) {
                console.error(`Error publishing deletion to ${url}:`, error);
                return { success: false, url, error: error?.message || String(error) };
            }
        });
        
        const results = await Promise.allSettled(publishPromises);
        const successCount = results.filter(
            (r) => r.status === 'fulfilled' && r.value && r.value.success
        ).length;
        const failedCount = relayUrls.length - successCount;

        if (successCount === 0) {
            if (deleteButton) {
                deleteButton.disabled = false;
                deleteButton.classList.remove('deleting');
                if (deleteButton.dataset.idleHtml) deleteButton.innerHTML = deleteButton.dataset.idleHtml;
                deleteButton.title = 'Delete this note';
            }
            showStatus(
                failedCount > 0
                    ? `Delete failed on all ${failedCount} relays.`
                    : 'Delete failed on all relays.',
                'error'
            );
            return;
        }
        
        // Update button to show completion
        if (deleteButton) {
            deleteButton.textContent = '✓';
            deleteButton.classList.remove('deleting');
            deleteButton.classList.add('deleted');
        }
        
        // Remove event from local events array
        const eventIndex = events.findIndex(e => e.id === eventId);
        if (eventIndex !== -1) {
            events.splice(eventIndex, 1);
        }
        
        // Also add the deletion event to events array so it can be used for filtering
        const deletionEventData = {
            id: signedEvent.id,
            kind: signedEvent.kind,
            pubkey: signedEvent.pubkey,
            content: signedEvent.content,
            created_at: signedEvent.created_at,
            tags: signedEvent.tags,
            sig: signedEvent.sig
        };
        events.push(deletionEventData);
        
        // Update cache
        void flushMapCacheToIndexedDB().catch((e) => console.warn('flushMapCacheToIndexedDB:', e));
        cachedFilteredEvents = null;
        filteredEventsCacheKey = null;
        
        // Rebuild spatial index
        rebuildSpatialIndex();
        
        // Update UI
        updateMapMarkers();
        if (map && map.loaded()) {
            updatePlusCodeGrid();
        }
        
        // Refresh notes list if modal is open
        if (selectedPlusCode) {
            setTimeout(() => {
                showNotesForPlusCode(selectedPlusCode);
            }, 100);
        }
        
        // Show success message
        if (failedCount > 0) {
            showStatus(`Note deleted on ${successCount} relays (${failedCount} failed)`, 'success');
        } else {
            showStatus(`Note deleted on ${successCount} relays`, 'success');
        }
        
        // Brief delay to show success state, then remove from UI
        setTimeout(() => {
            if (selectedPlusCode) {
                showNotesForPlusCode(selectedPlusCode);
            }
        }, 500);
        
    } catch (error) {
        console.error('Error deleting note:', error);
        
        // Reset button state on error
        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.classList.remove('deleting');
            if (deleteButton.dataset.idleHtml) deleteButton.innerHTML = deleteButton.dataset.idleHtml;
            deleteButton.title = 'Delete this note';
        }
        
        showStatus('Failed to delete note: ' + error.message, 'error');
    }
}

function closeActiveModal() {
    // Close any active modal
    const modals = document.querySelectorAll('.modal.active');
    modals.forEach(modal => {
        if (modal.id === 'keys-modal') {
            let hasStoredKey = false;
            try {
                hasStoredKey = !!readValidStoredKeyHex();
            } catch (_) {}
            if (!hasStoredKey) return;
            closeKeysModal();
        } else if (modal.id === 'pluscode-notes-modal') {
            closePlusCodeNotesModal();
        } else if (modal.id === 'settings-modal') {
            closeSettingsModal();
        } else if (modal.id === 'help-modal') {
            closeHelpModal();
        } else {
            modal.classList.remove('active');
        }
    });
}

function showStatus(message, type, options) {
    options = options || {};
    let statusContainer = document.getElementById('status-container');
    if (!statusContainer) {
        statusContainer = document.createElement('div');
        statusContainer.id = 'status-container';
        statusContainer.className = 'status-container';
        document.body.appendChild(statusContainer);
    }
    
    let status = null;
    if (options.id) {
        status = statusContainer.querySelector(`.status[data-status-id="${options.id}"]`);
    }
    if (!status) {
        status = document.createElement('div');
        statusContainer.appendChild(status);
    } else if (status._hideTimer) {
        clearTimeout(status._hideTimer);
    }
    status.className = `status ${type}`;
    if (options.id) status.setAttribute('data-status-id', options.id);
    status.innerHTML = '';
    
    const msgEl = document.createElement('div');
    msgEl.textContent = message;
    status.appendChild(msgEl);

    if (Array.isArray(options.actions) && options.actions.length > 0) {
        const actions = document.createElement('div');
        actions.className = 'status-event-actions';
        options.actions.forEach((action) => {
            if (!action || typeof action.label !== 'string' || typeof action.onClick !== 'function') return;
            const actionBtn = document.createElement('button');
            actionBtn.type = 'button';
            actionBtn.textContent = action.label;
            actionBtn.addEventListener('click', action.onClick);
            actions.appendChild(actionBtn);
        });
        if (actions.childElementCount > 0) {
            status.appendChild(actions);
        }
    }
    
    if (options.eventPayload) {
        const json = JSON.stringify(options.eventPayload, null, 2);
        const actions = document.createElement('div');
        actions.className = 'status-event-actions';
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy event JSON';
        copyBtn.type = 'button';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(json).then(() => { copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy event JSON'; }, 1500); }).catch(() => { copyBtn.textContent = 'Copy failed'; });
        });
        const showBtn = document.createElement('button');
        showBtn.textContent = 'Show event data';
        showBtn.type = 'button';
        const pre = document.createElement('pre');
        pre.className = 'status-event-pre';
        pre.textContent = json;
        pre.style.display = 'none';
        showBtn.addEventListener('click', () => {
            const visible = pre.style.display !== 'none';
            pre.style.display = visible ? 'none' : 'block';
            showBtn.textContent = visible ? 'Show event data' : 'Hide event data';
        });
        actions.appendChild(copyBtn);
        actions.appendChild(showBtn);
        status.appendChild(actions);
        status.appendChild(pre);
    }
    
    let hideMs = options.eventPayload ? 15000 : 5000;
    if (Array.isArray(options.actions) && options.actions.length > 0) {
        hideMs = Math.max(hideMs, 14000);
    }
    status._hideTimer = setTimeout(() => {
        if (status.parentNode) status.parentNode.removeChild(status);
    }, hideMs);
}

function normalizeRelayUrlForKeysLog(url) {
    try {
        const parsed = new URL(String(url || ''));
        return `${parsed.protocol}//${parsed.host}`.toLowerCase();
    } catch (_) {
        return String(url || '').trim().toLowerCase();
    }
}

function clearKeysLinkLog() {
    const el = document.getElementById('keys-link-log');
    if (!el) return;
    el.textContent = '';
}

function isKeysLinkLogEnabled() {
    return window.NrWebKeysModal?.isKeysLogEnabled?.() === true;
}

function appendKeysLinkLog(message) {
    if (!isKeysLinkLogEnabled()) return;
    const el = document.getElementById('keys-link-log');
    if (!el) return;
    const ts = new Date().toISOString().slice(11, 19);
    el.textContent += `[${ts}] ${message}\n`;
    el.scrollTop = el.scrollHeight;
}

// Check if profile is linked (has kind 10390 event)
async function checkProfileLinked() {
    if (profileLinkCheckInFlight) return await profileLinkCheckInFlight;
    const now = Date.now();
    if (now - profileLinkCheckLastRunAt < PROFILE_LINK_CHECK_COOLDOWN_MS) {
        appendKeysLinkLog('Skipping duplicate profile check (cooldown active)');
        return;
    }
    profileLinkCheckInFlight = checkProfileLinkedCore()
        .finally(() => {
            profileLinkCheckLastRunAt = Date.now();
            profileLinkCheckInFlight = null;
        });
    return await profileLinkCheckInFlight;
}

async function checkProfileLinkedCore() {
    if (!currentPublicKey) {
        appendKeysLinkLog('Profile check skipped: no public key loaded');
        isProfileLinked = false;
        usernameFromNostr = false;
        
        // Enable username field if no public key
        const usernameInput = document.getElementById('trustroots-username');
        const usernameIndicator = document.getElementById('username-nostr-indicator');
        if (usernameInput) {
            usernameInput.disabled = false;
        }
        if (usernameIndicator) {
            usernameIndicator.style.display = 'none';
        }
        
        updateLinkProfileButton();
        updateKeyDisplay({ skipProfileLookup: true });
        return;
    }
    const identityOk = await ensureNip7IdentityIsCurrent('profile check');
    if (!identityOk) return;
    
    try {
        const relayUrls = getRelayUrls();
        appendKeysLinkLog(`Checking Trustroots profile on ${relayUrls.length} relay${relayUrls.length === 1 ? '' : 's'}`);
        let foundLinked = false;
        let linkedUsername = null;
        const relayAuth = window.NrWebRelayAuth;
        const profileFilter = {
            kinds: [TRUSTROOTS_PROFILE_KIND],
            authors: [currentPublicKey],
            limit: 1
        };
        const applyProfileEvent = (event) => {
            if (!event) return;
            foundLinked = true;
            appendKeysLinkLog(`Found Trustroots profile event ${event.id || '<no id>'}`);
            const TRUSTROOTS_USERNAME_LABEL_NAMESPACE = 'org.trustroots:username';
            for (const tag of event.tags || []) {
                if (tag[0] === 'l' && tag[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE && tag[1]) {
                    linkedUsername = tag[1];
                    appendKeysLinkLog(`Found Trustroots username "${linkedUsername}" in Nostr profile`);
                    break;
                }
            }
        };
        
        // Check each relay for kind 10390 events
        const checkPromises = relayUrls.map(async (url) => {
            try {
                if (
                    isRestrictedRelayUrl(url) &&
                    hasRelayAuthSigningCapability() &&
                    relayAuth?.nip42SubscribeOnce
                ) {
                    appendKeysLinkLog(`Query auth relay ${url}`);
                    await relayAuth.nip42SubscribeOnce({
                        relayUrl: url,
                        filter: profileFilter,
                        authPubkey: currentPublicKey,
                        signEvent: async (eventTemplate) => signEventTemplate(eventTemplate),
                        onEvent: (event) => applyProfileEvent(event),
                        waitMs: 6500
                    });
                    return;
                }
                appendKeysLinkLog(`Query relay ${url}`);
                await oneshotQuery(url, profileFilter, {
                    onEvent: (event) => applyProfileEvent(event),
                    waitMs: 2000,
                });
            } catch (error) {
                appendKeysLinkLog(`Profile check failed on ${url}: ${error?.message || error}`);
                console.error(`Error checking profile link on ${url}:`, error);
            }
        });
        
        await Promise.allSettled(checkPromises);
        
        // Track if we cleared a username due to validation failure
        let usernameWasCleared = false;
        
        // If we found a linked username, validate it against NIP-05
        if (linkedUsername && currentPublicKey) {
            try {
                appendKeysLinkLog(`Validate ${linkedUsername}@trustroots.org via NIP-05`);
                const response = await fetch(`https://www.trustroots.org/.well-known/nostr.json?name=${linkedUsername}`);
                const data = await response.json();
                
                // Check if the username is valid and matches this pubkey
                if (data.names && data.names[linkedUsername]) {
                    const nip5Pubkey = data.names[linkedUsername];
                    const currentPubkeyHex = currentPublicKey.toLowerCase();
                    const nip5PubkeyHex = nip5Pubkey.toLowerCase();
                    
                    // If the pubkeys don't match, clear the username
                    if (currentPubkeyHex !== nip5PubkeyHex) {
                        const message = `Username ${linkedUsername} from Nostr does not match NIP-05 verification. Clearing.`;
                        appendKeysLinkLog(message);
                        console.warn(message);
                        usernameWasCleared = true;
                        linkedUsername = null;
                        foundLinked = false;
                    } else {
                        appendKeysLinkLog(`NIP-05 validated: ${linkedUsername}@trustroots.org matches this key`);
                    }
                } else {
                    // No valid NIP-05 found for this username, clear it
                    const message = `Username ${linkedUsername} from Nostr has no valid NIP-05. Clearing.`;
                    appendKeysLinkLog(message);
                    console.warn(message);
                    usernameWasCleared = true;
                    linkedUsername = null;
                    foundLinked = false;
                }
            } catch (error) {
                // If validation fails, clear the username to be safe
                appendKeysLinkLog(`Error validating username ${linkedUsername} from Nostr: ${error?.message || error}`);
                console.warn(`Error validating username ${linkedUsername} from Nostr:`, error);
                usernameWasCleared = true;
                linkedUsername = null;
                foundLinked = false;
            }
        } else if (foundLinked) {
            appendKeysLinkLog('Trustroots profile event found, but no Trustroots username tag was present');
        } else {
            appendKeysLinkLog('No linked Trustroots profile event found on configured relays');
        }
        
        const wasProfileLinked = isProfileLinked;
        isProfileLinked = foundLinked;
        if (!isProfileLinked) {
            claimEventsByKind = new Map();
        } else if (hasRelayAuthSigningCapability()) {
            scheduleRefreshClaimSuggestions();
        }
        
        // Update username field if we found a linked username
        const usernameInput = document.getElementById('trustroots-username');
        const usernameIndicator = document.getElementById('username-nostr-indicator');
        
        if (linkedUsername) {
            usernameFromNostr = true;
            if (usernameInput) {
                usernameInput.value = linkedUsername;
                usernameInput.disabled = true;
            }
            if (usernameIndicator) {
                usernameIndicator.style.display = 'block';
            }
        } else {
            usernameFromNostr = false;
            if (usernameInput) {
                usernameInput.value = '';
                usernameInput.disabled = false;
                // Focus the field if it was cleared due to validation failure
                if (usernameWasCleared) {
                    // Use setTimeout to ensure UI is ready before focusing
                    setTimeout(() => usernameInput.focus(), 100);
                }
            }
            if (usernameIndicator) {
                usernameIndicator.style.display = 'none';
            }
        }
        
        updateLinkProfileButton();
        setHeaderIdentity();
        renderClaimSummary();
        
        // Update "Update Trustroots Profile" button visibility - hide if profile is linked
        const updateTrustrootsGroup = document.getElementById('update-trustroots-profile-group');
        if (updateTrustrootsGroup) {
            updateTrustrootsGroup.style.display = isProfileLinked ? 'none' : 'block';
        }
        updateKeyDisplay({ skipProfileLookup: true });
        if (!wasProfileLinked && isProfileLinked) {
            reconnectRestrictedRelayIfEligible();
        }
    } catch (error) {
        console.error('Error checking profile link:', error);
        isProfileLinked = false;
        usernameFromNostr = false;
        claimEventsByKind = new Map();
        
        // Enable username field if not from Nostr
        const usernameInput = document.getElementById('trustroots-username');
        const usernameIndicator = document.getElementById('username-nostr-indicator');
        if (usernameInput) {
            usernameInput.disabled = false;
        }
        if (usernameIndicator) {
            usernameIndicator.style.display = 'none';
        }
        
        updateLinkProfileButton();
        renderClaimSummary();
        
        // Show "Update Trustroots Profile" button if profile is not linked
        const updateTrustrootsGroup = document.getElementById('update-trustroots-profile-group');
        if (updateTrustrootsGroup && currentPublicKey) {
            updateTrustrootsGroup.style.display = 'block';
        }
        updateKeyDisplay({ skipProfileLookup: true });
    }
}

// Update link profile button visibility
function updateLinkProfileButton() {
    // Link Profile button has been removed, this function is kept for compatibility
    // but no longer does anything
}

function getClaimTagSingle(tags, name) {
    const t = (tags || []).find((tag) => Array.isArray(tag) && tag[0] === name && tag[1]);
    return t ? t[1] : '';
}

function isClaimableSuggestionEvent(event) {
    const v = getClaimTagSingle(event?.tags, 'claimable');
    return String(v || '').trim().toLowerCase() === 'true';
}

function getClaimableClaimsByKind(kind) {
    const list = claimEventsByKind.get(kind) || [];
    return list.filter(isClaimableSuggestionEvent);
}

function hasUnclaimableClaimsByKind(kind) {
    const list = claimEventsByKind.get(kind) || [];
    return list.some((event) => !isClaimableSuggestionEvent(event));
}

function truncateClaimBody(s, max) {
    if (s == null || s === undefined) return '';
    const t = String(s).trim();
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + '…';
}

function getClaimSummaryCounts() {
    return {
        profile: getClaimableClaimsByKind(PROFILE_CLAIM_KIND).length,
        hosts: getClaimableClaimsByKind(HOST_CLAIM_KIND).length,
        relationships: getClaimableClaimsByKind(RELATIONSHIP_CLAIM_KIND).length,
        experiences: getClaimableClaimsByKind(EXPERIENCE_CLAIM_KIND).length
    };
}

function claimSignEnsureAllLoadedSync() {
    if (_nrKvClaimSignAll !== null) return;
    try {
        const raw = localStorage.getItem(CLAIM_SIGN_STORAGE_KEY);
        _nrKvClaimSignAll = raw ? JSON.parse(raw) : {};
    } catch (_) {
        _nrKvClaimSignAll = {};
    }
    if (!_nrKvClaimSignAll || typeof _nrKvClaimSignAll !== 'object' || Array.isArray(_nrKvClaimSignAll)) {
        _nrKvClaimSignAll = {};
    }
}

function getClaimSignDoneMap() {
    if (!currentPublicKey) return {};
    claimSignEnsureAllLoadedSync();
    return _nrKvClaimSignAll[currentPublicKey] || {};
}

function setClaimSignDone(kind) {
    if (!currentPublicKey || !kind) return;
    try {
        claimSignEnsureAllLoadedSync();
        if (!_nrKvClaimSignAll[currentPublicKey]) _nrKvClaimSignAll[currentPublicKey] = {};
        _nrKvClaimSignAll[currentPublicKey][kind] = true;
        try {
            localStorage.removeItem(CLAIM_SIGN_STORAGE_KEY);
        } catch (_) {}
        void ensureNrWebKvPrefsHydrated()
            .then(() => nrWebKvPut(NR_WEB_KV_KEYS.CLAIM_SIGN_DONE, _nrKvClaimSignAll))
            .catch((e) => console.warn('Failed to persist claim-sign state:', e));
    } catch (_) {}
}

function clearClaimSignDoneForPubkey(pubkeyHex) {
    if (!pubkeyHex) return;
    try {
        claimSignEnsureAllLoadedSync();
        delete _nrKvClaimSignAll[pubkeyHex];
        try {
            localStorage.removeItem(CLAIM_SIGN_STORAGE_KEY);
        } catch (_) {}
        void ensureNrWebKvPrefsHydrated()
            .then(() => nrWebKvPut(NR_WEB_KV_KEYS.CLAIM_SIGN_DONE, _nrKvClaimSignAll))
            .catch((e) => console.warn('Failed to persist claim-sign state:', e));
    } catch (_) {}
}

function syncClaimButton(btn, kind, shouldEnable) {
    if (!btn) return;
    const signed = !!getClaimSignDoneMap()[kind];
    if (signed) {
        btn.classList.remove('claim-sign-exiting');
        btn.classList.add('claim-sign-gone');
        btn.disabled = true;
        btn.setAttribute('aria-hidden', 'true');
        return;
    }
    btn.classList.remove('claim-sign-gone');
    if (btn.classList.contains('claim-sign-exiting')) {
        return;
    }
    btn.removeAttribute('aria-hidden');
    btn.disabled = !shouldEnable;
}

function fadeOutClaimButton(btn, kind) {
    if (!btn || !kind) return;
    btn.classList.add('claim-sign-exiting');
    const finish = () => {
        setClaimSignDone(kind);
        btn.classList.remove('claim-sign-exiting');
        btn.classList.add('claim-sign-gone');
        btn.disabled = true;
        btn.setAttribute('aria-hidden', 'true');
    };
    const onEnd = (e) => {
        if (e.propertyName !== 'opacity') return;
        btn.removeEventListener('transitionend', onEnd);
        finish();
    };
    btn.addEventListener('transitionend', onEnd);
    void btn.offsetHeight;
    setTimeout(() => {
        btn.removeEventListener('transitionend', onEnd);
        if (btn.classList.contains('claim-sign-exiting')) finish();
    }, 650);
}

function renderClaimDetailBlocks() {
    const profilePre = document.getElementById('claim-preview-profile');
    const hostingList = document.getElementById('claim-preview-hosting');
    const relList = document.getElementById('claim-preview-relationships');
    const expList = document.getElementById('claim-preview-experiences');
    const btnP = document.getElementById('claim-btn-profile');
    const btnH = document.getElementById('claim-btn-hosting');
    const btnR = document.getElementById('claim-btn-relationships');
    const btnE = document.getElementById('claim-btn-experiences');

    const countH = getClaimableClaimsByKind(HOST_CLAIM_KIND).length;
    const countRel = getClaimableClaimsByKind(RELATIONSHIP_CLAIM_KIND).length;
    const countExp = getClaimableClaimsByKind(EXPERIENCE_CLAIM_KIND).length;
    const claimsP = getClaimableClaimsByKind(PROFILE_CLAIM_KIND);

    if (profilePre && btnP) {
        if (!claimsP.length) {
            profilePre.textContent = 'No profile suggestion on your relays yet (kind 30390). When the Trustroots export publishes it, reopen Keys here or reload the page—suggestions refresh automatically after your Trustroots link is verified.';
        } else {
            const latest = [...claimsP].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
            try {
                profilePre.textContent = JSON.stringify(JSON.parse(latest.content || '{}'), null, 2);
            } catch (_) {
                profilePre.textContent = latest.content || '';
            }
        }
    }

    function fillClaimList(container, claims, emptyMsg, renderLine) {
        if (!container) return;
        while (container.firstChild) container.removeChild(container.firstChild);
        if (!claims.length) {
            const p = document.createElement('p');
            p.className = 'claim-empty-note';
            p.textContent = emptyMsg;
            container.appendChild(p);
            return;
        }
        const sorted = [...claims].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        for (const ev of sorted) {
            container.appendChild(renderLine(ev));
        }
    }

    fillClaimList(
        hostingList,
        getClaimableClaimsByKind(HOST_CLAIM_KIND),
        'Nothing claimable yet. Claimable hosting mirrors appear as kind 30398 with your pubkey in a "p" tag and claimable=true.',
        (ev) => {
            const wrap = document.createElement('div');
            wrap.className = 'claim-line';
            const d = getClaimTagSingle(ev.tags, 'd');
            const meta = document.createElement('div');
            meta.className = 'claim-line-meta';
            meta.textContent = d || `Event ${(ev.id || '').slice(0, 12)}…`;
            const body = document.createElement('div');
            body.className = 'claim-line-body';
            body.textContent = truncateClaimBody(ev.content, 400);
            wrap.appendChild(meta);
            wrap.appendChild(body);
            return wrap;
        }
    );
    fillClaimList(
        relList,
        getClaimableClaimsByKind(RELATIONSHIP_CLAIM_KIND),
        'No claimable relationship suggestions yet (kind 30392). Claimable rows require claimable=true.',
        (ev) => {
            const wrap = document.createElement('div');
            wrap.className = 'claim-line';
            const meta = document.createElement('div');
            meta.className = 'claim-line-meta';
            const myTr = document.getElementById('trustroots-username')?.value || '';
            const disp = relationshipCounterpartyDisplay(ev.tags, ev.content, currentPublicKey, myTr);
            if (disp.type === 'hex') {
                meta.textContent = `Counterparty: ${formatPubkeyShort(disp.hex)}`;
            } else if (disp.type === 'user' && disp.usernames[0]) {
                const u = disp.usernames[0];
                meta.appendChild(document.createTextNode('Counterparty: '));
                const a = document.createElement('a');
                a.href = trustrootsProfileUrl(u);
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = `@${u}`;
                meta.appendChild(a);
            } else if (disp.type === 'users' && disp.usernames.length === 2) {
                meta.appendChild(document.createTextNode('Between: '));
                const [u0, u1] = disp.usernames;
                const a0 = document.createElement('a');
                a0.href = trustrootsProfileUrl(u0);
                a0.target = '_blank';
                a0.rel = 'noopener noreferrer';
                a0.textContent = `@${u0}`;
                meta.appendChild(a0);
                meta.appendChild(document.createTextNode(' → '));
                const a1 = document.createElement('a');
                a1.href = trustrootsProfileUrl(u1);
                a1.target = '_blank';
                a1.rel = 'noopener noreferrer';
                a1.textContent = `@${u1}`;
                meta.appendChild(a1);
            } else {
                meta.textContent = 'Relationship suggestion';
            }
            const body = document.createElement('div');
            body.className = 'claim-line-body';
            body.textContent = ev.content || '';
            wrap.appendChild(meta);
            wrap.appendChild(body);
            return wrap;
        }
    );

    fillClaimList(
        expList,
        getClaimableClaimsByKind(EXPERIENCE_CLAIM_KIND),
        'No claimable experience suggestions yet (kind 30393). Claimable rows require claimable=true.',
        (ev) => {
            const wrap = document.createElement('div');
            wrap.className = 'claim-line';
            const meta = document.createElement('div');
            meta.className = 'claim-line-meta';
            const disp = experienceCounterpartyDisplay(ev.tags, currentPublicKey);
            if (disp.type === 'hex') {
                meta.textContent = `About: ${formatPubkeyShort(disp.hex)}`;
            } else if (disp.type === 'user' && disp.username) {
                const u = disp.username;
                meta.appendChild(document.createTextNode('About: '));
                const a = document.createElement('a');
                a.href = trustrootsProfileUrl(u);
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = `@${u}`;
                meta.appendChild(a);
            } else {
                meta.textContent = 'Experience suggestion';
            }
            const body = document.createElement('div');
            body.className = 'claim-line-body';
            body.textContent = truncateClaimBody(ev.content, 400);
            wrap.appendChild(meta);
            wrap.appendChild(body);
            return wrap;
        }
    );
    syncClaimButton(btnP, 'profile', claimsP.length > 0);
    syncClaimButton(btnH, 'hosting', countH > 0);
    syncClaimButton(btnR, 'relationships', countRel > 0);
    syncClaimButton(btnE, 'experiences', countExp > 0);
    updateClaimRelayScopeRow();
}

function updateClaimRelayScopeRow() {
    const el = document.getElementById('claim-relay-scope');
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    el.classList.remove('claim-relay-scope--warning');
    const section = document.getElementById('keys-claim-section');
    const trustPanel = document.getElementById('keys-claim-trust-panel');
    const slot = document.getElementById('nr-profile-trust-claim-slot');
    const panelOnProfile = !!(trustPanel && slot?.contains(trustPanel));
    if (!section || (section.style.display === 'none' && !panelOnProfile)) {
        el.setAttribute('hidden', '');
        el.setAttribute('aria-hidden', 'true');
        return;
    }
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    const urls = getWritableRelayUrls();
    if (!urls.length) {
        el.classList.add('claim-relay-scope--warning');
        const p = document.createElement('p');
        p.className = 'claim-relay-scope-detail';
        p.style.margin = '0';
        p.textContent = 'No relay has Post enabled. Turn on Post for at least one relay in Settings before signing; otherwise publishing will fail.';
        el.appendChild(p);
        return;
    }
    const hasOpen = urls.some((u) => !isRestrictedRelayUrl(u));
    const hasRestricted = urls.some((u) => isRestrictedRelayUrl(u));
    const label = document.createElement('span');
    label.className = 'claim-relay-scope-label';
    label.textContent = 'Publishing sends to';
    const icons = document.createElement('span');
    icons.className = 'claim-relay-scope-icons';
    if (hasOpen) {
        const s = document.createElement('span');
        s.className = 'claim-relay-icon';
        s.textContent = '🌍';
        s.setAttribute('role', 'img');
        s.title = 'Open relay(s) — events are world-readable on the Nostr network (anyone can read). Includes public index relays such as relay.trustroots.org when Post is on.';
        icons.appendChild(s);
    }
    if (hasRestricted) {
        const s = document.createElement('span');
        s.className = 'claim-relay-icon';
        s.textContent = '🔐';
        s.setAttribute('role', 'img');
        s.title = 'Auth relay (nip42.trustroots.org, NIP-42) — publishing requires a signer and a linked Trustroots identity.';
        icons.appendChild(s);
    }
    el.appendChild(label);
    el.appendChild(icons);
    const detail = document.createElement('p');
    detail.className = 'claim-relay-scope-detail';
    const parts = [];
    if (hasOpen) parts.push('open (publicly readable) relays');
    if (hasRestricted) parts.push('the Trustroots auth relay');
    detail.textContent = `Each signed event is published to every relay that has Post enabled: ${parts.join(' and ')}.`;
    el.appendChild(detail);
}

function renderClaimSummary() {
    const section = document.getElementById('keys-claim-section');
    const summary = document.getElementById('claim-summary');
    if (!section || !summary) return;
    const onProfileClaims = window.NrWebClaimsUiSurface === 'profile';
    const canShow = onProfileClaims && !!currentPublicKey && hasRelayAuthSigningCapability();
    section.style.display = canShow ? 'block' : 'none';
    if (!canShow) {
        const scopeEl = document.getElementById('claim-relay-scope');
        if (scopeEl) {
            scopeEl.setAttribute('hidden', '');
            scopeEl.setAttribute('aria-hidden', 'true');
        }
        return;
    }
    const counts = getClaimSummaryCounts();
    const pill = (label, value) => `<span class="claim-summary-pill">${label} <strong>${value}</strong></span>`;
    summary.innerHTML = [
        pill('Profiles', counts.profile),
        pill('Hosting', counts.hosts),
        pill('Relationships', counts.relationships),
        pill('Experiences', counts.experiences),
    ].join('');
    renderClaimDetailBlocks();
}

function scheduleRefreshClaimSuggestions() {
    if (!currentPublicKey || !hasRelayAuthSigningCapability()) return;
    if (window.NrWebClaimsUiSurface !== 'profile') return;
    if (claimSuggestionsDebounce) clearTimeout(claimSuggestionsDebounce);
    claimSuggestionsDebounce = setTimeout(() => {
        claimSuggestionsDebounce = null;
        void refreshClaimSuggestions({ silent: true });
    }, 400);
}

async function refreshClaimSuggestions(options = {}) {
    const silent = options.silent === true;
    if (!currentPublicKey) {
        if (!silent) showStatus('Load a key first to fetch claim suggestions.', 'error');
        return;
    }
    if (!hasRelayAuthSigningCapability()) {
        return;
    }
    if (window.NrWebClaimsUiSurface !== 'profile') {
        return;
    }
    const relayUrls = getRelayUrls();
    claimEventsByKind = new Map();
    const filter = {
        kinds: [...getClaimKinds(), MAP_NOTE_REPOST_KIND],
        '#p': [currentPublicKey],
        limit: 1500
    };
    const relayAuth = window.NrWebRelayAuth;
    const restrictedWaitMs = 8000;
    const publicWaitMs = 4500;

    const fetchFromRelay = async (url) => {
        try {
            if (isRestrictedRelayUrl(url) && canUseRestrictedRelay() && relayAuth?.nip42SubscribeOnce) {
                await relayAuth.nip42SubscribeOnce({
                    relayUrl: url,
                    filter,
                    authPubkey: currentPublicKey,
                    signEvent: async (eventTemplate) => signEventTemplate(eventTemplate),
                    onEvent: (event) => {
                        if (event) upsertClaimEvent(event);
                    },
                    onAuthChallenge: () => {},
                    onAuthSuccess: () => {},
                    onAuthFail: () => {},
                    waitMs: restrictedWaitMs
                });
                return;
            }
            await oneshotQuery(url, filter, {
                onEvent: (event) => upsertClaimEvent(event),
                waitMs: publicWaitMs,
            });
        } catch (_) {}
    };

    await Promise.allSettled(relayUrls.map((url) => fetchFromRelay(url)));
    renderClaimSummary();
}

async function publishSignedEventTemplate(eventTemplate) {
    if (!hasRelayAuthSigningCapability()) throw new Error('No signing method available');
    if (eventTemplate?.kind === MAP_NOTE_KIND && containsPrivateKeyNsec(String(eventTemplate?.content || ''), nip19)) {
        throw new Error('Posting blocked: notes cannot include nsec private keys.');
    }
    const signedEvent = await signEventTemplate(eventTemplate);
    const relayUrls = getWritableRelayUrls();
    if (relayUrls.length === 0) throw new Error('No relays enabled for posting');
    const results = await Promise.all(relayUrls.map(url => publishToRelayWithRetries(url, signedEvent)));
    const successful = results.filter(r => r.success);
    if (successful.length === 0) {
        const failed = results.filter(r => !r.success).map(r => `${r.url}: ${r.error || 'failed'}`).join(', ');
        throw new Error(`Publish failed: ${failed}`);
    }
    return { signedEvent, results };
}

function ownProfileHashRoute() {
    if (!currentPublicKey) return '';
    const trU =
        document.getElementById('trustroots-username')?.value?.trim() ||
        (pubkeyToUsername && pubkeyToUsername.get && pubkeyToUsername.get(currentPublicKey));
    let idPart = '';
    if (trU) idPart = `${String(trU).toLowerCase()}@trustroots.org`;
    else idPart = getCurrentNpub() || String(currentPublicKey || '');
    if (!idPart) return '';
    return 'profile/' + encodeURIComponent(idPart).replace(/%2B/g, '+');
}

window.NrWebPublishKind0Metadata = async function (contentObj) {
    const template = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(contentObj || {})
    };
    await publishSignedEventTemplate(template);
};
window.NrWebSignEventTemplate = async function (eventTemplate) {
    return signEventTemplate(eventTemplate);
};
window.NrWebCanSignEventTemplate = function () {
    return hasRelayAuthSigningCapability();
};
window.NrWebGetCurrentPubkeyHex = () => currentPublicKey;
window.NrWebGoOwnProfile = function (action) {
    if (!currentPublicKey) return;
    const base = ownProfileHashRoute();
    if (!base) return;
    if (action === 'view') {
        try {
            location.hash = '#' + base;
        } catch (_) {}
        if (typeof applyNrUnifiedHash === 'function') void applyNrUnifiedHash();
        return;
    }
    const suf = action === 'edit' ? '/edit' : action === 'contacts' ? '/contacts' : '';
    try {
        location.hash = '#' + base + suf;
    } catch (_) {}
    if (typeof applyNrUnifiedHash === 'function') void applyNrUnifiedHash();
};

/** Register theme publish + fetch encrypted kind 30078 from relays (see NrWebTheme in common.js). */
async function fetchThemePreferenceFromRelaysIndex() {
    const NT = window.NrWebTheme;
    if (!NT || !currentPublicKey || (!currentPrivateKeyBytes && !nrWebNip7Signer.isActiveForPubkey(currentPublicKey)) || !nip44) return;
    const relayUrls = getConnectableRelayUrls(getRelayUrls());
    if (!relayUrls.length) return;
    const filter = [{
        kinds: [NT.NRWEB_THEME_KIND],
        authors: [currentPublicKey],
        '#d': [NT.NRWEB_THEME_D_TAG],
        limit: 10
    }];
    let best = null;
    const relayAuth = window.NrWebRelayAuth;
    for (const url of relayUrls) {
        if (isRestrictedRelayUrl(url) && relayAuth?.nip42SubscribeOnce) {
            await relayAuth.nip42SubscribeOnce({
                relayUrl: url,
                filter: filter[0],
                authPubkey: currentPublicKey,
                signEvent: async (eventTemplate) => signEventTemplate(eventTemplate),
                onEvent: (ev) => {
                    if (!best || ev.created_at > best.created_at) best = ev;
                },
                waitMs: 4000
            });
            continue;
        }
        await oneshotQuery(url, filter, {
            onEvent: (ev) => {
                if (!best || ev.created_at > best.created_at) best = ev;
            },
            waitMs: 4000,
        });
    }
    if (best) {
        let parsed = null;
        if (nrWebNip7Signer.isActiveForPubkey(currentPublicKey)) {
            try {
                const plain = await nrWebNip7Signer.nip44Decrypt(currentPublicKey, best.content);
                const data = JSON.parse(plain);
                if (data.theme === 'light' || data.theme === 'dark') {
                    parsed = { theme: data.theme, created_at: best.created_at || 0 };
                }
            } catch (_) {}
        } else {
            parsed = NT.parseThemeFromKind78Event(best, nip44, currentPrivateKeyBytes, currentPublicKey);
        }
        if (parsed) NT.mergeThemeFromRemote(parsed);
    }
}

async function setupIndexNrWebThemeSync() {
    const NT = window.NrWebTheme;
    if (!NT) return;
    if (!currentPublicKey || (!currentPrivateKeyBytes && !nrWebNip7Signer.isActiveForPubkey(currentPublicKey))) {
        NT.registerThemePublish(null);
        return;
    }
    NT.registerThemePublish(async (theme) => {
        try {
            let tpl = null;
            if (nrWebNip7Signer.isActiveForPubkey(currentPublicKey)) {
                if (theme !== 'light' && theme !== 'dark') return;
                tpl = {
                    kind: NT.NRWEB_THEME_KIND,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [['d', NT.NRWEB_THEME_D_TAG], ['client', 'nr-web']],
                    content: await nrWebNip7Signer.nip44Encrypt(currentPublicKey, JSON.stringify({ theme }))
                };
            } else {
                tpl = NT.createThemeEventTemplate(theme, nip44, currentPrivateKeyBytes, currentPublicKey);
            }
            if (!tpl) return;
            await publishSignedEventTemplate(tpl);
        } catch (_) {}
    });
    await fetchThemePreferenceFromRelaysIndex();
}

function removeClaimedHostTags(tags) {
    return (tags || []).filter(tag => {
        if (!Array.isArray(tag) || tag.length === 0) return false;
        if (tag[0] === 'source' || tag[0] === 'source_id') return false;
        if (tag[0] === 'p' && tag[1] && tag[1].toLowerCase() === currentPublicKey?.toLowerCase()) return false;
        return true;
    });
}

async function claimProfileData() {
    const claims = getClaimableClaimsByKind(PROFILE_CLAIM_KIND);
    if (!claims.length) {
        if (hasUnclaimableClaimsByKind(PROFILE_CLAIM_KIND)) {
            showStatus('No claimable profile claims yet. Waiting for claimable=true suggestions.', 'info');
            return;
        }
        showStatus('No profile claims available.', 'info');
        return;
    }
    try {
        const latest = claims.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
        const content = JSON.parse(latest.content || '{}');
        const template = { kind: 0, created_at: Math.floor(Date.now() / 1000), tags: [], content: JSON.stringify(content) };
        await publishSignedEventTemplate(template);
        showStatus('Profile claimed and published as kind 0.', 'success');
        fadeOutClaimButton(document.getElementById('claim-btn-profile'), 'profile');
    } catch (error) {
        showStatus('Failed to claim profile: ' + (error?.message || error), 'error');
    }
}

async function claimHostingOffers() {
    const claims = getClaimableClaimsByKind(HOST_CLAIM_KIND);
    if (!claims.length) {
        if (hasUnclaimableClaimsByKind(HOST_CLAIM_KIND)) {
            showStatus('No claimable hosting claims yet. Waiting for claimable=true suggestions.', 'info');
            return;
        }
        showStatus('No hosting claims available.', 'info');
        return;
    }
    let successCount = 0;
    for (const claim of claims) {
        try {
            const template = {
                kind: MAP_NOTE_KIND,
                created_at: Math.floor(Date.now() / 1000),
                tags: removeClaimedHostTags(claim.tags),
                content: claim.content || ''
            };
            await publishSignedEventTemplate(template);
            successCount++;
        } catch (_) {}
    }
    showStatus(`Claimed ${successCount}/${claims.length} hosting offers as kind ${MAP_NOTE_KIND}.`, successCount > 0 ? 'success' : 'error');
    if (successCount > 0 && successCount === claims.length) {
        fadeOutClaimButton(document.getElementById('claim-btn-hosting'), 'hosting');
    }
}

async function queryLatestUserEvent(kind, extraFilter) {
    const relayUrls = getRelayUrls();
    let newest = null;
    const filter = { kinds: [kind], authors: [currentPublicKey], limit: 20, ...(extraFilter || {}) };
    const relayAuth = window.NrWebRelayAuth;
    const consider = (event) => {
        if (event && (!newest || (event.created_at || 0) > (newest.created_at || 0))) newest = event;
    };
    const tasks = relayUrls.map(async (url) => {
        try {
            if (isRestrictedRelayUrl(url) && canUseRestrictedRelay() && relayAuth?.nip42SubscribeOnce) {
                await relayAuth.nip42SubscribeOnce({
                    relayUrl: url,
                    filter,
                    authPubkey: currentPublicKey,
                    signEvent: async (tpl) => signEventTemplate(tpl),
                    onEvent: (event) => consider(event),
                    waitMs: 6500
                });
                return;
            }
            await oneshotQuery(url, filter, {
                onEvent: (event) => consider(event),
                waitMs: 1200,
            });
        } catch (_) {}
    });
    await Promise.allSettled(tasks);
    return newest;
}

async function claimRelationships() {
    const claims = getClaimableClaimsByKind(RELATIONSHIP_CLAIM_KIND);
    if (!claims.length) {
        if (hasUnclaimableClaimsByKind(RELATIONSHIP_CLAIM_KIND)) {
            showStatus('No claimable relationship claims yet. Waiting for claimable=true suggestions.', 'info');
            return;
        }
        showStatus('No relationship claims available.', 'info');
        return;
    }
    const targets = extractRelationshipTargetsFromClaims(claims, currentPublicKey);
    if (!targets.size) {
        showStatus(
            'No hex pubkeys to merge from these suggestions—some may only list a Trustroots username for your contact. Add their npub on Trustroots (or wait for export) before they appear in your follow list.',
            'info',
        );
        return;
    }
    try {
        const existingKind3 = await queryLatestUserEvent(FOLLOW_LIST_KIND);
        const mergedTargets = mergePTags(existingKind3?.tags || [], targets);
        const kind3Template = {
            kind: FOLLOW_LIST_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: buildKind3Tags(mergedTargets),
            content: existingKind3?.content || ''
        };
        await publishSignedEventTemplate(kind3Template);

        const existingSet = await queryLatestUserEvent(TRUSTROOTS_CONTACT_SET_KIND, { '#d': ['trustroots-contacts'] });
        const setTargets = mergePTags(existingSet?.tags || [], targets);
        const setTemplate = {
            kind: TRUSTROOTS_CONTACT_SET_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: buildTrustroots30000Tags(setTargets),
            content: existingSet?.content || ''
        };
        await publishSignedEventTemplate(setTemplate);
        showStatus(`Claimed ${targets.size} relationships into kind 3 and kind 30000.`, 'success');
        fadeOutClaimButton(document.getElementById('claim-btn-relationships'), 'relationships');
    } catch (error) {
        showStatus('Failed to claim relationships: ' + (error?.message || error), 'error');
    }
}

async function claimExperiences() {
    const claims = getClaimableClaimsByKind(EXPERIENCE_CLAIM_KIND);
    if (!claims.length) {
        if (hasUnclaimableClaimsByKind(EXPERIENCE_CLAIM_KIND)) {
            showStatus('No claimable experience claims yet. Waiting for claimable=true suggestions.', 'info');
            return;
        }
        showStatus('No experience claims available.', 'info');
        return;
    }
    let successCount = 0;
    let skippedCount = 0;
    let failCount = 0;
    const publishable = claims.filter((claim) => {
        const plan = getExperienceClaimSignPlan(claim.tags, currentPublicKey);
        const sourceID = (claim.tags || []).find((t) => Array.isArray(t) && t[0] === 'source_id' && t[1])?.[1];
        return plan.canSign && !!sourceID;
    }).length;
    for (const claim of claims) {
        const plan = getExperienceClaimSignPlan(claim.tags, currentPublicKey);
        const sourceID = (claim.tags || []).find((t) => Array.isArray(t) && t[0] === 'source_id' && t[1])?.[1];
        if (!sourceID) {
            skippedCount++;
            continue;
        }
        if (!plan.canSign) {
            skippedCount++;
            continue;
        }
        try {
            const template = {
                kind: NIP32_LABEL_KIND,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['p', plan.targetHex],
                    ['d', sourceID],
                    ['L', 'org.trustroots:experience'],
                    ['l', 'positive', 'org.trustroots:experience'],
                ],
                content: claim.content || 'positive',
            };
            await publishSignedEventTemplate(template);
            successCount++;
        } catch (_) {
            failCount++;
        }
    }
    const parts = [
        `Signed ${successCount} positive experience label(s) (kind ${NIP32_LABEL_KIND}).`,
        skippedCount ? `Skipped ${skippedCount} (not the author, missing target npub on Trustroots, or missing source_id).` : '',
        failCount ? `${failCount} publish error(s).` : '',
    ].filter(Boolean);
    const tone =
        failCount > 0 ? 'error' : successCount > 0 ? 'success' : skippedCount === claims.length ? 'info' : 'error';
    showStatus(parts.join(' '), tone);
    if (publishable > 0 && successCount === publishable && failCount === 0) {
        fadeOutClaimButton(document.getElementById('claim-btn-experiences'), 'experiences');
    }
}

// Settings Modal Functions (modals injected by common.js)
/**
 * Shared open/close primitives for the Keys and Settings modals.
 * Surface-specific behavior (hasKey check, fallback route after close, post-open callback)
 * is supplied by the caller as a small options bag.
 */
function _openKeysModalShared({ hasKey, route = 'keys', onOpenManagedSection, preserveRoute = false }) {
    const keysModal = window.NrWebKeysModal;
    if (keysModal?.openKeysModal) {
        keysModal.openKeysModal({
            hasKey,
            route,
            setRoute: preserveRoute ? undefined : setHashRoute,
            onOpenManagedSection,
        });
        return;
    }
    const keysEl = document.getElementById('keys-modal');
    if (keysEl) keysEl.classList.add('active');
    if (!preserveRoute) setHashRoute(route);
}

function _closeKeysModalShared({ fallbackRoute }) {
    const keysModal = window.NrWebKeysModal;
    if (keysModal?.closeKeysModal) {
        keysModal.closeKeysModal({ fallbackRoute, setRoute: setHashRoute });
        return;
    }
    const el = document.getElementById('keys-modal');
    if (el) el.classList.remove('active');
    setHashRoute(fallbackRoute);
}

function _openSettingsModalShared({ extraSetup, route = 'settings' } = {}) {
    const keysEl = document.getElementById('keys-modal');
    const settingsEl = document.getElementById('settings-modal');
    if (keysEl) keysEl.classList.remove('active');
    if (settingsEl) settingsEl.classList.add('active');
    setHashRoute(route);
    if (typeof renderSettingsNotificationsSection === 'function') renderSettingsNotificationsSection();
    window.NrWeb?.applySettingsFooterMetadataFromCache?.();
    window.NrWeb?.refreshSettingsFooterMetadata?.();
    if (typeof extraSetup === 'function') extraSetup();
    scheduleHeaderKpiRefresh();
}

function openRelaysSettingsModal() {
    trackNrWebSurfaceEvent('nr_settings_relays_opened', 'settings/relays', {
        route_type: 'settings_relays',
        surface: 'settings',
        source: 'route',
        ...getCurrentTrustrootsUsernameAnalyticsData(),
    });
    _openSettingsModalShared({
        route: 'settings/relays',
        extraSetup: () => {
            if (typeof renderRelaysList === 'function') renderRelaysList();
            const relaysList = document.getElementById('relays-list');
            const relaysSection = relaysList?.closest('.settings-section') || relaysList;
            if (!relaysSection) return;
            try {
                relaysSection.scrollIntoView({ block: 'start', behavior: 'smooth' });
            } catch (_) {
                try { relaysSection.scrollIntoView(); } catch (_) {}
            }
        },
    });
}

function _closeSettingsModalShared({ fallbackRoute }) {
    const el = document.getElementById('settings-modal');
    if (el) el.classList.remove('active');
    setHashRoute(fallbackRoute);
}

function openKeysModal(options = {}) {
    const nip7Active =
        nrWebNip7Signer.isActive() ||
        (() => {
            try {
                return localStorage.getItem(NR_WEB_SIGNER_MODE_KEY) === 'nip7' && inspectNip7Capabilities().isFull;
            } catch (_) {
                return false;
            }
        })();
    if (nip7Active && !currentPublicKey && nrWebNip7Signer.pubkey) {
        currentPublicKey = nrWebNip7Signer.pubkey;
    }
    _openKeysModalShared({
        route: options.route || 'keys',
        hasKey: !!(currentPublicKey || currentPrivateKey || nip7Active),
        preserveRoute: options.preserveRoute === true,
        onOpenManagedSection: () => {
            try { window.NrWebUnmountClaimTrustrootsSection?.(); } catch (_) {}
            updateKeyDisplay();
        },
    });
    const route = options.route || 'keys';
    const isWelcomeRoute = route === 'welcome' || route === 'start';
    trackNrWebSurfaceEvent(isWelcomeRoute ? 'nr_welcome_opened' : 'nr_keys_opened', `keys:${route}`, {
        route_type: isWelcomeRoute ? 'welcome' : 'keys',
        surface: 'keys',
        source: options.preserveRoute === true ? 'overlay' : 'route',
        signer: getNrWebSignerAnalyticsType(),
        ...getCurrentTrustrootsUsernameAnalyticsData(),
    });
}

function closeKeysModal() {
    _closeKeysModalShared({ fallbackRoute: selectedPlusCode || '' });
}

function openSettingsModal() {
    _openSettingsModalShared();
}

function closeSettingsModal() {
    _closeSettingsModalShared({ fallbackRoute: selectedPlusCode || '' });
}

function openHelpModal() { modal('help-modal').open(); }
function closeHelpModal() { modal('help-modal').close(); }

function normalizeUserPlusCodeInput(raw) {
    if (raw == null || typeof raw !== 'string') return '';
    let s = raw.trim().replace(/\s+/g, '').toUpperCase();
    if (!s) return '';
    if (!s.includes('+') && s.length > 2) {
        s = s.slice(0, -2) + '+' + s.slice(-2);
    }
    return s;
}

function openSearchUi() {
    const mapEl = document.getElementById('map');
    const canvas = mapEl && mapEl.querySelector && (mapEl.querySelector('.maplibregl-canvas') || mapEl.querySelector('canvas'));
    if (canvas && typeof canvas.focus === 'function') {
        try { canvas.focus({ preventScroll: true }); } catch (_) { try { canvas.focus(); } catch (_) {} }
    } else if (mapEl && typeof mapEl.focus === 'function') {
        try { mapEl.focus({ preventScroll: true }); } catch (_) { try { mapEl.focus(); } catch (_) {} }
    }
    showStatus('Map: click a cell to open notes for that area.', 'info');
}

const HOST_NOTE_GEOLOCATION_TIMEOUT_MS = 3500;

function getMapCenterForHostNoteFlow() {
    if (!map || typeof map.getCenter !== 'function') return null;
    const c = map.getCenter();
    const lat = Number(c?.lat);
    const lng = Number(c?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

function getHostNoteCodeLengthFromMap() {
    let hostCodeLength = 6;
    const b = map && map.getBounds && map.getBounds();
    if (b && typeof b.getNorth === 'function' && typeof b.getSouth === 'function' && typeof b.getEast === 'function' && typeof b.getWest === 'function') {
        const latDelta = Math.abs(b.getNorth() - b.getSouth());
        const lngDelta = Math.abs(b.getEast() - b.getWest());
        const viewLength = whatLengthOfPlusCodeToShow(latDelta, lngDelta);
        // Host flow should open a sensible area, not an overly precise micro-cell.
        hostCodeLength = Math.max(4, Math.min(6, viewLength || 6));
    }
    return hostCodeLength;
}

async function getBrowserLocationForHostNoteFlow() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    try {
        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            if (permission && permission.state === 'denied') return null;
        }
    } catch (_) {}
    return new Promise((resolve) => {
        let settled = false;
        const done = (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const timeoutId = setTimeout(() => done(null), HOST_NOTE_GEOLOCATION_TIMEOUT_MS);
        try {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    clearTimeout(timeoutId);
                    const lat = Number(position?.coords?.latitude);
                    const lng = Number(position?.coords?.longitude);
                    done(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null);
                },
                () => {
                    clearTimeout(timeoutId);
                    done(null);
                },
                {
                    enableHighAccuracy: false,
                    maximumAge: 5 * 60 * 1000,
                    timeout: HOST_NOTE_GEOLOCATION_TIMEOUT_MS,
                }
            );
        } catch (_) {
            clearTimeout(timeoutId);
            done(null);
        }
    });
}

function openHostNoteFlow() {
    // If the URL already targets a plus-code route, keep the user anchored there.
    let routePlusCode = '';
    try {
        const H = window.NrWebHashRouter;
        const route = H && typeof H.getHashRoute === 'function' ? H.getHashRoute() : getHashRoute();
        const classified = H && typeof H.classify === 'function' ? H.classify(route) : null;
        if (classified && classified.kind === 'map_pluscode' && classified.plusCode) {
            routePlusCode = String(classified.plusCode || '').trim().toUpperCase();
        }
    } catch (_) {}
    const currentPlusCode = routePlusCode || (isHostSurfaceOpen() ? String(selectedPlusCode || '').trim().toUpperCase() : '');
    if (currentPlusCode) {
        showNotesForPlusCode(currentPlusCode, {
            initialContent: '',
            preserveMapView: true
        });
        return;
    }

    const body = document.body;
    const shouldRestoreLastHostArea = !!(
        body &&
        body.classList &&
        !body.classList.contains('nr-surface-host') &&
        (
            body.classList.contains('nr-surface-chat') ||
            body.classList.contains('nr-surface-profile') ||
            body.classList.contains('nr-surface-account')
        )
    );
    const rememberedHostPlusCode = shouldRestoreLastHostArea ? getLastHostPlusCode() : '';
    if (rememberedHostPlusCode) {
        showNotesForPlusCode(rememberedHostPlusCode, {
            initialContent: '',
            preserveMapView: true
        });
        return;
    }

    const browserLocationPromise = getBrowserLocationForHostNoteFlow();
    async function run() {
        if (!map) {
            showAreaSurface();
            setTimeout(run, 200);
            return;
        }
        const fallbackTarget = getMapCenterForHostNoteFlow();
        let fallbackPlusCode = '';
        if (fallbackTarget) {
            fallbackPlusCode = encodePlusCode(fallbackTarget.lat, fallbackTarget.lng, getHostNoteCodeLengthFromMap());
            showNotesForPlusCode(fallbackPlusCode, {
                initialContent: '',
                preserveMapView: true
            });
        } else {
            showAreaSurface();
        }
        const browserLocation = await browserLocationPromise;
        const target = browserLocation || (fallbackPlusCode ? null : getMapCenterForHostNoteFlow());
        if (!target) {
            if (!fallbackPlusCode) showStatus('Map is still finding a location. Try Host & meet again in a moment.', 'info');
            return;
        }
        const hostCodeLength = browserLocation ? 6 : getHostNoteCodeLengthFromMap();
        const pc = encodePlusCode(target.lat, target.lng, hostCodeLength);
        if (pc === selectedPlusCode) return;
        showNotesForPlusCode(pc, {
            initialContent: '',
            preserveMapView: true
        });
    }
    run();
}

function processNrWebUrlAction() {
    try {
        const u = new URL(window.location.href);
        const a = (u.searchParams.get('action') || '').toLowerCase();
        const welcomeOn = ['1', 'true', 'yes'].includes((u.searchParams.get('welcome') || '').toLowerCase());
        const startOn = ['1', 'true', 'yes'].includes((u.searchParams.get('start') || '').toLowerCase());
        if (!a && !welcomeOn && !startOn) return;
        if (a) u.searchParams.delete('action');
        if (welcomeOn) u.searchParams.delete('welcome');
        if (startOn) u.searchParams.delete('start');
        const qs = u.searchParams.toString();
        const clean = u.pathname + (qs ? '?' + qs : '') + u.hash;
        history.replaceState({}, '', clean);
        if (a === 'map' || a === 'search') {
            openSearchUi();
        } else if (a === 'host') {
            openHostNoteFlow();
        }
        if (welcomeOn || startOn) {
            try {
                location.hash = '#welcome';
            } catch (_) {}
        }
    } catch (err) {
        console.warn('[nr-web] processNrWebUrlAction', err);
    }
}

// Make functions globally accessible for onclick handlers
window.openKeysModal = openKeysModal;
window.closeKeysModal = closeKeysModal;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
window.openSearchUi = openSearchUi;
window.openHostNoteFlow = openHostNoteFlow;
window.saveExpirationSetting = saveExpirationSetting;
window.addRelay = addRelay;
window.removeRelay = removeRelay;
window.setRelayWriteEnabled = setRelayWriteEnabled;
window.toggleRelayWriteForEncodedUrl = toggleRelayWriteForEncodedUrl;
window.addNotificationPlusCode = addNotificationPlusCode;
window.removeNotificationPlusCode = removeNotificationPlusCode;
window.renderNotificationSubscribeBlock = renderNotificationSubscribeBlock;
window.showNotesForPlusCode = showNotesForPlusCode;
window.openNotificationSubscribedArea = openNotificationSubscribedArea;
window.requestNotificationPermission = requestNotificationPermission;
window.sendTestNotification = sendTestNotification;
window.setNotificationsEnabled = setNotificationsEnabled;
window.renderSettingsNotificationsSection = renderSettingsNotificationsSection;
window.refreshClaimSuggestions = refreshClaimSuggestions;
window.updateClaimRelayScopeRow = updateClaimRelayScopeRow;
window.claimProfileData = claimProfileData;
window.claimHostingOffers = claimHostingOffers;
window.claimRelationships = claimRelationships;
window.claimExperiences = claimExperiences;
window.disconnectNip7 = disconnectNip7;

// Onboarding

async function checkOnboarding() {
    const restoredNip7 = await nrWebNip7Signer.restoreFromStorage();
    if (restoredNip7 || nrWebNip7Signer.isActive()) {
        currentPrivateKey = null;
        currentPrivateKeyBytes = null;
        currentPublicKey = nrWebNip7Signer.pubkey;
        void setupIndexNrWebThemeSync();
        updateKeyDisplay();
        return;
    }
    const hasKey = readValidStoredKeyHex();
    if (!hasKey) {
        const initialRoute = getHashRoute().toLowerCase();
        if (initialRoute === 'settings') {
            openSettingsModal();
        } else if (initialRoute === 'keys') {
            openKeysModal({ route: 'keys' });
        } else if (initialRoute === 'start') {
            replaceHashRoute('welcome');
            openKeysModal({ route: 'welcome' });
        } else if (initialRoute && initialRoute !== 'welcome') {
            // Respect explicit routes such as plus-code area pages or chat routes.
        } else {
            openKeysModal({ route: 'welcome' });
        }
        updateKeyDisplay();
    } else {
        loadKeys();
    }
}

function onboardingGenerate() {
    generateKeyPair();
    // Refresh the keys modal to show the management section
    openKeysModal();
}

async function onboardingNip7Connect() {
    try {
        const pubkey = await nrWebNip7Signer.connect();
        currentPrivateKey = null;
        currentPrivateKeyBytes = null;
        currentPublicKey = pubkey;
        isProfileLinked = false;
        usernameFromNostr = false;
        void setupIndexNrWebThemeSync();
        appendKeysLinkLog(`Connected NIP-07 extension ${getCurrentNpub() || currentPublicKey}`);
        updateKeyDisplay();
        openKeysModal({ runProfileLookup: false });
        trackNrWebEvent('nr_nip7_connected', {
            key_method: 'nip7',
            signer: 'nip7',
            status: 'success',
            ...getCurrentTrustrootsUsernameAnalyticsData(),
        });
        showStatus('Browser extension connected.', 'success');
    } catch (error) {
        appendKeysLinkLog(`NIP-07 connect failed: ${error?.message || error}`);
        showStatus(error?.message || 'Could not connect browser extension.', 'error');
        updateKeyDisplay({ skipProfileLookup: true });
    }
}

async function onboardingImport() {
    const input = document.getElementById('onboarding-import').value.trim();
    appendKeysLinkLog('Import key from onboarding field');
    const parsed = parseKeyImportToHex(input);
    if (!parsed.ok) {
        const message = getKeyImportErrorMessage(input);
        appendKeysLinkLog(`Import failed: ${message}`);
        showStatus(message, 'error');
        return;
    }

    const wasMnemonic = input.includes(' ');
    try {
        savePrivateKey(parsed.hex);
        appendKeysLinkLog(`${wasMnemonic ? 'Mnemonic' : 'nsec'} parsed successfully. Public key: ${getCurrentNpub() || currentPublicKey}`);
        if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
            window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'imported');
            window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, true);
        }
        loadKeys();
        openKeysModal({ runProfileLookup: false });
        const noun = wasMnemonic ? 'Mnemonic' : 'nsec';
        appendKeysLinkLog('Checking linked Trustroots profile after onboarding import');
        showStatus('Key imported. Looking up your public profile details...', 'info');
        await checkProfileLinked();
        appendKeysLinkLog(`${noun} import complete`);
        trackNrWebEvent('nr_key_imported', {
            key_method: wasMnemonic ? 'mnemonic' : 'nsec',
            signer: 'local',
            status: 'success',
            ...getCurrentTrustrootsUsernameAnalyticsData(),
        });
        showStatus('Key imported successfully. Your key stays on this device and is never stored on our server.', 'success');
    } catch (error) {
        const noun = wasMnemonic ? 'mnemonic' : 'nsec';
        appendKeysLinkLog(`Error importing ${noun}: ${error.message || 'Unknown error'}`);
        console.error(`Error importing ${noun}:`, error);
        showStatus(`Error importing ${noun}: ` + (error.message || 'Unknown error'), 'error');
    }
}

// Update Trustroots Profile - copy npub and open Trustroots profile edit page
async function updateTrustrootsProfile() {
    if (!currentPublicKey) {
        showStatus('No public key available', 'error');
        return;
    }
    
    try {
        // Get npub from display or generate it
        const npubDisplay = document.getElementById('npub-display');
        let npub;
        
        if (npubDisplay && npubDisplay.value) {
            npub = npubDisplay.value;
        } else {
            npub = getCurrentNpub();
        }
        
        // Copy to clipboard
        await navigator.clipboard.writeText(npub);
        
        // Show alert first
        alert('Your public address was copied. Paste it into the Nostr field on Trustroots.');
        
        // Open Trustroots profile edit page in new tab
        window.open('https://www.trustroots.org/profile/edit/networks', '_blank');
    } catch (error) {
        console.error('Error updating Trustroots profile:', error);
        showStatus('Error copying public key: ' + (error.message || 'Unknown error'), 'error');
    }
}

// Trustroots profile linking
async function linkTrustrootsProfile() {
    const username = document.getElementById('trustroots-username').value.trim();
    appendKeysLinkLog(`Start link for username "${username || '<empty>'}"`);
    if (!username) {
        appendKeysLinkLog('Missing username input');
        showStatus('Please enter a username', 'error');
        return;
    }
    
    // Check if user has a key loaded
    if (!currentPublicKey) {
        appendKeysLinkLog('No currentPublicKey loaded');
        showStatus('Please generate or import a key first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`https://www.trustroots.org/.well-known/nostr.json?name=${username}`);
        const data = await response.json();
        
        // Check for nip5 validation - only proceed if valid
        if (data.names && data.names[username]) {
            const nip5Pubkey = data.names[username];
            appendKeysLinkLog(`NIP-05 lookup ok: ${username}@trustroots.org -> ${nip5Pubkey}`);
            
            // Normalize both pubkeys to lowercase hex for comparison
            const currentPubkeyHex = currentPublicKey.toLowerCase();
            const nip5PubkeyHex = nip5Pubkey.toLowerCase();
            
            // Verify the pubkey matches - only store/publish if valid
            if (currentPubkeyHex === nip5PubkeyHex) {
                appendKeysLinkLog('NIP-05 pubkey matches current key');
                // Create kind 10390 profile event with username
                const TRUSTROOTS_USERNAME_LABEL_NAMESPACE = "org.trustroots:username";
                const eventTemplate = {
                    kind: TRUSTROOTS_PROFILE_KIND,
                    tags: [
                        ["L", TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
                        ["l", username, TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
                    ],
                    content: "",
                    created_at: Math.floor(Date.now() / 1000),
                };
                
                let signedEvent;
                signedEvent = await signEventTemplate(eventTemplate);
                
                // Publish to all relays (only those with Post enabled)
                const relayUrls = getWritableRelayUrls();
                appendKeysLinkLog(`Writable relays (${relayUrls.length}): ${relayUrls.join(', ')}`);
                
                if (relayUrls.length === 0) {
                    appendKeysLinkLog('No writable relays configured');
                    trackNrWebEvent('nr_profile_linked', {
                        ...getWritableRelayAnalyticsData(relayUrls),
                        failed_count: 0,
                        status: 'no_relays',
                        ...getCurrentTrustrootsUsernameAnalyticsData(username),
                    });
                    showStatus('No relays enabled for posting. Enable "Post" toggle for at least one relay.', 'error');
                    return;
                }

                // Bootstrap for NIP-42 relays that allow unauthenticated kind 0 only.
                // This gives relays a Trustroots-linked profile marker before kind 10390.
                const kind0Template = {
                    kind: 0,
                    tags: [],
                    content: JSON.stringify({
                        trustrootsUsername: username,
                        nip05: `${username}@trustroots.org`,
                    }),
                    created_at: Math.floor(Date.now() / 1000),
                };
                const signedKind0Event = await signEventTemplate(kind0Template);
                const kind0Results = await Promise.all(
                    relayUrls.map((url) => publishToRelayWithRetries(url, signedKind0Event))
                );
                kind0Results.forEach((r) => {
                    appendKeysLinkLog(`kind0 ${r.success ? 'OK' : 'FAIL'} ${r.url}${r.error ? ` :: ${r.error}` : ''}`);
                });
                const kind0Successful = kind0Results.filter((r) => r.success);
                const kind0Failed = kind0Results.filter((r) => !r.success).map((r) => ({ url: r.url, error: r.error }));
                if (kind0Successful.length === 0) {
                    trackNrWebEvent('nr_profile_linked', {
                        ...getWritableRelayAnalyticsData(relayUrls),
                        failed_count: kind0Failed.length,
                        status: 'failed',
                        ...getCurrentTrustrootsUsernameAnalyticsData(username),
                    });
                    markRelaysWithPublishFailures(kind0Failed);
                    const errorDetails = kind0Failed.map((f) => {
                        const errorMsg = f.error ? ` (${formatRelayError(f.error)})` : '';
                        return `${f.url}${errorMsg}`;
                    }).join(', ');
                    showStatus(`Profile validated but bootstrap kind 0 failed to publish: ${errorDetails}.`, 'error', { eventPayload: signedKind0Event, actions: [] });
                    return;
                }
                // Small delay so relays can index kind 0 before enforcing trustroots-profile checks.
                await new Promise((resolve) => setTimeout(resolve, 700));
                
                const publishPromises = relayUrls.map(url => publishToRelayWithRetries(url, signedEvent));
                const results = await Promise.all(publishPromises);
                results.forEach((r) => {
                    appendKeysLinkLog(`kind10390 ${r.success ? 'OK' : 'FAIL'} ${r.url}${r.error ? ` :: ${r.error}` : ''}`);
                });
                const successful = results.filter(r => r.success);
                const failed = results.filter(r => !r.success).map(r => ({ url: r.url, error: r.error }));
                const authRelayNormalized = normalizeRelayUrlForKeysLog(TRUSTROOTS_RESTRICTED_RELAY_URL);
                const authRelayAttempted = relayUrls.some((u) => normalizeRelayUrlForKeysLog(u) === authRelayNormalized);
                const authRelayKind0Ok = kind0Results.some((r) => r.success && normalizeRelayUrlForKeysLog(r.url) === authRelayNormalized);
                const authRelayKind10390Ok = results.some((r) => r.success && normalizeRelayUrlForKeysLog(r.url) === authRelayNormalized);
                if (authRelayAttempted && (!authRelayKind0Ok || !authRelayKind10390Ok)) {
                    appendKeysLinkLog(`Auth relay check failed: kind0=${authRelayKind0Ok} kind10390=${authRelayKind10390Ok}`);
                    trackNrWebEvent('nr_profile_linked', {
                        ...getWritableRelayAnalyticsData(relayUrls),
                        failed_count: failed.length,
                        status: 'failed',
                        ...getCurrentTrustrootsUsernameAnalyticsData(username),
                    });
                    showStatus(
                        'Profile validated, but auth relay publish did not complete. Check relay settings, then retry.',
                        'error',
                        { actions: [{ label: 'Open Keys & profile', onClick: () => openKeysModal() }] }
                    );
                    return;
                }
                
                if (successful.length > 0) {
                    appendKeysLinkLog('Link flow success');
                    trackNrWebEvent('nr_profile_linked', {
                        ...getWritableRelayAnalyticsData(relayUrls),
                        failed_count: failed.length,
                        status: failed.length > 0 ? 'partial' : 'success',
                        ...getCurrentTrustrootsUsernameAnalyticsData(username),
                    });
                    const relayWord = successful.length === 1 ? 'relay' : 'relays';
                    const backupHint = nrWebNip7Signer.isActiveForPubkey(currentPublicKey)
                        ? ''
                        : ' Back up your nsec in your password manager before relying on this identity.';
                    let statusMessage = `Profile linked! Username ${username} published to ${successful.length} ${relayWord}. You can now explore the app.${backupHint}`;
                    if (failed.length > 0) {
                        const failedRelays = failed.map(f => f.url).join(', ');
                        statusMessage += ` (${failed.length} failed: ${failedRelays})`;
                    }
                    showStatus(statusMessage, 'success');
                    // Mark profile as linked and update UI
                    isProfileLinked = true;
                    usernameFromNostr = true;
                    updateLinkProfileButton();
                    
                    // Update username field and disable it since it's from Nostr
                    const usernameInput = document.getElementById('trustroots-username');
                    const usernameIndicator = document.getElementById('username-nostr-indicator');
                    if (usernameInput) {
                        usernameInput.value = username;
                        usernameInput.disabled = true;
                    }
                    if (usernameIndicator) {
                        usernameIndicator.style.display = 'block';
                    }
                    
                    // Hide "Update Trustroots Profile" button now that profile is linked
                    const updateTrustrootsGroup = document.getElementById('update-trustroots-profile-group');
                    if (updateTrustrootsGroup) {
                        updateTrustrootsGroup.style.display = 'none';
                    }
                    updateKeyDisplay({ skipProfileLookup: true });
                    await refreshClaimSuggestions({ silent: true });
                } else {
                    appendKeysLinkLog('kind10390 failed on all relays');
                    trackNrWebEvent('nr_profile_linked', {
                        ...getWritableRelayAnalyticsData(relayUrls),
                        failed_count: failed.length,
                        status: 'failed',
                        ...getCurrentTrustrootsUsernameAnalyticsData(username),
                    });
                    markRelaysWithPublishFailures(failed);
                    const relayWordPf = failed.length === 1 ? 'relay' : 'relays';
                    const hasProfileMissingRestrictionPf = failed.some(f => isTrustrootsProfileMissingRelayError(f.error));
                    if (hasProfileMissingRestrictionPf) {
                        showStatus(
                            `Profile validated but could not publish to ${relayWordPf}: relays still did not see a Trustroots profile for this key. Try again after a moment, or check relay settings.`,
                            'error',
                            { actions: [{ label: 'Open Keys & profile', onClick: () => openKeysModal() }] }
                        );
                    } else {
                        const errorDetails = failed.map(f => {
                            const hostname = f.url;
                            const errorMsg = f.error ? ` (${formatRelayError(f.error)})` : '';
                            return `${hostname}${errorMsg}`;
                        }).join(', ');
                        const hint = getRelayPublishFailureHint(failed);
                        showStatus(`Profile validated but failed to publish: ${errorDetails}.${hint}`, 'error', { eventPayload: signedEvent, actions: [] });
                    }
                }
            } else {
                appendKeysLinkLog('NIP-05 pubkey mismatch with current key');
                showStatus(`Username ${username} is linked to a different npub. This profile does not belong to you.`, 'error');
                
                // Clear the username field since it doesn't belong to this profile
                const usernameInput = document.getElementById('trustroots-username');
                const usernameIndicator = document.getElementById('username-nostr-indicator');
                if (usernameInput) {
                    usernameInput.value = '';
                    usernameInput.disabled = false;
                    // Focus the field so user can immediately enter a new username
                    usernameInput.focus();
                }
                if (usernameIndicator) {
                    usernameIndicator.style.display = 'none';
                }
                
                // Reset profile link state
                isProfileLinked = false;
                usernameFromNostr = false;
                updateLinkProfileButton();
            }
        } else {
            appendKeysLinkLog('NIP-05 name not found on trustroots.org');
            // No valid nip5 found - don't store username
            showStatus('Username not found or has no valid nip5', 'error');
        }
    } catch (error) {
        appendKeysLinkLog(`Exception: ${error?.message || error}`);
        showStatus('Error linking profile: ' + error.message, 'error');
    }
}

// Initialize relay list in settings
function initializeRelayList() {
    const urls = getRelayUrls();
    if (relaySettings?.initializeRelaySettingsState) {
        relaySettings.initializeRelaySettingsState(urls, relayWriteEnabled, relayStatus, {
            status: 'disconnected',
            savePreferences: true
        });
    } else {
        const savedWritePreferences = getSavedRelayWritePreferences();
        urls.forEach(url => {
            const hasSavedPreference = Object.prototype.hasOwnProperty.call(savedWritePreferences, url);
            const canWrite = hasSavedPreference
                ? savedWritePreferences[url] !== false
                : getDefaultRelayPostEnabled(url);
            if (!relayStatus.has(url)) {
                relayStatus.set(url, { status: 'disconnected', canWrite });
            } else {
                const current = relayStatus.get(url) || { status: 'disconnected', canWrite: true };
                relayStatus.set(url, { ...current, canWrite });
            }
            relayWriteEnabled.set(url, canWrite);
        });
        saveRelayWritePreferences();
    }
    renderRelaysList();
}

// Initialize relay list on page load
initializeRelayList();

// Plus code grid state
let plusCodeGridSource = null;
let plusCodeGridLayer = null;

// ESC key handler for closing modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
        closeActiveModal();
    }
});

// The app module is appended dynamically for cache-busting, so it can arrive
// after window.load has already fired on a normal refresh.
let nrWebAppInitialized = false;
async function initializeNrWebApp() {
    if (nrWebAppInitialized) return;
    nrWebAppInitialized = true;

    // If user switched from chat/map via the header link, suppress connection toasts
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nostroots_switching_page')) {
        sessionStorage.removeItem('nostroots_switching_page');
        window._nostrootsSuppressConnectionToasts = true;
    }
    // Map initialization handles MapLibre missing by attempting Leaflet fallback.
    if (typeof maplibregl === 'undefined') console.warn('MapLibre GL not loaded; trying Leaflet fallback');
    
    // Initialize expiration input with saved value
    const savedExpiration = getExpirationSetting();
    const expirationSelectModal = document.getElementById('note-expiration-in-modal');
    if (expirationSelectModal) expirationSelectModal.value = savedExpiration;
    
    // Initialize relay list
    initializeRelayList();

    // Keys / Settings header buttons: wired in common.js fillAppHeader() so listeners survive header rebuilds.

    // When user focuses the window after clicking a notification, open the notes modal for that plus code
    window.addEventListener('focus', () => {
        if (pendingNotificationPlusCode) {
            const plusCode = pendingNotificationPlusCode;
            pendingNotificationPlusCode = null;
            showNotesForPlusCode(plusCode);
        }
    });
    
    // Modals are loaded asynchronously from modals-keys-settings.html.
    // Defer onboarding and modal click handlers until the DOM is ready.
    function onModalsReady() {
        checkOnboarding();
        window.NrWeb?.applySettingsFooterMetadataFromCache?.();
        window.NrWeb?.refreshSettingsFooterMetadata?.();
        
        const keysModal = document.getElementById('keys-modal');
        if (keysModal) {
            keysModal.addEventListener('click', (e) => {
                if (e.target.id === 'keys-modal' && !document.body.classList.contains('nr-surface-account')) {
                    closeKeysModal();
                }
            });
        }
        
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target.id === 'settings-modal' && !document.body.classList.contains('nr-surface-account')) {
                    closeSettingsModal();
                }
            });
        }
    }
    
    if (document.getElementById('keys-modal')) {
        onModalsReady();
    } else {
        document.addEventListener('nostroots-modals-injected', onModalsReady, { once: true });
    }
    
    // Close circles modal when clicking outside
    const circlesModal = document.getElementById('circles-modal');
    if (circlesModal) {
        circlesModal.addEventListener('click', (e) => {
            if (e.target.id === 'circles-modal') {
                hideCirclesModal();
            }
        });
    }
    
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target.id === 'help-modal') {
                closeHelpModal();
            }
        });
    }
    
    // Note: Enter key handler for note textarea is set up in showNotesForPlusCode()
    // with proper deduplication via enterHandlerSetup flag
    
    // Small delay to ensure DOM is ready, then initialize map
    setTimeout(() => {
        initializeMap();
    }, 100);
    
    // Function to load data and connect to relays
    let loadDataReadyAttempts = 0;
    function loadDataWhenReady() {
        loadDataReadyAttempts++;
        if (mapFallbackMode) {
            void (async () => {
                await loadCachedEvents();
                setTimeout(async () => {
                    await initializeNDK();
                    startPeriodicFlushingOfExpiredEvents();
                    setTimeout(() => {
                        syncLocalStorageWithRelays();
                    }, 60000);
                }, 500);
            })();
            return;
        }

        // Avoid infinite "waiting for map" loops on soft refresh cache glitches:
        // after ~8s, force fallback so the app remains usable.
        if (loadDataReadyAttempts > 80) {
            console.warn('Map readiness timeout; forcing fallback renderer.');
            const switched = initializeLeafletFallback('map-ready-timeout');
            if (!switched) {
                renderUnavailableMapPanel('Map did not initialize. Try a hard refresh.');
                // Continue without map to keep non-map UI responsive.
                void (async () => {
                    await loadCachedEvents();
                    await initializeNDK();
                    startPeriodicFlushingOfExpiredEvents();
                })();
                return;
            }
            // Retry once fallback has been mounted.
            setTimeout(loadDataWhenReady, 100);
            return;
        }

        // Check if map is ready
        if (map && map.loaded() && map.getSource('pluscode-grid')) {
            void (async () => {
                await loadCachedEvents();
                setTimeout(() => {
                    updatePlusCodeGrid();
                }, 100);
                setTimeout(async () => {
                    await initializeNDK();
                    startPeriodicFlushingOfExpiredEvents();
                    setTimeout(() => {
                        syncLocalStorageWithRelays();
                    }, 60000);
                }, 500);
            })();
        } else {
            // Map not ready yet, try again
            setTimeout(loadDataWhenReady, 100);
        }
    }
    
    // Start checking if map is ready after giving it time to initialize
    setTimeout(loadDataWhenReady, 200);

    window.addEventListener('hashchange', () => {
        rememberHashRouteTransition();
        void applyUnifiedHash();
    });
    document.addEventListener('nostroots-modals-injected', () => {
        void applyUnifiedHash();
    });
    void applyUnifiedHash();
    setTimeout(() => processNrWebUrlAction(), 900);
}

if (document.readyState === 'complete') {
    void initializeNrWebApp();
} else {
    window.addEventListener('load', () => {
        void initializeNrWebApp();
    }, { once: true });
}

// Make functions available globally
window.generateKeyPair = generateKeyPair;
window.importNsec = importNsec;
window.exportNsec = exportNsec;
window.deleteNsec = deleteNsec;
window.saveRelays = saveRelays;
window.linkTrustrootsProfile = linkTrustrootsProfile;
window.updateTrustrootsProfile = updateTrustrootsProfile;
window.publishNoteFromModal = publishNoteFromModal;
window.closePlusCodeNotesModal = closePlusCodeNotesModal;
window.closeSettingsModal = closeSettingsModal;
window.openKeysModal = openKeysModal;
window.closeKeysModal = closeKeysModal;
window.onboardingGenerate = onboardingGenerate;
window.onboardingImport = onboardingImport;
window.onboardingNip7Connect = onboardingNip7Connect;
window.copyPublicKey = copyPublicKey;
window.showCirclesModal = showCirclesModal;
window.hideCirclesModal = hideCirclesModal;
window.clearSelectedCircle = clearSelectedCircle;

// Expiration-related functions (NIP-40)
window.isEventExpired = isEventExpired;
window.getExpirationTimestamp = getExpirationTimestamp;
window.getRemainingTime = getRemainingTime;
window.formatRemainingTime = formatRemainingTime;
window.flushExpiredEvents = flushExpiredEvents;
window.createNoteItem = createNoteItem;

// ---------------------------------------------------------------------------
// Folded: chat-app.js (wrapped in IIFE; returns embedded chat entry points)
// ---------------------------------------------------------------------------
const __nrChatApp = (() => {

        // nostr-tools may access window.printer.maybe for debug; avoid ReferenceError
        if (typeof window !== 'undefined' && !window.printer) {
            window.printer = { maybe: function () {} };
        }
        // Consume "switching page" flag so it doesn't persist (set by Map/Chat nav link on the other page)
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nostroots_switching_page')) {
            sessionStorage.removeItem('nostroots_switching_page');
        }

        const TRUSTROOTS_USERNAME_CACHE_STORAGE_KEY = 'trustroots_username_by_pubkey';
        const HOSTING_OFFER_CHANNEL_SLUG = 'hostingoffers';
        const HOSTING_OFFER_CHANNEL_ALIASES = ['hostingoffer', 'hostingoffers'];
        const relaySettings = window.NrWebRelaySettings;
        const TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX = String(
            globalThis.NrWebTrustrootsCircleMeta?.IMPORT_TOOL_PUBKEY_HEX || ''
        )
            .trim()
            .toLowerCase();
        const NIP42_AUTH_KIND = 22242;
        const RELAY_PUBLISH_TIMEOUT_MS = 10000;
        /** Same option set as map note composer; storage is via expirationSecondsStore at module scope. */
        const NR_EXPIRATION_OPTION_SECONDS = [3600, 86400, 604800, 2592000, 31536000];

        function normalizeChannelSlug(slug) {
            if (typeof slug !== 'string') return slug;
            const normalized = slug.trim().toLowerCase();
            if (HOSTING_OFFER_CHANNEL_ALIASES.includes(normalized)) {
                return HOSTING_OFFER_CHANNEL_SLUG;
            }
            // Canonicalize known direct aliases (e.g. #hitchhikers -> #hitch) so route-only
            // conversations still resolve circle metadata and fallback imagery.
            const alias = trustrootsCircleKeyAlias(normalized);
            if (alias && alias !== normalized && isKnownTrustrootsCircleSlug(alias)) {
                return alias;
            }
            // Legacy Trustroots channel aliases sometimes prefix circle slugs with
            // `trustroots` (e.g. #trustrootsvolunteers). Collapse those aliases into
            // known canonical circle keys when possible.
            const legacyPrefixed = normalizeLegacyTrustrootsCircleAlias(
                normalized,
                (candidate) => isKnownTrustrootsCircleSlug(candidate)
            );
            if (legacyPrefixed && legacyPrefixed !== normalized) {
                return legacyPrefixed;
            }
            // Trustroots circles canonicalize without ASCII hyphens (matches kind 30410 `d`
            // and the trustrootsimporttool slug helper). Old events / user notes may carry
            // a hyphenated `t` tag like beer-brewers; collapse to beerbrewers when the result
            // is a known circle so legacy and current data land in the same channel. Ad-hoc
            // hashtags that are not Trustroots circles keep their hyphens.
            if (normalized.includes('-')) {
                const stripped = canonicalTrustrootsCircleSlugKey(normalized);
                if (stripped && stripped !== normalized && isKnownTrustrootsCircleSlug(stripped)) {
                    return stripped;
                }
            }
            return normalized;
        }

        function isKnownTrustrootsCircleSlug(slug) {
            // Lazy reference: TRUSTROOTS_CIRCLE_SLUGS_SET is initialized later in this scope.
            try {
                return TRUSTROOTS_CIRCLE_SLUGS_SET.has(slug);
            } catch (_) {
                return false;
            }
        }

        // Decode blocklist npubs to hex (shared blocklist in common.js).
        // The map surface ran the same loop on module init (~line 880); this branch only triggers
        // if chat boots before that ran, e.g. in tests. Keep idempotent.
        if (typeof NrBlocklist !== 'undefined' && NrBlocklist.BLOCKLIST_NPUBS && nip19) {
            const blocklistHex = NrBlocklist.BLOCKLIST_NPUBS.map((n) => npubToHex(n) || null).filter(Boolean);
            NrBlocklist.setBlocklistHex(blocklistHex);
        }

        function isPlusCodeChannelId(id) {
            // OLC alphabet plus '0' for padded/prefix codes (e.g. 9F000000+)
            return typeof id === 'string' && /^[023456789CFGHJMPQRVWX]{4,}\+?$/i.test(id.replace(/\s/g, ''));
        }
        const pubkeyToUsername = new Map();
        /** NIP-05 from kind 0 (any domain). Used for display; prefer over npub. */
        const pubkeyToNip05 = new Map();
        /** Profile/circle picture by pubkey for chat headers and DM avatars. */
        const pubkeyToPicture = new Map();

        // isTrustrootsNip05Lower lives at module scope; chat re-uses that.

        let isProfileLinked = false;
        let usernameFromNostr = false;
        let currentUserNip05 = '';
        let chatProfileCheckInFlight = null;
        let chatProfileCheckLastRunAt = 0;

        function readValidatedTrustrootsUsernameMap() {
            try {
                const raw = localStorage.getItem(TRUSTROOTS_USERNAME_CACHE_STORAGE_KEY);
                if (!raw) return {};
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (_) {
                return {};
            }
        }

        function writeValidatedTrustrootsUsernameMap(map) {
            try {
                localStorage.setItem(TRUSTROOTS_USERNAME_CACHE_STORAGE_KEY, JSON.stringify(map || {}));
            } catch (_) {}
        }

        function getCachedValidatedTrustrootsUsername(pubkey) {
            if (!pubkey) return '';
            const normalized = String(pubkey).toLowerCase();
            const map = readValidatedTrustrootsUsernameMap();
            return map[normalized] || '';
        }

        function setCachedValidatedTrustrootsUsername(pubkey, username) {
            if (!pubkey) return;
            const normalizedPubkey = String(pubkey).toLowerCase();
            const normalizedUsername = (username || '').trim().toLowerCase();
            if (!normalizedUsername) return;
            const map = readValidatedTrustrootsUsernameMap();
            map[normalizedPubkey] = normalizedUsername;
            writeValidatedTrustrootsUsernameMap(map);
        }

        function clearCachedValidatedTrustrootsUsername(pubkey) {
            if (!pubkey) return;
            const normalized = String(pubkey).toLowerCase();
            const map = readValidatedTrustrootsUsernameMap();
            delete map[normalized];
            writeValidatedTrustrootsUsernameMap(map);
        }

        function getCurrentTrustrootsUsernameForAnalytics() {
            const usernameInput = document.getElementById('trustroots-username');
            const inputUsername = usernameInput && usernameInput.disabled
                ? normalizeNrWebAnalyticsTrustrootsUsername(usernameInput.value)
                : '';
            return (
                inputUsername ||
                normalizeNrWebAnalyticsTrustrootsUsername(pubkeyToUsername.get(currentPublicKey)) ||
                normalizeNrWebAnalyticsTrustrootsUsername(getCachedValidatedTrustrootsUsername(currentPublicKey))
            );
        }

        function getCurrentTrustrootsUsernameAnalyticsData(usernameOverride) {
            const trustrootsUsername =
                normalizeNrWebAnalyticsTrustrootsUsername(usernameOverride) ||
                getCurrentTrustrootsUsernameForAnalytics();
            return trustrootsUsername ? { trustroots_username: trustrootsUsername } : {};
        }

        function getTrustrootsCircles() {
            return getTrustrootsCircleEntries();
        }

        /** Shared relay list storage (same as index.html). */
        const getRelayUrls = () => relaySettings?.getRelayUrls ? relaySettings.getRelayUrls(DEFAULT_RELAYS) : DEFAULT_RELAYS.slice();

        function saveRelayUrls(urls) {
            if (relaySettings?.saveRelayUrls) {
                relaySettings.saveRelayUrls(urls);
                return;
            }
            if (urls.length) relayUrlsStore.write(urls);
            else relayUrlsStore.clear();
        }

        const getSavedRelayWritePreferences = () => relaySettings?.getRelayWritePreferences ? relaySettings.getRelayWritePreferences() : {};
        const getDefaultRelayPostEnabled = (url) => relaySettings?.getDefaultRelayPostEnabled
            ? relaySettings.getDefaultRelayPostEnabled(url)
            : (url || '').trim().toLowerCase() === 'wss://nip42.trustroots.org';
        const saveRelayWritePreferences = () => {
            if (relaySettings?.saveRelayWritePreferences) relaySettings.saveRelayWritePreferences(getRelayUrls(), relayWriteEnabled);
        };

        let currentPublicKey = null;
        let currentSecretKeyHex = null;
        let currentSecretKeyBytes = null;
        let pool = null;
        let relays = [];
        const relayStatus = new Map(); // url -> { status, canWrite }
        const relayWriteEnabled = new Map(); // url -> boolean
        const conversations = new Map();
        /** @type {Map<string, { name: string, about: string, picture: string, trustrootsSlug: string, created_at: number, eventId: string }>} */
        const circleMetaBySlug = new Map();
        /** @type {Map<string, { members: Map<string, object>, loading: boolean, loaded: boolean, error: string, expanded: boolean, query: string }>} */
        const circleMembersBySlug = new Map();
        const currentUserTrustrootsCircleSlugs = new Set();
        let currentUserCircleMembershipPubkey = '';
        let currentUserCircleMembershipOverrideActive = false;
        let currentUserCircleMembershipOverrideCreatedAt = 0;
        let currentUserCircleMembershipOverrideSlugs = new Set();

        function isNip7ChatActive() {
            return !!window.NrWebNip7?.isActiveForPubkey?.(currentPublicKey);
        }

        function hasChatSigningKey() {
            return !!(currentPublicKey && (currentSecretKeyBytes || isNip7ChatActive()));
        }

        function getChatSignerAnalyticsType() {
            if (isNip7ChatActive()) return 'nip7';
            if (currentSecretKeyBytes || currentSecretKeyHex) return 'local';
            return 'none';
        }

        async function nip7ChatEncrypt(peerPubkey, plaintext) {
            return window.NrWebNip7.nip44Encrypt(peerPubkey, plaintext);
        }

        async function nip7ChatDecrypt(peerPubkey, ciphertext) {
            return window.NrWebNip7.nip44Decrypt(peerPubkey, ciphertext);
        }

        const TRUSTROOTS_CIRCLE_SLUGS_SET = new Set(
            getTrustrootsCircles()
                .map((c) => normalizeTrustrootsCircleSlugKey(c.slug))
                .filter(Boolean)
        );

        function trustrootsCirclePictureFallback(slug, meta) {
            const key = canonicalTrustrootsCircleSlugKey(slug);
            if (!key) return '';
            if (!TRUSTROOTS_CIRCLE_SLUGS_SET.has(key)) return '';
            return trustrootsCirclePictureFallbackUrlFromMeta(meta || null, key);
        }

        function setImageWithFallback(imgEl, url, altText) {
            if (window.NrWeb && typeof window.NrWeb.setProfileImageWithResolvedCache === 'function') {
                window.NrWeb.setProfileImageWithResolvedCache(imgEl, url, altText);
                return;
            }
            if (!imgEl) return;
            const primary = String(url || '').trim();
            if (!primary) {
                imgEl.removeAttribute('src');
                imgEl.style.display = 'none';
                imgEl.onerror = null;
                return;
            }
            const fallback = String(primary).replace(/\/1400x900\.webp(?:[?#].*)?$/i, '/742x496.jpg');
            imgEl.onerror = fallback && fallback !== primary
                ? () => {
                    imgEl.onerror = null;
                    imgEl.src = fallback;
                }
                : null;
            imgEl.src = primary;
            if (altText != null) imgEl.alt = altText;
            imgEl.style.display = 'block';
        }

        /** True when this slug matches a Trustroots tribe (relay 30410 or known slug list), not only ad-hoc #channels. */
        function hasPublishedTrustrootsCircle(slug) {
            const key = canonicalTrustrootsCircleSlugKey(slug);
            if (!key) return false;
            if (circleMetaBySlug.has(key)) return true;
            return TRUSTROOTS_CIRCLE_SLUGS_SET.has(key);
        }

        function isTrustrootsCircleConversation(entry) {
            if (!entry || entry.type !== 'channel') return false;
            const idRaw = String(entry.id || '').trim();
            if (!idRaw) return false;
            const idCanonical = normalizeChannelSlug(idRaw) || idRaw;
            const idKey = canonicalTrustrootsCircleSlugKey(idCanonical);
            if (circleMetaBySlug.has(idKey)) return true;
            if (TRUSTROOTS_CIRCLE_SLUGS_SET.has(idKey)) return true;
            const evs = entry.events || [];
            for (let i = 0; i < evs.length; i++) {
                const raw = evs[i]?.raw;
                if (!raw?.tags) continue;
                const row = raw.tags.find(
                    (t) =>
                        Array.isArray(t) &&
                        t.length >= 3 &&
                        (t[0] === 'l' || t[0] === 'L') &&
                        t[2] === TRUSTROOTS_CIRCLE_LABEL &&
                        canonicalTrustrootsCircleSlugKey(t[1]) === idKey
                );
                if (row) return true;
            }
            return false;
        }

        function circleSlugKeyForConversation(entry) {
            if (!isTrustrootsCircleConversation(entry)) return '';
            return canonicalTrustrootsCircleSlugKey(normalizeChannelSlug(entry.id) || entry.id);
        }

        function resetCurrentUserCircleMembershipIfPubkeyChanged() {
            const normalized = normalizeCachedPubkeyHex(currentPublicKey);
            if (normalized === currentUserCircleMembershipPubkey) return;
            currentUserCircleMembershipPubkey = normalized;
            currentUserTrustrootsCircleSlugs.clear();
            currentUserCircleMembershipOverrideActive = false;
            currentUserCircleMembershipOverrideCreatedAt = 0;
            currentUserCircleMembershipOverrideSlugs = new Set();
            loadCachedCurrentUserCircleMembershipOverride();
        }

        function rememberCurrentUserCircleMembership(member) {
            resetCurrentUserCircleMembershipIfPubkeyChanged();
            const userPubkey = normalizeCachedPubkeyHex(currentPublicKey);
            const memberPubkey = normalizeCachedPubkeyHex(member?.pubkey);
            if (!userPubkey || memberPubkey !== userPubkey) return false;
            let changed = false;
            for (const slug of member?.slugs || []) {
                const key = canonicalTrustrootsCircleSlugKey(slug);
                if (!key || currentUserTrustrootsCircleSlugs.has(key)) continue;
                currentUserTrustrootsCircleSlugs.add(key);
                changed = true;
            }
            return changed;
        }

        function currentUserCircleMembershipCacheKey() {
            const userPubkey = normalizeCachedPubkeyHex(currentPublicKey);
            return userPubkey ? `nostroots_circle_memberships_v1:${userPubkey}` : '';
        }

        function normalizeCircleMembershipSlugList(slugs) {
            const out = [];
            const seen = new Set();
            for (const slug of slugs || []) {
                const key = canonicalTrustrootsCircleSlugKey(slug);
                if (!key || seen.has(key) || !TRUSTROOTS_CIRCLE_SLUGS_SET.has(key)) continue;
                seen.add(key);
                out.push(key);
            }
            return out.sort((a, b) => a.localeCompare(b));
        }

        function saveCachedCurrentUserCircleMembershipOverride() {
            const key = currentUserCircleMembershipCacheKey();
            if (!key || typeof localStorage === 'undefined') return;
            try {
                if (!currentUserCircleMembershipOverrideActive) {
                    localStorage.removeItem(key);
                    return;
                }
                localStorage.setItem(key, JSON.stringify({
                    created_at: currentUserCircleMembershipOverrideCreatedAt,
                    slugs: [...currentUserCircleMembershipOverrideSlugs],
                }));
            } catch (_) {}
        }

        function loadCachedCurrentUserCircleMembershipOverride() {
            const key = currentUserCircleMembershipCacheKey();
            if (!key || typeof localStorage === 'undefined') return false;
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return false;
                const parsed = JSON.parse(raw);
                const slugs = normalizeCircleMembershipSlugList(parsed?.slugs || []);
                currentUserCircleMembershipOverrideActive = true;
                currentUserCircleMembershipOverrideCreatedAt = Number(parsed?.created_at || 0) || 0;
                currentUserCircleMembershipOverrideSlugs = new Set(slugs);
                return true;
            } catch (_) {
                return false;
            }
        }

        function getCircleMembershipSlugsFromEvent(event) {
            if (!event || event.kind !== TRUSTROOTS_CIRCLE_MEMBERSHIP_KIND) return [];
            const tags = Array.isArray(event.tags) ? event.tags : [];
            const d = tags.find((tag) => Array.isArray(tag) && tag[0] === 'd')?.[1] || '';
            if (String(d || '').trim() !== TRUSTROOTS_CIRCLE_MEMBERSHIP_D_TAG) return [];
            return normalizeCircleMembershipSlugList(
                tags
                    .filter((tag) =>
                        Array.isArray(tag) &&
                        tag.length >= 3 &&
                        tag[0] === 'l' &&
                        tag[2] === TRUSTROOTS_CIRCLE_LABEL
                    )
                    .map((tag) => tag[1])
            );
        }

        function applyCurrentUserCircleMembershipOverride(slugs, createdAt) {
            resetCurrentUserCircleMembershipIfPubkeyChanged();
            currentUserCircleMembershipOverrideActive = true;
            currentUserCircleMembershipOverrideCreatedAt = Number(createdAt || 0) || 0;
            currentUserCircleMembershipOverrideSlugs = new Set(normalizeCircleMembershipSlugList(slugs));
            saveCachedCurrentUserCircleMembershipOverride();
        }

        function handleCurrentUserCircleMembershipEvent(event) {
            if (!event || event.kind !== TRUSTROOTS_CIRCLE_MEMBERSHIP_KIND) return false;
            const author = normalizeCachedPubkeyHex(event.pubkey);
            const userPubkey = normalizeCachedPubkeyHex(currentPublicKey);
            if (!author || !userPubkey || author !== userPubkey) return false;
            const tags = Array.isArray(event.tags) ? event.tags : [];
            const d = tags.find((tag) => Array.isArray(tag) && tag[0] === 'd')?.[1] || '';
            if (String(d || '').trim() !== TRUSTROOTS_CIRCLE_MEMBERSHIP_D_TAG) return false;
            const createdAt = Number(event.created_at || 0) || 0;
            if (currentUserCircleMembershipOverrideActive && createdAt < currentUserCircleMembershipOverrideCreatedAt) return false;
            applyCurrentUserCircleMembershipOverride(getCircleMembershipSlugsFromEvent(event), createdAt);
            scheduleRender('convList');
            const selected = selectedConversationId ? conversations.get(selectedConversationId) : null;
            renderCircleMembersPanel(selected);
            return true;
        }

        function getEffectiveCurrentUserCircleMembershipSlugs() {
            resetCurrentUserCircleMembershipIfPubkeyChanged();
            return new Set(
                currentUserCircleMembershipOverrideActive
                    ? [...currentUserCircleMembershipOverrideSlugs]
                    : [...currentUserTrustrootsCircleSlugs]
            );
        }

        function isCurrentUserMemberOfTrustrootsCircle(slug) {
            const key = canonicalTrustrootsCircleSlugKey(slug);
            if (!key) return false;
            return getEffectiveCurrentUserCircleMembershipSlugs().has(key);
        }

        function isIntentConversationSlug(slug) {
            const normalized = normalizeChannelSlug(String(slug || ''));
            return isIntentId(normalized) || normalized === HOSTING_OFFER_CHANNEL_SLUG;
        }

        function shouldShowConversationInSidebar(entry) {
            if (!entry) return false;
            if (entry.type === 'dm' || entry.type === 'group') return true;
            if (entry.type !== 'channel') return false;
            const id = normalizeChannelSlug(String(entry.id || ''));
            if (!id) return false;
            if (isIntentConversationSlug(id)) return true;
            if (isTrustrootsCircleConversation(entry)) return isCurrentUserMemberOfTrustrootsCircle(id);
            return false;
        }

        function getOrderedSidebarConversationEntries() {
            return Array.from(conversations.entries())
                .map(([id, c]) => ({ id, ...c }))
                .filter((entry) => shouldShowConversationInSidebar(entry))
                .sort((a, b) => convSortKey(b) - convSortKey(a));
        }

        function getFirstSidebarConversationId() {
            return getOrderedSidebarConversationEntries()[0]?.id || '';
        }

        function getCircleMemberState(slugKey) {
            const key = canonicalTrustrootsCircleSlugKey(slugKey);
            if (!key) return null;
            let state = circleMembersBySlug.get(key);
            if (!state) {
                state = { members: new Map(), loading: false, loaded: false, error: '', expanded: false, query: '' };
                circleMembersBySlug.set(key, state);
            }
            return state;
        }

        function trustedCircleMemberClaimAuthors(importPubkey) {
            const importPub = normalizeCachedPubkeyHex(importPubkey);
            const out = [];
            if (importPub) out.push(importPub);
            const validationPub = normalizeCachedPubkeyHex(NOSTROOTS_VALIDATION_PUBKEY);
            if (validationPub && validationPub !== importPub) out.push(validationPub);
            return out;
        }

        function isTrustedCircleMemberClaimEvent(event, importPubkey) {
            const author = String(event?.pubkey || '').trim().toLowerCase();
            const trustedAuthors = trustedCircleMemberClaimAuthors(importPubkey);
            if (!author || !trustedAuthors.includes(author)) return false;
            if (event?.kind === MAP_NOTE_REPOST_KIND) return hasClaimTagValue(event?.tags, 'claimable', 'true');
            return true;
        }

        function parseCircleMemberFromTrustedClaimEvent(event, slug, expectedPubkeys, opts = {}) {
            if (event?.kind === PROFILE_CLAIM_KIND) {
                return parseCircleMemberProfileClaim30390(event, slug, { expectedPubkeys });
            }
            if (MAP_NOTE_KINDS.includes(event?.kind) || opts.acceptedSlugs?.length) {
                return parseCircleMemberMapNoteClaimEvent(event, slug, { expectedPubkeys, ...opts });
            }
            return null;
        }

        function upsertCircleMemberForSlugFromClaimEvent(event, slug) {
            const importPub = TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX;
            if (!isTrustedCircleMemberClaimEvent(event, importPub)) return false;
            const expectedPubkeys = trustedCircleMemberClaimAuthors(importPub);
            const slugKey = canonicalTrustrootsCircleSlugKey(slug);
            if (!slugKey) return false;
            const member = parseCircleMemberFromTrustedClaimEvent(event, slugKey, expectedPubkeys, { acceptedSlugs: [slugKey] });
            if (!member) return false;
            const state = getCircleMemberState(slugKey);
            if (!state) return false;
            const prev = state.members.get(member.pubkey);
            let changed = false;
            if (!prev || Number(member.created_at || 0) >= Number(prev.created_at || 0)) {
                state.members.set(member.pubkey, member);
                changed = true;
            }
            if (member.trustrootsUsername && !pubkeyToUsername.has(member.pubkey)) {
                pubkeyToUsername.set(member.pubkey, member.trustrootsUsername);
            }
            if (member.nip05 && !pubkeyToNip05.has(member.pubkey)) {
                pubkeyToNip05.set(member.pubkey, member.nip05);
            }
            if (member.picture && isSafeHttpUrl(member.picture)) {
                pubkeyToPicture.set(member.pubkey, member.picture);
            }
            if (rememberCurrentUserCircleMembership(member)) changed = true;
            return changed;
        }

        function upsertCircleMemberFromClaimEvent(event) {
            const importPub = TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX;
            if (!isTrustedCircleMemberClaimEvent(event, importPub)) return false;
            const expectedPubkeys = trustedCircleMemberClaimAuthors(importPub);
            const slugs = event?.kind === PROFILE_CLAIM_KIND
                ? extractCircleSlugsFromProfileClaim30390Event(event)
                : extractTrustrootsCircleSlugsFromEventTags(event);
            if (!slugs.length) return false;
            let changed = false;
            for (const slug of slugs) {
                const member = parseCircleMemberFromTrustedClaimEvent(event, slug, expectedPubkeys);
                if (!member) continue;
                const state = getCircleMemberState(slug);
                if (!state) continue;
                const prev = state.members.get(member.pubkey);
                if (!prev || Number(member.created_at || 0) >= Number(prev.created_at || 0)) {
                    state.members.set(member.pubkey, member);
                    changed = true;
                }
                if (member.trustrootsUsername && !pubkeyToUsername.has(member.pubkey)) {
                    pubkeyToUsername.set(member.pubkey, member.trustrootsUsername);
                }
                if (member.nip05 && !pubkeyToNip05.has(member.pubkey)) {
                    pubkeyToNip05.set(member.pubkey, member.nip05);
                }
                if (member.picture && isSafeHttpUrl(member.picture)) {
                    pubkeyToPicture.set(member.pubkey, member.picture);
                }
                if (rememberCurrentUserCircleMembership(member)) changed = true;
            }
            return changed;
        }

        function upsertCircleMembersFromConversationEvents(conv, slugKey) {
            if (!conv || !Array.isArray(conv.events)) return false;
            let changed = false;
            for (const row of conv.events) {
                const raw = row?.raw || row;
                if (upsertCircleMemberForSlugFromClaimEvent(raw, slugKey)) changed = true;
            }
            return changed;
        }

        function collectCircleMembersFromPublicRelays(filter, opts = {}) {
            const urls = (relays?.length ? relays : getRelayUrls()).filter((url) => !isRestrictedRelayUrl(url));
            if (!urls.length) return Promise.resolve([]);
            const noEoseCapMs = opts.noEoseCapMs ?? 2800;
            const absoluteMaxMs = opts.absoluteMaxMs ?? 6500;
            const eoseGraceMs = opts.eoseGraceMs ?? 400;
            const readPool = new SimplePool();
            const out = [];
            return new Promise((resolve) => {
                let settled = false;
                let eoseCount = 0;
                let sub = null;
                const settle = () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(noEoseTimer);
                    clearTimeout(absoluteTimer);
                    try { sub?.close?.(); } catch (_) {}
                    try { readPool.close?.(); } catch (_) {}
                    resolve(out);
                };
                const noEoseTimer = setTimeout(settle, noEoseCapMs);
                const absoluteTimer = setTimeout(settle, absoluteMaxMs);
                try {
                    sub = readPool.subscribe(urls, filter, {
                        onevent(event) {
                            if (event && typeof event === 'object') out.push(event);
                        },
                        oneose() {
                            eoseCount += 1;
                            if (eoseCount >= urls.length) {
                                clearTimeout(noEoseTimer);
                                setTimeout(settle, eoseGraceMs);
                            }
                        }
                    });
                } catch (_) {
                    settle();
                }
            });
        }

        function collectCircleMembersFromAuthRelay(filter, waitMs = 5200) {
            const relayAuth = globalThis.NrWebRelayAuth;
            if (!relayAuth?.startNip42WsSubscription || !currentPublicKey || !hasChatSigningKey()) {
                return Promise.resolve([]);
            }
            const restrictedUrl = (relays || []).find(isRestrictedRelayUrl) || 'wss://nip42.trustroots.org';
            const out = [];
            return new Promise((resolve) => {
                let connection = null;
                const finish = () => {
                    try { connection?.close?.(); } catch (_) {}
                    resolve(out);
                };
                try {
                    connection = relayAuth.startNip42WsSubscription({
                        relayUrl: restrictedUrl,
                        filter,
                        authPubkey: currentPublicKey,
                        signEvent: (template) => signEvent(template),
                        onEvent: (event) => {
                            if (event && typeof event === 'object') out.push(event);
                        }
                    });
                    setTimeout(finish, waitMs);
                } catch (_) {
                    finish();
                }
            });
        }

        function ensureCircleMembersLoadedForConversation(conv) {
            const slugKey = circleSlugKeyForConversation(conv);
            if (!slugKey) return;
            const state = getCircleMemberState(slugKey);
            if (!state || state.loading || state.loaded) return;
            const importPub = TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX;
            const trustedAuthors = trustedCircleMemberClaimAuthors(importPub);
            const lFilter = { kinds: [PROFILE_CLAIM_KIND, MAP_NOTE_REPOST_KIND], '#l': [slugKey], limit: 5000 };
            const tFilter = { kinds: [MAP_NOTE_REPOST_KIND], '#t': [slugKey], limit: 5000 };
            if (trustedAuthors.length) {
                lFilter.authors = trustedAuthors;
                tFilter.authors = trustedAuthors;
            }
            state.loading = true;
            state.error = '';
            renderCircleMembersPanel(conv);
            Promise.all([
                collectCircleMembersFromPublicRelays(lFilter, { noEoseCapMs: 2800, absoluteMaxMs: 6500 }).catch(() => []),
                collectCircleMembersFromPublicRelays(tFilter, { noEoseCapMs: 2800, absoluteMaxMs: 6500 }).catch(() => []),
                collectCircleMembersFromAuthRelay(lFilter, 5200).catch(() => []),
                collectCircleMembersFromAuthRelay(tFilter, 5200).catch(() => []),
            ]).then((chunks) => {
                for (const event of chunks.flat()) {
                    upsertCircleMemberFromClaimEvent(event);
                    upsertCircleMemberForSlugFromClaimEvent(event, slugKey);
                }
                state.loaded = true;
                state.loading = false;
                state.error = '';
            }).catch((error) => {
                state.loading = false;
                state.error = String(error?.message || error || 'Could not load members');
            }).finally(() => {
                const selected = selectedConversationId ? conversations.get(selectedConversationId) : null;
                if (circleSlugKeyForConversation(selected) === slugKey) {
                    renderCircleMembersPanel(selected);
                }
                scheduleRender('convList');
            });
        }

        function circleMemberDisplayName(member) {
            const name = String(member?.displayName || '').trim();
            if (name) return name;
            const tr = String(member?.trustrootsUsername || '').trim();
            if (tr) return tr;
            const nip05 = String(member?.nip05 || '').trim();
            if (nip05) return nip05;
            return getDisplayNameShort(member?.pubkey) || member?.npub || member?.pubkey || 'Member';
        }

        function circleMemberHandle(member) {
            const tr = String(member?.trustrootsUsername || '').trim();
            if (tr) return `${tr}@trustroots.org`;
            const nip05 = String(member?.nip05 || '').trim();
            if (nip05) return nip05;
            return member?.npub || hexToNpub(member?.pubkey) || '';
        }

        function circleMemberInitial(member) {
            const label = circleMemberDisplayName(member).trim();
            return (label[0] || '?').toUpperCase();
        }

        function appendCircleMemberAvatar(parent, member) {
            const pubkey = String(member?.pubkey || '').trim().toLowerCase();
            const pic = String(
                member?.picture ||
                pubkeyToPicture.get(pubkey) ||
                window.NrWeb?.getRememberedNrNavAccountAvatar?.(pubkey) ||
                ''
            ).trim();
            if (pic && isSafeHttpUrl(pic)) {
                const img = document.createElement('img');
                img.className = 'circle-member-avatar';
                img.alt = '';
                img.loading = 'lazy';
                img.decoding = 'async';
                setImageWithFallback(img, pic, '');
                parent.appendChild(img);
                return;
            }
            const span = document.createElement('span');
            span.className = 'circle-member-avatar circle-member-avatar-placeholder';
            span.textContent = circleMemberInitial(member);
            parent.appendChild(span);
        }

        function buildCurrentUserCircleMember(slugKey) {
            const pubkey = normalizeCachedPubkeyHex(currentPublicKey);
            if (!pubkey) return null;
            const tr = String(pubkeyToUsername.get(pubkey) || '').trim().toLowerCase();
            const nip05 = String(pubkeyToNip05.get(pubkey) || '').trim().toLowerCase();
            const npub = hexToNpub(pubkey) || '';
            const displayName = tr || nip05 || getDisplayNameShort(pubkey) || npub || pubkey;
            return {
                pubkey,
                npub,
                trustrootsUsername: tr,
                nip05,
                displayName,
                picture: String(pubkeyToPicture.get(pubkey) || window.NrWeb?.getRememberedNrNavAccountAvatar?.(pubkey) || '').trim(),
                profileId: tr ? `${tr}@trustroots.org` : (nip05 || npub || pubkey),
                slugs: [slugKey],
                created_at: currentUserCircleMembershipOverrideCreatedAt || Math.floor(Date.now() / 1000),
                eventId: '',
            };
        }

        function syncCurrentUserCircleMemberForSlug(slugKey) {
            if (!isCurrentUserMemberOfTrustrootsCircle(slugKey)) return false;
            const state = getCircleMemberState(slugKey);
            const member = buildCurrentUserCircleMember(slugKey);
            if (!state || !member) return false;
            const prev = state.members.get(member.pubkey);
            state.members.set(member.pubkey, { ...(prev || {}), ...member });
            return true;
        }

        function isCircleMemberVisibleForSlug(member, slugKey) {
            const userPubkey = normalizeCachedPubkeyHex(currentPublicKey);
            const memberPubkey = normalizeCachedPubkeyHex(member?.pubkey);
            if (!userPubkey || memberPubkey !== userPubkey) return true;
            if (!currentUserCircleMembershipOverrideActive) return true;
            return currentUserCircleMembershipOverrideSlugs.has(canonicalTrustrootsCircleSlugKey(slugKey));
        }

        function renderCircleMembersPanel(conv) {
            const panel = document.getElementById('circle-members-panel');
            if (!panel) return;
            const slugKey = circleSlugKeyForConversation(conv);
            if (!slugKey) {
                panel.style.display = 'none';
                panel.replaceChildren();
                return;
            }
            const state = getCircleMemberState(slugKey);
            upsertCircleMembersFromConversationEvents(conv, slugKey);
            syncCurrentUserCircleMemberForSlug(slugKey);
            const visibleMemberRows = [...state.members.values()].filter((member) => isCircleMemberVisibleForSlug(member, slugKey));
            const members = filterCircleMembersForDisplay(visibleMemberRows, state.query);
            const allMembers = sortCircleMembersForDisplay(visibleMemberRows);
            panel.style.display = 'block';
            panel.replaceChildren();

            const summary = document.createElement('div');
            summary.className = 'circle-members-summary';
            const title = document.createElement('span');
            title.className = 'circle-members-title';
            title.textContent = state.loading && !allMembers.length
                ? 'Loading members'
                : `${allMembers.length} member${allMembers.length === 1 ? '' : 's'}`;
            summary.appendChild(title);

            const avatars = document.createElement('div');
            avatars.className = 'circle-members-avatars';
            allMembers.slice(0, 8).forEach((member) => appendCircleMemberAvatar(avatars, member));
            if (!allMembers.length) {
                const muted = document.createElement('span');
                muted.className = 'circle-members-muted';
                muted.textContent = state.loading ? 'Reading imported profiles…' : 'No imported members found yet.';
                avatars.appendChild(muted);
            }
            summary.appendChild(avatars);

            const isMember = isCurrentUserMemberOfTrustrootsCircle(slugKey);
            const membershipButton = document.createElement('button');
            membershipButton.type = 'button';
            membershipButton.className = `circle-members-toggle circle-membership-toggle${isMember ? ' circle-membership-leave' : ''}`;
            membershipButton.textContent = isMember ? 'Leave circle' : 'Join circle';
            membershipButton.addEventListener('click', () => {
                if (isMember) void leaveTrustrootsCircle(slugKey);
                else void joinTrustrootsCircle(slugKey);
            });
            summary.appendChild(membershipButton);

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'circle-members-toggle';
            toggle.textContent = state.expanded ? 'Hide members' : 'Show members';
            toggle.addEventListener('click', () => {
                state.expanded = !state.expanded;
                renderCircleMembersPanel(conv);
            });
            summary.appendChild(toggle);
            panel.appendChild(summary);

            if (!state.expanded) return;

            const expanded = document.createElement('div');
            expanded.className = 'circle-members-expanded';
            const input = document.createElement('input');
            input.className = 'circle-members-search';
            input.type = 'search';
            input.placeholder = 'Search members';
            input.value = state.query || '';
            input.addEventListener('input', (event) => {
                state.query = String(event.target?.value || '');
                renderCircleMembersPanel(conv);
                const next = document.querySelector('#circle-members-panel .circle-members-search');
                if (next) {
                    next.focus();
                    try { next.setSelectionRange(next.value.length, next.value.length); } catch (_) {}
                }
            });
            expanded.appendChild(input);

            const list = document.createElement('div');
            list.className = 'circle-members-list';
            if (!members.length) {
                const empty = document.createElement('span');
                empty.className = 'circle-members-muted';
                empty.textContent = state.query ? 'No matching members.' : (state.loading ? 'Reading imported profiles…' : 'No imported members found yet.');
                list.appendChild(empty);
            } else {
                members.forEach((member) => {
                    const a = document.createElement('a');
                    a.className = 'circle-member-link';
                    a.href = buildProfileHashRoute(member.profileId || member.npub || member.pubkey);
                    appendCircleMemberAvatar(a, member);
                    const text = document.createElement('span');
                    text.className = 'circle-member-text';
                    const name = document.createElement('span');
                    name.className = 'circle-member-name';
                    name.textContent = circleMemberDisplayName(member);
                    const handle = document.createElement('span');
                    handle.className = 'circle-member-handle';
                    handle.textContent = circleMemberHandle(member);
                    text.appendChild(name);
                    text.appendChild(handle);
                    a.appendChild(text);
                    list.appendChild(a);
                });
            }
            expanded.appendChild(list);
            panel.appendChild(expanded);
        }

        let selectedConversationId = null;
        let pendingDeepLinkNoteId = '';
        let noteHighlightTimeout = null;
        let conversationFilterQuery = '';
        let backgroundContentMatches = new Set();
        const conversationSearchIndex = new Map();
        let backgroundSearchToken = 0;
        let backgroundSearchScheduled = null;
        let relayUrlsForList = [];
        /** New group modal: list of { hex, label } for added members */
        let groupModalMembers = [];
        /** NIP-09: event IDs requested for deletion (kind 5). We hide events when deletion pubkey matches author. */
        const deletedEventIds = new Set();
        /** event id -> pubkey (author) for NIP-09 validation */
        const eventAuthorById = new Map();
        /** event id pending delete confirmation */
        let pendingDeleteEventId = null;

        function getWritableRelayUrls() {
            return getRelayUrls().filter(url => relayWriteEnabled.get(url) !== false);
        }

        function getPublishRelayUrls() {
            const configured = getRelayUrls();
            if (relaySettings?.getPublishRelayUrls) {
                return relaySettings.getPublishRelayUrls(configured, relayWriteEnabled, DEFAULT_RELAYS);
            }
            const writable = getWritableRelayUrls();
            if (writable.length > 0) return writable;
            if (configured.length > 0) return configured;
            return DEFAULT_RELAYS;
        }

        function isKnownPublicRelayUrl(url) {
            if (relaySettings?.isPublicRelayUrl) return relaySettings.isPublicRelayUrl(url);
            const normalized = String(url || '').trim().toLowerCase();
            return normalized === 'wss://relay.trustroots.org' || normalized === 'wss://relay.nomadwiki.org';
        }

        /**
         * Relay scope for display:
         * - "public" when any known public relay is targeted
         * - "auth" when relay set is non-empty but includes no known public relays (eg. NIP-42 only)
         * - "" when unknown
         */
        function getRelayScopeFromRelayUrls(urls) {
            const list = Array.isArray(urls) ? urls : [];
            if (!list.length) return '';
            if (list.some((url) => isKnownPublicRelayUrl(url))) return 'public';
            return 'auth';
        }

        function updateRelayStatus(url, status, canWrite = null) {
            const current = relayStatus.get(url) || { status: 'disconnected', canWrite: true };
            relayStatus.set(url, {
                status: status,
                canWrite: canWrite !== null ? canWrite : current.canWrite
            });
        }

        function setRelayWriteEnabled(url, enabled) {
            relayWriteEnabled.set(url, enabled);
            const current = relayStatus.get(url) || { status: 'disconnected', canWrite: true };
            relayStatus.set(url, { ...current, canWrite: enabled });
            saveRelayWritePreferences();
            renderRelaysList();
            updateComposePostingIcon();
        }

        function toggleRelayWriteForEncodedUrl(encodedUrl, enabled) {
            try {
                const url = decodeURIComponent(encodedUrl);
                setRelayWriteEnabled(url, enabled);
            } catch (_) {}
        }

        function renderRelayPostWarning(container, urls) {
            if (!container) return;
            if (relaySettings?.renderRelayPostWarnings) {
                relaySettings.renderRelayPostWarnings(container, urls, relayWriteEnabled, {
                    disabledWarningId: 'relay-post-disabled-warning',
                    publicWarningId: 'relay-post-public-warning',
                    disabledClassName: 'status-toast error',
                    publicClassName: 'status-toast info',
                    disabledMessage: 'Posting is disabled. Enable "Post" for at least one relay so you can send messages.',
                    publicMessage: 'Public posting is enabled. Messages sent there are visible to anyone.',
                    pointerEvents: 'auto'
                });
                return;
            }
        }

        function initializeRelaySettingsState(urls, status = 'disconnected') {
            if (relaySettings?.initializeRelaySettingsState) {
                relaySettings.initializeRelaySettingsState(urls, relayWriteEnabled, relayStatus, {
                    status,
                    savePreferences: true
                });
                return;
            }
            const savedWritePreferences = getSavedRelayWritePreferences();
            urls.forEach((url) => {
                const hasSavedPreference = Object.prototype.hasOwnProperty.call(savedWritePreferences, url);
                const canWrite = hasSavedPreference
                    ? savedWritePreferences[url] !== false
                    : getDefaultRelayPostEnabled(url);
                relayWriteEnabled.set(url, canWrite);
                updateRelayStatus(url, status, canWrite);
            });
            saveRelayWritePreferences();
        }

        // Chat cache (conversations, profiles, deletions) in IndexedDB (nr-web-kv-idb.js).
        // Includes NIP-04 DMs and NIP-44 group messages (decrypted content) so they load faster on next visit.
        const CHAT_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
        const CHAT_CACHE_MAX_EVENTS_PER_CONV = 500;
        let chatCacheWriteTimeout = null;

        /** Last-opened chat per account (e.g. restore after #map clears the hash). */
        function getSelectedChatStorageKey() {
            return currentPublicKey ? 'nostroots_selected_chat_' + currentPublicKey : '';
        }
        function writePersistedSelectedChatId(id) {
            const key = getSelectedChatStorageKey();
            if (!key || typeof localStorage === 'undefined') return;
            try {
                if (id) localStorage.setItem(key, id);
                else localStorage.removeItem(key);
            } catch (_) {}
        }

        async function saveChatToCache() {
            if (!currentPublicKey || typeof indexedDB === 'undefined') return;
            try {
                const convArr = [];
                for (const [id, c] of conversations.entries()) {
                    const events = (c.events || []).slice(-CHAT_CACHE_MAX_EVENTS_PER_CONV).map(ev => ({
                        id: ev.id,
                        kind: ev.kind,
                        pubkey: ev.pubkey,
                        content: ev.content ?? '',
                        created_at: ev.created_at,
                        mapNoteKey: ev.mapNoteKey,
                        raw: ev.raw ? {
                            id: ev.raw.id,
                            kind: ev.raw.kind,
                            pubkey: ev.raw.pubkey,
                            content: ev.raw.content,
                            created_at: ev.raw.created_at,
                            tags: ev.raw.tags || []
                        } : {},
                        ...(ev.nip ? { nip: ev.nip } : {}),
                        ...(ev.relayScope ? { relayScope: ev.relayScope } : {})
                    }));
                    convArr.push({ type: c.type, id, members: c.members || [], events });
                }
                const cacheData = {
                    conversations: convArr,
                    pubkeyToUsername: Array.from(pubkeyToUsername.entries()),
                    pubkeyToNip05: Array.from(pubkeyToNip05.entries()),
                    pubkeyToPicture: Array.from(pubkeyToPicture.entries()),
                    deletedEventIds: Array.from(deletedEventIds),
                    eventAuthorById: Array.from(eventAuthorById.entries()),
                    timestamp: Date.now()
                };
                const key = chatCacheKvKey(currentPublicKey);
                await nrWebKvPut(key, cacheData);
                try {
                    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
                } catch (_) {}
            } catch (e) {
                if (e && e.name === 'QuotaExceededError') {
                    try {
                        await nrWebKvDelete(chatCacheKvKey(currentPublicKey));
                    } catch (_) {}
                }
            }
        }

        function mergeConversationOnLoad(targetId, type, members, events) {
            if (!targetId) return;
            const existing = conversations.get(targetId);
            if (!existing) {
                conversations.set(targetId, {
                    type,
                    id: targetId,
                    members: members || [],
                    events: Array.isArray(events) ? events.slice() : []
                });
                return;
            }
            const seen = new Set(existing.events.map((e) => e && e.id).filter(Boolean));
            for (const ev of events || []) {
                if (!ev || (ev.id && seen.has(ev.id))) continue;
                existing.events.push(ev);
                if (ev.id) seen.add(ev.id);
            }
            existing.events.sort((a, b) => (a?.created_at || 0) - (b?.created_at || 0));
            invalidateConversationSearchIndex(targetId);
        }

        async function loadChatFromCache() {
            if (!currentPublicKey) return false;
            try {
                const key = chatCacheKvKey(currentPublicKey);
                let data = await nrWebKvGet(key);
                if (data === undefined && typeof localStorage !== 'undefined') {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        try {
                            data = JSON.parse(raw);
                            await nrWebKvPut(key, data);
                        } catch (_) {
                            data = null;
                        }
                        try {
                            localStorage.removeItem(key);
                        } catch (_) {}
                    }
                }
                if (!data || typeof data !== 'object') return false;
                if (!data.timestamp || (Date.now() - data.timestamp > CHAT_CACHE_MAX_AGE)) return false;
                conversations.clear();
                conversationSearchIndex.clear();
                backgroundContentMatches.clear();
                const isBlocked = (NrBlocklist && NrBlocklist.isBlocked) ? (hex) => NrBlocklist.isBlocked(hex) : () => false;
                for (const c of data.conversations || []) {
                    const events = (c.events || [])
                        .filter((ev) => !isBlocked(ev.pubkey))
                        .map(ev => ({
                            id: ev.id,
                            kind: ev.kind,
                            pubkey: ev.pubkey,
                            content: ev.content ?? '',
                            created_at: ev.created_at,
                            mapNoteKey: ev.mapNoteKey,
                            raw: ev.raw && ev.raw.tags ? {
                                id: ev.raw.id,
                                kind: ev.raw.kind,
                                pubkey: ev.raw.pubkey,
                                content: ev.raw.content,
                                created_at: ev.raw.created_at,
                                tags: ev.raw.tags
                            } : {},
                            ...(ev.nip ? { nip: ev.nip } : {}),
                            ...(ev.relayScope ? { relayScope: ev.relayScope } : {})
                        }));
                    const normalizedConversationId = c.type === 'channel'
                        ? normalizeChannelSlug(String(c.id || ''))
                        : c.id;
                    const targetId = normalizedConversationId || c.id;
                    if (c.type === 'channel' && normalizedConversationId === 'global') {
                        // Migration: legacy caches mirrored all map notes into #global.
                        // Keep only events that explicitly include the global channel slug.
                        const explicitGlobalEvents = events.filter((ev) =>
                            getChannelSlugsFromEvent(ev.raw || {}).includes('global')
                        );
                        if (!explicitGlobalEvents.length) continue;
                        mergeConversationOnLoad(targetId, c.type, c.members, explicitGlobalEvents);
                        continue;
                    }
                    // Channels with hyphenated legacy ids (e.g. #beer-brewers) merge into the
                    // canonical Trustroots-circle slug (e.g. #beerbrewers); see normalizeChannelSlug.
                    mergeConversationOnLoad(targetId, c.type, c.members, events);
                }
                pubkeyToUsername.clear();
                for (const [k, v] of (data.pubkeyToUsername || [])) pubkeyToUsername.set(k, v);
                pubkeyToNip05.clear();
                for (const [k, v] of (data.pubkeyToNip05 || [])) pubkeyToNip05.set(k, v);
                pubkeyToPicture.clear();
                for (const [k, v] of (data.pubkeyToPicture || [])) pubkeyToPicture.set(k, v);
                if (currentPublicKey) currentUserNip05 = pubkeyToNip05.get(currentPublicKey) || '';
                deletedEventIds.clear();
                for (const id of (data.deletedEventIds || [])) deletedEventIds.add(id);
                eventAuthorById.clear();
                for (const [k, v] of (data.eventAuthorById || [])) eventAuthorById.set(k, v);
                return true;
            } catch (_) {
                return false;
            }
        }

        function scheduleChatCacheWrite() {
            if (chatCacheWriteTimeout) clearTimeout(chatCacheWriteTimeout);
            chatCacheWriteTimeout = setTimeout(() => {
                void saveChatToCache().finally(() => {
                    chatCacheWriteTimeout = null;
                });
            }, 2000);
        }

        function normalizeSearchQuery(value) {
            return String(value || '').trim().toLowerCase();
        }

        function normalizeSearchText(value) {
            return String(value || '').toLowerCase();
        }

        function invalidateConversationSearchIndex(conversationId) {
            if (!conversationId) return;
            conversationSearchIndex.delete(conversationId);
            if (backgroundContentMatches.delete(conversationId)) scheduleRender('convList');
            if (normalizeSearchQuery(conversationFilterQuery)) scheduleBackgroundContentSearch();
        }

        function getConversationContentSearchText(entry) {
            const id = String(entry?.id || '');
            if (!id) return '';
            if (conversationSearchIndex.has(id)) return conversationSearchIndex.get(id) || '';
            const events = Array.isArray(entry?.events) ? entry.events : [];
            const indexed = events
                .map((ev) => normalizeSearchText(ev?.content))
                .filter(Boolean)
                .join('\n');
            conversationSearchIndex.set(id, indexed);
            return indexed;
        }

        function runBackgroundContentSearch(token, query) {
            const normalizedQuery = normalizeSearchQuery(query);
            if (!normalizedQuery) {
                backgroundContentMatches = new Set();
                scheduleRender('convList');
                return;
            }
            const entries = Array.from(conversations.entries()).map(([id, c]) => ({ id, ...c }));
            const matches = new Set();
            let idx = 0;

            function step() {
                if (token !== backgroundSearchToken) return;
                const start = performance.now();
                while (idx < entries.length) {
                    const entry = entries[idx++];
                    if (conversationMatchesFast(entry, normalizedQuery)) continue;
                    if (getConversationContentSearchText(entry).includes(normalizedQuery)) matches.add(entry.id);
                    if (performance.now() - start >= 8) break;
                }
                if (idx < entries.length) {
                    requestAnimationFrame(step);
                    return;
                }
                if (token !== backgroundSearchToken) return;
                backgroundContentMatches = matches;
                scheduleRender('convList');
            }

            requestAnimationFrame(step);
        }

        function scheduleBackgroundContentSearch() {
            backgroundSearchToken += 1;
            const token = backgroundSearchToken;
            if (backgroundSearchScheduled) clearTimeout(backgroundSearchScheduled);
            const query = conversationFilterQuery;
            backgroundSearchScheduled = setTimeout(() => {
                backgroundSearchScheduled = null;
                runBackgroundContentSearch(token, query);
            }, 0);
        }

        function getHashRoute() {
            const h = location.hash.slice(1);
            if (!h) return '';
            try { return decodeURIComponent(h); } catch (_) { return h; }
        }
        function parseChatRouteWithNote(rawRoute) {
            const decoded = String(rawRoute || '').trim();
            if (!decoded) return { conversationRoute: '', noteId: '' };
            const queryIndex = decoded.indexOf('?');
            if (queryIndex < 0) return { conversationRoute: decoded, noteId: '' };
            const conversationRoute = decoded.slice(0, queryIndex).trim();
            const query = decoded.slice(queryIndex + 1);
            let noteId = '';
            try {
                const params = new URLSearchParams(query);
                noteId = String(params.get('note') || '').trim();
            } catch (_) {
                noteId = '';
            }
            return { conversationRoute, noteId };
        }
        function setChatRouteWithNote(conversationRoute, noteId) {
            const route = String(conversationRoute || '').trim();
            const note = String(noteId || '').trim();
            if (!route) {
                setHashRoute('');
                return;
            }
            const encodedRoute = hashEncodeSegment(route);
            const query = note ? `?note=${encodeURIComponent(note)}` : '';
            const nextHash = `#${encodedRoute}${query}`;
            if (location.hash !== nextHash) location.hash = nextHash;
        }
        function buildMessageDeepLinkHref(conversationId, eventId) {
            const route = String(getConversationRouteId(conversationId) || '').trim();
            if (!route) return '#';
            const encodedRoute = hashEncodeSegment(route);
            const note = String(eventId || '').trim();
            return `#${encodedRoute}${note ? `?note=${encodeURIComponent(note)}` : ''}`;
        }
        function openRawNoteModal(eventLike) {
            const modalTitle = document.getElementById('raw-note-modal-title');
            const pre = document.getElementById('raw-note-json');
            if (!pre) return;
            const payload = eventLike?.raw || eventLike || {};
            const json = JSON.stringify(payload, null, 2);
            pre.textContent = json || '{}';
            const eventId = String(payload?.id || eventLike?.id || '').trim();
            if (modalTitle) {
                modalTitle.textContent = eventId ? `Nostr note ${eventId.slice(0, 12)}…` : 'Nostr note';
            }
            modal('raw-note-modal').open();
        }
        function closeRawNoteModal() {
            modal('raw-note-modal').close();
        }
        async function copyRawNoteModalJson() {
            const pre = document.getElementById('raw-note-json');
            const json = pre?.textContent || '';
            if (!json) {
                showStatus('No note JSON to copy.', 'error');
                return;
            }
            const ok = await copyTextToClipboard(json);
            showStatus(ok ? 'Note JSON copied.' : 'Failed to copy note JSON.', ok ? 'success' : 'error');
        }
        function focusPendingDeepLinkedMessage(container) {
            const noteId = String(pendingDeepLinkNoteId || '').trim();
            if (!noteId || !container) return;
            pendingDeepLinkNoteId = '';
            const rows = Array.from(container.querySelectorAll('.message-row[data-event-id]'));
            const target = rows.find((row) => String(row.dataset.eventId || '') === noteId);
            if (!target) return;
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
            rows.forEach((row) => row.classList.remove('message-row-note-target'));
            target.classList.add('message-row-note-target');
            if (noteHighlightTimeout) clearTimeout(noteHighlightTimeout);
            noteHighlightTimeout = setTimeout(() => {
                target.classList.remove('message-row-note-target');
            }, 2200);
        }
        function getConversationRouteId(id) {
            if (!id) return '';
            const conv = conversations.get(id);
            if (!conv || conv.type !== 'dm') return id;
            const pubkeyId = normalizeCachedPubkeyHex(id);
            if (!pubkeyId) {
                const rawId = String(id || '').trim();
                return rawId.includes('@') ? rawId.toLowerCase() : '';
            }
            const display = (getDisplayName(id) || '').trim();
            if (display.includes('@')) return display.toLowerCase();
            return hexToNpub(id) || id;
        }
        function findConversationIdByRoute(route) {
            const r = (route || '').trim();
            if (!r) return '';
            const pubkeyRoute = parsePubkeyInput(r);
            if (pubkeyRoute) {
                if (conversations.has(pubkeyRoute)) return pubkeyRoute;
                return '';
            }
            if (conversations.has(r)) return r;
            const needle = r.toLowerCase();
            for (const [id, conv] of conversations.entries()) {
                if (conv.type !== 'dm') continue;
                if (id === r) return id;
                if (!normalizeCachedPubkeyHex(id)) continue;
                const display = (getDisplayName(id) || '').trim().toLowerCase();
                if (display && display === needle) return id;
                const npub = (hexToNpub(id) || '').trim().toLowerCase();
                if (npub && npub === needle) return id;
            }
            return '';
        }
        // setHashRoute lives at module scope; chat re-uses that.
        /** Keys/settings are handled by index unified router when embedded. */
        async function applyChatHashToState(routeForced, opts) {
            const o = opts || {};
            const routeInput = routeForced !== undefined && routeForced !== null ? String(routeForced) : getHashRoute();
            const parsedRoute = parseChatRouteWithNote(routeInput);
            const route = parsedRoute.conversationRoute;
            pendingDeepLinkNoteId = parsedRoute.noteId;
            const normalizedRoute = normalizeChannelSlug(route);
            const keysEl = document.getElementById('keys-modal');
            const settingsEl = document.getElementById('settings-modal');
            if (keysEl) keysEl.classList.remove('active');
            if (settingsEl) settingsEl.classList.remove('active');
            if (!route) {
                applyDocumentTitle('Chat');
                if (o.emptyPicker) {
                    trackNrWebSurfaceEvent('nr_chat_opened', 'chat:picker', {
                        chat_type: 'picker',
                        route_type: 'chat',
                        surface: 'chat',
                        ...getCurrentTrustrootsUsernameAnalyticsData(),
                    });
                    // Explicit #chat (index): show conversation list, not the previously open thread.
                    writePersistedSelectedChatId('');
                    selectedConversationId = null;
                    document.body.classList.remove('chat-open');
                    renderConvList();
                    renderThread();
                    const es = document.getElementById('empty-state');
                    if (es) es.style.display = 'flex';
                    const comp = document.getElementById('compose');
                    if (comp) comp.style.display = 'none';
                    const th = document.getElementById('thread-header');
                    if (th) th.style.display = 'none';
                    const tm = document.getElementById('thread-messages');
                    if (tm) tm.innerHTML = '';
                    return;
                }
                const firstConversationId = getFirstSidebarConversationId();
                if (firstConversationId) {
                    selectConversation(firstConversationId);
                }
                return;
            }
            const mappedConversationId = findConversationIdByRoute(route);
            if (mappedConversationId) {
                const preferredRoute = getConversationRouteId(mappedConversationId);
                if (preferredRoute && route !== preferredRoute) setChatRouteWithNote(preferredRoute, pendingDeepLinkNoteId);
                selectConversation(mappedConversationId, { skipHashUpdate: true });
                return;
            }
            const routeForDmResolve = (route || '').trim();
            if (routeForDmResolve.includes('@')) {
                const dmPubkey = await resolvePubkeyInput(routeForDmResolve);
                if (dmPubkey) {
                    getOrCreateConversation('dm', dmPubkey, [dmPubkey]);
                    const preferredDmRoute = getConversationRouteId(dmPubkey);
                    if (preferredDmRoute && route !== preferredDmRoute) setChatRouteWithNote(preferredDmRoute, pendingDeepLinkNoteId);
                    selectConversation(dmPubkey, { skipHashUpdate: true });
                    return;
                }
            }
            const routePubkey = parsePubkeyInput(routeForDmResolve);
            if (routePubkey) {
                getOrCreateConversation('dm', routePubkey, [routePubkey]);
                const preferredPubkeyRoute = getConversationRouteId(routePubkey);
                if (preferredPubkeyRoute && route !== preferredPubkeyRoute) setChatRouteWithNote(preferredPubkeyRoute, pendingDeepLinkNoteId);
                selectConversation(routePubkey, { skipHashUpdate: true });
                return;
            }
            if (normalizedRoute && route !== normalizedRoute) {
                setChatRouteWithNote(normalizedRoute, pendingDeepLinkNoteId);
            }
            if (normalizedRoute && conversations.has(normalizedRoute)) {
                selectConversation(normalizedRoute, { skipHashUpdate: true });
                return;
            }
            if (normalizedRoute && !conversations.has(normalizedRoute)) {
                if (isPlusCodeChannelId(normalizedRoute)) {
                    if (typeof window !== 'undefined' && typeof window.NrWebUnifiedNavigateToMapPlusCode === 'function') {
                        window.NrWebUnifiedNavigateToMapPlusCode(normalizedRoute);
                    } else {
                        location.hash = '#' + encodeURIComponent(normalizedRoute).replace(/%2B/g, '+');
                    }
                    return;
                }
                if (/^[a-zA-Z0-9_-]+$/.test(normalizedRoute) && normalizedRoute !== 'keys' && normalizedRoute !== 'settings') {
                    getOrCreateConversation('channel', normalizedRoute, []);
                    selectConversation(normalizedRoute, { skipHashUpdate: true });
                } else {
                    selectedConversationId = null;
                    document.body.classList.remove('chat-open');
                    renderConvList();
                    renderThread();
                    const es2 = document.getElementById('empty-state');
                    if (es2) es2.style.display = 'flex';
                    const comp2 = document.getElementById('compose');
                    if (comp2) comp2.style.display = 'none';
                    const th2 = document.getElementById('thread-header');
                    if (th2) th2.style.display = 'none';
                    const tm2 = document.getElementById('thread-messages');
                    if (tm2) tm2.innerHTML = '';
                }
                return;
            }
        }

        function isTrustrootsProfileMissingRelayError(errorStr) {
            const normalized = (errorStr || '').toLowerCase();
            return normalized.includes('restricted') && normalized.includes('no trustroots username profile event found');
        }

        /** User-facing text + optional actions for relay publish/delete failures. */
        function relayPublishFailureUserFeedback(failed, contextVerb) {
            const list = Array.isArray(failed) ? failed : [];
            const profileMissing = list.some((f) => isTrustrootsProfileMissingRelayError(f?.error));
            if (profileMissing) {
                return {
                    message:
                        "Relays didn't accept this because they don't see a Trustroots profile for your public key yet. Open Keys & profile to link your Trustroots username, then try again.",
                    actions: [{ label: 'Open Keys & profile', onClick: () => openKeysModal() }]
                };
            }
            const first = (list[0] && list[0].error) || 'Unknown relay error';
            const s = typeof first === 'string' ? first : String(first);
            const short = s.length > 200 ? s.slice(0, 197) + '…' : s;
            const verb = contextVerb === 'delete' ? "Couldn't delete" : "Couldn't send";
            return { message: `${verb}: ${short}`, actions: [] };
        }

        function formatSendCatchError(err) {
            const raw = (err && err.message) || err || '';
            const str = typeof raw === 'string' ? raw : String(raw);
            if (isTrustrootsProfileMissingRelayError(str)) {
                return relayPublishFailureUserFeedback([{ error: str }], 'send');
            }
            const short = str.length > 200 ? str.slice(0, 197) + '…' : str;
            return { message: `Send failed: ${short}`, actions: [] };
        }

        function showStatus(message, type, options) {
            options = options || {};
            const el = document.getElementById('nr-chat-status-container');
            if (!el) return;
            el.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = `status-toast ${type || 'info'}`;
            const msgEl = document.createElement('div');
            msgEl.className = 'status-toast-msg';
            msgEl.textContent = message;
            wrap.appendChild(msgEl);
            if (Array.isArray(options.actions) && options.actions.length > 0) {
                const row = document.createElement('div');
                row.className = 'status-toast-actions';
                options.actions.forEach((action) => {
                    if (!action || typeof action.label !== 'string' || typeof action.onClick !== 'function') return;
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.textContent = action.label;
                    btn.addEventListener('click', () => {
                        try {
                            action.onClick();
                        } catch (_) {}
                        el.innerHTML = '';
                    });
                    row.appendChild(btn);
                });
                if (row.childElementCount > 0) wrap.appendChild(row);
            }
            el.appendChild(wrap);
            const persistMs = options.persistMs != null ? options.persistMs : options.actions?.length ? 14000 : 4000;
            setTimeout(() => {
                if (el.contains(wrap)) el.innerHTML = '';
            }, persistMs);
        }

        function truncatePubkey(hex) {
            if (!hex || hex.length < 16) return hex || '';
            return hex.slice(0, 8) + '…' + hex.slice(-8);
        }

        /**
         * Resolve best profile picture for a DM identifier.
         * Conversation IDs are usually pubkeys, but legacy/cache entries may be NIP-05/usernames.
         */
        function getDmPictureByConversationId(id) {
            const raw = String(id || '').trim();
            if (!raw) return '';
            const direct = pubkeyToPicture.get(raw);
            if (direct && isSafeHttpUrl(direct)) return direct;
            const low = raw.toLowerCase();
            // Match by known NIP-05 mapping (pubkey -> nip05).
            for (const [pk, nip05] of pubkeyToNip05.entries()) {
                if (String(nip05 || '').trim().toLowerCase() !== low) continue;
                const pic = pubkeyToPicture.get(pk);
                if (pic && isSafeHttpUrl(pic)) return pic;
            }
            // Match by trustroots username mapping (pubkey -> username).
            const lowNoAt = low.startsWith('@') ? low.slice(1) : low;
            for (const [pk, username] of pubkeyToUsername.entries()) {
                const u = String(username || '').trim().toLowerCase();
                if (!u) continue;
                if (u === lowNoAt || `${u}@trustroots.org` === lowNoAt) {
                    const pic = pubkeyToPicture.get(pk);
                    if (pic && isSafeHttpUrl(pic)) return pic;
                }
            }
            return '';
        }

        function profileHrefFromId(id) {
            const raw = String(id || '').trim();
            if (!raw) return '';
            return buildProfileHashRoute(raw);
        }

        function setThreadTitleAsProfileLink(titleEl, profileId, label) {
            if (!titleEl) return;
            const href = profileHrefFromId(profileId);
            const text = String(label || '').trim();
            if (!href || !text) {
                titleEl.textContent = text;
                return;
            }
            titleEl.innerHTML = `<a href="${href}" class="message-inline-link nr-content-link">${escapeHtml(text)}</a>`;
        }

        // hexToNpub lives at module scope; chat re-uses that.

        function getDisplayNpub() {
            if (!currentPublicKey) return '';
            return hexToNpub(currentPublicKey) || '';
        }

        function parsePubkeyInput(input) {
            return parsePubkeyInputNormalized(input);
        }

        /** Resolve npub/hex synchronously, or NIP-05 (async) to hex. Returns Promise<hex|null>. */
        async function resolvePubkeyInput(raw) {
            const s = (raw || '').trim();
            if (!s) return null;
            if (s.includes('@')) return await resolveNip05(s);
            return parsePubkeyInput(s);
        }

        // Use shared key-utils from outer module scope (parseKeyImportToHex, getKeyImportErrorMessage).

        function hasLocalSigningKey() {
            return hasChatSigningKey();
        }

        function requireLocalSigningKey() {
            if (hasLocalSigningKey()) return true;
            throw new Error('No signing method connected. Import an nsec or use a supported browser extension.');
        }

        async function loadKeysFromStorage() {
            if (window.NrWebNip7?.isActive?.()) {
                currentPublicKey = window.NrWebNip7.pubkey;
                currentSecretKeyHex = null;
                currentSecretKeyBytes = null;
                const cachedUsername = getCachedValidatedTrustrootsUsername(currentPublicKey);
                if (cachedUsername) {
                    isProfileLinked = true;
                    usernameFromNostr = true;
                    pubkeyToUsername.set(currentPublicKey, cachedUsername);
                }
                await startSubscriptions();
                updateUI();
                return true;
            }
            const hex = readValidStoredKeyHex();
            if (!hex) return false;
            currentSecretKeyHex = hex;
            currentSecretKeyBytes = secretKeyBytesFromHex64(hex);
            currentPublicKey = getPublicKey(currentSecretKeyBytes);
            const cachedUsername = getCachedValidatedTrustrootsUsername(currentPublicKey);
            if (cachedUsername) {
                isProfileLinked = true;
                usernameFromNostr = true;
                pubkeyToUsername.set(currentPublicKey, cachedUsername);
            }
            await startSubscriptions();
            updateUI();
            return true;
        }

        function savePrivateKey(hex) {
            window.NrWebNip7?.useLocal?.();
            writeStoredKeyHex(hex);
            currentSecretKeyHex = hex;
            currentSecretKeyBytes = secretKeyBytesFromHex64(hex);
            currentPublicKey = getPublicKey(currentSecretKeyBytes);
        }

        async function onboardingNip7Connect() {
            try {
                const pubkey = await window.NrWebNip7.connect();
                currentPublicKey = pubkey;
                currentSecretKeyHex = null;
                currentSecretKeyBytes = null;
                isProfileLinked = false;
                usernameFromNostr = false;
                currentUserNip05 = '';
                appendKeysLinkLog(`Connected NIP-07 extension ${getDisplayNpub() || currentPublicKey}`);
                await startSubscriptions();
                updateUI();
                openKeysModal();
                trackNrWebEvent('nr_nip7_connected', {
                    key_method: 'nip7',
                    signer: 'nip7',
                    status: 'success',
                    ...getCurrentTrustrootsUsernameAnalyticsData(),
                });
                showStatus('Browser extension connected.', 'success');
            } catch (e) {
                appendKeysLinkLog(`NIP-07 connect failed: ${e?.message || e}`);
                showStatus(e?.message || 'Could not connect browser extension.', 'error');
                updateKeyDisplay({ skipProfileLookup: true });
            }
        }

        function importKey() {
            const raw = (document.getElementById('nsec-import') || document.getElementById('onboarding-import'))?.value?.trim() || '';
            appendKeysLinkLog('Import key');
            const parsed = parseKeyImportToHex(raw);
            if (!parsed.ok) {
                const message = getKeyImportErrorMessage(raw);
                appendKeysLinkLog(`Import failed: ${message}`);
                showStatus(message, 'error');
                return;
            }
            savePrivateKey(parsed.hex);
            appendKeysLinkLog(`Import parsed successfully. Public key: ${getDisplayNpub() || currentPublicKey}`);
            const nsecImport = document.getElementById('nsec-import');
            const onboardingImport = document.getElementById('onboarding-import');
            if (nsecImport) nsecImport.value = '';
            if (onboardingImport) onboardingImport.value = '';
            closeKeysModal();
            void (async () => {
                await loadKeysFromStorage();
                appendKeysLinkLog('Import complete');
                showStatus('Key imported. Shared with map app.', 'success');
                trackNrWebEvent('nr_key_imported', {
                    key_method: raw.includes(' ') ? 'mnemonic' : 'nsec',
                    signer: 'local',
                    status: 'success',
                    ...getCurrentTrustrootsUsernameAnalyticsData(),
                });
                openKeysModal();
            })();
        }

        function disconnect() {
            const selChatKey = getSelectedChatStorageKey();
            currentPublicKey = null;
            currentSecretKeyHex = null;
            currentSecretKeyBytes = null;
            isProfileLinked = false;
            usernameFromNostr = false;
            currentUserNip05 = '';
            setTrustrootsUI('');
            if (typeof window.NrWebTheme !== 'undefined') {
                window.NrWebTheme.registerThemePublish(null);
            }
            clearStoredKey();
            if (selChatKey) {
                try {
                    localStorage.removeItem(selChatKey);
                } catch (_) {}
            }
            conversations.clear();
            selectedConversationId = null;
            if (pool) {
                pool.close();
                pool = null;
            }
            closePublicMapRelayConnections();
            updateUI();
            renderConvList();
            showThreadEmpty();
        }

        function applyChatNavAccountAvatar() {
            try {
                if (!window.NrWeb || typeof window.NrWeb.updateNrNavAccountAvatars !== 'function') return;
                let pic = '';
                if (currentPublicKey) {
                    pic =
                        pubkeyToPicture.get(currentPublicKey) ||
                        pubkeyToPicture.get(String(currentPublicKey).toLowerCase()) ||
                        window.NrWeb.getRememberedNrNavAccountAvatar?.(currentPublicKey) ||
                        '';
                    if (pic && !isSafeHttpUrl(pic)) pic = '';
                }
                if (pic) window.NrWeb.rememberNrNavAccountAvatar?.(currentPublicKey, pic);
                window.NrWeb.updateNrNavAccountAvatars(pic);
            } catch (_) {}
        }

        function setHeaderIdentity() {
            const el = document.getElementById('header-identity');
            const elM = document.getElementById('header-identity-mobile');
            const btn = document.getElementById('keys-icon-btn');
            const btnM = document.getElementById('keys-icon-btn-mobile');
            if (!el) {
                applyChatNavAccountAvatar();
                return;
            }
            const hasKey = !!currentPublicKey;
            const nip5 = currentUserNip05 || (currentPublicKey ? pubkeyToNip05.get(currentPublicKey) : '');
            const trUsername = currentPublicKey ? pubkeyToUsername.get(currentPublicKey) : null;
            const npubStr = getDisplayNpub() || (currentPublicKey ? hexToNpub(currentPublicKey) : '');
            function applyTo(node) {
                if (!node) return;
                if (!hasKey) {
                    node.textContent = '';
                    node.title = '';
                    node.classList.add('empty');
                    node.classList.remove('nip5');
                    return;
                }
                node.classList.remove('empty');
                if (nip5) {
                    node.textContent = nip5;
                    node.title = nip5 + (npubStr ? '\n' + npubStr : '');
                    node.classList.add('nip5');
                } else if (trUsername) {
                    node.textContent = trUsername + '@trustroots.org';
                    node.title = trUsername + '@trustroots.org\n' + (npubStr || '');
                    node.classList.remove('nip5');
                } else {
                    node.textContent = npubStr ? (npubStr.slice(0, 12) + '…' + npubStr.slice(-8)) : '';
                    node.title = npubStr || '';
                    node.classList.remove('nip5');
                }
            }
            if (!hasKey) {
                applyTo(el);
                applyTo(elM);
                if (btn) btn.classList.remove('has-identity');
                if (btnM) btnM.classList.remove('has-identity');
                applyChatNavAccountAvatar();
                return;
            }
            if (btn) btn.classList.add('has-identity');
            if (btnM) btnM.classList.add('has-identity');
            applyTo(el);
            applyTo(elM);
            applyChatNavAccountAvatar();
        }

        function updateUI() {
            const hasKey = !!currentPublicKey;
            setHeaderIdentity();
            const keysBtn = document.getElementById('keys-icon-btn');
            if (keysBtn) keysBtn.title = hasKey ? 'Keys' : 'Connect key to post';
            if (document.getElementById('keys-modal')) {
                updateKeyDisplay();
            }
            if (hasKey) {
                renderRelaysList();
                renderConvList();
            }
        }

        function openKeysModal() {
            const nip7Active =
                !!window.NrWebNip7?.isActive?.() ||
                (() => {
                    try {
                        return localStorage.getItem('nr_web_signer_mode') === 'nip7' && (window.NrWebNip7?.getCapabilities?.().isFull === true);
                    } catch (_) {
                        return false;
                    }
                })();
            if (nip7Active && !currentPublicKey && window.NrWebNip7?.pubkey) {
                currentPublicKey = window.NrWebNip7.pubkey;
            }
            _openKeysModalShared({
                hasKey: !!(currentPublicKey || currentSecretKeyHex || nip7Active),
                onOpenManagedSection: () => {
                    updateKeyDisplay({ skipProfileLookup: true });
                    checkProfileLinked();
                },
            });
            trackNrWebSurfaceEvent('nr_keys_opened', 'chat:keys', {
                route_type: 'keys',
                surface: 'keys',
                source: 'chat',
                signer: getChatSignerAnalyticsType(),
                ...getCurrentTrustrootsUsernameAnalyticsData(),
            });
        }
        function closeKeysModal() {
            _closeKeysModalShared({ fallbackRoute: getConversationRouteId(selectedConversationId) });
        }

        function openSettingsModal() {
            trackNrWebSurfaceEvent('nr_settings_relays_opened', 'chat:settings', {
                route_type: 'settings_relays',
                surface: 'settings',
                source: 'chat',
                ...getCurrentTrustrootsUsernameAnalyticsData(),
            });
            _openSettingsModalShared({ extraSetup: () => renderRelaysList() });
        }
        function closeSettingsModal() {
            _closeSettingsModalShared({ fallbackRoute: getConversationRouteId(selectedConversationId) });
        }

        function updateKeyDisplay(options = {}) {
            const keysModal = window.NrWebKeysModal;
            let npub = '';
            let npubError = '';
            const keySource = keysModal?.getKeySourceForPubkey?.(currentPublicKey) || '';
            const showChecklist = keySource === 'generated';
            const isNsecBackedUp = keysModal?.isKeyBackedUpForPubkey?.(currentPublicKey) === true;
            const nip7Caps = window.NrWebNip7?.getCapabilities?.() || { status: 'none' };
            const signerMode = isNip7ChatActive() ? 'nip7' : 'local';
            if (currentPublicKey) {
                npub = getCurrentNpub();
                if (!npub) npubError = 'Error encoding npub';
            }
            if (keysModal?.updateKeyDisplay) {
                keysModal.updateKeyDisplay({
                    hasNsec: !!currentSecretKeyHex,
                    hasPublicKey: !!currentPublicKey,
                    npub,
                    npubError,
                    isProfileLinked,
                    isUsernameLinked: usernameFromNostr,
                    showChecklist,
                    isNsecBackedUp,
                    signerMode,
                    nip7Status: nip7Caps.status,
                    signerStatusText: signerMode === 'nip7'
                        ? 'Using NIP-07 browser extension.'
                        : nip7Caps.status === 'full'
                            ? 'NIP-07 browser extension support detected.'
                            : nip7Caps.status === 'partial'
                                ? 'NIP-07 extension detected, but encrypted messaging support is incomplete.'
                                : 'No NIP-07 browser extension detected. Compatible extensions include Alby and nos2x.'
                });
            }
            if (currentPublicKey && options.skipProfileLookup !== true) checkProfileLinked();
            setHeaderIdentity();
        }

        function renderSettingsNotificationsSection() { /* no-op on chat */ }

        function onboardingImport() {
            const input = document.getElementById('onboarding-import');
            const raw = (input?.value || '').trim();
            appendKeysLinkLog('Import key from onboarding field');
            const parsed = parseKeyImportToHex(raw);
            if (!parsed.ok) {
                const message = getKeyImportErrorMessage(raw);
                appendKeysLinkLog(`Import failed: ${message}`);
                showStatus(message, 'error');
                return;
            }
            savePrivateKey(parsed.hex);
            appendKeysLinkLog(`Import parsed successfully. Public key: ${getDisplayNpub() || currentPublicKey}`);
            if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
                window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'imported');
                window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, true);
            }
            if (input) input.value = '';
            void (async () => {
                await loadKeysFromStorage();
                appendKeysLinkLog('Import complete');
                trackNrWebEvent('nr_key_imported', {
                    key_method: raw.includes(' ') ? 'mnemonic' : 'nsec',
                    signer: 'local',
                    status: 'success',
                    ...getCurrentTrustrootsUsernameAnalyticsData(),
                });
                openKeysModal();
            })();
            showStatus('Key imported successfully. Your key stays on this device and is never stored on our server.', 'success');
        }
        function onboardingGenerate() {
            generateKeyPair();
            openKeysModal();
        }
        function importNsec() {
            const el = document.getElementById('nsec-import');
            const raw = (el?.value || '').trim();
            appendKeysLinkLog('Import key from nsec field');
            const parsed = parseKeyImportToHex(raw);
            if (!parsed.ok) {
                const message = getKeyImportErrorMessage(raw);
                appendKeysLinkLog(`Import failed: ${message}`);
                showStatus(message, 'error');
                return;
            }
            savePrivateKey(parsed.hex);
            appendKeysLinkLog(`Import parsed successfully. Public key: ${getDisplayNpub() || currentPublicKey}`);
            if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
                window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'imported');
                window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, true);
            }
            if (el) el.value = '';
            void (async () => {
                await loadKeysFromStorage();
                appendKeysLinkLog('Import complete');
                updateKeyDisplay();
                trackNrWebEvent('nr_key_imported', {
                    key_method: raw.includes(' ') ? 'mnemonic' : 'nsec',
                    signer: 'local',
                    status: 'success',
                    ...getCurrentTrustrootsUsernameAnalyticsData(),
                });
                openKeysModal();
            })();
            showStatus('Key imported successfully. Your key stays on this device and is never stored on our server.', 'success');
        }
        function generateKeyPair() {
            const privateKeyHex = bytesToHex(generateSecretKey());
            savePrivateKey(privateKeyHex);
            if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
                window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'generated');
                window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, false);
            }
            appendKeysLinkLog(`Generated new key ${getDisplayNpub() || currentPublicKey || ''}`.trim());
            void (async () => {
                await loadKeysFromStorage();
            })();
            trackNrWebEvent('nr_key_created', {
                key_method: 'generated',
                signer: 'local',
                status: 'success',
                ...getCurrentTrustrootsUsernameAnalyticsData(),
            });
            showStatus('New key pair generated!', 'success');
        }
        function exportNsec() {
            if (!currentSecretKeyHex) {
                showStatus('No private key to export', 'error');
                return;
            }
            try {
                const nsec = nsecEncodeFromHex64(currentSecretKeyHex);
                navigator.clipboard.writeText(nsec).then(() => {
                    window.NrWebKeysModal?.setKeyBackedUpForPubkey?.(currentPublicKey, true);
                    updateKeyDisplay({ skipProfileLookup: true });
                    showStatus('nsec copied to clipboard!', 'success');
                }).catch(() => {
                    prompt('Your nsec (copy this):', nsec);
                    window.NrWebKeysModal?.setKeyBackedUpForPubkey?.(currentPublicKey, true);
                    updateKeyDisplay({ skipProfileLookup: true });
                    showStatus('nsec displayed', 'info');
                });
            } catch (e) {
                showStatus('Error exporting nsec: ' + (e && e.message), 'error');
            }
        }
        function deleteNsec() {
            if (!confirm('Remove your key from this device? You will need to import or create a key again before you can post.')) return;
            const deletedPubkey = currentPublicKey;
            disconnect();
            window.NrWebKeysModal?.clearKeySourceForPubkey?.(deletedPubkey);
            window.NrWebKeysModal?.clearKeyBackedUpForPubkey?.(deletedPubkey);
            updateKeyDisplay();
            openKeysModal();
            showStatus('Key removed from this device.', 'success');
        }

        async function disconnectNip7() {
            const previousPubkey = currentPublicKey;
            window.NrWebNip7?.useLocal?.();
            currentPublicKey = null;
            currentSecretKeyHex = null;
            currentSecretKeyBytes = null;
            isProfileLinked = false;
            usernameFromNostr = false;
            currentUserNip05 = '';
            setTrustrootsUI('');
            if (typeof window.NrWebTheme !== 'undefined') {
                window.NrWebTheme.registerThemePublish(null);
            }
            if (pool) {
                try { pool.close(); } catch (_) {}
                pool = null;
            }
            closePublicMapRelayConnections();
            const restoredLocalKey = await loadKeysFromStorage();
            if (!restoredLocalKey) {
                const selChatKey = previousPubkey ? 'nostroots_selected_chat_' + previousPubkey : '';
                if (selChatKey) {
                    try { localStorage.removeItem(selChatKey); } catch (_) {}
                }
                conversations.clear();
                selectedConversationId = null;
                updateUI();
                renderConvList();
                showThreadEmpty();
            }
            appendKeysLinkLog('Disconnected NIP-07 browser extension mode');
            updateKeyDisplay({ skipProfileLookup: true });
            openKeysModal();
            showStatus('Browser extension disconnected.', 'info');
        }

        function copyPublicKey() {
            const npubEl = document.getElementById('npub-display');
            const copyBtn = document.getElementById('copy-npub-btn');
            const copyText = document.getElementById('copy-npub-text');
            if (!npubEl || !npubEl.value) {
                showStatus('No public key to copy', 'error');
                return;
            }
            navigator.clipboard.writeText(npubEl.value).then(() => {
                const original = copyText ? copyText.textContent : '📋';
                if (copyText) copyText.textContent = '✓';
                if (copyBtn) copyBtn.classList.add('copied');
                showStatus('Public address copied.', 'success');
                setTimeout(() => {
                    if (copyText) copyText.textContent = original;
                    if (copyBtn) copyBtn.classList.remove('copied');
                }, 2000);
            }).catch(() => showStatus('Failed to copy', 'error'));
        }

        function openNewDmModal() {
            clearNewDmFeedback();
            modal('new-dm-modal').open();
            const input = document.getElementById('new-dm-pubkey');
            if (input) input.focus();
        }
        function closeNewDmModal() { modal('new-dm-modal').close(); }

        function clearNewDmFeedback() {
            const el = document.getElementById('new-dm-feedback');
            if (!el) return;
            el.textContent = '';
            el.className = 'form-feedback';
        }

        function setNewDmFeedback(message, options = {}) {
            const el = document.getElementById('new-dm-feedback');
            if (!el) return;
            el.textContent = '';
            el.className = `form-feedback ${options.type || 'error'}`.trim();
            const text = document.createElement('div');
            text.textContent = message;
            el.appendChild(text);
            if (options.actionHref && options.actionLabel) {
                const a = document.createElement('a');
                a.className = 'nr-content-link form-feedback-action';
                a.href = options.actionHref;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = options.actionLabel;
                el.appendChild(a);
            }
        }
        function openNewGroupModal() {
            groupModalMembers = [];
            renderGroupModalMembers();
            document.getElementById('new-group-one-pubkey').value = '';
            modal('new-group-modal').open();
        }
        function closeNewGroupModal() { modal('new-group-modal').close(); }

        function renderGroupModalMembers() {
            const list = document.getElementById('new-group-members-list');
            const startBtn = document.getElementById('new-group-start-btn');
            if (!list) return;
            list.textContent = '';
            groupModalMembers.forEach(({ hex, label }) => {
                const chip = document.createElement('span');
                chip.className = 'participant-chip';
                const span = document.createElement('span');
                span.className = 'label';
                span.title = label;
                span.textContent = label;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'remove-btn';
                btn.setAttribute('aria-label', 'Remove');
                btn.textContent = '×';
                btn.onclick = () => removeGroupModalMember(hex);
                chip.appendChild(span);
                chip.appendChild(btn);
                list.appendChild(chip);
            });
            if (startBtn) startBtn.disabled = groupModalMembers.length === 0;
        }

        function removeGroupModalMember(hex) {
            groupModalMembers = groupModalMembers.filter(m => m.hex !== hex);
            renderGroupModalMembers();
        }

        async function addGroupParticipant() {
            const input = document.getElementById('new-group-one-pubkey');
            const raw = (input?.value || '').trim();
            if (!raw) {
                showStatus('Enter npub, nip5 or hashtag (e.g. nostroots@trustroots.org).', 'error');
                return;
            }
            const hex = await resolvePubkeyInput(raw);
            if (!hex) {
                showStatus('Could not resolve: invalid or nip5 not found.', 'error');
                return;
            }
            if (hex === currentPublicKey) {
                showStatus('You are already in the group.', 'error');
                return;
            }
            if (groupModalMembers.some(m => m.hex === hex)) {
                showStatus('Already added.', 'error');
                return;
            }
            groupModalMembers.push({ hex, label: raw });
            renderGroupModalMembers();
            input.value = '';
            showStatus('Added: ' + raw, 'success');
        }
        function getOrCreateConversation(type, id, members) {
            if (type === 'channel') {
                const normalizedId = normalizeChannelSlug(id);
                if (normalizedId && normalizedId !== id) {
                    const legacyConv = conversations.get(id);
                    const canonicalConv = conversations.get(normalizedId);
                    if (legacyConv && !canonicalConv) {
                        legacyConv.id = normalizedId;
                        conversations.set(normalizedId, legacyConv);
                        conversations.delete(id);
                    }
                }
                id = normalizedId;
            }
            let c = conversations.get(id);
            if (!c) {
                c = { type, id, members: members || [], events: [] };
                conversations.set(id, c);
                invalidateConversationSearchIndex(id);
                if (getHashRoute() === id) selectConversation(id);
            }
            return c;
        }

        function getConversationKey(theirPubkey) {
            if (isNip7ChatActive()) return null;
            if (!currentSecretKeyBytes) return null;
            try {
                const key = nip44.getConversationKey(currentSecretKeyBytes, theirPubkey);
                return key;
            } catch (_) {}
            return null;
        }

        /** Encrypt DM content for a peer. Prefers NIP-44 (then NIP-04 fallback). Returns { cipher, nip } or null. */
        async function encryptKind4(peerPubkey, plaintext) {
            if (isNip7ChatActive()) {
                try {
                    const cipher = await nip7ChatEncrypt(peerPubkey, plaintext);
                    return { cipher, nip: 'nip44' };
                } catch (_) {
                    return null;
                }
            }
            if (!currentSecretKeyBytes) return null;
            const key = getConversationKey(peerPubkey);
            if (key) {
                try {
                    const cipher = nip44.v2.encrypt(plaintext, key);
                    return { cipher, nip: 'nip44' };
                } catch (_) {}
            }
            try {
                const cipher = nip04.encrypt(currentSecretKeyBytes, peerPubkey, plaintext);
                return { cipher, nip: 'nip4' };
            } catch (_) {}
            return null;
        }

        function looksLikeNip04(content) {
            return typeof content === 'string' && content.includes('?iv=');
        }

        async function decryptPendingForConversation(conv) {
            if (!conv || !conv._pendingEncrypted || !conv._pendingEncrypted.length) return;
            if (conv._decryptingPending) return;
            conv._decryptingPending = true;
            try {
                while (conv._pendingEncrypted.length) {
                    const event = conv._pendingEncrypted.shift();
                    if (conv.events.some(e => e.id === event.id)) continue;
                    const other = event.tags.find(t => t[0] === 'p')?.[1];
                    const peer = other && other !== currentPublicKey ? other : event.pubkey;
                    const authorPubkey = event.pubkey === currentPublicKey ? peer : event.pubkey;
                    let plain = await decryptKind4(event.content, authorPubkey);
                    if (plain == null) plain = '[could not decrypt]';
                    eventAuthorById.set(event.id, event.pubkey);
                    const dmNip = looksLikeNip04(event.content) ? 'nip4' : 'nip44';
                    conv.events.push({ id: event.id, pubkey: event.pubkey, content: plain, created_at: event.created_at, raw: event, nip: dmNip });
                    conv.events.sort((a, b) => a.created_at - b.created_at);
                    invalidateConversationSearchIndex(conv.id);
                    scheduleChatCacheWrite();
                    if (selectedConversationId === conv.id) scheduleRender('thread');
                }
                scheduleRender('convList');
            } finally {
                conv._decryptingPending = false;
            }
        }

        async function decryptKind4(content, authorPubkey) {
            if (isNip7ChatActive()) {
                try {
                    if (!looksLikeNip04(content)) return await nip7ChatDecrypt(authorPubkey, content);
                } catch (_) {}
                try {
                    return await window.NrWebNip7.nip04Decrypt(authorPubkey, content);
                } catch (_) {}
                return null;
            }
            if (!currentSecretKeyBytes) return null;
            const isNip04Content = looksLikeNip04(content);
            if (!isNip04Content) {
                const key = getConversationKey(authorPubkey);
                if (key) {
                    try {
                        return nip44.v2.decrypt(content, key);
                    } catch (_) {}
                }
            }
            try {
                return nip04.decrypt(currentSecretKeyBytes, authorPubkey, content);
            } catch (_) {}
            return null;
        }

        function setupChatNrWebThemeSync() {
            const NT = window.NrWebTheme;
            if (!NT || !currentPublicKey || !pool || (!currentSecretKeyBytes && !isNip7ChatActive())) return;
            NT.registerThemePublish(async (theme) => {
                try {
                    let tpl = null;
                    if (isNip7ChatActive()) {
                        if (theme !== 'light' && theme !== 'dark') return;
                        tpl = {
                            kind: NT.NRWEB_THEME_KIND,
                            created_at: Math.floor(Date.now() / 1000),
                            tags: [['d', NT.NRWEB_THEME_D_TAG], ['client', 'nr-web']],
                            content: await nip7ChatEncrypt(currentPublicKey, JSON.stringify({ theme }))
                        };
                    } else {
                        tpl = NT.createThemeEventTemplate(theme, nip44, currentSecretKeyBytes, currentPublicKey);
                    }
                    if (!tpl) return;
                    const signed = await signEvent(tpl);
                    const relayList = Array.isArray(relays) && relays.length ? relays : DEFAULT_RELAYS;
                    await publishEventWithRelayAcks(relayList, signed);
                } catch (_) {}
            });
            const relayList = (Array.isArray(relays) && relays.length ? relays : DEFAULT_RELAYS)
                .filter((url) => !isRestrictedRelayUrl(url));
            if (!relayList.length) return;
            const filter = {
                kinds: [NT.NRWEB_THEME_KIND],
                authors: [currentPublicKey],
                '#d': [NT.NRWEB_THEME_D_TAG],
                limit: 10
            };
            let best = null;
            const sub = pool.subscribe(relayList, filter, {
                onevent: (ev) => {
                    if (!best || ev.created_at > best.created_at) best = ev;
                },
                oneose: async () => {
                    try { sub.close(); } catch (_) {}
                    if (best) {
                        let parsed = null;
                        if (isNip7ChatActive()) {
                            try {
                                const plain = await nip7ChatDecrypt(currentPublicKey, best.content);
                                const data = JSON.parse(plain);
                                if (data.theme === 'light' || data.theme === 'dark') parsed = { theme: data.theme, created_at: best.created_at || 0 };
                            } catch (_) {}
                        } else {
                            parsed = NT.parseThemeFromKind78Event(best, nip44, currentSecretKeyBytes, currentPublicKey);
                        }
                        if (parsed) NT.mergeThemeFromRemote(parsed);
                    }
                }
            });
            setTimeout(() => {
                try { sub.close(); } catch (_) {}
            }, 8000);
        }

        let publicSubsStarted = false;
        let publicMapRelayConnections = [];

        function closePublicMapRelayConnections() {
            publicMapRelayConnections.forEach((conn) => {
                try { conn?.close?.(); } catch (_) {}
            });
            publicMapRelayConnections = [];
        }

        async function buildAuthEventForRelay(relayUrl, challenge) {
            const resolvedChallenge = extractNip42Challenge(challenge);
            if (!resolvedChallenge) throw new Error('Missing NIP-42 challenge');
            let relayTag = (relayUrl || '').trim();
            try {
                const parsed = new URL(relayTag);
                if ((parsed.pathname === '' || parsed.pathname === '/') && !parsed.search && !parsed.hash) {
                    relayTag = `${parsed.protocol}//${parsed.host}`;
                } else {
                    relayTag = parsed.toString();
                }
            } catch (_) {}
            const authTemplate = {
                kind: NIP42_AUTH_KIND,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['relay', relayTag],
                    ['challenge', resolvedChallenge]
                ],
                content: ''
            };
            const signedAuth = await signEvent(authTemplate);
            if (!signedAuth || !signedAuth.id) throw new Error('Invalid signed AUTH event');
            return signedAuth;
        }

        async function publishEventToRelayViaWebSocket(relayUrl, signedEvent) {
            return await new Promise((resolve) => {
                let settled = false;
                let ws = null;
                let authEventId = null;
                let authCompleted = false;
                let authChallengeSeen = false;
                let eventRejectedForAuth = false;
                let eventSent = false;
                let delayedSendTimer = null;
                const finish = (result) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    if (delayedSendTimer) clearTimeout(delayedSendTimer);
                    try { ws?.close(); } catch (_) {}
                    resolve(result);
                };
                const sendEvent = () => {
                    if (!ws || ws.readyState !== WebSocket.OPEN) return;
                    eventSent = true;
                    ws.send(JSON.stringify(['EVENT', signedEvent]));
                };
                const timeoutId = setTimeout(() => {
                    finish({ success: false, url: relayUrl, error: 'timeout waiting for relay OK' });
                }, RELAY_PUBLISH_TIMEOUT_MS);

                try {
                    ws = new WebSocket(relayUrl);
                } catch (error) {
                    finish({ success: false, url: relayUrl, error: error?.message || String(error) });
                    return;
                }

                ws.addEventListener('open', () => {
                    // Give relays that require NIP-42 a brief moment to issue AUTH before EVENT.
                    delayedSendTimer = setTimeout(() => {
                        if (!authChallengeSeen && !eventSent) sendEvent();
                    }, 120);
                });

                ws.addEventListener('message', async (msg) => {
                    let data;
                    try {
                        data = JSON.parse(msg.data);
                    } catch (_) {
                        return;
                    }
                    const [type, a, b, c] = data;

                    if (type === 'AUTH') {
                        authChallengeSeen = true;
                        if (delayedSendTimer) {
                            clearTimeout(delayedSendTimer);
                            delayedSendTimer = null;
                        }
                        try {
                            const relayTagUrl = ws?.url || relayUrl;
                            const signedAuth = await buildAuthEventForRelay(relayTagUrl, a);
                            authEventId = signedAuth.id;
                            ws.send(JSON.stringify(['AUTH', signedAuth]));
                        } catch (error) {
                            finish({ success: false, url: relayUrl, error: error?.message || String(error) });
                        }
                        return;
                    }

                    if (type === 'OK' && a === signedEvent.id) {
                        if (b === true) {
                            finish({ success: true, url: relayUrl });
                        } else {
                            const reason = (c || '').toString();
                            if (reason.toLowerCase().includes('auth-required') && !authCompleted) {
                                eventRejectedForAuth = true;
                                return;
                            }
                            finish({ success: false, url: relayUrl, error: reason || 'relay rejected event' });
                        }
                        return;
                    }

                    if (type === 'OK' && authEventId && a === authEventId) {
                        if (b === true) {
                            authCompleted = true;
                            if (!eventSent || eventRejectedForAuth) {
                                eventRejectedForAuth = false;
                                sendEvent();
                            }
                        } else {
                            finish({ success: false, url: relayUrl, error: (c || '').toString() || 'relay rejected auth event' });
                        }
                    }
                });

                ws.addEventListener('error', () => {
                    finish({ success: false, url: relayUrl, error: 'websocket error' });
                });

                ws.addEventListener('close', () => {
                    if (!settled) finish({ success: false, url: relayUrl, error: 'connection closed before relay OK' });
                });
            });
        }

        async function publishEventWithRelayAcks(relayUrls, signedEvent) {
            const urls = Array.isArray(relayUrls) ? relayUrls : [];
            const results = await Promise.all(urls.map((url) => publishEventToRelayViaWebSocket(url, signedEvent)));
            const succeeded = results.filter((res) => res.success);
            const failed = results.filter((res) => !res.success);
            return { succeeded, failed };
        }

        function startWsMapSubscription(relayUrl, onChannelEvent) {
            const relayAuth = globalThis.NrWebRelayAuth;
            if (isRestrictedRelayUrl(relayUrl) && relayAuth?.startNip42WsSubscription && currentPublicKey) {
                return relayAuth.startNip42WsSubscription({
                    relayUrl,
                    filter: buildLimitedMapNoteFilter(),
                    authPubkey: currentPublicKey,
                    signEvent: (template) => signEvent(template),
                    onEvent: (event) => {
                        if (event && (event.kind === MAP_NOTE_KIND || event.kind === MAP_NOTE_REPOST_KIND)) {
                            onChannelEvent(event);
                        }
                    },
                    onAuthChallenge: () => {},
                    onAuthSuccess: () => {},
                    onAuthFail: () => {}
                });
            }
            const ws = new WebSocket(relayUrl);
            const subId = `chat-map-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
            const sendReq = () => {
                const filter = buildLimitedMapNoteFilter();
                ws.send(JSON.stringify(['REQ', subId, filter]));
            };

            ws.addEventListener('open', () => {
                sendReq();
            });

            ws.addEventListener('message', async (msg) => {
                let data;
                try {
                    data = JSON.parse(msg.data);
                } catch (_) {
                    return;
                }
                const [type, a, b] = data;
                if (type === 'AUTH') {
                    try {
                        const signedAuth = await buildAuthEventForRelay(relayUrl, a);
                        ws.send(JSON.stringify(['AUTH', signedAuth]));
                        sendReq();
                    } catch (error) {
                        console.error(`[Chat Relay] NIP-42 auth failed for ${relayUrl}:`, error?.message || error);
                    }
                    return;
                }
                if (type === 'EVENT') {
                    const event = b;
                    if (event && (event.kind === MAP_NOTE_KIND || event.kind === MAP_NOTE_REPOST_KIND)) {
                        onChannelEvent(event);
                    }
                    return;
                }
            });

            ws.addEventListener('error', () => {});

            return {
                close: () => {
                    try { ws.close(); } catch (_) {}
                }
            };
        }

        function startPublicSubscriptions() {
            relayUrlsForList = getRelayUrls();
            relays = relayUrlsForList.length ? relayUrlsForList : DEFAULT_RELAYS;
            const publicRelays = relays.filter((url) => !isRestrictedRelayUrl(url));
            initializeRelaySettingsState(relays, 'connecting');
            renderRelaysList();
            if (!pool) pool = new SimplePool();

            renderConvList();
            if (!getHashRoute()) {
                const firstConversationId = getFirstSidebarConversationId();
                if (firstConversationId) selectConversation(firstConversationId);
            }

            function onChannelEvent(event) {
                const slugs = getChannelSlugsFromEvent(event);
                const mapNoteKey = getMapNoteCanonicalKey(event);

                const blocklistAuthor = getMapNoteOriginalAuthorPubkey(event) || event.pubkey;
                if (NrBlocklist && NrBlocklist.isBlocked(blocklistAuthor)) return;

                let changed = false;
                slugs.forEach((targetSlug) => {
                    const conv = getOrCreateConversation('channel', targetSlug, []);
                    const existing = conv.events.some(e => e.id === event.id || (mapNoteKey && e.mapNoteKey === mapNoteKey));
                    if (existing) return;
                    eventAuthorById.set(event.id, event.pubkey);
	                    conv.events.push({
	                        id: event.id,
	                        kind: event.kind,
	                        pubkey: event.pubkey,
                        content: event.content || '',
                        created_at: event.created_at,
                        raw: event,
                        mapNoteKey
                    });
	                    conv.events.sort((a, b) => a.created_at - b.created_at);
	                    invalidateConversationSearchIndex(conv.id);
	                    changed = true;
	                    if (upsertCircleMemberForSlugFromClaimEvent(event, targetSlug) && selectedConversationId === targetSlug) {
	                        renderCircleMembersPanel(conv);
	                    }
	                    if (selectedConversationId === targetSlug) scheduleRender('thread');
	                });

                if (changed) {
                    scheduleChatCacheWrite();
                    scheduleRender('convList');
                }
            }

            if (publicRelays.length) {
                pool.subscribe(publicRelays, buildLimitedMapNoteFilter({ '#L': [TRUSTROOTS_CIRCLE_LABEL] }), { onevent: onChannelEvent });
                pool.subscribe(publicRelays, buildLimitedMapNoteFilter({ '#t': HOSTING_OFFER_CHANNEL_ALIASES }), { onevent: onChannelEvent });
                pool.subscribe(publicRelays, buildLimitedMapNoteFilter(), { onevent: onChannelEvent });
            }

            closePublicMapRelayConnections();
            relays.forEach((url) => {
                try {
                    const connection = startWsMapSubscription(url, onChannelEvent);
                    publicMapRelayConnections.push(connection);
                } catch (error) {
                    console.error(`[Chat Relay] failed to connect ${url}:`, error?.message || error);
                }
            });

            if (publicRelays.length) {
                pool.subscribe(publicRelays, { kinds: [5], limit: 500 }, { onevent(event) {
                    (event.tags || []).filter(t => t[0] === 'e' && t[1]).forEach(t => {
                        const eid = t[1];
                        if (eventAuthorById.get(eid) === event.pubkey) deletedEventIds.add(eid);
                    });
                    scheduleChatCacheWrite();
                    scheduleRender('both');
                } });

                pool.subscribe(publicRelays, { kinds: [TRUSTROOTS_PROFILE_KIND] }, { onevent: handleKind10390ForProfile });
                pool.subscribe(publicRelays, { kinds: [0] }, { onevent: handleKind0ForProfile });
                pool.subscribe(publicRelays, { kinds: [PROFILE_CLAIM_KIND], limit: 1000 }, { onevent: handleKind30390ForProfile });
                pool.subscribe(
                    publicRelays,
                    {
                        kinds: [TRUSTROOTS_CIRCLE_MEMBERSHIP_KIND],
                        authors: [currentPublicKey],
                        '#d': [TRUSTROOTS_CIRCLE_MEMBERSHIP_D_TAG],
                        limit: 20
                    },
                    { onevent: handleCurrentUserCircleMembershipEvent }
                );
            }

            // Also fetch profile-shaped events from the NIP-42 auth relay; SimplePool above
            // is unauthenticated and won't receive them when restricted relays gate by AUTH.
            startAuthRelayProfileFetch();

            if (TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX) {
                if (publicRelays.length) {
                    pool.subscribe(
                        publicRelays,
                        {
                            kinds: [TRUSTROOTS_CIRCLE_META_KIND],
                            authors: [TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX],
                            limit: 5000
                        },
                        {
                            onevent(event) {
                                if (NrBlocklist && NrBlocklist.isBlocked(event.pubkey)) return;
                                const changed = mergeCircleMetadataMapEntry(circleMetaBySlug, event, {
                                    expectedPubkey: TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX,
                                    kind: TRUSTROOTS_CIRCLE_META_KIND
                                });
                                if (!changed) return;
                                scheduleRender('convList');
                                const sel = selectedConversationId ? conversations.get(selectedConversationId) : null;
                                if (sel && isTrustrootsCircleConversation(sel)) {
                                    syncThreadHeaderForConversation(sel);
                                    scheduleRender('thread');
                                }
                            }
                        }
                    );
                }
            }

            relays.forEach((url) => {
                updateRelayStatus(url, 'connected', relayWriteEnabled.get(url) !== false);
            });
            renderRelaysList();
            publicSubsStarted = true;
        }

        async function startSubscriptions() {
            relayUrlsForList = getRelayUrls();
            relays = relayUrlsForList.length ? relayUrlsForList : DEFAULT_RELAYS;
            const relayList = Array.isArray(relays) && relays.length ? relays : DEFAULT_RELAYS;
            const publicRelayList = relayList.filter((url) => !isRestrictedRelayUrl(url));
            if (!currentPublicKey || !relayList.length) return;

            // Restore NIP-04 (DM) and channel conversations from cache so UI shows immediately while relays stream
            if (await loadChatFromCache()) {
                setHeaderIdentity();
                renderConvList();
                if (selectedConversationId) renderThread();
            }

            if (!publicSubsStarted) {
                if (pool) try { pool.close(); } catch (_) {}
                pool = new SimplePool();
                startPublicSubscriptions();
            } else {
                try { if (pool) pool.close(); } catch (_) {}
                closePublicMapRelayConnections();
                pool = new SimplePool();
                startPublicSubscriptions();
            }

            const onDmEvent = async (event) => {
                if (NrBlocklist && NrBlocklist.isBlocked(event.pubkey)) return;
                const other = event.tags.find(t => t[0] === 'p')?.[1];
                const peer = other && other !== currentPublicKey ? other : event.pubkey;
                if (NrBlocklist && NrBlocklist.isBlocked(peer)) return;
                const convId = peer;
                const conv = getOrCreateConversation('dm', convId, [peer]);
                if (conv.events.some(e => e.id === event.id)) return;

                const authorPubkey = event.pubkey === currentPublicKey ? peer : event.pubkey;
                let plain = await decryptKind4(event.content, authorPubkey);
                if (plain == null) plain = '[could not decrypt]';
                eventAuthorById.set(event.id, event.pubkey);
                const dmNip = looksLikeNip04(event.content) ? 'nip4' : 'nip44';
                conv.events.push({ id: event.id, pubkey: event.pubkey, content: plain, created_at: event.created_at, raw: event, nip: dmNip });
                conv.events.sort((a, b) => a.created_at - b.created_at);
                invalidateConversationSearchIndex(conv.id);
                scheduleChatCacheWrite();
                scheduleRender('convList');
                if (selectedConversationId === convId) scheduleRender('thread');
            };
            if (!publicRelayList.length) return;

            pool.subscribe(publicRelayList, { kinds: [4], '#p': [currentPublicKey] }, { onevent: onDmEvent });
            pool.subscribe(publicRelayList, { kinds: [4], authors: [currentPublicKey] }, { onevent: onDmEvent });

            pool.subscribe(publicRelayList, { kinds: [1059], '#p': [currentPublicKey] }, { onevent(wrapEvent) {
                if (!currentSecretKeyBytes && !isNip7ChatActive()) return;
                void (async () => {
                try {
                    const wrapPubkey = wrapEvent.pubkey;
                    const innerJson = isNip7ChatActive()
                        ? await nip7ChatDecrypt(wrapPubkey, wrapEvent.content)
                        : nip44.v2.decrypt(wrapEvent.content, nip44.getConversationKey(currentSecretKeyBytes, wrapPubkey));
                    const seal = JSON.parse(innerJson);
                    if (seal.kind !== 13) return;
                    if (NrBlocklist && NrBlocklist.isBlocked(wrapPubkey)) return;
                    const rumorJson = isNip7ChatActive()
                        ? await nip7ChatDecrypt(seal.pubkey, seal.content)
                        : nip44.v2.decrypt(seal.content, nip44.getConversationKey(currentSecretKeyBytes, seal.pubkey));
                    const rumor = JSON.parse(rumorJson);
                    if (rumor.kind !== 14) return;
                    if (rumor.pubkey !== seal.pubkey) return;
                    if (NrBlocklist && NrBlocklist.isBlocked(rumor.pubkey)) return;
                    const pTags = (rumor.tags || []).filter(t => t[0] === 'p').map(t => t[1]);
                    const members = [rumor.pubkey, ...pTags].filter((x, i, a) => a.indexOf(x) === i).sort();
                    const groupId = members.join(',');
                    const conv = getOrCreateConversation('group', groupId, members);
                    const existing = conv.events.some(e => e.id === rumor.id);
                    if (!existing) {
                        eventAuthorById.set(rumor.id, rumor.pubkey);
                        conv.events.push({ id: rumor.id, pubkey: rumor.pubkey, content: rumor.content || '', created_at: rumor.created_at, raw: rumor, nip: 'nip17' });
                        conv.events.sort((a, b) => a.created_at - b.created_at);
                        invalidateConversationSearchIndex(conv.id);
                        scheduleChatCacheWrite();
                        scheduleRender('convList');
                        if (selectedConversationId === groupId) scheduleRender('thread');
                    }
                } catch (_) {}
                })();
            } });
            setupChatNrWebThemeSync();
        }

        // getTrustrootsUsernameFromProfileEvent lives at module scope; chat re-uses that.

        function getTrustrootsUsernameFromKind0(event) {
            if (event.kind !== 0 || !event.content) return undefined;
            try {
                const profile = JSON.parse(event.content);
                const nip05 = (profile.nip05 || '').trim().toLowerCase();
                if (!nip05) return undefined;
                // trustroots.org or www.trustroots.org
                if (nip05.endsWith('@trustroots.org') || nip05.endsWith('@www.trustroots.org')) {
                    const local = nip05.split('@')[0];
                    return local || undefined;
                }
                return undefined;
            } catch (_) {
                return undefined;
            }
        }

        function handleKind10390ForProfile(event) {
            const username = getTrustrootsUsernameFromProfileEvent(event);
            if (username) {
                pubkeyToUsername.set(event.pubkey, username);
                scheduleChatCacheWrite();
                scheduleRender('both');
            }
        }

        function handleKind0ForProfile(event) {
            const username = getTrustrootsUsernameFromKind0(event);
            if (username && !pubkeyToUsername.has(event.pubkey)) {
                pubkeyToUsername.set(event.pubkey, username);
                scheduleChatCacheWrite();
                scheduleRender('both');
            }
            if (!event.content) return;
            try {
                const profile = JSON.parse(event.content);
                const nip05 = (profile.nip05 || '').trim();
                const picture = String(profile.picture || '').trim();
                if (nip05) {
                    pubkeyToNip05.set(event.pubkey, nip05);
                    if (event.pubkey === currentPublicKey) {
                        currentUserNip05 = nip05;
                        updateAuthNip05Display();
                    }
                    scheduleChatCacheWrite();
                    scheduleRender('both');
                }
                if (picture && isSafeHttpUrl(picture)) {
                    pubkeyToPicture.set(event.pubkey, picture);
                    window.NrWeb?.rememberNrNavAccountAvatar?.(event.pubkey, picture);
                    scheduleChatCacheWrite();
                    scheduleRender('both');
                    if (event.pubkey === currentPublicKey) applyChatNavAccountAvatar();
                    const selDm = selectedConversationId ? conversations.get(selectedConversationId) : null;
                    if (selDm && selDm.type === 'dm' && selDm.id === event.pubkey) {
                        syncThreadHeaderForConversation(selDm);
                    }
                }
            } catch (_) {}
        }

        function handleKind30390ForProfile(event) {
            const changedMembers = upsertCircleMemberFromClaimEvent(event);
            const info = getProfileClaim30390PictureTarget(event);
            if (!info) {
                if (changedMembers) {
                    const selected = selectedConversationId ? conversations.get(selectedConversationId) : null;
                    scheduleRender('convList');
                    renderCircleMembersPanel(selected);
                }
                return;
            }
            pubkeyToPicture.set(info.targetPubkey, info.picture);
            window.NrWeb?.rememberNrNavAccountAvatar?.(info.targetPubkey, info.picture);
            if (info.nip05 && isTrustrootsNip05Lower(info.nip05)) {
                pubkeyToNip05.set(info.targetPubkey, info.nip05);
            }
            if (info.trustrootsUsername && !pubkeyToUsername.has(info.targetPubkey)) {
                pubkeyToUsername.set(info.targetPubkey, info.trustrootsUsername);
            }
            scheduleChatCacheWrite();
            scheduleRender('both');
            if (info.targetPubkey === currentPublicKey) applyChatNavAccountAvatar();
            const selDm = selectedConversationId ? conversations.get(selectedConversationId) : null;
            if (selDm && selDm.type === 'dm' && selDm.id === info.targetPubkey) {
                syncThreadHeaderForConversation(selDm);
            }
            if (changedMembers) {
                scheduleRender('convList');
                renderCircleMembersPanel(selDm);
            }
        }

        /**
         * After public SimplePool subscriptions start, also pull kind 0 / 30390 / 10390 from the
         * NIP-42 restricted relay using the same signer as map note auth. Without this the chat
         * UI would never receive Trustroots-imported profile pictures because they only live on
         * the auth-required relay.
         */
        let _nrChatAuthProfileSub = null;
        function startAuthRelayProfileFetch() {
            try { _nrChatAuthProfileSub?.close?.(); } catch (_) {}
            _nrChatAuthProfileSub = null;
            const relayAuth = globalThis.NrWebRelayAuth;
            if (!relayAuth?.startNip42WsSubscription || !currentPublicKey || !hasChatSigningKey()) return;
            const restrictedUrl = (relays || []).find(isRestrictedRelayUrl)
                || 'wss://nip42.trustroots.org';
            try {
                _nrChatAuthProfileSub = relayAuth.startNip42WsSubscription({
                    relayUrl: restrictedUrl,
                    filter: [
                        { kinds: [0, TRUSTROOTS_PROFILE_KIND, PROFILE_CLAIM_KIND], limit: 5000 },
                        {
                            kinds: [TRUSTROOTS_CIRCLE_MEMBERSHIP_KIND],
                            authors: [currentPublicKey],
                            '#d': [TRUSTROOTS_CIRCLE_MEMBERSHIP_D_TAG],
                            limit: 20,
                        },
                    ],
                    authPubkey: currentPublicKey,
                    signEvent: (template) => signEvent(template),
                    onEvent: (event) => {
                        if (!event || NrBlocklist?.isBlocked?.(event.pubkey)) return;
                        if (event.kind === 0) handleKind0ForProfile(event);
                        else if (event.kind === TRUSTROOTS_PROFILE_KIND) handleKind10390ForProfile(event);
                        else if (event.kind === PROFILE_CLAIM_KIND) handleKind30390ForProfile(event);
                        else if (event.kind === TRUSTROOTS_CIRCLE_MEMBERSHIP_KIND) handleCurrentUserCircleMembershipEvent(event);
                    }
                });
            } catch (e) {
                console.warn('[chat] auth-relay profile fetch failed:', e?.message || e);
            }
        }

        function isRestrictedRelayUrl(url) {
            return isTrustrootsAuthRelayUrl(url);
        }

        /**
         * Kind 30390 profile claim may target a user via `p` tag, or be self-authored without `p`.
         * Return normalized target pubkey + picture/nip05/username if picture is usable.
         */
        function getProfileClaim30390PictureTarget(event) {
            if (!event || event.kind !== PROFILE_CLAIM_KIND || !event.content) return null;
            let profile = null;
            try {
                profile = JSON.parse(event.content);
            } catch (_) {
                return null;
            }
            const picture = String(profile?.picture || '').trim();
            if (!picture || !isSafeHttpUrl(picture)) return null;
            const pTag = (event.tags || []).find((t) => Array.isArray(t) && t[0] === 'p' && t[1]);
            const byTag = String(pTag?.[1] || '').trim().toLowerCase();
            const byAuthor = String(event.pubkey || '').trim().toLowerCase();
            const targetPubkey = /^[0-9a-f]{64}$/.test(byTag)
                ? byTag
                : /^[0-9a-f]{64}$/.test(byAuthor)
                    ? byAuthor
                    : '';
            if (!targetPubkey) return null;
            return {
                targetPubkey,
                picture,
                nip05: String(profile?.nip05 || '').trim().toLowerCase(),
                trustrootsUsername: String(profile?.trustrootsUsername || '').trim().toLowerCase(),
            };
        }

        async function checkProfileLinked() {
            if (chatProfileCheckInFlight) return await chatProfileCheckInFlight;
            const now = Date.now();
            if (now - chatProfileCheckLastRunAt < PROFILE_LINK_CHECK_COOLDOWN_MS) {
                appendKeysLinkLog('Skipping duplicate chat profile check (cooldown active)');
                return;
            }
            chatProfileCheckInFlight = checkProfileLinkedCore()
                .finally(() => {
                    chatProfileCheckLastRunAt = Date.now();
                    chatProfileCheckInFlight = null;
                });
            return await chatProfileCheckInFlight;
        }

        async function checkProfileLinkedCore() {
            if (!currentPublicKey) {
                appendKeysLinkLog('Profile check skipped: no public key loaded');
                isProfileLinked = false;
                usernameFromNostr = false;
                setTrustrootsUI('');
                updateKeyDisplay({ skipProfileLookup: true });
                return;
            }
            const identityOk = await ensureNip7IdentityIsCurrent('chat profile check');
            if (!identityOk) return;
            const cachedUsername = getCachedValidatedTrustrootsUsername(currentPublicKey);
            if (cachedUsername) {
                appendKeysLinkLog(`Using cached Trustroots username "${cachedUsername}" for this key`);
                isProfileLinked = true;
                usernameFromNostr = true;
                pubkeyToUsername.set(currentPublicKey, cachedUsername);
                setTrustrootsUI(cachedUsername);
                updateKeyDisplay({ skipProfileLookup: true });
                return;
            }
            const r = (relays?.length ? relays : (getRelayUrls().length ? getRelayUrls() : DEFAULT_RELAYS))
                .filter((url) => !isRestrictedRelayUrl(url));
            if (!r.length) {
                appendKeysLinkLog('Profile check skipped: no public relays available in chat');
                setTrustrootsUI('');
                updateKeyDisplay({ skipProfileLookup: true });
                return;
            }
            appendKeysLinkLog(`Checking Trustroots profile on ${r.length} public relay${r.length === 1 ? '' : 's'}`);
            if (!pool) pool = new SimplePool();
            let linkedUsername = null;
            const done = { done: false };
            const unsub = pool.subscribe(r, { kinds: [TRUSTROOTS_PROFILE_KIND], authors: [currentPublicKey], limit: 1 }, { onevent(event) {
                if (done.done) return;
                done.done = true;
                const u = getTrustrootsUsernameFromProfileEvent(event);
                if (u) {
                    linkedUsername = u;
                    appendKeysLinkLog(`Found Trustroots username "${linkedUsername}" in Nostr profile`);
                }
            } });
            await new Promise(r => setTimeout(r, 2500));
            try { if (typeof unsub === 'function') unsub(); else if (unsub?.close) unsub.close(); } catch (_) {}
            if (linkedUsername) {
                try {
                    appendKeysLinkLog(`Validate ${linkedUsername}@trustroots.org via NIP-05`);
                    const res = await fetch(`https://www.trustroots.org/.well-known/nostr.json?name=${encodeURIComponent(linkedUsername)}`);
                    const data = await res.json();
                    if (data.names && data.names[linkedUsername]) {
                        const nip5Hex = (data.names[linkedUsername] + '').toLowerCase();
                        if (nip5Hex !== currentPublicKey.toLowerCase()) {
                            appendKeysLinkLog(`Username ${linkedUsername} from Nostr does not match NIP-05 verification. Clearing.`);
                            linkedUsername = null;
                        } else {
                            appendKeysLinkLog(`NIP-05 validated: ${linkedUsername}@trustroots.org matches this key`);
                        }
                    } else {
                        appendKeysLinkLog(`Username ${linkedUsername} from Nostr has no valid NIP-05. Clearing.`);
                        linkedUsername = null;
                    }
                } catch (error) {
                    appendKeysLinkLog(`Error validating username ${linkedUsername} from Nostr: ${error?.message || error}`);
                    linkedUsername = null;
                }
            } else {
                appendKeysLinkLog('No linked Trustroots profile event found on public chat relays');
            }
            isProfileLinked = !!linkedUsername;
            usernameFromNostr = !!linkedUsername;
            if (linkedUsername) {
                pubkeyToUsername.set(currentPublicKey, linkedUsername);
                setCachedValidatedTrustrootsUsername(currentPublicKey, linkedUsername);
            } else {
                clearCachedValidatedTrustrootsUsername(currentPublicKey);
            }
            setTrustrootsUI(linkedUsername || '');
            updateKeyDisplay({ skipProfileLookup: true });
        }

        function setTrustrootsUI(username) {
            const usernameInput = document.getElementById('trustroots-username');
            const usernameIndicator = document.getElementById('username-nostr-indicator');
            const updateBtn = document.getElementById('auth-update-trustroots-btn');
            const updateWrap = document.getElementById('auth-update-trustroots-wrap');
            if (usernameInput) {
                usernameInput.value = username;
                usernameInput.disabled = !!username;
            }
            if (usernameIndicator) usernameIndicator.style.display = username ? 'block' : 'none';
            if (updateBtn) updateBtn.style.display = username ? 'none' : 'block';
            if (updateWrap) updateWrap.style.display = username ? 'none' : 'block';
        }

        async function linkTrustrootsProfile() {
            const username = document.getElementById('trustroots-username')?.value?.trim() || '';
            appendKeysLinkLog(`Start link for username "${username || '<empty>'}"`);
            if (!username) { showStatus('Please enter a username.', 'error'); return; }
            if (!currentPublicKey) { showStatus('Please connect a key first.', 'error'); return; }
            try {
                const res = await fetch(`https://www.trustroots.org/.well-known/nostr.json?name=${encodeURIComponent(username)}`);
                const data = await res.json();
                if (!data.names || !data.names[username]) {
                    showStatus('Username not found or not linked on Trustroots.', 'error');
                    return;
                }
                const nip5Hex = (data.names[username] + '').toLowerCase();
                if (nip5Hex !== currentPublicKey.toLowerCase()) {
                    showStatus('That username is linked to a different key on Trustroots.', 'error');
                    return;
                }
                appendKeysLinkLog(`NIP-05 lookup ok: ${username}@trustroots.org -> ${nip5Hex}`);
                const eventTemplate = {
                    kind: TRUSTROOTS_PROFILE_KIND,
                    tags: [
                        ['L', TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
                        ['l', username, TRUSTROOTS_USERNAME_LABEL_NAMESPACE]
                    ],
                    content: '',
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: currentPublicKey
                };
                const signedEvent = await signEvent(eventTemplate);
                const r = getPublishRelayUrls();
                appendKeysLinkLog(`Writable relays (${r.length}): ${r.join(', ')}`);
                if (!r.length) {
                    trackNrWebEvent('nr_profile_linked', {
                        failed_count: 0,
                        relay_count: 0,
                        signer: getChatSignerAnalyticsType(),
                        status: 'no_relays',
                        ...getCurrentTrustrootsUsernameAnalyticsData(username),
                    });
                    showStatus('Turn on posting in Settings before linking your profile.', 'error');
                    return;
                }
                const kind0Template = {
                    kind: 0,
                    tags: [],
                    content: JSON.stringify({
                        trustrootsUsername: username,
                        nip05: `${username}@trustroots.org`,
                    }),
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: currentPublicKey
                };
                const signedKind0Event = await signEvent(kind0Template);
                const kind0Publish = await publishEventWithRelayAcks(r, signedKind0Event);
                kind0Publish.succeeded.forEach((entry) => appendKeysLinkLog(`kind0 OK ${entry.url}`));
                kind0Publish.failed.forEach((entry) => appendKeysLinkLog(`kind0 FAIL ${entry.url}${entry.error ? ` :: ${entry.error}` : ''}`));
                if (kind0Publish.succeeded.length === 0) {
                    trackNrWebEvent('nr_profile_linked', {
                        failed_count: kind0Publish.failed.length,
                        relay_count: r.length,
                        signer: getChatSignerAnalyticsType(),
                        status: 'failed',
                        ...getCurrentTrustrootsUsernameAnalyticsData(username),
                    });
                    showStatus('Profile validated but bootstrap kind 0 failed on all relays.', 'error');
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 700));
                const profilePublish = await publishEventWithRelayAcks(r, signedEvent);
                profilePublish.succeeded.forEach((entry) => appendKeysLinkLog(`kind10390 OK ${entry.url}`));
                profilePublish.failed.forEach((entry) => appendKeysLinkLog(`kind10390 FAIL ${entry.url}${entry.error ? ` :: ${entry.error}` : ''}`));
                const authRelayNormalized = normalizeRelayUrlForKeysLog(TRUSTROOTS_RESTRICTED_RELAY_URL);
                const authRelayAttempted = r.some((u) => normalizeRelayUrlForKeysLog(u) === authRelayNormalized);
                const authRelayKind0Ok = kind0Publish.succeeded.some((entry) => normalizeRelayUrlForKeysLog(entry.url) === authRelayNormalized);
                const authRelayKind10390Ok = profilePublish.succeeded.some((entry) => normalizeRelayUrlForKeysLog(entry.url) === authRelayNormalized);
                if (authRelayAttempted && (!authRelayKind0Ok || !authRelayKind10390Ok)) {
                    appendKeysLinkLog(`Auth relay check failed: kind0=${authRelayKind0Ok} kind10390=${authRelayKind10390Ok}`);
                    trackNrWebEvent('nr_profile_linked', {
                        failed_count: profilePublish.failed.length,
                        relay_count: r.length,
                        signer: getChatSignerAnalyticsType(),
                        status: 'failed',
                        ...getCurrentTrustrootsUsernameAnalyticsData(username),
                    });
                    showStatus('Profile validated, but auth relay publish did not complete. Check relay settings and retry.', 'error');
                    return;
                }
                if (profilePublish.succeeded.length === 0) {
                    trackNrWebEvent('nr_profile_linked', {
                        failed_count: profilePublish.failed.length,
                        relay_count: r.length,
                        signer: getChatSignerAnalyticsType(),
                        status: 'failed',
                        ...getCurrentTrustrootsUsernameAnalyticsData(username),
                    });
                    showStatus('Profile validated but kind 10390 failed on all relays.', 'error');
                    return;
                }
                isProfileLinked = true;
                usernameFromNostr = true;
                setTrustrootsUI(username);
                updateKeyDisplay({ skipProfileLookup: true });
                pubkeyToUsername.set(currentPublicKey, username);
                setCachedValidatedTrustrootsUsername(currentPublicKey, username);
                scheduleChatCacheWrite();
                appendKeysLinkLog('Link flow success');
                trackNrWebEvent('nr_profile_linked', {
                    failed_count: profilePublish.failed.length,
                    relay_count: r.length,
                    signer: getChatSignerAnalyticsType(),
                    status: profilePublish.failed.length > 0 ? 'partial' : 'success',
                    ...getCurrentTrustrootsUsernameAnalyticsData(username),
                });
                const backupHint = isNip7ChatActive()
                    ? ''
                    : ' Back up your nsec in your password manager before relying on this identity.';
                showStatus(`Profile linked. You can now explore the app.${backupHint}`, 'success');
            } catch (e) {
                appendKeysLinkLog(`Exception: ${e?.message || e}`);
                showStatus(e?.message || 'Failed to link profile.', 'error');
            }
        }

        async function updateTrustrootsProfile() {
            if (!currentPublicKey) { showStatus('No key connected.', 'error'); return; }
            const npub = getDisplayNpub() || getCurrentNpub();
            await navigator.clipboard.writeText(npub);
            alert('Your public address was copied. Paste it into the Nostr field on Trustroots.');
            window.open('https://www.trustroots.org/profile/edit/networks', '_blank');
        }

        function renderRelaysList() {
            const urls = getRelayUrls();
            const list = document.getElementById('relays-list');
            if (!list) return;
            renderRelayPostWarning(list, urls);
            if (relaySettings?.renderRelaysList) {
                relaySettings.renderRelaysList(list, {
                    urls,
                    statusMap: relayStatus,
                    relayWriteEnabledMap: relayWriteEnabled,
                    allowPostToggle: true,
                    allowRemove: true,
                    removeHandlerName: 'removeRelay',
                    toggleHandlerName: 'toggleRelayWriteForEncodedUrl',
                    removeButtonLabel: 'DELETE',
                    emptyMessage: 'No relays configured',
                    showLocalPrivacyHint: true
                });
                return;
            }
        }

        function addRelay() {
            let url = document.getElementById('new-relay-url')?.value?.trim() || '';
            if (!url) { showStatus('Enter a relay URL.', 'error'); return; }
            if (relaySettings?.normalizeRelayUrlInput) {
                const normalized = relaySettings.normalizeRelayUrlInput(url, 'ws');
                if (!normalized.ok) {
                    showStatus('Relay URL must start with ws:// or wss://', 'error');
                    return;
                }
                url = normalized.value;
            } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
                url = 'ws://' + url;
            }
            const urls = getRelayUrls();
            if (urls.includes(url)) { showStatus('Already added.', 'error'); return; }
            urls.push(url);
            saveRelayUrls(urls);
            relayWriteEnabled.set(url, true);
            updateRelayStatus(url, 'connecting', true);
            saveRelayWritePreferences();
            document.getElementById('new-relay-url').value = '';
            renderRelaysList();
            if (currentPublicKey) {
                relayUrlsForList = urls;
                relays = urls;
                void startSubscriptions();
            }
            trackNrWebEvent('nr_relays_saved', {
                relay_count: urls.length,
                source: 'add',
                status: 'success',
                surface: 'settings',
                ...getCurrentTrustrootsUsernameAnalyticsData(),
            });
            showStatus('Relay added.', 'success');
        }

        function removeRelay(url) {
            const urls = getRelayUrls().filter(u => u !== url);
            saveRelayUrls(urls);
            relayWriteEnabled.delete(url);
            relayStatus.delete(url);
            saveRelayWritePreferences();
            renderRelaysList();
            if (currentPublicKey) {
                relayUrlsForList = urls;
                relays = urls.length ? urls : DEFAULT_RELAYS;
                void startSubscriptions();
            }
            trackNrWebEvent('nr_relays_saved', {
                relay_count: urls.length,
                source: 'remove',
                status: 'success',
                surface: 'settings',
                ...getCurrentTrustrootsUsernameAnalyticsData(),
            });
            showStatus('Relay removed.', 'success');
        }

        function convSortKey(c) {
            const last = c.events[c.events.length - 1];
            return last ? last.created_at : 0;
        }

        const ENC_LOCK = '🔒';
        const ENC_GLOBE = '🌐';
        const RELAY_SCOPE_AUTH = '🔐';
        const RELAY_SCOPE_PUBLIC = '🌍';

        function getRelayScopeForDisplay(eventLike, conversation) {
            if (eventLike?.relayScope === 'public' || eventLike?.relayScope === 'auth') {
                return eventLike.relayScope;
            }
            // No metadata: do not guess "public" (NIP-42-only traffic was incorrectly shown as 🌍).
            return null;
        }

        function getChannelTagsSummary(events) {
            const seen = new Set();
            const parts = [];
            for (const ev of events) {
                const raw = ev.raw || ev;
                const tags = raw.tags || [];
                for (const t of tags) {
                    if (t.length < 2) continue;
                    const key = (t[0] || '').toLowerCase();
                    const val = t[1] || '';
                    const label = t[2] || '';
                    const token = label ? `${key}:${val} (${label})` : `${key}:${val}`;
                    if (token && !seen.has(token)) {
                        seen.add(token);
                        parts.push(label || val || key);
                    }
                }
            }
            return parts.slice(0, 8).join(', ');
        }

        let _renderRafId = null;
        let _renderDirty = { convList: false, thread: false };
        function scheduleRender(what) {
            if (what === 'convList' || what === 'both') _renderDirty.convList = true;
            if (what === 'thread' || what === 'both') _renderDirty.thread = true;
            if (_renderRafId) return;
            _renderRafId = requestAnimationFrame(() => {
                _renderRafId = null;
                const d = _renderDirty;
                _renderDirty = { convList: false, thread: false };
                if (d.convList) renderConvList();
                if (d.thread) renderThread();
            });
        }

        function getConversationLabel(entry) {
            const id = String(entry.id || '');
            if (entry.type === 'channel') {
                if (isTrustrootsCircleConversation(entry)) {
                    return '#' + id;
                }
                return id;
            }
            if (entry.type === 'group') return `Group (${entry.members?.length || 0})`;
            return getDisplayNameShort(id) || getDisplayName(id) || hexToNpub(id) || id;
        }

        /** Sidebar rail icon (matches thread header: globe vs lock vs channel marker). */
        function getConversationListEncIcon(entry) {
            const id = String(entry.id || '');
            const type = entry.type;
            if (type === 'dm' || type === 'group') return ENC_LOCK;
            if (type === 'channel') {
                if (isTrustrootsCircleConversation(entry)) return '∞';
                return '#';
            }
            return ENC_GLOBE;
        }

        function renderConvList() {
            const list = document.getElementById('conv-list');
            if (!list) return;
            list.innerHTML = '';
            function escConvHtml(s) {
                return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            }
            const ordered = getOrderedSidebarConversationEntries();
            const query = normalizeSearchQuery(conversationFilterQuery);
            const filtered = query ? ordered.filter((entry) => conversationMatchesFilter(entry, query)) : ordered;
            filtered.forEach(({ id, type, members, events }) => {
                const entry = { id, type, members, events };
                const label = getConversationLabel(entry);
                const item = document.createElement('div');
                const enc = getConversationListEncIcon(entry);
                const isCircle = type === 'channel' && isTrustrootsCircleConversation(entry);
                item.className =
                    'conv-item' +
                    (selectedConversationId === id ? ' selected' : '') +
                    (isCircle ? ' conv-item-circle' : '');
                item.dataset.convId = id;
                const eLab = escConvHtml(label);
                const eGlyph = escConvHtml(enc);
                if (isCircle) {
                    const slug = normalizeChannelSlug(id) || id;
                    const meta = circleMetaBySlug.get(canonicalTrustrootsCircleSlugKey(slug)) || {};
                    const pic = meta.picture && isSafeHttpUrl(meta.picture)
                        ? meta.picture
                        : trustrootsCirclePictureFallback(slug, meta);
                    const about = meta.about && String(meta.about).trim();
                    const hashEsc = escConvHtml('#' + slug);
                    const line =
                        about
                            ? `${escConvHtml(about.length > 88 ? about.slice(0, 85) + '…' : about)} · ${hashEsc}`
                            : hashEsc;
                    const imgHtml = pic
                        ? `<img class="conv-item-avatar" src="${escConvHtml(pic)}" alt="" loading="lazy" decoding="async" />`
                        : '<span class="conv-item-avatar conv-item-avatar-placeholder" aria-hidden="true"></span>';
                    item.innerHTML =
                        imgHtml +
                        '<span class="conv-item-stack">' +
                        `<span class="conv-item-title-row conv-item-circle-hashline">${line}</span>` +
                        '</span>';
                } else if (type === 'dm') {
                    const dmPic = getDmPictureByConversationId(id);
                    const imgHtml = dmPic && isSafeHttpUrl(dmPic)
                        ? `<img class="conv-item-avatar" src="${escConvHtml(dmPic)}" alt="" loading="lazy" decoding="async" />`
                        : '<span class="conv-item-avatar conv-item-avatar-placeholder" aria-hidden="true"></span>';
                    const oneLine = enc === '#' ? eGlyph + eLab : eLab + '\u2009' + eGlyph;
                    item.innerHTML =
                        imgHtml +
                        '<span class="conv-item-stack">' +
                        `<span class="conv-item-title-row">${oneLine}</span>` +
                        '</span>';
                } else {
                    // Emoji rail (🌐 🔒) on the right; keep # as a normal hashtag prefix on the left.
                    const oneLine = enc === '#' ? eGlyph + eLab : eLab + '\u2009' + eGlyph;
                    item.innerHTML =
                        '<span class="conv-item-avatar conv-item-avatar-placeholder" aria-hidden="true"></span>' +
                        '<span class="conv-item-stack">' +
                        `<span class="conv-item-title-row">${oneLine}</span>` +
                        '</span>';
                }
                item.onclick = () => selectConversation(id);
                list.appendChild(item);
            });

            if (!filtered.length) {
                const empty = document.createElement('div');
                empty.className = 'conv-item conv-item-empty';
                empty.innerHTML = '<span class="conv-item-label">\u2014 No matching chats</span>';
                list.appendChild(empty);
            }
        }

        function conversationMatchesFilter(entry, query) {
            if (!query) return true;
            return conversationMatchesFast(entry, query) || backgroundContentMatches.has(entry.id);
        }

        function conversationMatchesFast(entry, query) {
            const id = String(entry.id || '');
            const baseLabel = getConversationLabel(entry);
            const channelAlias = entry.type === 'channel' ? id : '';
            const tokens = [baseLabel, channelAlias, id];
            if (entry.type === 'channel' && id) {
                tokens.push('#' + id);
            }
            if (entry.type === 'channel' && isTrustrootsCircleConversation(entry)) {
                const meta = circleMetaBySlug.get(canonicalTrustrootsCircleSlugKey(id));
                if (meta) {
                    tokens.push(meta.name, meta.about);
                }
            }
            return tokens.some((value) => String(value || '').toLowerCase().includes(query));
        }

        function bindConversationFilterInput() {
            const filterInput = document.getElementById('conv-filter');
            if (!filterInput) return;
            filterInput.addEventListener('input', (event) => {
                conversationFilterQuery = normalizeSearchQuery(event.target?.value || '');
                backgroundContentMatches = new Set();
                scheduleRender('convList');
                scheduleBackgroundContentSearch();
            });
        }

        function syncComposeExpiryFromStorage() {
            const sel = document.getElementById('compose-expiry');
            if (!sel) return;
            const raw = expirationSecondsStore.read();
            const v = (raw != null && NR_EXPIRATION_OPTION_SECONDS.includes(raw)) ? raw : 604800;
            sel.value = String(v);
        }

        function wireComposeExpirySelect() {
            const sel = document.getElementById('compose-expiry');
            if (!sel || sel.dataset.nrExpiryWired === '1') return;
            sel.dataset.nrExpiryWired = '1';
            sel.addEventListener('change', () => {
                const val = sel.value;
                try {
                    if (typeof window.saveExpirationSetting === 'function') {
                        window.saveExpirationSetting(val);
                    } else {
                        expirationSecondsStore.write(val);
                        const noteSel = document.getElementById('note-expiration-in-modal');
                        if (noteSel) noteSel.value = val;
                    }
                } catch (_) {}
            });
        }

        function updateComposePostingIcon() {
            const iconEl = document.getElementById('compose-posting-icon');
            if (!iconEl) return;
            const conv = selectedConversationId ? conversations.get(selectedConversationId) : null;
            if (!conv) {
                iconEl.textContent = '';
                iconEl.title = 'No conversation selected';
                iconEl.style.display = 'none';
                return;
            }

            iconEl.style.display = 'inline-flex';
            const isEncrypted = conv.type === 'dm' || conv.type === 'group';
            if (isEncrypted) {
                iconEl.textContent = '🔒';
                iconEl.title = 'Encrypted PM/group message';
                return;
            }

            const relayScope = getRelayScopeFromRelayUrls(getWritableRelayUrls());
            if (relayScope === 'public') {
                iconEl.textContent = '🌍';
                iconEl.title = 'Posting to channel on public relay(s)';
            } else {
                iconEl.textContent = '🔐';
                iconEl.title = 'Posting to channel on auth-required relay(s)';
            }
        }

        function syncThreadChromeForSelection(conv) {
            const hasConversation = !!conv;
            document.body.classList.toggle('chat-open', hasConversation);
            const emptyEl = document.getElementById('empty-state');
            if (emptyEl) emptyEl.style.display = hasConversation ? 'none' : 'flex';
            const composeEl = document.getElementById('compose');
            if (composeEl) composeEl.style.display = hasConversation ? 'flex' : 'none';
            const opts = document.getElementById('compose-note-duration');
            if (opts) opts.style.display = conv?.type === 'channel' ? 'flex' : 'none';
            const headerEl = document.getElementById('thread-header');
            if (headerEl) headerEl.style.display = hasConversation ? 'flex' : 'none';
            if (conv?.type === 'channel') {
                syncComposeExpiryFromStorage();
            }
            updateComposePostingIcon();
        }

        function syncThreadHeaderForConversation(conv) {
            const headerEl = document.getElementById('thread-header');
            const titleEl = document.getElementById('thread-title');
            const avatarEl = document.getElementById('thread-circle-avatar');
            const heroEl = document.getElementById('thread-chat-image');
            const subEl = document.getElementById('thread-circle-subtitle');
            const linkEl = document.getElementById('thread-circle-link');
            const stackEl = document.getElementById('thread-header-circle-stack');
            if (!titleEl) return;

            const resetCircleChrome = () => {
                if (stackEl) stackEl.style.display = 'none';
                if (avatarEl) {
                    avatarEl.removeAttribute('src');
                    avatarEl.style.display = 'none';
                }
                if (heroEl) {
                    heroEl.removeAttribute('src');
                    heroEl.style.display = 'none';
                }
                if (headerEl) headerEl.classList.remove('thread-header-has-image');
                if (subEl) {
                    subEl.textContent = '';
                    subEl.style.display = 'none';
                }
                if (linkEl) {
                    linkEl.style.display = 'none';
                    linkEl.removeAttribute('href');
                }
            };

            if (!conv) {
                resetCircleChrome();
                return;
            }

            if (conv.type === 'dm' || conv.type === 'group') {
                resetCircleChrome();
                if (conv.type === 'dm') {
                    const pic = getDmPictureByConversationId(conv.id);
                    if (pic && isSafeHttpUrl(pic)) {
                        setImageWithFallback(heroEl, pic, '');
                        if (avatarEl) {
                            setImageWithFallback(avatarEl, pic, '');
                        }
                        if (headerEl) headerEl.classList.add('thread-header-has-image');
                    }
                }
                if (conv.type === 'group') {
                    titleEl.textContent = `Group (${conv.members.length})`;
                } else {
                    const profileId = getDisplayName(conv.id) || hexToNpub(conv.id) || conv.id;
                    const label = profileId.includes('@') ? profileId : (getDisplayNameShort(conv.id) || profileId);
                    setThreadTitleAsProfileLink(titleEl, profileId, label);
                }
                return;
            }

            if (conv.type === 'channel') {
                if (isTrustrootsCircleConversation(conv)) {
                    const slug = normalizeChannelSlug(conv.id) || conv.id;
                    const slugKey = canonicalTrustrootsCircleSlugKey(slug);
                    const meta = circleMetaBySlug.get(slugKey) || {};
                    const circlePicture = meta.picture && isSafeHttpUrl(meta.picture)
                        ? meta.picture
                        : trustrootsCirclePictureFallback(slug, meta);
                    const hash = '#' + slug;
                    titleEl.textContent = hash;
                    const about = meta.about && String(meta.about).trim();
                    const showTrustrootsLink = hasPublishedTrustrootsCircle(slug);
                    if (stackEl) stackEl.style.display = about || showTrustrootsLink ? 'flex' : 'none';
                    if (circlePicture) {
                        if (heroEl) {
                            setImageWithFallback(heroEl, circlePicture, '');
                        }
                        if (avatarEl) {
                            setImageWithFallback(avatarEl, circlePicture, '');
                        }
                        if (headerEl) headerEl.classList.add('thread-header-has-image');
                    } else {
                        if (heroEl) {
                            heroEl.removeAttribute('src');
                            heroEl.style.display = 'none';
                        }
                        if (avatarEl) {
                            avatarEl.removeAttribute('src');
                            avatarEl.style.display = 'none';
                        }
                        if (headerEl) headerEl.classList.remove('thread-header-has-image');
                    }
                    if (subEl) {
                        if (about) {
                            subEl.textContent = about.length > 160 ? about.slice(0, 157) + '…' : about;
                            subEl.style.display = 'block';
                        } else {
                            subEl.textContent = '';
                            subEl.style.display = 'none';
                        }
                    }
                    if (linkEl) {
                        if (showTrustrootsLink) {
                            const trustrootsUrl = trustrootsCirclePageUrlFromMeta(meta, slugKey);
                            if (trustrootsUrl) {
                                linkEl.href = trustrootsUrl;
                                linkEl.style.display = 'inline';
                            } else {
                                linkEl.removeAttribute('href');
                                linkEl.style.display = 'none';
                            }
                        } else {
                            linkEl.removeAttribute('href');
                            linkEl.style.display = 'none';
                        }
                    }
                    return;
                }
                resetCircleChrome();
                titleEl.textContent = '#' + conv.id;
            }
        }

        function selectConversation(id, options) {
            const selectionOpts = options || {};
            selectedConversationId = id;
            const keysEl = document.getElementById('keys-modal');
            const settingsEl = document.getElementById('settings-modal');
            if (keysEl) keysEl.classList.remove('active');
            if (settingsEl) settingsEl.classList.remove('active');
            const conv = conversations.get(id);
            applyDocumentTitle(resolveChatTitleContextFromConversation(conv, id));
            if (conv) {
                writePersistedSelectedChatId(String(id));
            } else {
                writePersistedSelectedChatId('');
            }
            if (conv) {
                const circleSlug = conv.type === 'channel' ? normalizeNrWebAnalyticsCircleSlug(conv.id) : '';
                trackNrWebSurfaceEvent('nr_chat_opened', `chat:${conv.type}:${circleSlug}`, {
                    chat_type: conv.type,
                    circle_slug: circleSlug,
                    has_circle: !!circleSlug,
                    route_type: 'chat',
                    surface: 'chat',
                    ...getCurrentTrustrootsUsernameAnalyticsData(),
                });
            }
            const list = document.getElementById('conv-list');
            if (list) list.querySelectorAll('.conv-item').forEach(el => el.classList.toggle('selected', el.dataset.convId === id));
            syncThreadChromeForSelection(conv);
            if (conv) {
                const isEnc = conv.type === 'dm' || conv.type === 'group';
                document.getElementById('thread-enc-icon').textContent = isEnc ? ENC_LOCK : ENC_GLOBE;
                document.getElementById('thread-enc-icon').title = isEnc ? 'Encrypted' : 'Unencrypted (public)';
                document.getElementById('thread-enc-label').textContent = isEnc ? 'Encrypted' : 'Unencrypted';
                syncThreadHeaderForConversation(conv);
                ensureCircleMembersLoadedForConversation(conv);
                if (conv._pendingEncrypted?.length) decryptPendingForConversation(conv);
            }
            if (!selectionOpts.skipHashUpdate) {
                const routeId = getConversationRouteId(id);
                if (routeId) setHashRoute(routeId);
            }
            const container = document.getElementById('thread-messages');
            if (container) container.innerHTML = '';
            // Defer heavy DOM work so the browser can paint the selection and header first
            requestAnimationFrame(() => {
                renderConvList();
                renderThread();
                if (conv) {
                    const input = document.getElementById('compose-input');
                    if (input) input.focus();
                }
            });
        }

        function goBackToList() {
            document.body.classList.remove('chat-open');
        }

        function showThreadEmpty() {
            document.body.classList.remove('chat-open');
            renderCircleMembersPanel(null);
            document.getElementById('empty-state').style.display = 'flex';
            document.getElementById('compose').style.display = 'none';
            document.getElementById('thread-header').style.display = 'none';
            document.getElementById('thread-messages').innerHTML = '';
        }

        function getPluscodeFromEvent(raw) {
            return getPlusCodeFromEvent(raw);
        }

        function getFirstTagValue(raw, tagName) {
            if (!raw?.tags) return '';
            const tag = raw.tags.find(t => Array.isArray(t) && t[0] === tagName && t[1]);
            return tag?.[1] || '';
        }

        function getMapNoteCanonicalKey(raw) {
            if (!raw || (raw.kind !== MAP_NOTE_KIND && raw.kind !== MAP_NOTE_REPOST_KIND)) {
                return raw?.id ? `id:${raw.id}` : '';
            }

            if (raw.kind === MAP_NOTE_REPOST_KIND) {
                const originalEventId = getFirstTagValue(raw, 'e');
                if (originalEventId) return `origin:${originalEventId}`;
            }

            const canonicalPubkey = raw.kind === MAP_NOTE_REPOST_KIND
                ? (getFirstTagValue(raw, 'p') || raw.pubkey || '')
                : (raw.pubkey || '');
            const originalCreatedAt = raw.kind === MAP_NOTE_REPOST_KIND
                ? Number.parseInt(getFirstTagValue(raw, 'original_created_at'), 10) || (raw.created_at || 0)
                : (raw.created_at || 0);
            const plusCode = getPluscodeFromEvent(raw) || '';
            const content = (raw.content || '').trim();
            return `canonical:${canonicalPubkey}|${originalCreatedAt}|${plusCode}|${content}`;
        }

        function getMapNoteOriginalAuthorPubkey(raw) {
            if (!raw) return '';
            if (raw.kind === MAP_NOTE_REPOST_KIND) {
                const originalAuthor = getFirstTagValue(raw, 'p');
                if (originalAuthor) return originalAuthor;
            }
            return raw.pubkey || '';
        }

        function isBlockedPubkey(pubkey) {
            if (!pubkey || !NrBlocklist || typeof NrBlocklist.isBlocked !== 'function') return false;
            if (NrBlocklist.isBlocked(pubkey)) return true;
            if (typeof pubkey === 'string' && pubkey.startsWith('npub1') && nip19 && typeof nip19.decode === 'function') {
                try {
                    const decoded = nip19.decode(pubkey);
                    if (decoded && decoded.type === 'npub' && decoded.data) {
                        return NrBlocklist.isBlocked(decoded.data);
                    }
                } catch (_) {}
            }
            return false;
        }

        function getChannelSlugFromEvent(raw) {
            if (!raw?.tags) return null;
            const circleTag = raw.tags.find(t => Array.isArray(t) && t.length >= 3 && (t[0] === 'l' || t[0] === 'L') && t[2] === TRUSTROOTS_CIRCLE_LABEL);
            const circleSlug = (circleTag?.[1] || '').trim();
            if (/^[a-zA-Z0-9_-]+$/.test(circleSlug)) {
                return canonicalTrustrootsCircleSlugKey(normalizeChannelSlug(circleSlug));
            }

            const circleHashtagTag = raw.tags.find(t =>
                Array.isArray(t) &&
                t.length >= 2 &&
                (t[0] === 't' || t[0] === 'T') &&
                typeof t[1] === 'string' &&
                !HOSTING_OFFER_CHANNEL_ALIASES.includes(t[1].trim().toLowerCase()) &&
                /^[a-zA-Z0-9_-]+$/.test(t[1].trim())
            );
            if (circleHashtagTag) {
                return normalizeChannelSlug(circleHashtagTag[1].trim().toLowerCase());
            }

            const hashtagTag = raw.tags.find(t =>
                Array.isArray(t) &&
                t.length >= 2 &&
                (t[0] === 't' || t[0] === 'T') &&
                typeof t[1] === 'string' &&
                HOSTING_OFFER_CHANNEL_ALIASES.includes(t[1].trim().toLowerCase())
            );
            if (hashtagTag) return HOSTING_OFFER_CHANNEL_SLUG;

            if (typeof raw.content === 'string') {
                const match = raw.content.match(/#([a-zA-Z0-9_-]+)/g) || [];
                for (const token of match) {
                    const slug = token.slice(1).toLowerCase();
                    if (HOSTING_OFFER_CHANNEL_ALIASES.includes(slug)) {
                        return HOSTING_OFFER_CHANNEL_SLUG;
                    }
                }
            }
            return null;
        }

        function getChannelSlugsFromEvent(raw) {
            const slugs = new Set();
            const primarySlug = getChannelSlugFromEvent(raw);
            if (primarySlug) {
                slugs.add(normalizeChannelSlug(primarySlug));
            }

            if (raw?.tags) {
                (raw.tags || []).forEach((tag) => {
                    if (!Array.isArray(tag) || tag.length < 2) return;
                    if (tag[0] !== 't' && tag[0] !== 'T') return;
                    const normalizedTag = normalizeChannelSlug((tag[1] || '').trim());
                    if (/^[a-zA-Z0-9_-]+$/.test(normalizedTag)) {
                        slugs.add(normalizedTag);
                    }
                });
            }
            return Array.from(slugs);
        }

        function renderThread() {
            const conv = conversations.get(selectedConversationId);
            const container = document.getElementById('thread-messages');
            syncThreadChromeForSelection(conv);
            renderCircleMembersPanel(conv);
            if (!container) return;
            if (!conv) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = '';
            const isChannel = conv.type === 'channel';
            let eventsToShow = conv.events.filter((ev) => {
                if (deletedEventIds.has(ev.id)) return false;
                if (!isChannel) return !isBlockedPubkey(ev.pubkey);
                const authorForBlocklist = getMapNoteOriginalAuthorPubkey(ev.raw || ev) || ev.pubkey;
                return !isBlockedPubkey(authorForBlocklist);
            });
            if (isChannel) {
                const deduped = new Map();
                eventsToShow.forEach((ev) => {
                    const raw = ev.raw || {};
                    let eventKind = raw.kind || ev.kind;
                    const rawTags = Array.isArray(raw.tags) ? raw.tags : [];
                    if (!eventKind && rawTags.length) {
                        const hasOriginalCreatedAt = rawTags.some(t => Array.isArray(t) && t[0] === 'original_created_at' && t[1]);
                        const hasETag = rawTags.some(t => Array.isArray(t) && t[0] === 'e' && t[1]);
                        const hasPTag = rawTags.some(t => Array.isArray(t) && t[0] === 'p' && t[1]);
                        const hasPlusCode = rawTags.some(t => Array.isArray(t) && t[0] === 'l' && t[2] === 'open-location-code');
                        if (hasOriginalCreatedAt && hasETag && hasPTag) eventKind = MAP_NOTE_REPOST_KIND;
                        else if (hasPlusCode) eventKind = MAP_NOTE_KIND;
                    }
                    const eventLike = {
                        id: raw.id || ev.id,
                        kind: eventKind,
                        pubkey: raw.pubkey || ev.pubkey,
                        content: raw.content || ev.content || '',
                        created_at: raw.created_at || ev.created_at || 0,
                        tags: rawTags
                    };
                    const canonicalKey = ev.mapNoteKey || getMapNoteCanonicalKey(eventLike) || '';
                    const plusCode = getPluscodeFromEvent(eventLike) || '';
                    const contentNormalized = (eventLike.content || '').trim();
                    const createdAtMinute = Math.floor((eventLike.created_at || 0) / 60);
                    const similarityKey = (eventKind === MAP_NOTE_KIND || eventKind === MAP_NOTE_REPOST_KIND)
                        ? `similar:${createdAtMinute}|${plusCode}|${contentNormalized}`
                        : '';
                    const key = similarityKey || canonicalKey || `id:${ev.id}`;
                    const hasUsername = !!pubkeyToUsername.get(ev.pubkey);
                    const nip05 = (pubkeyToNip05.get(ev.pubkey) || '').toLowerCase();
                    const hasTrustrootsIdentity = hasUsername || nip05.endsWith('@trustroots.org');
                    const isServerIdentity = nip05 === 'nostroots@trustroots.org' || ((pubkeyToUsername.get(ev.pubkey) || '').toLowerCase() === 'nostroots');
                    const score = (eventKind === MAP_NOTE_KIND ? 20 : 0)
                        + (hasTrustrootsIdentity ? 10 : 0)
                        + (isServerIdentity ? -20 : 0)
                        + (eventKind === MAP_NOTE_REPOST_KIND ? -1 : 0);
                    const existing = deduped.get(key);
                    if (!existing || score > existing.score) {
                        deduped.set(key, { ev, score });
                    }
                });
                eventsToShow = Array.from(deduped.values())
                    .map(entry => entry.ev)
                    .sort((a, b) => a.created_at - b.created_at);
            }
            eventsToShow.forEach(ev => {
                const isSelf = ev.pubkey === currentPublicKey;
                const { row, wrap, bubble: div, actionRail } = createMessageShell({
                    isSelf,
                    eventId: ev.id || '',
                });
                if (isChannel && !isSelf) {
                    const displayPubkey = getMapNoteOriginalAuthorPubkey(ev.raw || ev) || ev.pubkey;
                    const author = document.createElement('div');
                    author.className = 'message-author';
                    author.innerHTML = renderPubkeyLabelHtml(displayPubkey, {
                        usernameMap: pubkeyToUsername,
                        nip05Map: pubkeyToNip05,
                        allowAnyNip05: true,
                    });
                    const fullNpub = hexToNpub(displayPubkey);
                    if (fullNpub) author.title = fullNpub;
                    wrap.appendChild(author);
                }
                div.innerHTML = linkifyMessageTextHtml(escapeHtml(ev.content || ''), {
                    usernameMap: pubkeyToUsername,
                    nip05Map: pubkeyToNip05,
                    linkHashtags: false,
                    className: 'message-inline-link nr-content-link',
                });
                const pluscode = getPluscodeFromEvent(ev.raw);
                if (pluscode) {
                    const pluscodeEl = document.createElement('div');
                    pluscodeEl.className = 'message-pluscode';
                    const link = document.createElement('a');
                    link.className = 'nr-content-link';
                    link.href = '#' + encodeURIComponent(pluscode).replace(/%2B/g, '+');
                    link.title = 'View on map';
                    link.textContent = '\u2316 ' + pluscode;
                    pluscodeEl.appendChild(link);
                    div.appendChild(pluscodeEl);
                }
                const channelSlug = getChannelSlugFromEvent(ev.raw);
                if (channelSlug && channelSlug !== conv.id) {
                    const channelEl = document.createElement('div');
                    channelEl.className = 'message-channel-tag';
                    const channelLink = document.createElement('a');
                    channelLink.className = 'nr-content-link';
                    channelLink.href = '#'+ encodeURIComponent(channelSlug);
                    channelLink.title = `Open #${channelSlug}`;
                    channelLink.textContent = `#${channelSlug}`;
                    channelEl.appendChild(channelLink);
                    div.appendChild(channelEl);
                }
                const meta = document.createElement('div');
                meta.className = 'meta';
                const metaMain = document.createElement('span');
                metaMain.className = 'message-meta-main';
                const timeEl = document.createElement('a');
                timeEl.className = 'time message-time-link';
                timeEl.href = buildMessageDeepLinkHref(conv.id, ev.id);
                timeEl.textContent = formatMessageTimestamp(ev.created_at);
                const clientName = getFirstTagValue(ev.raw, 'client');
                if (clientName) {
                    timeEl.title = `Posted with ${clientName}`;
                }
                metaMain.appendChild(timeEl);
                meta.appendChild(metaMain);
                const confidentialityPill = document.createElement('span');
                confidentialityPill.className = 'message-privacy-pill';
                const isEncryptedConversation = conv.type === 'dm' || conv.type === 'group';
                if (isEncryptedConversation) {
                    confidentialityPill.textContent = ENC_LOCK;
                    confidentialityPill.title = 'Encrypted message content (independent of relay type)';
                    metaMain.appendChild(confidentialityPill);
                }
                const relayScopeForDisplay = getRelayScopeForDisplay(ev, conv);
                /* Channels: show public vs auth relay scope when we know it. DMs/groups: lock already signals encryption — omit relay globe to reduce noise. */
                if (!isEncryptedConversation && (relayScopeForDisplay === 'public' || relayScopeForDisplay === 'auth')) {
                    const relayPill = document.createElement('span');
                    relayPill.className = 'message-relay-pill';
                    relayPill.textContent = relayScopeForDisplay === 'auth' ? RELAY_SCOPE_AUTH : RELAY_SCOPE_PUBLIC;
                    relayPill.title = relayScopeForDisplay === 'auth'
                        ? 'Posted only to auth-required relay(s)'
                        : 'Posted to public relay(s)';
                    metaMain.appendChild(relayPill);
                }
                if ((conv.type === 'dm' || conv.type === 'group') && ev.nip) {
                    const pill = document.createElement('span');
                    pill.className = 'message-nip-pill';
                    pill.textContent = ev.nip;
                    meta.appendChild(pill);
                }
                const copyBtn = createMessageActionButton({
                    label: 'Copy message text',
                    title: 'Copy message text',
                    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
                });
                copyBtn.addEventListener('click', async () => {
                    const ok = await copyTextToClipboard(ev.content || '');
                    showStatus(ok ? 'Message copied.' : 'Failed to copy message.', ok ? 'success' : 'error');
                });
                const rawBtn = createMessageActionButton({
                    label: 'Show full Nostr note',
                    title: 'Show full Nostr note',
                    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6"/><path d="M9 11h2"/></svg>',
                });
                rawBtn.addEventListener('click', () => openRawNoteModal(ev.raw || ev));
                actionRail.appendChild(copyBtn);
                actionRail.appendChild(rawBtn);
                div.appendChild(meta);
                wrap.appendChild(div);
                row.appendChild(wrap);
                if (isSelf) {
                    const delBtn = createMessageActionButton({
                        label: 'Delete message',
                        title: 'Delete message (NIP-09)',
                        danger: true,
                        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
                    });
                    delBtn.onclick = (e) => { e.preventDefault(); openDeleteConfirmModal(ev.id); };
                    actionRail.appendChild(delBtn);
                }
                row.appendChild(actionRail);
                container.appendChild(row);
            });
            container.scrollTop = container.scrollHeight;
            focusPendingDeepLinkedMessage(container);
        }

        function parseHashtagChannelSlug(raw) {
            const s = (raw || '').trim();
            const m = s.match(/^#([a-zA-Z0-9_-]+)$/);
            return m ? normalizeChannelSlug(m[1]) : null;
        }

        async function startDm() {
            const raw = document.getElementById('new-dm-pubkey')?.value?.trim() || '';
            clearNewDmFeedback();
            const hashtagSlug = parseHashtagChannelSlug(raw);
            if (hashtagSlug) {
                getOrCreateConversation('channel', hashtagSlug, []);
                closeNewDmModal();
                document.getElementById('new-dm-pubkey').value = '';
                clearNewDmFeedback();
                setHashRoute(hashtagSlug);
                selectConversation(hashtagSlug);
                return;
            }
            const peer = await resolvePubkeyInput(raw);
            if (!peer) {
                const trustrootsUsername = trustrootsUsernameFromNip05Address(raw);
                if (trustrootsUsername) {
                    const feedback = trustrootsConversationStartFeedback(trustrootsUsername);
                    setNewDmFeedback(feedback.message, feedback);
                    return;
                }
                if (raw.includes('@')) {
                    setNewDmFeedback(`I couldn't find a Nostr address for that name. Try an npub1... address, name@domain, or #channel.`);
                    showStatus('Could not resolve that person address.', 'error');
                } else {
                    setNewDmFeedback('I couldn\'t find a Nostr address for that name. Try an npub1... address, name@domain, or #channel.');
                    showStatus('That does not look like a valid person address or #channel.', 'error');
                }
                return;
            }
            if (peer === currentPublicKey) {
                setNewDmFeedback('You cannot start a private chat with yourself.');
                showStatus('You cannot start a private chat with yourself.', 'error');
                return;
            }
            if (NrBlocklist && NrBlocklist.isBlocked(peer)) {
                setNewDmFeedback('This chat cannot be started right now.');
                showStatus('This chat cannot be started right now.', 'error');
                return;
            }
            getOrCreateConversation('dm', peer, [peer]);
            closeNewDmModal();
            document.getElementById('new-dm-pubkey').value = '';
            clearNewDmFeedback();
            selectConversation(peer);
        }

        function startGroup() {
            const members = [currentPublicKey, ...groupModalMembers.map(m => m.hex)];
            members.sort();
            const groupId = members.join(',');
            getOrCreateConversation('group', groupId, members);
            closeNewGroupModal();
            groupModalMembers = [];
            selectConversation(groupId);
        }

        async function signEvent(template) {
            requireLocalSigningKey();
            const eventToSign = template.pubkey ? template : { ...template, pubkey: currentPublicKey };
            if (isNip7ChatActive()) {
                return window.NrWebNip7.signEvent(eventToSign, currentPublicKey);
            }
            return finalizeEvent(eventToSign, currentSecretKeyBytes);
        }

        function buildTrustrootsCircleMembershipEventTemplate(slugs) {
            const normalizedSlugs = normalizeCircleMembershipSlugList(slugs);
            const tags = [
                ['d', TRUSTROOTS_CIRCLE_MEMBERSHIP_D_TAG],
                ['L', TRUSTROOTS_CIRCLE_LABEL],
            ];
            for (const slug of normalizedSlugs) {
                tags.push(['l', slug, TRUSTROOTS_CIRCLE_LABEL]);
                tags.push(['t', slug]);
            }
            return {
                kind: TRUSTROOTS_CIRCLE_MEMBERSHIP_KIND,
                content: '',
                tags,
                created_at: Math.floor(Date.now() / 1000),
                pubkey: currentPublicKey,
            };
        }

        async function publishTrustrootsCircleMembershipOverride(nextSlugs, actionLabel) {
            if (!currentPublicKey || !hasChatSigningKey()) {
                showStatus('Connect your identity key before changing circle memberships.', 'error');
                openKeysModal();
                return false;
            }
            const publishRelayUrls = getWritableRelayUrls();
            if (!publishRelayUrls.length) {
                showStatus('Turn on posting in Settings before changing circle memberships.', 'error');
                openSettingsModal();
                return false;
            }

            const previous = {
                active: currentUserCircleMembershipOverrideActive,
                createdAt: currentUserCircleMembershipOverrideCreatedAt,
                slugs: new Set(currentUserCircleMembershipOverrideSlugs),
            };
            const normalizedSlugs = normalizeCircleMembershipSlugList(nextSlugs);
            const template = buildTrustrootsCircleMembershipEventTemplate(normalizedSlugs);
            applyCurrentUserCircleMembershipOverride(normalizedSlugs, template.created_at);
            syncCurrentUserCircleMemberForSlug(selectedConversationId || '');
            scheduleRender('convList');
            renderCircleMembersPanel(selectedConversationId ? conversations.get(selectedConversationId) : null);

            try {
                const signed = await signEvent(template);
                const { succeeded, failed } = await publishEventWithRelayAcks(publishRelayUrls, signed);
                if (!succeeded.length) {
                    currentUserCircleMembershipOverrideActive = previous.active;
                    currentUserCircleMembershipOverrideCreatedAt = previous.createdAt;
                    currentUserCircleMembershipOverrideSlugs = previous.slugs;
                    saveCachedCurrentUserCircleMembershipOverride();
                    scheduleRender('convList');
                    renderCircleMembersPanel(selectedConversationId ? conversations.get(selectedConversationId) : null);
                    const fb = relayPublishFailureUserFeedback(failed, 'send');
                    showStatus(fb.message, 'error', { actions: fb.actions });
                    return false;
                }
                showStatus(`${actionLabel} (${succeeded.length} network${succeeded.length === 1 ? '' : 's'} confirmed).`, 'success');
                return true;
            } catch (error) {
                currentUserCircleMembershipOverrideActive = previous.active;
                currentUserCircleMembershipOverrideCreatedAt = previous.createdAt;
                currentUserCircleMembershipOverrideSlugs = previous.slugs;
                saveCachedCurrentUserCircleMembershipOverride();
                scheduleRender('convList');
                renderCircleMembersPanel(selectedConversationId ? conversations.get(selectedConversationId) : null);
                const fb = formatSendCatchError(error);
                showStatus(fb.message, 'error', { actions: fb.actions });
                return false;
            }
        }

        async function joinTrustrootsCircle(slug) {
            const key = canonicalTrustrootsCircleSlugKey(slug);
            if (!key || !TRUSTROOTS_CIRCLE_SLUGS_SET.has(key)) return false;
            const next = getEffectiveCurrentUserCircleMembershipSlugs();
            next.add(key);
            const ok = await publishTrustrootsCircleMembershipOverride([...next], `Joined #${key}`);
            trackNrWebEvent('nr_circle_membership_changed', {
                circle_slug: key,
                failed_count: ok ? 0 : getWritableRelayUrls().length,
                has_circle: true,
                relay_count: getWritableRelayUrls().length,
                signer: getChatSignerAnalyticsType(),
                source: 'join',
                status: ok ? 'success' : 'failed',
                ...getCurrentTrustrootsUsernameAnalyticsData(),
            });
            return ok;
        }

        async function leaveTrustrootsCircle(slug) {
            const key = canonicalTrustrootsCircleSlugKey(slug);
            if (!key || !TRUSTROOTS_CIRCLE_SLUGS_SET.has(key)) return false;
            const next = getEffectiveCurrentUserCircleMembershipSlugs();
            next.delete(key);
            const ok = await publishTrustrootsCircleMembershipOverride([...next], `Left #${key}`);
            trackNrWebEvent('nr_circle_membership_changed', {
                circle_slug: key,
                failed_count: ok ? 0 : getWritableRelayUrls().length,
                has_circle: true,
                relay_count: getWritableRelayUrls().length,
                signer: getChatSignerAnalyticsType(),
                source: 'leave',
                status: ok ? 'success' : 'failed',
                ...getCurrentTrustrootsUsernameAnalyticsData(),
            });
            return ok;
        }

        /** Returns Unix timestamp (seconds) for note expiration, or null for permanent. NIP-40. */
        function getComposeExpiration() {
            const sel = document.getElementById('compose-expiry');
            const val = sel?.value;
            if (!val) return null;
            const sec = parseInt(val, 10);
            if (!Number.isFinite(sec) || sec <= 0) return null;
            return Math.floor(Date.now() / 1000) + sec;
        }

        /**
         * Blocks send: shows status + modal warning, keeps compose text, refocuses input.
         * @returns {boolean} true if blocked
         */
        function warnAndBlockComposeIfNsec(rawPlaintext, inputEl) {
            if (!containsPrivateKeyNsec(rawPlaintext, nip19)) return false;
            const msg =
                'Message not sent: your text contains an nsec (private key). Remove it before sending. Your draft was kept in the box.';
            showStatus(msg, 'error');
            try {
                alert(msg);
            } catch (_) {}
            try {
                if (inputEl) {
                    inputEl.focus({ preventScroll: false });
                    inputEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            } catch (_) {}
            return true;
        }

        async function sendMessage() {
            const input = document.getElementById('compose-input');
            const raw = String(input?.value ?? '');
            const text = raw.trim();
            if (!text) return;
            if (warnAndBlockComposeIfNsec(raw, input)) return;
            const conv = selectedConversationId ? conversations.get(selectedConversationId) : null;
            if (!conv) return;
            const publishRelayUrls = getWritableRelayUrls();
            if (publishRelayUrls.length === 0) {
                showStatus('Turn on posting in Settings to send messages.', 'error');
                alert('Turn on posting in Settings to send messages.');
                openSettingsModal();
                return;
            }

            if (conv.type === 'dm') {
                const peer = conv.id;
                const result = await encryptKind4(peer, text);
                if (!result) {
                    showStatus('To send private messages, first connect your identity key in Keys.', 'error');
                    return;
                }
                const template = {
                    kind: 4,
                    content: result.cipher,
                    tags: [['p', peer]],
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: currentPublicKey
                };
                template.id = getEventHash(template);
                signEvent(template).then(async (signed) => {
                    const { succeeded, failed } = await publishEventWithRelayAcks(publishRelayUrls, signed);
                    if (succeeded.length === 0) {
                        trackNrWebEvent('nr_chat_message_sent', {
                            chat_type: 'dm',
                            failed_count: failed.length,
                            relay_count: publishRelayUrls.length,
                            signer: getChatSignerAnalyticsType(),
                            status: 'failed',
                            ...getCurrentTrustrootsUsernameAnalyticsData(),
                        });
                        const fb = relayPublishFailureUserFeedback(failed, 'send');
                        showStatus(fb.message, 'error', { actions: fb.actions });
                        return;
                    }
                    eventAuthorById.set(signed.id, currentPublicKey);
                    conv.events.push({
                        id: signed.id,
                        pubkey: currentPublicKey,
                        content: text,
                        created_at: template.created_at,
                        raw: signed,
                        nip: result.nip,
                        relayScope: null
                    });
                    conv.events.sort((a, b) => a.created_at - b.created_at);
                    invalidateConversationSearchIndex(conv.id);
                    scheduleChatCacheWrite();
                    input.value = '';
                    scheduleRender('both');
                    trackNrWebEvent('nr_chat_message_sent', {
                        chat_type: 'dm',
                        failed_count: failed.length,
                        relay_count: publishRelayUrls.length,
                        signer: getChatSignerAnalyticsType(),
                        status: failed.length > 0 ? 'partial' : 'success',
                        ...getCurrentTrustrootsUsernameAnalyticsData(),
                    });
                    showStatus(`Message sent (${succeeded.length} of ${publishRelayUrls.length} networks confirmed).`, 'success');
                }).catch((e) => {
                    trackNrWebEvent('nr_chat_message_sent', {
                        chat_type: 'dm',
                        failed_count: publishRelayUrls.length,
                        relay_count: publishRelayUrls.length,
                        signer: getChatSignerAnalyticsType(),
                        status: 'error',
                        ...getCurrentTrustrootsUsernameAnalyticsData(),
                    });
                    const fb = formatSendCatchError(e);
                    showStatus(fb.message, 'error', { actions: fb.actions });
                });
                return;
            }

            if (conv.type === 'group') {
                const rumor = {
                    kind: 14,
                    content: text,
                    tags: conv.members.filter(m => m !== currentPublicKey).map(m => ['p', m]),
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: currentPublicKey
                };
                rumor.id = getEventHash(rumor);
                const membersToSend = conv.members;
                (async () => {
                    for (const memberPubkey of membersToSend) {
                        try {
                            const sealContent = isNip7ChatActive()
                                ? await nip7ChatEncrypt(memberPubkey, JSON.stringify(rumor))
                                : nip44.v2.encrypt(JSON.stringify(rumor), nip44.getConversationKey(currentSecretKeyBytes, memberPubkey));
                            const seal = await signEvent({
                                kind: 13,
                                content: sealContent,
                                tags: [],
                                created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400),
                                pubkey: currentPublicKey
                            });
                            const ephem = generateSecretKey();
                            const wrapContent = nip44.v2.encrypt(JSON.stringify(seal), nip44.getConversationKey(ephem, memberPubkey));
                            const wrap = finalizeEvent({
                                kind: 1059,
                                content: wrapContent,
                                tags: [['p', memberPubkey]],
                                created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400),
                                pubkey: getPublicKey(ephem)
                            }, ephem);
                            void publishEventWithRelayAcks(publishRelayUrls, wrap);
                        } catch (_) {}
                    }
                    eventAuthorById.set(rumor.id, currentPublicKey);
                    conv.events.push({
                        id: rumor.id,
                        pubkey: currentPublicKey,
                        content: text,
                        created_at: rumor.created_at,
                        raw: rumor,
                        nip: 'nip17',
                        relayScope: getRelayScopeFromRelayUrls(publishRelayUrls)
                    });
                    conv.events.sort((a, b) => a.created_at - b.created_at);
                    invalidateConversationSearchIndex(conv.id);
                    scheduleChatCacheWrite();
                    document.getElementById('compose-input').value = '';
                    scheduleRender('both');
                    trackNrWebEvent('nr_chat_message_sent', {
                        chat_type: 'group',
                        failed_count: 0,
                        relay_count: publishRelayUrls.length,
                        signer: getChatSignerAnalyticsType(),
                        status: 'sent',
                        ...getCurrentTrustrootsUsernameAnalyticsData(),
                    });
                    showStatus('Sent to group.', 'success');
                })();
                return;
            }

            if (conv.type === 'channel') {
                const slug = conv.id;
                const exp = getComposeExpiration();
                const tags = [
                    ['L', TRUSTROOTS_CIRCLE_LABEL],
                    ['l', slug, TRUSTROOTS_CIRCLE_LABEL]
                ];
                if (exp) tags.push(['expiration', String(exp)]);
                const template = {
                    kind: MAP_NOTE_KIND,
                    content: text,
                    tags,
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: currentPublicKey
                };
                template.id = getEventHash(template);
                signEvent(template).then(async (signed) => {
                    const { succeeded, failed } = await publishEventWithRelayAcks(publishRelayUrls, signed);
                    if (succeeded.length === 0) {
                        trackNrWebEvent('nr_chat_message_sent', {
                            chat_type: 'channel',
                            circle_slug: slug,
                            failed_count: failed.length,
                            has_circle: true,
                            relay_count: publishRelayUrls.length,
                            signer: getChatSignerAnalyticsType(),
                            status: 'failed',
                            ...getCurrentTrustrootsUsernameAnalyticsData(),
                        });
                        const fb = relayPublishFailureUserFeedback(failed, 'send');
                        showStatus(fb.message, 'error', { actions: fb.actions });
                        return;
                    }
                    eventAuthorById.set(signed.id, currentPublicKey);
                    conv.events.push({
                        id: signed.id,
                        pubkey: currentPublicKey,
                        content: text,
                        created_at: template.created_at,
                        raw: signed,
                        relayScope: getRelayScopeFromRelayUrls(succeeded.map((r) => r.url))
                    });
                    conv.events.sort((a, b) => a.created_at - b.created_at);
                    invalidateConversationSearchIndex(conv.id);
                    scheduleChatCacheWrite();
                    document.getElementById('compose-input').value = '';
                    scheduleRender('both');
                    trackNrWebEvent('nr_chat_message_sent', {
                        chat_type: 'channel',
                        circle_slug: slug,
                        failed_count: failed.length,
                        has_circle: true,
                        relay_count: publishRelayUrls.length,
                        signer: getChatSignerAnalyticsType(),
                        status: failed.length > 0 ? 'partial' : 'success',
                        ...getCurrentTrustrootsUsernameAnalyticsData(),
                    });
                    if (failed.length > 0) {
                        showStatus(`Channel message sent (${succeeded.length} of ${publishRelayUrls.length} networks confirmed).`, 'success');
                    } else {
                        showStatus('Sent to channel.', 'success');
                    }
                }).catch((e) => {
                    trackNrWebEvent('nr_chat_message_sent', {
                        chat_type: 'channel',
                        circle_slug: slug,
                        failed_count: publishRelayUrls.length,
                        has_circle: true,
                        relay_count: publishRelayUrls.length,
                        signer: getChatSignerAnalyticsType(),
                        status: 'error',
                        ...getCurrentTrustrootsUsernameAnalyticsData(),
                    });
                    const fb = formatSendCatchError(e);
                    showStatus(fb.message, 'error', { actions: fb.actions });
                });
            }
        }

        function openDeleteConfirmModal(eventId) {
            pendingDeleteEventId = eventId;
            modal('delete-confirm-modal').open();
        }
        function closeDeleteConfirmModal() {
            pendingDeleteEventId = null;
            modal('delete-confirm-modal').close();
        }
        function confirmDeleteMessage() {
            if (pendingDeleteEventId) {
                deleteMessage(pendingDeleteEventId);
                closeDeleteConfirmModal();
            }
        }
        function deleteMessage(eventId) {
            if (eventAuthorById.get(eventId) !== currentPublicKey) return;
            const template = {
                kind: 5,
                content: '',
                tags: [['e', eventId]],
                created_at: Math.floor(Date.now() / 1000),
                pubkey: currentPublicKey
            };
            signEvent(template).then(async (signed) => {
                const relayUrls = getPublishRelayUrls();
                const { succeeded, failed } = await publishEventWithRelayAcks(relayUrls, signed);
                if (succeeded.length === 0) {
                    const fb = relayPublishFailureUserFeedback(failed, 'delete');
                    showStatus(fb.message, 'error', { actions: fb.actions });
                    return;
                }
                deletedEventIds.add(eventId);
                scheduleChatCacheWrite();
                renderConvList();
                renderThread();
                if (failed.length > 0) {
                    showStatus(`Delete requested on ${succeeded.length}/${relayUrls.length} relays.`, 'success');
                } else {
                    showStatus('Delete requested.', 'success');
                }
            }).catch((e) => {
                const raw = (e && e.message) || e || '';
                const str = typeof raw === 'string' ? raw : String(raw);
                if (isTrustrootsProfileMissingRelayError(str)) {
                    const fb = relayPublishFailureUserFeedback([{ error: str }], 'delete');
                    showStatus(fb.message, 'error', { actions: fb.actions });
                } else {
                    const short = str.length > 200 ? str.slice(0, 197) + '…' : str;
                    showStatus(`Delete failed: ${short}`, 'error');
                }
            });
        }

        // Expose shared modal handlers when embedded (see bootEmbeddedChat); avoids clobbering index before chat loads.
        function attachHeaderButtons() {
            const header = document.getElementById('app-header');
            if (!header) return;
            header.addEventListener('click', function (e) {
                if (e.target.closest('#keys-icon-btn') || e.target.closest('#keys-icon-btn-mobile')) {
                    e.preventDefault();
                    openKeysModal();
                } else if (e.target.closest('#settings-icon-btn') || e.target.closest('#settings-icon-btn-mobile')) {
                    e.preventDefault();
                    openSettingsModal();
                }
            });
        }

function bootEmbeddedChat() {
    if (typeof window !== 'undefined') {
        window.NrWebChatEmbedded = true;
        window.NrWebChatSyncNavAccountAvatar = applyChatNavAccountAvatar;
    }
    window.importKey = importKey;
    window.openKeysModal = openKeysModal;
    window.closeKeysModal = closeKeysModal;
    window.onboardingImport = onboardingImport;
    window.onboardingGenerate = onboardingGenerate;
    window.onboardingNip7Connect = onboardingNip7Connect;
    window.exportNsec = exportNsec;
    window.deleteNsec = deleteNsec;
    window.disconnectNip7 = disconnectNip7;
    window.importNsec = importNsec;
    window.generateKeyPair = generateKeyPair;
    window.NrWebSignEventTemplate = async (eventTemplate) => signEvent(eventTemplate);
    window.NrWebCanSignEventTemplate = () => hasChatSigningKey();
    window.NrWebGetCurrentPubkeyHex = () => currentPublicKey;
    window.openSettingsModal = openSettingsModal;
    window.closeSettingsModal = closeSettingsModal;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachHeaderButtons);
    } else {
        attachHeaderButtons();
    }
    bindConversationFilterInput();
    syncComposeExpiryFromStorage();
    wireComposeExpirySelect();
    document.getElementById('thread-back-btn')?.addEventListener('click', goBackToList);
    window.addRelay = addRelay;
    window.removeRelay = removeRelay;
    window.setRelayWriteEnabled = setRelayWriteEnabled;
    window.toggleRelayWriteForEncodedUrl = toggleRelayWriteForEncodedUrl;
    window.openNewDmModal = openNewDmModal;
    window.closeNewDmModal = closeNewDmModal;
    window.openNewGroupModal = openNewGroupModal;
    window.closeNewGroupModal = closeNewGroupModal;
    window.addGroupParticipant = addGroupParticipant;
    window.startDm = startDm;
    window.startGroup = startGroup;
    window.sendMessage = sendMessage;
    window.disconnect = disconnect;
    window.linkTrustrootsProfile = linkTrustrootsProfile;
    window.updateTrustrootsProfile = updateTrustrootsProfile;
    window.copyPublicKey = copyPublicKey;
    window.openDeleteConfirmModal = openDeleteConfirmModal;
    window.closeDeleteConfirmModal = closeDeleteConfirmModal;
    window.confirmDeleteMessage = confirmDeleteMessage;
    window.closeRawNoteModal = closeRawNoteModal;
    window.copyRawNoteModalJson = copyRawNoteModalJson;

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' && e.keyCode !== 27) return;
        const active = document.querySelector('.modal.active');
        if (!active) return;
        e.preventDefault();
        if (active.id === 'keys-modal') closeKeysModal();
        else if (active.id === 'settings-modal') closeSettingsModal();
        else if (active.id === 'new-dm-modal') closeNewDmModal();
        else if (active.id === 'new-group-modal') closeNewGroupModal();
        else if (active.id === 'delete-confirm-modal') closeDeleteConfirmModal();
        else if (active.id === 'raw-note-modal') closeRawNoteModal();
    }, true);

    return (async () => {
        const ok = await loadKeysFromStorage();
        if (!ok) {
            updateUI();
            startPublicSubscriptions();
        }
    })();
}

/**
 * Apply conversation route when embedded in index.html (keys/settings handled by parent).
 * @param {string} route - decoded hash fragment (channel slug, npub, nip-05, etc.)
 * @param {{ emptyPicker?: boolean }} [opts]
 */
async function applyEmbeddedChatRoute(route, opts) {
    await applyChatHashToState(typeof route === 'string' ? route : '', opts || {});
}

    return { bootEmbeddedChat, applyEmbeddedChatRoute };
})();
export const bootEmbeddedChat = __nrChatApp.bootEmbeddedChat;
export const applyEmbeddedChatRoute = __nrChatApp.applyEmbeddedChatRoute;

export function extractThreadUpvoteMetricValue(events, currentPubkey = '') {
  const cur = String(currentPubkey || '').toLowerCase();
  const candidates = [];
  for (const event of events || []) {
    if (!event || event.kind !== 30394) continue;
    if (!hasClaimTagValue(event.tags, 'claimable', 'true')) continue;
    if (cur && !listHexPubkeyPTags(event.tags).includes(cur)) continue;
    try {
      const payload = JSON.parse(String(event.content || '{}'));
      if (payload?.metric !== 'threads_upvoted_by_others') continue;
      const value = Number.parseInt(payload?.value, 10);
      if (!Number.isFinite(value) || value < 0) continue;
      candidates.push({ event, value });
    } catch (_) {}
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.event?.created_at || 0) - (a.event?.created_at || 0));
  return candidates[0].value;
}

export function normalizeProfileClaimGender(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '';
  const canonical = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (['m', 'man', 'male', 'masculine', 'cis male', 'cis man'].includes(canonical)) return 'male';
  if (['f', 'woman', 'female', 'feminine', 'cis female', 'cis woman'].includes(canonical)) return 'female';
  if (['nb', 'nonbinary', 'non binary', 'non-binary'].includes(canonical)) return 'non-binary';
  return canonical;
}

function formatUtcDateYmd(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function unixSecondsFromAny(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const n = Math.trunc(value);
    if (n >= 1_000_000_000_000) return Math.trunc(n / 1000);
    return n;
  }
  const s = String(value ?? '').trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) {
    const n = Number.parseInt(s, 10);
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (n >= 1_000_000_000_000) return Math.trunc(n / 1000);
    return n;
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.trunc(parsed.getTime() / 1000);
}

export function normalizeProfileClaimBirthDate(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const unixSeconds = unixSecondsFromAny(value);
  if (unixSeconds > 0) return formatUtcDateYmd(new Date(unixSeconds * 1000));
  return '';
}

export function normalizeProfileClaimMemberSince(value) {
  return unixSecondsFromAny(value);
}

export function normalizeProfileClaimLocation(value) {
  if (!value) return null;
  const finalize = (display, city, country) => {
    const d = String(display || '').trim();
    const c = String(city || '').trim();
    const co = String(country || '').trim();
    let resolvedDisplay = d;
    if (!resolvedDisplay) {
      if (c && co) resolvedDisplay = `${c}, ${co}`;
      else resolvedDisplay = c || co;
    }
    if (!resolvedDisplay) return null;
    const out = { display: resolvedDisplay };
    if (c) out.city = c;
    if (co) out.country = co;
    return out;
  };

  if (typeof value === 'string') return finalize(value, '', '');
  if (Array.isArray(value)) return finalize(value.join(', '), '', '');
  if (value && typeof value === 'object') {
    const v = /** @type {{ [key: string]: unknown }} */ (value);
    return finalize(
      v.display ?? v.formatted ?? v.label ?? v.name ?? v.value ?? v.text ?? '',
      v.city ?? v.locality ?? v.town ?? '',
      v.country ?? v.countryName ?? v.countryCode ?? ''
    );
  }
  return null;
}

const PROFILE_LANGUAGE_BIBLIOGRAPHIC_TO_TERMINOLOGIC = Object.freeze({
  alb: 'sqi',
  arm: 'hye',
  baq: 'eus',
  bur: 'mya',
  chi: 'zho',
  cze: 'ces',
  dut: 'nld',
  fre: 'fra',
  geo: 'kat',
  ger: 'deu',
  gre: 'ell',
  ice: 'isl',
  mac: 'mkd',
  mao: 'mri',
  may: 'msa',
  per: 'fas',
  rum: 'ron',
  slo: 'slk',
  tib: 'bod',
  wel: 'cym',
});

const PROFILE_LANGUAGE_CODE_FALLBACK = Object.freeze({
  arz: 'Egyptian Arabic',
  eng: 'English',
  en: 'English',
  ger: 'German',
  deu: 'German',
  de: 'German',
});

function normalizeProfileLanguageLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const lowerNoPrefix = lower.replace(/^iso[_-]?639[_-]?3[-_:]*/, '');
  const normalizedCode = PROFILE_LANGUAGE_BIBLIOGRAPHIC_TO_TERMINOLOGIC[lowerNoPrefix] || lowerNoPrefix;
  const looksLikeLanguageCode = /^[a-z]{2,3}$/.test(normalizedCode);
  if (!looksLikeLanguageCode) return raw;
  const directFallback = PROFILE_LANGUAGE_CODE_FALLBACK[lower] || PROFILE_LANGUAGE_CODE_FALLBACK[lowerNoPrefix] || PROFILE_LANGUAGE_CODE_FALLBACK[normalizedCode];
  if (directFallback) return directFallback;
  try {
    if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') return raw;
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
    const fromNormalized = displayNames.of(normalizedCode);
    if (typeof fromNormalized === 'string' && fromNormalized.trim()) return fromNormalized.trim();
  } catch (_) {}
  return raw;
}

export function normalizeProfileClaimLanguages(value) {
  const out = [];
  const seen = new Set();
  const push = (candidate) => {
    const s = normalizeProfileLanguageLabel(candidate);
    if (!s) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };
  if (Array.isArray(value)) {
    for (const row of value) push(row);
  } else if (typeof value === 'string') {
    const parts = value.split(/[;,/|]/g);
    if (parts.length <= 1) push(value);
    else for (const row of parts) push(row);
  }
  return out;
}

function pickProfileField(primary, secondary) {
  const present = (value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    return true;
  };
  if (present(primary)) return primary;
  if (present(secondary)) return secondary;
  return undefined;
}

export function extractExtendedProfileFields(from90 = {}, from0 = {}) {
  const gender = normalizeProfileClaimGender(pickProfileField(from90.gender, from0.gender));
  const birthDate = normalizeProfileClaimBirthDate(
    pickProfileField(from90.birthDate, pickProfileField(from90.birthdate, pickProfileField(from0.birthDate, from0.birthdate)))
  );
  const memberSince = normalizeProfileClaimMemberSince(
    pickProfileField(
      from90.memberSince,
      pickProfileField(from90.member_since, pickProfileField(from0.memberSince, pickProfileField(from0.member_since, from0.created_at)))
    )
  );
  const livesIn = normalizeProfileClaimLocation(
    pickProfileField(from90.livesIn, pickProfileField(from90.lives_in, pickProfileField(from0.livesIn, from0.lives_in)))
  );
  const from = normalizeProfileClaimLocation(pickProfileField(from90.from, from0.from));
  const languages = normalizeProfileClaimLanguages(
    pickProfileField(
      from90.languages,
      pickProfileField(from90.language, pickProfileField(from90.spokenLanguages, pickProfileField(from0.languages, from0.language)))
    )
  );
  return { gender, birthDate, memberSince, livesIn, from, languages };
}

export function ageYearsFromBirthDate(birthDate, nowMs = Date.now()) {
  const s = String(birthDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const now = new Date(nowMs);
  if (Number.isNaN(now.getTime())) return null;
  let age = now.getUTCFullYear() - y;
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  if (month < m || (month === m && day < d)) age -= 1;
  if (age < 0) return null;
  return age;
}

export function formatMemberSinceDate(unixSeconds) {
  const s = Number(unixSeconds || 0);
  if (!Number.isFinite(s) || s <= 0) return '';
  const date = new Date(s * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return formatUtcDateYmd(date);
}

export function firstSeenOnNostrootsTimestamp(events, subjectHex) {
  const h = String(subjectHex || '').trim().toLowerCase();
  let first = 0;
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || value.kind !== MAP_NOTE_KIND) return;
    if (h && String(value.pubkey || '').trim().toLowerCase() !== h) return;
    const ts = Number(value?.created_at || 0);
    if (!Number.isFinite(ts) || ts <= 0) return;
    if (!first || ts < first) first = ts;
  };
  visit(events);
  return first;
}

export function firstSeenOnNostrootsLine(events, subjectHex) {
  const first = firstSeenOnNostrootsTimestamp(events, subjectHex);
  return first > 0 ? `First seen on Nostroots ${formatMemberSinceDate(first)}` : '';
}

export function buildProfileStatsFromMeta(meta, nowMs = Date.now()) {
  const m = meta && typeof meta === 'object' ? meta : {};
  const genderRaw = normalizeProfileClaimGender(m.gender);
  const gender = genderRaw ? genderRaw.replace(/\b\w/g, (ch) => ch.toUpperCase()) : '';
  const birthDate = normalizeProfileClaimBirthDate(m.birthDate);
  const age = ageYearsFromBirthDate(birthDate, nowMs);
  const demographicsLine = age !== null && gender ? `${age} years. ${gender}.` : '';
  const memberSince = normalizeProfileClaimMemberSince(m.memberSince);
  const memberSinceLine = memberSince > 0 ? `Trustroots member since ${formatMemberSinceDate(memberSince)}` : '';
  const livesIn = normalizeProfileClaimLocation(m.livesIn);
  const livesInLine = livesIn?.display ? `Lives in ${livesIn.display}` : '';
  const from = normalizeProfileClaimLocation(m.from);
  const fromLine = from?.display ? `From ${from.display}` : '';
  const languages = normalizeProfileClaimLanguages(m.languages);
  return { demographicsLine, memberSinceLine, livesInLine, fromLine, languages };
}

export function profileHasMeaningfulRelayData(state = {}) {
  const meta = state.meta && typeof state.meta === 'object' ? state.meta : {};
  const stats = buildProfileStatsFromMeta(meta);
  const hasProfileText = [
    meta.about,
    meta.picture,
    meta.displayName,
    meta.display_name,
    meta.name,
    stats.demographicsLine,
    stats.memberSinceLine,
    stats.livesInLine,
    stats.fromLine,
  ].some((value) => String(value || '').trim());
  if (hasProfileText || stats.languages.length > 0) return true;
  if (Number.isFinite(Number(state.trustMetric)) && Number(state.trustMetric) > 0) return true;
  return [
    state.notes,
    state.relationships,
    state.experiences,
    state.connectedPeople,
    state.hostEvents,
    state.circleSlugs,
  ].some((value) => Array.isArray(value) && value.length > 0);
}

// ---------------------------------------------------------------------------
// Folded: nr-profile-page.js (wrapped in IIFE; returns profile renderers)
// ---------------------------------------------------------------------------
const __nrProfilePage = (() => {

/** Trustroots authenticated relay (NIP-42); kind 30397 seen here is treated as validated for profile UI. */
function isTrustrootsNip42RelayUrl(url) {
  return isTrustrootsAuthRelayUrl(url);
}

/**
 * Map note counts as Trustroots-validated for this author: kind 30398, or kind 30397 from auth relay / nip42.
 * @param {unknown} ev
 * @param {string} authorHex
 */
function isMapNoteTrustrootsValidated(ev, authorHex) {
  if (!ev || !MAP_NOTE_KINDS.includes(ev.kind)) return false;
  const h = String(authorHex || '').toLowerCase();
  if (String(ev.pubkey || '').toLowerCase() !== h) return false;
  if (ev.kind === MAP_NOTE_REPOST_KIND) return true;
  if (ev.kind === MAP_NOTE_KIND) {
    return ev.relayScope === 'auth' || isTrustrootsNip42RelayUrl(ev._nrCollectRelay);
  }
  return false;
}

/** Session memo: first successful avatar URL per tryList fingerprint (avoids re-probing on relay-driven re-renders). */
const AVATAR_TRY_MEMO_MAX = 200;
const avatarTryListResolvedByKey = new Map();

function rememberAvatarTryListSuccess(tryKey, resolvedUrl) {
  const k = String(tryKey || '').trim();
  const u = String(resolvedUrl || '').trim();
  if (!k || !u) return;
  if (avatarTryListResolvedByKey.size >= AVATAR_TRY_MEMO_MAX && !avatarTryListResolvedByKey.has(k)) {
    const first = avatarTryListResolvedByKey.keys().next();
    if (!first.done) avatarTryListResolvedByKey.delete(first.value);
  }
  avatarTryListResolvedByKey.set(k, u);
}

/** `#profile/<encoded-id>` for npub, hex, nip05, or `user@trustroots.org`. */
function profileHashFromSegment(segment) {
  return buildProfileHashRoute(segment);
}

function setExternalAnchorRel(a) {
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
}

function circleImportToolPubkeyHex() {
  try {
    const pub =
      typeof window !== 'undefined' &&
      window.NrWebTrustrootsCircleMeta &&
      window.NrWebTrustrootsCircleMeta.IMPORT_TOOL_PUBKEY_HEX
        ? String(window.NrWebTrustrootsCircleMeta.IMPORT_TOOL_PUBKEY_HEX).trim().toLowerCase()
        : '';
    return pub;
  } catch (_) {
    return '';
  }
}

let profileRenderSequence = 0;

function beginProfileRender(profileId, mode) {
  const root = document.getElementById('nr-profile-root');
  const token = {
    seq: ++profileRenderSequence,
    profileId: String(profileId || '').trim(),
    mode: String(mode || 'public'),
  };
  if (root) {
    root.dataset.nrProfileRenderSeq = String(token.seq);
    root.dataset.nrProfileRenderId = token.profileId;
    root.dataset.nrProfileRenderMode = token.mode;
    root.classList.remove('nr-profile-resolution-root');
    root.innerHTML = '<p class="nr-profile-loading">Loading…</p>';
  }
  return token;
}

function isProfileRenderCurrent(token) {
  if (!token || token.seq !== profileRenderSequence) return false;
  const root = document.getElementById('nr-profile-root');
  return !!root && root.dataset.nrProfileRenderSeq === String(token.seq);
}

function renderProfileResolutionFailure(root, profileId) {
  const details = profileResolutionFailureDetails(profileId);
  const actionHtml = details.actionHref
    ? `<p class="nr-profile-resolution-actions"><a class="btn" href="${escapeHtml(details.actionHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(details.actionLabel)}</a></p>`
    : '';
  const inviteHtml = details.invite
    ? `<p class="nr-profile-resolution-invite">${escapeHtml(details.invite)}</p>`
    : '';
  root.classList.add('nr-profile-resolution-root');
  root.innerHTML = `
    <section class="nr-profile-resolution-failure" aria-live="polite">
      <div class="nr-profile-resolution-mark" aria-hidden="true">?</div>
      <h2>${escapeHtml(details.title)}</h2>
      <p class="nr-profile-resolution-lead">${escapeHtml(details.intro)}</p>
      <p>${escapeHtml(details.next)}</p>
      ${inviteHtml}
      ${actionHtml}
    </section>
  `;
}

/**
 * @param {string} profileId
 * @param {{ seq: number }} token
 * @returns {Promise<{ root: HTMLElement; hex: string } | null>} null if missing root or resolve failed (DOM updated)
 */
async function prepareProfileRootResolved(profileId, token) {
  const root = document.getElementById('nr-profile-root');
  if (!root) return null;
  if (!isProfileRenderCurrent(token)) return null;
  const hex = await resolveProfileIdToHex(profileId);
  if (!isProfileRenderCurrent(token)) return null;
  if (!hex) {
    renderProfileResolutionFailure(root, profileId);
    return null;
  }
  return { root, hex };
}

function renderProfileSelfOnlyGate(root, hex, message, buttonLabel) {
  const href = escapeHtml(publicProfileHashForHex(hex));
  root.innerHTML = `<p class="nr-profile-muted">${escapeHtml(message)}</p><p><a class="btn" href="${href}">${escapeHtml(buttonLabel)}</a></p>`;
}

/** Kind 0 `about` may contain HTML; only render as HTML when it looks like markup (keeps "5 < 7" plain). */
const PROFILE_ABOUT_HTML_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'ul',
  'ol',
  'li',
  'blockquote',
];
const PROFILE_ABOUT_HTML_ATTR = [];

if (typeof DOMPurify.addHook === 'function') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'A' || !node.hasAttribute('href')) return;
    const href = (node.getAttribute('href') || '').trim().toLowerCase();
    if (href.startsWith('http://') || href.startsWith('https://')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    } else {
      node.removeAttribute('target');
      if (!href.startsWith('mailto:')) node.removeAttribute('rel');
    }
  });
}

function profileAboutLooksLikeHtml(s) {
  return /<\s*[a-zA-Z!/?]/.test(String(s));
}

/**
 * @param {string} raw
 * @returns {string} sanitized HTML (caller must only use when {@link profileAboutLooksLikeHtml} is true)
 */
function sanitizeProfileAboutHtml(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return DOMPurify.sanitize(s, {
    ALLOWED_TAGS: PROFILE_ABOUT_HTML_TAGS,
    ALLOWED_ATTR: PROFILE_ABOUT_HTML_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

function profileAboutTextOnly(raw) {
  const s = String(raw || '');
  if (!s) return '';
  if (!profileAboutLooksLikeHtml(s)) return s;
  const div = document.createElement('div');
  div.innerHTML = sanitizeProfileAboutHtml(s);
  return div.textContent || '';
}

function linkifyProfileHashtagsInNode(root) {
  const showText = typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_TEXT : 4;
  const walker = document.createTreeWalker(root, showText);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);

  for (const textNode of nodes) {
    const text = textNode.nodeValue || '';
    const re = /(^|[\s([{])#([a-z0-9][a-z0-9_-]{0,63})/gi;
    let match;
    let lastIndex = 0;
    const frag = document.createDocumentFragment();
    let changed = false;

    while ((match = re.exec(text))) {
      const prefix = match[1] || '';
      const slug = normalizeProfileTextHashtagSlug(match[2]);
      if (!slug) continue;
      frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index) + prefix));
      const a = document.createElement('a');
      a.className = 'nr-content-link';
      a.href = hashRouteFromSegment(slug);
      a.textContent = `#${match[2]}`;
      frag.appendChild(a);
      lastIndex = match.index + match[0].length;
      changed = true;
    }

    if (!changed) continue;
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}

function profileAboutHtmlWithHashtagLinks(raw) {
  const s = String(raw || '');
  if (!s) return '';
  const div = document.createElement('div');
  if (profileAboutLooksLikeHtml(s)) {
    div.innerHTML = sanitizeProfileAboutHtml(s);
  } else {
    div.textContent = s;
  }
  linkifyProfileHashtagsInNode(div);
  return div.innerHTML;
}

function relayUrls() {
  try {
    const u = window.NrWebRelaySettings?.getDefaultRelays?.();
    if (Array.isArray(u) && u.length) return u;
  } catch (_) {}
  return DEFAULT_RELAYS.slice();
}

// escapeHtml + sanitizePictureUrl: see module-scope escapeHtml + sanitizeProfileImageUrl above.
// Local alias so the rest of the profile IIFE can keep calling sanitizePictureUrl.
const sanitizePictureUrl = sanitizeProfileImageUrl;

function isLikelyImageUrl(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  return /\.(?:png|jpe?g|gif|webp|avif|bmp|svg)(?:$|[?#])/i.test(u) || /\/avatar\/\d+\.(?:jpg|png|webp)/i.test(u);
}

/**
 * Aggressively pull anything that looks like a profile picture URL out of a list of nostr events.
 * Used as a debug/fallback when {@link mergeProfile30390AndKind0} finds nothing.
 * @param {unknown[]} events
 * @returns {Array<{ url: string; via: string; kind: number; created_at: number; pubkey: string; eventId?: string }>}
 */
function extractPictureCandidatesFromEvents(events) {
  const out = [];
  const seen = new Set();
  const push = (url, via, ev) => {
    const clean = sanitizePictureUrl(url);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    out.push({
      url: clean,
      via,
      kind: ev?.kind ?? -1,
      created_at: ev?.created_at ?? 0,
      pubkey: String(ev?.pubkey || '').toLowerCase(),
      eventId: ev?.id || '',
    });
  };
  for (const ev of events || []) {
    if (!ev || typeof ev !== 'object') continue;
    const content = String(ev.content || '');
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        ['picture', 'image', 'avatar', 'banner'].forEach((key) => {
          if (typeof parsed[key] === 'string' && parsed[key]) push(parsed[key], `content.${key}`, ev);
        });
      }
    } catch (_) {}
    const text = content.match(/https?:\/\/[^\s<)"']+/gi) || [];
    text.forEach((u) => {
      if (isLikelyImageUrl(u)) push(u, 'content-url', ev);
    });
    (ev.tags || []).forEach((tag) => {
      if (!Array.isArray(tag) || tag.length < 2) return;
      const v = tag[1];
      if (typeof v !== 'string') return;
      if (tag[0] === 'r' && isLikelyImageUrl(v)) push(v, 'r-tag', ev);
      if (tag[0] === 'image' && isLikelyImageUrl(v)) push(v, 'image-tag', ev);
      if (tag[0] === 'picture' && isLikelyImageUrl(v)) push(v, 'picture-tag', ev);
    });
  }
  return out;
}

function getTrustrootsUsernameFrom10390(event) {
  if (!event || event.kind !== TRUSTROOTS_PROFILE_KIND) return '';
  const t = (event.tags || []).find(
    (tag) =>
      Array.isArray(tag) &&
      tag.length >= 3 &&
      tag[0] === 'l' &&
      tag[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE
  );
  return t && t[1] ? String(t[1]).toLowerCase() : '';
}

function getTrustrootsUsernameFromKind0(event) {
  if (event.kind !== 0 || !event.content) return '';
  try {
    const profile = JSON.parse(event.content);
    const nip05 = (profile.nip05 || '').trim().toLowerCase();
    if (!nip05) return '';
    if (nip05.endsWith('@trustroots.org') || nip05.endsWith('@www.trustroots.org')) {
      const local = nip05.split('@')[0];
      return local || '';
    }
    return '';
  } catch (_) {
    return '';
  }
}

function parsePubkeyInput(input) {
  return parsePubkeyInputNormalized(input);
}

async function resolveProfileIdToHex(profileId) {
  const raw = (profileId || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const memoHit = normalizeTimedLookup(profileIdResolveMemo.get(key), PROFILE_ID_RESOLVE_CACHE_MAX_AGE_MS);
  if (memoHit) {
    const cachedHex = normalizeCachedPubkeyHex(memoHit.value);
    if (cachedHex) return cachedHex;
    if (!memoHit.value) return null;
  }
  const cacheKey = PROFILE_ID_RESOLVE_CACHE_KEY_PREFIX + key;
  const persisted = normalizeTimedLookup(await nrWebKvGet(cacheKey), PROFILE_ID_RESOLVE_CACHE_MAX_AGE_MS);
  if (persisted) {
    const cachedHex = normalizeCachedPubkeyHex(persisted.value);
    if (cachedHex || !persisted.value) {
      rememberMemoizedLookup(profileIdResolveMemo, key, persisted);
      return cachedHex || null;
    }
  }
  const resolved = raw.includes('@') ? await resolveNip05(raw) : parsePubkeyInput(raw);
  const row = { ts: Date.now(), value: resolved || '' };
  rememberMemoizedLookup(profileIdResolveMemo, key, row);
  void nrWebKvPut(cacheKey, row).catch(() => {});
  return resolved;
}

/** Local Trustroots username from a profile fragment like `user@trustroots.org` (before relay fetch). */
function trustrootsLocalFromProfileId(profileId) {
  const s = (profileId || '').trim().toLowerCase();
  if (!s.includes('@')) return '';
  const at = s.lastIndexOf('@');
  if (at <= 0) return '';
  const local = s.slice(0, at);
  const domain = s.slice(at + 1).replace(/^www\./, '');
  if (domain === 'trustroots.org') return local;
  return '';
}

function dedupeById(events) {
  const m = new Map();
  for (const ev of events || []) {
    if (!ev || !ev.id) continue;
    const prev = m.get(ev.id);
    if (!prev) {
      m.set(ev.id, ev);
      continue;
    }
    const nip42prev = isTrustrootsNip42RelayUrl(prev._nrCollectRelay);
    const nip42next = isTrustrootsNip42RelayUrl(ev._nrCollectRelay);
    if (nip42next && !nip42prev) m.set(ev.id, ev);
    else if (!nip42next && nip42prev) {
      /* keep prev — it carries nip42 origin for validation UI */
    } else m.set(ev.id, ev);
  }
  return [...m.values()];
}

function pickLatest(events, kind, authorHex) {
  const h = (authorHex || '').toLowerCase();
  const list = (events || []).filter((e) => e.kind === kind && String(e.pubkey).toLowerCase() === h);
  if (!list.length) return null;
  return list.reduce((a, b) => (a.created_at >= b.created_at ? a : b));
}

function pickLatest30390(events, subjectHex, trustrootsUser = '') {
  const h = (subjectHex || '').toLowerCase();
  const tr = String(trustrootsUser || '').trim().toLowerCase();
  const list = (events || []).filter((e) => {
    if (e.kind !== PROFILE_CLAIM_KIND) return false;
    const pTags = eventPTagsHexSet(e);
    if (h && pTags.has(h)) return true;
    if (h && String(e.pubkey || '').toLowerCase() === h) {
      if (!pTags.size) return true;
      if (pTags.size === 1 && pTags.has(h)) return true;
    }
    const tags = e.tags || [];
    const labelMatch =
      !!tr &&
      tags.some(
        (t) =>
          Array.isArray(t) &&
          t.length >= 3 &&
          t[0] === 'l' &&
          String(t[1] || '').trim().toLowerCase() === tr &&
          String(t[2] || '').trim().toLowerCase() === TRUSTROOTS_USERNAME_LABEL_NAMESPACE
      );
    if (labelMatch) return true;
    if (!tr || !e.content) return false;
    // Fallback: some imports may omit/lose p and l tags, but keep identity in JSON content.
    try {
      const c = JSON.parse(String(e.content || '{}'));
      const trUser = String(c.trustrootsUsername || c.name || '').trim().toLowerCase();
      if (trUser && trUser === tr) return true;
      const nip05 = String(c.nip05 || '').trim().toLowerCase();
      if (nip05) {
        const at = nip05.lastIndexOf('@');
        if (at > 0) {
          const local = nip05.slice(0, at);
          const domain = nip05.slice(at + 1).replace(/^www\./, '');
          if (domain === 'trustroots.org' && local === tr) return true;
        }
      }
    } catch (_) {}
    return false;
  });
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  const withPicture = sorted.find((ev) => {
    try {
      const c = JSON.parse(String(ev?.content || '{}'));
      return !!sanitizePictureUrl(c?.picture);
    } catch (_) {
      return false;
    }
  });
  return withPicture || sorted[0];
}

/**
 * @param {string} trustrootsUser
 * @returns {Promise<unknown[]>}
 */
async function collectProfileClaimsForTrustrootsUser(trustrootsUser) {
  const tr = String(trustrootsUser || '').trim().toLowerCase();
  if (!tr) return [];
  const baseQueries = [
    collectFromRelays({ kinds: [PROFILE_CLAIM_KIND], '#l': [tr], limit: 40 }),
    collectFromRelays({ kinds: [PROFILE_CLAIM_KIND], limit: 1200 }),
    collectFromNip42RelayAuth({ kinds: [PROFILE_CLAIM_KIND], '#l': [tr], limit: 120 }),
    collectFromNip42RelayAuth({ kinds: [PROFILE_CLAIM_KIND], limit: 2000 }),
  ];
  const importPub = circleImportToolPubkeyHex();
  const importHex =
    importPub && String(importPub).trim().length === 64 && /^[0-9a-fA-F]+$/.test(String(importPub).trim())
      ? String(importPub).trim().toLowerCase()
      : '';
  if (importHex) {
    baseQueries.push(collectFromRelays({ kinds: [PROFILE_CLAIM_KIND], authors: [importHex], limit: 2000 }));
  }
  const chunks = await Promise.all(baseQueries);
  return dedupeById(chunks.flat());
}

/**
 * REQ one relay; finish soon after EOSE (plus grace), or after a cap if the relay never EOSEs.
 * @param {Record<string, unknown>} filter
 * @param {{ eoseGraceMs?: number; noEoseCapMs?: number; absoluteMaxMs?: number; connectTimeoutMs?: number }} [opts]
 */
async function collectFromRelays(filter, opts = {}) {
  const eoseGraceMs = opts.eoseGraceMs ?? 400;
  const noEoseCapMs = opts.noEoseCapMs ?? 2000;
  const absoluteMaxMs = opts.absoluteMaxMs ?? 5500;
  const connectTimeoutMs = opts.connectTimeoutMs ?? 4500;
  const urls = relayUrls().filter((url) => !isTrustrootsAuthRelayUrl(url));
  const all = [];
  await Promise.all(
    urls.map(async (url) => {
      let relay;
      try {
        relay = await Promise.race([
          Relay.connect(url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('connect timeout')), connectTimeoutMs)),
        ]);
      } catch (_) {
        return;
      }
      try {
        await new Promise((resolve) => {
          let settled = false;
          const settle = () => {
            if (settled) return;
            settled = true;
            clearTimeout(tNoEose);
            clearTimeout(tAbs);
            try {
              sub.close();
            } catch (_) {}
            try {
              relay.close();
            } catch (_) {}
            resolve();
          };
          const tNoEose = setTimeout(settle, noEoseCapMs);
          const tAbs = setTimeout(settle, absoluteMaxMs);
          let sub;
          sub = relay.subscribe([filter], {
            onevent: (ev) => {
              if (ev && typeof ev === 'object') all.push({ ...ev, _nrCollectRelay: url });
              else all.push(ev);
            },
            oneose: () => {
              clearTimeout(tNoEose);
              setTimeout(settle, eoseGraceMs);
            },
          });
        });
      } catch (_) {
        try {
          relay.close();
        } catch (_) {}
      }
    })
  );
  return dedupeById(all);
}

/**
 * One-shot authenticated read from NIP-42 relay when signer is available in index context.
 * Falls back to [] when auth/signer is unavailable.
 * @param {Record<string, unknown>} filter
 * @param {number} [waitMs]
 * @returns {Promise<unknown[]>}
 */
async function collectFromNip42RelayAuth(filter, waitMs = 3200, diagSink = null) {
  const diag = {
    relayAuthAvailable: false,
    signerSource: 'none',
    pubkeyHex: '',
    error: '',
    authChallenge: false,
    authSuccess: false,
    authFail: '',
    eventCount: 0,
  };
  try {
    const relayAuth = typeof window !== 'undefined' ? window.NrWebRelayAuth : null;
    const signFn = typeof window !== 'undefined' ? window.NrWebSignEventTemplate : null;
    const getPubkey = typeof window !== 'undefined' ? window.NrWebGetCurrentPubkeyHex : null;
    const canSign = typeof window !== 'undefined' ? window.NrWebCanSignEventTemplate : null;
    if (!relayAuth?.nip42SubscribeOnce) {
      diag.error = 'NrWebRelayAuth.nip42SubscribeOnce missing';
      if (diagSink) diagSink.push(diag);
      return [];
    }
    diag.relayAuthAvailable = true;

    let authPubkey = '';
    /** @type {(eventTemplate: Record<string, unknown>) => Promise<unknown>} */
    let signEventFn = null;
    const hasWindowSigner = typeof signFn === 'function' && typeof getPubkey === 'function';
    let canSignResult = false;
    try {
      canSignResult = typeof canSign !== 'function' || canSign();
    } catch (e) {
      diag.error = `canSign threw: ${e?.message || e}`;
      canSignResult = false;
    }
    if (hasWindowSigner && canSignResult) {
      try {
        authPubkey = String(getPubkey() || '').trim().toLowerCase();
      } catch (e) {
        diag.error = `getPubkey threw: ${e?.message || e}`;
        authPubkey = '';
      }
      if (/^[0-9a-f]{64}$/.test(authPubkey)) {
        signEventFn = async (eventTemplate) => signFn(eventTemplate);
        diag.signerSource = 'window';
      }
    }
    if (!/^[0-9a-f]{64}$/.test(authPubkey) || typeof signEventFn !== 'function') {
      let skBytes = null;
      const skHex = readValidStoredKeyHex();
      if (skHex) {
        skBytes = secretKeyBytesFromHex64(skHex);
        diag.signerSource = `localStorage:${NR_WEB_PRIVATE_KEY_STORAGE_KEY}`;
      } else {
        const nsec = lsGet(NIP42_TEST_NSEC_KEY).trim();
        if (nsec.toLowerCase().startsWith('nsec1')) {
          try {
            const decoded = nip19.decode(nsec);
            if (decoded?.type === 'nsec' && decoded.data instanceof Uint8Array && decoded.data.length === 32) {
              skBytes = decoded.data;
              diag.signerSource = `localStorage:${NIP42_TEST_NSEC_KEY}`;
            }
          } catch (e) {
            diag.error = `nsec decode failed: ${e?.message || e}`;
          }
        }
      }
      if (!(skBytes instanceof Uint8Array) || skBytes.length !== 32) {
        if (!diag.error) diag.error = `no signer available (no ${NR_WEB_PRIVATE_KEY_STORAGE_KEY}, no ${NIP42_TEST_NSEC_KEY})`;
        if (diagSink) diagSink.push(diag);
        return [];
      }
      authPubkey = String(getPublicKey(skBytes) || '').trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(authPubkey)) {
        diag.error = 'derived pubkey invalid';
        if (diagSink) diagSink.push(diag);
        return [];
      }
      signEventFn = async (eventTemplate) => finalizeEvent(eventTemplate, skBytes);
    }
    diag.pubkeyHex = authPubkey;

    const relayUrl = 'wss://nip42.trustroots.org';
    const out = [];
    await relayAuth.nip42SubscribeOnce({
      relayUrl,
      filter: filter || {},
      authPubkey,
      signEvent: async (eventTemplate) => signEventFn(eventTemplate),
      onEvent: (event) => {
        if (event && typeof event === 'object') {
          try {
            event._nrCollectRelay = relayUrl;
          } catch (_) {}
          out.push(event);
        }
      },
      onAuthChallenge: () => {
        diag.authChallenge = true;
      },
      onAuthSuccess: () => {
        diag.authSuccess = true;
      },
      onAuthFail: (err) => {
        diag.authFail = String((err && err.error) || err || 'auth failed');
      },
      onError: (err) => {
        if (!diag.error) diag.error = String(err?.message || err || 'ws error');
      },
      waitMs,
    });
    diag.eventCount = out.length;
    if (diagSink) diagSink.push(diag);
    return dedupeById(out);
  } catch (e) {
    diag.error = String(e?.message || e || 'unknown error');
    if (diagSink) diagSink.push(diag);
    return [];
  }
}

/**
 * Circle slugs from Trustroots Mongo import kind 30398 host mirrors that tag this pubkey (`p`).
 * Only events authored by {@link circleImportToolPubkeyHex} count: other 30398 reposts may
 * copy map-note tags and would otherwise surface chat circle slugs (e.g. `nostroots`) as tribes.
 * @param {unknown[]} events
 * @param {string} subjectHex
 * @returns {string[]}
 */
function extractCircleSlugsFromHostReposts30398(events, subjectHex) {
  const h = String(subjectHex || '').toLowerCase();
  if (h.length !== 64 || !/^[0-9a-f]+$/.test(h)) return [];
  const importAuthor = circleImportToolPubkeyHex();
  const ia = String(importAuthor || '')
    .trim()
    .toLowerCase();
  if (ia.length !== 64 || !/^[0-9a-f]+$/.test(ia)) return [];
  const seen = new Set();
  const out = [];
  for (const ev of events || []) {
    if (!ev || ev.kind !== MAP_NOTE_REPOST_KIND) continue;
    if (String(ev.pubkey || '').toLowerCase() !== ia) continue;
    const tags = Array.isArray(ev.tags) ? ev.tags : [];
    const mentions = tags.some((t) => Array.isArray(t) && t[0] === 'p' && String(t[1] || '').toLowerCase() === h);
    if (!mentions) continue;
    for (const t of tags) {
      if (!Array.isArray(t) || t.length < 3) continue;
      if (t[0] !== 'l' || t[2] !== TRUSTROOTS_CIRCLE_LABEL) continue;
      const slug = normalizeTrustrootsCircleSlugKey(t[1]);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push(slug);
    }
  }
  return out;
}

/**
 * Circle slugs from kind 30390 profile claims (Trustroots import) that tag this pubkey (`p`).
 * Same import author filter as {@link extractCircleSlugsFromHostReposts30398}.
 * @param {unknown[]} events
 * @param {string} subjectHex
 * @returns {string[]}
 */
function extractCircleSlugsFromProfileClaim30390(events, subjectHex) {
  const h = String(subjectHex || '').toLowerCase();
  if (h.length !== 64 || !/^[0-9a-f]+$/.test(h)) return [];
  const importAuthor = circleImportToolPubkeyHex();
  const ia = String(importAuthor || '')
    .trim()
    .toLowerCase();
  if (ia.length !== 64 || !/^[0-9a-f]+$/.test(ia)) return [];
  const seen = new Set();
  const out = [];
  for (const ev of events || []) {
    if (!ev || ev.kind !== PROFILE_CLAIM_KIND) continue;
    if (String(ev.pubkey || '').toLowerCase() !== ia) continue;
    const tags = Array.isArray(ev.tags) ? ev.tags : [];
    const mentions = tags.some((t) => Array.isArray(t) && t[0] === 'p' && String(t[1] || '').toLowerCase() === h);
    if (!mentions) continue;
    for (const t of tags) {
      if (!Array.isArray(t) || t.length < 3) continue;
      if (t[0] !== 'l' || t[2] !== TRUSTROOTS_CIRCLE_LABEL) continue;
      const slug = normalizeTrustrootsCircleSlugKey(t[1]);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push(slug);
    }
  }
  return out;
}

async function collectCircleDirectoryForSlugs(slugs) {
  const pub = circleImportToolPubkeyHex();
  if (!pub || !Array.isArray(slugs) || !slugs.length) return [];
  const uniq = [...new Set(slugs.map((s) => normalizeTrustrootsCircleSlugKey(s)).filter(Boolean))].slice(0, 40);
  if (!uniq.length) return [];
  return collectFromRelays({
    kinds: [TRUSTROOTS_CIRCLE_META_KIND],
    authors: [pub],
    '#d': uniq,
    limit: 120,
  });
}

function trustrootsCircleDirCacheKey(pubkeyHex, slugs) {
  const p = String(pubkeyHex || '').trim().toLowerCase();
  const s = (slugs || []).map((x) => normalizeTrustrootsCircleSlugKey(x)).filter(Boolean).sort().join(',');
  if (!p || !s) return '';
  return `${TRUSTROOTS_CIRCLE_DIR_CACHE_KEY_PREFIX}${p}:${s}`;
}

function serializeCircleMetaMap(map) {
  const out = [];
  for (const [slug, row] of map || []) {
    if (!slug || !row || typeof row !== 'object') continue;
    out.push({
      slug: normalizeTrustrootsCircleSlugKey(slug),
      name: String(row.name || '').trim(),
      about: String(row.about || '').trim(),
      picture: String(row.picture || '').trim(),
      trustrootsSlug: normalizeTrustrootsCircleWebSlug(row.trustrootsSlug || ''),
      created_at: Number(row.created_at || 0) || 0,
      eventId: String(row.eventId || '').trim(),
    });
  }
  return out.filter((r) => r.slug);
}

function deserializeCircleMetaMap(value) {
  const map = new Map();
  if (!Array.isArray(value)) return map;
  for (const row of value) {
    const slug = normalizeTrustrootsCircleSlugKey(row?.slug);
    if (!slug) continue;
    const picture = String(row?.picture || '').trim();
    const trustrootsSlug = resolveTrustrootsCircleWebSlug(
      { picture, slug: row?.trustrootsSlug },
      slug
    ) || slug;
    map.set(slug, {
      name: String(row?.name || '').trim(),
      about: String(row?.about || '').trim(),
      picture,
      trustrootsSlug,
      created_at: Number(row?.created_at || 0) || 0,
      eventId: String(row?.eventId || '').trim(),
    });
  }
  return map;
}

async function loadCachedCircleDirectoryMap(pubkeyHex, slugs) {
  const key = trustrootsCircleDirCacheKey(pubkeyHex, slugs);
  if (!key) return null;
  const memoHit = normalizeTimedLookup(trustrootsCircleDirMemo.get(key), TRUSTROOTS_CIRCLE_DIR_CACHE_MAX_AGE_MS);
  if (memoHit) return deserializeCircleMetaMap(memoHit.value);
  const persisted = normalizeTimedLookup(await nrWebKvGet(key), TRUSTROOTS_CIRCLE_DIR_CACHE_MAX_AGE_MS);
  if (!persisted) return null;
  rememberMemoizedLookup(trustrootsCircleDirMemo, key, persisted);
  return deserializeCircleMetaMap(persisted.value);
}

async function saveCachedCircleDirectoryMap(pubkeyHex, slugs, map) {
  const key = trustrootsCircleDirCacheKey(pubkeyHex, slugs);
  if (!key) return;
  const row = { ts: Date.now(), value: serializeCircleMetaMap(map) };
  rememberMemoizedLookup(trustrootsCircleDirMemo, key, row);
  void nrWebKvPut(key, row).catch(() => {});
}

function pictureUrlFromTrustrootsUserApiJson(j) {
  if (!j || typeof j !== 'object') return '';
  const src = j.avatarSource;
  if (src === 'local' && j.avatarUploaded && j._id) {
    const ts = j.updated ? new Date(j.updated).getTime() : '';
    return sanitizePictureUrl(`https://www.trustroots.org/uploads-profile/${j._id}/avatar/256.jpg?${ts}`);
  }
  if (src === 'gravatar' && j.emailHash) {
    return sanitizePictureUrl(`https://www.gravatar.com/avatar/${j.emailHash}?s=256&d=identicon`);
  }
  return '';
}

async function tryTrustrootsApiAvatar(username) {
  const u = String(username || '').trim().toLowerCase();
  if (!u) return '';
  const memoHit = normalizeTimedLookup(trustrootsAvatarMemo.get(u), TRUSTROOTS_AVATAR_CACHE_MAX_AGE_MS);
  if (memoHit) return String(memoHit.value || '');
  const cacheKey = TRUSTROOTS_AVATAR_CACHE_KEY_PREFIX + u;
  const persisted = normalizeTimedLookup(await nrWebKvGet(cacheKey), TRUSTROOTS_AVATAR_CACHE_MAX_AGE_MS);
  if (persisted) {
    rememberMemoizedLookup(trustrootsAvatarMemo, u, persisted);
    return String(persisted.value || '');
  }
  const apiUrl = `https://www.trustroots.org/api/users/${encodeURIComponent(u)}`;
  const fetchOpts = { mode: 'cors', credentials: 'omit' };
  const finalize = (picture) => {
    const value = String(picture || '');
    const row = { ts: Date.now(), value };
    rememberMemoizedLookup(trustrootsAvatarMemo, u, row);
    void nrWebKvPut(cacheKey, row).catch(() => {});
    return value;
  };

  try {
    const res = await fetch(apiUrl, fetchOpts);
    if (res.ok) return finalize(pictureUrlFromTrustrootsUserApiJson(await res.json()));
  } catch (_) {}

  try {
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(apiUrl);
    const res = await fetch(proxyUrl, fetchOpts);
    if (!res.ok) return finalize('');
    const pic = pictureUrlFromTrustrootsUserApiJson(JSON.parse(await res.text()));
    if (pic) return finalize(pic);
  } catch (_) {}

  return finalize('');
}

function mergeProfile30390AndKind0(ev30390, ev0) {
  let from90 = {};
  if (ev30390?.content) {
    try {
      from90 = JSON.parse(ev30390.content);
    } catch (_) {}
  }
  let from0 = {};
  if (ev0?.content) {
    try {
      from0 = JSON.parse(ev0.content);
    } catch (_) {}
  }
  const picture =
    sanitizePictureUrl(from90.picture) ||
    sanitizePictureUrl(from0.picture) ||
    '';
  const displayName =
    String(from90.display_name || from90.name || '').trim() ||
    String(from0.display_name || from0.name || '').trim() ||
    '';
  const about =
    String(from90.about || '').trim() || String(from0.about || '').trim() || '';
  const nip05 =
    String(from90.nip05 || from0.nip05 || '')
      .trim()
      .toLowerCase() || '';
  const trustrootsUsername = String(from90.trustrootsUsername || '').trim().toLowerCase() || '';
  const extended = extractExtendedProfileFields(from90, from0);
  return { picture, displayName, about, nip05, trustrootsUsername, from90, from0, ...extended };
}

function normalizeProfileTextHashtagSlug(value) {
  const slug = String(value || '').trim().replace(/^#+/, '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)) return '';
  return slug;
}

function extractProfileTextHashtagSlugs(text) {
  const out = [];
  const seen = new Set();
  const source = profileAboutTextOnly(text);
  const re = /(^|[\s([{])#([a-z0-9][a-z0-9_-]{0,63})/gi;
  let match;
  while ((match = re.exec(source))) {
    const slug = normalizeProfileTextHashtagSlug(match[2]);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

function extractProfileStructuredHashtagSlugs(value) {
  const out = [];
  const seen = new Set();
  const push = (candidate) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(push);
      return;
    }
    if (candidate && typeof candidate === 'object') {
      push(candidate.slug || candidate.name || candidate.label || candidate.value || '');
      return;
    }
    const raw = String(candidate || '').trim();
    if (!raw) return;
    const parts = raw.includes('#') ? extractProfileTextHashtagSlugs(raw) : raw.split(/[;,|]/g);
    for (const part of parts) {
      const slug = normalizeProfileTextHashtagSlug(part);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push(slug);
    }
  };
  push(value);
  return out;
}

function extractProfileHashtagSlugsFromMeta(meta) {
  const out = [];
  const seen = new Set();
  const pushSlug = (slug) => {
    const normalized = normalizeProfileTextHashtagSlug(slug);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };
  extractProfileTextHashtagSlugs(meta?.about || '').forEach(pushSlug);
  for (const source of [meta?.from90, meta?.from0]) {
    if (!source || typeof source !== 'object') continue;
    for (const key of ['tags', 'hashtags', 'interests', 'circles', 'tribes']) {
      extractProfileStructuredHashtagSlugs(source[key]).forEach(pushSlug);
    }
  }
  return out;
}

function truncateBody(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

function createCircleThumbPlaceholder(slug) {
  const ph = document.createElement('div');
  ph.className = 'nr-profile-tr-circ-thumb-ph';
  ph.setAttribute('aria-hidden', 'true');
  const glyph = document.createElement('span');
  glyph.className = 'nr-profile-tr-circ-thumb-ph-glyph';
  const initial = String(slug || '').trim().slice(0, 1).toUpperCase();
  glyph.textContent = initial || '#';
  ph.appendChild(glyph);
  return ph;
}

function trustrootsCirclePictureFallbackForProfile(slug, trustrootsSlug) {
  const key = normalizeTrustrootsCircleSlugKey(slug);
  if (!key) return '';
  return trustrootsCirclePictureFallbackUrlFromMeta({ slug: trustrootsSlug }, key);
}

function renderCircleThumbNode(pic, slug, trustrootsSlug) {
  const safePic = sanitizePictureUrl(pic) || trustrootsCirclePictureFallbackForProfile(slug, trustrootsSlug);
  if (!safePic) return createCircleThumbPlaceholder(slug);
  const img = document.createElement('img');
  img.className = 'nr-profile-tr-circ-thumb';
  img.alt = '';
  img.src = safePic;
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => {
    const jpgFallback = String(safePic).replace(/\/1400x900\.webp(?:[?#].*)?$/i, '/742x496.jpg');
    if (jpgFallback && jpgFallback !== img.src) {
      img.src = jpgFallback;
      return;
    }
    img.replaceWith(createCircleThumbPlaceholder(slug));
  }, { once: true });
  return img;
}

function mapNoteDisplayTimestamp(event) {
  // For Trustroots host mirrors (kind 30398), `created_at` is set from offer.updated
  // in the import tool. Display this as the "last updated" timestamp.
  return Number(event?.created_at || 0) || 0;
}

/**
 * Pick the newest map note per intent bucket.
 * Buckets include only known intents; notes without a recognized intent are ignored.
 * @param {unknown[]} notesSorted
 * @param {unknown[]} hostMirrorEvents
 * @param {string} subjectHex
 * @returns {{ event: unknown; intent: { id: string; label: string; hint: string } | null }[]}
 */
function pickLatestMapNotesByIntentType(notesSorted, hostMirrorEvents, subjectHex) {
  const h = String(subjectHex || '').toLowerCase();
  const ownNotes = Array.isArray(notesSorted) ? notesSorted : [];
  const mirrorNotes = Array.isArray(hostMirrorEvents) ? hostMirrorEvents : [];
  const combined = [...ownNotes, ...mirrorNotes]
    .filter((ev) => ev && MAP_NOTE_KINDS.includes(ev.kind))
    .filter((ev) => {
      if (ev.kind === MAP_NOTE_KIND) return String(ev.pubkey || '').toLowerCase() === h;
      if (ev.kind === MAP_NOTE_REPOST_KIND) {
        const tags = Array.isArray(ev.tags) ? ev.tags : [];
        const pTag = tags.find((t) => Array.isArray(t) && t[0] === 'p' && t[1]);
        return String(pTag?.[1] || '').toLowerCase() === h;
      }
      return false;
    })
    .sort((a, b) => mapNoteDisplayTimestamp(b) - mapNoteDisplayTimestamp(a));

  const byBucket = new Map();
  for (const ev of combined) {
    const intentId = detectNoteIntent(ev);
    const intent = intentId ? getIntentById(intentId) : null;
    if (!intent) continue;
    if (!byBucket.has(intent.id)) byBucket.set(intent.id, { event: ev, intent });
  }
  return Array.from(byBucket.values()).sort(
    (a, b) => mapNoteDisplayTimestamp(b.event) - mapNoteDisplayTimestamp(a.event)
  );
}

/**
 * Host & Meet card: show newest note per intent bucket with date.
 * @param {unknown[]} notesSorted
 * @param {unknown[]} hostMirrorEvents
 * @param {number} validatedCount
 * @param {string} subjectHex
 * @param {boolean} notesReady
 * @param {boolean} host303Ready
 */
function hostMeetSnapshot(notesSorted, hostMirrorEvents, validatedCount, subjectHex, notesReady, host303Ready) {
  if (notesReady) {
    const pickedRows = pickLatestMapNotesByIntentType(notesSorted, hostMirrorEvents, subjectHex);
    if (pickedRows.length > 0) {
      const rows = pickedRows.map(({ event, intent }) => {
        const validated = event?.kind === MAP_NOTE_REPOST_KIND
          ? true
          : isMapNoteTrustrootsValidated(event, subjectHex);
        const rawContent = String(event?.content || '');
        const visibleContent = stripLeadingIntentHashtag(rawContent, intent.id).trim();
        const stamp = mapNoteDisplayTimestamp(event);
        return {
          intentId: intent.id,
          badgeText: intent.label,
          badgeVariant: validated ? 'host' : 'warn',
          summary: truncateBody(visibleContent || rawContent.trim(), 1200),
          dateText: stamp > 0 ? formatDate(stamp) : '',
          plusCode: getPlusCodeFromEvent(event),
          source: '',
        };
      });
      const first = rows[0];
      const anyValidated = rows.some((row) => row.badgeVariant === 'host');
      const source = anyValidated || validatedCount > 0
        ? ''
        : 'Publish on the Trustroots auth relay to verify this note.';
      return {
        title: 'Host & Meet',
        badgeText: first.badgeText,
        badgeVariant: first.badgeVariant,
        summary: first.summary,
        dateText: first.dateText,
        plusCode: first.plusCode,
        source,
        rows: rows.map((row, index) => ({
          ...row,
          source: index === 0 ? source : '',
        })),
      };
    }
  }

  if (!notesReady && host303Ready) {
    return {
      title: 'Host & Meet',
      badgeText: '…',
      badgeVariant: 'muted',
      summary: 'Loading public map notes…',
      dateText: '',
      plusCode: '',
      source: '',
      rows: [],
    };
  }
  if (notesReady && !host303Ready) {
    return {
      title: 'Host & Meet',
      badgeText: '…',
      badgeVariant: 'muted',
      summary: 'Loading Trustroots mirrored notes…',
      dateText: '',
      plusCode: '',
      source: '',
      rows: [],
    };
  }

  return {
    title: 'Host & Meet',
    badgeText: 'No intent yet',
    badgeVariant: 'muted',
    summary: 'No map note intent found on your relays yet.',
    dateText: '',
    plusCode: '',
    source: '',
    rows: [],
  };
}

function bindBasicEditAction(button, label) {
  if (!button) return;
  button.addEventListener('click', (e) => {
    e.preventDefault();
    window.alert(`${label} editing is coming soon.`);
  });
}

function createInlineEditIcon(label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nr-profile-tr-edit-icon';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.textContent = '✏️';
  return btn;
}

function chatHashForSubject(hex, nip05Lower, trUsername) {
  if (nip05Lower) return hashRouteFromSegment(nip05Lower);
  if (trUsername) return hashRouteFromSegment(`${trUsername}@trustroots.org`);
  try {
    return '#' + nip19.npubEncode(hex);
  } catch (_) {
    return profileHashFromSegment(hex);
  }
}

/** Host & Meet intent pill: opens DM with this profile (not used on own profile). */
function createProfileHostMeetBadgeEl(badgeText, badgeVariant, subjectHex, nip05Lower, trUsername) {
  const text = String(badgeText || '').trim() || '—';
  const v = String(badgeVariant || 'muted');
  if (isSelfHex(subjectHex)) {
    return document.createDocumentFragment();
  }
  const a = document.createElement('a');
  a.className = 'nr-profile-tr-rail-message-link';
  a.href = chatHashForSubject(subjectHex, nip05Lower, trUsername);
  a.textContent = 'Message';
  a.setAttribute('aria-label', 'Send a message about this Host & Meet status');
  a.title = 'Send a message';
  return a;
}

function createProfileHostMeetRowBadgeEl(badgeText, badgeVariant) {
  const text = String(badgeText || '').trim() || '—';
  const v = String(badgeVariant || 'muted');
  const span = document.createElement('span');
  span.className = 'nr-profile-tr-badge';
  span.classList.add(`nr-profile-tr-badge--${v}`);
  span.textContent = text;
  return span;
}

function appendProfileHostMeetBody(hostMount, hostMeet) {
  const hostBody = document.createElement('div');
  hostBody.className = 'nr-profile-tr-rail-body nr-profile-tr-rail-body--accommodation';
  const rows = Array.isArray(hostMeet?.rows) ? hostMeet.rows : [];
  if (rows.length > 0) {
    for (const row of rows) {
      const item = document.createElement('div');
      item.className = 'nr-profile-tr-accommodation-row';
      item.style.display = 'grid';
      item.style.gap = '0.35rem';
      item.style.padding = '0.45rem 0';
      item.style.borderBottom = '1px solid var(--border)';

      const metaLine = document.createElement('div');
      metaLine.style.display = 'flex';
      metaLine.style.gap = '0.55rem';
      metaLine.style.alignItems = 'center';
      metaLine.style.justifyContent = 'space-between';

      const badgeWrap = document.createElement('span');
      badgeWrap.appendChild(createProfileHostMeetRowBadgeEl(row.badgeText, row.badgeVariant));
      metaLine.appendChild(badgeWrap);

      if (row.dateText) {
        const date = document.createElement('span');
        date.className = 'nr-profile-muted';
        date.style.fontSize = '0.82rem';
        date.textContent = row.dateText;
        metaLine.appendChild(date);
      }
      item.appendChild(metaLine);

      const summary = document.createElement('p');
      summary.className = 'nr-profile-tr-accommodation-text';
      summary.style.margin = '0';
      summary.style.whiteSpace = 'pre-wrap';
      summary.textContent = row.summary || '';
      item.appendChild(summary);

      if (row.plusCode) {
        const plus = document.createElement('p');
        plus.className = 'nr-profile-muted';
        plus.style.margin = '0';
        const a = document.createElement('a');
        a.className = 'nr-content-link';
        a.href = hashRouteFromSegment(row.plusCode);
        a.textContent = row.plusCode;
        plus.appendChild(a);
        item.appendChild(plus);
      }

      if (row.source) {
        const meta = document.createElement('p');
        meta.className = 'nr-profile-muted';
        meta.style.margin = '0';
        meta.textContent = row.source;
        item.appendChild(meta);
      }

      hostBody.appendChild(item);
    }
    const last = hostBody.lastElementChild;
    if (last) last.style.borderBottom = 'none';
  } else {
    const hostP = document.createElement('p');
    hostP.className = 'nr-profile-tr-accommodation-text';
    if (/^Loading\b/i.test(hostMeet?.summary || '')) hostP.classList.add('nr-profile-tr-skeleton');
    hostP.style.margin = '0';
    hostP.style.whiteSpace = 'pre-wrap';
    hostP.textContent = hostMeet?.summary || '';
    hostBody.appendChild(hostP);
    if (hostMeet?.plusCode) {
      const hostPlus = document.createElement('p');
      hostPlus.className = 'nr-profile-muted';
      hostPlus.style.margin = '0.45rem 0 0';
      const a = document.createElement('a');
      a.className = 'nr-content-link';
      a.href = hashRouteFromSegment(hostMeet.plusCode);
      a.textContent = hostMeet.plusCode;
      hostPlus.appendChild(a);
      hostBody.appendChild(hostPlus);
    }
    if (hostMeet?.dateText) {
      const hostDate = document.createElement('p');
      hostDate.className = 'nr-profile-muted';
      hostDate.style.margin = '0.3rem 0 0';
      hostDate.style.textAlign = 'right';
      hostDate.style.fontSize = '0.82rem';
      hostDate.textContent = hostMeet.dateText;
      hostBody.appendChild(hostDate);
    }
    if (hostMeet?.source) {
      const hostMeta = document.createElement('p');
      hostMeta.className = 'nr-profile-muted';
      hostMeta.style.margin = '0.45rem 0 0';
      hostMeta.textContent = hostMeet.source;
      hostBody.appendChild(hostMeta);
    }
  }
  hostMount.appendChild(hostBody);
}

function publicProfileHashForHex(hex) {
  const h = String(hex || '').toLowerCase();
  if (h.length !== 64 || !/^[0-9a-f]+$/.test(h)) {
    return profileHashFromSegment(String(hex || ''));
  }
  try {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return profileHashFromSegment(nip19.npubEncode(bytes));
  } catch (_) {
    return profileHashFromSegment(h);
  }
}

async function prefetchTrustCardPeopleProfiles(people, onDone) {
  const pending = [];
  for (const person of people || []) {
    const h = String(person?.hex || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) continue;
    if (trustCardProfilePrefetchAttempted.has(h)) continue;
    if (pubkeyToPicture.has(h) && hexHasTrustrootsInlineIdentity(h)) continue;
    trustCardProfilePrefetchAttempted.add(h);
    pending.push(h);
  }
  if (!pending.length) return;

  let sawMetadata = false;
  const batches = [];
  for (let i = 0; i < pending.length; i += 40) batches.push(pending.slice(i, i + 40));
  for (const authors of batches) {
    const filter = buildProfileLookupFilter(authors, { limit: authors.length * 6 });
    const [publicEvents, authEvents] = await Promise.all([
      collectFromRelays(filter).catch(() => []),
      collectFromNip42RelayAuth(filter, 4500, []).catch(() => []),
    ]);
    for (const event of [...(publicEvents || []), ...(authEvents || [])]) {
      if (!event || !authors.includes(String(event.pubkey || '').toLowerCase())) continue;
      processIncomingEvent(event);
      sawMetadata = true;
    }
  }
  if (sawMetadata && typeof onDone === 'function') onDone();
}

function isSelfHex(subjectHex) {
  const self = window.NrWebGetCurrentPubkeyHex?.();
  if (!self || !subjectHex) return false;
  return String(self).toLowerCase() === String(subjectHex).toLowerCase();
}

function trustrootsUserFromNip05(nip05) {
  const n = String(nip05 || '').trim().toLowerCase();
  if (!n || !n.includes('@')) return '';
  const at = n.lastIndexOf('@');
  if (at <= 0) return '';
  const local = n.slice(0, at);
  const domain = n.slice(at + 1).replace(/^www\./, '');
  if (domain !== 'trustroots.org') return '';
  return local;
}

function createClaimLineShell() {
  const wrap = document.createElement('div');
  wrap.className = 'nr-profile-claim-line';
  const meta = document.createElement('div');
  meta.className = 'nr-profile-claim-meta';
  const body = document.createElement('div');
  body.className = 'nr-profile-claim-body';
  wrap.appendChild(meta);
  wrap.appendChild(body);
  return { wrap, meta, body };
}

/** @param {HTMLElement} metaEl */
function appendTrustrootsUsernameProfileLink(metaEl, labelPrefix, username) {
  const u = String(username || '').trim().toLowerCase();
  if (!u) return;
  metaEl.appendChild(document.createTextNode(labelPrefix));
  const a = document.createElement('a');
  a.href = profileHashFromSegment(`${u}@trustroots.org`);
  a.className = 'nr-content-link';
  a.textContent = `@${u}`;
  metaEl.appendChild(a);
}

function renderClaimLineRelationship(ev, subjectHex, trUsernameForSubject) {
  const { wrap, meta, body } = createClaimLineShell();
  const disp = relationshipCounterpartyDisplay(ev.tags, ev.content, subjectHex, trUsernameForSubject || '');
  if (disp.type === 'hex') {
    meta.textContent = `Other: ${formatPubkeyShort(disp.hex)}`;
  } else if (disp.type === 'user' && disp.usernames[0]) {
    appendTrustrootsUsernameProfileLink(meta, 'Other: ', disp.usernames[0]);
  } else if (disp.type === 'users' && disp.usernames.length === 2) {
    meta.textContent = `Between @${disp.usernames[0]} → @${disp.usernames[1]}`;
  } else {
    meta.textContent = 'Relationship suggestion';
  }
  body.textContent = ev.content || '';
  return wrap;
}

function renderClaimLineExperience(ev, subjectHex) {
  const { wrap, meta, body } = createClaimLineShell();
  const disp = experienceCounterpartyDisplay(ev.tags, subjectHex);
  if (disp.type === 'hex') {
    meta.textContent = `Other: ${formatPubkeyShort(disp.hex)}`;
  } else if (disp.type === 'user' && disp.username) {
    appendTrustrootsUsernameProfileLink(meta, 'About: ', disp.username);
  } else {
    meta.textContent = 'Experience suggestion';
  }
  body.textContent = truncateBody(ev.content, 400);
  return wrap;
}

function profileTitleGuess(profileId, npub, hex) {
  const u = trustrootsLocalFromProfileId(profileId);
  if (u) {
    return u
      .split(/[-_]/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
  }
  if (npub) return npub.length > 22 ? `${npub.slice(0, 20)}…` : npub;
  return formatPubkeyShort(hex);
}

function profileHandleGuess(profileId, earlyTrUser, npub, hex) {
  if (earlyTrUser) return `@${earlyTrUser}`;
  const raw = (profileId || '').trim();
  if (raw.includes('@')) {
    const at = raw.lastIndexOf('@');
    if (at > 0) {
      const loc = raw.slice(0, at).toLowerCase();
      if (loc) return `@${loc}`;
    }
  }
  if (npub) return npub.length > 28 ? `${npub.slice(0, 24)}…` : npub;
  return formatPubkeyShort(hex);
}

function profileNip05Guess(profileId, earlyTrUser) {
  if (earlyTrUser) return `${earlyTrUser}@trustroots.org`;
  const r = (profileId || '').trim().toLowerCase();
  if (r.includes('@')) return r;
  return '';
}

/**
 * Build empty profile chrome; {@link applyStagedProfileView} fills content as relays respond.
 * @returns {{ shell: HTMLElement, refs: Record<string, HTMLElement> }}
 */
function createStagedProfileShell(root, ctx) {
  const { hex, npub, profileId, earlyTrUser, titleGuess, handleGuess, nip05Guess } = ctx;
  const selfProfile = isSelfHex(hex);
  root.replaceChildren();
  const shell = document.createElement('div');
  shell.className = 'nr-profile-tr';

  const avWrap = document.createElement('div');
  avWrap.className = 'nr-profile-tr-avatar-wrap';
  const ph = document.createElement('div');
  ph.className = 'nr-profile-tr-avatar-ph';
  ph.setAttribute('aria-hidden', 'true');
  ph.textContent = '👤';
  avWrap.appendChild(ph);

  const hero = document.createElement('div');
  hero.className = 'nr-profile-tr-hero';
  hero.appendChild(avWrap);

  const heroMain = document.createElement('div');
  heroMain.className = 'nr-profile-tr-hero-main';

  const header = document.createElement('header');
  header.className = 'nr-profile-tr-header';
  const titleLine = document.createElement('div');
  titleLine.className = 'nr-profile-tr-title-line';
  const h1 = document.createElement('h1');
  h1.className = 'nr-profile-tr-name';
  h1.textContent = titleGuess;
  titleLine.appendChild(h1);
  let nameEditBtn = null;
  if (selfProfile) {
    nameEditBtn = createInlineEditIcon('Edit profile header');
    titleLine.appendChild(nameEditBtn);
  }
  const handleEl = document.createElement('span');
  handleEl.className = 'nr-profile-tr-handle';
  handleEl.textContent = handleGuess;
  titleLine.appendChild(handleEl);
  header.appendChild(titleLine);

  heroMain.appendChild(header);

  hero.appendChild(heroMain);
  shell.appendChild(hero);

  const setupGuidance = document.createElement('div');
  setupGuidance.className = 'nr-profile-setup-card';
  setupGuidance.hidden = true;
  shell.appendChild(setupGuidance);

  const grid = document.createElement('div');
  grid.className = 'nr-profile-tr-grid';

  const aside = document.createElement('aside');
  aside.className = 'nr-profile-tr-aside';
  const stats = document.createElement('ul');
  stats.className = 'nr-profile-tr-stats';
  const liDemographics = document.createElement('li');
  liDemographics.hidden = true;
  stats.appendChild(liDemographics);
  const liMemberSince = document.createElement('li');
  liMemberSince.hidden = true;
  stats.appendChild(liMemberSince);
  const liFirstSeen = document.createElement('li');
  liFirstSeen.hidden = true;
  stats.appendChild(liFirstSeen);
  const liNip = document.createElement('li');
  liNip.classList.add('nr-profile-tr-stat-nip');
  const nipTitle = document.createElement('div');
  nipTitle.className = 'nr-profile-tr-stat-nip-title';
  nipTitle.textContent = 'Verified address (NIP-05)';
  const nipValue = document.createElement('div');
  nipValue.className = 'nr-profile-tr-stat-nip-value';
  if (nip05Guess) {
    const trUser = trustrootsUserFromNip05(nip05Guess);
    if (trUser) {
      const a = document.createElement('a');
      a.className = 'nr-content-link';
      a.href = trustrootsProfileUrl(trUser);
      setExternalAnchorRel(a);
      a.textContent = nip05Guess;
      nipValue.appendChild(a);
    } else {
      nipValue.textContent = nip05Guess;
    }
  } else {
    liNip.classList.add('nr-profile-tr-skeleton');
    nipValue.textContent = '…';
  }
  liNip.appendChild(nipTitle);
  liNip.appendChild(nipValue);
  stats.appendChild(liNip);
  const liLivesIn = document.createElement('li');
  liLivesIn.hidden = true;
  stats.appendChild(liLivesIn);
  const liFrom = document.createElement('li');
  liFrom.hidden = true;
  stats.appendChild(liFrom);
  const liLanguages = document.createElement('li');
  liLanguages.hidden = true;
  stats.appendChild(liLanguages);
  aside.appendChild(stats);

  grid.appendChild(aside);

  const main = document.createElement('div');
  main.className = 'nr-profile-tr-main';

  const panelAbout = document.createElement('div');
  panelAbout.className = 'nr-profile-tr-panel';
  panelAbout.setAttribute('data-panel', 'about');
  panelAbout.setAttribute('role', 'tabpanel');
  const aboutBox = document.createElement('div');
  aboutBox.className = 'nr-profile-tr-box nr-profile-tr-about';
  const aboutHead = document.createElement('div');
  aboutHead.className = 'nr-profile-tr-box-title';
  const aboutH = document.createElement('h2');
  aboutH.textContent = 'About me';
  aboutHead.appendChild(aboutH);
  let aboutEditBtn = null;
  if (selfProfile) {
    aboutEditBtn = createInlineEditIcon('Edit about section');
    aboutHead.appendChild(aboutEditBtn);
  }
  aboutBox.appendChild(aboutHead);
  const aboutMount = document.createElement('div');
  aboutMount.className = 'nr-profile-tr-about-mount';
  const skA = document.createElement('p');
  skA.className = 'nr-profile-tr-skeleton';
  skA.textContent = 'Loading bio from relays…';
  aboutMount.appendChild(skA);
  aboutBox.appendChild(aboutMount);
  panelAbout.appendChild(aboutBox);
  main.appendChild(panelAbout);

  function panelWithList(panelId, title, hintText) {
    const panel = document.createElement('div');
    panel.className = 'nr-profile-tr-panel';
    panel.setAttribute('data-panel', panelId);
    panel.setAttribute('role', 'tabpanel');
    panel.hidden = true;
    const wrap = document.createElement('div');
    wrap.className = 'nr-profile-tr-box';
    const h = document.createElement('h2');
    h.textContent = title;
    wrap.appendChild(h);
    const hint = document.createElement('p');
    hint.className = 'nr-profile-muted';
    hint.style.marginTop = '-0.35rem';
    hint.textContent = hintText;
    wrap.appendChild(hint);
    const listMount = document.createElement('div');
    listMount.className = 'nr-profile-list';
    const sk = document.createElement('p');
    sk.className = 'nr-profile-tr-skeleton';
    sk.textContent = 'Loading…';
    listMount.appendChild(sk);
    wrap.appendChild(listMount);
    panel.appendChild(wrap);
    return { panel, listMount };
  }

  const { panel: panelNotes, listMount: notesListMount } = panelWithList(
    'notes',
    'Notes',
    'Recent map notes from this person. Tap a plus code to open that area on the map.'
  );
  panelNotes.hidden = true;
  const panelTrust = document.createElement('div');
  panelTrust.className = 'nr-profile-tr-panel';
  panelTrust.setAttribute('data-panel', 'trust');
  panelTrust.setAttribute('role', 'tabpanel');
  panelTrust.hidden = true;
  const trustWrap = document.createElement('div');
  trustWrap.className = 'nr-profile-tr-box';
  const trustH = document.createElement('h2');
  trustH.textContent = 'Trust';
  trustWrap.appendChild(trustH);
  const trustHint = document.createElement('p');
  trustHint.className = 'nr-profile-muted';
  trustHint.style.marginTop = '-0.35rem';
  trustHint.textContent = selfProfile
    ? 'Sign mirrored claimable Trustroots contact suggestions (kind 30392) and experiences (kind 30393). Counts and where events are sent update when your key is loaded and relays are configured.'
    : 'Relationship and experience suggestions from relays (kinds 30392 and 30393), same source as Keys — not edited on this page.';
  trustWrap.appendChild(trustHint);
  const claimTrustSlot = document.createElement('div');
  claimTrustSlot.id = 'nr-profile-trust-claim-slot';
  claimTrustSlot.className = 'nr-profile-tr-trust-claim-slot';
  claimTrustSlot.setAttribute('aria-label', 'Sign Trustroots contact and experience suggestions');
  trustWrap.appendChild(claimTrustSlot);
  const trustRelayListsWrap = document.createElement('div');
  trustRelayListsWrap.className = 'nr-profile-tr-trust-relay-lists';
  if (selfProfile) {
    trustRelayListsWrap.hidden = true;
    trustRelayListsWrap.setAttribute('aria-hidden', 'true');
  }
  const relListMount = document.createElement('div');
  relListMount.className = 'nr-profile-list';
  const relSk = document.createElement('p');
  relSk.className = 'nr-profile-tr-skeleton';
  relSk.textContent = 'Loading…';
  relListMount.appendChild(relSk);
  trustRelayListsWrap.appendChild(relListMount);
  const expBlock = document.createElement('div');
  expBlock.className = 'nr-profile-tr-trust-exp-block';
  const expListMount = document.createElement('div');
  expListMount.className = 'nr-profile-list';
  const expSk = document.createElement('p');
  expSk.className = 'nr-profile-tr-skeleton';
  expSk.textContent = 'Loading…';
  expListMount.appendChild(expSk);
  expBlock.appendChild(expListMount);
  trustRelayListsWrap.appendChild(expBlock);
  trustWrap.appendChild(trustRelayListsWrap);
  panelTrust.appendChild(trustWrap);
  grid.appendChild(main);

  const rail = document.createElement('aside');
  rail.className = 'nr-profile-tr-rail';
  const hostCard = document.createElement('div');
  hostCard.className = 'nr-profile-tr-rail-card';
  const hostMount = document.createElement('div');
  hostMount.className = 'nr-profile-tr-rail-host-mount';
  const hsk = document.createElement('p');
  hsk.className = 'nr-profile-tr-skeleton';
  hsk.style.textAlign = 'center';
  hsk.textContent = 'Loading Host & Meet summary…';
  hostMount.appendChild(hsk);
  hostCard.appendChild(hostMount);
  rail.appendChild(hostCard);

  const trustCard = document.createElement('div');
  trustCard.className = 'nr-profile-tr-rail-card';
  const trustTitle = document.createElement('h3');
  trustTitle.className = 'nr-profile-tr-rail-title';
  trustTitle.textContent = 'Trust';
  trustCard.appendChild(trustTitle);
  const trustSub = document.createElement('p');
  trustSub.className = 'nr-profile-tr-circles-sub';
  trustSub.textContent = 'Imported from Trustroots';
  trustCard.appendChild(trustSub);
  const trustMount = document.createElement('div');
  trustMount.className = 'nr-profile-tr-circ-list';
  trustCard.appendChild(trustMount);
  rail.appendChild(trustCard);

  const circCard = document.createElement('div');
  circCard.className = 'nr-profile-tr-rail-card';
  const circTitle = document.createElement('h3');
  circTitle.className = 'nr-profile-tr-rail-title';
  circTitle.textContent = 'Hashtags';
  circCard.appendChild(circTitle);
  const circSub = document.createElement('p');
  circSub.className = 'nr-profile-tr-circles-sub';
  circSub.textContent = 'Profile tags and Trustroots circles';
  circCard.appendChild(circSub);
  const circListMount = document.createElement('div');
  circListMount.className = 'nr-profile-tr-circ-list';
  circCard.appendChild(circListMount);
  rail.appendChild(circCard);
  grid.appendChild(rail);

  shell.appendChild(grid);

  root.appendChild(shell);

  const refs = {
    shell,
    titleEl: h1,
    handleEl,
    avatarWrap: avWrap,
    statDemographicsLi: liDemographics,
    statMemberSinceLi: liMemberSince,
    statFirstSeenLi: liFirstSeen,
    statNipLi: liNip,
    statLivesInLi: liLivesIn,
    statFromLi: liFrom,
    statLanguagesLi: liLanguages,
    aboutMount,
    setupGuidance,
    notesListMount,
    relListMount,
    expListMount,
    expTrustBlock: expBlock,
    trustRelayListsWrap,
    hostMount,
    trustMount,
    circListMount,
    nameEditBtn,
    aboutEditBtn,
  };
  return { shell, refs };
}

function renderProfileSetupGuidance(el, setupState) {
  if (!el) return;
  el.replaceChildren();
  const state = String(setupState || '');
  if (state !== 'no_key' && state !== 'key_without_trustroots') {
    el.hidden = true;
    return;
  }

  const title = document.createElement('h2');
  title.textContent = 'Not much found on relays yet';
  el.appendChild(title);

  const body = document.createElement('p');
  body.className = 'nr-profile-muted';
  body.textContent = state === 'no_key'
    ? 'This profile exists, but Nostroots could not find profile details, Host & Meet notes, trust data, or circles on your relays yet. Connect a key in welcome Keys to get started.'
    : 'This profile exists, but Nostroots could not find much on your relays yet. Your key is connected; link your Trustroots account with NIP-05 in Keys to unlock full access, including nip42.trustroots.org.';
  el.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'nr-profile-setup-actions';
  const keys = document.createElement('a');
  keys.className = 'btn';
  keys.href = '#keys';
  keys.textContent = state === 'no_key' ? 'Open welcome Keys' : 'Open Keys';
  actions.appendChild(keys);
  const signup = document.createElement('a');
  signup.className = 'btn btn-secondary';
  signup.href = 'https://www.trustroots.org/signup';
  setExternalAnchorRel(signup);
  signup.textContent = 'Sign up for Trustroots';
  actions.appendChild(signup);
  el.appendChild(actions);
  el.hidden = false;
}

/**
 * @param {Record<string, HTMLElement>} refs
 * @param {{ evAuthors?: unknown[]; evP30390?: unknown[]; evPClaims?: unknown[]; evNotes?: unknown[]; evHost30398?: unknown[]; trustSummary?: { contactCount: number; positiveExperienceCount: number; threadUpvoteMetricValue: number|null; people: Array<{ hex: string; username: string; sources?: string[] }> }; circleMetaBySlug?: Map<string, { name: string; about: string; picture: string; trustrootsSlug?: string; created_at?: number }>; avatarExtra?: string }} viewState
 * @param {{ hex: string; npub: string; profileId: string; earlyTrUser: string; circleDirSlugsKey?: string; scheduleBump?: () => void; onTrustrootsUsernameResolved?: (username: string) => void }} ctx
 */
function applyStagedProfileView(refs, viewState, ctx) {
  const { hex, npub, profileId, earlyTrUser } = ctx;
  const authorsReady = viewState.evAuthors !== undefined;
  const p90Ready = viewState.evP30390 !== undefined;
  const claimsReady = viewState.evPClaims !== undefined;
  const trustSummaryReady = viewState.trustSummary !== undefined;
  const notesReady = viewState.evNotes !== undefined;
  const host303Ready = viewState.evHost30398 !== undefined;

  const evAuthors = authorsReady ? viewState.evAuthors || [] : [];
  const evP30390 = p90Ready ? viewState.evP30390 || [] : [];
  const evPClaims = claimsReady ? viewState.evPClaims || [] : [];
  const evNotes = notesReady ? viewState.evNotes || [] : [];
  const evHost30398 = host303Ready ? viewState.evHost30398 || [] : [];

  const ev0 = authorsReady ? pickLatest(evAuthors, 0, hex) : null;
  const ev10390 = authorsReady ? pickLatest(evAuthors, TRUSTROOTS_PROFILE_KIND, hex) : null;
  const ev30390 = p90Ready ? pickLatest30390(evP30390, hex, earlyTrUser) : null;

  const meta = mergeProfile30390AndKind0(ev30390, ev0);
  let trUser =
    meta.trustrootsUsername ||
    getTrustrootsUsernameFrom10390(ev10390 || {}) ||
    getTrustrootsUsernameFromKind0(ev0 || {});
  if (trUser && typeof ctx.onTrustrootsUsernameResolved === 'function') {
    ctx.onTrustrootsUsernameResolved(trUser);
  }

  const nip05Resolved = meta.nip05 || (trUser ? `${trUser}@trustroots.org` : '') || profileNip05Guess(profileId, earlyTrUser);

  let picture = meta.picture;
  if (!picture && trUser && viewState.avatarExtra) {
    picture = viewState.avatarExtra;
  }
  if (picture && isSelfHex(hex)) {
    const safePicture = sanitizeProfileImageUrl(picture);
    if (safePicture) {
      pubkeyToPicture.set(String(hex).toLowerCase(), safePicture);
      window.NrWeb?.rememberNrNavAccountAvatar?.(hex, safePicture);
      window.NrWeb?.updateNrNavAccountAvatars?.(safePicture);
    }
  }

  const notesSorted = notesReady
    ? evNotes
        .filter((e) => MAP_NOTE_KINDS.includes(e.kind))
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 25)
    : [];
  const validatedMapNoteCount = notesReady
    ? evNotes.filter((e) => isMapNoteTrustrootsValidated(e, hex)).length
    : 0;
  const rels = claimsReady ? evPClaims.filter((e) => e.kind === RELATIONSHIP_CLAIM_KIND).slice(0, 20) : [];
  const exps = claimsReady ? evPClaims.filter((e) => e.kind === EXPERIENCE_CLAIM_KIND).slice(0, 20) : [];
  const cachedTrustSummary = trustSummaryReady ? normalizeProfileTrustSummary(viewState.trustSummary) : null;
  const liveTrustSummary = claimsReady ? buildTrustCardSummaryFromEvents(evPClaims, hex, trUser) : null;
  if (liveTrustSummary) viewState.trustSummary = liveTrustSummary;
  const trustSummary = liveTrustSummary || cachedTrustSummary;
  const confirmedContactCount = trustSummary ? trustSummary.contactCount : 0;
  const connectedPubkeyPeople = trustSummary ? trustSummary.people : [];
  const positiveReferenceCount = trustSummary ? trustSummary.positiveExperienceCount : 0;
  const threadUpvoteMetric = trustSummary ? trustSummary.threadUpvoteMetricValue : null;
  const showThreadUpvoteMetric = shouldShowThreadUpvoteMetric(threadUpvoteMetric);
  const slugsText = extractProfileHashtagSlugsFromMeta(meta);
  const slugs98ForEmpty = host303Ready ? extractCircleSlugsFromHostReposts30398(viewState.evHost30398 || [], hex) : [];
  const slugs90ForEmpty = p90Ready ? extractCircleSlugsFromProfileClaim30390(viewState.evP30390 || [], hex) : [];
  const circleSlugsForEmpty = [...slugsText, ...slugs90ForEmpty, ...slugs98ForEmpty].filter(Boolean);
  const emptyGuidanceReady = authorsReady && p90Ready && claimsReady && notesReady && host303Ready;
  const showSetupGuidance = emptyGuidanceReady && !profileHasMeaningfulRelayData({
    meta,
    notes: notesSorted,
    relationships: rels,
    experiences: exps,
    connectedPeople: connectedPubkeyPeople,
    hostEvents: evHost30398,
    circleSlugs: circleSlugsForEmpty,
    trustMetric: threadUpvoteMetric,
  });
  renderProfileSetupGuidance(
    refs.setupGuidance,
    showSetupGuidance ? getCurrentNostrootsSetupState() : 'ready'
  );
  if (connectedPubkeyPeople.length) {
    void prefetchTrustCardPeopleProfiles(connectedPubkeyPeople, () => ctx.scheduleBump?.())
      .catch((e) => console.warn('[nr-profile] trust people profile prefetch', e));
  }
  const displayTitle = meta.displayName || profileTitleGuess(profileId, npub, hex);
  let handleLine = '';
  if (trUser) handleLine = `@${trUser}`;
  else if (nip05Resolved && nip05Resolved.includes('@')) {
    const loc = nip05Resolved.split('@')[0];
    if (loc) handleLine = `@${loc}`;
  } else if (npub) {
    handleLine = npub.length > 28 ? `${npub.slice(0, 24)}…` : npub;
  } else {
    handleLine = formatPubkeyShort(hex);
  }

  refs.titleEl.textContent = displayTitle;
  refs.handleEl.textContent = handleLine;

  const setStatLine = (el, text) => {
    if (!el) return;
    const line = String(text || '').trim();
    el.replaceChildren();
    el.hidden = !line;
    el.classList.remove('nr-profile-tr-skeleton', 'nr-profile-muted');
    if (line) el.textContent = line;
  };
  const setLanguagesStat = (el, languages) => {
    if (!el) return;
    const list = Array.isArray(languages) ? languages.filter((s) => String(s || '').trim()) : [];
    el.replaceChildren();
    el.hidden = list.length === 0;
    el.classList.remove('nr-profile-tr-skeleton', 'nr-profile-muted');
    if (!list.length) return;
    const title = document.createElement('div');
    title.className = 'nr-profile-tr-stat-languages-title';
    title.textContent = 'LANGUAGES';
    el.appendChild(title);
    for (const language of list) {
      const row = document.createElement('div');
      row.className = 'nr-profile-tr-stat-languages-row';
      row.textContent = String(language).trim();
      el.appendChild(row);
    }
  };

  const profileStats = buildProfileStatsFromMeta(meta);
  setStatLine(refs.statDemographicsLi, profileStats.demographicsLine);
  setStatLine(refs.statMemberSinceLi, profileStats.memberSinceLine);
  setStatLine(refs.statFirstSeenLi, firstSeenOnNostrootsLine(evNotes, hex));
  setStatLine(refs.statLivesInLi, profileStats.livesInLine);
  setStatLine(refs.statFromLi, profileStats.fromLine);
  setLanguagesStat(refs.statLanguagesLi, profileStats.languages);

  refs.statNipLi.replaceChildren();
  refs.statNipLi.hidden = false;
  refs.statNipLi.classList.remove('nr-profile-tr-skeleton', 'nr-profile-muted');
  const nipTitle = document.createElement('div');
  nipTitle.className = 'nr-profile-tr-stat-nip-title';
  nipTitle.textContent = 'Verified address (NIP-05)';
  const nipValue = document.createElement('div');
  nipValue.className = 'nr-profile-tr-stat-nip-value';
  refs.statNipLi.appendChild(nipTitle);
  refs.statNipLi.appendChild(nipValue);
  if (nip05Resolved) {
    const trUser = trustrootsUserFromNip05(nip05Resolved);
    if (trUser) {
      const a = document.createElement('a');
      a.className = 'nr-content-link';
      a.href = trustrootsProfileUrl(trUser);
      setExternalAnchorRel(a);
      a.textContent = nip05Resolved;
      nipValue.appendChild(a);
    } else {
      nipValue.textContent = nip05Resolved;
    }
  } else if (!authorsReady && !p90Ready) {
    refs.statNipLi.classList.add('nr-profile-tr-skeleton');
    nipValue.textContent = '…';
  } else {
    refs.statNipLi.classList.add('nr-profile-muted');
    nipValue.textContent = 'No verified address found yet.';
  }
  // Keep avatar fallbacks scoped to this profile only.
  // `evP30390` can include broad relay scans for discovery, so using all fetched
  // rows here can leak other users' pictures into this profile card.
  const profileScopedForAvatar = [ev0, ev10390, ev30390].filter(Boolean);
  const candidates = extractPictureCandidatesFromEvents(profileScopedForAvatar);
  /** Ordered list of URLs to try in <img> (primary first, fallbacks second). */
  const tryList = [];
  if (picture) tryList.push(picture);
  for (const c of candidates) {
    if (!tryList.includes(c.url)) tryList.push(c.url);
  }

  const tryKey = tryList.length ? `${hex}|${tryList.join('|')}` : '';
  const memoResolved = tryKey ? avatarTryListResolvedByKey.get(tryKey) : '';

  refs.avatarWrap.replaceChildren();
  if (tryList.length) {
    const img = document.createElement('img');
    img.className = 'nr-profile-avatar';
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    if (memoResolved && tryList.includes(memoResolved)) {
      img.src = memoResolved;
      refs.avatarWrap.appendChild(img);
    } else {
      let idx = 0;
      img.src = tryList[idx];
      img.addEventListener('load', () => {
        rememberAvatarTryListSuccess(tryKey, img.currentSrc || img.src || '');
      }, { once: true });
      img.addEventListener('error', () => {
        idx += 1;
        if (idx < tryList.length) {
          img.src = tryList[idx];
        } else {
          const ph = document.createElement('div');
          ph.className = 'nr-profile-tr-avatar-ph';
          ph.setAttribute('aria-hidden', 'true');
          ph.textContent = '👤';
          img.replaceWith(ph);
        }
      });
      refs.avatarWrap.appendChild(img);
    }
  } else {
    const ph = document.createElement('div');
    ph.className = 'nr-profile-tr-avatar-ph';
    ph.setAttribute('aria-hidden', 'true');
    ph.textContent = '👤';
    refs.avatarWrap.appendChild(ph);
  }

  refs.aboutMount.replaceChildren();
  if (!authorsReady && !p90Ready) {
    const p = document.createElement('p');
    p.className = 'nr-profile-tr-skeleton';
    p.textContent = 'Loading bio from relays…';
    refs.aboutMount.appendChild(p);
  } else if (meta.about) {
    const about = document.createElement('div');
    about.className = 'nr-profile-about';
    const rawAbout = String(meta.about);
    about.innerHTML = profileAboutHtmlWithHashtagLinks(rawAbout);
    refs.aboutMount.appendChild(about);
  } else {
    const emptyA = document.createElement('p');
    emptyA.className = 'nr-profile-muted';
    emptyA.textContent =
      'No “about” text on their latest Nostr profile yet. It may appear after they publish kind 0 or a Trustroots export (kind 30390).';
    refs.aboutMount.appendChild(emptyA);
  }

  function fillList(mount, ready, items, emptyMsg, renderRow) {
    mount.replaceChildren();
    if (!ready) {
      const p = document.createElement('p');
      p.className = 'nr-profile-tr-skeleton';
      p.textContent = 'Loading…';
      mount.appendChild(p);
      return;
    }
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'nr-profile-muted';
      p.textContent = emptyMsg;
      mount.appendChild(p);
      return;
    }
    for (const item of items) mount.appendChild(renderRow(item));
  }

  fillList(
    refs.notesListMount,
    notesReady,
    notesSorted,
    'No notes found on your relays for this person yet.',
    (ev) => {
      const pc = getPlusCodeFromEvent(ev);
      const row = document.createElement('div');
      row.className = 'nr-profile-note-row';
      const a = document.createElement('a');
      a.className = 'nr-content-link';
      if (pc) {
        a.href = hashRouteFromSegment(pc);
        a.textContent = pc;
      } else {
        a.href = '#map';
        a.textContent = 'View map';
      }
      const snip = document.createElement('span');
      snip.className = 'nr-profile-note-snippet';
      snip.textContent = truncateBody(ev.content, 120);
      row.appendChild(a);
      row.appendChild(snip);
      return row;
    }
  );

  if (!isSelfHex(hex)) {
    if (!claimsReady) {
      fillList(refs.relListMount, false, [], '', () => document.createElement('div'));
      fillList(refs.expListMount, false, [], '', () => document.createElement('div'));
    } else if (!rels.length && !exps.length) {
      refs.relListMount.replaceChildren();
      const p = document.createElement('p');
      p.className = 'nr-profile-muted';
      p.textContent = 'None loaded.';
      refs.relListMount.appendChild(p);
      refs.expListMount.replaceChildren();
      if (refs.expTrustBlock) refs.expTrustBlock.style.display = 'none';
    } else {
      if (refs.expTrustBlock) refs.expTrustBlock.style.display = '';
      fillList(
        refs.relListMount,
        true,
        rels,
        'No relationship suggestions.',
        (ev) => renderClaimLineRelationship(ev, hex, trUser)
      );
      fillList(refs.expListMount, true, exps, 'No experience suggestions.', (ev) => renderClaimLineExperience(ev, hex));
    }
  } else {
    refs.relListMount.replaceChildren();
    refs.expListMount.replaceChildren();
    if (refs.expTrustBlock) refs.expTrustBlock.style.display = 'none';
  }

  refs.hostMount.replaceChildren();
  if (!notesReady && !host303Ready) {
    const cachedHostMeet = loadProfileHostMeetCardFromCache(hex);
    if (!cachedHostMeet) {
      const p = document.createElement('p');
      p.className = 'nr-profile-tr-skeleton';
      p.style.textAlign = 'center';
      p.textContent = 'Loading Host & Meet summary…';
      refs.hostMount.appendChild(p);
    } else {
      const hostHead = document.createElement('div');
      hostHead.className = 'nr-profile-tr-rail-head';
      const hostTitle = document.createElement('h3');
      hostTitle.className = 'nr-profile-tr-rail-title';
      hostTitle.textContent = cachedHostMeet.title;
      hostHead.appendChild(hostTitle);
      hostHead.appendChild(
        createProfileHostMeetBadgeEl(
          cachedHostMeet.badgeText,
          cachedHostMeet.badgeVariant,
          hex,
          nip05Resolved,
          trUser
        )
      );
      refs.hostMount.appendChild(hostHead);
      appendProfileHostMeetBody(refs.hostMount, cachedHostMeet);
    }
  } else {
    const hostMeet = hostMeetSnapshot(
      notesSorted,
      viewState.evHost30398 || [],
      validatedMapNoteCount,
      hex,
      notesReady,
      host303Ready
    );
    const hostHead = document.createElement('div');
    hostHead.className = 'nr-profile-tr-rail-head';
    const hostTitle = document.createElement('h3');
    hostTitle.className = 'nr-profile-tr-rail-title';
    hostTitle.textContent = hostMeet.title;
    hostHead.appendChild(hostTitle);
    hostHead.appendChild(
      createProfileHostMeetBadgeEl(hostMeet.badgeText, hostMeet.badgeVariant, hex, nip05Resolved, trUser)
    );
    refs.hostMount.appendChild(hostHead);
    appendProfileHostMeetBody(refs.hostMount, hostMeet);
    if (hostMeet.badgeText !== '…' && hostMeet.badgeVariant !== 'muted' && Array.isArray(hostMeet.rows) && hostMeet.rows.length > 0) {
      saveProfileHostMeetCardToCache(hex, hostMeet);
    }
  }

  refs.trustMount.replaceChildren();
  function appendTrustStatRow(label, value) {
    const row = document.createElement('p');
    row.className = 'nr-profile-muted';
    row.style.marginTop = refs.trustMount.childNodes.length ? '0.35rem' : '0';
    row.textContent = `${value} ${label}${value === 1 ? '' : 's'}`;
    refs.trustMount.appendChild(row);
  }
  function appendTrustConnectedPeople(people) {
    const shown = people;
    if (!shown.length) return;
    const title = document.createElement('p');
    title.className = 'nr-profile-tr-trust-mini-title';
    title.textContent = 'Contacts & Experiences';
    refs.trustMount.appendChild(title);
    const list = document.createElement('div');
    list.className = 'nr-profile-tr-trust-contact-list';
    for (const contact of shown) {
      const a = document.createElement('a');
      a.className = 'nr-profile-tr-trust-contact';
      const nip05Label = trustCardPersonNip05(contact, pubkeyToNip05.get(contact.hex));
      a.href = nip05Label ? profileHashFromSegment(nip05Label) : publicProfileHashForHex(contact.hex);
      const npubLabel = hexToNpub(contact.hex);
      const keyLabel = npubLabel ? formatPubkeyShort(npubLabel) : formatPubkeyShort(contact.hex);
      a.title = npubLabel || contact.hex;
      const pic = sanitizeProfileImageUrl(pubkeyToPicture.get(contact.hex));
      const label = nip05Label || keyLabel;
      if (pic) {
        const img = document.createElement('img');
        img.className = 'nr-profile-tr-trust-contact-avatar';
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.src = pic;
        img.addEventListener('error', () => {
          const ph = document.createElement('span');
          ph.className = 'nr-profile-tr-trust-contact-avatar nr-profile-tr-trust-contact-avatar--placeholder';
          ph.textContent = label.slice(0, 1).toUpperCase() || '?';
          img.replaceWith(ph);
        }, { once: true });
        a.appendChild(img);
      } else {
        const ph = document.createElement('span');
        ph.className = 'nr-profile-tr-trust-contact-avatar nr-profile-tr-trust-contact-avatar--placeholder';
        ph.textContent = label.slice(0, 1).toUpperCase() || '?';
        a.appendChild(ph);
      }
      const text = document.createElement('span');
      text.className = 'nr-profile-tr-trust-contact-label';
      text.textContent = label;
      a.appendChild(text);
      list.appendChild(a);
    }
    refs.trustMount.appendChild(list);
  }
  if (!claimsReady && !trustSummaryReady) {
    const p = document.createElement('p');
    p.className = 'nr-profile-tr-skeleton';
    p.textContent = 'Loading trust summary…';
    refs.trustMount.appendChild(p);
  } else if (isSelfHex(hex)) {
    const hasAnyTrustStat = confirmedContactCount > 0 || positiveReferenceCount > 0 || showThreadUpvoteMetric;
    if (!hasAnyTrustStat) {
      const p = document.createElement('p');
      p.className = 'nr-profile-muted';
      p.textContent = 'No imported trust stats found yet.';
      refs.trustMount.appendChild(p);
    } else {
      appendTrustStatRow('Trustroots Contact', confirmedContactCount);
      appendTrustStatRow('positive Experience', positiveReferenceCount);
      if (showThreadUpvoteMetric) appendTrustStatRow('upvoted thread', threadUpvoteMetric);
      appendTrustConnectedPeople(connectedPubkeyPeople);
    }
  } else if (!rels.length && !exps.length && !connectedPubkeyPeople.length) {
    const p = document.createElement('p');
    p.className = 'nr-profile-muted';
    p.textContent = !showThreadUpvoteMetric
      ? 'No relationship, experience, or thread-upvote metrics found on your relays yet.'
      : 'No relationship or experience suggestions found on your relays yet.';
    refs.trustMount.appendChild(p);
    if (showThreadUpvoteMetric) {
      const metricRow = document.createElement('p');
      metricRow.className = 'nr-profile-muted';
      metricRow.style.marginTop = '0.35rem';
      metricRow.textContent = `${threadUpvoteMetric} upvoted thread${threadUpvoteMetric === 1 ? '' : 's'}`;
      refs.trustMount.appendChild(metricRow);
    }
  } else {
    if (confirmedContactCount > 0) appendTrustStatRow('Trustroots Contact', confirmedContactCount);
    else if (rels.length) appendTrustStatRow('relationship suggestion', rels.length);
    if (positiveReferenceCount > 0) appendTrustStatRow('positive Experience', positiveReferenceCount);
    else if (exps.length) appendTrustStatRow('experience suggestion', exps.length);
    if (showThreadUpvoteMetric) {
      const metricRow = document.createElement('p');
      metricRow.className = 'nr-profile-muted';
      metricRow.style.marginTop = '0.35rem';
      metricRow.textContent = `${threadUpvoteMetric} upvoted thread${threadUpvoteMetric === 1 ? '' : 's'}`;
      refs.trustMount.appendChild(metricRow);
    }
    appendTrustConnectedPeople(connectedPubkeyPeople);
  }

  refs.circListMount.replaceChildren();
  const circlesReady = p90Ready || host303Ready || authorsReady || slugsText.length > 0;
  if (!circlesReady) {
    const p = document.createElement('p');
    p.className = 'nr-profile-tr-skeleton';
    p.textContent = 'Loading profile hashtags and Trustroots circles…';
    refs.circListMount.appendChild(p);
  } else {
    const slugs98 = host303Ready ? extractCircleSlugsFromHostReposts30398(viewState.evHost30398 || [], hex) : [];
    const slugs90 = p90Ready ? extractCircleSlugsFromProfileClaim30390(viewState.evP30390 || [], hex) : [];
    const slugSet = new Set();
    for (const s of [...slugs90, ...slugs98]) {
      const k = normalizeTrustrootsCircleSlugKey(s);
      if (k) slugSet.add(k);
    }
    for (const s of slugsText) {
      if (s) slugSet.add(s);
    }
    const slugs = Array.from(slugSet).sort();
    const slugsKey = slugs.join('\0');

    if (!slugs.length) {
      ctx.circleDirSlugsKey = '';
      viewState.circleMetaBySlug = new Map();
    } else if (slugsKey !== ctx.circleDirSlugsKey) {
      ctx.circleDirSlugsKey = slugsKey;
      viewState.circleMetaBySlug = undefined;
      const importPub = circleImportToolPubkeyHex();
      void loadCachedCircleDirectoryMap(importPub, slugs)
        .then((cachedMap) => {
          if (!cachedMap || !cachedMap.size) return;
          if (ctx.circleDirSlugsKey !== slugsKey) return;
          viewState.circleMetaBySlug = cachedMap;
          ctx.scheduleBump?.();
        })
        .catch(() => {});
      void collectCircleDirectoryForSlugs(slugs)
        .then((events) => {
          const map = new Map();
          const pub = importPub;
          for (const ev of events || []) {
            mergeCircleMetadataMapEntry(map, ev, { expectedPubkey: pub, kind: TRUSTROOTS_CIRCLE_META_KIND });
          }
          viewState.circleMetaBySlug = map;
          void saveCachedCircleDirectoryMap(pub, slugs, map);
          ctx.scheduleBump?.();
        })
        .catch((e) => {
          console.warn('[nr-profile] circle directory (30410)', e);
          if (viewState.circleMetaBySlug === undefined) {
            viewState.circleMetaBySlug = new Map();
          }
          ctx.scheduleBump?.();
        });
    }

    const metaMap = viewState.circleMetaBySlug;
    if (!slugs.length) {
      const p = document.createElement('p');
      p.className = 'nr-profile-muted';
      p.textContent =
        'No profile hashtags or Trustroots circle memberships found on your relays yet.';
      refs.circListMount.appendChild(p);
    } else {
      for (const slug of slugs) {
        const row = document.createElement('div');
        row.className = 'nr-profile-tr-circ-row';
        const m = metaMap && metaMap.get(slug);
        const name = (m && m.name) || slug;
        const pic = m && m.picture ? String(m.picture) : '';
        row.appendChild(renderCircleThumbNode(pic, slug, m && m.trustrootsSlug ? String(m.trustrootsSlug) : ''));
        const body = document.createElement('div');
        body.className = 'nr-profile-tr-circ-row-text';
        const a = document.createElement('a');
        a.className = 'nr-profile-tr-circ-name';
        a.href = hashRouteFromSegment(slug);
        a.textContent = `#${name}`;
        body.appendChild(a);
        if (m && m.about) {
          const ab = document.createElement('p');
          ab.className = 'nr-profile-tr-circ-about';
          ab.textContent = truncateBody(m.about, 140);
          body.appendChild(ab);
        }
        row.appendChild(body);
        refs.circListMount.appendChild(row);
      }
    }
  }

}

/**
 * @param {string} profileId - npub, hex, or nip05 (decoded)
 */
async function renderPublicProfile(profileId) {
  const renderToken = beginProfileRender(profileId, 'public');
  const prep = await prepareProfileRootResolved(profileId, renderToken);
  if (!prep) return;
  if (!isProfileRenderCurrent(renderToken)) return;
  const { root, hex } = prep;
  const safeProfileId = String(profileId || '').trim();

  const npub = (() => {
    try {
      const s = String(hex || '').toLowerCase();
      if (s.length !== 64 || !/^[0-9a-f]+$/.test(s)) return '';
      const bytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) bytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
      return nip19.npubEncode(bytes);
    } catch (_) {
      return '';
    }
  })();

  try {
    const earlyTrUser = trustrootsLocalFromProfileId(profileId);

    const titleGuess = profileTitleGuess(profileId, npub, hex);
    const handleGuess = profileHandleGuess(profileId, earlyTrUser, npub, hex);
    const nip05Guess = profileNip05Guess(profileId, earlyTrUser);

    const viewState = {
      evAuthors: undefined,
      evP30390: undefined,
      evPClaims: undefined,
      evNotes: undefined,
      evHost30398: undefined,
      trustSummary: undefined,
      circleMetaBySlug: undefined,
      avatarExtra: '',
    };
    const ctx = { hex, npub, profileId, earlyTrUser, circleDirSlugsKey: '' };
    const avatarRequestedUsers = new Set();
    const requestTrustrootsAvatar = (username) => {
      const u = String(username || '').trim().toLowerCase();
      if (!u || avatarRequestedUsers.has(u)) return;
      avatarRequestedUsers.add(u);
      void tryTrustrootsApiAvatar(u).then((pic) => {
        if (!isProfileRenderCurrent(renderToken)) return;
        if (!pic || viewState.avatarExtra === pic) return;
        viewState.avatarExtra = pic;
        bump();
      }).catch(() => {});
    };
    ctx.onTrustrootsUsernameResolved = requestTrustrootsAvatar;

    const { shell, refs } = createStagedProfileShell(root, {
      hex,
      npub,
      profileId,
      earlyTrUser,
      titleGuess,
      handleGuess,
      nip05Guess,
    });

    const bump = () => {
      if (!isProfileRenderCurrent(renderToken)) return;
      try {
        applyStagedProfileView(refs, viewState, ctx);
      } catch (e) {
        console.warn('[nr-profile] staged profile apply', e);
      }
    };
    ctx.scheduleBump = bump;
    bump();
    if (earlyTrUser) requestTrustrootsAvatar(earlyTrUser);

    bindBasicEditAction(refs.nameEditBtn, 'Profile header');
    bindBasicEditAction(refs.aboutEditBtn, 'About');

    const tryMountOwnClaimSection = () => {
      if (!isProfileRenderCurrent(renderToken)) return false;
      if (!isSelfHex(hex)) return false;
      try {
        window.NrWebMountClaimTrustrootsSection?.();
      } catch (e) {
        console.warn('[nr-profile] mount claim section on own public profile', e);
      }
      return true;
    };
    if (!tryMountOwnClaimSection()) {
      // NIP-07 restore may finish just after initial profile render on refresh.
      // Retry briefly so own-profile claim tools still appear without manual navigation.
      [120, 400, 1000].forEach((delayMs) => {
        setTimeout(() => {
          void tryMountOwnClaimSection();
        }, delayMs);
      });
    }

    viewState.fetchDiag = { sources: [], authDiag: [] };
    const trackUnauth = async (label, filter) => {
      try {
        const got = await collectFromRelays(filter);
        viewState.fetchDiag.sources.push({ label, count: (got || []).length });
        bump();
        return got;
      } catch (e) {
        viewState.fetchDiag.sources.push({ label, count: 0, error: String(e?.message || e) });
        bump();
        return [];
      }
    };
    const trackAuth = async (label, filter) => {
      try {
        const got = await collectFromNip42RelayAuth(filter, 4500, viewState.fetchDiag.authDiag);
        viewState.fetchDiag.sources.push({ label, count: (got || []).length });
        bump();
        return got;
      } catch (e) {
        viewState.fetchDiag.sources.push({ label, count: 0, error: String(e?.message || e) });
        bump();
        return [];
      }
    };

    // Per-pubkey IndexedDB cache: paint the page from the previous visit instantly,
    // then merge fresh relay results when they arrive (replaceable events with newer
    // `created_at` win via pickLatest, so stale cache cannot mask updates).
    const normalizeCachedProfileEvents = (cached) => ({
      evAuthors: Array.isArray(cached?.evAuthors) ? cached.evAuthors : [],
      evP30390: Array.isArray(cached?.evP30390) ? cached.evP30390 : [],
      evPClaims: Array.isArray(cached?.evPClaims) ? cached.evPClaims : [],
      evNotes: Array.isArray(cached?.evNotes) ? cached.evNotes : [],
      evHost30398: Array.isArray(cached?.evHost30398) ? cached.evHost30398 : [],
    });
    const cachedProfilePromise = loadProfilePageEventsFromCache(hex).catch((e) => {
      console.warn('[nr-profile] cache load failed:', e);
      return null;
    });
    const cachedTrustSummaryPromise = loadProfileTrustSummaryFromCache(hex).catch((e) => {
      console.warn('[nr-profile] trust summary cache load failed:', e);
      return null;
    });
    void cachedTrustSummaryPromise.then((summary) => {
      if (!isProfileRenderCurrent(renderToken)) return;
      if (!summary || viewState.evPClaims !== undefined) return;
      viewState.trustSummary = summary;
      bump();
    });
    void cachedProfilePromise.then((cached) => {
      if (!isProfileRenderCurrent(renderToken)) return;
      if (!cached) return;
      const normalized = normalizeCachedProfileEvents(cached);
      let painted = false;
      if (viewState.evAuthors === undefined && normalized.evAuthors.length) {
        viewState.evAuthors = dedupeById(normalized.evAuthors);
        painted = true;
      }
      if (viewState.evP30390 === undefined && normalized.evP30390.length) {
        viewState.evP30390 = dedupeById(normalized.evP30390);
        painted = true;
      }
      if (viewState.evPClaims === undefined && normalized.evPClaims.length) {
        viewState.evPClaims = dedupeById(normalized.evPClaims);
        painted = true;
      }
      if (viewState.evNotes === undefined && normalized.evNotes.length) {
        viewState.evNotes = dedupeById(normalized.evNotes);
        painted = true;
      }
      if (viewState.evHost30398 === undefined && normalized.evHost30398.length) {
        viewState.evHost30398 = dedupeById(normalized.evHost30398);
        painted = true;
      }
      if (painted) bump();
    });

    const fetchTasks = [];
    // kind 0 / 10390 — fetch unauth and auth so a kind 0 living only on the auth relay is still seen.
    fetchTasks.push((async () => {
      const [byUnauth, byAuth, cached] = await Promise.all([
        trackUnauth('0+10390 authors=hex [unauth]', buildProfileMetadataFilter([hex], { limit: 30 })),
        trackAuth('0+10390 authors=hex [auth]', buildProfileMetadataFilter([hex], { limit: 30 })),
        cachedProfilePromise,
      ]);
      if (!isProfileRenderCurrent(renderToken)) return;
      viewState.evAuthors = dedupeById([
        ...(byUnauth || []),
        ...(byAuth || []),
        ...(cached?.evAuthors || []),
      ]);
      bump();
    })());

    fetchTasks.push((async () => {
      const queries = [
        trackUnauth('30390 #p [unauth]', { kinds: [PROFILE_CLAIM_KIND], '#p': [hex], limit: 20 }),
        trackUnauth('30390 authors=hex [unauth]', { kinds: [PROFILE_CLAIM_KIND], authors: [hex], limit: 20 }),
        trackAuth('30390 #p [auth]', { kinds: [PROFILE_CLAIM_KIND], '#p': [hex], limit: 120 }),
        trackAuth('30390 authors=hex [auth]', { kinds: [PROFILE_CLAIM_KIND], authors: [hex], limit: 120 }),
      ];
      if (earlyTrUser) {
        queries.push(
          trackUnauth('30390 #l=trUser [unauth]', { kinds: [PROFILE_CLAIM_KIND], '#l': [earlyTrUser], limit: 40 }),
          trackAuth('30390 #l=trUser [auth]', { kinds: [PROFILE_CLAIM_KIND], '#l': [earlyTrUser], limit: 120 }),
          trackUnauth('30390 broad scan [unauth]', { kinds: [PROFILE_CLAIM_KIND], limit: 1200 }),
          trackAuth('30390 broad scan [auth]', { kinds: [PROFILE_CLAIM_KIND], limit: 1200 })
        );
        const importPub = circleImportToolPubkeyHex();
        if (importPub) {
          queries.push(
            trackUnauth('30390 authors=importer [unauth]', {
              kinds: [PROFILE_CLAIM_KIND],
              authors: [importPub],
              limit: 1200,
            })
          );
        }
      }
      const [results, cached] = await Promise.all([Promise.all(queries), cachedProfilePromise]);
      if (!isProfileRenderCurrent(renderToken)) return;
      const normalized = normalizeCachedProfileEvents(cached);
      viewState.evP30390 = dedupeById([...results.flat(), ...normalized.evP30390]);
      bump();
    })());
    fetchTasks.push((async () => {
      const filter = { kinds: [RELATIONSHIP_CLAIM_KIND, EXPERIENCE_CLAIM_KIND, THREAD_UPVOTE_METRIC_KIND], '#p': [hex], limit: 1000 };
      const [byUnauth, byAuth, cached] = await Promise.all([
        trackUnauth('30392/30393/30394 #p [unauth]', filter),
        trackAuth('30392/30393/30394 #p [auth]', { ...filter, limit: 1500 }),
        cachedProfilePromise,
      ]);
      if (!isProfileRenderCurrent(renderToken)) return;
      const normalized = normalizeCachedProfileEvents(cached);
      viewState.evPClaims = dedupeById([
        ...(byUnauth || []),
        ...(byAuth || []),
        ...normalized.evPClaims,
      ]);
      bump();
    })());
    fetchTasks.push((async () => {
      const [byUnauth, byAuth, cached] = await Promise.all([
        trackUnauth('30397/30398 authors=hex [unauth]', { kinds: MAP_NOTE_KINDS, authors: [hex], limit: 40 }),
        trackAuth('30397/30398 authors=hex [auth]', { kinds: MAP_NOTE_KINDS, authors: [hex], limit: 120 }),
        cachedProfilePromise,
      ]);
      if (!isProfileRenderCurrent(renderToken)) return;
      const normalized = normalizeCachedProfileEvents(cached);
      viewState.evNotes = dedupeById([
        ...(byUnauth || []),
        ...(byAuth || []),
        ...normalized.evNotes,
      ]);
      bump();
    })());
    const importPub = circleImportToolPubkeyHex();
    const importHex =
      importPub && String(importPub).trim().length === 64 && /^[0-9a-fA-F]+$/.test(String(importPub).trim())
        ? String(importPub).trim().toLowerCase()
        : '';
    if (!importHex) {
      viewState.evHost30398 = [];
      bump();
    } else {
      fetchTasks.push((async () => {
        const [byUnauth, byAuth, cached] = await Promise.all([
          trackUnauth('30398 host-mirror import #p [unauth]', {
            kinds: [MAP_NOTE_REPOST_KIND],
            authors: [importHex],
            '#p': [hex],
            limit: 100,
          }),
          trackAuth('30398 host-mirror import #p [auth]', {
            kinds: [MAP_NOTE_REPOST_KIND],
            authors: [importHex],
            '#p': [hex],
            limit: 160,
          }),
          cachedProfilePromise,
        ]);
        if (!isProfileRenderCurrent(renderToken)) return;
        const normalized = normalizeCachedProfileEvents(cached);
        viewState.evHost30398 = dedupeById([
          ...(byUnauth || []),
          ...(byAuth || []),
          ...normalized.evHost30398,
        ]);
        bump();
      })());
    }

    void Promise.allSettled(fetchTasks).then(() => {
      if (!isProfileRenderCurrent(renderToken)) return;
      const trustSummary = viewState.trustSummary || (
        Array.isArray(viewState.evPClaims)
          ? buildTrustCardSummaryFromEvents(viewState.evPClaims, hex, earlyTrUser)
          : null
      );
      if (trustSummary) {
        void saveProfileTrustSummaryToCache(hex, trustSummary)
          .catch((e) => console.warn('saveProfileTrustSummaryToCache:', e));
      }
      void saveProfilePageEventsToCache(hex, {
        evAuthors: viewState.evAuthors || [],
        evP30390: viewState.evP30390 || [],
        evPClaims: viewState.evPClaims || [],
        evNotes: viewState.evNotes || [],
        evHost30398: viewState.evHost30398 || [],
      }).catch((e) => console.warn('saveProfilePageEventsToCache:', e));
    });
  } catch (err) {
    if (!isProfileRenderCurrent(renderToken)) return;
    console.warn('[nr-profile]', err);
    const reason = String(err?.message || err || '').trim();
    root.innerHTML = `<p class="nr-profile-error">We could not finish loading this profile.</p><p class="nr-profile-muted">Try reloading the page. If this keeps happening, copy this profile link and report it with the error below.</p><p class="nr-profile-muted"><strong>Profile:</strong> ${escapeHtml(safeProfileId || '(empty)')}</p><p class="nr-profile-muted"><strong>Error:</strong> ${escapeHtml(reason || 'Unknown rendering error')}</p>`;
  }
}

function renderInvalidProfile(profileId) {
  const renderToken = beginProfileRender(profileId, 'invalid');
  const root = document.getElementById('nr-profile-root');
  if (!root) return;
  if (!isProfileRenderCurrent(renderToken)) return;
  root.innerHTML = `<p class="nr-profile-error">This profile link is not valid. Use <code>#profile/npub1…</code>, a 64-character hex key, or <code>#profile/user@domain</code> (e.g. Trustroots NIP-05).</p><p class="nr-profile-muted">Fragment: ${escapeHtml(profileId || '')}</p>`;
}

/**
 * Self-only: mount Trustroots claim / relationships / experiences panel (same DOM as Keys).
 * @param {string} profileId
 */
async function renderProfileContacts(profileId) {
  const renderToken = beginProfileRender(profileId, 'contacts');
  const prep = await prepareProfileRootResolved(profileId, renderToken);
  if (!prep) return;
  if (!isProfileRenderCurrent(renderToken)) return;
  const { root, hex } = prep;
  if (!isSelfHex(hex)) {
    renderProfileSelfOnlyGate(
      root,
      hex,
      'Contacts and claim signing are only available on your own profile.',
      'View public profile'
    );
    return;
  }
  root.innerHTML = '';
  const intro = document.createElement('p');
  intro.className = 'nr-profile-muted';
  intro.textContent =
    'Link your Trustroots account in Keys if you have not already, then review relay suggestions and publish signed claims here (same tools as under Keys).';
  root.appendChild(intro);
  try {
    if (!isProfileRenderCurrent(renderToken)) return;
    window.NrWebMountClaimTrustrootsSection?.();
  } catch (e) {
    console.warn('[nr-profile] mount claims', e);
    root.appendChild(document.createTextNode('Could not load the contacts panel.'));
  }
}

/**
 * Self-only: edit Nostr kind 0 metadata (name, about, picture).
 * @param {string} profileId
 */
async function renderProfileEdit(profileId) {
  const renderToken = beginProfileRender(profileId, 'edit');
  const prep = await prepareProfileRootResolved(profileId, renderToken);
  if (!prep) return;
  if (!isProfileRenderCurrent(renderToken)) return;
  const { root, hex } = prep;
  if (!isSelfHex(hex)) {
    renderProfileSelfOnlyGate(
      root,
      hex,
      'You can only edit your own Nostr profile metadata.',
      'View public profile'
    );
    return;
  }

  let meta = {};
  try {
    const evs = await collectFromRelays({ kinds: [0], authors: [hex], limit: 20 });
    if (!isProfileRenderCurrent(renderToken)) return;
    const ev0 = pickLatest(evs, 0, hex);
    if (ev0?.content) meta = JSON.parse(ev0.content);
  } catch (_) {
    meta = {};
  }
  if (!isProfileRenderCurrent(renderToken)) return;
  if (typeof meta !== 'object' || meta === null) meta = {};

  root.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'nr-profile-card nr-profile-edit-card';

  const title = document.createElement('h2');
  title.className = 'nr-profile-section-title';
  title.textContent = 'Nostr profile (kind 0)';
  card.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'nr-profile-muted';
  hint.textContent =
    'Display name, about text, and picture URL are published to your relays as a new kind 0 event. Other fields from your latest profile are kept when you save.';
  card.appendChild(hint);

  const form = document.createElement('form');
  form.className = 'nr-profile-edit-form';

  function fieldRow(labelText, inputEl) {
    const row = document.createElement('div');
    row.className = 'nr-profile-field';
    const lab = document.createElement('label');
    lab.textContent = labelText;
    row.appendChild(lab);
    row.appendChild(inputEl);
    return row;
  }

  const nameIn = document.createElement('input');
  nameIn.type = 'text';
  nameIn.name = 'name';
  nameIn.autocomplete = 'nickname';
  nameIn.value = String(meta.name || '');
  form.appendChild(fieldRow('Display name', nameIn));

  const aboutIn = document.createElement('textarea');
  aboutIn.name = 'about';
  aboutIn.rows = 4;
  aboutIn.value = String(meta.about || '');
  form.appendChild(fieldRow('About', aboutIn));

  const picIn = document.createElement('input');
  picIn.type = 'url';
  picIn.name = 'picture';
  picIn.placeholder = 'https://…';
  picIn.value = String(meta.picture || '');
  form.appendChild(fieldRow('Picture URL', picIn));

  const statusEl = document.createElement('p');
  statusEl.className = 'nr-profile-muted nr-profile-edit-status';
  statusEl.setAttribute('role', 'status');
  form.appendChild(statusEl);

  const actions = document.createElement('div');
  actions.className = 'nr-profile-edit-actions';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn';
  saveBtn.textContent = 'Save to relays';
  actions.appendChild(saveBtn);
  form.appendChild(actions);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';
    const pub = window.NrWebPublishKind0Metadata;
    if (typeof pub !== 'function') {
      statusEl.textContent = 'Publishing is not available yet. Reload the page and try again.';
      return;
    }
    const next = { ...meta, name: nameIn.value.trim(), about: aboutIn.value, picture: picIn.value.trim() };
    saveBtn.disabled = true;
    try {
      await pub(next);
      statusEl.textContent = 'Saved. Relays may take a moment to show the update.';
      meta = next;
    } catch (err) {
      statusEl.textContent = err && err.message ? String(err.message) : 'Save failed.';
    } finally {
      saveBtn.disabled = false;
    }
  });

  card.appendChild(form);
  root.appendChild(card);
}

    return {
      renderPublicProfile,
      renderInvalidProfile,
      renderProfileContacts,
      renderProfileEdit,
      pickLatestMapNotesByIntentType,
      hostMeetSnapshot,
      profileAboutHtmlWithHashtagLinks,
      extractProfileHashtagSlugsFromMeta,
    };
})();
export const renderPublicProfile = __nrProfilePage.renderPublicProfile;
export const renderInvalidProfile = __nrProfilePage.renderInvalidProfile;
export const renderProfileContacts = __nrProfilePage.renderProfileContacts;
export const renderProfileEdit = __nrProfilePage.renderProfileEdit;
export const pickLatestMapNotesByIntentType = __nrProfilePage.pickLatestMapNotesByIntentType;
export const hostMeetSnapshot = __nrProfilePage.hostMeetSnapshot;
export const profileAboutHtmlWithHashtagLinks = __nrProfilePage.profileAboutHtmlWithHashtagLinks;
export const extractProfileHashtagSlugsFromMeta = __nrProfilePage.extractProfileHashtagSlugsFromMeta;
