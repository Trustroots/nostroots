import { describe, it, expect } from 'vitest';
import {
    TRUSTROOTS_CIRCLE_META_KIND,
    getCircleMetaDTagFromTags,
    parseCircleMetaContent,
    isSafeHttpUrl,
    mergeCircleMetadataMapEntry
} from '../../circle-metadata.js';

describe('circle-metadata', () => {
    const importPk = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

    it('parses circle JSON content', () => {
        const c = parseCircleMetaContent(JSON.stringify({ name: 'Hitch', about: 'Road', picture: 'https://x/y.jpg' }));
        expect(c.name).toBe('Hitch');
        expect(c.about).toBe('Road');
        expect(c.picture).toBe('https://x/y.jpg');
    });

    it('getCircleMetaDTagFromTags lowercases slug', () => {
        expect(getCircleMetaDTagFromTags([['d', 'VanLife']])).toBe('vanlife');
    });

    it('isSafeHttpUrl rejects javascript', () => {
        expect(isSafeHttpUrl('https://example.com/a.jpg')).toBe(true);
        expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    });

    it('mergeCircleMetadataMapEntry ignores wrong author', () => {
        const map = new Map();
        const ev = {
            kind: TRUSTROOTS_CIRCLE_META_KIND,
            pubkey: 'a'.repeat(64),
            created_at: 100,
            id: 'id1',
            tags: [['d', 'hitch']],
            content: JSON.stringify({ name: 'H', about: '', picture: '' })
        };
        expect(mergeCircleMetadataMapEntry(map, ev, { expectedPubkey: importPk })).toBe(false);
        expect(map.size).toBe(0);
    });

    it('mergeCircleMetadataMapEntry keeps newer created_at', () => {
        const map = new Map();
        const oldEv = {
            kind: TRUSTROOTS_CIRCLE_META_KIND,
            pubkey: importPk,
            created_at: 10,
            id: 'a',
            tags: [['d', 'hitch']],
            content: JSON.stringify({ name: 'Old', about: 'x', picture: '' })
        };
        const newEv = {
            kind: TRUSTROOTS_CIRCLE_META_KIND,
            pubkey: importPk,
            created_at: 20,
            id: 'b',
            tags: [['d', 'hitch']],
            content: JSON.stringify({ name: 'New', about: 'y', picture: '' })
        };
        expect(mergeCircleMetadataMapEntry(map, oldEv, { expectedPubkey: importPk })).toBe(true);
        expect(mergeCircleMetadataMapEntry(map, newEv, { expectedPubkey: importPk })).toBe(true);
        expect(map.get('hitch').name).toBe('New');
        expect(mergeCircleMetadataMapEntry(map, oldEv, { expectedPubkey: importPk })).toBe(false);
        expect(map.get('hitch').name).toBe('New');
    });
});
