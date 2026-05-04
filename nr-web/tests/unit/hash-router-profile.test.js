import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(() => {
  // nr-hash-router was inlined into index.html; extract by markers and eval.
  const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
  const m = html.match(/\/\* NR_HASH_ROUTER_BEGIN \*\/([\s\S]*?)\/\* NR_HASH_ROUTER_END \*\//);
  if (!m) throw new Error('NR_HASH_ROUTER markers not found in index.html');
  (0, eval)(m[1]);
});

function classify(route) {
  const H = globalThis.NrWebHashRouter;
  if (!H || typeof H.classify !== 'function') throw new Error('NrWebHashRouter not loaded');
  return H.classify(route);
}

describe('NrWebHashRouter profile routes', () => {
  it('classifies bare profile as own profile route', () => {
    expect(classify('profile')).toEqual({ kind: 'profile_self' });
  });

  it('classifies profile npub', () => {
    const npub = 'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d';
    expect(classify(`profile/${npub}`)).toEqual({ kind: 'profile', profileId: npub });
  });

  it('classifies profile hex', () => {
    const hex = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
    expect(classify(`profile/${hex}`)).toEqual({ kind: 'profile', profileId: hex });
  });

  it('classifies profile nip05 (decoded)', () => {
    expect(classify('profile/alice@trustroots.org')).toEqual({
      kind: 'profile',
      profileId: 'alice@trustroots.org',
    });
  });

  it('classifies encoded nostroots trustroots profile route', () => {
    expect(classify('profile/nostroots%40trustroots.org')).toEqual({
      kind: 'profile',
      profileId: 'nostroots@trustroots.org',
    });
  });

  it('classifies profile npub with /edit and /contacts (case-insensitive)', () => {
    const npub = 'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d';
    expect(classify(`profile/${npub}/edit`)).toEqual({ kind: 'profile_edit', profileId: npub });
    expect(classify(`profile/${npub}/CONTACTS`)).toEqual({ kind: 'profile_contacts', profileId: npub });
  });

  it('classifies profile nip05 with /edit', () => {
    expect(classify('profile/alice@trustroots.org/edit')).toEqual({
      kind: 'profile_edit',
      profileId: 'alice@trustroots.org',
    });
  });

  it('classifies invalid profile remainder', () => {
    expect(classify('profile/not-a-valid-id')).toEqual({
      kind: 'profile_invalid',
      profileId: 'not-a-valid-id',
    });
  });

  it('bare npub stays chat', () => {
    const npub = 'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d';
    expect(classify(npub)).toEqual({ kind: 'chat', chatRoute: npub });
  });

  it('coarse plus code stays map', () => {
    expect(classify('9G000000+')).toEqual({ kind: 'map_pluscode', plusCode: '9G000000+' });
  });
});
