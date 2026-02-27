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
