import { expect } from "jsr:@std/expect";
import { createApp } from "../../src/server.ts";
import { createPendingVerification } from "../../src/db/kv.ts";
import type { PendingVerification } from "../../schemas/pendingVerification.ts";
import { TOKEN_EXPIRY_MS } from "../../schemas/pendingVerification.ts";

function makePendingVerification(
  overrides?: Partial<PendingVerification>,
): PendingVerification {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    username: "testuser",
    email: "test@example.com",
    token: crypto.randomUUID(),
    code: "654321",
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
    ...overrides,
  };
}

Deno.test("#rt1 POST /verify_code returns 400 for missing body", async () => {
  const app = createApp();
  const res = await app.request("/verify_code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
});

Deno.test("#rt2 POST /verify_code returns 400 when code is missing", async () => {
  const app = createApp();
  const res = await app.request("/verify_code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      npub: "npub1abc",
      token: crypto.randomUUID(),
    }),
  });
  expect(res.status).toBe(400);
});

Deno.test("#rt3 POST /verify_code returns 401 when no pending verification", async () => {
  const app = createApp();
  const res = await app.request("/verify_code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      npub: "npub1abc",
      token: crypto.randomUUID(),
      code: "123456",
    }),
  });
  expect(res.status).toBe(401);
});

Deno.test("#rt4 POST /verify_code returns 401 for wrong code", async () => {
  const verification = makePendingVerification({ code: "654321" });
  await createPendingVerification(verification);

  const app = createApp();
  const res = await app.request("/verify_code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      npub: "npub1abc",
      token: verification.token,
      code: "000000",
    }),
  });
  expect(res.status).toBe(401);
});

Deno.test("#rt5 POST /request_token returns 400 for missing username", async () => {
  const app = createApp();
  const res = await app.request("/request_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
});
