import { expect } from "jsr:@std/expect";
import { SUPPORT_MESSAGE_MAX_LENGTH } from "@trustroots/nr-common";
import type { Message, Receipt } from "@upyo/core";
import type { Db } from "mongodb";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { getToken } from "nostr-tools/nip98";
import { nip19 } from "nostr-tools";
import { closeMongoClient, setDb } from "../../src/db/mongodb.ts";
import { buildSupportEmail } from "../../src/email/templates.ts";
import { setEmailTransport } from "../../src/email/send.ts";
import { createApp } from "../../src/server.ts";

const secretKey = generateSecretKey();
const npub = nip19.npubEncode(getPublicKey(secretKey));

/**
 * Route every lookup on the `users` collection to a single stub document, so
 * the real route wiring runs without a MongoDB.
 */
function stubUser(user: { email: string; username: string } | null): void {
  setDb(
    {
      collection: () => ({ findOne: () => Promise.resolve(user) }),
    } as unknown as Db,
  );
}

/** Capture outgoing mail instead of delivering it. */
function captureEmails(): Message[] {
  const sent: Message[] = [];
  setEmailTransport({
    send: (message: Message) => {
      sent.push(message);
      return Promise.resolve({ successful: true } as Receipt);
    },
    closeAllConnections: () => Promise.resolve(),
  });
  return sent;
}

function htmlOf(message: Message): string {
  const content = message.content as { html?: string };
  return content.html ?? "";
}

function signedToken(body: Record<string, unknown>): Promise<string> {
  return getToken(
    "https://bridge.example/support",
    "POST",
    (template) => finalizeEvent(template, secretKey),
    true,
    body,
  );
}

async function postSupport(
  body: Record<string, unknown>,
  { authorization }: { authorization?: string | null } = {},
): Promise<Response> {
  const app = createApp();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = authorization === undefined
    ? await signedToken(body)
    : authorization;
  if (token) headers.Authorization = token;

  return await app.request("/support", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

Deno.test("#sup1 POST /support returns 400 for a missing message", async () => {
  const res = await postSupport({});
  expect(res.status).toBe(400);
});

Deno.test("#sup2 POST /support returns 400 for an empty message", async () => {
  const res = await postSupport({ message: "   " });
  expect(res.status).toBe(400);
});

Deno.test("#sup3 POST /support returns 400 for an oversized message", async () => {
  const res = await postSupport({
    message: "x".repeat(SUPPORT_MESSAGE_MAX_LENGTH + 1),
  });
  expect(res.status).toBe(400);
});

Deno.test("#sup4 POST /support returns 401 without a signature", async () => {
  const res = await postSupport({ message: "help me" }, {
    authorization: null,
  });
  expect(res.status).toBe(401);
});

Deno.test("#sup5 POST /support returns 401 when the body was altered after signing", async () => {
  const res = await postSupport({ message: "tampered" }, {
    authorization: await signedToken({ message: "original" }),
  });
  expect(res.status).toBe(401);
});

Deno.test("#sup6 support email names the verified username in the subject", () => {
  const { subject, html } = buildSupportEmail({
    message: "the map does not load",
    npub: "npub1abc",
    username: "wanderingpine",
  });

  expect(subject).toBe("Nostroots support request from wanderingpine");
  expect(html).toContain("wanderingpine (verified)");
  expect(html).toContain("the map does not load");
  expect(html).toContain("Nostroots");
});

Deno.test("#sup7 support email falls back to the npub when unlinked", () => {
  const { subject, html } = buildSupportEmail({
    message: "hello",
    npub: "npub1abc",
  });

  expect(subject).toBe("Nostroots support request from npub1abc");
  expect(html).toContain("not linked to a Trustroots account");
});

Deno.test("#sup8 support email escapes HTML in the message", () => {
  const { html } = buildSupportEmail({
    message: "<script>alert('x')</script>",
    npub: "npub1abc",
  });

  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
});

Deno.test("#sup9 POST /support rejects malformed JSON", async () => {
  const app = createApp();
  const res = await app.request("/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });

  expect(res.status).toBe(400);
});

Deno.test("#sup10 POST /support sends an attributed email", async () => {
  stubUser({ email: "alice@example.test", username: "wanderingpine" });
  const sent = captureEmails();

  const res = await postSupport({ message: "The map is blank" });

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ success: true });
  expect(sent).toHaveLength(1);
  expect(sent[0].subject).toContain("wanderingpine");
  expect(htmlOf(sent[0])).toContain("The map is blank");

  await closeMongoClient();
});

Deno.test("#sup11 POST /support handles an unlinked signer", async () => {
  stubUser(null);
  const sent = captureEmails();

  const res = await postSupport({ message: "Please help" });

  expect(res.status).toBe(200);
  expect(htmlOf(sent[0])).toContain("not linked to a Trustroots account");
  expect(sent[0].subject).toContain(npub);

  await closeMongoClient();
});
