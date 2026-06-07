/**
 * Simple TTL cache for Squatbridge API responses (memory + sessionStorage).
 */
(function () {
  "use strict";

  var TTL_MS = 15 * 60 * 1000;
  var STALE_MAX_MS = 24 * 60 * 60 * 1000;
  var STORAGE_PREFIX = "squatbridge:cache:v1:";
  var memory = Object.create(null);

  function readStorage(key) {
    try {
      var raw = sessionStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeStorage(key, entry) {
    try {
      sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch (_) {
      try {
        for (var i = 0; i < sessionStorage.length; i += 1) {
          var k = sessionStorage.key(i);
          if (k && k.indexOf(STORAGE_PREFIX) === 0) sessionStorage.removeItem(k);
        }
        sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
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
    return hours + " h";
  }

  function listFresh(prefix) {
    var now = Date.now();
    var keyPrefix = prefix || "";
    var seen = Object.create(null);
    var results = [];

    function consider(key, entry) {
      if (keyPrefix && key.indexOf(keyPrefix) !== 0) return;
      var normalized = normalizeEntry(entry);
      if (!normalized || seen[key]) return;
      seen[key] = true;
      var ageMs = now - normalized.storedAt;
      if (ageMs > TTL_MS) return;
      memory[key] = normalized;
      results.push({ key: key, data: normalized.data, ageMs: ageMs });
    }

    Object.keys(memory).forEach(function (key) {
      consider(key, memory[key]);
    });

    try {
      for (var i = 0; i < sessionStorage.length; i += 1) {
        var storageKey = sessionStorage.key(i);
        if (!storageKey || storageKey.indexOf(STORAGE_PREFIX) !== 0) continue;
        consider(storageKey.slice(STORAGE_PREFIX.length), readStorage(storageKey.slice(STORAGE_PREFIX.length)));
      }
    } catch (_) {}

    return results;
  }

  window.SQUATBRIDGE_CACHE = {
    TTL_MS: TTL_MS,
    get: get,
    set: set,
    listFresh: listFresh,
    formatAge: formatAge,
  };
})();
