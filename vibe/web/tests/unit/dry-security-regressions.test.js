import { describe, it, expect } from 'vitest';
import {
    buildLimitedMapNoteFilter,
    buildMapRelayKeepAliveFilter,
    buildMapRelayReadFilter,
    buildProfileDisplayLabel,
    buildProfileHashRoute,
    buildProfileLookupFilter,
    buildProfileMetadataFilter,
    getPlusCodeFromEvent,
    isTrustrootsAuthRelayUrl,
    linkifyTrustrootsUrls,
    nsecEncodeFromHex64,
    parsePubkeyInputNormalized,
    sanitizeProfileImageUrl,
} from '../../index.js';

const HEX_64 = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

describe('nr-web DRY/security regression helpers', () => {
    it('linkifyTrustrootsUrls escapes dangerous URL characters in anchors', () => {
        const input = 'See https://trustroots.org/path"onclick="alert(1) now';
        const html = linkifyTrustrootsUrls(input, 'message-inline-link nr-content-link');
        expect(html).not.toContain('" onclick=');
        expect(html).not.toContain('href="https://trustroots.org/path"onclick=');
        expect(html).toContain('message-inline-link nr-content-link');
        expect(html).toContain('%22onclick=%22');
    });

    it('getPlusCodeFromEvent supports open-location-code namespace and d-tag fallback', () => {
        expect(
            getPlusCodeFromEvent({
                tags: [['l', '9C5M8QQ7+V8', 'open-location-code-grid']],
            })
        ).toBe('9C5M8QQ7+V8');
        expect(
            getPlusCodeFromEvent({
                tags: [['d', '9c5m8qq7+v8']],
            })
        ).toBe('9C5M8QQ7+V8');
    });

    it('parsePubkeyInputNormalized lowercases hex and rejects nsec values', () => {
        expect(parsePubkeyInputNormalized(HEX_64.toUpperCase())).toBe(HEX_64);
        expect(parsePubkeyInputNormalized(nsecEncodeFromHex64(HEX_64))).toBe(null);
    });

    it('buildProfileHashRoute encodes IDs while keeping plus signs', () => {
        expect(buildProfileHashRoute('user+name@trustroots.org')).toBe('#profile/user+name%40trustroots.org');
    });

    it('isTrustrootsAuthRelayUrl matches trusted nip42 relay host', () => {
        expect(isTrustrootsAuthRelayUrl('wss://nip42.trustroots.org')).toBe(true);
        expect(isTrustrootsAuthRelayUrl('wss://relay.trustroots.org')).toBe(false);
    });

    it('centralizes relay filters used by map/profile/chat subscriptions', () => {
        expect(buildMapRelayReadFilter({ limit: 10000 })).toEqual({
            kinds: [0, 5, 10390, 30390, 30397, 30398],
            limit: 10000,
        });
        expect(buildMapRelayKeepAliveFilter()).toEqual({
            kinds: [0, 5, 10390, 30390, 30397, 30398],
            limit: 1,
        });
        expect(buildLimitedMapNoteFilter({ '#t': ['hosting-offer'] })).toEqual({
            kinds: [30397, 30398],
            limit: 10000,
            '#t': ['hosting-offer'],
        });
        expect(buildProfileLookupFilter([HEX_64], { limit: 6 })).toEqual({
            kinds: [0, 30390, 10390],
            authors: [HEX_64],
            limit: 6,
        });
        expect(buildProfileMetadataFilter([HEX_64], { limit: 30 })).toEqual({
            kinds: [0, 10390],
            authors: [HEX_64],
            limit: 30,
        });
    });

    it('centralizes profile display labels and image URL safety', () => {
        expect(buildProfileDisplayLabel(HEX_64, { trustrootsUsername: 'alice' })).toBe('alice@trustroots.org');
        expect(buildProfileDisplayLabel(HEX_64, { nip05: 'bob@example.org' })).toBe('bob@example.org');
        expect(buildProfileDisplayLabel(HEX_64, { short: true })).toMatch(/^npub1.+…[a-z0-9]{8}$/);
        expect(sanitizeProfileImageUrl('/uploads-profile/alice/avatar/256.jpg')).toBe('https://nos.trustroots.org/uploads-profile/alice/avatar/256.jpg');
        expect(sanitizeProfileImageUrl('javascript:alert(1)')).toBe('');
    });
});
