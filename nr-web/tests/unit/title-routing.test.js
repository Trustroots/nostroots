import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(() => {
  const src = readFileSync(join(__dirname, '../../index.js'), 'utf8');
  const m = src.match(/\/\* NR_TITLE_ROUTER_BEGIN \*\/([\s\S]*?)\/\* NR_TITLE_ROUTER_END \*\//);
  if (!m) throw new Error('NR_TITLE_ROUTER markers not found in index.js');
  (0, eval)(m[1]);
});

function resolve(classification) {
  if (typeof resolveNostrootsTitleFromRouteClassification !== 'function') {
    throw new Error('resolveNostrootsTitleFromRouteClassification not loaded');
  }
  return resolveNostrootsTitleFromRouteClassification(classification);
}

describe('Nostroots title routing', () => {
  it('handles map and account surfaces', () => {
    expect(resolve({ kind: 'map_home' })).toBe('Nostroots Map');
    expect(resolve({ kind: 'map_pluscode', plusCode: '9G000000+' })).toBe('Nostroots 9G000000+');
    expect(resolve({ kind: 'modal', modal: 'keys' })).toBe('Nostroots Keys');
    expect(resolve({ kind: 'modal', modal: 'settings' })).toBe('Nostroots Settings');
    expect(resolve({ kind: 'reserved', token: 'welcome' })).toBe('Nostroots Welcome');
    expect(resolve({ kind: 'stats' })).toBe('Nostroots Stats');
  });

  it('handles profile surfaces', () => {
    expect(resolve({ kind: 'profile', profileId: 'alice@trustroots.org' })).toBe('Nostroots alice@trustroots.org');
    expect(resolve({ kind: 'profile_edit', profileId: 'alice@trustroots.org' })).toBe('Nostroots alice@trustroots.org Edit');
    expect(resolve({ kind: 'profile_contacts', profileId: 'alice@trustroots.org' })).toBe('Nostroots alice@trustroots.org Contacts');
    expect(resolve({ kind: 'profile_invalid', profileId: 'bad*id' })).toBe('Nostroots Profile');
  });

  it('handles chat and fallback surfaces', () => {
    expect(resolve({ kind: 'chat', chatRoute: 'hitchhikers' })).toBe('Nostroots Chat');
    expect(resolve({ kind: 'unknown' })).toBe('Nostroots');
  });
});
