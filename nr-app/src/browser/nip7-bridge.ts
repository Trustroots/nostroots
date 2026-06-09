import type { EventTemplate, VerifiedEvent } from "nostr-tools";
import { z } from "zod";

export const NIP7_BRIDGE_SOURCE = "nostroots-nip7-bridge" as const;
export const NIP7_RESPONSE_SOURCE = "nostroots-nip7-bridge" as const;

export const NIP7_METHODS = [
  "getPublicKey",
  "signEvent",
  "nip44.encrypt",
  "nip44.decrypt",
  "nip04.encrypt",
  "nip04.decrypt",
] as const;

const eventTemplateSchema = z
  .object({
    kind: z.number().int(),
    created_at: z.number().int().optional(),
    tags: z.array(z.array(z.string())).optional(),
    content: z.string().optional(),
  })
  .passthrough();

const requestSchema = z.object({
  source: z.literal(NIP7_BRIDGE_SOURCE),
  id: z.string().min(1),
  method: z.enum(NIP7_METHODS),
  params: z.unknown().optional(),
});

const peerTextParamsSchema = z.tuple([z.string(), z.string()]);
const signEventParamsSchema = z.tuple([eventTemplateSchema]);

export type Nip7Method = (typeof NIP7_METHODS)[number];
export type Nip7BridgeRequest = z.infer<typeof requestSchema>;

export type Nip7BridgeResponse =
  | {
      source: typeof NIP7_RESPONSE_SOURCE;
      id: string;
      ok: true;
      result: unknown;
    }
  | {
      source: typeof NIP7_RESPONSE_SOURCE;
      id: string;
      ok: false;
      error: string;
    };

export interface Nip7BridgeApi {
  getPublicKey: () => Promise<string>;
  signEvent: (eventTemplate: EventTemplate) => Promise<VerifiedEvent>;
  nip44Encrypt: (peerPubkeyHex: string, plaintext: string) => Promise<string>;
  nip44Decrypt: (peerPubkeyHex: string, ciphertext: string) => Promise<string>;
  nip04Encrypt: (peerPubkeyHex: string, plaintext: string) => Promise<string>;
  nip04Decrypt: (peerPubkeyHex: string, ciphertext: string) => Promise<string>;
}

export function isKnownNip7Method(method: unknown): method is Nip7Method {
  return (
    typeof method === "string" && NIP7_METHODS.includes(method as Nip7Method)
  );
}

export function requestMetadata(
  rawMessage: string,
): { id: string; method: string } | null {
  try {
    const parsed = JSON.parse(rawMessage);
    if (
      parsed?.source === NIP7_BRIDGE_SOURCE &&
      typeof parsed.id === "string" &&
      typeof parsed.method === "string"
    ) {
      return { id: parsed.id, method: parsed.method };
    }
  } catch {
    return null;
  }
  return null;
}

function sanitizeEventTemplate(input: unknown): EventTemplate {
  const parsed = eventTemplateSchema.parse(input);

  return {
    kind: parsed.kind,
    created_at: parsed.created_at ?? Math.floor(Date.now() / 1000),
    tags: parsed.tags ?? [],
    content: parsed.content ?? "",
  };
}

export function success(id: string, result: unknown): Nip7BridgeResponse {
  return {
    source: NIP7_RESPONSE_SOURCE,
    id,
    ok: true,
    result,
  };
}

export function failure(id: string, error: string): Nip7BridgeResponse {
  return {
    source: NIP7_RESPONSE_SOURCE,
    id,
    ok: false,
    error,
  };
}

export async function handleNip7BridgeMessage(
  rawMessage: string,
  api: Nip7BridgeApi,
): Promise<Nip7BridgeResponse> {
  let id = "unknown";

  try {
    const parsedJson = JSON.parse(rawMessage);
    const request = requestSchema.parse(parsedJson);
    id = request.id;

    switch (request.method) {
      case "getPublicKey":
        return success(request.id, await api.getPublicKey());
      case "signEvent":
        return success(
          request.id,
          await api.signEvent(
            sanitizeEventTemplate(
              signEventParamsSchema.parse(request.params)[0],
            ),
          ),
        );
      case "nip44.encrypt": {
        const [peerPubkeyHex, plaintext] = peerTextParamsSchema.parse(
          request.params,
        );
        return success(
          request.id,
          await api.nip44Encrypt(peerPubkeyHex, plaintext),
        );
      }
      case "nip44.decrypt": {
        const [peerPubkeyHex, ciphertext] = peerTextParamsSchema.parse(
          request.params,
        );
        return success(
          request.id,
          await api.nip44Decrypt(peerPubkeyHex, ciphertext),
        );
      }
      case "nip04.encrypt": {
        const [peerPubkeyHex, plaintext] = peerTextParamsSchema.parse(
          request.params,
        );
        return success(
          request.id,
          await api.nip04Encrypt(peerPubkeyHex, plaintext),
        );
      }
      case "nip04.decrypt": {
        const [peerPubkeyHex, ciphertext] = peerTextParamsSchema.parse(
          request.params,
        );
        return success(
          request.id,
          await api.nip04Decrypt(peerPubkeyHex, ciphertext),
        );
      }
    }
  } catch (error) {
    return failure(id, error instanceof Error ? error.message : String(error));
  }
}

export function createNip7InjectionScript(): string {
  return `
(function () {
  if (window.nostr && window.nostr.__nostrootsBrowser) return true;

  var pending = {};
  var counter = 0;

  function request(method, params) {
    return new Promise(function (resolve, reject) {
      var id = 'nr-browser-' + String(Date.now()) + '-' + String(++counter);
      pending[id] = { resolve: resolve, reject: reject };
      window.ReactNativeWebView.postMessage(JSON.stringify({
        source: '${NIP7_BRIDGE_SOURCE}',
        id: id,
        method: method,
        params: params || []
      }));
    });
  }

  window.__nostrootsNip7Receive = function (message) {
    var response = typeof message === 'string' ? JSON.parse(message) : message;
    if (!response || response.source !== '${NIP7_RESPONSE_SOURCE}') return;
    var entry = pending[response.id];
    if (!entry) return;
    delete pending[response.id];
    if (response.ok) {
      entry.resolve(response.result);
    } else {
      entry.reject(new Error(response.error || 'Nostroots Browser signing failed.'));
    }
  };

  window.__nostrootsNip7Installed = true;
  window.nostr = {
    __nostrootsBrowser: true,
    getPublicKey: function () {
      return request('getPublicKey', []);
    },
    signEvent: function (eventTemplate) {
      return request('signEvent', [eventTemplate]);
    },
    nip44: {
      encrypt: function (peerPubkey, plaintext) {
        return request('nip44.encrypt', [peerPubkey, plaintext]);
      },
      decrypt: function (peerPubkey, ciphertext) {
        return request('nip44.decrypt', [peerPubkey, ciphertext]);
      }
    },
    nip04: {
      encrypt: function (peerPubkey, plaintext) {
        return request('nip04.encrypt', [peerPubkey, plaintext]);
      },
      decrypt: function (peerPubkey, ciphertext) {
        return request('nip04.decrypt', [peerPubkey, ciphertext]);
      }
    }
  };

  return true;
})();`;
}

export function createNip7ResponseScript(response: Nip7BridgeResponse): string {
  return `
window.__nostrootsNip7Receive(${JSON.stringify(response)});
true;`;
}
