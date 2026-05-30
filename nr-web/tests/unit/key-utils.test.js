import { describe, it, expect, beforeEach } from 'vitest';
import {
    NR_WEB_PRIVATE_KEY_STORAGE_KEY,
    isValidPrivateKeyHex64,
    secretKeyBytesFromHex64,
    readValidStoredKeyHex,
    writeStoredKeyHex,
    clearStoredKey,
    parseKeyImportToHex,
    getKeyImportErrorMessage,
    nsecEncodeFromHex64,
    inspectNip7Capabilities,
    nrWebNip7Signer,
} from '../../index.js';

const HEX_64 = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

describe('nr-web local key utils', () => {
    beforeEach(() => {
        try { localStorage.clear(); } catch (_) {}
        try { delete window.nostr; } catch (_) { window.nostr = undefined; }
        nrWebNip7Signer.pubkey = '';
    });

    it('uses the stable storage key name', () => {
        expect(NR_WEB_PRIVATE_KEY_STORAGE_KEY).toBe('nostr_private_key');
    });

    it('isValidPrivateKeyHex64 accepts only 64-char lowercase hex', () => {
        expect(isValidPrivateKeyHex64(HEX_64)).toBe(true);
        expect(isValidPrivateKeyHex64(HEX_64.toUpperCase())).toBe(false);
        expect(isValidPrivateKeyHex64(HEX_64.slice(0, 63))).toBe(false);
        expect(isValidPrivateKeyHex64('zz' + HEX_64.slice(2))).toBe(false);
        expect(isValidPrivateKeyHex64('')).toBe(false);
        expect(isValidPrivateKeyHex64(null)).toBe(false);
    });

    it('secretKeyBytesFromHex64 round-trips bytes', () => {
        const bytes = secretKeyBytesFromHex64(HEX_64);
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBe(32);
        const roundTripHex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
        expect(roundTripHex).toBe(HEX_64);
    });

    it('secretKeyBytesFromHex64 throws on bad hex', () => {
        expect(() => secretKeyBytesFromHex64('nope')).toThrow();
    });

    it('parseKeyImportToHex accepts 64-char hex (case-insensitive)', () => {
        expect(parseKeyImportToHex(HEX_64)).toEqual({ ok: true, hex: HEX_64 });
        expect(parseKeyImportToHex('  ' + HEX_64.toUpperCase() + '  ')).toEqual({ ok: true, hex: HEX_64 });
    });

    it('parseKeyImportToHex accepts an nsec1 and decodes via nostr-tools', () => {
        const nsec = nsecEncodeFromHex64(HEX_64);
        const parsed = parseKeyImportToHex(nsec);
        expect(parsed.ok).toBe(true);
        expect(parsed.hex).toBe(HEX_64);
    });

    it('parseKeyImportToHex accepts a 12-word BIP-39 mnemonic', () => {
        const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
        const parsed = parseKeyImportToHex(mnemonic);
        expect(parsed.ok).toBe(true);
        expect(/^[0-9a-f]{64}$/.test(parsed.hex)).toBe(true);
    });

    it('parseKeyImportToHex rejects empty input with kind=empty', () => {
        expect(parseKeyImportToHex('')).toEqual({ ok: false, kind: 'empty' });
        expect(parseKeyImportToHex('   ')).toEqual({ ok: false, kind: 'empty' });
    });

    it('parseKeyImportToHex flags pasted npub with kind=npub', () => {
        const npub = 'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d';
        expect(parseKeyImportToHex(npub)).toEqual({ ok: false, kind: 'npub' });
    });

    it('parseKeyImportToHex rejects invalid mnemonic with kind=invalid', () => {
        const bad = 'not a real bip39 mnemonic phrase at all just words here please';
        const parsed = parseKeyImportToHex(bad);
        expect(parsed.ok).toBe(false);
        expect(parsed.kind).toBe('invalid');
    });

    it('parseKeyImportToHex rejects malformed nsec', () => {
        const parsed = parseKeyImportToHex('nsec1invalid');
        expect(parsed.ok).toBe(false);
        expect(parsed.kind).toBe('invalid');
    });

    it('getKeyImportErrorMessage returns helpful copy for npub paste', () => {
        const npub = 'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d';
        const msg = getKeyImportErrorMessage(npub);
        expect(msg.toLowerCase()).toContain('npub');
        expect(msg).toMatch(/private/i);
    });

    it('getKeyImportErrorMessage returns mnemonic copy when input has spaces', () => {
        const msg = getKeyImportErrorMessage('not a valid mnemonic phrase here right now please');
        expect(msg.toLowerCase()).toContain('mnemonic');
    });

    it('write/read/clear stored key round-trips via localStorage', () => {
        expect(readValidStoredKeyHex()).toBe('');
        expect(writeStoredKeyHex(HEX_64)).toBe(true);
        expect(localStorage.getItem(NR_WEB_PRIVATE_KEY_STORAGE_KEY)).toBe(HEX_64);
        expect(readValidStoredKeyHex()).toBe(HEX_64);
        clearStoredKey();
        expect(readValidStoredKeyHex()).toBe('');
        expect(localStorage.getItem(NR_WEB_PRIVATE_KEY_STORAGE_KEY)).toBe(null);
    });

    it('readValidStoredKeyHex ignores malformed values without crashing', () => {
        localStorage.setItem(NR_WEB_PRIVATE_KEY_STORAGE_KEY, 'not-hex');
        expect(readValidStoredKeyHex()).toBe('');
    });

    it('classifies missing, partial, and full NIP-07 support', () => {
        expect(inspectNip7Capabilities().status).toBe('none');

        window.nostr = {
            getPublicKey: async () => '0'.repeat(64),
            signEvent: async (event) => event,
        };
        expect(inspectNip7Capabilities().status).toBe('partial');

        window.nostr.nip44 = {
            encrypt: async () => 'cipher',
            decrypt: async () => 'plain',
        };
        window.nostr.nip04 = {
            decrypt: async () => 'plain',
        };
        expect(inspectNip7Capabilities().status).toBe('full');
    });

    it('does not connect sign-only NIP-07 as full Nostroots support', async () => {
        window.nostr = {
            getPublicKey: async () => '0'.repeat(64),
            signEvent: async (event) => event,
        };

        await expect(nrWebNip7Signer.connect()).rejects.toThrow(/encrypted features/i);
    });
});
