import type { EventTemplate, VerifiedEvent } from "nostr-tools";

import {
  NIP7_BRIDGE_SOURCE,
  handleNip7BridgeMessage,
  type Nip7BridgeApi,
} from "@/nostr/nip7-bridge";

const validPubkey = "1".repeat(64);

function createApi(): Nip7BridgeApi {
  return {
    getPublicKey: jest.fn(async () => validPubkey),
    signEvent: jest.fn(
      async (eventTemplate: EventTemplate) =>
        ({
          ...eventTemplate,
          id: "2".repeat(64),
          pubkey: validPubkey,
          sig: "3".repeat(128),
        }) as unknown as VerifiedEvent,
    ),
    nip44Encrypt: jest.fn(async () => "nip44-cipher"),
    nip44Decrypt: jest.fn(async () => "nip44-plain"),
    nip04Encrypt: jest.fn(async () => "nip04-cipher"),
    nip04Decrypt: jest.fn(async () => "nip04-plain"),
  };
}

function request(method: string, params?: unknown) {
  return JSON.stringify({
    source: NIP7_BRIDGE_SOURCE,
    id: "request-1",
    method,
    params,
  });
}

describe("NIP-07 bridge", () => {
  it("returns the public key", async () => {
    const api = createApi();
    const response = await handleNip7BridgeMessage(request("getPublicKey", []), api);

    expect(response).toMatchObject({
      id: "request-1",
      ok: true,
      result: validPubkey,
    });
  });

  it("signs a sanitized event template from one-item params", async () => {
    const api = createApi();
    const response = await handleNip7BridgeMessage(
      request("signEvent", [
        {
          id: "bad-id",
          sig: "bad-sig",
          pubkey: "bad-pubkey",
          kind: 1,
          tags: [["client", "nr-browser"]],
          content: "hello",
        },
      ]),
      api,
    );

    expect(response.ok).toBe(true);
    expect(api.signEvent).toHaveBeenCalledWith({
      kind: 1,
      created_at: expect.any(Number),
      tags: [["client", "nr-browser"]],
      content: "hello",
    });
  });

  it("routes NIP-44 and NIP-04 calls", async () => {
    const api = createApi();

    await expect(
      handleNip7BridgeMessage(request("nip44.encrypt", [validPubkey, "plain"]), api),
    ).resolves.toMatchObject({ ok: true, result: "nip44-cipher" });
    await expect(
      handleNip7BridgeMessage(request("nip44.decrypt", [validPubkey, "cipher"]), api),
    ).resolves.toMatchObject({ ok: true, result: "nip44-plain" });
    await expect(
      handleNip7BridgeMessage(request("nip04.encrypt", [validPubkey, "plain"]), api),
    ).resolves.toMatchObject({ ok: true, result: "nip04-cipher" });
    await expect(
      handleNip7BridgeMessage(request("nip04.decrypt", [validPubkey, "cipher"]), api),
    ).resolves.toMatchObject({ ok: true, result: "nip04-plain" });
  });

  it("returns an error for unknown methods and malformed params", async () => {
    const api = createApi();

    await expect(handleNip7BridgeMessage(request("unknown"), api)).resolves.toMatchObject({
      ok: false,
    });
    await expect(
      handleNip7BridgeMessage(request("nip44.encrypt", [validPubkey]), api),
    ).resolves.toMatchObject({ ok: false });
  });

  it("surfaces invalid peer pubkey errors from crypto helpers", async () => {
    const api = createApi();
    api.nip44Encrypt = jest.fn(async () => {
      throw new Error("Invalid peer public key.");
    });

    await expect(
      handleNip7BridgeMessage(request("nip44.encrypt", ["bad", "plain"]), api),
    ).resolves.toMatchObject({
      ok: false,
      error: "Invalid peer public key.",
    });
  });
});
