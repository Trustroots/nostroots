import { assert, assertEquals } from "jsr:@std/assert";
import { nip19 } from "npm:nostr-tools@2";

import {
  startMockStack,
  TEST_NPUB,
  TEST_PUBKEY_HEX,
  TEST_USERNAME,
} from "./server.ts";

const PORT = 18787;
const BASE = `http://localhost:${PORT}`;

async function withStack(run: () => Promise<void>) {
  const stack = startMockStack(PORT);
  try {
    await run();
  } finally {
    await stack.close();
  }
}

Deno.test("the fixed test identity is self-consistent", () => {
  assertEquals(nip19.npubEncode(TEST_PUBKEY_HEX), TEST_NPUB);
});

Deno.test("verify_token accepts a username", async () => {
  await withStack(async () => {
    const response = await fetch(`${BASE}/verify_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME }),
    });
    assertEquals(response.status, 200);
    await response.body?.cancel();
  });
});

Deno.test("verify_token rejects a missing username with 400", async () => {
  await withStack(async () => {
    const response = await fetch(`${BASE}/verify_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assertEquals(response.status, 400);
    await response.body?.cancel();
  });
});

Deno.test(
  "authenticate accepts the fixed code and rejects any other",
  async () => {
    await withStack(async () => {
      const ok = await fetch(`${BASE}/authenticate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: TEST_USERNAME,
          npub: TEST_NPUB,
          code: "123456",
        }),
      });
      assertEquals(ok.status, 200);
      await ok.body?.cancel();

      const bad = await fetch(`${BASE}/authenticate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: TEST_USERNAME,
          npub: TEST_NPUB,
          code: "000000",
        }),
      });
      assertEquals(bad.status, 401);
      await bad.body?.cancel();
    });
  },
);

Deno.test(
  "nostr.json returns the test pubkey for the test username",
  async () => {
    await withStack(async () => {
      const response = await fetch(
        `${BASE}/.well-known/nostr.json?name=${TEST_USERNAME}`,
      );
      assertEquals(response.status, 200);
      const body = await response.json();
      assertEquals(body.names[TEST_USERNAME], TEST_PUBKEY_HEX);
    });
  },
);

Deno.test("nostr.json omits unknown names", async () => {
  await withStack(async () => {
    const response = await fetch(`${BASE}/.well-known/nostr.json?name=nobody`);
    const body = await response.json();
    assertEquals(body.names.nobody, undefined);
  });
});

Deno.test(
  "the relay acknowledges an EVENT and closes a REQ with EOSE",
  async () => {
    await withStack(async () => {
      const socket = new WebSocket(`ws://localhost:${PORT}`);
      const messages: unknown[][] = [];

      await new Promise<void>((resolve, reject) => {
        socket.onerror = () => reject(new Error("socket error"));
        socket.onopen = () => resolve();
      });

      const done = new Promise<void>((resolve) => {
        socket.onmessage = (event) => {
          const parsed = JSON.parse(event.data as string);
          messages.push(parsed);
          if (messages.length === 2) resolve();
        };
      });

      socket.send(
        JSON.stringify([
          "EVENT",
          { id: "deadbeef", kind: 10390, tags: [], content: "", sig: "x" },
        ]),
      );
      socket.send(JSON.stringify(["REQ", "sub1", { kinds: [10390] }]));

      await done;
      socket.close();

      const ok = messages.find((m) => m[0] === "OK");
      assert(ok, "expected an OK frame");
      assertEquals(ok![1], "deadbeef");
      assertEquals(ok![2], true);

      const eose = messages.find((m) => m[0] === "EOSE");
      assert(eose, "expected an EOSE frame");
      assertEquals(eose![1], "sub1");
    });
  },
);
