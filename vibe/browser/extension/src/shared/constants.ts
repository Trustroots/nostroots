export const EXTENSION_BRAND = "Nostroots Extension";

export const MESSAGE_SOURCE_PAGE = "nostroots-extension-provider";
export const MESSAGE_SOURCE_CONTENT = "nostroots-extension-content";
export const MESSAGE_SOURCE_PROMPT = "nostroots-extension-prompt";

export const STORAGE_KEYS = {
  privateKeyHex: "nostroots.browser.privateKeyHex",
  allowedOriginAccess: "nostroots.browser.allowedOriginAccess",
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

export function nip07MethodLabel(method: Nip07Method | string): string {
  switch (method) {
    case "getPublicKey":
      return "Share public address";
    case "signEvent":
      return "Sign events";
    case "nip44.encrypt":
      return "Encrypt NIP-44 messages";
    case "nip44.decrypt":
      return "Decrypt NIP-44 messages";
    case "nip04.encrypt":
      return "Encrypt NIP-04 messages";
    case "nip04.decrypt":
      return "Decrypt NIP-04 messages";
    default:
      return String(method);
  }
}
