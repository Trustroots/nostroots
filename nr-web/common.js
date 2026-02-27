/**
 * Shared JS for nr-web (index + chat).
 * - NIP-07: Nostr browser extension helpers (getPublicKey with no args, retries).
 *   Spec: https://github.com/nostr-protocol/nips/blob/master/07.md
 */
(function (global) {
    'use strict';

    // --- NIP-07 (browser extension) ---
    function detectNostrExtension() {
        if (typeof global.window === 'undefined') return null;
        var w = global.window;
        if (w.nostr && typeof w.nostr.getPublicKey === 'function') return w.nostr;
        if (w.webln && w.webln.nostr && typeof w.webln.nostr.getPublicKey === 'function') return w.webln.nostr;
        return null;
    }

    function isExtensionReady(provider) {
        if (!provider) return false;
        if (typeof provider.getPublicKey !== 'function') return false;
        return true;
    }

    /**
     * Get public key from extension. Calls getPublicKey() with NO arguments (NIP-07).
     * Retries once on failure (e.g. extension not ready or SyntaxError in some extensions).
     * @param {object} provider - NIP-07 provider (window.nostr or window.webln.nostr)
     * @returns {Promise<string|null>} 64-char hex pubkey or null on failure
     */
    function getPublicKeyFromExtension(provider) {
        if (!provider || !isExtensionReady(provider)) return Promise.resolve(null);

        function callGetPublicKey() {
            return provider.getPublicKey();
        }

        return callGetPublicKey().then(function (pubkey) {
            if (pubkey && typeof pubkey === 'string' && /^[0-9a-f]{64}$/i.test(pubkey)) return pubkey;
            return null;
        }).catch(function (error) {
            console.error('NIP-07 getPublicKey (first attempt):', error);
            var errorStr = String((error && error.message) || error || '');
            var isSyntaxError = (error && error.name === 'SyntaxError') ||
                errorStr.indexOf('SyntaxError') !== -1 ||
                errorStr.indexOf('invalid or illegal string') !== -1;
            var waitMs = isSyntaxError ? 1000 : 300;
            return new Promise(function (resolve) { setTimeout(resolve, waitMs); })
                .then(function () { return detectNostrExtension(); })
                .then(function (retryProvider) {
                    if (!retryProvider || !isExtensionReady(retryProvider)) return null;
                    return retryProvider.getPublicKey();
                })
                .then(function (pubkey) {
                    if (pubkey && typeof pubkey === 'string' && /^[0-9a-f]{64}$/i.test(pubkey)) return pubkey;
                    return null;
                })
                .catch(function (retryErr) {
                    console.error('NIP-07 getPublicKey (retry):', retryErr);
                    return null;
                });
        });
    }

    var NIP07_STORAGE_KEY = 'using_nip07';
    var NIP07_STATUS_MESSAGE = '✓ Using NIP-07 extension – private key stays in extension';
    var NIP07_CONNECT_SUCCESS_MESSAGE = 'Connected to NIP-07 extension! Your private key stays secure in the extension.';

    function isUsingNip07FromStorage() {
        if (typeof global.localStorage === 'undefined') return false;
        return global.localStorage.getItem(NIP07_STORAGE_KEY) === 'true';
    }

    function setUsingNip07InStorage(use) {
        if (typeof global.localStorage === 'undefined') return;
        if (use) global.localStorage.setItem(NIP07_STORAGE_KEY, 'true');
        else global.localStorage.removeItem(NIP07_STORAGE_KEY);
    }

    global.NrNip07 = {
        detectNostrExtension: detectNostrExtension,
        isExtensionReady: isExtensionReady,
        getPublicKeyFromExtension: getPublicKeyFromExtension,
        NIP07_STORAGE_KEY: NIP07_STORAGE_KEY,
        NIP07_STATUS_MESSAGE: NIP07_STATUS_MESSAGE,
        NIP07_CONNECT_SUCCESS_MESSAGE: NIP07_CONNECT_SUCCESS_MESSAGE,
        isUsingNip07FromStorage: isUsingNip07FromStorage,
        setUsingNip07InStorage: setUsingNip07InStorage
    };

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

    if (global.document) {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', function () {
                fillAppHeader();
                global.document.body.addEventListener('click', onNavLinkClick);
            });
        } else {
            fillAppHeader();
            global.document.body.addEventListener('click', onNavLinkClick);
        }
    }

    global.NrWeb = global.NrWeb || {};
    global.NrWeb.fillAppHeader = fillAppHeader;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
