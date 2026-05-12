import { describe, it, expect } from 'vitest';
import {
    MAP_NOTE_INTENTS,
    MAP_NOTE_INTENT_IDS,
    isIntentId,
    getIntentById,
    detectNoteIntent,
    applyIntentHashtagToContent,
    pushIntentTag,
    stripLeadingIntentHashtag,
    pickLatestMapNotesByIntentType,
    hostMeetSnapshot,
    normalizeProfileHostMeetCard,
} from '../../index.js';

describe('note-intents', () => {
    it('exposes the locked-in vocabulary', () => {
        const ids = MAP_NOTE_INTENTS.map((i) => i.id);
        expect(ids).toEqual([
            'wanttomeet',
            'hosting',
            'lookingforhost',
            'localtips',
            'ride',
            'event',
        ]);
        expect(MAP_NOTE_INTENT_IDS.has('hosting')).toBe(true);
        expect(MAP_NOTE_INTENT_IDS.has('nope')).toBe(false);
    });

    it('isIntentId / getIntentById accept canonical ids only', () => {
        expect(isIntentId('hosting')).toBe(true);
        expect(isIntentId('Hosting')).toBe(true);
        expect(isIntentId(' wanttomeet ')).toBe(true);
        expect(isIntentId('travel')).toBe(false);
        expect(isIntentId(null)).toBe(false);
        expect(isIntentId(undefined)).toBe(false);
        expect(getIntentById('hosting')?.label).toBe('Hosting');
        expect(getIntentById('nope')).toBeNull();
    });

    it('applyIntentHashtagToContent prepends once, idempotently', () => {
        expect(applyIntentHashtagToContent('hello', 'hosting')).toBe('#hosting hello');
        expect(applyIntentHashtagToContent('#hosting hello', 'hosting')).toBe('#hosting hello');
        expect(applyIntentHashtagToContent('mid #hosting tag', 'hosting')).toBe('mid #hosting tag');
        expect(applyIntentHashtagToContent('hello', 'unknown')).toBe('hello');
        expect(applyIntentHashtagToContent('hello', null)).toBe('hello');
        expect(applyIntentHashtagToContent('   spaced   ', 'ride')).toBe('#ride spaced');
    });

    it('pushIntentTag adds a NIP-12 t-tag for known intents only', () => {
        const tags = [['expiration', '123']];
        pushIntentTag(tags, 'hosting');
        expect(tags).toEqual([
            ['expiration', '123'],
            ['t', 'hosting'],
        ]);
        pushIntentTag(tags, 'unknown');
        expect(tags).toHaveLength(2);
        pushIntentTag(tags, null);
        expect(tags).toHaveLength(2);
    });

    it('detectNoteIntent prefers t-tag over content hashtag', () => {
        const event = {
            tags: [['t', 'wanttomeet']],
            content: '#hosting hello',
        };
        expect(detectNoteIntent(event)).toBe('wanttomeet');
    });

    it('detectNoteIntent falls back to content hashtag', () => {
        expect(
            detectNoteIntent({ tags: [], content: 'come #localtips please' }),
        ).toBe('localtips');
        expect(detectNoteIntent({ tags: [], content: 'no intent here' })).toBeNull();
        expect(detectNoteIntent(null)).toBeNull();
    });

    it('stripLeadingIntentHashtag removes only the leading token', () => {
        expect(stripLeadingIntentHashtag('#hosting hello there', 'hosting')).toBe('hello there');
        expect(stripLeadingIntentHashtag('  #hosting   hi', 'hosting')).toBe('hi');
        // does not strip non-leading occurrences
        expect(stripLeadingIntentHashtag('hello #hosting', 'hosting')).toBe('hello #hosting');
        // does not strip a different intent
        expect(stripLeadingIntentHashtag('#wanttomeet hi', 'hosting')).toBe('#wanttomeet hi');
    });

    it('publish-shape: tagging + content prepend produce expected event tags and content', () => {
        let content = 'Tea this afternoon at the square';
        const tags = [
            ['expiration', '999'],
            ['L', 'open-location-code'],
            ['l', '9F3HC2J7+', 'open-location-code'],
        ];
        const intent = 'wanttomeet';
        content = applyIntentHashtagToContent(content, intent);
        pushIntentTag(tags, intent);
        expect(content).toBe('#wanttomeet Tea this afternoon at the square');
        expect(tags).toContainEqual(['t', 'wanttomeet']);
    });

    it('pickLatestMapNotesByIntentType keeps newest per real intent only, newest first', () => {
        const subject = 'a'.repeat(64);
        const notesSorted = [
            {
                id: 'old-hosting',
                kind: 30397,
                pubkey: subject,
                created_at: 100,
                content: '#hosting old',
                tags: [['t', 'hosting']],
            },
            {
                id: 'new-hosting',
                kind: 30397,
                pubkey: subject,
                created_at: 200,
                content: '#hosting new',
                tags: [['t', 'hosting']],
            },
            {
                id: 'want',
                kind: 30397,
                pubkey: subject,
                created_at: 150,
                content: '#wanttomeet hello',
                tags: [['t', 'wanttomeet']],
            },
            {
                id: 'untyped-new',
                kind: 30397,
                pubkey: subject,
                created_at: 180,
                content: 'plain note',
                tags: [],
            },
            {
                id: 'untyped-old',
                kind: 30397,
                pubkey: subject,
                created_at: 170,
                content: 'older plain note',
                tags: [],
            },
            {
                id: 'other-user',
                kind: 30397,
                pubkey: 'b'.repeat(64),
                created_at: 999,
                content: '#hosting ignore',
                tags: [['t', 'hosting']],
            },
        ];
        const hostMirrorEvents = [
            {
                id: 'ride-repost',
                kind: 30398,
                pubkey: 'c'.repeat(64),
                created_at: 250,
                content: '#ride ride-share',
                tags: [['p', subject], ['t', 'ride']],
            },
            {
                id: 'wrong-repost',
                kind: 30398,
                pubkey: 'c'.repeat(64),
                created_at: 300,
                content: '#ride ignore',
                tags: [['p', 'd'.repeat(64)], ['t', 'ride']],
            },
        ];

        const rows = pickLatestMapNotesByIntentType(notesSorted, hostMirrorEvents, subject);
        expect(rows).toHaveLength(3);
        expect(rows.map((row) => row.event.id)).toEqual([
            'ride-repost',
            'new-hosting',
            'want',
        ]);
        expect(rows.map((row) => row.intent.id)).toEqual([
            'ride',
            'hosting',
            'wanttomeet',
        ]);
    });

    it('hostMeetSnapshot preserves validation badge semantics per row', () => {
        const subject = 'f'.repeat(64);
        const notesSorted = [
            {
                id: 'ride-unvalidated',
                kind: 30397,
                pubkey: subject,
                created_at: 150,
                relayScope: 'public',
                content: '#ride ride to Lisbon',
                tags: [['t', 'ride']],
            },
        ];
        const hostMirrorEvents = [
            {
                id: 'hosting-validated',
                kind: 30398,
                pubkey: '1'.repeat(64),
                created_at: 200,
                content: '#hosting spare room',
                tags: [['p', subject], ['t', 'hosting']],
            },
        ];
        const snapshot = hostMeetSnapshot(
            notesSorted,
            hostMirrorEvents,
            0,
            subject,
            true,
            true,
        );

        expect(snapshot.rows).toHaveLength(2);
        expect(snapshot.rows[0].badgeText).toBe('Hosting');
        expect(snapshot.rows[0].badgeVariant).toBe('host');
        expect(snapshot.rows[1].badgeText).toBe('Ride');
        expect(snapshot.rows[1].badgeVariant).toBe('warn');
    });

    it('normalizeProfileHostMeetCard migrates legacy v1 payload to a v2 row', () => {
        const legacy = {
            title: 'Host & Meet',
            badgeText: 'Hosting',
            badgeVariant: 'host',
            summary: 'I can host',
            dateText: '2026-01-01 10:00',
            plusCode: '9F3HC2J7+',
            source: '',
        };
        const normalized = normalizeProfileHostMeetCard(legacy);
        expect(normalized).toBeTruthy();
        expect(normalized.title).toBe('Host & Meet');
        expect(normalized.badgeText).toBe('Hosting');
        expect(normalized.rows).toHaveLength(1);
        expect(normalized.rows[0]).toEqual({
            intentId: null,
            badgeText: 'Hosting',
            badgeVariant: 'host',
            summary: 'I can host',
            dateText: '2026-01-01 10:00',
            plusCode: '9F3HC2J7+',
            source: '',
        });
    });
});
