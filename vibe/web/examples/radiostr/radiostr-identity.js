/**
 * Trustroots identity lookup for Radiostr (kind 0 / 10390 / 30390).
 */
(function () {
  'use strict';

  const TRUSTROOTS_PROFILE_KIND = 10390;
  const TRUSTROOTS_PROFILE_CLAIM_KIND = 30390;
  const TRUSTROOTS_USERNAME_LABEL_NAMESPACE = 'org.trustroots:username';
  const IDENTITY_RELAY_URLS = [
    'wss://relay.trustroots.org',
    'wss://nip42.trustroots.org'
  ];
  const identityCache = new Map();

  function isHexKey(value) {
    return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
  }

  function normalizeUsername(value) {
    const username = String(value || '').trim().toLowerCase();
    return username && /^[a-z0-9_.-]+$/.test(username) ? username : '';
  }

  function normalizeTrustrootsNip05(value) {
    const nip05 = String(value || '').trim().toLowerCase();
    const at = nip05.lastIndexOf('@');
    if (at <= 0 || at === nip05.length - 1) return '';
    const username = normalizeUsername(nip05.slice(0, at));
    const domain = nip05.slice(at + 1).replace(/^www\./, '');
    return username && domain === 'trustroots.org' ? username + '@trustroots.org' : '';
  }

  function trustrootsNip05FromUsername(value) {
    const username = normalizeUsername(value);
    return username ? username + '@trustroots.org' : '';
  }

  function newestEvent(events) {
    if (!events.length) return null;
    return events.reduce((latest, event) => {
      return Number(event.created_at || 0) >= Number(latest.created_at || 0) ? event : latest;
    });
  }

  function matchesPubkey(event, publicKeyHex) {
    return String(event && event.pubkey || '').toLowerCase() === publicKeyHex.toLowerCase();
  }

  function trustrootsUsernameFromTags(tags) {
    for (let i = 0; i < (tags || []).length; i += 1) {
      const tag = tags[i] || [];
      if (tag[0] === 'trustroots' && tag[1]) return normalizeUsername(tag[1]);
      if (tag[0] === 'l' && tag[1] && tag[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE) {
        return normalizeUsername(tag[1]);
      }
    }
    return '';
  }

  function extractKind0TrustrootsNip05(events, publicKeyHex) {
    const event = newestEvent(events.filter((candidate) => {
      return candidate && candidate.kind === 0 && matchesPubkey(candidate, publicKeyHex);
    }));
    if (!event || !event.content) return '';
    try {
      const metadata = JSON.parse(event.content);
      return normalizeTrustrootsNip05(metadata && metadata.nip05);
    } catch (_) {
      return '';
    }
  }

  function extractKind10390TrustrootsNip05(events, publicKeyHex) {
    const event = newestEvent(events.filter((candidate) => {
      return candidate && candidate.kind === TRUSTROOTS_PROFILE_KIND && matchesPubkey(candidate, publicKeyHex);
    }));
    return trustrootsNip05FromUsername(trustrootsUsernameFromTags(event && event.tags));
  }

  function eventTargetsPubkey(event, publicKeyHex) {
    if (matchesPubkey(event, publicKeyHex)) return true;
    return (event && event.tags || []).some((tag) => {
      return tag && tag[0] === 'p' && String(tag[1] || '').toLowerCase() === publicKeyHex.toLowerCase();
    });
  }

  function trustrootsNip05FromClaimContent(content) {
    try {
      const metadata = JSON.parse(content || '{}');
      return (
        normalizeTrustrootsNip05(metadata && metadata.nip05) ||
        trustrootsNip05FromUsername(metadata && metadata.trustrootsUsername) ||
        trustrootsNip05FromUsername(metadata && metadata.username)
      );
    } catch (_) {
      return '';
    }
  }

  function extractKind30390TrustrootsNip05(events, publicKeyHex) {
    const candidates = events
      .filter((candidate) => {
        return candidate && candidate.kind === TRUSTROOTS_PROFILE_CLAIM_KIND &&
          eventTargetsPubkey(candidate, publicKeyHex);
      })
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));

    for (let i = 0; i < candidates.length; i += 1) {
      const fromTags = trustrootsNip05FromUsername(trustrootsUsernameFromTags(candidates[i].tags));
      if (fromTags) return fromTags;
      const fromContent = trustrootsNip05FromClaimContent(candidates[i].content);
      if (fromContent) return fromContent;
    }
    return '';
  }

  function dedupeEvents(events) {
    const byId = new Map();
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      if (event && event.id) byId.set(event.id, event);
    }
    return Array.from(byId.values());
  }

  function normalizeRelayAuthTemplate(template, relayUrl) {
    let hasRelayTag = false;
    const tags = (template.tags || []).map((tag) => {
      if (tag[0] !== 'relay') return tag;
      hasRelayTag = true;
      return ['relay', relayUrl];
    });
    return Object.assign({}, template, {
      tags: hasRelayTag ? tags : [['relay', relayUrl]].concat(tags)
    });
  }

  function readTrustrootsRelayEventsFromRelay(relayUrl, filters, timeoutMs, signAuthEvent) {
    return new Promise((resolve) => {
      const events = [];
      let settled = false;
      let didRetryAfterAuth = false;
      const subscriptionId = 'rs-identity-' + Math.random().toString(36).slice(2);
      let ws;
      const timeout = setTimeout(settle, timeoutMs);

      function settle() {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try {
          if (ws && ws.readyState !== WebSocket.CLOSED) ws.close();
        } catch (_) {}
        resolve(events);
      }

      function subscribe() {
        try {
          ws.send(JSON.stringify(['REQ', subscriptionId].concat(filters)));
        } catch (_) {
          settle();
        }
      }

      try {
        ws = new WebSocket(relayUrl);
      } catch (_) {
        settle();
        return;
      }

      ws.addEventListener('open', subscribe);
      ws.addEventListener('message', (message) => {
        let data;
        try {
          data = JSON.parse(message.data);
        } catch (_) {
          return;
        }
        if (!Array.isArray(data)) return;
        if (data[0] === 'EVENT' && data[2]) {
          events.push(data[2]);
          return;
        }
        if (data[0] === 'EOSE') {
          settle();
          return;
        }
        if (data[0] === 'AUTH' && typeof signAuthEvent === 'function') {
          Promise.resolve(signAuthEvent({
            kind: 22242,
            created_at: Math.floor(Date.now() / 1000),
            content: '',
            tags: [
              ['relay', relayUrl],
              ['challenge', String(data[1] || '')]
            ]
          }, relayUrl))
            .then((signedAuth) => {
              if (signedAuth) ws.send(JSON.stringify(['AUTH', signedAuth]));
            })
            .catch(() => {});
        }
        if (data[0] === 'CLOSED' && String(data[2] || '').startsWith('auth-required:') && !didRetryAfterAuth) {
          didRetryAfterAuth = true;
          subscribe();
        }
      });
      ws.addEventListener('close', settle);
      ws.addEventListener('error', settle);
    });
  }

  async function readTrustrootsRelayEvents(filters, signAuthEvent) {
    const eventLists = await Promise.all(IDENTITY_RELAY_URLS.map((relayUrl) => {
      return readTrustrootsRelayEventsFromRelay(relayUrl, filters, 3200, signAuthEvent).catch(() => []);
    }));
    return dedupeEvents(eventLists.flat());
  }

  async function lookupTrustrootsNip05(publicKeyHex, signAuthEvent) {
    if (!isHexKey(publicKeyHex)) return '';
    try {
      const hex = publicKeyHex.toLowerCase();
      const kind0Events = await readTrustrootsRelayEvents([
        { kinds: [0], authors: [hex], limit: 5 }
      ], signAuthEvent);
      const kind0Nip05 = extractKind0TrustrootsNip05(kind0Events, hex);
      if (kind0Nip05) return kind0Nip05;

      const kind10390Events = await readTrustrootsRelayEvents([
        { kinds: [TRUSTROOTS_PROFILE_KIND], authors: [hex], limit: 5 }
      ], signAuthEvent);
      const kind10390Nip05 = extractKind10390TrustrootsNip05(kind10390Events, hex);
      if (kind10390Nip05) return kind10390Nip05;

      const kind30390Events = await readTrustrootsRelayEvents([
        { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], '#p': [hex], limit: 20 },
        { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], authors: [hex], limit: 20 }
      ], signAuthEvent);
      const kind30390Nip05 = extractKind30390TrustrootsNip05(kind30390Events, hex);
      if (kind30390Nip05) return kind30390Nip05;

      const broadProfileEvents = await readTrustrootsRelayEvents([
        { kinds: [0, TRUSTROOTS_PROFILE_KIND], limit: 5000 },
        { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], limit: 5000 }
      ], signAuthEvent);
      return (
        extractKind0TrustrootsNip05(broadProfileEvents, hex) ||
        extractKind10390TrustrootsNip05(broadProfileEvents, hex) ||
        extractKind30390TrustrootsNip05(broadProfileEvents, hex)
      );
    } catch (_) {
      return '';
    }
  }

  let nip19Promise = null;

  function loadNip19() {
    if (!nip19Promise) {
      nip19Promise = import('https://cdn.jsdelivr.net/npm/nostr-tools@2.7.2/+esm')
        .then((mod) => mod.nip19)
        .catch(() => null);
    }
    return nip19Promise;
  }

  async function hexToNpub(publicKeyHex) {
    if (!isHexKey(publicKeyHex)) return '';
    const nip19 = await loadNip19();
    if (!nip19) return '';
    try {
      return nip19.npubEncode(publicKeyHex.toLowerCase());
    } catch (_) {
      return '';
    }
  }

  async function resolveDisplayIdentity(publicKeyHex, signAuthEvent) {
    if (!isHexKey(publicKeyHex)) {
      return { nip05: '', npub: '', label: '' };
    }
    const hex = publicKeyHex.toLowerCase();
    const cacheKey = 'identity:' + hex;
    if (identityCache.has(cacheKey)) return identityCache.get(cacheKey);

    const nip05 = await lookupTrustrootsNip05(hex, signAuthEvent);
    const npub = await hexToNpub(hex);
    const label = nip05 || npub || (hex.slice(0, 8) + '…');
    const result = { nip05, npub, label };
    identityCache.set(cacheKey, result);
    return result;
  }

  window.RADIOSTR_IDENTITY = {
    lookupTrustrootsNip05,
    hexToNpub,
    resolveDisplayIdentity,
    normalizeRelayAuthTemplate
  };
})();
