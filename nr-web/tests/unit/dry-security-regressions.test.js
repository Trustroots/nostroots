import { describe, it, expect } from 'vitest';
import {
    buildProfileHashRoute,
    getPlusCodeFromEvent,
    isTrustrootsAuthRelayUrl,
    linkifyTrustrootsUrls,
    nsecEncodeFromHex64,
    parsePubkeyInputNormalized,
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
});
