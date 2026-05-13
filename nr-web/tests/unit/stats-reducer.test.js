import { describe, expect, it } from 'vitest';
import { buildStatsSnapshotFromEvents } from '../../index.js';

const usernameNs = 'org.trustroots:username';
const circleNs = 'trustroots-circle';

function ev(id, kind, pubkey, created_at, tags = [], content = '') {
  return {
    id,
    kind,
    pubkey,
    created_at,
    tags,
    content,
    sig: 'sig',
  };
}

describe('stats reducer', () => {
  it('summarizes migration progress from observed relay events', () => {
    const now = 1_700_000_000;
    const alice = 'a'.repeat(64);
    const bob = 'b'.repeat(64);
    const carol = 'c'.repeat(64);
    const importer = 'd'.repeat(64);
    const events = [
      ev('profile-10390', 10390, alice, now - 100, [['l', 'alice', usernameNs]]),
      ev('profile-kind0', 0, bob, now - 200, [], JSON.stringify({ nip05: 'bob@trustroots.org' })),
      ev('profile-claim', 30390, importer, now - 20 * 86400, [
        ['p', carol],
        ['l', 'carol', usernameNs],
        ['l', 'hitch', circleNs],
      ]),
      ev('note-hosting', 30397, alice, now - 10, [
        ['l', '9G000000+', 'open-location-code'],
        ['t', 'hosting'],
      ]),
      ev('note-looking', 30398, bob, now - 8 * 86400, [
        ['d', '8F000000+'],
        ['t', 'lookingforhost'],
        ['l', 'hitch', circleNs],
      ]),
      ev('note-meet', 30397, carol, now - 40 * 86400, [['d', '7F000000+']], '#wanttomeet hello'),
      ev('relationship', 30392, importer, now - 50, [['p', alice], ['p', bob]]),
      ev('experience', 30393, importer, now - 40, [['p', bob], ['p', carol]]),
      ev('upvotes', 30394, importer, now - 30, [['p', alice]], JSON.stringify({ metric: 'threads_upvoted_by_others', value: 4 })),
      ev('circle-dir', 30410, importer, now - 60, [['d', 'hitch'], ['l', 'hitch', circleNs]]),
    ];

    const snapshot = buildStatsSnapshotFromEvents(events, {
      nowTimestamp: now,
      generatedAt: now * 1000,
      relaysConnected: 2,
      relaysTotal: 3,
      contributingRelays: 2,
    });

    expect(snapshot.identity).toEqual({
      observedTrustrootsIdentities: 3,
      linkedTrustrootsUsernames: 3,
      importedProfileClaims: 1,
      recentNewIdentities: 3,
    });
    expect(snapshot.hostMeet).toMatchObject({
      totalNotes: 3,
      hostMirrors: 1,
      notes24h: 1,
      notes7d: 1,
      notes30d: 2,
      activePosters: 3,
      activeAreas: 3,
    });
    expect(Object.fromEntries(snapshot.intents.map((row) => [row.id, row.count]))).toEqual({
      hosting: 1,
      lookingforhost: 1,
      wanttomeet: 1,
    });
    expect(snapshot.community).toEqual({
      relationshipClaims: 1,
      experienceReferences: 1,
      threadUpvoteMetrics: 1,
      uniqueClaimParticipants: 3,
    });
    expect(snapshot.circles.circleDirectoryCount).toBe(1);
    expect(snapshot.circles.topCircles[0]).toEqual({ slug: 'hitch', count: 3 });
    expect(snapshot.relays).toMatchObject({ online: 2, total: 3, contributing: 2 });
  });
});
