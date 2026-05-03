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
