export const EXTENSION_BRAND = "Nostroots Browser";

export const MESSAGE_SOURCE_PAGE = "nostroots-extension-provider";
export const MESSAGE_SOURCE_CONTENT = "nostroots-extension-content";
export const MESSAGE_SOURCE_PROMPT = "nostroots-extension-prompt";

export const STORAGE_KEYS = {
  privateKeyHex: "nostroots.browser.privateKeyHex",
  allowedOrigins: "nostroots.browser.allowedOrigins",
  trustrootsNip05ByPubkey: "nostroots.browser.trustrootsNip05ByPubkey",
} as const;

export const TRUSTED_DOMAINS = ["trustroots.org"] as const;

export const NIP07_METHODS = [
  "getPublicKey",
  "signEvent",
  "nip44.encrypt",
  "nip44.decrypt",
  "nip04.encrypt",
  "nip04.decrypt",
] as const;

export type Nip07Method = (typeof NIP07_METHODS)[number];

export function isKnownNip07Method(method: unknown): method is Nip07Method {
  return typeof method === "string" && NIP07_METHODS.includes(method as Nip07Method);
}
