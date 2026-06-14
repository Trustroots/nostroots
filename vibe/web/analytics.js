(function () {
  'use strict';

  var UMAMI_SRC = 'https://1p.trustroots.org/script.js';
  var UMAMI_WEBSITE_ID = 'aefdc936-5f3e-48b6-a512-71d7a5292868';
  var EVENT_NAME_MAX = 50;
  var STRING_MAX = 120;
  var ALLOWED_KEYS = {
    enabled: true,
    hostname: true,
    source: true,
    status: true,
    surface: true,
  };

  function sanitizeString(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_:+.-]/g, '_')
      .slice(0, STRING_MAX);
  }

  function sanitizeData(data) {
    var out = {};
    var input = data && typeof data === 'object' ? data : {};
    Object.keys(input).forEach(function (key) {
      var value = input[key];
      if (!ALLOWED_KEYS[key] || value === undefined || value === null || value === '') return;
      if (typeof value === 'boolean') {
        out[key] = value;
      } else {
        var sanitized = sanitizeString(value);
        if (sanitized) out[key] = sanitized;
      }
    });
    return out;
  }

  function getHostname() {
    try {
      return sanitizeString(window.location && window.location.hostname);
    } catch (_) {
      return '';
    }
  }

  function loadUmami() {
    if (window.umami && typeof window.umami.track === 'function') return;
    if (document.querySelector('script[data-nr-vibe-umami]')) return;

    var script = document.createElement('script');
    script.defer = true;
    script.src = UMAMI_SRC;
    script.dataset.websiteId = UMAMI_WEBSITE_ID;
    script.dataset.nrVibeUmami = 'true';
    (document.head || document.documentElement).appendChild(script);
  }

  function track(name, data) {
    try {
      var eventName = sanitizeString(name).slice(0, EVENT_NAME_MAX);
      var tracker = window.umami;
      if (!eventName || !tracker || typeof tracker.track !== 'function') return false;
      tracker.track(eventName, sanitizeData(Object.assign({
        hostname: getHostname(),
      }, data && typeof data === 'object' ? data : {})));
      return true;
    } catch (_) {
      return false;
    }
  }

  window.NrVibeAnalytics = {
    track: track,
    sanitizeData: sanitizeData,
  };

  loadUmami();
})();
