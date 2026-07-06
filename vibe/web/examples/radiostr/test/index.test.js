const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'index.js');
const channelsPath = path.join(__dirname, '..', 'channels.js');
const htmlPath = path.join(__dirname, '..', 'index.html');

function loadRadiostr() {
  const channelsSource = fs.readFileSync(channelsPath, 'utf8');
  const appSource = fs.readFileSync(appPath, 'utf8');
  const sandbox = {
    window: {
      __RADIOSTR_TEST__: true,
      Radiostr: null,
      addEventListener() {},
      setInterval() {},
      setTimeout() {},
      clearInterval() {},
      clearTimeout() {},
      dispatchEvent() {}
    },
    document: {
      getElementById() {
        return null;
      },
      addEventListener() {}
    },
    location: { hash: '' },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {}
    },
    channels: null,
    sections: null,
    console
  };
  sandbox.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(channelsSource, sandbox);
  sandbox.channels = sandbox.channels;
  sandbox.sections = sandbox.sections;
  vm.runInContext(appSource, sandbox);
  return sandbox.window.Radiostr;
}

test('buildRadioData derives SomaFM stream URLs and sections', () => {
  const Radiostr = loadRadiostr();
  const built = Radiostr.buildRadioData(
    {
      groovesalad: { tags: ['soma'] },
      fip: {
        url: 'https://icecast.radiofrance.fr/fip-midfi.mp3',
        tags: ['fip']
      }
    },
    [
      { name: 'SomaFM', tags: ['soma'], order: 1 },
      { name: 'FIP', tags: ['fip'], order: 2 }
    ]
  );
  assert.equal(built.stations.length, 2);
  assert.match(built.stations[0].url, /ice1\.somafm\.com\/groovesalad-128-mp3/);
  assert.equal(built.sections.length, 2);
  assert.equal(built.sections[0].items[0].id, 'groovesalad');
});

test('parseHashRoute reads station id from hash', () => {
  const Radiostr = loadRadiostr();
  assert.equal(Radiostr.parseHashRoute('#groovesalad').stationId, 'groovesalad');
  assert.equal(Radiostr.parseHashRoute('').stationId, null);
});

test('buildNowPlayingTags include radiostr room and station', () => {
  const Radiostr = loadRadiostr();
  const tags = Radiostr.buildNowPlayingTags('defcon', 1_700_000_000_000);
  assert(Radiostr.hasTag(tags, 't', 'radiostr'));
  assert(Radiostr.hasTag(tags, 't', 'nowplaying'));
  assert.equal(Radiostr.tagValue(tags, 'radiostr_station'), 'defcon');
  assert.equal(Radiostr.tagValue(tags, 'client'), 'radiostr');
});

test('buildChatTags include channel and expiration', () => {
  const Radiostr = loadRadiostr();
  const tags = Radiostr.buildChatTags('paradise', 1_700_000_000_000);
  assert(Radiostr.hasTag(tags, 't', 'radiostr'));
  assert.equal(Radiostr.tagValue(tags, 'channel'), 'paradise');
  assert(Radiostr.tagValue(tags, 'expiration'));
});

test('parseNowPlayingEvent and aggregateListeners keep latest per pubkey', () => {
  const Radiostr = loadRadiostr();
  const older = {
    id: 'a',
    kind: 1,
    pubkey: 'aa'.repeat(32),
    content: 'Drone Zone',
    created_at: 1000,
    tags: [
      ['t', 'radiostr'],
      ['t', 'nowplaying'],
      ['radiostr_station', 'dronezone']
    ]
  };
  const newer = {
    id: 'b',
    kind: 1,
    pubkey: 'aa'.repeat(32),
    content: 'Groove Salad',
    created_at: 2000,
    tags: [
      ['t', 'radiostr'],
      ['t', 'nowplaying'],
      ['radiostr_station', 'groovesalad']
    ]
  };
  const stale = {
    id: 'c',
    kind: 1,
    pubkey: 'bb'.repeat(32),
    content: 'Lush',
    created_at: 100,
    tags: [
      ['t', 'radiostr'],
      ['t', 'nowplaying'],
      ['radiostr_station', 'lush']
    ]
  };
  const parsed = Radiostr.parseNowPlayingEvent(older);
  assert.equal(parsed.stationId, 'dronezone');
  assert.equal(parsed.title, 'Drone Zone');
  assert.equal(parsed.createdAt, 1000);
  assert.equal(parsed.eventId, 'a');
  const listeners = Radiostr.aggregateListeners([older, newer, stale], 2500);
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0].stationId, 'groovesalad');
});

test('isChatEvent excludes now-playing notes', () => {
  const Radiostr = loadRadiostr();
  const chat = {
    kind: 1,
    tags: [['t', 'radiostr'], ['channel', 'fip']]
  };
  const np = {
    kind: 1,
    tags: [['t', 'radiostr'], ['t', 'nowplaying'], ['radiostr_station', 'fip']]
  };
  const favorite = {
    kind: 1,
    tags: [
      ['t', 'radiostr'],
      ['t', 'favorite'],
      ['radiostr_station', 'groovesalad'],
      ['radiostr_action', 'star']
    ]
  };
  assert.equal(Radiostr.isChatEvent(chat), true);
  assert.equal(Radiostr.isChatEvent(np), false);
  assert.equal(Radiostr.isChatEvent(favorite), false);
});

test('buildFavoriteTags and parseFavoriteEvent encode station favorites', () => {
  const Radiostr = loadRadiostr();
  const station = { id: 'beatblender', title: 'Beat Blender' };
  const tags = Radiostr.buildFavoriteTags(station, 'star', 1_700_000_000_000);
  assert(Radiostr.hasTag(tags, 't', 'radiostr'));
  assert(Radiostr.hasTag(tags, 't', 'favorite'));
  assert.equal(Radiostr.tagValue(tags, 'radiostr_station'), 'beatblender');
  assert.equal(Radiostr.tagValue(tags, 'radiostr_action'), 'star');
  assert.equal(Radiostr.tagValue(tags, 'radiostr_title'), 'Beat Blender');
  assert(Radiostr.tagValue(tags, 'expiration'));
  const ev = {
    kind: 1,
    content: Radiostr.favoriteEventContent(station, true),
    created_at: 2000,
    tags
  };
  const parsed = Radiostr.parseFavoriteEvent(ev);
  assert.equal(parsed.stationId, 'beatblender');
  assert.equal(parsed.starred, true);
  assert.equal(parsed.createdAt, 2000);
});

test('mergeFavoriteTimeline keeps latest action and star order', () => {
  const Radiostr = loadRadiostr();
  const starGroove = {
    kind: 1,
    created_at: 1000,
    tags: [
      ['t', 'radiostr'],
      ['t', 'favorite'],
      ['radiostr_station', 'groovesalad'],
      ['radiostr_action', 'star']
    ]
  };
  const starDefcon = {
    kind: 1,
    created_at: 2000,
    tags: [
      ['t', 'radiostr'],
      ['t', 'favorite'],
      ['radiostr_station', 'defcon'],
      ['radiostr_action', 'star']
    ]
  };
  const unstarGroove = {
    kind: 1,
    created_at: 3000,
    tags: [
      ['t', 'radiostr'],
      ['t', 'favorite'],
      ['radiostr_station', 'groovesalad'],
      ['radiostr_action', 'unstar']
    ]
  };
  assert.equal(Radiostr.mergeFavoriteTimeline([starGroove, starDefcon]).join(','), 'defcon,groovesalad');
  assert.equal(Radiostr.mergeFavoriteTimeline([starGroove, starDefcon, unstarGroove]).join(','), 'defcon');
});

test('mergeStarredWithRemote preserves local-only stars', () => {
  const Radiostr = loadRadiostr();
  const remoteStar = {
    kind: 1,
    created_at: 1000,
    tags: [
      ['t', 'radiostr'],
      ['t', 'favorite'],
      ['radiostr_station', 'defcon'],
      ['radiostr_action', 'star']
    ]
  };
  const remoteUnstar = {
    kind: 1,
    created_at: 2000,
    tags: [
      ['t', 'radiostr'],
      ['t', 'favorite'],
      ['radiostr_station', 'groovesalad'],
      ['radiostr_action', 'unstar']
    ]
  };
  assert.equal(Radiostr.mergeStarredWithRemote(
    ['groovesalad', 'fip'],
    [remoteStar, remoteUnstar]
  ).join(','), 'defcon,fip');
});

test('toggleStarredId stars and unstars station ids', () => {
  const Radiostr = loadRadiostr();
  assert.deepEqual(Radiostr.toggleStarredId([], 'groovesalad'), ['groovesalad']);
  assert.deepEqual(Radiostr.toggleStarredId(['groovesalad'], 'groovesalad'), []);
  assert.deepEqual(Radiostr.toggleStarredId(['groovesalad'], 'defcon'), ['groovesalad', 'defcon']);
});

test('canChatFromIdentity requires a Trustroots NIP-05', () => {
  const Radiostr = loadRadiostr();
  assert.equal(Radiostr.canChatFromIdentity({ ready: true, nip05: 'alice@trustroots.org' }), true);
  assert.equal(Radiostr.canChatFromIdentity({ ready: true, nip05: '' }), false);
  assert.equal(Radiostr.canChatFromIdentity({ ready: false, nip05: 'alice@trustroots.org' }), false);
});

test('isTrustrootsChatAuthorForProfile hides authors without Trustroots NIP-05', () => {
  const Radiostr = loadRadiostr();
  assert.equal(Radiostr.isTrustrootsChatAuthorForProfile({ pending: true }), true);
  assert.equal(Radiostr.isTrustrootsChatAuthorForProfile({ nip05: 'alice@trustroots.org' }), true);
  assert.equal(Radiostr.isTrustrootsChatAuthorForProfile({ nip05: '' }), false);
  assert.equal(Radiostr.isTrustrootsChatAuthorForProfile({ noTrustroots: true }), false);
});

test('index.html references star controls', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /channels\.js/);
  assert.match(html, /index\.js/);
  assert.match(html, /id="star-btn"/);
  assert.match(html, /site-footer-build/);
  assert.match(html, /site-footer-build-commit/);
  assert.match(html, /Listening now/);
});

test('profilePageHref builds nr-web profile links', () => {
  const Radiostr = loadRadiostr();
  assert.equal(
    Radiostr.profilePageHref('thefriendlyhost@trustroots.org'),
    '../../web/#profile/thefriendlyhost%40trustroots.org'
  );
});

test('profileIdForPubkey prefers Trustroots NIP-05', () => {
  const Radiostr = loadRadiostr();
  Radiostr.state.profiles.set('abc', {
    nip05: 'thefriendlyhost@trustroots.org',
    npub: 'npub1example'
  });
  assert.equal(Radiostr.profileIdForPubkey('abc'), 'thefriendlyhost@trustroots.org');
});

test('channel catalog assigns brand favicons before remote artwork hydration', () => {
  const channelsSource = fs.readFileSync(channelsPath, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(channelsSource, sandbox);
  const catalog = sandbox.window.RADIOSTR_CHANNELS;
  assert.match(catalog.paradise.img, /google\.com\/s2\/favicons.*radioparadise\.com/);
  assert.match(catalog.fip.img, /google\.com\/s2\/favicons.*radiofrance\.fr/);
  assert.match(catalog.antena3.img, /google\.com\/s2\/favicons.*rtp\.pt/);
  assert.match(catalog.concertzender_jazz.img, /google\.com\/s2\/favicons.*concertzender\.nl/);
  assert.match(catalog.traxx_fm_ambient.img, /google\.com\/s2\/favicons.*traxx\.fm/);
  assert.match(catalog.flux_fm_lounge.img, /google\.com\/s2\/favicons.*fluxfm\.de/);
  assert.equal(catalog.groovesalad.img, undefined);
});
