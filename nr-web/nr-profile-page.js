/**
 * Public profile surface for #profile/<npub|hex|nip05>
 * Fetches kind 30390 (Trustroots import), 0, 10390, map notes, 30392/30393, 30398 (#p) circle tags, 30410 circle directory.
 */
import { Relay, nip19, finalizeEvent, getPublicKey } from 'https://cdn.jsdelivr.net/npm/nostr-tools@2.10.3/+esm';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.2.2/+esm';
import { resolveNip05 } from './nip05-resolve.js';
import {
  TRUSTROOTS_CIRCLE_META_KIND,
  mergeCircleMetadataMapEntry,
} from './circle-metadata.js';
import {
  TRUSTROOTS_USERNAME_LABEL_NAMESPACE,
  trustrootsProfileUrl,
  formatPubkeyShort,
  relationshipCounterpartyDisplay,
  experienceCounterpartyDisplay,
} from './claim-utils.js';

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

function escapeHtml(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function sanitizePictureUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  try {
    const p = new URL(u, 'https://nos.trustroots.org');
    if (p.protocol !== 'https:' && p.protocol !== 'http:') return '';
    return p.href;
  } catch (_) {
    return '';
  }
}

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
  try {
    const decoded = nip19.decode(s);
    if (decoded.type === 'npub') {
      if (typeof decoded.data === 'string') {
        const h = decoded.data.toLowerCase();
        return h.length === 64 && /^[0-9a-f]+$/.test(h) ? h : null;
      }
      return Array.from(decoded.data)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (_) {}
  return null;
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
      const skHex = String(localStorage.getItem('nostr_private_key') || '').trim().toLowerCase();
      if (/^[0-9a-f]{64}$/.test(skHex)) {
        const bytes = new Uint8Array(32);
        for (let i = 0; i < 32; i += 1) {
          bytes[i] = parseInt(skHex.slice(i * 2, i * 2 + 2), 16);
        }
        skBytes = bytes;
        diag.signerSource = 'localStorage:nostr_private_key';
      } else {
        const nsec = String(localStorage.getItem('nip42test.nsec') || '').trim();
        if (nsec.toLowerCase().startsWith('nsec1')) {
          try {
            const decoded = nip19.decode(nsec);
            if (decoded?.type === 'nsec' && decoded.data instanceof Uint8Array && decoded.data.length === 32) {
              skBytes = decoded.data;
              diag.signerSource = 'localStorage:nip42test.nsec';
            }
          } catch (e) {
            diag.error = `nsec decode failed: ${e?.message || e}`;
          }
        }
      }
      if (!(skBytes instanceof Uint8Array) || skBytes.length !== 32) {
        if (!diag.error) diag.error = 'no signer available (no nostr_private_key, no nip42test.nsec)';
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
      const slug = String(t[1] || '')
        .trim()
        .toLowerCase();
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
  const uniq = [...new Set(slugs.map((s) => String(s || '').trim().toLowerCase()).filter(Boolean))].slice(0, 40);
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
    circListMount,
    nameEditBtn,
    aboutEditBtn,
  };
  return { shell, refs };
}

/**
 * @param {Record<string, HTMLElement>} refs
 * @param {{ evAuthors?: unknown[]; evP30390?: unknown[]; evPClaims?: unknown[]; evNotes?: unknown[]; evHost30398?: unknown[]; circleMetaBySlug?: Map<string, { name: string; about: string; picture: string; created_at?: number }>; avatarExtra?: string }} viewState
 * @param {{ hex: string; npub: string; profileId: string; earlyTrUser: string; circleDirStarted?: boolean; scheduleBump?: () => void }} ctx
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

  refs.avatarWrap.replaceChildren();
  if (tryList.length) {
    const img = document.createElement('img');
    img.className = 'nr-profile-avatar';
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    let idx = 0;
    img.src = tryList[idx];
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
    const hostIcon = document.createElement('div');
    hostIcon.className = 'nr-profile-tr-rail-icon';
    hostIcon.setAttribute('aria-hidden', 'true');
    hostIcon.textContent = '🛋';
    hostBody.appendChild(hostIcon);
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

  refs.circListMount.replaceChildren();
  if (!host303Ready) {
    const p = document.createElement('p');
    p.className = 'nr-profile-tr-skeleton';
    p.textContent = 'Loading circles from Trustroots host mirrors (kind 30398)…';
    refs.circListMount.appendChild(p);
  } else {
    const slugs = extractCircleSlugsFromHostReposts30398(viewState.evHost30398 || [], hex);
    if (!ctx.circleDirStarted) {
      ctx.circleDirStarted = true;
      if (!slugs.length) {
        viewState.circleMetaBySlug = new Map();
        queueMicrotask(() => ctx.scheduleBump?.());
      } else {
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
        'No circle tags on kind 30398 mirrors for this pubkey on your relays yet. They appear when the Trustroots import tags hosted offers with tribes you belong to.';
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
export async function renderPublicProfile(profileId) {
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
    const ctx = { hex, npub, profileId, earlyTrUser, circleDirStarted: false };

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

    void collectFromRelays({ kinds: [0, TRUSTROOTS_PROFILE_KIND], authors: [hex], limit: 30 }).then((x) => {
      viewState.evAuthors = x;
      bump();
    });
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

export function renderInvalidProfile(profileId) {
  const root = document.getElementById('nr-profile-root');
  if (!root) return;
  root.innerHTML = `<p class="nr-profile-error">This profile link is not valid. Use <code>#profile/npub1…</code>, a 64-character hex key, or <code>#profile/user@domain</code> (e.g. Trustroots NIP-05).</p><p class="nr-profile-muted">Fragment: ${escapeHtml(profileId || '')}</p>`;
}

/**
 * Self-only: mount Trustroots claim / relationships / experiences panel (same DOM as Keys).
 * @param {string} profileId
 */
export async function renderProfileContacts(profileId) {
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
export async function renderProfileEdit(profileId) {
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
