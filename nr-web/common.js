/**
 * Shared JS for nr-web (index + chat).
 */
(function (global) {
    'use strict';

    // --- Blocklist (shared by index + chat) ---
    /** Npubs to block; pages decode to hex and call setBlocklistHex. */
    var BLOCKLIST_NPUBS = [
        'npub1ld69y3drhnc0k4lr2qs0adthae8npal8hfmpm9tyq7jtujkk66ws5lp53h'
    ];
    var BLOCKLIST_HEX = null;

    function setBlocklistHex(hexArray) {
        BLOCKLIST_HEX = hexArray && hexArray.length
            ? new Set(hexArray.map(function (h) { return String(h).toLowerCase(); }))
            : null;
    }

    /**
     * @param {string} pubkeyHex - 64-char hex pubkey
     * @returns {boolean}
     */
    function isBlocked(pubkeyHex) {
        if (!pubkeyHex || !BLOCKLIST_HEX) return false;
        var hex = String(pubkeyHex).toLowerCase();
        if (hex.length !== 64 || !/^[0-9a-f]+$/.test(hex)) return false;
        return BLOCKLIST_HEX.has(hex);
    }

    global.NrBlocklist = {
        BLOCKLIST_NPUBS: BLOCKLIST_NPUBS,
        setBlocklistHex: setBlocklistHex,
        isBlocked: isBlocked
    };

    // --- Shared relay settings helpers (index + chat) ---
    var RELAY_URLS_STORAGE_KEY = 'relay_urls';
    var RELAY_WRITE_ENABLED_STORAGE_KEY = 'relay_write_enabled';

    function getRelayUrls(defaultRelays) {
        var saved = null;
        try { saved = global.localStorage.getItem(RELAY_URLS_STORAGE_KEY); } catch (_) {}
        var list = null;
        if (saved) {
            list = saved.split('\n').filter(function (url) { return !!(url && url.trim()); });
        } else {
            list = Array.isArray(defaultRelays) ? defaultRelays.slice() : [];
        }

        // Dev ergonomics: when running nr-web on localhost, include local relay by default
        // so pages see the same events as nip42-nip5-test.html.
        var isLocalHost = false;
        try {
            var host = (global.location && global.location.hostname) ? global.location.hostname : '';
            isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
        } catch (_) {}
        if (isLocalHost) {
            var localRelay = 'wss://nip42.trustroots.org';
            var hasLocal = list.some(function (url) {
                return String(url).trim().toLowerCase() === localRelay;
            });
            if (!hasLocal) list = [localRelay].concat(list);
        }

        return list;
    }

    function saveRelayUrls(urls) {
        var list = Array.isArray(urls) ? urls.filter(function (url) { return !!(url && url.trim()); }) : [];
        try {
            if (list.length) global.localStorage.setItem(RELAY_URLS_STORAGE_KEY, list.join('\n'));
            else global.localStorage.removeItem(RELAY_URLS_STORAGE_KEY);
        } catch (_) {}
        return list;
    }

    function getRelayWritePreferences() {
        try {
            var raw = global.localStorage.getItem(RELAY_WRITE_ENABLED_STORAGE_KEY);
            if (!raw) return {};
            var parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function saveRelayWritePreferences(urls, relayWriteEnabledMap) {
        var preferences = {};
        var list = Array.isArray(urls) ? urls : [];
        list.forEach(function (url) {
            var canWrite = relayWriteEnabledMap && typeof relayWriteEnabledMap.get === 'function'
                ? relayWriteEnabledMap.get(url) !== false
                : true;
            preferences[url] = canWrite;
        });
        try { global.localStorage.setItem(RELAY_WRITE_ENABLED_STORAGE_KEY, JSON.stringify(preferences)); } catch (_) {}
        return preferences;
    }

    function isLocalRelayUrl(url) {
        try {
            var parsed = new URL(url);
            var host = parsed.hostname;
            return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
        } catch (_) {
            return false;
        }
    }

    function normalizeRelayUrlInput(rawUrl, defaultScheme) {
        var input = (rawUrl || '').trim();
        if (!input) return { ok: false, value: '', error: 'empty' };
        if (input.indexOf('ws://') === 0 || input.indexOf('wss://') === 0) {
            return { ok: true, value: input };
        }
        if (input.indexOf('://') !== -1) {
            return { ok: false, value: input, error: 'invalid_scheme' };
        }
        var scheme = defaultScheme === 'wss' ? 'wss://' : 'ws://';
        return { ok: true, value: scheme + input };
    }

    function relayStatusText(statusClass) {
        if (statusClass === 'connected') return 'Connected';
        if (statusClass === 'connecting') return 'Connecting...';
        if (statusClass === 'error') return 'Error';
        return 'Disconnected';
    }

    function renderRelaysList(container, options) {
        if (!container) return;
        var opts = options || {};
        var urls = Array.isArray(opts.urls) ? opts.urls : [];
        var statusMap = opts.statusMap;
        var relayWriteEnabledMap = opts.relayWriteEnabledMap;
        var allowPostToggle = opts.allowPostToggle !== false;
        var allowRemove = opts.allowRemove !== false;
        var removeButtonLabel = opts.removeButtonLabel || 'DELETE';
        var removeHandlerName = opts.removeHandlerName || 'removeRelay';
        var toggleHandlerName = opts.toggleHandlerName || 'toggleRelayWriteForEncodedUrl';
        var emptyMessage = opts.emptyMessage || 'No relays configured';
        var showLocalPrivacyHint = opts.showLocalPrivacyHint !== false;
        var requireSigningForConnected = opts.requireSigningForConnected === true;
        var hasSigningCapability = opts.hasSigningCapability !== false;

        container.innerHTML = '';
        if (!urls.length) {
            container.innerHTML = '<p style="color: var(--muted-foreground); font-size: 0.875rem; padding: 1rem; text-align: center;">' + escapeHtml(emptyMessage) + '</p>';
            return;
        }

        urls.forEach(function (url) {
            var status = statusMap && typeof statusMap.get === 'function'
                ? (statusMap.get(url) || { status: 'disconnected', canWrite: true })
                : { status: 'disconnected', canWrite: true };
            var statusClass = (status && status.status) ? status.status : 'disconnected';
            var statusText = relayStatusText(statusClass);
            var indicatorStatusClass = statusClass;
            var indicatorStatusText = statusText;
            if (requireSigningForConnected && statusClass === 'connected' && !hasSigningCapability) {
                indicatorStatusClass = 'disconnected';
                indicatorStatusText = 'Connected (no nsec/signer)';
            }
            var postEnabled = relayWriteEnabledMap && typeof relayWriteEnabledMap.get === 'function'
                ? relayWriteEnabledMap.get(url) !== false
                : (status && status.canWrite !== false);
            var encodedUrl = encodeURIComponent(url);
            var localPrivacyHint = showLocalPrivacyHint && isLocalRelayUrl(url)
                ? '<div class="relay-privacy-hint">More private (NIP-42 + Trustroots NIP-5)</div>'
                : '';
            var postToggleHtml = allowPostToggle
                ? '<label class="relay-post-toggle" title="When off, this relay is read-only">' +
                  '<input type="checkbox" ' + (postEnabled ? 'checked' : '') +
                  ' onchange="' + escapeHtml(toggleHandlerName) + '(\'' + encodedUrl + '\', this.checked)">' +
                  '<span>Post</span></label>'
                : '';
            var removeButtonHtml = allowRemove
                ? '<button class="relay-delete-btn" onclick="' + escapeHtml(removeHandlerName) + '(decodeURIComponent(\'' + encodedUrl + '\'))">' +
                  escapeHtml(removeButtonLabel) + '</button>'
                : '';

            var item = global.document.createElement('div');
            item.className = 'relay-item';
            item.innerHTML =
                '<div class="relay-status-indicator ' + escapeHtml(indicatorStatusClass) + '" title="' + escapeHtml(indicatorStatusText) + '"></div>' +
                '<div class="relay-url-wrap"><div class="relay-url">' + escapeHtml(url) + '</div>' + localPrivacyHint + '</div>' +
                '<div class="relay-controls">' + postToggleHtml + removeButtonHtml + '</div>';
            container.appendChild(item);
        });
    }

    global.NrWebRelaySettings = {
        RELAY_URLS_STORAGE_KEY: RELAY_URLS_STORAGE_KEY,
        RELAY_WRITE_ENABLED_STORAGE_KEY: RELAY_WRITE_ENABLED_STORAGE_KEY,
        getRelayUrls: getRelayUrls,
        saveRelayUrls: saveRelayUrls,
        getRelayWritePreferences: getRelayWritePreferences,
        saveRelayWritePreferences: saveRelayWritePreferences,
        isLocalRelayUrl: isLocalRelayUrl,
        normalizeRelayUrlInput: normalizeRelayUrlInput,
        renderRelaysList: renderRelaysList
    };

    // --- Shared NIP-42 WS auth subscription helper (index + chat + pixel) ---
    function startNip42WsSubscription(options) {
        var opts = options || {};
        var relayUrl = opts.relayUrl;
        var filter = opts.filter || {};
        var signEvent = opts.signEvent;
        var authPubkey = opts.authPubkey;
        var onEvent = opts.onEvent;
        var onAuthChallenge = opts.onAuthChallenge;
        var onAuthSuccess = opts.onAuthSuccess;
        var onAuthFail = opts.onAuthFail;
        var onOpen = opts.onOpen;
        var onClose = opts.onClose;
        var onError = opts.onError;
        if (!relayUrl) throw new Error('relayUrl is required');
        if (typeof onEvent !== 'function') throw new Error('onEvent callback is required');
        if (typeof signEvent !== 'function') throw new Error('signEvent callback is required');

        var ws = new WebSocket(relayUrl);
        var subId = 'ws-sub-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);

        function sendReq() {
            ws.send(JSON.stringify(['REQ', subId, filter]));
        }

        ws.addEventListener('open', function () {
            if (typeof onOpen === 'function') onOpen(relayUrl);
            sendReq();
        });

        ws.addEventListener('message', function (msg) {
            var data = null;
            try {
                data = JSON.parse(msg.data);
            } catch (_) {
                return;
            }
            var type = data[0];
            var a = data[1];
            var b = data[2];

            if (type === 'AUTH') {
                if (typeof onAuthChallenge === 'function') onAuthChallenge(relayUrl, a);
                Promise.resolve().then(function () {
                    var template = {
                        kind: 22242,
                        created_at: Math.floor(Date.now() / 1000),
                        tags: [
                            ['relay', relayUrl],
                            ['challenge', a]
                        ],
                        content: '',
                        pubkey: authPubkey
                    };
                    return signEvent(template);
                }).then(function (signedAuth) {
                    ws.send(JSON.stringify(['AUTH', signedAuth]));
                    if (typeof onAuthSuccess === 'function') onAuthSuccess(relayUrl);
                    // Retry reads after AUTH, matching test page behavior.
                    sendReq();
                }).catch(function (err) {
                    if (typeof onAuthFail === 'function') onAuthFail(relayUrl, err);
                });
                return;
            }

            if (type === 'EVENT') {
                onEvent(b, relayUrl, data);
            }
        });

        ws.addEventListener('error', function (err) {
            if (typeof onError === 'function') onError(relayUrl, err);
        });

        ws.addEventListener('close', function (ev) {
            if (typeof onClose === 'function') onClose(relayUrl, ev);
        });

        return {
            close: function () {
                try { ws.close(); } catch (_) {}
            }
        };
    }

    global.NrWebRelayAuth = {
        startNip42WsSubscription: startNip42WsSubscription
    };

    // --- Shared header (index + chat) ---
    // Fill <header id="app-header" data-page-title="..." data-nav-href="..." ...>
    function fillAppHeader() {
        var header = global.document && global.document.getElementById('app-header');
        if (!header || !header.getAttribute('data-page-title')) return;
        var pageTitle = header.getAttribute('data-page-title');
        var navHref = header.getAttribute('data-nav-href') || '#';
        var navTitle = header.getAttribute('data-nav-title') || '';
        var navAriaLabel = header.getAttribute('data-nav-aria-label') || navTitle;
        var navIcon = header.getAttribute('data-nav-icon') || '';
        var settingsTitle = header.getAttribute('data-settings-title') || 'Settings';

        header.setAttribute('aria-label', 'Brand');
        header.innerHTML =
            '<div class="vines">' +
            '<img src="https://raw.githubusercontent.com/Trustroots/notes.trustroots.org/main/images/vines-top.png" alt="" width="1200" height="400">' +
            '</div>' +
            '<div class="app-header-inner">' +
            '<img src="https://notes.trustroots.org/logo.svg" alt="Trustroots" class="app-header-logo" width="140" height="32">' +
            '<h1>' + escapeHtml(pageTitle) + '</h1>' +
            '<a href="' + escapeHtml(navHref) + '" class="app-header-nav-link" title="' + escapeHtml(navTitle) + '" aria-label="' + escapeHtml(navAriaLabel) + '">' + escapeHtml(navIcon) + '</a>' +
            '</div>' +
            '<div class="app-header-actions">' +
            '<button type="button" class="keys-icon header-identity-btn" id="keys-icon-btn" title="Keys">' +
            '<span class="header-identity-text empty" id="header-identity" title=""></span>' +
            '<span class="keys-icon-symbol" aria-hidden="true">🔑</span>' +
            '</button>' +
            '<button type="button" class="settings-icon" id="settings-icon-btn" title="' + escapeHtml(settingsTitle) + '">⚙️</button>' +
            '</div>';
    }

    function escapeHtml(s) {
        if (s == null) return '';
        var str = String(s);
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function onNavLinkClick(e) {
        if (e.target && e.target.closest && e.target.closest('.app-header-nav-link')) {
            try { global.sessionStorage.setItem('nostroots_switching_page', '1'); } catch (err) {}
        }
    }

    /** Inject shared Keys + Settings modals (used by index.html and chat.html). Dispatches 'nostroots-modals-injected' when done. */
    function injectKeysSettingsModals() {
        var doc = global.document;
        if (!doc || !doc.body) return;
        if (doc.getElementById('keys-modal')) return; /* already injected */
        fetch('modals-keys-settings.html')
            .then(function (r) { return r.text(); })
            .then(function (html) {
                if (doc.body && !doc.getElementById('keys-modal')) {
                    doc.body.insertAdjacentHTML('beforeend', html);
                    try { doc.dispatchEvent(new CustomEvent('nostroots-modals-injected')); } catch (e) {}
                }
            })
            .catch(function (err) { console.error('NrWeb: failed to load modals-keys-settings.html', err); });
    }

    if (global.document) {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', function () {
                fillAppHeader();
                injectKeysSettingsModals();
                global.document.body.addEventListener('click', onNavLinkClick);
            });
        } else {
            fillAppHeader();
            injectKeysSettingsModals();
            global.document.body.addEventListener('click', onNavLinkClick);
        }
    }

    global.NrWeb = global.NrWeb || {};
    global.NrWeb.fillAppHeader = fillAppHeader;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
