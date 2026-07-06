import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const squatbridgeHtml = readFileSync(join(__dirname, '../../examples/squatbridge/index.html'), 'utf8');

function extractFunctionSource(name) {
  const start = squatbridgeHtml.indexOf(`  function ${name}(`);
  if (start === -1) throw new Error(`Could not find ${name} in squatbridge/index.html`);
  const next = squatbridgeHtml.indexOf('\n  function ', start + 1);
  if (next === -1) throw new Error(`Could not find end of ${name} in squatbridge/index.html`);
  return squatbridgeHtml.slice(start, next);
}

function loadShareTagBuilder() {
  const source = [
    'const PLUS_CODE_ALPHABET = "23456789CFGHJMPQRVWX";',
    'const GRID_SIZE = 20;',
    'const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];',
    'const LATITUDE_MAX = 90;',
    'const LONGITUDE_MAX = 180;',
    'const PLUS_CODE_PREFIX_MIN = 2;',
    'const state = { selectedCircles: new Set(["punks"]) };',
    extractFunctionSource('normalizeLongitude'),
    extractFunctionSource('encodePlusCode'),
    extractFunctionSource('getPlusCodePrefixes'),
    extractFunctionSource('getSelectedCircles'),
    extractFunctionSource('appendCircleTags'),
    extractFunctionSource('buildShareTags'),
    'return { buildShareTags };',
  ].join('\n');

  return new Function(source)();
}

describe('Squatbridge map-note publishing shape', () => {
  it('publishes shared map notes as kind 30397', () => {
    expect(squatbridgeHtml).toContain('const MAP_NOTE_KIND = 30397;');
    expect(squatbridgeHtml).toContain('drafts.push({ kind: MAP_NOTE_KIND, content, tags: mapTags });');
    expect(squatbridgeHtml).not.toContain('THIRD_PARTY_EVENT_KIND');
  });

  it('builds map-note compatible provenance and location tags', () => {
    const { buildShareTags } = loadShareTagBuilder();
    const tags = buildShareTags({
      nid: '123456',
      url: 'https://radar.squat.net/en/node/123456',
      coords: { lat: 52.52, lon: 13.405 },
      endUnix: 1_780_758_000,
    });

    expect(tags).toContainEqual(['d', 'squatbridge:radar:123456']);
    expect(tags).toContainEqual(['r', 'https://radar.squat.net/en/node/123456']);
    expect(tags).toContainEqual(['linkLabel', 'radar.squat.net']);
    expect(tags).toContainEqual(['L', 'open-location-code']);
    expect(tags).toContainEqual(['L', 'open-location-code-prefix']);
    expect(tags).toContainEqual(['L', 'trustroots-circle']);
    expect(tags).toContainEqual(['l', 'punks', 'trustroots-circle']);
    expect(tags).toContainEqual(['expiration', '1780844400']);

    const plusCodeTags = tags.filter((tag) => tag[0] === 'l' && tag[2] === 'open-location-code');
    expect(plusCodeTags).toHaveLength(1);
    expect(plusCodeTags[0][1]).toMatch(/^[23456789CFGHJMPQRVWX]{8}\+$/);

    const prefixTags = tags.filter((tag) => tag[0] === 'l' && tag[2] === 'open-location-code-prefix');
    expect(prefixTags.length).toBeGreaterThan(0);
    expect(prefixTags.every((tag) => tag.length === 3 && /^[23456789CFGHJMPQRVWX0]{8}\+$/.test(tag[1]))).toBe(true);
  });
});

describe('Squatbridge layout and Berlin prefetch', () => {
  it('keeps the flex layout chain that lets the map fill the viewport', () => {
    expect(squatbridgeHtml).toContain('class="sb-app"');
    expect(squatbridgeHtml).toMatch(/\.sb-app\s*\{[^}]*display:\s*flex/);
    expect(squatbridgeHtml).toMatch(/\.sb-app\s*\{[^}]*flex:\s*1/);
    expect(squatbridgeHtml).toMatch(/\.sb-app\s*\{[^}]*min-height:\s*0/);
    expect(squatbridgeHtml).toMatch(/#sb-map\s*\{[^}]*min-height:\s*0/);
    expect(squatbridgeHtml).toContain('function refreshMapSize()');
  });

  it('loads Berlin from static prefetch before localStorage and radar', () => {
    expect(squatbridgeHtml).toContain('function berlinStaticCacheUrl()');
    expect(squatbridgeHtml).toContain('squatbridge-data/city/berlin.json');
    expect(squatbridgeHtml).toContain('await tryBerlinStaticPrefetch(cacheKey, options)');
    const staticCallIdx = squatbridgeHtml.indexOf('await tryBerlinStaticPrefetch(cacheKey, options)');
    const radarIdx = squatbridgeHtml.indexOf('fetch(RADAR_API + "?" + params.toString())');
    expect(staticCallIdx).toBeGreaterThan(-1);
    expect(radarIdx).toBeGreaterThan(staticCallIdx);
  });

  it('uses shared Nostroots site chrome for the header', () => {
    expect(squatbridgeHtml).toContain('site-chrome.css');
    expect(squatbridgeHtml).toContain('site-chrome-identity.js');
    expect(squatbridgeHtml).toContain('id="nostr-key-status"');
    expect(squatbridgeHtml).toContain('id="nip7-info-modal"');
    expect(squatbridgeHtml).toMatch(/<\/header>\s*<div id="nip7-info-modal"/);
    expect(squatbridgeHtml).toContain('h1 class="sb-title"');
    expect(squatbridgeHtml).not.toContain('id="sb-signer"');
  });
});
