/**
 * Shared JS for nr-web (index + chat).
 */
(function (global) {
    'use strict';

    // --- Blocklist (shared by index + chat) ---
    /** Npubs to block; pages decode to hex and call setBlocklistHex. */
    var BLOCKLIST_NPUBS = [
        'npub1ld69y3drhnc0k4lr2qs0adthae8npal8hfmpm9tyq7jtujkk66ws5lp53h',
        'npub17k78z6f0cz822tqdrj9ulwr409vyzp44l66w54ptrw9f2cf0y4asw3ay0f'
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

    function relayAccessHint(url) {
        if (!url) return '';
        var normalized = String(url).trim().toLowerCase();
        if (normalized === 'wss://nip42.trustroots.org') {
            return '🔐 Auth relay (NIP-42): reading from and writing to this relay requires a Trustroots profile linked to your Nostr identity.';
        }
        if (normalized === 'wss://relay.trustroots.org' || normalized === 'wss://relay.nomadwiki.org') {
            return '🌍 Public relay: readable by anyone.';
        }
        return '';
    }

    function isPublicRelayUrl(url) {
        if (!url) return false;
        var normalized = String(url).trim().toLowerCase();
        return normalized === 'wss://relay.trustroots.org' || normalized === 'wss://relay.nomadwiki.org';
    }

    function getDefaultRelayPostEnabled(url) {
        return !isPublicRelayUrl(url);
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
            var accessHint = relayAccessHint(url);
            var localPrivacyHint = showLocalPrivacyHint && isLocalRelayUrl(url)
                ? '<div class="relay-privacy-hint">🔐 More private (local relay)</div>'
                : '';
            var relayHintHtml = accessHint
                ? '<div class="relay-privacy-hint">' + escapeHtml(accessHint) + '</div>'
                : localPrivacyHint;
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
                '<div class="relay-url-wrap"><div class="relay-url">' + escapeHtml(url) + '</div>' + relayHintHtml + '</div>' +
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
        getDefaultRelayPostEnabled: getDefaultRelayPostEnabled,
        isLocalRelayUrl: isLocalRelayUrl,
        normalizeRelayUrlInput: normalizeRelayUrlInput,
        renderRelaysList: renderRelaysList
    };

    // --- Shared keys modal helpers (index + chat) ---
    var KEY_SOURCE_STORAGE_KEY = 'nostr_key_source_by_pubkey';
    var KEY_BACKUP_STATUS_STORAGE_KEY = 'nostr_key_backup_by_pubkey';

    function setDisplayById(id, displayValue) {
        var el = global.document.getElementById(id);
        if (el) el.style.display = displayValue;
    }

    function readKeySourceMap() {
        try {
            var raw = global.localStorage.getItem(KEY_SOURCE_STORAGE_KEY);
            if (!raw) return {};
            var parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function writeKeySourceMap(map) {
        try {
            global.localStorage.setItem(KEY_SOURCE_STORAGE_KEY, JSON.stringify(map || {}));
        } catch (_) {}
    }

    function setKeySourceForPubkey(pubkey, source) {
        if (!pubkey) return;
        var normalized = String(pubkey).toLowerCase();
        var map = readKeySourceMap();
        map[normalized] = source === 'generated' ? 'generated' : 'imported';
        writeKeySourceMap(map);
    }

    function getKeySourceForPubkey(pubkey) {
        if (!pubkey) return '';
        var normalized = String(pubkey).toLowerCase();
        var map = readKeySourceMap();
        return map[normalized] || '';
    }

    function clearKeySourceForPubkey(pubkey) {
        if (!pubkey) return;
        var normalized = String(pubkey).toLowerCase();
        var map = readKeySourceMap();
        delete map[normalized];
        writeKeySourceMap(map);
    }

    function readKeyBackupStatusMap() {
        try {
            var raw = global.localStorage.getItem(KEY_BACKUP_STATUS_STORAGE_KEY);
            if (!raw) return {};
            var parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function writeKeyBackupStatusMap(map) {
        try {
            global.localStorage.setItem(KEY_BACKUP_STATUS_STORAGE_KEY, JSON.stringify(map || {}));
        } catch (_) {}
    }

    function setKeyBackedUpForPubkey(pubkey, isBackedUp) {
        if (!pubkey) return;
        var normalized = String(pubkey).toLowerCase();
        var map = readKeyBackupStatusMap();
        map[normalized] = isBackedUp === true;
        writeKeyBackupStatusMap(map);
    }

    function isKeyBackedUpForPubkey(pubkey) {
        if (!pubkey) return false;
        var normalized = String(pubkey).toLowerCase();
        var map = readKeyBackupStatusMap();
        return map[normalized] === true;
    }

    function clearKeyBackedUpForPubkey(pubkey) {
        if (!pubkey) return;
        var normalized = String(pubkey).toLowerCase();
        var map = readKeyBackupStatusMap();
        delete map[normalized];
        writeKeyBackupStatusMap(map);
    }

    function setKeysModalSections(hasKey) {
        if (!hasKey) {
            setDisplayById('keys-welcome-section', 'block');
            setDisplayById('keys-import-section', 'block');
            setDisplayById('keys-generate-section', 'block');
            setDisplayById('keys-manage-section', 'none');
            setDisplayById('keys-trustroots-section', 'none');
            return;
        }
        setDisplayById('keys-welcome-section', 'none');
        setDisplayById('keys-import-section', 'none');
        setDisplayById('keys-generate-section', 'none');
        setDisplayById('keys-manage-section', 'block');
        setDisplayById('keys-trustroots-section', 'block');
    }

    function focusKeysImportInput(hasKey) {
        // Wait one tick so modal visibility/styles are applied before focusing.
        setTimeout(function () {
            var target = null;
            if (!hasKey) {
                target = global.document.getElementById('onboarding-import');
            }
            if (!target) target = global.document.getElementById('nsec-import');
            if (!target || typeof target.focus !== 'function') return;
            try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
        }, 0);
    }

    function openKeysModal(options) {
        var opts = options || {};
        var keysEl = global.document.getElementById(opts.keysModalId || 'keys-modal');
        if (!keysEl) return false;
        var settingsEl = global.document.getElementById(opts.settingsModalId || 'settings-modal');
        if (settingsEl) settingsEl.classList.remove('active');
        keysEl.classList.add('active');
        setKeysModalSections(!!opts.hasKey);
        focusKeysImportInput(!!opts.hasKey);
        if (opts.hasKey && typeof opts.onOpenManagedSection === 'function') {
            opts.onOpenManagedSection();
        }
        if (typeof opts.setRoute === 'function') {
            opts.setRoute(opts.route || 'keys');
        }
        return true;
    }

    function closeKeysModal(options) {
        var opts = options || {};
        var keysEl = global.document.getElementById(opts.keysModalId || 'keys-modal');
        if (keysEl) keysEl.classList.remove('active');
        if (typeof opts.setRoute === 'function') {
            opts.setRoute(opts.fallbackRoute || '');
        }
    }

    function updateKeyDisplay(options) {
        var opts = options || {};
        var hasNsec = !!opts.hasNsec;
        var hasPublicKey = !!opts.hasPublicKey;
        var npub = typeof opts.npub === 'string' ? opts.npub : '';
        var npubError = typeof opts.npubError === 'string' ? opts.npubError : 'Error encoding npub';
        var isProfileLinked = opts.isProfileLinked === true;
        var isUsernameLinked = opts.isUsernameLinked === true;
        var showChecklist = opts.showChecklist === true;
        var isNsecBackedUp = opts.isNsecBackedUp === true;

        setDisplayById('nsec-actions-group', hasNsec ? 'block' : 'none');
        setDisplayById('no-nsec-actions-group', hasNsec ? 'none' : 'block');
        setDisplayById('generate-key-group', hasNsec ? 'none' : 'block');

        var npubDisplay = global.document.getElementById('npub-display');
        if (hasPublicKey) {
            if (npubDisplay) npubDisplay.value = npub || npubError;
            setDisplayById('npub-display-group', 'block');
            setDisplayById('key-section-divider', 'block');
            setDisplayById('update-trustroots-profile-group', isProfileLinked ? 'none' : 'block');
        } else {
            if (npubDisplay) npubDisplay.value = '';
            setDisplayById('npub-display-group', 'none');
            setDisplayById('key-section-divider', 'none');
            setDisplayById('update-trustroots-profile-group', 'none');
        }

        var keysBtn = global.document.getElementById('keys-icon-btn');
        if (keysBtn) keysBtn.title = hasPublicKey ? 'Keys' : 'Connect';

        var usernameGuidance = global.document.getElementById('keys-username-guidance-text');
        if (usernameGuidance) {
            usernameGuidance.textContent = isUsernameLinked
                ? 'Trustroots username verified from your Nostr profile.'
                : 'Enter your Trustroots username and verify it.';
        }

        var stepBackup = global.document.getElementById('keys-step-backup');
        var stepProfile = global.document.getElementById('keys-step-profile');
        var stepUsername = global.document.getElementById('keys-step-username');
        if (stepBackup) {
            stepBackup.style.display = showChecklist ? 'inline-block' : 'none';
            stepBackup.checked = showChecklist && hasNsec && isNsecBackedUp;
        }
        if (stepProfile) {
            stepProfile.style.display = showChecklist ? 'inline-block' : 'none';
            stepProfile.checked = showChecklist && hasPublicKey && isProfileLinked;
        }
        if (stepUsername) {
            stepUsername.style.display = showChecklist ? 'inline-block' : 'none';
            stepUsername.checked = showChecklist && hasPublicKey && isUsernameLinked;
        }
    }

    global.NrWebKeysModal = {
        openKeysModal: openKeysModal,
        closeKeysModal: closeKeysModal,
        updateKeyDisplay: updateKeyDisplay,
        setKeySourceForPubkey: setKeySourceForPubkey,
        getKeySourceForPubkey: getKeySourceForPubkey,
        clearKeySourceForPubkey: clearKeySourceForPubkey,
        setKeyBackedUpForPubkey: setKeyBackedUpForPubkey,
        isKeyBackedUpForPubkey: isKeyBackedUpForPubkey,
        clearKeyBackedUpForPubkey: clearKeyBackedUpForPubkey
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
        var connectDelayMs = typeof opts.connectDelayMs === 'number' ? Math.max(0, opts.connectDelayMs) : 350;
        var maxReconnectAttempts = typeof opts.maxReconnectAttempts === 'number' ? Math.max(0, opts.maxReconnectAttempts) : 2;
        var reconnectBaseDelayMs = typeof opts.reconnectBaseDelayMs === 'number' ? Math.max(50, opts.reconnectBaseDelayMs) : 500;
        if (!relayUrl) throw new Error('relayUrl is required');
        if (typeof onEvent !== 'function') throw new Error('onEvent callback is required');
        if (typeof signEvent !== 'function') throw new Error('signEvent callback is required');

        var subId = 'ws-sub-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);
        var ws = null;
        var closedByUser = false;
        var attempt = 0;
        var connectTimer = null;

        function sendReq() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(['REQ', subId, filter]));
            }
        }

        function clearConnectTimer() {
            if (connectTimer) {
                clearTimeout(connectTimer);
                connectTimer = null;
            }
        }

        function scheduleConnect(delayMs) {
            if (closedByUser) return;
            clearConnectTimer();
            connectTimer = setTimeout(function () {
                connectTimer = null;
                connect();
            }, Math.max(0, delayMs));
        }

        function scheduleReconnect(lastError) {
            if (closedByUser) return;
            if (attempt >= maxReconnectAttempts) {
                if (typeof onError === 'function' && lastError) onError(relayUrl, lastError);
                return;
            }
            attempt += 1;
            var backoffMs = reconnectBaseDelayMs * attempt;
            scheduleConnect(backoffMs);
        }

        function connect() {
            if (closedByUser) return;
            try {
                ws = new WebSocket(relayUrl);
            } catch (err) {
                scheduleReconnect(err);
                return;
            }

            var hasOpened = false;
            var reconnectScheduled = false;

            function maybeReconnect(err) {
                if (reconnectScheduled || closedByUser) return;
                reconnectScheduled = true;
                scheduleReconnect(err);
            }

            ws.addEventListener('open', function () {
                hasOpened = true;
                attempt = 0;
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
                // Browser may emit transient errors during initial page load. Reconnect first,
                // and only surface onError after retries are exhausted.
                if (!hasOpened) maybeReconnect(err);
                if (typeof onError === 'function' && hasOpened) onError(relayUrl, err);
            });

            ws.addEventListener('close', function (ev) {
                if (typeof onClose === 'function') onClose(relayUrl, ev);
                if (!closedByUser && !hasOpened) maybeReconnect(ev);
            });
        }
        scheduleConnect(connectDelayMs);

        return {
            close: function () {
                closedByUser = true;
                clearConnectTimer();
                try { if (ws) ws.close(); } catch (_) {}
            }
        };
    }

    global.NrWebRelayAuth = {
        startNip42WsSubscription: startNip42WsSubscription
    };

    var MOBILE_APP_LINKS = [
        {
            id: 'android',
            href: 'https://github.com/Trustroots/nostroots/releases',
            label: 'Android',
            icon: '🤖',
            title: 'Download Android APK from GitHub releases'
        },
        {
            id: 'ios',
            href: 'https://testflight.apple.com/join/n5WGu8Hu',
            label: 'iOS',
            icon: '🍎',
            title: 'Join iOS beta on TestFlight'
        }
    ];

    function buildMobileAppLinksMarkup() {
        var links = MOBILE_APP_LINKS.map(function (item) {
            return '<a class="app-header-mobile-link app-header-mobile-link-' + escapeHtml(item.id) + '"' +
                ' href="' + escapeHtml(item.href) + '"' +
                ' title="' + escapeHtml(item.title) + '"' +
                ' aria-label="' + escapeHtml(item.title) + '"' +
                ' target="_blank" rel="noopener noreferrer">' +
                '<span class="app-header-mobile-link-icon" aria-hidden="true">' + escapeHtml(item.icon) + '</span>' +
                '<span class="app-header-mobile-link-label">' + escapeHtml(item.label) + '</span>' +
                '</a>';
        }).join('');
        return '<div class="app-header-mobile-links-wrap" aria-label="Mobile apps">' +
            '<div class="app-header-mobile-links">' + links + '</div>' +
            '<p class="app-header-mobile-hint">Mobile app is more stable. Web is more experimental and has more features.</p>' +
            '</div>';
    }

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
            buildMobileAppLinksMarkup() +
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
