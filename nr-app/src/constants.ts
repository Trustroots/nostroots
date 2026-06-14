export const ID_SEPARATOR = ":" as const;

export const NOSTR_EVENT_INDEX_MAXIMUM_PLUS_CODE_LENGTH = 6;

export const SECURE_STORE_PRIVATE_KEY_HEX_KEY =
  "nostroots_private_key_hex" as const;
export const SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC =
  "nostroots_private_key_mnemonic" as const;

export const NOSTROOTS_WEB_ORIGIN = "https://nos.trustroots.org" as const;
export const NOSTROOTS_WEB_URL = `${NOSTROOTS_WEB_ORIGIN}/` as const;
export const NOSTROOTS_BROWSER_USER_AGENT = "NostrootsBrowser/1.0" as const;

export const STORAGE_NIP7_ALLOWED_ORIGINS_KEY =
  "nostroots.browser.nip7.allowedOrigins" as const;
export const STORAGE_NIP7_TRUSTED_USE_ORIGINS_KEY =
  "nostroots.browser.nip7.usedTrustedOrigins" as const;

export const TRUSTED_NIP7_DOMAINS = [
  "trustroots.org",
  "hitchwiki.org",
] as const;
