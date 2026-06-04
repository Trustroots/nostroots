import { describe, it, expect } from 'vitest';
import {
    containsPrivateKeyNsec,
    CHAT_NSEC_LEAK_FIXTURE,
    NSEC1_TOKEN_RE,
} from '../../index.js';

const FIXTURE_TOKEN = 'nsec1l53ku95egk2emglml9q4k5zt722axs4eplkq4sauqv2d2vz23h8smvgxx8';

describe('nsec in user messages (chat + notes guard)', () => {
    it('extracts the fixture nsec with the bech32 charset (includes "l")', () => {
        const m = CHAT_NSEC_LEAK_FIXTURE.match(NSEC1_TOKEN_RE);
        expect(m).toBeTruthy();
        expect(m[0]).toBe(FIXTURE_TOKEN);
    });

    it('treats the fixture as blocked when nip19.decode reports nsec', () => {
        const nip19 = {
            decode(s) {
                if (s === FIXTURE_TOKEN) return { type: 'nsec', data: new Uint8Array(32) };
                throw new Error('invalid');
            },
        };
        expect(containsPrivateKeyNsec(CHAT_NSEC_LEAK_FIXTURE, nip19)).toBe(true);
    });

    it('does not block when decode is not nsec', () => {
        const nip19 = {
            decode() {
                return { type: 'note' };
            },
        };
        expect(containsPrivateKeyNsec(CHAT_NSEC_LEAK_FIXTURE, nip19)).toBe(false);
    });

    it('does not flag bare npub-shaped tokens (regex must not match npub1 as nsec1)', () => {
        const nip19 = {
            decode(s) {
                if (s.startsWith('npub1')) return { type: 'npub', data: new Uint8Array(32) };
                throw new Error('invalid');
            },
        };
        expect(containsPrivateKeyNsec('hello npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq', nip19)).toBe(
            false
        );
    });
});
