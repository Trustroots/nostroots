/**
 * Public profile surface for #profile/<npub|hex|nip05>
 * Fetches kind 30390 (Trustroots import), 0, 10390, map notes, 30392/30393 from user relay list.
 */
import { Relay, nip19 } from 'https://cdn.jsdelivr.net/npm/nostr-tools@2.10.3/+esm';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.2.2/+esm';
import { resolveNip05 } from './nip05-resolve.js';
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

const DEFAULT_RELAYS = ['wss://nip42.trustroots.org', 'wss://relay.trustroots.org', 'wss://relay.nomadwiki.org'];

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

function dedupeById(events) {
  const m = new Map();
  for (const ev of events || []) {
    if (ev && ev.id) m.set(ev.id, ev);
  }
  return [...m.values()];
}

function pickLatest(events, kind, authorHex) {
  const h = (authorHex || '').toLowerCase();
  const list = (events || []).filter((e) => e.kind === kind && String(e.pubkey).toLowerCase() === h);
  if (!list.length) return null;
  return list.reduce((a, b) => (a.created_at >= b.created_at ? a : b));
}

function pickLatest30390(events, subjectHex) {
  const h = (subjectHex || '').toLowerCase();
  const list = (events || []).filter((e) => {
    if (e.kind !== PROFILE_CLAIM_KIND) return false;
    const ps = (e.tags || []).filter((t) => t[0] === 'p' && t[1]);
    return ps.some((t) => String(t[1]).toLowerCase() === h);
  });
  if (!list.length) return null;
  return list.reduce((a, b) => (a.created_at >= b.created_at ? a : b));
}

async function collectFromRelays(filter, timeoutMs = 2600) {
  const urls = relayUrls();
  const all = [];
  await Promise.all(
    urls.map(async (url) => {
      try {
        const relay = await Relay.connect(url);
        const sub = relay.subscribe([filter], {
          onevent: (ev) => all.push(ev),
        });
        await new Promise((r) => setTimeout(r, timeoutMs));
        try {
          sub.close();
        } catch (_) {}
        try {
          relay.close();
        } catch (_) {}
      } catch (_) {}
    })
  );
  return dedupeById(all);
}

async function tryTrustrootsApiAvatar(username) {
  const u = String(username || '').trim().toLowerCase();
  if (!u) return '';
  try {
    const res = await fetch(`https://www.trustroots.org/api/users/${encodeURIComponent(u)}`, {
      mode: 'cors',
      credentials: 'omit',
    });
    if (!res.ok) return '';
    const j = await res.json();
    const src = j.avatarSource;
    if (src === 'local' && j.avatarUploaded && j._id) {
      const ts = j.updated ? new Date(j.updated).getTime() : '';
      return sanitizePictureUrl(`https://www.trustroots.org/uploads-profile/${j._id}/avatar/256.jpg?${ts}`);
    }
    if (src === 'gravatar' && j.emailHash) {
      return sanitizePictureUrl(`https://www.gravatar.com/avatar/${j.emailHash}?s=256&d=identicon`);
    }
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

function chatHashForSubject(hex, nip05Lower, trUsername) {
  if (nip05Lower) return '#' + encodeURIComponent(nip05Lower).replace(/%2B/g, '+');
  if (trUsername) return '#' + encodeURIComponent(`${trUsername}@trustroots.org`).replace(/%2B/g, '+');
  try {
    return '#' + nip19.npubEncode(hex);
  } catch (_) {
    return '#profile/' + hex;
  }
}

function publicProfileHashForHex(hex) {
  const h = String(hex || '').toLowerCase();
  if (h.length !== 64 || !/^[0-9a-f]+$/.test(h)) {
    return '#profile/' + encodeURIComponent(String(hex || '')).replace(/%2B/g, '+');
  }
  try {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return '#profile/' + encodeURIComponent(nip19.npubEncode(bytes)).replace(/%2B/g, '+');
  } catch (_) {
    return '#profile/' + encodeURIComponent(h).replace(/%2B/g, '+');
  }
}

function isSelfHex(subjectHex) {
  const self = window.NrWebGetCurrentPubkeyHex?.();
  if (!self || !subjectHex) return false;
  return String(self).toLowerCase() === String(subjectHex).toLowerCase();
}

function renderClaimLineRelationship(ev, subjectHex, trUsernameForSubject) {
  const wrap = document.createElement('div');
  wrap.className = 'nr-profile-claim-line';
  const meta = document.createElement('div');
  meta.className = 'nr-profile-claim-meta';
  const disp = relationshipCounterpartyDisplay(ev.tags, ev.content, subjectHex, trUsernameForSubject || '');
  if (disp.type === 'hex') {
    meta.textContent = `Other: ${formatPubkeyShort(disp.hex)}`;
  } else if (disp.type === 'user' && disp.usernames[0]) {
    const u = disp.usernames[0];
    meta.appendChild(document.createTextNode('Other: '));
    const a = document.createElement('a');
    a.href = '#profile/' + encodeURIComponent(`${u}@trustroots.org`).replace(/%2B/g, '+');
    a.className = 'nr-content-link';
    a.textContent = `@${u}`;
    meta.appendChild(a);
  } else if (disp.type === 'users' && disp.usernames.length === 2) {
    meta.textContent = `Between @${disp.usernames[0]} → @${disp.usernames[1]}`;
  } else {
    meta.textContent = 'Relationship suggestion';
  }
  const body = document.createElement('div');
  body.className = 'nr-profile-claim-body';
  body.textContent = ev.content || '';
  wrap.appendChild(meta);
  wrap.appendChild(body);
  return wrap;
}

function renderClaimLineExperience(ev, subjectHex) {
  const wrap = document.createElement('div');
  wrap.className = 'nr-profile-claim-line';
  const meta = document.createElement('div');
  meta.className = 'nr-profile-claim-meta';
  const disp = experienceCounterpartyDisplay(ev.tags, subjectHex);
  if (disp.type === 'hex') {
    meta.textContent = `Other: ${formatPubkeyShort(disp.hex)}`;
  } else if (disp.type === 'user' && disp.username) {
    const u = disp.username;
    meta.appendChild(document.createTextNode('About: '));
    const a = document.createElement('a');
    a.href = '#profile/' + encodeURIComponent(`${u}@trustroots.org`).replace(/%2B/g, '+');
    a.className = 'nr-content-link';
    a.textContent = `@${u}`;
    meta.appendChild(a);
  } else {
    meta.textContent = 'Experience suggestion';
  }
  const body = document.createElement('div');
  body.className = 'nr-profile-claim-body';
  body.textContent = truncateBody(ev.content, 400);
  wrap.appendChild(meta);
  wrap.appendChild(body);
  return wrap;
}

/**
 * @param {string} profileId - npub, hex, or nip05 (decoded)
 */
export async function renderPublicProfile(profileId) {
  const root = document.getElementById('nr-profile-root');
  if (!root) return;
  root.innerHTML = '<p class="nr-profile-loading">Loading…</p>';

  const hex = await resolveProfileIdToHex(profileId);
  if (!hex) {
    root.innerHTML =
      '<p class="nr-profile-error">Could not resolve that NIP-05, or the npub is invalid.</p>';
    return;
  }

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
    const [evAuthors, evP30390, evPClaims, evNotes] = await Promise.all([
      collectFromRelays({ kinds: [0, TRUSTROOTS_PROFILE_KIND], authors: [hex], limit: 30 }),
      collectFromRelays({ kinds: [PROFILE_CLAIM_KIND], '#p': [hex], limit: 20 }),
      collectFromRelays({ kinds: [RELATIONSHIP_CLAIM_KIND, EXPERIENCE_CLAIM_KIND], '#p': [hex], limit: 60 }),
      collectFromRelays({ kinds: MAP_NOTE_KINDS, authors: [hex], limit: 40 }),
    ]);

    const mergedEvents = dedupeById([...evAuthors, ...evP30390]);
    const ev0 = pickLatest(mergedEvents, 0, hex);
    const ev10390 = pickLatest(mergedEvents, TRUSTROOTS_PROFILE_KIND, hex);
    const ev30390 = pickLatest30390(evP30390, hex);

    const meta = mergeProfile30390AndKind0(ev30390, ev0);
    let trUser =
      meta.trustrootsUsername ||
      getTrustrootsUsernameFrom10390(ev10390 || {}) ||
      getTrustrootsUsernameFromKind0(ev0 || {});

    let picture = meta.picture;
    if (!picture && trUser) {
      picture = await tryTrustrootsApiAvatar(trUser);
    }

    const nip05Resolved = meta.nip05 || (trUser ? `${trUser}@trustroots.org` : '');

    root.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'nr-profile-card';

    const head = document.createElement('div');
    head.className = 'nr-profile-head';
    const img = document.createElement('img');
    img.className = 'nr-profile-avatar';
    img.alt = '';
    if (picture) {
      img.src = picture;
      img.referrerPolicy = 'no-referrer';
    } else {
      img.style.display = 'none';
    }
    const titleBlock = document.createElement('div');
    titleBlock.className = 'nr-profile-title-block';
    const h1 = document.createElement('h1');
    h1.className = 'nr-profile-title';
    h1.textContent = meta.displayName || npub || formatPubkeyShort(hex);
    const sub = document.createElement('div');
    sub.className = 'nr-profile-sub';
    sub.textContent = nip05Resolved || npub || hex;
    titleBlock.appendChild(h1);
    titleBlock.appendChild(sub);
    head.appendChild(img);
    head.appendChild(titleBlock);
    card.appendChild(head);

    if (meta.about) {
      const about = document.createElement('div');
      about.className = 'nr-profile-about';
      const rawAbout = String(meta.about);
      if (profileAboutLooksLikeHtml(rawAbout)) {
        about.innerHTML = sanitizeProfileAboutHtml(rawAbout);
      } else {
        about.textContent = rawAbout;
      }
      card.appendChild(about);
    }

    const ids = document.createElement('div');
    ids.className = 'nr-profile-ids';
    ids.innerHTML = `<div><strong>npub</strong> <code class="nr-profile-code">${escapeHtml(npub)}</code> <button type="button" class="btn btn-secondary nr-profile-copy" data-copy-npub="${escapeHtml(npub)}">Copy</button></div>`;
    if (nip05Resolved) {
      const row = document.createElement('div');
      row.innerHTML = `<strong>NIP-05</strong> <span class="nr-profile-nip05">${escapeHtml(nip05Resolved)}</span>`;
      ids.appendChild(row);
    }
    card.appendChild(ids);

    const actions = document.createElement('div');
    actions.className = 'nr-profile-actions';
    const msg = document.createElement('a');
    msg.className = 'btn';
    msg.href = chatHashForSubject(hex, nip05Resolved, trUser);
    msg.textContent = 'Message';
    actions.appendChild(msg);
    if (trUser) {
      const tr = document.createElement('a');
      tr.className = 'btn btn-secondary';
      tr.href = trustrootsProfileUrl(trUser);
      tr.target = '_blank';
      tr.rel = 'noopener noreferrer';
      tr.textContent = 'Open on Trustroots';
      actions.appendChild(tr);
    }
    card.appendChild(actions);

    const noteHint = document.createElement('p');
    noteHint.className = 'nr-profile-muted';
    noteHint.textContent =
      'Relationship and experience lines are mirrored suggestions from relays, same as in Keys — not edited here.';
    card.appendChild(noteHint);

    const notesTitle = document.createElement('h2');
    notesTitle.className = 'nr-profile-section-title';
    notesTitle.textContent = 'Recent map notes';
    card.appendChild(notesTitle);
    const notesBox = document.createElement('div');
    notesBox.className = 'nr-profile-list';
    const notesSorted = evNotes
      .filter((e) => MAP_NOTE_KINDS.includes(e.kind))
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 25);
    if (!notesSorted.length) {
      const empty = document.createElement('p');
      empty.className = 'nr-profile-muted';
      empty.textContent = 'No map notes found on your relays for this author yet.';
      notesBox.appendChild(empty);
    } else {
      for (const ev of notesSorted) {
        const pc = getPlusCodeFromEvent(ev);
        const row = document.createElement('div');
        row.className = 'nr-profile-note-row';
        const a = document.createElement('a');
        a.className = 'nr-content-link';
        if (pc) {
          a.href = '#' + encodeURIComponent(pc).replace(/%2B/g, '+');
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
        notesBox.appendChild(row);
      }
    }
    card.appendChild(notesBox);

    const relTitle = document.createElement('h2');
    relTitle.className = 'nr-profile-section-title';
    relTitle.textContent = 'Relationship suggestions';
    card.appendChild(relTitle);
    const relBox = document.createElement('div');
    relBox.className = 'nr-profile-list';
    const rels = evPClaims.filter((e) => e.kind === RELATIONSHIP_CLAIM_KIND).slice(0, 20);
    if (!rels.length) {
      const p = document.createElement('p');
      p.className = 'nr-profile-muted';
      p.textContent = 'None loaded.';
      relBox.appendChild(p);
    } else {
      for (const ev of rels) relBox.appendChild(renderClaimLineRelationship(ev, hex, trUser));
    }
    card.appendChild(relBox);

    const expTitle = document.createElement('h2');
    expTitle.className = 'nr-profile-section-title';
    expTitle.textContent = 'Experience suggestions';
    card.appendChild(expTitle);
    const expBox = document.createElement('div');
    expBox.className = 'nr-profile-list';
    const exps = evPClaims.filter((e) => e.kind === EXPERIENCE_CLAIM_KIND).slice(0, 20);
    if (!exps.length) {
      const p = document.createElement('p');
      p.className = 'nr-profile-muted';
      p.textContent = 'None loaded.';
      expBox.appendChild(p);
    } else {
      for (const ev of exps) expBox.appendChild(renderClaimLineExperience(ev, hex));
    }
    card.appendChild(expBox);

    root.appendChild(card);

    card.querySelector('.nr-profile-copy')?.addEventListener('click', async () => {
      const v = npub;
      if (!v) return;
      try {
        await navigator.clipboard.writeText(v);
      } catch (_) {}
    });
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
  const root = document.getElementById('nr-profile-root');
  if (!root) return;
  root.innerHTML = '<p class="nr-profile-loading">Loading…</p>';
  const hex = await resolveProfileIdToHex(profileId);
  if (!hex) {
    root.innerHTML =
      '<p class="nr-profile-error">Could not resolve that NIP-05, or the npub is invalid.</p>';
    return;
  }
  if (!isSelfHex(hex)) {
    const href = publicProfileHashForHex(hex);
    root.innerHTML = `<p class="nr-profile-muted">Contacts and claim signing are only available on your own profile.</p><p><a class="btn" href="${escapeHtml(href)}">View public profile</a></p>`;
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
  const root = document.getElementById('nr-profile-root');
  if (!root) return;
  root.innerHTML = '<p class="nr-profile-loading">Loading…</p>';
  const hex = await resolveProfileIdToHex(profileId);
  if (!hex) {
    root.innerHTML =
      '<p class="nr-profile-error">Could not resolve that NIP-05, or the npub is invalid.</p>';
    return;
  }
  if (!isSelfHex(hex)) {
    const href = publicProfileHashForHex(hex);
    root.innerHTML = `<p class="nr-profile-muted">You can only edit your own Nostr profile metadata.</p><p><a class="btn" href="${escapeHtml(href)}">View public profile</a></p>`;
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
