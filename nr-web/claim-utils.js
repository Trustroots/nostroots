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
