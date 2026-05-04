import { describe, it, expect } from 'vitest';
import {
  extractRelationshipTargetsFromClaims,
  mergePTags,
  buildKind3Tags,
  buildTrustroots30000Tags,
  formatPubkeyShort,
  pickOtherPTag,
  getExperienceClaimSignPlan,
  getExperienceAuthorAndTarget,
  relationshipCounterpartyDisplay,
  experienceCounterpartyDisplay,
  trustrootsProfileUrl,
  parseRelationshipSuggestionUsernames,
} from '../../index.js';

const H = (ch) => String(ch).repeat(64);

describe('Claim Relationship Flow Helpers', () => {
  it('extracts other hex pubkeys when current appears in any p tag (order-independent)', () => {
    const A = H('a');
    const B = H('b');
    const C = H('c');
    const D = H('d');
    const claims = [
      { tags: [['p', A], ['p', B]] },
      { tags: [['p', C], ['p', D]] },
      { tags: [['p', B], ['p', A]] },
    ];
    const targets = extractRelationshipTargetsFromClaims(claims, A);
    expect(Array.from(targets).sort()).toEqual([B]);
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

  it('shortens long hex pubkeys for display', () => {
    const long = 'a'.repeat(64);
    expect(formatPubkeyShort(long)).toMatch(/^aaaaaaaa…aaaaaa$/);
    expect(formatPubkeyShort('abcd')).toBe('abcd');
  });

  it('pickOtherPTag returns the other party when both p tags are 64-hex pubkeys', () => {
    const A = H('a');
    const B = H('b');
    expect(pickOtherPTag([['p', A], ['p', B]], A)).toBe(B);
    expect(pickOtherPTag([['p', B], ['p', A]], A)).toBe(B);
    expect(pickOtherPTag([['p', A]], A)).toBe('');
    expect(pickOtherPTag([['p', 'aa'], ['p', 'bb']], 'aa')).toBe('');
  });
});

describe('Relationship suggestion display', () => {
  it('parseRelationshipSuggestionUsernames reads @a -> @b', () => {
    expect(
      parseRelationshipSuggestionUsernames('Trustroots relationship suggestion: @alice -> @bob'),
    ).toEqual(['alice', 'bob']);
  });

  it('relationshipCounterpartyDisplay prefers hex counterparty', () => {
    const me = H('a');
    const them = H('b');
    const disp = relationshipCounterpartyDisplay(
      [['p', me], ['p', them]],
      'Trustroots relationship suggestion: @x -> @y',
      me,
      'alice',
    );
    expect(disp.type).toBe('hex');
    expect(disp.hex).toBe(them);
  });

  it('relationshipCounterpartyDisplay uses parsed usernames when linked user matches', () => {
    const content = 'Trustroots relationship suggestion: @alice -> @bob';
    const disp = relationshipCounterpartyDisplay([], content, '', 'alice');
    expect(disp.type).toBe('user');
    expect(disp.usernames).toEqual(['bob']);
  });

  it('relationshipCounterpartyDisplay lists both profiles when Trustroots username not linked', () => {
    const content = 'Trustroots relationship suggestion: @alice -> @bob';
    const disp = relationshipCounterpartyDisplay([], content, '', '');
    expect(disp.type).toBe('users');
    expect(disp.usernames).toEqual(['alice', 'bob']);
  });
});

describe('Experience claim helpers', () => {
  const NS = 'org.trustroots:username';
  const author = H('a');
  const target = H('b');

  it('getExperienceAuthorAndTarget reads p hex blocks after d', () => {
    const tags = [
      ['d', 'x'],
      ['p', author],
      ['p', target],
    ];
    expect(getExperienceAuthorAndTarget(tags)).toEqual({
      author: { hex: author, username: '' },
      target: { hex: target, username: '' },
    });
  });

  it('getExperienceAuthorAndTarget reads L/l username for target', () => {
    const tags = [
      ['d', 'exp'],
      ['p', author],
      ['L', NS],
      ['l', 'carol', NS],
    ];
    const { author: au, target: ta } = getExperienceAuthorAndTarget(tags);
    expect(au).toEqual({ hex: author, username: '' });
    expect(ta).toEqual({ hex: '', username: 'carol' });
  });

  it('getExperienceClaimSignPlan allows author with hex target only', () => {
    const tags = [['d', 'e'], ['p', author], ['p', target]];
    expect(getExperienceClaimSignPlan(tags, author)).toEqual({
      canSign: true,
      targetHex: target,
      reason: '',
    });
    expect(getExperienceClaimSignPlan(tags, target).canSign).toBe(false);
  });

  it('getExperienceClaimSignPlan refuses when target has no hex', () => {
    const tags = [
      ['d', 'e'],
      ['p', author],
      ['L', NS],
      ['l', 'carol', NS],
    ];
    const plan = getExperienceClaimSignPlan(tags, author);
    expect(plan.canSign).toBe(false);
    expect(plan.reason).toBe('no_target_hex');
  });

  it('experienceCounterpartyDisplay shows username when viewer is author and target is username-only', () => {
    const tags = [
      ['d', 'e'],
      ['p', author],
      ['L', NS],
      ['l', 'carol', NS],
    ];
    const disp = experienceCounterpartyDisplay(tags, author);
    expect(disp).toEqual({ type: 'user', hex: '', username: 'carol' });
  });
});

describe('trustrootsProfileUrl', () => {
  it('builds profile URL', () => {
    expect(trustrootsProfileUrl('Alice')).toBe('https://www.trustroots.org/profile/alice');
  });
});
