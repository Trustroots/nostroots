(function () {
  const SERVICE_ADVERT_KIND = 31388;
  const NIP98_KIND = 27235;
  const NIP42_KIND = 22242;
  const TRUSTROOTS_PROFILE_KIND = 10390;
  const TRUSTROOTS_PROFILE_CLAIM_KIND = 30390;
  const TRUSTROOTS_USERNAME_LABEL_NAMESPACE = 'org.trustroots:username';
  const DEFAULT_RELAYS = ['wss://relay.guaka.org', 'wss://nip42.trustroots.org'];
  const WRAPSTER_PROXY_ENDPOINT = 'https://relay.guaka.org/proxy';
  const SERVICE_ADVERT_CACHE_KEY = 'wikistr:service-adverts:v1';
  const SERVICE_ADVERT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_HARDCODED_WIKIS = [
    {
      slug: 'nomadwiki',
      title: 'Nomadwiki',
      summary: 'Travel wiki.',
      wikiOrigin: 'https://nomadwiki.org',
      proxyRoute: 'nomadwiki.org',
      wikiPath: '/wiki',
      wikiApiPath: '/api.php',
      wikiLoadPath: '/index.php',
      wikiMainPagePath: '/wiki/en/Main_Page',
      wikiMainPageTitle: 'Main_Page'
    },
    {
      slug: 'hitchwiki',
      title: 'Hitchwiki',
      summary: 'Hitchhiking and travel wiki.',
      wikiOrigin: 'https://hitchwiki.org',
      proxyRoute: 'hitchwiki.org',
      wikiPath: '/wiki',
      wikiApiPath: '/api.php',
      wikiLoadPath: '/index.php',
      wikiMainPagePath: '/wiki/Main_Page',
      wikiMainPageTitle: 'Main_Page'
    },
    {
      slug: 'trashwiki',
      title: 'Trashwiki',
      summary: 'Waste, reuse, and sustainability wiki.',
      wikiOrigin: 'https://trashwiki.org',
      proxyRoute: 'trashwiki.org',
      wikiPath: '/wiki',
      wikiApiPath: '/api.php',
      wikiLoadPath: '/index.php',
      wikiMainPagePath: '/wiki/Main_Page',
      wikiMainPageTitle: 'Main_Page'
    },
    {
      slug: 'wikivoyage',
      title: 'Wikivoyage',
      summary: 'Free worldwide travel guide.',
      wikiOrigin: 'https://en.wikivoyage.org',
      proxyRoute: 'en.wikivoyage.org',
      wikiPath: '/wiki',
      wikiApiPath: '/w/api.php',
      wikiLoadPath: '/w/index.php',
      wikiMainPagePath: '/wiki/Main_Page',
      wikiMainPageTitle: 'Main Page'
    },
    {
      slug: 'trustroots-wiki',
      title: 'Trustroots wiki',
      summary: 'Community wiki on Trustroots.',
      wikiOrigin: 'https://wiki.trustroots.org',
      proxyRoute: 'wiki.trustroots.org',
      wikiPath: '/wiki',
      wikiApiPath: '/api.php',
      wikiLoadPath: '/index.php',
      wikiMainPagePath: '/wiki/Main_Page',
      wikiMainPageTitle: 'Main_Page'
    }
  ];
  const TEST_MODE = Boolean(window.__WIKISTR_TEST__);

  const state = {
    relays: DEFAULT_RELAYS.slice(),
    adverts: [],
    wikiAdverts: [],
    proxyAdverts: [],
    wikiConfigs: [],
    activeWiki: null,
    currentPage: '',
    discovered: false
  };

  function noPublicWikiMessage() {
    return 'No public wiki adverts found.';
  }

  const els = {
    wikiSwitcher: document.getElementById('wiki-switcher'),
    changesStatus: document.getElementById('changes-status'),
    recentChanges: document.getElementById('recent-changes'),
    mainPageHeading: document.getElementById('main-page-heading'),
    mainPageContent: document.getElementById('main-page-content'),
    nomadwikiEdit: document.getElementById('nomadwiki-edit-link'),
    buildTime: document.getElementById('build-time')
  };

  const DEFAULT_RECENT_CHANGES_LIMIT = 50;
  const DEFAULT_RECENT_CHANGES_DAYS = 30;
  const RECENT_CHANGES_QUERY = {
    action: 'query',
    list: 'recentchanges',
    rcprop: 'title|user|comment|timestamp|ids',
    rcshow: '!bot',
    rclimit: String(DEFAULT_RECENT_CHANGES_LIMIT),
    format: 'json'
  };

  const authCache = new Map();
  const WRAPSTER_AUTH_TTL_MS = 45 * 1000;
  const NOSTROOTS_ANDROID_URL = 'https://play.google.com/store/apps/details?id=org.trustroots.nostroots';
  const NOSTROOTS_IOS_URL = 'https://apps.apple.com/app/nostroots/id6755037304';
  const NOSTROOTS_EXTENSION_URL = 'https://chromewebstore.google.com/detail/nostroots-extension/kmgfnmgidnajdpjnpfekmcbbdpgdimhf';
  const NOMADWIKI_EDIT_RETURN_QUERY = 'action%3Dedit';

  function tagValue(event, name) {
    const tag = (event.tags || []).find((item) => Array.isArray(item) && item[0] === name && item[1]);
    return tag ? String(tag[1]) : '';
  }

  function tagValues(event, name) {
    return (event.tags || [])
      .filter((item) => Array.isArray(item) && item[0] === name && item[1])
      .map((item) => String(item[1]));
  }

  function tTags(event) {
    return tagValues(event, 't');
  }

  function serviceFromTags(event) {
    const direct = tagValue(event, 'service');
    if (direct) {
      return direct;
    }
    const serviceTag = tTags(event).find((value) => value.startsWith('service:'));
    return serviceTag ? serviceTag.slice('service:'.length) : '';
  }

  function addressForAdvert(event) {
    const d = tagValue(event, 'd');
    if (!event || event.kind !== SERVICE_ADVERT_KIND || !event.pubkey || !d) {
      return '';
    }
    return `${SERVICE_ADVERT_KIND}:${event.pubkey}:${d}`;
  }

  function isServiceAdvert(event) {
    return Boolean(
      event &&
      event.kind === SERVICE_ADVERT_KIND &&
      tagValue(event, 'd') &&
      tagValue(event, 'title') &&
      tagValue(event, 'summary') &&
      tagValue(event, 'status') &&
      tagValue(event, 'request') &&
      serviceFromTags(event) &&
      tTags(event).includes('nostr-service-advert')
    );
  }

  function compareAdvertEvents(a, b) {
    const aTime = Number(a.created_at || 0);
    const bTime = Number(b.created_at || 0);
    if (aTime !== bTime) {
      return bTime - aTime;
    }
    return String(a.id || '').localeCompare(String(b.id || ''));
  }

  function dedupeAddressableAdverts(events) {
    const latest = new Map();
    for (const event of events.filter(isServiceAdvert)) {
      const address = addressForAdvert(event);
      if (!address) {
        continue;
      }
      const current = latest.get(address);
      if (!current || compareAdvertEvents(event, current) < 0) {
        latest.set(address, event);
      }
    }
    return Array.from(latest.values()).sort((a, b) => {
      const aTitle = tagValue(a, 'title').toLowerCase();
      const bTitle = tagValue(b, 'title').toLowerCase();
      return aTitle.localeCompare(bTitle);
    });
  }

  function slugFromAdvert(event) {
    const d = tagValue(event, 'd');
    const [, slug = d] = d.split(/:(.*)/, 2);
    return normalizeSlug(slug || d);
  }

  function normalizeSlug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function normalizeProxyRoute(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '');
  }

  const normalizePath = (value, fallback) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
      return fallback;
    }
    if (trimmed === '/') {
      return '/';
    }
    return trimmed.startsWith('/') ? trimmed.replace(/\/+$/, '') : `/${trimmed.replace(/\/+$/, '')}`;
  };

  function normalizePathForJoin(value) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
      return '/';
    }
    return trimmed.startsWith('/') ? trimmed.replace(/\/+$/, '') : `/${trimmed.replace(/\/+$/, '')}`;
  }

  function validHTTPURL(value) {
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.host);
    } catch {
      return false;
    }
  }

  function proxyEndpointFromAdvert(event) {
    const endpoint = tagValue(event, 'endpoint').trim();
    if (validHTTPURL(endpoint)) {
      return endpoint.replace(/\/+$/, '');
    }
    return '';
  }

  function buildProxyIndex(proxyAdverts) {
    const byRoute = new Map();
    for (const advert of proxyAdverts) {
      const endpoint = proxyEndpointFromAdvert(advert);
      if (!endpoint) {
        continue;
      }
      for (const route of tagValues(advert, 'proxy_route').map(normalizeProxyRoute).filter(Boolean)) {
        if (!byRoute.has(route)) {
          byRoute.set(route, { advert, endpoint });
        }
      }
    }
    return byRoute;
  }

  function buildWikiConfigFromAdvert(event, proxyIndex = new Map()) {
    const slug = slugFromAdvert(event);
    const wikiOrigin = tagValue(event, 'wiki_origin').replace(/\/+$/, '');
    const proxyRoute = normalizeProxyRoute(tagValue(event, 'proxy_route'));
    if (!slug || !validHTTPURL(wikiOrigin) || !proxyRoute) {
      return null;
    }
    const proxy = proxyIndex.get(proxyRoute);
    if (!proxy) {
      return null;
    }
    const wikiPath = normalizePath(tagValue(event, 'wiki_path'), '/wiki');
    const wikiApiPath = normalizePath(tagValue(event, 'wiki_api_path'), '/api.php');
    const wikiLoadPath = normalizePath(tagValue(event, 'wiki_load_path'), '/index.php');
    const wikiMainPagePath = normalizePath(tagValue(event, 'wiki_main_page_path'), `${wikiPath}/Main_Page`);
    const wikiMainPageTitle = tagValue(event, 'wiki_main_page_title') || buildMainPageTitleFromPath(wikiPath, wikiMainPagePath);
    return {
      slug,
      id: slug,
      title: tagValue(event, 'title'),
      summary: tagValue(event, 'summary'),
      status: tagValue(event, 'status') || 'active',
      wikiOrigin,
      wikiPath,
      wikiApiPath,
      wikiLoadPath,
      wikiMainPagePath,
      wikiMainPageTitle,
      proxyRoute,
      proxyEndpoint: proxy.endpoint,
      wikiApiProxy: `${proxy.endpoint}/${proxyRoute}`,
      advert: event,
      proxyAdvert: proxy.advert
    };
  }

  function buildWikiConfigs(adverts) {
    const latest = dedupeAddressableAdverts(adverts);
    const proxies = latest.filter((event) => serviceFromTags(event) === 'cors-proxy');
    const proxyIndex = buildProxyIndex(proxies);
    return latest
      .filter((event) => serviceFromTags(event) === 'wiki')
      .map((event) => buildWikiConfigFromAdvert(event, proxyIndex))
      .filter(Boolean)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  function hardcodedWikiConfigs() {
    return DEFAULT_HARDCODED_WIKIS
      .map((item) => {
        const wikiPath = normalizePath(item.wikiPath, '/wiki');
        const wikiApiPath = normalizePath(item.wikiApiPath, '/api.php');
        const wikiLoadPath = normalizePath(item.wikiLoadPath, '/index.php');
        const wikiMainPagePath = normalizePath(item.wikiMainPagePath, `${wikiPath}/Main_Page`);
        const wikiMainPageTitle = item.wikiMainPageTitle || buildMainPageTitleFromPath(wikiPath, wikiMainPagePath);
        const proxyRoute = normalizeProxyRoute(item.proxyRoute);
        const origin = String(item.wikiOrigin || '').replace(/\/+$/, '');
        if (!item.slug || !validHTTPURL(origin) || !proxyRoute) {
          return null;
        }
        return {
          slug: normalizeSlug(item.slug),
          id: normalizeSlug(item.slug),
          title: item.title || normalizeSlug(item.slug),
          summary: item.summary || '',
          status: 'active',
          wikiOrigin: origin,
          wikiPath,
          wikiApiPath,
          wikiLoadPath,
          wikiMainPagePath,
          wikiMainPageTitle,
          proxyRoute,
          proxyEndpoint: WRAPSTER_PROXY_ENDPOINT,
          wikiApiProxy: `${WRAPSTER_PROXY_ENDPOINT}/${proxyRoute}`,
          advert: null,
          proxyAdvert: null
        };
      })
      .filter(Boolean);
  }

  function storageArea() {
    try {
      return window.localStorage || null;
    } catch {
      return null;
    }
  }

  function cacheableAdvert(event) {
    if (!isServiceAdvert(event)) {
      return null;
    }
    return {
      id: String(event.id || ''),
      pubkey: String(event.pubkey || ''),
      kind: Number(event.kind || 0),
      created_at: Number(event.created_at || 0),
      content: String(event.content || ''),
      tags: Array.isArray(event.tags)
        ? event.tags.filter(Array.isArray).map((tag) => tag.map((value) => String(value)))
        : []
    };
  }

  function cacheServiceAdverts(adverts) {
    const storage = storageArea();
    if (!storage) {
      return false;
    }
    const events = dedupeAddressableAdverts(adverts)
      .map(cacheableAdvert)
      .filter(Boolean);
    if (!events.length) {
      return false;
    }
    try {
      storage.setItem(SERVICE_ADVERT_CACHE_KEY, JSON.stringify({
        version: 1,
        cachedAt: Date.now(),
        events
      }));
      return true;
    } catch {
      return false;
    }
  }

  function loadCachedServiceAdverts(now = Date.now()) {
    const storage = storageArea();
    if (!storage) {
      return [];
    }
    try {
      const raw = storage.getItem(SERVICE_ADVERT_CACHE_KEY);
      if (!raw) {
        return [];
      }
      const payload = JSON.parse(raw);
      if (!payload || payload.version !== 1 || !Array.isArray(payload.events)) {
        return [];
      }
      const cachedAt = Number(payload.cachedAt || 0);
      if (!cachedAt || now - cachedAt > SERVICE_ADVERT_CACHE_MAX_AGE_MS) {
        storage.removeItem(SERVICE_ADVERT_CACHE_KEY);
        return [];
      }
      return payload.events
        .map(cacheableAdvert)
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function applyServiceAdverts(adverts) {
    const latest = dedupeAddressableAdverts(adverts);
    state.adverts = latest;
    state.wikiAdverts = latest.filter((event) => serviceFromTags(event) === 'wiki');
    state.proxyAdverts = latest.filter((event) => serviceFromTags(event) === 'cors-proxy');
    const discoveredConfigs = buildWikiConfigs(latest);
    const fallbackConfigs = hardcodedWikiConfigs();
    const merged = new Map();
    for (const config of fallbackConfigs) {
      merged.set(config.slug, config);
    }
    for (const config of discoveredConfigs) {
      merged.set(config.slug, config);
    }
    state.wikiConfigs = Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title));
    state.discovered = true;
    return state.wikiConfigs;
  }

  function parseHashRoute(configs = state.wikiConfigs) {
    const raw = (window.location.hash || '').replace(/^#\/?/, '');
    if (!raw) {
      return { slug: null, page: '' };
    }
    const slash = raw.indexOf('/');
    const slugRaw = slash === -1 ? raw : raw.slice(0, slash);
    const pageRaw = slash === -1 ? '' : raw.slice(slash + 1);
    const slug = configs.some((config) => config.slug === slugRaw) ? slugRaw : null;
    let page = '';
    try {
      page = decodeURIComponent(pageRaw);
    } catch {
      page = pageRaw;
    }
    return { slug, page };
  }

  function routeHashFor(slug, page) {
    if (!slug) {
      return '';
    }
    if (!page) {
      return `#${slug}`;
    }
    const encoded = String(page).split('/').map(encodeURIComponent).join('/');
    return `#${slug}/${encoded}`;
  }

  function activeConfig() {
    return state.activeWiki;
  }

  function buildWikiConfig(slug, configs = state.wikiConfigs) {
    return configs.find((config) => config.slug === slug) || null;
  }

  function buildMainPageTitleFromPath(wikiPath, wikiMainPagePath) {
    const base = normalizePath(wikiPath, '/wiki');
    const path = normalizePath(wikiMainPagePath, `${base}/Main_Page`);
    if (path === base || path === `${base}/`) {
      return 'Main_Page';
    }
    if (path.startsWith(`${base}/`)) {
      return path.slice(base.length + 1);
    }
    return path.replace(/^\/+/, '') || 'Main_Page';
  }

  function buildWikiUrl(path, params = null, useProxy = false) {
    const config = activeConfig();
    if (!config) {
      return '';
    }
    const normalizedPath = normalizePathForJoin(path);
    const url = new URL(config.wikiOrigin + normalizedPath);
    if (params && typeof params === 'object') {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value);
        }
      }
    }
    if (!useProxy) {
      return url.toString();
    }
    const proxied = new URL(`${config.wikiApiProxy}${normalizedPath}`, window.location.origin);
    for (const [key, value] of url.searchParams.entries()) {
      proxied.searchParams.set(key, value);
    }
    return proxied.toString();
  }

  function buildWikiApiURLWithQuery(queryParams = {}, useProxy = true) {
    const config = activeConfig();
    if (!config) {
      return '';
    }
    return buildWikiUrl(config.wikiApiPath, queryParams, useProxy);
  }

  function recentChangesQuery() {
    const query = { ...RECENT_CHANGES_QUERY };
    const end = new Date();
    const start = new Date(end.getTime() - DEFAULT_RECENT_CHANGES_DAYS * 24 * 60 * 60 * 1000);
    query.rcend = toWikiAPITimestamp(start);
    return query;
  }

  function buildMainPageParseURL(useProxy = true) {
    const config = activeConfig();
    if (!config) {
      return '';
    }
    const page = state.currentPage || config.wikiMainPageTitle;
    return buildWikiApiURLWithQuery({
      action: 'parse',
      page,
      prop: 'text',
      format: 'json',
      formatversion: '2'
    }, useProxy);
  }

  function buildMainPageRenderURL(useProxy = true) {
    const config = activeConfig();
    if (!config) {
      return '';
    }
    const title = state.currentPage || config.wikiMainPageTitle;
    return buildWikiUrl(config.wikiLoadPath, { title, action: 'render' }, useProxy);
  }

  function encodeBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function profileNip05FromEvent(event) {
    try {
      const profile = JSON.parse(String(event.content || '{}'));
      return normalizeTrustrootsNip05(profile.nip05) ||
        trustrootsNip05FromUsername(profile.trustrootsUsername) ||
        trustrootsNip05FromUsername(profile.username);
    } catch {
      return '';
    }
  }

  function newestEvent(events) {
    if (!events.length) {
      return null;
    }
    return events.reduce((latest, event) => (
      Number(event.created_at || 0) >= Number(latest.created_at || 0) ? event : latest
    ));
  }

  function matchesPubkey(event, pubkey) {
    return String(event?.pubkey || '').toLowerCase() === pubkey;
  }

  function normalizeUsername(value) {
    const username = String(value || '').trim().toLowerCase();
    return username && /^[a-z0-9_.-]+$/.test(username) ? username : '';
  }

  function normalizeTrustrootsNip05(value) {
    const nip05 = String(value || '').trim().toLowerCase();
    const at = nip05.lastIndexOf('@');
    if (at <= 0 || at === nip05.length - 1) {
      return '';
    }
    const username = normalizeUsername(nip05.slice(0, at));
    const domain = nip05.slice(at + 1).replace(/^www\./, '');
    return username && domain === 'trustroots.org' ? `${username}@trustroots.org` : '';
  }

  function trustrootsNip05FromUsername(value) {
    const username = normalizeUsername(value);
    return username ? `${username}@trustroots.org` : '';
  }

  function trustrootsUsernameFromTags(tags) {
    for (const tag of tags || []) {
      if (!Array.isArray(tag)) {
        continue;
      }
      if (tag[0] === 'trustroots' && tag[1]) {
        return normalizeUsername(tag[1]);
      }
      if (tag[0] === 'l' && tag[1] && tag[2] === TRUSTROOTS_USERNAME_LABEL_NAMESPACE) {
        return normalizeUsername(tag[1]);
      }
    }
    return '';
  }

  function trustrootsNip05FromClaimContent(content) {
    try {
      const profile = JSON.parse(String(content || '{}'));
      return normalizeTrustrootsNip05(profile.nip05) ||
        trustrootsNip05FromUsername(profile.trustrootsUsername) ||
        trustrootsNip05FromUsername(profile.username);
    } catch {
      return '';
    }
  }

  function eventTargetsPubkey(event, pubkey) {
    if (matchesPubkey(event, pubkey)) {
      return true;
    }
    return (event?.tags || []).some((tag) => (
      Array.isArray(tag) && tag[0] === 'p' && String(tag[1] || '').toLowerCase() === pubkey
    ));
  }

  function extractTrustrootsNip05(events, pubkey) {
    const kind0 = newestEvent(events.filter((event) => event?.kind === 0 && matchesPubkey(event, pubkey)));
    const kind0Nip05 = kind0 ? profileNip05FromEvent(kind0) : '';
    if (kind0Nip05) {
      return kind0Nip05;
    }

    const kind10390 = newestEvent(events.filter((event) => event?.kind === TRUSTROOTS_PROFILE_KIND && matchesPubkey(event, pubkey)));
    const kind10390Nip05 = trustrootsNip05FromUsername(trustrootsUsernameFromTags(kind10390?.tags));
    if (kind10390Nip05) {
      return kind10390Nip05;
    }

    const claims = events
      .filter((event) => event?.kind === TRUSTROOTS_PROFILE_CLAIM_KIND && eventTargetsPubkey(event, pubkey))
      .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    for (const claim of claims) {
      const fromTags = trustrootsNip05FromUsername(trustrootsUsernameFromTags(claim.tags));
      if (fromTags) {
        return fromTags;
      }
      const fromContent = trustrootsNip05FromClaimContent(claim.content);
      if (fromContent) {
        return fromContent;
      }
    }
    return '';
  }

  function dedupeEvents(events) {
    const byId = new Map();
    for (const event of events) {
      if (event?.id) {
        byId.set(event.id, event);
      }
    }
    return Array.from(byId.values());
  }

  async function waitForNostr(timeoutMs = 1500, options = {}) {
    if (window.nostr && (!options.requireSignEvent || typeof window.nostr.signEvent === 'function')) {
      return window.nostr;
    }
    const started = Date.now();
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        if (window.nostr && (!options.requireSignEvent || typeof window.nostr.signEvent === 'function')) {
          clearInterval(timer);
          resolve(window.nostr);
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          resolve(null);
        }
      }, 100);
    });
  }

  async function buildWrapsterAuthHeader(url, method = 'GET') {
    const key = `${method.toUpperCase()} ${url}`;
    const cached = authCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.header;
    }
    const nostr = await waitForNostr(1800, { requireSignEvent: true });
    if (!nostr) {
      throw new Error('No NIP-07 signer found for Wrapster auth.');
    }
    const event = await nostr.signEvent({
      kind: NIP98_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', url],
        ['method', method.toUpperCase()]
      ],
      content: ''
    });
    const header = `Nostr ${encodeBase64(JSON.stringify(event))}`;
    authCache.set(key, { header, expires: Date.now() + WRAPSTER_AUTH_TTL_MS });
    return header;
  }

  async function addWrapsterAuth(headers, requestURL, method = 'GET') {
    const authorization = await buildWrapsterAuthHeader(requestURL, method);
    headers.set('Authorization', authorization);
  }

  async function wikiFetchJSON(requestURL, init = {}) {
    const headers = new Headers(init.headers || {});
    const method = (init.method || 'GET').toUpperCase();
    try {
      await addWrapsterAuth(headers, requestURL, method);
    } catch (err) {
      return { ok: false, status: 0, body: { error: err.message || 'Nostr auth unavailable.' }, rawBody: '', url: requestURL };
    }
    try {
      const res = await fetch(requestURL, { ...init, headers, mode: 'cors', credentials: 'omit' });
      const rawBody = await res.text();
      let body = {};
      try {
        body = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        body = { error: rawBody || 'Invalid JSON response', _raw: rawBody };
      }
      return { ok: res.ok, status: res.status, body, rawBody, url: requestURL };
    } catch (err) {
      return { ok: false, status: 0, body: { error: err.message || 'Network error' }, rawBody: '', url: requestURL };
    }
  }

  function relayEvents(relay, filter, subID = 'wikistr-discovery') {
    return new Promise((resolve, reject) => {
      const events = [];
      let socket;
      let done = false;
      let requested = false;
      let authEventID = '';
      let authAccepted = false;
      let unauthenticatedReqTimer = 0;
      const timeout = window.setTimeout(() => finish(), 12000);

      function finish(err) {
        if (done) {
          return;
        }
        done = true;
        window.clearTimeout(timeout);
        window.clearTimeout(unauthenticatedReqTimer);
        try {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(['CLOSE', subID]));
            socket.close();
          }
        } catch {
          // Ignore close failures.
        }
        if (err) {
          reject(err);
        } else {
          resolve(events);
        }
      }

      function sendRequest() {
        if (done || requested || !socket || socket.readyState !== WebSocket.OPEN) {
          return;
        }
        requested = true;
        socket.send(JSON.stringify(['REQ', subID, filter]));
      }

      async function authenticate(challenge) {
        window.clearTimeout(unauthenticatedReqTimer);
        if (!window.nostr || typeof window.nostr.signEvent !== 'function') {
          sendRequest();
          return;
        }
        try {
          const authEvent = await window.nostr.signEvent({
            kind: NIP42_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['relay', relay], ['challenge', String(challenge)]],
            content: ''
          });
          if (done || !socket || socket.readyState !== WebSocket.OPEN) {
            return;
          }
          authEventID = authEvent.id || '';
          socket.send(JSON.stringify(['AUTH', authEvent]));
        } catch (err) {
          finish(new Error(`Relay auth failed: ${err.message || String(err)}`));
        }
      }

      function waitForAuthRetry(reason) {
        if (authAccepted || !window.nostr || typeof window.nostr.signEvent !== 'function') {
          return false;
        }
        if (!/auth-required|restricted/i.test(reason)) {
          return false;
        }
        requested = false;
        window.clearTimeout(unauthenticatedReqTimer);
        return true;
      }

      try {
        socket = new WebSocket(relay);
      } catch (err) {
        finish(err);
        return;
      }
      socket.addEventListener('open', () => {
        unauthenticatedReqTimer = window.setTimeout(sendRequest, 600);
      });
      socket.addEventListener('message', async (message) => {
        let payload;
        try {
          payload = JSON.parse(message.data);
        } catch {
          return;
        }
        const type = payload[0];
        if (type === 'AUTH') {
          await authenticate(payload[1]);
        } else if (type === 'OK' && payload[1] === authEventID) {
          if (payload[2] === true) {
            authAccepted = true;
            sendRequest();
          } else {
            finish(new Error(String(payload[3] || 'Relay auth rejected')));
          }
        } else if (type === 'EVENT' && payload[1] === subID) {
          events.push(payload[2]);
        } else if (type === 'EOSE' && payload[1] === subID) {
          finish();
        } else if (type === 'CLOSED' && payload[1] === subID) {
          const reason = String(payload[2] || 'Relay closed subscription');
          if (waitForAuthRetry(reason)) {
            return;
          }
          finish(events.length ? null : new Error(reason));
        }
      });
      socket.addEventListener('error', () => finish(new Error('Relay connection failed')));
      socket.addEventListener('close', () => {
        if (!done) {
          finish(events.length ? null : new Error('Relay connection closed'));
        }
      });
    });
  }

  async function discoverAdverts(relays = state.relays) {
    const cachedAdverts = loadCachedServiceAdverts();
    if (cachedAdverts.length) {
      applyServiceAdverts(cachedAdverts);
    }
    const filter = {
      kinds: [SERVICE_ADVERT_KIND],
      '#t': ['nostr-service-advert'],
      limit: 200
    };
    const settled = await Promise.allSettled(relays.map((relay, index) => relayEvents(relay, filter, `wikistr-${index}`)));
    const events = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    const adverts = dedupeAddressableAdverts(events);
    if (adverts.length) {
      cacheServiceAdverts(adverts);
      applyServiceAdverts(adverts);
    } else if (!cachedAdverts.length) {
      applyServiceAdverts([]);
    }
    return state.wikiConfigs;
  }

  function setStatus(message, isError = false) {
    void message;
    void isError;
  }

  function renderWikiSwitcher() {
    if (!els.wikiSwitcher) {
      return;
    }
    els.wikiSwitcher.replaceChildren();
    if (!state.wikiConfigs.length) {
      const empty = document.createElement('span');
      empty.className = 'muted small';
      empty.textContent = noPublicWikiMessage();
      els.wikiSwitcher.append(empty);
      return;
    }
    for (const config of state.wikiConfigs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wiki-switch-btn';
      button.dataset.wiki = config.slug;
      button.textContent = config.title || config.slug;
      button.setAttribute('aria-pressed', config === state.activeWiki ? 'true' : 'false');
      if (config === state.activeWiki) {
        button.classList.add('active');
      }
      button.addEventListener('click', () => switchWiki(config.slug));
      els.wikiSwitcher.append(button);
    }
  }

  function selectInitialWiki(configs) {
    const route = parseHashRoute(configs);
    const selected = route.slug ? buildWikiConfig(route.slug, configs) : configs[0] || null;
    state.activeWiki = selected;
    state.currentPage = route.page || '';
    return selected;
  }

  function syncUrlToActiveWiki() {
    if (!state.activeWiki) {
      return;
    }
    const hash = routeHashFor(state.activeWiki.slug, state.currentPage);
    history.replaceState(null, '', `${window.location.pathname}${hash}`);
  }

  async function switchWiki(slug) {
    const config = buildWikiConfig(slug);
    if (!config || config === state.activeWiki) {
      return;
    }
    state.activeWiki = config;
    state.currentPage = '';
    syncUrlToActiveWiki();
    renderWikiSwitcher();
    await loadSurfaceData();
  }

  async function handleHashRoute() {
    const { slug, page } = parseHashRoute();
    const nextWiki = slug ? buildWikiConfig(slug) : state.activeWiki;
    if (!nextWiki) {
      return;
    }
    const wikiChanged = nextWiki !== state.activeWiki;
    state.activeWiki = nextWiki;
    state.currentPage = page || '';
    renderWikiSwitcher();
    syncMainPageHeading(state.currentPage || nextWiki.wikiMainPageTitle);
    if (wikiChanged) {
      await loadSurfaceData();
    } else {
      await loadMainPageContent();
    }
  }

  function surfacePageHref(page) {
    return routeHashFor(state.activeWiki?.slug, page);
  }

  function makePageLink(title) {
    const safeTitle = escapeHTML(title);
    const page = String(title || '').replace(/\s+/g, '_');
    return `<a href="${surfacePageHref(page)}" rel="noopener">${safeTitle}</a>`;
  }

  function diffHref(revid, oldid) {
    if (!revid || !state.activeWiki) {
      return '';
    }
    const params = { diff: revid };
    if (oldid) {
      params.oldid = oldid;
    }
    return buildWikiUrl(state.activeWiki.wikiLoadPath, params, false);
  }

  async function loadSurfaceData() {
    const config = activeConfig();
    if (!config) {
      const message = noPublicWikiMessage();
      setStatus(message, true);
      setMainPageMessage(message);
      return;
    }
    setStatus(config.title || config.wikiOrigin);
    syncMainPageHeading(state.currentPage || config.wikiMainPageTitle);
    if (els.changesStatus) {
      els.changesStatus.textContent = 'Loading recent changes...';
    }
    setMainPageMessage('Loading page...');
    await Promise.allSettled([loadMainPageContent(), loadRecentChanges()]);
  }

  async function loadMainPageContent() {
    const url = buildMainPageParseURL(true);
    if (!url) {
      return;
    }
    const result = await wikiFetchJSON(url);
    if (!result.ok || result.body?.error) {
      if (isMissingSignerWikiError(result)) {
        setMainPageMessage(formatMissingSignerHelpHTML(), { html: true });
        return;
      }
      setMainPageMessage(formatWikiFetchError({
        result,
        context: 'Page load',
        requestURL: url,
        useProxy: true
      }));
      return;
    }
    const html = result.body?.parse?.text || '';
    if (!html) {
      setMainPageMessage('No page content returned.');
      return;
    }
    els.mainPageContent.innerHTML = rewriteWikiHTML(html);
  }

  async function loadRecentChanges() {
    const url = buildWikiApiURLWithQuery(recentChangesQuery(), true);
    if (!url) {
      return;
    }
    const result = await wikiFetchJSON(url);
    if (!result.ok || result.body?.error) {
      if (els.changesStatus) {
        els.changesStatus.textContent = isMissingSignerWikiError(result)
          ? formatMissingSignerHelpText()
          : formatWikiFetchError({
            result,
            context: 'Recent changes',
            requestURL: url,
            useProxy: true
          });
      }
      if (els.recentChanges) {
        els.recentChanges.textContent = '';
      }
      return;
    }
    renderRecentChanges(result.body?.query?.recentchanges || []);
  }

  function setMainPageMessage(message, options = {}) {
    if (!els.mainPageContent) {
      return;
    }
    if (options.html) {
      els.mainPageContent.innerHTML = message;
      return;
    }
    els.mainPageContent.textContent = message;
  }

  function isMissingSignerWikiError(result) {
    const error = String(result?.body?.error || '').toLowerCase();
    if (!error) {
      return false;
    }
    return error.includes('no nip-07 signer')
      || error.includes('nostr auth unavailable')
      || error.includes('missing nostr authorization');
  }

  function formatMissingSignerHelpText() {
    return 'Connect a Nostr key to read this wiki. Use the Nostroots app on your phone, or install the Nostroots Extension on desktop, then reload.';
  }

  function formatMissingSignerHelpHTML() {
    return [
      '<div class="signer-help">',
      '<p><strong>Connect a Nostr key to read this wiki.</strong></p>',
      '<p>Wikistr loads pages through a signed proxy. You need a signer on this device.</p>',
      '<ul>',
      `<li><strong>On your phone:</strong> open the <a href="${escapeHTML(NOSTROOTS_ANDROID_URL)}" target="_blank" rel="noopener noreferrer">Nostroots app</a> (Android or iOS).</li>`,
      `<li><strong>On desktop:</strong> install the <a href="${escapeHTML(NOSTROOTS_EXTENSION_URL)}" target="_blank" rel="noopener noreferrer">Nostroots Extension</a> in Chrome, Brave, or Edge.</li>`,
      '</ul>',
      '<p class="muted small">Reload this page after your signer is ready.</p>',
      '</div>'
    ].join('');
  }

  function hasLinkedTrustrootsIdentity() {
    const identityStatus = document.getElementById('trustroots-identity-status');
    return Boolean(identityStatus && identityStatus.dataset.state === 'connected');
  }

  function isViewingMainPage(config, page = state.currentPage) {
    const current = String(page || '').trim();
    if (!current) {
      return true;
    }
    const mainTitle = String(config?.wikiMainPageTitle || 'Main_Page');
    if (current === mainTitle) {
      return true;
    }
    return current.replace(/\s+/g, '_') === mainTitle.replace(/\s+/g, '_');
  }

  function nomadwikiEditReturnTitle(config, page = state.currentPage) {
    if (isViewingMainPage(config, page)) {
      return 'Main Page';
    }
    return String(page).replace(/_/g, ' ');
  }

  function buildNomadwikiEditHref(page = state.currentPage) {
    const config = activeConfig();
    if (!config || config.slug !== 'nomadwiki') {
      return '';
    }
    const base = buildWikiUrl(config.wikiLoadPath, {
      title: 'Special:NostrLogin',
      returnto: nomadwikiEditReturnTitle(config, page)
    }, false);
    if (!base) {
      return '';
    }
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}returntoquery=${NOMADWIKI_EDIT_RETURN_QUERY}`;
  }

  function syncCardTitleRow() {
    const row = els.mainPageHeading?.closest('.card-title');
    if (!row) {
      return;
    }
    const headingVisible = Boolean(els.mainPageHeading && !els.mainPageHeading.hidden);
    const editVisible = Boolean(els.nomadwikiEdit && !els.nomadwikiEdit.hidden);
    row.hidden = !headingVisible && !editVisible;
  }

  function syncNomadwikiEditButton() {
    if (!els.nomadwikiEdit) {
      return;
    }
    const config = activeConfig();
    const show = config?.slug === 'nomadwiki' && hasLinkedTrustrootsIdentity();
    if (!show) {
      els.nomadwikiEdit.hidden = true;
      syncCardTitleRow();
      return;
    }
    const href = buildNomadwikiEditHref();
    els.nomadwikiEdit.href = href;
    els.nomadwikiEdit.hidden = !href;
    syncCardTitleRow();
  }

  function watchTrustrootsIdentityForEdit() {
    const identityStatus = document.getElementById('trustroots-identity-status');
    if (!identityStatus) {
      return;
    }
    const observer = new MutationObserver(() => {
      syncNomadwikiEditButton();
    });
    observer.observe(identityStatus, { attributes: true, attributeFilter: ['data-state', 'hidden'] });
  }

  function syncMainPageHeading(title) {
    if (!els.mainPageHeading) {
      return;
    }
    const visible = Boolean(title);
    els.mainPageHeading.hidden = !visible;
    els.mainPageHeading.textContent = visible ? title.replaceAll('_', ' ') : '';
    syncNomadwikiEditButton();
    syncCardTitleRow();
  }

  function rewriteWikiHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    for (const anchor of template.content.querySelectorAll('a[href]')) {
      const title = wikiPageTitleFromUrl(anchor.getAttribute('href'));
      if (title) {
        anchor.setAttribute('href', surfacePageHref(title));
      } else {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      }
    }
    for (const img of template.content.querySelectorAll('img[src]')) {
      const src = normalizeWikiResourceUrl(img.getAttribute('src'));
      if (src) {
        img.setAttribute('src', proxiedWikiResourceUrl(src));
      }
      if (img.hasAttribute('srcset')) {
        img.setAttribute('srcset', normalizeWikiSrcset(img.getAttribute('srcset'), true));
      }
    }
    return template.innerHTML;
  }

  function normalizeWikiResourceUrl(value) {
    if (!state.activeWiki) {
      return '';
    }
    try {
      const url = new URL(value, state.activeWiki.wikiOrigin);
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
        return '';
      }
      return url.toString();
    } catch {
      return '';
    }
  }

  function normalizeWikiSrcset(value, proxy = false) {
    return String(value || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const bits = part.split(/\s+/);
        const url = normalizeWikiResourceUrl(bits.shift());
        if (!url) {
          return '';
        }
        const finalURL = proxy ? proxiedWikiResourceUrl(url) : url;
        return [finalURL, ...bits].join(' ');
      })
      .filter(Boolean)
      .join(', ');
  }

  function shouldProxyResources() {
    return Boolean(state.activeWiki?.wikiApiProxy);
  }

  function proxiedWikiResourceUrl(value) {
    const config = activeConfig();
    if (!config || !shouldProxyResources()) {
      return value;
    }
    try {
      const url = new URL(value);
      if (url.origin !== config.wikiOrigin) {
        return value;
      }
      const proxyURL = new URL(`${config.wikiApiProxy}${url.pathname}`, window.location.origin);
      proxyURL.search = url.search;
      return proxyURL.toString();
    } catch {
      return value;
    }
  }

  function wikiPageTitleFromUrl(value) {
    const config = activeConfig();
    if (!config) {
      return null;
    }
    try {
      const url = new URL(value, config.wikiOrigin);
      if (url.origin !== config.wikiOrigin) {
        return null;
      }
      if (url.pathname === config.wikiLoadPath) {
        const title = url.searchParams.get('title');
        if (title && !url.searchParams.has('action') && !title.startsWith('Special:')) {
          return title;
        }
      }
      const wikiPrefix = `${config.wikiPath}/`;
      if (url.pathname.startsWith(wikiPrefix)) {
        const title = decodeURIComponent(url.pathname.slice(wikiPrefix.length));
        return title && !title.startsWith('Special:') ? title : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  function renderRecentChanges(changes) {
    if (!els.recentChanges || !els.changesStatus) {
      return;
    }
    els.recentChanges.replaceChildren();
    if (!changes.length) {
      els.changesStatus.textContent = 'No recent changes found.';
      return;
    }
    els.changesStatus.textContent = '';
    const groups = new Map();
    for (const change of changes) {
      const title = change.title || '(untitled)';
      if (!groups.has(title)) {
        groups.set(title, []);
      }
      groups.get(title).push(change);
    }
    for (const [title, edits] of groups.entries()) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = surfacePageHref(String(title).replace(/\s+/g, '_'));
      link.textContent = title;
      item.append(link);
      const list = document.createElement('ul');
      list.className = 'rc-edits';
      for (const edit of edits) {
        const editItem = document.createElement('li');
        editItem.className = 'rc-edit';
        const meta = document.createElement('div');
        meta.className = 'item-meta muted small';
        const bits = [formatDateTime(edit.timestamp)];
        if (edit.user) {
          bits.push(`by ${edit.user}`);
        }
        const diff = diffHref(edit.revid, edit.old_revid);
        meta.textContent = bits.filter(Boolean).join(' ');
        if (diff) {
          const diffLink = document.createElement('a');
          diffLink.href = diff;
          diffLink.target = '_blank';
          diffLink.rel = 'noopener noreferrer';
          diffLink.className = 'rc-diff';
          diffLink.textContent = 'diff';
          meta.append(' ', diffLink);
        }
        editItem.append(meta);
        const comment = formatChangeComment(edit.comment || '');
        if (comment) {
          const commentEl = document.createElement('div');
          commentEl.className = 'rc-edit-comment';
          commentEl.innerHTML = comment;
          editItem.append(commentEl);
        }
        list.append(editItem);
      }
      item.append(list);
      els.recentChanges.append(item);
    }
  }

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatChangeComment(comment) {
    const value = String(comment || '').trim();
    if (!value) {
      return '';
    }
    const sections = [];
    let rest = value;
    let match = rest.match(/^\/\*\s*(.*?)\s*\*\/\s*/);
    while (match) {
      sections.push(match[1]);
      rest = rest.slice(match[0].length);
      match = rest.match(/^\/\*\s*(.*?)\s*\*\/\s*/);
    }
    const sectionHTML = sections.map((section) => `<span class="rc-section">${escapeHTML(section)}</span>`).join('');
    const restHTML = rest ? `<span class="rc-comment">${escapeHTML(rest)}</span>` : '';
    return `${sectionHTML}${restHTML}`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value || '';
    }
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }

  function toWikiAPITimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  function sanitizeUrlForDisplay(url) {
    try {
      const parsed = new URL(url);
      parsed.username = '';
      parsed.password = '';
      return parsed.toString();
    } catch {
      return url;
    }
  }

  function truncateForDisplay(text, limit = 500) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    const trimmed = text.replace(/\s+/g, ' ').trim();
    return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
  }

  function describeWikiErrorBody(body, rawBody = '') {
    if (!body && rawBody) {
      return truncateForDisplay(rawBody);
    }
    if (!body) {
      return '';
    }
    const error = body.error;
    if (error) {
      if (typeof error === 'object') {
        const bits = [];
        if (error.code) {
          bits.push(`code=${error.code}`);
        }
        if (error.info) {
          bits.push(error.info);
        }
        return bits.length ? bits.join(' - ') : JSON.stringify(error);
      }
      const extra = body.message && body.message !== error ? ` (${body.message})` : '';
      return `${String(error)}${extra}`;
    }
    if (body._raw) {
      return truncateForDisplay(body._raw);
    }
    return truncateForDisplay(rawBody || JSON.stringify(body));
  }

  function formatWikiFetchError({ result, context, requestURL, useProxy }) {
    if (isMissingSignerWikiError(result)) {
      return formatMissingSignerHelpText();
    }
    const lines = [];
    lines.push(`${context} via ${useProxy ? 'Wrapster proxy' : 'direct wiki'}.`);
    lines.push(result.status ? `HTTP ${result.status}.` : 'No HTTP status (browser network/CORS block).');
    if (requestURL) {
      lines.push(`URL: ${sanitizeUrlForDisplay(requestURL)}`);
    }
    const detail = describeWikiErrorBody(result.body, result.rawBody);
    if (detail) {
      lines.push(`Response: ${detail}`);
    }
    const errorText = typeof result.body?.error === 'string' ? result.body.error.toLowerCase() : '';
    if (errorText.includes('missing nostr authorization')) {
      lines.push('Hint: connect the Nostroots app or Nostroots Extension, then reload.');
    } else if (errorText.includes('url does not match request')) {
      lines.push(`Hint: signed NIP-98 u tag must equal ${requestURL ? sanitizeUrlForDisplay(requestURL) : 'the exact request URL'}.`);
    } else if (errorText.includes('method')) {
      lines.push('Hint: signed NIP-98 method tag must match the HTTP method.');
    } else if (errorText.includes('stale') || errorText.includes('timestamp')) {
      lines.push('Hint: check your system clock.');
    } else if (errorText === 'no_upstream') {
      lines.push(`Hint: add ${state.activeWiki?.proxyRoute || 'this route'} to the proxy allowlist.`);
    } else if (result.status === 401 || result.status === 403) {
      lines.push('Hint: check Wrapster NIP-98 authorization.');
    }
    return lines.join(' ');
  }

  async function initialize() {
    watchTrustrootsIdentityForEdit();
    loadBuildInfo();
    setStatus('Discovering public wiki adverts...');
    const configs = await discoverAdverts();
    selectInitialWiki(configs);
    renderWikiSwitcher();
    if (!state.activeWiki) {
      const message = noPublicWikiMessage();
      setStatus(message, true);
      setMainPageMessage(message);
      return;
    }
    syncUrlToActiveWiki();
    await loadSurfaceData();
  }

  async function loadBuildInfo() {
    if (!els.buildTime) {
      return;
    }
    try {
      const res = await fetch('./build-info.json', { cache: 'no-store' });
      if (!res.ok) {
        return;
      }
      const info = await res.json();
      const buildTime = String(info.build_time || '').trim();
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(buildTime)) {
        els.buildTime.textContent = `${buildTime}`;
      }
    } catch {
      // Local development may not have a generated build-info.json.
    }
  }

  window.Wikistr = Object.freeze(Object.assign({
    SERVICE_ADVERT_KIND,
    DEFAULT_RELAYS,
    NOMADWIKI_EDIT_RETURN_QUERY,
    addWrapsterAuth,
    addressForAdvert,
    buildMainPageParseURL,
    buildMainPageRenderURL,
    buildMainPageTitleFromPath,
    buildNomadwikiEditHref,
    buildProxyIndex,
    buildWikiApiURLWithQuery,
    buildWikiConfig,
    buildWikiConfigFromAdvert,
    buildWikiConfigs,
    buildWikiUrl,
    buildWrapsterAuthHeader,
    cacheServiceAdverts,
    compareAdvertEvents,
    dedupeAddressableAdverts,
    describeWikiErrorBody,
    diffHref,
    discoverAdverts,
    formatChangeComment,
    formatDateTime,
    formatMissingSignerHelpHTML,
    formatMissingSignerHelpText,
    formatWikiFetchError,
    hasLinkedTrustrootsIdentity,
    isMissingSignerWikiError,
    isServiceAdvert,
    isViewingMainPage,
    loadCachedServiceAdverts,
    loadBuildInfo,
    makePageLink,
    normalizePath,
    normalizePathForJoin,
    normalizeProxyRoute,
    normalizeTrustrootsNip05,
    normalizeWikiResourceUrl,
    normalizeWikiSrcset,
    parseHashRoute,
    proxiedWikiResourceUrl,
    proxyEndpointFromAdvert,
    relayEvents,
    renderRecentChanges,
    routeHashFor,
    sanitizeUrlForDisplay,
    serviceFromTags,
    shouldProxyResources,
    slugFromAdvert,
    state,
    surfacePageHref,
    syncMainPageHeading,
    tagValue,
    extractTrustrootsNip05,
    toWikiAPITimestamp,
    truncateForDisplay,
    wikiFetchJSON,
    wikiPageTitleFromUrl
  }, TEST_MODE ? {
    setActiveWikiForTest(config, page = '') {
      state.activeWiki = config;
      state.wikiConfigs = config ? [config] : [];
      state.currentPage = page;
    },
    setWikiConfigsForTest(configs, activeSlug = '') {
      state.wikiConfigs = configs;
      state.activeWiki = activeSlug ? configs.find((config) => config.slug === activeSlug) || null : configs[0] || null;
    }
  } : {}));

  if (!TEST_MODE) {
    window.addEventListener('hashchange', () => {
      handleHashRoute();
    });
    initialize();
  }
}());
