/**
 * Simple TTL cache for Squatbridge API responses (memory + localStorage).
 * Radar events change slowly — fresh for 24h, stale fallback up to 7 days.
 */
(function () {
  "use strict";

  var TTL_MS = 24 * 60 * 60 * 1000;
  var STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;
  var STORAGE_PREFIX = "squatbridge:cache:v2:";
  var memory = Object.create(null);
  var storage = typeof localStorage !== "undefined" ? localStorage : null;

  function readStorage(key) {
    if (!storage) return null;
    try {
      var raw = storage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeStorage(key, entry) {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch (_) {
      try {
        for (var i = storage.length - 1; i >= 0; i -= 1) {
          var k = storage.key(i);
          if (k && k.indexOf(STORAGE_PREFIX) === 0) storage.removeItem(k);
        }
        storage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
      } catch (_) {}
    }
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry.storedAt !== "number") return null;
    return entry;
  }

  function get(key, options) {
    options = options || {};
    var now = Date.now();
    var entry = normalizeEntry(memory[key]) || normalizeEntry(readStorage(key));
    if (!entry) return null;

    memory[key] = entry;
    var ageMs = now - entry.storedAt;
    if (ageMs <= TTL_MS) {
      return { data: entry.data, fresh: true, ageMs: ageMs };
    }
    if (options.allowStale && ageMs <= STALE_MAX_MS) {
      return { data: entry.data, fresh: false, ageMs: ageMs };
    }
    return null;
  }

  function set(key, data) {
    var entry = { storedAt: Date.now(), data: data };
    memory[key] = entry;
    writeStorage(key, entry);
  }

  function formatAge(ageMs) {
    var mins = Math.max(1, Math.round(ageMs / 60000));
    if (mins < 60) return mins + " min";
    var hours = Math.round(mins / 60);
    if (hours < 48) return hours + " h";
    var days = Math.round(hours / 24);
    return days + " d";
  }

  function listCached(prefix, maxAgeMs) {
    var now = Date.now();
    var keyPrefix = prefix || "";
    var maxAge = typeof maxAgeMs === "number" ? maxAgeMs : STALE_MAX_MS;
    var seen = Object.create(null);
    var results = [];

    function consider(key, entry) {
      if (keyPrefix && key.indexOf(keyPrefix) !== 0) return;
      var normalized = normalizeEntry(entry);
      if (!normalized || seen[key]) return;
      seen[key] = true;
      var ageMs = now - normalized.storedAt;
      if (ageMs > maxAge) return;
      memory[key] = normalized;
      results.push({
        key: key,
        data: normalized.data,
        ageMs: ageMs,
        fresh: ageMs <= TTL_MS,
      });
    }

    Object.keys(memory).forEach(function (key) {
      consider(key, memory[key]);
    });

    if (storage) {
      try {
        for (var i = 0; i < storage.length; i += 1) {
          var storageKey = storage.key(i);
          if (!storageKey || storageKey.indexOf(STORAGE_PREFIX) !== 0) continue;
          consider(storageKey.slice(STORAGE_PREFIX.length), readStorage(storageKey.slice(STORAGE_PREFIX.length)));
        }
      } catch (_) {}
    }

    return results;
  }

  function listFresh(prefix) {
    return listCached(prefix, TTL_MS).filter(function (entry) {
      return entry.fresh;
    });
  }

  window.SQUATBRIDGE_CACHE = {
    TTL_MS: TTL_MS,
    STALE_MAX_MS: STALE_MAX_MS,
    get: get,
    set: set,
    listFresh: listFresh,
    listCached: listCached,
    formatAge: formatAge,
  };
})();
