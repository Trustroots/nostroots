import { expect } from "jsr:@std/expect";
import { createApp } from "../../src/server.ts";
import {
  closeKv,
  createTokenRequest,
  getTokenRequest,
  reserveVerifyAttempt,
  setKv,
  tryReserveGlobalVerifyAttemptSlot,
  tryReserveGlobalVerifyTokenSlot,
  tryReserveVerifyTokenSlot,
} from "../../src/db/kv.ts";
import {
  MAX_VERIFY_ATTEMPTS,
  MAX_VERIFY_ATTEMPTS_GLOBAL_PER_WINDOW,
  MAX_VERIFY_TOKEN_GLOBAL_PER_WINDOW,
  MAX_VERIFY_TOKEN_PER_WINDOW,
  TOKEN_EXPIRY_MS,
  type TokenRequest,
  VERIFY_TOKEN_WINDOW_MS,
} from "../../schemas/tokenRequest.ts";

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

async function authenticate(
  code: string,
  username = "testuser",
): Promise<{ status: number; error: string }> {
  const res = await createApp().request("/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, npub: "npub1abc", code }),
  });
  return { status: res.status, error: (await res.json()).error };
}

const NO_PENDING = "No pending verification or code expired";
const INVALID = "Invalid code or token";

Deno.test("#rl1 reserveVerifyAttempt returns null without a pending request", async () => {
  await withTestKv(async () => {
    expect(await reserveVerifyAttempt("testuser")).toBeNull();
  });
});

Deno.test("#rl2 reserveVerifyAttempt counts each submission and keeps the expiry", async () => {
  await withTestKv(async () => {
    const request = makeTokenRequest();
    await createTokenRequest(request);

    expect(await reserveVerifyAttempt("testuser")).toEqual({
      ...request,
      attempts: 1,
    });
    const stored = await getTokenRequest("testuser");
    expect(stored?.attempts).toBe(1);
    expect(stored?.expiresAt).toBe(request.expiresAt);
  });
});

Deno.test("#rl3 reserveVerifyAttempt deletes the request once attempts are used up", async () => {
  await withTestKv(async () => {
    await createTokenRequest(
      makeTokenRequest({ attempts: MAX_VERIFY_ATTEMPTS - 1 }),
    );

    expect((await reserveVerifyAttempt("testuser"))?.attempts).toBe(
      MAX_VERIFY_ATTEMPTS,
    );
    expect(await reserveVerifyAttempt("testuser")).toBeNull();
    expect(await getTokenRequest("testuser")).toBeNull();
  });
});

Deno.test("#rl4 POST /authenticate locks out after too many wrong codes", async () => {
  await withTestKv(async () => {
    await createTokenRequest(makeTokenRequest({ code: "654321" }));

    for (let i = 0; i < MAX_VERIFY_ATTEMPTS; i++) {
      expect(await authenticate("000000")).toEqual({
        status: 401,
        error: INVALID,
      });
    }

    expect(await authenticate("654321")).toEqual({
      status: 401,
      error: NO_PENDING,
    });
  });
});

Deno.test("#rl4b POST /authenticate counts every guess it compares in a parallel burst", async () => {
  await withTestKv(async () => {
    await createTokenRequest(makeTokenRequest({ code: "654321" }));

    const results = await Promise.all(
      Array.from({ length: 20 }, () => authenticate("000000")),
    );

    // Contended attempts are rejected without a comparison (401, or 429 when
    // the global counter is contended), so the burst may use up fewer than the
    // limit, but every comparison must be counted.
    const compared = results.filter((result) => result.error === INVALID);
    expect(results.every((result) => [401, 429].includes(result.status))).toBe(
      true,
    );
    expect(compared.length).toBeLessThanOrEqual(MAX_VERIFY_ATTEMPTS);
    expect(
      (await getTokenRequest("testuser"))?.attempts ?? MAX_VERIFY_ATTEMPTS,
    ).toBe(compared.length);
  });
});

Deno.test("#rl4c POST /authenticate matches the request regardless of username case", async () => {
  await withTestKv(async () => {
    await createTokenRequest(makeTokenRequest({ code: "654321" }));

    await authenticate("000000", "TestUser");

    expect((await getTokenRequest("testuser"))?.attempts).toBe(1);
  });
});

Deno.test("#rl5 tryReserveVerifyTokenSlot allows up to the limit per user", async () => {
  await withTestKv(async () => {
    for (let i = 1; i <= MAX_VERIFY_TOKEN_PER_WINDOW; i++) {
      expect(await tryReserveVerifyTokenSlot("user-a")).toMatchObject({
        allowed: true,
        count: i,
      });
    }
    const denied = await tryReserveVerifyTokenSlot("user-a");
    expect(denied).toMatchObject({
      allowed: false,
      count: MAX_VERIFY_TOKEN_PER_WINDOW,
    });
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(
      VERIFY_TOKEN_WINDOW_MS / 1000,
    );
    expect((await tryReserveVerifyTokenSlot("user-b")).allowed).toBe(true);
  });
});

Deno.test("#rl5b tryReserveVerifyTokenSlot starts over in the next window", async () => {
  const realNow = Date.now;
  const windowStart = Math.ceil(realNow() / VERIFY_TOKEN_WINDOW_MS) *
    VERIFY_TOKEN_WINDOW_MS;
  try {
    await withTestKv(async () => {
      Date.now = () => windowStart + VERIFY_TOKEN_WINDOW_MS - 1;
      for (let i = 0; i < MAX_VERIFY_TOKEN_PER_WINDOW; i++) {
        await tryReserveVerifyTokenSlot("user-a");
      }
      expect((await tryReserveVerifyTokenSlot("user-a")).allowed).toBe(false);

      Date.now = () => windowStart + VERIFY_TOKEN_WINDOW_MS;
      expect(await tryReserveVerifyTokenSlot("user-a")).toMatchObject({
        allowed: true,
        count: 1,
      });
    });
  } finally {
    Date.now = realNow;
  }
});

Deno.test("#rl5c the global verify_token cap is shared by all users", async () => {
  await withTestKv(async () => {
    for (let i = 0; i < MAX_VERIFY_TOKEN_GLOBAL_PER_WINDOW; i++) {
      expect((await tryReserveGlobalVerifyTokenSlot()).allowed).toBe(true);
    }
    expect((await tryReserveGlobalVerifyTokenSlot()).allowed).toBe(false);
  });
});

Deno.test("#rl5d POST /authenticate returns 429 for codes once the global guess cap is used up", async () => {
  await withTestKv(async () => {
    await createTokenRequest(makeTokenRequest({ code: "654321" }));
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS_GLOBAL_PER_WINDOW; i++) {
      await tryReserveGlobalVerifyAttemptSlot();
    }

    const res = await createApp().request("/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        npub: "npub1abc",
        code: "000000",
      }),
    });

    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

Deno.test("#rl5f a 429 from the global guess cap doesn't use up the request's attempts", async () => {
  await withTestKv(async () => {
    await createTokenRequest(makeTokenRequest({ code: "654321" }));
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS_GLOBAL_PER_WINDOW; i++) {
      await tryReserveGlobalVerifyAttemptSlot();
    }

    for (let i = 0; i <= MAX_VERIFY_ATTEMPTS; i++) {
      expect((await authenticate("654321")).status).toBe(429);
    }

    expect((await getTokenRequest("testuser"))?.attempts ?? 0).toBe(0);
  });
});

Deno.test("#rl5e deep-link tokens aren't counted against the global guess cap", async () => {
  await withTestKv(async () => {
    await createTokenRequest(makeTokenRequest());
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS_GLOBAL_PER_WINDOW; i++) {
      await tryReserveGlobalVerifyAttemptSlot();
    }

    const res = await createApp().request("/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        npub: "npub1abc",
        token: crypto.randomUUID(),
      }),
    });

    expect(res.status).toBe(401);
  });
});

// Contended commits fail closed, so a burst may admit fewer than the limit.
Deno.test("#rl6 tryReserveVerifyTokenSlot never over-admits a parallel burst", async () => {
  await withTestKv(async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => tryReserveVerifyTokenSlot("user-a")),
    );
    const admitted = results.filter((result) => result.allowed).length;
    expect(admitted).toBeLessThanOrEqual(MAX_VERIFY_TOKEN_PER_WINDOW);
    expect(admitted).toBeGreaterThan(0);
  });
});
