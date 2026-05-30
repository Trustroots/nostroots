import { describe, it, expect } from 'vitest';
import {
    TRUSTROOTS_CIRCLE_META_KIND,
    getCircleMetaDTagFromTags,
    parseCircleMetaContent,
    isSafeHttpUrl,
    mergeCircleMetadataMapEntry,
    normalizeTrustrootsCircleSlugKey,
    normalizeLegacyTrustrootsCircleAlias,
    trustrootsCircleWebSlugOverride,
    trustrootsCircleKeyAlias,
    canonicalTrustrootsCircleSlugKey,
    trustrootsCircleSlugFromPictureUrl,
    resolveTrustrootsCircleWebSlug,
    trustrootsCirclePageUrlFromMeta,
    trustrootsCirclePictureFallbackUrlFromMeta,
    extractCircleSlugsFromProfileClaim30390Event,
    parseCircleMemberProfileClaim30390,
    parseCircleMemberMapNoteClaimEvent,
    filterCircleMembersForDisplay,
    sortCircleMembersForDisplay
} from '../../index.js';

describe('circle-metadata', () => {
    const importPk = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

    it('parses circle JSON content', () => {
        const c = parseCircleMetaContent(JSON.stringify({ name: 'Hitch', about: 'Road', picture: 'https://x/y.jpg', slug: 'hitch-hikers' }));
        expect(c.name).toBe('Hitch');
        expect(c.about).toBe('Road');
        expect(c.picture).toBe('https://x/y.jpg');
        expect(c.slug).toBe('hitch-hikers');
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
        expect(map.get('hitchhikers').trustrootsSlug).toBe('hitchhikers');
        expect(isSafeHttpUrl(map.get('hitchhikers').picture)).toBe(true);
    });

    it('stores explicit trustroots slug when picture is absent', () => {
        const map = new Map();
        const ev = {
            kind: TRUSTROOTS_CIRCLE_META_KIND,
            pubkey: importPk,
            created_at: 31,
            id: 'rg1',
            tags: [['d', 'rainbowgathering']],
            content: JSON.stringify({ name: 'Rainbow Gathering', about: 'Gathering', picture: '', slug: 'rainbow-gathering' })
        };
        expect(mergeCircleMetadataMapEntry(map, ev, { expectedPubkey: importPk })).toBe(true);
        expect(map.get('rainbowgathering').trustrootsSlug).toBe('rainbow-gathering');
    });

    it('extracts hyphen-preserving trustroots slug from picture URL', () => {
        const pic = 'https://www.trustroots.org/uploads-circle/rainbow-gathering/742x496.jpg';
        expect(trustrootsCircleSlugFromPictureUrl(pic)).toBe('rainbow-gathering');
    });

    it('resolves trustroots web slug precedence: picture > content slug > fallback', () => {
        const fromPicture = resolveTrustrootsCircleWebSlug(
            { picture: 'https://www.trustroots.org/uploads-circle/rainbow-gathering/742x496.jpg', slug: 'wrong-slug' },
            'rainbowgathering'
        );
        expect(fromPicture).toBe('rainbow-gathering');

        const fromContentSlug = resolveTrustrootsCircleWebSlug(
            { picture: '', slug: 'rainbow-gathering' },
            'rainbowgathering'
        );
        expect(fromContentSlug).toBe('rainbow-gathering');

        const fromFallback = resolveTrustrootsCircleWebSlug(
            { picture: '', slug: '' },
            'rainbowgathering'
        );
        expect(fromFallback).toBe('rainbow-gathering');
    });

    it('uses canonical Trustroots web-slug overrides for dashless keys', () => {
        expect(trustrootsCircleWebSlugOverride('rainbowgathering')).toBe('rainbow-gathering');
        expect(trustrootsCircleWebSlugOverride('volunteers')).toBe('trustroots-volunteers');
        expect(trustrootsCircleWebSlugOverride('hitch')).toBe('hitchhikers');
        expect(trustrootsCircleWebSlugOverride('dumpsterdivers')).toBe('dumpster-divers');
        expect(trustrootsCircleWebSlugOverride('gardeners')).toBe('gardeners-farmers');
        expect(trustrootsCircleWebSlugOverride('scubadivers')).toBe('scuba-divers');
        expect(trustrootsCircleWebSlugOverride('beerbrewers')).toBe('beer-brewers');
        expect(trustrootsCircleWebSlugOverride('zerowasters')).toBe('zero-wasters');
        expect(trustrootsCircleWebSlugOverride('lightfoot')).toBe('');
    });

    it('uses canonical Nostr key aliases for legacy/user-entered variants', () => {
        expect(trustrootsCircleKeyAlias('hitchhikers')).toBe('hitch');
        expect(trustrootsCircleKeyAlias('trustroots-volunteers')).toBe('volunteers');
        expect(trustrootsCircleKeyAlias('gardenersfarmers')).toBe('gardeners');
        expect(trustrootsCircleKeyAlias('volunteers')).toBe('');
        expect(canonicalTrustrootsCircleSlugKey('hitchhikers')).toBe('hitch');
        expect(canonicalTrustrootsCircleSlugKey('trustroots-volunteers')).toBe('volunteers');
        expect(canonicalTrustrootsCircleSlugKey('gardenersfarmers')).toBe('gardeners');
    });

    it('builds trustroots circle page URL from hyphen-preserving slug', () => {
        const url = trustrootsCirclePageUrlFromMeta(
            { picture: 'https://www.trustroots.org/uploads-circle/rainbow-gathering/742x496.jpg', slug: '' },
            'rainbowgathering'
        );
        expect(url).toBe('https://www.trustroots.org/circles/rainbow-gathering');
    });

    it('builds trustroots circle fallback picture URL from explicit metadata slug', () => {
        const url = trustrootsCirclePictureFallbackUrlFromMeta(
            { picture: '', slug: 'rainbow-gathering' },
            'rainbowgathering'
        );
        expect(url).toBe('https://www.trustroots.org/uploads-circle/rainbow-gathering/1400x900.webp');
    });

    it('builds trustroots URLs from canonical web-slug overrides when metadata is missing', () => {
        const volunteersPage = trustrootsCirclePageUrlFromMeta({ picture: '', slug: '' }, 'volunteers');
        expect(volunteersPage).toBe('https://www.trustroots.org/circles/trustroots-volunteers');
        const hitchPic = trustrootsCirclePictureFallbackUrlFromMeta({ picture: '', slug: '' }, 'hitch');
        expect(hitchPic).toBe('https://www.trustroots.org/uploads-circle/hitchhikers/1400x900.webp');
        const scubaPic = trustrootsCirclePictureFallbackUrlFromMeta({ picture: '', slug: '' }, 'scubadivers');
        expect(scubaPic).toBe('https://www.trustroots.org/uploads-circle/scuba-divers/1400x900.webp');
        const dumpsterPic = trustrootsCirclePictureFallbackUrlFromMeta({ picture: '', slug: '' }, 'dumpsterdivers');
        expect(dumpsterPic).toBe('https://www.trustroots.org/uploads-circle/dumpster-divers/1400x900.webp');
        const gardenersPic = trustrootsCirclePictureFallbackUrlFromMeta({ picture: '', slug: '' }, 'gardenersfarmers');
        expect(gardenersPic).toBe('https://www.trustroots.org/uploads-circle/gardeners-farmers/1400x900.webp');
    });

    it('normalizes legacy trustroots-prefixed circle alias', () => {
        const known = new Set(['volunteers', 'rainbowgathering']);
        const isKnown = (candidate) => known.has(candidate);
        expect(normalizeLegacyTrustrootsCircleAlias('trustrootsvolunteers', isKnown)).toBe('volunteers');
        expect(normalizeLegacyTrustrootsCircleAlias('trustroots-rainbow-gathering', isKnown)).toBe('rainbowgathering');
    });

    it('keeps unknown trustroots-prefixed hashtags unchanged', () => {
        const known = new Set(['volunteers']);
        const isKnown = (candidate) => known.has(candidate);
        expect(normalizeLegacyTrustrootsCircleAlias('trustrootssomethingelse', isKnown)).toBe('trustrootssomethingelse');
    });

    it('parses circle members from imported profile claims', () => {
        const memberPk = 'b'.repeat(64);
        const ev = {
            id: 'profile1',
            kind: 30390,
            pubkey: importPk,
            created_at: 20,
            tags: [
                ['p', memberPk],
                ['l', 'rainbow-gathering', 'trustroots-circle'],
                ['l', 'alice', 'org.trustroots:username']
            ],
            content: JSON.stringify({
                display_name: 'Alice Traveller',
                trustrootsUsername: 'Alice',
                nip05: 'alice@trustroots.org',
                picture: 'https://example.com/alice.jpg'
            })
        };

        expect(extractCircleSlugsFromProfileClaim30390Event(ev)).toEqual(['rainbowgathering']);
        const member = parseCircleMemberProfileClaim30390(ev, 'rainbowgathering', { expectedPubkey: importPk });
        expect(member.pubkey).toBe(memberPk);
        expect(member.trustrootsUsername).toBe('alice');
        expect(member.nip05).toBe('alice@trustroots.org');
        expect(member.picture).toBe('https://example.com/alice.jpg');
        expect(member.profileId).toBe('alice@trustroots.org');
    });

    it('matches profile claim members across canonical circle aliases', () => {
        const memberPk = 'b'.repeat(64);
        const ev = {
            id: 'profile-alias',
            kind: 30390,
            pubkey: importPk,
            created_at: 22,
            tags: [['p', memberPk], ['l', 'hitchhikers', 'trustroots-circle']],
            content: JSON.stringify({ trustrootsUsername: 'bob', picture: 'https://example.com/bob.jpg' })
        };
        const member = parseCircleMemberProfileClaim30390(ev, 'hitch', { expectedPubkey: importPk });
        expect(extractCircleSlugsFromProfileClaim30390Event(ev)).toEqual(['hitch']);
        expect(member?.pubkey).toBe(memberPk);
        expect(member?.picture).toBe('https://example.com/bob.jpg');
    });

    it('ignores profile claims that cannot define a circle member', () => {
        const base = {
            id: 'profile2',
            kind: 30390,
            pubkey: importPk,
            created_at: 20,
            tags: [['p', 'c'.repeat(64)], ['l', 'hitchhikers', 'trustroots-circle']],
            content: JSON.stringify({ trustrootsUsername: 'bob' })
        };
        expect(parseCircleMemberProfileClaim30390(base, 'hitchhikers', { expectedPubkey: 'd'.repeat(64) })).toBe(null);
        expect(parseCircleMemberProfileClaim30390({ ...base, tags: [['l', 'hitchhikers', 'trustroots-circle']] }, 'hitchhikers', { expectedPubkey: importPk })).toBe(null);
        expect(parseCircleMemberProfileClaim30390({ ...base, tags: [['p', 'nothex'], ['l', 'hitchhikers', 'trustroots-circle']] }, 'hitchhikers', { expectedPubkey: importPk })).toBe(null);
        expect(parseCircleMemberProfileClaim30390(base, 'climbers', { expectedPubkey: importPk })).toBe(null);
    });

    it('accepts profile claims from any allowed expected pubkey', () => {
        const memberPk = 'c'.repeat(64);
        const validationPk = 'd'.repeat(64);
        const ev = {
            id: 'profile3',
            kind: 30390,
            pubkey: validationPk,
            created_at: 30,
            tags: [['p', memberPk], ['l', 'hackers', 'trustroots-circle']],
            content: JSON.stringify({ trustrootsUsername: 'carol' })
        };
        const member = parseCircleMemberProfileClaim30390(ev, 'hackers', {
            expectedPubkeys: [importPk, validationPk]
        });
        expect(member?.pubkey).toBe(memberPk);
        expect(member?.trustrootsUsername).toBe('carol');
    });

    it('parses circle members from claimable host mirrors authored by a trusted pubkey', () => {
        const memberPk = 'e'.repeat(64);
        const validationPk = 'f'.repeat(64);
        const ev = {
            id: 'host1',
            kind: 30398,
            pubkey: validationPk,
            created_at: 40,
            tags: [
                ['p', memberPk],
                ['claimable', 'true'],
                ['l', 'hackers', 'trustroots-circle'],
                ['trustroots', 'dana'],
                ['linkPath', '/profile/dana'],
                ['t', 'hackers']
            ],
            content: 'Hosting mirror'
        };
        const member = parseCircleMemberMapNoteClaimEvent(ev, 'hackers', {
            expectedPubkeys: [importPk, validationPk]
        });
        expect(member?.pubkey).toBe(memberPk);
        expect(member?.trustrootsUsername).toBe('dana');
        expect(member?.profileId).toBe('dana@trustroots.org');
    });

    it('parses trusted claimable host mirrors when the channel slug is provided by context', () => {
        const memberPk = '1'.repeat(64);
        const validationPk = '2'.repeat(64);
        const ev = {
            id: 'host2',
            kind: 30398,
            pubkey: validationPk,
            created_at: 41,
            tags: [
                ['p', memberPk],
                ['claimable', 'true'],
                ['trustroots', 'erin'],
                ['t', 'hackers']
            ],
            content: 'Host mirror tagged as a channel'
        };
        const member = parseCircleMemberMapNoteClaimEvent(ev, 'hackers', {
            expectedPubkeys: [validationPk],
            acceptedSlugs: ['hackers']
        });
        expect(member?.pubkey).toBe(memberPk);
        expect(member?.trustrootsUsername).toBe('erin');
    });

    it('parses trusted direct channel notes as author members when scoped to the channel', () => {
        const validationPk = 'f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b';
        const ev = {
            id: 'note1',
            kind: 30397,
            pubkey: validationPk,
            created_at: 42,
            tags: [['t', 'hackers']],
            content: 'another hackathon soon-ish #hackers'
        };
        const member = parseCircleMemberMapNoteClaimEvent(ev, 'hackers', {
            expectedPubkeys: [validationPk],
            acceptedSlugs: ['hackers']
        });
        expect(member?.pubkey).toBe(validationPk);
        expect(member?.trustrootsUsername).toBe('nostroots');
        expect(member?.profileId).toBe('nostroots@trustroots.org');
    });

    it('sorts and filters circle members for display', () => {
        const members = [
            { pubkey: 'b'.repeat(64), displayName: 'Beta', trustrootsUsername: 'beta', nip05: 'beta@trustroots.org', npub: 'npub-beta', created_at: 1 },
            { pubkey: 'a'.repeat(64), displayName: 'Alice', trustrootsUsername: 'alice', nip05: 'alice@trustroots.org', npub: 'npub-alice', created_at: 1 },
            { pubkey: 'b'.repeat(64), displayName: 'Beta New', trustrootsUsername: 'beta', nip05: 'beta@trustroots.org', npub: 'npub-beta', created_at: 2 }
        ];
        expect(sortCircleMembersForDisplay(members).map((m) => m.displayName)).toEqual(['Alice', 'Beta New']);
        expect(filterCircleMembersForDisplay(members, 'beta').map((m) => m.pubkey)).toEqual(['b'.repeat(64)]);
        expect(filterCircleMembersForDisplay(members, 'npub-alice').map((m) => m.pubkey)).toEqual(['a'.repeat(64)]);
    });
});
