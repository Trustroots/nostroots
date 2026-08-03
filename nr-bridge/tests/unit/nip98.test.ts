import { expect } from "jsr:@std/expect";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { getToken } from "nostr-tools/nip98";
import { finalizeEvent } from "nostr-tools/pure";
import { verifyNip98Header } from "../../src/nostr/nip98.ts";

const secretKey = generateSecretKey();

function sign(template: Parameters<typeof finalizeEvent>[0]) {
  return finalizeEvent(template, secretKey);
}

async function makeToken(
  url: string,
  method: string,
  body: Record<string, unknown>,
): Promise<string> {
  return await getToken(url, method, sign, true, body);
}

Deno.test("#n98-1 accepts a valid token and returns the signer pubkey", async () => {
  const body = { message: "hello support" };
  const token = await makeToken("https://bridge.example/support", "POST", body);

  const result = await verifyNip98Header(token, "/support", "POST", body);

  expect(result).toEqual({ ok: true, pubkey: getPublicKey(secretKey) });
});

Deno.test("#n98-2 rejects a missing Authorization header", async () => {
  const result = await verifyNip98Header(undefined, "/support", "POST", {
    message: "hello",
  });
  expect(result.ok).toBe(false);
});

Deno.test("#n98-3 rejects a body that does not match the payload tag", async () => {
  const token = await makeToken("https://bridge.example/support", "POST", {
    message: "original",
  });

  const result = await verifyNip98Header(token, "/support", "POST", {
    message: "tampered",
  });

  expect(result.ok).toBe(false);
});

Deno.test("#n98-4 rejects a token signed for a different path", async () => {
  const body = { message: "hello" };
  const token = await makeToken(
    "https://bridge.example/authenticate",
    "POST",
    body,
  );

  const result = await verifyNip98Header(token, "/support", "POST", body);

  expect(result.ok).toBe(false);
});

Deno.test("#n98-5 ignores scheme and host so it works behind a proxy", async () => {
  const body = { message: "hello" };
  const token = await makeToken("http://localhost:8000/support", "POST", body);

  const result = await verifyNip98Header(token, "/support", "POST", body);

  expect(result.ok).toBe(true);
});

Deno.test("#n98-6 rejects a token signed for a different method", async () => {
  const body = { message: "hello" };
  const token = await makeToken("https://bridge.example/support", "GET", body);

  const result = await verifyNip98Header(token, "/support", "POST", body);

  expect(result.ok).toBe(false);
});

Deno.test("#n98-7 rejects a stale auth event", async () => {
  const body = { message: "hello" };
  const stale = finalizeEvent(
    {
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000) - 600,
      content: "",
      tags: [
        ["u", "https://bridge.example/support"],
        ["method", "POST"],
      ],
    },
    secretKey,
  );
  const token = `Nostr ${btoa(JSON.stringify(stale))}`;

  const result = await verifyNip98Header(token, "/support", "POST", body);

  expect(result.ok).toBe(false);
});

Deno.test("#n98-8 rejects an event with a tampered signature", async () => {
  const body = { message: "hello" };
  const token = await makeToken("https://bridge.example/support", "POST", body);
  const event = JSON.parse(atob(token.replace("Nostr ", "")));
  event.pubkey = getPublicKey(generateSecretKey());
  const tampered = `Nostr ${btoa(JSON.stringify(event))}`;

  const result = await verifyNip98Header(tampered, "/support", "POST", body);

  expect(result.ok).toBe(false);
});
