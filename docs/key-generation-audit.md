# Nostr key generation and recovery audit

Audited against `origin/main` through `6a7b486b` on 2026-08-04. The review covered
production, development, test, and ephemeral Nostr secret generation; mnemonic
derivation; import validation; persistence; and accidental secret disclosure.

## Status legend

- 🟢 Cryptographically strong and appropriate for the stated lifetime
- 🟡 Strong randomness, with a separate storage or operational concern
- 🟠 Material weakness that is not an immediate key compromise
- 🔴 Incorrect, unsafe, or incompatible behavior that needs a decision or fix
- ⚪ Development/test-only material that is not a production identity

## Priority summary

| Priority | Status | Finding | Resolution |
| --- | --- | --- | --- |
| P1 | 🔴 → 🟢 | Mnemonics derived different identities across clients | Web and both Swift parsers use NIP-06 on `main`, matching `nr-app` and the extension. |
| P1 | 🔴 → 🟢 | Mobile debugging could expose key generation to a `Math.random()` fallback | The shim is removed; an early Expo Crypto bootstrap requests 128 bits and fails closed. |
| P1 | 🔴 → 🟢 | The validation server generated a new signing identity and logged its `nsec` when configuration was absent | Production now requires `PRIVATE_KEY_NSEC`; only development may use an ephemeral key, and only its public key is logged. |
| P2 | 🟠 → 🟢 | Mobile import accepted arbitrary text or a public-only `npub` as a recovery phrase | Imports now validate the BIP-39 checksum and reject public-only keys. |
| P2 | 🟠 → 🟢 | Partial mobile storage writes could split the displayed and signing identities | Replacement writes roll back and the stored signing key is canonical. |
| P2 | 🟠 → 🟢 | Swift import/generation accepted zero or out-of-range secp256k1 values | Both native implementations validate `1...n-1` and use rejection sampling on `main`. |
| P2 | 🟠 | Web and extension secrets live in browser-readable storage | Prefer NIP-07, reduce same-origin script exposure, and treat origin permissions as part of the key boundary. |
| P3 | 🟡 | Browser key replacement and remembered origin permissions are separate writes | Make replacement a recoverable transaction in a follow-up. |

## Generation inventory

| Status | Component and location                                                                            | Key lifetime               | Random input and effective entropy                                                                                | Notes                                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢     | `nr-app` onboarding (`src/components/KeyInput.tsx`, `src/services/onboardingIdentity.service.ts`) | Persistent recovery phrase | `nip06.generateSeedWords()` uses 128 random bits for 12 BIP-39 words                                              | This change installs Expo Crypto's native CSPRNG before key modules load, avoiding the React Native shim's `Math.random()` remote-debug fallback. Tests assert 16-byte requests and fail-closed behavior. |
| 🟡     | Nostroots Web (`vibe/web/web/index.js`, `generateKeyPair`)                                        | Persistent local key       | `nostr-tools.generateSecretKey()` maps CSPRNG bytes into a valid secp256k1 scalar; approximately 256-bit security | The private key is kept in same-origin `localStorage`, so any successful same-origin script injection can read it. Prefer NIP-07 for valuable identities.                                                 |
| 🟢     | Nostroots Web gift wrapping (`vibe/web/web/index.js`)                                             | One message                | `nostr-tools.generateSecretKey()`; approximately 256-bit security                                                 | Correct ephemeral use for NIP-59-style wrapping.                                                                                                                                                          |
| 🟡     | Browser extension (`vibe/browser/extension/src/shared/keys.ts`)                                   | Persistent signer key      | NIP-06 mnemonic generation uses 128 random bits; the raw helper uses `nostr-tools`                                | The secret is stored in `chrome.storage.local`; origin permissions should be treated as part of the key's security boundary.                                                                              |
| 🟢     | Native Nostroots Browser (`vibe/browser/ios/SharedCore/Crypto/NIP19.swift`)                       | Persistent Keychain key    | `SecRandomCopyBytes`, 256 random bits, with rejection outside `1...n-1`                                           | The implementation on `main` validates the full secp256k1 scalar range during generation, import, storage, and `nsec` encoding.                                                                            |
| 🟢     | Nostroots native iOS companion (`vibe/web/ios-app/SharedCore/Crypto/NIP19.swift`)                 | Persistent Keychain key    | `SecRandomCopyBytes`, 256 random bits, with rejection outside `1...n-1`                                           | The implementation on `main` validates the full scalar range during generation and import.                                                                                                                |
| 🟡     | Validation server (`nr-server/main.ts`)                                                           | Long-lived server identity | `nostr-tools.generateSecretKey()` when explicitly in development                                                  | This PR requires `PRIVATE_KEY_NSEC` outside development and never logs a generated `nsec`. The old production fallback silently changed identity on every restart and disclosed the secret in logs.       |
| 🟢     | Monitor probes (`nr-monitor/src/ping.ts`)                                                         | One process/probe          | `nostr-tools.generateSecretKey()`                                                                                 | Appropriate ephemeral authentication identity.                                                                                                                                                            |
| ⚪     | NIP-46 development client (`development-utils/nip-46-client`)                                     | Development session        | `nostr-tools.generateSecretKey()` and `crypto.randomUUID()`                                                       | Development-only tooling; no production identity depends on it.                                                                                                                                           |
| ⚪     | Push spam helper and Go tests (`nr-push/spam.ts`, `vibe/nip42relay`)                              | Development/test           | Fixed or library-generated test values                                                                            | Acceptable only while these paths remain clearly non-production.                                                                                                                                          |

## Entropy conclusion

The intended generators provide enough randomness. Twelve-word NIP-06/BIP-39
phrases contain 128 bits of entropy plus a checksum, already beyond practical
brute-force reach. Direct secret generators use OS-backed cryptographic random
sources and produce valid 256-bit secp256k1 scalars. Adding more random bytes
would not materially improve security.

The mobile app was the exception under Chrome remote debugging: its installed
`react-native-get-random-values` shim deliberately fell back to `Math.random()`.
The app now replaces that method with Expo Crypto's native implementation and
therefore fails closed if secure randomness is unavailable.

## High-priority compatibility finding and resolution

Before the Vibe update on `main`, the same 12-word recovery phrase did **not**
restore the same Nostr identity in all clients:

| Client                                      | Previous derivation                       |
| ------------------------------------------- | ----------------------------------------- |
| `nr-app` and the browser extension          | NIP-06 / BIP-32 path `m/44'/1237'/0'/0/0` |
| Nostroots Web and both Swift native parsers | First 32 bytes of the BIP-39 seed         |

For the standard `abandon ... about` vector these paths produced different
private keys. Nostroots Web and both Swift parsers now use the NIP-06 path, with
the standard-derived secret locked by regression tests. Existing installations
continue using their persisted raw key; a phrase previously imported through a
legacy client will resolve to the NIP-06 identity if it is imported again. This
deliberate recovery compatibility break was accepted because legacy usage is
known to be low.

## Other findings and recommendations

1. `nr-app` previously treated arbitrary text and `npub` values as recovery
   phrases. Import now validates BIP-39 checksums, rejects public-only keys, and
   accepts case-normalized `nsec` input.
2. `nr-app` could navigate away before SecureStore finished writing. It now
   waits for success. Replacement writes also roll back on failure, and the
   actual signing key is canonical if a stale mnemonic remains.
3. Nostroots Web loads several third-party modules while allowing a raw secret
   in `localStorage`. Self-host and pin all executable dependencies, deploy a
   strict Content Security Policy, and make NIP-07 the recommended default.
4. Browser-extension and native-browser key replacement should update key
   storage and remembered origin permissions as one recoverable operation.
5. Hex validators shared across JavaScript clients generally check length and
   characters only. Import boundaries should consistently reject zero and
   values at or above the secp256k1 group order before persistence.

## Review method

The inventory was built by tracing calls to `generateSecretKey`,
`generateSeedWords`, `SecRandomCopyBytes`, `randomBytes`, `randomUUID`, NIP-19
encoders, mnemonic parsers, key persistence APIs, and committed fixed-key
fixtures. Generator implementations were then traced into the installed
`nostr-tools`, Noble, Scure BIP-39, Expo Crypto, and React Native shim sources.
