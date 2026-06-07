/**
 * Trustroots identity lookup for Squatbridge (kind 0 / 10390 / 30390).
 * Mirrors nr-web hub and trustroots-map conventions.
 */
(function () {
  "use strict";

  var TRUSTROOTS_PROFILE_KIND = 10390;
  var TRUSTROOTS_PROFILE_CLAIM_KIND = 30390;
  var TRUSTROOTS_USERNAME_LABEL_NAMESPACE = "org.trustroots:username";
  var IDENTITY_RELAY_URLS = [
    "wss://relay.trustroots.org",
    "wss://nip42.trustroots.org",
  ];

  function isHexKey(value) {
    return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
  }

  function normalizeUsername(value) {
    var username = String(value || "").trim().toLowerCase();
    return username && /^[a-z0-9_.-]+$/.test(username) ? username : "";
  }

  function normalizeTrustrootsNip05(value) {
    var nip05 = String(value || "").trim().toLowerCase();
    var at = nip05.lastIndexOf("@");
    if (at <= 0 || at === nip05.length - 1) return "";
    var username = normalizeUsername(nip05.slice(0, at));
    var domain = nip05.slice(at + 1).replace(/^www\./, "");
    return username && domain === "trustroots.org" ? username + "@trustroots.org" : "";
  }

  function trustrootsNip05FromUsername(value) {
    var username = normalizeUsername(value);
    return username ? username + "@trustroots.org" : "";
  }

  function newestEvent(events) {
    if (!events.length) return null;
    return events.reduce(function (latest, event) {
      return Number(event.created_at || 0) >= Number(latest.created_at || 0) ? event : latest;
    });
  }

  function matchesPubkey(event, publicKeyHex) {
    return String(event && event.pubkey || "").toLowerCase() === publicKeyHex;
  }

  function trustrootsUsernameFromTags(tags) {
    for (var i = 0; i < (tags || []).length; i += 1) {
      var tag = tags[i] || [];
      if (tag[0] === "trustroots" && tag[1]) return normalizeUsername(tag[1]);
      if (tag[0] === "l" && tag[1] && tag[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE) {
        return normalizeUsername(tag[1]);
      }
    }
    return "";
  }

  function extractKind0TrustrootsNip05(events, publicKeyHex) {
    var event = newestEvent(events.filter(function (candidate) {
      return candidate && candidate.kind === 0 && matchesPubkey(candidate, publicKeyHex);
    }));
    if (!event || !event.content) return "";
    try {
      var metadata = JSON.parse(event.content);
      return normalizeTrustrootsNip05(metadata && metadata.nip05);
    } catch (_) {
      return "";
    }
  }

  function extractKind10390TrustrootsNip05(events, publicKeyHex) {
    var event = newestEvent(events.filter(function (candidate) {
      return candidate && candidate.kind === TRUSTROOTS_PROFILE_KIND && matchesPubkey(candidate, publicKeyHex);
    }));
    return trustrootsNip05FromUsername(trustrootsUsernameFromTags(event && event.tags));
  }

  function eventTargetsPubkey(event, publicKeyHex) {
    if (matchesPubkey(event, publicKeyHex)) return true;
    return (event && event.tags || []).some(function (tag) {
      return tag && tag[0] === "p" && String(tag[1] || "").toLowerCase() === publicKeyHex;
    });
  }

  function trustrootsNip05FromClaimContent(content) {
    try {
      var metadata = JSON.parse(content || "{}");
      return (
        normalizeTrustrootsNip05(metadata && metadata.nip05) ||
        trustrootsNip05FromUsername(metadata && metadata.trustrootsUsername) ||
        trustrootsNip05FromUsername(metadata && metadata.username)
      );
    } catch (_) {
      return "";
    }
  }

  function extractKind30390TrustrootsNip05(events, publicKeyHex) {
    var candidates = events
      .filter(function (candidate) {
        return candidate && candidate.kind === TRUSTROOTS_PROFILE_CLAIM_KIND &&
          eventTargetsPubkey(candidate, publicKeyHex);
      })
      .sort(function (a, b) {
        return Number(b.created_at || 0) - Number(a.created_at || 0);
      });

    for (var i = 0; i < candidates.length; i += 1) {
      var fromTags = trustrootsNip05FromUsername(trustrootsUsernameFromTags(candidates[i].tags));
      if (fromTags) return fromTags;
      var fromContent = trustrootsNip05FromClaimContent(candidates[i].content);
      if (fromContent) return fromContent;
    }
    return "";
  }

  function dedupeEvents(events) {
    var byId = new Map();
    for (var i = 0; i < events.length; i += 1) {
      var event = events[i];
      if (event && event.id) byId.set(event.id, event);
    }
    return Array.from(byId.values());
  }

  function normalizeRelayAuthTemplate(template, relayUrl) {
    var hasRelayTag = false;
    var tags = (template.tags || []).map(function (tag) {
      if (tag[0] !== "relay") return tag;
      hasRelayTag = true;
      return ["relay", relayUrl];
    });
    return Object.assign({}, template, {
      tags: hasRelayTag ? tags : [["relay", relayUrl]].concat(tags),
    });
  }

  function readTrustrootsRelayEventsFromRelay(relayUrl, filters, timeoutMs, signAuthEvent) {
    return new Promise(function (resolve) {
      var events = [];
      var settled = false;
      var didRetryAfterAuth = false;
      var subscriptionId = "sb-identity-" + Math.random().toString(36).slice(2);
      var ws;
      var timeout = setTimeout(settle, timeoutMs);

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
          ws.send(JSON.stringify(["REQ", subscriptionId].concat(filters)));
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

      ws.addEventListener("open", subscribe);
      ws.addEventListener("message", function (message) {
        var data;
        try {
          data = JSON.parse(message.data);
        } catch (_) {
          return;
        }
        if (!Array.isArray(data)) return;
        if (data[0] === "EVENT" && data[2]) {
          events.push(data[2]);
          return;
        }
        if (data[0] === "EOSE") {
          settle();
          return;
        }
        if (data[0] === "AUTH" && typeof signAuthEvent === "function") {
          Promise.resolve(signAuthEvent({
            kind: 22242,
            created_at: Math.floor(Date.now() / 1000),
            content: "",
            tags: [
              ["relay", relayUrl],
              ["challenge", String(data[1] || "")],
            ],
          }, relayUrl))
            .then(function (signedAuth) {
              if (signedAuth) ws.send(JSON.stringify(["AUTH", signedAuth]));
            })
            .catch(function () {});
        }
        if (data[0] === "CLOSED" && String(data[2] || "").startsWith("auth-required:") && !didRetryAfterAuth) {
          didRetryAfterAuth = true;
          subscribe();
        }
      });
      ws.addEventListener("close", settle);
      ws.addEventListener("error", settle);
    });
  }

  async function readTrustrootsRelayEvents(filters, signAuthEvent) {
    var eventLists = await Promise.all(IDENTITY_RELAY_URLS.map(function (relayUrl) {
      return readTrustrootsRelayEventsFromRelay(relayUrl, filters, 3200, signAuthEvent).catch(function () {
        return [];
      });
    }));
    return dedupeEvents([].concat.apply([], eventLists));
  }

  async function lookupTrustrootsNip05(publicKeyHex, signAuthEvent) {
    if (!isHexKey(publicKeyHex)) return "";
    try {
      var kind0Events = await readTrustrootsRelayEvents([
        { kinds: [0], authors: [publicKeyHex], limit: 5 },
      ], signAuthEvent);
      var kind0Nip05 = extractKind0TrustrootsNip05(kind0Events, publicKeyHex);
      if (kind0Nip05) return kind0Nip05;

      var kind10390Events = await readTrustrootsRelayEvents([
        { kinds: [TRUSTROOTS_PROFILE_KIND], authors: [publicKeyHex], limit: 5 },
      ], signAuthEvent);
      var kind10390Nip05 = extractKind10390TrustrootsNip05(kind10390Events, publicKeyHex);
      if (kind10390Nip05) return kind10390Nip05;

      var kind30390Events = await readTrustrootsRelayEvents([
        { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], "#p": [publicKeyHex], limit: 20 },
        { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], authors: [publicKeyHex], limit: 20 },
      ], signAuthEvent);
      var kind30390Nip05 = extractKind30390TrustrootsNip05(kind30390Events, publicKeyHex);
      if (kind30390Nip05) return kind30390Nip05;

      var broadProfileEvents = await readTrustrootsRelayEvents([
        { kinds: [0, TRUSTROOTS_PROFILE_KIND], limit: 5000 },
        { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], limit: 5000 },
      ], signAuthEvent);
      return (
        extractKind0TrustrootsNip05(broadProfileEvents, publicKeyHex) ||
        extractKind10390TrustrootsNip05(broadProfileEvents, publicKeyHex) ||
        extractKind30390TrustrootsNip05(broadProfileEvents, publicKeyHex)
      );
    } catch (_) {
      return "";
    }
  }

  var nip19Promise = null;

  function loadNip19() {
    if (!nip19Promise) {
      nip19Promise = import("https://cdn.jsdelivr.net/npm/nostr-tools@2.10.4/lib/esm/index.js")
        .then(function (mod) { return mod.nip19; })
        .catch(function () { return null; });
    }
    return nip19Promise;
  }

  async function hexToNpub(publicKeyHex) {
    if (!isHexKey(publicKeyHex)) return "";
    var nip19 = await loadNip19();
    if (!nip19) return "";
    try {
      return nip19.npubEncode(publicKeyHex);
    } catch (_) {
      return "";
    }
  }

  async function resolveDisplayIdentity(publicKeyHex, signAuthEvent) {
    if (!isHexKey(publicKeyHex)) {
      return { nip05: "", npub: "", label: "" };
    }
    var cache = window.SQUATBRIDGE_CACHE;
    var cacheKey = "identity:" + publicKeyHex;
    if (cache) {
      var cached = cache.get(cacheKey);
      if (cached && cached.fresh) return cached.data;
    }

    var nip05 = await lookupTrustrootsNip05(publicKeyHex, signAuthEvent);
    var npub = await hexToNpub(publicKeyHex);
    var label = nip05 || npub || (publicKeyHex.slice(0, 8) + "…");
    var result = { nip05: nip05, npub: npub, label: label };
    if (cache) cache.set(cacheKey, result);
    return result;
  }

  window.SQUATBRIDGE_IDENTITY = {
    lookupTrustrootsNip05: lookupTrustrootsNip05,
    hexToNpub: hexToNpub,
    resolveDisplayIdentity: resolveDisplayIdentity,
    normalizeRelayAuthTemplate: normalizeRelayAuthTemplate,
  };
})();
