import { expect } from "jsr:@std/expect";
import { createApp } from "../../src/server.ts";
import {
  createPendingVerification,
  getPendingVerification,
} from "../../src/db/kv.ts";
import type { PendingVerification } from "../../schemas/pendingVerification.ts";
import {
  MAX_VERIFY_ATTEMPTS,
  TOKEN_EXPIRY_MS,
} from "../../schemas/pendingVerification.ts";

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
    attempts: 0,
    ...overrides,
  };
}

async function postVerifyCode(
  app: ReturnType<typeof createApp>,
  body: { token: string; code: string; npub: string },
): Promise<Response> {
  return await app.request("/verify_code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

Deno.test("#rt6 POST /verify_code locks out after MAX_VERIFY_ATTEMPTS wrong codes", async () => {
  const verification = makePendingVerification({ code: "111111" });
  await createPendingVerification(verification);

  const app = createApp();

  // Burn MAX_VERIFY_ATTEMPTS wrong-code attempts. Each returns 401 "Invalid
  // code"; the last one also triggers the lockout (record deletion).
  for (const _attempt of Array(MAX_VERIFY_ATTEMPTS).keys()) {
    const res = await postVerifyCode(app, {
      token: verification.token,
      code: "000000",
      npub: "npub1abc",
    });
    expect(res.status).toBe(401);
  }

  // The pending verification should now be gone from KV.
  const reread = await getPendingVerification(verification.token);
  expect(reread).toBeNull();

  // A subsequent attempt — even with the correct code — falls through to the
  // generic "No pending verification or token expired" branch. The attacker
  // cannot distinguish a lockout from a naturally expired token.
  const postLockout = await postVerifyCode(app, {
    token: verification.token,
    code: "111111",
    npub: "npub1abc",
  });
  expect(postLockout.status).toBe(401);
  const postLockoutBody = await postLockout.json();
  expect(postLockoutBody.error).toBe(
    "No pending verification or token expired",
  );
});

Deno.test("#rt7 POST /verify_code MAX-th wrong code still returns 'Invalid code'", async () => {
  // Locks in the message-consistency security property: the lockout-triggering
  // call returns the same "Invalid code" message as any other wrong-code call,
  // so an attacker cannot detect the lockout from the triggering response
  // alone — they only see it on their *next* call (#rt6 covers that).
  const verification = makePendingVerification({ code: "222222" });
  await createPendingVerification(verification);

  const app = createApp();

  // First MAX-1 wrong attempts.
  for (const _attempt of Array(MAX_VERIFY_ATTEMPTS - 1).keys()) {
    const res = await postVerifyCode(app, {
      token: verification.token,
      code: "000000",
      npub: "npub1abc",
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid code");
  }

  // The MAX-th wrong attempt — the one that triggers the lockout.
  const triggering = await postVerifyCode(app, {
    token: verification.token,
    code: "000000",
    npub: "npub1abc",
  });
  expect(triggering.status).toBe(401);
  const triggeringBody = await triggering.json();
  expect(triggeringBody.error).toBe("Invalid code");
});
