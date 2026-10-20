import { expect } from "jsr:@std/expect";
import {
  closeKv,
  createTokenRequest,
  deleteTokenRequest,
  getKv,
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
  TOKEN_EXPIRY_MS,
  type TokenRequest,
  VERIFY_TOKEN_WINDOW_MS,
} from "../../schemas/tokenRequest.ts";

async function withTestKv(
  fn: (kv: Deno.Kv) => Promise<void>,
): Promise<void> {
  const kv = await Deno.openKv(":memory:");
  await setKv(kv);
  try {
    await fn(kv);
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

async function withFakeNow(
  now: number,
  fn: () => Promise<void>,
): Promise<void> {
  const realNow = Date.now;
  Date.now = () => now;
  try {
    await fn();
  } finally {
    Date.now = realNow;
  }
}

Deno.test("#kv1 getKv returns the injected store and reuses it", async () => {
  await withTestKv(async (kv) => {
    expect(await getKv()).toBe(kv);
    expect(await getKv()).toBe(kv);
  });
});

Deno.test("#kv2 getKv opens the configured store when none is set", async () => {
  await closeKv();
  try {
    const first = await getKv();
    expect(await getKv()).toBe(first);
  } finally {
    await closeKv();
  }
});

Deno.test("#kv3 closeKv is safe without an open store and forces a reopen", async () => {
  await closeKv();
  await closeKv();

  const kv = await Deno.openKv(":memory:");
  await setKv(kv);
  await closeKv();
  try {
    expect(await getKv()).not.toBe(kv);
  } finally {
    await closeKv();
  }
});

Deno.test("#kv4 createTokenRequest stores the request under tokenRequests/username", async () => {
  await withTestKv(async (kv) => {
    const request = makeTokenRequest();
    await createTokenRequest(request);

    const entry = await kv.get<TokenRequest>(["tokenRequests", "testuser"]);
    expect(entry.value).toEqual(request);
  });
});

Deno.test("#kv5 createTokenRequest replaces an earlier request for the same user", async () => {
  await withTestKv(async () => {
    await createTokenRequest(makeTokenRequest({ code: "111111" }));
    await createTokenRequest(makeTokenRequest({ code: "222222" }));

    expect((await getTokenRequest("testuser"))?.code).toBe("222222");
  });
});

Deno.test("#kv6 createTokenRequest sets the KV TTL to the request's lifetime", async () => {
  await withTestKv(async (kv) => {
    const expireIns: (number | undefined)[] = [];
    const realSet = kv.set.bind(kv);
    kv.set = (key, value, options) => {
      expireIns.push(options?.expireIn);
      return realSet(key, value, options);
    };

    const createdAt = Date.now();
    await createTokenRequest(
      makeTokenRequest({ createdAt, expiresAt: createdAt + 1234 }),
    );

    expect(expireIns).toEqual([1234]);
  });
});

Deno.test("#kv7 getTokenRequest returns null for an unknown user", async () => {
  await withTestKv(async () => {
    expect(await getTokenRequest("nobody")).toBeNull();
  });
});

Deno.test("#kv8 getTokenRequest keeps requests per username", async () => {
  await withTestKv(async () => {
    await createTokenRequest(makeTokenRequest({ username: "alice" }));
    await createTokenRequest(makeTokenRequest({ username: "bob" }));

    expect((await getTokenRequest("alice"))?.username).toBe("alice");
    expect((await getTokenRequest("bob"))?.username).toBe("bob");
  });
});

Deno.test("#kv9 getTokenRequest deletes and hides a request past expiresAt even if KV still has it", async () => {
  await withTestKv(async (kv) => {
    const now = Date.now();
    await createTokenRequest(
      makeTokenRequest({ createdAt: now, expiresAt: now + 1000 }),
    );

    await withFakeNow(now + 1001, async () => {
      expect(await getTokenRequest("testuser")).toBeNull();
    });

    expect((await kv.get(["tokenRequests", "testuser"])).value).toBeNull();
  });
});

Deno.test("#kv10 getTokenRequest still returns a request exactly at expiresAt", async () => {
  await withTestKv(async () => {
    const now = Date.now();
    const request = makeTokenRequest({
      createdAt: now,
      expiresAt: now + 1000,
    });
    await createTokenRequest(request);

    await withFakeNow(now + 1000, async () => {
      expect(await getTokenRequest("testuser")).toEqual(request);
    });
  });
});

Deno.test("#kv11 deleteTokenRequest removes only that user's request", async () => {
  await withTestKv(async () => {
    await createTokenRequest(makeTokenRequest({ username: "alice" }));
    await createTokenRequest(makeTokenRequest({ username: "bob" }));

    await deleteTokenRequest("alice");

    expect(await getTokenRequest("alice")).toBeNull();
    expect(await getTokenRequest("bob")).not.toBeNull();
  });
});

Deno.test("#kv12 deleteTokenRequest is a no-op for an unknown user", async () => {
  await withTestKv(async () => {
    await deleteTokenRequest("nobody");
    expect(await getTokenRequest("nobody")).toBeNull();
  });
});

Deno.test("#kv13 reserveVerifyAttempt counts up to the limit and returns the incremented request", async () => {
  await withTestKv(async () => {
    await createTokenRequest(makeTokenRequest());

    for (let i = 1; i <= MAX_VERIFY_ATTEMPTS; i++) {
      expect((await reserveVerifyAttempt("testuser"))?.attempts).toBe(i);
    }
  });
});

Deno.test("#kv14 reserveVerifyAttempt deletes an expired request and returns null", async () => {
  await withTestKv(async (kv) => {
    const now = Date.now();
    await createTokenRequest(
      makeTokenRequest({ createdAt: now, expiresAt: now + 1000 }),
    );

    await withFakeNow(now + 1000, async () => {
      expect(await reserveVerifyAttempt("testuser")).toBeNull();
    });

    expect((await kv.get(["tokenRequests", "testuser"])).value).toBeNull();
  });
});

Deno.test("#kv15 reserveVerifyAttempt keeps only the remaining lifetime as TTL", async () => {
  await withTestKv(async (kv) => {
    const now = Date.now();
    await createTokenRequest(
      makeTokenRequest({ createdAt: now - 5000, expiresAt: now + 10_000 }),
    );

    const expireIns: (number | undefined)[] = [];
    const realAtomic = kv.atomic.bind(kv);
    kv.atomic = () => {
      const op = realAtomic();
      const realSet = op.set.bind(op);
      op.set = (key, value, options) => {
        expireIns.push(options?.expireIn);
        return realSet(key, value, options);
      };
      return op;
    };

    await withFakeNow(now + 4000, async () => {
      await reserveVerifyAttempt("testuser");
    });

    expect(expireIns).toEqual([6000]);
  });
});

Deno.test("#kv16 reserveVerifyAttempt deletes a request that already used its attempts", async () => {
  await withTestKv(async (kv) => {
    await createTokenRequest(
      makeTokenRequest({ attempts: MAX_VERIFY_ATTEMPTS }),
    );

    expect(await reserveVerifyAttempt("testuser")).toBeNull();
    expect((await kv.get(["tokenRequests", "testuser"])).value).toBeNull();
  });
});

Deno.test("#kv17 reserveVerifyAttempt returns null when the counter stays contended", async () => {
  await withTestKv(async (kv) => {
    const request = makeTokenRequest();
    await createTokenRequest(request);

    const realAtomic = kv.atomic.bind(kv);
    kv.atomic = () => {
      // Bump the stored version before every commit so the check always fails.
      const op = realAtomic();
      const realCommit = op.commit.bind(op);
      op.commit = async () => {
        await kv.set(["tokenRequests", "testuser"], { ...request });
        return await realCommit();
      };
      return op;
    };

    expect(await reserveVerifyAttempt("testuser")).toBeNull();
    kv.atomic = realAtomic;
    expect((await getTokenRequest("testuser"))?.attempts).toBeUndefined();
  });
});

Deno.test("#kv18 tryReserveVerifyTokenSlot reports retryAfterSeconds until the window ends", async () => {
  await withTestKv(async () => {
    const windowStart = Math.floor(Date.now() / VERIFY_TOKEN_WINDOW_MS) *
      VERIFY_TOKEN_WINDOW_MS;

    await withFakeNow(windowStart + VERIFY_TOKEN_WINDOW_MS - 1500, async () => {
      expect((await tryReserveVerifyTokenSlot("user-a")).retryAfterSeconds)
        .toBe(2);
    });
  });
});

Deno.test("#kv19 the global verify_token and verify attempt counters are independent", async () => {
  await withTestKv(async () => {
    for (let i = 0; i < MAX_VERIFY_TOKEN_GLOBAL_PER_WINDOW; i++) {
      await tryReserveGlobalVerifyTokenSlot();
    }

    expect((await tryReserveGlobalVerifyTokenSlot()).allowed).toBe(false);
    expect(await tryReserveGlobalVerifyAttemptSlot()).toMatchObject({
      allowed: true,
      count: 1,
    });
  });
});

Deno.test("#kv20 the global attempt cap is enforced and counts are reported", async () => {
  await withTestKv(async () => {
    for (let i = 1; i <= MAX_VERIFY_ATTEMPTS_GLOBAL_PER_WINDOW; i++) {
      expect(await tryReserveGlobalVerifyAttemptSlot()).toMatchObject({
        allowed: true,
        count: i,
      });
    }

    expect(await tryReserveGlobalVerifyAttemptSlot()).toMatchObject({
      allowed: false,
      count: MAX_VERIFY_ATTEMPTS_GLOBAL_PER_WINDOW,
    });
  });
});

Deno.test("#kv21 per-user counters do not affect the global ones", async () => {
  await withTestKv(async () => {
    await tryReserveVerifyTokenSlot("user-a");

    expect((await tryReserveGlobalVerifyTokenSlot()).count).toBe(1);
  });
});

Deno.test("#kv22 counters are stored per scope and window index", async () => {
  await withTestKv(async (kv) => {
    await tryReserveVerifyTokenSlot("user-a");

    const windowIndex = Math.floor(Date.now() / VERIFY_TOKEN_WINDOW_MS);
    const entry = await kv.get<{ count: number }>([
      "verifyTokenRate",
      "user",
      "user-a",
      windowIndex,
    ]);
    expect(entry.value).toEqual({ count: 1 });
  });
});
