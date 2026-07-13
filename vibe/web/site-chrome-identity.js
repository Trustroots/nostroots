var NR_WEB_NOSTROOTS_BROWSER_USER_AGENT_MARKER = 'NostrootsBrowser/';
var NR_WEB_NOSTROOTS_IOS_USER_AGENT_MARKER = 'NostrootsBrowser/1.0 iOS-native';
var NOSTROOTS_APP_DETECTION_TIMEOUT_MS = 12000;
var NOSTROOTS_APP_DETECTION_INTERVAL_MS = 250;

function shortenNpub(npub) {
  return npub && npub.length > 22 ? npub.slice(0, 10) + '...' + npub.slice(-8) : npub;
}

function isInNostrootsApp() {
  var ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (ua.indexOf(NR_WEB_NOSTROOTS_BROWSER_USER_AGENT_MARKER) !== -1) return true;
  if (typeof window !== 'undefined') {
    if (window.nostr && window.nostr.__nostrootsBrowser === true) return true;
    if (window.__nostrootsNip7Installed === true) return true;
  }
  return false;
}

function isInNostrootsIOSApp() {
  var ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return ua.indexOf(NR_WEB_NOSTROOTS_IOS_USER_AGENT_MARKER) !== -1;
}

function hideHubIntroduction() {
  var lead = document.querySelector('.hub-header .lead');
  if (lead) lead.hidden = true;

  var webExperiencesSection = document.getElementById('web-experiences-section');
  if (!webExperiencesSection) return;

  var webExperiencesHeading = document.getElementById('web-experiences-heading');
  var webExperiencesLead = webExperiencesSection.querySelector('.section-lead');
  if (webExperiencesHeading) webExperiencesHeading.hidden = true;
  if (webExperiencesLead) webExperiencesLead.hidden = true;
}

function hideAppDownloadPrompts() {
  if (!isInNostrootsApp()) return;

  document.documentElement.classList.add('is-in-nostroots-browser');
  if (isInNostrootsIOSApp()) {
    document.documentElement.classList.add('is-in-nostroots-ios');
  }

  var downloadSection = document.getElementById('download-section');
  if (downloadSection) downloadSection.hidden = true;

  document.querySelectorAll(
    '.hub-nav a[data-umami-event-target="android-app"], .hub-nav a[data-umami-event-target="ios-app"]'
  ).forEach(function (link) {
    link.hidden = true;
  });

  hideHubIntroduction();

  var nip7Modal = document.getElementById('nip7-info-modal');
  if (nip7Modal) {
    nip7Modal.querySelectorAll('li').forEach(function (item) {
      if (item.textContent.indexOf('On mobile, install') !== -1) item.hidden = true;
    });
  }
}

function watchForNostrootsApp() {
  if (isInNostrootsApp()) {
    hideAppDownloadPrompts();
    return;
  }

  var startedAt = Date.now();
  var timer = setInterval(function () {
    if (isInNostrootsApp()) {
      hideAppDownloadPrompts();
      clearInterval(timer);
      return;
    }
    if (Date.now() - startedAt >= NOSTROOTS_APP_DETECTION_TIMEOUT_MS) {
      clearInterval(timer);
    }
  }, NOSTROOTS_APP_DETECTION_INTERVAL_MS);
}

function ensureNip7InfoModal() {
  var modal = document.getElementById('nip7-info-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'nip7-info-modal';
    modal.className = 'info-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'nip7-info-title');
    modal.hidden = true;
    document.body.appendChild(modal);
  }

  modal.innerHTML = [
    '<section class="info-modal-panel" tabindex="-1">',
    '<div class="info-modal-header">',
    '<h2 id="nip7-info-title">Nostr connection</h2>',
    '<button class="info-modal-close" type="button" data-nip7-close aria-label="Close Nostr connection information">X</button>',
    '</div>',
    '<div class="info-modal-body">',
    '<section data-nip7-info-state="no-signer">',
    '<h3>Connect a Nostr key</h3>',
    '<p>A Nostr key is your account for Nostr apps. It stays in a signer, so Nostroots never needs your private key.</p>',
    '<ul>',
    '<li>On mobile, install the Nostroots app for <a href="https://play.google.com/store/apps/details?id=org.trustroots.nostroots" target="_blank" rel="noopener noreferrer">Android</a> or <a href="https://apps.apple.com/app/nostroots/id6755037304" target="_blank" rel="noopener noreferrer">iOS</a>.</li>',
    '<li>On desktop, install the <a href="https://chromewebstore.google.com/detail/nostroots-extension/kmgfnmgidnajdpjnpfekmcbbdpgdimhf" target="_blank" rel="noopener noreferrer">Nostroots Extension</a> for Chrome, Brave, or Edge. Firefox support is still under review.</li>',
    '</ul>',
    '</section>',
    '<section data-nip7-info-state="signer-no-key" hidden>',
    '<h3>Set up your Nostr key</h3>',
    '<p>Nostroots found a signer, but it has not provided a public key yet. Generate or import a key in your Nostroots app or browser extension, then return here.</p>',
    '</section>',
    '<section data-nip7-info-state="key-no-nip05" hidden>',
    '<h3>Link your Trustroots identity</h3>',
    '<p>Your signer has a Nostr key, but it is not linked to a Trustroots username yet. Add this public key to your Trustroots profile, then return here.</p>',
    '<p><a href="https://www.trustroots.org/profile/edit/networks" target="_blank" rel="noopener noreferrer">Open Trustroots profile settings</a></p>',
    '</section>',
    '<section data-nip7-info-state="linked" hidden>',
    '<h3>Trustroots identity linked</h3>',
    '<p><strong data-nip7-linked-nip05></strong> is linked to the public key held by your signer. Nostroots asks that signer to approve actions, while the Trustroots link lets the service recognize your account.</p>',
    '<p>Your public key: <code data-nip7-linked-npub></code></p>',
    '<p><a href="https://www.trustroots.org/profile/edit/networks" target="_blank" rel="noopener noreferrer">Change your Trustroots profile link</a></p>',
    '</section>',
    '</div>',
    '</section>'
  ].join('');
  return modal;
}

function setNip7InfoModalState(state, nip05, npub) {
  var modal = document.getElementById('nip7-info-modal');
  if (!modal) return;
  modal.dataset.nip7InfoState = state;
  modal.querySelectorAll('[data-nip7-info-state]').forEach(function (section) {
    section.hidden = section.getAttribute('data-nip7-info-state') !== state;
  });
  modal.querySelectorAll('[data-nip7-linked-nip05]').forEach(function (element) {
    element.textContent = nip05 || '';
  });
  modal.querySelectorAll('[data-nip7-linked-npub]').forEach(function (element) {
    element.textContent = shortenNpub(npub) || '';
    if (npub) {
      element.title = npub;
      element.setAttribute('aria-label', 'Full public key: ' + npub);
    } else {
      element.removeAttribute('title');
      element.removeAttribute('aria-label');
    }
  });
}

function initNip7InfoModal() {
  var keyStatus = document.getElementById('nostr-key-status');
  var identityStatus = document.getElementById('trustroots-identity-status');
  var modal = ensureNip7InfoModal();
  var panel = modal.querySelector('.info-modal-panel');
  var closeButtons = modal.querySelectorAll('[data-nip7-close]');
  var triggers = [keyStatus, identityStatus].filter(Boolean);
  var lastFocused = null;
  if (!triggers.length || !panel) return;

  setNip7InfoModalState('no-signer');

  triggers.forEach(function (trigger) {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', 'nip7-info-modal');
    trigger.setAttribute('aria-expanded', 'false');
  });
  if (identityStatus) {
    identityStatus.setAttribute('role', 'button');
    identityStatus.setAttribute('tabindex', '0');
  }

  function openModal(event) {
    if (event) event.preventDefault();
    lastFocused = document.activeElement;
    modal.hidden = false;
    triggers.forEach(function (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    });
    panel.focus();
  }

  function closeModal() {
    modal.hidden = true;
    triggers.forEach(function (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    });
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', openModal);
    trigger.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openModal();
    });
  });
  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });
  closeButtons.forEach(function (button) {
    button.addEventListener('click', closeModal);
  });
}

async function initSiteChromeIdentity() {
  initNip7InfoModal();
  hideAppDownloadPrompts();
  watchForNostrootsApp();

var TRUSTROOTS_EDIT_NETWORKS_URL = 'https://www.trustroots.org/profile/edit/networks';
var TRUSTROOTS_PROFILE_KIND = 10390;
var TRUSTROOTS_PROFILE_CLAIM_KIND = 30390;
var TRUSTROOTS_USERNAME_LABEL_NAMESPACE = 'org.trustroots:username';
var RELAY_URLS = ['wss://relay.trustroots.org', 'wss://nip42.trustroots.org'];
var NIP7_DETECTION_TIMEOUT_MS = 12000;
var NIP7_MISSING_STATUS_DELAY_MS = 1000;
var NIP7_DETECTION_INTERVAL_MS = 250;
var IDENTITY_REVEAL_DELAY_MS = 180;

var keyStatus = document.getElementById('nostr-key-status');
var identityStatus = document.getElementById('trustroots-identity-status');
var downloadSection = document.getElementById('download-section');
var webExperiencesSection = document.getElementById('web-experiences-section');
var browserExtensionsSection = document.getElementById('browser-extensions-section');
var hubControls = document.querySelector('.hub-controls');
if (!keyStatus || !identityStatus) return;
var keyStatusFadeTimer = null;
var keyStatusRevealTimer = null;
var identityStatusRevealTimer = null;

function moveDownloadSectionAfterWebExperiences() {
  if (!downloadSection || !webExperiencesSection || !webExperiencesSection.parentNode) return;
  var parent = webExperiencesSection.parentNode;
  var anchor = hubControls && hubControls.parentNode === parent ? hubControls : webExperiencesSection;
  if (anchor.nextElementSibling === downloadSection) return;
  parent.insertBefore(downloadSection, anchor.nextSibling);
}

function syncBrowserExtensionsSection(hasNip7Provider) {
  if (!browserExtensionsSection) return;
  browserExtensionsSection.hidden = !!hasNip7Provider;
}

var BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function hexToBytes(hex) {
  var clean = String(hex || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) return [];
  var bytes = [];
  for (var i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes;
}

function bech32Polymod(values) {
  var generator = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  var chk = 1;
  for (var i = 0; i < values.length; i += 1) {
    var top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ values[i];
    for (var j = 0; j < 5; j += 1) {
      if ((top >> j) & 1) chk ^= generator[j];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  var values = [];
  for (var i = 0; i < hrp.length; i += 1) values.push(hrp.charCodeAt(i) >> 5);
  values.push(0);
  for (var j = 0; j < hrp.length; j += 1) values.push(hrp.charCodeAt(j) & 31);
  return values;
}

function bech32CreateChecksum(hrp, data) {
  var values = bech32HrpExpand(hrp).concat(data, [0, 0, 0, 0, 0, 0]);
  var polymod = bech32Polymod(values) ^ 1;
  var checksum = [];
  for (var i = 0; i < 6; i += 1) checksum.push((polymod >> (5 * (5 - i))) & 31);
  return checksum;
}

function convertBits(data, fromBits, toBits, pad) {
  var acc = 0;
  var bits = 0;
  var ret = [];
  var maxv = (1 << toBits) - 1;
  for (var i = 0; i < data.length; i += 1) {
    acc = (acc << fromBits) | data[i];
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits) ret.push((acc << (toBits - bits)) & maxv);
  return ret;
}

function bech32Encode(hrp, data) {
  var combined = data.concat(bech32CreateChecksum(hrp, data));
  var encoded = hrp + '1';
  for (var i = 0; i < combined.length; i += 1) encoded += BECH32_CHARSET[combined[i]];
  return encoded;
}

function npubEncodeFromHex(hex) {
  var bytes = hexToBytes(hex);
  return bytes.length ? bech32Encode('npub', convertBits(bytes, 8, 5, true)) : '';
}

function writeStatus(pill, label, value, state, title) {
  pill.dataset.state = state || 'missing';
  pill.textContent = label ? label + ': ' : '';
  var strong = document.createElement('strong');
  strong.textContent = value;
  pill.appendChild(strong);
  if (title) {
    pill.title = title;
  } else {
    pill.removeAttribute('title');
  }
}

function setStatus(pill, label, value, state, title) {
  if (pill === keyStatus && keyStatusFadeTimer) {
    clearTimeout(keyStatusFadeTimer);
    keyStatusFadeTimer = null;
  }
  if (pill === keyStatus && keyStatusRevealTimer) {
    clearTimeout(keyStatusRevealTimer);
    keyStatusRevealTimer = null;
  }
  if (pill === identityStatus && identityStatusRevealTimer) {
    clearTimeout(identityStatusRevealTimer);
    identityStatusRevealTimer = null;
  }
  pill.classList.remove('is-fading-in', 'is-fading-out');
  pill.removeAttribute('aria-hidden');
  pill.hidden = false;
  writeStatus(pill, label, value, state, title);
}

function revealKeyStatusAfterSettled() {
  if (keyStatusRevealTimer) clearTimeout(keyStatusRevealTimer);
  keyStatus.classList.add('is-fading-in');
  keyStatus.hidden = true;
  keyStatusRevealTimer = setTimeout(function () {
    keyStatus.hidden = false;
    requestAnimationFrame(function () {
      keyStatus.classList.remove('is-fading-in');
      keyStatusRevealTimer = null;
    });
  }, IDENTITY_REVEAL_DELAY_MS);
}

function revealIdentityStatusAfterSettled() {
  if (identityStatusRevealTimer) clearTimeout(identityStatusRevealTimer);
  identityStatus.classList.add('is-fading-in');
  identityStatus.hidden = true;
  identityStatusRevealTimer = setTimeout(function () {
    identityStatus.hidden = false;
    requestAnimationFrame(function () {
      identityStatus.classList.remove('is-fading-in');
      identityStatusRevealTimer = null;
    });
  }, IDENTITY_REVEAL_DELAY_MS);
}

function fadeOutKeyStatus(onComplete) {
  if (keyStatus.hidden || keyStatusFadeTimer) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }
  keyStatus.classList.add('is-fading-out');
  keyStatus.setAttribute('aria-hidden', 'true');
  keyStatusFadeTimer = setTimeout(function () {
    keyStatus.hidden = true;
    keyStatus.classList.remove('is-fading-out');
    keyStatus.removeAttribute('aria-hidden');
    keyStatusFadeTimer = null;
    if (typeof onComplete === 'function') onComplete();
  }, 700);
}

function isHexKey(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function normalizeUsername(value) {
  var username = String(value || '').trim().toLowerCase();
  return username && /^[a-z0-9_.-]+$/.test(username) ? username : '';
}

function normalizeTrustrootsNip05(value) {
  var nip05 = String(value || '').trim().toLowerCase();
  var at = nip05.lastIndexOf('@');
  if (at <= 0 || at === nip05.length - 1) return '';
  var username = normalizeUsername(nip05.slice(0, at));
  var domain = nip05.slice(at + 1).replace(/^www\./, '');
  return username && domain === 'trustroots.org' ? username + '@trustroots.org' : '';
}

function trustrootsNip05FromUsername(value) {
  var username = normalizeUsername(value);
  return username ? username + '@trustroots.org' : '';
}

function usernameFromTrustrootsNip05(nip05) {
  var normalized = normalizeTrustrootsNip05(nip05);
  return normalized ? normalized.split('@')[0] : '';
}

function newestEvent(events) {
  if (!events.length) return null;
  return events.reduce(function (latest, event) {
    return Number(event.created_at || 0) >= Number(latest.created_at || 0) ? event : latest;
  });
}

function matchesPubkey(event, publicKeyHex) {
  return String(event && event.pubkey || '').toLowerCase() === publicKeyHex;
}

function extractKind0TrustrootsNip05(events, publicKeyHex) {
  var event = newestEvent(events.filter(function (candidate) {
    return candidate && candidate.kind === 0 && matchesPubkey(candidate, publicKeyHex);
  }));
  if (!event || !event.content) return '';
  try {
    var metadata = JSON.parse(event.content);
    return normalizeTrustrootsNip05(metadata && metadata.nip05);
  } catch (_) {
    return '';
  }
}

function trustrootsUsernameFromTags(tags) {
  for (var i = 0; i < (tags || []).length; i += 1) {
    var tag = tags[i] || [];
    if (tag[0] === 'trustroots' && tag[1]) return normalizeUsername(tag[1]);
    if (tag[0] === 'l' && tag[1] && tag[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE) {
      return normalizeUsername(tag[1]);
    }
  }
  return '';
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
    return tag && tag[0] === 'p' && String(tag[1] || '').toLowerCase() === publicKeyHex;
  });
}

function trustrootsNip05FromClaimContent(content) {
  try {
    var metadata = JSON.parse(content || '{}');
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
  var candidates = events
    .filter(function (candidate) {
      return candidate && candidate.kind === TRUSTROOTS_PROFILE_CLAIM_KIND && eventTargetsPubkey(candidate, publicKeyHex);
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
  return '';
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
    if (tag[0] !== 'relay') return tag;
    hasRelayTag = true;
    return ['relay', relayUrl];
  });
  return Object.assign({}, template, {
    tags: hasRelayTag ? tags : [['relay', relayUrl]].concat(tags)
  });
}

function getNip7Provider() {
  var provider = window.nostr;
  return provider && typeof provider.getPublicKey === 'function' ? provider : null;
}

async function getNip7PublicKey(provider) {
  if (!provider) return '';
  try {
    var publicKeyHex = String(await provider.getPublicKey()).trim().toLowerCase();
    return isHexKey(publicKeyHex) ? publicKeyHex : '';
  } catch (_) {
    return '';
  }
}

async function signNip7AuthEvent(template, relayUrl, publicKeyHex) {
  var provider = window.nostr;
  if (!provider || typeof provider.signEvent !== 'function') return null;
  var authTemplate = normalizeRelayAuthTemplate(template, relayUrl);
  if (!authTemplate.pubkey) authTemplate.pubkey = publicKeyHex;
  try {
    var signed = await provider.signEvent(authTemplate);
    return signed && String(signed.pubkey || '').toLowerCase() === publicKeyHex ? signed : null;
  } catch (_) {
    return null;
  }
}

function readTrustrootsRelayEventsFromRelay(relayUrl, filters, timeoutMs, signAuthEvent) {
  return new Promise(function (resolve) {
    var events = [];
    var settled = false;
    var didRetryAfterAuth = false;
    var subscriptionId = 'hub-trustroots-' + Math.random().toString(36).slice(2);
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
    ws.addEventListener('message', function (message) {
      var data;
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
          .then(function (signedAuth) {
            if (signedAuth) ws.send(JSON.stringify(['AUTH', signedAuth]));
          })
          .catch(function () {});
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
  var eventLists = await Promise.all(RELAY_URLS.map(function (relayUrl) {
    return readTrustrootsRelayEventsFromRelay(relayUrl, filters, 3200, signAuthEvent).catch(function () {
      return [];
    });
  }));
  return dedupeEvents([].concat.apply([], eventLists));
}

async function lookupTrustrootsNip05(publicKeyHex, signAuthEvent) {
  if (!isHexKey(publicKeyHex)) return '';
  try {
    var kind0Events = await readTrustrootsRelayEvents([
      { kinds: [0], authors: [publicKeyHex], limit: 5 }
    ], signAuthEvent);
    var kind0Nip05 = extractKind0TrustrootsNip05(kind0Events, publicKeyHex);
    if (kind0Nip05) return kind0Nip05;

    var kind10390Events = await readTrustrootsRelayEvents([
      { kinds: [TRUSTROOTS_PROFILE_KIND], authors: [publicKeyHex], limit: 5 }
    ], signAuthEvent);
    var kind10390Nip05 = extractKind10390TrustrootsNip05(kind10390Events, publicKeyHex);
    if (kind10390Nip05) return kind10390Nip05;

    var kind30390Events = await readTrustrootsRelayEvents([
      { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], '#p': [publicKeyHex], limit: 20 },
      { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], authors: [publicKeyHex], limit: 20 }
    ], signAuthEvent);
    var kind30390Nip05 = extractKind30390TrustrootsNip05(kind30390Events, publicKeyHex);
    if (kind30390Nip05) return kind30390Nip05;

    var broadProfileEvents = await readTrustrootsRelayEvents([
      { kinds: [0, TRUSTROOTS_PROFILE_KIND], limit: 5000 },
      { kinds: [TRUSTROOTS_PROFILE_CLAIM_KIND], limit: 5000 }
    ], signAuthEvent);
    return (
      extractKind0TrustrootsNip05(broadProfileEvents, publicKeyHex) ||
      extractKind10390TrustrootsNip05(broadProfileEvents, publicKeyHex) ||
      extractKind30390TrustrootsNip05(broadProfileEvents, publicKeyHex)
    );
  } catch (_) {
    return '';
  }
}

function applyKeyState(publicKeyHex) {
  var npub = npubEncodeFromHex(publicKeyHex);
  setNip7InfoModalState('key-no-nip05');
  keyStatus.removeAttribute('aria-label');
  writeStatus(keyStatus, '', shortenNpub(npub) || publicKeyHex.slice(0, 10) + '...', 'connected', npub || publicKeyHex);
  revealKeyStatusAfterSettled();
}

function applyMissingKeyState() {
  if (activePublicKeyHex) return;
  setNip7InfoModalState('no-signer');
  keyStatus.setAttribute('aria-label', 'No Nostr key detected. About Nostr keys');
  setStatus(keyStatus, '', 'no nostr key detected', 'missing');
}

function applyProviderDetectedState() {
  if (activePublicKeyHex) return;
  setNip7InfoModalState('signer-no-key');
  keyStatus.setAttribute('aria-label', 'NIP-07 extension detected. Waiting for key access.');
  setStatus(
    keyStatus,
    'NIP-07 extension',
    'waiting for key access',
    'pending',
    'Approve key access in your browser extension if prompted.'
  );
}

function applyUnlinkedIdentityState() {
  identityStatus.removeAttribute('href');
  writeStatus(identityStatus, 'Trustroots identity', 'not linked', 'missing');
  revealIdentityStatusAfterSettled();
}

function applyIdentityState(nip05) {
  var username = usernameFromTrustrootsNip05(nip05);
  if (!username) return;
  var npub = npubEncodeFromHex(activePublicKeyHex);
  identityStatus.dataset.state = 'connected';
  identityStatus.removeAttribute('href');
  identityStatus.title = 'About your linked Trustroots identity';
  identityStatus.setAttribute('aria-label', 'About your linked Trustroots identity');
  identityStatus.replaceChildren();
  var label = document.createElement('span');
  label.className = 'identity-link-label';
  label.textContent = username + '@trustroots.org';
  var icon = document.createElement('span');
  icon.className = 'identity-link-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '@';
  identityStatus.append(label, icon);
  setNip7InfoModalState('linked', username + '@trustroots.org', npub || activePublicKeyHex);
  fadeOutKeyStatus(revealIdentityStatusAfterSettled);
}

var activePublicKeyHex = '';
var nip7PublicKeyRequestPending = false;

async function applyDetectedNip7Key(publicKeyHex) {
  if (!publicKeyHex || publicKeyHex === activePublicKeyHex) return;
  activePublicKeyHex = publicKeyHex;
  try {
    var signAuthEvent = function (template, relayUrl) {
      return signNip7AuthEvent(template, relayUrl, publicKeyHex);
    };
    var nip05 = await lookupTrustrootsNip05(publicKeyHex, signAuthEvent);
    if (activePublicKeyHex !== publicKeyHex) return;
    if (nip05) {
      applyIdentityState(nip05);
    } else {
      applyKeyState(publicKeyHex);
    }
  } catch (_) {
    if (activePublicKeyHex === publicKeyHex) applyKeyState(publicKeyHex);
  }
}

async function refreshNip7Key() {
  var provider = getNip7Provider();
  if (!provider) return false;
  syncBrowserExtensionsSection(true);
  moveDownloadSectionAfterWebExperiences();
  if (nip7PublicKeyRequestPending) return true;
  nip7PublicKeyRequestPending = true;
  try {
    var publicKeyHex = await getNip7PublicKey(provider);
    if (publicKeyHex) {
      await applyDetectedNip7Key(publicKeyHex);
    } else {
      applyProviderDetectedState();
    }
  } finally {
    nip7PublicKeyRequestPending = false;
  }
  return true;
}

function watchForNip7Key() {
  var startedAt = Date.now();
  var timer = null;
  var checking = false;
  var showedMissingKeyState = false;

  async function check() {
    if (checking) return;
    checking = true;
    try {
      var found = await refreshNip7Key();
      var elapsed = Date.now() - startedAt;
      if (!found && !showedMissingKeyState && !activePublicKeyHex && elapsed >= NIP7_MISSING_STATUS_DELAY_MS) {
        showedMissingKeyState = true;
        applyMissingKeyState();
      }
      if (found || elapsed >= NIP7_DETECTION_TIMEOUT_MS) {
        if (timer) clearInterval(timer);
      }
    } finally {
      checking = false;
    }
  }

  void check();
  timer = setInterval(check, NIP7_DETECTION_INTERVAL_MS);
  window.addEventListener('focus', function () {
    void refreshNip7Key();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') void refreshNip7Key();
  });
}

watchForNip7Key();
}

initSiteChromeIdentity();
