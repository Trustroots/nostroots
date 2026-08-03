import { expect } from "jsr:@std/expect";
import { finalizeEvent, generateSecretKey } from "nostr-tools/pure";
import { getToken } from "nostr-tools/nip98";
import { createApp } from "../../src/server.ts";
import { buildSupportEmail } from "../../src/email/templates.ts";
import { SUPPORT_MESSAGE_MAX_LENGTH } from "../../schemas/supportRequest.ts";

const secretKey = generateSecretKey();

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
    username: "marmaladeskies",
  });

  expect(subject).toBe("Nostroots support request from marmaladeskies");
  expect(html).toContain("marmaladeskies (verified)");
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
