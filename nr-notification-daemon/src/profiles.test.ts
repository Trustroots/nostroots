import { expect } from "jsr:@std/expect@1.0.13";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  type NostrEvent,
} from "nostr-tools";
import {
  TRUSTROOTS_PROFILE_KIND,
  TRUSTROOTS_USERNAME_LABEL_NAMESPACE,
} from "@trustroots/nr-common";
import { Nip5VerificationError, resolveUsername } from "./profiles.ts";

type FakeRelay = {
  url: string;
  connections: number;
  close: () => Promise<void>;
};

function startFakeRelay(
  profiles: Map<string, NostrEvent>,
  { silent = false } = {},
): FakeRelay {
  const relay: FakeRelay = { url: "", connections: 0, close: async () => {} };
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => {} },
    (request) => {
      const { socket, response } = Deno.upgradeWebSocket(request);
      relay.connections++;
      socket.onmessage = (message) => {
        const [type, subId, filter] = JSON.parse(message.data);
        if (type !== "REQ" || silent) return;
        const profile = profiles.get(filter.authors[0]);
        if (profile) socket.send(JSON.stringify(["EVENT", subId, profile]));
        socket.send(JSON.stringify(["EOSE", subId]));
      };
      return response;
    },
  );
  relay.url = `ws://127.0.0.1:${server.addr.port}`;
  relay.close = () => server.shutdown();
  return relay;
}

function newAuthor() {
  const secret = generateSecretKey();
  return { secret, pubkey: getPublicKey(secret) };
}

function profileEvent(secret: Uint8Array, username: string) {
  return finalizeEvent(
    {
      kind: TRUSTROOTS_PROFILE_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["L", TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
        ["l", username, TRUSTROOTS_USERNAME_LABEL_NAMESPACE],
      ],
      content: "",
    },
    secret,
  );
}

async function withNip5(
  names: Record<string, string>,
  fn: (nip5Requests: string[]) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const nip5Requests: string[] = [];
  globalThis.fetch = (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const name = url.searchParams.get("name") ?? "";
    nip5Requests.push(name);
    const pubkey = names[name];
    return Promise.resolve(
      Response.json({ names: pubkey ? { [name]: pubkey } : {} }),
    );
  };
  try {
    await fn(nip5Requests);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

Deno.test("resolveUsername returns a NIP-5 verified username and caches it", async () => {
  const { secret, pubkey } = newAuthor();
  const relay = startFakeRelay(
    new Map([[pubkey, profileEvent(secret, "alice")]]),
  );
  try {
    await withNip5({ alice: pubkey }, async (nip5Requests) => {
      expect(await resolveUsername(pubkey, relay.url)).toBe("alice");
      expect(await resolveUsername(pubkey, relay.url)).toBe("alice");
      expect(relay.connections).toBe(1);
      expect(nip5Requests).toEqual(["alice"]);
    });
  } finally {
    await relay.close();
  }
});

Deno.test("resolveUsername throws when NIP-5 points at another pubkey", async () => {
  const { secret, pubkey } = newAuthor();
  const relay = startFakeRelay(
    new Map([[pubkey, profileEvent(secret, "bob")]]),
  );
  try {
    await withNip5({ bob: newAuthor().pubkey }, async () => {
      await expect(resolveUsername(pubkey, relay.url)).rejects.toThrow(
        Nip5VerificationError,
      );
    });
  } finally {
    await relay.close();
  }
});

Deno.test("resolveUsername caches authors without a profile", async () => {
  const { pubkey } = newAuthor();
  const relay = startFakeRelay(new Map());
  try {
    expect(await resolveUsername(pubkey, relay.url)).toBeUndefined();
    expect(await resolveUsername(pubkey, relay.url)).toBeUndefined();
    expect(relay.connections).toBe(1);
  } finally {
    await relay.close();
  }
});

Deno.test("resolveUsername retries a cached miss after five minutes", async () => {
  const { pubkey } = newAuthor();
  const relay = startFakeRelay(new Map());
  const realNow = Date.now;
  try {
    expect(await resolveUsername(pubkey, relay.url)).toBeUndefined();
    const later = realNow() + 5 * 60 * 1000;
    Date.now = () => later;
    expect(await resolveUsername(pubkey, relay.url)).toBeUndefined();
    expect(relay.connections).toBe(2);
  } finally {
    Date.now = realNow;
    await relay.close();
  }
});

Deno.test("resolveUsername shares one lookup between concurrent callers", async () => {
  const { secret, pubkey } = newAuthor();
  const relay = startFakeRelay(
    new Map([[pubkey, profileEvent(secret, "carol")]]),
  );
  try {
    await withNip5({ carol: pubkey }, async (nip5Requests) => {
      const results = await Promise.all([
        resolveUsername(pubkey, relay.url),
        resolveUsername(pubkey, relay.url),
        resolveUsername(pubkey, relay.url),
      ]);
      expect(results).toEqual(["carol", "carol", "carol"]);
      expect(relay.connections).toBe(1);
      expect(nip5Requests).toEqual(["carol"]);
    });
  } finally {
    await relay.close();
  }
});

Deno.test("resolveUsername does not cache a relay that never answers", async () => {
  const { pubkey } = newAuthor();
  const relay = startFakeRelay(new Map(), { silent: true });
  try {
    expect(await resolveUsername(pubkey, relay.url)).toBeUndefined();
    const second = resolveUsername(pubkey, relay.url);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(relay.connections).toBe(2);
    await second;
  } finally {
    await relay.close();
  }
});
