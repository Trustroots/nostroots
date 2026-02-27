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

    global.NrNip07 = {
        detectNostrExtension: detectNostrExtension,
        isExtensionReady: isExtensionReady,
        getPublicKeyFromExtension: getPublicKeyFromExtension
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
