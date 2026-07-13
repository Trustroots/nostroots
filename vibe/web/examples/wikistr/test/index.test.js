const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'index.js');
const htmlPath = path.join(__dirname, '..', 'index.html');
const readmePath = path.join(__dirname, '..', 'README.md');

function b64(value) {
  return Buffer.from(String(value), 'utf8').toString('base64');
}

function fromB64(value) {
  return Buffer.from(String(value), 'base64').toString('utf8');
}

function makeLocalStorage(initial = {}) {
  const items = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) {
      return items.has(key) ? items.get(key) : null;
    },
    setItem(key, value) {
      items.set(key, String(value));
    },
    removeItem(key) {
      items.delete(key);
    }
  };
}

function makeElement(init = {}) {
  const classes = new Set();
  const attributes = {};
  const children = [];
  return {
    attributes,
    children,
    className: '',
    dataset: init.dataset || {},
    hidden: init.hidden || false,
    href: '',
    innerHTML: '',
    textContent: '',
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      toggle(name, force) {
        if (force) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
      },
      contains(name) {
        return classes.has(name);
      }
    },
    append(...items) {
      children.push(...items);
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
    addEventListener() {},
    closest() {
      return init.closest || null;
    },
    querySelectorAll() {
      return [];
    },
    replaceChildren(...items) {
      children.length = 0;
      children.push(...items);
    },
    setAttribute(name, value) {
      attributes[name] = String(value);
      if (name === 'href') {
        this.href = String(value);
      }
    },
    getAttribute(name) {
      return attributes[name] ?? null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name);
    }
  };
}

function loadApp(url = 'http://localhost:8788/index.html', options = {}) {
  const source = fs.readFileSync(appPath, 'utf8');
  const parsed = new URL(url);
  const elements = new Map();
  const document = {
    title: '',
    createElement(name) {
      if (name === 'template') {
        return { innerHTML: '', content: { querySelectorAll: () => [] } };
      }
      return makeElement();
    },
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, makeElement());
      }
      return elements.get(id);
    }
  };
  const window = {
    __WIKISTR_TEST__: true,
    location: {
      hash: parsed.hash,
      search: parsed.search,
      hostname: parsed.hostname,
      origin: parsed.origin,
      pathname: parsed.pathname
    },
    setTimeout,
    clearTimeout,
    addEventListener() {}
  };
  if (options.nostr) {
    window.nostr = options.nostr;
  }
  if (options.WebSocket) {
    window.WebSocket = options.WebSocket;
  }
  window.localStorage = options.localStorage || makeLocalStorage();
  const context = {
    Array,
    Boolean,
    Buffer,
    Date,
    Error,
    Headers,
    Map,
    Object,
    Promise,
    RegExp,
    Set,
    String,
    TextDecoder,
    TextEncoder,
    URL,
    URLSearchParams,
    atob: fromB64,
    btoa: b64,
    clearInterval,
    clearTimeout,
    console,
    document,
    fetch: options.fetch || (async () => {
      throw new Error('fetch should not run during unit tests');
    }),
    history: {
      replaceState() {}
    },
    setInterval,
    setTimeout,
    WebSocket: options.WebSocket || function WebSocket() {},
    window
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: appPath });
  return { app: window.Wikistr, elements };
}

function wikiAdvert(overrides = {}) {
  return {
    id: overrides.id || 'wiki-a',
    pubkey: overrides.pubkey || 'a'.repeat(64),
    kind: 31388,
    created_at: overrides.created_at || 100,
    content: 'A public wiki.',
    tags: [
      ['d', overrides.d || 'wiki:nomadwiki'],
      ['title', overrides.title || 'Nomadwiki'],
      ['summary', overrides.summary || 'Travel wiki'],
      ['service', 'wiki'],
      ['status', 'active'],
      ['request', 'nip17'],
      ['p', 'b'.repeat(64), 'wss://relay.guaka.org', 'contact'],
      ['wiki_origin', overrides.origin || 'https://nomadwiki.org'],
      ['wiki_path', overrides.wiki_path || '/wiki'],
      ['wiki_api_path', overrides.wiki_api_path || '/api.php'],
      ['wiki_load_path', overrides.wiki_load_path || '/index.php'],
      ['wiki_main_page_path', overrides.wiki_main_page_path || '/wiki/en/Main_Page'],
      ['wiki_main_page_title', overrides.wiki_main_page_title || 'Main_Page'],
      ['proxy_route', overrides.proxy_route || 'nomadwiki.org'],
      ['t', 'nostr-service-advert'],
      ['t', 'service:wiki'],
      ['t', 'status:active'],
      ['t', 'access:public']
    ]
  };
}

function proxyAdvert(overrides = {}) {
  return {
    id: overrides.id || 'proxy-a',
    pubkey: overrides.pubkey || 'c'.repeat(64),
    kind: 31388,
    created_at: overrides.created_at || 100,
    content: 'A public proxy.',
    tags: [
      ['d', overrides.d || 'cors-proxy:community-wikis'],
      ['title', 'Community Wiki CORS Proxy'],
      ['summary', 'Allowlisted browser proxy'],
      ['service', 'cors-proxy'],
      ['status', 'active'],
      ['request', 'nip17'],
      ['p', 'd'.repeat(64), 'wss://relay.guaka.org', 'contact'],
      ['endpoint', overrides.endpoint || 'https://relay.guaka.org/proxy'],
      ['proxy_route', overrides.proxy_route || 'nomadwiki.org'],
      ['t', 'nostr-service-advert'],
      ['t', 'service:cors-proxy'],
      ['t', 'status:active'],
      ['t', 'access:public']
    ]
  };
}

test('static shell is backend-free, Pages-safe, and public-source linked', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /<script src="\.\/index\.js"><\/script>/);
  assert.match(html, /<script src="\.\.\/\.\.\/site-chrome-identity\.js"><\/script>/);
  assert.match(html, /href="\.\.\/\.\.\/"/);
  assert.match(html, /class="header-title"><a href="\/examples\/wikistr\/#trustroots-wiki\/Wikistr"><span>Wikistr<\/span><\/a><\/h1>/);
  assert.match(html, /html\.is-in-nostroots-browser \.header-brand/);
  assert.match(html, /\.wiki-switcher \{\s*flex-wrap: nowrap;/);
  assert.match(html, /content: "★"/);
  assert.match(html, /aria-label="Android"/);
  assert.match(html, /aria-label="iOS"/);
  assert.match(html, /id="build-time"/);
  assert.match(html, /id="nostr-key-status"/);
  assert.match(html, /id="trustroots-identity-status"/);
  assert.match(html, /id="nomadwiki-edit-link"/);
  assert.match(html, /wss:\/\/relay\.trustroots\.org/);
  assert.doesNotMatch(html, /id="status"/);
  assert.doesNotMatch(html, /id="reload-wikis"/);
  assert.doesNotMatch(html, /id="signer-identity"/);
  assert.doesNotMatch(html, /Background<\/a>/);
  assert.doesNotMatch(html, /Read-only MediaWiki surfaces discovered from public Nostr service adverts\./);
  assert.doesNotMatch(html, /Edit this page/);
  assert.doesNotMatch(html, /<iframe\b/i);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /\/api\//i);
  assert.doesNotMatch(html, /data-wiki=/);
});

test('removes private-wiki strings, credentials, private source links, and fruit icons', () => {
  const combined = [
    fs.readFileSync(htmlPath, 'utf8'),
    fs.readFileSync(appPath, 'utf8'),
    fs.readFileSync(readmePath, 'utf8')
  ].join('\n');

  const forbiddenWords = [
    ['m', 'elancia'],
    ['con', 'vidado'],
    ['bem', 'vindo'],
    ['hitchwiki', '-private'],
    ['allowed', 'Nip05'],
    ['water', 'melon']
  ].map((parts) => new RegExp(parts.join(''), 'i'));
  for (const forbidden of forbiddenWords) {
    assert.doesNotMatch(combined, forbidden);
  }
  assert.doesNotMatch(combined, new RegExp(String.fromCodePoint(0x1f349)));
});

test('parses and validates service wiki and cors proxy adverts', () => {
  const { app } = loadApp();
  const wiki = wikiAdvert();
  const proxy = proxyAdvert();

  assert.equal(app.isServiceAdvert(wiki), true);
  assert.equal(app.isServiceAdvert(proxy), true);
  assert.equal(app.serviceFromTags(wiki), 'wiki');
  assert.equal(app.serviceFromTags(proxy), 'cors-proxy');
  assert.equal(app.slugFromAdvert(wiki), 'nomadwiki');
  assert.equal(app.proxyEndpointFromAdvert(proxy), 'https://relay.guaka.org/proxy');
});

test('rejects malformed adverts and invalid proxy endpoints', () => {
  const { app } = loadApp();
  const missingSummary = wikiAdvert();
  missingSummary.tags = missingSummary.tags.filter((tag) => tag[0] !== 'summary');
  const missingTopic = wikiAdvert();
  missingTopic.tags = missingTopic.tags.filter((tag) => !(tag[0] === 't' && tag[1] === 'nostr-service-advert'));
  const proxy = proxyAdvert({ endpoint: 'ftp://relay.example/proxy' });

  assert.equal(app.isServiceAdvert(missingSummary), false);
  assert.equal(app.isServiceAdvert(missingTopic), false);
  assert.equal(app.proxyEndpointFromAdvert(proxy), '');
});

test('extracts Trustroots NIP-05 identity from signer profile events', () => {
  const { app } = loadApp();
  const pubkey = 'a'.repeat(64);

  assert.equal(app.extractTrustrootsNip05([
    {
      id: '1'.repeat(64),
      pubkey,
      kind: 0,
      created_at: 100,
      content: '{"nip05":"TheFriendlyHost@trustroots.org"}',
      tags: []
    }
  ], pubkey), 'thefriendlyhost@trustroots.org');

  assert.equal(app.extractTrustrootsNip05([
    {
      id: '2'.repeat(64),
      pubkey,
      kind: 10390,
      created_at: 100,
      content: '',
      tags: [['l', 'thefriendlyhost', 'org.trustroots:username']]
    }
  ], pubkey), 'thefriendlyhost@trustroots.org');

  assert.equal(app.extractTrustrootsNip05([
    {
      id: '3'.repeat(64),
      pubkey: 'b'.repeat(64),
      kind: 30390,
      created_at: 100,
      content: '{"trustrootsUsername":"TheFriendlyHost"}',
      tags: [['p', pubkey]]
    }
  ], pubkey), 'thefriendlyhost@trustroots.org');
});

test('de-duplicates addressable adverts by newest timestamp then lower event id', () => {
  const { app } = loadApp();
  const old = wikiAdvert({ id: 'z', created_at: 100, title: 'Old' });
  const sameTimeHigh = wikiAdvert({ id: 'z', created_at: 200, title: 'High' });
  const sameTimeLow = wikiAdvert({ id: 'a', created_at: 200, title: 'Low' });

  const deduped = app.dedupeAddressableAdverts([old, sameTimeHigh, sameTimeLow]);

  assert.equal(deduped.length, 1);
  assert.equal(app.tagValue(deduped[0], 'title'), 'Low');
});

test('caches service adverts in localStorage', () => {
  const localStorage = makeLocalStorage();
  const { app } = loadApp('http://localhost:8788/index.html', { localStorage });
  const events = [wikiAdvert(), proxyAdvert()];

  assert.equal(app.cacheServiceAdverts(events), true);

  const cached = app.loadCachedServiceAdverts();
  assert.equal(cached.length, 2);
  assert.equal(cached[0].kind, 31388);
  assert.equal(cached.some((event) => event.tags.some((tag) => tag[0] === 'service' && tag[1] === 'wiki')), true);
  assert.equal(cached.some((event) => event.tags.some((tag) => tag[0] === 'service' && tag[1] === 'cors-proxy')), true);
});

test('ignores stale cached service adverts', () => {
  const localStorage = makeLocalStorage({
    'wikistr:service-adverts:v1': JSON.stringify({
      version: 1,
      cachedAt: 1,
      events: [wikiAdvert(), proxyAdvert()]
    })
  });
  const { app } = loadApp('http://localhost:8788/index.html', { localStorage });

  assert.equal(app.loadCachedServiceAdverts(1 + 25 * 60 * 60 * 1000).length, 0);
  assert.equal(localStorage.getItem('wikistr:service-adverts:v1'), null);
});

test('builds wiki configs from advert tags and matching proxy route', () => {
  const { app } = loadApp();
  const configs = app.buildWikiConfigs([wikiAdvert(), proxyAdvert()]);

  assert.equal(configs.length, 1);
  assert.equal(configs[0].slug, 'nomadwiki');
  assert.equal(configs[0].wikiOrigin, 'https://nomadwiki.org');
  assert.equal(configs[0].wikiPath, '/wiki');
  assert.equal(configs[0].wikiApiPath, '/api.php');
  assert.equal(configs[0].wikiLoadPath, '/index.php');
  assert.equal(configs[0].wikiMainPagePath, '/wiki/en/Main_Page');
  assert.equal(configs[0].wikiMainPageTitle, 'Main_Page');
  assert.equal(configs[0].wikiApiProxy, 'https://relay.guaka.org/proxy/nomadwiki.org');
});

test('builds multiple wiki configs and sorts them by title', () => {
  const { app } = loadApp();
  const proxy = proxyAdvert();
  proxy.tags.push(['proxy_route', 'alpha.example']);
  const alpha = wikiAdvert({
    d: 'wiki:alpha',
    title: 'Alpha Wiki',
    origin: 'https://alpha.example',
    proxy_route: 'alpha.example'
  });
  const nomad = wikiAdvert({ title: 'Nomadwiki' });

  const configs = app.buildWikiConfigs([nomad, alpha, proxy]);

  assert.deepEqual(configs.map((config) => config.slug), ['alpha', 'nomadwiki']);
  assert.deepEqual(configs.map((config) => config.wikiApiProxy), [
    'https://relay.guaka.org/proxy/alpha.example',
    'https://relay.guaka.org/proxy/nomadwiki.org'
  ]);
});

test('does not build wiki configs without a matching advertised proxy route', () => {
  const { app } = loadApp();
  const configs = app.buildWikiConfigs([
    wikiAdvert({ proxy_route: 'nomadwiki.org' }),
    proxyAdvert({ proxy_route: 'other.example' })
  ]);

  assert.equal(configs.length, 0);
});

test('derives main page titles when adverts omit an explicit title tag', () => {
  const { app } = loadApp();
  const wiki = wikiAdvert({ wiki_main_page_path: '/wiki/en/Welcome' });
  wiki.tags = wiki.tags.filter((tag) => tag[0] !== 'wiki_main_page_title');
  const [config] = app.buildWikiConfigs([wiki, proxyAdvert()]);

  assert.equal(config.wikiMainPageTitle, 'en/Welcome');
});

test('defaults to Nomadwiki when the hash route is empty', async () => {
  const { app } = loadApp('http://localhost:8788/examples/wikistr/');
  const configs = await app.discoverAdverts([]);

  app.selectInitialWiki(configs);

  assert.equal(app.state.activeWiki?.slug, 'nomadwiki');
  assert.equal(app.DEFAULT_WIKI_SLUG, 'nomadwiki');
});

test('returns to the active wiki main page when its switcher is selected', async () => {
  const { app } = loadApp('http://localhost:8788/#nomadwiki/Category%3AVisa', {
    nostr: {
      signEvent: async (event) => event
    }
  });
  const [config] = app.buildWikiConfigs([wikiAdvert(), proxyAdvert()]);
  app.setActiveWikiForTest(config, 'Category:Visa');

  await app.switchWiki('nomadwiki');

  assert.equal(app.state.activeWiki, config);
  assert.equal(app.state.currentPage, '');
});

test('keeps route hashes stable from advert slugs', () => {
  const { app } = loadApp('http://localhost:8788/#nomadwiki/en/Lisbon%20Guide');
  const configs = app.buildWikiConfigs([wikiAdvert(), proxyAdvert()]);
  app.setWikiConfigsForTest(configs, 'nomadwiki');

  assert.deepEqual(
    JSON.parse(JSON.stringify(app.parseHashRoute(configs))),
    { slug: 'nomadwiki', page: 'en/Lisbon Guide' }
  );
  assert.equal(app.routeHashFor('nomadwiki', 'en/Lisbon'), '#nomadwiki/en/Lisbon');
  assert.equal(app.routeHashFor('nomadwiki', 'Main Page'), '#nomadwiki/Main%20Page');
  assert.equal(app.routeHashFor('', 'Page'), '');
});

test('keeps unknown hash slugs out of active routing while preserving the decoded page', () => {
  const { app } = loadApp('http://localhost:8788/#unknown/Page%20Name');
  const configs = app.buildWikiConfigs([wikiAdvert(), proxyAdvert()]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(app.parseHashRoute(configs))),
    { slug: null, page: 'Page Name' }
  );
});

test('builds proxied API and render URLs from the active advert config', () => {
  const { app } = loadApp('http://localhost:8788/#nomadwiki/en/Lisbon');
  const [config] = app.buildWikiConfigs([wikiAdvert(), proxyAdvert()]);
  app.setActiveWikiForTest(config, 'en/Lisbon');

  const api = new URL(app.buildWikiApiURLWithQuery({ action: 'parse', page: 'en/Lisbon' }, true));
  assert.equal(api.origin, 'https://relay.guaka.org');
  assert.equal(api.pathname, '/proxy/nomadwiki.org/api.php');
  assert.equal(api.searchParams.get('page'), 'en/Lisbon');

  const parsed = new URL(app.buildMainPageParseURL(true));
  assert.equal(parsed.searchParams.get('redirects'), '1');

  const render = new URL(app.buildMainPageRenderURL(true));
  assert.equal(render.pathname, '/proxy/nomadwiki.org/index.php');
  assert.equal(render.searchParams.get('title'), 'en/Lisbon');

  assert.equal(app.surfacePageHref('Another Page'), '#nomadwiki/Another%20Page');
});

test('builds Nomadwiki edit links via Special:NostrLogin with edit returntoquery', () => {
  const { app, elements } = loadApp('http://localhost:8788/#nomadwiki');
  const [config] = app.buildWikiConfigs([wikiAdvert(), proxyAdvert()]);

  app.setActiveWikiForTest(config, '');
  assert.equal(app.isViewingMainPage(config, ''), true);
  assert.equal(app.isViewingMainPage(config, 'Main_Page'), true);

  const mainEdit = app.buildNomadwikiEditHref('');
  assert.match(mainEdit, /^https:\/\/nomadwiki\.org\/index\.php\?/);
  assert.match(mainEdit, /title=Special%3ANostrLogin/);
  assert.match(mainEdit, /returnto=Main\+Page/);
  assert.match(mainEdit, /returntoquery=action%3Dedit(?:&|$)/);
  assert.doesNotMatch(mainEdit, /returntoquery=action=edit/);

  app.setActiveWikiForTest(config, 'en/Lisbon Guide');
  const pageEdit = app.buildNomadwikiEditHref('en/Lisbon Guide');
  assert.match(pageEdit, /returnto=en%2FLisbon\+Guide/);
  assert.match(pageEdit, /returntoquery=action%3Dedit(?:&|$)/);

  app.setActiveWikiForTest(config, 'Bargaining');
  const bargainEdit = app.buildNomadwikiEditHref('Bargaining');
  assert.match(bargainEdit, /returnto=Bargaining(?:&|$)/);
  assert.doesNotMatch(bargainEdit, /returnto=Main\+Page/);
  assert.equal(app.NOMADWIKI_EDIT_RETURN_QUERY, 'action%3Dedit');

  const hitchConfig = app.buildWikiConfig('hitchwiki');
  app.setActiveWikiForTest(hitchConfig, 'Main_Page');
  assert.equal(app.buildNomadwikiEditHref('Main_Page'), '');

  app.setActiveWikiForTest(config, 'Bargaining');
  assert.equal(app.buildWikiEditHref('Bargaining'), '');
  elements.get('trustroots-identity-status').dataset.state = 'connected';
  assert.match(app.buildWikiEditHref('Bargaining'), /title=Special%3ANostrLogin/);

  const [trashConfig] = app.buildWikiConfigs([
    wikiAdvert({ d: 'wiki:trashwiki', title: 'Trashwiki', origin: 'https://trashwiki.org', proxy_route: 'trashwiki.org' }),
    proxyAdvert({ proxy_route: 'trashwiki.org' })
  ]);
  app.setActiveWikiForTest(trashConfig, 'Reuse');
  assert.match(app.buildWikiEditHref(), /^https:\/\/trashwiki\.org\/index\.php\?/);
  assert.match(app.buildWikiEditHref(), /title=Special%3ANostrLogin/);
  assert.match(app.buildWikiEditHref(), /returnto=Reuse/);
  assert.match(app.buildWikiEditHref(), /returntoquery=action%3Dedit(?:&|$)/);

  const [trustrootsConfig] = app.buildWikiConfigs([
    wikiAdvert({ d: 'wiki:trustroots-wiki', title: 'Trustroots wiki', origin: 'https://wiki.trustroots.org', proxy_route: 'wiki.trustroots.org' }),
    proxyAdvert({ proxy_route: 'wiki.trustroots.org' })
  ]);
  app.setActiveWikiForTest(trustrootsConfig, 'Hosting');
  assert.match(app.buildWikiEditHref(), /^https:\/\/wiki\.trustroots\.org\/index\.php\?/);
  assert.match(app.buildWikiEditHref(), /title=Special%3ANostrLogin/);
  assert.match(app.buildWikiEditHref(), /returnto=Hosting/);
  assert.match(app.buildWikiEditHref(), /returntoquery=action%3Dedit(?:&|$)/);
});

test('keeps proxied resource URL helper for non-image callers', () => {
  const { app } = loadApp('http://localhost:8788/#nomadwiki/en/Lisbon');
  const [config] = app.buildWikiConfigs([wikiAdvert(), proxyAdvert()]);
  app.setActiveWikiForTest(config, 'en/Lisbon');

  assert.equal(
    app.proxiedWikiResourceUrl('https://nomadwiki.org/images/a.png?width=320'),
    'https://relay.guaka.org/proxy/nomadwiki.org/images/a.png?width=320'
  );
});

test('fallback discovery includes Wikivoyage with Wikimedia paths', async () => {
  const { app } = loadApp('http://localhost:8788/#wikivoyage/Paris');
  const configs = await app.discoverAdverts([]);
  const config = configs.find((item) => item.slug === 'wikivoyage');

  assert.ok(config);
  assert.equal(config.wikiOrigin, 'https://en.wikivoyage.org');
  assert.equal(config.wikiPath, '/wiki');
  assert.equal(config.wikiApiPath, '/w/api.php');
  assert.equal(config.wikiLoadPath, '/w/index.php');
  assert.equal(config.wikiMainPagePath, '/wiki/Main_Page');
  assert.equal(config.wikiMainPageTitle, 'Main Page');
  assert.equal(config.wikiApiProxy, 'https://relay.guaka.org/proxy/en.wikivoyage.org');

  app.setActiveWikiForTest(config, 'Paris');

  const api = new URL(app.buildWikiApiURLWithQuery({ action: 'parse', page: 'Paris' }, true));
  assert.equal(api.pathname, '/proxy/en.wikivoyage.org/w/api.php');

  const render = new URL(app.buildMainPageRenderURL(true));
  assert.equal(render.pathname, '/proxy/en.wikivoyage.org/w/index.php');

  assert.equal(app.surfacePageHref('Lisbon'), '#wikivoyage/Lisbon');
});

test('normalizes safe wiki resources and rejects script-like resource URLs', () => {
  const { app } = loadApp();
  const [config] = app.buildWikiConfigs([wikiAdvert(), proxyAdvert()]);
  app.setActiveWikiForTest(config);

  assert.equal(app.normalizeWikiResourceUrl('/images/a.png'), 'https://nomadwiki.org/images/a.png');
  assert.equal(app.normalizeWikiResourceUrl('mailto:hello@example.org'), 'mailto:hello@example.org');
  assert.equal(app.normalizeWikiResourceUrl('tel:+351123456789'), 'tel:+351123456789');
  assert.equal(app.normalizeWikiResourceUrl('javascript:alert(1)'), '');
  assert.equal(app.normalizeWikiResourceUrl('data:text/html,<h1>x</h1>'), '');
  assert.equal(app.normalizeWikiResourceUrl('file:///etc/passwd'), '');
  assert.equal(
    app.normalizeWikiSrcset('/images/a-small.png 1x, javascript:alert(1) 2x, /images/a-large.png 2x', true),
    'https://relay.guaka.org/proxy/nomadwiki.org/images/a-small.png 1x, https://relay.guaka.org/proxy/nomadwiki.org/images/a-large.png 2x'
  );
});

test('extracts same-wiki article titles and routes missing-page links safely', () => {
  const { app, elements } = loadApp();
  const [config] = app.buildWikiConfigs([wikiAdvert(), proxyAdvert()]);
  app.setActiveWikiForTest(config);

  assert.equal(app.wikiPageTitleFromUrl('https://nomadwiki.org/wiki/Foo_Bar'), 'Foo_Bar');
  assert.equal(app.wikiPageTitleFromUrl('https://nomadwiki.org/index.php?title=Foo_Bar'), 'Foo_Bar');
  assert.equal(app.wikiPageTitleFromUrl('https://nomadwiki.org/index.php?title=Foo_Bar&action=edit'), null);
  assert.equal(app.wikiPageTitleFromUrl('https://nomadwiki.org/wiki/Special:RecentChanges'), null);
  assert.equal(app.wikiPageTitleFromUrl('https://example.org/wiki/Foo_Bar'), null);

  // Nomadwiki's parser emits /en/... article URLs even though its advertised
  // wiki_path is /wiki. MediaWiki's title attribute is the canonical page
  // title Wikistr should keep inside its own hash router.
  assert.equal(app.wikiPageTitleFromLink('/en/Lisbon', 'Lisbon'), 'Lisbon');
  assert.equal(app.wikiPageTitleFromLink('/en/Free_camping', 'Free camping'), 'Free camping');
  assert.equal(app.wikiPageTitleFromLink('/en/Special:Statistics', 'Special:Statistics'), null);
  assert.equal(app.wikiPageTitleFromLink('#Transport', ''), null);
  assert.equal(app.wikiPageTitleFromLink('https://example.org/en/Lisbon', 'Lisbon'), null);
  assert.equal(app.wikiPageTitleFromLink('/index.php?title=Lisbon&action=history', 'Lisbon'), null);

  const redLink = '/index.php?title=Bangkok&action=edit&redlink=1';
  assert.equal(app.wikiRedLinkTitleFromUrl(redLink), 'Bangkok');
  assert.equal(app.buildWikiRedLinkHref(redLink), 'https://nomadwiki.org/index.php?title=Bangkok&action=edit&redlink=1');
  assert.equal(app.wikiRedLinkTitleFromUrl('/index.php?title=Bangkok&action=edit'), null);

  elements.get('trustroots-identity-status').dataset.state = 'connected';
  const nostrLoginHref = app.buildWikiRedLinkHref(redLink);
  assert.match(nostrLoginHref, /^https:\/\/nomadwiki\.org\/index\.php\?/);
  assert.match(nostrLoginHref, /title=Special%3ANostrLogin/);
  assert.match(nostrLoginHref, /returnto=Bangkok/);
  assert.match(nostrLoginHref, /returntoquery=action%3Dedit(?:&|$)/);
});

test('uses the parsed redirect target as the Wikistr route', () => {
  const { app } = loadApp('http://localhost:8788/#nomadwiki/Visa');
  const [config] = app.buildWikiConfigs([wikiAdvert(), proxyAdvert()]);
  app.setActiveWikiForTest(config, 'Visa');

  assert.equal(app.redirectedPageTitle({ title: 'Category:Visa' }), 'Category:Visa');
  assert.equal(app.redirectedPageTitle({ title: 'Visa' }), '');
  assert.equal(app.redirectedPageTitle({ title: 'Visa_Page' }), 'Visa_Page');
});

test('signs NIP-98 requests against the exact proxied URL', async () => {
  const signedEvents = [];
  const { app } = loadApp('http://localhost:8788/index.html', {
    nostr: {
      signEvent: async (event) => {
        signedEvents.push(event);
        return {
          ...event,
          id: 'event-id',
          pubkey: 'pubkey',
          sig: 'signature'
        };
      }
    }
  });
  const requestURL = 'https://relay.guaka.org/proxy/nomadwiki.org/api.php?action=query';

  const header = await app.buildWrapsterAuthHeader(requestURL, 'POST');
  const event = JSON.parse(fromB64(header.replace(/^Nostr\s+/, '')));

  assert.equal(header.startsWith('Nostr '), true);
  assert.equal(signedEvents.length, 1);
  assert.equal(event.kind, 27235);
  assert.deepEqual(event.tags, [['u', requestURL], ['method', 'POST']]);
  assert.equal(event.pubkey, 'pubkey');
  assert.equal(event.sig, 'signature');
});

test('fetches proxy-fallback images with NIP-98 authorization', async () => {
  const requests = [];
  const { app } = loadApp('http://localhost:8788/index.html', {
    nostr: {
      signEvent: async (event) => ({ ...event, id: 'event-id', pubkey: 'pubkey', sig: 'signature' })
    },
    fetch: async (url, init) => {
      requests.push({ url, authorization: init.headers.get('Authorization') });
      return { ok: true, blob: async () => ({}) };
    }
  });
  const imageURL = 'https://relay.guaka.org/proxy/trashwiki.org/images/reuse.png';

  const response = await app.wikiFetchResource(imageURL);

  assert.ok(response);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, imageURL);
  assert.match(requests[0].authorization, /^Nostr /);
});

test('uses NIP-42 relay auth when a relay requests it', async () => {
  const signedEvents = [];
  class FakeWebSocket {
    static OPEN = 1;
    constructor(url) {
      this.url = url;
      this.readyState = FakeWebSocket.OPEN;
      this.listeners = {};
      this.sent = [];
      FakeWebSocket.instance = this;
      setTimeout(() => this.emit('open'), 0);
      setTimeout(() => this.emit('message', { data: JSON.stringify(['AUTH', 'challenge']) }), 2);
    }
    addEventListener(name, fn) {
      this.listeners[name] = fn;
    }
    send(raw) {
      this.sent.push(JSON.parse(raw));
      const payload = this.sent[this.sent.length - 1];
      if (payload[0] === 'AUTH') {
        setTimeout(() => this.emit('message', { data: JSON.stringify(['OK', 'auth-id', true, '']) }), 0);
      } else if (payload[0] === 'REQ') {
        setTimeout(() => this.emit('message', { data: JSON.stringify(['EVENT', payload[1], wikiAdvert()]) }), 0);
        setTimeout(() => this.emit('message', { data: JSON.stringify(['EOSE', payload[1]]) }), 1);
      }
    }
    close() {}
    emit(name, event) {
      this.listeners[name]?.(event);
    }
  }

  const { app } = loadApp('http://localhost:8788/index.html', {
    WebSocket: FakeWebSocket,
    nostr: {
      signEvent: async (event) => {
        signedEvents.push(event);
        return { ...event, id: 'auth-id', pubkey: 'pubkey', sig: 'signature' };
      }
    }
  });

  const events = await app.relayEvents('wss://relay.example', { kinds: [31388], limit: 1 }, 'sub');

  assert.equal(events.length, 1);
  assert.equal(signedEvents[0].kind, 22242);
  assert.deepEqual(
    JSON.parse(JSON.stringify(signedEvents[0].tags)),
    [['relay', 'wss://relay.example'], ['challenge', 'challenge']]
  );
  assert.deepEqual(FakeWebSocket.instance.sent.map((payload) => payload[0]), ['AUTH', 'REQ', 'CLOSE']);
});

test('formats timestamps, comments, and redacts URL credentials in errors', () => {
  const { app } = loadApp();

  assert.equal(app.formatDateTime('2026-06-14T22:46:16Z'), '2026-06-14 22:46');
  assert.equal(
    app.formatChangeComment('/* Plans */ expanded <script>alert(1)</script>'),
    '<span class="rc-section">Plans</span><span class="rc-comment">expanded &lt;script&gt;alert(1)&lt;/script&gt;</span>'
  );
  const message = app.formatWikiFetchError({
    context: 'Recent changes',
    requestURL: 'https://user:pass@relay.guaka.org/proxy/nomadwiki.org/api.php',
    result: {
      ok: false,
      status: 401,
      body: { error: 'missing Nostr authorization' },
      rawBody: '{"error":"missing Nostr authorization"}'
    },
    useProxy: true
  });
  assert.match(message, /Nostroots app/);
  assert.match(message, /Nostroots Extension/);
  assert.doesNotMatch(message, /user:pass/);
  assert.doesNotMatch(message, /Wrapster proxy/);

  const missingSigner = app.formatWikiFetchError({
    context: 'Page load',
    requestURL: 'https://relay.guaka.org/proxy/hitchwiki.org/api.php?action=parse&page=Main_Page',
    result: {
      ok: false,
      status: 0,
      body: { error: 'No NIP-07 signer found for Wrapster auth.' },
      rawBody: ''
    },
    useProxy: true
  });
  assert.equal(missingSigner, app.formatMissingSignerHelpText());
  assert.match(app.formatMissingSignerHelpHTML(), /Nostroots Extension/);
  assert.match(app.formatMissingSignerHelpHTML(), /Nostroots app/);
  assert.equal(app.isMissingSignerWikiError({
    ok: false,
    status: 0,
    body: { error: 'No NIP-07 signer found for Wrapster auth.' }
  }), true);
});

test('renders recent changes grouped by title and clears loading status', () => {
  const { app, elements } = loadApp();
  const [config] = app.buildWikiConfigs([wikiAdvert(), proxyAdvert()]);
  app.setActiveWikiForTest(config);
  elements.get('changes-status').textContent = 'Loading recent changes...';

  app.renderRecentChanges([
    {
      title: 'Main Page',
      comment: '/* Intro */ first edit',
      timestamp: '2026-06-14T22:46:16Z',
      user: 'alice',
      revid: 12,
      old_revid: 11
    },
    {
      title: 'Main Page',
      comment: 'second edit',
      timestamp: '2026-06-14T23:00:00Z',
      user: 'bob'
    },
    {
      title: 'Other Page',
      comment: '',
      timestamp: '2026-06-15T08:05:00Z',
      user: 'carol'
    }
  ]);

  const recentChanges = elements.get('recent-changes');
  assert.equal(elements.get('changes-status').textContent, '');
  assert.equal(recentChanges.children.length, 2);
  assert.equal(recentChanges.children[0].children[0].textContent, 'Main Page');
  assert.equal(recentChanges.children[0].children[1].children.length, 2);
  assert.equal(recentChanges.children[1].children[0].textContent, 'Other Page');
});

test('renders an empty recent-change result as a status message', () => {
  const { app, elements } = loadApp();

  app.renderRecentChanges([]);

  assert.equal(elements.get('changes-status').textContent, 'No recent changes found.');
  assert.equal(elements.get('recent-changes').children.length, 0);
});

test('loads generated build info into the footer', async () => {
  const { app, elements } = loadApp('http://localhost:8788/index.html', {
    fetch: async (url) => {
      assert.equal(url, './build-info.json');
      return {
        ok: true,
        json: async () => ({ build_time: '2026-06-15 12:34' })
      };
    }
  });

  await app.loadBuildInfo();

  assert.equal(elements.get('build-time').textContent, '2026-06-15 12:34');
});

test('ignores malformed build info', async () => {
  const { app, elements } = loadApp('http://localhost:8788/index.html', {
    fetch: async () => ({
      ok: true,
      json: async () => ({ build_time: 'June 15' })
    })
  });

  elements.get('build-time').textContent = 'local';
  await app.loadBuildInfo();

  assert.equal(elements.get('build-time').textContent, 'local');
});

test('keeps local build-time fallback when build-info fetch fails', async () => {
  const { app, elements } = loadApp('http://localhost:8788/index.html', {
    fetch: async () => {
      throw new Error('not found');
    }
  });

  elements.get('build-time').textContent = 'local';
  await app.loadBuildInfo();

  assert.equal(elements.get('build-time').textContent, 'local');
});
