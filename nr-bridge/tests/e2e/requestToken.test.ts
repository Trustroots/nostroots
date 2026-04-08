import { expect } from "jsr:@std/expect";
import { MongoClient } from "mongodb";
import { createApp } from "../../src/server.ts";
import { MONGODB_DB_NAME, MONGODB_URI } from "../../src/config.ts";
import { kv, KV_KEYS } from "../../src/db/kv.ts";
import {
  MAX_REQUEST_TOKEN_PER_WINDOW,
  REQUEST_TOKEN_WINDOW_MS,
} from "../../schemas/pendingVerification.ts";

async function seedUser(
  client: MongoClient,
  user: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  },
): Promise<string> {
  const db = client.db(MONGODB_DB_NAME);
  await db.collection("users").updateOne(
    { username: user.username },
    {
      $set: user,
      $setOnInsert: { created: new Date(), roles: ["user"], public: true },
    },
    { upsert: true },
  );
  const inserted = await db.collection("users").findOne(
    { username: user.username },
    { projection: { _id: 1 } },
  );
  if (!inserted) throw new Error(`failed to seed user ${user.username}`);
  return inserted._id.toString();
}

async function cleanupUser(
  client: MongoClient,
  username: string,
): Promise<void> {
  const db = client.db(MONGODB_DB_NAME);
  await db.collection("users").deleteOne({ username });
}

/**
 * Read the body and headers of a 429 response in a comparable shape so two
 * 429s from different code paths can be asserted byte-equal.
 */
async function captureRateLimitedResponse(
  res: Response,
): Promise<
  { status: number; retryAfter: string | null; body: unknown }
> {
  return {
    status: res.status,
    retryAfter: res.headers.get("Retry-After"),
    body: await res.json(),
  };
}

const expectedRetryAfter = String(Math.ceil(REQUEST_TOKEN_WINDOW_MS / 1000));

Deno.test({
  name: "#e2e1 POST /request_token validation and unknown-user paths",
  async fn() {
    const client = new MongoClient(MONGODB_URI);
    const unknownUsername = `nonexistent_e2e_user_${
      crypto.randomUUID().slice(0, 8)
    }`;

    try {
      await client.connect();
      await seedUser(client, {
        username: "e2etestuser",
        email: "e2e@test.example.com",
        firstName: "E2E",
        lastName: "Test",
      });

      const app = createApp();

      // Test: missing username returns 400
      const res400 = await app.request("/request_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res400.status).toBe(400);

      // Test: nonexistent user returns 200 with a throw-away token (silent
      // success to prevent username enumeration). The token will not
      // correspond to a real PendingVerification in KV, so any later
      // /verify_code attempt with it will fail with the same 401 as an
      // expired token.
      const resUnknown = await app.request("/request_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: unknownUsername }),
      });
      expect(resUnknown.status).toBe(200);
      const unknownBody = await resUnknown.json();
      expect(typeof unknownBody.token).toBe("string");
      expect(unknownBody.token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    } finally {
      await cleanupUser(client, "e2etestuser");
      await kv.delete([
        KV_KEYS.requestTokenRate,
        "input",
        unknownUsername.toLowerCase(),
      ]);
      await client.close();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "#e2e5 POST /request_token returns 429 after MAX calls for a real user",
  async fn() {
    const client = new MongoClient(MONGODB_URI);
    const username = `e2eratelimit_${crypto.randomUUID().slice(0, 8)}`;

    try {
      await client.connect();
      const userId = await seedUser(client, {
        username,
        email: `${username}@test.example.com`,
        firstName: "Rate",
        lastName: "Limit",
      });

      try {
        const app = createApp();

        // The first MAX_REQUEST_TOKEN_PER_WINDOW calls reach the email-send
        // step. Tests use dummy SMTP credentials that fail to connect, so the
        // throw propagates and Hono returns 500. The throttle counter is
        // incremented *before* the email send (by design), so it still
        // reaches the limit after MAX calls regardless of SMTP outcome.
        for (const _attempt of Array(MAX_REQUEST_TOKEN_PER_WINDOW).keys()) {
          const res = await app.request("/request_token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
          });
          expect(res.status).toBe(500);
        }

        // The next call must be throttled.
        const limited = await app.request("/request_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        const captured = await captureRateLimitedResponse(limited);
        expect(captured.status).toBe(429);
        expect(captured.retryAfter).toBe(expectedRetryAfter);
        expect(captured.body).toEqual({
          error: "Too many verification requests, try again later",
        });
      } finally {
        await cleanupUser(client, username);
        await kv.delete([KV_KEYS.requestTokenRate, "uid", userId]);
      }
    } finally {
      await client.close();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name:
    "#e2e6 POST /request_token returns 429 after MAX calls for an unknown user, byte-identical to the real-user 429",
  async fn() {
    const client = new MongoClient(MONGODB_URI);
    const realUsername = `e2eparity_${crypto.randomUUID().slice(0, 8)}`;
    const unknownUsername = `nonexistent_parity_${
      crypto.randomUUID().slice(0, 8)
    }`;

    try {
      await client.connect();
      const realUserId = await seedUser(client, {
        username: realUsername,
        email: `${realUsername}@test.example.com`,
        firstName: "Parity",
        lastName: "Real",
      });

      try {
        const app = createApp();

        // Drive the unknown-user branch to its limit.
        for (const _attempt of Array(MAX_REQUEST_TOKEN_PER_WINDOW).keys()) {
          const res = await app.request("/request_token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: unknownUsername }),
          });
          expect(res.status).toBe(200);
        }
        const unknownLimited = await app.request("/request_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: unknownUsername }),
        });
        const unknownCaptured = await captureRateLimitedResponse(
          unknownLimited,
        );
        expect(unknownCaptured.status).toBe(429);

        // Drive the real-user branch to its limit (each call returns 500 due
        // to SMTP failure, but the counter still increments — see #e2e5).
        for (const _attempt of Array(MAX_REQUEST_TOKEN_PER_WINDOW).keys()) {
          const res = await app.request("/request_token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: realUsername }),
          });
          expect(res.status).toBe(500);
        }
        const realLimited = await app.request("/request_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: realUsername }),
        });
        const realCaptured = await captureRateLimitedResponse(realLimited);
        expect(realCaptured.status).toBe(429);

        // Critical: the two 429 responses must be byte-identical. Any
        // divergence (status, header, body) re-opens the enumeration oracle
        // that d0fed8e closed.
        expect(unknownCaptured).toEqual(realCaptured);
      } finally {
        await cleanupUser(client, realUsername);
        await kv.delete([KV_KEYS.requestTokenRate, "uid", realUserId]);
        await kv.delete([
          KV_KEYS.requestTokenRate,
          "input",
          unknownUsername.toLowerCase(),
        ]);
      }
    } finally {
      await client.close();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name:
    "#e2e7 request_token rate limits for input and uid namespaces are isolated",
  async fn() {
    const client = new MongoClient(MONGODB_URI);
    const realUsername = `e2eiso_${crypto.randomUUID().slice(0, 8)}`;
    const unknownUsername = `nonexistent_iso_${
      crypto.randomUUID().slice(0, 8)
    }`;

    try {
      await client.connect();
      const realUserId = await seedUser(client, {
        username: realUsername,
        email: `${realUsername}@test.example.com`,
        firstName: "Iso",
        lastName: "Test",
      });

      try {
        const app = createApp();

        // Burn the input-namespace limit.
        for (const _attempt of Array(MAX_REQUEST_TOKEN_PER_WINDOW).keys()) {
          const res = await app.request("/request_token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: unknownUsername }),
          });
          expect(res.status).toBe(200);
        }
        const inputBlocked = await app.request("/request_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: unknownUsername }),
        });
        expect(inputBlocked.status).toBe(429);

        // The uid namespace must still have its full allowance — none of the
        // calls below should hit 429. They each return 500 because SMTP
        // fails, but that's fine: 500 means the route reached the email-send
        // step, which only happens after the throttle check passed.
        for (const _attempt of Array(MAX_REQUEST_TOKEN_PER_WINDOW).keys()) {
          const res = await app.request("/request_token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: realUsername }),
          });
          expect(res.status).toBe(500);
        }
      } finally {
        await cleanupUser(client, realUsername);
        await kv.delete([KV_KEYS.requestTokenRate, "uid", realUserId]);
        await kv.delete([
          KV_KEYS.requestTokenRate,
          "input",
          unknownUsername.toLowerCase(),
        ]);
      }
    } finally {
      await client.close();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
