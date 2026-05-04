import { describe, it, expect } from 'vitest';
import {
    TRUSTROOTS_CIRCLE_META_KIND,
    getCircleMetaDTagFromTags,
    parseCircleMetaContent,
    isSafeHttpUrl,
    mergeCircleMetadataMapEntry,
    normalizeTrustrootsCircleSlugKey
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

    it('normalizes hyphenated d tag to a single map key', () => {
        const map = new Map();
        const ev = {
            kind: TRUSTROOTS_CIRCLE_META_KIND,
            pubkey: importPk,
            created_at: 40,
            id: 'z1',
            tags: [['d', 'zero-wasters']],
            content: JSON.stringify({ name: 'Zero', about: '', picture: 'https://www.trustroots.org/uploads-circle/zero-wasters/742x496.jpg' })
        };
        expect(mergeCircleMetadataMapEntry(map, ev, { expectedPubkey: importPk })).toBe(true);
        const key = normalizeTrustrootsCircleSlugKey('zero-wasters');
        expect(key).toBe('zerowasters');
        expect(map.get('zerowasters').name).toBe('Zero');
        expect(map.has('zero-wasters')).toBe(false);
    });

    it('keeps trustroots uploads-circle picture for hitchhikers', () => {
        const map = new Map();
        const pic = 'https://www.trustroots.org/uploads-circle/hitchhikers/1400x900.webp';
        const ev = {
            kind: TRUSTROOTS_CIRCLE_META_KIND,
            pubkey: importPk,
            created_at: 30,
            id: 'h1',
            tags: [['d', 'HitchHikers']],
            content: JSON.stringify({ name: 'Hitchhikers', about: 'Road travel', picture: pic })
        };
        expect(mergeCircleMetadataMapEntry(map, ev, { expectedPubkey: importPk })).toBe(true);
        expect(map.get('hitchhikers').picture).toBe(pic);
        expect(isSafeHttpUrl(map.get('hitchhikers').picture)).toBe(true);
    });
});
