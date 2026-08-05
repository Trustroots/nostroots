import { expect } from "jsr:@std/expect";
import { finalizeEvent, generateSecretKey } from "nostr-tools/pure";
import { getToken } from "nostr-tools/nip98";
import { Hono } from "hono";
import type { Collection } from "mongodb";
import { createApp } from "../../src/server.ts";
import { buildSupportEmail } from "../../src/email/templates.ts";
import { createSupportHandler } from "../../src/routes/support.ts";
import { SUPPORT_MESSAGE_MAX_LENGTH } from "../../schemas/supportRequest.ts";

const secretKey = generateSecretKey();

function createIsolatedSupportApp({
  user,
  sent,
}: {
  user: { email: string; username: string } | null;
  sent: Array<{ to: string; subject: string; html: string }>;
}) {
  const app = new Hono();
  const collection = {
    findOne: () => Promise.resolve(user),
  } as unknown as Collection;

  app.post(
    "/support",
    createSupportHandler({
      getUsersCollection: () => Promise.resolve(collection),
      sendEmail: (email) => {
        sent.push(email);
        return Promise.resolve();
      },
      verifyNip98Header: () =>
        Promise.resolve({
          ok: true,
          pubkey: "1".repeat(64),
        }),
    }),
  );
  return app;
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

// These tests cover the rejection paths, which return before the handler
// touches MongoDB or SMTP. The happy path is covered by the nip98 and email
// template unit tests plus the e2e suite.

Deno.test("#sup1 POST /support returns 400 for a missing message", async () => {
  const app = createApp();
  const res = await app.request("/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
});

Deno.test("#sup2 POST /support returns 400 for an empty message", async () => {
  const app = createApp();
  const body = { message: "   " };
  const res = await app.request("/support", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: await signedToken(body),
    },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(400);
});

Deno.test("#sup3 POST /support returns 400 for an oversized message", async () => {
  const app = createApp();
  const body = { message: "x".repeat(SUPPORT_MESSAGE_MAX_LENGTH + 1) };
  const res = await app.request("/support", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: await signedToken(body),
    },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(400);
});

Deno.test("#sup4 POST /support returns 401 without a signature", async () => {
  const app = createApp();
  const res = await app.request("/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "help me" }),
  });
  expect(res.status).toBe(401);
});

Deno.test("#sup5 POST /support returns 401 when the body was altered after signing", async () => {
  const app = createApp();
  const token = await signedToken({ message: "original" });
  const res = await app.request("/support", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ message: "tampered" }),
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
  const sent: Array<{ to: string; subject: string; html: string }> = [];
  const app = createIsolatedSupportApp({
    user: { email: "alice@example.test", username: "wanderingpine" },
    sent,
  });
  const res = await app.request("/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "The map is blank" }),
  });

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ success: true });
  expect(sent).toHaveLength(1);
  expect(sent[0].subject).toContain("wanderingpine");
  expect(sent[0].html).toContain("The map is blank");
});

Deno.test("#sup11 POST /support handles an unlinked signer", async () => {
  const sent: Array<{ to: string; subject: string; html: string }> = [];
  const app = createIsolatedSupportApp({ user: null, sent });
  const res = await app.request("/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Please help" }),
  });

  expect(res.status).toBe(200);
  expect(sent[0].html).toContain("not linked to a Trustroots account");
});
