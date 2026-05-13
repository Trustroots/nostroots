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
  trustrootsConversationStartFeedback,
  trustrootsMessageUrl,
  trustrootsProfileUrl,
  trustrootsUsernameFromNip05Address,
  profileResolutionFailureDetails,
  parseRelationshipSuggestionUsernames,
  getConfirmedTwoSidedContactCount,
  getConfirmedConnectedPubkeyContacts,
  getTrustCardConnectedPubkeyPeople,
  buildTrustCardSummaryFromEvents,
  trustCardPersonNip05,
  getClaimablePositiveReferenceCount,
  extractThreadUpvoteMetricValue,
  shouldShowThreadUpvoteMetric,
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

  it('builds message URL', () => {
    expect(trustrootsMessageUrl('Alice')).toBe('https://www.trustroots.org/messages/alice');
  });

  it('parses Trustroots NIP-05 addresses only', () => {
    expect(trustrootsUsernameFromNip05Address('Alice@trustroots.org')).toBe('alice');
    expect(trustrootsUsernameFromNip05Address('alice@www.trustroots.org')).toBe('alice');
    expect(trustrootsUsernameFromNip05Address('alice@example.org')).toBe('');
    expect(trustrootsUsernameFromNip05Address('not valid@trustroots.org')).toBe('');
  });

  it('describes conversation-start failures for Trustroots users', () => {
    expect(trustrootsConversationStartFeedback('Alice')).toEqual({
      message: "I couldn't find a Nostroots address for alice@trustroots.org. They may still need to add their public Nostr address (npub) on Trustroots before you can message them here.",
      actionHref: 'https://www.trustroots.org/messages/alice',
      actionLabel: 'Message on Trustroots',
    });
  });

  it('explains unresolved Trustroots profiles and links to Trustroots messages', () => {
    expect(profileResolutionFailureDetails('DoesntExist@trustroots.org')).toEqual({
      title: "We couldn't find this Nostr profile.",
      intro: 'Nostroots tried to look up DoesntExist@trustroots.org. Nostr profiles can be found by an npub (a public profile key) or by a NIP-05 address, which looks like username@trustroots.org and points to an npub.',
      next: 'That probably means doesntexist has not added their npub to Trustroots yet, or the Trustroots username is wrong.',
      trustrootsUsername: 'doesntexist',
      actionHref: 'https://www.trustroots.org/messages/doesntexist',
      actionLabel: 'Message doesntexist on Trustroots',
      invite: 'You can invite them to Nostroots from Trustroots and ask them to add their public Nostr address there.',
    });
  });
});

describe('Trust card count helpers', () => {
  it('counts only confirmed claimable relationship claims, deduped by source_id', () => {
    const me = H('a');
    const them = H('b');
    const events = [
      { id: 'one', kind: 30392, tags: [['p', me], ['p', them], ['claimable', 'true'], ['confirmed', 'true'], ['source_id', 'c1']] },
      { id: 'dupe', kind: 30392, tags: [['p', me], ['p', them], ['claimable', 'true'], ['confirmed', 'true'], ['source_id', 'c1']] },
      { id: 'old', kind: 30392, tags: [['p', me], ['p', them], ['claimable', 'true'], ['source_id', 'c2']] },
      { id: 'nope', kind: 30392, tags: [['p', me], ['p', them], ['confirmed', 'true']] },
      { id: 'other', kind: 30392, tags: [['p', them], ['claimable', 'true'], ['confirmed', 'true'], ['source_id', 'c3']] },
    ];
    expect(getConfirmedTwoSidedContactCount(events, me)).toBe(1);
  });

  it('lists confirmed claimable connected contacts that have npubs', () => {
    const me = H('a');
    const bob = H('b');
    const carol = H('c');
    const dana = H('d');
    const events = [
      {
        id: 'older-bob',
        kind: 30392,
        created_at: 10,
        tags: [['p', me], ['p', bob], ['claimable', 'true'], ['confirmed', 'true'], ['source_id', 'bob-old']],
        content: 'Trustroots relationship suggestion: @alice -> @oldbob',
      },
      {
        id: 'newer-bob',
        kind: 30392,
        created_at: 20,
        tags: [['p', me], ['p', bob], ['claimable', 'true'], ['confirmed', 'true'], ['source_id', 'bob-new']],
        content: 'Trustroots relationship suggestion: @alice -> @bob',
      },
      {
        id: 'carol',
        kind: 30392,
        created_at: 15,
        tags: [['p', carol], ['p', me], ['claimable', 'true'], ['confirmed', 'true'], ['source_id', 'carol']],
        content: 'Trustroots relationship suggestion: @carol -> @alice',
      },
      {
        id: 'username-only-other',
        kind: 30392,
        created_at: 30,
        tags: [['p', me], ['L', 'org.trustroots:username'], ['l', 'erin', 'org.trustroots:username'], ['claimable', 'true'], ['confirmed', 'true']],
        content: 'Trustroots relationship suggestion: @alice -> @erin',
      },
      {
        id: 'unconfirmed',
        kind: 30392,
        created_at: 40,
        tags: [['p', me], ['p', dana], ['claimable', 'true']],
        content: 'Trustroots relationship suggestion: @alice -> @dana',
      },
      {
        id: 'not-mine',
        kind: 30392,
        created_at: 50,
        tags: [['p', bob], ['p', dana], ['claimable', 'true'], ['confirmed', 'true']],
        content: 'Trustroots relationship suggestion: @bob -> @dana',
      },
    ];
    expect(getConfirmedConnectedPubkeyContacts(events, me, 'alice')).toEqual([
      { hex: bob, username: 'bob' },
      { hex: carol, username: 'carol' },
    ]);
  });

  it('finds the first profile when viewing the second side of a Contact', () => {
    const alice = H('a');
    const bob = H('b');
    const events = [
      {
        id: 'alice-bob',
        kind: 30392,
        created_at: 20,
        tags: [['p', alice], ['p', bob], ['claimable', 'true'], ['confirmed', 'true']],
        content: 'Trustroots relationship suggestion: @alice -> @bob',
      },
    ];
    expect(getTrustCardConnectedPubkeyPeople(events, bob, '')).toEqual([
      { hex: alice, username: 'alice', sources: ['contact'] },
    ]);
  });

  it('lists npub people from confirmed Contacts and positive Experiences', () => {
    const me = H('a');
    const bob = H('b');
    const carol = H('c');
    const dana = H('d');
    const events = [
      {
        id: 'contact',
        kind: 30392,
        created_at: 30,
        tags: [['p', me], ['p', bob], ['claimable', 'true'], ['confirmed', 'true']],
        content: 'Trustroots relationship suggestion: @alice -> @bob',
      },
      {
        id: 'experience-received',
        kind: 30393,
        created_at: 20,
        tags: [['d', 'e1'], ['p', carol], ['p', me], ['claimable', 'true']],
        content: 'A kind note from Carol',
      },
      {
        id: 'experience-left',
        kind: 30393,
        created_at: 10,
        tags: [['d', 'e2'], ['p', me], ['p', dana], ['claimable', 'true']],
        content: 'A kind note for Dana',
      },
      {
        id: 'unclaimable-experience',
        kind: 30393,
        created_at: 40,
        tags: [['d', 'e3'], ['p', H('e')], ['p', me]],
      },
    ];
    expect(getTrustCardConnectedPubkeyPeople(events, me, 'alice')).toEqual([
      { hex: bob, username: 'bob', sources: ['contact'] },
      { hex: carol, username: '', sources: ['experience'] },
      { hex: dana, username: '', sources: ['experience'] },
    ]);
  });

  it('builds cached Trust card summary from claim events', () => {
    const me = H('a');
    const bob = H('b');
    const carol = H('c');
    const events = [
      {
        id: 'contact',
        kind: 30392,
        created_at: 30,
        tags: [['p', me], ['p', bob], ['claimable', 'true'], ['confirmed', 'true'], ['source_id', 'c1']],
        content: 'Trustroots relationship suggestion: @alice -> @bob',
      },
      {
        id: 'experience',
        kind: 30393,
        created_at: 20,
        tags: [['d', 'e1'], ['p', me], ['p', carol], ['claimable', 'true'], ['source_id', 'e1']],
      },
      {
        id: 'metric',
        kind: 30394,
        created_at: 40,
        tags: [['p', me], ['claimable', 'true']],
        content: JSON.stringify({ metric: 'threads_upvoted_by_others', value: 3 }),
      },
    ];
    expect(buildTrustCardSummaryFromEvents(events, me, 'alice')).toEqual({
      contactCount: 1,
      positiveExperienceCount: 1,
      threadUpvoteMetricValue: 3,
      people: [
        { hex: bob, username: 'bob', sources: ['contact'] },
        { hex: carol, username: '', sources: ['experience'] },
      ],
    });
  });

  it('prefers NIP-05 labels for Trust card people', () => {
    expect(trustCardPersonNip05({ username: 'Alice' })).toBe('alice@trustroots.org');
    expect(trustCardPersonNip05({ username: 'alice' }, 'other@trustroots.org')).toBe('other@trustroots.org');
    expect(trustCardPersonNip05({ username: 'alice' }, 'not@example.com')).toBe('alice@trustroots.org');
    expect(trustCardPersonNip05({ username: '' })).toBe('');
  });

  it('counts only claimable positive references this user can sign, deduped by source_id', () => {
    const me = H('a');
    const them = H('b');
    const events = [
      { id: 'one', kind: 30393, tags: [['d', 'e1'], ['p', me], ['p', them], ['claimable', 'true'], ['source_id', 'e1']] },
      { id: 'dupe', kind: 30393, tags: [['d', 'e1'], ['p', me], ['p', them], ['claimable', 'true'], ['source_id', 'e1']] },
      { id: 'not-author', kind: 30393, tags: [['d', 'e2'], ['p', them], ['p', me], ['claimable', 'true'], ['source_id', 'e2']] },
      { id: 'not-claimable', kind: 30393, tags: [['d', 'e3'], ['p', me], ['p', them], ['source_id', 'e3']] },
    ];
    expect(getClaimablePositiveReferenceCount(events, me)).toBe(1);
  });

  it('parses newest valid thread-upvote metric', () => {
    const me = H('a');
    const events = [
      {
        id: 'older-valid',
        kind: 30394,
        created_at: 10,
        tags: [['p', me], ['claimable', 'true']],
        content: JSON.stringify({ metric: 'threads_upvoted_by_others', value: 4 }),
      },
      {
        id: 'newer-invalid',
        kind: 30394,
        created_at: 20,
        tags: [['p', me], ['claimable', 'true']],
        content: JSON.stringify({ metric: 'other', value: 99 }),
      },
      {
        id: 'newest-valid',
        kind: 30394,
        created_at: 30,
        tags: [['p', me], ['claimable', 'true']],
        content: JSON.stringify({ metric: 'threads_upvoted_by_others', value: 7 }),
      },
    ];
    expect(extractThreadUpvoteMetricValue(events, me)).toBe(7);
  });

  it('only displays positive thread-upvote metrics on profiles', () => {
    expect(shouldShowThreadUpvoteMetric(0)).toBe(false);
    expect(shouldShowThreadUpvoteMetric(null)).toBe(false);
    expect(shouldShowThreadUpvoteMetric(1)).toBe(true);
  });
});
