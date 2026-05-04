import {
            finalizeEvent,
            getPublicKey,
            getEventHash,
            nip19,
            nip04,
            nip44,
            generateSecretKey,
            SimplePool,
        } from 'https://cdn.jsdelivr.net/npm/nostr-tools@2.23.0/+esm';
import { resolveNip05 } from './nip05-resolve.js';
import {
    TRUSTROOTS_CIRCLE_META_KIND,
    mergeCircleMetadataMapEntry,
    isSafeHttpUrl
} from './circle-metadata.js';
import { nrWebKvGet, nrWebKvPut, nrWebKvDelete, chatCacheKvKey } from './nr-web-kv-idb.js';

        // nostr-tools may access window.printer.maybe for debug; avoid ReferenceError
        if (typeof window !== 'undefined' && !window.printer) {
            window.printer = { maybe: function () {} };
        }
        // Consume "switching page" flag so it doesn't persist (set by Map/Chat nav link on the other page)
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nostroots_switching_page')) {
            sessionStorage.removeItem('nostroots_switching_page');
        }

        const MAP_NOTE_KIND = 30397;
        const MAP_NOTE_REPOST_KIND = 30398;
        const PROFILE_CLAIM_KIND = 30390;
        const TRUSTROOTS_PROFILE_KIND = 10390;
        const TRUSTROOTS_USERNAME_LABEL_NAMESPACE = 'org.trustroots:username';
        const TRUSTROOTS_USERNAME_CACHE_STORAGE_KEY = 'trustroots_username_by_pubkey';
        const DEFAULT_RELAY_URL = 'wss://nip42.trustroots.org';
        const DEFAULT_RELAYS = (window.NrWebRelaySettings?.getDefaultRelays?.() || ['wss://nip42.trustroots.org', 'wss://relay.trustroots.org', 'wss://relay.nomadwiki.org']);
        const TRUSTROOTS_CIRCLE_LABEL = 'trustroots-circle';
        const GLOBAL_CHANNEL_SLUG = 'global';
        const HOSTING_OFFER_CHANNEL_SLUG = 'hostingoffers';
        const HOSTING_OFFER_CHANNEL_ALIASES = ['hostingoffer', 'hostingoffers'];
        const relaySettings = window.NrWebRelaySettings;
        const TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX = String(
            globalThis.NrWebTrustrootsCircleMeta?.IMPORT_TOOL_PUBKEY_HEX || ''
        )
            .trim()
            .toLowerCase();
        const NIP42_AUTH_KIND = 22242;
        const RELAY_PUBLISH_TIMEOUT_MS = 10000;
        /** Same key / option set as map note composer in index.html */
        const NR_EXPIRATION_STORAGE_KEY = 'nostroots_expiration_seconds';
        const NR_EXPIRATION_OPTION_SECONDS = [3600, 86400, 604800, 2592000, 31536000];

        function normalizeChannelSlug(slug) {
            if (typeof slug !== 'string') return slug;
            const normalized = slug.trim().toLowerCase();
            if (HOSTING_OFFER_CHANNEL_ALIASES.includes(normalized)) {
                return HOSTING_OFFER_CHANNEL_SLUG;
            }
            // Must match kind 30410 `d` tags (lowercase) so circle metadata pictures resolve.
            return normalized;
        }

        // Decode blocklist npubs to hex (shared blocklist in common.js)
        if (typeof NrBlocklist !== 'undefined' && NrBlocklist.BLOCKLIST_NPUBS && nip19) {
            const blocklistHex = NrBlocklist.BLOCKLIST_NPUBS.map((n) => {
                try {
                    const d = nip19.decode(n);
                    if (d.type === 'npub') return Array.from(d.data).map(b => b.toString(16).padStart(2, '0')).join('');
                } catch (_) {}
                return null;
            }).filter(Boolean);
            NrBlocklist.setBlocklistHex(blocklistHex);
        }

        function isPlusCodeChannelId(id) {
            // OLC alphabet plus '0' for padded/prefix codes (e.g. 9F000000+)
            return typeof id === 'string' && id !== GLOBAL_CHANNEL_SLUG && /^[023456789CFGHJMPQRVWX]{4,}\+?$/i.test(id.replace(/\s/g, ''));
        }
        const pubkeyToUsername = new Map();
        /** NIP-05 from kind 0 (any domain). Used for display; prefer over npub. */
        const pubkeyToNip05 = new Map();
        /** Profile/circle picture by pubkey for chat headers and DM avatars. */
        const pubkeyToPicture = new Map();

        function isTrustrootsNip05Lower(s) {
            const n = String(s || '').trim().toLowerCase();
            return n.endsWith('@trustroots.org') || n.endsWith('@www.trustroots.org');
        }

        let isProfileLinked = false;
        let usernameFromNostr = false;
        let currentUserNip05 = '';

        function readValidatedTrustrootsUsernameMap() {
            try {
                const raw = localStorage.getItem(TRUSTROOTS_USERNAME_CACHE_STORAGE_KEY);
                if (!raw) return {};
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (_) {
                return {};
            }
        }

        function writeValidatedTrustrootsUsernameMap(map) {
            try {
                localStorage.setItem(TRUSTROOTS_USERNAME_CACHE_STORAGE_KEY, JSON.stringify(map || {}));
            } catch (_) {}
        }

        function getCachedValidatedTrustrootsUsername(pubkey) {
            if (!pubkey) return '';
            const normalized = String(pubkey).toLowerCase();
            const map = readValidatedTrustrootsUsernameMap();
            return map[normalized] || '';
        }

        function setCachedValidatedTrustrootsUsername(pubkey, username) {
            if (!pubkey) return;
            const normalizedPubkey = String(pubkey).toLowerCase();
            const normalizedUsername = (username || '').trim().toLowerCase();
            if (!normalizedUsername) return;
            const map = readValidatedTrustrootsUsernameMap();
            map[normalizedPubkey] = normalizedUsername;
            writeValidatedTrustrootsUsernameMap(map);
        }

        function clearCachedValidatedTrustrootsUsername(pubkey) {
            if (!pubkey) return;
            const normalized = String(pubkey).toLowerCase();
            const map = readValidatedTrustrootsUsernameMap();
            delete map[normalized];
            writeValidatedTrustrootsUsernameMap(map);
        }

        function getTrustrootsCircles() {
            return [
                { slug: 'hitch' }, { slug: 'hackers' }, { slug: 'nomads' }, { slug: 'veg' }, { slug: 'climbers' },
                { slug: 'cyclists' }, { slug: 'artists' }, { slug: 'photographers' }, { slug: 'vanlife' },
                { slug: 'sailors' }, { slug: 'musicians' }, { slug: 'punks' }, { slug: 'ecoliving' },
                { slug: 'foodsharing' }, { slug: 'yoga' }, { slug: 'hikers' }, { slug: 'dancers' },
                { slug: 'volunteers' }, { slug: 'activists' }, { slug: 'burners' }, { slug: 'lightfoot' }
            ];
        }

        /** Shared relay list storage (same as index.html). */
        const getRelayUrls = () => relaySettings?.getRelayUrls ? relaySettings.getRelayUrls(DEFAULT_RELAYS) : DEFAULT_RELAYS.slice();

        function saveRelayUrls(urls) {
            if (relaySettings?.saveRelayUrls) {
                relaySettings.saveRelayUrls(urls);
                return;
            }
            if (urls.length) localStorage.setItem('relay_urls', urls.join('\n'));
            else localStorage.removeItem('relay_urls');
        }

        const getSavedRelayWritePreferences = () => relaySettings?.getRelayWritePreferences ? relaySettings.getRelayWritePreferences() : {};
        const getDefaultRelayPostEnabled = (url) => relaySettings?.getDefaultRelayPostEnabled
            ? relaySettings.getDefaultRelayPostEnabled(url)
            : (url || '').trim().toLowerCase() === 'wss://nip42.trustroots.org';
        const saveRelayWritePreferences = () => {
            if (relaySettings?.saveRelayWritePreferences) relaySettings.saveRelayWritePreferences(getRelayUrls(), relayWriteEnabled);
        };

        let currentPublicKey = null;
        let currentSecretKeyHex = null;
        let currentSecretKeyBytes = null;
        let pool = null;
        let relays = [];
        const relayStatus = new Map(); // url -> { status, canWrite }
        const relayWriteEnabled = new Map(); // url -> boolean
        const conversations = new Map();
        /** @type {Map<string, { name: string, about: string, picture: string, created_at: number, eventId: string }>} */
        const circleMetaBySlug = new Map();

        const TRUSTROOTS_CIRCLE_SLUGS_SET = new Set(
            getTrustrootsCircles()
                .map((c) => String(c.slug || '').trim().toLowerCase())
                .filter(Boolean)
        );

        function normalizeCircleSlug(slug) {
            return String(slug || '').trim().toLowerCase();
        }

        function trustrootsCirclePictureFallback(slug) {
            const key = normalizeCircleSlug(slug);
            if (!key) return '';
            if (!TRUSTROOTS_CIRCLE_SLUGS_SET.has(key)) return '';
            return `https://www.trustroots.org/uploads-circle/${encodeURIComponent(key)}/1400x900.webp`;
        }

        function jpgFallbackForImageUrl(url) {
            const value = String(url || '').trim();
            if (!value) return '';
            return value.replace(/\/1400x900\.webp(?:[?#].*)?$/i, '/742x496.jpg');
        }

        function setImageWithFallback(imgEl, url, altText) {
            if (!imgEl) return;
            const primary = String(url || '').trim();
            if (!primary) {
                imgEl.removeAttribute('src');
                imgEl.style.display = 'none';
                imgEl.onerror = null;
                return;
            }
            const fallback = jpgFallbackForImageUrl(primary);
            imgEl.onerror = fallback && fallback !== primary
                ? () => {
                    imgEl.onerror = null;
                    imgEl.src = fallback;
                }
                : null;
            imgEl.src = primary;
            if (altText != null) imgEl.alt = altText;
            imgEl.style.display = 'block';
        }

        /** True when this slug matches a Trustroots tribe (relay 30410 or known slug list), not only ad-hoc #channels. */
        function hasPublishedTrustrootsCircle(slug) {
            const key = normalizeCircleSlug(slug);
            if (!key) return false;
            if (circleMetaBySlug.has(key)) return true;
            return TRUSTROOTS_CIRCLE_SLUGS_SET.has(key);
        }

        function isTrustrootsCircleConversation(entry) {
            if (!entry || entry.type !== 'channel') return false;
            const idRaw = String(entry.id || '').trim();
            if (!idRaw || idRaw === GLOBAL_CHANNEL_SLUG) return false;
            const idKey = normalizeCircleSlug(idRaw);
            if (circleMetaBySlug.has(idKey)) return true;
            if (TRUSTROOTS_CIRCLE_SLUGS_SET.has(idKey)) return true;
            const evs = entry.events || [];
            for (let i = 0; i < evs.length; i++) {
                const raw = evs[i]?.raw;
                if (!raw?.tags) continue;
                const row = raw.tags.find(
                    (t) =>
                        Array.isArray(t) &&
                        t.length >= 3 &&
                        (t[0] === 'l' || t[0] === 'L') &&
                        t[2] === TRUSTROOTS_CIRCLE_LABEL &&
                        normalizeCircleSlug(t[1]) === idKey
                );
                if (row) return true;
            }
            return false;
        }

        let selectedConversationId = null;
        let conversationFilterQuery = '';
        let backgroundContentMatches = new Set();
        const conversationSearchIndex = new Map();
        let backgroundSearchToken = 0;
        let backgroundSearchScheduled = null;
        let relayUrlsForList = [];
        /** New group modal: list of { hex, label } for added members */
        let groupModalMembers = [];
        /** NIP-09: event IDs requested for deletion (kind 5). We hide events when deletion pubkey matches author. */
        const deletedEventIds = new Set();
        /** event id -> pubkey (author) for NIP-09 validation */
        const eventAuthorById = new Map();
        /** event id pending delete confirmation */
        let pendingDeleteEventId = null;

        function getWritableRelayUrls() {
            return getRelayUrls().filter(url => relayWriteEnabled.get(url) !== false);
        }

        function getPublishRelayUrls() {
            const configured = getRelayUrls();
            if (relaySettings?.getPublishRelayUrls) {
                return relaySettings.getPublishRelayUrls(configured, relayWriteEnabled, DEFAULT_RELAYS);
            }
            const writable = getWritableRelayUrls();
            if (writable.length > 0) return writable;
            if (configured.length > 0) return configured;
            return DEFAULT_RELAYS;
        }

        function isKnownPublicRelayUrl(url) {
            if (relaySettings?.isPublicRelayUrl) return relaySettings.isPublicRelayUrl(url);
            const normalized = String(url || '').trim().toLowerCase();
            return normalized === 'wss://relay.trustroots.org' || normalized === 'wss://relay.nomadwiki.org';
        }

        /**
         * Relay scope for display:
         * - "public" when any known public relay is targeted
         * - "auth" when relay set is non-empty but includes no known public relays (eg. NIP-42 only)
         * - "" when unknown
         */
        function getRelayScopeFromRelayUrls(urls) {
            const list = Array.isArray(urls) ? urls : [];
            if (!list.length) return '';
            if (list.some((url) => isKnownPublicRelayUrl(url))) return 'public';
            return 'auth';
        }

        function updateRelayStatus(url, status, canWrite = null) {
            const current = relayStatus.get(url) || { status: 'disconnected', canWrite: true };
            relayStatus.set(url, {
                status: status,
                canWrite: canWrite !== null ? canWrite : current.canWrite
            });
        }

        function setRelayWriteEnabled(url, enabled) {
            relayWriteEnabled.set(url, enabled);
            const current = relayStatus.get(url) || { status: 'disconnected', canWrite: true };
            relayStatus.set(url, { ...current, canWrite: enabled });
            saveRelayWritePreferences();
            renderRelaysList();
            updateComposePostingIcon();
        }

        function toggleRelayWriteForEncodedUrl(encodedUrl, enabled) {
            try {
                const url = decodeURIComponent(encodedUrl);
                setRelayWriteEnabled(url, enabled);
            } catch (_) {}
        }

        function renderRelayPostWarning(container, urls) {
            if (!container) return;
            if (relaySettings?.renderRelayPostWarnings) {
                relaySettings.renderRelayPostWarnings(container, urls, relayWriteEnabled, {
                    disabledWarningId: 'relay-post-disabled-warning',
                    publicWarningId: 'relay-post-public-warning',
                    disabledClassName: 'status-toast error',
                    publicClassName: 'status-toast info',
                    disabledMessage: 'Posting is disabled. Enable "Post" for at least one relay so you can send messages.',
                    publicMessage: 'PUBLIC posting is enabled. Messages sent there are publicly visible.',
                    pointerEvents: 'auto'
                });
                return;
            }
        }

        function initializeRelaySettingsState(urls, status = 'disconnected') {
            if (relaySettings?.initializeRelaySettingsState) {
                relaySettings.initializeRelaySettingsState(urls, relayWriteEnabled, relayStatus, {
                    status,
                    savePreferences: true
                });
                return;
            }
            const savedWritePreferences = getSavedRelayWritePreferences();
            urls.forEach((url) => {
                const hasSavedPreference = Object.prototype.hasOwnProperty.call(savedWritePreferences, url);
                const canWrite = hasSavedPreference
                    ? savedWritePreferences[url] !== false
                    : getDefaultRelayPostEnabled(url);
                relayWriteEnabled.set(url, canWrite);
                updateRelayStatus(url, status, canWrite);
            });
            saveRelayWritePreferences();
        }

        // Chat cache (conversations, profiles, deletions) in IndexedDB (nr-web-kv-idb.js).
        // Includes NIP-04 DMs and NIP-44 group messages (decrypted content) so they load faster on next visit.
        const CHAT_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
        const CHAT_CACHE_MAX_EVENTS_PER_CONV = 500;
        let chatCacheWriteTimeout = null;

        /** Last-opened chat per account (e.g. restore after #map clears the hash). */
        function getSelectedChatStorageKey() {
            return currentPublicKey ? 'nostroots_selected_chat_' + currentPublicKey : '';
        }
        function readPersistedSelectedChatId() {
            const key = getSelectedChatStorageKey();
            if (!key || typeof localStorage === 'undefined') return '';
            try {
                const v = localStorage.getItem(key);
                return typeof v === 'string' && v ? v : '';
            } catch (_) {
                return '';
            }
        }
        function writePersistedSelectedChatId(id) {
            const key = getSelectedChatStorageKey();
            if (!key || typeof localStorage === 'undefined') return;
            try {
                if (id) localStorage.setItem(key, id);
                else localStorage.removeItem(key);
            } catch (_) {}
        }
        /** Ensure a conversation row exists for an id saved from a prior session (channel / DM / group). */
        function ensureConversationExistsForRestore(storedId) {
            if (!storedId || conversations.has(storedId)) return storedId;
            if (/^[0-9a-f]{64}$/i.test(storedId)) {
                getOrCreateConversation('dm', storedId, [storedId]);
                return storedId;
            }
            if (/^[0-9a-f]{64}(,[0-9a-f]{64})+$/i.test(storedId)) {
                getOrCreateConversation('group', storedId, storedId.split(','));
                return storedId;
            }
            const slug = normalizeChannelSlug(storedId);
            if (/^[a-zA-Z0-9_-]+$/.test(slug) && slug !== 'keys' && slug !== 'settings') {
                const conv = getOrCreateConversation('channel', slug, []);
                return conv && conv.id ? conv.id : slug;
            }
            return '';
        }

        async function saveChatToCache() {
            if (!currentPublicKey || typeof indexedDB === 'undefined') return;
            try {
                const convArr = [];
                for (const [id, c] of conversations.entries()) {
                    const events = (c.events || []).slice(-CHAT_CACHE_MAX_EVENTS_PER_CONV).map(ev => ({
                        id: ev.id,
                        kind: ev.kind,
                        pubkey: ev.pubkey,
                        content: ev.content ?? '',
                        created_at: ev.created_at,
                        mapNoteKey: ev.mapNoteKey,
                        raw: ev.raw ? {
                            id: ev.raw.id,
                            kind: ev.raw.kind,
                            pubkey: ev.raw.pubkey,
                            content: ev.raw.content,
                            created_at: ev.raw.created_at,
                            tags: ev.raw.tags || []
                        } : {},
                        ...(ev.nip ? { nip: ev.nip } : {}),
                        ...(ev.relayScope ? { relayScope: ev.relayScope } : {})
                    }));
                    convArr.push({ type: c.type, id, members: c.members || [], events });
                }
                const cacheData = {
                    conversations: convArr,
                    pubkeyToUsername: Array.from(pubkeyToUsername.entries()),
                    pubkeyToNip05: Array.from(pubkeyToNip05.entries()),
                    pubkeyToPicture: Array.from(pubkeyToPicture.entries()),
                    deletedEventIds: Array.from(deletedEventIds),
                    eventAuthorById: Array.from(eventAuthorById.entries()),
                    timestamp: Date.now()
                };
                const key = chatCacheKvKey(currentPublicKey);
                await nrWebKvPut(key, cacheData);
                try {
                    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
                } catch (_) {}
            } catch (e) {
                if (e && e.name === 'QuotaExceededError') {
                    try {
                        await nrWebKvDelete(chatCacheKvKey(currentPublicKey));
                    } catch (_) {}
                }
            }
        }

        async function loadChatFromCache() {
            if (!currentPublicKey) return false;
            try {
                const key = chatCacheKvKey(currentPublicKey);
                let data = await nrWebKvGet(key);
                if (data === undefined && typeof localStorage !== 'undefined') {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        try {
                            data = JSON.parse(raw);
                            await nrWebKvPut(key, data);
                        } catch (_) {
                            data = null;
                        }
                        try {
                            localStorage.removeItem(key);
                        } catch (_) {}
                    }
                }
                if (!data || typeof data !== 'object') return false;
                if (!data.timestamp || (Date.now() - data.timestamp > CHAT_CACHE_MAX_AGE)) return false;
                conversations.clear();
                conversationSearchIndex.clear();
                backgroundContentMatches.clear();
                const isBlocked = (NrBlocklist && NrBlocklist.isBlocked) ? (hex) => NrBlocklist.isBlocked(hex) : () => false;
                for (const c of data.conversations || []) {
                    const events = (c.events || [])
                        .filter(ev => !isBlocked(ev.pubkey))
                        .map(ev => ({
                            id: ev.id,
                            kind: ev.kind,
                            pubkey: ev.pubkey,
                            content: ev.content ?? '',
                            created_at: ev.created_at,
                            mapNoteKey: ev.mapNoteKey,
                            raw: ev.raw && ev.raw.tags ? {
                                id: ev.raw.id,
                                kind: ev.raw.kind,
                                pubkey: ev.raw.pubkey,
                                content: ev.raw.content,
                                created_at: ev.raw.created_at,
                                tags: ev.raw.tags
                            } : {},
                            ...(ev.nip ? { nip: ev.nip } : {}),
                            ...(ev.relayScope ? { relayScope: ev.relayScope } : {})
                        }));
                    conversations.set(c.id, { type: c.type, id: c.id, members: c.members || [], events });
                }
                pubkeyToUsername.clear();
                for (const [k, v] of (data.pubkeyToUsername || [])) pubkeyToUsername.set(k, v);
                pubkeyToNip05.clear();
                for (const [k, v] of (data.pubkeyToNip05 || [])) pubkeyToNip05.set(k, v);
                pubkeyToPicture.clear();
                for (const [k, v] of (data.pubkeyToPicture || [])) pubkeyToPicture.set(k, v);
                if (currentPublicKey) currentUserNip05 = pubkeyToNip05.get(currentPublicKey) || '';
                deletedEventIds.clear();
                for (const id of (data.deletedEventIds || [])) deletedEventIds.add(id);
                eventAuthorById.clear();
                for (const [k, v] of (data.eventAuthorById || [])) eventAuthorById.set(k, v);
                return true;
            } catch (_) {
                return false;
            }
        }

        function scheduleChatCacheWrite() {
            if (chatCacheWriteTimeout) clearTimeout(chatCacheWriteTimeout);
            chatCacheWriteTimeout = setTimeout(() => {
                void saveChatToCache().finally(() => {
                    chatCacheWriteTimeout = null;
                });
            }, 2000);
        }

        function normalizeSearchQuery(value) {
            return String(value || '').trim().toLowerCase();
        }

        function normalizeSearchText(value) {
            return String(value || '').toLowerCase();
        }

        function invalidateConversationSearchIndex(conversationId) {
            if (!conversationId) return;
            conversationSearchIndex.delete(conversationId);
            if (backgroundContentMatches.delete(conversationId)) scheduleRender('convList');
            if (normalizeSearchQuery(conversationFilterQuery)) scheduleBackgroundContentSearch();
        }

        function getConversationContentSearchText(entry) {
            const id = String(entry?.id || '');
            if (!id) return '';
            if (conversationSearchIndex.has(id)) return conversationSearchIndex.get(id) || '';
            const events = Array.isArray(entry?.events) ? entry.events : [];
            const indexed = events
                .map((ev) => normalizeSearchText(ev?.content))
                .filter(Boolean)
                .join('\n');
            conversationSearchIndex.set(id, indexed);
            return indexed;
        }

        function runBackgroundContentSearch(token, query) {
            const normalizedQuery = normalizeSearchQuery(query);
            if (!normalizedQuery) {
                backgroundContentMatches = new Set();
                scheduleRender('convList');
                return;
            }
            const entries = Array.from(conversations.entries()).map(([id, c]) => ({ id, ...c }));
            const matches = new Set();
            let idx = 0;

            function step() {
                if (token !== backgroundSearchToken) return;
                const start = performance.now();
                while (idx < entries.length) {
                    const entry = entries[idx++];
                    if (conversationMatchesFast(entry, normalizedQuery)) continue;
                    if (getConversationContentSearchText(entry).includes(normalizedQuery)) matches.add(entry.id);
                    if (performance.now() - start >= 8) break;
                }
                if (idx < entries.length) {
                    requestAnimationFrame(step);
                    return;
                }
                if (token !== backgroundSearchToken) return;
                backgroundContentMatches = matches;
                scheduleRender('convList');
            }

            requestAnimationFrame(step);
        }

        function scheduleBackgroundContentSearch() {
            backgroundSearchToken += 1;
            const token = backgroundSearchToken;
            if (backgroundSearchScheduled) clearTimeout(backgroundSearchScheduled);
            const query = conversationFilterQuery;
            backgroundSearchScheduled = setTimeout(() => {
                backgroundSearchScheduled = null;
                runBackgroundContentSearch(token, query);
            }, 0);
        }

        function getHashRoute() {
            const h = location.hash.slice(1);
            if (!h) return '';
            try { return decodeURIComponent(h); } catch (_) { return h; }
        }
        function getConversationRouteId(id) {
            if (!id) return '';
            const conv = conversations.get(id);
            if (!conv || conv.type !== 'dm') return id;
            const display = (getDisplayName(id) || '').trim();
            if (display.includes('@')) return display.toLowerCase();
            return hexToNpub(id) || id;
        }
        function findConversationIdByRoute(route) {
            const r = (route || '').trim();
            if (!r) return '';
            if (conversations.has(r)) return r;
            const needle = r.toLowerCase();
            for (const [id, conv] of conversations.entries()) {
                if (conv.type !== 'dm') continue;
                if (id === r) return id;
                const display = (getDisplayName(id) || '').trim().toLowerCase();
                if (display && display === needle) return id;
                const npub = (hexToNpub(id) || '').trim().toLowerCase();
                if (npub && npub === needle) return id;
            }
            return '';
        }
        function setHashRoute(route) {
            const encoded = route ? encodeURIComponent(route).replace(/%2B/g, '+') : '';
            const want = encoded ? '#' + encoded : '';
            if (location.hash !== want) location.hash = want;
        }
        /** Keys/settings are handled by index unified router when embedded. */
        function applyChatHashToState(routeForced, opts) {
            const o = opts || {};
            const route = routeForced !== undefined && routeForced !== null ? String(routeForced) : getHashRoute();
            const normalizedRoute = normalizeChannelSlug(route);
            const keysEl = document.getElementById('keys-modal');
            const settingsEl = document.getElementById('settings-modal');
            if (keysEl) keysEl.classList.remove('active');
            if (settingsEl) settingsEl.classList.remove('active');
            if (!route) {
                if (o.emptyPicker) {
                    const saved = readPersistedSelectedChatId();
                    if (saved) {
                        const effectiveId = ensureConversationExistsForRestore(saved);
                        if (effectiveId && conversations.has(effectiveId)) {
                            selectConversation(effectiveId);
                            return;
                        }
                        writePersistedSelectedChatId('');
                    }
                    selectedConversationId = null;
                    document.body.classList.remove('chat-open');
                    renderConvList();
                    renderThread();
                    const es = document.getElementById('empty-state');
                    if (es) es.style.display = 'flex';
                    const comp = document.getElementById('compose');
                    if (comp) comp.style.display = 'none';
                    const th = document.getElementById('thread-header');
                    if (th) th.style.display = 'none';
                    const tm = document.getElementById('thread-messages');
                    if (tm) tm.innerHTML = '';
                    return;
                }
                selectConversation(GLOBAL_CHANNEL_SLUG);
                return;
            }
            const mappedConversationId = findConversationIdByRoute(route);
            if (mappedConversationId) {
                const preferredRoute = getConversationRouteId(mappedConversationId);
                if (preferredRoute && route !== preferredRoute) setHashRoute(preferredRoute);
                selectConversation(mappedConversationId);
                return;
            }
            if (normalizedRoute && route !== normalizedRoute) {
                setHashRoute(normalizedRoute);
            }
            if (normalizedRoute && conversations.has(normalizedRoute)) {
                selectConversation(normalizedRoute);
                return;
            }
            if (normalizedRoute && !conversations.has(normalizedRoute)) {
                if (isPlusCodeChannelId(normalizedRoute)) {
                    if (typeof window !== 'undefined' && typeof window.NrWebUnifiedNavigateToMapPlusCode === 'function') {
                        window.NrWebUnifiedNavigateToMapPlusCode(normalizedRoute);
                    } else {
                        location.hash = '#' + encodeURIComponent(normalizedRoute).replace(/%2B/g, '+');
                    }
                    return;
                }
                if (/^[a-zA-Z0-9_-]+$/.test(normalizedRoute) && normalizedRoute !== 'keys' && normalizedRoute !== 'settings' && normalizedRoute !== GLOBAL_CHANNEL_SLUG) {
                    getOrCreateConversation('channel', normalizedRoute, []);
                    selectConversation(normalizedRoute);
                } else {
                    selectedConversationId = null;
                    document.body.classList.remove('chat-open');
                    renderConvList();
                    renderThread();
                    const es2 = document.getElementById('empty-state');
                    if (es2) es2.style.display = 'flex';
                    const comp2 = document.getElementById('compose');
                    if (comp2) comp2.style.display = 'none';
                    const th2 = document.getElementById('thread-header');
                    if (th2) th2.style.display = 'none';
                    const tm2 = document.getElementById('thread-messages');
                    if (tm2) tm2.innerHTML = '';
                }
                return;
            }
        }

        function isTrustrootsProfileMissingRelayError(errorStr) {
            const normalized = (errorStr || '').toLowerCase();
            return normalized.includes('restricted') && normalized.includes('no trustroots username profile event found');
        }

        /** User-facing text + optional actions for relay publish/delete failures. */
        function relayPublishFailureUserFeedback(failed, contextVerb) {
            const list = Array.isArray(failed) ? failed : [];
            const profileMissing = list.some((f) => isTrustrootsProfileMissingRelayError(f?.error));
            if (profileMissing) {
                return {
                    message:
                        "Relays didn't accept this because they don't see a Trustroots profile for your public key yet. Open Keys & profile to link your Trustroots username, then try again.",
                    actions: [{ label: 'Open Keys & profile', onClick: () => openKeysModal() }]
                };
            }
            const first = (list[0] && list[0].error) || 'Unknown relay error';
            const s = typeof first === 'string' ? first : String(first);
            const short = s.length > 200 ? s.slice(0, 197) + '…' : s;
            const verb = contextVerb === 'delete' ? "Couldn't delete" : "Couldn't send";
            return { message: `${verb}: ${short}`, actions: [] };
        }

        function formatSendCatchError(err) {
            const raw = (err && err.message) || err || '';
            const str = typeof raw === 'string' ? raw : String(raw);
            if (isTrustrootsProfileMissingRelayError(str)) {
                return relayPublishFailureUserFeedback([{ error: str }], 'send');
            }
            const short = str.length > 200 ? str.slice(0, 197) + '…' : str;
            return { message: `Send failed: ${short}`, actions: [] };
        }

        function showStatus(message, type, options) {
            options = options || {};
            const el = document.getElementById('nr-chat-status-container');
            if (!el) return;
            el.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = `status-toast ${type || 'info'}`;
            const msgEl = document.createElement('div');
            msgEl.className = 'status-toast-msg';
            msgEl.textContent = message;
            wrap.appendChild(msgEl);
            if (Array.isArray(options.actions) && options.actions.length > 0) {
                const row = document.createElement('div');
                row.className = 'status-toast-actions';
                options.actions.forEach((action) => {
                    if (!action || typeof action.label !== 'string' || typeof action.onClick !== 'function') return;
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.textContent = action.label;
                    btn.addEventListener('click', () => {
                        try {
                            action.onClick();
                        } catch (_) {}
                        el.innerHTML = '';
                    });
                    row.appendChild(btn);
                });
                if (row.childElementCount > 0) wrap.appendChild(row);
            }
            el.appendChild(wrap);
            const persistMs = options.persistMs != null ? options.persistMs : options.actions?.length ? 14000 : 4000;
            setTimeout(() => {
                if (el.contains(wrap)) el.innerHTML = '';
            }, persistMs);
        }

        function truncatePubkey(hex) {
            if (!hex || hex.length < 16) return hex || '';
            return hex.slice(0, 8) + '…' + hex.slice(-8);
        }

        /** Display name: NIP-05 if known (Trustroots or kind 0), else npub. Never hex. */
        function getDisplayName(hex) {
            if (!hex) return '';
            const trUser = pubkeyToUsername.get(hex);
            if (trUser) return trUser + '@trustroots.org';
            const nip05 = pubkeyToNip05.get(hex);
            if (nip05) return nip05;
            return hexToNpub(hex) || '';
        }

        /** Short form for sidebar: NIP-05 as-is if short, else truncated npub (never hex). */
        function getDisplayNameShort(hex) {
            const full = getDisplayName(hex);
            if (!full) return '';
            if (full.includes('@') && full.length <= 32) return full;
            if (full.length <= 20) return full;
            return full.slice(0, 12) + '…' + full.slice(-8);
        }

        function profileHrefFromId(id) {
            const raw = String(id || '').trim();
            if (!raw) return '';
            return '#profile/' + encodeURIComponent(raw).replace(/%2B/g, '+');
        }

        function setThreadTitleAsProfileLink(titleEl, profileId, label) {
            if (!titleEl) return;
            const href = profileHrefFromId(profileId);
            const text = String(label || '').trim();
            if (!href || !text) {
                titleEl.textContent = text;
                return;
            }
            titleEl.innerHTML = `<a href="${href}" class="message-inline-link nr-content-link">${escapeHtml(text)}</a>`;
        }

        /** Display label for a pubkey (nip5 or npub); used in thread author and meta. */
        function pubkeyDisplayLabel(hex) {
            return getDisplayName(hex) || getDisplayNameShort(hex) || '';
        }

        function hexToNpub(hex) {
            try {
                if (!hex || typeof hex !== 'string') return '';
                const s = hex.trim().toLowerCase().replace(/^0x/, '');
                if (s.startsWith('npub1')) return hex.trim();
                if (s.length !== 64 || !/^[0-9a-f]+$/.test(s)) return '';
                const bytes = new Uint8Array(32);
                for (let i = 0; i < 32; i++) bytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
                return nip19.npubEncode(bytes);
            } catch (_) {}
            try {
                const s = (hex || '').trim().toLowerCase().replace(/^0x/, '');
                if (s.length === 64 && /^[0-9a-f]+$/.test(s)) return nip19.npubEncode(s);
            } catch (_) {}
            return '';
        }

        function getDisplayNpub() {
            if (!currentPublicKey) return '';
            return hexToNpub(currentPublicKey) || '';
        }

        function parsePubkeyInput(input) {
            const s = (input || '').trim();
            if (!s) return null;
            if (/^[0-9a-f]{64}$/i.test(s)) return s;
            try {
                const decoded = nip19.decode(s);
                if (decoded.type === 'npub') return Array.from(decoded.data).map(b => b.toString(16).padStart(2, '0')).join('');
                if (decoded.type === 'nsec') return null;
            } catch (_) {}
            return null;
        }

        /** Resolve npub/hex synchronously, or NIP-05 (async) to hex. Returns Promise<hex|null>. */
        async function resolvePubkeyInput(raw) {
            const s = (raw || '').trim();
            if (!s) return null;
            if (s.includes('@')) return await resolveNip05(s);
            return parsePubkeyInput(s);
        }

        function decodeNsec(input) {
            const s = (input || '').trim();
            if (s.length === 64 && /^[0-9a-f]+$/i.test(s)) return s;
            if (!s.startsWith('nsec1')) return null;
            try {
                const decoded = nip19.decode(s);
                if (decoded.type === 'nsec') return Array.from(decoded.data).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (_) {}
            return null;
        }

        function getNsecInputErrorMessage(input) {
            const s = (input || '').trim();
            if (!s) return 'Please enter an nsec';
            if (s.startsWith('npub1')) {
                return 'You entered an npub (public key). Paste your nsec (private key) here. If you only have a mnemonic phrase, import it on the Map page first. You may have your key in the Nostroots mobile app or your password manager.';
            }
            return 'Invalid nsec format';
        }

        function hasLocalSigningKey() {
            return !!(currentSecretKeyBytes && currentPublicKey);
        }

        function requireLocalSigningKey() {
            if (hasLocalSigningKey()) return true;
            throw new Error('No local key loaded. Import an nsec to continue.');
        }

        async function loadKeysFromStorage() {
            const hex = localStorage.getItem('nostr_private_key');
            if (!(hex && hex.length === 64 && /^[0-9a-f]+$/i.test(hex))) return false;
            currentSecretKeyHex = hex;
            currentSecretKeyBytes = new Uint8Array(32);
            for (let i = 0; i < 32; i++) currentSecretKeyBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
            currentPublicKey = getPublicKey(currentSecretKeyBytes);
            const cachedUsername = getCachedValidatedTrustrootsUsername(currentPublicKey);
            if (cachedUsername) {
                isProfileLinked = true;
                usernameFromNostr = true;
                pubkeyToUsername.set(currentPublicKey, cachedUsername);
            }
            await startSubscriptions();
            updateUI();
            return true;
        }

        function savePrivateKey(hex) {
            localStorage.setItem('nostr_private_key', hex);
            currentSecretKeyHex = hex;
            currentSecretKeyBytes = new Uint8Array(32);
            for (let i = 0; i < 32; i++) currentSecretKeyBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
            currentPublicKey = getPublicKey(currentSecretKeyBytes);
        }

        function importKey() {
            const raw = (document.getElementById('nsec-import') || document.getElementById('onboarding-import'))?.value?.trim() || '';
            const hex = decodeNsec(raw) || (raw.length === 64 && /^[0-9a-f]+$/i.test(raw) ? raw : null);
            if (!hex) {
                showStatus('Invalid nsec or hex key.', 'error');
                return;
            }
            savePrivateKey(hex);
            const nsecImport = document.getElementById('nsec-import');
            const onboardingImport = document.getElementById('onboarding-import');
            if (nsecImport) nsecImport.value = '';
            if (onboardingImport) onboardingImport.value = '';
            closeKeysModal();
            void (async () => {
                await loadKeysFromStorage();
                showStatus('Key imported. Shared with map app.', 'success');
                openKeysModal();
            })();
        }

        function disconnect() {
            const selChatKey = getSelectedChatStorageKey();
            currentPublicKey = null;
            currentSecretKeyHex = null;
            currentSecretKeyBytes = null;
            isProfileLinked = false;
            usernameFromNostr = false;
            currentUserNip05 = '';
            setTrustrootsUI('');
            if (typeof window.NrWebTheme !== 'undefined') {
                window.NrWebTheme.registerThemePublish(null);
            }
            localStorage.removeItem('nostr_private_key');
            if (selChatKey) {
                try {
                    localStorage.removeItem(selChatKey);
                } catch (_) {}
            }
            conversations.clear();
            selectedConversationId = null;
            if (pool) {
                pool.close();
                pool = null;
            }
            closePublicMapRelayConnections();
            updateUI();
            renderConvList();
            showThreadEmpty();
        }

        function setHeaderIdentity() {
            const el = document.getElementById('header-identity');
            const elM = document.getElementById('header-identity-mobile');
            const btn = document.getElementById('keys-icon-btn');
            const btnM = document.getElementById('keys-icon-btn-mobile');
            if (!el) return;
            const hasKey = !!currentPublicKey;
            const nip5 = currentUserNip05 || (currentPublicKey ? pubkeyToNip05.get(currentPublicKey) : '');
            const trUsername = currentPublicKey ? pubkeyToUsername.get(currentPublicKey) : null;
            const npubStr = getDisplayNpub() || (currentPublicKey ? hexToNpub(currentPublicKey) : '');
            function applyTo(node) {
                if (!node) return;
                if (!hasKey) {
                    node.textContent = '';
                    node.title = '';
                    node.classList.add('empty');
                    node.classList.remove('nip5');
                    return;
                }
                node.classList.remove('empty');
                if (nip5) {
                    node.textContent = nip5;
                    node.title = nip5 + (npubStr ? '\n' + npubStr : '');
                    node.classList.add('nip5');
                } else if (trUsername) {
                    node.textContent = trUsername + '@trustroots.org';
                    node.title = trUsername + '@trustroots.org\n' + (npubStr || '');
                    node.classList.remove('nip5');
                } else {
                    node.textContent = npubStr ? (npubStr.slice(0, 12) + '…' + npubStr.slice(-8)) : '';
                    node.title = npubStr || '';
                    node.classList.remove('nip5');
                }
            }
            if (!hasKey) {
                applyTo(el);
                applyTo(elM);
                if (btn) btn.classList.remove('has-identity');
                if (btnM) btnM.classList.remove('has-identity');
                return;
            }
            if (btn) btn.classList.add('has-identity');
            if (btnM) btnM.classList.add('has-identity');
            applyTo(el);
            applyTo(elM);
        }

        function updateUI() {
            const hasKey = !!currentPublicKey;
            setHeaderIdentity();
            const keysBtn = document.getElementById('keys-icon-btn');
            if (keysBtn) keysBtn.title = hasKey ? 'Keys' : 'Connect key to post';
            if (document.getElementById('keys-modal')) {
                updateKeyDisplay();
            }
            if (hasKey) {
                renderRelaysList();
                renderConvList();
            }
        }

        function openKeysModal() {
            const keysModal = window.NrWebKeysModal;
            const hasKey = !!(currentPublicKey || currentSecretKeyHex);
            if (keysModal?.openKeysModal) {
                keysModal.openKeysModal({
                    hasKey,
                    route: 'keys',
                    setRoute: setHashRoute,
                    onOpenManagedSection: () => {
                        updateKeyDisplay({ skipProfileLookup: true });
                        checkProfileLinked();
                    }
                });
                return;
            }
            const keysEl = document.getElementById('keys-modal');
            if (!keysEl) return;
            keysEl.classList.add('active');
            setHashRoute('keys');
        }
        function closeKeysModal() {
            const keysModal = window.NrWebKeysModal;
            if (keysModal?.closeKeysModal) {
                keysModal.closeKeysModal({
                    fallbackRoute: getConversationRouteId(selectedConversationId),
                    setRoute: setHashRoute
                });
                return;
            }
            const el = document.getElementById('keys-modal');
            if (el) el.classList.remove('active');
            setHashRoute(getConversationRouteId(selectedConversationId));
        }

        function openSettingsModal() {
            const keysEl = document.getElementById('keys-modal');
            const settingsEl = document.getElementById('settings-modal');
            if (keysEl) keysEl.classList.remove('active');
            if (settingsEl) settingsEl.classList.add('active');
            setHashRoute('settings');
            renderRelaysList();
            if (typeof renderSettingsNotificationsSection === 'function') renderSettingsNotificationsSection();
            window.NrWeb?.applySettingsFooterMetadataFromCache?.();
            window.NrWeb?.refreshSettingsFooterMetadata?.();
        }
        function closeSettingsModal() {
            const el = document.getElementById('settings-modal');
            if (el) el.classList.remove('active');
            setHashRoute(getConversationRouteId(selectedConversationId));
        }

        function updateKeyDisplay(options = {}) {
            const keysModal = window.NrWebKeysModal;
            let npub = '';
            let npubError = '';
            const keySource = keysModal?.getKeySourceForPubkey?.(currentPublicKey) || '';
            const showChecklist = keySource === 'generated';
            const isNsecBackedUp = keysModal?.isKeyBackedUpForPubkey?.(currentPublicKey) === true;
            if (currentPublicKey) {
                try {
                    npub = nip19.npubEncode(currentPublicKey);
                } catch (_) {
                    npubError = 'Error encoding npub';
                }
            }
            if (keysModal?.updateKeyDisplay) {
                keysModal.updateKeyDisplay({
                    hasNsec: !!currentSecretKeyHex,
                    hasPublicKey: !!currentPublicKey,
                    npub,
                    npubError,
                    isProfileLinked,
                    isUsernameLinked: usernameFromNostr,
                    showChecklist,
                    isNsecBackedUp
                });
            }
            if (currentPublicKey && options.skipProfileLookup !== true) checkProfileLinked();
            setHeaderIdentity();
        }

        function renderSettingsNotificationsSection() { /* no-op on chat */ }

        function onboardingImport() {
            const input = document.getElementById('onboarding-import');
            const raw = (input?.value || '').trim();
            if (!raw) {
                showStatus('Please enter nsec or hex key.', 'error');
                return;
            }
            const hex = decodeNsec(raw) || (raw.length === 64 && /^[0-9a-f]+$/i.test(raw) ? raw : null);
            if (!hex) {
                const errorMessage = raw.startsWith('npub1')
                    ? getNsecInputErrorMessage(raw)
                    : 'Invalid nsec or hex. For mnemonic, use the Map page.';
                showStatus(errorMessage, 'error');
                return;
            }
            savePrivateKey(hex);
            if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
                window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'imported');
                window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, true);
            }
            if (input) input.value = '';
            void (async () => {
                await loadKeysFromStorage();
                openKeysModal();
            })();
            showStatus('Key imported.', 'success');
        }
        function onboardingGenerate() {
            generateKeyPair();
            openKeysModal();
        }
        function importNsec() {
            const el = document.getElementById('nsec-import');
            const raw = (el?.value || '').trim();
            if (!raw) {
                showStatus('Please enter an nsec', 'error');
                return;
            }
            const hex = decodeNsec(raw) || (raw.length === 64 && /^[0-9a-f]+$/i.test(raw) ? raw : null);
            if (!hex) {
                showStatus(getNsecInputErrorMessage(raw), 'error');
                return;
            }
            savePrivateKey(hex);
            if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
                window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'imported');
                window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, true);
            }
            if (el) el.value = '';
            void (async () => {
                await loadKeysFromStorage();
                updateKeyDisplay();
                openKeysModal();
            })();
            showStatus('nsec imported successfully!', 'success');
        }
        function generateKeyPair() {
            const privateKey = new Uint8Array(32);
            crypto.getRandomValues(privateKey);
            const privateKeyHex = Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('');
            savePrivateKey(privateKeyHex);
            if (window.NrWebKeysModal?.setKeySourceForPubkey && currentPublicKey) {
                window.NrWebKeysModal.setKeySourceForPubkey(currentPublicKey, 'generated');
                window.NrWebKeysModal.setKeyBackedUpForPubkey?.(currentPublicKey, false);
            }
            void (async () => {
                await loadKeysFromStorage();
            })();
            showStatus('New key pair generated!', 'success');
        }
        function exportNsec() {
            if (!currentSecretKeyHex) {
                showStatus('No private key to export', 'error');
                return;
            }
            try {
                const bytes = new Uint8Array(32);
                for (let i = 0; i < 32; i++) bytes[i] = parseInt(currentSecretKeyHex.substring(i * 2, i * 2 + 2), 16);
                const nsec = nip19.nsecEncode(bytes);
                navigator.clipboard.writeText(nsec).then(() => {
                    window.NrWebKeysModal?.setKeyBackedUpForPubkey?.(currentPublicKey, true);
                    updateKeyDisplay({ skipProfileLookup: true });
                    showStatus('nsec copied to clipboard!', 'success');
                }).catch(() => {
                    prompt('Your nsec (copy this):', nsec);
                    window.NrWebKeysModal?.setKeyBackedUpForPubkey?.(currentPublicKey, true);
                    updateKeyDisplay({ skipProfileLookup: true });
                    showStatus('nsec displayed', 'info');
                });
            } catch (e) {
                showStatus('Error exporting nsec: ' + (e && e.message), 'error');
            }
        }
        function deleteNsec() {
            if (!confirm('Delete your private key? You will need to import or generate a new key.')) return;
            const deletedPubkey = currentPublicKey;
            disconnect();
            window.NrWebKeysModal?.clearKeySourceForPubkey?.(deletedPubkey);
            window.NrWebKeysModal?.clearKeyBackedUpForPubkey?.(deletedPubkey);
            updateKeyDisplay();
            openKeysModal();
            showStatus('Private key deleted', 'success');
        }

        function copyPublicKey() {
            const npubEl = document.getElementById('npub-display');
            const copyBtn = document.getElementById('copy-npub-btn');
            const copyText = document.getElementById('copy-npub-text');
            if (!npubEl || !npubEl.value) {
                showStatus('No public key to copy', 'error');
                return;
            }
            navigator.clipboard.writeText(npubEl.value).then(() => {
                const original = copyText ? copyText.textContent : '📋';
                if (copyText) copyText.textContent = '✓';
                if (copyBtn) copyBtn.classList.add('copied');
                showStatus('Public key copied to clipboard', 'success');
                setTimeout(() => {
                    if (copyText) copyText.textContent = original;
                    if (copyBtn) copyBtn.classList.remove('copied');
                }, 2000);
            }).catch(() => showStatus('Failed to copy', 'error'));
        }

        function openNewDmModal() {
            document.getElementById('new-dm-modal').classList.add('active');
            const input = document.getElementById('new-dm-pubkey');
            if (input) input.focus();
        }
        function closeNewDmModal() {
            document.getElementById('new-dm-modal').classList.remove('active');
        }
        function openNewGroupModal() {
            groupModalMembers = [];
            renderGroupModalMembers();
            document.getElementById('new-group-one-pubkey').value = '';
            document.getElementById('new-group-modal').classList.add('active');
        }
        function closeNewGroupModal() {
            document.getElementById('new-group-modal').classList.remove('active');
        }

        function renderGroupModalMembers() {
            const list = document.getElementById('new-group-members-list');
            const startBtn = document.getElementById('new-group-start-btn');
            if (!list) return;
            list.textContent = '';
            groupModalMembers.forEach(({ hex, label }) => {
                const chip = document.createElement('span');
                chip.className = 'participant-chip';
                const span = document.createElement('span');
                span.className = 'label';
                span.title = label;
                span.textContent = label;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'remove-btn';
                btn.setAttribute('aria-label', 'Remove');
                btn.textContent = '×';
                btn.onclick = () => removeGroupModalMember(hex);
                chip.appendChild(span);
                chip.appendChild(btn);
                list.appendChild(chip);
            });
            if (startBtn) startBtn.disabled = groupModalMembers.length === 0;
        }

        function removeGroupModalMember(hex) {
            groupModalMembers = groupModalMembers.filter(m => m.hex !== hex);
            renderGroupModalMembers();
        }

        async function addGroupParticipant() {
            const input = document.getElementById('new-group-one-pubkey');
            const raw = (input?.value || '').trim();
            if (!raw) {
                showStatus('Enter npub, nip5 or hashtag (e.g. nostroots@trustroots.org).', 'error');
                return;
            }
            const hex = await resolvePubkeyInput(raw);
            if (!hex) {
                showStatus('Could not resolve: invalid or nip5 not found.', 'error');
                return;
            }
            if (hex === currentPublicKey) {
                showStatus('You are already in the group.', 'error');
                return;
            }
            if (groupModalMembers.some(m => m.hex === hex)) {
                showStatus('Already added.', 'error');
                return;
            }
            groupModalMembers.push({ hex, label: raw });
            renderGroupModalMembers();
            input.value = '';
            showStatus('Added: ' + raw, 'success');
        }
        function getOrCreateConversation(type, id, members) {
            if (type === 'channel') {
                const normalizedId = normalizeChannelSlug(id);
                if (normalizedId && normalizedId !== id) {
                    const legacyConv = conversations.get(id);
                    const canonicalConv = conversations.get(normalizedId);
                    if (legacyConv && !canonicalConv) {
                        legacyConv.id = normalizedId;
                        conversations.set(normalizedId, legacyConv);
                        conversations.delete(id);
                    }
                }
                id = normalizedId;
            }
            let c = conversations.get(id);
            if (!c) {
                c = { type, id, members: members || [], events: [] };
                conversations.set(id, c);
                invalidateConversationSearchIndex(id);
                if (getHashRoute() === id) selectConversation(id);
            }
            return c;
        }

        function getConversationKey(theirPubkey) {
            if (!currentSecretKeyBytes) return null;
            try {
                const key = nip44.getConversationKey(currentSecretKeyBytes, theirPubkey);
                return key;
            } catch (_) {}
            return null;
        }

        /** Encrypt DM content for a peer. Prefers NIP-44 (then NIP-04 fallback). Returns { cipher, nip } or null. */
        async function encryptKind4(peerPubkey, plaintext) {
            if (!currentSecretKeyBytes) return null;
            const key = getConversationKey(peerPubkey);
            if (key) {
                try {
                    const cipher = nip44.v2.encrypt(plaintext, key);
                    return { cipher, nip: 'nip44' };
                } catch (_) {}
            }
            try {
                const cipher = nip04.encrypt(currentSecretKeyBytes, peerPubkey, plaintext);
                return { cipher, nip: 'nip4' };
            } catch (_) {}
            return null;
        }

        function looksLikeNip04(content) {
            return typeof content === 'string' && content.includes('?iv=');
        }

        async function decryptPendingForConversation(conv) {
            if (!conv || !conv._pendingEncrypted || !conv._pendingEncrypted.length) return;
            if (conv._decryptingPending) return;
            conv._decryptingPending = true;
            try {
                while (conv._pendingEncrypted.length) {
                    const event = conv._pendingEncrypted.shift();
                    if (conv.events.some(e => e.id === event.id)) continue;
                    const other = event.tags.find(t => t[0] === 'p')?.[1];
                    const peer = other && other !== currentPublicKey ? other : event.pubkey;
                    const authorPubkey = event.pubkey === currentPublicKey ? peer : event.pubkey;
                    let plain = await decryptKind4(event.content, authorPubkey);
                    if (plain == null) plain = '[could not decrypt]';
                    eventAuthorById.set(event.id, event.pubkey);
                    const dmNip = looksLikeNip04(event.content) ? 'nip4' : 'nip44';
                    conv.events.push({ id: event.id, pubkey: event.pubkey, content: plain, created_at: event.created_at, raw: event, nip: dmNip });
                    conv.events.sort((a, b) => a.created_at - b.created_at);
                    invalidateConversationSearchIndex(conv.id);
                    scheduleChatCacheWrite();
                    if (selectedConversationId === conv.id) scheduleRender('thread');
                }
                scheduleRender('convList');
            } finally {
                conv._decryptingPending = false;
            }
        }

        async function decryptKind4(content, authorPubkey) {
            if (!currentSecretKeyBytes) return null;
            const isNip04Content = looksLikeNip04(content);
            if (!isNip04Content) {
                const key = getConversationKey(authorPubkey);
                if (key) {
                    try {
                        return nip44.v2.decrypt(content, key);
                    } catch (_) {}
                }
            }
            try {
                return nip04.decrypt(currentSecretKeyBytes, authorPubkey, content);
            } catch (_) {}
            return null;
        }

        function setupChatNrWebThemeSync() {
            const NT = window.NrWebTheme;
            if (!NT || !currentSecretKeyBytes || !currentPublicKey || !pool) return;
            NT.registerThemePublish(async (theme) => {
                try {
                    const tpl = NT.createThemeEventTemplate(theme, nip44, currentSecretKeyBytes, currentPublicKey);
                    if (!tpl) return;
                    const signed = finalizeEvent(tpl, currentSecretKeyBytes);
                    const relayList = Array.isArray(relays) && relays.length ? relays : DEFAULT_RELAYS;
                    await pool.publish(relayList, signed);
                } catch (_) {}
            });
            const relayList = Array.isArray(relays) && relays.length ? relays : DEFAULT_RELAYS;
            const filter = {
                kinds: [NT.NRWEB_THEME_KIND],
                authors: [currentPublicKey],
                '#d': [NT.NRWEB_THEME_D_TAG],
                limit: 10
            };
            let best = null;
            const sub = pool.subscribe(relayList, filter, {
                onevent: (ev) => {
                    if (!best || ev.created_at > best.created_at) best = ev;
                },
                oneose: () => {
                    try { sub.close(); } catch (_) {}
                    if (best) {
                        const parsed = NT.parseThemeFromKind78Event(best, nip44, currentSecretKeyBytes, currentPublicKey);
                        if (parsed) NT.mergeThemeFromRemote(parsed);
                    }
                }
            });
            setTimeout(() => {
                try { sub.close(); } catch (_) {}
            }, 8000);
        }

        let publicSubsStarted = false;
        let publicMapRelayConnections = [];

        function closePublicMapRelayConnections() {
            publicMapRelayConnections.forEach((conn) => {
                try { conn?.close?.(); } catch (_) {}
            });
            publicMapRelayConnections = [];
        }

        async function buildAuthEventForRelay(relayUrl, challenge) {
            if (!challenge) return false;
            requireLocalSigningKey();
            let relayTag = (relayUrl || '').trim();
            try {
                const parsed = new URL(relayTag);
                if ((parsed.pathname === '' || parsed.pathname === '/') && !parsed.search && !parsed.hash) {
                    relayTag = `${parsed.protocol}//${parsed.host}`;
                } else {
                    relayTag = parsed.toString();
                }
            } catch (_) {}
            const authTemplate = {
                kind: NIP42_AUTH_KIND,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['relay', relayTag],
                    ['challenge', challenge]
                ],
                content: '',
                pubkey: currentPublicKey
            };
            return signEvent(authTemplate);
        }

        async function publishEventToRelayViaWebSocket(relayUrl, signedEvent) {
            return await new Promise((resolve) => {
                let settled = false;
                let ws = null;
                let authEventId = null;
                let authCompleted = false;
                let authChallengeSeen = false;
                let eventRejectedForAuth = false;
                let eventSent = false;
                let delayedSendTimer = null;
                const finish = (result) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    if (delayedSendTimer) clearTimeout(delayedSendTimer);
                    try { ws?.close(); } catch (_) {}
                    resolve(result);
                };
                const sendEvent = () => {
                    if (!ws || ws.readyState !== WebSocket.OPEN) return;
                    eventSent = true;
                    ws.send(JSON.stringify(['EVENT', signedEvent]));
                };
                const timeoutId = setTimeout(() => {
                    finish({ success: false, url: relayUrl, error: 'timeout waiting for relay OK' });
                }, RELAY_PUBLISH_TIMEOUT_MS);

                try {
                    ws = new WebSocket(relayUrl);
                } catch (error) {
                    finish({ success: false, url: relayUrl, error: error?.message || String(error) });
                    return;
                }

                ws.addEventListener('open', () => {
                    // Give relays that require NIP-42 a brief moment to issue AUTH before EVENT.
                    delayedSendTimer = setTimeout(() => {
                        if (!authChallengeSeen && !eventSent) sendEvent();
                    }, 120);
                });

                ws.addEventListener('message', async (msg) => {
                    let data;
                    try {
                        data = JSON.parse(msg.data);
                    } catch (_) {
                        return;
                    }
                    const [type, a, b, c] = data;

                    if (type === 'AUTH') {
                        authChallengeSeen = true;
                        if (delayedSendTimer) {
                            clearTimeout(delayedSendTimer);
                            delayedSendTimer = null;
                        }
                        try {
                            const relayTagUrl = ws?.url || relayUrl;
                            const signedAuth = await buildAuthEventForRelay(relayTagUrl, a);
                            authEventId = signedAuth.id;
                            ws.send(JSON.stringify(['AUTH', signedAuth]));
                        } catch (error) {
                            finish({ success: false, url: relayUrl, error: error?.message || String(error) });
                        }
                        return;
                    }

                    if (type === 'OK' && a === signedEvent.id) {
                        if (b === true) {
                            finish({ success: true, url: relayUrl });
                        } else {
                            const reason = (c || '').toString();
                            if (reason.toLowerCase().includes('auth-required') && !authCompleted) {
                                eventRejectedForAuth = true;
                                return;
                            }
                            finish({ success: false, url: relayUrl, error: reason || 'relay rejected event' });
                        }
                        return;
                    }

                    if (type === 'OK' && authEventId && a === authEventId) {
                        if (b === true) {
                            authCompleted = true;
                            if (!eventSent || eventRejectedForAuth) {
                                eventRejectedForAuth = false;
                                sendEvent();
                            }
                        } else {
                            finish({ success: false, url: relayUrl, error: (c || '').toString() || 'relay rejected auth event' });
                        }
                    }
                });

                ws.addEventListener('error', () => {
                    finish({ success: false, url: relayUrl, error: 'websocket error' });
                });

                ws.addEventListener('close', () => {
                    if (!settled) finish({ success: false, url: relayUrl, error: 'connection closed before relay OK' });
                });
            });
        }

        async function publishEventWithRelayAcks(relayUrls, signedEvent) {
            const urls = Array.isArray(relayUrls) ? relayUrls : [];
            const results = await Promise.all(urls.map((url) => publishEventToRelayViaWebSocket(url, signedEvent)));
            const succeeded = results.filter((res) => res.success);
            const failed = results.filter((res) => !res.success);
            return { succeeded, failed };
        }

        function startWsMapSubscription(relayUrl, onChannelEvent) {
            const relayAuth = globalThis.NrWebRelayAuth;
            if (relayAuth?.startNip42WsSubscription && currentPublicKey) {
                return relayAuth.startNip42WsSubscription({
                    relayUrl,
                    filter: { kinds: [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND], limit: 10000 },
                    authPubkey: currentPublicKey,
                    signEvent: (template) => signEvent(template),
                    onEvent: (event) => {
                        if (event && (event.kind === MAP_NOTE_KIND || event.kind === MAP_NOTE_REPOST_KIND)) {
                            onChannelEvent(event);
                        }
                    },
                    onAuthChallenge: () => {},
                    onAuthSuccess: () => {},
                    onAuthFail: () => {}
                });
            }
            const ws = new WebSocket(relayUrl);
            const subId = `chat-map-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
            const sendReq = () => {
                const filter = { kinds: [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND], limit: 10000 };
                ws.send(JSON.stringify(['REQ', subId, filter]));
            };

            ws.addEventListener('open', () => {
                sendReq();
            });

            ws.addEventListener('message', async (msg) => {
                let data;
                try {
                    data = JSON.parse(msg.data);
                } catch (_) {
                    return;
                }
                const [type, a, b] = data;
                if (type === 'AUTH') {
                    try {
                        const signedAuth = await buildAuthEventForRelay(relayUrl, a);
                        ws.send(JSON.stringify(['AUTH', signedAuth]));
                        sendReq();
                    } catch (error) {
                        console.error(`[Chat Relay] NIP-42 auth failed for ${relayUrl}:`, error?.message || error);
                    }
                    return;
                }
                if (type === 'EVENT') {
                    const event = b;
                    if (event && (event.kind === MAP_NOTE_KIND || event.kind === MAP_NOTE_REPOST_KIND)) {
                        onChannelEvent(event);
                    }
                    return;
                }
            });

            ws.addEventListener('error', () => {});

            return {
                close: () => {
                    try { ws.close(); } catch (_) {}
                }
            };
        }

        function startPublicSubscriptions() {
            relayUrlsForList = getRelayUrls();
            relays = relayUrlsForList.length ? relayUrlsForList : DEFAULT_RELAYS;
            initializeRelaySettingsState(relays, 'connecting');
            renderRelaysList();
            if (!pool) pool = new SimplePool();

            getOrCreateConversation('channel', GLOBAL_CHANNEL_SLUG, []);
            renderConvList();
            if (!getHashRoute()) selectConversation(GLOBAL_CHANNEL_SLUG);

            function onChannelEvent(event) {
                const slugs = getChannelSlugsFromEvent(event);
                const mapNoteKey = getMapNoteCanonicalKey(event);

                if (NrBlocklist && NrBlocklist.isBlocked(event.pubkey)) return;

                let changed = false;
                slugs.forEach((targetSlug) => {
                    const conv = getOrCreateConversation('channel', targetSlug, []);
                    const existing = conv.events.some(e => e.id === event.id || (mapNoteKey && e.mapNoteKey === mapNoteKey));
                    if (existing) return;
                    eventAuthorById.set(event.id, event.pubkey);
                    conv.events.push({
                        id: event.id,
                        kind: event.kind,
                        pubkey: event.pubkey,
                        content: event.content || '',
                        created_at: event.created_at,
                        raw: event,
                        mapNoteKey
                    });
                    conv.events.sort((a, b) => a.created_at - b.created_at);
                    invalidateConversationSearchIndex(conv.id);
                    changed = true;
                    if (selectedConversationId === targetSlug) scheduleRender('thread');
                });

                if (changed) {
                    scheduleChatCacheWrite();
                    scheduleRender('convList');
                }
            }

            const mapNoteFilter = (extra) => ({ kinds: [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND], limit: 10000, ...extra });
            pool.subscribe(relays, mapNoteFilter({ '#L': [TRUSTROOTS_CIRCLE_LABEL] }), { onevent: onChannelEvent });
            pool.subscribe(relays, mapNoteFilter({ '#t': HOSTING_OFFER_CHANNEL_ALIASES }), { onevent: onChannelEvent });
            pool.subscribe(relays, mapNoteFilter(), { onevent: onChannelEvent });

            closePublicMapRelayConnections();
            relays.forEach((url) => {
                try {
                    const connection = startWsMapSubscription(url, onChannelEvent);
                    publicMapRelayConnections.push(connection);
                } catch (error) {
                    console.error(`[Chat Relay] failed to connect ${url}:`, error?.message || error);
                }
            });

            pool.subscribe(relays, { kinds: [5], limit: 500 }, { onevent(event) {
                (event.tags || []).filter(t => t[0] === 'e' && t[1]).forEach(t => {
                    const eid = t[1];
                    if (eventAuthorById.get(eid) === event.pubkey) deletedEventIds.add(eid);
                });
                scheduleChatCacheWrite();
                scheduleRender('both');
            } });

            pool.subscribe(relays, { kinds: [TRUSTROOTS_PROFILE_KIND] }, { onevent(event) {
                const username = getTrustrootsUsernameFromProfileEvent(event);
                if (username) {
                    pubkeyToUsername.set(event.pubkey, username);
                    scheduleChatCacheWrite();
                    scheduleRender('both');
                }
            } });

            pool.subscribe(relays, { kinds: [0] }, { onevent(event) {
                const username = getTrustrootsUsernameFromKind0(event);
                if (username && !pubkeyToUsername.has(event.pubkey)) {
                    pubkeyToUsername.set(event.pubkey, username);
                    scheduleChatCacheWrite();
                    scheduleRender('both');
                }
                if (event.content) {
                    try {
                        const profile = JSON.parse(event.content);
                        const nip05 = (profile.nip05 || '').trim();
                        const picture = String(profile.picture || '').trim();
                        if (nip05) {
                            pubkeyToNip05.set(event.pubkey, nip05);
                            if (event.pubkey === currentPublicKey) {
                                currentUserNip05 = nip05;
                                updateAuthNip05Display();
                            }
                            scheduleChatCacheWrite();
                            scheduleRender('both');
                        }
                        if (picture && isSafeHttpUrl(picture)) {
                            pubkeyToPicture.set(event.pubkey, picture);
                            scheduleChatCacheWrite();
                            scheduleRender('both');
                            const selDm = selectedConversationId ? conversations.get(selectedConversationId) : null;
                            if (selDm && selDm.type === 'dm' && selDm.id === event.pubkey) {
                                syncThreadHeaderForConversation(selDm);
                            }
                        }
                    } catch (_) {}
                }
            } });

            pool.subscribe(relays, { kinds: [PROFILE_CLAIM_KIND], limit: 1000 }, { onevent(event) {
                if (event.kind !== PROFILE_CLAIM_KIND || !event.content) return;
                let picture = '';
                try {
                    const profile = JSON.parse(event.content);
                    picture = String(profile.picture || '').trim();
                } catch (_) {
                    picture = '';
                }
                if (!picture || !isSafeHttpUrl(picture)) return;
                const pTag = (event.tags || []).find((t) => Array.isArray(t) && t[0] === 'p' && t[1]);
                const targetPubkey = String(pTag?.[1] || '').trim().toLowerCase();
                if (!/^[0-9a-f]{64}$/.test(targetPubkey)) return;
                pubkeyToPicture.set(targetPubkey, picture);
                scheduleChatCacheWrite();
                scheduleRender('both');
                const selDm = selectedConversationId ? conversations.get(selectedConversationId) : null;
                if (selDm && selDm.type === 'dm' && selDm.id === targetPubkey) {
                    syncThreadHeaderForConversation(selDm);
                }
            } });

            if (TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX) {
                pool.subscribe(
                    relays,
                    {
                        kinds: [TRUSTROOTS_CIRCLE_META_KIND],
                        authors: [TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX],
                        limit: 5000
                    },
                    {
                        onevent(event) {
                            if (NrBlocklist && NrBlocklist.isBlocked(event.pubkey)) return;
                            const changed = mergeCircleMetadataMapEntry(circleMetaBySlug, event, {
                                expectedPubkey: TRUSTROOTS_IMPORT_TOOL_PUBKEY_HEX,
                                kind: TRUSTROOTS_CIRCLE_META_KIND
                            });
                            if (!changed) return;
                            scheduleRender('convList');
                            const sel = selectedConversationId ? conversations.get(selectedConversationId) : null;
                            if (sel && isTrustrootsCircleConversation(sel)) {
                                syncThreadHeaderForConversation(sel);
                                scheduleRender('thread');
                            }
                        }
                    }
                );
            }

            relays.forEach((url) => {
                updateRelayStatus(url, 'connected', relayWriteEnabled.get(url) !== false);
            });
            renderRelaysList();
            publicSubsStarted = true;
        }

        async function startSubscriptions() {
            relayUrlsForList = getRelayUrls();
            relays = relayUrlsForList.length ? relayUrlsForList : DEFAULT_RELAYS;
            const relayList = Array.isArray(relays) && relays.length ? relays : DEFAULT_RELAYS;
            if (!currentPublicKey || !relayList.length) return;

            // Restore NIP-04 (DM) and channel conversations from cache so UI shows immediately while relays stream
            if (await loadChatFromCache()) {
                setHeaderIdentity();
                renderConvList();
                if (selectedConversationId) renderThread();
            }

            if (!publicSubsStarted) {
                if (pool) try { pool.close(); } catch (_) {}
                pool = new SimplePool();
                startPublicSubscriptions();
            } else {
                try { if (pool) pool.close(); } catch (_) {}
                closePublicMapRelayConnections();
                pool = new SimplePool();
                startPublicSubscriptions();
            }

            const onDmEvent = async (event) => {
                if (NrBlocklist && NrBlocklist.isBlocked(event.pubkey)) return;
                const other = event.tags.find(t => t[0] === 'p')?.[1];
                const peer = other && other !== currentPublicKey ? other : event.pubkey;
                if (NrBlocklist && NrBlocklist.isBlocked(peer)) return;
                const convId = peer;
                const conv = getOrCreateConversation('dm', convId, [peer]);
                if (conv.events.some(e => e.id === event.id)) return;

                const authorPubkey = event.pubkey === currentPublicKey ? peer : event.pubkey;
                let plain = await decryptKind4(event.content, authorPubkey);
                if (plain == null) plain = '[could not decrypt]';
                eventAuthorById.set(event.id, event.pubkey);
                const dmNip = looksLikeNip04(event.content) ? 'nip4' : 'nip44';
                conv.events.push({ id: event.id, pubkey: event.pubkey, content: plain, created_at: event.created_at, raw: event, nip: dmNip });
                conv.events.sort((a, b) => a.created_at - b.created_at);
                invalidateConversationSearchIndex(conv.id);
                scheduleChatCacheWrite();
                scheduleRender('convList');
                if (selectedConversationId === convId) scheduleRender('thread');
            };
            pool.subscribe(relayList, { kinds: [4], '#p': [currentPublicKey] }, { onevent: onDmEvent });
            pool.subscribe(relayList, { kinds: [4], authors: [currentPublicKey] }, { onevent: onDmEvent });

            pool.subscribe(relayList, { kinds: [1059], '#p': [currentPublicKey] }, { onevent(wrapEvent) {
                if (!currentSecretKeyBytes) return;
                try {
                    const wrapPubkey = wrapEvent.pubkey;
                    const key = nip44.getConversationKey(currentSecretKeyBytes, wrapPubkey);
                    const innerJson = nip44.v2.decrypt(wrapEvent.content, key);
                    const seal = JSON.parse(innerJson);
                    if (seal.kind !== 13) return;
                    if (NrBlocklist && NrBlocklist.isBlocked(wrapPubkey)) return;
                    const sealKey = nip44.getConversationKey(currentSecretKeyBytes, seal.pubkey);
                    const rumorJson = nip44.v2.decrypt(seal.content, sealKey);
                    const rumor = JSON.parse(rumorJson);
                    if (rumor.kind !== 14) return;
                    if (rumor.pubkey !== seal.pubkey) return;
                    if (NrBlocklist && NrBlocklist.isBlocked(rumor.pubkey)) return;
                    const pTags = (rumor.tags || []).filter(t => t[0] === 'p').map(t => t[1]);
                    const members = [rumor.pubkey, ...pTags].filter((x, i, a) => a.indexOf(x) === i).sort();
                    const groupId = members.join(',');
                    const conv = getOrCreateConversation('group', groupId, members);
                    const existing = conv.events.some(e => e.id === rumor.id);
                    if (!existing) {
                        eventAuthorById.set(rumor.id, rumor.pubkey);
                        conv.events.push({ id: rumor.id, pubkey: rumor.pubkey, content: rumor.content || '', created_at: rumor.created_at, raw: rumor, nip: 'nip17' });
                        conv.events.sort((a, b) => a.created_at - b.created_at);
                        invalidateConversationSearchIndex(conv.id);
                        scheduleChatCacheWrite();
                        scheduleRender('convList');
                        if (selectedConversationId === groupId) scheduleRender('thread');
                    }
                } catch (_) {}
            } });
            setupChatNrWebThemeSync();
        }

        function getTrustrootsUsernameFromProfileEvent(event) {
            if (event.kind !== TRUSTROOTS_PROFILE_KIND) return undefined;
            const tag = (event.tags || []).find(t => t.length >= 3 && t[0] === 'l' && t[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE);
            return tag && tag[1] ? tag[1] : undefined;
        }

        function getTrustrootsUsernameFromKind0(event) {
            if (event.kind !== 0 || !event.content) return undefined;
            try {
                const profile = JSON.parse(event.content);
                const nip05 = (profile.nip05 || '').trim().toLowerCase();
                if (!nip05) return undefined;
                // trustroots.org or www.trustroots.org
                if (nip05.endsWith('@trustroots.org') || nip05.endsWith('@www.trustroots.org')) {
                    const local = nip05.split('@')[0];
                    return local || undefined;
                }
                return undefined;
            } catch (_) {
                return undefined;
            }
        }

        async function checkProfileLinked() {
            if (!currentPublicKey) {
                isProfileLinked = false;
                usernameFromNostr = false;
                setTrustrootsUI('');
                updateKeyDisplay({ skipProfileLookup: true });
                return;
            }
            const cachedUsername = getCachedValidatedTrustrootsUsername(currentPublicKey);
            if (cachedUsername) {
                isProfileLinked = true;
                usernameFromNostr = true;
                pubkeyToUsername.set(currentPublicKey, cachedUsername);
                setTrustrootsUI(cachedUsername);
                updateKeyDisplay({ skipProfileLookup: true });
                return;
            }
            const r = relays?.length ? relays : (getRelayUrls().length ? getRelayUrls() : DEFAULT_RELAYS);
            if (!r.length) {
                setTrustrootsUI('');
                updateKeyDisplay({ skipProfileLookup: true });
                return;
            }
            if (!pool) pool = new SimplePool();
            let linkedUsername = null;
            const done = { done: false };
            const unsub = pool.subscribe(r, { kinds: [TRUSTROOTS_PROFILE_KIND], authors: [currentPublicKey], limit: 1 }, { onevent(event) {
                if (done.done) return;
                done.done = true;
                const u = getTrustrootsUsernameFromProfileEvent(event);
                if (u) linkedUsername = u;
            } });
            await new Promise(r => setTimeout(r, 2500));
            try { if (typeof unsub === 'function') unsub(); else if (unsub?.close) unsub.close(); } catch (_) {}
            if (linkedUsername) {
                try {
                    const res = await fetch(`https://www.trustroots.org/.well-known/nostr.json?name=${encodeURIComponent(linkedUsername)}`);
                    const data = await res.json();
                    if (data.names && data.names[linkedUsername]) {
                        const nip5Hex = (data.names[linkedUsername] + '').toLowerCase();
                        if (nip5Hex !== currentPublicKey.toLowerCase()) {
                            linkedUsername = null;
                        }
                    } else {
                        linkedUsername = null;
                    }
                } catch (_) {
                    linkedUsername = null;
                }
            }
            isProfileLinked = !!linkedUsername;
            usernameFromNostr = !!linkedUsername;
            if (linkedUsername) {
                pubkeyToUsername.set(currentPublicKey, linkedUsername);
                setCachedValidatedTrustrootsUsername(currentPublicKey, linkedUsername);
            } else {
                clearCachedValidatedTrustrootsUsername(currentPublicKey);
            }
            setTrustrootsUI(linkedUsername || '');
            updateKeyDisplay({ skipProfileLookup: true });
        }

        function setTrustrootsUI(username) {
            const usernameInput = document.getElementById('trustroots-username');
            const usernameIndicator = document.getElementById('username-nostr-indicator');
            const updateBtn = document.getElementById('auth-update-trustroots-btn');
            const updateWrap = document.getElementById('auth-update-trustroots-wrap');
            if (usernameInput) {
                usernameInput.value = username;
                usernameInput.disabled = !!username;
            }
            if (usernameIndicator) usernameIndicator.style.display = username ? 'block' : 'none';
            if (updateBtn) updateBtn.style.display = username ? 'none' : 'block';
            if (updateWrap) updateWrap.style.display = username ? 'none' : 'block';
        }

        async function linkTrustrootsProfile() {
            const username = document.getElementById('trustroots-username')?.value?.trim() || '';
            if (!username) { showStatus('Please enter a username.', 'error'); return; }
            if (!currentPublicKey) { showStatus('Please connect a key first.', 'error'); return; }
            try {
                const res = await fetch(`https://www.trustroots.org/.well-known/nostr.json?name=${encodeURIComponent(username)}`);
                const data = await res.json();
                if (!data.names || !data.names[username]) {
                    showStatus('Username not found or not linked on Trustroots.', 'error');
                    return;
                }
                const nip5Hex = (data.names[username] + '').toLowerCase();
                if (nip5Hex !== currentPublicKey.toLowerCase()) {
                    showStatus('That username is linked to a different key on Trustroots.', 'error');
                    return;
                }
                const eventTemplate = {
                    kind: TRUSTROOTS_PROFILE_KIND,
                    tags: [
                        ['L', TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
                        ['l', username, TRUSTROOTS_USERNAME_LABEL_NAMESPACE]
                    ],
                    content: '',
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: currentPublicKey
                };
                const signedEvent = await signEvent(eventTemplate);
                const r = getPublishRelayUrls();
                await pool.publish(r, signedEvent);
                isProfileLinked = true;
                usernameFromNostr = true;
                setTrustrootsUI(username);
                updateKeyDisplay({ skipProfileLookup: true });
                pubkeyToUsername.set(currentPublicKey, username);
                setCachedValidatedTrustrootsUsername(currentPublicKey, username);
                scheduleChatCacheWrite();
                showStatus('Profile linked. You can now close this modal and explore the app. Make sure your nsec is safely backed up (for example in your password manager).', 'success');
            } catch (e) {
                showStatus(e?.message || 'Failed to link profile.', 'error');
            }
        }

        async function updateTrustrootsProfile() {
            if (!currentPublicKey) { showStatus('No key connected.', 'error'); return; }
            const npub = getDisplayNpub() || nip19.npubEncode(currentPublicKey);
            await navigator.clipboard.writeText(npub);
            alert('Your npub has been copied to the clipboard. Please paste it into the Nostr field on Trustroots.');
            window.open('https://www.trustroots.org/profile/edit/networks', '_blank');
        }

        function renderRelaysList() {
            const urls = getRelayUrls();
            const list = document.getElementById('relays-list');
            if (!list) return;
            renderRelayPostWarning(list, urls);
            if (relaySettings?.renderRelaysList) {
                relaySettings.renderRelaysList(list, {
                    urls,
                    statusMap: relayStatus,
                    relayWriteEnabledMap: relayWriteEnabled,
                    allowPostToggle: true,
                    allowRemove: true,
                    removeHandlerName: 'removeRelay',
                    toggleHandlerName: 'toggleRelayWriteForEncodedUrl',
                    removeButtonLabel: 'DELETE',
                    emptyMessage: 'No relays configured',
                    showLocalPrivacyHint: true
                });
                return;
            }
        }

        function addRelay() {
            let url = document.getElementById('new-relay-url')?.value?.trim() || '';
            if (!url) { showStatus('Enter a relay URL.', 'error'); return; }
            if (relaySettings?.normalizeRelayUrlInput) {
                const normalized = relaySettings.normalizeRelayUrlInput(url, 'ws');
                if (!normalized.ok) {
                    showStatus('Relay URL must start with ws:// or wss://', 'error');
                    return;
                }
                url = normalized.value;
            } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
                url = 'ws://' + url;
            }
            const urls = getRelayUrls();
            if (urls.includes(url)) { showStatus('Already added.', 'error'); return; }
            urls.push(url);
            saveRelayUrls(urls);
            relayWriteEnabled.set(url, true);
            updateRelayStatus(url, 'connecting', true);
            saveRelayWritePreferences();
            document.getElementById('new-relay-url').value = '';
            renderRelaysList();
            if (currentPublicKey) {
                relayUrlsForList = urls;
                relays = urls;
                void startSubscriptions();
            }
            showStatus('Relay added.', 'success');
        }

        function removeRelay(url) {
            const urls = getRelayUrls().filter(u => u !== url);
            saveRelayUrls(urls);
            relayWriteEnabled.delete(url);
            relayStatus.delete(url);
            saveRelayWritePreferences();
            renderRelaysList();
            if (currentPublicKey) {
                relayUrlsForList = urls;
                relays = urls.length ? urls : DEFAULT_RELAYS;
                void startSubscriptions();
            }
            showStatus('Relay removed.', 'success');
        }

        function convSortKey(c) {
            const last = c.events[c.events.length - 1];
            return last ? last.created_at : 0;
        }

        const ENC_LOCK = '🔒';
        const ENC_GLOBE = '🌐';
        const RELAY_SCOPE_AUTH = '🔐';
        const RELAY_SCOPE_PUBLIC = '🌍';

        function getRelayScopeForDisplay(eventLike, conversation) {
            if (eventLike?.relayScope === 'public' || eventLike?.relayScope === 'auth') {
                return eventLike.relayScope;
            }
            // No metadata: do not guess "public" (NIP-42-only traffic was incorrectly shown as 🌍).
            return null;
        }

        function getChannelTagsSummary(events) {
            const seen = new Set();
            const parts = [];
            for (const ev of events) {
                const raw = ev.raw || ev;
                const tags = raw.tags || [];
                for (const t of tags) {
                    if (t.length < 2) continue;
                    const key = (t[0] || '').toLowerCase();
                    const val = t[1] || '';
                    const label = t[2] || '';
                    const token = label ? `${key}:${val} (${label})` : `${key}:${val}`;
                    if (token && !seen.has(token)) {
                        seen.add(token);
                        parts.push(label || val || key);
                    }
                }
            }
            return parts.slice(0, 8).join(', ');
        }

        let _renderRafId = null;
        let _renderDirty = { convList: false, thread: false };
        function scheduleRender(what) {
            if (what === 'convList' || what === 'both') _renderDirty.convList = true;
            if (what === 'thread' || what === 'both') _renderDirty.thread = true;
            if (_renderRafId) return;
            _renderRafId = requestAnimationFrame(() => {
                _renderRafId = null;
                const d = _renderDirty;
                _renderDirty = { convList: false, thread: false };
                if (d.convList) renderConvList();
                if (d.thread) renderThread();
            });
        }

        function getConversationLabel(entry) {
            const id = String(entry.id || '');
            if (entry.type === 'channel') {
                if (id === GLOBAL_CHANNEL_SLUG) return 'Global';
                if (isTrustrootsCircleConversation(entry)) {
                    return '#' + id;
                }
                return id;
            }
            if (entry.type === 'group') return `Group (${entry.members?.length || 0})`;
            return getDisplayNameShort(id) || getDisplayName(id) || hexToNpub(id) || id;
        }

        /** Sidebar rail icon (matches thread header: globe vs lock vs channel marker). */
        function getConversationListEncIcon(entry) {
            const id = String(entry.id || '');
            const type = entry.type;
            if (type === 'dm' || type === 'group') return ENC_LOCK;
            if (type === 'channel') {
                if (id === GLOBAL_CHANNEL_SLUG) return ENC_GLOBE;
                if (isTrustrootsCircleConversation(entry)) return '∞';
                return '#';
            }
            return ENC_GLOBE;
        }

        function renderConvList() {
            const list = document.getElementById('conv-list');
            if (!list) return;
            list.innerHTML = '';
            function escConvHtml(s) {
                return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            }
            const entries = Array.from(conversations.entries())
                .map(([id, c]) => ({ id, ...c }));
            const globalEntry = entries.find(e => e.id === GLOBAL_CHANNEL_SLUG);
            const rest = entries.filter(e => e.id !== GLOBAL_CHANNEL_SLUG).sort((a, b) => convSortKey(b) - convSortKey(a));
            const ordered = globalEntry ? [globalEntry, ...rest] : rest;
            const query = normalizeSearchQuery(conversationFilterQuery);
            const filtered = query ? ordered.filter((entry) => conversationMatchesFilter(entry, query)) : ordered;
            filtered.forEach(({ id, type, members, events }) => {
                const entry = { id, type, members, events };
                const label = getConversationLabel(entry);
                const item = document.createElement('div');
                const enc = getConversationListEncIcon(entry);
                const isCircle = type === 'channel' && isTrustrootsCircleConversation(entry);
                item.className =
                    'conv-item' +
                    (selectedConversationId === id ? ' selected' : '') +
                    (isCircle ? ' conv-item-circle' : '');
                item.dataset.convId = id;
                const eLab = escConvHtml(label);
                const eGlyph = escConvHtml(enc);
                if (isCircle) {
                    const meta = circleMetaBySlug.get(normalizeCircleSlug(id)) || {};
                    const slug = id;
                    const pic = meta.picture && isSafeHttpUrl(meta.picture)
                        ? meta.picture
                        : trustrootsCirclePictureFallback(slug);
                    const about = meta.about && String(meta.about).trim();
                    const hashEsc = escConvHtml('#' + slug);
                    const line =
                        about
                            ? `${escConvHtml(about.length > 88 ? about.slice(0, 85) + '…' : about)} · ${hashEsc}`
                            : hashEsc;
                    const imgHtml = pic
                        ? `<img class="conv-item-avatar" src="${escConvHtml(pic)}" alt="" loading="lazy" decoding="async" />`
                        : '';
                    item.innerHTML =
                        '<span class="conv-item-stack">' +
                        `<span class="conv-item-title-row conv-item-circle-hashline">${line}</span>` +
                        '</span>' +
                        imgHtml;
                } else {
                    // Emoji rail (🌐 🔒) on the right; keep # as a normal hashtag prefix on the left.
                    const oneLine = enc === '#' ? eGlyph + eLab : eLab + '\u2009' + eGlyph;
                    item.innerHTML = `<span class="conv-item-label">${oneLine}</span>`;
                }
                item.onclick = () => selectConversation(id);
                list.appendChild(item);
            });

            if (!filtered.length) {
                const empty = document.createElement('div');
                empty.className = 'conv-item conv-item-empty';
                empty.innerHTML = '<span class="conv-item-label">\u2014 No matching chats</span>';
                list.appendChild(empty);
            }
        }

        function conversationMatchesFilter(entry, query) {
            if (!query) return true;
            return conversationMatchesFast(entry, query) || backgroundContentMatches.has(entry.id);
        }

        function conversationMatchesFast(entry, query) {
            const id = String(entry.id || '');
            const baseLabel = getConversationLabel(entry);
            const channelAlias = entry.type === 'channel' ? id : '';
            const tokens = [baseLabel, channelAlias, id];
            if (entry.type === 'channel' && id && id !== GLOBAL_CHANNEL_SLUG) {
                tokens.push('#' + id);
            }
            if (entry.type === 'channel' && isTrustrootsCircleConversation(entry)) {
                const meta = circleMetaBySlug.get(normalizeCircleSlug(id));
                if (meta) {
                    tokens.push(meta.name, meta.about);
                }
            }
            return tokens.some((value) => String(value || '').toLowerCase().includes(query));
        }

        function bindConversationFilterInput() {
            const filterInput = document.getElementById('conv-filter');
            if (!filterInput) return;
            filterInput.addEventListener('input', (event) => {
                conversationFilterQuery = normalizeSearchQuery(event.target?.value || '');
                backgroundContentMatches = new Set();
                scheduleRender('convList');
                scheduleBackgroundContentSearch();
            });
        }

        function syncComposeExpiryFromStorage() {
            const sel = document.getElementById('compose-expiry');
            if (!sel) return;
            let v = 604800;
            try {
                const raw = localStorage.getItem(NR_EXPIRATION_STORAGE_KEY);
                if (raw != null) {
                    const n = parseInt(raw, 10);
                    if (Number.isFinite(n) && NR_EXPIRATION_OPTION_SECONDS.includes(n)) {
                        v = n;
                    }
                }
            } catch (_) {}
            sel.value = String(v);
        }

        function wireComposeExpirySelect() {
            const sel = document.getElementById('compose-expiry');
            if (!sel || sel.dataset.nrExpiryWired === '1') return;
            sel.dataset.nrExpiryWired = '1';
            sel.addEventListener('change', () => {
                const val = sel.value;
                try {
                    if (typeof window.saveExpirationSetting === 'function') {
                        window.saveExpirationSetting(val);
                    } else {
                        localStorage.setItem(NR_EXPIRATION_STORAGE_KEY, val);
                        const noteSel = document.getElementById('note-expiration-in-modal');
                        if (noteSel) noteSel.value = val;
                    }
                } catch (_) {}
            });
        }

        function updateComposePostingIcon() {
            const iconEl = document.getElementById('compose-posting-icon');
            if (!iconEl) return;
            const conv = selectedConversationId ? conversations.get(selectedConversationId) : null;
            if (!conv) {
                iconEl.textContent = '';
                iconEl.title = 'No conversation selected';
                iconEl.style.display = 'none';
                return;
            }

            iconEl.style.display = 'inline-flex';
            const isEncrypted = conv.type === 'dm' || conv.type === 'group';
            if (isEncrypted) {
                iconEl.textContent = '🔒';
                iconEl.title = 'Encrypted PM/group message';
                return;
            }

            const relayScope = getRelayScopeFromRelayUrls(getWritableRelayUrls());
            if (relayScope === 'public') {
                iconEl.textContent = '🌍';
                iconEl.title = 'Posting to channel on public relay(s)';
            } else {
                iconEl.textContent = '🔐';
                iconEl.title = 'Posting to channel on auth-required relay(s)';
            }
        }

        function syncThreadHeaderForConversation(conv) {
            const headerEl = document.getElementById('thread-header');
            const titleEl = document.getElementById('thread-title');
            const avatarEl = document.getElementById('thread-circle-avatar');
            const heroEl = document.getElementById('thread-chat-image');
            const subEl = document.getElementById('thread-circle-subtitle');
            const linkEl = document.getElementById('thread-circle-link');
            const stackEl = document.getElementById('thread-header-circle-stack');
            if (!titleEl) return;

            const resetCircleChrome = () => {
                if (stackEl) stackEl.style.display = 'none';
                if (avatarEl) {
                    avatarEl.removeAttribute('src');
                    avatarEl.style.display = 'none';
                }
                if (heroEl) {
                    heroEl.removeAttribute('src');
                    heroEl.style.display = 'none';
                }
                if (headerEl) headerEl.classList.remove('thread-header-has-image');
                if (subEl) {
                    subEl.textContent = '';
                    subEl.style.display = 'none';
                }
                if (linkEl) {
                    linkEl.style.display = 'none';
                    linkEl.removeAttribute('href');
                }
            };

            if (!conv) {
                resetCircleChrome();
                return;
            }

            if (conv.type === 'dm' || conv.type === 'group') {
                resetCircleChrome();
                if (conv.type === 'dm') {
                    const pic = pubkeyToPicture.get(conv.id);
                    if (pic && isSafeHttpUrl(pic)) {
                        setImageWithFallback(heroEl, pic, '');
                        if (headerEl) headerEl.classList.add('thread-header-has-image');
                    }
                }
                if (conv.type === 'group') {
                    titleEl.textContent = `Group (${conv.members.length})`;
                } else {
                    const profileId = getDisplayName(conv.id) || hexToNpub(conv.id) || conv.id;
                    const label = profileId.includes('@') ? profileId : (getDisplayNameShort(conv.id) || profileId);
                    setThreadTitleAsProfileLink(titleEl, profileId, label);
                }
                return;
            }

            if (conv.type === 'channel') {
                if (conv.id === GLOBAL_CHANNEL_SLUG) {
                    resetCircleChrome();
                    titleEl.textContent = 'Global';
                    return;
                }
                if (isTrustrootsCircleConversation(conv)) {
                    const slug = conv.id;
                    const slugKey = normalizeCircleSlug(slug);
                    const meta = circleMetaBySlug.get(slugKey) || {};
                    const circlePicture = meta.picture && isSafeHttpUrl(meta.picture)
                        ? meta.picture
                        : trustrootsCirclePictureFallback(slugKey);
                    const hash = '#' + slug;
                    titleEl.textContent = hash;
                    const about = meta.about && String(meta.about).trim();
                    const showTrustrootsLink = hasPublishedTrustrootsCircle(slug);
                    if (stackEl) stackEl.style.display = about || showTrustrootsLink ? 'flex' : 'none';
                    if (circlePicture) {
                        if (heroEl) {
                            setImageWithFallback(heroEl, circlePicture, '');
                        }
                        if (headerEl) headerEl.classList.add('thread-header-has-image');
                    } else {
                        if (heroEl) {
                            heroEl.removeAttribute('src');
                            heroEl.style.display = 'none';
                        }
                        if (headerEl) headerEl.classList.remove('thread-header-has-image');
                    }
                    if (avatarEl) {
                        avatarEl.removeAttribute('src');
                        avatarEl.style.display = 'none';
                    }
                    if (subEl) {
                        if (about) {
                            subEl.textContent = about.length > 160 ? about.slice(0, 157) + '…' : about;
                            subEl.style.display = 'block';
                        } else {
                            subEl.textContent = '';
                            subEl.style.display = 'none';
                        }
                    }
                    if (linkEl) {
                        if (showTrustrootsLink) {
                            linkEl.href = `https://www.trustroots.org/circles/${encodeURIComponent(slugKey)}`;
                            linkEl.style.display = 'inline';
                        } else {
                            linkEl.removeAttribute('href');
                            linkEl.style.display = 'none';
                        }
                    }
                    return;
                }
                resetCircleChrome();
                titleEl.textContent = '#' + conv.id;
            }
        }

        function selectConversation(id) {
            selectedConversationId = id;
            setHashRoute(getConversationRouteId(id));
            const keysEl = document.getElementById('keys-modal');
            const settingsEl = document.getElementById('settings-modal');
            if (keysEl) keysEl.classList.remove('active');
            if (settingsEl) settingsEl.classList.remove('active');
            const conv = conversations.get(id);
            if (conv) {
                writePersistedSelectedChatId(String(id));
            } else {
                writePersistedSelectedChatId('');
            }
            document.body.classList.toggle('chat-open', !!conv);
            const list = document.getElementById('conv-list');
            if (list) list.querySelectorAll('.conv-item').forEach(el => el.classList.toggle('selected', el.dataset.convId === id));
            document.getElementById('empty-state').style.display = conv ? 'none' : 'flex';
            document.getElementById('compose').style.display = conv ? 'flex' : 'none';
            const opts = document.getElementById('compose-note-duration');
            if (opts) opts.style.display = conv?.type === 'channel' ? 'flex' : 'none';
            if (conv?.type === 'channel') {
                syncComposeExpiryFromStorage();
            }
            updateComposePostingIcon();
            document.getElementById('thread-header').style.display = conv ? 'flex' : 'none';
            if (conv) {
                const isEnc = conv.type === 'dm' || conv.type === 'group';
                document.getElementById('thread-enc-icon').textContent = isEnc ? ENC_LOCK : ENC_GLOBE;
                document.getElementById('thread-enc-icon').title = isEnc ? 'Encrypted' : 'Unencrypted (public)';
                document.getElementById('thread-enc-label').textContent = isEnc ? 'Encrypted' : 'Unencrypted';
                syncThreadHeaderForConversation(conv);
                if (conv._pendingEncrypted?.length) decryptPendingForConversation(conv);
            }
            const container = document.getElementById('thread-messages');
            if (container) container.innerHTML = '';
            // Defer heavy DOM work so the browser can paint the selection and header first
            requestAnimationFrame(() => {
                renderConvList();
                renderThread();
                if (conv) {
                    const input = document.getElementById('compose-input');
                    if (input) input.focus();
                }
            });
        }

        function goBackToList() {
            document.body.classList.remove('chat-open');
        }

        function showThreadEmpty() {
            document.body.classList.remove('chat-open');
            document.getElementById('empty-state').style.display = 'flex';
            document.getElementById('compose').style.display = 'none';
            document.getElementById('thread-header').style.display = 'none';
            document.getElementById('thread-messages').innerHTML = '';
        }

        function getPluscodeFromEvent(raw) {
            if (!raw?.tags) return null;
            const tag = raw.tags.find(t => Array.isArray(t) && t.length >= 3 && t[0] === 'l' && t[2] === 'open-location-code');
            const code = tag?.[1];
            return (code && typeof code === 'string' && code.trim()) ? code.trim() : null;
        }

        function getFirstTagValue(raw, tagName) {
            if (!raw?.tags) return '';
            const tag = raw.tags.find(t => Array.isArray(t) && t[0] === tagName && t[1]);
            return tag?.[1] || '';
        }

        function getMapNoteCanonicalKey(raw) {
            if (!raw || (raw.kind !== MAP_NOTE_KIND && raw.kind !== MAP_NOTE_REPOST_KIND)) {
                return raw?.id ? `id:${raw.id}` : '';
            }

            if (raw.kind === MAP_NOTE_REPOST_KIND) {
                const originalEventId = getFirstTagValue(raw, 'e');
                if (originalEventId) return `origin:${originalEventId}`;
            }

            const canonicalPubkey = raw.kind === MAP_NOTE_REPOST_KIND
                ? (getFirstTagValue(raw, 'p') || raw.pubkey || '')
                : (raw.pubkey || '');
            const originalCreatedAt = raw.kind === MAP_NOTE_REPOST_KIND
                ? Number.parseInt(getFirstTagValue(raw, 'original_created_at'), 10) || (raw.created_at || 0)
                : (raw.created_at || 0);
            const plusCode = getPluscodeFromEvent(raw) || '';
            const content = (raw.content || '').trim();
            return `canonical:${canonicalPubkey}|${originalCreatedAt}|${plusCode}|${content}`;
        }

        function isBlockedPubkey(pubkey) {
            if (!pubkey || !NrBlocklist || typeof NrBlocklist.isBlocked !== 'function') return false;
            if (NrBlocklist.isBlocked(pubkey)) return true;
            if (typeof pubkey === 'string' && pubkey.startsWith('npub1') && nip19 && typeof nip19.decode === 'function') {
                try {
                    const decoded = nip19.decode(pubkey);
                    if (decoded && decoded.type === 'npub' && decoded.data) {
                        return NrBlocklist.isBlocked(decoded.data);
                    }
                } catch (_) {}
            }
            return false;
        }

        function getChannelSlugFromEvent(raw) {
            if (!raw?.tags) return null;
            const circleTag = raw.tags.find(t => Array.isArray(t) && t.length >= 3 && (t[0] === 'l' || t[0] === 'L') && t[2] === TRUSTROOTS_CIRCLE_LABEL);
            const circleSlug = (circleTag?.[1] || '').trim();
            if (/^[a-zA-Z0-9_-]+$/.test(circleSlug)) return normalizeChannelSlug(circleSlug);

            const circleHashtagTag = raw.tags.find(t =>
                Array.isArray(t) &&
                t.length >= 2 &&
                (t[0] === 't' || t[0] === 'T') &&
                typeof t[1] === 'string' &&
                !HOSTING_OFFER_CHANNEL_ALIASES.includes(t[1].trim().toLowerCase()) &&
                /^[a-zA-Z0-9_-]+$/.test(t[1].trim())
            );
            if (circleHashtagTag) {
                return normalizeChannelSlug(circleHashtagTag[1].trim().toLowerCase());
            }

            const hashtagTag = raw.tags.find(t =>
                Array.isArray(t) &&
                t.length >= 2 &&
                (t[0] === 't' || t[0] === 'T') &&
                typeof t[1] === 'string' &&
                HOSTING_OFFER_CHANNEL_ALIASES.includes(t[1].trim().toLowerCase())
            );
            if (hashtagTag) return HOSTING_OFFER_CHANNEL_SLUG;

            if (typeof raw.content === 'string') {
                const match = raw.content.match(/#([a-zA-Z0-9_-]+)/g) || [];
                for (const token of match) {
                    const slug = token.slice(1).toLowerCase();
                    if (HOSTING_OFFER_CHANNEL_ALIASES.includes(slug)) {
                        return HOSTING_OFFER_CHANNEL_SLUG;
                    }
                }
            }
            return null;
        }

        function getChannelSlugsFromEvent(raw) {
            const slugs = new Set([GLOBAL_CHANNEL_SLUG]);
            const primarySlug = getChannelSlugFromEvent(raw);
            if (primarySlug) {
                slugs.add(normalizeChannelSlug(primarySlug));
            }

            if (raw?.tags) {
                (raw.tags || []).forEach((tag) => {
                    if (!Array.isArray(tag) || tag.length < 2) return;
                    if (tag[0] !== 't' && tag[0] !== 'T') return;
                    const normalizedTag = normalizeChannelSlug((tag[1] || '').trim());
                    if (/^[a-zA-Z0-9_-]+$/.test(normalizedTag)) {
                        slugs.add(normalizedTag);
                    }
                });
            }
            return Array.from(slugs);
        }

        function renderThread() {
            const conv = conversations.get(selectedConversationId);
            const container = document.getElementById('thread-messages');
            if (!conv || !container) return;
            container.innerHTML = '';
            const isChannel = conv.type === 'channel';
            const isGlobalChannel = isChannel && conv.id === GLOBAL_CHANNEL_SLUG;
            let eventsToShow = conv.events.filter(ev => !deletedEventIds.has(ev.id) && !isBlockedPubkey(ev.pubkey));
            if (isChannel) {
                const deduped = new Map();
                eventsToShow.forEach((ev) => {
                    const raw = ev.raw || {};
                    let eventKind = raw.kind || ev.kind;
                    const rawTags = Array.isArray(raw.tags) ? raw.tags : [];
                    if (!eventKind && rawTags.length) {
                        const hasOriginalCreatedAt = rawTags.some(t => Array.isArray(t) && t[0] === 'original_created_at' && t[1]);
                        const hasETag = rawTags.some(t => Array.isArray(t) && t[0] === 'e' && t[1]);
                        const hasPTag = rawTags.some(t => Array.isArray(t) && t[0] === 'p' && t[1]);
                        const hasPlusCode = rawTags.some(t => Array.isArray(t) && t[0] === 'l' && t[2] === 'open-location-code');
                        if (hasOriginalCreatedAt && hasETag && hasPTag) eventKind = MAP_NOTE_REPOST_KIND;
                        else if (hasPlusCode) eventKind = MAP_NOTE_KIND;
                    }
                    const eventLike = {
                        id: raw.id || ev.id,
                        kind: eventKind,
                        pubkey: raw.pubkey || ev.pubkey,
                        content: raw.content || ev.content || '',
                        created_at: raw.created_at || ev.created_at || 0,
                        tags: rawTags
                    };
                    const canonicalKey = ev.mapNoteKey || getMapNoteCanonicalKey(eventLike) || '';
                    const plusCode = getPluscodeFromEvent(eventLike) || '';
                    const contentNormalized = (eventLike.content || '').trim();
                    const createdAtMinute = Math.floor((eventLike.created_at || 0) / 60);
                    const similarityKey = (eventKind === MAP_NOTE_KIND || eventKind === MAP_NOTE_REPOST_KIND)
                        ? `similar:${createdAtMinute}|${plusCode}|${contentNormalized}`
                        : '';
                    const key = similarityKey || canonicalKey || `id:${ev.id}`;
                    const hasUsername = !!pubkeyToUsername.get(ev.pubkey);
                    const nip05 = (pubkeyToNip05.get(ev.pubkey) || '').toLowerCase();
                    const hasTrustrootsIdentity = hasUsername || nip05.endsWith('@trustroots.org');
                    const isServerIdentity = nip05 === 'nostroots@trustroots.org' || ((pubkeyToUsername.get(ev.pubkey) || '').toLowerCase() === 'nostroots');
                    const score = (eventKind === MAP_NOTE_KIND ? 20 : 0)
                        + (hasTrustrootsIdentity ? 10 : 0)
                        + (isServerIdentity ? -20 : 0)
                        + (eventKind === MAP_NOTE_REPOST_KIND ? -1 : 0);
                    const existing = deduped.get(key);
                    if (!existing || score > existing.score) {
                        deduped.set(key, { ev, score });
                    }
                });
                eventsToShow = Array.from(deduped.values())
                    .map(entry => entry.ev)
                    .sort((a, b) => a.created_at - b.created_at);
            }
            eventsToShow.forEach(ev => {
                const isSelf = ev.pubkey === currentPublicKey;
                const row = document.createElement('div');
                row.className = 'message-row' + (isSelf ? ' self' : '');
                const wrap = document.createElement('div');
                wrap.className = 'message-wrap ' + (isSelf ? 'self' : 'other');
                if (isChannel && !isSelf) {
                    const author = document.createElement('div');
                    author.className = 'message-author';
                    author.innerHTML = renderPubkeyLabelHtml(ev.pubkey);
                    const fullNpub = hexToNpub(ev.pubkey);
                    if (fullNpub) author.title = fullNpub;
                    wrap.appendChild(author);
                }
                const div = document.createElement('div');
                div.className = 'message ' + (isSelf ? 'self' : 'other');
                div.innerHTML = linkifyTrustrootsUrls(
                    linkifyNpubsWithTrustrootsProfiles(linkifyNip05Identifiers(escapeHtml(ev.content || '')))
                );
                const pluscode = getPluscodeFromEvent(ev.raw);
                if (pluscode) {
                    const pluscodeEl = document.createElement('div');
                    pluscodeEl.className = 'message-pluscode';
                    const link = document.createElement('a');
                    link.className = 'nr-content-link';
                    link.href = '#' + encodeURIComponent(pluscode).replace(/%2B/g, '+');
                    link.title = 'View on map';
                    link.textContent = '\u2316 ' + pluscode;
                    pluscodeEl.appendChild(link);
                    div.appendChild(pluscodeEl);
                }
                const channelSlug = isGlobalChannel ? getChannelSlugFromEvent(ev.raw) : null;
                if (channelSlug && channelSlug !== GLOBAL_CHANNEL_SLUG) {
                    const channelEl = document.createElement('div');
                    channelEl.className = 'message-channel-tag';
                    const channelLink = document.createElement('a');
                    channelLink.className = 'nr-content-link';
                    channelLink.href = '#'+ encodeURIComponent(channelSlug);
                    channelLink.title = `Open #${channelSlug}`;
                    channelLink.textContent = `#${channelSlug}`;
                    channelEl.appendChild(channelLink);
                    div.appendChild(channelEl);
                }
                const meta = document.createElement('div');
                meta.className = 'meta';
                const messageDate = new Date(ev.created_at * 1000);
                const year = messageDate.getFullYear();
                const month = String(messageDate.getMonth() + 1).padStart(2, '0');
                const day = String(messageDate.getDate()).padStart(2, '0');
                const hour = String(messageDate.getHours()).padStart(2, '0');
                const minute = String(messageDate.getMinutes()).padStart(2, '0');
                const timeStr = `${year}-${month}-${day} ${hour}:${minute}`;
                const metaMain = document.createElement('span');
                metaMain.className = 'message-meta-main';
                metaMain.innerHTML = `<span class="time">${timeStr}</span>`;
                meta.appendChild(metaMain);
                const confidentialityPill = document.createElement('span');
                confidentialityPill.className = 'message-privacy-pill';
                const isEncryptedConversation = conv.type === 'dm' || conv.type === 'group';
                if (isEncryptedConversation) {
                    confidentialityPill.textContent = ENC_LOCK;
                    confidentialityPill.title = 'Encrypted message content (independent of relay type)';
                    metaMain.appendChild(confidentialityPill);
                }
                const relayScopeForDisplay = getRelayScopeForDisplay(ev, conv);
                /* Channels: show public vs auth relay scope when we know it. DMs/groups: lock already signals encryption — omit relay globe to reduce noise. */
                if (!isEncryptedConversation && (relayScopeForDisplay === 'public' || relayScopeForDisplay === 'auth')) {
                    const relayPill = document.createElement('span');
                    relayPill.className = 'message-relay-pill';
                    relayPill.textContent = relayScopeForDisplay === 'auth' ? RELAY_SCOPE_AUTH : RELAY_SCOPE_PUBLIC;
                    relayPill.title = relayScopeForDisplay === 'auth'
                        ? 'Posted only to auth-required relay(s)'
                        : 'Posted to public relay(s)';
                    metaMain.appendChild(relayPill);
                }
                if ((conv.type === 'dm' || conv.type === 'group') && ev.nip) {
                    const pill = document.createElement('span');
                    pill.className = 'message-nip-pill';
                    pill.textContent = ev.nip;
                    meta.appendChild(pill);
                }
                div.appendChild(meta);
                wrap.appendChild(div);
                row.appendChild(wrap);
                if (isSelf) {
                    const delBtn = document.createElement('button');
                    delBtn.type = 'button';
                    delBtn.className = 'message-delete';
                    delBtn.title = 'Delete message (NIP-09)';
                    delBtn.setAttribute('aria-label', 'Delete message');
                    delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
                    delBtn.onclick = (e) => { e.preventDefault(); openDeleteConfirmModal(ev.id); };
                    row.appendChild(delBtn);
                }
                container.appendChild(row);
            });
            container.scrollTop = container.scrollHeight;
        }

        function parseHashtagChannelSlug(raw) {
            const s = (raw || '').trim();
            const m = s.match(/^#([a-zA-Z0-9_-]+)$/);
            return m ? normalizeChannelSlug(m[1]) : null;
        }

        function escapeHtml(text) {
            if (text == null) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function linkifyTrustrootsUrls(html) {
            return html.replace(
                /https:\/\/(?:www\.)?trustroots\.org\/[^\s<)]+/gi,
                (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-inline-link nr-content-link">${url}</a>`
            );
        }

        function linkifyNip05Identifiers(html) {
            return html.replace(
                /(^|[^a-z0-9_@.-])([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})(?=$|[^a-z0-9_@.-])/gi,
                (match, prefix, nip05) => {
                    const normalized = String(nip05 || '').trim().toLowerCase();
                    if (!normalized) return match;
                    const href = '#profile/' + encodeURIComponent(normalized).replace(/%2B/g, '+');
                    return `${prefix}<a href="${href}" class="message-inline-link nr-content-link">${nip05}</a>`;
                }
            );
        }

        /** Replace npub1… with Trustroots NIP-05 + #profile when known (run after escapeHtml, before NIP-05 linkify). */
        function linkifyNpubsWithTrustrootsProfiles(html) {
            if (!html) return html || '';
            return html.replace(/\bnpub1[023456789acdefghjkmnpqrstuvwxyz]{20,}\b/gi, (npubStr) => {
                let hex = '';
                try {
                    const d = nip19.decode(npubStr);
                    if (d.type !== 'npub') return npubStr;
                    hex = Array.from(d.data)
                        .map((b) => b.toString(16).padStart(2, '0'))
                        .join('')
                        .toLowerCase();
                } catch (_) {
                    return npubStr;
                }
                let nip05 = (pubkeyToNip05.get(hex) || '').trim().toLowerCase();
                if (!isTrustrootsNip05Lower(nip05)) nip05 = '';
                if (!nip05) {
                    const u = pubkeyToUsername.get(hex);
                    if (u) nip05 = `${String(u).trim().toLowerCase()}@trustroots.org`;
                }
                if (!nip05 || !isTrustrootsNip05Lower(nip05)) return npubStr;
                const href = '#profile/' + encodeURIComponent(nip05).replace(/%2B/g, '+');
                return `<a href="${href}" class="message-inline-link nr-content-link" title="${escapeHtml(npubStr)}">${escapeHtml(nip05)}</a>`;
            });
        }

        function renderPubkeyLabelHtml(hex) {
            const label = escapeHtml(pubkeyDisplayLabel(hex));
            if (!label) return '';
            if (!label.includes('@')) return label;
            const route = encodeURIComponent(label.toLowerCase()).replace(/%2B/g, '+');
            return `<a href="#profile/${route}" class="nr-content-link">${label}</a>`;
        }

        async function startDm() {
            const raw = document.getElementById('new-dm-pubkey')?.value?.trim() || '';
            const hashtagSlug = parseHashtagChannelSlug(raw);
            if (hashtagSlug) {
                getOrCreateConversation('channel', hashtagSlug, []);
                closeNewDmModal();
                document.getElementById('new-dm-pubkey').value = '';
                setHashRoute(hashtagSlug);
                selectConversation(hashtagSlug);
                return;
            }
            const peer = await resolvePubkeyInput(raw);
            if (!peer) {
                showStatus('Invalid npub, nip5 or hashtag (e.g. nostroots@trustroots.org).', 'error');
                return;
            }
            if (peer === currentPublicKey) {
                showStatus('Cannot message yourself.', 'error');
                return;
            }
            if (NrBlocklist && NrBlocklist.isBlocked(peer)) {
                showStatus('This user is blocked.', 'error');
                return;
            }
            getOrCreateConversation('dm', peer, [peer]);
            closeNewDmModal();
            document.getElementById('new-dm-pubkey').value = '';
            selectConversation(peer);
        }

        function startGroup() {
            const members = [currentPublicKey, ...groupModalMembers.map(m => m.hex)];
            members.sort();
            const groupId = members.join(',');
            getOrCreateConversation('group', groupId, members);
            closeNewGroupModal();
            groupModalMembers = [];
            selectConversation(groupId);
        }

        async function signEvent(template) {
            requireLocalSigningKey();
            const eventToSign = template.pubkey ? template : { ...template, pubkey: currentPublicKey };
            return finalizeEvent(eventToSign, currentSecretKeyBytes);
        }

        /** Returns Unix timestamp (seconds) for note expiration, or null for permanent. NIP-40. */
        function getComposeExpiration() {
            const sel = document.getElementById('compose-expiry');
            const val = sel?.value;
            if (!val) return null;
            const sec = parseInt(val, 10);
            if (!Number.isFinite(sec) || sec <= 0) return null;
            return Math.floor(Date.now() / 1000) + sec;
        }

        async function sendMessage() {
            const input = document.getElementById('compose-input');
            const text = (input?.value || '').trim();
            if (!text) return;
            const conv = selectedConversationId ? conversations.get(selectedConversationId) : null;
            if (!conv) return;
            const publishRelayUrls = getWritableRelayUrls();
            if (publishRelayUrls.length === 0) {
                showStatus('No relays enabled for posting. Enable "Post" for at least one relay. Opening Settings…', 'error');
                alert('At least one relay must have "Post" enabled before you can send a message.');
                openSettingsModal();
                return;
            }

            if (conv.type === 'dm') {
                const peer = conv.id;
                const result = await encryptKind4(peer, text);
                if (!result) {
                    showStatus('Cannot encrypt: no secret key. Please import or generate a key.', 'error');
                    return;
                }
                const template = {
                    kind: 4,
                    content: result.cipher,
                    tags: [['p', peer]],
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: currentPublicKey
                };
                template.id = getEventHash(template);
                signEvent(template).then((signed) => {
                    pool.publish(publishRelayUrls, signed);
                    eventAuthorById.set(signed.id, currentPublicKey);
                    conv.events.push({
                        id: signed.id,
                        pubkey: currentPublicKey,
                        content: text,
                        created_at: template.created_at,
                        raw: signed,
                        nip: result.nip,
                        relayScope: null
                    });
                    conv.events.sort((a, b) => a.created_at - b.created_at);
                    invalidateConversationSearchIndex(conv.id);
                    scheduleChatCacheWrite();
                    input.value = '';
                    renderThread();
                    showStatus('Sent.', 'success');
                }).catch((e) => {
                    const fb = formatSendCatchError(e);
                    showStatus(fb.message, 'error', { actions: fb.actions });
                });
                return;
            }

            if (conv.type === 'group') {
                const rumor = {
                    kind: 14,
                    content: text,
                    tags: conv.members.filter(m => m !== currentPublicKey).map(m => ['p', m]),
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: currentPublicKey
                };
                rumor.id = getEventHash(rumor);
                const membersToSend = conv.members;
                (async () => {
                    for (const memberPubkey of membersToSend) {
                        try {
                            const sealContent = nip44.v2.encrypt(JSON.stringify(rumor), nip44.getConversationKey(currentSecretKeyBytes, memberPubkey));
                            const seal = await signEvent({
                                kind: 13,
                                content: sealContent,
                                tags: [],
                                created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400),
                                pubkey: currentPublicKey
                            });
                            const ephem = generateSecretKey();
                            const wrapContent = nip44.v2.encrypt(JSON.stringify(seal), nip44.getConversationKey(ephem, memberPubkey));
                            const wrap = finalizeEvent({
                                kind: 1059,
                                content: wrapContent,
                                tags: [['p', memberPubkey]],
                                created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400),
                                pubkey: getPublicKey(ephem)
                            }, ephem);
                            pool.publish(publishRelayUrls, wrap);
                        } catch (_) {}
                    }
                    eventAuthorById.set(rumor.id, currentPublicKey);
                    conv.events.push({
                        id: rumor.id,
                        pubkey: currentPublicKey,
                        content: text,
                        created_at: rumor.created_at,
                        raw: rumor,
                        nip: 'nip17',
                        relayScope: getRelayScopeFromRelayUrls(publishRelayUrls)
                    });
                    conv.events.sort((a, b) => a.created_at - b.created_at);
                    invalidateConversationSearchIndex(conv.id);
                    scheduleChatCacheWrite();
                    document.getElementById('compose-input').value = '';
                    renderThread();
                    showStatus('Sent to group.', 'success');
                })();
                return;
            }

            if (conv.type === 'channel') {
                const slug = conv.id;
                const exp = getComposeExpiration();
                const tags = [
                    ['L', TRUSTROOTS_CIRCLE_LABEL],
                    ['l', slug, TRUSTROOTS_CIRCLE_LABEL]
                ];
                if (exp) tags.push(['expiration', String(exp)]);
                const template = {
                    kind: MAP_NOTE_KIND,
                    content: text,
                    tags,
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: currentPublicKey
                };
                template.id = getEventHash(template);
                signEvent(template).then(async (signed) => {
                    const { succeeded, failed } = await publishEventWithRelayAcks(publishRelayUrls, signed);
                    if (succeeded.length === 0) {
                        const fb = relayPublishFailureUserFeedback(failed, 'send');
                        showStatus(fb.message, 'error', { actions: fb.actions });
                        return;
                    }
                    eventAuthorById.set(signed.id, currentPublicKey);
                    conv.events.push({
                        id: signed.id,
                        pubkey: currentPublicKey,
                        content: text,
                        created_at: template.created_at,
                        raw: signed,
                        relayScope: getRelayScopeFromRelayUrls(succeeded.map((r) => r.url))
                    });
                    conv.events.sort((a, b) => a.created_at - b.created_at);
                    invalidateConversationSearchIndex(conv.id);
                    scheduleChatCacheWrite();
                    document.getElementById('compose-input').value = '';
                    renderThread();
                    if (failed.length > 0) {
                        showStatus(`Sent to channel on ${succeeded.length}/${publishRelayUrls.length} relays.`, 'success');
                    } else {
                        showStatus('Sent to channel.', 'success');
                    }
                }).catch((e) => {
                    const fb = formatSendCatchError(e);
                    showStatus(fb.message, 'error', { actions: fb.actions });
                });
            }
        }

        function openDeleteConfirmModal(eventId) {
            pendingDeleteEventId = eventId;
            document.getElementById('delete-confirm-modal').classList.add('active');
        }
        function closeDeleteConfirmModal() {
            pendingDeleteEventId = null;
            document.getElementById('delete-confirm-modal').classList.remove('active');
        }
        function confirmDeleteMessage() {
            if (pendingDeleteEventId) {
                deleteMessage(pendingDeleteEventId);
                closeDeleteConfirmModal();
            }
        }
        function deleteMessage(eventId) {
            if (eventAuthorById.get(eventId) !== currentPublicKey) return;
            const template = {
                kind: 5,
                content: '',
                tags: [['e', eventId]],
                created_at: Math.floor(Date.now() / 1000),
                pubkey: currentPublicKey
            };
            signEvent(template).then(async (signed) => {
                const relayUrls = getPublishRelayUrls();
                const { succeeded, failed } = await publishEventWithRelayAcks(relayUrls, signed);
                if (succeeded.length === 0) {
                    const fb = relayPublishFailureUserFeedback(failed, 'delete');
                    showStatus(fb.message, 'error', { actions: fb.actions });
                    return;
                }
                deletedEventIds.add(eventId);
                scheduleChatCacheWrite();
                renderConvList();
                renderThread();
                if (failed.length > 0) {
                    showStatus(`Delete requested on ${succeeded.length}/${relayUrls.length} relays.`, 'success');
                } else {
                    showStatus('Delete requested.', 'success');
                }
            }).catch((e) => {
                const raw = (e && e.message) || e || '';
                const str = typeof raw === 'string' ? raw : String(raw);
                if (isTrustrootsProfileMissingRelayError(str)) {
                    const fb = relayPublishFailureUserFeedback([{ error: str }], 'delete');
                    showStatus(fb.message, 'error', { actions: fb.actions });
                } else {
                    const short = str.length > 200 ? str.slice(0, 197) + '…' : str;
                    showStatus(`Delete failed: ${short}`, 'error');
                }
            });
        }

        // Expose shared modal handlers when embedded (see bootEmbeddedChat); avoids clobbering index before chat loads.
        function attachHeaderButtons() {
            const header = document.getElementById('app-header');
            if (!header) return;
            header.addEventListener('click', function (e) {
                if (e.target.closest('#keys-icon-btn') || e.target.closest('#keys-icon-btn-mobile')) {
                    e.preventDefault();
                    openKeysModal();
                } else if (e.target.closest('#settings-icon-btn') || e.target.closest('#settings-icon-btn-mobile')) {
                    e.preventDefault();
                    openSettingsModal();
                }
            });
        }

export function bootEmbeddedChat() {
    if (typeof window !== 'undefined') {
        window.NrWebChatEmbedded = true;
    }
    window.importKey = importKey;
    window.openKeysModal = openKeysModal;
    window.closeKeysModal = closeKeysModal;
    window.onboardingImport = onboardingImport;
    window.onboardingGenerate = onboardingGenerate;
    window.exportNsec = exportNsec;
    window.deleteNsec = deleteNsec;
    window.importNsec = importNsec;
    window.generateKeyPair = generateKeyPair;
    window.openSettingsModal = openSettingsModal;
    window.closeSettingsModal = closeSettingsModal;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachHeaderButtons);
    } else {
        attachHeaderButtons();
    }
    bindConversationFilterInput();
    syncComposeExpiryFromStorage();
    wireComposeExpirySelect();
    document.getElementById('thread-back-btn')?.addEventListener('click', goBackToList);
    window.addRelay = addRelay;
    window.removeRelay = removeRelay;
    window.setRelayWriteEnabled = setRelayWriteEnabled;
    window.toggleRelayWriteForEncodedUrl = toggleRelayWriteForEncodedUrl;
    window.openNewDmModal = openNewDmModal;
    window.closeNewDmModal = closeNewDmModal;
    window.openNewGroupModal = openNewGroupModal;
    window.closeNewGroupModal = closeNewGroupModal;
    window.addGroupParticipant = addGroupParticipant;
    window.startDm = startDm;
    window.startGroup = startGroup;
    window.sendMessage = sendMessage;
    window.disconnect = disconnect;
    window.linkTrustrootsProfile = linkTrustrootsProfile;
    window.updateTrustrootsProfile = updateTrustrootsProfile;
    window.copyPublicKey = copyPublicKey;
    window.openDeleteConfirmModal = openDeleteConfirmModal;
    window.closeDeleteConfirmModal = closeDeleteConfirmModal;
    window.confirmDeleteMessage = confirmDeleteMessage;

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' && e.keyCode !== 27) return;
        const active = document.querySelector('.modal.active');
        if (!active) return;
        e.preventDefault();
        if (active.id === 'keys-modal') closeKeysModal();
        else if (active.id === 'settings-modal') closeSettingsModal();
        else if (active.id === 'new-dm-modal') closeNewDmModal();
        else if (active.id === 'new-group-modal') closeNewGroupModal();
        else if (active.id === 'delete-confirm-modal') closeDeleteConfirmModal();
    }, true);

    void (async () => {
        const ok = await loadKeysFromStorage();
        if (!ok) {
            updateUI();
            startPublicSubscriptions();
        }
    })();
}

/**
 * Apply conversation route when embedded in index.html (keys/settings handled by parent).
 * @param {string} route - decoded hash fragment (channel slug, npub, nip-05, etc.)
 * @param {{ emptyPicker?: boolean }} [opts]
 */
export function applyEmbeddedChatRoute(route, opts) {
    applyChatHashToState(typeof route === 'string' ? route : '', opts || {});
}

