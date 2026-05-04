/**
 * Unified location.hash classification for index.html (map + embedded chat).
 * Parser order (first match wins) is documented in nr-web/README.md — URL routing.
 */
(function (g) {
    'use strict';

    /** Not valid as bare circle/channel slugs (lowercase). */
    var EXTENDED_RESERVED = ['map', 'chat', 'help', 'welcome', 'start'];
    var RESERVED_SET = new Set(EXTENDED_RESERVED);

    function getHashRoute() {
        var h = g.location && g.location.hash ? String(g.location.hash).slice(1) : '';
        if (!h) return '';
        try {
            return decodeURIComponent(h);
        } catch (_) {
            return h;
        }
    }

    /** Full-area plus codes include a separator; avoids classifying circle slugs like "hitch". */
    function looksLikeMapPlusCode(s) {
        if (!s || typeof s !== 'string') return false;
        if (s.indexOf('+') < 0) return false;
        var t = s.replace(/\s/g, '').toUpperCase();
        // OLC refinement after "+" may be empty for coarse / grid-area codes (e.g. 9G000000+).
        return /^[02-9CFGHJMPQRVWX]{7,}\+[02-9CFGHJMPQRVWX0-9]*$/i.test(t);
    }

    function looksLikeHex64(s) {
        return typeof s === 'string' && /^[a-fA-F0-9]{64}$/.test(s);
    }

    function looksLikeNpub(s) {
        return typeof s === 'string' && /^npub1[a-z0-9]+$/i.test(s);
    }

    function looksLikeNip05(s) {
        if (!s || typeof s !== 'string') return false;
        var d = s;
        try {
            d = decodeURIComponent(s);
        } catch (_) {
            d = s;
        }
        return d.indexOf('@') > 0 && /^[^\s#@]+@[^\s#@]+\.[^\s#@]+$/.test(d);
    }

    /**
     * @param {string} route decoded hash fragment (no leading #)
     * @returns {{ kind: string, modal?: string, token?: string, plusCode?: string, chatRoute?: string, profileId?: string }}
     */
    function classify(route) {
        if (!route) return { kind: 'map_home' };
        var lower = String(route).toLowerCase();
        if (lower === 'profile') return { kind: 'profile_self' };
        if (lower === 'keys') return { kind: 'modal', modal: 'keys' };
        if (lower === 'settings') return { kind: 'modal', modal: 'settings' };
        if (RESERVED_SET.has(lower)) return { kind: 'reserved', token: lower };
        if (looksLikeMapPlusCode(route)) return { kind: 'map_pluscode', plusCode: route.replace(/\s/g, '') };
        if (/^profile\//i.test(route)) {
            var rest = String(route).replace(/^profile\//i, '').trim();
            var tabM = rest.match(/^(.+)\/(edit|contacts)$/i);
            var tab = '';
            var idPart = rest;
            if (tabM) {
                idPart = tabM[1].trim();
                tab = String(tabM[2]).toLowerCase();
            }
            var idRaw = idPart;
            try {
                idRaw = decodeURIComponent(idPart);
            } catch (_) {
                idRaw = idPart;
            }
            var kindSuffix = tab === 'edit' ? '_edit' : tab === 'contacts' ? '_contacts' : '';
            var profileKind = 'profile' + kindSuffix;
            if (looksLikeNpub(idPart) || looksLikeHex64(idPart)) {
                return { kind: profileKind, profileId: idPart };
            }
            if (looksLikeNip05(idRaw)) {
                return { kind: profileKind, profileId: idRaw.trim().toLowerCase() };
            }
            if (looksLikeNpub(idRaw) || looksLikeHex64(idRaw)) {
                return { kind: profileKind, profileId: idRaw.trim() };
            }
            return { kind: 'profile_invalid', profileId: rest };
        }
        if (looksLikeNpub(route) || looksLikeHex64(route)) return { kind: 'chat', chatRoute: route };
        if (looksLikeNip05(route)) {
            var dr = route;
            try {
                dr = decodeURIComponent(route);
            } catch (_) {
                dr = route;
            }
            return { kind: 'chat', chatRoute: dr };
        }
        return { kind: 'chat', chatRoute: route };
    }

    g.NrWebHashRouter = {
        EXTENDED_RESERVED: EXTENDED_RESERVED.slice(),
        getHashRoute: getHashRoute,
        classify: classify
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
