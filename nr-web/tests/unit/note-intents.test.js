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
} from '../../index.js';

describe('note-intents', () => {
    it('exposes the locked-in vocabulary', () => {
        const ids = MAP_NOTE_INTENTS.map((i) => i.id);
        expect(ids).toEqual([
            'hosting',
            'lookingforhost',
            'wanttomeet',
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
});
