import { expect } from "jsr:@std/expect";
import { createApp } from "../../src/server.ts";
import { setKv, closeKv } from "../../src/db/kv.ts";
import { createTokenRequest } from "../../src/db/kv.ts";
import type { TokenRequest } from "../../schemas/tokenRequest.ts";
import { TOKEN_EXPIRY_MS } from "../../schemas/tokenRequest.ts";

// These tests mock MongoDB and SMTP by overriding the modules used by routes.
// For the route-level unit tests we inject a test KV and skip real MongoDB/SMTP
// by testing just the authenticate route with pre-seeded KV data.

async function withTestKv(fn: () => Promise<void>): Promise<void> {
  const kv = await Deno.openKv(":memory:");
  await setKv(kv);
  try {
    await fn();
  } finally {
    await closeKv();
  }
}

function makeTokenRequest(overrides?: Partial<TokenRequest>): TokenRequest {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    username: "testuser",
    email: "test@example.com",
    code: "654321",
    token: crypto.randomUUID(),
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
    ...overrides,
  };
}

Deno.test("#rt1 POST /authenticate returns 400 for missing body", async () => {
  await withTestKv(async () => {
    const app = createApp();
    const res = await app.request("/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

Deno.test("#rt2 POST /authenticate returns 400 when neither code nor token", async () => {
  await withTestKv(async () => {
    const app = createApp();
    const res = await app.request("/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        npub: "npub1abc",
      }),
    });
    expect(res.status).toBe(400);
  });
});

Deno.test("#rt3 POST /authenticate returns 401 when no pending verification", async () => {
  await withTestKv(async () => {
    const app = createApp();
    const res = await app.request("/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        npub: "npub1abc",
        code: "123456",
      }),
    });
    expect(res.status).toBe(401);
  });
});

Deno.test("#rt4 POST /authenticate returns 401 for wrong code", async () => {
  await withTestKv(async () => {
    const req = makeTokenRequest({ code: "654321" });
    await createTokenRequest(req);

    const app = createApp();
    const res = await app.request("/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        npub: "npub1abc",
        code: "000000",
      }),
    });
    expect(res.status).toBe(401);
  });
});

Deno.test("#rt5 POST /verify_token returns 400 for missing username", async () => {
  await withTestKv(async () => {
    const app = createApp();
    const res = await app.request("/verify_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
