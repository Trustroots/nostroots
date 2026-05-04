/**
 * Detect valid NIP-19 nsec tokens in user-visible text (notes, chat, etc.).
 * Candidate tokens use the bech32 data charset (BIP-173); each match is verified with nip19.decode.
 */

/** Bech32 data payload charset (BIP-173 / NIP-19). Flag `i` allows uppercase bech32. */
export const NSEC1_TOKEN_RE = /\bnsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{20,}\b/gi;

/**
 * @param {string} text
 * @param {{ decode: (s: string) => { type?: string } }} nip19
 */
export function containsPrivateKeyNsec(text, nip19) {
    if (!text || typeof text !== 'string' || !nip19?.decode) return false;
    const candidates = text.match(NSEC1_TOKEN_RE) || [];
    for (const candidate of candidates) {
        try {
            const decoded = nip19.decode(candidate);
            if (decoded?.type === 'nsec') return true;
        } catch (_) {}
    }
    return false;
}

/** Example string that must be blocked in chat (contains valid nsec with bech32 `l`). */
export const CHAT_NSEC_LEAK_FIXTURE =
    'test nsec1l53ku95egk2emglml9q4k5zt722axs4eplkq4sauqv2d2vz23h8smvgxx8';
