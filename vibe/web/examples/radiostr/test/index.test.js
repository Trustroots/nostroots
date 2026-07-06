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
  const listeners = Radiostr.aggregateListeners([older, newer, stale], 9000);
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
  assert.equal(Radiostr.isChatEvent(chat), true);
  assert.equal(Radiostr.isChatEvent(np), false);
});

test('index.html references channels.js and index.js', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /channels\.js/);
  assert.match(html, /index\.js/);
  assert.match(html, /Listening now/);
});
