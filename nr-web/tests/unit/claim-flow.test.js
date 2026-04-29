import { describe, it, expect } from 'vitest';
import {
  extractRelationshipTargetsFromClaims,
  mergePTags,
  buildKind3Tags,
  buildTrustroots30000Tags,
} from '../../claim-utils.js';

describe('Claim Relationship Flow Helpers', () => {
  it('extracts targets only when first p-tag is current pubkey', () => {
    const current = 'aaaa';
    const claims = [
      { tags: [['p', 'aaaa'], ['p', 'bbbb']] },
      { tags: [['p', 'cccc'], ['p', 'dddd']] },
      { tags: [['p', 'AAAA'], ['p', 'eeee']] },
    ];
    const targets = extractRelationshipTargetsFromClaims(claims, current);
    expect(Array.from(targets)).toEqual(['bbbb', 'eeee']);
  });

  it('merges existing p tags with new targets without duplicates', () => {
    const existingTags = [['p', 'bbbb'], ['p', 'cccc'], ['e', 'ignore-me']];
    const merged = mergePTags(existingTags, new Set(['cccc', 'dddd']));
    expect(merged.sort()).toEqual(['bbbb', 'cccc', 'dddd']);
  });

  it('builds kind 3 tags from merged pubkeys', () => {
    const tags = buildKind3Tags(['bbbb', 'cccc']);
    expect(tags).toEqual([['p', 'bbbb'], ['p', 'cccc']]);
  });

  it('builds trustroots kind 30000 tags with d tag first', () => {
    const tags = buildTrustroots30000Tags(['bbbb', 'cccc']);
    expect(tags[0]).toEqual(['d', 'trustroots-contacts']);
    expect(tags.slice(1)).toEqual([['p', 'bbbb'], ['p', 'cccc']]);
  });
});

