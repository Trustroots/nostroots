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
} from 'https://cdn.jsdelivr.net/npm/nostr-tools@2.23.0/+esm';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.2.2/+esm';

// Import BIP39 for mnemonic support
import { mnemonicToSeedSync, validateMnemonic } from 'https://cdn.jsdelivr.net/npm/bip39@3.1.0/+esm';

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
    { id: 'hosting',        label: 'Hosting',          hint: 'I can host travelers' },
    { id: 'lookingforhost', label: 'Looking for host', hint: 'I need a place to stay' },
    { id: 'wanttomeet',     label: 'Want to meet',     hint: 'Social meetup, no hosting' },
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

let dbPromise = null;

export function chatCacheKvKey(pubkeyHex) {
    return 'nostroots_chat_cache_' + pubkeyHex;
}

export function openNrWebKvDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
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
    const db = await openNrWebKvDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(NR_WEB_KV_STORE, 'readwrite');
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();
        tx.objectStore(NR_WEB_KV_STORE).put({ k: key, v: value });
    });
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
  return hex.length === 64 && /^[0-9a-f]+$/.test(hex) ? hex : null;
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

export function parseCircleMetaContent(jsonStr) {
    try {
        const o = JSON.parse(jsonStr || '{}');
        return {
            name: String(o.name || '').trim(),
            about: String(o.about || '').trim(),
            picture: String(o.picture || '').trim()
        };
    } catch (_) {
        return { name: '', about: '', picture: '' };
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
 * @param {Map<string, object>} map - slug -> { name, about, picture, created_at, eventId }
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
    map.set(slug, {
        name: parsed.name || slug,
        about: parsed.about,
        picture: parsed.picture,
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
        return bytesToHex(d.data);
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

function ensureNrWebKvPrefsHydrated() {
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
    } else {
        let migrated = [];
        if (_nrKvNotificationCodes !== null && Array.isArray(_nrKvNotificationCodes)) {
            migrated = _nrKvNotificationCodes;
        } else {
            try {
                const raw = localStorage.getItem(NOTIFICATION_PLUS_CODES_KEY);
                migrated = raw ? JSON.parse(raw) : [];
            } catch (_) {
                migrated = [];
            }
            if (!Array.isArray(migrated)) migrated = [];
            _nrKvNotificationCodes = migrated;
        }
        await nrWebKvPut(NR_WEB_KV_KEYS.NOTIFICATION_PLUS_CODES, migrated);
    }
    try {
        localStorage.removeItem(NOTIFICATION_PLUS_CODES_KEY);
    } catch (_) {}

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
const FOLLOW_LIST_KIND = 3;
const TRUSTROOTS_CONTACT_SET_KIND = 30000;
const NIP32_LABEL_KIND = 1985;
const MAP_NOTE_KINDS = [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND];
const DELETION_KIND = 5; // NIP-05: Deletion events
const TRUSTROOTS_PROFILE_KIND = 10390;
// TRUSTROOTS_USERNAME_LABEL_NAMESPACE comes from folded claim-utils.js block above.
const DEFAULT_RELAY_URL = 'wss://nip42.trustroots.org';
const DEFAULT_RELAYS = (window.NrWebRelaySettings?.getDefaultRelays?.() || ['wss://nip42.trustroots.org', 'wss://relay.trustroots.org', 'wss://relay.nomadwiki.org']);
const DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH = 2;

let nrChatBooted = false;
function ensureChatEmbeddedReady() {
    if (!nrChatBooted) {
        nrChatBooted = true;
        try {
            bootEmbeddedChat();
        } catch (err) {
            console.warn('[nr-web] embedded chat boot failed', err);
        }
    }
    return Promise.resolve();
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

function isAuthRequiredError(errorMessage) {
    return (errorMessage || '').toLowerCase().includes('auth-required');
}

async function signEventTemplate(eventTemplate) {
    if (currentPrivateKeyBytes) {
        return finalizeEvent(eventTemplate, currentPrivateKeyBytes);
    }
    throw new Error('No signing method available for relay authentication');
}

function hasRelayAuthSigningCapability() {
    return !!currentPrivateKeyBytes;
}

async function authenticateRelay(relay, relayUrl, challenge) {
    if (!challenge) {
        throw new Error('Missing NIP-42 challenge');
    }
    const authTemplate = {
        kind: NIP42_AUTH_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['relay', relayUrl],
            ['challenge', challenge]
        ],
        content: ''
    };
    if (currentPublicKey) {
        authTemplate.pubkey = currentPublicKey;
    }
    const signedAuth = await signEventTemplate(authTemplate);
    await relay.auth(signedAuth);
}

/**
 * One-shot REQ to a single relay. Subscribes, collects events via `onEvent`, closes
 * on EOSE or after `waitMs`. Always closes the subscription and relay socket.
 * Errors and EOSE timeouts resolve quietly so callers can wrap in `Promise.allSettled`.
 */
async function oneshotQuery(url, filter, { onEvent, waitMs = 2000 } = {}) {
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
                    const challenge = a;
                    const authTemplate = {
                        kind: NIP42_AUTH_KIND,
                        created_at: Math.floor(Date.now() / 1000),
                        tags: [
                            ['relay', url],
                            ['challenge', challenge]
                        ],
                        content: '',
                        pubkey: signedEvent.pubkey
                    };
                    const signedAuth = await signEventTemplate(authTemplate);
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
            latestAuthPromise = authenticateRelay(relay, relayUrl, challenge);
            await latestAuthPromise;
            if (typeof options.onAuthenticated === 'function') {
                options.onAuthenticated();
            }
        } catch (error) {
            const errorMessage = error?.message || String(error);
            console.error(`[Relay] NIP-42 auth failed for ${relayUrl}:`, errorMessage);
        }
    };
    
    // nostr-tools relay APIs differ across versions:
    // some expose relay.on('auth', ...), others expose relay.onauth callback.
    if (typeof relay?.on === 'function') {
        relay.on('auth', authHandler);
    } else if ('onauth' in relay) {
        relay.onauth = authHandler;
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

// Map to store pubkey -> Trustroots username (kind 10390 label)
const pubkeyToUsername = new Map();
/** Pubkey hex -> lowercase Trustroots NIP-05 (kind 0 nip05 or kind 30390 import). */
const pubkeyToNip05 = new Map();
/** Pubkey hex -> profile picture URL (kind 0 and 30390). */
const pubkeyToPicture = new Map();
/** Lowercase hex pubkeys with an in-flight relay profile fetch (npub mentions in map notes). */
const mentionProfilePrefetchInFlight = new Set();

function sanitizeProfileImageUrl(url) {
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
    if (pic) pubkeyToPicture.set(String(event.pubkey || '').toLowerCase(), pic);
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
    if (pic) pubkeyToPicture.set(subjectHex, pic);
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

function closeRelaysArray(list) {
    (list || []).forEach((r) => {
        try { r?.close?.(); } catch (_) {}
    });
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
let selectedCircle = null; // Selected Trustroots circle slug
let selectedIntent = null; // Selected map-note intent (see note-intents.js)
const NR_WEB_LAST_INTENT_KEY = 'nr-web.lastIntent';

function getClaimKinds() {
    return [PROFILE_CLAIM_KIND, HOST_CLAIM_KIND, RELATIONSHIP_CLAIM_KIND, EXPERIENCE_CLAIM_KIND];
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

// Map notes use two paths: (1) raw WebSocket + NIP-42 via startWsMapSubscriptions for
// long-lived reads and compatibility with some relays; (2) nostr-tools Relay + setupRelayAuthHandler
// in initializeRelays for shared long-lived connections used by publishToRelayWithRetries.
// Both call processIncomingEvent; duplicate EVENTs are deduped by id.

function startWsMapSubscriptions(relayUrls) {
    const relayAuth = window.NrWebRelayAuth;
    if (!relayAuth?.startNip42WsSubscription) return;
    closeWsMapSubscriptions();
    relayUrls.forEach((url) => {
        try {
            const sub = relayAuth.startNip42WsSubscription({
                relayUrl: url,
                filter: { kinds: MAP_NOTE_KINDS, limit: 10000 },
                authPubkey: currentPublicKey,
                signEvent: async (eventTemplate) => signEventTemplate(eventTemplate),
                onEvent: (event) => {
                    if (event && MAP_NOTE_KINDS.includes(event.kind)) {
                        processIncomingEvent(event);
                    }
                },
                onAuthChallenge: () => {},
                onAuthSuccess: () => {},
                onAuthFail: () => {}
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
function setHashRoute(route) {
    const encoded = route ? encodeURIComponent(route).replace(/%2B/g, '+') : '';
    const want = encoded ? '#' + encoded : '';
    if (location.hash !== want) location.hash = want;
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
    const mapView = document.getElementById('map-view');
    const chatView = document.getElementById('nr-chat-view');
    const profileView = document.getElementById('nr-profile-view');

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

    function showMapShell() {
        restoreAllClaimsProfileUi();
        document.body.classList.remove('nr-surface-chat');
        document.body.classList.remove('nr-surface-profile');
        if (profileView) {
            profileView.hidden = true;
            profileView.style.display = 'none';
        }
        if (mapView) mapView.style.display = '';
        if (chatView) {
            chatView.hidden = true;
            chatView.style.display = 'none';
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
        if (profileView) {
            profileView.hidden = true;
            profileView.style.display = 'none';
        }
        document.body.classList.add('nr-surface-chat');
        if (mapView) mapView.style.display = 'none';
        if (chatView) {
            chatView.hidden = false;
            chatView.style.display = 'flex';
        }
        try {
            if (window.NrWeb && typeof window.NrWeb.fillAppHeader === 'function') {
                window.NrWeb.fillAppHeader();
            }
        } catch (_) {}
    }
    async function showProfileShell(profileId, invalid, mode) {
        const m = mode || 'public';
        if (m !== 'contacts') restoreAllClaimsProfileUi();
        document.body.classList.remove('nr-surface-chat');
        document.body.classList.add('nr-surface-profile');
        if (mapView) mapView.style.display = 'none';
        if (chatView) {
            chatView.hidden = true;
            chatView.style.display = 'none';
        }
        if (profileView) {
            profileView.hidden = false;
            profileView.style.display = 'flex';
        }
        try {
            if (window.NrWeb && typeof window.NrWeb.fillAppHeader === 'function') {
                window.NrWeb.fillAppHeader();
            }
        } catch (_) {}
        if (invalid) {
            renderInvalidProfile(profileId);
            return;
        }
        if (m === 'contacts') {
            renderProfileContacts(profileId);
            return;
        }
        if (m === 'edit') {
            void renderProfileEdit(profileId);
            return;
        }
        void renderPublicProfile(profileId);
    }

    if (c.kind === 'map_home') {
        showMapShell();
        closePlusCodeNotesModal(true);
        return;
    }
    if (c.kind === 'modal') {
        showMapShell();
        closePlusCodeNotesModal(true);
        const keysEl = document.getElementById('keys-modal');
        const settingsEl = document.getElementById('settings-modal');
        if (c.modal === 'keys') {
            if (settingsEl) settingsEl.classList.remove('active');
            openKeysModal();
        } else if (c.modal === 'settings') {
            if (keysEl) keysEl.classList.remove('active');
            openSettingsModal();
        }
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
            return;
        }
        if (c.token === 'chat') {
            await ensureChatEmbeddedReady();
            showChatShell();
            closePlusCodeNotesModal(true);
            await applyEmbeddedChatRoute('', { emptyPicker: true });
            return;
        }
        if (c.token === 'help') {
            showMapShell();
            if (typeof openHelpModal === 'function') openHelpModal();
            return;
        }
        if (c.token === 'welcome' || c.token === 'start') {
            showMapShell();
            closePlusCodeNotesModal(true);
            const keysEl2 = document.getElementById('keys-modal');
            const settingsEl2 = document.getElementById('settings-modal');
            if (settingsEl2) settingsEl2.classList.remove('active');
            if (keysEl2) keysEl2.classList.remove('active');
            openKeysModal();
            return;
        }
        showMapShell();
        return;
    }
    if (c.kind === 'map_pluscode') {
        const pNorm = normalizePlusCodeForHashSuppress(c.plusCode);
        if (nrMapPlusCodeSuppressedUntil && nrMapPlusCodeSuppressedUntil === pNorm) {
            nrMapPlusCodeSuppressedUntil = null;
            return;
        }
        showMapShell();
        const keysEl3 = document.getElementById('keys-modal');
        const settingsEl3 = document.getElementById('settings-modal');
        if (keysEl3) keysEl3.classList.remove('active');
        if (settingsEl3) settingsEl3.classList.remove('active');
        showNotesForPlusCode(c.plusCode);
        return;
    }
    if (c.kind === 'profile' || c.kind === 'profile_edit' || c.kind === 'profile_contacts' || c.kind === 'profile_invalid' || c.kind === 'profile_self') {
        closePlusCodeNotesModal(true);
        if (c.kind === 'profile_self') {
            if (!currentPublicKey) {
                showMapShell();
                openKeysModal();
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
        await showProfileShell(c.profileId, c.kind === 'profile_invalid', mode);
        return;
    }
    if (c.kind === 'chat') {
        await ensureChatEmbeddedReady();
        showChatShell();
        closePlusCodeNotesModal(true);
        await applyEmbeddedChatRoute(c.chatRoute, {});
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
    showStatus('New key pair generated!', 'success');
}

async function importNsec() {
    const nsecInput = document.getElementById('nsec-import').value.trim();
    const parsed = parseKeyImportToHex(nsecInput);
    if (!parsed.ok) {
        showStatus(getKeyImportErrorMessage(nsecInput), 'error');
        return;
    }
    try {
        savePrivateKey(parsed.hex);
        if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
            window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'imported');
            window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, true);
        }
        loadKeys();
        showStatus('nsec imported. Looking up your kind 0 profile information...', 'info');
        await checkProfileLinked();
        showStatus('nsec imported successfully!', 'success');
        document.getElementById('nsec-import').value = '';
    } catch (error) {
        showStatus('Error importing nsec: ' + error.message, 'error');
    }
}

function savePrivateKey(privateKeyHex) {
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
        
        showStatus('Public key copied to clipboard!', 'success');
        
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
    if (!confirm('Are you sure you want to delete your private key? This action cannot be undone. You will need to import or generate a new key to continue using the app.')) {
        return;
    }
    const deletedPubkey = currentPublicKey;
    clearClaimSignDoneForPubkey(deletedPubkey);
    
    clearStoredKey();
    currentPrivateKey = null;
    currentPrivateKeyBytes = null;
    currentPublicKey = null;
    if (typeof window.NrWebTheme !== 'undefined') {
        window.NrWebTheme.registerThemePublish(null);
    }
    window.NrWebKeysModal?.clearKeySourceForPubkey?.(deletedPubkey);
    window.NrWebKeysModal?.clearKeyBackedUpForPubkey?.(deletedPubkey);
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
    showStatus('Private key deleted', 'success');
    
    // Show onboarding modal again
    openKeysModal();
}

function updateKeyDisplay(options = {}) {
    const keysModal = window.NrWebKeysModal;
    let npub = '';
    let npubError = '';
    const keySource = keysModal?.getKeySourceForPubkey?.(currentPublicKey) || '';
    const showChecklist = keySource === 'generated';
    const isNsecBackedUp = keysModal?.isKeyBackedUpForPubkey?.(currentPublicKey) === true;
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
            isNsecBackedUp
        });
    }
    if (currentPublicKey && options.skipProfileLookup !== true) checkProfileLinked();
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
    if (currentPublicKey && window.NrWeb && typeof window.NrWeb.updateNrNavAccountAvatars === 'function') {
        pic =
            sanitizeProfileImageUrl(pubkeyToPicture.get(String(currentPublicKey).toLowerCase())) || '';
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

document.addEventListener('nrweb-app-header-filled', function () {
    try {
        applyNrNavAccountAvatarForActiveSurface();
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
    return (url || '').trim().toLowerCase() === TRUSTROOTS_RESTRICTED_RELAY_URL;
}

function canUseRestrictedRelay() {
    return !!currentPrivateKeyBytes && isProfileLinked === true;
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
    showStatus('Relays saved! Reconnecting...', 'info');
    initializeNDK();
}

function updateRelayStatus(url, status, canWrite = null) {
    const current = relayStatus.get(url) || { status: 'disconnected', canWrite: false };
    relayStatus.set(url, {
        status: status,
        canWrite: canWrite !== null ? canWrite : current.canWrite
    });
    renderRelaysList();
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
            publicMessage: 'PUBLIC posting is enabled for at least one relay. Anything you post there is publicly visible.'
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
    showStatus('Relay added! Reconnecting...', 'info');
    initializeNDK();
}

function removeRelay(url) {
    if (!confirm(`Remove relay ${url}?`)) {
        return;
    }
    
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
    showStatus('Relay removed! Reconnecting...', 'info');
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

function getNotificationPlusCodes() {
    if (_nrKvNotificationCodes !== null) return _nrKvNotificationCodes;
    try {
        const raw = localStorage.getItem(NOTIFICATION_PLUS_CODES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveNotificationPlusCodes(codes) {
    _nrKvNotificationCodes = Array.isArray(codes) ? codes : [];
    try {
        localStorage.removeItem(NOTIFICATION_PLUS_CODES_KEY);
    } catch (_) {}
    void ensureNrWebKvPrefsHydrated()
        .then(() => nrWebKvPut(NR_WEB_KV_KEYS.NOTIFICATION_PLUS_CODES, _nrKvNotificationCodes))
        .catch((e) => console.warn('Failed to persist notification plus codes:', e));
}

function addNotificationPlusCode(plusCode) {
    const codes = getNotificationPlusCodes();
    if (codes.includes(plusCode)) return;
    saveNotificationPlusCodes([...codes, plusCode]);
}

function removeNotificationPlusCode(plusCode) {
    saveNotificationPlusCodes(getNotificationPlusCodes().filter(c => c !== plusCode));
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

function renderSettingsNotificationsSection() {
    const el = document.getElementById('settings-notifications-section');
    if (!el) return;
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    const enabled = isNotificationsEnabled();
    const count = getNotificationPlusCodes().length;
    el.innerHTML = `
        <h2>Notifications</h2>
        <p class="notifications-tab-notice" style="color: var(--muted-foreground); font-size: 0.875rem; margin-bottom: 0.75rem;">
            Notifications only work while this tab is open. You won't get alerts when the tab is closed.
        </p>
        <p style="font-size: 0.875rem; margin-bottom: 0.5rem;">Permission: ${perm}. Subscribed areas: ${count}.</p>
        ${perm === 'default' ? '<p style="font-size: 0.875rem; margin-bottom: 0.5rem; color: var(--muted-foreground);">Click Enable to allow this site to show notifications.</p>' : ''}
        ${perm === 'denied' ? '<p style="font-size: 0.875rem; margin-bottom: 0.5rem; color: var(--muted-foreground);">Notifications are blocked. Use your browser’s site settings (e.g. lock or info icon in the address bar) to allow notifications, then refresh.</p>' : ''}
        ${perm !== 'granted' ? `
            <button class="btn" onclick="requestNotificationPermission()">Enable notifications</button>
        ` : `
            ${enabled ? '<button class="btn" style="margin-right: 0.5rem;" onclick="setNotificationsEnabled(false); renderSettingsNotificationsSection();">Disable notifications</button>' : '<button class="btn" onclick="setNotificationsEnabled(true); renderSettingsNotificationsSection();">Turn notifications on</button>'}
        `}
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
        const notesModal = document.getElementById('pluscode-notes-modal');
        if (notesModal && notesModal.classList.contains('active') && selectedPlusCode) {
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
        return true;
    }
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
                if (!window._nostrootsSuppressConnectionToasts) showStatus(`Connected to ${connectedCount} relay(s)`, 'success', { id: 'relay-connection-status' });
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
    
    for (const url of connectableRelayUrls) {
        try {
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
                const kinds = [0, DELETION_KIND, TRUSTROOTS_PROFILE_KIND, ...MAP_NOTE_KINDS];
                
                // First, do a direct query for map note events to see how many exist
                let directQueryCount = 0;
                const directQuery = relay.subscribe([{ kinds: MAP_NOTE_KINDS }], {
                    onevent: (event) => {
                        directQueryCount++;
                        // Process these events too
                        processIncomingEvent(event);
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
                        processIncomingEvent(event);
                    },
                    oneose: () => {
                        // EOSE received
                    }
                });
                
                // Query for existing kind 10390 profile events to populate username map
                const profileQuery = relay.subscribe([{ kinds: [TRUSTROOTS_PROFILE_KIND] }], {
                    onevent: (event) => {
                        processIncomingEvent(event);
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
                    relay.subscribe([{ kinds: [0, DELETION_KIND, TRUSTROOTS_PROFILE_KIND, ...MAP_NOTE_KINDS], limit: 1 }], {
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
    const connectedCount = relays.length;
    const totalCount = connectableRelayUrls.length;
    const failedCount = totalCount - connectedCount;
    
    if (connectedCount > 0) {
        if (!window._nostrootsSuppressConnectionToasts) {
            if (failedCount > 0) {
                showStatus(`Connected to ${connectedCount} of ${totalCount} relay(s)`, 'success', { id: 'relay-connection-status' });
            } else {
                showStatus(`Connected to ${connectedCount} relay(s)`, 'success', { id: 'relay-connection-status' });
            }
        }
        // Subscribe to plus code prefixes
        subscribeToPlusCodePrefixes();
    } else {
        if (!window._nostrootsSuppressConnectionToasts) showStatus(`Failed to connect to any relays`, 'error', { id: 'relay-connection-status' });
    }
}

function subscribeToEvents() {
    if (ndk) {
        // Use NDK subscription - profiles/deletions plus map notes and reposts.
        const kinds = [0, DELETION_KIND, TRUSTROOTS_PROFILE_KIND, ...MAP_NOTE_KINDS];
        
        const filter = {
            kinds: kinds
        };
        
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
                            processIncomingEvent(event);
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

function removeLegacyEventsLocalStorageCache() {
    try {
        localStorage.removeItem(EVENTS_CACHE_KEY);
        localStorage.removeItem(EVENTS_CACHE_TIMESTAMP_KEY);
    } catch (_) {}
}

function slimEventForCache(event) {
    if (!event || typeof event !== 'object') return null;
    return {
        id: event.id,
        pubkey: event.pubkey,
        kind: event.kind,
        created_at: event.created_at,
        content: event.content != null ? String(event.content) : '',
        tags: Array.isArray(event.tags) ? event.tags : []
    };
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

function processIncomingEvent(event) {
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
            const notesModal = document.getElementById('pluscode-notes-modal');
            if (notesModal && notesModal.classList.contains('active') && selectedPlusCode) {
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
        
        // If it's the same event ID, skip (already have it)
        if (existingEvent.id === event.id) {
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
            const notesModal = document.getElementById('pluscode-notes-modal');
            if (notesModal && notesModal.classList.contains('active') && selectedPlusCode && plusCode) {
                const eventMatches = plusCode === selectedPlusCode || 
                                    isPlusCodeInsidePlusCode(selectedPlusCode, plusCode);
                if (eventMatches) {
                    setTimeout(() => {
                        showNotesForPlusCode(selectedPlusCode);
                    }, 150);
                }
            }
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
    
    const eventData = {
        id: event.id,
        kind: event.kind,
        pubkey: event.pubkey,
        content: event.content,
        created_at: event.created_at,
        tags: event.tags,
        sig: event.sig,
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
    const notesModal = document.getElementById('pluscode-notes-modal');
    const isModalActive = notesModal && notesModal.classList.contains('active');
    
    // Try to get the plus code from the modal title if selectedPlusCode is not set
    let modalPlusCode = selectedPlusCode;
    if (isModalActive && !modalPlusCode) {
        const titleElement = document.getElementById('pluscode-notes-title');
        if (titleElement) {
            // Extract plus code from title like "X notes for 5G000000+"
            const titleText = titleElement.textContent;
            const match = titleText.match(/for\s+([A-Z0-9]+\+)/);
            if (match && match[1]) {
                modalPlusCode = match[1];
            }
        }
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

function linkifyTrustrootsUrls(html) {
    return html.replace(
        /https:\/\/(?:www\.)?trustroots\.org\/[^\s<)]+/gi,
        (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="nr-content-link">${url}</a>`
    );
}

// containsPrivateKeyNsec(text, nip19) is provided by the folded nsec-guard.js block above.

/**
 * After escapeHtml: replace bech32 npubs with Trustroots NIP-05 labels and #profile links when we have
 * a matching kind 0 / 30390 NIP-05 or kind 10390 username (same resolution as note author line).
 * Run on plain text before linkifyHashtags so #profile/… in href is not treated as a hashtag.
 */
function linkifyNpubsWithKnownTrustrootsProfiles(html) {
    if (!html || typeof nip19 === 'undefined' || !nip19.decode) return html || '';
    return html.replace(/\bnpub1[023456789acdefghjkmnpqrstuvwxyz]{20,}\b/gi, (npubStr) => {
        const hex = npubToHex(npubStr);
        if (!hex) return npubStr;
        let nip05 = (pubkeyToNip05.get(hex) || '').trim().toLowerCase();
        if (!nip05 || !isTrustrootsNip05Lower(nip05)) {
            const u = pubkeyToUsername.get(hex);
            if (u) nip05 = `${String(u).trim().toLowerCase()}@trustroots.org`;
        }
        if (!nip05 || !isTrustrootsNip05Lower(nip05)) return npubStr;
        const href = '#profile/' + encodeURIComponent(nip05).replace(/%2B/g, '+');
        return `<a href="${href}" class="nr-content-link" title="${escapeHtml(npubStr)}">${escapeHtml(nip05)}</a>`;
    });
}

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
        const modal = document.getElementById('pluscode-notes-modal');
        if (
            upgraded &&
            modal &&
            modal.classList.contains('active') &&
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
                            kinds: [0, PROFILE_CLAIM_KIND, TRUSTROOTS_PROFILE_KIND],
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

function getPlusCodeFromEvent(event) {
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
    modal('pluscode-notes-modal').close();
    document.getElementById('note-content-in-modal').value = '';
    document.getElementById('note-expiration-in-modal').value = getExpirationSetting();
    // Clear selected circle when closing modal
    clearSelectedCircle('modal');
    // Clear selected plus code and update grid to remove highlight
    selectedPlusCode = null;
    if (!skipHashUpdate) setHashRoute('');
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
    if (!currentPrivateKeyBytes) {
        showStatus('No private key available. Please import or generate a key.', 'error');
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
        signedEvent = finalizeEvent(eventTemplate, currentPrivateKeyBytes);
        
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
            showStatus('No relays enabled for posting. Enable "Post" toggle for at least one relay.', 'error');
            return;
        }
        
        const publishPromises = relayUrls.map(url => publishToRelayWithRetries(url, signedEvent));
        const results = await Promise.all(publishPromises);
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success).map(r => ({ url: r.url, error: r.error }));
        
        if (successful.length > 0) {
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

function showNotesForPlusCode(plusCode, options = {}) {
    selectedPlusCode = plusCode;
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

    void prefetchTrustrootsProfilesForNoteMentions([...collectMapNoteMentionNpubHexes(sortedAll)], plusCode);
    
    // Update modal title
    document.getElementById('pluscode-notes-title').textContent = 
        `${sortedAll.length} note${sortedAll.length !== 1 ? 's' : ''} for ${plusCode}`;
    
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
        noNotes.innerHTML = '<p style="color: var(--muted-foreground); text-align: center; padding: 2rem;">No notes here yet. You can post the first note for this area, or zoom out and open nearby areas to discover activity.</p>';
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

        // Resolve initial intent: explicit option > sticky last choice > none
        if (Object.prototype.hasOwnProperty.call(options, 'intent')) {
            selectedIntent = isIntentId(options.intent) ? options.intent : null;
            persistStickyIntent(selectedIntent);
        } else if (!selectedIntent) {
            selectedIntent = getStickyIntent();
        }
    }
    renderIntentChips();

    // Update the grid to highlight the selected plus code (moss green) BEFORE panning
    updatePlusCodeGrid();

    // Show modal FIRST so any subsequent fitBounds error never blocks opening it.
    modal('pluscode-notes-modal').open();

    // Pan/zoom map so the selected cell is visible (skipped for e.g. Host & meet — keep viewport).
    if (map && !options.preserveMapView) {
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
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    
    const metaRow = document.createElement('div');
    metaRow.className = 'note-meta-row';
    
    const meta = document.createElement('span');
    meta.className = 'note-meta';
    meta.textContent = formatDate(event.created_at);
    
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
    const trNip05Stored = (pubkeyToNip05.get(authorPk) || '').trim().toLowerCase();
    // Prefer verified Trustroots NIP-05 (kind 0 / 30390); else @username from kind 10390; else npub snippet
    if (trNip05Stored && isTrustrootsNip05Lower(trNip05Stored)) {
        const profileHref = '#profile/' + encodeURIComponent(trNip05Stored).replace(/%2B/g, '+');
        const authorLink = document.createElement('a');
        authorLink.className = 'nr-content-link';
        authorLink.href = profileHref;
        authorLink.textContent = trNip05Stored;
        try {
            const npub = nip19.npubEncode(authorPk);
            authorLink.title = npub;
        } catch (error) {
            authorLink.title = String(authorPk || '').substring(0, 16) + '…';
        }
        author.appendChild(authorLink);
    } else {
    const username = pubkeyToUsername.get(authorPk);
    if (username) {
        const nip05 = `${username}@trustroots.org`.toLowerCase();
        const chatHref = '#profile/' + encodeURIComponent(nip05).replace(/%2B/g, '+');
        const authorLink = document.createElement('a');
        authorLink.className = 'nr-content-link';
        authorLink.href = chatHref;
        authorLink.textContent = `@${username}`;
        try {
            const npub = nip19.npubEncode(authorPk);
            authorLink.title = `@${username} (${npub})`; // Show username and npub on hover
        } catch (error) {
            authorLink.title = `@${username} (${String(authorPk || '').substring(0, 16)}...)`;
        }
        author.appendChild(authorLink);
    } else {
        try {
            const npub = nip19.npubEncode(authorPk);
            author.textContent = npub.substring(0, 12) + '...';
            author.title = npub; // Show full npub on hover
        } catch (error) {
            author.textContent = String(authorPk || '').substring(0, 12) + '...';
        }
    }
    }
    
    // Combine meta, author, expiry, and plus code on same line with pluscode on the right
    metaRow.appendChild(meta);
    metaRow.appendChild(document.createTextNode(' '));
    metaRow.appendChild(author);
    
    // Add expiration indicator if event has expiration
    const remainingSeconds = getRemainingTime(event);
    if (remainingSeconds !== null) {
        const expirySpan = document.createElement('span');
        expirySpan.className = 'note-expiry';
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
        
        metaRow.appendChild(document.createTextNode(' '));
        metaRow.appendChild(expirySpan);
    }
    
    // Check if this is the user's own event (for delete button)
    const isCurrentUser = currentPublicKey && 
        event.pubkey.toLowerCase() === currentPublicKey.toLowerCase();
    
    // Create a wrapper for delete button and plus code (right side of meta row)
    const rightGroup = document.createElement('span');
    rightGroup.style.marginLeft = 'auto';
    rightGroup.style.display = 'flex';
    rightGroup.style.alignItems = 'center';
    rightGroup.style.gap = '0.25rem';
    
    // Add delete button if this is the user's own event
    if (isCurrentUser) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'note-delete-btn';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Delete this note';
        deleteBtn.setAttribute('data-note-id', event.id);
        
        deleteBtn.addEventListener('click', () => {
            deleteEvent(event.id, deleteBtn);
        });
        
        rightGroup.appendChild(deleteBtn);
    }
    
    if (plusCode) {
        const plusCodeSpan = document.createElement('span');
        plusCodeSpan.className = 'note-meta';
        plusCodeSpan.style.fontFamily = 'monospace';
        plusCodeSpan.style.color = 'var(--primary)';
        plusCodeSpan.textContent = plusCode;
        rightGroup.appendChild(plusCodeSpan);
    }

    const relayScope = event?.relayScope;
    if (relayScope === 'public' || relayScope === 'auth') {
        const relayScopePill = document.createElement('span');
        relayScopePill.className = 'note-relay-scope-pill';
        relayScopePill.textContent = relayScope === 'public' ? '🌍' : '🔐';
        relayScopePill.title = relayScope === 'public'
            ? 'Published to public relay(s)'
            : 'Published to auth-required relay(s)';
        rightGroup.appendChild(relayScopePill);
    }
    
    metaRow.appendChild(rightGroup);
    noteItem.appendChild(metaRow);

    const intentId = detectNoteIntent(event);
    const intent = intentId ? getIntentById(intentId) : null;
    const visibleContent = intentId
        ? stripLeadingIntentHashtag(event.content || '', intentId)
        : (event.content || '');

    const content = document.createElement('div');
    content.className = 'note-content';
    if (intent) {
        const badge = document.createElement('span');
        badge.className = `nr-note-intent-badge nr-note-intent-${intent.id}`;
        badge.textContent = intent.label;
        badge.title = intent.hint;
        content.appendChild(badge);
        content.appendChild(document.createTextNode(' '));
    }
    const textSpan = document.createElement('span');
    textSpan.innerHTML = linkifyTrustrootsUrls(
        linkifyNpubsWithKnownTrustrootsProfiles(linkifyHashtags(escapeHtml(visibleContent)))
    );
    content.appendChild(textSpan);
    noteItem.appendChild(content);

    return noteItem;
}

async function deleteEvent(eventId, deleteButton) {
    if (!currentPrivateKeyBytes) {
        showStatus('No private key available. Please import or generate a key.', 'error');
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
        deleteButton.textContent = '⏳ DELETING...';
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
        signedEvent = finalizeEvent(deletionEvent, currentPrivateKeyBytes);
        
        // Publish only to relays that have posting enabled.
        const relayUrls = getWritableRelayUrls();
        
        if (relayUrls.length === 0) {
            showStatus('No relays enabled for posting. Enable "Post" toggle for at least one relay.', 'error');
            return;
        }
        
        if (deleteButton && relayUrls.length > 0) {
            deleteButton.textContent = `⏳ SENDING TO ${relayUrls.length} RELAYS...`;
        }
        
        const publishPromises = relayUrls.map(async (url, index) => {
            try {
                if (deleteButton && relayUrls.length > 1) {
                    deleteButton.textContent = `⏳ SENDING TO RELAY ${index + 1}/${relayUrls.length}...`;
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
        
        // Update button to show completion
        if (deleteButton) {
            deleteButton.textContent = '✅ DELETED!';
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
        showStatus(`Note deleted on ${successCount} relays`, 'success');
        
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
            deleteButton.textContent = '🗑️ DELETE';
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

// Check if profile is linked (has kind 10390 event)
async function checkProfileLinked() {
    if (!currentPublicKey) {
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
    
    try {
        const relayUrls = getRelayUrls();
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
            const TRUSTROOTS_USERNAME_LABEL_NAMESPACE = 'org.trustroots:username';
            for (const tag of event.tags || []) {
                if (tag[0] === 'l' && tag[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE && tag[1]) {
                    linkedUsername = tag[1];
                    break;
                }
            }
        };
        
        // Check each relay for kind 10390 events
        const checkPromises = relayUrls.map(async (url) => {
            try {
                if (
                    isRestrictedRelayUrl(url) &&
                    currentPrivateKeyBytes &&
                    relayAuth?.nip42SubscribeOnce
                ) {
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
                await oneshotQuery(url, profileFilter, {
                    onEvent: (event) => applyProfileEvent(event),
                    waitMs: 2000,
                });
            } catch (error) {
                console.error(`Error checking profile link on ${url}:`, error);
            }
        });
        
        await Promise.allSettled(checkPromises);
        
        // Track if we cleared a username due to validation failure
        let usernameWasCleared = false;
        
        // If we found a linked username, validate it against NIP-05
        if (linkedUsername && currentPublicKey) {
            try {
                const response = await fetch(`https://www.trustroots.org/.well-known/nostr.json?name=${linkedUsername}`);
                const data = await response.json();
                
                // Check if the username is valid and matches this pubkey
                if (data.names && data.names[linkedUsername]) {
                    const nip5Pubkey = data.names[linkedUsername];
                    const currentPubkeyHex = currentPublicKey.toLowerCase();
                    const nip5PubkeyHex = nip5Pubkey.toLowerCase();
                    
                    // If the pubkeys don't match, clear the username
                    if (currentPubkeyHex !== nip5PubkeyHex) {
                        console.warn(`Username ${linkedUsername} from Nostr does not match NIP-05 verification. Clearing.`);
                        usernameWasCleared = true;
                        linkedUsername = null;
                        foundLinked = false;
                    }
                } else {
                    // No valid NIP-05 found for this username, clear it
                    console.warn(`Username ${linkedUsername} from Nostr has no valid NIP-05. Clearing.`);
                    usernameWasCleared = true;
                    linkedUsername = null;
                    foundLinked = false;
                }
            } catch (error) {
                // If validation fails, clear the username to be safe
                console.warn(`Error validating username ${linkedUsername} from Nostr:`, error);
                usernameWasCleared = true;
                linkedUsername = null;
                foundLinked = false;
            }
        }
        
        const wasProfileLinked = isProfileLinked;
        isProfileLinked = foundLinked;
        if (!isProfileLinked) {
            claimEventsByKind = new Map();
        } else if (currentPrivateKeyBytes) {
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

function truncateClaimBody(s, max) {
    if (s == null || s === undefined) return '';
    const t = String(s).trim();
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + '…';
}

function getClaimSummaryCounts() {
    return {
        profile: (claimEventsByKind.get(PROFILE_CLAIM_KIND) || []).length,
        hosts: (claimEventsByKind.get(HOST_CLAIM_KIND) || []).length,
        relationships: (claimEventsByKind.get(RELATIONSHIP_CLAIM_KIND) || []).length,
        experiences: (claimEventsByKind.get(EXPERIENCE_CLAIM_KIND) || []).length
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

    const countH = (claimEventsByKind.get(HOST_CLAIM_KIND) || []).length;
    const countRel = (claimEventsByKind.get(RELATIONSHIP_CLAIM_KIND) || []).length;
    const countExp = (claimEventsByKind.get(EXPERIENCE_CLAIM_KIND) || []).length;
    const claimsP = claimEventsByKind.get(PROFILE_CLAIM_KIND) || [];

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
        claimEventsByKind.get(HOST_CLAIM_KIND) || [],
        'Nothing loaded yet. Mirrored hosting usually appears as kind 30398 with your pubkey in a "p" tag.',
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
        claimEventsByKind.get(RELATIONSHIP_CLAIM_KIND) || [],
        'No relationship suggestions yet (kind 30392). They appear when Trustroots has mirrored a contact suggestion for you—counterparty may show as a pubkey or a Trustroots username until both sides have keys.',
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
        claimEventsByKind.get(EXPERIENCE_CLAIM_KIND) || [],
        'No experience suggestions yet (kind 30393). They appear when a mirrored positive experience exists for your account; the other person may appear as a pubkey or a Trustroots username until they have a key on Trustroots.',
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
    label.textContent = 'Signing sends to';
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
        s.title = 'Auth relay (nip42.trustroots.org, NIP-42) — publishing requires your nsec and a linked Trustroots identity.';
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
    const canShow =
        (!!currentPublicKey && !!currentPrivateKeyBytes && isProfileLinked === true) ||
        (onProfileClaims && !!currentPublicKey && !!currentPrivateKeyBytes);
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
    summary.textContent = `Profiles: ${counts.profile} | Hosting: ${counts.hosts} | Relationships: ${counts.relationships} | Experiences: ${counts.experiences}`;
    renderClaimDetailBlocks();
}

function scheduleRefreshClaimSuggestions() {
    if (!currentPublicKey || !currentPrivateKeyBytes) return;
    if (isProfileLinked !== true && window.NrWebClaimsUiSurface !== 'profile') return;
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
    if (!currentPrivateKeyBytes) {
        return;
    }
    if (isProfileLinked !== true && window.NrWebClaimsUiSurface !== 'profile') {
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
    if (!currentPrivateKeyBytes) throw new Error('No private key available');
    if (eventTemplate?.kind === MAP_NOTE_KIND && containsPrivateKeyNsec(String(eventTemplate?.content || ''), nip19)) {
        throw new Error('Posting blocked: notes cannot include nsec private keys.');
    }
    const signedEvent = finalizeEvent(eventTemplate, currentPrivateKeyBytes);
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
    if (!NT || !currentPrivateKeyBytes || !currentPublicKey || !nip44) return;
    const relayUrls = getConnectableRelayUrls(getRelayUrls());
    if (!relayUrls.length) return;
    const filter = [{
        kinds: [NT.NRWEB_THEME_KIND],
        authors: [currentPublicKey],
        '#d': [NT.NRWEB_THEME_D_TAG],
        limit: 10
    }];
    let best = null;
    for (const url of relayUrls) {
        await oneshotQuery(url, filter, {
            onEvent: (ev) => {
                if (!best || ev.created_at > best.created_at) best = ev;
            },
            waitMs: 4000,
        });
    }
    if (best) {
        const parsed = NT.parseThemeFromKind78Event(best, nip44, currentPrivateKeyBytes, currentPublicKey);
        if (parsed) NT.mergeThemeFromRemote(parsed);
    }
}

async function setupIndexNrWebThemeSync() {
    const NT = window.NrWebTheme;
    if (!NT) return;
    if (!currentPrivateKeyBytes || !currentPublicKey) {
        NT.registerThemePublish(null);
        return;
    }
    NT.registerThemePublish(async (theme) => {
        try {
            const tpl = NT.createThemeEventTemplate(theme, nip44, currentPrivateKeyBytes, currentPublicKey);
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
    const claims = claimEventsByKind.get(PROFILE_CLAIM_KIND) || [];
    if (!claims.length) {
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
    const claims = claimEventsByKind.get(HOST_CLAIM_KIND) || [];
    if (!claims.length) {
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
    const claims = claimEventsByKind.get(RELATIONSHIP_CLAIM_KIND) || [];
    if (!claims.length) {
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
    const claims = claimEventsByKind.get(EXPERIENCE_CLAIM_KIND) || [];
    if (!claims.length) {
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
function _openKeysModalShared({ hasKey, route = 'keys', onOpenManagedSection }) {
    const keysModal = window.NrWebKeysModal;
    if (keysModal?.openKeysModal) {
        keysModal.openKeysModal({ hasKey, route, setRoute: setHashRoute, onOpenManagedSection });
        return;
    }
    const keysEl = document.getElementById('keys-modal');
    if (keysEl) keysEl.classList.add('active');
    setHashRoute(route);
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

function _openSettingsModalShared({ extraSetup } = {}) {
    const keysEl = document.getElementById('keys-modal');
    const settingsEl = document.getElementById('settings-modal');
    if (keysEl) keysEl.classList.remove('active');
    if (settingsEl) settingsEl.classList.add('active');
    setHashRoute('settings');
    if (typeof renderSettingsNotificationsSection === 'function') renderSettingsNotificationsSection();
    window.NrWeb?.applySettingsFooterMetadataFromCache?.();
    window.NrWeb?.refreshSettingsFooterMetadata?.();
    if (typeof extraSetup === 'function') extraSetup();
}

function _closeSettingsModalShared({ fallbackRoute }) {
    const el = document.getElementById('settings-modal');
    if (el) el.classList.remove('active');
    setHashRoute(fallbackRoute);
}

function openKeysModal(options = {}) {
    _openKeysModalShared({
        hasKey: !!(currentPublicKey || currentPrivateKey),
        onOpenManagedSection: () => {
            try { window.NrWebUnmountClaimTrustrootsSection?.(); } catch (_) {}
            updateKeyDisplay();
        },
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

function openHostNoteFlow() {
    function run() {
        if (!map) {
            setTimeout(run, 200);
            return;
        }
        const c = map.getCenter();
        const b = map.getBounds && map.getBounds();
        let hostCodeLength = 6;
        if (b && typeof b.getNorth === 'function' && typeof b.getSouth === 'function' && typeof b.getEast === 'function' && typeof b.getWest === 'function') {
            const latDelta = Math.abs(b.getNorth() - b.getSouth());
            const lngDelta = Math.abs(b.getEast() - b.getWest());
            const viewLength = whatLengthOfPlusCodeToShow(latDelta, lngDelta);
            // Host flow should open a sensible area, not an overly precise micro-cell.
            hostCodeLength = Math.max(4, Math.min(6, viewLength || 6));
        }
        const pc = encodePlusCode(c.lat, c.lng, hostCodeLength);
        showNotesForPlusCode(pc, {
            initialContent: '',
            preserveMapView: true,
            intent: 'hosting'
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
        if (welcomeOn) {
            try {
                location.hash = '#welcome';
            } catch (_) {}
        } else if (startOn) {
            try {
                location.hash = '#start';
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
window.requestNotificationPermission = requestNotificationPermission;
window.setNotificationsEnabled = setNotificationsEnabled;
window.renderSettingsNotificationsSection = renderSettingsNotificationsSection;
window.refreshClaimSuggestions = refreshClaimSuggestions;
window.updateClaimRelayScopeRow = updateClaimRelayScopeRow;
window.claimProfileData = claimProfileData;
window.claimHostingOffers = claimHostingOffers;
window.claimRelationships = claimRelationships;
window.claimExperiences = claimExperiences;

// Onboarding

function checkOnboarding() {
    const hasKey = readValidStoredKeyHex();
    if (!hasKey) {
        openKeysModal();
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

async function onboardingImport() {
    const input = document.getElementById('onboarding-import').value.trim();
    const parsed = parseKeyImportToHex(input);
    if (!parsed.ok) {
        showStatus(getKeyImportErrorMessage(input), 'error');
        return;
    }

    const wasMnemonic = input.includes(' ');
    try {
        savePrivateKey(parsed.hex);
        if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
            window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'imported');
            window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, true);
        }
        loadKeys();
        openKeysModal({ runProfileLookup: false });
        const noun = wasMnemonic ? 'Mnemonic' : 'nsec';
        showStatus(`${noun} imported. Looking up your kind 0 profile information...`, 'info');
        await checkProfileLinked();
        showStatus(`${noun} imported successfully!`, 'success');
    } catch (error) {
        const noun = wasMnemonic ? 'mnemonic' : 'nsec';
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
        alert('Your npub has been copied to the clipboard. Please paste this npub into the Nostr field on Trustroots.');
        
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
    if (!username) {
        showStatus('Please enter a username', 'error');
        return;
    }
    
    // Check if user has a key loaded
    if (!currentPublicKey) {
        showStatus('Please generate or import a key first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`https://www.trustroots.org/.well-known/nostr.json?name=${username}`);
        const data = await response.json();
        
        // Check for nip5 validation - only proceed if valid
        if (data.names && data.names[username]) {
            const nip5Pubkey = data.names[username];
            
            // Normalize both pubkeys to lowercase hex for comparison
            const currentPubkeyHex = currentPublicKey.toLowerCase();
            const nip5PubkeyHex = nip5Pubkey.toLowerCase();
            
            // Verify the pubkey matches - only store/publish if valid
            if (currentPubkeyHex === nip5PubkeyHex) {
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
                
                if (currentPrivateKeyBytes) {
                    signedEvent = finalizeEvent(eventTemplate, currentPrivateKeyBytes);
                } else {
                    showStatus('No signing method available. Please import or generate a key.', 'error');
                    return;
                }
                
                // Publish to all relays (only those with Post enabled)
                const relayUrls = getWritableRelayUrls();
                
                if (relayUrls.length === 0) {
                    showStatus('No relays enabled for posting. Enable "Post" toggle for at least one relay.', 'error');
                    return;
                }
                
                const publishPromises = relayUrls.map(url => publishToRelayWithRetries(url, signedEvent));
                const results = await Promise.all(publishPromises);
                const successful = results.filter(r => r.success);
                const failed = results.filter(r => !r.success).map(r => ({ url: r.url, error: r.error }));
                
                if (successful.length > 0) {
                    const relayWord = successful.length === 1 ? 'relay' : 'relays';
                    let statusMessage = `Profile linked! Username ${username} published to ${successful.length} ${relayWord}. You can now close this modal and explore the app. Make sure your nsec is safely backed up (for example in your password manager).`;
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
            // No valid nip5 found - don't store username
            showStatus('Username not found or has no valid nip5', 'error');
        }
    } catch (error) {
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

// Initialize on load
window.addEventListener('load', async () => {
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
                if (e.target.id === 'keys-modal') {
                    closeKeysModal();
                }
            });
        }
        
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target.id === 'settings-modal') {
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
    
    // Close pluscode-notes modal when clicking outside
    const pluscodeNotesModal = document.getElementById('pluscode-notes-modal');
    if (pluscodeNotesModal) {
        pluscodeNotesModal.addEventListener('click', (e) => {
            if (e.target.id === 'pluscode-notes-modal') {
                closePlusCodeNotesModal();
            }
        });
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
    function loadDataWhenReady() {
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
        void applyUnifiedHash();
    });
    document.addEventListener('nostroots-modals-injected', () => {
        void applyUnifiedHash();
    });
    void applyUnifiedHash();
    setTimeout(() => processNrWebUrlAction(), 900);
});

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

        const MAP_NOTE_KIND = 30397;
        const MAP_NOTE_REPOST_KIND = 30398;
        const PROFILE_CLAIM_KIND = 30390;
        const TRUSTROOTS_PROFILE_KIND = 10390;
        const TRUSTROOTS_USERNAME_LABEL_NAMESPACE = 'org.trustroots:username';
        const TRUSTROOTS_USERNAME_CACHE_STORAGE_KEY = 'trustroots_username_by_pubkey';
        const DEFAULT_RELAY_URL = 'wss://nip42.trustroots.org';
        const DEFAULT_RELAYS = (window.NrWebRelaySettings?.getDefaultRelays?.() || ['wss://nip42.trustroots.org', 'wss://relay.trustroots.org', 'wss://relay.nomadwiki.org']);
        const TRUSTROOTS_CIRCLE_LABEL = 'trustroots-circle';
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
            // Must match kind 30410 `d` tags (lowercase) so circle metadata pictures resolve.
            return normalized;
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
        /** @type {Map<string, { name: string, about: string, picture: string, created_at: number, eventId: string }>} */
        const circleMetaBySlug = new Map();

        const TRUSTROOTS_CIRCLE_SLUGS_SET = new Set(
            getTrustrootsCircles()
                .map((c) => normalizeTrustrootsCircleSlugKey(c.slug))
                .filter(Boolean)
        );

        function trustrootsCirclePictureFallback(slug) {
            const key = normalizeTrustrootsCircleSlugKey(slug);
            if (!key) return '';
            if (!TRUSTROOTS_CIRCLE_SLUGS_SET.has(key)) return '';
            return `https://www.trustroots.org/uploads-circle/${encodeURIComponent(key)}/1400x900.webp`;
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
            const key = normalizeTrustrootsCircleSlugKey(slug);
            if (!key) return false;
            if (circleMetaBySlug.has(key)) return true;
            return TRUSTROOTS_CIRCLE_SLUGS_SET.has(key);
        }

        function isTrustrootsCircleConversation(entry) {
            if (!entry || entry.type !== 'channel') return false;
            const idRaw = String(entry.id || '').trim();
            if (!idRaw) return false;
            const idKey = normalizeTrustrootsCircleSlugKey(idRaw);
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
                        normalizeTrustrootsCircleSlugKey(t[1]) === idKey
                );
                if (row) return true;
            }
            return false;
        }

        let selectedConversationId = null;
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
                    publicMessage: 'PUBLIC posting is enabled. Messages sent there are publicly visible.',
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
                        .filter(ev => !isBlocked(ev.pubkey))
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
                    const normalizedConversationId = normalizeChannelSlug(String(c.id || ''));
                    if (c.type === 'channel' && normalizedConversationId === 'global') {
                        // Migration: legacy caches mirrored all map notes into #global.
                        // Keep only events that explicitly include the global channel slug.
                        const explicitGlobalEvents = events.filter((ev) =>
                            getChannelSlugsFromEvent(ev.raw || {}).includes('global')
                        );
                        if (!explicitGlobalEvents.length) continue;
                        conversations.set(c.id, { type: c.type, id: c.id, members: c.members || [], events: explicitGlobalEvents });
                        continue;
                    }
                    conversations.set(c.id, { type: c.type, id: c.id, members: c.members || [], events });
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
        function getConversationRouteId(id) {
            if (!id) return '';
            const conv = conversations.get(id);
            if (!conv || conv.type !== 'dm') return id;
            const display = (getDisplayName(id) || '').trim();
            if (display.includes('@')) return display.toLowerCase();
            return hexToNpub(id) || id;
        }
        function findConversationIdByRoute(route) {
            const r = (route || '').trim();
            if (!r) return '';
            if (conversations.has(r)) return r;
            const needle = r.toLowerCase();
            for (const [id, conv] of conversations.entries()) {
                if (conv.type !== 'dm') continue;
                if (id === r) return id;
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
            const route = routeForced !== undefined && routeForced !== null ? String(routeForced) : getHashRoute();
            const normalizedRoute = normalizeChannelSlug(route);
            const keysEl = document.getElementById('keys-modal');
            const settingsEl = document.getElementById('settings-modal');
            if (keysEl) keysEl.classList.remove('active');
            if (settingsEl) settingsEl.classList.remove('active');
            if (!route) {
                if (o.emptyPicker) {
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
                const firstConversationId = Array.from(conversations.entries())
                    .map(([id, c]) => ({ id, ...c }))
                    .sort((a, b) => convSortKey(b) - convSortKey(a))[0]?.id;
                if (firstConversationId) {
                    selectConversation(firstConversationId);
                }
                return;
            }
            const mappedConversationId = findConversationIdByRoute(route);
            if (mappedConversationId) {
                const preferredRoute = getConversationRouteId(mappedConversationId);
                if (preferredRoute && route !== preferredRoute) setHashRoute(preferredRoute);
                selectConversation(mappedConversationId);
                return;
            }
            const routeForDmResolve = (route || '').trim();
            if (routeForDmResolve.includes('@')) {
                const dmPubkey = await resolvePubkeyInput(routeForDmResolve);
                if (dmPubkey) {
                    getOrCreateConversation('dm', dmPubkey, [dmPubkey]);
                    const preferredDmRoute = getConversationRouteId(dmPubkey);
                    if (preferredDmRoute && route !== preferredDmRoute) setHashRoute(preferredDmRoute);
                    selectConversation(dmPubkey);
                    return;
                }
            }
            if (normalizedRoute && route !== normalizedRoute) {
                setHashRoute(normalizedRoute);
            }
            if (normalizedRoute && conversations.has(normalizedRoute)) {
                selectConversation(normalizedRoute);
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
                    selectConversation(normalizedRoute);
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

        /** Display name: NIP-05 if known (Trustroots or kind 0), else npub. Never hex. */
        function getDisplayName(hex) {
            if (!hex) return '';
            const trUser = pubkeyToUsername.get(hex);
            if (trUser) return trUser + '@trustroots.org';
            const nip05 = pubkeyToNip05.get(hex);
            if (nip05) return nip05;
            return hexToNpub(hex) || '';
        }

        /** Short form for sidebar: NIP-05 as-is if short, else truncated npub (never hex). */
        function getDisplayNameShort(hex) {
            const full = getDisplayName(hex);
            if (!full) return '';
            if (full.includes('@') && full.length <= 32) return full;
            if (full.length <= 20) return full;
            return full.slice(0, 12) + '…' + full.slice(-8);
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
            return '#profile/' + encodeURIComponent(raw).replace(/%2B/g, '+');
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

        /** Display label for a pubkey (nip5 or npub); used in thread author and meta. */
        function pubkeyDisplayLabel(hex) {
            return getDisplayName(hex) || getDisplayNameShort(hex) || '';
        }

        // hexToNpub lives at module scope; chat re-uses that.

        function getDisplayNpub() {
            if (!currentPublicKey) return '';
            return hexToNpub(currentPublicKey) || '';
        }

        function parsePubkeyInput(input) {
            const s = (input || '').trim();
            if (!s) return null;
            if (/^[0-9a-f]{64}$/i.test(s)) return s;
            try {
                const decoded = nip19.decode(s);
                if (decoded.type === 'nsec') return null;
            } catch (_) {}
            return npubToHex(s) || null;
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
            return !!(currentSecretKeyBytes && currentPublicKey);
        }

        function requireLocalSigningKey() {
            if (hasLocalSigningKey()) return true;
            throw new Error('No local key loaded. Import an nsec to continue.');
        }

        async function loadKeysFromStorage() {
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
            writeStoredKeyHex(hex);
            currentSecretKeyHex = hex;
            currentSecretKeyBytes = secretKeyBytesFromHex64(hex);
            currentPublicKey = getPublicKey(currentSecretKeyBytes);
        }

        function importKey() {
            const raw = (document.getElementById('nsec-import') || document.getElementById('onboarding-import'))?.value?.trim() || '';
            const parsed = parseKeyImportToHex(raw);
            if (!parsed.ok) {
                showStatus(getKeyImportErrorMessage(raw), 'error');
                return;
            }
            savePrivateKey(parsed.hex);
            const nsecImport = document.getElementById('nsec-import');
            const onboardingImport = document.getElementById('onboarding-import');
            if (nsecImport) nsecImport.value = '';
            if (onboardingImport) onboardingImport.value = '';
            closeKeysModal();
            void (async () => {
                await loadKeysFromStorage();
                showStatus('Key imported. Shared with map app.', 'success');
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
                        '';
                    if (pic && !isSafeHttpUrl(pic)) pic = '';
                }
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
            _openKeysModalShared({
                hasKey: !!(currentPublicKey || currentSecretKeyHex),
                onOpenManagedSection: () => {
                    updateKeyDisplay({ skipProfileLookup: true });
                    checkProfileLinked();
                },
            });
        }
        function closeKeysModal() {
            _closeKeysModalShared({ fallbackRoute: getConversationRouteId(selectedConversationId) });
        }

        function openSettingsModal() {
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
                    isNsecBackedUp
                });
            }
            if (currentPublicKey && options.skipProfileLookup !== true) checkProfileLinked();
            setHeaderIdentity();
        }

        function renderSettingsNotificationsSection() { /* no-op on chat */ }

        function onboardingImport() {
            const input = document.getElementById('onboarding-import');
            const raw = (input?.value || '').trim();
            const parsed = parseKeyImportToHex(raw);
            if (!parsed.ok) {
                showStatus(getKeyImportErrorMessage(raw), 'error');
                return;
            }
            savePrivateKey(parsed.hex);
            if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
                window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'imported');
                window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, true);
            }
            if (input) input.value = '';
            void (async () => {
                await loadKeysFromStorage();
                openKeysModal();
            })();
            showStatus('Key imported.', 'success');
        }
        function onboardingGenerate() {
            generateKeyPair();
            openKeysModal();
        }
        function importNsec() {
            const el = document.getElementById('nsec-import');
            const raw = (el?.value || '').trim();
            const parsed = parseKeyImportToHex(raw);
            if (!parsed.ok) {
                showStatus(getKeyImportErrorMessage(raw), 'error');
                return;
            }
            savePrivateKey(parsed.hex);
            if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
                window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'imported');
                window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, true);
            }
            if (el) el.value = '';
            void (async () => {
                await loadKeysFromStorage();
                updateKeyDisplay();
                openKeysModal();
            })();
            showStatus('nsec imported successfully!', 'success');
        }
        function generateKeyPair() {
            const privateKeyHex = bytesToHex(generateSecretKey());
            savePrivateKey(privateKeyHex);
            if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
                window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'generated');
                window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, false);
            }
            void (async () => {
                await loadKeysFromStorage();
            })();
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
            if (!confirm('Delete your private key? You will need to import or generate a new key.')) return;
            const deletedPubkey = currentPublicKey;
            disconnect();
            window.NrWebKeysModal?.clearKeySourceForPubkey?.(deletedPubkey);
            window.NrWebKeysModal?.clearKeyBackedUpForPubkey?.(deletedPubkey);
            updateKeyDisplay();
            openKeysModal();
            showStatus('Private key deleted', 'success');
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
                showStatus('Public key copied to clipboard', 'success');
                setTimeout(() => {
                    if (copyText) copyText.textContent = original;
                    if (copyBtn) copyBtn.classList.remove('copied');
                }, 2000);
            }).catch(() => showStatus('Failed to copy', 'error'));
        }

        function openNewDmModal() {
            modal('new-dm-modal').open();
            const input = document.getElementById('new-dm-pubkey');
            if (input) input.focus();
        }
        function closeNewDmModal() { modal('new-dm-modal').close(); }
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
            if (!currentSecretKeyBytes) return null;
            try {
                const key = nip44.getConversationKey(currentSecretKeyBytes, theirPubkey);
                return key;
            } catch (_) {}
            return null;
        }

        /** Encrypt DM content for a peer. Prefers NIP-44 (then NIP-04 fallback). Returns { cipher, nip } or null. */
        async function encryptKind4(peerPubkey, plaintext) {
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
            if (!NT || !currentSecretKeyBytes || !currentPublicKey || !pool) return;
            NT.registerThemePublish(async (theme) => {
                try {
                    const tpl = NT.createThemeEventTemplate(theme, nip44, currentSecretKeyBytes, currentPublicKey);
                    if (!tpl) return;
                    const signed = finalizeEvent(tpl, currentSecretKeyBytes);
                    const relayList = Array.isArray(relays) && relays.length ? relays : DEFAULT_RELAYS;
                    await pool.publish(relayList, signed);
                } catch (_) {}
            });
            const relayList = Array.isArray(relays) && relays.length ? relays : DEFAULT_RELAYS;
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
                oneose: () => {
                    try { sub.close(); } catch (_) {}
                    if (best) {
                        const parsed = NT.parseThemeFromKind78Event(best, nip44, currentSecretKeyBytes, currentPublicKey);
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
            if (!challenge) return false;
            requireLocalSigningKey();
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
                    ['challenge', challenge]
                ],
                content: '',
                pubkey: currentPublicKey
            };
            return signEvent(authTemplate);
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
            if (relayAuth?.startNip42WsSubscription && currentPublicKey) {
                return relayAuth.startNip42WsSubscription({
                    relayUrl,
                    filter: { kinds: [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND], limit: 10000 },
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
                const filter = { kinds: [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND], limit: 10000 };
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
            initializeRelaySettingsState(relays, 'connecting');
            renderRelaysList();
            if (!pool) pool = new SimplePool();

            renderConvList();
            if (!getHashRoute()) {
                const firstConversationId = Array.from(conversations.entries())
                    .map(([id, c]) => ({ id, ...c }))
                    .sort((a, b) => convSortKey(b) - convSortKey(a))[0]?.id;
                if (firstConversationId) selectConversation(firstConversationId);
            }

            function onChannelEvent(event) {
                const slugs = getChannelSlugsFromEvent(event);
                const mapNoteKey = getMapNoteCanonicalKey(event);

                if (NrBlocklist && NrBlocklist.isBlocked(event.pubkey)) return;

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
                    if (selectedConversationId === targetSlug) scheduleRender('thread');
                });

                if (changed) {
                    scheduleChatCacheWrite();
                    scheduleRender('convList');
                }
            }

            const mapNoteFilter = (extra) => ({ kinds: [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND], limit: 10000, ...extra });
            pool.subscribe(relays, mapNoteFilter({ '#L': [TRUSTROOTS_CIRCLE_LABEL] }), { onevent: onChannelEvent });
            pool.subscribe(relays, mapNoteFilter({ '#t': HOSTING_OFFER_CHANNEL_ALIASES }), { onevent: onChannelEvent });
            pool.subscribe(relays, mapNoteFilter(), { onevent: onChannelEvent });

            closePublicMapRelayConnections();
            relays.forEach((url) => {
                try {
                    const connection = startWsMapSubscription(url, onChannelEvent);
                    publicMapRelayConnections.push(connection);
                } catch (error) {
                    console.error(`[Chat Relay] failed to connect ${url}:`, error?.message || error);
                }
            });

            pool.subscribe(relays, { kinds: [5], limit: 500 }, { onevent(event) {
                (event.tags || []).filter(t => t[0] === 'e' && t[1]).forEach(t => {
                    const eid = t[1];
                    if (eventAuthorById.get(eid) === event.pubkey) deletedEventIds.add(eid);
                });
                scheduleChatCacheWrite();
                scheduleRender('both');
            } });

            pool.subscribe(relays, { kinds: [TRUSTROOTS_PROFILE_KIND] }, { onevent: handleKind10390ForProfile });
            pool.subscribe(relays, { kinds: [0] }, { onevent: handleKind0ForProfile });
            pool.subscribe(relays, { kinds: [PROFILE_CLAIM_KIND], limit: 1000 }, { onevent: handleKind30390ForProfile });

            // Also fetch profile-shaped events from the NIP-42 auth relay; SimplePool above
            // is unauthenticated and won't receive them when restricted relays gate by AUTH.
            startAuthRelayProfileFetch();

            if (TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX) {
                pool.subscribe(
                    relays,
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
            pool.subscribe(relayList, { kinds: [4], '#p': [currentPublicKey] }, { onevent: onDmEvent });
            pool.subscribe(relayList, { kinds: [4], authors: [currentPublicKey] }, { onevent: onDmEvent });

            pool.subscribe(relayList, { kinds: [1059], '#p': [currentPublicKey] }, { onevent(wrapEvent) {
                if (!currentSecretKeyBytes) return;
                try {
                    const wrapPubkey = wrapEvent.pubkey;
                    const key = nip44.getConversationKey(currentSecretKeyBytes, wrapPubkey);
                    const innerJson = nip44.v2.decrypt(wrapEvent.content, key);
                    const seal = JSON.parse(innerJson);
                    if (seal.kind !== 13) return;
                    if (NrBlocklist && NrBlocklist.isBlocked(wrapPubkey)) return;
                    const sealKey = nip44.getConversationKey(currentSecretKeyBytes, seal.pubkey);
                    const rumorJson = nip44.v2.decrypt(seal.content, sealKey);
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
                    scheduleChatCacheWrite();
                    scheduleRender('both');
                    const selDm = selectedConversationId ? conversations.get(selectedConversationId) : null;
                    if (selDm && selDm.type === 'dm' && selDm.id === event.pubkey) {
                        syncThreadHeaderForConversation(selDm);
                    }
                }
            } catch (_) {}
        }

        function handleKind30390ForProfile(event) {
            const info = getProfileClaim30390PictureTarget(event);
            if (!info) return;
            pubkeyToPicture.set(info.targetPubkey, info.picture);
            if (info.nip05 && isTrustrootsNip05Lower(info.nip05)) {
                pubkeyToNip05.set(info.targetPubkey, info.nip05);
            }
            if (info.trustrootsUsername && !pubkeyToUsername.has(info.targetPubkey)) {
                pubkeyToUsername.set(info.targetPubkey, info.trustrootsUsername);
            }
            scheduleChatCacheWrite();
            scheduleRender('both');
            const selDm = selectedConversationId ? conversations.get(selectedConversationId) : null;
            if (selDm && selDm.type === 'dm' && selDm.id === info.targetPubkey) {
                syncThreadHeaderForConversation(selDm);
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
            if (!relayAuth?.startNip42WsSubscription || !currentPublicKey || !currentSecretKeyBytes) return;
            const restrictedUrl = (relays || []).find(isRestrictedRelayUrl)
                || 'wss://nip42.trustroots.org';
            try {
                _nrChatAuthProfileSub = relayAuth.startNip42WsSubscription({
                    relayUrl: restrictedUrl,
                    filter: { kinds: [0, TRUSTROOTS_PROFILE_KIND, PROFILE_CLAIM_KIND], limit: 5000 },
                    authPubkey: currentPublicKey,
                    signEvent: (template) => signEvent(template),
                    onEvent: (event) => {
                        if (!event || NrBlocklist?.isBlocked?.(event.pubkey)) return;
                        if (event.kind === 0) handleKind0ForProfile(event);
                        else if (event.kind === TRUSTROOTS_PROFILE_KIND) handleKind10390ForProfile(event);
                        else if (event.kind === PROFILE_CLAIM_KIND) handleKind30390ForProfile(event);
                    }
                });
            } catch (e) {
                console.warn('[chat] auth-relay profile fetch failed:', e?.message || e);
            }
        }

        function isRestrictedRelayUrl(url) {
            return /nip42\.trustroots\.org/i.test(String(url || ''));
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
            if (!currentPublicKey) {
                isProfileLinked = false;
                usernameFromNostr = false;
                setTrustrootsUI('');
                updateKeyDisplay({ skipProfileLookup: true });
                return;
            }
            const cachedUsername = getCachedValidatedTrustrootsUsername(currentPublicKey);
            if (cachedUsername) {
                isProfileLinked = true;
                usernameFromNostr = true;
                pubkeyToUsername.set(currentPublicKey, cachedUsername);
                setTrustrootsUI(cachedUsername);
                updateKeyDisplay({ skipProfileLookup: true });
                return;
            }
            const r = relays?.length ? relays : (getRelayUrls().length ? getRelayUrls() : DEFAULT_RELAYS);
            if (!r.length) {
                setTrustrootsUI('');
                updateKeyDisplay({ skipProfileLookup: true });
                return;
            }
            if (!pool) pool = new SimplePool();
            let linkedUsername = null;
            const done = { done: false };
            const unsub = pool.subscribe(r, { kinds: [TRUSTROOTS_PROFILE_KIND], authors: [currentPublicKey], limit: 1 }, { onevent(event) {
                if (done.done) return;
                done.done = true;
                const u = getTrustrootsUsernameFromProfileEvent(event);
                if (u) linkedUsername = u;
            } });
            await new Promise(r => setTimeout(r, 2500));
            try { if (typeof unsub === 'function') unsub(); else if (unsub?.close) unsub.close(); } catch (_) {}
            if (linkedUsername) {
                try {
                    const res = await fetch(`https://www.trustroots.org/.well-known/nostr.json?name=${encodeURIComponent(linkedUsername)}`);
                    const data = await res.json();
                    if (data.names && data.names[linkedUsername]) {
                        const nip5Hex = (data.names[linkedUsername] + '').toLowerCase();
                        if (nip5Hex !== currentPublicKey.toLowerCase()) {
                            linkedUsername = null;
                        }
                    } else {
                        linkedUsername = null;
                    }
                } catch (_) {
                    linkedUsername = null;
                }
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
                await pool.publish(r, signedEvent);
                isProfileLinked = true;
                usernameFromNostr = true;
                setTrustrootsUI(username);
                updateKeyDisplay({ skipProfileLookup: true });
                pubkeyToUsername.set(currentPublicKey, username);
                setCachedValidatedTrustrootsUsername(currentPublicKey, username);
                scheduleChatCacheWrite();
                showStatus('Profile linked. You can now close this modal and explore the app. Make sure your nsec is safely backed up (for example in your password manager).', 'success');
            } catch (e) {
                showStatus(e?.message || 'Failed to link profile.', 'error');
            }
        }

        async function updateTrustrootsProfile() {
            if (!currentPublicKey) { showStatus('No key connected.', 'error'); return; }
            const npub = getDisplayNpub() || getCurrentNpub();
            await navigator.clipboard.writeText(npub);
            alert('Your npub has been copied to the clipboard. Please paste it into the Nostr field on Trustroots.');
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
            const entries = Array.from(conversations.entries())
                .map(([id, c]) => ({ id, ...c }));
            const ordered = entries.sort((a, b) => convSortKey(b) - convSortKey(a));
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
                    const meta = circleMetaBySlug.get(normalizeTrustrootsCircleSlugKey(id)) || {};
                    const slug = id;
                    const pic = meta.picture && isSafeHttpUrl(meta.picture)
                        ? meta.picture
                        : trustrootsCirclePictureFallback(slug);
                    const about = meta.about && String(meta.about).trim();
                    const hashEsc = escConvHtml('#' + slug);
                    const line =
                        about
                            ? `${escConvHtml(about.length > 88 ? about.slice(0, 85) + '…' : about)} · ${hashEsc}`
                            : hashEsc;
                    const imgHtml = pic
                        ? `<img class="conv-item-avatar" src="${escConvHtml(pic)}" alt="" loading="lazy" decoding="async" />`
                        : '';
                    item.innerHTML =
                        '<span class="conv-item-stack">' +
                        `<span class="conv-item-title-row conv-item-circle-hashline">${line}</span>` +
                        '</span>' +
                        imgHtml;
                } else if (type === 'dm') {
                    const dmPic = getDmPictureByConversationId(id);
                    const imgHtml = dmPic && isSafeHttpUrl(dmPic)
                        ? `<img class="conv-item-avatar" src="${escConvHtml(dmPic)}" alt="" loading="lazy" decoding="async" />`
                        : '';
                    const oneLine = enc === '#' ? eGlyph + eLab : eLab + '\u2009' + eGlyph;
                    item.innerHTML =
                        '<span class="conv-item-stack">' +
                        `<span class="conv-item-title-row">${oneLine}</span>` +
                        '</span>' +
                        imgHtml;
                } else {
                    // Emoji rail (🌐 🔒) on the right; keep # as a normal hashtag prefix on the left.
                    const oneLine = enc === '#' ? eGlyph + eLab : eLab + '\u2009' + eGlyph;
                    item.innerHTML = `<span class="conv-item-label">${oneLine}</span>`;
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
                const meta = circleMetaBySlug.get(normalizeTrustrootsCircleSlugKey(id));
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
                    const slug = conv.id;
                    const slugKey = normalizeTrustrootsCircleSlugKey(slug);
                    const meta = circleMetaBySlug.get(slugKey) || {};
                    const circlePicture = meta.picture && isSafeHttpUrl(meta.picture)
                        ? meta.picture
                        : trustrootsCirclePictureFallback(slugKey);
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
                            linkEl.href = `https://www.trustroots.org/circles/${encodeURIComponent(slugKey)}`;
                            linkEl.style.display = 'inline';
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

        function selectConversation(id) {
            selectedConversationId = id;
            setHashRoute(getConversationRouteId(id));
            const keysEl = document.getElementById('keys-modal');
            const settingsEl = document.getElementById('settings-modal');
            if (keysEl) keysEl.classList.remove('active');
            if (settingsEl) settingsEl.classList.remove('active');
            const conv = conversations.get(id);
            if (conv) {
                writePersistedSelectedChatId(String(id));
            } else {
                writePersistedSelectedChatId('');
            }
            document.body.classList.toggle('chat-open', !!conv);
            const list = document.getElementById('conv-list');
            if (list) list.querySelectorAll('.conv-item').forEach(el => el.classList.toggle('selected', el.dataset.convId === id));
            document.getElementById('empty-state').style.display = conv ? 'none' : 'flex';
            document.getElementById('compose').style.display = conv ? 'flex' : 'none';
            const opts = document.getElementById('compose-note-duration');
            if (opts) opts.style.display = conv?.type === 'channel' ? 'flex' : 'none';
            if (conv?.type === 'channel') {
                syncComposeExpiryFromStorage();
            }
            updateComposePostingIcon();
            document.getElementById('thread-header').style.display = conv ? 'flex' : 'none';
            if (conv) {
                const isEnc = conv.type === 'dm' || conv.type === 'group';
                document.getElementById('thread-enc-icon').textContent = isEnc ? ENC_LOCK : ENC_GLOBE;
                document.getElementById('thread-enc-icon').title = isEnc ? 'Encrypted' : 'Unencrypted (public)';
                document.getElementById('thread-enc-label').textContent = isEnc ? 'Encrypted' : 'Unencrypted';
                syncThreadHeaderForConversation(conv);
                if (conv._pendingEncrypted?.length) decryptPendingForConversation(conv);
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
            document.getElementById('empty-state').style.display = 'flex';
            document.getElementById('compose').style.display = 'none';
            document.getElementById('thread-header').style.display = 'none';
            document.getElementById('thread-messages').innerHTML = '';
        }

        function getPluscodeFromEvent(raw) {
            if (!raw?.tags) return null;
            const tag = raw.tags.find(t => Array.isArray(t) && t.length >= 3 && t[0] === 'l' && t[2] === 'open-location-code');
            const code = tag?.[1];
            return (code && typeof code === 'string' && code.trim()) ? code.trim() : null;
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
                return normalizeTrustrootsCircleSlugKey(normalizeChannelSlug(circleSlug));
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
            if (!conv || !container) return;
            container.innerHTML = '';
            const isChannel = conv.type === 'channel';
            let eventsToShow = conv.events.filter(ev => !deletedEventIds.has(ev.id) && !isBlockedPubkey(ev.pubkey));
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
                const row = document.createElement('div');
                row.className = 'message-row' + (isSelf ? ' self' : '');
                const wrap = document.createElement('div');
                wrap.className = 'message-wrap ' + (isSelf ? 'self' : 'other');
                if (isChannel && !isSelf) {
                    const author = document.createElement('div');
                    author.className = 'message-author';
                    author.innerHTML = renderPubkeyLabelHtml(ev.pubkey);
                    const fullNpub = hexToNpub(ev.pubkey);
                    if (fullNpub) author.title = fullNpub;
                    wrap.appendChild(author);
                }
                const div = document.createElement('div');
                div.className = 'message ' + (isSelf ? 'self' : 'other');
                div.innerHTML = linkifyTrustrootsUrls(
                    linkifyNpubsWithTrustrootsProfiles(linkifyNip05Identifiers(escapeHtml(ev.content || '')))
                );
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
                const messageDate = new Date(ev.created_at * 1000);
                const year = messageDate.getFullYear();
                const month = String(messageDate.getMonth() + 1).padStart(2, '0');
                const day = String(messageDate.getDate()).padStart(2, '0');
                const hour = String(messageDate.getHours()).padStart(2, '0');
                const minute = String(messageDate.getMinutes()).padStart(2, '0');
                const timeStr = `${year}-${month}-${day} ${hour}:${minute}`;
                const metaMain = document.createElement('span');
                metaMain.className = 'message-meta-main';
                metaMain.innerHTML = `<span class="time">${timeStr}</span>`;
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
                div.appendChild(meta);
                wrap.appendChild(div);
                row.appendChild(wrap);
                if (isSelf) {
                    const delBtn = document.createElement('button');
                    delBtn.type = 'button';
                    delBtn.className = 'message-delete';
                    delBtn.title = 'Delete message (NIP-09)';
                    delBtn.setAttribute('aria-label', 'Delete message');
                    delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
                    delBtn.onclick = (e) => { e.preventDefault(); openDeleteConfirmModal(ev.id); };
                    row.appendChild(delBtn);
                }
                container.appendChild(row);
            });
            container.scrollTop = container.scrollHeight;
        }

        function parseHashtagChannelSlug(raw) {
            const s = (raw || '').trim();
            const m = s.match(/^#([a-zA-Z0-9_-]+)$/);
            return m ? normalizeChannelSlug(m[1]) : null;
        }

        // escapeHtml is defined at module scope (folded above); chat re-uses that.

        function linkifyTrustrootsUrls(html) {
            // Chat-only variant: also adds .message-inline-link so chat bubbles can style links separately.
            return html.replace(
                /https:\/\/(?:www\.)?trustroots\.org\/[^\s<)]+/gi,
                (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-inline-link nr-content-link">${url}</a>`
            );
        }

        function linkifyNip05Identifiers(html) {
            return html.replace(
                /(^|[^a-z0-9_@.-])([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})(?=$|[^a-z0-9_@.-])/gi,
                (match, prefix, nip05) => {
                    const normalized = String(nip05 || '').trim().toLowerCase();
                    if (!normalized) return match;
                    const href = '#profile/' + encodeURIComponent(normalized).replace(/%2B/g, '+');
                    return `${prefix}<a href="${href}" class="message-inline-link nr-content-link">${nip05}</a>`;
                }
            );
        }

        /** Replace npub1… with Trustroots NIP-05 + #profile when known (run after escapeHtml, before NIP-05 linkify). */
        function linkifyNpubsWithTrustrootsProfiles(html) {
            if (!html) return html || '';
            return html.replace(/\bnpub1[023456789acdefghjkmnpqrstuvwxyz]{20,}\b/gi, (npubStr) => {
                const hex = npubToHex(npubStr);
                if (!hex) return npubStr;
                let nip05 = (pubkeyToNip05.get(hex) || '').trim().toLowerCase();
                if (!isTrustrootsNip05Lower(nip05)) nip05 = '';
                if (!nip05) {
                    const u = pubkeyToUsername.get(hex);
                    if (u) nip05 = `${String(u).trim().toLowerCase()}@trustroots.org`;
                }
                if (!nip05 || !isTrustrootsNip05Lower(nip05)) return npubStr;
                const href = '#profile/' + encodeURIComponent(nip05).replace(/%2B/g, '+');
                return `<a href="${href}" class="message-inline-link nr-content-link" title="${escapeHtml(npubStr)}">${escapeHtml(nip05)}</a>`;
            });
        }

        function renderPubkeyLabelHtml(hex) {
            const label = escapeHtml(pubkeyDisplayLabel(hex));
            if (!label) return '';
            if (!label.includes('@')) return label;
            const route = encodeURIComponent(label.toLowerCase()).replace(/%2B/g, '+');
            return `<a href="#profile/${route}" class="nr-content-link">${label}</a>`;
        }

        async function startDm() {
            const raw = document.getElementById('new-dm-pubkey')?.value?.trim() || '';
            const hashtagSlug = parseHashtagChannelSlug(raw);
            if (hashtagSlug) {
                getOrCreateConversation('channel', hashtagSlug, []);
                closeNewDmModal();
                document.getElementById('new-dm-pubkey').value = '';
                setHashRoute(hashtagSlug);
                selectConversation(hashtagSlug);
                return;
            }
            const peer = await resolvePubkeyInput(raw);
            if (!peer) {
                showStatus('Invalid npub, nip5 or hashtag (e.g. nostroots@trustroots.org).', 'error');
                return;
            }
            if (peer === currentPublicKey) {
                showStatus('Cannot message yourself.', 'error');
                return;
            }
            if (NrBlocklist && NrBlocklist.isBlocked(peer)) {
                showStatus('This user is blocked.', 'error');
                return;
            }
            getOrCreateConversation('dm', peer, [peer]);
            closeNewDmModal();
            document.getElementById('new-dm-pubkey').value = '';
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
            return finalizeEvent(eventToSign, currentSecretKeyBytes);
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
                showStatus('No relays enabled for posting. Enable "Post" for at least one relay. Opening Settings…', 'error');
                alert('At least one relay must have "Post" enabled before you can send a message.');
                openSettingsModal();
                return;
            }

            if (conv.type === 'dm') {
                const peer = conv.id;
                const result = await encryptKind4(peer, text);
                if (!result) {
                    showStatus('Cannot encrypt: no secret key. Please import or generate a key.', 'error');
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
                signEvent(template).then((signed) => {
                    pool.publish(publishRelayUrls, signed);
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
                    showStatus('Sent.', 'success');
                }).catch((e) => {
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
                            const sealContent = nip44.v2.encrypt(JSON.stringify(rumor), nip44.getConversationKey(currentSecretKeyBytes, memberPubkey));
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
                            pool.publish(publishRelayUrls, wrap);
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
                    if (failed.length > 0) {
                        showStatus(`Sent to channel on ${succeeded.length}/${publishRelayUrls.length} relays.`, 'success');
                    } else {
                        showStatus('Sent to channel.', 'success');
                    }
                }).catch((e) => {
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
    window.exportNsec = exportNsec;
    window.deleteNsec = deleteNsec;
    window.importNsec = importNsec;
    window.generateKeyPair = generateKeyPair;
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
    }, true);

    void (async () => {
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


// ---------------------------------------------------------------------------
// Folded: nr-profile-page.js (wrapped in IIFE; returns profile renderers)
// ---------------------------------------------------------------------------
const __nrProfilePage = (() => {

const TRUSTROOTS_PROFILE_KIND = 10390;
const PROFILE_CLAIM_KIND = 30390;
const RELATIONSHIP_CLAIM_KIND = 30392;
const EXPERIENCE_CLAIM_KIND = 30393;
const MAP_NOTE_KIND = 30397;
const MAP_NOTE_REPOST_KIND = 30398;
const MAP_NOTE_KINDS = [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND];
/** NIP-32 label namespace on kind 30398 host mirrors (trustrootsimporttool). */
const TRUSTROOTS_CIRCLE_LABEL = 'trustroots-circle';

/** Trustroots authenticated relay (NIP-42); kind 30397 seen here is treated as validated for profile UI. */
function isTrustrootsNip42RelayUrl(url) {
  return /nip42\.trustroots\.org/i.test(String(url || ''));
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

const DEFAULT_RELAYS = ['wss://nip42.trustroots.org', 'wss://relay.trustroots.org', 'wss://relay.nomadwiki.org'];

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

/** `location.hash` segment encoding (keep `+` for spaces). */
function hashEncodeSegment(s) {
  return encodeURIComponent(String(s ?? '')).replace(/%2B/g, '+');
}

/** Top-level hash route, e.g. plus code or NIP-05 chat fragment. */
function hashRoute(s) {
  return '#' + hashEncodeSegment(s);
}

/** `#profile/<encoded-id>` for npub, hex, nip05, or `user@trustroots.org`. */
function profileHashFromSegment(segment) {
  return '#profile/' + hashEncodeSegment(segment);
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

/**
 * @param {string} profileId
 * @returns {Promise<{ root: HTMLElement; hex: string } | null>} null if missing root or resolve failed (DOM updated)
 */
async function prepareProfileRootResolved(profileId) {
  const root = document.getElementById('nr-profile-root');
  if (!root) return null;
  root.innerHTML = '<p class="nr-profile-loading">Loading…</p>';
  const hex = await resolveProfileIdToHex(profileId);
  if (!hex) {
    root.innerHTML =
      '<p class="nr-profile-error">Could not resolve that NIP-05, or the npub is invalid.</p>';
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
  'a',
  'strong',
  'em',
  'b',
  'i',
  'ul',
  'ol',
  'li',
  'blockquote',
];
const PROFILE_ABOUT_HTML_ATTR = ['href', 'title', 'rel', 'target'];

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

function getPlusCodeFromEvent(event) {
  if (!Array.isArray(event?.tags)) return null;
  for (const tag of event.tags) {
    if (!Array.isArray(tag) || tag.length < 2 || tag[0] !== 'l') continue;
    const namespace = typeof tag[2] === 'string' ? tag[2] : '';
    if (namespace.startsWith('open-location-code')) {
      const code = typeof tag[1] === 'string' ? tag[1].trim().toUpperCase() : '';
      if (code) return code;
    }
  }
  const dTag = event.tags.find((tag) => Array.isArray(tag) && tag[0] === 'd' && typeof tag[1] === 'string');
  if (dTag) {
    const code = dTag[1].trim().toUpperCase();
    if (code) return code;
  }
  return null;
}

function parsePubkeyInput(input) {
  const s = (input || '').trim();
  if (!s) return null;
  if (/^[0-9a-f]{64}$/i.test(s)) return s.toLowerCase();
  return npubToHex(s) || null;
}

async function resolveProfileIdToHex(profileId) {
  const raw = (profileId || '').trim();
  if (!raw) return null;
  if (raw.includes('@')) return await resolveNip05(raw);
  return parsePubkeyInput(raw);
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
    if (h && String(e.pubkey || '').toLowerCase() === h) return true;
    const tags = e.tags || [];
    const ps = tags.filter((t) => t[0] === 'p' && t[1]);
    const pMatch = h ? ps.some((t) => String(t[1]).toLowerCase() === h) : false;
    if (pMatch) return true;
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
  const urls = relayUrls();
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
  const apiUrl = `https://www.trustroots.org/api/users/${encodeURIComponent(u)}`;
  const fetchOpts = { mode: 'cors', credentials: 'omit' };

  try {
    const res = await fetch(apiUrl, fetchOpts);
    if (!res.ok) return '';
    return pictureUrlFromTrustrootsUserApiJson(await res.json());
  } catch (_) {}

  try {
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(apiUrl);
    const res = await fetch(proxyUrl, fetchOpts);
    if (!res.ok) return '';
    const pic = pictureUrlFromTrustrootsUserApiJson(JSON.parse(await res.text()));
    if (pic) return pic;
  } catch (_) {}

  return '';
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
  return { picture, displayName, about, nip05, trustrootsUsername, from90, from0 };
}

function truncateBody(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

function inferHostingBadgeFromBody(body) {
  const low = String(body || '').toLowerCase();
  let badgeText = 'Can host';
  let badgeVariant = 'host';
  if (/(can'?t host|cannot host|no hosting|not hosting|unable to host|no guests)/i.test(low)) {
    badgeText = 'Cannot host';
    badgeVariant = 'warn';
  } else if (/(maybe|depends|sometimes|if it works out|might host|ask first|limited)/i.test(low)) {
    badgeText = 'Maybe host';
    badgeVariant = 'warn';
  }
  return { badgeText, badgeVariant };
}

/** Kind 30397/30398 with Trustroots circle tribe tag (hosting-style map note). */
function eventHasTrustrootsCircleTag(ev) {
  const tags = Array.isArray(ev?.tags) ? ev.tags : [];
  return tags.some((t) => Array.isArray(t) && t[0] === 'l' && t[2] === TRUSTROOTS_CIRCLE_LABEL);
}

function eventContentHasHostingChannelHashtag(ev) {
  const c = String(ev?.content || '').toLowerCase();
  return /#hostingoffers?\b/i.test(c) || /#hostingoffer\b/i.test(c);
}

/**
 * Latest Trustroots-import mirror (kind 30398) for this profile — same payload as claimable hosting in Keys.
 * @param {unknown[]} hostMirrorEvents from collect: import-tool author + `#p` subject
 */
function pickLatestHostMirrorOffer(hostMirrorEvents) {
  const list = [...(hostMirrorEvents || [])].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  for (const ev of list) {
    if (String(ev?.content || '').trim()) return ev;
  }
  return list[0] || null;
}

/**
 * Author's own kind 30397 that looks like a hosting offer (circle tag or #hostingoffers), newest first.
 * @param {unknown[]} notesSorted
 * @param {string} subjectHex
 */
function pickLatestHostLikeMapNote(notesSorted, subjectHex) {
  const h = String(subjectHex || '').toLowerCase();
  const list = Array.isArray(notesSorted) ? notesSorted : [];
  for (const ev of list) {
    if (!ev || ev.kind !== MAP_NOTE_KIND) continue;
    if (String(ev.pubkey || '').toLowerCase() !== h) continue;
    if (eventHasTrustrootsCircleTag(ev) || eventContentHasHostingChannelHashtag(ev)) return ev;
  }
  return null;
}

/**
 * Accommodation card: prefer mirrored Trustroots host offer (30398 import), else circle / hosting-tagged 30397.
 * @param {unknown[]} hostMirrorEvents
 * @param {unknown[]} notesSorted
 * @param {number} validatedCount
 * @param {string} subjectHex
 * @param {boolean} notesReady
 * @param {boolean} host303Ready
 */
function accommodationSnapshot(hostMirrorEvents, notesSorted, validatedCount, subjectHex, notesReady, host303Ready) {
  const mirrorEv = pickLatestHostMirrorOffer(hostMirrorEvents);
  const mirrorBody = mirrorEv ? String(mirrorEv.content || '').trim() : '';
  if (mirrorBody) {
    const { badgeText, badgeVariant } = inferHostingBadgeFromBody(mirrorBody);
    return {
      title: 'Accommodation',
      badgeText,
      badgeVariant,
      summary: truncateBody(mirrorBody, 1200),
      source: '',
    };
  }

  if (notesReady) {
    const hostLike = pickLatestHostLikeMapNote(notesSorted, subjectHex);
    const pubBody = hostLike ? String(hostLike.content || '').trim() : '';
    if (pubBody) {
      const validated = hostLike ? isMapNoteTrustrootsValidated(hostLike, subjectHex) : false;
      const inferred = inferHostingBadgeFromBody(pubBody);
      return {
        title: 'Accommodation',
        badgeText: validated ? inferred.badgeText : 'Cannot host currently',
        badgeVariant: validated ? inferred.badgeVariant : 'warn',
        summary: truncateBody(pubBody, 1200),
        source: validated || validatedCount > 0 ? '' : 'Publish this offer on the Trustroots auth relay to verify it.',
      };
    }
  }

  if (!notesReady && host303Ready) {
    return {
      title: 'Accommodation',
      badgeText: '…',
      badgeVariant: 'muted',
      summary: 'Loading public map notes…',
      source: '',
    };
  }
  if (notesReady && !host303Ready) {
    return {
      title: 'Accommodation',
      badgeText: '…',
      badgeVariant: 'muted',
      summary: 'Loading Trustroots hosting mirror…',
      source: '',
    };
  }

  return {
    title: 'Accommodation',
    badgeText: 'No hosting yet',
    badgeVariant: 'muted',
    summary: 'No mirrored hosting offer or circle-tagged host note found on your relays yet.',
    source: '',
  };
}

function bindProfileTrTabs(shell) {
  const tabs = shell.querySelectorAll('.nr-profile-tr-tab');
  const panels = shell.querySelectorAll('.nr-profile-tr-panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.getAttribute('data-tab');
      tabs.forEach((t) => {
        const on = t.getAttribute('data-tab') === id;
        t.classList.toggle('nr-profile-tr-tab--active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.forEach((p) => {
        const on = p.getAttribute('data-panel') === id;
        p.toggleAttribute('hidden', !on);
      });
    });
  });
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
  if (nip05Lower) return hashRoute(nip05Lower);
  if (trUsername) return hashRoute(`${trUsername}@trustroots.org`);
  try {
    return '#' + nip19.npubEncode(hex);
  } catch (_) {
    return profileHashFromSegment(hex);
  }
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

  const actionsRow = document.createElement('div');
  actionsRow.className = 'nr-profile-tr-actions';
  let msg = null;
  let addTrustBtn = null;
  if (!selfProfile) {
    msg = document.createElement('a');
    msg.className = 'nr-profile-tr-action';
    msg.href = chatHashForSubject(hex, nip05Guess || '', earlyTrUser);
    msg.innerHTML = '💬 <span>Send a message</span>';
    actionsRow.appendChild(msg);
    addTrustBtn = document.createElement('button');
    addTrustBtn.type = 'button';
    addTrustBtn.className = 'nr-profile-tr-action nr-profile-tr-action-btn';
    addTrustBtn.innerHTML = '⊞ <span>Add trust</span>';
    actionsRow.appendChild(addTrustBtn);
    header.appendChild(actionsRow);
  }
  heroMain.appendChild(header);

  const tabBar = document.createElement('div');
  tabBar.className = 'nr-profile-tr-tabs';
  tabBar.setAttribute('role', 'tablist');
  function makeTab(id, label, active) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nr-profile-tr-tab' + (active ? ' nr-profile-tr-tab--active' : '');
    b.setAttribute('data-tab', id);
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', active ? 'true' : 'false');
    b.textContent = label;
    return b;
  }
  const tabAbout = makeTab('about', 'About', true);
  const tabNotes = makeTab('notes', 'Notes …', false);
  const tabTrust = makeTab('trust', 'Trust …', false);
  tabBar.appendChild(tabAbout);
  tabBar.appendChild(tabNotes);
  tabBar.appendChild(tabTrust);
  if (addTrustBtn) addTrustBtn.addEventListener('click', () => tabTrust.click());
  heroMain.appendChild(tabBar);
  hero.appendChild(heroMain);
  shell.appendChild(hero);

  const grid = document.createElement('div');
  grid.className = 'nr-profile-tr-grid';

  const aside = document.createElement('aside');
  aside.className = 'nr-profile-tr-aside';
  const stats = document.createElement('ul');
  stats.className = 'nr-profile-tr-stats';
  const liNip = document.createElement('li');
  if (nip05Guess) {
    liNip.textContent = `NIP-05: ${nip05Guess}`;
  } else {
    liNip.className = 'nr-profile-tr-skeleton';
    liNip.textContent = 'NIP-05: …';
  }
  stats.appendChild(liNip);
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
    ? 'Sign mirrored Trustroots contact suggestions (kind 30392) and experiences (kind 30393). Counts and where events are sent update when your key is loaded and relays are configured.'
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
  main.appendChild(panelNotes);
  main.appendChild(panelTrust);
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
  hsk.textContent = 'Loading accommodation summary…';
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
  circTitle.textContent = 'Circles';
  circCard.appendChild(circTitle);
  const circSub = document.createElement('p');
  circSub.className = 'nr-profile-tr-circles-sub';
  circSub.textContent = 'Imported from Trustroots';
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
    msgLink: msg,
    tabNotes,
    tabTrust,
    avatarWrap: avWrap,
    statNipLi: liNip,
    aboutMount,
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

/**
 * @param {Record<string, HTMLElement>} refs
 * @param {{ evAuthors?: unknown[]; evP30390?: unknown[]; evPClaims?: unknown[]; evNotes?: unknown[]; evHost30398?: unknown[]; circleMetaBySlug?: Map<string, { name: string; about: string; picture: string; created_at?: number }>; avatarExtra?: string }} viewState
 * @param {{ hex: string; npub: string; profileId: string; earlyTrUser: string; circleDirSlugsKey?: string; scheduleBump?: () => void }} ctx
 */
function applyStagedProfileView(refs, viewState, ctx) {
  const { hex, npub, profileId, earlyTrUser } = ctx;
  const authorsReady = viewState.evAuthors !== undefined;
  const p90Ready = viewState.evP30390 !== undefined;
  const claimsReady = viewState.evPClaims !== undefined;
  const notesReady = viewState.evNotes !== undefined;
  const host303Ready = viewState.evHost30398 !== undefined;

  const evAuthors = authorsReady ? viewState.evAuthors || [] : [];
  const evP30390 = p90Ready ? viewState.evP30390 || [] : [];
  const evPClaims = claimsReady ? viewState.evPClaims || [] : [];
  const evNotes = notesReady ? viewState.evNotes || [] : [];

  const ev0 = authorsReady ? pickLatest(evAuthors, 0, hex) : null;
  const ev10390 = authorsReady ? pickLatest(evAuthors, TRUSTROOTS_PROFILE_KIND, hex) : null;
  const ev30390 = p90Ready ? pickLatest30390(evP30390, hex, earlyTrUser) : null;

  const meta = mergeProfile30390AndKind0(ev30390, ev0);
  let trUser =
    meta.trustrootsUsername ||
    getTrustrootsUsernameFrom10390(ev10390 || {}) ||
    getTrustrootsUsernameFromKind0(ev0 || {});

  const nip05Resolved = meta.nip05 || (trUser ? `${trUser}@trustroots.org` : '') || profileNip05Guess(profileId, earlyTrUser);

  let picture = meta.picture;
  if (!picture && trUser && viewState.avatarExtra) {
    picture = viewState.avatarExtra;
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
  if (refs.msgLink) refs.msgLink.href = chatHashForSubject(hex, nip05Resolved, trUser);

  refs.tabNotes.textContent = notesReady ? `Notes (${notesSorted.length})` : 'Notes …';
  refs.tabTrust.textContent = claimsReady ? 'Trust' : 'Trust …';

  refs.statNipLi.replaceChildren();
  refs.statNipLi.classList.remove('nr-profile-tr-skeleton', 'nr-profile-muted');
  if (nip05Resolved) {
    const trUser = trustrootsUserFromNip05(nip05Resolved);
    if (trUser) {
      refs.statNipLi.appendChild(document.createTextNode('NIP-05: '));
      const a = document.createElement('a');
      a.className = 'nr-content-link';
      a.href = trustrootsProfileUrl(trUser);
      setExternalAnchorRel(a);
      a.textContent = nip05Resolved;
      refs.statNipLi.appendChild(a);
    } else {
      refs.statNipLi.textContent = `NIP-05: ${nip05Resolved}`;
    }
  } else if (!authorsReady && !p90Ready) {
    refs.statNipLi.classList.add('nr-profile-tr-skeleton');
    refs.statNipLi.textContent = 'NIP-05: …';
  } else {
    refs.statNipLi.classList.add('nr-profile-muted');
    refs.statNipLi.textContent = 'No NIP-05 on latest profile export yet.';
  }
  const allCollectedForDebug = [
    ...(authorsReady ? evAuthors : []),
    ...(p90Ready ? evP30390 : []),
  ];
  const candidates = extractPictureCandidatesFromEvents(allCollectedForDebug);
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
    if (profileAboutLooksLikeHtml(rawAbout)) {
      about.innerHTML = sanitizeProfileAboutHtml(rawAbout);
    } else {
      about.textContent = rawAbout;
    }
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
        a.href = hashRoute(pc);
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
    const p = document.createElement('p');
    p.className = 'nr-profile-tr-skeleton';
    p.style.textAlign = 'center';
    p.textContent = 'Loading accommodation summary…';
    refs.hostMount.appendChild(p);
  } else {
    const accommodation = accommodationSnapshot(
      viewState.evHost30398 || [],
      notesSorted,
      validatedMapNoteCount,
      hex,
      notesReady,
      host303Ready
    );
    const hostHead = document.createElement('div');
    hostHead.className = 'nr-profile-tr-rail-head';
    const hostTitle = document.createElement('h3');
    hostTitle.className = 'nr-profile-tr-rail-title';
    hostTitle.textContent = accommodation.title;
    const hostBadge = document.createElement('span');
    hostBadge.className = 'nr-profile-tr-badge';
    hostBadge.classList.add(`nr-profile-tr-badge--${accommodation.badgeVariant}`);
    hostBadge.textContent = accommodation.badgeText;
    hostHead.appendChild(hostTitle);
    hostHead.appendChild(hostBadge);
    refs.hostMount.appendChild(hostHead);
    const hostBody = document.createElement('div');
    hostBody.className = 'nr-profile-tr-rail-body nr-profile-tr-rail-body--accommodation';
    const hostP = document.createElement('p');
    hostP.className = 'nr-profile-tr-accommodation-text';
    if (/^Loading\b/i.test(accommodation.summary || '')) hostP.classList.add('nr-profile-tr-skeleton');
    hostP.style.margin = '0';
    hostP.style.whiteSpace = 'pre-wrap';
    hostP.textContent = accommodation.summary || '';
    hostBody.appendChild(hostP);
    if (accommodation.source) {
      const hostMeta = document.createElement('p');
      hostMeta.className = 'nr-profile-muted';
      hostMeta.style.margin = '0.45rem 0 0';
      hostMeta.textContent = accommodation.source;
      hostBody.appendChild(hostMeta);
    }
    refs.hostMount.appendChild(hostBody);
  }

  refs.trustMount.replaceChildren();
  if (!claimsReady) {
    const p = document.createElement('p');
    p.className = 'nr-profile-tr-skeleton';
    p.textContent = 'Loading trust summary…';
    refs.trustMount.appendChild(p);
  } else if (isSelfHex(hex)) {
    const p = document.createElement('p');
    p.className = 'nr-profile-muted';
    p.textContent = 'Open the Trust tab to sign relationship and experience suggestions.';
    refs.trustMount.appendChild(p);
  } else if (!rels.length && !exps.length) {
    const p = document.createElement('p');
    p.className = 'nr-profile-muted';
    p.textContent = 'No relationship or experience suggestions found on your relays yet.';
    refs.trustMount.appendChild(p);
  } else {
    const relRow = document.createElement('p');
    relRow.className = 'nr-profile-muted';
    relRow.textContent = `${rels.length} relationship suggestion${rels.length === 1 ? '' : 's'}.`;
    refs.trustMount.appendChild(relRow);
    const expRow = document.createElement('p');
    expRow.className = 'nr-profile-muted';
    expRow.style.marginTop = '0.35rem';
    expRow.textContent = `${exps.length} experience suggestion${exps.length === 1 ? '' : 's'}.`;
    refs.trustMount.appendChild(expRow);
  }

  refs.circListMount.replaceChildren();
  const circlesReady = p90Ready && host303Ready;
  if (!circlesReady) {
    const p = document.createElement('p');
    p.className = 'nr-profile-tr-skeleton';
    p.textContent = 'Loading circles from Trustroots import (kind 30390 / 30398)…';
    refs.circListMount.appendChild(p);
  } else {
    const slugs98 = extractCircleSlugsFromHostReposts30398(viewState.evHost30398 || [], hex);
    const slugs90 = extractCircleSlugsFromProfileClaim30390(viewState.evP30390 || [], hex);
    const slugSet = new Set();
    for (const s of [...slugs90, ...slugs98]) {
      const k = normalizeTrustrootsCircleSlugKey(s);
      if (k) slugSet.add(k);
    }
    const slugs = Array.from(slugSet).sort();
    const slugsKey = slugs.join('\0');

    if (!slugs.length) {
      ctx.circleDirSlugsKey = '';
      viewState.circleMetaBySlug = new Map();
    } else if (slugsKey !== ctx.circleDirSlugsKey) {
      ctx.circleDirSlugsKey = slugsKey;
      viewState.circleMetaBySlug = undefined;
      void collectCircleDirectoryForSlugs(slugs)
        .then((events) => {
          const map = new Map();
          const pub = circleImportToolPubkeyHex();
          for (const ev of events || []) {
            mergeCircleMetadataMapEntry(map, ev, { expectedPubkey: pub, kind: TRUSTROOTS_CIRCLE_META_KIND });
          }
          viewState.circleMetaBySlug = map;
          ctx.scheduleBump?.();
        })
        .catch((e) => {
          console.warn('[nr-profile] circle directory (30410)', e);
          viewState.circleMetaBySlug = new Map();
          ctx.scheduleBump?.();
        });
    }

    const metaMap = viewState.circleMetaBySlug;
    if (metaMap === undefined && slugs.length) {
      const p = document.createElement('p');
      p.className = 'nr-profile-tr-skeleton';
      p.textContent = 'Loading circle directory (kind 30410)…';
      refs.circListMount.appendChild(p);
    } else if (!slugs.length) {
      const p = document.createElement('p');
      p.className = 'nr-profile-muted';
      p.textContent =
        'No Trustroots circle memberships found on your relays yet. After import, circle tags appear on kind 30390 profile claims (all members) and on kind 30398 host mirrors when a hosted offer is tagged with tribes you belong to.';
      refs.circListMount.appendChild(p);
    } else {
      for (const slug of slugs) {
        const row = document.createElement('div');
        row.className = 'nr-profile-tr-circ-row';
        const m = metaMap && metaMap.get(slug);
        const name = (m && m.name) || slug;
        const pic = m && m.picture ? sanitizePictureUrl(m.picture) : '';
        if (pic) {
          const img = document.createElement('img');
          img.className = 'nr-profile-tr-circ-thumb';
          img.alt = '';
          img.src = pic;
          img.referrerPolicy = 'no-referrer';
          row.appendChild(img);
        } else {
          const ph = document.createElement('div');
          ph.className = 'nr-profile-tr-circ-thumb-ph';
          ph.setAttribute('aria-hidden', 'true');
          ph.textContent = '◉';
          row.appendChild(ph);
        }
        const body = document.createElement('div');
        body.className = 'nr-profile-tr-circ-row-text';
        const a = document.createElement('a');
        a.className = 'nr-profile-tr-circ-name';
        a.href = `https://www.trustroots.org/circles/${encodeURIComponent(slug)}`;
        setExternalAnchorRel(a);
        a.textContent = name;
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
  const prep = await prepareProfileRootResolved(profileId);
  if (!prep) return;
  const { root, hex } = prep;

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
      circleMetaBySlug: undefined,
      avatarExtra: '',
    };
    const ctx = { hex, npub, profileId, earlyTrUser, circleDirSlugsKey: '' };

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
      try {
        applyStagedProfileView(refs, viewState, ctx);
      } catch (e) {
        console.warn('[nr-profile] staged profile apply', e);
      }
    };
    ctx.scheduleBump = bump;
    bump();

    bindProfileTrTabs(shell);
    bindBasicEditAction(refs.nameEditBtn, 'Profile header');
    bindBasicEditAction(refs.aboutEditBtn, 'About');

    if (isSelfHex(hex)) {
      try {
        window.NrWebMountClaimTrustrootsTrustTab?.();
      } catch (e) {
        console.warn('[nr-profile] mount claim trust blocks on own public profile', e);
      }
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

    // kind 0 / 10390 — fetch unauth and auth so a kind 0 living only on the auth relay is still seen.
    void (async () => {
      const [byUnauth, byAuth] = await Promise.all([
        trackUnauth('0+10390 authors=hex [unauth]', { kinds: [0, TRUSTROOTS_PROFILE_KIND], authors: [hex], limit: 30 }),
        trackAuth('0+10390 authors=hex [auth]', { kinds: [0, TRUSTROOTS_PROFILE_KIND], authors: [hex], limit: 30 }),
      ]);
      viewState.evAuthors = dedupeById([...(byUnauth || []), ...(byAuth || [])]);
      bump();
    })();

    void (async () => {
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
      const results = await Promise.all(queries);
      viewState.evP30390 = dedupeById(results.flat());
      bump();
    })();
    void collectFromRelays({ kinds: [RELATIONSHIP_CLAIM_KIND, EXPERIENCE_CLAIM_KIND], '#p': [hex], limit: 60 }).then(
      (x) => {
        viewState.evPClaims = x;
        bump();
      }
    );
    void collectFromRelays({ kinds: MAP_NOTE_KINDS, authors: [hex], limit: 40 }).then((x) => {
      viewState.evNotes = x;
      bump();
    });
    const importPub = circleImportToolPubkeyHex();
    const importHex =
      importPub && String(importPub).trim().length === 64 && /^[0-9a-fA-F]+$/.test(String(importPub).trim())
        ? String(importPub).trim().toLowerCase()
        : '';
    if (!importHex) {
      viewState.evHost30398 = [];
      bump();
    } else {
      void collectFromRelays({
        kinds: [MAP_NOTE_REPOST_KIND],
        authors: [importHex],
        '#p': [hex],
        limit: 100,
      }).then((x) => {
        viewState.evHost30398 = x;
        bump();
      });
    }
  } catch (err) {
    console.warn('[nr-profile]', err);
    root.innerHTML = `<p class="nr-profile-error">Something went wrong loading this profile.</p>`;
  }
}

function renderInvalidProfile(profileId) {
  const root = document.getElementById('nr-profile-root');
  if (!root) return;
  root.innerHTML = `<p class="nr-profile-error">This profile link is not valid. Use <code>#profile/npub1…</code>, a 64-character hex key, or <code>#profile/user@domain</code> (e.g. Trustroots NIP-05).</p><p class="nr-profile-muted">Fragment: ${escapeHtml(profileId || '')}</p>`;
}

/**
 * Self-only: mount Trustroots claim / relationships / experiences panel (same DOM as Keys).
 * @param {string} profileId
 */
async function renderProfileContacts(profileId) {
  const prep = await prepareProfileRootResolved(profileId);
  if (!prep) return;
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
  const prep = await prepareProfileRootResolved(profileId);
  if (!prep) return;
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
    const ev0 = pickLatest(evs, 0, hex);
    if (ev0?.content) meta = JSON.parse(ev0.content);
  } catch (_) {
    meta = {};
  }
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

    return { renderPublicProfile, renderInvalidProfile, renderProfileContacts, renderProfileEdit };
})();
export const renderPublicProfile = __nrProfilePage.renderPublicProfile;
export const renderInvalidProfile = __nrProfilePage.renderInvalidProfile;
export const renderProfileContacts = __nrProfilePage.renderProfileContacts;
export const renderProfileEdit = __nrProfilePage.renderProfileEdit;
