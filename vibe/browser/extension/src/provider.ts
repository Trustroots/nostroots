import { MESSAGE_SOURCE_CONTENT, MESSAGE_SOURCE_PAGE } from "./shared/constants";
import type { BridgeResponse } from "./shared/messages";

declare global {
  interface Window {
    nostr?: {
      __nostrootsBrowser?: boolean;
      getPublicKey: () => Promise<string>;
      signEvent: (event: unknown) => Promise<unknown>;
      nip44: {
        encrypt: (peerPubkey: string, plaintext: string) => Promise<string>;
        decrypt: (peerPubkey: string, ciphertext: string) => Promise<string>;
      };
      nip04: {
        encrypt: (peerPubkey: string, plaintext: string) => Promise<string>;
        decrypt: (peerPubkey: string, ciphertext: string) => Promise<string>;
      };
    };
    __nostrootsNip7Installed?: boolean;
  }
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

if (!window.nostr?.__nostrootsBrowser) {
  const pending = new Map<string, PendingRequest>();
  let counter = 0;

  function request(method: string, params: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = `nostroots-${Date.now()}-${++counter}`;
      pending.set(id, { resolve, reject });
      window.postMessage(
        {
          source: MESSAGE_SOURCE_PAGE,
          id,
          method,
          params,
        },
        window.location.origin,
      );
    });
  }

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== window || !isProviderResponse(event.data)) return;
    const entry = pending.get(event.data.id);
    if (!entry) return;

    pending.delete(event.data.id);
    if (event.data.response.ok) {
      entry.resolve(event.data.response.result);
    } else {
      entry.reject(new Error(event.data.response.error || "Nostroots Browser request failed."));
    }
  });

  window.__nostrootsNip7Installed = true;
  window.nostr = {
    __nostrootsBrowser: true,
    getPublicKey: () => request("getPublicKey", []) as Promise<string>,
    signEvent: (event: unknown) => request("signEvent", [event]),
    nip44: {
      encrypt: (peerPubkey: string, plaintext: string) =>
        request("nip44.encrypt", [peerPubkey, plaintext]) as Promise<string>,
      decrypt: (peerPubkey: string, ciphertext: string) =>
        request("nip44.decrypt", [peerPubkey, ciphertext]) as Promise<string>,
    },
    nip04: {
      encrypt: (peerPubkey: string, plaintext: string) =>
        request("nip04.encrypt", [peerPubkey, plaintext]) as Promise<string>,
      decrypt: (peerPubkey: string, ciphertext: string) =>
        request("nip04.decrypt", [peerPubkey, ciphertext]) as Promise<string>,
    },
  };
}

function isProviderResponse(value: unknown): value is {
  source: typeof MESSAGE_SOURCE_CONTENT;
  id: string;
  response: BridgeResponse;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { source?: unknown }).source === MESSAGE_SOURCE_CONTENT &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { response?: unknown }).response === "object" &&
    (value as { response?: unknown }).response !== null
  );
}
